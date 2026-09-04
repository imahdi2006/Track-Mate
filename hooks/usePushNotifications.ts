"use client";

import { useCallback, useEffect, useState } from "react";
import { PUSH_PROMPT_SEEN_KEY, isVapidConfigured } from "@/lib/config";
import { urlBase64ToUint8Array } from "@/lib/pwa/vapid";
import { useSessionStore } from "@/lib/store/session-store";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pair = useSessionStore((s) => s.room);
  const profile = useSessionStore((s) => s.profile);
  const savePushSubscription = useSessionStore((s) => s.savePushSubscription);
  const removePushSubscription = useSessionStore((s) => s.removePushSubscription);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const persistSub = useCallback(
    async (sub: PushSubscription) => {
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) return false;
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      setSubscribed(true);
      return true;
    },
    [savePushSubscription],
  );

  /**
   * Browsers drop or rotate push endpoints without always firing
   * `pushsubscriptionchange`. Re-upsert the live subscription whenever the
   * app opens (or the tab comes back) so pings keep arriving.
   */
  const heal = useCallback(async () => {
    if (!supported || !isVapidConfigured()) return false;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");
      return false;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        });
      }
      const ok = await persistSub(sub);
      setPermission("granted");
      return ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t refresh push.");
      return false;
    }
  }, [supported, persistSub]);

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    void navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    });
  }, [supported]);

  useEffect(() => {
    if (!profile || !supported) return;
    void heal();
    const onVisible = () => {
      if (document.visibilityState === "visible") void heal();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [profile, supported, heal]);

  useEffect(() => {
    if (!pair || !supported || permission !== "default") return;
    if (!isVapidConfigured()) return;
    if (localStorage.getItem(PUSH_PROMPT_SEEN_KEY)) return;
    const t = window.setTimeout(() => setPromptOpen(true), 1800);
    return () => window.clearTimeout(t);
  }, [pair, supported, permission]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      setError("Push is not supported in this browser.");
      return false;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      setError("Push notifications aren’t set up on this app yet.");
      return false;
    }
    if (!isStandalone() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setError("On iPhone, add Trackmate to the Home Screen first, then enable push.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError(
          perm === "denied"
            ? "Notifications are blocked. Allow them in the browser site settings, then try again."
            : "Notifications were not granted.",
        );
        return false;
      }
      const ok = await heal();
      if (!ok) {
        setError("Couldn’t subscribe this device. Try again while online.");
        return false;
      }
      localStorage.setItem(PUSH_PROMPT_SEEN_KEY, "1");
      setPromptOpen(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribe failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, heal]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [removePushSubscription]);

  const sendTest = useCallback(async () => {
    const { room, profile: me } = useSessionStore.getState();
    if (!room || !me) {
      setError("Sign in and join a room first.");
      return false;
    }
    try {
      await heal();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const json = sub?.toJSON();
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          actorId: me.id,
          buddyCode: room.inviteCode,
          roomId: room.id,
          subscription:
            sub && json?.keys?.p256dh && json.keys.auth
              ? { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
              : undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; sent?: number; reason?: string };
      if (!data.ok || !data.sent) {
        setError(
          data.reason === "vapid_unconfigured"
            ? "Push keys aren’t loaded. Restart the app after adding VAPID keys."
            : data.reason === "no_subscription"
              ? "This device isn’t subscribed yet. Toggle push on, then try again."
              : "No ping yet — keep this tab open and try again.",
        );
        return false;
      }
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test ping failed");
      return false;
    }
  }, [heal]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(PUSH_PROMPT_SEEN_KEY, "1");
    setPromptOpen(false);
  }, []);

  return {
    supported: supported && isVapidConfigured(),
    permission,
    subscribed,
    busy,
    promptOpen,
    error,
    standalone: isStandalone(),
    subscribe,
    unsubscribe,
    sendTest,
    heal,
    dismissPrompt,
    openPrompt: () => setPromptOpen(true),
  };
}
