import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { findUser, verifyUser } from "@/lib/auth/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`login:${ip}`, 80)) {
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

  try {
    const user = await verifyUser(email, password);
    if (!user) {
      const exists = await findUser(email);
      return NextResponse.json(
        {
          message: exists
            ? "Wrong password."
            : "No account for that email. Create one first.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      email: user.email,
      profileId: user.profileId,
      displayName: user.displayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn’t sign in";
    return NextResponse.json({ message }, { status: 500 });
  }
}
