"use client";

import Link from "next/link";
import { ShareBookButton } from "@/components/auth/ShareBookButton";
import { BidiText } from "@/components/ui/BidiText";
import { BookCover } from "@/components/ui/BookCover";
import type { Book } from "@/lib/types";
import { percent } from "@/lib/utils";
import { formatUnitMark, kindNoun, parseTitleKind } from "@/lib/media";

export function BookCard({
  book,
  myPage,
  theirPage,
  theirName = "Buddy",
  otherCount = 0,
}: {
  book: Book;
  myPage: number;
  theirPage: number;
  /** Name of the other reader whose progress is shown (falls back to "Buddy"). */
  theirName?: string;
  /** Extra room members beyond `theirName` who also share this title. */
  otherCount?: number;
}) {
  const mine = percent(myPage, book.totalPages);
  const theirs = percent(theirPage, book.totalPages);
  const theirLabel = otherCount > 0 ? `${theirName} +${otherCount}` : theirName;
  return (
    <article className="glass flex gap-2 overflow-hidden rounded-2xl p-3 transition hover:border-brand/30">
      <Link href={`/book/${book.id}`} className="flex min-w-0 flex-1 gap-3">
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          className="h-24 w-16 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            {kindNoun(parseTitleKind(book.kind))}
          </p>
          <BidiText as="h3" className="truncate font-medium text-cream">
            {book.title}
          </BidiText>
          <BidiText as="p" className="truncate text-xs text-muted">
            {book.author}
          </BidiText>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div className="relative h-full">
              <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${mine}%` }} />
              <div
                className="absolute inset-y-0 left-0 bg-accent/60"
                style={{ width: `${theirs}%` }}
              />
            </div>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted">
            You {formatUnitMark(parseTitleKind(book.kind), myPage)} · {theirLabel}{" "}
            {formatUnitMark(parseTitleKind(book.kind), theirPage)}
          </p>
        </div>
      </Link>
        <ShareBookButton compact bookId={book.id} title={book.title} kind={parseTitleKind(book.kind)} />
    </article>
  );
}
