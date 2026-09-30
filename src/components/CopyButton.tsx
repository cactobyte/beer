"use client";

import { useState } from "react";

/** Copies `text` (resolved against the current origin if it's a path), or opens the share sheet on phones. */
export function CopyButton({ text, label = "Copy", share = false }: { text: string; label?: string; share?: boolean }) {
  const [done, setDone] = useState(false);

  async function onClick() {
    const value = text.startsWith("/") ? `${location.origin}${text}` : text;
    if (share && navigator.share) {
      try {
        await navigator.share({ title: "Join my Sesh group", url: value });
        return;
      } catch {
        // cancelled — fall through to copy
      }
    }
    await navigator.clipboard.writeText(value);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button type="button" onClick={onClick} className="btn btn-ghost">
      {done ? "Copied ✓" : label}
    </button>
  );
}
