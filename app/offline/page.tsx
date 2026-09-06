import { TrackmateLogo } from "@/components/branding/TrackmateLogo";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <TrackmateLogo size={56} withWordmark />
      <h1 className="font-display text-2xl">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted">
        Trackmate will keep your last page turns and replay them when the
        connection returns.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center rounded-2xl bg-brand px-5 text-sm font-medium"
      >
        Try again
      </Link>
    </div>
  );
}
