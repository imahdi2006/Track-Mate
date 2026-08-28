"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ReactionEmoji } from "@/lib/types";
import { useSessionStore } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";

const EMOJIS: ReactionEmoji[] = ["🔥", "👏", "😮", "💛", "📖"];

export function ReactionBar({ bookId, page }: { bookId: string; page: number }) {
  const addNote = useSessionStore((s) => s.addNote);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function react(emoji: ReactionEmoji) {
    setBusy(true);
    try {
      await addNote({ bookId, pageNumber: page, emoji });
    } finally {
      setBusy(false);
    }
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addNote({ bookId, pageNumber: page, note: note.trim() });
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        React on page {page}
      </p>
      <div className="flex gap-2">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={busy}
            onClick={() => void react(e)}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-2xl bg-white/5 text-xl transition hover:bg-white/10",
            )}
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <form onSubmit={submitNote} className="flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Spoiler-free note or quote…"
          maxLength={180}
        />
        <Button type="submit" disabled={busy || !note.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
