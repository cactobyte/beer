import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { Feed } from "@/components/Feed";
import { Leaderboard } from "@/components/Leaderboard";
import { LogDrink } from "@/components/LogDrink";
import { PeriodTabs } from "@/components/PeriodTabs";
import { RememberGroup } from "@/components/RememberGroup";
import { requireUser } from "@/lib/auth";
import { PERIODS, parsePeriod } from "@/lib/drinks";
import { timeAgo } from "@/lib/time";
import { getGroupFeed, getLatestMessage, getLeaderboard, getMyTonight, requireGroup } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const me = await requireUser(`/g/${groupId}`);
  const { group } = await requireGroup(groupId, me.id);
  return { title: group.name };
}

export default async function GroupPage({ params, searchParams }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const period = parsePeriod((await searchParams).period);
  const me = await requireUser(`/g/${groupId}`);
  const { group } = await requireGroup(groupId, me.id);

  const [board, feed, tonight, lastMessage] = await Promise.all([
    getLeaderboard(group.id, group.timezone, period),
    getGroupFeed(group.id),
    getMyTonight(me.id, group.timezone),
    getLatestMessage(group.id),
  ]);

  return (
    <div className="space-y-5">
      <RememberGroup id={group.id} />
      <AutoRefresh />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted">
            {board.length} {board.length === 1 ? "member" : "members"} · code{" "}
            <span className="font-mono font-semibold tracking-wider text-ink">{group.inviteCode}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <CopyButton text={`/join/${group.inviteCode}`} label="Invite" share />
          <Link href={`/g/${group.id}/settings`} className="btn btn-ghost" aria-label="Group settings">
            ⚙️
          </Link>
        </div>
      </div>

      <Link
        href={`/g/${group.id}/chat`}
        className="card flex items-center gap-3 px-4 py-3 transition hover:bg-card-hi"
      >
        <span className="text-2xl">💬</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Group chat</span>
          <span className="block truncate text-sm text-muted">
            {lastMessage ? `${lastMessage.displayName}: ${lastMessage.body}` : "Start the conversation"}
          </span>
        </span>
        {lastMessage && <span className="shrink-0 text-xs text-dim">{timeAgo(new Date(lastMessage.createdAt))}</span>}
        <span className="text-dim">→</span>
      </Link>

      <LogDrink tonight={tonight} />

      <section className="card overflow-hidden">
        <div className="border-b border-line p-3">
          <PeriodTabs base={`/g/${group.id}`} current={period} />
        </div>
        {board.every((r) => r.drinks === 0) && (
          <p className="border-b border-line px-4 py-3 text-center text-sm text-dim">
            Nobody’s on the board {period === "all" ? "yet" : PERIODS[period].toLowerCase()}. Get a round in.
          </p>
        )}
        <Leaderboard rows={board} meId={me.id} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold">Latest</h2>
        <Feed items={feed} meId={me.id} />
      </section>
    </div>
  );
}
