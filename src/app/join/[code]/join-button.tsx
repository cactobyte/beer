"use client";

import { useActionState } from "react";
import { joinGroup } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function JoinButton({ code }: { code: string }) {
  const [state, action] = useActionState(joinGroup, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Joining…">Join group</SubmitButton>
    </form>
  );
}
