"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TrackmateLogo } from "@/components/branding/TrackmateLogo";
import { ActiveBookCard } from "@/components/dashboard/ActiveBookCard";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { BookCard } from "@/components/library/BookCard";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { personName } from "@/lib/names";
import { matchesShelfQuery } from "@/lib/search";
import { useSessionStore } from "@/lib/store/session-store";
import type { BookStatus } from "@/lib/types";

type ShelfFilter = "all" | BookStatus;

const FILTERS: { id: ShelfFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "currently_reading", label: "Now" },
  { id: "want_to_read", label: "Want" },
  { id: "completed", label: "Done" },
];

const STATUS_LABEL: Record<BookStatus, string> = {
  currently_reading: "Now",
  want_to_read: "Want to read",
  completed: "Done",
};

export function DashboardScreen() {
  const profile = useSessionStore((s) => s.profile)!;
  const members = useSessionStore((s) => s.members);
  const books = useSessionStore((s) => s.books);
  const progress = useSessionStore((s) => s.progress);
  const activities = useSessionStore((s) => s.activities);
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [query, setQuery] = useState("");

  const others = useMemo(
    () => members.filter((m) => m.userId !== profile.id && m.profile),
    [members, profile.id],
  );
  const buddy = others[0]?.profile ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      return matchesShelfQuery(b, q);
    });
  }, [books, filter, query]);

  const featured = useMemo(() => {
    if (filter === "want_to_read" || filter === "completed") return null;
    return filtered.find((b) => b.status === "currently_reading") ?? null;
  }, [filtered, filter]);

  const rest = useMemo(
    () => (featured ? filtered.filter((b) => b.id !== featured.id) : filtered),
    [filtered, featured],
  );

  function pagesFor(bookId: string) {
    return {
      mine: progress.find((p) => p.bookId === bookId && p.userId === profile.id)?.currentPage ?? 0,
      theirs: buddy
        ? progress.find((p) => p.bookId === bookId && p.userId === buddy.id)?.currentPage ?? 0
        : 0,
    };
  }

  const featuredPages = featured ? pagesFor(featured.id) : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <TrackmateLogo size={34} withWordmark />
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <div className="flex items-center -space-x-2">
            <Avatar name={personName(profile)} hue={profile.avatarHue} />
            {others.slice(0, 3).map((m) =>
              m.profile ? (
                <Avatar
                  key={m.userId}
                  name={personName(m.profile)}
                  hue={m.profile.avatarHue}
                />
              ) : null,
            )}
          </div>
        </div>
      </header>

      {books.length === 0 ? (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="font-display text-xl">Your shelf is empty</p>
          <p className="mt-1 text-sm text-muted">
            Add a book, course, movie, or series in Library — nothing is seeded by default.
          </p>
          <Link
            href="/library"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium"
          >
            Add a title
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex gap-1 rounded-2xl bg-white/5 p-1">
            {FILTERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex-1 rounded-xl py-2 text-sm ${
                  filter === t.id ? "bg-brand/25 text-cream" : "text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative block">
            <Search size={16} className="absolute top-4 left-3 text-muted" />
            <Input
              className="pl-9"
              dir="auto"
              placeholder="Search title, creator, or kind"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          {featured && featuredPages ? (
            <ActiveBookCard
              book={featured}
              me={profile}
              buddy={buddy}
              myPage={featuredPages.mine}
              theirPage={featuredPages.theirs}
              otherCount={Math.max(0, others.length - 1)}
            />
          ) : null}

          {rest.length > 0 ? (
            <ul className="grid gap-3">
              {rest.map((book) => {
                const pages = pagesFor(book.id);
                return (
                  <li key={book.id} className="space-y-1">
                    {filter === "all" ? (
                      <p className="px-1 text-[11px] uppercase tracking-wider text-muted">
                        {STATUS_LABEL[book.status]}
                      </p>
                    ) : null}
                    <BookCard
                      book={book}
                      myPage={pages.mine}
                      theirPage={pages.theirs}
                      theirName={buddy ? personName(buddy) : "Buddy"}
                      otherCount={Math.max(0, others.length - 1)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!featured && rest.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nothing matches that filter.
            </p>
          ) : null}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cream">Recent activity</h2>
          <Link href="/activity" className="text-xs text-brand-glow">
            See all
          </Link>
        </div>
        <ActivityFeed activities={activities} me={profile} buddy={buddy} members={members} compact />
      </section>
    </div>
  );
}
