"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageMateLogo } from "@/components/branding/PageMateLogo";
import { ActiveBookCard } from "@/components/dashboard/ActiveBookCard";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { useSessionStore } from "@/lib/store/session-store";

export function DashboardScreen() {
  const profile = useSessionStore((s) => s.profile)!;
  const buddy = useSessionStore((s) => s.buddy);
  const pair = useSessionStore((s) => s.pair)!;
  const books = useSessionStore((s) => s.books);
  const progress = useSessionStore((s) => s.progress);
  const activities = useSessionStore((s) => s.activities);

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
        <PageMateLogo size={34} withWordmark />
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <div className="flex items-center -space-x-2">
            <Avatar name={profile.displayName} hue={profile.avatarHue} />
            {buddy ? <Avatar name={buddy.displayName} hue={buddy.avatarHue} /> : null}
          </div>
        </div>
      </header>

      <div className="space-y-1 rounded-2xl bg-white/4 px-3 py-2 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span>
            Pair <span className="tracking-widest text-cream">{pair.buddyCode}</span>
          </span>
          <span>{buddy ? `live with ${buddy.displayName}` : "not connected"}</span>
        </div>
        {buddy ? (
          <p className="text-brand-glow">Connected — both bars update within a couple of seconds.</p>
        ) : (
          <p>Share this book. After they open the link, this line turns into their name.</p>
        )}
      </div>

      {book ? (
        <ActiveBookCard
          book={book}
          me={profile}
          buddy={buddy}
          myPage={myPage}
          theirPage={theirPage}
        />
      ) : (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="font-display text-xl">Your shelf is empty</p>
          <p className="mt-1 text-sm text-muted">Add a book to start tracking pages together.</p>
          <Link
            href="/library"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium"
          >
            Open library
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
