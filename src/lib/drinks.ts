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
  mixer: { label: "Mixer", emoji: "🧊", units: 1.0 },
  // Single 25ml vodka
  vodka_redbull: { label: "Vodka RB", emoji: "⚡", units: 1.0 },
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

// How a single one reads in a sentence ("Dave had …"), where "a" + lowercase label doesn't work
const PHRASES: Partial<Record<DrinkType, string>> = {
  asahi: "an Asahi",
  vodka_redbull: "a vodka Red Bull",
  other: "something else",
};

/** "a pint", "an Asahi", "3× shot" */
export function drinkPhrase(type: string, quantity: number) {
  const info = drinkInfo(type);
  if (quantity > 1) return `${quantity}× ${info.label.toLowerCase()}`;
  return PHRASES[type as DrinkType] ?? `a ${info.label.toLowerCase()}`;
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
