import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getUser } from "@/lib/auth";

/** Cheap change counter that open pages poll to know when to refresh. */
export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[groupId]/version">) {
  const { groupId } = await ctx.params;
  const me = await getUser();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select({ version: schema.groups.version })
    .from(schema.groups)
    .innerJoin(
      schema.groupMembers,
      and(eq(schema.groupMembers.groupId, schema.groups.id), eq(schema.groupMembers.userId, me.id)),
    )
    .where(eq(schema.groups.id, groupId))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ version: row.version }, { headers: { "Cache-Control": "no-store" } });
}
