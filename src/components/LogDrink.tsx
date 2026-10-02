"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { deleteDrink, logDrink, type LogResult } from "@/app/actions";
import { formatUnits, type DrinkOption } from "@/lib/drinks";

const TOAST_MS = 6000;

export type LogForOption = { userId: string; name: string };

export function LogDrink({
  groupId,
  options,
  meId,
  members = [],
  tonight,
  countLabel = "You tonight",
}: {
  groupId: string;
  /** The group's drink buttons (visible built-ins + owner-added) */
  options: DrinkOption[];
  meId: string;
  /** Set for group owners: people they can log on behalf of */
  members?: LogForOption[];
  tonight: number;
  countLabel?: string;
}) {
  const [forUserId, setForUserId] = useState(meId);
  const [qty, setQty] = useState(1);
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [result, setResult] = useState<LogResult>();
  const [dismissedAt, setDismissedAt] = useState<number>();
  const [undoing, startUndo] = useTransition();
  const [undone, setUndone] = useState<string>();
  const [, startLog] = useTransition();

  // Taps show up immediately, even on bad pub wifi; the real numbers replace
  // these once the server confirms and the page data refreshes.
  const [shownCount, addToCount] = useOptimistic(tonight, (count, n: number) => count + n);
  const [inFlight, addInFlight] = useOptimistic<string[], string>([], (list, label) => [...list, label]);

  function log(option: DrinkOption) {
    const form = new FormData();
    form.set("groupId", groupId);
    form.set("forUserId", forUserId);
    form.set("type", option.key);
    form.set("quantity", String(qty));
    form.set("note", note);
    // datetime-local has no zone; convert in the browser so the server gets an absolute time
    form.set("drunkAt", when ? new Date(when).toISOString() : "");
    const forName = forUserId === meId ? "" : ` for ${members.find((m) => m.userId === forUserId)?.name ?? "them"}`;
    const label = `${qty > 1 ? `${qty}× ` : ""}${option.label} ${option.emoji}${forName}`;
    // Only your own drinks move your count
    const sentQty = forUserId === meId ? qty : 0;

    // Reset straight away so the next tap starts clean
    setQty(1);
    setNote("");
    setWhen("");
    setShowMore(false);

    startLog(async () => {
      addToCount(sentQty);
      addInFlight(label);
      const r = await logDrink(undefined, form).catch(() => ({ error: "Couldn’t log that, check your signal" }));
      setResult(r);
    });
  }

  const toastVisible = inFlight.length > 0 || Boolean(result?.loggedId && result.at !== dismissedAt);
  useEffect(() => {
    if (!result?.at) return;
    const t = setTimeout(() => setDismissedAt(result.at), TOAST_MS);
    return () => clearTimeout(t);
  }, [result?.at]);

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Log a drink</h2>
        <p className="text-sm text-muted">
          {countLabel}: <span className="font-semibold text-foam">{shownCount}</span>
        </p>
      </div>

      {members.length > 1 && (
        <label className="mb-3 flex items-center gap-3 text-sm">
          <span className="shrink-0 text-muted">Logging for</span>
          <select
            value={forUserId}
            onChange={(e) => setForUserId(e.target.value)}
            className={`input py-2 ${forUserId === meId ? "" : "border-foam text-foam"}`}
            aria-label="Logging for"
          >
            {[...members]
              .sort((x, y) => (x.userId === meId ? -1 : y.userId === meId ? 1 : x.name.localeCompare(y.name)))
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === meId ? "Me" : m.name}
                </option>
              ))}
          </select>
        </label>
      )}

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
        {options.map((d) => (
          <button
            key={d.key}
            type="button"
            value={d.key}
            onClick={() => log(d)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-bg px-1 py-2.5 transition hover:border-foam/60 hover:bg-card-hi active:animate-pop"
          >
            <span className="text-2xl leading-none sm:text-3xl">{d.emoji}</span>
            <span className="mt-1 w-full text-center text-xs leading-tight font-medium text-balance break-words sm:text-sm">
              {d.label}
            </span>
            <span className="text-[11px] text-dim">{formatUnits(d.units * qty)}u</span>
          </button>
        ))}
      </div>

      {result?.error && inFlight.length === 0 && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {result.error}
        </p>
      )}

      {toastVisible && (
        <div
          role="status"
          className="animate-slide-up fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-foam/40 bg-card-hi px-4 py-3 shadow-2xl shadow-black/60"
        >
          {inFlight.length > 0 ? (
            <span className="text-sm">
              Logging {inFlight.at(-1)}
              {inFlight.length > 1 && <span className="text-muted"> (+{inFlight.length - 1} more)</span>}…
            </span>
          ) : (
            result?.loggedId && (
              <>
                <span className="text-sm">{undone === result.loggedId ? "Removed" : `Logged ${result.label}`}</span>
                {undone !== result.loggedId && (
                  <button
                    type="button"
                    disabled={undoing}
                    className="text-sm font-semibold text-foam hover:underline"
                    onClick={() => {
                      const id = result.loggedId!;
                      startUndo(async () => {
                        await deleteDrink(id, groupId);
                        setUndone(id);
                      });
                    }}
                  >
                    Undo
                  </button>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
