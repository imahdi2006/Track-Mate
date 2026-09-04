"use client";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await reg.update();
    // First install only — if a controller already exists, leave the waiting
    // worker so UpdateToast can ask before restarting.
    if (reg.waiting && !navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    return reg;
  } catch (err) {
    console.warn("[BookMate] service worker registration failed", err);
    return null;
  }
}
