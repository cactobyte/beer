import Link from "next/link";
import { drinkDisplay, drinkPhrase, formatUnits, type DrinkOption } from "@/lib/drinks";
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
  options,
  showSesh = true,
  empty = "No drinks logged yet. Be the first.",
}: {
  items: FeedItem[];
  meId: string;
  groupId: string;
  isOwner?: boolean;
  seshes?: SeshOption[];
  /** The group's drink catalogue, for changing a drink's type */
  options?: DrinkOption[];
  showSesh?: boolean;
  empty?: string;
}) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-dim">{empty}</p>;

  return (
    <HideableRows>
      <ul className="divide-y divide-line">
        {items.map((d) => {
          const info = drinkDisplay({ type: d.type, label: d.label, emoji: d.drinkEmoji });
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
                  <span className="text-muted">had</span> {drinkPhrase(d)} {info.emoji}
                </p>
                {(d.note || d.loggedByName || (showSesh && d.seshId)) && (
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
                    {d.loggedByName && <span className="shrink-0 text-dim">added by {d.loggedByName}</span>}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-right text-xs text-dim">
                {timeAgo(d.drunkAt)}
                <span className="block">{formatUnits(d.units)}u</span>
              </span>
              {(d.userId === meId || isOwner) && (
                <DrinkMenu
                  drink={d}
                  groupId={groupId}
                  isOwner={isOwner}
                  seshes={seshes}
                  currentSeshId={d.seshId}
                  options={options}
                />
              )}
            </HideableRow>
          );
        })}
      </ul>
    </HideableRows>
  );
}
