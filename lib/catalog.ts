import { coverUrlFromDoc, searchOpenLibrary } from "@/lib/openlibrary";
import type { TitleKind } from "@/lib/types";
import { defaultTotalUnits } from "@/lib/media";

export interface CatalogHit {
  id: string;
  kind: TitleKind;
  title: string;
  creator: string;
  coverUrl: string | null;
  totalUnits: number;
  year?: number;
  source: string;
}

interface ItunesResult {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackCount?: number;
  releaseDate?: string;
}

function itunesArt(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace("100x100bb", "600x600bb").replace("100x100", "600x600");
}

async function searchItunes(query: string, entity: string): Promise<ItunesResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=8`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: ItunesResult[] };
  return json.results ?? [];
}

function yearOf(iso?: string): number | undefined {
  if (!iso) return undefined;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : undefined;
}

async function searchGoogleBooks(query: string): Promise<CatalogHit[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: {
      id: string;
      volumeInfo?: {
        title?: string;
        authors?: string[];
        pageCount?: number;
        publishedDate?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      };
    }[];
  };
  return (json.items ?? []).map((item) => {
    const info = item.volumeInfo ?? {};
    const raw = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "";
    const cover = raw ? raw.replace(/^http:/, "https:") : null;
    return {
      id: `gbooks:${item.id}`,
      kind: "course" as const,
      title: info.title ?? "Untitled",
      creator: info.authors?.[0] ?? "Unknown",
      coverUrl: cover,
      totalUnits: Math.max(1, info.pageCount ?? defaultTotalUnits("course")),
      year: yearOf(info.publishedDate),
      source: "Google Books",
    };
  });
}

async function searchBooks(query: string): Promise<CatalogHit[]> {
  const docs = await searchOpenLibrary(query, 8);
  return docs.map((doc) => ({
    id: `ol:${doc.key}`,
    kind: "book",
    title: doc.title,
    creator: doc.author_name?.[0] ?? "Unknown",
    coverUrl: coverUrlFromDoc(doc, "L"),
    totalUnits: Math.max(1, doc.number_of_pages_median ?? defaultTotalUnits("book")),
    year: doc.first_publish_year,
    source: "Open Library",
  }));
}

async function searchMovies(query: string): Promise<CatalogHit[]> {
  const results = await searchItunes(query, "movie");
  const hits = results
    .filter((r) => r.trackName)
    .map((r) => {
      const mins = Math.round((r.trackTimeMillis ?? 0) / 60000);
      return {
        id: `itunes-movie:${r.trackId ?? r.collectionId}`,
        kind: "movie" as const,
        title: r.trackName ?? "Untitled",
        creator: r.artistName ?? "Unknown",
        coverUrl: itunesArt(r.artworkUrl100),
        // Prefer real runtimes; push unknown-length results to the end later.
        totalUnits: mins > 0 ? mins : 0,
        year: yearOf(r.releaseDate),
        source: "iTunes",
      };
    });
  // Real runtimes first; fill missing with a sensible default only at the end.
  hits.sort((a, b) => (b.totalUnits > 0 ? 1 : 0) - (a.totalUnits > 0 ? 1 : 0));
  return hits.map((h) => ({
    ...h,
    totalUnits: h.totalUnits > 0 ? h.totalUnits : defaultTotalUnits("movie"),
  }));
}

interface TvmazeShow {
  id: number;
  name?: string;
  premiered?: string;
  image?: { medium?: string; original?: string } | null;
  network?: { name?: string } | null;
  webChannel?: { name?: string } | null;
  status?: string;
}

interface TvmazeSeason {
  season?: number;
  number?: number;
  name?: string;
  episodeOrder?: number | null;
}

function tvmazeShowId(hitId: string): number | null {
  if (!hitId.startsWith("tvmaze:")) return null;
  const n = Number(hitId.slice("tvmaze:".length));
  return Number.isFinite(n) ? n : null;
}

async function episodeCountForShow(showId: number): Promise<number> {
  try {
    const seasonRes = await fetch(`https://api.tvmaze.com/shows/${showId}/seasons`, {
      headers: { Accept: "application/json" },
    });
    if (seasonRes.ok) {
      const rows = ((await seasonRes.json()) as TvmazeSeason[]) ?? [];
      const sum = rows.reduce((n, row) => n + Math.max(0, Number(row.episodeOrder ?? 0)), 0);
      if (sum > 0) return sum;
    }
    const epRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`, {
      headers: { Accept: "application/json" },
    });
    if (epRes.ok) {
      const eps = ((await epRes.json()) as unknown[]) ?? [];
      return Math.max(0, eps.length);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

async function searchSeries(query: string): Promise<CatalogHit[]> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { show?: TvmazeShow }[];
  const shows = (json ?? [])
    .map((row) => row.show)
    .filter((show): show is TvmazeShow => Boolean(show?.id && show.name))
    .slice(0, 8);

  const counts = await Promise.all(shows.map((s) => episodeCountForShow(s.id)));
  return shows.map((show, i) => ({
    id: `tvmaze:${show.id}`,
    kind: "series" as const,
    title: show.name ?? "Untitled",
    creator: show.network?.name ?? show.webChannel?.name ?? "Unknown",
    coverUrl: show.image?.original ?? show.image?.medium ?? null,
    totalUnits: Math.max(1, counts[i] || defaultTotalUnits("series")),
    year: yearOf(show.premiered),
    source: "TVMaze",
  }));
}

export interface SeriesSeason {
  key: string;
  number: number | "all";
  label: string;
  episodes: number;
  titleSuffix: string;
}

export async function fetchSeriesSeasons(hitId: string): Promise<SeriesSeason[]> {
  const id = tvmazeShowId(hitId);
  if (id == null) return [];
  const seasonRes = await fetch(`https://api.tvmaze.com/shows/${id}/seasons`, {
    headers: { Accept: "application/json" },
  });
  let seasons: { number: number; episodes: number }[] = [];
  if (seasonRes.ok) {
    const rows = ((await seasonRes.json()) as TvmazeSeason[]) ?? [];
    seasons = rows
      .map((row) => ({
        number: Number(row.number ?? row.season ?? 0),
        episodes: Math.max(0, Number(row.episodeOrder ?? 0)),
      }))
      .filter((s) => s.number > 0 && s.episodes > 0);
  }
  if (!seasons.length) {
    const epRes = await fetch(`https://api.tvmaze.com/shows/${id}/episodes`, {
      headers: { Accept: "application/json" },
    });
    if (epRes.ok) {
      const eps = ((await epRes.json()) as { season?: number }[]) ?? [];
      const bySeason = new Map<number, number>();
      for (const ep of eps) {
        const n = Number(ep.season ?? 0);
        if (n <= 0) continue;
        bySeason.set(n, (bySeason.get(n) ?? 0) + 1);
      }
      seasons = [...bySeason.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, episodes]) => ({ number, episodes }));
    }
  }
  const total = seasons.reduce((sum, s) => sum + s.episodes, 0);
  const picks: SeriesSeason[] = [];
  if (total > 0) {
    picks.push({
      key: "all",
      number: "all",
      label: `All · ${total} ep`,
      episodes: total,
      titleSuffix: "",
    });
  }
  for (const s of seasons) {
    picks.push({
      key: `s${s.number}`,
      number: s.number,
      label: `S${s.number} · ${s.episodes}`,
      episodes: s.episodes,
      titleSuffix: ` · Season ${s.number}`,
    });
  }
  return picks;
}

async function searchCourses(query: string): Promise<CatalogHit[]> {
  const [podcasts, books] = await Promise.all([
    searchItunes(`${query} course`, "podcast"),
    searchGoogleBooks(`${query} course`),
  ]);
  const fromItunes: CatalogHit[] = podcasts
    .filter((r) => r.collectionName || r.trackName)
    .map((r) => ({
      id: `itunes-course:${r.collectionId ?? r.trackId}`,
      kind: "course" as const,
      title: r.collectionName ?? r.trackName ?? "Untitled",
      creator: r.artistName ?? "Unknown",
      coverUrl: itunesArt(r.artworkUrl100),
      totalUnits: Math.max(1, r.trackCount ?? defaultTotalUnits("course")),
      year: yearOf(r.releaseDate),
      source: "iTunes Podcasts",
    }));
  const seen = new Set<string>();
  const merged: CatalogHit[] = [];
  for (const hit of [...fromItunes, ...books]) {
    const key = hit.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(hit);
  }
  return merged.slice(0, 10);
}

/**
 * Films and TV shows share one "Movie" tab, so a title like "Breaking Bad"
 * needs to surface as a series even if the user hasn't flipped the
 * Film/Series switch — otherwise it silently gets added as a 1-minute movie.
 * Search both catalogs and put whichever type the user has selected first.
 */
async function searchWatchable(query: string, preferred: TitleKind): Promise<CatalogHit[]> {
  const [movies, series] = await Promise.all([searchMovies(query), searchSeries(query)]);
  const primary = preferred === "series" ? series : movies;
  const secondary = preferred === "series" ? movies : series;
  return [...primary, ...secondary].slice(0, 10);
}

/** Public catalogs — user taps a hit to approve cover, title, and length. */
export async function searchCatalog(kind: TitleKind, query: string): Promise<CatalogHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    if (kind === "movie" || kind === "series") return await searchWatchable(q, kind);
    if (kind === "course") return await searchCourses(q);
    return await searchBooks(q);
  } catch {
    return [];
  }
}
