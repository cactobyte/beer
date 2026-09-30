import Link from "next/link";
import { formatUnits } from "@/lib/drinks";
import type { LeaderboardRow } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";

const MEDALS = ["🥇", "🥈", "🥉"];
const RING = ["ring-gold", "ring-silver", "ring-bronze"];

export function Leaderboard({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  const anyDrinks = rows.some((r) => r.drinks > 0);
  // Standard competition ranking: ties share a place (1, 2, 2, 4)
  const ranks = rows.map((r) => rows.findIndex((o) => o.drinks === r.drinks && o.units === r.units) + 1);

  return (
    <ol className="divide-y divide-line">
      {rows.map((r, i) => {
        const rank = ranks[i];
        const podium = anyDrinks && r.drinks > 0 && rank <= 3;
        const isMe = r.userId === meId;
        return (
          <li key={r.userId} className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-foam/5" : ""}`}>
            <span className="w-7 text-center font-display text-lg font-semibold text-muted tabular-nums">
              {podium ? MEDALS[rank - 1] : rank}
            </span>
            <Link href={`/u/${r.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className={podium ? `rounded-full ring-2 ${RING[rank - 1]}` : ""}>
                <Avatar emoji={r.emoji} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {r.displayName}
                  {isMe && <span className="ml-1.5 text-xs font-normal text-foam">you</span>}
                </span>
                <span className="block truncate text-xs text-dim">
                  {r.lastDrinkAt ? `last drink ${timeAgo(r.lastDrinkAt)}` : "nothing yet"}
                </span>
              </span>
            </Link>
            <span className="text-right">
              <span className="block font-display text-2xl font-extrabold tabular-nums">{r.drinks}</span>
              <span className="block text-xs text-dim tabular-nums">{formatUnits(r.units)} units</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
