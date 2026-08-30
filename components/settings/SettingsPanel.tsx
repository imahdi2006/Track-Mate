"use client";

import { Copy, LogOut, UserMinus } from "lucide-react";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import { ShareLinkModal } from "@/components/auth/ShareLinkModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { roomShareUrl } from "@/lib/invite";
import { getSyncMode } from "@/lib/store/session-store";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { useMemo, useState } from "react";

export function SettingsPanel() {
  const profile = useSessionStore((s) => s.profile)!;
  const room = useSessionStore((s) => s.room)!;
  const rooms = useSessionStore((s) => s.rooms);
  const members = useSessionStore((s) => s.members);
  const rename = useSessionStore((s) => s.rename);
  const leaveRoom = useSessionStore((s) => s.leaveRoom);
  const deleteRoom = useSessionStore((s) => s.deleteRoom);
  const kickMember = useSessionStore((s) => s.kickMember);
  const setActiveRoom = useSessionStore((s) => s.setActiveRoom);
  const signOut = useSessionStore((s) => s.signOut);
  const [name, setName] = useState(profile.displayName);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [kickId, setKickId] = useState<string | null>(null);
  const [roomInviteOpen, setRoomInviteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const push = usePushNotifications();
  const install = usePWAInstall();

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
          <Avatar name={profile.displayName} hue={profile.avatarHue} size={52} />
          <div>
            <p className="font-medium" dir="auto">
              {profile.displayName}
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

      {rooms.length > 1 ? (
        <section className="glass rounded-3xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your rooms</p>
          {rooms.map((r) => (
            <button
              key={r.room.id}
              type="button"
              onClick={() => void setActiveRoom(r.room.id)}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm ${
                r.room.id === room.id ? "bg-brand/20 text-cream" : "hover:bg-white/5 text-muted"
              }`}
            >
              <span dir="auto">{r.room.name}</span>
              <span className="text-xs">
                {r.memberCount}/{r.room.maxMembers}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Room</p>
        <div>
          <p className="text-sm font-medium" dir="auto">
            {room.name}
          </p>
          <p className="font-display text-2xl tracking-[0.2em]">{room.inviteCode}</p>
          <p className="mt-1 text-[11px] text-muted">
            Prefer sharing a book from Home. A room invite shares the whole shelf
            ({members.length}/{room.maxMembers} members).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
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
            Copy code
          </Button>
          <Button className="flex-1" onClick={() => setRoomInviteOpen(true)}>
            Invite to room
          </Button>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Members</p>
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar
                  name={m.profile?.displayName ?? "Reader"}
                  hue={m.profile?.avatarHue ?? 220}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm" dir="auto">
                    {m.profile?.displayName ?? "Reader"}
                    {m.userId === profile.id ? " (you)" : ""}
                  </p>
                  <p className="text-[11px] text-muted">{m.role}</p>
                </div>
              </div>
              {isOwner && m.userId !== profile.id ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Kick member"
                  onClick={() => setKickId(m.userId)}
                >
                  <UserMinus size={16} />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {isOwner ? (
          <Button variant="ghost" className="w-full text-accent" onClick={() => setConfirmDelete(true)}>
            Delete room
          </Button>
        ) : (
          <Button variant="ghost" className="w-full text-accent" onClick={() => setConfirmLeave(true)}>
            Leave room
          </Button>
        )}
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

      <Modal open={Boolean(kickId)} onClose={() => setKickId(null)} title="Kick member?">
        <p className="text-sm text-muted">They’ll leave this room and lose the shared shelf.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setKickId(null)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              if (!kickId) return;
              void kickMember(kickId).catch((err) =>
                useToastStore.getState().push({
                  title: "Couldn’t kick",
                  body: err instanceof Error ? err.message : "Try again",
                  tone: "warn",
                }),
              );
              setKickId(null);
            }}
          >
            Kick
          </Button>
        </div>
      </Modal>

      <Modal open={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out?">
        <p className="text-sm text-muted">
          You’ll need your email and password to come back. Your rooms stay with this account.
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
