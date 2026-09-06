"use client";

import { Rocket } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

export function UpdateToast() {
  const { updateReady, applyUpdate, dismiss } = usePWAUpdate();

  return (
    <AnimatePresence>
      {updateReady ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-0 bottom-24 z-[56] px-4"
        >
          <div className="mx-auto flex max-w-lg items-center gap-3 glass-strong rounded-2xl p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-lg">
              <Rocket size={18} className="text-brand-glow" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cream">Update available</p>
              <p className="text-xs text-muted">
                Your account stays. Tap to load the new Trackmate on this device.
              </p>
            </div>
            <Button size="sm" onClick={applyUpdate}>
              Update & Restart
            </Button>
            <button
              type="button"
              className="text-xs text-muted hover:text-cream"
              onClick={dismiss}
            >
              Later
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
