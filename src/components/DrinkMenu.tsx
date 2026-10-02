"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { assignDrinks, deleteDrink, editDrink } from "@/app/actions";
import { BUILTIN_OPTIONS, drinkDisplay, type DrinkOption } from "@/lib/drinks";
import type { FormState } from "@/lib/validation";
import { FormMessage } from "./FormMessage";
import { useHideRow } from "./HideableRows";
import { SubmitButton } from "./SubmitButton";

export type SeshOption = { id: string; name: string };

type Props = {
  drink: {
    id: string;
    type: string;
    label?: string | null;
    drinkEmoji?: string | null;
    quantity: number;
    note: string | null;
    drunkAt: Date | string;
    displayName: string;
  };
  /** Group context; needed for owner powers and sesh moves */
  groupId?: string;
  /** Owner of the group: can move drinks between seshes */
  isOwner?: boolean;
  seshes?: SeshOption[];
  currentSeshId?: string | null;
  /** Drinks to choose from when changing type; defaults to the built-ins */
  options?: DrinkOption[];
};

/** Value for <input type="datetime-local"> in the viewer's own timezone. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DrinkMenu({ drink, groupId, isOwner, seshes = [], currentSeshId, options = BUILTIN_OPTIONS }: Props) {
  // Keep the drink's own type selectable even if it's hidden or from another group
  const choices = options.some((o) => o.key === drink.type)
    ? options
    : [
        {
          key: drink.type,
          units: 0,
          custom: true,
          ...drinkDisplay({ type: drink.type, label: drink.label, emoji: drink.drinkEmoji }),
        },
        ...options,
      ];
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = useHideRow();
  const [when, setWhen] = useState("");
  const [pending, start] = useTransition();
  const [state, action] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await editDrink(drink.id, groupId, prev, form);
    if (result?.ok) {
      dialog.current?.close();
      return undefined;
    }
    return result;
  }, undefined);

  function open() {
    setWhen(toLocalInput(new Date(drink.drunkAt)));
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Edit drink"
        className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-dim transition hover:bg-card-hi hover:text-ink"
      >
        ⋯
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink backdrop:bg-black/70"
      >
        <form action={action} className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Edit {drink.displayName}’s drink</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="text-muted hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <select name="type" defaultValue={drink.type} className="input" aria-label="Drink">
              {choices.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
            <input
              name="quantity"
              type="number"
              min={1}
              max={20}
              defaultValue={drink.quantity}
              className="input"
              aria-label="How many"
            />
          </div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="input"
            aria-label="When"
            required
          />
          <input type="hidden" name="drunkAt" value={when ? new Date(when).toISOString() : ""} />
          <input name="note" defaultValue={drink.note ?? ""} maxLength={140} placeholder="Note" className="input" />
          <FormMessage state={state} />
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>

        {isOwner && groupId && seshes.length > 0 && (
          <div className="space-y-2 border-t border-line p-5">
            <label className="label" htmlFor={`sesh-${drink.id}`}>
              Sesh
            </label>
            <select
              id={`sesh-${drink.id}`}
              className="input"
              defaultValue={currentSeshId ?? ""}
              disabled={pending}
              onChange={(e) => {
                const target = e.target.value || null;
                start(async () => {
                  await assignDrinks(groupId, target, [drink.id]);
                  dialog.current?.close();
                });
              }}
            >
              <option value="">Not in a sesh</option>
              {seshes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {pending && <p className="text-xs text-muted">Moving…</p>}
          </div>
        )}

        <div className="border-t border-line p-5">
          <button
            type="button"
            disabled={pending}
            className="btn btn-danger w-full"
            onClick={() => {
              if (!confirm("Delete this drink? It disappears from every leaderboard.")) return;
              // Gone immediately; comes back only if the server refuses
              dialog.current?.close();
              rows?.hide(drink.id);
              start(async () => {
                try {
                  await deleteDrink(drink.id, groupId);
                } catch {
                  rows?.show(drink.id);
                }
              });
            }}
          >
            Delete drink
          </button>
        </div>
      </dialog>
    </>
  );
}
