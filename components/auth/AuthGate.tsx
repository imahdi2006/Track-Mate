"use client";

import { useSessionStore } from "@/lib/store/session-store";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { PairingScreen } from "@/components/auth/PairingScreen";
import { BookMateLogo } from "@/components/branding/BookMateLogo";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useSessionStore((s) => s.hydrated);
  const hydrating = useSessionStore((s) => s.hydrating);
  const profile = useSessionStore((s) => s.profile);
  const room = useSessionStore((s) => s.room);

  if (!hydrated || hydrating) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <BookMateLogo size={64} />
        <p className="text-sm text-muted">Opening your library…</p>
      </div>
    );
  }

  if (!profile) return <AuthScreen />;
  if (!room) return <PairingScreen />;
  return <>{children}</>;
}
