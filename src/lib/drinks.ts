// Drink catalogue. Units are UK standard alcohol units per single drink.
// Shared by server (to compute units on log) and client (to render buttons).
export const DRINK_TYPES = {
  pint: { label: "Pint", emoji: "🍺", units: 2.3 },
  bottle: { label: "Bottle", emoji: "🍻", units: 1.7 },
  // 330ml at 5%
  asahi: { label: "Asahi", emoji: "🇯🇵", units: 1.7 },
  cider: { label: "Cider", emoji: "🍏", units: 2.6 },
  wine: { label: "Wine", emoji: "🍷", units: 2.1 },
  fizz: { label: "Prosecco", emoji: "🥂", units: 1.5 },
  shot: { label: "Shot", emoji: "🥃", units: 1.0 },
  // Spirit and mixer: 25ml single / 50ml double at 40%
  mixer: { label: "Single mixer", emoji: "🧊", units: 1.0 },
  double_mixer: { label: "Double mixer", emoji: "🍹", units: 2.0 },
  cocktail: { label: "Cocktail", emoji: "🍸", units: 2.0 },
  seltzer: { label: "Seltzer", emoji: "🫧", units: 1.3 },
  soju: { label: "Soju", emoji: "🍶", units: 1.0 },
  other: { label: "Other", emoji: "🥤", units: 1.0 },
} as const;

export type DrinkType = keyof typeof DRINK_TYPES;

export const DRINK_TYPE_KEYS = Object.keys(DRINK_TYPES) as DrinkType[];

export function drinkInfo(type: string) {
  return DRINK_TYPES[type as DrinkType] ?? DRINK_TYPES.other;
}

export function isBuiltinDrink(type: string): type is DrinkType {
  return Object.hasOwn(DRINK_TYPES, type);
}

/** A button on the log-a-drink grid: a built-in, or one a group owner added ("c:<id>"). */
export type DrinkOption = { key: string; label: string; emoji: string; units: number; custom: boolean };

export const BUILTIN_OPTIONS: DrinkOption[] = DRINK_TYPE_KEYS.map((key) => ({ key, ...DRINK_TYPES[key], custom: false }));

export const customDrinkKey = (id: string) => `c:${id}`;
export const CUSTOM_KEY_RE = /^c:([0-9a-f-]{36})$/i;

/**
 * Name and emoji for a logged drink. Custom drinks carry their own (frozen at
 * log time); built-ins come from the catalogue.
 */
export function drinkDisplay(d: { type: string; label?: string | null; emoji?: string | null }) {
  if (d.label) return { label: d.label, emoji: d.emoji || "🥤" };
  const info = drinkInfo(d.type);
  return { label: info.label, emoji: info.emoji };
}

// How a single one reads in a sentence ("Dave had …"), where "a" + lowercase label doesn't work
const PHRASES: Partial<Record<DrinkType, string>> = {
  asahi: "an Asahi",
  other: "something else",
};

/** "a pint", "an Asahi", "3× shot", "a Jägerbomb" */
export function drinkPhrase(d: { type: string; label?: string | null; quantity: number }) {
  if (d.label) {
    // Owner-named drinks keep their capitalisation
    return d.quantity > 1 ? `${d.quantity}× ${d.label}` : `${/^[aeiou]/i.test(d.label) ? "an" : "a"} ${d.label}`;
  }
  const info = drinkInfo(d.type);
  if (d.quantity > 1) return `${d.quantity}× ${info.label.toLowerCase()}`;
  return PHRASES[d.type as DrinkType] ?? `a ${info.label.toLowerCase()}`;
}

export function formatUnits(units: number) {
  return units.toFixed(1).replace(/\.0$/, "");
}

export const PERIODS = {
  tonight: "Tonight",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
} as const;

export type Period = keyof typeof PERIODS;

export function parsePeriod(value: string | string[] | undefined): Period {
  return typeof value === "string" && value in PERIODS ? (value as Period) : "tonight";
}

export const EMOJIS = ["🍺", "🍷", "🥃", "🍸", "🍹", "🥂", "🍾", "🍶", "🧉", "🦄", "🐐", "🔥", "💀", "👑", "🤡", "🐸"];
