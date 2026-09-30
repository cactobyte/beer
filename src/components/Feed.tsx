import Link from "next/link";
import { drinkInfo, formatUnits } from "@/lib/drinks";
import type { FeedItem } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";
import { DeleteDrinkButton } from "./DeleteDrinkButton";

export function Feed({ items, meId }: { items: FeedItem[]; meId: string }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-dim">No drinks logged yet. Be the first.</p>;

  return (
    <ul className="divide-y divide-line">
      {items.map((d) => {
        const info = drinkInfo(d.type);
        return (
          <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
            <Link href={`/u/${d.username}`}>
              <Avatar emoji={d.emoji} size="sm" />
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">
                <Link href={`/u/${d.username}`} className="font-semibold hover:underline">
                  {d.displayName}
                </Link>{" "}
                <span className="text-muted">had</span> {d.quantity > 1 ? `${d.quantity}× ` : "a "}
                {info.label.toLowerCase()} {info.emoji}
              </p>
              {d.note && <p className="truncate text-xs text-muted">“{d.note}”</p>}
            </div>
            <span className="shrink-0 text-right text-xs text-dim">
              {timeAgo(d.drunkAt)}
              <span className="block">{formatUnits(d.units)}u</span>
            </span>
            {d.userId === meId && <DeleteDrinkButton id={d.id} />}
          </li>
        );
      })}
    </ul>
  );
}
