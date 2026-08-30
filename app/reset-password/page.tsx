"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookMateLogo } from "@/components/branding/BookMateLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { completeServerPasswordReset } from "@/lib/auth/client-api";
import { clearAccessToken, registerLocalPassword } from "@/lib/auth/credentials";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToastStore } from "@/lib/store/toast-store";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const cloud = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return;
    setBusy(true);
    try {
      if (token) {
        const result = await completeServerPasswordReset(token, password);
        await registerLocalPassword(result.email, password, result.profileId);
        clearAccessToken();
        sessionStorage.removeItem("pagemate-session-user-id");
        useToastStore.getState().push({
          title: "Password updated",
          body: "Sign in with your new password.",
          tone: "success",
        });
        router.replace("/");
        return;
      }

      const sb = getSupabaseBrowserClient();
      if (!sb) {
        throw new Error("Open the reset link from your email. Request a new one from Sign in → Forgot password.");
      }
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      useToastStore.getState().push({
        title: "Password updated",
        body: "You can sign in with the new password.",
        tone: "success",
      });
      router.replace("/");
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t update password",
        body: err instanceof Error ? err.message : "Open the Gmail link again.",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="glass rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <BookMateLogo size={44} withWordmark />
          <ThemeSwitch />
        </div>
        <h1 className="font-display mt-5 text-2xl text-cream">New password</h1>
        <p className="mt-2 text-sm text-muted">
          {token || cloud
            ? "Choose a new password. This link works once and expires in an hour."
            : "Request a reset from Sign in → Forgot password, then open the Gmail link."}
        </p>
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            size="lg"
            disabled={busy || password.length < 6 || (!token && !cloud)}
          >
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Opening reset…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
