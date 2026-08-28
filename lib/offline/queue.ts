"use client";

import { get, set } from "idb-keyval";
import { OFFLINE_QUEUE_KEY } from "@/lib/config";
import type { QueuedMutation } from "@/lib/types";
import { generateId, isBrowser } from "@/lib/utils";

const MEMORY_FALLBACK_KEY = "pagemate-offline-queue-ls";

async function readQueue(): Promise<QueuedMutation[]> {
  if (!isBrowser()) return [];
  try {
    const fromIdb = await get<QueuedMutation[]>(OFFLINE_QUEUE_KEY);
    if (Array.isArray(fromIdb)) return fromIdb;
  } catch {
    // IndexedDB can fail in private-mode Safari; fall through.
  }
  try {
    const raw = localStorage.getItem(MEMORY_FALLBACK_KEY);
    if (raw) return JSON.parse(raw) as QueuedMutation[];
  } catch {
    /* ignore */
  }
  return [];
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  if (!isBrowser()) return;
  try {
    await set(OFFLINE_QUEUE_KEY, queue);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(MEMORY_FALLBACK_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

export async function enqueueMutation(
  mutation: Omit<QueuedMutation, "id" | "createdAt"> &
    Partial<Pick<QueuedMutation, "id" | "createdAt">>,
): Promise<QueuedMutation> {
  const item = {
    ...mutation,
    id: mutation.id ?? generateId(),
    createdAt: mutation.createdAt ?? Date.now(),
  } as QueuedMutation;
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export async function peekQueue(): Promise<QueuedMutation[]> {
  return readQueue();
}

export async function dequeueMutation(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((m) => m.id !== id));
}

export async function replaceQueue(queue: QueuedMutation[]): Promise<void> {
  await writeQueue(queue);
}

export function isOnline(): boolean {
  if (!isBrowser()) return true;
  return navigator.onLine;
}
