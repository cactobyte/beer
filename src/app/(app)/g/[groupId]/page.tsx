import Link from "next/link";
import { LiveRefresh } from "@/components/LiveRefresh";
import { CopyButton } from "@/components/CopyButton";
import { Feed } from "@/components/Feed";
import { Leaderboard } from "@/components/Leaderboard";
import { LogDrink } from "@/components/LogDrink";
import { PeriodTabs } from "@/components/PeriodTabs";
import { RememberGroup } from "@/components/RememberGroup";
import { requireUser } from "@/lib/auth";
import { PERIODS, parsePeriod } from "@/lib/drinks";
import { formatInTz, timeAgo } from "@/lib/time";
import { getGroupFeed, getLatestMessage, getLeaderboard, getMyTonight, getSeshes, requireGroup } from "@/lib/queries";
import { StartSeshForm } from "@/components/SeshForms";

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
  const { group, role } = await requireGroup(groupId, me.id);
  const isOwner = role === "owner";

  const [board, feed, tonight, lastMessage, seshes] = await Promise.all([
    getLeaderboard(group.id, group.timezone, period),
    getGroupFeed(group.id),
    getMyTonight(me.id, group.timezone),
    getLatestMessage(group.id),
    getSeshes(group.id, 20),
  ]);
  const liveSesh = seshes.find((x) => x.endedAt === null);
  const pastSeshes = seshes.filter((x) => x.endedAt !== null);
  const seshOptions = seshes.map((x) => ({ id: x.id, name: x.name }));

  return (
    <div className="space-y-5">
      <RememberGroup id={group.id} />
      <LiveRefresh groupId={group.id} />

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

      {liveSesh ? (
        <Link
          href={`/g/${group.id}/s/${liveSesh.id}`}
          className="card flex items-center gap-3 border-danger/40 px-4 py-3 transition hover:bg-card-hi"
        >
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-danger" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-danger">Live sesh</span>
            <span className="block truncate font-display text-lg font-semibold">{liveSesh.name}</span>
          </span>
          <span className="shrink-0 text-right text-sm text-muted">
            <span className="block font-semibold text-ink">{liveSesh.drinks} drinks</span>
            {liveSesh.people} {liveSesh.people === 1 ? "person" : "people"}
          </span>
          <span className="text-dim">→</span>
        </Link>
      ) : (
        <section className="card space-y-2 p-4">
          <h2 className="font-display text-lg font-semibold">Going out?</h2>
          <p className="text-sm text-muted">Start a sesh and everyone’s drinks count towards it until it ends.</p>
          <StartSeshForm groupId={group.id} live={false} />
        </section>
      )}

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
        <Feed items={feed} meId={me.id} groupId={group.id} isOwner={isOwner} seshes={seshOptions} />
      </section>

      {pastSeshes.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold">Past seshes</h2>
          <ul className="divide-y divide-line">
            {pastSeshes.map((x) => (
              <li key={x.id}>
                <Link href={`/g/${group.id}/s/${x.id}`} prefetch={false} className="flex items-center gap-3 px-4 py-3 transition hover:bg-card-hi">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{x.name}</span>
                    <span className="block text-xs text-dim">
                      {formatInTz(x.startedAt, group.timezone, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {x.drinks} drinks · {x.people} {x.people === 1 ? "person" : "people"}
                  </span>
                  <span className="text-dim">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
