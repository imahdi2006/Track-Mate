import { kindNoun, kindNounPlural, parseTitleKind } from "@/lib/media";

/** Match a shelf title against a typed query (title, creator, or kind). */
export function matchesShelfQuery(
  item: { title: string; author: string; kind?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const kind = parseTitleKind(item.kind);
  const hay = [item.title, item.author, kindNoun(kind), kindNounPlural(kind)]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}
