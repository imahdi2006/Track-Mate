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
  shelfScopeByUser?: Record<string, "all" | string[]>;
}

/** Push local state; returns the merged doc the server saved. */
export async function publishPairDoc(code: string, doc: RemotePairDoc): Promise<RemotePairDoc | null> {
  try {
    const res = await fetch(`/api/pairs/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(doc),
    });
    if (!res.ok) return null;
    return (await res.json()) as RemotePairDoc;
  } catch {
    return null;
  }
}

export function subscribePairStream(
  code: string,
  onDoc: (doc: RemotePairDoc) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => undefined;
  const source = new EventSource(`/api/pairs/${encodeURIComponent(code)}/stream`);
  source.onmessage = (event) => {
    try {
      onDoc(JSON.parse(event.data) as RemotePairDoc);
    } catch {
      /* ignore malformed events */
    }
  };
  return () => source.close();
}

export async function fetchPairDocForUser(profileId: string): Promise<RemotePairDoc | null> {
  try {
    const res = await fetch(`/api/pairs/by-user/${encodeURIComponent(profileId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RemotePairDoc;
  } catch {
    return null;
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
