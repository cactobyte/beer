"use client";

import { useActionState, useState } from "react";
import { changePassword, updateProfile } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { EMOJIS } from "@/lib/drinks";

export function ProfileForm({ displayName, emoji }: { displayName: string; emoji: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [picked, setPicked] = useState(emoji);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">Profile</h2>
      <div>
        <label className="label" htmlFor="displayName">
          Display name
        </label>
        <input id="displayName" name="displayName" className="input" defaultValue={displayName} maxLength={30} required />
      </div>
      <fieldset>
        <legend className="label">Avatar</legend>
        <input type="hidden" name="emoji" value={picked} />
        <div className="grid grid-cols-8 gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setPicked(e)}
              aria-pressed={picked === e}
              className={`aspect-square rounded-xl border text-2xl transition ${
                picked === e ? "border-foam bg-foam/10" : "border-line bg-bg hover:bg-card-hi"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…" className="btn btn-primary">
        Save
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <input
        name="current"
        type="password"
        className="input"
        placeholder="Current password"
        autoComplete="current-password"
        required
      />
      <input
        name="password"
        type="password"
        className="input"
        placeholder="New password (8+ characters)"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…" className="btn btn-primary">
        Change password
      </SubmitButton>
      <p className="text-xs text-dim">This logs you out everywhere else.</p>
    </form>
  );
}
