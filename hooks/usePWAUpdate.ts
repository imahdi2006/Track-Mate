"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Watches the service worker registration for a waiting worker
 * (a new build sitting in `waiting` after `updatefound` → `installed`).
 */
export function usePWAUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let mounted = true;

    const attach = (reg: ServiceWorkerRegistration) => {
      if (!mounted) return;
      setRegistration(reg);
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateReady(true);
      }
      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(reg.waiting ?? incoming);
            setUpdateReady(true);
          }
        });
      });
    };

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) attach(reg);
    });

    const checkForUpdate = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) void reg.update();
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkForUpdate);
    const interval = window.setInterval(checkForUpdate, 30 * 60 * 1000);

    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkForUpdate);
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const worker = waitingWorker ?? registration?.waiting;
    if (!worker) {
      window.location.reload();
      return;
    }
    worker.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker, registration]);

  const dismiss = useCallback(() => setUpdateReady(false), []);

  /** Manual "Check for updates" — Settings calls this on demand. */
  const checkNow = useCallback(async (): Promise<"update-found" | "up-to-date" | "unsupported"> => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
    setChecking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return "unsupported";
      await reg.update();
      if (reg.waiting) {
        setRegistration(reg);
        setWaitingWorker(reg.waiting);
        setUpdateReady(true);
        return "update-found";
      }
      return "up-to-date";
    } finally {
      setChecking(false);
    }
  }, []);

  return { updateReady, applyUpdate, dismiss, registration, checking, checkNow };
}
