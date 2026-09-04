export type BookStatus = "currently_reading" | "want_to_read" | "completed";

/** Shelf item: a book, a course, a movie, or a TV series. Stored on `books.kind`. */
export type TitleKind = "book" | "course" | "movie" | "series";

export type ActivityKind =
  | "page_update"
  | "reaction"
  | "note"
  | "book_added"
  | "book_completed"
  | "pair_joined"
  | "room_joined";

export type ReactionEmoji = "🔥" | "👏" | "😮" | "💛" | "📖";

export type RoomMemberRole = "owner" | "member";

export interface Profile {
  id: string;
  displayName: string;
  email: string | null;
  avatarHue: number;
  createdAt: string;
}

export interface ReadingRoom {
  id: string;
  inviteCode: string;
  name: string;
  ownerId: string;
  maxMembers: number;
  createdAt: string;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  profile: Profile | null;
  /** `all` = whole shelf; `books` = only titles granted via a book invite */
  shelfScope: "all" | "books";
  /** `null` means every title in the room. */
  allowedBookIds: string[] | null;
}

export function memberCanAccessBook(member: RoomMember, bookId: string): boolean {
  if (member.role === "owner" || member.shelfScope === "all" || member.allowedBookIds === null) {
    return true;
  }
  return member.allowedBookIds.includes(bookId);
}

/** Local / pair-doc wire shape (maps to ReadingRoom via inviteCode = buddyCode). */
export interface ReadingPair {
  id: string;
  buddyCode: string;
  userAId: string;
  userBId: string | null;
  createdAt: string;
  name?: string;
  maxMembers?: number;
  /** Extra members beyond userA/userB (local multi-member). */
  memberIds?: string[];
}

export function roomFromPair(pair: ReadingPair): ReadingRoom {
  return {
    id: pair.id,
    inviteCode: pair.buddyCode,
    name: pair.name ?? "Reading room",
    ownerId: pair.userAId,
    maxMembers: pair.maxMembers ?? 2,
    createdAt: pair.createdAt,
  };
}

export function pairMemberIds(pair: ReadingPair): string[] {
  const ids = [pair.userAId, pair.userBId, ...(pair.memberIds ?? [])].filter(
    (id): id is string => Boolean(id),
  );
  return [...new Set(ids)];
}

export interface Book {
  id: string;
  roomId: string;
  /** @deprecated Prefer roomId */
  pairId?: string;
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
  status: BookStatus;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  olid?: string | null;
  /** Defaults to book for older rows. */
  kind?: TitleKind;
}

export interface ReadingProgress {
  id: string;
  bookId: string;
  userId: string;
  currentPage: number;
  updatedAt: string;
}

export interface Activity {
  id: string;
  roomId: string;
  /** @deprecated Prefer roomId */
  pairId?: string;
  bookId: string | null;
  userId: string;
  kind: ActivityKind;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MicroNote {
  id: string;
  bookId: string;
  userId: string;
  pageNumber: number;
  emoji: ReactionEmoji | null;
  note: string | null;
  createdAt: string;
  readBy: { userId: string; readAt: string }[];
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
}

export interface RoomSummary {
  room: ReadingRoom;
  memberCount: number;
  role: RoomMemberRole;
}

export interface BookMateSnapshot {
  profile: Profile | null;
  rooms: RoomSummary[];
  room: ReadingRoom | null;
  members: RoomMember[];
  /** @deprecated Prefer members — other people in the active room */
  buddy: Profile | null;
  /** @deprecated Prefer room */
  pair: ReadingRoom | null;
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  pushSubscriptions: PushSubscriptionRecord[];
  removedBookIds: string[];
}

export interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
  isbn?: string[];
}

export type QueuedMutation =
  | {
      id: string;
      type: "update_page";
      createdAt: number;
      payload: {
        bookId: string;
        userId: string;
        page: number;
        previousPage: number;
      };
    }
  | {
      id: string;
      type: "add_note";
      createdAt: number;
      payload: {
        bookId: string;
        userId: string;
        pageNumber: number;
        emoji: ReactionEmoji | null;
        note: string | null;
      };
    }
  | {
      id: string;
      type: "add_book";
      createdAt: number;
      payload: Omit<Book, "id" | "createdAt"> & { id?: string };
    }
  | {
      id: string;
      type: "update_book_status";
      createdAt: number;
      payload: { bookId: string; status: BookStatus };
    }
  | {
      id: string;
      type: "update_book";
      createdAt: number;
      payload: {
        bookId: string;
        title?: string;
        author?: string;
        totalPages?: number;
        coverUrl?: string | null;
        kind?: TitleKind;
      };
    }
  | {
      id: string;
      type: "remove_book";
      createdAt: number;
      payload: { bookId: string };
    };

export function emptySnapshot(): BookMateSnapshot {
  return {
    profile: null,
    rooms: [],
    room: null,
    members: [],
    buddy: null,
    pair: null,
    books: [],
    progress: [],
    activities: [],
    notes: [],
    pushSubscriptions: [],
    removedBookIds: [],
  };
}

export interface AuthPayload {
  displayName: string;
  email: string;
  password: string;
  mode: "signin" | "signup";
}

export interface CreateRoomInput {
  name?: string;
  maxMembers?: number;
}
