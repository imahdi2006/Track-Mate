"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { AuthGate } from "@/components/auth/AuthGate";
import { useRealtimeProgress } from "@/hooks/useRealtimeProgress";

export function AppShell({ children }: { children: React.ReactNode }) {
  useRealtimeProgress();
  return (
    <AuthGate>
      <div className="mx-auto min-h-dvh w-full max-w-lg">
        <main className="safe-bottom px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthGate>
  );
}
