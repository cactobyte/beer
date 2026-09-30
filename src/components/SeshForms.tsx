"use client";

import { useActionState } from "react";
import { renameSesh, startSesh } from "@/app/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function StartSeshForm({ groupId, live }: { groupId: string; live: boolean }) {
  const [state, action] = useActionState(startSesh.bind(null, groupId), undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="name"
          className="input flex-1"
          placeholder={live ? "Next stop, e.g. Spoons" : "e.g. The restaurant"}
          maxLength={40}
          required
          aria-label="Sesh name"
        />
        <SubmitButton pendingText="…" className="btn btn-primary shrink-0">
          {live ? "Next sesh" : "Start sesh"}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RenameSeshForm({ groupId, seshId, name }: { groupId: string; seshId: string; name: string }) {
  const [state, action] = useActionState(renameSesh.bind(null, groupId, seshId), undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="name" defaultValue={name} className="input flex-1" maxLength={40} required aria-label="Sesh name" />
        <SubmitButton pendingText="…" className="btn btn-ghost shrink-0">
          Rename
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
