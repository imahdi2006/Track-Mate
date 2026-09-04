import type { TitleKind } from "@/lib/types";

export function parseTitleKind(value: unknown): TitleKind {
  if (value === "course" || value === "movie" || value === "series") return value;
  return "book";
}

export function isWatchKind(kind: TitleKind): boolean {
  return kind === "movie" || kind === "series";
}

export function kindNoun(kind: TitleKind): string {
  if (kind === "course") return "course";
  if (kind === "movie") return "movie";
  if (kind === "series") return "series";
  return "book";
}

export function kindNounPlural(kind: TitleKind): string {
  if (kind === "course") return "courses";
  if (kind === "movie") return "movies";
  if (kind === "series") return "series";
  return "books";
}

export function creatorLabel(kind: TitleKind): string {
  if (kind === "course") return "Instructor";
  if (kind === "movie") return "Director / studio";
  if (kind === "series") return "Network / studio";
  return "Author";
}

export function unitNoun(kind: TitleKind, n = 2): string {
  if (kind === "course") return n === 1 ? "lesson" : "lessons";
  if (kind === "movie") return n === 1 ? "min" : "min";
  if (kind === "series") return n === 1 ? "episode" : "episodes";
  return n === 1 ? "page" : "pages";
}

export function unitTotalPlaceholder(kind: TitleKind): string {
  if (kind === "course") return "Total lessons";
  if (kind === "movie") return "Runtime (minutes)";
  if (kind === "series") return "Total episodes";
  return "Total pages";
}

export function defaultTotalUnits(kind: TitleKind): number {
  if (kind === "course") return 12;
  if (kind === "movie") return 120;
  if (kind === "series") return 10;
  return 320;
}

export function nowStatusLabel(kind: TitleKind): string {
  if (kind === "course") return "Learning";
  if (isWatchKind(kind)) return "Watching";
  return "Reading";
}

export function currentlyLabel(kind: TitleKind): string {
  if (kind === "course") return "Currently learning";
  if (isWatchKind(kind)) return "Currently watching";
  return "Currently reading";
}

export function shareVerb(kind: TitleKind): string {
  if (kind === "course") return "learn";
  if (isWatchKind(kind)) return "watch";
  return "read";
}

export function formatUnitMark(kind: TitleKind, n: number): string {
  if (kind === "course") return `L${n}`;
  if (kind === "movie") return `${n}m`;
  if (kind === "series") return `E${n}`;
  return `p.${n}`;
}

export function stepHints(kind: TitleKind): { label: string; d: number }[] {
  if (kind === "movie") {
    return [
      { label: "+1 min", d: 1 },
      { label: "+5 min", d: 5 },
      { label: "+10 min", d: 10 },
    ];
  }
  if (kind === "course") {
    return [
      { label: "+1 lesson", d: 1 },
      { label: "+5", d: 5 },
      { label: "+10", d: 10 },
    ];
  }
  if (kind === "series") {
    return [
      { label: "+1 ep", d: 1 },
      { label: "+5", d: 5 },
      { label: "+10", d: 10 },
    ];
  }
  return [
    { label: "+1 Page", d: 1 },
    { label: "+5 Pages", d: 5 },
    { label: "+10", d: 10 },
  ];
}

export function catalogHint(kind: TitleKind): string {
  if (kind === "course") return "Type a name — tap a result to use its cover.";
  if (kind === "movie") return "Type a title — tap a result to use its poster.";
  if (kind === "series") return "Type a show — tap a result, then pick a season.";
  return "Type a title — tap a result to use its cover.";
}
