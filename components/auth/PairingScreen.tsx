"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Link2, Users } from "lucide-react";
import { TrackmateLogo } from "@/components/branding/TrackmateLogo";
import { LoadingScreen } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { ROOM_MAX_MEMBERS, ROOM_MIN_MEMBERS } from "@/lib/config";
import {
  clearPendingJoinCode,
  parseBookIdFromInvite,
  parseBuddyCode,
  readPendingBookId,
  readPendingJoinCode,
  takePendingBookId,
  writePendingBookId,
} from "@/lib/invite";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";

function afterJoin(router: ReturnType<typeof useRouter>) {
  const bookId = takePendingBookId();
  router.replace(bookId ? `/book/${bookId}` : "/");
}

export function PairingScreen() {
  const router = useRouter();
  const createRoom = useSessionStore((s) => s.createRoom);
  const joinRoom = useSessionStore((s) => s.joinRoom);
  const room = useSessionStore((s) => s.room);
  const [code, setCode] = useState("");
  const [roomName, setRoomName] = useState("Reading room");
  const [maxMembers, setMaxMembers] = useState(ROOM_MAX_MEMBERS);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const autoJoin = useRef(false);

  useEffect(() => {
    const pending = readPendingJoinCode();
    if (!pending || room || autoJoin.current) return;
    autoJoin.current = true;
    setCode(pending);
    setMode("join");
    setBusy(true);
    const pendingBook = readPendingBookId();
    void joinRoom(pending, pendingBook)
      .then(() => {
        clearPendingJoinCode();
        useToastStore.getState().push({
          title: "You’re in the room",
          body: pendingBook
            ? "You can read this book together — not their whole library."
            : "Open a book from Home — share a book link to invite others.",
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
  }, [joinRoom, room, router]);

  async function onCreate() {
    setBusy(true);
    try {
      await createRoom({ name: roomName, maxMembers });
      setMode("create");
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t create room",
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
    const fromPaste = parseBookIdFromInvite(code);
    const pendingBook = fromPaste || readPendingBookId();
    if (pendingBook) writePendingBookId(pendingBook);
    setBusy(true);
    try {
      await joinRoom(clean, pendingBook);
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
    if (!room?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      useToastStore.getState().push({ title: "Invite code copied", tone: "success" });
    } catch {
      useToastStore.getState().push({
        title: "Copy manually",
        body: room.inviteCode,
        tone: "warn",
      });
    }
  }

  if (busy && mode === "join" && !room) {
    return <LoadingScreen label="Opening this book invite…" />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <TrackmateLogo size={44} withWordmark />
          <ThemeSwitch />
        </div>
        <h1 className="font-display mt-5 text-2xl text-cream">Start a reading room</h1>
        <p className="mt-2 text-sm text-muted">
          Create a room (up to {ROOM_MAX_MEMBERS} people), then share a book from Home.
          Book links invite people into that room — not your password.
        </p>

        {mode === "choose" && !room ? (
          <div className="mt-6 grid gap-3">
            <Button size="lg" onClick={() => setMode("create")} disabled={busy}>
              <Users size={18} />
              Create a room
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setMode("join")}>
              <Link2 size={18} />
              I have a book link or code
            </Button>
          </div>
        ) : null}

        {mode === "create" && !room ? (
          <div className="mt-6 space-y-3">
            <Input
              dir="auto"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
            />
            <label className="block text-xs text-muted">
              Max members ({ROOM_MIN_MEMBERS}–{ROOM_MAX_MEMBERS})
              <select
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-cream"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
              >
                {Array.from(
                  { length: ROOM_MAX_MEMBERS - ROOM_MIN_MEMBERS + 1 },
                  (_, i) => ROOM_MIN_MEMBERS + i,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} people
                  </option>
                ))}
              </select>
            </label>
            <Button size="lg" className="w-full" onClick={() => void onCreate()} disabled={busy}>
              Create room
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choose")}>
              Back
            </Button>
          </div>
        ) : null}

        {(mode === "create" || room) && room ? (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Room invite code</p>
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3">
                <span className="font-display text-3xl tracking-[0.28em] text-cream">
                  {room.inviteCode}
                </span>
                <Button size="icon" variant="ghost" onClick={() => void copyCode()} aria-label="Copy invite code">
                  <Copy size={18} />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Prefer sharing a <strong>book</strong> from Home — that opens the right title.
              A room code shares the whole shelf.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => router.replace("/")}>
              Open dashboard
            </Button>
          </div>
        ) : null}

        {mode === "join" && !room ? (
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
              Join room
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
