"use client";

import { Share, Plus, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import { Button } from "@/components/ui/Button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function InstallPrompt() {
  const {
    visible,
    canNativePrompt,
    showIosGuide,
    promptInstall,
    dismiss,
    platform,
  } = usePWAInstall();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-[55] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
        >
          <div className="mx-auto max-w-lg glass-strong rounded-3xl p-4 shadow-glass">
            <div className="flex items-start gap-3">
              <BookMateLogo size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-cream">Install BookMate</p>
                <p className="text-sm text-muted">
                  {showIosGuide
                    ? "Add it to your Home Screen so push and full-screen reading work on iPhone."
                    : "Add to your home screen for a native, offline-ready reading companion."}
                </p>
              </div>
            </div>

            {showIosGuide ? (
              <ol className="mt-4 space-y-3 text-sm text-cream/90">
                <li className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/20 text-brand-glow">
                    <Share size={16} />
                  </span>
                  Tap the <strong className="mx-1">Share</strong> icon in Safari
                </li>
                <li className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/20">
                    <MoreHorizontal size={16} />
                  </span>
                  Scroll the sheet
                </li>
                <li className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent">
                    <Plus size={16} />
                  </span>
                  Tap <strong className="mx-1">Add to Home Screen</strong>
                </li>
              </ol>
            ) : null}

            <div className="mt-4 flex gap-2">
              {canNativePrompt ? (
                <Button className="flex-1" onClick={() => void promptInstall()}>
                  Install BookMate
                </Button>
              ) : showIosGuide ? (
                <Button className="flex-1" variant="secondary" onClick={dismiss}>
                  I&apos;ll do this now
                </Button>
              ) : platform === "desktop" ? (
                <Button className="flex-1" variant="secondary" onClick={dismiss}>
                  Maybe later
                </Button>
              ) : null}
              <Button variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
