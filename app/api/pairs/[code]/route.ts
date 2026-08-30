import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { getPairDoc, upsertPairDoc, type PairDoc } from "@/lib/auth/pair-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const { code } = await params;
  const doc = await getPairDoc(code);
  if (!doc) {
    return NextResponse.json(
      { message: "No pair for that code." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const { code } = await params;
  let body: PairDoc;
  try {
    body = (await request.json()) as PairDoc;
  } catch {
    return NextResponse.json({ message: "Invalid pair payload." }, { status: 400 });
  }
  if (!body?.pair?.buddyCode) {
    return NextResponse.json({ message: "Missing pair." }, { status: 400 });
  }
  body.pair.buddyCode = code.trim().toUpperCase();
  const merged = await upsertPairDoc(body);
  return NextResponse.json(merged, { headers: { "Cache-Control": "no-store" } });
}
