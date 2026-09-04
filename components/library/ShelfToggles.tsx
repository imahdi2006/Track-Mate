"use client";

import { Bookmark, BookOpen, Check, Clapperboard, GraduationCap, Tv } from "lucide-react";
import type { BookStatus, TitleKind } from "@/lib/types";
import { isWatchKind, nowStatusLabel } from "@/lib/media";
import { cn } from "@/lib/utils";

const KINDS: { id: "book" | "course" | "movie"; label: string; Icon: typeof BookOpen }[] = [
  { id: "book", label: "Book", Icon: BookOpen },
  { id: "course", label: "Course", Icon: GraduationCap },
  { id: "movie", label: "Movie", Icon: Clapperboard },
];

export function KindToggle({
  value,
  onChange,
}: {
  value: TitleKind;
  onChange: (kind: TitleKind) => void;
}) {
  const tab = isWatchKind(value) ? "movie" : value;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-2xl bg-white/5 p-1" role="tablist" aria-label="Title type">
        {KINDS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (id === "movie") {
                  onChange(isWatchKind(value) ? value : "movie");
                  return;
                }
                onChange(id);
              }}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium sm:flex-row sm:gap-1.5 sm:text-sm",
                on ? "bg-brand text-white" : "text-muted",
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>
      {isWatchKind(value) ? (
        <div className="flex gap-1 rounded-2xl bg-white/5 p-1" role="tablist" aria-label="Film or series">
          {(
            [
              { id: "movie" as const, label: "Film", Icon: Clapperboard },
              { id: "series" as const, label: "Series", Icon: Tv },
            ] as const
          ).map(({ id, label, Icon }) => {
            const on = value === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange(id)}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium",
                  on ? "bg-brand text-white" : "text-muted",
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ShelfStatusToggle({
  kind,
  value,
  onChange,
}: {
  kind: TitleKind;
  value: BookStatus;
  onChange: (status: BookStatus) => void;
}) {
  const items = [
    { id: "currently_reading" as const, label: nowStatusLabel(kind), Icon: BookOpen },
    { id: "want_to_read" as const, label: "Want", Icon: Bookmark },
    { id: "completed" as const, label: "Done", Icon: Check },
  ];
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Shelf">
      {items.map(({ id, label, Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium",
              on ? "bg-brand text-white" : "bg-white/5 text-muted",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
