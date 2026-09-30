import { z } from "zod";
import { DRINK_TYPE_KEYS } from "./drinks";

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: letters, numbers, underscores");

export const displayName = z.string().trim().min(1, "Pick a name").max(30, "Max 30 characters");

export const password = z.string().min(8, "At least 8 characters").max(200);

export const groupName = z.string().trim().min(1, "Give it a name").max(40, "Max 40 characters");

export const timezone = z
  .string()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone");

export const logDrink = z.object({
  type: z.enum(DRINK_TYPE_KEYS as [string, ...string[]]),
  quantity: z.coerce.number().int().min(1).max(20),
  note: z
    .string()
    .trim()
    .max(140)
    .optional()
    .transform((v) => v || null),
  // ISO string from the browser; empty = now
  drunkAt: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return new Date();
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid time" });
        return z.NEVER;
      }
      const now = Date.now();
      if (d.getTime() > now + 5 * 60_000) {
        ctx.addIssue({ code: "custom", message: "Can't log drinks in the future" });
        return z.NEVER;
      }
      if (d.getTime() < now - 7 * 86_400_000) {
        ctx.addIssue({ code: "custom", message: "Can only backdate up to 7 days" });
        return z.NEVER;
      }
      return d;
    }),
});

export type FormState = { error?: string; ok?: string } | undefined;

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}
