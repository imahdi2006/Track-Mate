"use client";

import type { MouseEvent } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { shareOrCopyBook } from "@/lib/invite";
import { publishPairDoc } from "@/lib/sync/pair-client";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

export function ShareBookButton({
  bookId,
  title,
  compact = false,
  className,
}: {
  bookId: string;
  title: string;
  compact?: boolean;
  className?: string;
}) {
  const buddyCode = useSessionStore((s) => s.pair?.buddyCode);

  if (!buddyCode) return null;
  const code = buddyCode;

  async function share(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const snap = useSessionStore.getState();
      if (snap.pair && snap.profile) {
        await publishPairDoc(code, {
          pair: snap.pair,
          books: snap.books,
          progress: snap.progress,
          activities: snap.activities,
          notes: snap.notes,
          profiles: snap.buddy ? [snap.profile, snap.buddy] : [snap.profile],
          pushSubscriptions: snap.pushSubscriptions,
          removedBookIds: [],
        });
      }
      const result = await shareOrCopyBook({ bookId, buddyCode: code, title });
      useToastStore.getState().push({
        title: result === "shared" ? "Book invite opened" : "Book link copied",
        body: "They open it, sign in, and land on this book — not your whole account.",
        tone: "success",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      useToastStore.getState().push({
        title: "Couldn’t share this book",
        body: err instanceof Error ? err.message : "Copy the link instead.",
        tone: "warn",
      });
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={`Share ${title}`}
        onClick={(e) => void share(e)}
        className={cn(
          "touch-target inline-flex shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-white/8 hover:text-cream",
          className,
        )}
      >
        <Share2 size={18} />
      </button>
    );
  }

  return (
    <Button className={cn("w-full", className)} onClick={(e) => void share(e)}>
      <Share2 size={16} />
      Share this book
    </Button>
  );
}
