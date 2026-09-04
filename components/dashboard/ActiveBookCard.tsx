"use client";

import Link from "next/link";
import { ShareBookButton } from "@/components/auth/ShareBookButton";
import { BookCover } from "@/components/ui/BookCover";
import { DualProgressBar } from "@/components/dashboard/DualProgressBar";
import { LeadIndicator } from "@/components/dashboard/LeadIndicator";
import { PageCounter } from "@/components/dashboard/PageCounter";
import { BidiText } from "@/components/ui/BidiText";
import type { Book, Profile } from "@/lib/types";
import { personName } from "@/lib/names";
import { percent } from "@/lib/utils";
import { currentlyLabel, parseTitleKind, unitNoun } from "@/lib/media";

export function ActiveBookCard({
  book,
  me,
  buddy,
  myPage,
  theirPage,
  otherCount = 0,
}: {
  book: Book;
  me: Profile;
  buddy: Profile | null;
  myPage: number;
  theirPage: number;
  otherCount?: number;
}) {
  const buddyName = personName(buddy, otherCount > 0 ? "Room" : "Buddy");
  const theirLabel =
    buddy && otherCount > 0 ? `${personName(buddy)} +${otherCount}` : buddyName;

  return (
    <article className="glass overflow-hidden rounded-3xl">
      <div className="flex gap-4 p-4">
        <Link href={`/book/${book.id}`} className="shrink-0">
          <BookCover
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl}
            className="h-36 w-24 rounded-xl ring-1 ring-white/10"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            {currentlyLabel(parseTitleKind(book.kind))}
          </p>
          <Link href={`/book/${book.id}`}>
            <BidiText as="h2" className="font-display mt-1 text-xl leading-snug text-cream">
              {book.title}
            </BidiText>
          </Link>
          <BidiText as="p" className="mt-0.5 text-sm text-muted">
            {book.author}
          </BidiText>
          <p className="mt-2 text-xs text-muted">
            {book.totalPages} {unitNoun(parseTitleKind(book.kind), book.totalPages)} · you{" "}
            {Math.round(percent(myPage, book.totalPages))}%
          </p>
        </div>
      </div>
      <div className="space-y-4 px-4 pb-5">
        <DualProgressBar
          mine={myPage}
          theirs={theirPage}
          total={book.totalPages}
          myName={personName(me)}
          theirName={theirLabel}
        />
        <LeadIndicator
          myPage={myPage}
          theirPage={theirPage}
          myName={personName(me)}
          theirName={theirLabel}
        />
        <PageCounter
          bookId={book.id}
          totalPages={book.totalPages}
          currentPage={myPage}
          kind={parseTitleKind(book.kind)}
        />
        <ShareBookButton bookId={book.id} title={book.title} kind={parseTitleKind(book.kind)} />
      </div>
    </article>
  );
}
