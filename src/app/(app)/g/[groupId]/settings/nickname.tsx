"use client";

import { useActionState, useState } from "react";
import { setNickname } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

/** Owner tool: rename a member inside this group. */
export function NicknameEditor({
  groupId,
  userId,
  nickname,
  realName,
}: {
  groupId: string;
  userId: string;
  nickname: string | null;
  realName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: Parameters<typeof setNickname>[2], form: FormData) => {
    const result = await setNickname(groupId, userId, prev, form);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  if (!open)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-dim hover:text-ink">
          Rename
        </button>
        <FormMessage state={state} />
      </>
    );

  return (
    <form action={action} className="mt-2 w-full basis-full space-y-2">
      <div className="flex gap-2">
        <input
          name="nickname"
          defaultValue={nickname ?? ""}
          placeholder={realName}
          maxLength={30}
          autoFocus
          className="input flex-1 py-2"
          aria-label="Nickname"
        />
        <SubmitButton pendingText="…" className="btn btn-primary shrink-0 px-3 py-2 text-sm">
          Save
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost shrink-0 px-3 py-2 text-sm">
          Cancel
        </button>
      </div>
      <p className="text-xs text-dim">Shown instead of “{realName}” everywhere in this group. Leave blank to clear.</p>
      <FormMessage state={state} />
    </form>
  );
}
