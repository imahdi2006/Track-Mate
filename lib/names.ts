/** Prefer a human name over an email local-part like mahdi.mahdi1385631 */

export function looksLikeAccountHandle(name: string, email?: string | null): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n.includes("@")) return true;
  const local = email?.split("@")[0]?.trim();
  if (local && n.toLowerCase() === local.toLowerCase()) return true;
  if (/\d{3,}/.test(n) && /[._-]/.test(n)) return true;
  return false;
}

export function nameFromAuthMeta(meta: Record<string, unknown> | null | undefined, email?: string | null): string {
  const keys = ["given_name", "full_name", "name", "display_name"];
  for (const key of keys) {
    const raw = String(meta?.[key] ?? "").trim();
    if (raw && !looksLikeAccountHandle(raw, email)) return raw;
  }
  return softenHandle(email?.split("@")[0] ?? "Reader");
}

export function softenHandle(raw: string): string {
  const token = raw.trim().split(/[.\-_@]/)[0] ?? raw;
  if (/^[a-zA-Z\u0600-\u06FF]{2,}$/.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }
  return raw.trim() || "Reader";
}

export function personName(
  profile: { displayName?: string | null; email?: string | null } | null | undefined,
  fallback = "Reader",
): string {
  if (!profile) return fallback;
  const n = profile.displayName?.trim() ?? "";
  if (n && !looksLikeAccountHandle(n, profile.email)) return n;
  if (n) return softenHandle(n);
  if (profile.email) return softenHandle(profile.email.split("@")[0] ?? fallback);
  return fallback;
}
