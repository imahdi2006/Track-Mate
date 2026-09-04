import { APP_NAME, PENDING_BOOK_KEY, PENDING_JOIN_KEY } from "@/lib/config";
import { shareVerb } from "@/lib/media";

export function parseBuddyCode(raw: string): string {
  const trimmed = raw.trim();
  const fromPath = trimmed.match(/\/join\/([A-Za-z0-9]{4,8})/i);
  if (fromPath) return fromPath[1]!.toUpperCase().slice(0, 6);
  const fromQuery = trimmed.match(/[?&](?:join|code|pair)=([A-Za-z0-9]{4,8})/i);
  if (fromQuery) return fromQuery[1]!.toUpperCase().slice(0, 6);
  return trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

/** Book id from `/join/{code}?book=` (pasted URL or query). */
export function parseBookIdFromInvite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, "https://bookmate.local");
    const book = url.searchParams.get("book")?.trim();
    if (book) return book;
  } catch {
    /* not a URL */
  }
  const match = trimmed.match(/[?&]book=([^&]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

function originNow(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

export function bookShareUrl(bookId: string, inviteCode: string): string {
  const code = parseBuddyCode(inviteCode);
  return `${originNow()}/join/${code}?book=${encodeURIComponent(bookId)}`;
}

export function roomShareUrl(inviteCode: string): string {
  const code = parseBuddyCode(inviteCode);
  return `${originNow()}/join/${code}`;
}

export function readPendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = parseBuddyCode(sessionStorage.getItem(PENDING_JOIN_KEY) ?? "");
    return code.length === 6 ? code : null;
  } catch {
    return null;
  }
}

export function writePendingJoinCode(code: string): void {
  if (typeof window === "undefined") return;
  const clean = parseBuddyCode(code);
  if (clean.length === 6) sessionStorage.setItem(PENDING_JOIN_KEY, clean);
}

export function clearPendingJoinCode(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_JOIN_KEY);
}

export function readPendingBookId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PENDING_BOOK_KEY);
  } catch {
    return null;
  }
}

export function writePendingBookId(bookId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (bookId) sessionStorage.setItem(PENDING_BOOK_KEY, bookId);
}

export function takePendingBookId(): string | null {
  const id = readPendingBookId();
  if (typeof window !== "undefined") sessionStorage.removeItem(PENDING_BOOK_KEY);
  return id;
}

export type ShareResult = "shared" | "copied" | "manual";

export async function shareOrCopyBook(input: {
  bookId: string;
  buddyCode: string;
  title: string;
  kind?: import("@/lib/types").TitleKind;
}): Promise<ShareResult> {
  const url = bookShareUrl(input.bookId, input.buddyCode);
  const verb = shareVerb(input.kind ?? "book");
  const text = `Let’s ${verb} “${input.title}” together on ${APP_NAME}.`;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: input.title, text, url });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}

export async function shareOrCopyRoom(inviteCode: string): Promise<ShareResult> {
  const url = roomShareUrl(inviteCode);
  const text = `Join my reading room on ${APP_NAME}.`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: APP_NAME, text, url });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
