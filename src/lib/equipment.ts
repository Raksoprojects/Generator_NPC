/**
 * Bron i pancerz BN: rozpoznawanie ich w wyposazeniu profesji, bron domyslna
 * ze specjalizacji umiejetnosci oraz zestawy pancerza archetypu.
 */

import { chance, pick, type Rng } from "./dice";
import * as gd from "./gameData";
import type { ArmourDef, Npc, WeaponDef } from "./types";

type Match = { kind: "weapon" | "armour"; names: string[] };

const PLATE = ["Napierśnik", "Naramienniki", "Nagolenniki płytowe", "Hełm"];

/** Wzorce wyposazenia z profesji (dopasowanie od poczatku tekstu). */
const PATTERNS: [RegExp, Match][] = [
  [/^(pełna )?zbroja płytowa/, { kind: "armour", names: PLATE }],
  [/^napierśnik płytowy i hełm/, { kind: "armour", names: ["Napierśnik", "Hełm"] }],
  [/^skórzan[ya] napierśnik|^kaftan$/, { kind: "armour", names: ["Skórzany kaftan"] }],
  [/^skórzana kurta/, { kind: "armour", names: ["Skórzana kurta"] }],
  [/^skórzany kaftan/, { kind: "armour", names: ["Skórzany kaftan"] }],
  [/^skórzany hełm/, { kind: "armour", names: ["Skórzany hełm"] }],
  [/^skórzane nogawice/, { kind: "armour", names: ["Skórzane nogawice"] }],
  [/^kaftan kolczy z rękawami|^kolczuga/, { kind: "armour", names: ["Kolczuga"] }],
  [/^kaftan kolczy/, { kind: "armour", names: ["Kaftan kolczy"] }],
  [/^spódnica kolcza|^nogawice kolcze/, { kind: "armour", names: ["Nogawice kolcze"] }],
  [/^czepiec kolczy/, { kind: "armour", names: ["Czepiec kolczy"] }],
  [/^kolet/, { kind: "armour", names: ["Kolet"] }],
  [/^napierśnik/, { kind: "armour", names: ["Napierśnik"] }],
  [/^naramienniki/, { kind: "armour", names: ["Naramienniki"] }],
  [/^nagolenniki/, { kind: "armour", names: ["Nagolenniki płytowe"] }],
  [/^hełm (płytowy )?\(?otwarty|^hełm z gromrilu \(otwarty\)|^hełm płytowy otwarty/, { kind: "armour", names: ["Hełm otwarty"] }],
  [/^(wielki |pełny )?hełm/, { kind: "armour", names: ["Hełm"] }],
  [/^młot kawaleryjski/, { kind: "weapon", names: ["Młot kawaleryjski"] }],
  [/^miecz dwuręczny/, { kind: "weapon", names: ["Miecz dwuręczny"] }],
  [/^wielki topór|^topór dwuręczny|^broń dwuręczna|^wielka broń/, { kind: "weapon", names: ["Wielki topór"] }],
  [/^broń ręczna|^broń \(dowolna\)|^broń biała|^dowolna broń biała|^miecz|^topór|^maczuga|^szabla/, { kind: "weapon", names: ["Broń Ręczna"] }],
  [/^kostur/, { kind: "weapon", names: ["Kostur"] }],
  [/^włócznia/, { kind: "weapon", names: ["Włócznia"] }],
  [/^pika/, { kind: "weapon", names: ["Pika"] }],
  [/^halabarda/, { kind: "weapon", names: ["Halabarda"] }],
  [/^kopia/, { kind: "weapon", names: ["Kopia"] }],
  [/^kastet/, { kind: "weapon", names: ["Kastet"] }],
  [/^korbacz/, { kind: "weapon", names: ["Korbacz"] }],
  [/^cep/, { kind: "weapon", names: ["Cep bojowy"] }],
  [/^rapier/, { kind: "weapon", names: ["Rapier"] }],
  [/^floret/, { kind: "weapon", names: ["Floret"] }],
  [/^lewak/, { kind: "weapon", names: ["Lewak"] }],
  [/^łamacz mieczy/, { kind: "weapon", names: ["Łamacz mieczy"] }],
  [/^sztylet/, { kind: "weapon", names: ["Sztylet"] }],
  [/^bicz/, { kind: "weapon", names: ["Bicz"] }],
  [/^arkan/, { kind: "weapon", names: ["Arkan"] }],
  [/^oszczep/, { kind: "weapon", names: ["Oszczep"] }],
  [/^broń miotana/, { kind: "weapon", names: ["Nóż do rzucania"] }],
  [/^kusza pistoletowa/, { kind: "weapon", names: ["Kusza pistoletowa"] }],
  [/^kusza/, { kind: "weapon", names: ["Kusza"] }],
  [/^pistolet|^pas z pistoletami/, { kind: "weapon", names: ["Pistolet"] }],
  [/^garłacz/, { kind: "weapon", names: ["Garłacz"] }],
  [/^rusznica/, { kind: "weapon", names: ["Rusznica"] }],
  [/^muszkiet/, { kind: "weapon", names: ["Muszkiet hochlandzki"] }],
  [/^łuk długi/, { kind: "weapon", names: ["Łuk długi"] }],
  [/^krótki łuk/, { kind: "weapon", names: ["Krótki łuk"] }],
  [/^łuk/, { kind: "weapon", names: ["Łuk"] }],
  [/^proca/, { kind: "weapon", names: ["Proca"] }],
  [/^puklerz/, { kind: "weapon", names: ["Tarcza (puklerz)"] }],
  [/^tarcza/, { kind: "weapon", names: ["Tarcza"] }]
];

/** Bron domyslna dla specjalizacji umiejetnosci. */
const MELEE_BY_SPEC: Record<string, string[]> = {
  Podstawowa: ["Broń Ręczna"],
  Dwuręczna: ["Wielki topór", "Miecz dwuręczny", "Młot bojowy"],
  Drzewcowa: ["Halabarda", "Włócznia"],
  Szermiercza: ["Rapier", "Floret"],
  Bijatyka: ["Kastet"],
  Kawaleryjska: ["Młot kawaleryjski"],
  Korbacz: ["Korbacz", "Cep bojowy"],
  Parująca: ["Lewak", "Łamacz mieczy"]
};

const RANGED_BY_SPEC: Record<string, string[]> = {
  Łuk: ["Łuk"],
  Kusza: ["Kusza"],
  Prochowa: ["Pistolet", "Rusznica"],
  Proca: ["Proca"],
  Miotana: ["Nóż do rzucania", "Topór do rzucania"],
  Oplątująca: ["Bicz"],
  Eksperymentalna: ["Pistolet samopowtarzalny"]
};

export function getWeaponDef(name: string): { def: WeaponDef; ranged: boolean } | undefined {
  const w = gd.getWeapons();
  if (w.melee[name]) return { def: w.melee[name], ranged: false };
  if (w.ranged[name]) return { def: w.ranged[name], ranged: true };
  return undefined;
}

export function getArmourDef(name: string): ArmourDef | undefined {
  return gd.getWeapons().armour[name];
}

export function allWeaponNames(): string[] {
  const w = gd.getWeapons();
  return [...Object.keys(w.melee), ...Object.keys(w.ranged)];
}

export function allArmourNames(): string[] {
  return Object.keys(gd.getWeapons().armour);
}

/** Rozpoznaje bron/pancerz w pozycji wyposazenia (lub null). */
export function matchTrapping(item: string, rng: Rng): Match | null {
  let t = item.trim().toLowerCase().replace(/\s+/g, " ");
  t = t.replace(/^(dobrej jakości|dobra|dobry|posrebrzany|posrebrzana) /, "");
  if (t.includes(" albo ")) t = pick(t.split(" albo "), rng) ?? t;
  const parts = /^(naramienniki|napierśnik)/.test(t) ? t.split(" i ") : [t];
  const out: Match = { kind: "weapon", names: [] };
  for (const part of parts) {
    const hit = PATTERNS.find(([re]) => re.test(part.trim()));
    if (!hit) return parts.length > 1 && out.names.length ? out : null;
    out.kind = hit[1].kind;
    out.names.push(...hit[1].names);
  }
  return out.names.length ? out : null;
}

/** Specjalizacje posiadanych umiejetnosci "Broń Biała/Zasięgowa (X)", od najwyzej rozwinietej. */
function ownedSpecs(npc: Npc, base: string): string[] {
  return npc.skills
    .filter((s) => gd.splitSpec(s.name).base === base && gd.splitSpec(s.name).spec)
    .sort((a, b) => b.advances - a.advances)
    .map((s) => gd.splitSpec(s.name).spec as string);
}

/**
 * Wyciaga bron i pancerz z wyposazenia BN, dokłada bron wynikajaca z jego
 * umiejetnosci oraz zestaw pancerza archetypu.
 */
export function equipNpc(npc: Npc, rng: Rng): void {
  const weapons = new Set<string>();
  const armour = new Set<string>();
  const rest: string[] = [];
  for (const item of npc.trappings) {
    const m = matchTrapping(item, rng);
    if (!m) rest.push(item);
    else for (const n of m.names) (m.kind === "weapon" ? weapons : armour).add(n);
  }

  const has = (ranged: boolean) => [...weapons].some((w) => getWeaponDef(w)?.ranged === ranged && !getWeaponDef(w)?.def.shield);
  const meleeSpecs = ownedSpecs(npc, "Broń Biała");
  if (!has(false)) {
    const spec = meleeSpecs[0];
    const options = spec ? MELEE_BY_SPEC[spec] : undefined;
    weapons.add(options ? (pick(options, rng) ?? options[0]) : "Sztylet");
  }
  // Wojownik z Bronia Biala (Podstawowa) czesto nosi tarcze.
  if (meleeSpecs.includes("Podstawowa") && ![...weapons].some((w) => getWeaponDef(w)?.def.shield)) {
    const twoHanded = [...weapons].some((w) => getWeaponDef(w)?.def.twoHanded);
    if (!twoHanded && ["Wojownik", "Strażnik"].includes(npc.archetype) && chance(0.5, rng)) weapons.add("Tarcza");
  }
  for (const spec of ownedSpecs(npc, "Broń Zasięgowa")) {
    const options = RANGED_BY_SPEC[spec];
    if (!options) continue;
    const already = [...weapons].some((w) => getWeaponDef(w)?.def.group === spec);
    if (!already) weapons.add(pick(options, rng) ?? options[0]);
  }

  // Jedna tarcza - najlepsza (np. "puklerz albo tarcza" z dwoch poziomow).
  const shields = [...weapons].filter((w) => getWeaponDef(w)?.def.shield);
  if (shields.length > 1) {
    shields.sort((a, b) => (getWeaponDef(b)?.def.shield ?? 0) - (getWeaponDef(a)?.def.shield ?? 0));
    for (const s of shields.slice(1)) weapons.delete(s);
  }

  const setName = gd.getArchetype(npc.archetype)?.armour?.[npc.tier];
  for (const piece of (setName && gd.getWeapons().armourSets[setName]) || []) armour.add(piece);

  npc.weapons = [...weapons];
  npc.armour = [...armour];
  npc.trappings = rest;
}

export const LOCATIONS = ["głowa", "ręce", "korpus", "nogi"] as const;
export type Location = (typeof LOCATIONS)[number];

/** Punkty Pancerza na lokacjach z elementow pancerza (warstwy sie sumuja). */
export function armourPoints(armour: string[]): Record<Location, number> {
  const out: Record<Location, number> = { głowa: 0, ręce: 0, korpus: 0, nogi: 0 };
  for (const name of new Set(armour)) {
    const def = getArmourDef(name);
    if (!def) continue;
    for (const loc of def.locations) {
      const key = (loc === "ramiona" ? "ręce" : loc) as Location;
      if (key in out) out[key] += def.ap;
    }
  }
  return out;
}
