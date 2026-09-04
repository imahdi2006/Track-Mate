import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h === "0.0.0.0") return true;
  if (h === "::1" || h === "127.0.0.1") return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  if (isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: "That host isn’t allowed" }, { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "image/*" },
    redirect: "follow",
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Couldn’t fetch that image" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "That URL isn’t an image" }, { status: 400 });
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large to crop" }, { status: 400 });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type.split(";")[0] ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
