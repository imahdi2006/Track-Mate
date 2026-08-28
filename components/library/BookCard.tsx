"use client";

import Link from "next/link";
import { ShareBookButton } from "@/components/auth/ShareBookButton";
import { BidiText } from "@/components/ui/BidiText";
import { BookCover } from "@/components/ui/BookCover";
import type { Book } from "@/lib/types";
import { percent } from "@/lib/utils";

export function BookCard({
  book,
  myPage,
  theirPage,
}: {
  book: Book;
  myPage: number;
  theirPage: number;
}) {
  const mine = percent(myPage, book.totalPages);
  const theirs = percent(theirPage, book.totalPages);
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
          <p className="mt-1.5 text-[11px] text-muted">
            You p.{myPage} · Buddy p.{theirPage}
          </p>
        </div>
      </Link>
      <ShareBookButton compact bookId={book.id} title={book.title} />
    </article>
  );
}
