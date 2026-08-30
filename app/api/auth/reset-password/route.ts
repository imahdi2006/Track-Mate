import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { consumeResetToken, updatePassword } from "@/lib/auth/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`reset:${ip}`, 20)) {
    return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";
  if (!token || password.length < 6) {
    return NextResponse.json(
      { message: "Open the email link and choose a password of at least 6 characters." },
      { status: 400 },
    );
  }

  const user = await consumeResetToken(token);
  if (!user) {
    return NextResponse.json(
      { message: "This reset link is invalid or expired. Request a new one." },
      { status: 400 },
    );
  }

  const updated = await updatePassword(user.email, password);
  if (!updated) {
    return NextResponse.json({ message: "Couldn’t update password." }, { status: 400 });
  }

  return NextResponse.json({
    email: updated.email,
    profileId: updated.profileId,
    displayName: updated.displayName,
  });
}
