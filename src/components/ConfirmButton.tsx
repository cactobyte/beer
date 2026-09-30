"use client";

import { useTransition } from "react";

/** Button that runs a server action after a confirm() prompt. */
export function ConfirmButton({
  action,
  confirm: message,
  children,
  className = "btn btn-danger",
}: {
  action: () => Promise<void>;
  confirm?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (message && !window.confirm(message)) return;
        start(() => action());
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
