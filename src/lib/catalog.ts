import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BUILTIN_OPTIONS, CUSTOM_KEY_RE, DRINK_TYPES, customDrinkKey, isBuiltinDrink, type DrinkOption } from "./drinks";

/** What a group's log-a-drink grid shows: visible built-ins, then the owner's own drinks. */
export async function getGroupCatalog(groupId: string) {
  const [[group], customs] = await Promise.all([
    db.select({ hidden: schema.groups.hiddenDrinks }).from(schema.groups).where(eq(schema.groups.id, groupId)),
    db
      .select()
      .from(schema.groupDrinks)
      .where(eq(schema.groupDrinks.groupId, groupId))
      .orderBy(asc(schema.groupDrinks.createdAt)),
  ]);
  const hidden = new Set(group?.hidden ?? []);
  const customOptions: DrinkOption[] = customs.map((c) => ({
    key: customDrinkKey(c.id),
    label: c.label,
    emoji: c.emoji,
    units: c.units,
    custom: true,
  }));
  return {
    options: [...BUILTIN_OPTIONS.filter((o) => !hidden.has(o.key)), ...customOptions],
    hidden: [...hidden],
    customs,
  };
}

export type ResolvedDrink = { units: number; label: string | null; emoji: string | null; display: string };

/**
 * Per-drink units and frozen name for a drink type. Custom drinks must belong
 * to `groupId`; without a group only built-ins resolve.
 */
export async function resolveDrinkType(type: string, groupId?: string): Promise<ResolvedDrink | null> {
  if (isBuiltinDrink(type)) {
    const d = DRINK_TYPES[type];
    return { units: d.units, label: null, emoji: null, display: `${d.label} ${d.emoji}` };
  }
  const match = CUSTOM_KEY_RE.exec(type);
  if (!match || !groupId) return null;
  const [c] = await db
    .select()
    .from(schema.groupDrinks)
    .where(and(eq(schema.groupDrinks.id, match[1]), eq(schema.groupDrinks.groupId, groupId)))
    .limit(1);
  return c ? { units: c.units, label: c.label, emoji: c.emoji, display: `${c.label} ${c.emoji}` } : null;
}
