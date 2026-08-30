import { NextResponse } from "next/server";
import { localApiUnavailable } from "@/lib/auth/local-api-guard";
import { getPairDoc, subscribePairDoc, type PairDoc } from "@/lib/auth/pair-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const blocked = localApiUnavailable();
  if (blocked) return blocked;
  const { code } = await params;
  const buddyCode = code.trim().toUpperCase();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const push = (doc: PairDoc) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doc)}\n\n`));
      };

      void getPairDoc(buddyCode).then((doc) => {
        if (doc) push(doc);
      });

      const unsubscribe = subscribePairDoc(buddyCode, push);

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
