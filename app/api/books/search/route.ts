import { NextResponse } from "next/server";
import { searchOpenLibrary } from "@/lib/openlibrary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  try {
    const docs = await searchOpenLibrary(q);
    return NextResponse.json({ docs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "search_failed" },
      { status: 502 },
    );
  }
}
