"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { ShareBookButton } from "@/components/auth/ShareBookButton";
import { DualProgressBar } from "@/components/dashboard/DualProgressBar";
import { LeadIndicator } from "@/components/dashboard/LeadIndicator";
import { PageCounter } from "@/components/dashboard/PageCounter";
import { ReactionBar } from "@/components/activity/ReactionBar";
import { EditBookModal } from "@/components/library/EditBookModal";
import { BookCover } from "@/components/ui/BookCover";
import { BidiText } from "@/components/ui/BidiText";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { cn, relativeTime } from "@/lib/utils";
import type { BookStatus } from "@/lib/types";

const STATUS: { id: BookStatus; label: string }[] = [
  { id: "currently_reading", label: "Reading" },
  { id: "want_to_read", label: "Want" },
  { id: "completed", label: "Done" },
];

export function BookDetailScreen({ bookId }: { bookId: string }) {
  const router = useRouter();
  const books = useSessionStore((s) => s.books);
  const notesAll = useSessionStore((s) => s.notes);
  const progress = useSessionStore((s) => s.progress);
  const profile = useSessionStore((s) => s.profile);
  const buddy = useSessionStore((s) => s.buddy);
  const setStatus = useSessionStore((s) => s.setBookStatus);
  const updateBook = useSessionStore((s) => s.updateBook);
  const removeBook = useSessionStore((s) => s.removeBook);

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);
  const notes = useMemo(
    () => notesAll.filter((n) => n.bookId === bookId),
    [notesAll, bookId],
  );
  const myPage = useMemo(() => {
    if (!profile) return 0;
    return progress.find((p) => p.bookId === bookId && p.userId === profile.id)?.currentPage ?? 0;
  }, [progress, bookId, profile]);
  const theirPage = useMemo(() => {
    if (!buddy) return 0;
    return progress.find((p) => p.bookId === bookId && p.userId === buddy.id)?.currentPage ?? 0;
  }, [progress, bookId, buddy]);

  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const persistCover = useCallback(
    (url: string) => {
      void updateBook(bookId, { coverUrl: url });
    },
    [bookId, updateBook],
  );

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Sign in to open this book.</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Book not found.</p>
        <Link href="/library" className="mt-3 inline-block text-brand-glow">
          Back to library
        </Link>
      </div>
    );
  }

  const addedByBuddy = Boolean(buddy && book.createdBy === buddy.id);

  async function leaveBook() {
    await setStatus(book.id, "want_to_read");
    useToastStore.getState().push({
      title: "Moved off the current pile",
      body: "It’s in Want — your buddy still has it on the shared shelf.",
      tone: "success",
    });
    router.replace("/library");
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await removeBook(book.id);
      useToastStore.getState().push({
        title: "Removed from your shelf",
        body: "This title is gone for both of you.",
        tone: "success",
      });
      router.replace("/library");
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex h-11 items-center gap-1 text-sm text-muted">
          <ArrowLeft size={16} /> Home
        </Link>
        <Link href="/library" className="text-sm text-brand-glow">
          Library
        </Link>
      </div>

      <div className="glass flex gap-4 rounded-3xl p-4">
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          onResolved={persistCover}
          className="h-44 w-28 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <BidiText as="h1" className="font-display text-2xl leading-tight">
            {book.title}
          </BidiText>
          <BidiText as="p" className="mt-1 text-sm text-muted">
            {book.author}
          </BidiText>
          <p className="mt-3 text-xs uppercase tracking-wider text-accent">
            {book.status.replaceAll("_", " ")}
          </p>
          {addedByBuddy ? (
            <p className="mt-2 text-[11px] text-muted">Added by {buddy?.displayName}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={16} />
          Edit
        </Button>
        <Button variant="secondary" onClick={() => void leaveBook()}>
          Leave book
        </Button>
      </div>
      <Button variant="ghost" className="w-full text-accent" onClick={() => setConfirmRemove(true)}>
        <Trash2 size={16} />
        {addedByBuddy ? "Remove from our shelf" : "Remove this book"}
      </Button>

      <ShareBookButton bookId={book.id} title={book.title} />
      <p className="text-center text-xs text-muted">
        {buddy
          ? `Connected with ${buddy.displayName} — their bar moves when they turn a page.`
          : "Not connected yet. Share this book; when they join, both bars stay in sync."}
      </p>

      <DualProgressBar
        mine={myPage}
        theirs={theirPage}
        total={book.totalPages}
        myName={profile.displayName}
        theirName={buddy?.displayName ?? "Buddy"}
      />
      <LeadIndicator
        myPage={myPage}
        theirPage={theirPage}
        myName={profile.displayName}
        theirName={buddy?.displayName ?? "Buddy"}
      />
      <PageCounter bookId={book.id} totalPages={book.totalPages} currentPage={myPage} />
      <ReactionBar bookId={book.id} page={myPage} />

      <div className="grid grid-cols-3 gap-2">
        {STATUS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "touch-target rounded-2xl py-2.5 text-xs font-medium",
              book.status === item.id ? "bg-brand text-white" : "bg-white/5 text-muted",
            )}
            onClick={() => void setStatus(book.id, item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Notes & reactions</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted">None yet — leave a spoiler-free breadcrumb.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} dir="auto" className="pm-bidi rounded-2xl bg-white/4 px-3 py-2 text-sm">
                <span className="text-muted">p.{n.pageNumber}</span>{" "}
                {n.emoji} {n.note}
                <span className="ml-2 text-[11px] text-muted">{relativeTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EditBookModal book={book} open={editing} onClose={() => setEditing(false)} />
      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove this book?">
        <p className="text-sm text-muted">
          This takes the title off the shared shelf for both of you. To leave the
          pair entirely, use Settings. To keep the book but stop reading it, tap
          Leave book instead.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmRemove(false)}>
            Keep it
          </Button>
          <Button className="flex-1" onClick={() => void confirmDelete()} disabled={busy}>
            {busy ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
