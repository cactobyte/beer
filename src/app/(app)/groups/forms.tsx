"use client";

import { useActionState, useSyncExternalStore } from "react";
import { createGroup, joinGroup } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function JoinGroupForm() {
  const [state, action] = useActionState(joinGroup, undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-display text-lg font-semibold">Join a group</h2>
      <input
        name="code"
        className="input font-mono uppercase tracking-widest"
        placeholder="CODE"
        maxLength={6}
        autoCapitalize="characters"
        autoComplete="off"
        required
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Joining…">Join</SubmitButton>
    </form>
  );
}

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-display text-lg font-semibold">Start a group</h2>
      <input name="name" className="input" placeholder="e.g. The Lads, Uni Flat 12" maxLength={40} required />
      <TimezoneInput />
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create</SubmitButton>
    </form>
  );
}

/** Captures the creator's timezone so "tonight" rolls over at 6am local time. */
export function TimezoneInput() {
  const tz = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  return <input type="hidden" name="timezone" value={tz} />;
}

const noopSubscribe = () => () => {};
