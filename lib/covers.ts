const PLACEHOLDER_SNIPPETS = [
  "/icons/icon",
  "icon-192",
  "icon-512",
  "apple-touch-icon",
];

export function isUsableCoverUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  return !PLACEHOLDER_SNIPPETS.some((snip) => value.includes(snip));
}

export async function lookupCoverUrl(title: string, author?: string): Promise<string | null> {
  const q = [title, author].map((s) => s?.trim()).filter(Boolean).join(" ");
  if (q.length < 2) return null;
  try {
    const { searchOpenLibrary, coverUrlFromDoc } = await import("@/lib/openlibrary");
    const docs = await searchOpenLibrary(q, 8);
    for (const doc of docs) {
      const url = coverUrlFromDoc(doc, "L");
      if (url) return url;
    }
  } catch {
    return null;
  }
  return null;
}
