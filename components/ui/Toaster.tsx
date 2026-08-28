"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/lib/store/toast-store";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="pointer-events-auto glass-strong rounded-2xl px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-cream">{t.title}</p>
            {t.body ? <p className="mt-0.5 text-xs text-muted">{t.body}</p> : null}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
