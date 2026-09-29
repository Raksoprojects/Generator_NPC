/**
 * Wampiry (dodatek "Wampiry"): Linia Krwi z tabeli k100, szesc Slabosci tej linii,
 * Dary Krwi (glownie z listy linii) i Cecha Wiek zalezne od poziomu BN oraz
 * preferowane tradycje magii jako "Rzucanie Czarow".
 */

import { rollK100, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import type { Npc, NpcMutation } from "./types";

export function isVampire(npc: Pick<Npc, "creature">): boolean {
  return !!npc.creature && !!gd.getVampires()?.creatures.includes(npc.creature);
}

/** Linia Krwi, Slabosci, Dary Krwi (jako wpisy listy mutacji) oraz cechy Wiek i tradycje magii. */
export function rollVampire(
  npc: Npc,
  rng: Rng,
  deterministic = false,
  bloodline?: string
): { entries: NpcMutation[]; traits: string[] } {
  const data = gd.getVampires();
  if (!data || !isVampire(npc)) return { entries: [], traits: [] };
  const roll = deterministic ? 70 : rollK100(rng);
  const line =
    data.bloodlines.find((b) => b.name === bloodline) ??
    data.bloodlines.find((b) => roll >= b.min && roll <= b.max) ??
    data.bloodlines[0];
  const entries: NpcMutation[] = [{ kind: "bloodline", name: line.name }];
  for (const w of line.weaknesses) entries.push({ kind: "weakness", name: w });

  const count = data.giftsPerTier[npc.tier] ?? 3;
  const pool = data.gifts.filter((g) => line.gifts.includes(g.name) || g.recommended === "dowolna");
  const weight = (name: string) => (line.gifts.includes(name) ? data.bloodlineGiftWeight : 1);
  const chosen: string[] = [];
  for (let i = 0; i < count && chosen.length < pool.length; i++) {
    const left = pool.filter((g) => !chosen.includes(g.name));
    const g = deterministic ? left.sort((a, b) => weight(b.name) - weight(a.name))[0] : weightedPick(left, (x) => weight(x.name), rng);
    if (g) chosen.push(g.name);
  }
  for (const g of chosen) entries.push({ kind: "blood", name: g });

  const traits = [`Wiek (${data.ageByTier[npc.tier] ?? 3})`, "Klątwa Nocy"];
  for (const group of line.lores.split(/,\s*/)) traits.push(`Rzucanie Czarów (${group})`);
  return { entries, traits };
}
