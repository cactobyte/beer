import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { JoinButton } from "./join-button";

export const metadata = { title: "Join group" };

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const [group] = await db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      members: sql<number>`(select count(*)::int from ${schema.groupMembers} gm where gm.group_id = ${schema.groups.id})`,
    })
    .from(schema.groups)
    .where(eq(schema.groups.inviteCode, code))
    .limit(1);

  const user = await getUser();
  if (group && user) {
    const [member] = await db
      .select({ one: sql`1` })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, user.id)))
      .limit(1);
    if (member) redirect(`/g/${group.id}`);
  }

  const next = `/join/${code}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10 text-center">
      <Link href="/" className="mb-8 font-display text-5xl font-extrabold tracking-tight text-foam">
        sesh
      </Link>
      {!group ? (
        <div className="card space-y-4 p-6">
          <p className="text-lg font-semibold">That invite doesn’t work</p>
          <p className="text-sm text-muted">The code may have been changed. Ask for a fresh link.</p>
          <Link href="/" className="btn btn-ghost w-full">
            Go home
          </Link>
        </div>
      ) : (
        <div className="card space-y-5 p-6">
          <div>
            <p className="text-sm text-muted">You’ve been invited to</p>
            <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">{group.name}</p>
            <p className="mt-1 text-sm text-dim">
              {group.members} {group.members === 1 ? "member" : "members"}
            </p>
          </div>
          {user ? (
            <JoinButton code={code} />
          ) : (
            <div className="grid gap-3">
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn btn-primary">
                Sign up to join
              </Link>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-ghost">
                I have an account
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
