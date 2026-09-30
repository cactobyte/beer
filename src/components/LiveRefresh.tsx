"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_MS = 3000;

/**
 * Keeps a group page live: polls the group's change counter while the tab is
 * visible and re-renders the page's server data as soon as it moves.
 */
export function LiveRefresh({ groupId }: { groupId: string }) {
  const router = useRouter();
  const last = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    async function check() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const res = await fetch(`/api/groups/${groupId}/version`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: number };
        if (last.current !== null && version !== last.current) router.refresh();
        last.current = version;
      } catch {
        // offline for a moment; next tick retries
      } finally {
        inFlight = false;
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [groupId, router]);

  return null;
}
