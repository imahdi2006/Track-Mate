"use client";

import { motion } from "framer-motion";

export function LeadIndicator({
  myPage,
  theirPage,
  myName,
  theirName,
}: {
  myPage: number;
  theirPage: number;
  myName: string;
  theirName: string;
}) {
  const delta = myPage - theirPage;
  let copy = "You are on the exact same page! 🎉";
  if (delta > 0) copy = `You are ${delta} page${delta === 1 ? "" : "s"} ahead of ${theirName}`;
  if (delta < 0) {
    const n = Math.abs(delta);
    copy = `${theirName} is ${n} page${n === 1 ? "" : "s"} ahead!`;
  }

  return (
    <motion.p
      key={copy}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 px-3 py-2 text-center text-sm text-cream/90"
    >
      {copy}
      {delta === 0 && myName ? null : null}
    </motion.p>
  );
}
