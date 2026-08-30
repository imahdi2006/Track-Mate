"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import {
  clearPendingJoinCode,
  parseBuddyCode,
  readPendingBookId,
  takePendingBookId,
  writePendingBookId,
  writePendingJoinCode,
} from "@/lib/invite";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";

function goAfterJoin(router: ReturnType<typeof useRouter>, bookId: string | null) {
  takePendingBookId();
  router.replace(bookId ? `/book/${bookId}` : "/");
}

export function JoinCapture({
  code,
  bookId,
}: {
  code: string;
  bookId?: string | null;
}) {
  const router = useRouter();
  const hydrated = useSessionStore((s) => s.hydrated);
  const ran = useRef(false);

  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;

    const clean = parseBuddyCode(code);
    const pendingBook = bookId?.trim() || readPendingBookId();
    if (pendingBook) writePendingBookId(pendingBook);

    const { profile, room, joinRoom } = useSessionStore.getState();

    if (clean.length !== 6) {
      useToastStore.getState().push({
        title: "Invalid invite",
        body: "Ask them to share the book link again.",
        tone: "warn",
      });
      router.replace("/");
      return;
    }

    // Already in a room — still open the book deep-link; joinRoom is idempotent if same code.
    if (room) {
      if (room.inviteCode === clean) {
        goAfterJoin(router, pendingBook);
        return;
      }
      void joinRoom(clean)
        .then(() => goAfterJoin(router, pendingBook))
        .catch((err) => {
          useToastStore.getState().push({
            title: "Couldn’t join",
            body: err instanceof Error ? err.message : "Check the invite.",
            tone: "warn",
          });
          goAfterJoin(router, pendingBook);
        });
      return;
    }

    writePendingJoinCode(clean);

    if (!profile) {
      router.replace("/");
      return;
    }

    void joinRoom(clean)
      .then(() => {
        clearPendingJoinCode();
        const opened = pendingBook;
        useToastStore.getState().push({
          title: "You’re in the room",
          body: opened
            ? "This book is now on your shared shelf."
            : "Shared books and pages will show up here.",
          tone: "success",
        });
        goAfterJoin(router, opened);
      })
      .catch((err) => {
        useToastStore.getState().push({
          title: "Couldn’t join",
          body: err instanceof Error ? err.message : "Check the invite and try again.",
          tone: "warn",
        });
        router.replace("/");
      });
  }, [hydrated, code, bookId, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <BookMateLogo size={64} />
      <p className="text-sm text-muted">Opening this book invite…</p>
    </div>
  );
}
