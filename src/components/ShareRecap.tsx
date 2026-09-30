"use client";

import { useState } from "react";

/** Shares the recap image through the phone's share sheet (Instagram, WhatsApp…), or opens it. */
export function ShareRecap({ url, name }: { url: string; name: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "sesh"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
      } else {
        window.open(url, "_blank");
      }
    } catch {
      // share sheet dismissed
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} className="btn btn-primary">
      {busy ? "…" : "Share recap 📸"}
    </button>
  );
}
