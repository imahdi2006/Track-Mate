"use client";

import type {
  Activity,
  AuthPayload,
  Book,
  BookStatus,
  MicroNote,
  PageMateSnapshot,
  Profile,
  PushSubscriptionRecord,
  ReactionEmoji,
  ReadingPair,
} from "@/lib/types";

export type ProgressListener = (snapshot: Partial<PageMateSnapshot>) => void;

export interface SyncAdapter {
  readonly mode: "local" | "supabase";
  hydrate(): Promise<PageMateSnapshot>;
  authenticate(payload: AuthPayload): Promise<Profile>;
  requestPasswordReset(email: string): Promise<{ emailed: boolean; message: string }>;
  signOut(): Promise<void>;
  createPair(): Promise<ReadingPair>;
  joinPair(
    buddyCode: string,
  ): Promise<{ pair: ReadingPair; buddy: Profile | null }>;
  leavePair(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, "displayName">>): Promise<Profile>;
  addBook(input: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string | null;
    status?: BookStatus;
  }): Promise<Book>;
  updateBookStatus(bookId: string, status: BookStatus): Promise<void>;
  updateBook(
    bookId: string,
    patch: {
      title?: string;
      author?: string;
      totalPages?: number;
      coverUrl?: string | null;
    },
  ): Promise<void>;
  removeBook(bookId: string): Promise<void>;
  updatePage(bookId: string, page: number, previousPage: number): Promise<void>;
  addNote(input: {
    bookId: string;
    pageNumber: number;
    emoji?: ReactionEmoji | null;
    note?: string | null;
  }): Promise<MicroNote>;
  savePushSubscription(
    sub: Omit<PushSubscriptionRecord, "id" | "createdAt" | "userId">,
  ): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;
  subscribe(onChange: ProgressListener): () => void;
  replayQueued?(): Promise<void>;
}

export function activityFromPageUpdate(input: {
  pairId: string;
  bookId: string;
  userId: string;
  page: number;
  previousPage: number;
  bookTitle: string;
}): Activity {
  return {
    id: crypto.randomUUID?.() ?? `act_${Date.now()}`,
    pairId: input.pairId,
    bookId: input.bookId,
    userId: input.userId,
    kind: "page_update",
    payload: {
      page: input.page,
      previousPage: input.previousPage,
      delta: input.page - input.previousPage,
      bookTitle: input.bookTitle,
    },
    createdAt: new Date().toISOString(),
  };
}
