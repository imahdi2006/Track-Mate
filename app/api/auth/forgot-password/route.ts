import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth/rate-limit";
import { sendPasswordResetEmail } from "@/lib/auth/resend";
import { findUser, issueResetToken } from "@/lib/auth/server-store";

export const runtime = "nodejs";

const GENERIC =
  "If that email has a PageMate account, a reset link is on its way. Check Gmail and spam.";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`forgot:${ip}`) || !rateLimit(`forgot-ip:${ip}`, 12)) {
    return NextResponse.json({ message: "Too many reset emails. Try again in a bit." }, { status: 429 });
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

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      emailed: false,
      message:
        "Email sending is not configured. Add RESEND_API_KEY in .env.local, then restart the app.",
    });
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

  const origin =
    (body.origin && /^https?:\/\//.test(body.origin) ? body.origin.replace(/\/$/, "") : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin;

  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendPasswordResetEmail({ to: email, resetUrl });
  if (!sent.ok) {
    return NextResponse.json({ emailed: false, message: sent.message }, { status: 502 });
  }

  return NextResponse.json({ emailed: true, message: GENERIC });
}
