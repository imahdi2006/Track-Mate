/* Trackmate service worker
 *
 * Cache strategy:
 *  - install: pre-cache app shell + offline fallback
 *  - fetch: network-first for navigations, cache-first for static hashed assets
 *  - activate: take control + drop old caches
 *  - push / notificationclick: Web Push surface
 *  - message SKIP_WAITING: update modal orchestration
 */

const CACHE_VERSION = "Trackmate-v13";
const PRECACHE = [
  "/offline",
  "/offline.html",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isNavigation = request.mode === "navigate";
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json";

  if (isNavigation) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStatic) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;
    return (await caches.match("/offline.html")) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  const cache = await caches.open(CACHE_VERSION);
  cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "Trackmate",
    body: "Your buddy just turned a page.",
    url: "/",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  const url = payload.url || (payload.bookId ? `/book/${payload.bookId}` : "/");

  event.waitUntil(
    self.registration.showNotification(payload.title || "Trackmate", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      vibrate: [80, 40, 80, 40, 120],
      data: { url },
      tag: payload.tag || "Trackmate-activity",
      renotify: true,
      actions: [
        { action: "open", title: "Open" },
        { action: "later", title: "Later" },
      ],
    }),
  );
});

/** Same b64url → Uint8Array decode as lib/pwa/vapid.ts — inlined since the SW can't import app modules. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Browsers can rotate/expire a push subscription on their own (quota,
// endpoint TTL). Without handling this, notifications silently stop
// arriving for that device until the user manually re-toggles push in
// Settings. Resubscribe with the same key and tell the server about the
// swap so future sends use the live endpoint.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
      if (!oldEndpoint) return;
      try {
        const keyRes = await fetch("/api/push/vapid-public-key");
        const { key } = await keyRes.json();
        if (!key) return;
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
        const json = newSub.toJSON();
        await fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: newSub.endpoint,
            p256dh: json.keys && json.keys.p256dh,
            auth: json.keys && json.keys.auth,
            userAgent: self.navigator ? self.navigator.userAgent : undefined,
          }),
        });
      } catch {
        // Resubscribe failed (e.g. permission revoked) — tell the server
        // to drop the dead endpoint so it stops wasting sends on it.
        try {
          await fetch("/api/push/resubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldEndpoint }),
          });
        } catch {
          /* best effort */
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "later") return;

  const target = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && target) {
            try {
              await client.navigate(target);
            } catch {
              /* older browsers */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
