export const APP_NAME = "Trackmate";
export const APP_TAGLINE = "Read, watch, and learn together.";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
export const BUG_REPORT_EMAIL = "mahdi.mahdi1385631@gmail.com";

export const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/imahdi2006/Page-Mate";
/** Buy me a coffee — paused in Settings while the project is open source. */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL ?? "https://buymeacoffee.com/imahdi2006";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isVapidConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** Prefer canonical production URL for Auth emails; fall back to this tab’s origin. */
export function getAuthRedirectOrigin(): string {
  if (typeof window !== "undefined") {
    const live = window.location.origin.replace(/\/$/, "");
    const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    // On the real deployed host, always use that host so confirmation /
    // reset links open Trackmate — not an old Vercel preview URL stored
    // as Site URL alone.
    if (live && !/localhost|127\.0\.0\.1/.test(live)) return live;
    if (configured) return configured;
    return live;
  }
  return getAppUrl();
}

export const PAGE_DEBOUNCE_MS = 420;
export const PUSH_THROTTLE_MS = 15_000;
export const INSTALL_DISMISS_DAYS = 14;
/** Storage key prefix kept as pagemate-* so existing local demos keep working. */
export const OFFLINE_QUEUE_KEY = "pagemate-offline-queue";
export const INSTALL_DISMISS_KEY = "pagemate-install-dismissed-at";
export const IOS_INSTALL_DISMISS_KEY = "pagemate-ios-install-dismissed-at";
export const PUSH_PROMPT_SEEN_KEY = "pagemate-push-prompt-seen";
export const THEME_KEY = "pagemate-theme";
export const PENDING_JOIN_KEY = "pagemate-pending-join";
export const PENDING_BOOK_KEY = "pagemate-pending-book";
export const ACTIVE_ROOM_KEY = "pagemate-active-room";
export const ROOM_MAX_MEMBERS = 5;
export const ROOM_MIN_MEMBERS = 2;

