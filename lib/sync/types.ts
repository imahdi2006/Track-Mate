"use client";

import type {
  Activity,
  AuthPayload,
  Book,
  BookStatus,
  CreateRoomInput,
  MicroNote,
  TrackmateSnapshot,
  Profile,
  PushSubscriptionRecord,
  ReactionEmoji,
  ReadingRoom,
  TitleKind,
} from "@/lib/types";

export type ProgressListener = (snapshot: Partial<TrackmateSnapshot>) => void;

export interface SyncAdapter {
  readonly mode: "local" | "supabase";
  hydrate(): Promise<TrackmateSnapshot>;
  authenticate(payload: AuthPayload): Promise<Profile>;
  requestPasswordReset(email: string): Promise<{ emailed: boolean; message: string; resetUrl?: string }>;
  signOut(): Promise<void>;
  createRoom(input?: CreateRoomInput): Promise<ReadingRoom>;
  joinRoom(inviteCode: string, bookId?: string | null): Promise<{ room: ReadingRoom }>;
  leaveRoom(): Promise<void>;
  deleteRoom(): Promise<void>;
  kickMember(userId: string): Promise<void>;
  removeFromTitle(bookId: string, userId: string): Promise<void>;
  setActiveRoom(roomId: string): Promise<void>;
  /** @deprecated Use createRoom */
  createPair(): Promise<ReadingRoom>;
  /** @deprecated Use joinRoom */
  joinPair(buddyCode: string, bookId?: string | null): Promise<{ pair: ReadingRoom; buddy: Profile | null }>;
  /** @deprecated Use leaveRoom */
  leavePair(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, "displayName">>): Promise<Profile>;
  addBook(input: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string | null;
    status?: BookStatus;
    kind?: TitleKind;
  }): Promise<Book>;
  updateBookStatus(bookId: string, status: BookStatus): Promise<void>;
  updateBook(
    bookId: string,
    patch: {
      title?: string;
      author?: string;
      totalPages?: number;
      coverUrl?: string | null;
      kind?: TitleKind;
    },
  ): Promise<void>;
  startOAuth(provider: "google"): Promise<void>;
  removeBook(bookId: string): Promise<void>;
  updatePage(bookId: string, page: number, previousPage: number): Promise<void>;
  addNote(input: {
    bookId: string;
    pageNumber: number;
    emoji?: ReactionEmoji | null;
    note?: string | null;
  }): Promise<MicroNote>;
  markNotesRead(bookId: string): Promise<void>;
  savePushSubscription(
    sub: Omit<PushSubscriptionRecord, "id" | "createdAt" | "userId">,
  ): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;
  subscribe(onChange: ProgressListener): () => void;
  replayQueued?(): Promise<void>;
}

export function activityFromPageUpdate(input: {
  roomId: string;
  bookId: string;
  userId: string;
  page: number;
  previousPage: number;
  bookTitle: string;
}): Activity {
  return {
    id: crypto.randomUUID?.() ?? `act_${Date.now()}`,
    roomId: input.roomId,
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
