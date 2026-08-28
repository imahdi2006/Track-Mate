"use client";

import {
  loginServerAccount,
  requestServerPasswordReset,
  syncServerAccount,
} from "@/lib/auth/client-api";
import {
  clearAccessToken,
  issueAccessToken,
  normalizeEmail,
  readAccessToken,
  readCredentials,
  registerLocalPassword,
  rememberedUserId,
  verifyLocalPassword,
} from "@/lib/auth/credentials";
import { SAMPLE_BOOK } from "@/lib/sample-book";
import { mergePairDocs, pairContentFingerprint, type PairDocLike } from "@/lib/sync/merge-pair";
import { fetchPairDoc, publishPairDoc, type RemotePairDoc } from "@/lib/sync/pair-client";
import type {
  Activity,
  Book,
  BookStatus,
  MicroNote,
  PageMateSnapshot,
  Profile,
  PushSubscriptionRecord,
  ReadingPair,
  ReadingProgress,
} from "@/lib/types";
import { emptySnapshot } from "@/lib/types";
import { generateBuddyCode, generateId } from "@/lib/utils";
import { activityFromPageUpdate, type ProgressListener, type SyncAdapter } from "@/lib/sync/types";

const SESSION_USER_KEY = "pagemate-session-user-id";
const USERS_KEY = "pagemate-users";
const PAIRS_KEY = "pagemate-pairs";
const CHANNEL = "pagemate-sync";

function nowIso(): string {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function dataKey(pairId: string): string {
  return `pagemate-pair-data:${pairId}`;
}

interface PairData {
  books: Book[];
  progress: ReadingProgress[];
  activities: Activity[];
  notes: MicroNote[];
  pushSubscriptions: PushSubscriptionRecord[];
  removedBookIds: string[];
}

function emptyPairData(): PairData {
  return {
    books: [],
    progress: [],
    activities: [],
    notes: [],
    pushSubscriptions: [],
    removedBookIds: [],
  };
}

function readUsers(): Record<string, Profile> {
  return readJson(USERS_KEY, {});
}

function writeUsers(users: Record<string, Profile>): void {
  writeJson(USERS_KEY, users);
}

function readPairs(): Record<string, ReadingPair> {
  return readJson(PAIRS_KEY, {});
}

function writePairs(pairs: Record<string, ReadingPair>): void {
  writeJson(PAIRS_KEY, pairs);
}

function readPairData(pairId: string): PairData {
  return readJson(dataKey(pairId), emptyPairData());
}

function writePairData(pairId: string, data: PairData): void {
  writeJson(dataKey(pairId), data);
}

function findPairForUser(userId: string): ReadingPair | null {
  const pairs = Object.values(readPairs());
  return pairs.find((p) => p.userAId === userId || p.userBId === userId) ?? null;
}

function findUserByEmail(email: string): Profile | null {
  const needle = normalizeEmail(email);
  return (
    Object.values(readUsers()).find(
      (u) => u.email && normalizeEmail(u.email) === needle,
    ) ?? null
  );
}

function seedBook(pairId: string, createdBy: string): PairData {
  const book: Book = {
    id: generateId(),
    pairId,
    title: SAMPLE_BOOK.title,
    author: SAMPLE_BOOK.author,
    totalPages: SAMPLE_BOOK.totalPages,
    coverUrl: SAMPLE_BOOK.coverUrl,
    status: "currently_reading",
    createdBy,
    createdAt: nowIso(),
    completedAt: null,
  };
  return {
    books: [book],
    progress: [
      {
        id: generateId(),
        bookId: book.id,
        userId: createdBy,
        currentPage: 1,
        updatedAt: nowIso(),
      },
    ],
    activities: [
      {
        id: generateId(),
        pairId,
        bookId: book.id,
        userId: createdBy,
        kind: "book_added",
        payload: { bookTitle: book.title },
        createdAt: nowIso(),
      },
    ],
    notes: [],
    pushSubscriptions: [],
    removedBookIds: [],
  };
}

function assemble(userId: string | null): PageMateSnapshot {
  if (!userId) return emptySnapshot();
  const users = readUsers();
  const profile = users[userId] ?? null;
  const pair = findPairForUser(userId);
  if (!profile) return emptySnapshot();
  if (!pair) {
    return { ...emptySnapshot(), profile };
  }
  const buddyId = pair.userAId === userId ? pair.userBId : pair.userAId;
  const data = readPairData(pair.id);
  return {
    profile,
    pair,
    buddy: buddyId ? (users[buddyId] ?? null) : null,
    books: data.books,
    progress: data.progress,
    activities: data.activities,
    notes: data.notes,
    pushSubscriptions: data.pushSubscriptions.filter((s) => s.userId === userId),
    removedBookIds: data.removedBookIds ?? [],
  };
}

function pairDocFromStorage(pair: ReadingPair): RemotePairDoc {
  const data = readPairData(pair.id);
  const users = readUsers();
  const profiles = [users[pair.userAId], pair.userBId ? users[pair.userBId] : null].filter(
    (p): p is Profile => Boolean(p),
  );
  return {
    pair,
    books: data.books,
    progress: data.progress,
    activities: data.activities,
    notes: data.notes,
    profiles,
    pushSubscriptions: data.pushSubscriptions,
    removedBookIds: data.removedBookIds ?? [],
  };
}

function writeMergedDoc(doc: PairDocLike, userId: string | null): void {
  const code = doc.pair.buddyCode.trim().toUpperCase();
  const pairs = readPairs();
  pairs[code] = { ...doc.pair, buddyCode: code };
  writePairs(pairs);
  const existing = readPairData(doc.pair.id);
  writePairData(doc.pair.id, {
    books: doc.books,
    progress: doc.progress,
    activities: doc.activities,
    notes: doc.notes,
    pushSubscriptions: doc.pushSubscriptions ?? existing.pushSubscriptions,
    removedBookIds: doc.removedBookIds ?? existing.removedBookIds ?? [],
  });
  const users = readUsers();
  for (const profile of doc.profiles) {
    if (userId && profile.id === userId) {
      users[profile.id] = users[profile.id] ? { ...profile, ...users[profile.id] } : profile;
    } else {
      users[profile.id] = users[profile.id] ? { ...users[profile.id], ...profile } : profile;
    }
  }
  writeUsers(users);
}

function applyRemotePair(doc: RemotePairDoc, preserveUserId: string | null): void {
  const code = doc.pair.buddyCode.trim().toUpperCase();
  const pairs = readPairs();
  const localPair = pairs[code];
  const localDoc: PairDocLike = localPair
    ? pairDocFromStorage(localPair)
    : { pair: doc.pair, books: [], progress: [], activities: [], notes: [], profiles: [] };
  writeMergedDoc(mergePairDocs(localDoc, doc), preserveUserId);
}

function publishPair(pair: ReadingPair | null | undefined): void {
  if (!pair) return;
  void publishPairDoc(pair.buddyCode, pairDocFromStorage(pair));
}

const PULL_MS = 2000;

/**
 * Local adapter: per-tab identity in sessionStorage, shared pair data in
 * localStorage, live fan-out via BroadcastChannel. Pair docs are also mirrored
 * to `/api/pairs/:code` so another browser (Incognito / second phone on this
 * Next server) can join a shared book without Supabase. That browser then
 * polls the same file so page turns stay in sync.
 */
export function createLocalAdapter(): SyncAdapter {
  const listeners = new Set<ProgressListener>();
  let channel: BroadcastChannel | null = null;
  let pullTimer: number | null = null;
  let pulling = false;

  const currentUserId = () =>
    typeof window === "undefined" ? null : sessionStorage.getItem(SESSION_USER_KEY);

  const notify = () => {
    const snap = assemble(currentUserId());
    listeners.forEach((l) => l(snap));
    try {
      channel?.postMessage({ type: "invalidate" });
    } catch {
      /* closed */
    }
  };

  const emit = () => {
    notify();
    publishPair(assemble(currentUserId()).pair);
  };

  const pingBuddy = (payload: Record<string, unknown>) => {
    const userId = currentUserId();
    const pair = userId ? findPairForUser(userId) : null;
    if (!userId || !pair) return;
    void fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        actorId: userId,
        buddyCode: pair.buddyCode,
      }),
    }).catch(() => undefined);
  };

  const pullRemote = async () => {
    if (pulling) return;
    const userId = currentUserId();
    if (!userId) return;
    const pair = findPairForUser(userId);
    if (!pair) return;
    pulling = true;
    try {
      const remote = await fetchPairDoc(pair.buddyCode);
      if (!remote) return;
      const localDoc = pairDocFromStorage(pair);
      const merged = mergePairDocs(localDoc, remote);
      const localFp = pairContentFingerprint(localDoc);
      const mergedFp = pairContentFingerprint(merged);
      const remoteFp = pairContentFingerprint(remote);
      if (mergedFp !== localFp) {
        writeMergedDoc(merged, userId);
        notify();
      }
      if (mergedFp !== remoteFp) {
        publishPair(merged.pair);
      }
    } finally {
      pulling = false;
    }
  };

  const ensureChannel = () => {
    if (channel || typeof BroadcastChannel === "undefined") return;
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      listeners.forEach((l) => l(assemble(currentUserId())));
    };
  };

  const ensurePull = () => {
    if (typeof window === "undefined" || pullTimer !== null) return;
    pullTimer = window.setInterval(() => void pullRemote(), PULL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void pullRemote();
    });
    window.addEventListener("focus", () => void pullRemote());
    void pullRemote();
  };

  const requireUser = (): string => {
    const id = currentUserId();
    if (!id) throw new Error("Sign in first");
    return id;
  };

  const mutatePair = (pairId: string, fn: (data: PairData) => PairData) => {
    writePairData(pairId, fn(readPairData(pairId)));
  };

  return {
    mode: "local",

    async hydrate() {
      ensureChannel();
      ensurePull();
      let userId = currentUserId();
      if (!userId) {
        const claims = await readAccessToken();
        if (claims && readUsers()[claims.sub]) {
          userId = claims.sub;
          sessionStorage.setItem(SESSION_USER_KEY, userId);
        } else {
          const remembered = rememberedUserId();
          if (remembered && readUsers()[remembered]) {
            userId = remembered;
            sessionStorage.setItem(SESSION_USER_KEY, userId);
          }
        }
      }
      const snap = assemble(userId);
      publishPair(snap.pair);
      return snap;
    },

    async authenticate(payload) {
      const email = normalizeEmail(payload.email);
      if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
      if (payload.password.length < 6) throw new Error("Password must be at least 6 characters.");

      const users = readUsers();
      let profile: Profile;

      if (payload.mode === "signup") {
        if (readCredentials()[email] || findUserByEmail(email)) {
          throw new Error("An account with that email already exists. Sign in instead.");
        }
        profile = {
          id: generateId(),
          displayName: payload.displayName.trim() || "Reader",
          email,
          avatarHue: Math.floor(Math.random() * 360),
          createdAt: nowIso(),
        };
        try {
          await syncServerAccount({
            email,
            password: payload.password,
            profileId: profile.id,
            displayName: profile.displayName,
            mode: "signup",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          if (message.toLowerCase().includes("already exists")) throw err;
        }
        users[profile.id] = profile;
        writeUsers(users);
        await registerLocalPassword(email, payload.password, profile.id);
      } else {
        let cred: { profileId: string };
        try {
          cred = await verifyLocalPassword(email, payload.password);
        } catch (localErr) {
          const remote = await loginServerAccount(email, payload.password).catch(() => null);
          if (!remote) throw localErr;
          await registerLocalPassword(email, payload.password, remote.profileId);
          cred = { profileId: remote.profileId };
          if (!users[remote.profileId] && !findUserByEmail(email)) {
            users[remote.profileId] = {
              id: remote.profileId,
              displayName: payload.displayName.trim() || remote.displayName,
              email,
              avatarHue: Math.floor(Math.random() * 360),
              createdAt: nowIso(),
            };
            writeUsers(users);
          }
        }
        try {
          await syncServerAccount({
            email,
            password: payload.password,
            profileId: cred.profileId,
            displayName:
              payload.displayName.trim() ||
              users[cred.profileId]?.displayName ||
              email.split("@")[0] ||
              "Reader",
            mode: "signin",
          });
        } catch {
          /* server optional after local auth */
        }
        profile = users[cred.profileId] ?? findUserByEmail(email) ?? {
          id: cred.profileId,
          displayName: payload.displayName.trim() || email.split("@")[0] || "Reader",
          email,
          avatarHue: Math.floor(Math.random() * 360),
          createdAt: nowIso(),
        };
        if (payload.displayName.trim()) {
          profile = { ...profile, displayName: payload.displayName.trim(), email };
        } else {
          profile = { ...profile, email };
        }
        users[profile.id] = profile;
        writeUsers(users);
      }

      sessionStorage.setItem(SESSION_USER_KEY, profile.id);
      await issueAccessToken({
        sub: profile.id,
        email: profile.email ?? email,
        name: profile.displayName,
      });
      emit();
      return profile;
    },

    async requestPasswordReset(email) {
      const normalized = normalizeEmail(email);
      if (!normalized.includes("@")) throw new Error("Enter a valid email.");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return requestServerPasswordReset(normalized, origin);
    },

    async signOut() {
      sessionStorage.removeItem(SESSION_USER_KEY);
      clearAccessToken();
      listeners.forEach((l) => l(emptySnapshot()));
    },

    async createPair() {
      const userId = requireUser();
      const existing = findPairForUser(userId);
      if (existing) {
        emit();
        return existing;
      }
      const pair: ReadingPair = {
        id: generateId(),
        buddyCode: generateBuddyCode(),
        userAId: userId,
        userBId: null,
        createdAt: nowIso(),
      };
      const pairs = readPairs();
      pairs[pair.buddyCode] = pair;
      writePairs(pairs);
      writePairData(pair.id, seedBook(pair.id, userId));
      emit();
      return pair;
    },

    async joinPair(buddyCode) {
      const userId = requireUser();
      const code = buddyCode.trim().toUpperCase();
      let pairs = readPairs();
      let pair = pairs[code];
      if (!pair) {
        const remote = await fetchPairDoc(code);
        if (remote) {
          applyRemotePair(remote, userId);
          pairs = readPairs();
          pair = pairs[code];
        }
      }
      if (!pair) {
        throw new Error(
          "No pair with that code. Ask your buddy to tap Share this book while PageMate is running, then open that link again.",
        );
      }
      if (pair.userAId === userId) throw new Error("That's your own code.");
      if (pair.userBId && pair.userBId !== userId) throw new Error("This pair is already full.");
      const next: ReadingPair = { ...pair, userBId: userId };
      pairs[code] = next;
      writePairs(pairs);
      mutatePair(next.id, (data) => {
        const extras: ReadingProgress[] = data.books
          .filter((b) => !data.progress.some((p) => p.bookId === b.id && p.userId === userId))
          .map((b) => ({
            id: generateId(),
            bookId: b.id,
            userId,
            currentPage: 0,
            updatedAt: nowIso(),
          }));
        return {
          ...data,
          progress: [...data.progress, ...extras],
          activities: [
            {
              id: generateId(),
              pairId: next.id,
              bookId: null,
              userId,
              kind: "pair_joined",
              payload: {},
              createdAt: nowIso(),
            },
            ...data.activities,
          ],
        };
      });
      emit();
      const users = readUsers();
      return { pair: next, buddy: users[next.userAId] ?? null };
    },

    async leavePair() {
      const userId = currentUserId();
      if (!userId) return;
      const pair = findPairForUser(userId);
      if (!pair) return;
      const pairs = readPairs();
      if (pair.userAId === userId) {
        delete pairs[pair.buddyCode];
        localStorage.removeItem(dataKey(pair.id));
      } else {
        pairs[pair.buddyCode] = { ...pair, userBId: null };
        writePairs(pairs);
      }
      writePairs(pairs);
      emit();
    },

    async updateProfile(patch) {
      const userId = requireUser();
      const users = readUsers();
      const current = users[userId];
      if (!current) throw new Error("No profile");
      const next = { ...current, ...patch };
      users[userId] = next;
      writeUsers(users);
      emit();
      return next;
    },

    async addBook(input) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) throw new Error("Pair required");
      const book: Book = {
        id: generateId(),
        pairId: pair.id,
        title: input.title.trim(),
        author: input.author.trim(),
        totalPages: Math.max(1, Math.floor(input.totalPages)),
        coverUrl: input.coverUrl ?? null,
        status: input.status ?? "currently_reading",
        createdBy: userId,
        createdAt: nowIso(),
        completedAt: null,
      };
      const members = [pair.userAId, pair.userBId].filter(Boolean) as string[];
      mutatePair(pair.id, (data) => ({
        ...data,
        books: [book, ...data.books],
        progress: [
          ...data.progress,
          ...members.map((id) => ({
            id: generateId(),
            bookId: book.id,
            userId: id,
            currentPage: 0,
            updatedAt: nowIso(),
          })),
        ],
        activities: [
          {
            id: generateId(),
            pairId: pair.id,
            bookId: book.id,
            userId,
            kind: "book_added" as const,
            payload: { bookTitle: book.title },
            createdAt: nowIso(),
          },
          ...data.activities,
        ].slice(0, 200),
      }));
      emit();
      return book;
    },

    async updateBookStatus(bookId, status) {
      const userId = currentUserId();
      const pair = userId ? findPairForUser(userId) : null;
      if (!pair) return;
      mutatePair(pair.id, (data) => ({
        ...data,
        books: data.books.map((b) =>
          b.id === bookId
            ? {
                ...b,
                status,
                completedAt: status === "completed" ? nowIso() : b.completedAt,
              }
            : b,
        ),
      }));
      emit();
    },

    async updateBook(bookId, patch) {
      const pair = findPairForUser(requireUser());
      if (!pair) return;
      mutatePair(pair.id, (data) => ({
        ...data,
        books: data.books.map((b) => {
          if (b.id !== bookId) return b;
          return {
            ...b,
            title: patch.title?.trim() || b.title,
            author: patch.author?.trim() || b.author,
            totalPages:
              patch.totalPages !== undefined ? Math.max(1, Math.floor(patch.totalPages)) : b.totalPages,
            coverUrl: patch.coverUrl === undefined ? b.coverUrl : patch.coverUrl,
          };
        }),
      }));
      emit();
    },

    async removeBook(bookId) {
      const pair = findPairForUser(requireUser());
      if (!pair) return;
      mutatePair(pair.id, (data) => ({
        ...data,
        books: data.books.filter((b) => b.id !== bookId),
        progress: data.progress.filter((p) => p.bookId !== bookId),
        notes: data.notes.filter((n) => n.bookId !== bookId),
        activities: data.activities.filter((a) => a.bookId !== bookId),
        removedBookIds: [...new Set([...(data.removedBookIds ?? []), bookId])],
      }));
      emit();
    },

    async updatePage(bookId, page, previousPage) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) return;
      mutatePair(pair.id, (data) => {
        const book = data.books.find((b) => b.id === bookId);
        const clamped = Math.max(0, Math.min(page, book?.totalPages ?? page));
        const existing = data.progress.find((p) => p.bookId === bookId && p.userId === userId);
        const next: ReadingProgress = existing
          ? { ...existing, currentPage: clamped, updatedAt: nowIso() }
          : { id: generateId(), bookId, userId, currentPage: clamped, updatedAt: nowIso() };
        const progress = existing
          ? data.progress.map((p) => (p.id === existing.id ? next : p))
          : [...data.progress, next];
        let books = data.books;
        let activities = data.activities;
        if (clamped !== previousPage) {
          activities = [
            activityFromPageUpdate({
              pairId: pair.id,
              bookId,
              userId,
              page: clamped,
              previousPage,
              bookTitle: book?.title ?? "a book",
            }),
            ...activities,
          ].slice(0, 200);
        }
        const partner = progress.find((p) => p.bookId === bookId && p.userId !== userId);
        const bothDone =
          Boolean(book) &&
          clamped >= (book?.totalPages ?? Infinity) &&
          partner !== undefined &&
          partner.currentPage >= (book?.totalPages ?? Infinity);
        if (bothDone && book && book.status !== "completed") {
          books = books.map((b) =>
            b.id === bookId
              ? { ...b, status: "completed" as BookStatus, completedAt: nowIso() }
              : b,
          );
          activities = [
            {
              id: generateId(),
              pairId: pair.id,
              bookId,
              userId,
              kind: "book_completed",
              payload: { bookTitle: book.title },
              createdAt: nowIso(),
            },
            ...activities,
          ];
        }
        return { ...data, progress, books, activities };
      });
      emit();
      const book = readPairData(pair.id).books.find((b) => b.id === bookId);
      pingBuddy({
        event: "page_update",
        bookId,
        page,
        bookTitle: book?.title,
      });
    },

    async addNote(input) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) throw new Error("Pair required");
      const note: MicroNote = {
        id: generateId(),
        bookId: input.bookId,
        userId,
        pageNumber: input.pageNumber,
        emoji: input.emoji ?? null,
        note: input.note?.trim() || null,
        createdAt: nowIso(),
      };
      mutatePair(pair.id, (data) => {
        const book = data.books.find((b) => b.id === input.bookId);
        const activity: Activity = {
          id: generateId(),
          pairId: pair.id,
          bookId: input.bookId,
          userId,
          kind: input.emoji && !input.note ? "reaction" : "note",
          payload: {
            emoji: note.emoji,
            note: note.note,
            page: note.pageNumber,
            bookTitle: book?.title,
          },
          createdAt: nowIso(),
        };
        return {
          ...data,
          notes: [note, ...data.notes],
          activities: [activity, ...data.activities].slice(0, 200),
        };
      });
      emit();
      pingBuddy({
        event: input.emoji && !input.note ? "reaction" : "note",
        bookId: input.bookId,
        page: input.pageNumber,
        emoji: input.emoji,
        note: input.note,
        bookTitle: readPairData(pair.id).books.find((b) => b.id === input.bookId)?.title,
      });
      return note;
    },

    async savePushSubscription(sub) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) return;
      mutatePair(pair.id, (data) => ({
        ...data,
        pushSubscriptions: [
          {
            id: generateId(),
            userId,
            createdAt: nowIso(),
            ...sub,
          },
          ...data.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint),
        ],
      }));
      emit();
    },

    async removePushSubscription(endpoint) {
      const userId = currentUserId();
      const pair = userId ? findPairForUser(userId) : null;
      if (!pair) return;
      mutatePair(pair.id, (data) => ({
        ...data,
        pushSubscriptions: data.pushSubscriptions.filter((s) => s.endpoint !== endpoint),
      }));
      emit();
    },

    subscribe(onChange) {
      ensureChannel();
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}
