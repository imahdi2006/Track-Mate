export type BookStatus = "currently_reading" | "want_to_read" | "completed";

export type ActivityKind =
  | "page_update"
  | "reaction"
  | "note"
  | "book_added"
  | "book_completed"
  | "pair_joined";

export type ReactionEmoji = "🔥" | "👏" | "😮" | "💛" | "📖";

export interface Profile {
  id: string;
  displayName: string;
  email: string | null;
  avatarHue: number;
  createdAt: string;
}

export interface ReadingPair {
  id: string;
  buddyCode: string;
  userAId: string;
  userBId: string | null;
  createdAt: string;
}

export interface Book {
  id: string;
  pairId: string;
  title: string;
  author: string;
  totalPages: number;
  coverUrl: string | null;
  status: BookStatus;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  olid?: string | null;
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
  pairId: string;
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

export interface PageMateSnapshot {
  profile: Profile | null;
  pair: ReadingPair | null;
  buddy: Profile | null;
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
      };
    }
  | {
      id: string;
      type: "remove_book";
      createdAt: number;
      payload: { bookId: string };
    };

export function emptySnapshot(): PageMateSnapshot {
  return {
    profile: null,
    pair: null,
    buddy: null,
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
