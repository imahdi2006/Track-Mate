"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, DoorOpen, Pencil, Trash2 } from "lucide-react";
import { ShareBookButton } from "@/components/auth/ShareBookButton";
import { NoteReadTicks } from "@/components/activity/NoteReadTicks";
import { TitlePeoplePanel } from "@/components/room/TitlePeoplePanel";
import { DualProgressBar } from "@/components/dashboard/DualProgressBar";
import { LeadIndicator } from "@/components/dashboard/LeadIndicator";
import { PageCounter } from "@/components/dashboard/PageCounter";
import { ReactionBar } from "@/components/activity/ReactionBar";
import { EditBookModal } from "@/components/library/EditBookModal";
import { BookCover } from "@/components/ui/BookCover";
import { BidiText } from "@/components/ui/BidiText";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { personName } from "@/lib/names";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";
import { formatUnitMark, nowStatusLabel, parseTitleKind } from "@/lib/media";
import { memberCanAccessBook } from "@/lib/types";

export function BookDetailScreen({ bookId }: { bookId: string }) {
  const router = useRouter();
  const books = useSessionStore((s) => s.books);
  const notesAll = useSessionStore((s) => s.notes);
  const progress = useSessionStore((s) => s.progress);
  const profile = useSessionStore((s) => s.profile);
  const buddy = useSessionStore((s) => s.buddy);
  const members = useSessionStore((s) => s.members);
  const setStatus = useSessionStore((s) => s.setBookStatus);
  const updateBook = useSessionStore((s) => s.updateBook);
  const removeBook = useSessionStore((s) => s.removeBook);
  const markNotesRead = useSessionStore((s) => s.markNotesRead);
  const [readList, setReadList] = useState<{ name: string }[] | null>(null);

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

  useEffect(() => {
    void markNotesRead(bookId);
  }, [bookId, markNotesRead, notesAll.length]);

  const persistCover = useCallback(
    (url: string) => {
      void updateBook(bookId, { coverUrl: url });
    },
    [bookId, updateBook],
  );

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">Sign in to open this title.</p>
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
    await setStatus(bookId, "want_to_read");
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
      await removeBook(bookId);
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

      <div className="glass rounded-3xl p-4">
        <div className="flex gap-4">
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
              {nowStatusLabel(parseTitleKind(book.kind))}
            </p>
            {addedByBuddy ? (
              <p className="mt-2 text-[11px] text-muted">Added by {personName(buddy)}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1 border-t border-line pt-3">
          <button
            type="button"
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-cream hover:bg-white/8"
            onClick={() => setEditing(true)}
          >
            <Pencil size={18} />
            Edit
          </button>
          <button
            type="button"
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-cream hover:bg-white/8"
            onClick={() => void leaveBook()}
          >
            <DoorOpen size={18} />
            Leave
          </button>
          <ShareBookButton
            bookId={book.id}
            title={book.title}
            kind={parseTitleKind(book.kind)}
            iconLabel
          />
          <button
            type="button"
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-accent hover:bg-white/8"
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 size={18} />
            Remove
          </button>
        </div>
      </div>

      <TitlePeoplePanel book={book} />
      <p className="text-center text-xs text-muted">
        {buddy
          ? `Connected with ${personName(buddy)} — their bar moves when they turn a page.`
          : "Not connected yet. Share this book; when they join, both bars stay in sync."}
      </p>

      <DualProgressBar
        mine={myPage}
        theirs={theirPage}
        total={book.totalPages}
        myName={personName(profile)}
        theirName={personName(buddy, "Buddy")}
      />
      <LeadIndicator
        myPage={myPage}
        theirPage={theirPage}
        myName={personName(profile)}
        theirName={personName(buddy, "Buddy")}
      />
      <PageCounter
        bookId={book.id}
        totalPages={book.totalPages}
        currentPage={myPage}
        kind={parseTitleKind(book.kind)}
      />
      <ReactionBar bookId={book.id} page={myPage} />

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["currently_reading", nowStatusLabel(parseTitleKind(book.kind))],
            ["want_to_read", "Want"],
            ["completed", "Done"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "touch-target rounded-2xl py-2.5 text-xs font-medium",
              book.status === id ? "bg-brand text-white" : "bg-white/5 text-muted",
            )}
            onClick={() => void setStatus(book.id, id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Notes & reactions</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted">None yet — leave a spoiler-free breadcrumb.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => {
              const authorProfile =
                n.userId === profile?.id
                  ? profile
                  : members.find((m) => m.userId === n.userId)?.profile ??
                    (buddy?.id === n.userId ? buddy : null);
              const author = n.userId === profile?.id ? "You" : personName(authorProfile, "Someone");
              const when = formatDateTime(n.createdAt);
              const readers = members.filter(
                (m) => m.userId !== n.userId && memberCanAccessBook(m, book.id),
              );
              const readBy = n.readBy ?? [];
              const readSet = new Set(readBy.map((r) => r.userId));
              const readCount = readers.filter((m) => readSet.has(m.userId)).length;
              const mine = n.userId === profile?.id;
              return (
                <li key={n.id} dir="auto" className="pm-bidi rounded-2xl bg-white/4 px-3 py-2 text-sm">
                  <p className="text-cream/90">
                    {n.emoji ? `${n.emoji} ` : null}
                    {n.note || "Reaction"}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                    <p>
                      {author}
                      {` · ${formatUnitMark(parseTitleKind(book.kind), n.pageNumber)}`}
                      {when ? ` · ${when}` : ""}
                      {` · ${relativeTime(n.createdAt)}`}
                    </p>
                    <NoteReadTicks
                      mine={mine}
                      readCount={readCount}
                      readerNames={readers
                        .filter((m) => readSet.has(m.userId))
                        .map((m) => personName(m.profile, "Someone"))}
                      onOpen={() =>
                        setReadList(
                          readBy.map((r) => ({
                            name: personName(
                              members.find((m) => m.userId === r.userId)?.profile,
                              "Someone",
                            ),
                          })),
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EditBookModal book={book} open={editing} onClose={() => setEditing(false)} />
      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove this book?">
        <p className="text-sm text-muted">
          This takes the title off the shared shelf for everyone who shares it. To keep the
          book but stop reading it, tap Leave instead.
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
      <Modal open={Boolean(readList)} onClose={() => setReadList(null)} title="Read by">
        {readList && readList.length === 0 ? (
          <p className="text-sm text-muted">Nobody has opened this yet.</p>
        ) : (
          <ul className="space-y-2">
            {(readList ?? []).map((r, i) => (
              <li key={`${r.name}-${i}`} className="text-sm text-cream" dir="auto">
                {r.name}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
