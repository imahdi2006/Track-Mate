import { NextResponse } from "next/server";
import webpush from "web-push";
import { PUSH_THROTTLE_MS, isSupabaseConfigured } from "@/lib/config";
import { formatUnitMark, parseTitleKind } from "@/lib/media";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { TitleKind } from "@/lib/types";

export const runtime = "nodejs";

const lastSent = new Map<string, number>();

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@Trackmate.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

type Body = {
  event: "page_update" | "reaction" | "note" | "test";
  bookId?: string;
  page?: number;
  bookTitle?: string;
  kind?: TitleKind;
  emoji?: string;
  note?: string;
  actorId?: string;
  buddyCode?: string;
  roomId?: string;
  subscription?: { endpoint: string; p256dh: string; auth: string };
};

function composeMessage(body: Body, name: string): string {
  const title = body.bookTitle ?? "your title";
  const kind = parseTitleKind(body.kind);
  const mark = formatUnitMark(kind, body.page ?? 0);
  if (body.event === "test") {
    return "Push is on. You’ll get a ping when someone in the room moves ahead.";
  }
  if (body.event === "reaction") {
    return `${name} reacted ${body.emoji ?? "👏"} at ${mark} of ‘${title}’`;
  }
  if (body.event === "note") {
    return `${name} left a note at ${mark} of ‘${title}’`;
  }
  return `${name} just reached ${mark} of ‘${title}’. Catch up!`;
}

/**
 * Push endpoints go permanently dead (uninstalled PWA, cleared site data,
 * unsubscribed elsewhere) and the browser returns 404/410 for those. If we
 * never prune them, every future send keeps silently failing against the
 * same dead row forever — one of the main reasons notifications "sometimes
 * don't arrive". Report which endpoints are gone so the caller can delete
 * them.
 */
async function deliver(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  message: string,
  bookId?: string,
): Promise<{ sent: number; gone: string[] }> {
  const payload = JSON.stringify({
    title: "Trackmate",
    body: message,
    bookId,
    url: bookId ? `/book/${bookId}` : "/",
    tag: `Trackmate-${bookId ?? "feed"}`,
  });
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );
  const gone: string[] = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent += 1;
      return;
    }
    const statusCode = (r.reason as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      gone.push(subs[i]!.endpoint);
    }
  });
  return { sent, gone };
}

export async function POST(request: Request) {
  if (!configureVapid()) {
    return NextResponse.json({ ok: false, reason: "vapid_unconfigured" }, { status: 200 });
  }

  const body = (await request.json()) as Body;
  const throttleKey = `${body.actorId ?? "anon"}:${body.event}:${body.bookId ?? ""}`;
  const prev = lastSent.get(throttleKey) ?? 0;
  if (Date.now() - prev < PUSH_THROTTLE_MS && body.event !== "test") {
    return NextResponse.json({ ok: true, throttled: true });
  }
  lastSent.set(throttleKey, Date.now());

  // Local demo path (SQLite pair docs) — only when Supabase is not the production path.
  if (!isSupabaseConfigured() && body.buddyCode && body.actorId) {
    const { getPairDoc } = await import("@/lib/auth/pair-store");
    const doc = await getPairDoc(body.buddyCode);
    const actor = doc?.profiles.find((p) => p.id === body.actorId);
    const name = actor?.displayName ?? "Your buddy";
    const fromDoc =
      body.event === "test"
        ? (doc?.pushSubscriptions ?? []).filter((s) => s.userId === body.actorId)
        : (doc?.pushSubscriptions ?? []).filter((s) => s.userId !== body.actorId);
    const extra = body.event === "test" && body.subscription ? [body.subscription] : [];
    const seen = new Set<string>();
    const targets = [...extra, ...fromDoc]
      .filter((s) => {
        if (!s.endpoint || seen.has(s.endpoint)) return false;
        seen.add(s.endpoint);
        return true;
      })
      .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
    if (!targets.length) {
      return NextResponse.json({ ok: false, reason: "no_subscription" }, { status: 200 });
    }
    const { sent, gone } = await deliver(targets, composeMessage(body, name), body.bookId);
    if (gone.length) {
      const { replacePushSubscriptionEverywhere } = await import("@/lib/auth/pair-store");
      await Promise.all(gone.map((endpoint) => replacePushSubscriptionEverywhere(endpoint, null)));
    }
    return NextResponse.json({ ok: true, sent, mode: "local" });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return NextResponse.json({ ok: false, reason: "no_service_role" }, { status: 200 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let actorId: string | null = body.actorId ?? null;
  if (token) {
    const { data } = await sb.auth.getUser(token);
    actorId = data.user?.id ?? actorId;
  }
  if (!actorId) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  let roomId = body.roomId ?? null;
  if (!roomId && body.buddyCode) {
    const { data: byCode } = await sb
      .from("reading_rooms")
      .select("id")
      .eq("invite_code", body.buddyCode.trim().toUpperCase())
      .maybeSingle();
    roomId = byCode?.id ?? null;
  }
  if (!roomId) {
    const { data: membership } = await sb
      .from("room_members")
      .select("room_id")
      .eq("user_id", actorId)
      .limit(1)
      .maybeSingle();
    roomId = membership?.room_id ?? null;
  }
  if (!roomId) {
    return NextResponse.json({ ok: false, reason: "no_room" }, { status: 200 });
  }

  const { data: actor } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .maybeSingle();
  const name = actor?.display_name ?? "Someone";

  const { data: memberRows } = await sb
    .from("room_members")
    .select("user_id, role, shelf_scope")
    .eq("room_id", roomId);
  let targetIds =
    body.event === "test"
      ? [actorId]
      : (memberRows ?? [])
          .map((m) => String(m.user_id))
          .filter((id) => id !== actorId);

  // Book-scoped invites: only ping people who can actually open that title.
  if (body.event !== "test" && body.bookId && targetIds.length) {
    const allowed = new Set<string>();
    for (const m of memberRows ?? []) {
      const id = String(m.user_id);
      if (m.role === "owner" || m.shelf_scope === "all") allowed.add(id);
    }
    const { data: access } = await sb
      .from("book_access")
      .select("user_id")
      .eq("book_id", body.bookId);
    for (const row of access ?? []) allowed.add(String(row.user_id));
    targetIds = targetIds.filter((id) => allowed.has(id));
  }

  if (!targetIds.length) {
    return NextResponse.json({ ok: true, skipped: "no_targets" });
  }

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("*")
    .in("user_id", targetIds);

  const extra =
    body.event === "test" && body.subscription ? [body.subscription] : [];
  const seen = new Set<string>();
  const targets = [
    ...extra,
    ...(subs ?? []).map((sub) => ({
      endpoint: sub.endpoint as string,
      p256dh: sub.p256dh as string,
      auth: sub.auth as string,
    })),
  ].filter((s) => {
    if (!s.endpoint || seen.has(s.endpoint)) return false;
    seen.add(s.endpoint);
    return true;
  });

  if (!targets.length) {
    return NextResponse.json({ ok: false, reason: "no_subscription" }, { status: 200 });
  }

  const { sent, gone } = await deliver(targets, composeMessage(body, name), body.bookId);
  if (gone.length) {
    await sb.from("push_subscriptions").delete().in("endpoint", gone);
  }
  return NextResponse.json({ ok: true, sent, mode: "supabase" });
}
