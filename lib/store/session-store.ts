"use client";

import { create } from "zustand";
import { PAGE_DEBOUNCE_MS, isSupabaseConfigured } from "@/lib/config";
import { haptic } from "@/lib/haptic";
import {
  dequeueMutation,
  enqueueMutation,
  isOnline,
  peekQueue,
} from "@/lib/offline/queue";
import { createLocalAdapter } from "@/lib/sync/local-adapter";
import { debounceMutex } from "@/lib/sync/mutex";
import { createSupabaseAdapter } from "@/lib/sync/supabase-adapter";
import type { SyncAdapter } from "@/lib/sync/types";
import type {
  Activity,
  AuthPayload,
  Book,
  BookStatus,
  MicroNote,
  Profile,
  PushSubscriptionRecord,
  ReactionEmoji,
  ReadingPair,
  ReadingProgress,
} from "@/lib/types";
import { clamp } from "@/lib/utils";
import { fireCompletionConfetti } from "@/lib/confetti";
import { useToastStore } from "@/lib/store/toast-store";

let adapter: SyncAdapter | null = null;
let unsubscribeAdapter: (() => void) | null = null;

function getAdapter(): SyncAdapter {
  if (adapter) return adapter;
  adapter = isSupabaseConfigured()
    ? (createSupabaseAdapter() ?? createLocalAdapter())
    : createLocalAdapter();
  return adapter;
}

export function getSyncMode(): "local" | "supabase" {
  return getAdapter().mode;
}

interface SessionState {
  hydrated: boolean;
  hydrating: boolean;
  profile: Profile | null;
  pair: ReadingPair | null;
  buddy: Profile | null;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  pushSubscriptions: PushSubscriptionRecord[];
  lastError: string | null;
  hydrate: () => Promise<void>;
  signIn: (payload: AuthPayload) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ emailed: boolean; message: string }>;
  signOut: () => Promise<void>;
  createPair: () => Promise<void>;
  joinPair: (code: string) => Promise<void>;
  leavePair: () => Promise<void>;
  rename: (displayName: string) => Promise<void>;
  addBook: (input: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string | null;
    status?: BookStatus;
  }) => Promise<Book>;
  updateBook: (
    bookId: string,
    patch: {
      title?: string;
      author?: string;
      totalPages?: number;
      coverUrl?: string | null;
    },
  ) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  setBookStatus: (bookId: string, status: BookStatus) => Promise<void>;
  setPageOptimistic: (
    bookId: string,
    page: number | ((current: number) => number),
  ) => void;
  addNote: (input: {
    bookId: string;
    pageNumber: number;
    emoji?: ReactionEmoji | null;
    note?: string | null;
  }) => Promise<void>;
  savePushSubscription: (
    sub: Omit<PushSubscriptionRecord, "id" | "createdAt" | "userId">,
  ) => Promise<void>;
  removePushSubscription: (endpoint: string) => Promise<void>;
  replayOfflineQueue: () => Promise<void>;
}

function mergeProgress(
  list: ReadingProgress[],
  bookId: string,
  userId: string,
  page: number,
): ReadingProgress[] {
  const idx = list.findIndex((p) => p.bookId === bookId && p.userId === userId);
  const updatedAt = new Date().toISOString();
  if (idx === -1) {
    return [
      ...list,
      {
        id: `tmp_${bookId}_${userId}`,
        bookId,
        userId,
        currentPage: page,
        updatedAt,
      },
    ];
  }
  return list.map((p, i) =>
    i === idx ? { ...p, currentPage: page, updatedAt } : p,
  );
}

export const useSessionStore = create<SessionState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  profile: null,
  pair: null,
  buddy: null,
  books: [],
  progress: [],
  activities: [],
  notes: [],
  pushSubscriptions: [],
  lastError: null,

  hydrate: async () => {
    if (get().hydrating) return;
    set({ hydrating: true });
    try {
      const a = getAdapter();
      const snap = await a.hydrate();
      set({ ...snap, hydrated: true, hydrating: false, lastError: null });
      unsubscribeAdapter?.();
      unsubscribeAdapter = a.subscribe((partial) => {
        set((state) => ({ ...state, ...partial }));
      });
      void get().replayOfflineQueue();
    } catch (err) {
      set({
        hydrating: false,
        hydrated: true,
        lastError: err instanceof Error ? err.message : "Failed to load",
      });
    }
  },

  signIn: async (payload) => {
    const profile = await getAdapter().authenticate(payload);
    const snap = await getAdapter().hydrate();
    set({ ...snap, profile, lastError: null });
  },

  requestPasswordReset: async (email) => {
    return getAdapter().requestPasswordReset(email);
  },

  signOut: async () => {
    await getAdapter().signOut();
    set({
      profile: null,
      pair: null,
      buddy: null,
      books: [],
      progress: [],
      activities: [],
      notes: [],
      pushSubscriptions: [],
    });
  },

  createPair: async () => {
    const pair = await getAdapter().createPair();
    const snap = await getAdapter().hydrate();
    set({ ...snap, pair });
  },

  joinPair: async (code) => {
    const { pair, buddy } = await getAdapter().joinPair(code);
    const snap = await getAdapter().hydrate();
    set({ ...snap, pair, buddy });
  },

  leavePair: async () => {
    await getAdapter().leavePair();
    const profile = get().profile;
    set({
      pair: null,
      buddy: null,
      books: [],
      progress: [],
      activities: [],
      notes: [],
      profile,
    });
  },

  rename: async (displayName) => {
    const profile = await getAdapter().updateProfile({ displayName });
    set({ profile });
  },

  addBook: async (input) => {
    const book = await getAdapter().addBook(input);
    const snap = await getAdapter().hydrate();
    set(snap);
    haptic("success");
    return book;
  },

  updateBook: async (bookId, patch) => {
    set({
      books: get().books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              title: patch.title?.trim() || b.title,
              author: patch.author?.trim() || b.author,
              totalPages:
                patch.totalPages !== undefined
                  ? Math.max(1, Math.floor(patch.totalPages))
                  : b.totalPages,
              coverUrl: patch.coverUrl === undefined ? b.coverUrl : patch.coverUrl,
            }
          : b,
      ),
    });
    await getAdapter().updateBook(bookId, patch);
  },

  removeBook: async (bookId) => {
    set({
      books: get().books.filter((b) => b.id !== bookId),
      progress: get().progress.filter((p) => p.bookId !== bookId),
      notes: get().notes.filter((n) => n.bookId !== bookId),
      activities: get().activities.filter((a) => a.bookId !== bookId),
    });
    await getAdapter().removeBook(bookId);
  },

  setBookStatus: async (bookId, status) => {
    set({
      books: get().books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              status,
              completedAt:
                status === "completed"
                  ? new Date().toISOString()
                  : b.completedAt,
            }
          : b,
      ),
    });
    if (!isOnline()) {
      await enqueueMutation({
        type: "update_book_status",
        payload: { bookId, status },
      });
      return;
    }
    await getAdapter().updateBookStatus(bookId, status);
  },

  setPageOptimistic: (bookId, pageOrFn) => {
    const { profile, progress, books } = get();
    if (!profile) return;
    const current =
      progress.find((p) => p.bookId === bookId && p.userId === profile.id)
        ?.currentPage ?? 0;
    const book = books.find((b) => b.id === bookId);
    const next = clamp(
      typeof pageOrFn === "function" ? pageOrFn(current) : pageOrFn,
      0,
      book?.totalPages ?? Number.MAX_SAFE_INTEGER,
    );
    if (next === current) return;

    set({ progress: mergeProgress(progress, bookId, profile.id, next) });
    haptic("selection");

    const key = `page:${bookId}:${profile.id}`;
    debounceMutex(
      key,
      async () => {
        const latest =
          get().progress.find(
            (p) => p.bookId === bookId && p.userId === profile.id,
          )?.currentPage ?? next;
        if (!isOnline()) {
          await enqueueMutation({
            type: "update_page",
            payload: {
              bookId,
              userId: profile.id,
              page: latest,
              previousPage: current,
            },
          });
          useToastStore.getState().push({
            title: "Saved offline",
            body: "We'll sync this page turn when you're back online.",
          });
          return;
        }
        await getAdapter().updatePage(bookId, latest, current);

        const snap = get();
        const mine = snap.progress.find(
          (p) => p.bookId === bookId && p.userId === profile.id,
        );
        const theirs = snap.buddy
          ? snap.progress.find(
              (p) => p.bookId === bookId && p.userId === snap.buddy!.id,
            )
          : undefined;
        if (
          book &&
          mine &&
          theirs &&
          mine.currentPage >= book.totalPages &&
          theirs.currentPage >= book.totalPages
        ) {
          fireCompletionConfetti();
          haptic("success");
        }
      },
      PAGE_DEBOUNCE_MS,
    );
  },

  addNote: async (input) => {
    haptic("light");
    if (!isOnline()) {
      await enqueueMutation({
        type: "add_note",
        payload: {
          bookId: input.bookId,
          userId: get().profile!.id,
          pageNumber: input.pageNumber,
          emoji: input.emoji ?? null,
          note: input.note ?? null,
        },
      });
      useToastStore.getState().push({
        title: "Note queued",
        body: "We'll deliver it to your buddy when you're online.",
      });
      return;
    }
    await getAdapter().addNote(input);
    const snap = await getAdapter().hydrate();
    set(snap);
  },

  savePushSubscription: async (sub) => {
    await getAdapter().savePushSubscription(sub);
  },

  removePushSubscription: async (endpoint) => {
    await getAdapter().removePushSubscription(endpoint);
  },

  replayOfflineQueue: async () => {
    if (!isOnline()) return;
    const queue = await peekQueue();
    for (const item of queue) {
      try {
        if (item.type === "update_page") {
          await getAdapter().updatePage(
            item.payload.bookId,
            item.payload.page,
            item.payload.previousPage,
          );
        } else if (item.type === "add_note") {
          await getAdapter().addNote(item.payload);
        } else if (item.type === "add_book") {
          await getAdapter().addBook(item.payload);
        } else if (item.type === "update_book_status") {
          await getAdapter().updateBookStatus(
            item.payload.bookId,
            item.payload.status,
          );
        } else if (item.type === "update_book") {
          await getAdapter().updateBook(item.payload.bookId, item.payload);
        } else if (item.type === "remove_book") {
          await getAdapter().removeBook(item.payload.bookId);
        }
        await dequeueMutation(item.id);
      } catch (err) {
        console.error("[PageMate] replay failed", item, err);
        break;
      }
    }
  },
}));

export function selectActiveBook(state: SessionState): Book | undefined {
  return (
    state.books.find((b) => b.status === "currently_reading") ?? state.books[0]
  );
}

export function selectProgressFor(
  state: SessionState,
  bookId: string,
  userId: string | undefined,
): number {
  if (!userId) return 0;
  return (
    state.progress.find((p) => p.bookId === bookId && p.userId === userId)
      ?.currentPage ?? 0
  );
}
