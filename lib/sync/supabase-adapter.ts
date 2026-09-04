"use client";

import type { RealtimeChannel, SupabaseClient, User } from "@supabase/supabase-js";
import { EmailConfirmationRequired } from "@/lib/auth/errors";
import { ACTIVE_ROOM_KEY, ROOM_MAX_MEMBERS, ROOM_MIN_MEMBERS } from "@/lib/config";
import type {
  Activity,
  AuthPayload,
  Book,
  BookStatus,
  CreateRoomInput,
  MicroNote,
  TrackmateSnapshot,
  Profile,
  ReadingRoom,
  RoomMember,
  RoomSummary,
} from "@/lib/types";
import { looksLikeAccountHandle, nameFromAuthMeta, personName } from "@/lib/names";
import { emptySnapshot } from "@/lib/types";
import { parseTitleKind } from "@/lib/media";
import { generateBuddyCode } from "@/lib/utils";
import type { ProgressListener, SyncAdapter } from "@/lib/sync/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    displayName: personName({
      displayName: String(row.display_name ?? "Reader"),
      email: (row.email as string | null) ?? null,
    }),
    email: (row.email as string | null) ?? null,
    avatarHue: Number(row.avatar_hue ?? 220),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapRoom(row: Record<string, unknown>): ReadingRoom {
  return {
    id: String(row.id),
    inviteCode: String(row.invite_code),
    name: String(row.name ?? "Reading room"),
    ownerId: String(row.owner_id),
    maxMembers: Number(row.max_members ?? ROOM_MAX_MEMBERS),
    createdAt: String(row.created_at),
  };
}

function mapBook(row: Record<string, unknown>): Book {
  const roomId = String(row.room_id ?? row.pair_id ?? "");
  return {
    id: String(row.id),
    roomId,
    title: String(row.title),
    author: String(row.author),
    totalPages: Number(row.total_pages),
    coverUrl: (row.cover_url as string | null) ?? null,
    status: row.status as BookStatus,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    completedAt: (row.completed_at as string | null) ?? null,
    olid: (row.olid as string | null) ?? null,
    kind: parseTitleKind(row.kind),
  };
}

function mapProgress(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    userId: String(row.user_id),
    currentPage: Number(row.current_page),
    updatedAt: String(row.updated_at),
  };
}

function mapActivity(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id),
    roomId: String(row.room_id ?? row.pair_id ?? ""),
    bookId: (row.book_id as string | null) ?? null,
    userId: String(row.user_id),
    kind: row.kind as Activity["kind"],
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapNote(row: Record<string, unknown>): MicroNote {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    userId: String(row.user_id),
    pageNumber: Number(row.page_number),
    emoji: (row.emoji as MicroNote["emoji"]) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at),
    readBy: [],
  };
}

function readActiveRoomId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_ROOM_KEY);
  } catch {
    return null;
  }
}

function writeActiveRoomId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_ROOM_KEY, id);
    else localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

async function listRoomSummaries(
  sb: SupabaseClient,
  userId: string,
): Promise<RoomSummary[]> {
  const { data: memberships } = await sb
    .from("room_members")
    .select("room_id, role, reading_rooms(*)")
    .eq("user_id", userId);

  const summaries: RoomSummary[] = [];
  for (const m of memberships ?? []) {
    const roomRow = m.reading_rooms as unknown as Record<string, unknown> | null;
    if (!roomRow) continue;
    const room = mapRoom(roomRow);
    const { count } = await sb
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);
    summaries.push({
      room,
      memberCount: count ?? 1,
      role: m.role === "owner" ? "owner" : "member",
    });
  }
  return summaries;
}

async function fetchSnapshot(
  sb: SupabaseClient,
  userId: string,
  preferredRoomId?: string | null,
): Promise<TrackmateSnapshot> {
  const { data: profileRow } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow) : null;
  const rooms = await listRoomSummaries(sb, userId);

  if (!rooms.length) {
    return { ...emptySnapshot(), profile, rooms: [] };
  }

  const preferred =
    preferredRoomId ??
    readActiveRoomId() ??
    null;
  const activeSummary =
    rooms.find((r) => r.room.id === preferred) ?? rooms[0]!;
  const room = activeSummary.room;
  writeActiveRoomId(room.id);

  const [
    { data: memberRows },
    { data: bookRows },
    { data: progressRows },
    { data: activityRows },
    { data: noteRows },
    { data: pushRows },
  ] = await Promise.all([
    sb
      .from("room_members")
      .select("room_id, user_id, role, joined_at, shelf_scope, profiles(*)")
      .eq("room_id", room.id),
    sb
      .from("books")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false }),
    sb.from("reading_progress").select("*").eq("room_id", room.id),
    sb
      .from("activities")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("micro_notes")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false }),
    sb.from("push_subscriptions").select("*").eq("user_id", userId),
  ]);

  let books = (bookRows ?? []).map(mapBook);
  let progress = (progressRows ?? []).map(mapProgress);
  let activities = (activityRows ?? []).map(mapActivity);
  let notes = (noteRows ?? []).map(mapNote);

  const bookIds = books.map((b) => b.id);
  const { data: accessRows } = bookIds.length
    ? await sb.from("book_access").select("book_id, user_id").in("book_id", bookIds)
    : { data: [] as { book_id: string; user_id: string }[] };
  const accessByUser = new Map<string, string[]>();
  for (const row of accessRows ?? []) {
    const uid = String(row.user_id);
    const bid = String(row.book_id);
    const list = accessByUser.get(uid) ?? [];
    list.push(bid);
    accessByUser.set(uid, list);
  }

  const members: RoomMember[] = (memberRows ?? []).map((row) => {
    const p = row.profiles as unknown as Record<string, unknown> | null;
    const shelfScope = row.shelf_scope === "books" ? "books" : "all";
    const uid = String(row.user_id);
    return {
      roomId: String(row.room_id),
      userId: uid,
      role: row.role === "owner" ? "owner" : "member",
      joinedAt: String(row.joined_at),
      profile: p ? mapProfile(p) : null,
      shelfScope,
      allowedBookIds:
        shelfScope === "all" || row.role === "owner" ? null : (accessByUser.get(uid) ?? []),
    };
  });

  const others = members.filter((m) => m.userId !== userId);
  const buddy = others[0]?.profile ?? null;
  const me = members.find((m) => m.userId === userId);

  if (me?.shelfScope === "books") {
    const allowed = new Set(me.allowedBookIds ?? []);
    books = books.filter((b) => allowed.has(b.id));
    progress = progress.filter((p) => allowed.has(p.bookId));
    notes = notes.filter((n) => allowed.has(n.bookId));
    activities = activities.filter((a) => !a.bookId || allowed.has(a.bookId));
  }

  const noteIds = notes.map((n) => n.id);
  if (noteIds.length) {
    const { data: readRows, error: readErr } = await sb
      .from("note_reads")
      .select("note_id, user_id, read_at")
      .in("note_id", noteIds);
    if (!readErr && readRows?.length) {
      const byNote = new Map<string, { userId: string; readAt: string }[]>();
      for (const row of readRows) {
        const nid = String(row.note_id);
        const list = byNote.get(nid) ?? [];
        list.push({ userId: String(row.user_id), readAt: String(row.read_at) });
        byNote.set(nid, list);
      }
      notes = notes.map((n) => ({ ...n, readBy: byNote.get(n.id) ?? [] }));
    }
  }

  return {
    profile,
    rooms,
    room,
    members,
    buddy,
    pair: room,
    books,
    progress,
    activities,
    notes,
    removedBookIds: [],
    pushSubscriptions: (pushRows ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      userAgent: (row.user_agent as string | null) ?? null,
      createdAt: String(row.created_at),
    })),
  };
}

async function sendPush(
  sb: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* push is best-effort */
  }
}

async function ensureProfile(sb: SupabaseClient, user: User): Promise<void> {
  const nice = nameFromAuthMeta(user.user_metadata as Record<string, unknown>, user.email);
  const { data: existing } = await sb
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!existing) {
    await sb.from("profiles").insert({
      id: user.id,
      display_name: nice,
      email: user.email ?? null,
      avatar_hue: Math.floor(Math.random() * 360),
    });
    return;
  }
  const patch: { email: string | null; display_name?: string } = {
    email: user.email ?? (existing.email as string | null),
  };
  if (
    looksLikeAccountHandle(String(existing.display_name ?? ""), user.email) &&
    nice &&
    nice !== existing.display_name
  ) {
    patch.display_name = nice;
  }
  await sb.from("profiles").update(patch).eq("id", user.id);
}

export function createSupabaseAdapter(
  client?: SupabaseClient | null,
): SyncAdapter | null {
  const sb = client ?? getSupabaseBrowserClient();
  if (!sb) return null;

  let userId: string | null = null;
  let roomId: string | null = null;
  const listeners = new Set<ProgressListener>();
  let channel: RealtimeChannel | null = null;
  let visibilityBound = false;

  const notify = async () => {
    if (!userId) return;
    const snap = await fetchSnapshot(sb, userId, roomId);
    roomId = snap.room?.id ?? null;
    listeners.forEach((l) => l(snap));
  };

  return {
    mode: "supabase",

    async hydrate() {
      const { data } = await sb.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || !data.user) return emptySnapshot();
      await ensureProfile(sb, data.user);
      const snap = await fetchSnapshot(sb, userId);
      roomId = snap.room?.id ?? null;
      return snap;
    },

    async authenticate(payload: AuthPayload) {
      const email = payload.email.trim().toLowerCase();
      const password = payload.password;
      const displayName = payload.displayName.trim() || email.split("@")[0] || "Reader";
      if (!email.includes("@")) throw new Error("Enter a valid email.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      if (payload.mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo:
              typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        if (!data.session || !data.user) {
          throw new EmailConfirmationRequired(email);
        }
        userId = data.user.id;
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("Couldn’t sign in.");
        userId = data.user.id;
      }

      const { data: existingProfile } = await sb
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (existingProfile) {
        if (payload.mode === "signup" && payload.displayName.trim()) {
          const { data: updated } = await sb
            .from("profiles")
            .update({ display_name: displayName, email })
            .eq("id", userId)
            .select("*")
            .single();
          return mapProfile(updated ?? existingProfile);
        }
        return mapProfile(existingProfile);
      }
      const { data: profile } = await sb
        .from("profiles")
        .insert({
          id: userId,
          display_name: displayName,
          email,
          avatar_hue: Math.floor(Math.random() * 360),
        })
        .select("*")
        .single();
      if (!profile) throw new Error("Couldn’t save your profile.");
      return mapProfile(profile);
    },

    async startOAuth(provider) {
      if (provider !== "google") throw new Error("Unsupported sign-in provider.");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          scopes: "openid email profile",
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    },

    async requestPasswordReset(email: string) {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) throw new Error("Enter a valid email.");
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await sb.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) throw error;
      return {
        emailed: true,
        message: "Check your email for a Trackmate reset link. It expires soon.",
      };
    },

    async signOut() {
      await sb.auth.signOut();
      userId = null;
      roomId = null;
      writeActiveRoomId(null);
      listeners.forEach((l) => l(emptySnapshot()));
    },

    async createRoom(input?: CreateRoomInput) {
      if (!userId) throw new Error("Not authenticated");
      const maxMembers = Math.min(
        ROOM_MAX_MEMBERS,
        Math.max(ROOM_MIN_MEMBERS, Math.floor(input?.maxMembers ?? ROOM_MAX_MEMBERS)),
      );
      const name = (input?.name ?? "Reading room").trim() || "Reading room";
      const inviteCode = generateBuddyCode();

      const { data, error } = await sb
        .from("reading_rooms")
        .insert({
          invite_code: inviteCode,
          name,
          owner_id: userId,
          max_members: maxMembers,
        })
        .select("*")
        .single();
      if (error) throw error;
      const room = mapRoom(data);

      const { error: memErr } = await sb.from("room_members").insert({
        room_id: room.id,
        user_id: userId,
        role: "owner",
      });
      if (memErr) {
        await sb.from("reading_rooms").delete().eq("id", room.id);
        throw memErr;
      }

      roomId = room.id;
      writeActiveRoomId(room.id);
      await notify();
      return room;
    },

    async createPair() {
      return this.createRoom({ maxMembers: 2 });
    },

    async joinRoom(inviteCode, bookId) {
      if (!userId) throw new Error("Not authenticated");
      const code = inviteCode.trim().toUpperCase();
      const { data: existing, error } = await sb
        .from("reading_rooms")
        .select("*")
        .eq("invite_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!existing) throw new Error("No room found for that invite code.");
      const room = mapRoom(existing);
      const fullShelf = !bookId;

      const { data: already } = await sb
        .from("room_members")
        .select("user_id, shelf_scope")
        .eq("room_id", room.id)
        .eq("user_id", userId)
        .maybeSingle();

      const grantAccess = async () => {
        if (fullShelf || !bookId) return;
        await sb.from("book_access").upsert(
          { book_id: bookId, user_id: userId },
          { onConflict: "book_id,user_id" },
        );
        await sb.from("reading_progress").upsert(
          {
            room_id: room.id,
            book_id: bookId,
            user_id: userId,
            current_page: 0,
          },
          { onConflict: "book_id,user_id" },
        );
      };

      if (already) {
        if (already.shelf_scope !== "all" && bookId) {
          await grantAccess();
        }
        roomId = room.id;
        writeActiveRoomId(room.id);
        await notify();
        return { room };
      }

      const { count } = await sb
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);
      if ((count ?? 0) >= room.maxMembers) {
        throw new Error(`This room is full (max ${room.maxMembers}).`);
      }

      const { error: joinErr } = await sb.from("room_members").insert({
        room_id: room.id,
        user_id: userId,
        role: "member",
        shelf_scope: fullShelf ? "all" : "books",
      });
      if (joinErr) throw joinErr;

      if (fullShelf) {
        const { data: books } = await sb.from("books").select("id").eq("room_id", room.id);
        if (books?.length) {
          await sb.from("reading_progress").upsert(
            books.map((b) => ({
              room_id: room.id,
              book_id: b.id,
              user_id: userId,
              current_page: 0,
            })),
            { onConflict: "book_id,user_id" },
          );
          await sb.from("book_access").upsert(
            books.map((b) => ({ book_id: b.id, user_id: userId })),
            { onConflict: "book_id,user_id" },
          );
        }
      } else {
        await grantAccess();
      }

      await sb.from("activities").insert({
        room_id: room.id,
        book_id: bookId ?? null,
        user_id: userId,
        kind: "room_joined",
        payload: bookId ? { bookId } : {},
      });

      roomId = room.id;
      writeActiveRoomId(room.id);
      await notify();
      return { room };
    },

    async joinPair(buddyCode, bookId) {
      const { room } = await this.joinRoom(buddyCode, bookId);
      const snap = await fetchSnapshot(sb, userId!);
      return { pair: room, buddy: snap.buddy };
    },

    async leaveRoom() {
      if (!userId || !roomId) return;
      const { data: membership } = await sb
        .from("room_members")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return;

      if (membership.role === "owner") {
        await sb.from("reading_rooms").delete().eq("id", roomId);
      } else {
        await sb
          .from("room_members")
          .delete()
          .eq("room_id", roomId)
          .eq("user_id", userId);
      }
      roomId = null;
      writeActiveRoomId(null);
      await notify();
    },

    async leavePair() {
      return this.leaveRoom();
    },

    async deleteRoom() {
      if (!userId || !roomId) return;
      const { data: membership } = await sb
        .from("room_members")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (membership?.role !== "owner") {
        throw new Error("Only the room owner can delete the room.");
      }
      await sb.from("reading_rooms").delete().eq("id", roomId);
      roomId = null;
      writeActiveRoomId(null);
      await notify();
    },

    async kickMember(targetUserId: string) {
      if (!userId || !roomId) throw new Error("Room required");
      if (targetUserId === userId) throw new Error("You can’t kick yourself.");
      const { data: membership } = await sb
        .from("room_members")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (membership?.role !== "owner") {
        throw new Error("Only the room owner can kick members.");
      }
      const { data: removed, error } = await sb
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", targetUserId)
        .select("user_id");
      if (error) throw error;
      if (!removed?.length) throw new Error("Couldn’t remove them. Only the room owner can.");
      await notify();
    },

    async removeFromTitle(bookId: string, targetUserId: string) {
      if (!userId || !roomId) throw new Error("Room required");
      if (targetUserId === userId) throw new Error("Use Leave book to step away yourself.");
      const { data: me } = await sb
        .from("room_members")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      const { data: book, error: bookErr } = await sb
        .from("books")
        .select("id, created_by, room_id")
        .eq("id", bookId)
        .maybeSingle();
      if (bookErr) throw bookErr;
      if (!book || String(book.room_id) !== roomId) throw new Error("Title not found.");
      const isOwner = me?.role === "owner";
      if (!isOwner && String(book.created_by) !== userId) {
        throw new Error("Only the owner can remove people from this title.");
      }
      const { data: target } = await sb
        .from("room_members")
        .select("role, shelf_scope")
        .eq("room_id", roomId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!target) throw new Error("They are not in this room.");
      if (target.role === "owner") throw new Error("You can’t remove the room owner.");

      const { data: roomBooks } = await sb.from("books").select("id").eq("room_id", roomId);
      const allIds = (roomBooks ?? []).map((b) => String(b.id));
      const otherIds = allIds.filter((id) => id !== bookId);

      if (target.shelf_scope !== "books") {
        if (!isOwner) {
          throw new Error("Only the room owner can remove someone who has the whole shelf.");
        }
        if (!otherIds.length) {
          await this.kickMember(targetUserId);
          return;
        }
        const { error: scopeErr } = await sb
          .from("room_members")
          .update({ shelf_scope: "books" })
          .eq("room_id", roomId)
          .eq("user_id", targetUserId);
        if (scopeErr) throw scopeErr;
        const { error: grantErr } = await sb.from("book_access").upsert(
          otherIds.map((id) => ({ book_id: id, user_id: targetUserId })),
          { onConflict: "book_id,user_id" },
        );
        if (grantErr) throw grantErr;
      }

      const { error: accessErr } = await sb
        .from("book_access")
        .delete()
        .eq("book_id", bookId)
        .eq("user_id", targetUserId);
      if (accessErr) throw accessErr;

      await sb.from("reading_progress").delete().eq("book_id", bookId).eq("user_id", targetUserId);
      await sb.from("micro_notes").delete().eq("book_id", bookId).eq("user_id", targetUserId);

      const { data: remaining } = await sb
        .from("book_access")
        .select("book_id")
        .eq("user_id", targetUserId);
      const stillHere = (remaining ?? []).some((row) => allIds.includes(String(row.book_id)));
      const { data: after } = await sb
        .from("room_members")
        .select("shelf_scope")
        .eq("room_id", roomId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (after?.shelf_scope === "books" && !stillHere && isOwner) {
        await this.kickMember(targetUserId);
        return;
      }
      await notify();
    },

    async setActiveRoom(nextRoomId: string) {
      if (!userId) throw new Error("Not authenticated");
      const { data } = await sb
        .from("room_members")
        .select("room_id")
        .eq("room_id", nextRoomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) throw new Error("You’re not in that room.");
      roomId = nextRoomId;
      writeActiveRoomId(nextRoomId);
      await notify();
    },

    async updateProfile(patch) {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await sb
        .from("profiles")
        .update({ display_name: patch.displayName })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      const profile = mapProfile(data);
      listeners.forEach((l) => l({ profile }));
      return profile;
    },

    async addBook(input) {
      if (!userId || !roomId) throw new Error("Room required");
      const { data, error } = await sb
        .from("books")
        .insert({
          room_id: roomId,
          title: input.title.trim(),
          author: input.author.trim(),
          total_pages: Math.max(1, Math.floor(input.totalPages)),
          cover_url: input.coverUrl ?? null,
          kind: parseTitleKind(input.kind),
          status: input.status ?? "currently_reading",
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      const book = mapBook(data);
      const { data: members } = await sb
        .from("room_members")
        .select("user_id, role, shelf_scope")
        .eq("room_id", roomId);
      const viewers = (members ?? []).filter(
        (m) => m.role === "owner" || m.shelf_scope !== "books" || String(m.user_id) === userId,
      );
      const ids = viewers.map((m) => String(m.user_id));
      if (ids.length) {
        await sb.from("book_access").upsert(
          ids.map((id) => ({ book_id: book.id, user_id: id })),
          { onConflict: "book_id,user_id" },
        );
        await sb.from("reading_progress").insert(
          ids.map((id) => ({
            room_id: roomId,
            book_id: book.id,
            user_id: id,
            current_page: 0,
          })),
        );
      }
      await sb.from("activities").insert({
        room_id: roomId,
        book_id: book.id,
        user_id: userId,
        kind: "book_added",
        payload: { bookTitle: book.title },
      });
      await notify();
      return book;
    },

    async updateBookStatus(bookId, status) {
      await sb
        .from("books")
        .update({
          status,
          completed_at:
            status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", bookId);
      await notify();
    },

    async updateBook(bookId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.title !== undefined) row.title = patch.title.trim();
      if (patch.author !== undefined) row.author = patch.author.trim();
      if (patch.totalPages !== undefined) row.total_pages = Math.max(1, Math.floor(patch.totalPages));
      if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
      if (patch.kind !== undefined) row.kind = parseTitleKind(patch.kind);
      if (Object.keys(row).length) {
        await sb.from("books").update(row).eq("id", bookId);
      }
      await notify();
    },

    async removeBook(bookId) {
      await sb.from("books").delete().eq("id", bookId);
      await notify();
    },

    async updatePage(bookId, page, previousPage) {
      if (!userId || !roomId) return;
      const { data: book } = await sb
        .from("books")
        .select("title, total_pages, status, kind")
        .eq("id", bookId)
        .single();
      const total = Number(book?.total_pages ?? page);
      const clamped = Math.max(0, Math.min(page, total));

      await sb.from("reading_progress").upsert(
        {
          room_id: roomId,
          book_id: bookId,
          user_id: userId,
          current_page: clamped,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "book_id,user_id" },
      );

      if (clamped !== previousPage) {
        await sb.from("activities").insert({
          room_id: roomId,
          book_id: bookId,
          user_id: userId,
          kind: "page_update",
          payload: {
            page: clamped,
            previousPage,
            delta: clamped - previousPage,
            bookTitle: book?.title,
          },
        });
      }

      const { data: allProgress } = await sb
        .from("reading_progress")
        .select("current_page")
        .eq("book_id", bookId);
      const { count: memberCount } = await sb
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId);
      const everyoneDone =
        (allProgress ?? []).length >= Math.max(2, memberCount ?? 2) &&
        (allProgress ?? []).every((p) => Number(p.current_page) >= total);

      if (everyoneDone && book?.status !== "completed") {
        await sb
          .from("books")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", bookId);
        await sb.from("activities").insert({
          room_id: roomId,
          book_id: bookId,
          user_id: userId,
          kind: "book_completed",
          payload: { bookTitle: book?.title },
        });
      }

      await sendPush(sb, {
        event: "page_update",
        bookId,
        page: clamped,
        bookTitle: book?.title,
        kind: book?.kind,
        actorId: userId,
        roomId,
        inviteCode: undefined,
      });

      await notify();
    },

    async addNote(input) {
      if (!userId || !roomId) throw new Error("Room required");
      const { data, error } = await sb
        .from("micro_notes")
        .insert({
          room_id: roomId,
          book_id: input.bookId,
          user_id: userId,
          page_number: input.pageNumber,
          emoji: input.emoji ?? null,
          note: input.note?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      await sb.from("activities").insert({
        room_id: roomId,
        book_id: input.bookId,
        user_id: userId,
        kind: input.emoji && !input.note ? "reaction" : "note",
        payload: {
          emoji: input.emoji,
          note: input.note,
          page: input.pageNumber,
        },
      });
      const { data: noteBook } = await sb
        .from("books")
        .select("title, kind")
        .eq("id", input.bookId)
        .maybeSingle();
      await sendPush(sb, {
        event: input.emoji && !input.note ? "reaction" : "note",
        bookId: input.bookId,
        page: input.pageNumber,
        emoji: input.emoji,
        note: input.note,
        bookTitle: noteBook?.title,
        kind: noteBook?.kind,
        actorId: userId,
        roomId,
      });
      const note = mapNote(data);
      await notify();
      return note;
    },

    async markNotesRead(bookId: string) {
      if (!userId) return;
      const mine = (await fetchSnapshot(sb, userId, roomId)).notes.filter(
        (n) => n.bookId === bookId && n.userId !== userId,
      );
      if (!mine.length) return;
      const { error } = await sb.from("note_reads").upsert(
        mine.map((n) => ({ note_id: n.id, user_id: userId })),
        { onConflict: "note_id,user_id", ignoreDuplicates: true },
      );
      if (error) return;
      await notify();
    },

    async savePushSubscription(sub) {
      if (!userId) return;
      await sb.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          user_agent: sub.userAgent,
        },
        { onConflict: "endpoint" },
      );
    },

    async removePushSubscription(endpoint) {
      if (!userId) return;
      await sb
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", userId);
    },

    subscribe(onChange) {
      listeners.add(onChange);
      // Safety net: some deletes (e.g. someone else removing you from a
      // title) can miss a live event depending on RLS/row visibility at
      // delete time. Re-pull the snapshot whenever the tab regains focus so
      // the UI never needs a manual refresh.
      if (!visibilityBound && typeof document !== "undefined") {
        visibilityBound = true;
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void notify();
        });
        window.addEventListener("focus", () => void notify());
      }
      if (channel) {
        return () => listeners.delete(onChange);
      }
      channel = sb
        .channel("Trackmate-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reading_progress" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activities" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "micro_notes" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "note_reads" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "books" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reading_rooms" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "book_access" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "room_members" },
          () => {
            void notify();
          },
        )
        .subscribe();

      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && channel) {
          void sb.removeChannel(channel);
          channel = null;
        }
      };
    },
  };
}
