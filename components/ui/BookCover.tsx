"use client";

import { useEffect, useState } from "react";
import { isUsableCoverUrl, lookupCoverUrl } from "@/lib/covers";
import { cn } from "@/lib/utils";

export function BookCover({
  title,
  author,
  coverUrl,
  className,
  onResolved,
}: {
  title: string;
  author?: string;
  coverUrl?: string | null;
  className?: string;
  onResolved?: (url: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(isUsableCoverUrl(coverUrl) ? coverUrl! : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isUsableCoverUrl(coverUrl)) {
      setSrc(coverUrl!);
      setFailed(false);
      return;
    }
    let cancelled = false;
    void lookupCoverUrl(title, author).then((url) => {
      if (cancelled || !url) return;
      setSrc(url);
      setFailed(false);
      onResolved?.(url);
    });
    return () => {
      cancelled = true;
    };
  }, [coverUrl, title, author, onResolved]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex flex-col justify-end bg-gradient-to-br from-brand-deep via-panel to-accent/40 p-2 text-left shadow-xl",
          className,
        )}
        aria-hidden
      >
        <p dir="auto" className="pm-bidi line-clamp-4 text-[11px] font-semibold leading-snug text-cream">
          {title}
        </p>
        {author ? (
          <p dir="auto" className="pm-bidi mt-1 line-clamp-2 text-[10px] text-cream/70">
            {author}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("object-cover shadow-xl", className)}
      onError={() => setFailed(true)}
    />
  );
}
