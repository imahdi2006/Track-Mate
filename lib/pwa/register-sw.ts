"use client";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await reg.update();
    return reg;
  } catch (err) {
    console.warn("[PageMate] service worker registration failed", err);
    return null;
  }
}
