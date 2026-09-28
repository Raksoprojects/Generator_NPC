/**
 * Stworzenia z bestiariusza.
 *
 * Cechy: wartosc z ksiazki minus 10 to baza, do ktorej rzucamy 2k10 (jak dla
 * ras). Cecha o wartosci 5 lub mniejszej to po prostu 1k10. Brak cechy ("–")
 * zostaje brakiem. Statystyki ksiazkowe zawieraja juz Cechy Stworzen
 * stworzenia (np. Twardy trolla) - dodajemy tylko cechy wylosowane.
 *
 * Rozwoj bestii (bez profesji) - patrz creature_families.json:
 *   - slaby = profil z ksiazki + umiejetnosci rodziny; kazdy poziom wyzej +5 do cech i umiejetnosci,
 *   - umiejetnosci rodziny: premia = pasowanie (10–40) x wspolczynnik poziomu,
 *   - Cechy Stworzen z wag rodziny: 0/1/1/2/3 wg poziomu,
 *   - cechy "Opcjonalne" z ksiazki: szansa rosnaca z poziomem.
 * Stworzenia cywilizowane (orkowie, skaveny, kultysci...) z archetypem
 * rozwijaja sie przez profesje jak ludzie.
 */

import { chance, randInt, roll2k10, rollDie, weightedKey, type Rng } from "./dice";
import * as gd from "./gameData";
import { ATTRIBUTES, characteristicBonus, type Attribute } from "./rules";
import { TIER_IDS, type CreatureDef, type Npc, type TierId } from "./types";

/** Baza cechy stworzenia i rodzaj rzutu. */
export function creatureBase(creature: CreatureDef, code: Attribute): { base: number; die: "2k10" | "1k10" | null } {
  const v = creature.stats[code];
  if (v == null) return { base: 0, die: null };
  if (v <= 5) return { base: 0, die: "1k10" };
  return { base: v - 10, die: "2k10" };
}

/** Rzuty na cechy stworzenia (minimum kluczowych cech archetypu dla cywilizowanych). */
export function rollCreature(creature: CreatureDef, keyChars: Attribute[], rng: Rng, deterministic = false): Record<Attribute, number> {
  const min = gd.getSettings().minKeyRoll;
  const out = {} as Record<Attribute, number>;
  for (const code of ATTRIBUTES) {
    const { die } = creatureBase(creature, code);
    if (!die) out[code] = 0;
    else if (die === "1k10") out[code] = deterministic ? 5 : rollDie(10, rng);
    else if (deterministic) out[code] = keyChars.includes(code) ? Math.max(11, min) : 11;
    else {
      let r = roll2k10(rng);
      for (let i = 0; keyChars.includes(code) && r < min && i < 50; i++) r = roll2k10(rng);
      out[code] = r;
    }
  }
  return out;
}

export function sizeOf(traits: string[]): string {
  for (const t of traits) {
    const m = /^Rozmiar \(([^)]+)\)/.exec(t);
    if (m) return m[1].split(/\s/)[0];
  }
  return "Średni";
}

/**
 * Zywotnosc stworzenia wg Rozmiaru (podrecznik s. 341): Drobny 1, Niewielki BWt,
 * Maly 2xBWt+BSW, Sredni BS+2xBWt+BSW, Duzy x2, Wielki x4, Monstrualny x8;
 * Twardziel dodaje BWt przed mnoznikiem; Roj x5 i ignoruje Rozmiar.
 * Stworzenie bez Sily Woli uzywa Bonusu z Sily.
 */
export function creatureWounds(
  s: number,
  t: number,
  wp: number | null,
  traits: string[],
  hardy: number
): number {
  const sb = characteristicBonus(s);
  const tb = characteristicBonus(t);
  const wpb = wp == null ? sb : characteristicBonus(wp);
  const swarm = traits.some((x) => /^Rój/.test(x));
  const size = swarm ? "Średni" : sizeOf(traits);
  let w: number;
  if (size === "Drobny") w = 1;
  else if (size === "Niewielki") w = tb;
  else if (size === "Mały") w = 2 * tb + wpb;
  else w = sb + 2 * tb + wpb;
  w += hardy * tb;
  const mult: Record<string, number> = { Duży: 2, Wielki: 4, Monstrualny: 8 };
  w *= mult[size] ?? 1;
  if (swarm) w *= 5;
  return w;
}

/** Naturalne ataki z cech ksiazkowych (Broń +X, Ugryzienie +X, Ogon, Rogi, Macki, Język, Strzelanie, Zionięcie). */
export interface NaturalAttack {
  name: string;
  /** Obrazenia bez Bonusu z Sily (dla ataków wręcz) albo stale. */
  base: number;
  addsSb: boolean;
  range?: string;
  count?: number;
  trait: string;
}

export function naturalAttacks(creature: CreatureDef): NaturalAttack[] {
  const sb = characteristicBonus(creature.stats.S ?? 0);
  const out: NaturalAttack[] = [];
  for (const t of creature.traits) {
    let m: RegExpExecArray | null;
    if ((m = /^Broń(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ?? "Broń", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^Ugryzienie(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ? `Ugryzienie (${m[1]})` : "Ugryzienie", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^(?:Atak Ogonem|Ogon) \+(\d+)/.exec(t))) out.push({ name: "Ogon", base: +m[1] - sb, addsSb: true, trait: t });
    else if ((m = /^Rogi(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ? `Rogi (${m[1]})` : "Rogi", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^(?:(\d+)× )?Macki \+(\d+)/.exec(t))) out.push({ name: "Macki", base: +m[2] - sb, addsSb: true, count: m[1] ? +m[1] : 1, trait: t });
    else if ((m = /^Atak Językiem \+(\d+) \((\d+)\)/.exec(t))) out.push({ name: "Język", base: +m[1], addsSb: false, range: m[2], trait: t });
    else if ((m = /^Strzelanie(?: \(([^)]+)\))? \+(\d+) \((\d+)\)/.exec(t))) out.push({ name: m[1] ?? "Strzelanie", base: +m[2], addsSb: false, range: m[3], trait: t });
    else if ((m = /^Zionięcie(?: \(([^)]+)\))? \+(\d+)(?: \(([^)]+)\))?/.exec(t))) out.push({ name: `Zionięcie (${m[1] ?? m[3] ?? "różne"})`, base: +m[2], addsSb: false, trait: t });
    else if ((m = /^Wymiot \+(\d+)/.exec(t))) out.push({ name: "Wymiot", base: +m[1], addsSb: false, trait: t });
  }
  return out;
}

/** Punkty Pancerza z cechy "Pancerz (N)". */
export function creatureArmour(traits: string[]): number {
  for (const t of traits) {
    const m = /^Pancerz\s*\(?(\d+)/.exec(t);
    if (m) return +m[1];
  }
  return 0;
}

/** Umiejetnosci i talenty z ksiazki (wartosci -> rozwiniecia wzgledem cech ksiazkowych). */
export function bookSkillsAndTalents(npc: Npc, creature: CreatureDef): void {
  for (const s of creature.skills) {
    const attr = (gd.skillAttr(s.name) ?? "WW") as Attribute;
    const charValue = creature.stats[attr] ?? 0;
    const adv = Math.max(0, s.value - charValue);
    const owned = npc.skills.find((x) => x.name === s.name);
    if (owned) owned.advances = Math.max(owned.advances, adv);
    else npc.skills.push({ name: s.name, advances: adv });
  }
  for (const t of creature.talents) {
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(t)!;
    const name = m[1].trim();
    const level = m[2] ? +m[2] : 1;
    const owned = npc.talents.find((x) => x.name === name);
    if (owned) owned.level = Math.max(owned.level, level);
    else npc.talents.push({ name, level });
  }
}

/** Cechy "Opcjonalne", ktore mozna nadac automatycznie (bez instrukcji, zmian Rozmiaru i umiejetnosci). */
export function usableOptional(creature: CreatureDef): string[] {
  return creature.optional.filter(
    (o) =>
      !/usuń|dodaj|zmień|zwiększ|^Rozmiar|Wszystkie Cechy|^Mutacja|jedynie/i.test(o) &&
      o.length < 60 &&
      !gd.skillAttr(o.replace(/\s+\d+$/, ""))
  );
}

/**
 * Rozwoj bestii ponad profil z ksiazki:
 *   - umiejetnosci rodziny: pasowanie x wspolczynnik poziomu (do 5), liczy sie
 *     wyzsza wartosc (ksiazka albo rodzina) - bestie z podrecznika nie maja
 *     w ksiazce umiejetnosci, wiec slaby niedzwiedz dostaje np. Bijatyke,
 *   - kazda umiejetnosc dostaje skillBonus poziomu,
 *   - cechy z charCodes dostaja charAdvances poziomu.
 * Kazdy skladnik rosnie z poziomem, wiec wyzszy poziom tej samej bestii jest zawsze silniejszy.
 */
/**
 * Poziom rozwoju bestii liczony od jej minimalnego poziomu: Wybraniec Chaosu
 * (od doswiadczonego) na poziomie doswiadczonym to profil z ksiazki, jak slaby wilk.
 */
export function beastTier(npc: Pick<Npc, "tier">, creature: CreatureDef): TierId {
  const shift = TIER_IDS.indexOf(creature.minTier ?? "slaby");
  return TIER_IDS[Math.max(0, TIER_IDS.indexOf(npc.tier) - shift)];
}

export function beastSkills(npc: Npc, creature: CreatureDef): void {
  const fam = gd.getCreatureFamilies();
  const family = fam.families[creature.family];
  const tier = beastTier(npc, creature);
  const factor = fam.settings.tierFactor[tier] ?? 0;
  if (factor > 0) {
    for (const [skill, fit] of Object.entries(family?.skills ?? {})) {
      const bonus = Math.max(5, Math.round((fit * factor) / 5) * 5);
      const owned = npc.skills.find((s) => s.name === skill);
      if (owned) owned.advances = Math.max(owned.advances, bonus);
      else npc.skills.push({ name: skill, advances: bonus });
    }
  }
  const bump = fam.settings.skillBonus?.[tier] ?? 0;
  for (const s of npc.skills) s.advances += bump;
  const adv = fam.settings.charAdvances?.[tier] ?? 0;
  for (const code of fam.settings.charCodes ?? []) {
    if (creature.stats[code] != null) npc.charAdvances[code] = (npc.charAdvances[code] ?? 0) + adv;
  }
}

/** Wagi Cech Stworzen rodziny (do losowania cech opcjonalnych bestii). */
export function familyTraitWeights(creature: CreatureDef | undefined): Record<string, number> | undefined {
  return creature ? gd.getCreatureFamilies().families[creature.family]?.traits : undefined;
}

/** Cechy Stworzen wynikajace z poziomu bestii oraz cechy "Opcjonalne" z ksiazki. */
export function beastTraits(npc: Npc, creature: CreatureDef, rng: Rng, deterministic = false): void {
  const fam = gd.getCreatureFamilies();
  const family = fam.families[creature.family];
  const tier: TierId = beastTier(npc, creature);
  const count = fam.settings.traitCount[tier] ?? 0;
  const weights = { ...(family?.traits ?? {}) };
  for (let i = 0; i < count; i++) {
    for (const t of npc.traits) delete weights[t];
    const t = deterministic ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] : weightedKey(weights, rng);
    if (t) npc.traits.push(t);
  }

  const optional = usableOptional(creature).filter((o) => !npc.traits.includes(o));
  if (optional.length && !deterministic && chance(fam.settings.optionalChance[tier] ?? 0, rng)) {
    npc.traits.push(optional[randInt(0, optional.length - 1, rng)]);
  }
}
