"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { TrackmateLogo } from "@/components/branding/TrackmateLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { isSupabaseConfigured } from "@/lib/config";
import { isEmailConfirmationRequired } from "@/lib/auth/errors";
import { readPendingJoinCode } from "@/lib/invite";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";

type AuthView = "signin" | "signup" | "forgot";

export function AuthScreen() {
  const signIn = useSessionStore((s) => s.signIn);
  const signInWithGoogle = useSessionStore((s) => s.signInWithGoogle);
  const requestPasswordReset = useSessionStore((s) => s.requestPasswordReset);
  const [view, setView] = useState<AuthView>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const cloud = isSupabaseConfigured();

  useEffect(() => {
    setPendingJoin(readPendingJoinCode());
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("auth") === "error") {
      useToastStore.getState().push({
        title: "Google sign-in didn’t finish",
        body: "Approve Trackmate in the Google prompt, or use email.",
        tone: "warn",
      });
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (view === "forgot") {
      if (!email.trim()) return;
      setBusy(true);
      setResetUrl(null);
      try {
        const result = await requestPasswordReset(email.trim());
        if (result.resetUrl) {
          setResetUrl(result.resetUrl);
        }
        useToastStore.getState().push({
          title: result.emailed ? "Check your email" : "Copy your reset link",
          body: result.message,
          tone: result.emailed ? "success" : "warn",
        });
        if (result.emailed) setView("signin");
      } catch (err) {
        useToastStore.getState().push({
          title: "Couldn’t send reset",
          body: err instanceof Error ? err.message : "Try again",
          tone: "warn",
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) return;
    if (view === "signup" && !name.trim()) return;
    setBusy(true);
    try {
      await signIn({
        displayName: name.trim() || email.split("@")[0] || "Reader",
        email: email.trim(),
        password,
        mode: view,
      });
    } catch (err) {
      if (view === "signup" && isEmailConfirmationRequired(err)) {
        setCheckEmail(err.email);
        useToastStore.getState().push({
          title: "Check your inbox",
          body: err.message,
          tone: "success",
        });
        return;
      }
      useToastStore.getState().push({
        title: view === "signup" ? "Couldn’t create account" : "Couldn’t sign in",
        body: err instanceof Error ? err.message : "Try again",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t open Google",
        body: err instanceof Error ? err.message : "Try email instead.",
        tone: "warn",
      });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <TrackmateLogo size={52} withWordmark wordmarkClassName="text-2xl" />
          <ThemeSwitch />
        </div>
        <h1 className="font-display mt-6 text-3xl leading-tight text-cream">
          Read, watch, learn.
          <br />
          Stay in sync.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Share a book, course, or movie — not your password. Google signs you in
          or creates an account in one tap. Same Gmail as before keeps the same shelf.
        </p>
        {pendingJoin ? (
          <p className="mt-3 rounded-2xl bg-brand/15 px-3 py-2 text-sm text-cream">
            Invite waiting — after you sign in you’ll join pair{" "}
            <span className="font-display tracking-[0.2em]">{pendingJoin}</span>.
          </p>
        ) : null}

        {!checkEmail && view !== "forgot" ? (
          <div className="mt-5 space-y-3">
            <GoogleSignInButton busy={busy} disabled={busy} onClick={() => void onGoogle()} />
            <p className="text-center text-[11px] text-muted">
              Continue with Google signs you in or creates an account.
            </p>
            <p className="text-center text-[11px] text-muted">or email</p>
          </div>
        ) : null}

        {checkEmail ? (
          <div className="mt-6 space-y-3 rounded-2xl bg-brand/15 px-4 py-4">
            <p className="font-display text-xl text-cream">Confirm your email</p>
            <p className="text-sm text-cream/90">
              We created your account. Open the message sent to{" "}
              <span className="font-medium">{checkEmail}</span>, tap the link, then sign in
              here. Check spam if you don’t see it within a few minutes.
            </p>
            <p className="text-xs text-muted">
              That email comes from your Trackmate project (Supabase), not from this screen.
              If nothing arrives, wait a bit and try Create account again — this is not a failed signup.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setCheckEmail(null);
                setView("signin");
                setPassword("");
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : null}

        {!checkEmail && view !== "forgot" ? (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              className={`rounded-xl py-2 text-sm ${view === "signin" ? "bg-brand text-white" : "text-muted"}`}
              onClick={() => setView("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-xl py-2 text-sm ${view === "signup" ? "bg-brand text-white" : "text-muted"}`}
              onClick={() => setView("signup")}
            >
              Create account
            </button>
          </div>
        ) : null}

        {!checkEmail ? (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
          {view === "signup" ? (
            <label className="text-xs font-medium uppercase tracking-wider text-muted">
              Your name
              <Input
                className="mt-1.5"
                dir="auto"
                placeholder="Mahdi"
                value={name}
                autoComplete="nickname"
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          ) : null}

          <label className="text-xs font-medium uppercase tracking-wider text-muted">
            Email
            <Input
              className="mt-1.5"
              type="email"
              placeholder="you@gmail.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {view !== "forgot" ? (
            <label className="text-xs font-medium uppercase tracking-wider text-muted">
              Password
              <Input
                className="mt-1.5"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                autoComplete={view === "signup" ? "new-password" : "current-password"}
                minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          ) : null}

          {view === "signin" ? (
            <button
              type="button"
              className="self-start text-xs text-brand-glow"
              onClick={() => setView("forgot")}
            >
              Forgot password?
            </button>
          ) : null}

          {view === "forgot" ? (
            <p className="text-xs text-muted">
              {cloud
                ? "We’ll email a reset link. It expires in one hour."
                : "On this server we show a reset link here when email isn’t configured. It expires in one hour."}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {cloud
                ? "Cloud accounts sync across phones. Forgot password sends a reset email."
                : "Same email and password keep your books and buddy code. Forgot it? We’ll email a reset link."}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={
              busy ||
              !email.trim() ||
              (view !== "forgot" && password.length < 6) ||
              (view === "signup" && !name.trim())
            }
            className="mt-1"
          >
            {view === "forgot" ? <Mail size={18} /> : cloud ? <KeyRound size={18} /> : <Sparkles size={18} />}
            {busy
              ? "Working…"
              : view === "forgot"
                ? "Send reset link"
                : view === "signup"
                  ? "Create account"
                  : "Sign in"}
          </Button>

          {resetUrl ? (
            <div className="rounded-2xl bg-white/5 p-3 space-y-2">
              <p className="text-xs text-muted">Reset link (tap copy, open in this browser):</p>
              <p className="break-all text-xs text-cream">{resetUrl}</p>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(resetUrl);
                  useToastStore.getState().push({
                    title: "Link copied",
                    body: "Paste it in the address bar or a new tab.",
                    tone: "success",
                  });
                }}
              >
                Copy reset link
              </Button>
            </div>
          ) : null}

          {view === "forgot" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResetUrl(null);
                setView("signin");
              }}
            >
              Back to sign in
            </Button>
          ) : null}
        </form>
        ) : null}
      </motion.div>
    </div>
  );
}
