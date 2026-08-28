"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store/session-store";

/**
 * Ensures the session store is hydrated and the realtime adapter
 * subscription is alive for the lifetime of the signed-in shell.
 */
export function useRealtimeProgress() {
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrated = useSessionStore((s) => s.hydrated);
  const replay = useSessionStore((s) => s.replayOfflineQueue);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    const onOnline = () => {
      void replay();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [replay]);

  return { hydrated };
}
