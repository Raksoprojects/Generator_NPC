/**
 * Wampiry (dodatek "Wampiry"): Linia Krwi z tabeli k100, szesc Slabosci tej linii,
 * Dary Krwi (glownie z listy linii) i Cecha Wiek zalezne od poziomu BN oraz
 * preferowane tradycje magii jako "Rzucanie Czarow" (jedna z alternatyw).
 * Wampir to istota rozumna: rozwija sie przez profesje wg Preferowanych Profesji
 * linii, a Splatanie i Jezyk (Magiczny) ma tym wyzsze, im linia bardziej sklonna do czarow.
 */

import { pick, randInt, rollK100, weightedKey, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import type { Npc, NpcMutation, VampiresData } from "./types";

export function isVampire(npc: Pick<Npc, "creature">): boolean {
  return !!npc.creature && !!gd.getVampires()?.creatures.includes(npc.creature);
}

type Bloodline = VampiresData["bloodlines"][number];

export function findBloodline(name: string | undefined): Bloodline | undefined {
  return gd.getVampires()?.bloodlines.find((b) => b.name === name);
}

/** Linia Krwi z tabeli k100 (albo wybrana). */
export function rollBloodline(rng: Rng, deterministic = false, chosen?: string): string | undefined {
  const data = gd.getVampires();
  if (!data) return undefined;
  if (findBloodline(chosen)) return chosen;
  const roll = deterministic ? 70 : rollK100(rng);
  return (data.bloodlines.find((b) => roll >= b.min && roll <= b.max) ?? data.bloodlines[0]).name;
}

export function npcBloodline(npc: Npc): Bloodline | undefined {
  return findBloodline(npc.mutations?.find((m) => m.kind === "bloodline")?.name);
}

/** Archetyp wampira wg Preferowanych Profesji jego linii. */
export function vampireArchetype(bloodline: string | undefined, rng: Rng, deterministic = false): string | undefined {
  const weights = findBloodline(bloodline)?.archetypes;
  if (!weights) return undefined;
  return deterministic ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0] : weightedKey(weights, rng);
}

/**
 * Tradycje linii, np. "Śmierci, Ognia, Metalu albo Cieni, Nekromancja": kolory to
 * jedna grupa wyboru, a czesc z Nekromancja/Czarownictwem - druga.
 */
function loreChoices(lores: string, rng: Rng, deterministic: boolean): string[] {
  const parts = lores.split(/,\s*/);
  const dark = parts.findIndex((p) => /Nekromancj|Czarownictw/.test(p));
  const colours = (dark >= 0 ? parts.slice(0, dark) : parts).flatMap((p) => p.split(/\s+albo\s+|\s+lub\s+/)).filter(Boolean);
  const darkOpts = dark >= 0 ? parts.slice(dark).join(", ").split(/\s+albo\s+|\s+lub\s+|,\s*/).filter(Boolean) : [];
  const choose = (opts: string[]) => (deterministic ? opts[0] : pick(opts, rng));
  return [choose(colours), choose(darkOpts)].filter((x): x is string => !!x);
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
  const line = findBloodline(rollBloodline(rng, deterministic, bloodline))!;
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
  for (const lore of loreChoices(line.lores, rng, deterministic)) traits.push(`Rzucanie Czarów (${lore})`);
  return { entries, traits };
}

/**
 * Wampir zna podstawy Dhar: Splatanie Magii (Dhar) i Jezyk (Magiczny). Rozwiniecia rosna
 * z poziomem i zamilowaniem linii do czarow - Nekrarcha jest mistrzem, Strigoi ledwie czaruje.
 */
export function addVampireMagic(npc: Npc, rng: Rng, deterministic = false): void {
  const data = gd.getVampires();
  const line = npcBloodline(npc);
  if (!data || !line || !isVampire(npc)) return;
  const base = (data.magicAdvances?.[npc.tier] ?? 10) * ((line.magic ?? 1) / 2);
  for (const name of ["Splatanie Magii (Dhar)", "Język (Magiczny)"]) {
    const value = Math.max(1, Math.round(base + (deterministic ? 0 : randInt(-2, 2, rng))));
    const owned = npc.skills.find((s) => s.name === name);
    if (owned) owned.advances = Math.max(owned.advances, value);
    else npc.skills.push({ name, advances: value });
  }
}
