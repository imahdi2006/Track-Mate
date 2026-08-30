"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import { ActiveBookCard } from "@/components/dashboard/ActiveBookCard";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { useSessionStore } from "@/lib/store/session-store";

export function DashboardScreen() {
  const profile = useSessionStore((s) => s.profile)!;
  const room = useSessionStore((s) => s.room)!;
  const members = useSessionStore((s) => s.members);
  const books = useSessionStore((s) => s.books);
  const progress = useSessionStore((s) => s.progress);
  const activities = useSessionStore((s) => s.activities);

  const others = useMemo(
    () => members.filter((m) => m.userId !== profile.id && m.profile),
    [members, profile.id],
  );
  const buddy = others[0]?.profile ?? null;

  const book = useMemo(
    () => books.find((b) => b.status === "currently_reading") ?? books[0],
    [books],
  );
  const myPage = useMemo(() => {
    if (!book) return 0;
    return progress.find((p) => p.bookId === book.id && p.userId === profile.id)?.currentPage ?? 0;
  }, [book, progress, profile.id]);
  const theirPage = useMemo(() => {
    if (!book || !buddy) return 0;
    return progress.find((p) => p.bookId === book.id && p.userId === buddy.id)?.currentPage ?? 0;
  }, [book, progress, buddy]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <BookMateLogo size={34} withWordmark />
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <div className="flex items-center -space-x-2">
            <Avatar name={profile.displayName} hue={profile.avatarHue} />
            {others.slice(0, 3).map((m) =>
              m.profile ? (
                <Avatar
                  key={m.userId}
                  name={m.profile.displayName}
                  hue={m.profile.avatarHue}
                />
              ) : null,
            )}
          </div>
        </div>
      </header>

      <div className="space-y-1 rounded-2xl bg-white/4 px-3 py-2 text-xs text-muted">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate" dir="auto">
            {room.name}{" "}
            <span className="tracking-widest text-cream">{room.inviteCode}</span>
          </span>
          <span className="shrink-0">
            {members.length}/{room.maxMembers}
            {others.length
              ? ` · ${others.map((m) => m.profile!.displayName).join(", ")}`
              : " · waiting"}
          </span>
        </div>
        {others.length ? (
          <p className="text-brand-glow">Live — page turns sync across devices in this room.</p>
        ) : (
          <p>Share a book from below. After they open the link, their name shows here.</p>
        )}
      </div>

      {book ? (
        <ActiveBookCard
          book={book}
          me={profile}
          buddy={buddy}
          myPage={myPage}
          theirPage={theirPage}
          otherCount={Math.max(0, others.length - 1)}
        />
      ) : (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="font-display text-xl">Your shelf is empty</p>
          <p className="mt-1 text-sm text-muted">
            Add a book in Library — nothing is seeded for you by default.
          </p>
          <Link
            href="/library"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium"
          >
            Add a book
          </Link>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cream">Recent activity</h2>
          <Link href="/activity" className="text-xs text-brand-glow">
            See all
          </Link>
        </div>
        <ActivityFeed activities={activities} me={profile} buddy={buddy} compact />
      </section>
    </div>
  );
}
