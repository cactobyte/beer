"use client";

import { useEffect, useRef } from "react";

const FALLBACK_POLL_MS = 4000;

/**
 * Calls `onChange` as soon as anything in the group changes. Uses a pushed
 * event stream; falls back to polling if the stream isn't available.
 */
export function useGroupVersion(groupId: string, onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let last: number | null = null;
    let source: EventSource | null = null;
    let poller: ReturnType<typeof setInterval> | null = null;
    let failures = 0;
    let stopped = false;

    const seen = (v: number) => {
      if (last !== null && v !== last) callback.current();
      last = v;
    };

    async function pollOnce() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/groups/${groupId}/version`, { cache: "no-store" });
        if (res.ok) seen(((await res.json()) as { version: number }).version);
      } catch {
        // offline for a moment
      }
    }

    function startPolling() {
      source?.close();
      source = null;
      if (!poller) poller = setInterval(pollOnce, FALLBACK_POLL_MS);
      void pollOnce();
    }

    function connect() {
      if (stopped || typeof EventSource === "undefined") return startPolling();
      source = new EventSource(`/api/groups/${groupId}/events`);
      source.addEventListener("version", (e) => {
        failures = 0;
        seen(Number((e as MessageEvent<string>).data));
      });
      source.addEventListener("unavailable", startPolling);
      source.onerror = () => {
        // EventSource retries by itself; give up on it after repeated failures
        if (++failures >= 5) startPolling();
      };
    }

    // Phones kill connections in the background; catch up on return
    const onVisible = () => {
      if (document.visibilityState === "visible") void pollOnce();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      source?.close();
      if (poller) clearInterval(poller);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [groupId]);
}
