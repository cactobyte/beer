"use client";

import { useActionState } from "react";
import { updateGroup } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function GroupSettingsForm({
  groupId,
  name,
  timezone,
  timezones,
}: {
  groupId: string;
  name: string;
  timezone: string;
  timezones: string[];
}) {
  const [state, action] = useActionState(updateGroup.bind(null, groupId), undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">Details</h2>
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" className="input" defaultValue={name} maxLength={40} required />
      </div>
      <div>
        <label className="label" htmlFor="timezone">
          Timezone
        </label>
        <select id="timezone" name="timezone" className="input" defaultValue={timezone}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-dim">“Tonight” resets at 6am in this timezone.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…" className="btn btn-primary">
        Save
      </SubmitButton>
    </form>
  );
}
