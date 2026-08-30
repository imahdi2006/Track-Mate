import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { findPairDocForProfile } from "@/lib/auth/pair-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const { profileId } = await params;
  const id = profileId.trim();
  if (!id) {
    return NextResponse.json({ message: "Missing profile id." }, { status: 400 });
  }

  const doc = await findPairDocForProfile(id);
  if (!doc) {
    return NextResponse.json(
      { message: "No pair for this user yet." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } });
}
