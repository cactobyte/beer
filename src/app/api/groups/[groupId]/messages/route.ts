import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { getMessages, isMember } from "@/lib/queries";

function parseDate(v: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Chat polling (`?after=`) and history paging (`?before=`). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/[groupId]/messages">) {
  const { groupId } = await ctx.params;
  const me = await getUser();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!(await isMember(groupId, me.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const params = req.nextUrl.searchParams;
  const messages = await getMessages(groupId, {
    after: parseDate(params.get("after")),
    before: parseDate(params.get("before")),
    limit: 50,
  });
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
