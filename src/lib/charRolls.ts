/**
 * Rzuty 2k10 na cechy i ich rozdzielenie (PG s. 33): w kolejnosci rzutow albo z zamiana.
 *
 * Ustawienia - tiers.json -> settings.charRolls (wszystkie opcjonalne):
 *   - clamp: [min, max] - wynik rzutu przycinany do przedzialu (np. [5, 17]),
 *   - orderShare: czesc BN, ktora zostawia rzuty w kolejnosci cech,
 *   - swaps: ile zamian maja pozostali (kazda zamiana przestawia 2 rzuty; brak = dowolne rozlozenie).
 * Bez ustawien: najwyzsze rzuty trafiaja do cech kluczowych archetypu (dowolne rozlozenie).
 */

import { chance, randInt, roll2k10, type Rng } from "./dice";
import * as gd from "./gameData";
import type { Attribute } from "./rules";

export interface CharRollSettings {
  clamp?: [number, number];
  orderShare?: number;
  swaps?: number;
}

function settings(): CharRollSettings {
  return gd.getSettings().charRolls ?? {};
}

/** Jeden rzut 2k10 (albo 11 +- spread dla stworzen o malym rozrzucie), przyciety do clamp. */
export function rollStat(rng: Rng, spread?: number, cfg: CharRollSettings = settings()): number {
  const raw = spread != null ? 11 + randInt(-spread, spread, rng) : roll2k10(rng);
  const [lo, hi] = cfg.clamp ?? [2, 20];
  return Math.min(hi, Math.max(lo, raw));
}

/**
 * Rozdziela rzuty na cechy `codes`: kolejnosc, zamiany albo najwyzsze do cech kluczowych.
 * free = rzuty bez ograniczen BN (pelne 2k10, dowolne rozlozenie) - opcja w formularzu.
 */
export function arrangeRolls(codes: Attribute[], keys: Attribute[], rng: Rng, spread?: number, free = false): Record<Attribute, number> {
  const cfg = free ? {} : settings();
  const out = {} as Record<Attribute, number>;
  const rolls = codes.map(() => rollStat(rng, spread, cfg));
  const keyCodes = keys.filter((k) => codes.includes(k));
  const ordered = cfg.orderShare != null && chance(cfg.orderShare, rng);
  if (ordered || cfg.swaps != null) {
    codes.forEach((c, i) => (out[c] = rolls[i]));
    if (ordered) return out;
    // Zamiany: najwyzszy rzut, ktory nie lezy jeszcze w cesze kluczowej, do kolejnej cechy kluczowej.
    for (let s = 0; s < cfg.swaps! && s < keyCodes.length; s++) {
      const target = keyCodes[s];
      const free = codes.filter((c) => !keyCodes.slice(0, s + 1).includes(c));
      const best = free.reduce((a, b) => (out[b] > out[a] ? b : a), free[0]);
      if (best && out[best] > out[target]) [out[best], out[target]] = [out[target], out[best]];
    }
    return out;
  }
  rolls.sort((a, b) => b - a);
  keyCodes.forEach((k, i) => (out[k] = rolls[i]));
  const rest = rolls.slice(keyCodes.length);
  for (const c of codes.filter((c) => !keyCodes.includes(c))) out[c] = rest.splice(Math.floor(rng() * rest.length), 1)[0];
  return out;
}
