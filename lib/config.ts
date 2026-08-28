export const APP_NAME = "PageMate";
export const APP_TAGLINE = "Read together. Stay in sync.";

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
export const OFFLINE_QUEUE_KEY = "pagemate-offline-queue";
export const INSTALL_DISMISS_KEY = "pagemate-install-dismissed-at";
export const IOS_INSTALL_DISMISS_KEY = "pagemate-ios-install-dismissed-at";
export const PUSH_PROMPT_SEEN_KEY = "pagemate-push-prompt-seen";
export const THEME_KEY = "pagemate-theme";
export const PENDING_JOIN_KEY = "pagemate-pending-join";
export const PENDING_BOOK_KEY = "pagemate-pending-book";

