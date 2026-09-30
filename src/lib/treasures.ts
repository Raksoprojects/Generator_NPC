/**
 * Jakosc wykonania broni i pancerza oraz przedmioty magiczne BN (treasures.json).
 *
 * - Jakosc (PG s. 291–293): slabi BN czesciej nosza Tandetne, Brzydkie graty,
 *   wyzsi - Wytrzymale i Wysmienite; zielonoskorzy i skaveny gorzej, krasnoludy
 *   i elfy lepiej (elfie wyroby zawsze Wytrzymały 1, Wyśmienity 1). Gromril i
 *   ithilmar trafiaja sie bohaterom swoich ras.
 * - Przedmioty magiczne: tylko istoty rozumne; szanse wg poziomu (zaawansowany 1%,
 *   doswiadczony 10%, heroiczny 50%, legendarny co najmniej dwa). Losowane z
 *   szablonow pasujacych do BN - runy dla krasnoludow, Bron Chaosu dla slug
 *   Chaosu, artefakty wampirow, zaklete przedmioty elfow, przeklete przedmioty.
 */

import { chance, pick, randInt, weightedKey, weightedPick, type Rng } from "./dice";
import { naturalAttacks } from "./creatures";
import { getArmourDef, getWeaponDef } from "./equipment";
import * as gd from "./gameData";
import { ATTRIBUTES, type Attribute } from "./rules";
import type { CraftModifier, ItemCraft, ItemEffects, Npc, NpcMagicItem, RuneDef, TierId, TreasureDef } from "./types";
import { TIER_IDS } from "./types";

// ---------------------------------------------------------------------------
// Dopasowanie BN
// ---------------------------------------------------------------------------

function groupKeys(npc: Npc): string[] {
  const c = gd.getCreature(npc.creature);
  return c ? [c.group, gd.creatureGroupKey(c)] : [];
}

function matchesModifier(npc: Npc, m: CraftModifier): boolean {
  const race = !npc.creature && m.races?.includes(npc.race);
  const group = groupKeys(npc).some((g) => m.groups?.includes(g));
  const arch = !!npc.archetype && m.archetypes?.includes(npc.archetype);
  return !!(race || group || arch);
}

/** Istota rozumna: rasa albo stworzenie cywilizowane (goblin tak, smok nie). */
export function isRational(npc: Npc): boolean {
  return !npc.creature || gd.isCivilized(npc.creature);
}

const tierIdx = (t: TierId) => TIER_IDS.indexOf(t);

// ---------------------------------------------------------------------------
// Jakosc wykonania
// ---------------------------------------------------------------------------

/** Najwyzszy poziom Zalety wykonania (gromril: Wytrzymały 4 + odrobina kunsztu). */
const MAX_CRAFT_LEVEL = 5;

/** "Wytrzymały 1" + "Wytrzymały 2" -> "Wytrzymały 3" (najwyzej MAX_CRAFT_LEVEL). */
function mergeLevels(list: string[]): string[] {
  const levels = new Map<string, number>();
  for (const q of list) {
    const m = /^(.*?)\s+(\d+)$/.exec(q);
    const name = m ? m[1] : q;
    levels.set(name, (levels.get(name) ?? 0) + (m ? +m[2] : 0));
  }
  return [...levels].map(([name, lvl]) => (lvl ? `${name} ${Math.min(lvl, MAX_CRAFT_LEVEL)}` : name));
}

/** Zalety z poziomami (Wytrzymały, Wyśmienity) dostaja numer; pozostale bez. */
const LEVELLED = new Set(["Wytrzymały", "Wyśmienity"]);

function rollOne(npc: Npc, name: string, isArmour: boolean, rng: Rng, deterministic: boolean): ItemCraft | undefined {
  const data = gd.getTreasures()?.craft;
  if (!data) return undefined;
  const mods = data.modifiers.filter((m) => matchesModifier(npc, m));
  const tier = data.tiers[npc.tier];
  const flawMult = mods.reduce((p, m) => p * (m.flawMult ?? 1), 1);
  const qualityMult = mods.reduce((p, m) => p * (m.qualityMult ?? 1), 1);
  const flawWeights: Record<string, number> = Object.assign({}, data.defaultFlaws, ...mods.map((m) => m.flaws ?? {}));
  const qualityWeights: Record<string, number> = Object.assign({}, data.defaultQualities, ...mods.map((m) => m.qualities ?? {}));
  const out: ItemCraft = { qualities: mods.flatMap((m) => m.always ?? []), flaws: [] };
  const label = mods.find((m) => m.label)?.label;
  if (label) out.label = label;

  // Material bohaterow (gromril u krasnoludow, ithilmar u elfow).
  for (const [key, mat] of Object.entries(data.materials)) {
    if (npc.creature || !mat.races.includes(npc.race)) continue;
    const p = mat.chance[npc.tier] ?? 0;
    if (!p || (deterministic ? p < 0.5 : !chance(p, rng))) continue;
    if (isArmour) {
      const def = getArmourDef(name);
      if (!mat.armour || !def || !mat.armour.types.includes(def.type)) continue;
      out.qualities.push(...mat.armour.qualities);
    } else {
      // Bron z materialu tylko tego rodzaju, jaki sie z niego kuje (gromril: topory, mloty, kilofy).
      const byName = Object.entries(mat.weapon?.byName ?? {}).filter(([part]) => name.toLowerCase().includes(part));
      if (!mat.weapon || (mat.weapon.byName && !byName.length)) continue;
      out.qualities.push(...mat.weapon.qualities, ...byName.flatMap(([, extra]) => extra));
    }
    out.material = key;
    break;
  }

  if (!deterministic) {
    if (!out.material && chance(Math.min(1, tier.flaw * flawMult), rng)) {
      const first = weightedKey(flawWeights, rng);
      if (first) out.flaws.push(first);
      // Czasem cale nieszczescie naraz (Tandetny i Brzydki).
      const second = chance(0.3, rng) ? weightedKey(Object.fromEntries(Object.entries(flawWeights).filter(([k]) => k !== first)), rng) : undefined;
      if (second) out.flaws.push(second);
    }
    if (!out.flaws.length) {
      let p = Math.min(1, tier.quality * qualityMult);
      for (let i = 0; i < tier.maxQualities && chance(p, rng); i++, p /= 2) {
        const q = weightedKey(qualityWeights, rng);
        if (q) out.qualities.push(LEVELLED.has(q) ? `${q} 1` : q);
      }
    }
  }
  out.qualities = mergeLevels(out.qualities);
  return out.qualities.length || out.flaws.length || out.material || out.label ? out : undefined;
}

/** Zalety/Wady wykonania kazdej broni i elementu pancerza BN. */
export function rollCraft(npc: Npc, rng: Rng, deterministic = false): void {
  npc.craft = {};
  for (const w of npc.weapons) {
    const c = rollOne(npc, w, false, rng, deterministic);
    if (c) npc.craft[w] = c;
  }
  for (const a of npc.armour) {
    const c = rollOne(npc, a, true, rng, deterministic);
    if (c) npc.craft[a] = c;
  }
}

/** Opis Zalety/Wady wykonania ("Wytrzymały 2" -> opis Wytrzymały). */
export function craftDescription(name: string): string | undefined {
  const data = gd.getTreasures()?.craft;
  const base = name.replace(/\s+\d+$/, "");
  return data?.qualities[base] ?? data?.flaws[base];
}

export function isCraftFlaw(name: string): boolean {
  return !!gd.getTreasures()?.craft.flaws[name.replace(/\s+\d+$/, "")];
}

export function materialOf(npc: Npc, item: string) {
  const key = npc.craft?.[item]?.material;
  return key ? gd.getTreasures()?.craft.materials[key] : undefined;
}

/** Dodatkowe PP elementu pancerza z materialu (plyta z gromrilu: 3 zamiast 2). */
export function materialApBonus(npc: Npc, piece: string): number {
  const mat = materialOf(npc, piece);
  const def = getArmourDef(piece);
  return (def && mat?.armour?.apBonus?.[def.type]) ?? 0;
}

// ---------------------------------------------------------------------------
// Przedmioty magiczne
// ---------------------------------------------------------------------------

function npcGod(npc: Npc): string | undefined {
  const text = [npc.creature ?? "", ...npc.talents.map((t) => t.name), ...npc.traits].join(" ").toLowerCase();
  if (/khorn/.test(text)) return "Khorne";
  if (/nurgl/.test(text)) return "Nurgle";
  if (/slaanesh/.test(text)) return "Slaanesh";
  if (/tzeentch/.test(text)) return "Tzeentch";
  return undefined;
}

/** Wrogie sobie potegi Chaosu - wlasciwosci nie laczą sie na jednej broni. */
const CHAOS_ENEMIES: Record<string, string[]> = {
  Khorne: ["Slaanesh", "Tzeentch"],
  Slaanesh: ["Khorne"],
  Tzeentch: ["Khorne", "Nurgle"],
  Nurgle: ["Tzeentch"]
};

function npcLores(npc: Npc): string[] {
  return npc.talents
    .map((t) => gd.splitSpec(t.name))
    .filter((s) => (s.base === "Magia Tajemna" || s.base === "Magia Chaosu") && s.spec)
    .map((s) => gd.spellLoreKey(s.spec!) ?? s.spec!);
}

const isCaster = (npc: Npc) => npc.spells.length > 0 || npc.talents.some((t) => /^Magia (Prosta|Tajemna|Chaosu)/.test(t.name));
const hasSkill = (npc: Npc, skill: string) => npc.skills.some((s) => s.name === skill);

/** Glowna bron biala BN (albo naturalny atak bronią stworzenia, np. "Broń Chaosu i duża tarcza"). */
function primaryMelee(npc: Npc): string | undefined {
  const own = npc.weapons.find((w) => {
    const d = getWeaponDef(w);
    return d && !d.ranged && !d.def.shield;
  });
  if (own) return own;
  const creature = gd.getCreature(npc.creature);
  return creature ? naturalAttacks(creature).find((a) => /^Broń/.test(a.name) && !a.range)?.name : undefined;
}

/** Bron BN tej samej grupy co wzorzec (np. Podstawowa), jeszcze nie zakleta - do zastapienia przedmiotem. */
function sameGroupWeapon(npc: Npc, pattern: string, used: Set<string | undefined>): string | undefined {
  const def = getWeaponDef(pattern);
  if (!def) return undefined;
  return npc.weapons.find((w) => {
    const d = getWeaponDef(w);
    return d && !used.has(w) && d.ranged === def.ranged && d.def.group === def.def.group && !d.def.shield;
  });
}

const METAL = ["Płytowy", "Kolczuga"];

function fits(npc: Npc, t: TreasureDef, owned: NpcMagicItem[]): boolean {
  if (t.minTier && tierIdx(npc.tier) < tierIdx(t.minTier)) return false;
  if (owned.some((o) => o.template === t.name)) return false;
  if (t.forRaces && (npc.creature || !t.forRaces.includes(npc.race))) return false;
  if (t.forGroups || t.forTalents) {
    const byGroup = !!t.forGroups && groupKeys(npc).some((g) => t.forGroups!.includes(g));
    const byTalent = !!t.forTalents && npc.talents.some((x) => t.forTalents!.some((n) => x.name.startsWith(n)));
    if (!byGroup && !byTalent) return false;
  }
  if (t.forLores && !npcLores(npc).some((l) => t.forLores!.includes(l))) return false;
  if (t.forCasters && !isCaster(npc)) return false;
  if (t.forBloodlines && !npc.mutations.some((m) => m.kind === "bloodline" && t.forBloodlines!.includes(m.name))) return false;
  if (t.needsSkill && !hasSkill(npc, t.needsSkill)) return false;
  const usedWeapons = new Set(owned.map((o) => o.base));
  if (t.kind === "weapon") {
    if (t.replaces) {
      if (!getWeaponDef(t.replaces) || usedWeapons.has(t.replaces)) return false;
      // Przedmiot zastępuje broń tego samego rodzaju, którą BN już nosi; osobny (extra) - dochodzi do ekwipunku.
      const has = npc.weapons.includes(t.replaces) || !!sameGroupWeapon(npc, t.replaces, usedWeapons);
      if (!has && !(t.extra && npc.weapons.length)) return false;
    } else {
      const base = primaryMelee(npc);
      if (!base || usedWeapons.has(base)) return false;
    }
  }
  if (t.kind === "armour") {
    if (owned.some((o) => o.base === "pancerz")) return false;
    if (t.replaces) return npc.armour.includes(t.replaces);
    if (!npc.armour.length) return false;
    // Material i runy tylko na metalu (Prawo Formy).
    if ((t.material || t.runes) && !npc.armour.some((a) => METAL.includes(getArmourDef(a)?.type ?? ""))) return false;
  }
  return true;
}

/**
 * Runy przedmiotu: 1-3 zwykle wg poziomu (moga sie powtarzac) i czasem jedna mistrzowska -
 * razem najwyzej cztery (Prawo Trzech, Prawo Zazdrosci). Tymczasowy - jedna zwykla runa.
 */
function rollRunes(npc: Npc, pool: RuneDef[], rng: Rng, deterministic: boolean, temporary = false): string[] {
  const data = gd.getTreasures()!.runic;
  const regular = pool.filter((r) => !r.master);
  if (temporary) return regular.length ? [(deterministic ? regular[0] : pick(regular, rng))!.name] : [];
  const [lo, hi] = data.regularCount[npc.tier] ?? [1, 1];
  const count = Math.min(3, deterministic ? hi : randInt(lo, hi, rng));
  const out: string[] = [];
  while (out.length < count && regular.length) {
    const repeat = !deterministic && out.length > 0 && chance(0.35, rng);
    out.push(repeat ? pick(out, rng)! : (deterministic ? regular[out.length % regular.length] : pick(regular, rng)!).name);
  }
  const master = pool.filter((r) => r.master);
  const p = data.masterChance[npc.tier] ?? 0;
  if (master.length && (deterministic ? p >= 0.5 : chance(p, rng))) out.unshift((deterministic ? master[0] : pick(master, rng))!.name);
  return out;
}

/**
 * Przedmioty runiczne, osobno od pozostalych: tymczasowe od sredniego poziomu (rzadko),
 * trwale od zaawansowanego; krasnoludy znacznie czesciej, elfy rzadko, stworzenia wcale.
 */
function rollRunic(npc: Npc, rng: Rng, deterministic: boolean): void {
  const data = gd.getTreasures()!;
  if (npc.creature || !data.runic) return;
  const mult = data.runic.raceMult[npc.race] ?? 1;
  for (const temporary of [false, true]) {
    const p = Math.min(1, ((temporary ? data.runic.temporary : data.runic.permanent)[npc.tier] ?? 0) * mult);
    if (deterministic ? p < 0.5 : !chance(p, rng)) continue;
    // Runa tymczasowa trafia na zwykly przedmiot, nie na zbroje z gromrilu.
    const pool = data.items.filter((t) => t.runes && (!temporary || !t.material) && fits(npc, t, npc.magicItems!));
    const t = deterministic ? [...pool].sort((a, b) => b.weight - a.weight)[0] : weightedPick(pool, (x) => x.weight, rng);
    if (!t) continue;
    const item: NpcMagicItem = { template: t.name, name: t.name };
    const base = attach(npc, t, npc.magicItems!);
    if (base) item.base = base;
    item.runes = rollRunes(npc, data.runes[t.runes!], rng, deterministic, temporary);
    if (t.kind === "weapon" && base) item.name = `runiczny ${base.toLowerCase()}`;
    if (temporary) {
      item.temporary = true;
      item.name += " (runa tymczasowa)";
    }
    npc.magicItems!.push(item);
  }
}

function rollChaosProperties(npc: Npc, range: [number, number], rng: Rng, deterministic: boolean): string[] {
  const props = gd.getTreasures()!.chaosProperties;
  const god = npcGod(npc);
  const count = deterministic ? range[1] : randInt(range[0], range[1], rng);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const gods = out.map((n) => props.find((p) => p.name === n)!.god);
    const pool = props.filter(
      (p) =>
        !out.includes(p.name) &&
        (!god || p.god === god || p.god === "Niepodzielny") &&
        !gods.some((g) => CHAOS_ENEMIES[g]?.includes(p.god) || CHAOS_ENEMIES[p.god]?.includes(g))
    );
    const p = deterministic ? pool[0] : pick(pool, rng);
    if (p) out.push(p.name);
  }
  return out;
}

/** Demon broni demonicznej: sluga boga BN (niepodzielny - dowolnego); wiekszy tylko u legendarnych. */
function rollDaemon(npc: Npc, rng: Rng, deterministic: boolean): string | undefined {
  const data = gd.getTreasures()!;
  const gods = Object.keys(data.daemons);
  const god = npcGod(npc) ?? (deterministic ? gods[0] : pick(gods, rng));
  const p = data.greaterDaemonChance[npc.tier] ?? 0;
  const greater = deterministic ? p >= 0.5 : chance(p, rng);
  return god ? data.daemons[god]?.[greater ? "greater" : "lesser"]?.name : undefined;
}

/** Nadaje przedmiotowi konkretna bron/pancerz BN (zastepujac bron danego rodzaju). */
function attach(npc: Npc, t: TreasureDef, owned: NpcMagicItem[]): string | undefined {
  if (t.kind === "weapon") {
    if (!t.replaces) return primaryMelee(npc);
    if (npc.weapons.includes(t.replaces)) return t.replaces;
    const same = t.extra ? undefined : sameGroupWeapon(npc, t.replaces, new Set(owned.map((o) => o.base)));
    if (same) {
      if (npc.craft) delete npc.craft[same];
      npc.weapons[npc.weapons.indexOf(same)] = t.replaces;
    } else npc.weapons.push(t.replaces);
    return t.replaces;
  }
  if (t.kind === "armour") {
    if (t.replaces) return t.replaces;
    if (t.material) {
      // Zbroja z gromrilu/ithilmaru: metalowe elementy dostaja material.
      const mat = gd.getTreasures()!.craft.materials[t.material];
      npc.craft ??= {};
      for (const a of npc.armour) {
        const def = getArmourDef(a);
        if (!def || !mat?.armour?.types.includes(def.type)) continue;
        const cur = npc.craft[a] ?? { qualities: [], flaws: [] };
        npc.craft[a] = { ...cur, flaws: [], material: t.material, qualities: mergeLevels([...cur.qualities.filter((q) => !/^(Wytrzymały|Wyśmienity)/.test(q)), ...mat.armour.qualities]) };
      }
    }
    return "pancerz";
  }
  return undefined;
}

function potionName(npc: Npc, rng: Rng): string | undefined {
  const pool = (gd.getMagicItems()?.items ?? []).filter((i) => i.random && !i.scroll && !i.group && !i.cnMod);
  const owned = new Set((npc.magicItems ?? []).map((m) => m.name));
  return weightedPick(pool.filter((i) => !owned.has(i.name)), (i) => i.random?.weight ?? 1, rng)?.name;
}

/**
 * Przedmioty magiczne BN wg poziomu: kolejne z malejaca szansa (legendarny - co
 * najmniej dwa). Szablony pasujace do BN (rasa, grupa, talent) sa bardziej prawdopodobne.
 */
export function rollTreasures(npc: Npc, rng: Rng, deterministic = false): void {
  npc.magicItems = [];
  const data = gd.getTreasures();
  if (!data || !isRational(npc)) return;
  for (const p of data.chances[npc.tier] ?? []) {
    if (deterministic ? p < 1 : !chance(p, rng)) break;
    const pool = data.items.filter((t) => !t.runes && fits(npc, t, npc.magicItems!));
    const specific = (t: TreasureDef) => !!(t.forRaces || t.forGroups || t.forTalents || t.forLores || t.forBloodlines);
    const weight = (t: TreasureDef) => t.weight * (specific(t) ? data.fitWeight : 1);
    const t = deterministic ? [...pool].sort((a, b) => weight(b) - weight(a))[0] : weightedPick(pool, weight, rng);
    if (!t) break;
    const item: NpcMagicItem = { template: t.name, name: t.name };
    if (t.kind === "potion") {
      const name = potionName(npc, rng);
      if (!name) continue;
      item.name = name;
    }
    const base = attach(npc, t, npc.magicItems);
    if (base) item.base = base;
    if (t.chaos) item.properties = rollChaosProperties(npc, t.chaos, rng, deterministic);
    if (t.daemon) item.daemon = rollDaemon(npc, rng, deterministic);
    npc.magicItems.push(item);
  }
  rollRunic(npc, rng, deterministic);
}

// ---------------------------------------------------------------------------
// Efekty i opisy
// ---------------------------------------------------------------------------

export function findRune(name: string): RuneDef | undefined {
  const r = gd.getTreasures()?.runes;
  return r ? [...r.weapon, ...r.armour, ...r.talisman].find((x) => x.name === name) : undefined;
}

export function findTreasure(name: string): TreasureDef | undefined {
  return gd.getTreasures()?.items.find((t) => t.name === name);
}

export interface MagicEffects {
  chars: Partial<Record<Attribute, number>>;
  wounds: number;
  /** PP na wszystkich lokacjach (talizman, pierscien). */
  apAll: number;
  /** PP tylko tam, gdzie BN ma pancerz (zaklety pancerz, Runa Kamienia). */
  apArmoured: number;
  /** PP na lokacjach konkretnego elementu pancerza. */
  apPiece: Record<string, number>;
  weapon: Record<string, { damage: number; skill: number; qualities: string[]; item: string }>;
}

/** Laczne efekty przedmiotow magicznych BN (liczone w statystykach). */
export function magicEffects(npc: Npc): MagicEffects {
  const out: MagicEffects = { chars: {}, wounds: 0, apAll: 0, apArmoured: 0, apPiece: {}, weapon: {} };
  for (const item of npc.magicItems ?? []) {
    const t = findTreasure(item.template);
    const parts: ItemEffects[] = [
      t?.effects ?? {},
      ...(item.runes ?? []).map((r) => findRune(r)?.effects ?? {}),
      ...(item.properties ?? []).map((p) => gd.getTreasures()?.chaosProperties.find((x) => x.name === p)?.effects ?? {})
    ];
    for (const e of parts) {
      for (const code of ATTRIBUTES) if (e.chars?.[code]) out.chars[code] = (out.chars[code] ?? 0) + e.chars[code]!;
      out.wounds += e.wounds ?? 0;
      if (e.ap) {
        if (t?.kind === "armour" && item.base && item.base !== "pancerz") out.apPiece[item.base] = (out.apPiece[item.base] ?? 0) + e.ap;
        else if (t?.kind === "armour") out.apArmoured += e.ap;
        else out.apAll += e.ap;
      }
      if (t?.kind === "weapon" && item.base && (e.damage || e.skill || e.qualities)) {
        const w = (out.weapon[item.base] ??= { damage: 0, skill: 0, qualities: [], item: item.name });
        w.damage += e.damage ?? 0;
        w.skill += e.skill ?? 0;
        w.qualities.push(...(e.qualities ?? []));
      }
    }
    if (t?.kind === "weapon" && item.base) out.weapon[item.base] ??= { damage: 0, skill: 0, qualities: [], item: item.name };
  }
  return out;
}

/** Pelny opis przedmiotu: szablon, runy (z krotnoscia) i wlasciwosci Broni Chaosu. */
export function describeMagicItem(item: NpcMagicItem): string {
  const t = findTreasure(item.template);
  const potion = t?.kind === "potion" ? gd.getMagicItems()?.items.find((i) => i.name === item.name) : undefined;
  const parts = [potion?.description ?? t?.description ?? ""];
  if (item.temporary) parts[0] = gd.getTreasures()?.runic.temporaryNote ?? "";
  if (item.runes?.length) {
    const counts = new Map<string, number>();
    for (const r of item.runes) counts.set(r, (counts.get(r) ?? 0) + 1);
    parts.push(...[...counts].map(([r, n]) => `${r}${n > 1 ? ` ×${n}` : ""}: ${findRune(r)?.effect ?? ""}`));
  }
  for (const p of item.properties ?? []) {
    const def = gd.getTreasures()?.chaosProperties.find((x) => x.name === p);
    if (def) parts.push(`${p} (${def.god}): ${def.effect}`);
  }
  if (item.daemon) {
    const d = Object.values(gd.getTreasures()?.daemons ?? {})
      .flatMap((v) => Object.values(v))
      .find((x) => x.name === item.daemon);
    if (d) parts.push(`Uwięziony demon — ${d.name}: ${d.benefit}`);
  }
  const src = potion ? `${potion.source ?? ""}${potion.page ? `, s. ${potion.page}` : ""}` : t ? `${t.source}${t.page ? `, s. ${t.page}` : ""}` : "";
  return parts.filter(Boolean).join("\n") + (src ? `\n[${src}]` : "");
}
