"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageMateLogo } from "@/components/branding/PageMateLogo";
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

    const { profile, pair, joinPair } = useSessionStore.getState();

    if (clean.length !== 6) {
      useToastStore.getState().push({
        title: "Invalid invite",
        body: "Ask your buddy to share the book link again.",
        tone: "warn",
      });
      router.replace("/");
      return;
    }

    if (pair) {
      goAfterJoin(router, pendingBook);
      return;
    }

    writePendingJoinCode(clean);

    if (!profile) {
      router.replace("/");
      return;
    }

    void joinPair(clean)
      .then(() => {
        clearPendingJoinCode();
        const opened = pendingBook;
        useToastStore.getState().push({
          title: "You’re paired",
          body: opened
            ? "This book is now on your shared shelf."
            : "Your buddy’s books and pages will show up here.",
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
      <PageMateLogo size={64} />
      <p className="text-sm text-muted">Opening this book invite…</p>
    </div>
  );
}
