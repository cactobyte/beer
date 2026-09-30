import Link from "next/link";
import { drinkInfo, formatUnits } from "@/lib/drinks";
import type { FeedItem } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";
import { DrinkMenu, type SeshOption } from "./DrinkMenu";
import { HideableRow, HideableRows } from "./HideableRows";

export function Feed({
  items,
  meId,
  groupId,
  isOwner = false,
  seshes = [],
  showSesh = true,
  empty = "No drinks logged yet. Be the first.",
}: {
  items: FeedItem[];
  meId: string;
  groupId: string;
  isOwner?: boolean;
  seshes?: SeshOption[];
  showSesh?: boolean;
  empty?: string;
}) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-dim">{empty}</p>;

  return (
    <HideableRows>
      <ul className="divide-y divide-line">
        {items.map((d) => {
          const info = drinkInfo(d.type);
          return (
            <HideableRow key={d.id} id={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/u/${d.username}`} prefetch={false}>
                <Avatar emoji={d.emoji} size="sm" />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">
                  <Link href={`/u/${d.username}`} prefetch={false} className="font-semibold hover:underline">
                    {d.displayName}
                  </Link>{" "}
                  <span className="text-muted">had</span> {d.quantity > 1 ? `${d.quantity}× ` : "a "}
                  {info.label.toLowerCase()} {info.emoji}
                </p>
                {(d.note || (showSesh && d.seshId)) && (
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    {showSesh && d.seshId && (
                      <Link
                        href={`/g/${groupId}/s/${d.seshId}`}
                        prefetch={false}
                        className="shrink-0 rounded-full bg-foam/10 px-1.5 py-px font-medium text-foam hover:bg-foam/20"
                      >
                        {d.seshName}
                      </Link>
                    )}
                    {d.note && <span className="truncate">“{d.note}”</span>}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-right text-xs text-dim">
                {timeAgo(d.drunkAt)}
                <span className="block">{formatUnits(d.units)}u</span>
              </span>
              {(d.userId === meId || isOwner) && (
                <DrinkMenu drink={d} groupId={groupId} isOwner={isOwner} seshes={seshes} currentSeshId={d.seshId} />
              )}
            </HideableRow>
          );
        })}
      </ul>
    </HideableRows>
  );
}
