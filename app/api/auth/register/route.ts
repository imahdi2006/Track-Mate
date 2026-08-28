import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth/rate-limit";
import { upsertUser } from "@/lib/auth/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`register:${ip}`, 20)) {
    return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: {
    email?: string;
    password?: string;
    profileId?: string;
    displayName?: string;
    mode?: "signup" | "signin";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const profileId = body.profileId?.trim() ?? "";
  const displayName = body.displayName?.trim() || email.split("@")[0] || "Reader";

  if (!email.includes("@") || password.length < 6 || !profileId) {
    return NextResponse.json({ message: "Enter a valid email, password, and profile." }, { status: 400 });
  }

  try {
    const user = await upsertUser({
      email,
      password,
      profileId,
      displayName,
      mode: body.mode === "signin" ? "signin" : "signup",
    });
    return NextResponse.json({
      email: user.email,
      profileId: user.profileId,
      displayName: user.displayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn’t save account";
    const status = message.toLowerCase().includes("already exists") ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
