"use client";

import { motion } from "framer-motion";
import { percent } from "@/lib/utils";

export function DualProgressBar({
  mine,
  theirs,
  total,
  myName,
  theirName,
}: {
  mine: number;
  theirs: number;
  total: number;
  myName: string;
  theirName: string;
}) {
  const a = percent(mine, total);
  const b = percent(theirs, total);

  return (
    <div className="space-y-2">
      <div className="relative h-4 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-brand/80"
          initial={false}
          animate={{ width: `${a}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
        />
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent/55 mix-blend-screen"
          initial={false}
          animate={{ width: `${b}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
        />
        <motion.span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-brand shadow"
          initial={false}
          animate={{ left: `${a}%` }}
          aria-hidden
        />
        <motion.span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-accent"
          initial={false}
          animate={{ left: `${b}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand" />
          {myName} · {mine}/{total}
        </span>
        <span className="flex items-center gap-1.5">
          {theirName} · {theirs}/{total}
          <span className="h-2 w-2 rounded-full bg-accent" />
        </span>
      </div>
    </div>
  );
}
