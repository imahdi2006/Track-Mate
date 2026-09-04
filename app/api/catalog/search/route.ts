import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/catalog";
import { parseTitleKind } from "@/lib/media";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const kind = parseTitleKind(searchParams.get("kind"));
  try {
    const hits = await searchCatalog(kind, q);
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "search_failed" },
      { status: 502 },
    );
  }
}
