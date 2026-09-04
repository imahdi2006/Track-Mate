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
  registerLocalPassword,
  verifyLocalPassword,
} from "@/lib/auth/credentials";
import { ACTIVE_ROOM_KEY, ROOM_MAX_MEMBERS, ROOM_MIN_MEMBERS } from "@/lib/config";
import { mergePairDocs, pairContentFingerprint, type PairDocLike } from "@/lib/sync/merge-pair";
import { fetchPairDoc, fetchPairDocForUser, publishPairDoc, subscribePairStream, type RemotePairDoc } from "@/lib/sync/pair-client";
import type {
  Activity,
  Book,
  BookStatus,
  CreateRoomInput,
  MicroNote,
  TrackmateSnapshot,
  Profile,
  PushSubscriptionRecord,
  ReadingPair,
  ReadingProgress,
  RoomMember,
  RoomSummary,
} from "@/lib/types";
import { emptySnapshot, pairMemberIds, roomFromPair } from "@/lib/types";
import { personName } from "@/lib/names";
import { parseTitleKind } from "@/lib/media";
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
  /** userId → whole shelf or a list of book ids from a book invite */
  shelfScopeByUser?: Record<string, "all" | string[]>;
}

function emptyPairData(): PairData {
  return {
    books: [],
    progress: [],
    activities: [],
    notes: [],
    pushSubscriptions: [],
    removedBookIds: [],
    shelfScopeByUser: {},
  };
}

function memberScope(
  pair: ReadingPair,
  data: PairData,
  userId: string,
): "all" | string[] {
  if (pair.userAId === userId) return "all";
  const stored = data.shelfScopeByUser?.[userId];
  if (!stored || stored === "all") return "all";
  return stored;
}

function filterShelf(userId: string, pair: ReadingPair, data: PairData): PairData {
  const scope = memberScope(pair, data, userId);
  if (scope === "all") return data;
  const allowed = new Set(scope);
  return {
    ...data,
    books: data.books.filter((b) => allowed.has(b.id)),
    progress: data.progress.filter((p) => allowed.has(p.bookId)),
    notes: data.notes.filter((n) => allowed.has(n.bookId)),
    activities: data.activities.filter((a) => !a.bookId || allowed.has(a.bookId)),
  };
}

function grantBookScope(
  data: PairData,
  userId: string,
  bookId: string | null | undefined,
  fullShelf: boolean,
): PairData {
  const current = { ...(data.shelfScopeByUser ?? {}) };
  if (fullShelf || !bookId) {
    current[userId] = "all";
    return { ...data, shelfScopeByUser: current };
  }
  const prev = current[userId];
  if (prev === "all") {
    return { ...data, shelfScopeByUser: current };
  }
  const ids = new Set(Array.isArray(prev) ? prev : []);
  ids.add(bookId);
  current[userId] = [...ids];
  return { ...data, shelfScopeByUser: current };
}

function revokeTitleFromUser(
  data: PairData,
  pair: ReadingPair,
  targetId: string,
  bookId: string,
): { data: PairData; kick: boolean } {
  const scope = memberScope(pair, data, targetId);
  const otherBooks = data.books.filter((b) => b.id !== bookId).map((b) => b.id);
  const current = { ...(data.shelfScopeByUser ?? {}) };
  let kick = false;
  if (scope === "all") {
    if (otherBooks.length === 0) kick = true;
    else current[targetId] = otherBooks;
  } else {
    const next = scope.filter((id) => id !== bookId);
    if (next.length === 0) kick = true;
    else current[targetId] = next;
  }
  if (kick) delete current[targetId];
  return {
    kick,
    data: {
      ...data,
      shelfScopeByUser: current,
      progress: data.progress.filter((p) => !(p.bookId === bookId && p.userId === targetId)),
      notes: data.notes.filter((n) => !(n.bookId === bookId && n.userId === targetId)),
    },
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
  const preferred = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ROOM_KEY) : null;
  const mine = pairs.filter((p) => pairMemberIds(p).includes(userId));
  if (!mine.length) return null;
  return mine.find((p) => p.id === preferred) ?? mine[0] ?? null;
}

function findAllPairsForUser(userId: string): ReadingPair[] {
  return Object.values(readPairs()).filter((p) => pairMemberIds(p).includes(userId));
}

function normalizeBooks(books: Book[], roomId: string): Book[] {
  return books.map((b) => ({
    ...b,
    roomId: b.roomId || b.pairId || roomId,
    kind: parseTitleKind(b.kind),
  }));
}

function normalizeActivities(activities: Activity[], roomId: string): Activity[] {
  return activities.map((a) => ({
    ...a,
    roomId: a.roomId || a.pairId || roomId,
  }));
}

function findUserByEmail(email: string): Profile | null {
  const needle = normalizeEmail(email);
  return (
    Object.values(readUsers()).find(
      (u) => u.email && normalizeEmail(u.email) === needle,
    ) ?? null
  );
}

function assemble(userId: string | null): TrackmateSnapshot {
  if (!userId) return emptySnapshot();
  const users = readUsers();
  const profile = users[userId] ? { ...users[userId], displayName: personName(users[userId]) } : null;
  if (!profile) return emptySnapshot();

  const allPairs = findAllPairsForUser(userId);
  const rooms: RoomSummary[] = allPairs.map((p) => ({
    room: roomFromPair(p),
    memberCount: pairMemberIds(p).length,
    role: p.userAId === userId ? "owner" : "member",
  }));

  const pair = findPairForUser(userId);
  if (!pair) {
    return { ...emptySnapshot(), profile, rooms };
  }

  const room = roomFromPair(pair);
  const memberIds = pairMemberIds(pair);
  const data = readPairData(pair.id);
  const members: RoomMember[] = memberIds.map((id) => {
    const scope = memberScope(pair, data, id);
    return {
      roomId: pair.id,
      userId: id,
      role: id === pair.userAId ? "owner" : "member",
      joinedAt: pair.createdAt,
      profile: users[id] ? { ...users[id], displayName: personName(users[id]) } : null,
      shelfScope: scope === "all" ? "all" : "books",
      allowedBookIds: scope === "all" ? null : scope,
    };
  });
  const others = members.filter((m) => m.userId !== userId);
  const visible = filterShelf(userId, pair, data);
  return {
    profile,
    rooms,
    room,
    members,
    buddy: others[0]?.profile ?? null,
    pair: room,
    books: normalizeBooks(visible.books, pair.id),
    progress: visible.progress,
    activities: normalizeActivities(visible.activities, pair.id),
    notes: visible.notes.map((n) => ({ ...n, readBy: n.readBy ?? [] })),
    pushSubscriptions: visible.pushSubscriptions.filter((s) => s.userId === userId),
    removedBookIds: visible.removedBookIds ?? [],
  };
}

function pairDocFromStorage(pair: ReadingPair): RemotePairDoc {
  const data = readPairData(pair.id);
  const users = readUsers();
  const profiles = pairMemberIds(pair)
    .map((id) => users[id])
    .filter((p): p is Profile => Boolean(p));
  return {
    pair,
    books: normalizeBooks(data.books, pair.id),
    progress: data.progress,
    activities: normalizeActivities(data.activities, pair.id),
    notes: data.notes,
    profiles,
    pushSubscriptions: data.pushSubscriptions,
    removedBookIds: data.removedBookIds ?? [],
    shelfScopeByUser: data.shelfScopeByUser,
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
    shelfScopeByUser: doc.shelfScopeByUser ?? existing.shelfScopeByUser ?? {},
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

/**
 * Local adapter: identity in sessionStorage, pair data in localStorage + server
 * (`GET/PUT /api/pairs/:code`, `GET /api/pairs/by-user/:id`). Mutations PUT
 * and apply the merged response; other tabs/devices receive SSE pushes.
 */
export function createLocalAdapter(): SyncAdapter {
  const listeners = new Set<ProgressListener>();
  let channel: BroadcastChannel | null = null;
  let pairStreamStop: (() => void) | null = null;
  let streamCode: string | null = null;
  let syncing = false;
  let streamListenersBound = false;

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

  const applyServerDoc = (remote: RemotePairDoc) => {
    const userId = currentUserId();
    if (!userId) return;
    const pair = findPairForUser(userId);
    if (!pair || pair.buddyCode !== remote.pair.buddyCode) return;
    const localDoc = pairDocFromStorage(pair);
    const merged = mergePairDocs(localDoc, remote);
    if (pairContentFingerprint(merged) === pairContentFingerprint(localDoc)) return;
    writeMergedDoc(merged, userId);
    notify();
  };

  const pushPairToServer = async (pair: ReadingPair) => {
    const userId = currentUserId();
    if (!userId) return;
    const localDoc = pairDocFromStorage(pair);
    const serverDoc = await publishPairDoc(pair.buddyCode, localDoc);
    if (!serverDoc) return;
    const merged = mergePairDocs(localDoc, serverDoc);
    if (pairContentFingerprint(merged) !== pairContentFingerprint(localDoc)) {
      writeMergedDoc(merged, userId);
      notify();
    }
  };

  const restorePairFromServer = async (userId: string): Promise<ReadingPair | null> => {
    const remote = await fetchPairDocForUser(userId);
    if (!remote) return null;
    applyRemotePair(remote, userId);
    return findPairForUser(userId);
  };

  const syncFromServer = async () => {
    if (syncing) return;
    const userId = currentUserId();
    if (!userId) return;
    let pair = findPairForUser(userId);
    if (!pair) {
      pair = await restorePairFromServer(userId);
      if (!pair) return;
    }
    syncing = true;
    try {
      const remote = await fetchPairDoc(pair.buddyCode);
      if (remote) applyServerDoc(remote);
    } finally {
      syncing = false;
    }
  };

  const closePairStream = () => {
    pairStreamStop?.();
    pairStreamStop = null;
    streamCode = null;
  };

  const ensurePairStream = (code: string) => {
    if (typeof window === "undefined") return;
    const buddyCode = code.trim().toUpperCase();
    if (streamCode === buddyCode && pairStreamStop) return;
    closePairStream();
    streamCode = buddyCode;
    pairStreamStop = subscribePairStream(buddyCode, (doc) => applyServerDoc(doc));
  };

  const bindStreamLifecycle = () => {
    if (streamListenersBound || typeof window === "undefined") return;
    streamListenersBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const userId = currentUserId();
      const pair = userId ? findPairForUser(userId) : null;
      if (!pair) return;
      ensurePairStream(pair.buddyCode);
      void syncFromServer();
    });
  };

  const emit = () => {
    notify();
    const userId = currentUserId();
    const pair = userId ? findPairForUser(userId) : null;
    if (pair) {
      ensurePairStream(pair.buddyCode);
      void pushPairToServer(pair);
    }
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

  const ensureChannel = () => {
    if (channel || typeof BroadcastChannel === "undefined") return;
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      listeners.forEach((l) => l(assemble(currentUserId())));
    };
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
      bindStreamLifecycle();
      // Drop legacy auto-login keys from older builds.
      localStorage.removeItem("pagemate-remember-user-id");
      if (!currentUserId() && typeof window !== "undefined" && sessionStorage.getItem("pagemate-access-token")) {
        clearAccessToken();
      }
      const userId = currentUserId();
      if (userId) {
        if (!findPairForUser(userId)) {
          await restorePairFromServer(userId);
        }
        await syncFromServer();
        const pair = findPairForUser(userId);
        if (pair) ensurePairStream(pair.buddyCode);
      }
      return assemble(userId);
    },

    async startOAuth() {
      throw new Error(
        "Google sign-in needs the cloud app (Supabase). Use email and password in local demo.",
      );
    },

    async authenticate(payload) {
      const email = normalizeEmail(payload.email);
      if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
      if (payload.password.length < 6) throw new Error("Password must be at least 6 characters.");

      const users = readUsers();
      const displayName = payload.displayName.trim() || email.split("@")[0] || "Reader";

      let remote: { profileId: string; displayName: string; email: string };
      if (payload.mode === "signup") {
        remote = await syncServerAccount({
          email,
          password: payload.password,
          profileId: generateId(),
          displayName,
          mode: "signup",
        });
      } else {
        try {
          remote = await loginServerAccount(email, payload.password);
        } catch (err) {
          try {
            const cred = await verifyLocalPassword(email, payload.password);
            remote = {
              profileId: cred.profileId,
              displayName: users[cred.profileId]?.displayName ?? displayName,
              email,
            };
          } catch {
            throw err instanceof Error ? err : new Error("Couldn’t sign in");
          }
        }
      }

      await registerLocalPassword(email, payload.password, remote.profileId);
      await restorePairFromServer(remote.profileId);
      let profile =
        users[remote.profileId] ??
        findUserByEmail(email) ?? {
          id: remote.profileId,
          displayName: displayName || remote.displayName,
          email,
          avatarHue: Math.floor(Math.random() * 360),
          createdAt: nowIso(),
        };
      profile = {
        ...profile,
        id: remote.profileId,
        email,
        displayName: payload.displayName.trim() || profile.displayName || remote.displayName,
      };
      users[profile.id] = profile;
      writeUsers(users);

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
      const userId = currentUserId();
      if (userId) {
        const pair = findPairForUser(userId);
        if (pair) await pushPairToServer(pair);
      }
      closePairStream();
      sessionStorage.removeItem(SESSION_USER_KEY);
      clearAccessToken();
      listeners.forEach((l) => l(emptySnapshot()));
    },

    async createRoom(input?: CreateRoomInput) {
      const userId = requireUser();
      const maxMembers = Math.min(
        ROOM_MAX_MEMBERS,
        Math.max(ROOM_MIN_MEMBERS, Math.floor(input?.maxMembers ?? ROOM_MAX_MEMBERS)),
      );
      const name = (input?.name ?? "Reading room").trim() || "Reading room";
      const pair: ReadingPair = {
        id: generateId(),
        buddyCode: generateBuddyCode(),
        userAId: userId,
        userBId: null,
        memberIds: [],
        name,
        maxMembers,
        createdAt: nowIso(),
      };
      const pairs = readPairs();
      pairs[pair.buddyCode] = pair;
      writePairs(pairs);
      writePairData(pair.id, emptyPairData());
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, pair.id);
      } catch {
        /* ignore */
      }
      emit();
      return roomFromPair(pair);
    },

    async createPair() {
      return this.createRoom({ maxMembers: 2 });
    },

    async joinRoom(inviteCode, bookId) {
      const { pair } = await this.joinPair(inviteCode, bookId);
      return { room: pair };
    },

    async joinPair(buddyCode, bookId) {
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
          "No room with that code. Ask someone to share a book link while Trackmate is running, then open that link again.",
        );
      }
      const ids = pairMemberIds(pair);
      const fullShelf = !bookId;
      if (ids.includes(userId)) {
        mutatePair(pair.id, (data) => grantBookScope(data, userId, bookId, fullShelf));
        try {
          localStorage.setItem(ACTIVE_ROOM_KEY, pair.id);
        } catch {
          /* ignore */
        }
        emit();
        return { pair: roomFromPair(pair), buddy: assemble(userId).buddy };
      }
      const max = pair.maxMembers ?? 2;
      if (ids.length >= max) {
        throw new Error(`This room is full (max ${max}).`);
      }
      let next: ReadingPair;
      if (!pair.userBId) {
        next = { ...pair, userBId: userId };
      } else {
        next = {
          ...pair,
          memberIds: [...(pair.memberIds ?? []).filter((id) => id !== userId), userId],
        };
      }
      pairs[code] = next;
      writePairs(pairs);
      mutatePair(next.id, (data) => {
        const scoped = grantBookScope(data, userId, bookId, fullShelf);
        const visibleBooks =
          memberScope(next, scoped, userId) === "all"
            ? scoped.books
            : scoped.books.filter((b) => (memberScope(next, scoped, userId) as string[]).includes(b.id));
        const extras: ReadingProgress[] = visibleBooks
          .filter((b) => !scoped.progress.some((p) => p.bookId === b.id && p.userId === userId))
          .map((b) => ({
            id: generateId(),
            bookId: b.id,
            userId,
            currentPage: 0,
            updatedAt: nowIso(),
          }));
        return {
          ...scoped,
          progress: [...scoped.progress, ...extras],
          activities: [
            {
              id: generateId(),
              roomId: next.id,
              bookId: bookId ?? null,
              userId,
              kind: "room_joined",
              payload: bookId ? { bookId } : {},
              createdAt: nowIso(),
            },
            ...scoped.activities,
          ],
        };
      });
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, next.id);
      } catch {
        /* ignore */
      }
      emit();
      const users = readUsers();
      return { pair: roomFromPair(next), buddy: users[next.userAId] ?? null };
    },

    async leaveRoom() {
      return this.leavePair();
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
      } else if (pair.userBId === userId) {
        pairs[pair.buddyCode] = {
          ...pair,
          userBId: pair.memberIds?.[0] ?? null,
          memberIds: (pair.memberIds ?? []).slice(1),
        };
      } else {
        pairs[pair.buddyCode] = {
          ...pair,
          memberIds: (pair.memberIds ?? []).filter((id) => id !== userId),
        };
      }
      writePairs(pairs);
      try {
        localStorage.removeItem(ACTIVE_ROOM_KEY);
      } catch {
        /* ignore */
      }
      emit();
    },

    async deleteRoom() {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) return;
      if (pair.userAId !== userId) throw new Error("Only the room owner can delete the room.");
      const pairs = readPairs();
      delete pairs[pair.buddyCode];
      writePairs(pairs);
      localStorage.removeItem(dataKey(pair.id));
      try {
        localStorage.removeItem(ACTIVE_ROOM_KEY);
      } catch {
        /* ignore */
      }
      emit();
    },

    async kickMember(targetUserId: string) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) throw new Error("Room required");
      if (pair.userAId !== userId) throw new Error("Only the room owner can kick members.");
      if (targetUserId === userId) throw new Error("You can’t kick yourself.");
      const pairs = readPairs();
      let next: ReadingPair = { ...pair };
      if (pair.userBId === targetUserId) {
        next = {
          ...pair,
          userBId: pair.memberIds?.[0] ?? null,
          memberIds: (pair.memberIds ?? []).slice(1),
        };
      } else {
        next = {
          ...pair,
          memberIds: (pair.memberIds ?? []).filter((id) => id !== targetUserId),
        };
      }
      pairs[pair.buddyCode] = next;
      writePairs(pairs);
      mutatePair(pair.id, (data) => {
        const shelf = { ...(data.shelfScopeByUser ?? {}) };
        delete shelf[targetUserId];
        return {
          ...data,
          shelfScopeByUser: shelf,
          progress: data.progress.filter((p) => p.userId !== targetUserId),
          notes: data.notes.filter((n) => n.userId !== targetUserId),
        };
      });
      emit();
    },

    async removeFromTitle(bookId: string, targetUserId: string) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) throw new Error("Room required");
      if (targetUserId === userId) throw new Error("Use Leave book to step away yourself.");
      if (targetUserId === pair.userAId) throw new Error("You can’t remove the room owner.");
      const data = readPairData(pair.id);
      const book = data.books.find((b) => b.id === bookId);
      if (!book) throw new Error("Title not found.");
      const isOwner = pair.userAId === userId;
      if (!isOwner && book.createdBy !== userId) {
        throw new Error("Only the owner can remove people from this title.");
      }
      const scope = memberScope(pair, data, targetUserId);
      if (scope === "all" && !isOwner) {
        throw new Error("Only the room owner can remove someone who has the whole shelf.");
      }
      const revoked = revokeTitleFromUser(data, pair, targetUserId, bookId);
      writePairData(pair.id, revoked.data);
      if (revoked.kick) {
        const pairs = readPairs();
        let next: ReadingPair = { ...pair };
        if (pair.userBId === targetUserId) {
          next = {
            ...pair,
            userBId: pair.memberIds?.[0] ?? null,
            memberIds: (pair.memberIds ?? []).slice(1),
          };
        } else {
          next = {
            ...pair,
            memberIds: (pair.memberIds ?? []).filter((id) => id !== targetUserId),
          };
        }
        pairs[pair.buddyCode] = next;
        writePairs(pairs);
      }
      emit();
    },

    async setActiveRoom(roomId: string) {
      const userId = requireUser();
      const pair = Object.values(readPairs()).find(
        (p) => p.id === roomId && pairMemberIds(p).includes(userId),
      );
      if (!pair) throw new Error("You’re not in that room.");
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
      } catch {
        /* ignore */
      }
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
      if (!pair) throw new Error("Room required");
      const book: Book = {
        id: generateId(),
        roomId: pair.id,
        title: input.title.trim(),
        author: input.author.trim(),
        totalPages: Math.max(1, Math.floor(input.totalPages)),
        coverUrl: input.coverUrl ?? null,
        status: input.status ?? "currently_reading",
        createdBy: userId,
        createdAt: nowIso(),
        completedAt: null,
        kind: parseTitleKind(input.kind),
      };
      mutatePair(pair.id, (data) => {
        let withBook = { ...data, books: [book, ...data.books] };
        if (memberScope(pair, data, userId) !== "all") {
          withBook = grantBookScope(withBook, userId, book.id, false);
        }
        const viewers = pairMemberIds(pair).filter((id) => {
          if (id === userId || pair.userAId === id) return true;
          return memberScope(pair, data, id) === "all";
        });
        return {
          ...withBook,
          progress: [
            ...data.progress,
            ...viewers.map((id) => ({
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
              roomId: pair.id,
              bookId: book.id,
              userId,
              kind: "book_added" as const,
              payload: { bookTitle: book.title },
              createdAt: nowIso(),
            },
            ...data.activities,
          ].slice(0, 200),
        };
      });
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
            kind: patch.kind ? parseTitleKind(patch.kind) : b.kind,
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
              roomId: pair.id,
              bookId,
              userId,
              page: clamped,
              previousPage,
              bookTitle: book?.title ?? "a book",
            }),
            ...activities,
          ].slice(0, 200);
        }
        const membersDone = pairMemberIds(pair).every((id) => {
          const row = progress.find((p) => p.bookId === bookId && p.userId === id);
          return Boolean(book) && (row?.currentPage ?? 0) >= (book?.totalPages ?? Infinity);
        });
        if (membersDone && book && book.status !== "completed" && pairMemberIds(pair).length >= 2) {
          books = books.map((b) =>
            b.id === bookId
              ? { ...b, status: "completed" as BookStatus, completedAt: nowIso() }
              : b,
          );
          activities = [
            {
              id: generateId(),
              roomId: pair.id,
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
        kind: book?.kind,
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
        readBy: [],
      };
      mutatePair(pair.id, (data) => {
        const book = data.books.find((b) => b.id === input.bookId);
        const activity: Activity = {
          id: generateId(),
          roomId: pair.id,
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
        kind: readPairData(pair.id).books.find((b) => b.id === input.bookId)?.kind,
      });
      return note;
    },

    async markNotesRead(bookId: string) {
      const userId = requireUser();
      const pair = findPairForUser(userId);
      if (!pair) return;
      const at = nowIso();
      mutatePair(pair.id, (data) => ({
        ...data,
        notes: data.notes.map((n) => {
          if (n.bookId !== bookId || n.userId === userId) return { ...n, readBy: n.readBy ?? [] };
          const readBy = n.readBy ?? [];
          if (readBy.some((r) => r.userId === userId)) return { ...n, readBy };
          return { ...n, readBy: [...readBy, { userId, readAt: at }] };
        }),
      }));
      emit();
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
