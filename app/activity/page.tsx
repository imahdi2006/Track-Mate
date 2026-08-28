"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { useSessionStore } from "@/lib/store/session-store";

function ActivityInner() {
  const profile = useSessionStore((s) => s.profile)!;
  const buddy = useSessionStore((s) => s.buddy);
  const activities = useSessionStore((s) => s.activities);
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Activity</h1>
        <ThemeSwitch />
      </header>
      <ActivityFeed activities={activities} me={profile} buddy={buddy} />
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AppShell>
      <ActivityInner />
    </AppShell>
  );
}
