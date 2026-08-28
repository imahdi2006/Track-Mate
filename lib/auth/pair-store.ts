import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { mergePairDocs } from "@/lib/sync/merge-pair";
import type { Book, MicroNote, Profile, PushSubscriptionRecord, ReadingPair, ReadingProgress, Activity } from "@/lib/types";

const STORE_PATH = path.join(process.cwd(), ".data", "pairs.json");

export interface PairDoc {
  pair: ReadingPair;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  profiles: Profile[];
  pushSubscriptions?: PushSubscriptionRecord[];
  removedBookIds?: string[];
}

interface PairStore {
  pairs: Record<string, PairDoc>;
}

async function readStore(): Promise<PairStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PairStore;
    return { pairs: parsed.pairs ?? {} };
  } catch {
    return { pairs: {} };
  }
}

async function writeStore(store: PairStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

let queue: Promise<unknown> = Promise.resolve();

function withStore<T>(fn: (store: PairStore) => T): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await writeStore(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function upsertPairDoc(doc: PairDoc): Promise<void> {
  const code = doc.pair.buddyCode.trim().toUpperCase();
  await withStore((store) => {
    const incoming: PairDoc = { ...doc, pair: { ...doc.pair, buddyCode: code } };
    const existing = store.pairs[code];
    store.pairs[code] = existing ? mergePairDocs(existing, incoming) : incoming;
  });
}

export async function getPairDoc(code: string): Promise<PairDoc | null> {
  const store = await readStore();
  return store.pairs[code.trim().toUpperCase()] ?? null;
}
