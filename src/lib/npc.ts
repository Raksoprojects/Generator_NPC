/**
 * Wartosci koncowe BN liczone z danych zrodlowych (computeNpc) oraz
 * tekstowy blok statystyk do kopiowania.
 *
 * Kolejnosc skladania cechy:
 *   baza rasowa + rzut 2k10 + rozwiniecia (lub profil bohatera, patrz
 *   heroProfileMode) + talenty dajace +5 + Cechy Stworzen.
 */

import * as gd from "./gameData";
import { ATTRIBUTES, characteristicBonus, computeWounds, type Attribute } from "./rules";
import type { Npc } from "./types";

export interface CharView {
  code: Attribute;
  base: number;
  roll: number;
  advances: number;
  hero: number;
  talent: number;
  trait: number;
  total: number;
  bonus: number;
}

export interface SkillView {
  name: string;
  attr: string;
  advances: number;
  traitBonus: number;
  total: number;
}

export interface TalentView {
  name: string;
  level: number;
  max: number | null;
  description: string;
  tests: string;
  known: boolean;
}

export interface NpcView {
  chars: Record<Attribute, CharView>;
  skills: SkillView[];
  talents: TalentView[];
  wounds: number;
  movement: number;
  heroTraits: string[];
  career: { profession: string; level: number; title: string; status: string } | null;
  careerPathText: string;
}

/**
 * Modyfikatory profilu bohatera dopasowane do archetypu (heroProfileShape =
 * "archetype"): wartosci profilu sortujemy malejaco i przydzielamy cechom w
 * kolejnosci waznosci archetypu. Zlodziej dostaje wiec +45 do Zwinnosci, a nie
 * do Walki Wreczy. Laczna "sila" profilu sie nie zmienia. Przy "bestiary"
 * profil stosowany jest doslownie jak w Bestiariuszu.
 */
export function shapedHeroModifiers(profile: string, archetype: string): Record<Attribute, number> {
  const mods = gd.getHeroProfile(profile)?.modifiers ?? {};
  const out = Object.fromEntries(ATTRIBUTES.map((c) => [c, mods[c] ?? 0])) as Record<Attribute, number>;
  const arch = gd.getArchetype(archetype);
  if (gd.getSettings().heroProfileShape !== "archetype" || !arch) return out;
  const order = [...arch.characteristics, ...ATTRIBUTES.filter((c) => !arch.characteristics.includes(c))];
  const values = ATTRIBUTES.map((c) => out[c]).sort((a, b) => b - a);
  return Object.fromEntries(order.map((c, i) => [c, values[i]])) as Record<Attribute, number>;
}

/** Suma lub maksimum modyfikatorow profili bohaterow dla cechy. */
function heroModifier(npc: Npc, code: Attribute): number {
  let best = 0;
  let sum = 0;
  for (const name of npc.heroProfiles) {
    const v = shapedHeroModifiers(name, npc.archetype)[code];
    best = Math.max(best, v);
    sum += v;
  }
  return gd.getSettings().heroProfileMode === "add" ? sum : best;
}

/** Tytul i status poziomu profesji. */
export function careerLevelInfo(profession: string, level: number): { title: string; status: string } {
  const lvl = gd.getProfession(profession)?.levels.find((l) => l.level === level);
  return { title: lvl?.title ?? profession, status: lvl?.status ?? "" };
}

/** Limit poziomow talentu dla danych cech (null = brak limitu). */
export function talentMax(name: string, chars: Record<Attribute, number>): number | null {
  const t = gd.getTalent(name);
  if (!t) return null;
  if (t.max.type === "fixed") return t.max.value ?? 1;
  if (t.max.type === "characteristic" && t.max.attr) {
    return Math.max(1, characteristicBonus(chars[t.max.attr as Attribute] ?? 0));
  }
  if (t.max.type === "special") return 1;
  return null;
}

export function computeNpc(npc: Npc): NpcView {
  const race = gd.getRace(npc.race);
  const mode = gd.getSettings().heroProfileMode;

  const talentBonus: Partial<Record<Attribute, number>> = {};
  let hardyLevels = 0;
  for (const t of npc.talents) {
    const def = gd.getTalent(t.name);
    const code = def?.adds_characteristic as Attribute | undefined;
    if (code) talentBonus[code] = (talentBonus[code] ?? 0) + 5;
    if (def?.wounds_toughness_bonus) hardyLevels += t.level;
  }

  const traitBonus: Partial<Record<Attribute, number>> = {};
  const traitSkills: Record<string, number> = {};
  let movement = race?.movement ?? 4;
  for (const name of npc.traits) {
    const tr = gd.getCreatureTrait(name);
    if (!tr) continue;
    for (const [code, v] of Object.entries(tr.modifiers ?? {})) {
      traitBonus[code as Attribute] = (traitBonus[code as Attribute] ?? 0) + (v ?? 0);
    }
    for (const [skill, v] of Object.entries(tr.skills ?? {})) {
      traitSkills[skill] = (traitSkills[skill] ?? 0) + v;
    }
    movement += tr.movement ?? 0;
  }

  const chars = {} as Record<Attribute, CharView>;
  const totals = {} as Record<Attribute, number>;
  for (const code of ATTRIBUTES) {
    const base = race?.characteristics[code] ?? 20;
    const roll = npc.rolls[code] ?? 0;
    const adv = npc.charAdvances[code] ?? 0;
    const heroRaw = heroModifier(npc, code);
    // Tryb "max": profil bohatera liczy sie tylko w czesci przewyzszajacej rozwiniecia.
    const hero = mode === "max" ? Math.max(0, heroRaw - adv) : heroRaw;
    const talent = talentBonus[code] ?? 0;
    const trait = traitBonus[code] ?? 0;
    const total = Math.max(0, base + roll + adv + hero + talent + trait);
    totals[code] = total;
    chars[code] = { code, base, roll, advances: adv, hero, talent, trait, total, bonus: characteristicBonus(total) };
  }

  const skills: SkillView[] = npc.skills.map((s) => {
    const attr = gd.skillAttr(s.name) ?? "Int";
    const bonus = traitSkills[s.name] ?? traitSkills[gd.splitSpec(s.name).base] ?? 0;
    return {
      name: s.name,
      attr,
      advances: s.advances,
      traitBonus: bonus,
      total: (totals[attr as Attribute] ?? 0) + s.advances + bonus
    };
  });
  // Premie z cech do umiejetnosci, ktorych BN nie ma (np. Czujny -> Percepcja).
  for (const [skill, bonus] of Object.entries(traitSkills)) {
    if (skills.some((s) => s.name === skill || gd.splitSpec(s.name).base === skill)) continue;
    const attr = gd.skillAttr(skill) ?? "I";
    skills.push({ name: skill, attr, advances: 0, traitBonus: bonus, total: (totals[attr as Attribute] ?? 0) + bonus });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name, "pl"));

  const talents: TalentView[] = npc.talents.map((t) => {
    const def = gd.getTalent(t.name);
    return {
      name: t.name,
      level: t.level,
      max: talentMax(t.name, totals),
      description: def?.description ?? "",
      tests: def?.tests ?? "",
      known: !!def
    };
  });

  const heroTraits = [...new Set(npc.heroProfiles.flatMap((h) => gd.getHeroProfile(h)?.traits ?? []))];
  if (heroTraits.includes("Twardziel")) hardyLevels += 1;

  const wounds = computeWounds(totals.S, totals.Wt, totals.SW, race?.woundsIncludeStrength ?? true, hardyLevels);

  const last = npc.careerPath[npc.careerPath.length - 1];
  const career = last ? { ...last, ...careerLevelInfo(last.profession, last.level) } : null;

  return {
    chars,
    skills,
    talents,
    wounds,
    movement: Math.max(0, movement),
    heroTraits,
    career,
    careerPathText: careerPathText(npc)
  };
}

/** "Rekrut → Żołnierz → Giermek" - tytuly kolejnych poziomow sciezki. */
export function careerPathText(npc: Npc): string {
  return npc.careerPath.map((s) => careerLevelInfo(s.profession, s.level).title).join(" → ");
}

/** Blok statystyk jako czysty tekst (do notatek sesyjnych). */
export function npcToText(npc: Npc, view: NpcView = computeNpc(npc)): string {
  const tier = gd.getTier(npc.tier)?.label ?? npc.tier;
  const lines: string[] = [];
  const title = npc.label ? `${npc.name} (${npc.label})` : npc.name;
  lines.push(`${title} — ${npc.race}, ${npc.archetype} (${tier})`);
  if (view.career) {
    lines.push(`Profesja: ${view.career.title} (${view.career.profession} ${view.career.level}, ${view.career.status})`);
    lines.push(`Ścieżka: ${view.careerPathText}`);
  }
  lines.push(ATTRIBUTES.map((c) => `${c} ${view.chars[c].total}`).join(" | ") + ` | Żyw ${view.wounds} | Sz ${view.movement}`);
  if (view.skills.length) {
    lines.push("Umiejętności: " + view.skills.map((s) => `${s.name} ${s.total}`).join(", "));
  }
  if (view.talents.length) {
    lines.push("Talenty: " + view.talents.map((t) => (t.level > 1 ? `${t.name} ${t.level}` : t.name)).join(", "));
  }
  if (npc.traits.length || view.heroTraits.length) {
    lines.push("Cechy Stworzeń: " + [...npc.traits, ...view.heroTraits].join(", "));
  }
  if (npc.heroProfiles.length) lines.push("Profil: " + npc.heroProfiles.join(", "));
  if (npc.trappings.length) lines.push("Wyposażenie: " + npc.trappings.join(", "));
  if (npc.money) lines.push("Pieniądze: " + npc.money);
  if (npc.notes.trim()) lines.push("Notatki: " + npc.notes.trim());
  return lines.join("\n");
}
