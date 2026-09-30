import type { FormState } from "@/lib/validation";

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="text-sm text-emerald-400">
        {state.ok}
      </p>
    );
  return null;
}
