"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui/Loader";
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

    // Already in a room — still join so a book link can grant that title only.
    if (room) {
      void joinRoom(clean, pendingBook)
        .then(() => goAfterJoin(router, pendingBook))
        .catch((err) => {
          // Don't redirect to the book on failure (e.g. the room is full, or
          // the code is stale) — that silently opens a "Book not found"
          // page and makes a real error (like a full room) look like a
          // broken link. Clear the pending state and send them home with
          // the real reason instead.
          takePendingBookId();
          useToastStore.getState().push({
            title: "Couldn’t join",
            body: err instanceof Error ? err.message : "Check the invite and try again.",
            tone: "warn",
          });
          router.replace("/");
        });
      return;
    }

    writePendingJoinCode(clean);

    if (!profile) {
      router.replace("/");
      return;
    }

    void joinRoom(clean, pendingBook)
      .then(() => {
        clearPendingJoinCode();
        const opened = pendingBook;
        useToastStore.getState().push({
          title: "You’re in the room",
          body: opened
            ? "You can read this book together — not their whole library."
            : "Shared books and pages will show up here.",
          tone: "success",
        });
        goAfterJoin(router, opened);
      })
      .catch((err) => {
        takePendingBookId();
        useToastStore.getState().push({
          title: "Couldn’t join",
          body: err instanceof Error ? err.message : "Check the invite and try again.",
          tone: "warn",
        });
        router.replace("/");
      });
  }, [hydrated, code, bookId, router]);

  return <LoadingScreen label="Opening this book invite…" />;
}
