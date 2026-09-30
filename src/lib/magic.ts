/**
 * Dobor zaklec dla BN czarujacych.
 *
 * - Magia Prosta: okolo Bonusu z Siły Woli zaklec (±1).
 * - Tradycja tajemna: Bonus z Inteligencji + odchylenie zalezne od poziomu BN
 *   (tiers.json -> spells.arcane), z PZ nie wyzszym niz spells.maxCn.
 *   Zawsze co najmniej jedno zaklecie z gornej polki dostepnej dla poziomu.
 * - Poczatkujacy (maxCn = 0) znaja tylko Magie Prosta.
 */

import { chance, pick, randInt, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import { computeNpc } from "./npc";
import type { Npc, SpellDef } from "./types";

const CHAOS_LORES = ["Nurgla", "Slaanesha", "Tzeentcha"];
const COLLEGE_LORES = ["Ognia", "Metalu", "Życia", "Niebios", "Cieni", "Śmierci", "Światła", "Zwierząt"];

/**
 * Wlasna Magia Prosta i wspolne zaklecia tajemne tradycji (Grimuar): druidzi maja
 * druidzka Magie Prosta, skaveny i zielonoskorzy - swoja i nie znaja wspolnych
 * zaklec tajemnych, czarownicy Chaosu dostaja tez tajemne zaklecia Chaosu.
 */
const LORE_FAMILY: Record<string, { petty?: string; common: string[] }> = {
  "Pór Roku": { petty: "Prosta (Druidzka)", common: ["Tajemna"] },
  Spaczenia: { petty: "Prosta (Spaczenie)", common: [] },
  "Najmniejszego Waaagh!": { petty: "Prosta (Waaagh!)", common: [] },
  "Wielkiego Waaagh!": { petty: "Prosta (Waaagh!)", common: [] },
  Nurgla: { common: ["Tajemna", "Tajemna Chaosu"] },
  Slaanesha: { common: ["Tajemna", "Tajemna Chaosu"] },
  Tzeentcha: { common: ["Tajemna", "Tajemna Chaosu"] },
};
const familyOf = (lore: string) => LORE_FAMILY[lore] ?? { common: ["Tajemna"] };

/** Tradycja Wysokiej Magii (talent Wysoka Magia) i Elfie Zaklecia Tajemne laczace dwa Wiatry. */
const HIGH_MAGIC = "Wysokiej Magii";
const ELVEN_COMBINED = "Elfie";
const isElf = (race: string) => /elf/i.test(race);

/** Tradycja z opisu cechy "Rzucanie Czarów (…)" - moze zawierac alternatywy. */
function loreFromTrait(spec: string, rng: Rng): string | undefined {
  const s = spec.toLowerCase();
  if (/dowoln|różne/.test(s) && !s.includes("chaos")) return pick(COLLEGE_LORES, rng);
  const options = spec
    .split(/\s*,\s*|\s+albo\s+|\s+lub\s+/)
    .map((o) => o.replace(/dowolna tradycja|tradycji|tradycja/gi, "").trim())
    .filter(Boolean);
  const resolved: string[] = [];
  for (const o of options) {
    if (/chaos/i.test(o)) resolved.push(pick(CHAOS_LORES, rng) ?? "Tzeentcha");
    else if (/nekromanc/i.test(o)) resolved.push("Nekromancji");
    else if (/demonolog/i.test(o)) resolved.push("Demonologii");
    else if (/nurgl/i.test(o)) resolved.push("Nurgla");
    else if (/slaanesh/i.test(o)) resolved.push("Slaanesha");
    else if (/tzeentch/i.test(o)) resolved.push("Tzeentcha");
    else if (/spacze|skave/i.test(o)) resolved.push("Spaczenia");
    else if (/waaagh|ork/i.test(o)) resolved.push(/najmniejsz|goblin/i.test(o) ? "Najmniejszego Waaagh!" : "Wielkiego Waaagh!");
    else if (/elementali|żywioł/i.test(o)) resolved.push("Elementalizmu");
    else if (/pór roku|druid/i.test(o)) resolved.push("Pór Roku");
    else {
      const key = gd.spellLoreKey(o);
      if (key) resolved.push(key);
    }
  }
  return pick(resolved, rng);
}

/**
 * Cecha z wyborem ("Rzucanie Czarów (Śmierci albo Cieni)", "(Dowolna Tradycja)") -> jedna
 * konkretna opcja, jak przy wyposazeniu. Pozostale cechy bez zmian.
 */
export function resolveTraitChoice(trait: string, rng: Rng, deterministic = false): string {
  const m = /^(.*?)\((.+)\)(.*)$/.exec(trait);
  if (!m) return trait;
  const [, head, inner, tail] = m;
  if (/^Rzucanie Czarów/.test(head) && /dowoln|różne/i.test(inner) && !/chaos/i.test(inner)) {
    return `${head}(${deterministic ? COLLEGE_LORES[0] : pick(COLLEGE_LORES, rng)})${tail}`;
  }
  if (!/\s(albo|lub)\s/.test(inner)) return trait;
  const options = inner.split(/,\s*|\s+albo\s+|\s+lub\s+/).filter(Boolean);
  return `${head}(${deterministic ? options[0] : pick(options, rng)})${tail}`;
}

/** Czy BN czaruje i z jakich tradycji (z talentow oraz cech stworzenia). */
export function casterLores(npc: Npc, rng: Rng): { petty: boolean; lores: string[] } {
  let petty = false;
  const lores = new Set<string>();
  // Kaplan elfow: tradycja boga (Magia Vaula...) jest glowna, przed kolorami i Wysoka Magia.
  const own = gd.getProfession(npc.careerPath.at(-1)?.profession ?? "")?.spellLore;
  if (own && npc.talents.some((t) => t.name === "Wysoka Magia")) lores.add(own);
  for (const t of npc.talents) {
    const { base, spec } = gd.splitSpec(t.name);
    if (base === "Magia Prosta") petty = true;
    if (base === "Wysoka Magia") lores.add(HIGH_MAGIC);
    if ((base === "Magia Tajemna" || base === "Magia Chaosu") && spec) {
      const key = base === "Magia Chaosu" ? loreFromTrait(spec, rng) : gd.spellLoreKey(spec) ?? loreFromTrait(spec, rng);
      if (key) lores.add(key);
    }
  }
  const creature = gd.getCreature(npc.creature);
  const book = (creature?.traits ?? []).map((t) => gd.resolvedBookTrait(npc.specChoices, t));
  for (const tr of [...book, ...npc.traits]) {
    const m = /^Rzucanie Czarów \((.+)\)$/.exec(tr);
    if (!m) continue;
    petty = true;
    const key = loreFromTrait(m[1], rng);
    if (key) lores.add(key);
  }
  return { petty, lores: [...lores] };
}

/**
 * Elfy nie sa zwiazane jednym kolegium: od zaawansowanego ich czarodzieje moga
 * poznac kolejne tradycje (tiers.json -> spells.extraLores, settings.multiLoreRaces).
 * Kazda nowa to talent Magia Tajemna i Splatanie Magii jej wiatru na polowie rozwiniec.
 */
export function rollExtraLores(npc: Npc, rng: Rng, deterministic = false): void {
  const chances = gd.getTier(npc.tier)?.spells.extraLores ?? [];
  if (deterministic || !chances.length || !gd.getSettings().multiLoreRaces?.includes(npc.race)) return;
  const colleges = gd.getSpecializations().lores;
  const known = new Set<string>();
  for (const t of npc.talents) {
    const { base, spec } = gd.splitSpec(t.name);
    if (base === "Magia Tajemna" && spec) known.add(gd.spellLoreKey(spec) ?? spec);
  }
  if (!known.size) return;
  const channel = Math.max(0, ...npc.skills.filter((s) => s.name.startsWith("Splatanie Magii")).map((s) => s.advances));
  // Elf moze znac tyle tradycji, ile wynosi jego Bonus z Siły Woli (Wysokie Elfy, s. 79).
  const cap = bonuses(npc).wp;
  for (const c of chances) {
    if (known.size >= cap || !chance(c, rng)) break;
    const lore = pick(colleges.filter((l) => !known.has(gd.spellLoreKey(l.lore) ?? l.lore)), rng);
    if (!lore) break;
    known.add(gd.spellLoreKey(lore.lore) ?? lore.lore);
    npc.talents.push({ name: `Magia Tajemna (${lore.lore})`, level: 1 });
    const skill = `Splatanie Magii (${lore.wind})`;
    if (!npc.skills.some((s) => s.name === skill)) npc.skills.push({ name: skill, advances: Math.floor(channel / 2) });
  }
}

/** Bonusy z Siły Woli i Inteligencji z pelnych wartosci BN (z profilem bohatera i cechami). */
function bonuses(npc: Npc): { wp: number; int: number } {
  const v = computeNpc(npc);
  return { wp: v.chars.SW.bonus, int: v.chars.Int.bonus };
}

/** Wybiera zaklecia dla BN (nazwy z spells.json). */
export function pickSpells(npc: Npc, rng: Rng, deterministic = false): string[] {
  const { petty, lores } = casterLores(npc, rng);
  if (!petty && !lores.length) return [];
  const tier = gd.getTier(npc.tier);
  const all = gd.getSpellsData().spells;
  const { wp, int } = bonuses(npc);
  const out: string[] = [];

  // Wlasna Magia Prosta tradycji (skaveny, zielonoskorzy) zastepuje zwykla; druidzi maja obie.
  const ownPetty = lores.map((l) => familyOf(l).petty).filter(Boolean) as string[];
  const replacesPetty = lores.some((l) => familyOf(l).petty && !familyOf(l).common.includes("Tajemna"));
  const pettyLores = new Set([...(replacesPetty ? [] : ["Prosta"]), ...ownPetty]);
  const pettyPool = all.filter((s) => pettyLores.has(s.lore));
  let pettyCount = Math.max(1, wp + (deterministic ? 0 : randInt(-1, 1, rng)));
  // Stworzenie czarujace z cechy: i proste czary zaleza od wprawy w Jezyku (Magicznym), nie od samej SW.
  const incantationAdv = npc.skills.find((s) => s.name === "Język (Magiczny)")?.advances;
  const traitCaster = !!npc.creature && !npc.talents.some((t) => /^Magia (Tajemna|Chaosu|Prosta)/.test(t.name));
  if (traitCaster && incantationAdv !== undefined) pettyCount = 1 + Math.floor(incantationAdv / 8);
  out.push(...drawSpells(pettyPool, pettyCount, () => 1, rng, deterministic).map((s) => s.name));
  // Elfy znaja tez Magie Prosta Ishy; Mag musi znac co najmniej cztery (Wysokie Elfy, s. 79-80).
  if (!replacesPetty && isElf(npc.race)) {
    const mage = npc.careerPath.some((s) => s.profession === "Mag");
    const elven = all.filter((s) => s.lore === "Prosta (Elfia)");
    out.push(...drawSpells(elven, mage ? 4 : 1 + (deterministic ? 0 : randInt(0, 1, rng)), () => 1, rng, deterministic).map((s) => s.name));
    pettyLores.add("Prosta (Elfia)");
  }

  const maxCn = tier?.spells.maxCn ?? 0;
  if (!lores.length || maxCn <= 0) return out;

  const loreSet = new Set(lores);
  const common = new Set(lores.flatMap((l) => familyOf(l).common));
  const arcanePool = all.filter(
    (s) => !pettyLores.has(s.lore) && (loreSet.has(s.lore) || common.has(s.lore)) && s.cn <= maxCn && !out.includes(s.name)
  );
  if (!arcanePool.length) return out;
  const [lo, hi] = tier?.spells.arcane ?? [0, 0];
  let count = Math.max(1, int + (deterministic ? Math.round((lo + hi) / 2) : randInt(lo, hi, rng)));
  // Stworzenie czarujace z cechy (wampir, szaman): zaklec tyle, ile pozwala wprawa w Jezyku (Magicznym).
  const incantation = npc.skills.find((s) => s.name === "Język (Magiczny)");
  const talentCaster = npc.talents.some((t) => /^Magia (Tajemna|Chaosu)/.test(t.name));
  if (npc.creature && !talentCaster && incantation) count = 1 + Math.floor(incantation.advances / 6);
  count = Math.min(count, arcanePool.length);

  // Najsilniejsze zaklecia glownej tradycji (gorna polka osiagalna na tym poziomie):
  // 1 u sredniego, 3 u heroicznego, 4 u legendarnego (tiers.json -> spells.topSpells).
  const [mainLore, ...extraLores] = lores;
  const mainPool = arcanePool.filter((s) => s.lore === mainLore);
  const topCn = Math.max(...(mainPool.length ? mainPool : arcanePool).map((s) => s.cn));
  const topPool = (mainPool.length ? mainPool : arcanePool).filter((s) => s.cn >= Math.max(1, topCn - 3));
  const topCount = Math.min(tier?.spells.topSpells ?? 1, count);
  out.push(...drawSpells(topPool, topCount, (s) => s.cn, rng, deterministic).map((s) => s.name));

  // Kolejne tradycje (elfy, Wysoka Magia): druga dostaje polowe zaklec glownej, trzecia jedna trzecia.
  const rest = arcanePool.filter((s) => !out.includes(s.name) && !extraLores.includes(s.lore));
  const weight = (s: SpellDef) => (s.lore === mainLore ? 3 : 1);
  out.push(...drawSpells(rest, count - topCount, weight, rng, deterministic).map((s) => s.name));
  const mainCount = out.filter((n) => gd.getSpell(n)?.lore === mainLore).length;
  extraLores.forEach((lore, i) => {
    const pool = arcanePool.filter((s) => s.lore === lore && !out.includes(s.name));
    const n = Math.max(1, Math.round(mainCount / (i + 2)));
    out.push(...drawSpells(pool, n, (s) => s.cn, rng, deterministic).map((s) => s.name));
  });

  // Elfie Zaklecia Tajemne: tylko gdy BN zna obie laczone tradycje; kazde z polowa szans.
  const combined = all.filter(
    (s) => s.lore === ELVEN_COMBINED && s.cn <= maxCn && (s.requires ?? []).every((l) => loreSet.has(l))
  );
  for (const s of combined) if (deterministic || chance(0.5, rng)) out.push(s.name);
  return out;
}

export interface SpellBookLore {
  lore: string;
  label: string;
  /** Cecha Rzucanie Czarów: stworzenie zna wszystkie zaklecia tej tradycji. */
  allKnown: boolean;
  spells: SpellDef[];
}

/** Wszystkie zaklecia tradycji BN do przegladania: tradycje glowne, ich wspolne zaklecia i Magia Prosta. */
export function spellBook(npc: Npc): SpellBookLore[] {
  const { petty, lores } = casterLores(npc, () => 0);
  const data = gd.getSpellsData();
  const creature = gd.getCreature(npc.creature);
  const traitLores = new Set<string>();
  for (const tr of [...(creature?.traits ?? []).map((t) => gd.resolvedBookTrait(npc.specChoices, t)), ...npc.traits]) {
    const m = /^Rzucanie Czarów \((.+)\)$/.exec(tr);
    const key = m && loreFromTrait(m[1], () => 0);
    if (key) traitLores.add(key);
  }
  const known = npc.spells.map((n) => gd.getSpell(n)?.lore).filter(Boolean) as string[];
  const replacesPetty = lores.some((l) => familyOf(l).petty && !familyOf(l).common.includes("Tajemna"));
  const order = [
    ...lores,
    ...(lores.some((l) => isElf(npc.race) || l === HIGH_MAGIC) ? [ELVEN_COMBINED] : []),
    ...lores.flatMap((l) => familyOf(l).common),
    ...(petty && !replacesPetty ? ["Prosta"] : []),
    ...lores.map((l) => familyOf(l).petty ?? ""),
    ...(petty && isElf(npc.race) ? ["Prosta (Elfia)"] : []),
    ...known,
  ];
  const loreSet = new Set(lores);
  return [...new Set(order)]
    .filter(Boolean)
    .map((lore) => ({
      lore,
      label: data.lores[lore]?.label ?? lore,
      allKnown: traitLores.has(lore),
      spells: data.spells
        .filter((s) => s.lore === lore && (lore !== ELVEN_COMBINED || (s.requires ?? []).every((l) => loreSet.has(l))))
        .sort((a, b) => a.cn - b.cn || a.name.localeCompare(b.name, "pl")),
    }))
    .filter((g) => g.spells.length);
}

function drawSpells(pool: SpellDef[], count: number, weight: (s: SpellDef) => number, rng: Rng, deterministic: boolean): SpellDef[] {
  const left = [...pool];
  const out: SpellDef[] = [];
  for (let i = 0; i < count && left.length; i++) {
    const s = deterministic ? [...left].sort((a, b) => weight(b) - weight(a) || b.cn - a.cn)[0] : weightedPick(left, weight, rng);
    if (!s) break;
    out.push(s);
    left.splice(left.indexOf(s), 1);
  }
  return out;
}
