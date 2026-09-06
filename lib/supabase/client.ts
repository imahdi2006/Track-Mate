"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";

let browserClient: SupabaseClient | null = null;

// `createBrowserClient` (from @supabase/ssr, not plain supabase-js) stores
// the session as cookies instead of localStorage-only, so the JWT is
// readable by `middleware.ts` and server routes/components too — required
// for PKCE (Google OAuth) and for `/auth/callback` to exchange the code
// server-side. `autoRefreshToken`/`persistSession` are supabase-js defaults;
// spelled out here so it's a deliberate choice, not an accident: a PWA can
// sit installed for days, and the access token (~1h) must silently refresh
// via the long-lived refresh token the whole time it's open.
const AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
} as const;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    browserClient = createSupabaseBrowserClient(url, key, { auth: AUTH_OPTIONS });
  } catch {
    browserClient = createClient(url, key, { auth: AUTH_OPTIONS });
  }
  return browserClient;
}
