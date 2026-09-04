"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function NoteReadTicks({
  mine,
  readerNames,
  readCount,
  onOpen,
}: {
  mine: boolean;
  readerNames: string[];
  readCount: number;
  onOpen: () => void;
}) {
  if (!mine) return null;
  const allNamed = readerNames.length > 0 && readCount >= readerNames.length;
  const label = readCount
    ? `Read by ${readerNames.join(", ") || `${readCount}`}`
    : "Sent — tap to see who read this";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 max-w-[12rem] items-center gap-1 text-[11px]",
        allNamed ? "text-brand-glow" : readCount ? "text-cream/70" : "text-muted",
      )}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
    >
      {readCount ? <CheckCheck size={14} /> : <Check size={14} />}
      {readerNames.length ? (
        <span dir="auto" className="truncate">
          {readerNames.join(", ")}
        </span>
      ) : null}
    </button>
  );
}
