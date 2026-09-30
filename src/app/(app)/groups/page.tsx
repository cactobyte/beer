import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { CreateGroupForm, JoinGroupForm } from "./forms";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const me = await requireUser("/groups");
  const groups = await getMyGroups(me.id);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Your groups</h1>

      {groups.length === 0 ? (
        <p className="card p-5 text-muted">
          You’re not in any groups yet. Join your mates with their code, or start your own and send them the link.
        </p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/g/${g.id}`} className="flex items-center justify-between px-4 py-3.5 transition hover:bg-card-hi">
                <span className="font-semibold">{g.name}</span>
                <span className="text-sm text-dim">
                  {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  {g.role === "owner" && " · owner"} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <JoinGroupForm />
        <CreateGroupForm />
      </div>
    </div>
  );
}
