"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Ctx = { hidden: Set<string>; hide: (id: string) => void; show: (id: string) => void };

const HiddenRows = createContext<Ctx | null>(null);

/** Lets a row vanish the instant it's deleted, before the server confirms. */
export function HideableRows({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = useCallback((id: string) => setHidden((h) => new Set(h).add(id)), []);
  const show = useCallback(
    (id: string) =>
      setHidden((h) => {
        const next = new Set(h);
        next.delete(id);
        return next;
      }),
    [],
  );
  return <HiddenRows.Provider value={{ hidden, hide, show }}>{children}</HiddenRows.Provider>;
}

export function HideableRow({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(HiddenRows);
  if (ctx?.hidden.has(id)) return null;
  return <li className={className}>{children}</li>;
}

export function useHideRow() {
  return useContext(HiddenRows);
}
