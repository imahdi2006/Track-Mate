import type {
  Activity,
  Book,
  MicroNote,
  Profile,
  PushSubscriptionRecord,
  ReadingPair,
  ReadingProgress,
} from "@/lib/types";
import { isUsableCoverUrl } from "@/lib/covers";

export interface PairDocLike {
  pair: ReadingPair;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  profiles: Profile[];
  pushSubscriptions?: PushSubscriptionRecord[];
  removedBookIds?: string[];
}

function stamp(iso: string | null | undefined): number {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function mergeById<T extends { id: string }>(left: T[], right: T[], pick: (a: T, b: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of left) map.set(item.id, item);
  for (const item of right) {
    const prev = map.get(item.id);
    map.set(item.id, prev ? pick(prev, item) : item);
  }
  return [...map.values()];
}

function mergeProgress(left: ReadingProgress[], right: ReadingProgress[]): ReadingProgress[] {
  const map = new Map<string, ReadingProgress>();
  for (const row of [...left, ...right]) {
    const key = `${row.bookId}:${row.userId}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const newer =
      stamp(row.updatedAt) > stamp(prev.updatedAt) ||
      (stamp(row.updatedAt) === stamp(prev.updatedAt) && row.currentPage >= prev.currentPage);
    map.set(key, newer ? row : prev);
  }
  return [...map.values()];
}

function mergePairMeta(base: ReadingPair, incoming: ReadingPair): ReadingPair {
  return {
    id: base.id || incoming.id,
    buddyCode: (incoming.buddyCode || base.buddyCode).trim().toUpperCase(),
    userAId: base.userAId || incoming.userAId,
    userBId: base.userBId || incoming.userBId,
    createdAt: stamp(base.createdAt) <= stamp(incoming.createdAt) ? base.createdAt : incoming.createdAt,
  };
}

function mergeProfiles(left: Profile[], right: Profile[]): Profile[] {
  return mergeById(left, right, (a, b) => ({ ...a, ...b, email: b.email ?? a.email }));
}

function mergePush(
  left: PushSubscriptionRecord[] | undefined,
  right: PushSubscriptionRecord[] | undefined,
): PushSubscriptionRecord[] {
  const map = new Map<string, PushSubscriptionRecord>();
  for (const row of [...(left ?? []), ...(right ?? [])]) {
    if (!row.endpoint) continue;
    map.set(row.endpoint, row);
  }
  return [...map.values()];
}

function pickCover(a: Book, b: Book): string | null {
  if (isUsableCoverUrl(b.coverUrl)) return b.coverUrl!;
  if (isUsableCoverUrl(a.coverUrl)) return a.coverUrl!;
  return b.coverUrl ?? a.coverUrl ?? null;
}

/** Merge two pair snapshots. Never lets a stale client clear `userBId` or rewind pages. */
export function mergePairDocs(base: PairDocLike, incoming: PairDocLike): PairDocLike {
  const pair = mergePairMeta(base.pair, incoming.pair);
  const removedBookIds = [
    ...new Set([...(base.removedBookIds ?? []), ...(incoming.removedBookIds ?? [])]),
  ];
  const removed = new Set(removedBookIds);
  const books = mergeById(base.books, incoming.books, (a, b) => ({
    ...a,
    ...b,
    pairId: pair.id,
    coverUrl: pickCover(a, b),
  }))
    .map((book) => ({ ...book, pairId: pair.id }))
    .filter((book) => !removed.has(book.id));
  const progress = mergeProgress(base.progress, incoming.progress).filter((p) => !removed.has(p.bookId));
  const notes = mergeById(base.notes, incoming.notes, (a, b) =>
    stamp(a.createdAt) >= stamp(b.createdAt) ? a : b,
  ).filter((n) => !removed.has(n.bookId));
  const activities = mergeById(base.activities, incoming.activities, (a, b) =>
    stamp(a.createdAt) >= stamp(b.createdAt) ? a : b,
  )
    .filter((a) => !a.bookId || !removed.has(a.bookId))
    .sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt))
    .slice(0, 200);
  const profiles = mergeProfiles(base.profiles, incoming.profiles);
  const pushSubscriptions = mergePush(base.pushSubscriptions, incoming.pushSubscriptions);
  return {
    pair,
    books,
    progress,
    activities,
    notes,
    profiles,
    pushSubscriptions,
    removedBookIds,
  };
}

export function pairContentFingerprint(doc: PairDocLike): string {
  return JSON.stringify({
    pairId: doc.pair.id,
    userBId: doc.pair.userBId,
    books: doc.books.map((b) => [b.id, b.status, b.title, b.coverUrl]),
    removed: doc.removedBookIds ?? [],
    progress: [...doc.progress]
      .map((p) => [p.bookId, p.userId, p.currentPage, p.updatedAt])
      .sort(),
    notes: doc.notes.map((n) => n.id).sort(),
    activities: doc.activities.slice(0, 20).map((a) => a.id),
    profiles: doc.profiles.map((p) => [p.id, p.displayName]),
    push: (doc.pushSubscriptions ?? []).map((s) => s.endpoint).sort(),
  });
}
