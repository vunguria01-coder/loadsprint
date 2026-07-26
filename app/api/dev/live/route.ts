import { bootId, subscribe, watchedRoots, type LiveBatch } from "@/lib/dev-live";

// Server-sent event stream of source-file changes, consumed by <DevLiveSync />.
// Dev only: in production this route answers 404 and the watcher never loads.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keeps proxies and browsers from dropping an idle stream. */
const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let detach: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const teardown = () => {
        if (closed) return;
        closed = true;
        detach?.();
        detach = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };

      // bootId changes when the dev server restarts — the client uses that to
      // tell "reconnected" apart from "a new server is running".
      send("hello", { bootId: bootId(), roots: watchedRoots(), at: Date.now() });

      detach = subscribe((batch: LiveBatch) => send("change", batch));

      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      heartbeat.unref?.();

      req.signal.addEventListener("abort", teardown);
    },
    cancel() {
      detach?.();
      detach = null;
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
