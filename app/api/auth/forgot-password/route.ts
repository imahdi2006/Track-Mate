import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { sendPasswordResetEmail } from "@/lib/auth/resend";
import { findUser, issueResetToken } from "@/lib/auth/server-store";

export const runtime = "nodejs";

const GENERIC =
  "If that email has a BookMate account, a reset link is on its way. Check Gmail and spam.";

function buildOrigin(request: Request, bodyOrigin?: string): string {
  return (
    (bodyOrigin && /^https?:\/\//.test(bodyOrigin) ? bodyOrigin.replace(/\/$/, "") : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  );
}

export async function POST(request: Request) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`forgot:${ip}`) || !rateLimit(`forgot-ip:${ip}`, 12)) {
    return NextResponse.json({ message: "Too many reset attempts. Try again in a bit." }, { status: 429 });
  }

  let body: { email?: string; origin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ message: "Enter a valid email." }, { status: 400 });
  }

  if (!rateLimit(`forgot-email:${email}`, 4)) {
    return NextResponse.json({ emailed: true, message: GENERIC });
  }

  const user = await findUser(email);
  if (!user) {
    return NextResponse.json({ emailed: true, message: GENERIC });
  }

  const token = await issueResetToken(email);
  if (!token) {
    return NextResponse.json({ emailed: true, message: GENERIC });
  }

  const resetUrl = `${buildOrigin(request, body.origin)}/reset-password?token=${encodeURIComponent(token)}`;

  if (process.env.RESEND_API_KEY) {
    const sent = await sendPasswordResetEmail({ to: email, resetUrl });
    if (sent.ok) {
      return NextResponse.json({ emailed: true, message: GENERIC });
    }
  }

  return NextResponse.json({
    emailed: false,
    resetUrl,
    message:
      "Email is not set up on this server. Copy the reset link below — it expires in one hour.",
  });
}
