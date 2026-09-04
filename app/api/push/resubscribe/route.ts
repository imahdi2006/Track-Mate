import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  oldEndpoint?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
};

/**
 * The browser can rotate a push endpoint on its own (quota/expiry) and
 * fires `pushsubscriptionchange` in the service worker. The SW resubscribes
 * and reports the swap here, keyed by the old endpoint — it has no user id
 * to hand us. Without this, a rotated subscription just goes silently dead
 * and notifications "sometimes don't arrive" with no way to recover short
 * of the user manually toggling push off/on in Settings.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const oldEndpoint = body.oldEndpoint?.trim();
  if (!oldEndpoint) {
    return NextResponse.json({ ok: false, reason: "missing_old_endpoint" }, { status: 400 });
  }
  const next =
    body.endpoint && body.p256dh && body.auth
      ? {
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          userAgent: body.userAgent ?? null,
        }
      : null;

  if (!isSupabaseConfigured()) {
    const { replacePushSubscriptionEverywhere } = await import("@/lib/auth/pair-store");
    const changed = await replacePushSubscriptionEverywhere(oldEndpoint, next);
    return NextResponse.json({ ok: true, changed, mode: "local" });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ ok: false, reason: "no_service_role" }, { status: 200 });

  const { data: existing } = await sb
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", oldEndpoint)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: true, changed: false, mode: "supabase" });
  }

  await sb.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
  if (next) {
    await sb.from("push_subscriptions").upsert(
      {
        user_id: existing.user_id,
        endpoint: next.endpoint,
        p256dh: next.p256dh,
        auth: next.auth,
        user_agent: next.userAgent,
      },
      { onConflict: "endpoint" },
    );
  }
  return NextResponse.json({ ok: true, changed: true, mode: "supabase" });
}
