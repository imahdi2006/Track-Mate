"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { TrackmateLogo } from "@/components/branding/TrackmateLogo";
import { Button } from "@/components/ui/Button";
import { BUG_REPORT_EMAIL } from "@/lib/config";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort console breadcrumb — no analytics wired up yet, so this
    // is the only trace we get if the user doesn't file a bug report.
    console.error("[Trackmate] Unhandled screen error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <TrackmateLogo size={56} withWordmark />
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        This screen hit an unexpected error. Your reading progress is safe — try again,
        or head back to Home.
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={() => reset()}>
          <RefreshCw size={16} />
          Try again
        </Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          Home
        </Button>
      </div>
      <a
        href={`mailto:${BUG_REPORT_EMAIL}?subject=Trackmate%20error&body=${encodeURIComponent(
          `${error.message}\n\ndigest: ${error.digest ?? "n/a"}`,
        )}`}
        className="text-xs text-muted underline"
      >
        Report this
      </a>
    </div>
  );
}
