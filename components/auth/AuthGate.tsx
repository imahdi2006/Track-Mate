"use client";

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/lib/store/session-store";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { PairingScreen } from "@/components/auth/PairingScreen";
import { LoadingScreen } from "@/components/ui/Loader";
import {
  clearPendingJoinCode,
  readPendingBookId,
  readPendingJoinCode,
  takePendingBookId,
} from "@/lib/invite";
import { useToastStore } from "@/lib/store/toast-store";

/**
 * After sign-in, users who already have a room never see PairingScreen, so a
 * pending /join/{code} invite would be ignored. Consume it here.
 */
function PendingJoinConsumer({ children }: { children: React.ReactNode }) {
  const joinRoom = useSessionStore((s) => s.joinRoom);
  const profile = useSessionStore((s) => s.profile);
  const room = useSessionStore((s) => s.room);
  const ran = useRef(false);

  useEffect(() => {
    if (!profile || !room || ran.current) return;
    const code = readPendingJoinCode();
    if (!code) return;
    ran.current = true;
    const bookId = readPendingBookId();
    void joinRoom(code, bookId)
      .then(() => {
        clearPendingJoinCode();
        takePendingBookId();
        useToastStore.getState().push({
          title: "You’re in the room",
          body: bookId
            ? "You can open this title together — not their whole library."
            : "Shared titles will show up here.",
          tone: "success",
        });
        if (bookId && typeof window !== "undefined") {
          window.location.replace(`/book/${bookId}`);
        }
      })
      .catch((err) => {
        ran.current = false;
        takePendingBookId();
        clearPendingJoinCode();
        useToastStore.getState().push({
          title: "Couldn’t join",
          body: err instanceof Error ? err.message : "Check the invite and try again.",
          tone: "warn",
        });
      });
  }, [profile, room, joinRoom]);

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useSessionStore((s) => s.hydrated);
  const hydrating = useSessionStore((s) => s.hydrating);
  const profile = useSessionStore((s) => s.profile);
  const room = useSessionStore((s) => s.room);

  if (!hydrated || hydrating) {
    return <LoadingScreen label="Opening your library…" />;
  }

  if (!profile) return <AuthScreen />;
  if (!room) return <PairingScreen />;
  return <PendingJoinConsumer>{children}</PendingJoinConsumer>;
}
