import { NextResponse } from "next/server";
import { isSupabaseConfigured, isVapidConfigured, getAppUrl } from "@/lib/config";

export const runtime = "nodejs";

/**
 * Visit /api/health after a deploy to confirm env vars actually reached the
 * server — no secrets, just booleans. If `supabaseConfigured` is false in
 * production, every auth/room/book request falls back to the local SQLite
 * demo path, which fails on Vercel's read-only filesystem
 * (`ENOENT ... mkdir '/var/task/.data'`).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    vapidConfigured: isVapidConfigured(),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    appUrl: getAppUrl(),
    nodeEnv: process.env.NODE_ENV,
  });
}
