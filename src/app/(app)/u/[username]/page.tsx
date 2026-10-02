import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { DrinkMenu } from "@/components/DrinkMenu";
import { HideableRow, HideableRows } from "@/components/HideableRows";
import { requireUser } from "@/lib/auth";
import { drinkDisplay, formatUnits } from "@/lib/drinks";
import { getUserByUsername, getUserHistory, getUserStats, sharesGroup } from "@/lib/queries";
import { timeAgo } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const me = await requireUser(`/u/${username}`);
  const user = await getUserByUsername(username);
  // Profiles are only visible to people you share a group with
  if (!user || !(await sharesGroup(me.id, user.id))) notFound();
  const isMe = user.id === me.id;

  const [stats, history] = await Promise.all([getUserStats(user.id), getUserHistory(user.id)]);
  const maxType = Math.max(1, ...stats.byType.map((t) => t.drinks));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar emoji={user.emoji} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight">{user.displayName}</h1>
          <p className="text-sm text-muted">
            @{user.username} · joined {user.createdAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
        </div>
        {isMe && (
          <Link href="/settings" className="btn btn-ghost shrink-0">
            Edit
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Drinks" value={stats.drinks} />
        <Stat label="Units" value={formatUnits(stats.units)} />
        <Stat label="Nights out" value={stats.nights} />
        <Stat
          label="Best night"
          value={stats.bestNight?.drinks ?? "–"}
          sub={
            stats.bestNight
              ? new Date(stats.bestNight.night).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })
              : undefined
          }
        />
      </div>

      {stats.byType.length > 0 && (
        <section className="card space-y-2.5 p-5">
          <h2 className="mb-1 font-display text-lg font-semibold">Drink of choice</h2>
          {stats.byType.map((t) => {
            const info = drinkDisplay(t);
            return (
              <div key={t.type} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center text-lg">{info.emoji}</span>
                <span className="w-28 shrink-0 truncate">{info.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg">
                  <span
                    className="block h-full rounded-full bg-foam"
                    style={{ width: `${(t.drinks / maxType) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-semibold tabular-nums">{t.drinks}</span>
              </div>
            );
          })}
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-dim">Clean record. For now.</p>
        ) : (
          <HideableRows>
            <ul className="divide-y divide-line">
              {history.map((d) => {
                const info = drinkDisplay(d);
                return (
                  <HideableRow key={d.id} id={d.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="text-xl">{info.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p>
                        {d.quantity > 1 ? `${d.quantity}× ` : ""}
                        {info.label} <span className="text-dim">· {formatUnits(d.units)}u</span>
                      </p>
                      {d.note && <p className="truncate text-xs text-muted">“{d.note}”</p>}
                    </div>
                    <span className="shrink-0 text-xs text-dim">{timeAgo(d.drunkAt)}</span>
                    {isMe && <DrinkMenu drink={{ ...d, displayName: user.displayName }} />}
                  </HideableRow>
                );
              })}
            </ul>
          </HideableRows>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
