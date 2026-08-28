"use client";

import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushPrompt() {
  const { promptOpen, subscribe, dismissPrompt, busy, error, supported } =
    usePushNotifications();

  if (!supported) return null;

  return (
    <AnimatePresence>
      {promptOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[54] flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md glass-strong rounded-3xl p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Bell size={20} />
              </span>
              <div>
                <p className="font-display text-lg">Enable push notifications</p>
                <p className="text-sm text-muted">
                  Get a ping when your buddy turns a page or drops a note.
                </p>
              </div>
            </div>
            {error ? <p className="mt-3 text-xs text-accent">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => void subscribe()}>
                {busy ? "Enabling…" : "Enable notifications"}
              </Button>
              <Button variant="ghost" onClick={dismissPrompt}>
                Skip
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
