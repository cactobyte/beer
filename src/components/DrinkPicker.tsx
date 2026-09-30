"use client";

import { useState, useTransition } from "react";
import { assignDrinks } from "@/app/actions";
import { drinkInfo } from "@/lib/drinks";
import { timeAgo } from "@/lib/time";

type Item = { id: string; type: string; quantity: number; drunkAt: Date; displayName: string; note: string | null };

/** Owner tool: tick drinks and add them to a sesh in one go. */
export function DrinkPicker({ groupId, seshId, items }: { groupId: string; seshId: string; items: Item[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  if (items.length === 0) return <p className="px-4 py-4 text-sm text-dim">No loose drinks from the last 2 weeks.</p>;

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-sm">
        <button
          type="button"
          className="text-muted hover:text-ink"
          onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
        >
          {picked.size === items.length ? "Clear" : "Select all"}
        </button>
        <button
          type="button"
          disabled={picked.size === 0 || pending}
          className="btn btn-primary px-3 py-1.5 text-sm"
          onClick={() =>
            start(async () => {
              await assignDrinks(groupId, seshId, [...picked]);
              setPicked(new Set());
            })
          }
        >
          {pending ? "Adding…" : `Add ${picked.size || ""} to this sesh`}
        </button>
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {items.map((d) => {
          const info = drinkInfo(d.type);
          return (
            <li key={d.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-card-hi">
                <input
                  type="checkbox"
                  checked={picked.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="size-4 accent-[var(--color-foam)]"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{d.displayName}</span> · {d.quantity > 1 ? `${d.quantity}× ` : ""}
                  {info.label} {info.emoji}
                  {d.note && <span className="text-muted"> “{d.note}”</span>}
                </span>
                <span className="shrink-0 text-xs text-dim">{timeAgo(d.drunkAt)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
