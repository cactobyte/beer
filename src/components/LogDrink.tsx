"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { deleteDrink, logDrink, type LogResult } from "@/app/actions";
import { DRINK_TYPES, DRINK_TYPE_KEYS, formatUnits } from "@/lib/drinks";

const TOAST_MS = 6000;

export function LogDrink({ tonight }: { tonight: number }) {
  const [qty, setQty] = useState(1);
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [dismissedAt, setDismissedAt] = useState<number>();
  const [undoing, startUndo] = useTransition();
  const [undone, setUndone] = useState<string>();

  const [state, action, pending] = useActionState(async (prev: LogResult, form: FormData) => {
    const result = await logDrink(prev, form);
    if (result?.loggedId) {
      setQty(1);
      setNote("");
      setWhen("");
      setShowMore(false);
    }
    return result;
  }, undefined);

  const toastVisible = Boolean(state?.loggedId && state.at !== dismissedAt);
  useEffect(() => {
    if (!state?.at) return;
    const t = setTimeout(() => setDismissedAt(state.at), TOAST_MS);
    return () => clearTimeout(t);
  }, [state?.at]);

  // datetime-local has no zone; convert in the browser so the server gets an absolute time
  const drunkAtIso = when ? new Date(when).toISOString() : "";

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Log a drink</h2>
        <p className="text-sm text-muted">
          You tonight: <span className="font-semibold text-foam">{tonight}</span>
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="quantity" value={qty} />
        <input type="hidden" name="note" value={note} />
        <input type="hidden" name="drunkAt" value={drunkAtIso} />

        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm text-muted">How many</span>
          <div className="flex items-center rounded-xl border border-line bg-bg">
            <button
              type="button"
              className="px-3 py-1.5 text-lg text-muted hover:text-ink disabled:opacity-30"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Fewer"
            >
              −
            </button>
            <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
            <button
              type="button"
              className="px-3 py-1.5 text-lg text-muted hover:text-ink disabled:opacity-30"
              onClick={() => setQty((q) => Math.min(20, q + 1))}
              disabled={qty >= 20}
              aria-label="More"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="ml-auto text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {showMore ? "Fewer options" : "Note / earlier"}
          </button>
        </div>

        {showMore && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Note (optional)"
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <input
              className="input"
              type="datetime-local"
              aria-label="When"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {DRINK_TYPE_KEYS.map((key) => {
            const d = DRINK_TYPES[key];
            return (
              <button
                key={key}
                type="submit"
                name="type"
                value={key}
                disabled={pending}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-line bg-bg px-1 py-2.5 transition hover:border-foam/60 hover:bg-card-hi active:animate-pop disabled:opacity-60"
              >
                <span className="text-2xl leading-none sm:text-3xl">{d.emoji}</span>
                <span className="mt-1 w-full truncate text-center text-xs font-medium sm:text-sm">{d.label}</span>
                <span className="text-[11px] text-dim">{formatUnits(d.units * qty)}u</span>
              </button>
            );
          })}
        </div>
      </form>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      {toastVisible && state?.loggedId && (
        <div
          role="status"
          className="animate-slide-up fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-foam/40 bg-card-hi px-4 py-3 shadow-2xl shadow-black/60"
        >
          <span className="text-sm">
            {undone === state.loggedId ? "Removed" : `Logged ${state.label}`}
          </span>
          {undone !== state.loggedId && (
            <button
              type="button"
              disabled={undoing}
              className="text-sm font-semibold text-foam hover:underline"
              onClick={() => {
                const id = state.loggedId!;
                startUndo(async () => {
                  await deleteDrink(id);
                  setUndone(id);
                });
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </section>
  );
}
