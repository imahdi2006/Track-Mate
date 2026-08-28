"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Link2, Users } from "lucide-react";
import { PageMateLogo } from "@/components/branding/PageMateLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import {
  clearPendingJoinCode,
  parseBuddyCode,
  readPendingJoinCode,
  takePendingBookId,
} from "@/lib/invite";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";

function afterJoin(router: ReturnType<typeof useRouter>) {
  const bookId = takePendingBookId();
  router.replace(bookId ? `/book/${bookId}` : "/");
}

export function PairingScreen() {
  const router = useRouter();
  const createPair = useSessionStore((s) => s.createPair);
  const joinPair = useSessionStore((s) => s.joinPair);
  const pair = useSessionStore((s) => s.pair);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const autoJoin = useRef(false);

  useEffect(() => {
    const pending = readPendingJoinCode();
    if (!pending || pair || autoJoin.current) return;
    autoJoin.current = true;
    setCode(pending);
    setMode("join");
    setBusy(true);
    void joinPair(pending)
      .then(() => {
        clearPendingJoinCode();
        useToastStore.getState().push({
          title: "You’re paired",
          body: "Open a book from Home and share it — that’s the invite.",
          tone: "success",
        });
        afterJoin(router);
      })
      .catch((err) => {
        autoJoin.current = false;
        useToastStore.getState().push({
          title: "Couldn’t join",
          body: err instanceof Error ? err.message : "Check the invite link.",
          tone: "warn",
        });
      })
      .finally(() => setBusy(false));
  }, [joinPair, pair, router]);

  async function onCreate() {
    setBusy(true);
    try {
      await createPair();
      setMode("create");
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t create pair",
        body: err instanceof Error ? err.message : "Try again",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    const clean = parseBuddyCode(code);
    if (clean.length < 6) return;
    setBusy(true);
    try {
      await joinPair(clean);
      clearPendingJoinCode();
      afterJoin(router);
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t join",
        body: err instanceof Error ? err.message : "Check the code",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!pair?.buddyCode) return;
    await navigator.clipboard.writeText(pair.buddyCode);
    useToastStore.getState().push({ title: "Buddy code copied", tone: "success" });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <PageMateLogo size={44} withWordmark />
          <ThemeSwitch />
        </div>
        <h1 className="font-display mt-5 text-2xl text-cream">Find your reading buddy</h1>
        <p className="mt-2 text-sm text-muted">
          Create a pair, then share a book from Home or Library. They join that
          book — not your whole account.
        </p>

        {mode === "choose" && !pair ? (
          <div className="mt-6 grid gap-3">
            <Button size="lg" onClick={onCreate} disabled={busy}>
              <Users size={18} />
              Create a pair
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setMode("join")}>
              <Link2 size={18} />
              I have a book link or code
            </Button>
          </div>
        ) : null}

        {(mode === "create" || pair) && pair ? (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Your buddy code</p>
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3">
                <span className="font-display text-3xl tracking-[0.28em] text-cream">
                  {pair.buddyCode}
                </span>
                <Button size="icon" variant="ghost" onClick={copyCode} aria-label="Copy buddy code">
                  <Copy size={18} />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Next: open Home or Library and tap <strong>Share this book</strong>.
              That link is what your buddy opens.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => router.replace("/")}>
              Open dashboard
            </Button>
          </div>
        ) : null}

        {mode === "join" && !pair ? (
          <form onSubmit={onJoin} className="mt-6 flex flex-col gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(parseBuddyCode(e.target.value))}
              placeholder="Paste link or F2A6PD"
              maxLength={120}
              className="text-center font-display text-xl tracking-[0.2em] uppercase"
              autoCapitalize="characters"
            />
            <Button type="submit" size="lg" disabled={busy || parseBuddyCode(code).length < 6}>
              Join this book
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
              Back
            </Button>
          </form>
        ) : null}
      </motion.div>
    </div>
  );
}
