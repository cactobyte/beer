"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { addGroupDrink, deleteGroupDrink, setBuiltinHidden, updateGroupDrink } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { BUILTIN_OPTIONS, formatUnits } from "@/lib/drinks";
import type { FormState } from "@/lib/validation";

type Custom = { id: string; label: string; emoji: string; units: number };

/** Owner tool: choose which built-in drinks show, and add the group's own. */
export function DrinksManager({ groupId, hidden, customs }: { groupId: string; hidden: string[]; customs: Custom[] }) {
  const [, start] = useTransition();
  const [shownHidden, toggleHidden] = useOptimistic(new Set(hidden), (set, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Drinks</h2>
        <p className="text-sm text-muted">
          What shows on everyone’s log buttons in this group. Changes only affect new logs; past drinks keep their name
          and units.
        </p>
      </div>

      <div>
        <h3 className="label">Built-in · tap to hide or show</h3>
        <div className="flex flex-wrap gap-2">
          {BUILTIN_OPTIONS.map((d) => {
            const off = shownHidden.has(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  start(async () => {
                    toggleHidden(d.key);
                    await setBuiltinHidden(groupId, d.key, !off);
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  off ? "border-line text-dim line-through opacity-60" : "border-foam/40 bg-foam/10 text-ink"
                }`}
              >
                {d.emoji} {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="label">Your drinks</h3>
        {customs.length === 0 ? (
          <p className="text-sm text-dim">None yet. Add your local’s specials below.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {customs.map((c) => (
              <CustomRow key={c.id} groupId={groupId} drink={c} />
            ))}
          </ul>
        )}
      </div>

      <AddDrinkForm groupId={groupId} />
    </section>
  );
}

function DrinkFields({ drink }: { drink?: Custom }) {
  return (
    <div className="grid grid-cols-[4rem_1fr_5.5rem] gap-2">
      <input
        name="emoji"
        defaultValue={drink?.emoji}
        placeholder="🍹"
        maxLength={16}
        required
        className="input px-2 text-center text-xl"
        aria-label="Emoji"
      />
      <input
        name="label"
        defaultValue={drink?.label}
        placeholder="Name"
        maxLength={24}
        required
        className="input"
        aria-label="Name"
      />
      <input
        name="units"
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0.1"
        max="20"
        defaultValue={drink?.units}
        placeholder="Units"
        required
        className="input"
        aria-label="Units per drink"
      />
    </div>
  );
}

function AddDrinkForm({ groupId }: { groupId: string }) {
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await addGroupDrink(groupId, prev, form);
    // Clear the fields after a successful add
    if (result?.ok) setFormKey((k) => k + 1);
    return result;
  }, undefined);

  return (
    <form key={formKey} action={action} className="space-y-2 rounded-xl border border-dashed border-line p-3">
      <h3 className="text-sm font-semibold">Add a drink</h3>
      <DrinkFields />
      <p className="text-xs text-dim">
        Units per drink: pint of 4% ≈ 2.3 · single spirit 1 · large wine 3 · can of 4.5% ≈ 2
      </p>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…" className="btn btn-primary w-full">
        Add drink
      </SubmitButton>
    </form>
  );
}

function CustomRow({ groupId, drink }: { groupId: string; drink: Custom }) {
  const [editing, setEditing] = useState(false);
  const [removing, startRemove] = useTransition();
  const [state, action] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await updateGroupDrink(groupId, drink.id, prev, form);
    if (result?.ok) setEditing(false);
    return result;
  }, undefined);

  if (editing)
    return (
      <li className="p-3">
        <form action={action} className="space-y-2">
          <DrinkFields drink={drink} />
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton pendingText="Saving…" className="btn btn-primary flex-1">
              Save
            </SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${removing ? "opacity-40" : ""}`}>
      <span className="text-2xl">{drink.emoji}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{drink.label}</span>
      <span className="shrink-0 text-sm text-dim">{formatUnits(drink.units)}u</span>
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted hover:text-ink">
        Edit
      </button>
      <button
        type="button"
        disabled={removing}
        onClick={() => {
          if (confirm(`Delete ${drink.label}? Drinks already logged keep it.`))
            startRemove(() => deleteGroupDrink(groupId, drink.id));
        }}
        className="text-xs text-dim hover:text-danger"
      >
        Delete
      </button>
    </li>
  );
}
