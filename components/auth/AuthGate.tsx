"use client";

import { useSessionStore } from "@/lib/store/session-store";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { PairingScreen } from "@/components/auth/PairingScreen";
import { LoadingScreen } from "@/components/ui/Loader";

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
  return <>{children}</>;
}
