import { getDb } from "@/lib/db/sqlite";
import { mergePairDocs } from "@/lib/sync/merge-pair";
import type { Book, MicroNote, Profile, PushSubscriptionRecord, ReadingPair, ReadingProgress, Activity } from "@/lib/types";

export interface PairDoc {
  pair: ReadingPair;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  profiles: Profile[];
  pushSubscriptions?: PushSubscriptionRecord[];
  removedBookIds?: string[];
  shelfScopeByUser?: Record<string, "all" | string[]>;
}

type PairListener = (doc: PairDoc) => void;
const pairListeners = new Map<string, Set<PairListener>>();

function emitPairDoc(code: string, doc: PairDoc): void {
  const key = code.trim().toUpperCase();
  pairListeners.get(key)?.forEach((listener) => listener(doc));
}

/** In-process subscribers (SSE). Same Node process as PUT handlers on the VPS. */
export function subscribePairDoc(code: string, listener: PairListener): () => void {
  const key = code.trim().toUpperCase();
  if (!pairListeners.has(key)) pairListeners.set(key, new Set());
  pairListeners.get(key)!.add(listener);
  return () => pairListeners.get(key)?.delete(listener);
}

export async function upsertPairDoc(doc: PairDoc): Promise<PairDoc> {
  const code = doc.pair.buddyCode.trim().toUpperCase();
  const database = getDb();
  const incoming: PairDoc = { ...doc, pair: { ...doc.pair, buddyCode: code } };

  const merged = database.transaction(() => {
    const row = database
      .prepare("SELECT doc_json FROM pair_docs WHERE buddy_code = ?")
      .get(code) as { doc_json: string } | undefined;
    const existing = row ? (JSON.parse(row.doc_json) as PairDoc) : null;
    const next = existing ? mergePairDocs(existing, incoming) : incoming;
    database
      .prepare(
        `INSERT INTO pair_docs (buddy_code, doc_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(buddy_code) DO UPDATE SET doc_json = excluded.doc_json, updated_at = excluded.updated_at`,
      )
      .run(code, JSON.stringify(next), new Date().toISOString());
    return next;
  })();

  emitPairDoc(code, merged);
  return merged;
}

export async function getPairDoc(code: string): Promise<PairDoc | null> {
  const row = getDb()
    .prepare("SELECT doc_json FROM pair_docs WHERE buddy_code = ?")
    .get(code.trim().toUpperCase()) as { doc_json: string } | undefined;
  return row ? (JSON.parse(row.doc_json) as PairDoc) : null;
}

/** Find a pair doc when this browser has no local buddy code (multi-device on one VPS). */
export async function findPairDocForProfile(profileId: string): Promise<PairDoc | null> {
  const rows = getDb().prepare("SELECT doc_json FROM pair_docs").all() as { doc_json: string }[];
  let best: PairDoc | null = null;
  let bestScore = -1;
  for (const row of rows) {
    const doc = JSON.parse(row.doc_json) as PairDoc;
    const ids = [
      doc.pair.userAId,
      doc.pair.userBId,
      ...(doc.pair.memberIds ?? []),
    ].filter(Boolean);
    if (!ids.includes(profileId)) continue;
    const score = doc.books.length * 1000 + doc.progress.length;
    if (score > bestScore) {
      best = doc;
      bestScore = score;
    }
  }
  return best;
}
