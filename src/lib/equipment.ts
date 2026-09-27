/**
 * Bron i pancerz BN: rozpoznawanie ich w wyposazeniu profesji, dobor
 * konkretnej broni do postaci (krasnolud z "bronią ręczną" dostaje topór)
 * oraz zestawy pancerza archetypu. Bron wg kart z "Pod Bronią".
 */

import { chance, pick, weightedKey, type Rng } from "./dice";
import * as gd from "./gameData";
import type { ArmourDef, Npc, WeaponChoice, WeaponDef } from "./types";

/** Znaczniki broni do dobrania wg postaci. */
const HAND = "@jednoręczna";
const TWO = "@dwuręczna";

type Match = { kind: "weapon" | "armour"; names: string[] };

const PLATE = ["Napierśnik", "Naramienniki", "Nagolenniki płytowe", "Hełm"];

/** Bron w nawiasie wyposazenia, np. "broń ręczna (bosak)". */
const PAREN_WEAPON: Record<string, string> = {
  bosak: "Bosak",
  miecz: "Miecz",
  topór: "Topór",
  kilof: "Nadziak jednoręczny",
  sierp: "Broń improwizowana",
  "dwuręczny kilof": "Nadziak",
  maczuga: "Pałka",
  młot: "Młot jednoręczny"
};

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
  [/^wielki topór/, { kind: "weapon", names: ["Wielki topór"] }],
  [/^topór dwuręczny|^broń dwuręczna|^wielka broń/, { kind: "weapon", names: [TWO] }],
  [/^broń ręczna|^broń \(dowolna\)|^broń biała|^dowolna broń biała|^broń$/, { kind: "weapon", names: [HAND] }],
  [/^miecz/, { kind: "weapon", names: ["Miecz"] }],
  [/^topór/, { kind: "weapon", names: ["Topór"] }],
  [/^maczuga|^pałka/, { kind: "weapon", names: ["Pałka"] }],
  [/^szabla/, { kind: "weapon", names: ["Szabla"] }],
  [/^kostur/, { kind: "weapon", names: ["Kostur"] }],
  [/^włócznia/, { kind: "weapon", names: ["Włócznia"] }],
  [/^pika/, { kind: "weapon", names: ["Pika"] }],
  [/^halabarda/, { kind: "weapon", names: ["Halabarda"] }],
  [/^kopia/, { kind: "weapon", names: ["Kopia"] }],
  [/^lanca/, { kind: "weapon", names: ["Lanca"] }],
  [/^kastet/, { kind: "weapon", names: ["Kastet"] }],
  [/^korbacz/, { kind: "weapon", names: ["Korbacz"] }],
  [/^cep/, { kind: "weapon", names: ["Cep bojowy"] }],
  [/^rapier/, { kind: "weapon", names: ["Rapier"] }],
  [/^floret/, { kind: "weapon", names: ["Floret"] }],
  [/^szpada/, { kind: "weapon", names: ["Szpada"] }],
  [/^lewak/, { kind: "weapon", names: ["Lewak"] }],
  [/^łamacz mieczy/, { kind: "weapon", names: ["Łamacz mieczy"] }],
  [/^sztylet/, { kind: "weapon", names: ["Sztylet"] }],
  [/^nóż$/, { kind: "weapon", names: ["Nóż"] }],
  [/^bicz/, { kind: "weapon", names: ["Bicz"] }],
  [/^arkan/, { kind: "weapon", names: ["Arkan"] }],
  [/^sieć/, { kind: "weapon", names: ["Obciążona sieć"] }],
  [/^oszczep/, { kind: "weapon", names: ["Oszczep"] }],
  [/^broń miotana|^topory do rzucania/, { kind: "weapon", names: ["Topór do rzucania"] }],
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
  [/^puklerz/, { kind: "weapon", names: ["Puklerz"] }],
  [/^tarcza/, { kind: "weapon", names: ["Tarcza"] }]
];

/** Bron domyslna dla specjalizacji umiejetnosci. */
const MELEE_BY_SPEC: Record<string, string[]> = {
  Podstawowa: [HAND],
  Dwuręczna: [TWO],
  Drzewcowa: ["Halabarda", "Włócznia", "Topór drzewcowy"],
  Szermiercza: ["Rapier", "Szpada", "Floret"],
  Bijatyka: ["Kastet", "Tłuk"],
  Kawaleryjska: ["Szabla", "Młot kawaleryjski"],
  Korbacz: ["Korbacz", "Cep bojowy"],
  Parująca: ["Lewak", "Łamacz mieczy"]
};

const RANGED_BY_SPEC: Record<string, string[]> = {
  Łuk: ["Łuk"],
  Kusza: ["Kusza"],
  Prochowa: ["Pistolet", "Rusznica"],
  Proca: ["Proca"],
  Miotana: ["Nóż do rzucania", "Topór do rzucania", "Oszczep"],
  Oplątująca: ["Bicz", "Arkan"],
  Eksperymentalna: ["Pistolet samopowtarzalny"]
};

export function getWeaponDef(name: string): { def: WeaponDef; ranged: boolean; name: string } | undefined {
  const w = gd.getWeapons();
  const key = w.melee[name] || w.ranged[name] ? name : w.legacy?.[name];
  if (!key) return undefined;
  if (w.melee[key]) return { def: w.melee[key], ranged: false, name: key };
  if (w.ranged[key]) return { def: w.ranged[key], ranged: true, name: key };
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

/**
 * Opis zalety/wady. Karty uzywaja roznych form ("Parujący", "Parująca",
 * "Sieczna (1P)", "Tarcza 2") - szukamy po rdzeniu nazwy.
 */
export function qualityDescription(quality: string): string {
  const all = gd.getWeapons().qualities;
  const name = quality.replace(/\s*\(\d+P\)$|\s+\d+$/, "").trim();
  if (all[name]) return all[name];
  const stem = name.toLowerCase().slice(0, Math.max(5, name.length - 2));
  const key = Object.keys(all).find((k) => k.toLowerCase().startsWith(stem));
  return key ? all[key] : "";
}

/** Wybiera bron z tabeli wag: rasa x archetyp (albo grupa stworzenia). */
export function chooseWeapon(table: WeaponChoice, npc: Npc, rng: Rng): string {
  const creature = gd.getCreature(npc.creature);
  const race = creature ? undefined : table.race?.[npc.race];
  const arch = table.archetype?.[npc.archetype];
  const group = creature ? table.creatureGroup?.[creature.group] : undefined;
  const keys = new Set([...Object.keys(table.default), ...Object.keys(race ?? {}), ...Object.keys(arch ?? {}), ...Object.keys(group ?? {})]);
  const weights: Record<string, number> = {};
  for (const k of keys) {
    if (!getWeaponDef(k)) continue;
    const base = table.default[k] ?? 1;
    weights[k] = (race?.[k] ?? base) * (arch?.[k] ?? 1) * (group?.[k] ?? 1);
  }
  return weightedKey(weights, rng) ?? "Miecz";
}

function resolveMarker(name: string, npc: Npc, rng: Rng): string {
  const w = gd.getWeapons();
  if (name === HAND) return chooseWeapon(w.handWeapon, npc, rng);
  if (name === TWO) return chooseWeapon(w.twoHandedWeapon, npc, rng);
  return name;
}

/** Rozpoznaje bron/pancerz w pozycji wyposazenia (lub null). */
export function matchTrapping(item: string, rng: Rng): Match | null {
  let t = item.trim().toLowerCase().replace(/\s+/g, " ");
  t = t.replace(/^(dobrej jakości|dobra|dobry|posrebrzany|posrebrzana) /, "");
  if (t.includes(" albo ")) t = pick(t.split(" albo "), rng) ?? t;
  const paren = /^broń(?: ręczna)? \(([^)]+?)\s*\)/.exec(t);
  if (paren && PAREN_WEAPON[paren[1]]) return { kind: "weapon", names: [PAREN_WEAPON[paren[1]]] };
  const wielka = /^wielka broń \(([^)]+?)\s*\)/.exec(t);
  if (wielka && PAREN_WEAPON[wielka[1]]) return { kind: "weapon", names: [PAREN_WEAPON[wielka[1]]] };
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

/** Ranking broni: rozwiniecia umiejetnosci jej grupy (bron bez umiejetnosci na koncu). */
function weaponRank(npc: Npc, name: string): number {
  const w = getWeaponDef(name);
  if (!w) return -1;
  const skill = npc.skills.find((s) => s.name === `${w.ranged ? "Broń Zasięgowa" : "Broń Biała"} (${w.def.group})`);
  // Przy rownej umiejetnosci wyzej stoi bron zadajaca wiecej obrazen (topor przed sztyletem).
  return (skill ? skill.advances + 1 : 0) * 100 + (w.def.damage ?? 0);
}

/**
 * Wyciaga bron i pancerz z wyposazenia BN, dobiera konkretna bron do postaci,
 * dokłada bron wynikajaca z umiejetnosci oraz zestaw pancerza archetypu.
 */
export function equipNpc(npc: Npc, rng: Rng): void {
  const weapons = new Set<string>();
  const armour = new Set<string>();
  const rest: string[] = [];
  for (const item of npc.trappings) {
    const m = matchTrapping(item, rng);
    if (!m) rest.push(item);
    else for (const n of m.names) (m.kind === "weapon" ? weapons.add(resolveMarker(n, npc, rng)) : armour.add(n));
  }

  const isShield = (w: string) => !!getWeaponDef(w)?.def.shield;
  const has = (ranged: boolean) => [...weapons].some((w) => getWeaponDef(w)?.ranged === ranged && !isShield(w));
  const meleeSpecs = ownedSpecs(npc, "Broń Biała");
  if (!has(false)) {
    const spec = meleeSpecs[0];
    const options = spec ? MELEE_BY_SPEC[spec] : undefined;
    weapons.add(options ? resolveMarker(pick(options, rng) ?? options[0], npc, rng) : "Sztylet");
  }
  // Wojownik lub straznik z Bronia Biala (Podstawowa) czesto nosi tarcze.
  if (meleeSpecs.includes("Podstawowa") && ![...weapons].some(isShield)) {
    const twoHanded = [...weapons].some((w) => getWeaponDef(w)?.def.twoHanded && !getWeaponDef(w)?.ranged);
    if (!twoHanded && ["Wojownik", "Strażnik"].includes(npc.archetype) && chance(0.5, rng)) weapons.add("Tarcza");
  }
  // Bron zasiegowa z najlepiej rozwinietej specjalizacji, jesli wyposazenie jej nie dalo.
  const topRanged = ownedSpecs(npc, "Broń Zasięgowa").find((s) => RANGED_BY_SPEC[s]);
  if (topRanged && !has(true)) weapons.add(pick(RANGED_BY_SPEC[topRanged], rng) ?? RANGED_BY_SPEC[topRanged][0]);

  // Czytelny zestaw: najwyzej 2 bronie biale, 1 tarcza (najlepsza) i 1 zasiegowa.
  const list = [...weapons];
  const shields = list.filter(isShield).sort((a, b) => (getWeaponDef(b)?.def.shield ?? 0) - (getWeaponDef(a)?.def.shield ?? 0));
  const melee = list.filter((w) => !isShield(w) && !getWeaponDef(w)?.ranged).sort((a, b) => weaponRank(npc, b) - weaponRank(npc, a));
  const ranged = list.filter((w) => getWeaponDef(w)?.ranged).sort((a, b) => weaponRank(npc, b) - weaponRank(npc, a));
  weapons.clear();
  for (const w of [...melee.slice(0, 2), ...shields.slice(0, 1), ...ranged.slice(0, 1)]) weapons.add(w);

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
