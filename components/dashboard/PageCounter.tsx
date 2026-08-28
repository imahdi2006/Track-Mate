"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSessionStore } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";

export function PageCounter({
  bookId,
  totalPages,
  currentPage,
}: {
  bookId: string;
  totalPages: number;
  currentPage: number;
}) {
  const setPage = useSessionStore((s) => s.setPageOptimistic);
  const [draft, setDraft] = useState(String(currentPage));

  useEffect(() => {
    setDraft(String(currentPage));
  }, [currentPage]);

  function commitDraft() {
    const n = Number(draft);
    if (Number.isFinite(n)) setPage(bookId, Math.round(n));
    else setDraft(String(currentPage));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Minus one page"
          onClick={() => setPage(bookId, (p) => p - 1)}
        >
          <Minus size={18} />
        </Button>
        <div className="flex flex-col items-center">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            inputMode="numeric"
            aria-label="Current page"
            className="w-28 bg-transparent text-center font-display text-5xl font-semibold text-cream outline-none"
          />
          <p className="text-xs text-muted">of {totalPages} pages</p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Plus one page"
          onClick={() => setPage(bookId, (p) => p + 1)}
        >
          <Plus size={18} />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "+1 Page", d: 1 },
          { label: "+5 Pages", d: 5 },
          { label: "+10", d: 10 },
        ].map((b) => (
          <button
            key={b.d}
            type="button"
            onClick={() => setPage(bookId, (p) => p + b.d)}
            className={cn(
              "h-12 rounded-2xl border border-line bg-white/5 text-sm font-medium text-cream transition hover:border-brand/40 hover:bg-brand/15",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
