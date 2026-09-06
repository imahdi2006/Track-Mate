import { NextResponse } from "next/server";
import { APP_NAME, BUG_REPORT_EMAIL, isSupabaseConfigured } from "@/lib/config";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  what?: string;
  expected?: string;
  version?: string;
  mode?: string;
  roomCode?: string;
  userAgent?: string;
  email?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const what = (body.what ?? "").trim();
  const expected = (body.expected ?? "").trim();
  if (what.length < 8) {
    return NextResponse.json(
      { ok: false, error: "too_short", message: "Tell us a bit more about what happened." },
      { status: 400 },
    );
  }

  let reporter = body.email?.trim() || "anonymous";
  if (isSupabaseConfigured()) {
    const sb = getSupabaseServiceClient();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (sb && token) {
      const { data } = await sb.auth.getUser(token);
      if (data.user?.email) reporter = data.user.email;
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "resend_unconfigured",
        message: "Bug reports aren’t wired up on the server yet (missing RESEND_API_KEY).",
      },
      { status: 200 },
    );
  }

  const from = process.env.RESEND_FROM || "Trackmate <onboarding@resend.dev>";
  const text = [
    `Reporter: ${reporter}`,
    `App: ${APP_NAME} v${body.version ?? "?"}`,
    `Mode: ${body.mode ?? "?"}`,
    `Room: ${body.roomCode ?? "—"}`,
    `UA: ${body.userAgent ?? "—"}`,
    "",
    "What happened:",
    what,
    "",
    "What they expected:",
    expected || "(not provided)",
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [BUG_REPORT_EMAIL],
      reply_to: reporter.includes("@") ? reporter : undefined,
      subject: `[${APP_NAME} bug] ${what.slice(0, 72)}`,
      text,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { message?: string };
      detail = j.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    return NextResponse.json(
      {
        ok: false,
        error: "send_failed",
        message: detail || "Couldn’t send the report. Try again in a moment.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true });
}
