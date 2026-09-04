export const APP_NAME = "BookMate";
export const APP_TAGLINE = "Read, watch, and learn together.";

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
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000")
  );
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

