"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareLinkModal } from "@/components/auth/ShareLinkModal";
import { Button } from "@/components/ui/Button";
import { bookShareUrl, shareOrCopyBook } from "@/lib/invite";
import { publishPairDoc } from "@/lib/sync/pair-client";
import { getSyncMode, useSessionStore } from "@/lib/store/session-store";
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
  const inviteCode = useSessionStore((s) => s.room?.inviteCode);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  if (!inviteCode) return null;
  const code = inviteCode;

  async function share(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const snap = useSessionStore.getState();
      if (snap.room && snap.profile && getSyncMode() === "local") {
        const pairLike = {
          id: snap.room.id,
          buddyCode: snap.room.inviteCode,
          userAId: snap.room.ownerId,
          userBId: snap.members.find((m) => m.userId !== snap.room!.ownerId)?.userId ?? null,
          memberIds: snap.members
            .map((m) => m.userId)
            .filter((id) => id !== snap.room!.ownerId)
            .slice(1),
          name: snap.room.name,
          maxMembers: snap.room.maxMembers,
          createdAt: snap.room.createdAt,
        };
        const saved = await publishPairDoc(code, {
          pair: pairLike,
          books: snap.books,
          progress: snap.progress,
          activities: snap.activities.map((a) => ({
            ...a,
            pairId: a.roomId,
          })),
          notes: snap.notes,
          profiles: snap.members.map((m) => m.profile!).filter(Boolean),
          pushSubscriptions: snap.pushSubscriptions,
          removedBookIds: [],
        });
        if (!saved) {
          throw new Error("Could not save the invite on the server. Try again in a moment.");
        }
      }
      const result = await shareOrCopyBook({ bookId, buddyCode: code, title });
      if (result === "manual") {
        setManualUrl(bookShareUrl(bookId, code));
        return;
      }
      useToastStore.getState().push({
        title: result === "shared" ? "Book invite opened" : "Book link copied",
        body: "They open it, sign in, and land on this book — not your password.",
        tone: "success",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setManualUrl(bookShareUrl(bookId, code));
      useToastStore.getState().push({
        title: "Share link ready",
        body: err instanceof Error ? err.message : "Copy the link from the dialog.",
        tone: "warn",
      });
    }
  }

  return (
    <>
      {compact ? (
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
      ) : (
        <Button className={cn("w-full", className)} onClick={(e) => void share(e)}>
          <Share2 size={16} />
          Share this book
        </Button>
      )}
      <ShareLinkModal
        open={Boolean(manualUrl)}
        onClose={() => setManualUrl(null)}
        title="Share this book"
        url={manualUrl ?? ""}
      />
    </>
  );
}
