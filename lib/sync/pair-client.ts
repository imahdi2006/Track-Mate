"use client";

import type { Profile, PushSubscriptionRecord } from "@/lib/types";
import type { Book, ReadingPair, ReadingProgress, Activity, MicroNote } from "@/lib/types";

export interface RemotePairDoc {
  pair: ReadingPair;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  profiles: Profile[];
  pushSubscriptions?: PushSubscriptionRecord[];
  removedBookIds?: string[];
}

export async function publishPairDoc(code: string, doc: RemotePairDoc): Promise<void> {
  try {
    await fetch(`/api/pairs/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(doc),
    });
  } catch {
    /* local demo still works on this browser */
  }
}

export async function fetchPairDoc(code: string): Promise<RemotePairDoc | null> {
  try {
    const res = await fetch(`/api/pairs/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as RemotePairDoc;
  } catch {
    return null;
  }
}
