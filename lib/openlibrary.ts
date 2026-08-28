import type { OpenLibraryDoc } from "@/lib/types";

const SEARCH_URL = "https://openlibrary.org/search.json";

export function coverUrlFromDoc(doc: OpenLibraryDoc, size: "S" | "M" | "L" = "L"): string | null {
  if (doc.cover_i) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
  }
  const isbn = doc.isbn?.[0];
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
  }
  return null;
}

export async function searchOpenLibrary(query: string, limit = 8): Promise<OpenLibraryDoc[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  const json = (await res.json()) as { docs?: OpenLibraryDoc[] };
  return json.docs ?? [];
}
