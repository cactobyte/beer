"use client";

import { useEffect, useRef, useState } from "react";

type State = { status: "idle" } | { status: "loading" } | { status: "ready"; file: File; url: string } | { status: "error" };

/**
 * Two steps on purpose: phones only open the share sheet straight after a tap,
 * and on slow wifi the image takes longer than that allows. So the first tap
 * makes the image and shows it; the second shares or saves it.
 */
export function ShareRecap({ url, name }: { url: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const filename = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "sesh"}.png`;

  // Free the preview's memory when it's replaced or the page goes away
  useEffect(() => {
    if (state.status !== "ready") return;
    return () => URL.revokeObjectURL(state.url);
  }, [state]);

  async function open() {
    dialog.current?.showModal();
    setState({ status: "loading" });
    try {
      // Cache-bust so a recap made mid-sesh isn't reused later
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      setState({ status: "ready", file, url: URL.createObjectURL(blob) });
    } catch {
      setState({ status: "error" });
    }
  }

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch {
      // dismissed
    }
  }

  const canShareFiles =
    state.status === "ready" && typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [state.file] }));

  return (
    <>
      <button type="button" onClick={open} className="btn btn-primary">
        Share recap 📸
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink backdrop:bg-black/80"
      >
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recap</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-muted hover:text-ink" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="flex aspect-[9/16] max-h-[60dvh] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-bg">
            {state.status === "loading" && <p className="animate-pulse text-sm text-muted">Making your recap…</p>}
            {state.status === "error" && (
              <p className="px-6 text-center text-sm text-danger">Couldn’t make it. Check your signal and try again.</p>
            )}
            {state.status === "ready" && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing for next/image to optimise
              <img src={state.url} alt={`${name} recap`} className="h-full w-full object-contain" />
            )}
          </div>

          {state.status === "ready" && (
            <div className="grid gap-2">
              {canShareFiles && (
                <button type="button" onClick={() => share(state.file)} className="btn btn-primary">
                  Share to Instagram / WhatsApp
                </button>
              )}
              <a href={state.url} download={filename} className="btn btn-ghost">
                Save image
              </a>
              <p className="text-center text-xs text-dim">On iPhone you can also press and hold the image to save it.</p>
            </div>
          )}
          {state.status === "error" && (
            <button type="button" onClick={open} className="btn btn-primary w-full">
              Try again
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
