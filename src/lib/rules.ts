/**
 * Stale i czyste funkcje regul WFRP 4ed potrzebne generatorowi BN.
 */

/** Kolejnosc glownych cech postaci (kody jak w danych). */
export const ATTRIBUTES = ["WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

/** Pelne polskie nazwy cech (do dymkow i opisow). */
export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  WW: "Walka Wręcz",
  US: "Umiejętności Strzeleckie",
  S: "Siła",
  Wt: "Wytrzymałość",
  I: "Inicjatywa",
  Zw: "Zwinność",
  Zr: "Zręczność",
  Int: "Inteligencja",
  SW: "Siła Woli",
  Ogd: "Ogłada"
};

/** Mapa pelnych nazw cech (jak w professions.json) na kody. */
const NAME_TO_CODE: Record<string, Attribute> = Object.fromEntries(
  ATTRIBUTES.map((code) => [ATTRIBUTE_NAMES[code].toLowerCase(), code])
) as Record<string, Attribute>;

/** Kod cechy dla pelnej nazwy lub kodu; null dla nieznanych. */
export function characteristicToCode(name: string): Attribute | null {
  const raw = String(name ?? "").trim();
  if ((ATTRIBUTES as readonly string[]).includes(raw)) return raw as Attribute;
  return NAME_TO_CODE[raw.toLowerCase().split(/\s+/).join(" ")] ?? null;
}

/** Bonus z cechy = cyfra dziesiatek (np. 37 -> 3). */
export function characteristicBonus(value: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 10);
}

/**
 * Zywotnosc: BS + 2xBWt + BSW (Niziolek bez BS) + BWt za kazdy poziom
 * talentu Twardziel.
 */
export function computeWounds(
  strength: number,
  toughness: number,
  willpower: number,
  includeStrength: boolean,
  hardyLevels = 0
): number {
  const sb = includeStrength ? characteristicBonus(strength) : 0;
  const tb = characteristicBonus(toughness);
  return sb + 2 * tb + characteristicBonus(willpower) + hardyLevels * tb;
}
