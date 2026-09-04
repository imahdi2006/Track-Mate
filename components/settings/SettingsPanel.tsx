"use client";

import { Copy, DoorOpen, Github, LogOut, Share2, Trash2, Users } from "lucide-react";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import { ShareLinkModal } from "@/components/auth/ShareLinkModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { GITHUB_URL } from "@/lib/config";
import { personName } from "@/lib/names";
import { roomShareUrl } from "@/lib/invite";
import { getSyncMode } from "@/lib/store/session-store";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { useEffect, useMemo, useState } from "react";

export function SettingsPanel() {
  const profile = useSessionStore((s) => s.profile)!;
  const room = useSessionStore((s) => s.room)!;
  const rooms = useSessionStore((s) => s.rooms);
  const members = useSessionStore((s) => s.members);
  const rename = useSessionStore((s) => s.rename);
  const leaveRoom = useSessionStore((s) => s.leaveRoom);
  const deleteRoom = useSessionStore((s) => s.deleteRoom);
  const setActiveRoom = useSessionStore((s) => s.setActiveRoom);
  const signOut = useSessionStore((s) => s.signOut);
  const [name, setName] = useState(personName(profile));
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [roomInviteOpen, setRoomInviteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const push = usePushNotifications();
  const install = usePWAInstall();

  useEffect(() => {
    setName(personName(profile));
  }, [profile.displayName, profile.email]);

  const myRole = useMemo(
    () => members.find((m) => m.userId === profile.id)?.role ?? "member",
    [members, profile.id],
  );
  const isOwner = myRole === "owner";

  async function confirmLogout() {
    setSigningOut(true);
    try {
      await signOut();
      setConfirmSignOut(false);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-center justify-between">
        <BookMateLogo size={32} withWordmark />
      </header>

      <section className="glass rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <Avatar name={personName(profile)} hue={profile.avatarHue} size={52} />
          <div>
            <p className="font-medium" dir="auto">
              {personName(profile)}
            </p>
            <p className="text-xs text-muted">
              {profile.email ?? (getSyncMode() === "supabase" ? "Cloud sync on" : "Local demo mode")}
            </p>
          </div>
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void rename(name.trim() || profile.displayName);
          }}
        >
          <Input dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Rooms</p>
        {rooms.length > 1 ? (
          <ul className="space-y-1">
            {rooms.map((r) => (
              <li key={r.room.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (r.room.id !== room.id) void setActiveRoom(r.room.id);
                  }}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm ${
                    r.room.id === room.id ? "bg-brand/20 text-cream" : "text-muted hover:bg-white/5"
                  }`}
                >
                  <Users size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {r.room.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {r.memberCount}/{r.room.maxMembers}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-2xl bg-white/5 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="shrink-0 text-muted" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
              {room.name}
            </p>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {members.length}/{room.maxMembers}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-display min-w-0 flex-1 text-xl tracking-[0.12em]">{room.inviteCode}</p>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Copy room code"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(room.inviteCode);
                  useToastStore.getState().push({ title: "Code copied", tone: "success" });
                } catch {
                  setRoomInviteOpen(true);
                }
              }}
            >
              <Copy size={16} />
            </Button>
            <Button
              size="icon"
              aria-label="Invite to room"
              onClick={() => setRoomInviteOpen(true)}
            >
              <Share2 size={16} />
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            This code shares the whole shelf. Prefer Share on a title when you can.
          </p>
          {isOwner ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-accent"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Delete room
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-accent"
              onClick={() => setConfirmLeave(true)}
            >
              <DoorOpen size={16} />
              Leave room
            </button>
          )}
        </div>
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Notifications
        </p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Push notifications</p>
            <p className="text-xs text-muted">
              {push.subscribed ? "On — roommates can ping this device" : "Off"}
            </p>
            {push.error ? <p className="text-xs text-accent">{push.error}</p> : null}
            {!push.supported && install.platform === "ios" ? (
              <p className="text-xs text-accent">
                On iPhone, Add to Home Screen first (HTTPS), then enable push.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={push.subscribed}
            disabled={push.busy}
            onClick={() => void (push.subscribed ? push.unsubscribe() : push.subscribe())}
            className={`relative h-7 w-12 rounded-full transition ${
              push.subscribed ? "bg-brand" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-cream transition ${
                push.subscribed ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {push.subscribed ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              const ok = await push.sendTest();
              useToastStore.getState().push({
                title: ok ? "Test ping sent" : "Couldn’t ping",
                body: ok
                  ? "You should see a BookMate notification in a second."
                  : push.error ?? "Check the toggle and try again.",
                tone: ok ? "success" : "warn",
              });
            }}
          >
            Send test ping
          </Button>
        ) : (
          <p className="text-[11px] text-muted">
            Needs HTTPS (e.g. Vercel). Install the app on this device, then enable push.
          </p>
        )}
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Appearance</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Theme</p>
            <p className="text-xs text-muted">Dark or light on this device</p>
          </div>
          <ThemeSwitch />
        </div>
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Install</p>
        {install.installed ? (
          <p className="text-sm text-muted">Running as an installed app. Nice.</p>
        ) : (
          <>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                if (install.canNativePrompt) void install.promptInstall();
                else install.open();
              }}
            >
              Install BookMate
            </Button>
            <p className="text-[11px] text-muted">
              Native install needs HTTPS. On iPhone use Share → Add to Home Screen.
            </p>
          </>
        )}
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Open source
        </p>
        <p className="text-sm text-muted">
          BookMate is free and open source (MIT). Use it, fork it, self-host it,
          or send a pull request — the code is yours to run.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm font-medium text-cream hover:bg-white/8"
        >
          <Github size={16} />
          View source on GitHub
        </a>
        {/* Buy me a coffee — paused; project is open source instead
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent/20 text-sm font-medium text-cream hover:bg-accent/30"
        >
          <Heart size={16} />
          Buy me a coffee
        </a>
        */}
        <p className="text-[11px] text-muted">
          Stars and issues on GitHub help. Self-hosting needs Vercel + Supabase
          (see the repo README).
        </p>
      </section>

      <Button variant="ghost" className="w-full" onClick={() => setConfirmSignOut(true)}>
        <LogOut size={16} />
        Sign out
      </Button>

      <ShareLinkModal
        open={roomInviteOpen}
        onClose={() => setRoomInviteOpen(false)}
        title="Invite to this room"
        url={roomShareUrl(room.inviteCode)}
        warning="This shares the whole shelf (all books), not just one book. Prefer Share this book from Home when you can."
      />

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave room?">
        <p className="text-sm text-muted">You’ll lose access to this shared shelf until invited again.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              void leaveRoom();
              setConfirmLeave(false);
            }}
          >
            Leave
          </Button>
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete room?">
        <p className="text-sm text-muted">
          Deletes the room and shared shelf for everyone. This can’t be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              void deleteRoom().catch((err) =>
                useToastStore.getState().push({
                  title: "Couldn’t delete",
                  body: err instanceof Error ? err.message : "Try again",
                  tone: "warn",
                }),
              );
              setConfirmDelete(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Modal open={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out?">
        <p className="text-sm text-muted">
          You’ll need Google or your email and password to come back. Your rooms stay with this account.
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmSignOut(false)}
            disabled={signingOut}
          >
            Stay
          </Button>
          <Button className="flex-1" onClick={() => void confirmLogout()} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
