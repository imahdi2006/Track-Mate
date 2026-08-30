import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/** Local SQLite demo APIs are disabled when Supabase is configured (Vercel production). */
export function localApiUnavailable(): NextResponse | null {
  if (!isSupabaseConfigured()) return null;
  return NextResponse.json(
    {
      message:
        "Local SQLite APIs are disabled. Use Supabase Auth and rooms (cloud path).",
    },
    { status: 501 },
  );
}
