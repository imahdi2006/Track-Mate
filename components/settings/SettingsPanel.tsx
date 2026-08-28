"use client";

import { Copy, LogOut } from "lucide-react";
import { PageMateLogo } from "@/components/branding/PageMateLogo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getSyncMode } from "@/lib/store/session-store";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { useThemeStore } from "@/lib/store/theme-store";
import { useState } from "react";

export function SettingsPanel() {
  const profile = useSessionStore((s) => s.profile)!;
  const pair = useSessionStore((s) => s.pair)!;
  const buddy = useSessionStore((s) => s.buddy);
  const rename = useSessionStore((s) => s.rename);
  const leavePair = useSessionStore((s) => s.leavePair);
  const signOut = useSessionStore((s) => s.signOut);
  const [name, setName] = useState(profile.displayName);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const push = usePushNotifications();
  const install = usePWAInstall();
  const theme = useThemeStore((s) => s.theme);

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
        <PageMateLogo size={32} withWordmark />
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

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pair</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Buddy code</p>
            <p className="font-display text-2xl tracking-[0.2em]">{pair.buddyCode}</p>
            <p className="mt-1 text-[11px] text-muted">
              Share a book from Home or Library — not this code by itself.
            </p>
          </div>
          <Button
            size="icon"
            variant="secondary"
            aria-label="Copy buddy code"
            onClick={async () => {
              await navigator.clipboard.writeText(pair.buddyCode);
              useToastStore.getState().push({ title: "Code copied", tone: "success" });
            }}
          >
            <Copy size={16} />
          </Button>
        </div>
        <p className="text-sm text-muted">
          {buddy ? `Paired with ${buddy.displayName}` : "Waiting for a buddy to join a shared book…"}
        </p>
        <Button variant="ghost" className="w-full text-accent" onClick={() => void leavePair()}>
          Leave pair
        </Button>
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Notifications
        </p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Push notifications</p>
            <p className="text-xs text-muted">
              {push.subscribed ? "On — your buddy will ping this device" : "Off"}
            </p>
            {push.error ? <p className="text-xs text-accent">{push.error}</p> : null}
            {!push.supported && install.platform === "ios" ? (
              <p className="text-xs text-accent">
                On iPhone, Add to Home Screen first, then enable push.
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
                  ? "You should see a PageMate notification in a second."
                  : push.error ?? "Check the toggle and try again.",
                tone: ok ? "success" : "warn",
              });
            }}
          >
            Send test ping
          </Button>
        ) : (
          <p className="text-[11px] text-muted">
            Turn this on in Chrome on this same URL. Your buddy must enable it too,
            on their device.
          </p>
        )}
      </section>

      <section className="glass rounded-3xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Install</p>
        {install.installed ? (
          <p className="text-sm text-muted">Running as an installed app. Nice.</p>
        ) : (
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              if (install.canNativePrompt) void install.promptInstall();
              else install.open();
            }}
          >
            Install PageMate
          </Button>
        )}
      </section>

      <Button variant="ghost" className="w-full" onClick={() => setConfirmSignOut(true)}>
        <LogOut size={16} />
        Sign out
      </Button>

      <Modal
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
      >
        <p className="text-sm text-muted">
          You’ll need your email and password to come back. Your buddy code stays
          with this account.
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
