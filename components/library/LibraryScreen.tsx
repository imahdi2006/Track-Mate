"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AddBookModal } from "@/components/library/AddBookModal";
import { BookCard } from "@/components/library/BookCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import type { BookStatus } from "@/lib/types";
import { personName } from "@/lib/names";
import { matchesShelfQuery } from "@/lib/search";
import { useSessionStore } from "@/lib/store/session-store";

type ShelfTab = "all" | BookStatus;

const TABS: { id: ShelfTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "currently_reading", label: "Now" },
  { id: "want_to_read", label: "Want" },
  { id: "completed", label: "Done" },
];

export function LibraryScreen() {
  const books = useSessionStore((s) => s.books);
  const progress = useSessionStore((s) => s.progress);
  const profile = useSessionStore((s) => s.profile)!;
  const members = useSessionStore((s) => s.members);
  const [tab, setTab] = useState<ShelfTab>("all");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const others = useMemo(
    () => members.filter((m) => m.userId !== profile.id && m.profile),
    [members, profile.id],
  );
  const buddy = others[0]?.profile ?? null;

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (tab !== "all" && b.status !== tab) return false;
      return matchesShelfQuery(b, query);
    });
  }, [books, tab, query]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <BookOpen size={22} className="text-brand-glow" />
          Library
        </h1>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <Button size="icon" onClick={() => setOpen(true)} aria-label="Add to library">
            <Plus size={18} />
          </Button>
        </div>
      </header>

      <div className="flex gap-1 rounded-2xl bg-white/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative flex-1 py-2 text-sm"
          >
            {tab === t.id ? (
              <motion.span
                layoutId="lib-tab"
                className="absolute inset-0 rounded-xl bg-brand/25"
              />
            ) : null}
            <span className={`relative ${tab === t.id ? "text-cream" : "text-muted"}`}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <label className="relative block">
        <Search size={16} className="absolute top-4 left-3 text-muted" />
        <Input
          className="pl-9"
          dir="auto"
          placeholder="Search title, creator, or kind (book, series…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          className="grid gap-3"
        >
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {query.trim() ? "No match on this shelf." : "Nothing here yet."}
            </p>
          ) : (
            filtered.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                myPage={
                  progress.find((p) => p.bookId === book.id && p.userId === profile.id)
                    ?.currentPage ?? 0
                }
                theirPage={
                  buddy
                    ? progress.find((p) => p.bookId === book.id && p.userId === buddy.id)
                        ?.currentPage ?? 0
                    : 0
                }
                theirName={buddy ? personName(buddy) : "Buddy"}
                otherCount={Math.max(0, others.length - 1)}
              />
            ))
          )}
        </motion.div>
      </AnimatePresence>

      <AddBookModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
