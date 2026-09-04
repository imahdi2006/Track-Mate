import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * The service worker can't read NEXT_PUBLIC_* env vars (it's a static file,
 * not bundled by Next), so it fetches the VAPID public key here when it
 * needs to silently resubscribe after `pushsubscriptionchange`. The key is
 * public by design (it's sent to browsers on every subscribe call already).
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  return NextResponse.json(
    { key },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
