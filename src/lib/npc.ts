/**
 * Wartosci koncowe BN liczone z danych zrodlowych (computeNpc) oraz
 * tekstowy blok statystyk do kopiowania.
 *
 * Kolejnosc skladania cechy:
 *   baza (rasowa albo z bestiariusza) + rzut + rozwiniecia + profil bohatera
 *   + talenty dajace +5 + wylosowane Cechy Stworzen + mutacje.
 */

import { creatureArmour, creatureBase, creatureWounds, naturalAttacks } from "./creatures";
import { armourPoints, getWeaponDef, LOCATIONS, type Location } from "./equipment";
import * as gd from "./gameData";
import { castingSummary, type CastingView } from "./magicItems";
import { mutationEffects, mutationEffectText, mutationLabel, mutationRow } from "./mutations";
import { ATTRIBUTES, characteristicBonus, computeWounds, type Attribute } from "./rules";
import type { Npc, NpcMutation, Sex, SpellDef } from "./types";

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
  /** Stworzenie nie posiada tej cechy ("–"). */
  absent: boolean;
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

export interface WeaponView {
  name: string;
  /** Obrazenia koncowe (+X) albo null, gdy bron nie zadaje obrazen. */
  damage: number | null;
  /** Wartosc testu (umiejetnosc albo cecha). */
  skill: number;
  skillName: string;
  qualities: string[];
  flaws: string[];
  reach?: string;
  ranged: boolean;
  range?: string;
  note?: string;
  natural: boolean;
}

export interface NpcView {
  chars: Record<Attribute, CharView>;
  skills: SkillView[];
  talents: TalentView[];
  weapons: WeaponView[];
  /** Punkty Pancerza i redukcja obrazen (BWt + PP) na lokacjach. */
  armour: Record<Location, { ap: number; total: number }>;
  armourPenalties: string[];
  spells: SpellDef[];
  mutations: { label: string; effect: string; kind: NpcMutation["kind"] }[];
  /** Cechy ksiazkowe stworzenia (bez zmian w statystykach). */
  creatureTraits: string[];
  abilities: { name: string; description: string }[];
  wounds: number;
  movement: number;
  heroTraits: string[];
  career: { profession: string; level: number; title: string; status: string; professionName: string } | null;
  careerPathText: string;
  /** Czarowanie: Splatanie i Rzucanie z premiami PS, zmiana PZ, reguly tradycji. */
  casting: CastingView | null;
}

/** Cechy, w ktorych profil bohatera zawsze daje wartosc z Bestiariusza. */
const FIXED_HERO_CHARS: readonly Attribute[] = ["S", "Wt"];

/**
 * Stale modyfikatory profilu bohatera dopasowane do archetypu (heroProfileShape =
 * "archetype"). Sila i Wytrzymalosc dostaja zawsze wartosc z Bestiariusza;
 * pozostale wartosci profilu sortujemy malejaco i przydzielamy cechom w
 * kolejnosci waznosci archetypu. Zlodziej dostaje wiec +45 do Zwinnosci, a nie
 * do Walki Wreczy. Wartosci sa stale - nic tu nie jest losowane.
 */
export function shapedHeroModifiers(profile: string, archetype: string): Record<Attribute, number> {
  const mods = gd.getHeroProfile(profile)?.modifiers ?? {};
  const out = Object.fromEntries(ATTRIBUTES.map((c) => [c, mods[c] ?? 0])) as Record<Attribute, number>;
  const arch = gd.getArchetype(archetype);
  if (gd.getSettings().heroProfileShape !== "archetype" || !arch) return out;
  const movable = ATTRIBUTES.filter((c) => !FIXED_HERO_CHARS.includes(c));
  const order = [
    ...arch.characteristics.filter((c) => movable.includes(c)),
    ...movable.filter((c) => !arch.characteristics.includes(c))
  ];
  const values = movable.map((c) => out[c]).sort((a, b) => b - a);
  order.forEach((c, i) => (out[c] = values[i]));
  return out;
}

/** Premia profili bohaterow dla cechy - stala, niezalezna od rozwiniec. */
function heroModifier(npc: Npc, code: Attribute): number {
  return npc.heroProfiles.reduce((sum, name) => sum + shapedHeroModifiers(name, npc.archetype)[code], 0);
}

/** Tytul (w formie dla plci), nazwa profesji i status poziomu. */
export function careerLevelInfo(
  profession: string,
  level: number,
  sex?: Sex
): { title: string; status: string; professionName: string } {
  const lvl = gd.getProfession(profession)?.levels.find((l) => l.level === level);
  return {
    title: gd.professionTitle(profession, level, sex) ?? profession,
    status: lvl?.status ?? "",
    professionName: gd.professionName(profession, sex)
  };
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

/** Uzupelnia pola dodane w nowszych wersjach (stare zapisy z biblioteki). */
export function normalizeNpc(npc: Npc): Npc {
  npc.weapons ??= [];
  npc.armour ??= [];
  npc.spells ??= [];
  npc.mutations ??= [];
  npc.traits ??= [];
  npc.heroProfiles ??= [];
  npc.archetype ??= "";
  return npc;
}

/** PZ zaklecia z uwzglednieniem kostura (tradycje wlasciciela i wspolne tajemne), min. 0. */
export function effectiveCn(spell: SpellDef, casting: CastingView | null): number {
  if (!casting?.cnMod || !casting.cnLores.includes(spell.lore)) return spell.cn;
  return Math.max(0, spell.cn + casting.cnMod);
}

/** Poziom cechy Twardziel z ksiazki ("Twardziel" = 1, "Twardziel 4" = 4). */
function bookHardy(traits: string[]): number {
  const t = traits.find((x) => /^Twardziel/.test(x));
  return t ? Number(/(\d+)\s*$/.exec(t)?.[1] ?? 1) : 0;
}

/** Wartosc testu broni: umiejetnosc z grupy albo sama cecha (bez szkolenia). */
function weaponSkill(skills: SkillView[], chars: Record<Attribute, CharView>, ranged: boolean, group: string): { value: number; name: string } {
  const base = ranged ? "Broń Zasięgowa" : "Broń Biała";
  const exact = skills.find((s) => s.name === `${base} (${group})`);
  if (exact) return { value: exact.total, name: exact.name };
  const code: Attribute = ranged ? "US" : "WW";
  return { value: chars[code].total, name: code };
}

export function computeNpc(input: Npc): NpcView {
  const npc = normalizeNpc(input);
  const creature = gd.getCreature(npc.creature);
  const race = gd.getRace(npc.race);
  const bookTraits = creature?.traits ?? [];

  const talentBonus: Partial<Record<Attribute, number>> = {};
  let hardy = 0;
  // Premie do cech z talentow bloku stworzenia (np. Urodzony Wojownik) sa juz wliczone w jego statystyki.
  const bookTalents = new Set((creature?.talents ?? []).map((t) => gd.normalize(t.replace(/\s+\d+$/, ""))));
  for (const t of npc.talents) {
    const def = gd.getTalent(t.name);
    const code = def?.adds_characteristic as Attribute | undefined;
    if (code && !bookTalents.has(gd.normalize(t.name))) talentBonus[code] = (talentBonus[code] ?? 0) + 5;
    if (def?.wounds_toughness_bonus) hardy += t.level;
  }

  // Wylosowane Cechy Stworzen i mutacje zmieniaja cechy; ksiazkowe juz sa w profilu.
  const traitBonus: Partial<Record<Attribute, number>> = {};
  const traitSkills: Record<string, number> = {};
  let movement = creature ? (creature.stats.Sz ?? 4) : (race?.movement ?? 4);
  let extraAp = 0;
  let headAp = 0;
  const addMods = (mods: Partial<Record<Attribute, number>> | undefined) => {
    for (const [code, v] of Object.entries(mods ?? {})) {
      traitBonus[code as Attribute] = (traitBonus[code as Attribute] ?? 0) + (v ?? 0);
    }
  };
  for (const name of npc.traits) {
    const tr = gd.findCreatureTrait(name)?.trait;
    if (!tr) continue;
    addMods(tr.modifiers);
    for (const [skill, v] of Object.entries(tr.skills ?? {})) traitSkills[skill] = (traitSkills[skill] ?? 0) + v;
    movement += tr.movement ?? 0;
    if (/^Twardziel/.test(name)) hardy += 1;
  }
  let mutationWounds = 0;
  const charCaps: Partial<Record<Attribute, number>> = {};
  const mutations = npc.mutations.map((m) => {
    const row = mutationRow(m);
    const fx = mutationEffects(m, row);
    addMods(fx.chars as Partial<Record<Attribute, number>>);
    for (const [skill, v] of Object.entries(fx.skills)) traitSkills[skill] = (traitSkills[skill] ?? 0) + v;
    for (const [code, cap] of Object.entries(row?.maxChar ?? {})) {
      charCaps[code as Attribute] = Math.min(charCaps[code as Attribute] ?? Infinity, cap ?? Infinity);
    }
    movement += row?.movement ?? 0;
    mutationWounds += row?.wounds ?? 0;
    extraAp += row?.armour ?? 0;
    headAp += row?.headArmour ?? 0;
    return { label: mutationLabel(m), effect: mutationEffectText(m, row), kind: m.kind };
  });

  const chars = {} as Record<Attribute, CharView>;
  const totals = {} as Record<Attribute, number>;
  for (const code of ATTRIBUTES) {
    const cb = creature ? creatureBase(creature, code) : null;
    const absent = !!cb && cb.die === null;
    const base = cb ? cb.base : (race?.characteristics[code] ?? 20);
    const roll = absent ? 0 : (npc.rolls[code] ?? 0);
    const adv = npc.charAdvances[code] ?? 0;
    const hero = heroModifier(npc, code);
    const talent = talentBonus[code] ?? 0;
    const trait = traitBonus[code] ?? 0;
    const total = absent ? 0 : Math.max(0, Math.min(charCaps[code] ?? Infinity, base + roll + adv + hero + talent + trait));
    totals[code] = total;
    chars[code] = { code, base, roll, advances: adv, hero, talent, trait, total, bonus: characteristicBonus(total), absent };
  }

  const skills: SkillView[] = npc.skills.map((s) => {
    const attr = gd.skillAttr(s.name) ?? "Int";
    const bonus = traitSkills[s.name] ?? traitSkills[gd.splitSpec(s.name).base] ?? 0;
    return { name: s.name, attr, advances: s.advances, traitBonus: bonus, total: (totals[attr as Attribute] ?? 0) + s.advances + bonus };
  });
  for (const [skill, bonus] of Object.entries(traitSkills)) {
    if (skills.some((s) => s.name === skill || gd.splitSpec(s.name).base === skill)) continue;
    const attr = gd.skillAttr(skill) ?? "I";
    skills.push({ name: skill, attr, advances: 0, traitBonus: bonus, total: (totals[attr as Attribute] ?? 0) + bonus });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name, "pl"));

  const talents: TalentView[] = npc.talents.map((t) => {
    const def = gd.getTalent(t.name);
    return { name: t.name, level: t.level, max: talentMax(t.name, totals), description: def?.description ?? "", tests: def?.tests ?? "", known: !!def };
  });

  const heroTraits = [...new Set(npc.heroProfiles.flatMap((h) => gd.getHeroProfile(h)?.traits ?? []))];
  if (heroTraits.includes("Twardziel")) hardy += 1;
  const heroWeapon = heroTraits.reduce((sum, t) => sum + (+(/^\+(\d+) do Broni/.exec(t)?.[1] ?? 0)), 0);
  const heroArmour = heroTraits.reduce((sum, t) => sum + (+(/^\+(\d+) do Pancerza/.exec(t)?.[1] ?? 0)), 0);

  const sb = chars.S.bonus;
  const weapons: WeaponView[] = [];
  for (const name of npc.weapons) {
    const w = getWeaponDef(name);
    if (!w) {
      weapons.push({ name, damage: null, skill: totals.WW, skillName: "WW", qualities: [], flaws: [], ranged: false, natural: false });
      continue;
    }
    const { def, ranged } = w;
    const dmg = def.damage == null ? null : def.damage + (def.sb ? sb : 0) + heroWeapon;
    const skill = weaponSkill(skills, chars, ranged, def.group);
    weapons.push({
      name: w.name,
      damage: dmg,
      skill: skill.value,
      skillName: skill.name,
      qualities: def.qualities,
      flaws: def.flaws ?? [],
      reach: def.reach,
      ranged,
      range: ranged ? def.range : undefined,
      note: def.note,
      natural: false
    });
  }
  if (creature) {
    const hasCareerWeapon = npc.weapons.length > 0;
    for (const a of naturalAttacks(creature)) {
      if (hasCareerWeapon && a.name === "Broń") continue;
      const ranged = !!a.range && a.name !== "Język";
      const dmg = a.base + (a.addsSb ? sb : 0) + heroWeapon;
      const skill = ranged
        ? weaponSkill(skills, chars, true, a.name)
        : (() => {
            // Wlasna grupa, Bijatyka, a dla broni ("Broń", "Broń Chaosu i tarcza") najlepsza Broń Biała.
            const melee = skills.filter((s) => s.name.startsWith("Broń Biała")).sort((x, y) => y.total - x.total);
            const bodyPart = /^(Ugryzienie|Ogon|Rogi|Macki|Pazury|Zmutowany|Kły|Szpony)/.test(a.name);
            const own =
              skills.find((s) => s.name === `Broń Biała (${a.name})`) ??
              (bodyPart ? skills.find((s) => s.name === "Broń Biała (Bijatyka)") : melee[0]) ??
              skills.find((s) => s.name === "Broń Biała (Bijatyka)");
            return own ? { value: own.total, name: own.name } : { value: totals.WW, name: "WW" };
          })();
      weapons.push({
        name: a.count && a.count > 1 ? `${a.count}× ${a.name}` : a.name,
        damage: dmg,
        skill: skill.value,
        skillName: skill.name,
        qualities: [],
        flaws: [],
        ranged,
        range: a.range,
        natural: true
      });
    }
  }

  const ap = armourPoints(npc.armour);
  // Pancerz z ksiazki u stworzen cywilizowanych to ich zwykla zbroja - zastepuje ja pancerz z profesji.
  const bookAp = npc.armour.length && npc.archetype ? 0 : creatureArmour(bookTraits);
  const flatAp = bookAp + extraAp + heroArmour;
  const armour = {} as Record<Location, { ap: number; total: number }>;
  for (const loc of LOCATIONS) {
    const points = ap[loc] + flatAp + (loc === "głowa" ? headAp : 0);
    armour[loc] = { ap: points, total: points + chars.Wt.bonus };
  }
  const armourPenalties = [
    ...new Set(npc.armour.map((a) => gd.getWeapons().armour[a]?.penalty).filter(Boolean) as string[])
  ];

  const wounds =
    mutationWounds +
    (creature
      ? creatureWounds(totals.S, totals.Wt, chars.SW.absent ? null : totals.SW, bookTraits, hardy + bookHardy(bookTraits))
      : computeWounds(totals.S, totals.Wt, totals.SW, race?.woundsIncludeStrength ?? true, hardy));

  const spells = npc.spells.map((n) => gd.getSpell(n)).filter(Boolean) as SpellDef[];
  spells.sort((a, b) => (a.lore === "Prosta" ? -1 : 0) - (b.lore === "Prosta" ? -1 : 0) || a.cn - b.cn || a.name.localeCompare(b.name, "pl"));

  const last = npc.careerPath[npc.careerPath.length - 1];
  const career = last ? { ...last, ...careerLevelInfo(last.profession, last.level, npc.sex) } : null;

  return {
    chars,
    skills,
    talents,
    weapons,
    armour,
    armourPenalties,
    spells,
    mutations,
    creatureTraits: bookTraits,
    abilities: creature?.abilities ?? [],
    wounds,
    movement: Math.max(0, movement),
    heroTraits,
    career,
    careerPathText: careerPathText(npc),
    casting: castingSummary(npc, skills, chars)
  };
}

/** "Rekrut → Żołnierz → Giermek" - tytuly kolejnych poziomow sciezki. */
export function careerPathText(npc: Npc): string {
  return npc.careerPath.map((s) => careerLevelInfo(s.profession, s.level, npc.sex).title).join(" → ");
}

/** "Miecz (+8/52)" - bron w formacie bloku statystyk. */
export function weaponLabel(w: WeaponView): string {
  const dmg = w.damage == null ? "–" : `+${w.damage}`;
  const range = w.range ? `, zasięg ${w.range}` : "";
  return `${w.name} (${dmg}/${w.skill}${range})`;
}

const LOCATION_LABELS: Record<Location, string> = { głowa: "Głowa", ręce: "Ręce", korpus: "Korpus", nogi: "Nogi" };

export function armourLine(view: NpcView): string {
  return LOCATIONS.map((l) => `${LOCATION_LABELS[l]} ${view.armour[l].total}`).join(" · ");
}

/** Blok statystyk jako czysty tekst (do notatek sesyjnych). */
export function npcToText(input: Npc, view: NpcView = computeNpc(input)): string {
  const npc = normalizeNpc(input);
  const tier = gd.getTier(npc.tier)?.label ?? npc.tier;
  const lines: string[] = [];
  const title = npc.label ? `${npc.name} (${npc.label})` : npc.name;
  lines.push(`${title} — ${npc.race}${npc.archetype ? `, ${npc.archetype}` : ""} (${tier})`);
  if (view.career) {
    lines.push(`Profesja: ${view.career.title} (${view.career.professionName} ${view.career.level}, ${view.career.status})`);
    if (npc.careerPath.length > 1) lines.push(`Ścieżka: ${view.careerPathText}`);
  }
  const stat = (c: Attribute) => (view.chars[c].absent ? "–" : String(view.chars[c].total));
  lines.push(ATTRIBUTES.map((c) => `${c} ${stat(c)}`).join(" | ") + ` | Żyw ${view.wounds} | Sz ${view.movement}`);
  for (const w of view.weapons) {
    const extra = [
      w.qualities.length ? `Zalety: ${w.qualities.join(", ")}` : "",
      w.flaws.length ? `Wady: ${w.flaws.join(", ")}` : ""
    ].filter(Boolean);
    lines.push(`Broń: ${weaponLabel(w)}${extra.length ? " — " + extra.join("; ") : ""}`);
  }
  lines.push(`Redukcja obrażeń (BWt+PP): ${armourLine(view)}`);
  if (npc.armour.length) lines.push("Pancerz: " + npc.armour.join(", "));
  if (view.skills.length) lines.push("Umiejętności: " + view.skills.map((s) => `${s.name} ${s.total}`).join(", "));
  if (view.talents.length) lines.push("Talenty: " + view.talents.map((t) => (t.level > 1 ? `${t.name} ${t.level}` : t.name)).join(", "));
  if (view.casting) {
    const c = view.casting;
    const sl = (n: number) => (n ? ` (+${n} PS)` : "");
    lines.push(`Czarowanie: ${c.channel.name} ${c.channel.value}${sl(c.channel.sl)}, ${c.cast.name} ${c.cast.value}${sl(c.cast.sl)}${c.cnMod ? `, PZ ${c.cnMod}` : ""}`);
  }
  if (view.spells.length) lines.push("Zaklęcia: " + view.spells.map((s) => `${s.name} (PZ ${effectiveCn(s, view.casting)})`).join(", "));
  const traits = [...view.creatureTraits, ...npc.traits, ...view.heroTraits];
  if (traits.length) lines.push("Cechy Stworzeń: " + traits.join(", "));
  if (view.abilities.length) lines.push("Zdolności: " + view.abilities.map((a) => `${a.name} — ${a.description}`).join(" "));
  if (view.mutations.length) lines.push("Mutacje: " + view.mutations.map((m) => `${m.label} (${m.effect})`).join(", "));
  if (npc.heroProfiles.length) lines.push("Profil: " + npc.heroProfiles.join(", "));
  if (npc.trappings.length) lines.push("Wyposażenie: " + npc.trappings.join(", "));
  if (npc.money) lines.push("Pieniądze: " + npc.money);
  if (npc.notes.trim()) lines.push("Notatki: " + npc.notes.trim());
  return lines.join("\n");
}
