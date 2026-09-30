import Link from "next/link";
import { deleteSesh, endSesh } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DrinkPicker } from "@/components/DrinkPicker";
import { Feed } from "@/components/Feed";
import { Leaderboard } from "@/components/Leaderboard";
import { LogDrink } from "@/components/LogDrink";
import { RenameSeshForm, StartSeshForm } from "@/components/SeshForms";
import { ShareRecap } from "@/components/ShareRecap";
import { requireUser } from "@/lib/auth";
import { formatUnits } from "@/lib/drinks";
import { getSeshDrinks, getSeshLeaderboard, getSeshes, getUnassignedDrinks, requireGroup, requireSesh } from "@/lib/queries";
import { formatDuration, formatInTz } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/g/[groupId]/s/[seshId]">) {
  const { groupId, seshId } = await params;
  const me = await requireUser(`/g/${groupId}/s/${seshId}`);
  await requireGroup(groupId, me.id);
  const sesh = await requireSesh(groupId, seshId);
  return { title: sesh.name };
}

export default async function SeshPage({ params }: PageProps<"/g/[groupId]/s/[seshId]">) {
  const { groupId, seshId } = await params;
  const me = await requireUser(`/g/${groupId}/s/${seshId}`);
  const { group, role } = await requireGroup(groupId, me.id);
  const sesh = await requireSesh(groupId, seshId);
  const isOwner = role === "owner";
  const live = sesh.endedAt === null;

  const [board, items, allSeshes, loose] = await Promise.all([
    getSeshLeaderboard(sesh.id),
    getSeshDrinks(sesh.id),
    getSeshes(group.id),
    isOwner ? getUnassignedDrinks(group.id) : Promise.resolve([]),
  ]);
  const seshOptions = allSeshes.map((s) => ({ id: s.id, name: s.name }));
  const total = board.reduce((n, r) => n + r.drinks, 0);
  const units = board.reduce((n, r) => n + r.units, 0);
  const tz = group.timezone;

  return (
    <div className="space-y-5">
      {live && <AutoRefresh />}
      <div>
        <Link href={`/g/${group.id}`} className="text-sm text-muted hover:text-ink">
          ← {group.name}
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{sesh.name}</h1>
            <p className="text-sm text-muted">
              {live && (
                <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-px text-xs font-semibold text-danger">
                  <span className="size-1.5 animate-pulse rounded-full bg-danger" /> LIVE
                </span>
              )}
              {formatInTz(sesh.startedAt, tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {sesh.endedAt
                ? ` – ${formatInTz(sesh.endedAt, tz, { hour: "2-digit", minute: "2-digit" })} · ${formatDuration(sesh.startedAt, sesh.endedAt)}`
                : ` · ${formatDuration(sesh.startedAt, new Date())} so far`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Drinks" value={total} />
        <Stat label="Units" value={formatUnits(units)} />
        <Stat label="People" value={board.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {total > 0 && <ShareRecap url={`/g/${group.id}/s/${sesh.id}/recap`} name={sesh.name} />}
        {live && (
          <ConfirmButton action={endSesh.bind(null, group.id, sesh.id)} confirm={`End ${sesh.name}?`} className="btn btn-ghost">
            End sesh
          </ConfirmButton>
        )}
      </div>

      {live && <LogDrink tonight={board.find((r) => r.userId === me.id)?.drinks ?? 0} countLabel="You this sesh" />}

      {live && (
        <section className="card space-y-2 p-4">
          <h2 className="font-display text-lg font-semibold">Moving on?</h2>
          <p className="text-sm text-muted">Ends this sesh and starts the next one. New drinks go there.</p>
          <StartSeshForm groupId={group.id} live />
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold">Leaderboard</h2>
        {board.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-dim">
            {live ? "Nothing yet. Drinks logged now land here." : "No drinks in this sesh."}
          </p>
        ) : (
          <Leaderboard rows={board} meId={me.id} />
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold">Drinks</h2>
        <Feed
          items={items}
          meId={me.id}
          groupId={group.id}
          isOwner={isOwner}
          seshes={seshOptions}
          showSesh={false}
          empty="No drinks in this sesh yet."
        />
      </section>

      {isOwner && (
        <>
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-display text-lg font-semibold">Add drinks to this sesh</h2>
              <p className="text-xs text-muted">Owner only. Drinks from the last 2 weeks that aren’t in any sesh yet.</p>
            </div>
            <DrinkPicker groupId={group.id} seshId={sesh.id} items={loose} />
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-display text-lg font-semibold">Manage sesh</h2>
            <RenameSeshForm groupId={group.id} seshId={sesh.id} name={sesh.name} />
            <ConfirmButton
              action={deleteSesh.bind(null, group.id, sesh.id)}
              confirm={`Delete ${sesh.name}? Drinks stay on everyone’s record, just not in a sesh.`}
            >
              Delete sesh
            </ConfirmButton>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-3 text-center">
      <p className="font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-dim">{label}</p>
    </div>
  );
}
