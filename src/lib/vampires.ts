/**
 * Wampiry (dodatek "Wampiry"): Linia Krwi z tabeli k100, szesc Slabosci tej linii,
 * Dary Krwi (glownie z listy linii) i Cecha Wiek zalezne od poziomu BN oraz
 * preferowane tradycje magii jako "Rzucanie Czarow" (jedna z alternatyw).
 * Wampir to istota rozumna: rozwija sie przez profesje wg Preferowanych Profesji
 * linii, a Splatanie i Jezyk (Magiczny) ma tym wyzsze, im linia bardziej sklonna do czarow.
 */

import { chance, pick, randInt, rollK100, weightedKey, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import { TIER_IDS, type Npc, type NpcMutation, type VampiresData } from "./types";

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
  // Nie kazdy wampir czaruje: Nekrarcha zawsze, Lahmianka i von Carstein czesto, Krwawy Smok
  // dopiero od heroicznego, Strigoi rzadko od doswiadczonego (vampires.json -> casting).
  const p = line.casting ? (line.casting.chance[npc.tier] ?? 0) : 1;
  if (deterministic ? p >= 0.5 : chance(p, rng)) {
    for (const lore of loreChoices(line.casting?.lores ?? line.lores, rng, deterministic)) traits.push(`Rzucanie Czarów (${lore})`);
  }
  return { entries, traits };
}

/**
 * Rozwiniecia Splatania i Jezyka (Magicznego) czarujacego wampira: rosna z poziomem
 * i zamilowaniem linii do czarow, nie mniej niz minAdvances linii.
 */
export function vampireCasterAdvances(npc: Npc, rng: Rng, deterministic = false): number | undefined {
  const data = gd.getVampires();
  const line = npcBloodline(npc);
  if (!data || !line || !isVampire(npc)) return undefined;
  const base = (data.magicAdvances?.[npc.tier] ?? 10) * ((line.magic ?? 1) / 2);
  const value = Math.round(base + (deterministic ? 0 : randInt(-2, 2, rng)));
  return Math.max(1, line.casting?.minAdvances ?? 0, value);
}

/** Zasady czarowania linii wampira (limity zaklec, tylko bezposrednie). */
export function vampireCasting(npc: Npc) {
  return isVampire(npc) ? npcBloodline(npc)?.casting : undefined;
}

/** Profesje dozwolone linii (Strigoi: proste, dzikie); brak = wszystkie. */
export function vampireProfessions(npc: Npc): string[] | undefined {
  return isVampire(npc) ? npcBloodline(npc)?.professions : undefined;
}

/**
 * Linia bez pancerza (Strigoi to dzikie bestie): zdejmuje zwykly pancerz; magiczny
 * zostaje tylko od heroicznego poziomu.
 */
export function stripVampireArmour(npc: Npc): void {
  if (!isVampire(npc) || !npcBloodline(npc)?.noArmour) return;
  const heroic = TIER_IDS.indexOf(npc.tier) >= TIER_IDS.indexOf("heroiczny");
  const items = npc.magicItems ?? [];
  const isArmourItem = (base?: string) => base === "pancerz" || (!!base && npc.armour.includes(base));
  if (!heroic) npc.magicItems = items.filter((m) => !isArmourItem(m.base));
  const kept = heroic ? items.filter((m) => isArmourItem(m.base)) : [];
  const keep = new Set(kept.some((m) => m.base === "pancerz") ? npc.armour : kept.map((m) => m.base));
  for (const a of npc.armour) if (!keep.has(a) && npc.craft) delete npc.craft[a];
  npc.armour = npc.armour.filter((a) => keep.has(a));
}
