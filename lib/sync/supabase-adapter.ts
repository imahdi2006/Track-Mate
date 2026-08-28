"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { SAMPLE_BOOK } from "@/lib/sample-book";
import type {
  Activity,
  AuthPayload,
  Book,
  BookStatus,
  MicroNote,
  PageMateSnapshot,
  Profile,
  ReadingPair,
  ReadingProgress,
} from "@/lib/types";
import { emptySnapshot } from "@/lib/types";
import { generateBuddyCode } from "@/lib/utils";
import type { ProgressListener, SyncAdapter } from "@/lib/sync/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? "Reader"),
    email: (row.email as string | null) ?? null,
    avatarHue: Number(row.avatar_hue ?? 220),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapPair(row: Record<string, unknown>): ReadingPair {
  return {
    id: String(row.id),
    buddyCode: String(row.buddy_code),
    userAId: String(row.user_a_id),
    userBId: (row.user_b_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function mapBook(row: Record<string, unknown>): Book {
  return {
    id: String(row.id),
    pairId: String(row.pair_id),
    title: String(row.title),
    author: String(row.author),
    totalPages: Number(row.total_pages),
    coverUrl: (row.cover_url as string | null) ?? null,
    status: row.status as BookStatus,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    completedAt: (row.completed_at as string | null) ?? null,
    olid: (row.olid as string | null) ?? null,
  };
}

function mapProgress(row: Record<string, unknown>): ReadingProgress {
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
    pairId: String(row.pair_id),
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
  };
}

async function fetchSnapshot(
  sb: SupabaseClient,
  userId: string,
): Promise<PageMateSnapshot> {
  const { data: profileRow } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow) : null;

  const { data: pairRow } = await sb
    .from("reading_pairs")
    .select("*")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle();

  if (!pairRow) {
    return { ...emptySnapshot(), profile };
  }

  const pair = mapPair(pairRow);
  const buddyId = pair.userAId === userId ? pair.userBId : pair.userAId;

  const [
    { data: buddyRow },
    { data: bookRows },
    { data: progressRows },
    { data: activityRows },
    { data: noteRows },
    { data: pushRows },
  ] = await Promise.all([
    buddyId
      ? sb.from("profiles").select("*").eq("id", buddyId).maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("books")
      .select("*")
      .eq("pair_id", pair.id)
      .order("created_at", { ascending: false }),
    sb.from("reading_progress").select("*").eq("pair_id", pair.id),
    sb
      .from("activities")
      .select("*")
      .eq("pair_id", pair.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sb
      .from("micro_notes")
      .select("*")
      .eq("pair_id", pair.id)
      .order("created_at", { ascending: false }),
    sb.from("push_subscriptions").select("*").eq("user_id", userId),
  ]);

  return {
    profile,
    pair,
    buddy: buddyRow ? mapProfile(buddyRow) : null,
    books: (bookRows ?? []).map(mapBook),
    progress: (progressRows ?? []).map(mapProgress),
    activities: (activityRows ?? []).map(mapActivity),
    notes: (noteRows ?? []).map(mapNote),
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

export function createSupabaseAdapter(
  client?: SupabaseClient | null,
): SyncAdapter | null {
  const sb = client ?? getSupabaseBrowserClient();
  if (!sb) return null;

  let userId: string | null = null;
  let pairId: string | null = null;
  const listeners = new Set<ProgressListener>();
  let channel: RealtimeChannel | null = null;

  const notify = async () => {
    if (!userId) return;
    const snap = await fetchSnapshot(sb, userId);
    pairId = snap.pair?.id ?? null;
    listeners.forEach((l) => l(snap));
  };

  return {
    mode: "supabase",

    async hydrate() {
      const { data } = await sb.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId) return emptySnapshot();
      const snap = await fetchSnapshot(sb, userId);
      pairId = snap.pair?.id ?? null;
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
          throw new Error(
            "Check Gmail (or your inbox) to confirm the account, then sign in.",
          );
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
        message: "Check Gmail for a PageMate reset link. It expires soon.",
      };
    },

    async signOut() {
      await sb.auth.signOut();
      userId = null;
      pairId = null;
      listeners.forEach((l) => l(emptySnapshot()));
    },

    async createPair() {
      if (!userId) throw new Error("Not authenticated");
      const { data: existing } = await sb
        .from("reading_pairs")
        .select("*")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .maybeSingle();
      if (existing) {
        const pair = mapPair(existing);
        pairId = pair.id;
        await notify();
        return pair;
      }
      const { data, error } = await sb
        .from("reading_pairs")
        .insert({
          buddy_code: generateBuddyCode(),
          user_a_id: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      const pair = mapPair(data);
      pairId = pair.id;

      const { data: book } = await sb
        .from("books")
        .insert({
          pair_id: pair.id,
          title: SAMPLE_BOOK.title,
          author: SAMPLE_BOOK.author,
          total_pages: SAMPLE_BOOK.totalPages,
          cover_url: SAMPLE_BOOK.coverUrl,
          status: "currently_reading",
          created_by: userId,
        })
        .select("*")
        .single();

      if (book) {
        await sb.from("reading_progress").insert({
          pair_id: pair.id,
          book_id: book.id,
          user_id: userId,
          current_page: 1,
        });
        await sb.from("activities").insert({
          pair_id: pair.id,
          book_id: book.id,
          user_id: userId,
          kind: "book_added",
          payload: { bookTitle: SAMPLE_BOOK.title },
        });
      }

      await notify();
      return pair;
    },

    async joinPair(buddyCode) {
      if (!userId) throw new Error("Not authenticated");
      const code = buddyCode.trim().toUpperCase();
      const { data: existing, error } = await sb
        .from("reading_pairs")
        .select("*")
        .eq("buddy_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!existing) throw new Error("No pair found for that buddy code.");
      if (existing.user_a_id === userId)
        throw new Error("That's your own code.");
      if (existing.user_b_id && existing.user_b_id !== userId) {
        throw new Error("This pair is already full.");
      }
      const { data: updated, error: upErr } = await sb
        .from("reading_pairs")
        .update({ user_b_id: userId })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (upErr) throw upErr;
      const pair = mapPair(updated);
      pairId = pair.id;

      const { data: books } = await sb
        .from("books")
        .select("id")
        .eq("pair_id", pair.id);
      if (books) {
        await sb.from("reading_progress").upsert(
          books.map((b) => ({
            pair_id: pair.id,
            book_id: b.id,
            user_id: userId,
            current_page: 0,
          })),
          { onConflict: "book_id,user_id" },
        );
      }
      await sb.from("activities").insert({
        pair_id: pair.id,
        book_id: null,
        user_id: userId,
        kind: "pair_joined",
        payload: {},
      });
      const snap = await fetchSnapshot(sb, userId);
      listeners.forEach((l) => l(snap));
      return { pair, buddy: snap.buddy };
    },

    async leavePair() {
      if (!userId || !pairId) return;
      const { data: pair } = await sb
        .from("reading_pairs")
        .select("*")
        .eq("id", pairId)
        .maybeSingle();
      if (!pair) return;
      if (pair.user_a_id === userId) {
        await sb.from("reading_pairs").delete().eq("id", pairId);
      } else {
        await sb
          .from("reading_pairs")
          .update({ user_b_id: null })
          .eq("id", pairId);
      }
      pairId = null;
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
      if (!userId || !pairId) throw new Error("Pair required");
      const { data, error } = await sb
        .from("books")
        .insert({
          pair_id: pairId,
          title: input.title.trim(),
          author: input.author.trim(),
          total_pages: Math.max(1, Math.floor(input.totalPages)),
          cover_url: input.coverUrl ?? null,
          status: input.status ?? "currently_reading",
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      const book = mapBook(data);
      const { data: pair } = await sb
        .from("reading_pairs")
        .select("user_a_id, user_b_id")
        .eq("id", pairId)
        .single();
      const ids = [pair?.user_a_id, pair?.user_b_id].filter(
        Boolean,
      ) as string[];
      await sb.from("reading_progress").insert(
        ids.map((id) => ({
          pair_id: pairId,
          book_id: book.id,
          user_id: id,
          current_page: 0,
        })),
      );
      await sb.from("activities").insert({
        pair_id: pairId,
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
      if (!userId || !pairId) return;
      const { data: book } = await sb
        .from("books")
        .select("title, total_pages, status")
        .eq("id", bookId)
        .single();
      const total = Number(book?.total_pages ?? page);
      const clamped = Math.max(0, Math.min(page, total));

      await sb.from("reading_progress").upsert(
        {
          pair_id: pairId,
          book_id: bookId,
          user_id: userId,
          current_page: clamped,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "book_id,user_id" },
      );

      if (clamped !== previousPage) {
        await sb.from("activities").insert({
          pair_id: pairId,
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
      const bothDone =
        (allProgress ?? []).length >= 2 &&
        (allProgress ?? []).every((p) => Number(p.current_page) >= total);

      if (bothDone && book?.status !== "completed") {
        await sb
          .from("books")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", bookId);
        await sb.from("activities").insert({
          pair_id: pairId,
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
      });

      await notify();
    },

    async addNote(input) {
      if (!userId || !pairId) throw new Error("Pair required");
      const { data, error } = await sb
        .from("micro_notes")
        .insert({
          pair_id: pairId,
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
        pair_id: pairId,
        book_id: input.bookId,
        user_id: userId,
        kind: input.emoji && !input.note ? "reaction" : "note",
        payload: {
          emoji: input.emoji,
          note: input.note,
          page: input.pageNumber,
        },
      });
      await sendPush(sb, {
        event: input.emoji && !input.note ? "reaction" : "note",
        bookId: input.bookId,
        page: input.pageNumber,
        emoji: input.emoji,
        note: input.note,
      });
      const note = mapNote(data);
      await notify();
      return note;
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
      if (channel) {
        return () => listeners.delete(onChange);
      }
      channel = sb
        .channel("pagemate-realtime")
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
          { event: "*", schema: "public", table: "books" },
          () => {
            void notify();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reading_pairs" },
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
