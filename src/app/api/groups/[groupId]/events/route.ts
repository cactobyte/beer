import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { groupChanges } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Close a little before the platform limit; EventSource reconnects on its own
const STREAM_MS = 270_000;
const PING_MS = 20_000;

/**
 * Server-Sent Events stream of a group's change counter. Pushed the moment a
 * change is committed (Postgres NOTIFY), so pages refresh instantly.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/groups/[groupId]/events">) {
  const { groupId } = await ctx.params;
  const me = await getUser();
  if (!me) return new Response("Not logged in", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return new Response("Not found", { status: 404 });

  const current = async () => {
    const [row] = await db
      .select({ version: schema.groups.version })
      .from(schema.groups)
      .innerJoin(
        schema.groupMembers,
        and(eq(schema.groupMembers.groupId, schema.groups.id), eq(schema.groupMembers.userId, me.id)),
      )
      .where(eq(schema.groups.id, groupId))
      .limit(1);
    return row?.version ?? null;
  };
  if ((await current()) === null) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const sendVersion = (v: number) => send(`event: version\ndata: ${v}\n\n`);

      // Subscribe before reading the version so nothing slips between the two
      const sub = groupChanges.subscribe(groupId, sendVersion);
      const ping = setInterval(() => send(": ping\n\n"), PING_MS);
      const end = setTimeout(() => close(), STREAM_MS);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearTimeout(end);
        sub.unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
      req.signal.addEventListener("abort", close);

      send("retry: 1000\n\n");
      try {
        await sub.ready;
      } catch {
        // No LISTEN connection: tell the client to fall back to polling
        send("event: unavailable\ndata: 1\n\n");
        close();
        return;
      }
      const v = await current();
      if (v === null) close();
      else sendVersion(v);
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
