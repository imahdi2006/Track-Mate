import type { Profile, ReadingProgress, TrackmateSnapshot } from "@/lib/types";
import { isDebounceArmed } from "@/lib/sync/mutex";

function progressKey(row: Pick<ReadingProgress, "bookId" | "userId">): string {
  return `${row.bookId}:${row.userId}`;
}

function pageMutexKey(bookId: string, userId: string): string {
  return `page:${bookId}:${userId}`;
}

function isFresher(local: ReadingProgress, remote: ReadingProgress): boolean {
  const lt = Date.parse(local.updatedAt) || 0;
  const rt = Date.parse(remote.updatedAt) || 0;
  if (lt !== rt) return lt > rt;
  // Same clock: never roll a just-tapped page back to a stale server value.
  return local.currentPage > remote.currentPage;
}

/**
 * Remote snapshots (Realtime, focus refetch, note-read hydrate) must not
 * overwrite a page the user just tapped. Optimistic rows have a newer
 * `updatedAt`; an armed debounce means the persist hasn't even started.
 */
export function mergeProgressPreferLocalFresh(
  local: ReadingProgress[],
  remote: ReadingProgress[],
  myUserId: string | null,
): ReadingProgress[] {
  const remoteByKey = new Map(remote.map((row) => [progressKey(row), row]));
  const used = new Set<string>();
  const out: ReadingProgress[] = [];

  for (const row of remote) {
    const key = progressKey(row);
    used.add(key);
    if (!myUserId || row.userId !== myUserId) {
      out.push(row);
      continue;
    }
    const mine = local.find((p) => progressKey(p) === key);
    if (!mine) {
      out.push(row);
      continue;
    }
    const pending = isDebounceArmed(pageMutexKey(row.bookId, row.userId));
    out.push(pending || isFresher(mine, row) ? mine : row);
  }

  for (const row of local) {
    if (row.userId !== myUserId) continue;
    const key = progressKey(row);
    if (used.has(key)) continue;
    if (isDebounceArmed(pageMutexKey(row.bookId, row.userId)) || row.id.startsWith("tmp_")) {
      out.push(row);
    }
  }

  return out;
}

export function applyRemoteSnapshot<T extends { progress: ReadingProgress[]; profile: Profile | null }>(
  state: T,
  partial: Partial<TrackmateSnapshot>,
): T {
  const next = { ...state, ...partial };
  if (partial.profile === null && Array.isArray(partial.books)) {
    return next;
  }
  if (partial.progress) {
    const myId = state.profile?.id ?? partial.profile?.id ?? null;
    next.progress = mergeProgressPreferLocalFresh(state.progress, partial.progress, myId);
  }
  return next;
}
