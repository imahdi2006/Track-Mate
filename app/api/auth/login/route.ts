import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth/rate-limit";
import { verifyUser } from "@/lib/auth/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`login:${ip}`, 20)) {
    return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email.includes("@") || !password) {
    return NextResponse.json({ message: "Enter email and password." }, { status: 400 });
  }

  const user = await verifyUser(email, password);
  if (!user) {
    return NextResponse.json({ message: "Wrong email or password." }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email,
    profileId: user.profileId,
    displayName: user.displayName,
  });
}
