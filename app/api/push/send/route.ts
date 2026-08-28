import { NextResponse } from "next/server";
import webpush from "web-push";
import { PUSH_THROTTLE_MS } from "@/lib/config";
import { getPairDoc } from "@/lib/auth/pair-store";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const lastSent = new Map<string, number>();

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@pagemate.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

type Body = {
  event: "page_update" | "reaction" | "note" | "test";
  bookId?: string;
  page?: number;
  bookTitle?: string;
  emoji?: string;
  note?: string;
  actorId?: string;
  buddyCode?: string;
  subscription?: { endpoint: string; p256dh: string; auth: string };
};

function composeMessage(body: Body, name: string): string {
  const title = body.bookTitle ?? "your book";
  if (body.event === "test") return "Push is on. You’ll get a ping when your buddy turns a page.";
  if (body.event === "reaction") {
    return `${name} reacted ${body.emoji ?? "👏"} on page ${body.page} of '${title}'`;
  }
  if (body.event === "note") {
    return `${name} left a note on page ${body.page} of '${title}'`;
  }
  return `🔥 ${name} just reached page ${body.page} of '${title}'! Catch up!`;
}

async function deliver(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  message: string,
  bookId?: string,
): Promise<number> {
  const payload = JSON.stringify({
    title: "PageMate",
    body: message,
    bookId,
    url: bookId ? `/book/${bookId}` : "/",
    tag: `pagemate-${bookId ?? "feed"}`,
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
  return results.filter((r) => r.status === "fulfilled").length;
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

  if (body.buddyCode && body.actorId) {
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
    const sent = await deliver(targets, composeMessage(body, name), body.bookId);
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

  const { data: pair } = await sb
    .from("reading_pairs")
    .select("*")
    .or(`user_a_id.eq.${actorId},user_b_id.eq.${actorId}`)
    .maybeSingle();

  if (!pair) return NextResponse.json({ ok: false, reason: "no_pair" }, { status: 200 });

  const buddyId = pair.user_a_id === actorId ? pair.user_b_id : pair.user_a_id;
  const { data: actor } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .maybeSingle();

  const name = actor?.display_name ?? "Your buddy";
  const targetUser = body.event === "test" ? actorId : buddyId;
  if (!targetUser) return NextResponse.json({ ok: true, skipped: "no_buddy" });

  const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", targetUser);
  const sent = await deliver(
    (subs ?? []).map((sub) => ({
      endpoint: sub.endpoint as string,
      p256dh: sub.p256dh as string,
      auth: sub.auth as string,
    })),
    composeMessage(body, name),
    body.bookId,
  );

  return NextResponse.json({ ok: true, sent, mode: "supabase" });
}
