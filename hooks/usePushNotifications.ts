"use client";

import { useCallback, useEffect, useState } from "react";
import { PUSH_PROMPT_SEEN_KEY, isVapidConfigured } from "@/lib/config";
import { urlBase64ToUint8Array } from "@/lib/pwa/vapid";
import { useSessionStore } from "@/lib/store/session-store";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pair = useSessionStore((s) => s.room);
  const savePushSubscription = useSessionStore((s) => s.savePushSubscription);
  const removePushSubscription = useSessionStore((s) => s.removePushSubscription);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    void navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    });
  }, [supported]);

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
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notifications were not granted.");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setSubscribed(true);
      localStorage.setItem(PUSH_PROMPT_SEEN_KEY, "1");
      setPromptOpen(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribe failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, savePushSubscription]);

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
    const { room, profile } = useSessionStore.getState();
    if (!room || !profile) {
      setError("Sign in and join a room first.");
      return false;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const json = sub?.toJSON();
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          actorId: profile.id,
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
  }, []);

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
    subscribe,
    unsubscribe,
    sendTest,
    dismissPrompt,
    openPrompt: () => setPromptOpen(true),
  };
}
