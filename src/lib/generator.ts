/**
 * Generator BN. Budowa postaci przebiega etapami:
 *
 *   1. archetyp i poziom zaawansowania,
 *   2. rasa, plec, imie                        (sekcja "tozsamosc"),
 *   3. rzuty 2k10 na cechy                     (sekcja "rzuty"),
 *   4. sciezka profesji i rozwoj przez poziomy (sekcja "rozwoj"),
 *   5. cechy opcjonalne (Cechy Stworzen)       (sekcja "cechyStworzen"),
 *   6. profile bohaterow (poziom BN + dowodca).
 *
 * Kazdy parametr GenSpec moze byc ustawiony recznie (tryb pol-losowy) albo
 * pominiety - wtedy jest losowany. rerollNpc() losuje ponownie tylko
 * niezablokowane sekcje istniejacego BN.
 */

import { chance, defaultRng, pick, randInt, roll2k10, rollDie, rollK100, weightedKey, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import { ATTRIBUTES, characteristicBonus, characteristicToCode, type Attribute } from "./rules";
import type { Archetype, CareerStep, Npc, NpcSection, Sex, TierDef, TierId } from "./types";
import { TIER_IDS } from "./types";

/** Parametry generowania. Brak pola = wartosc losowa. */
export interface GenSpec {
  race?: string;
  sex?: Sex;
  name?: string;
  archetype?: string;
  tier?: TierId;
  /** Profesje sciezki w kolejnosci (ostatnia = obecna). */
  professions?: string[];
  /** Cechy Stworzen wybrane recznie. */
  traits?: string[];
  /** Czy dolosowac cechy opcjonalne (15/5/1%). Domyslnie tak. */
  randomTraits?: boolean;
  /** Dodatkowe profile bohaterow. */
  heroProfiles?: string[];
  /** Czy nalozyc profil bohatera wynikajacy z poziomu BN. Domyslnie tak. */
  autoHeroProfile?: boolean;
  /** Dodaje profil Dowodcy Oddzialu. */
  commander?: boolean;
  label?: string;
  /** Tryb "wlasny": srednie rzuty, bez losowych odchylen i cech opcjonalnych. */
  deterministic?: boolean;
}

export const COMMANDER_PROFILE = "Dowódca Oddziału";
const LORE_KEY = "__lore";

// ---------------------------------------------------------------------------
// Etap 1-2: archetyp, poziom, rasa, tozsamosc
// ---------------------------------------------------------------------------

export function pickArchetype(spec: GenSpec, rng: Rng): string {
  if (spec.archetype && gd.getArchetype(spec.archetype)) return spec.archetype;
  return pick(gd.allArchetypeNames(), rng) ?? "Wojownik";
}

export function pickTier(spec: GenSpec, rng: Rng): TierId {
  if (spec.tier) return spec.tier;
  const tiers = gd.getTiers();
  return weightedPick(TIER_IDS, (id) => tiers[id]?.randomWeight ?? 0, rng) ?? "slaby";
}

/** Rasy, dla ktorych archetyp ma chociaz jedna profesje. */
export function racesForArchetype(archetype: string): string[] {
  const arch = gd.getArchetype(archetype);
  if (!arch) return gd.allRaceNames();
  const profs = Object.keys(arch.professions);
  return gd.allRaceNames().filter((race) => profs.some((p) => gd.professionAllowsRace(p, race)));
}

/** Rasa losowana wg tabeli k100 (Czlowiek 90%), zawezona do ras archetypu. */
export function pickRace(spec: GenSpec, archetype: string, rng: Rng): string {
  if (spec.race && gd.getRace(spec.race)) return spec.race;
  const allowed = racesForArchetype(archetype);
  const pool = allowed.length ? allowed : gd.allRaceNames();
  return (
    weightedPick(pool, (r) => {
      const def = gd.getRace(r);
      return def ? def.randomMax - def.randomMin + 1 : 0;
    }, rng) ?? "Człowiek"
  );
}

export function pickName(race: string, sex: Sex, rng: Rng): string {
  const table = gd.getNames(race) ?? gd.getNames("Człowiek");
  if (!table) return "Bezimienny";
  const first = pick(sex === "K" ? table.female : table.male, rng) ?? "Bezimienny";
  const last = pick(table.surnames, rng);
  return last ? `${first} ${last}` : first;
}

// ---------------------------------------------------------------------------
// Etap 3: rzuty na cechy
// ---------------------------------------------------------------------------

/**
 * Rzuty 2k10 na wszystkie cechy. W kluczowych cechach archetypu wynik ponizej
 * minKeyRoll jest przerzucany (wojownik nie bywa miernota w WW).
 */
export function rollCharacteristics(archetype: Archetype | undefined, rng: Rng, deterministic = false): Record<Attribute, number> {
  const min = gd.getSettings().minKeyRoll;
  const key = new Set(archetype?.characteristics ?? []);
  const out = {} as Record<Attribute, number>;
  for (const code of ATTRIBUTES) {
    if (deterministic) {
      out[code] = key.has(code) ? Math.max(11, min) : 11;
      continue;
    }
    let roll = roll2k10(rng);
    for (let i = 0; key.has(code) && roll < min && i < 50; i++) roll = roll2k10(rng);
    out[code] = key.has(code) ? Math.max(roll, min) : roll;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Etap 4: sciezka profesji
// ---------------------------------------------------------------------------

function professionCandidates(arch: Archetype, race: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, w] of Object.entries(arch.professions)) {
    if (gd.getProfession(name) && gd.professionAllowsRace(name, race)) out[name] = w;
  }
  if (Object.keys(out).length) return out;
  // Zadna profesja archetypu nie pasuje do rasy - bierzemy dowolna istniejaca.
  for (const [name, w] of Object.entries(arch.professions)) if (gd.getProfession(name)) out[name] = w;
  return out;
}

/** Druga (wczesniejsza) profesja: inna niz glowna, preferowana ta sama klasa. */
function pickPreviousCareer(arch: Archetype, race: string, main: string, rng: Rng): string | undefined {
  const mainClass = gd.getProfession(main)?.class;
  const cands = professionCandidates(arch, race);
  delete cands[main];
  const weights: Record<string, number> = {};
  for (const [name, w] of Object.entries(cands)) {
    if (!gd.professionAllowsRace(name, race)) continue;
    weights[name] = w * (gd.getProfession(name)?.class === mainClass ? 2 : 1);
  }
  if (Object.keys(weights).length) return weightedKey(weights, rng);
  // Archetyp nie ma drugiej profesji dla tej rasy - dowolna z tej samej klasy.
  const sameClass = gd.allProfessionNames().filter(
    (p) => p !== main && gd.getProfession(p)?.class === mainClass && gd.professionAllowsRace(p, race)
  );
  return pick(sameClass, rng);
}

/** Podzial laczniej liczby poziomow na [poprzednia, glowna] profesje. */
function splitLevels(tier: TierDef, total: number, forceTwo: boolean, rng: Rng): [number, number] {
  if (tier.requireLevel4) return [Math.min(Math.max(0, total - 4), 3), 4];
  const maxL = tier.maxCareerLevel;
  const canSingle = total <= maxL;
  const canSplit = tier.maxCareers > 1 && total >= 2;
  if (canSingle && (!canSplit || (!forceTwo && chance(0.5, rng)))) return [0, total];
  if (!canSplit) return [0, Math.min(total, maxL)];
  // Glowna (obecna) profesja dostaje co najmniej polowe poziomow.
  const mainMin = Math.max(Math.ceil(total / 2), total - maxL);
  const mainMax = Math.min(maxL, total - 1);
  const main = randInt(mainMin, mainMax, rng);
  return [total - main, main];
}

export function buildCareerPath(spec: GenSpec, archetype: string, tierId: TierId, race: string, rng: Rng): CareerStep[] {
  const arch = gd.getArchetype(archetype);
  const tier = gd.getTier(tierId);
  if (!arch || !tier) return [];
  const chosen = (spec.professions ?? []).filter((p) => gd.getProfession(p));
  const total = Number(weightedKey(tier.totalLevels, rng) ?? 1);

  const main = chosen[chosen.length - 1] ?? weightedKey(professionCandidates(arch, race), rng);
  if (!main) return [];
  let [prevLevels, mainLevels] = splitLevels(tier, total, chosen.length > 1, rng);
  let prev: string | undefined;
  if (prevLevels > 0) {
    prev = chosen.length > 1 ? chosen[chosen.length - 2] : pickPreviousCareer(arch, race, main, rng);
    if (!prev) {
      mainLevels = Math.min(total, tier.maxCareerLevel);
      prevLevels = 0;
    }
  }

  const steps: CareerStep[] = [];
  if (prev) for (let l = 1; l <= prevLevels; l++) steps.push({ profession: prev, level: l });
  for (let l = 1; l <= mainLevels; l++) steps.push({ profession: main, level: l });
  return steps;
}

// ---------------------------------------------------------------------------
// Specjalizacje ("Dowolna", "Miasto albo Wieś", szkoly magii, bostwa)
// ---------------------------------------------------------------------------

function linkedKey(base: string): string {
  const group = gd.getSpecializations().linked.find((g) => g.includes(base));
  return group ? group[0] : base;
}

/** Zapamietuje konkretna szkole magii / bostwo, by kolejne "Dowolne" do nich pasowaly. */
function registerConcrete(base: string, spec: string, choices: Record<string, string>): void {
  const lores = gd.getSpecializations().lores;
  if (!choices[LORE_KEY]) {
    const lore = lores.find((l) => (base === "Magia Tajemna" && l.lore === spec) || (base === "Splatanie Magii" && l.wind === spec));
    if (lore) choices[LORE_KEY] = lore.lore;
  }
  if (gd.getSpecializations().linked.some((g) => g.includes(base))) {
    const key = linkedKey(base);
    if (!choices[key]) choices[key] = spec;
  }
}

function weightedSpec(base: string, options: string[], arch: Archetype | undefined, rng: Rng, deterministic: boolean): string {
  const prefs = arch?.specializations?.[base];
  const weight = (o: string) => (prefs ? (prefs[o] ?? 0.2) : 1);
  if (deterministic) return [...options].sort((a, b) => weight(b) - weight(a))[0];
  return weightedPick(options, weight, rng) ?? options[0];
}

/**
 * Zamienia nazwe ze schematu profesji na konkretna, np.
 * "Broń Biała (Dowolna)" -> "Broń Biała (Dwuręczna)".
 */
export function resolveSpecName(
  name: string,
  choices: Record<string, string>,
  arch: Archetype | undefined,
  rng: Rng,
  deterministic = false
): string {
  const { base, spec } = gd.splitSpec(name);
  if (spec === null) return name;

  const alternatives = gd.specAlternatives(spec);
  if (alternatives) {
    const remembered = choices[linkedKey(base)];
    const choice = remembered && alternatives.includes(remembered) ? remembered : weightedSpec(base, alternatives, arch, rng, deterministic);
    return `${base} (${choice})`;
  }

  if (!gd.isOpenSpec(spec)) {
    registerConcrete(base, spec, choices);
    return name;
  }

  // Szkola magii: Magia Tajemna i Splatanie Magii musza do siebie pasowac.
  if (base === "Magia Tajemna" || base === "Splatanie Magii") {
    const lores = gd.getSpecializations().lores;
    let lore = lores.find((l) => l.lore === choices[LORE_KEY]);
    if (!lore) {
      lore = deterministic ? lores[0] : (pick(lores, rng) ?? lores[0]);
      choices[LORE_KEY] = lore.lore;
    }
    return `${base} (${base === "Magia Tajemna" ? lore.lore : lore.wind})`;
  }

  const options = gd.getSpecializations().options[base];
  if (!options?.length) return name;

  // Archetyp z preferencjami (np. bron wojownika) losuje za kazdym razem.
  if (arch?.specializations?.[base]) return `${base} (${weightedSpec(base, options, arch, rng, deterministic)})`;

  const key = linkedKey(base);
  if (!choices[key]) choices[key] = deterministic ? options[0] : (pick(options, rng) ?? options[0]);
  return `${base} (${choices[key]})`;
}

// ---------------------------------------------------------------------------
// Etap 4b: rozwoj przez poziomy profesji
// ---------------------------------------------------------------------------

/** Cechy dostepne na danym poziomie profesji (narastajaco od poziomu 1). */
export function levelCharacteristics(profession: string, level: number, arch: Archetype | undefined): Attribute[] {
  const prof = gd.getProfession(profession);
  const out = new Set<Attribute>();
  for (const lvl of prof?.levels ?? []) {
    if (lvl.level > level) continue;
    for (const c of lvl.characteristics) {
      const code = characteristicToCode(c);
      if (code) out.add(code);
    }
  }
  // Profesja bez rozpisanych cech: 3 pierwsze cechy archetypu + 1 na kazdy kolejny poziom.
  if (out.size === 0 && arch) arch.characteristics.slice(0, 2 + level).forEach((c) => out.add(c));
  return [...out];
}

/** Umiejetnosci dostepne na danym poziomie profesji (narastajaco). */
export function levelSkills(profession: string, level: number): string[] {
  const prof = gd.getProfession(profession);
  const out: string[] = [];
  for (const lvl of prof?.levels ?? []) {
    if (lvl.level > level) continue;
    for (const s of lvl.skills) {
      const clean = s.trim().replace(/\+$/, "").trim();
      if (!out.includes(clean)) out.push(clean);
    }
  }
  return out;
}

function matchesKey(name: string, key: string): boolean {
  if (name === key) return true;
  const n = gd.normalize(name);
  const k = gd.normalize(key);
  return n === k || gd.normalize(gd.splitSpec(name).base) === k;
}

function talentWeight(arch: Archetype | undefined, name: string): number {
  if (!arch) return 1;
  for (const [key, w] of Object.entries(arch.talents)) if (matchesKey(name, key)) return w;
  return 1;
}

function approxChars(npc: Npc): Record<Attribute, number> {
  const race = gd.getRace(npc.race);
  const out = {} as Record<Attribute, number>;
  for (const c of ATTRIBUTES) out[c] = (race?.characteristics[c] ?? 20) + (npc.rolls[c] ?? 0) + (npc.charAdvances[c] ?? 0);
  return out;
}

function talentCap(name: string, chars: Record<Attribute, number>): number {
  const t = gd.getTalent(name);
  if (!t) return 1;
  if (t.max.type === "fixed") return t.max.value ?? 1;
  if (t.max.type === "characteristic" && t.max.attr) return Math.max(1, characteristicBonus(chars[t.max.attr as Attribute] ?? 0));
  if (t.max.type === "special") return 1;
  return gd.getSettings().unlimitedTalentCap;
}

/** Dodaje talent albo podnosi jego poziom (w granicach maksimum). */
function gainTalent(npc: Npc, name: string, chars: Record<Attribute, number>): boolean {
  const owned = npc.talents.find((t) => t.name === name);
  if (!owned) {
    npc.talents.push({ name, level: 1 });
    return true;
  }
  if (owned.level < talentCap(name, chars)) {
    owned.level += 1;
    return true;
  }
  return false;
}

function addSkill(npc: Npc, name: string, advances: number): void {
  const owned = npc.skills.find((s) => s.name === name);
  if (owned) owned.advances += advances;
  else npc.skills.push({ name, advances });
}

function advanceAmount(rng: Rng, deterministic: boolean): number {
  const { advancePerLevel, advanceJitter } = gd.getSettings();
  if (deterministic) return advancePerLevel;
  return Math.max(1, advancePerLevel + randInt(-advanceJitter, advanceJitter, rng));
}

function emptyAttrs(): Record<Attribute, number> {
  return Object.fromEntries(ATTRIBUTES.map((c) => [c, 0])) as Record<Attribute, number>;
}

/**
 * Przeprowadza BN przez sciezke profesji: rozwiniecia cech i umiejetnosci,
 * talenty, wyposazenie, pieniadze oraz premie kluczowe archetypu.
 */
export function developCareer(npc: Npc, rng: Rng, deterministic = false): void {
  const arch = gd.getArchetype(npc.archetype);
  const tier = gd.getTier(npc.tier);
  npc.charAdvances = emptyAttrs();
  npc.skills = [];
  npc.talents = [];
  npc.trappings = [];
  npc.specChoices = {};

  // Konkretne szkoly/bostwa z calej sciezki - zanim zaczniemy rozwiazywac "Dowolne".
  for (const step of npc.careerPath) {
    for (const lvl of gd.getProfession(step.profession)?.levels ?? []) {
      if (lvl.level > step.level) continue;
      for (const n of [...lvl.skills, ...lvl.talents]) {
        const { base, spec } = gd.splitSpec(n);
        if (spec && !gd.isOpenSpec(spec) && !gd.specAlternatives(spec)) registerConcrete(base, spec, npc.specChoices);
      }
    }
  }

  // Umiejetnosci "Dowolne" rozwiazujemy raz na profesje, by rozwiniecia sie kumulowaly.
  const resolvedSkills = new Map<string, string>();
  const resolveSkill = (profession: string, raw: string) => {
    const key = `${profession}|${raw}`;
    if (!resolvedSkills.has(key)) resolvedSkills.set(key, resolveSpecName(raw, npc.specChoices, arch, rng, deterministic));
    return resolvedSkills.get(key)!;
  };

  for (const step of npc.careerPath) {
    const prof = gd.getProfession(step.profession);
    const lvl = prof?.levels.find((l) => l.level === step.level);
    if (!prof || !lvl) continue;

    for (const code of levelCharacteristics(step.profession, step.level, arch)) {
      npc.charAdvances[code] += advanceAmount(rng, deterministic);
    }
    for (const raw of levelSkills(step.profession, step.level)) {
      addSkill(npc, resolveSkill(step.profession, raw), advanceAmount(rng, deterministic));
    }

    const chars = approxChars(npc);
    const pool = lvl.talents.map((t) => resolveSpecName(t, npc.specChoices, arch, rng, deterministic));
    let picks = tier?.talentsPerLevel ?? 1;
    if (!deterministic && tier && chance(tier.extraTalentChance, rng)) picks += 1;
    const available = [...pool];
    for (let i = 0; i < picks && available.length; i++) {
      const choice = deterministic
        ? [...available].sort((a, b) => talentWeight(arch, b) - talentWeight(arch, a))[0]
        : weightedPick(available, (t) => talentWeight(arch, t), rng);
      if (!choice) break;
      available.splice(available.indexOf(choice), 1);
      if (!gainTalent(npc, choice, chars)) i--;
    }

    // Wyposazenie tylko z obecnej profesji - poprzednia zostawila po sobie najwyzej wspomnienia.
    if (step.profession === npc.careerPath[npc.careerPath.length - 1].profession) {
      for (const item of lvl.trappings) if (!npc.trappings.includes(item)) npc.trappings.push(item);
    }
  }

  applyArchetypeBonuses(npc, arch, tier, rng, deterministic);

  // Poziomy talentow: szansa na kolejny poziom za kazdy poziom profesji ponad pierwszy.
  if (tier && !deterministic) {
    const chars = approxChars(npc);
    for (let i = 1; i < npc.careerPath.length; i++) {
      if (!chance(tier.talentLevelUpChance, rng)) continue;
      const growable = npc.talents.filter((t) => t.level < talentCap(t.name, chars));
      const t = weightedPick(growable, (x) => talentWeight(arch, x.name), rng);
      if (t) t.level += 1;
    }
  }

  const last = npc.careerPath[npc.careerPath.length - 1];
  npc.money = last ? rollMoney(gd.getProfession(last.profession)?.levels.find((l) => l.level === last.level)?.status ?? "", rng, deterministic) : "";
}

/** Premie archetypu: wiecej w kluczowych umiejetnosciach i cechach (skalowane poziomem BN). */
function applyArchetypeBonuses(npc: Npc, arch: Archetype | undefined, tier: TierDef | undefined, rng: Rng, deterministic: boolean): void {
  if (!arch || !tier) return;
  const roll = (lo: number, hi: number) => (deterministic ? Math.round((lo + hi) / 2) : randInt(lo, hi, rng));

  const skillMax = tier.keySkillBonus;
  arch.keySkills.forEach((key, index) => {
    const primary = index < 2;
    const bonus = primary ? roll(Math.ceil(skillMax / 2), skillMax) : roll(0, Math.ceil(skillMax / 2));
    const owned = npc.skills.filter((s) => matchesKey(s.name, key));
    if (owned.length) {
      // Najbardziej rozwinieta pasujaca umiejetnosc dostaje premie (np. jedna bron).
      owned.sort((a, b) => b.advances - a.advances)[0].advances += bonus;
    } else if (bonus > 0) {
      const name = gd.splitSpec(key).spec === null && gd.getSpecializations().options[key]
        ? resolveSpecName(`${key} (Dowolna)`, npc.specChoices, arch, rng, deterministic)
        : key;
      addSkill(npc, name, bonus);
    }
  });

  const charMax = tier.keyCharBonus;
  arch.characteristics.slice(0, 3).forEach((code, index) => {
    npc.charAdvances[code] += index < 2 ? roll(0, charMax) : roll(0, Math.ceil(charMax / 2));
  });
}

/** Pieniadze wg Statusu: Braz = 2k10 x poziom pensow, Srebro = 1k10 x poziom szylingow, Zloto = poziom koron. */
export function rollMoney(status: string, rng: Rng, deterministic = false): string {
  const m = /^(Brąz|Srebro|Złoto)\s*(\d+)/i.exec(status.trim());
  if (!m) return "";
  const standing = Number(m[2]);
  if (standing <= 0) return "brak";
  const tierName = m[1].toLowerCase();
  if (tierName === "brąz") {
    const roll = deterministic ? 11 : rollDie(10, rng) + rollDie(10, rng);
    return `${roll * standing} p`;
  }
  if (tierName === "srebro") return `${(deterministic ? 5 : rollDie(10, rng)) * standing} s`;
  return `${standing} zk`;
}

// ---------------------------------------------------------------------------
// Etap 5-6: cechy opcjonalne i profile bohaterow
// ---------------------------------------------------------------------------

/** Liczba cech opcjonalnych z jednego rzutu k100 (domyslnie 1: 3 cechy, 2-5: 2, 6-20: 1). */
export function traitCountForRoll(roll: number): number {
  for (const row of gd.getSettings().traitRoll) if (roll <= row.upTo) return row.count;
  return 0;
}

/** Losuje cechy opcjonalne bez powtorzen, z wagami archetypu. */
export function pickTraits(count: number, archetype: string, exclude: string[], rng: Rng): string[] {
  const arch = gd.getArchetype(archetype);
  const def = gd.getSettings().defaultTraitWeight;
  const pool = Object.entries(gd.getCreatureTraits())
    .filter(([name, t]) => t.randomPool && !exclude.includes(name))
    .map(([name]) => name);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const t = weightedPick(pool, (name) => arch?.traits?.[name] ?? def, rng);
    if (!t) break;
    out.push(t);
    pool.splice(pool.indexOf(t), 1);
  }
  return out;
}

function rollTraits(spec: GenSpec, archetype: string, rng: Rng): string[] {
  const chosen = [...(spec.traits ?? [])];
  const random = spec.randomTraits ?? !spec.deterministic;
  if (!random) return chosen;
  return [...chosen, ...pickTraits(traitCountForRoll(rollK100(rng)), archetype, chosen, rng)];
}

function heroProfilesFor(spec: GenSpec, tierId: TierId): string[] {
  const out = new Set<string>(spec.heroProfiles ?? []);
  const auto = gd.getTier(tierId)?.heroProfile;
  if (auto && spec.autoHeroProfile !== false) out.add(auto);
  if (spec.commander) out.add(COMMANDER_PROFILE);
  return [...out];
}

// ---------------------------------------------------------------------------
// Skladanie BN
// ---------------------------------------------------------------------------

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `npc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generuje kompletnego BN wg specyfikacji. */
export function generateNpc(spec: GenSpec = {}, rng: Rng = defaultRng): Npc {
  const archetype = pickArchetype(spec, rng);
  const tier = pickTier(spec, rng);
  const race = pickRace(spec, archetype, rng);
  const sex: Sex = spec.sex ?? (chance(0.5, rng) ? "M" : "K");
  const det = !!spec.deterministic;

  const npc: Npc = {
    id: newId(),
    version: 1,
    name: spec.name?.trim() || pickName(race, sex, rng),
    sex,
    race,
    archetype,
    tier,
    label: spec.label,
    careerPath: [],
    rolls: rollCharacteristics(gd.getArchetype(archetype), rng, det),
    charAdvances: emptyAttrs(),
    skills: [],
    talents: [],
    traits: [],
    heroProfiles: heroProfilesFor(spec, tier),
    trappings: [],
    money: "",
    notes: "",
    specChoices: {},
    locks: {},
    createdAt: new Date().toISOString()
  };
  npc.careerPath = buildCareerPath(spec, archetype, tier, race, rng);
  developCareer(npc, rng, det);
  npc.traits = rollTraits(spec, archetype, rng);
  return npc;
}

/**
 * Losuje ponownie niezablokowane sekcje BN. Rasa, archetyp i poziom zostaja;
 * zablokowana sekcja "rozwoj" zachowuje sciezke profesji.
 */
export function rerollNpc(npc: Npc, rng: Rng = defaultRng): Npc {
  const next: Npc = structuredClone(npc);
  const unlocked = (s: NpcSection) => !npc.locks[s];
  if (unlocked("tozsamosc")) {
    next.sex = chance(0.5, rng) ? "M" : "K";
    next.name = pickName(next.race, next.sex, rng);
  }
  if (unlocked("rzuty")) next.rolls = rollCharacteristics(gd.getArchetype(next.archetype), rng);
  if (unlocked("rozwoj")) {
    next.careerPath = buildCareerPath({}, next.archetype, next.tier, next.race, rng);
    developCareer(next, rng);
  }
  if (unlocked("cechyStworzen")) {
    next.traits = pickTraits(traitCountForRoll(rollK100(rng)), next.archetype, [], rng);
  }
  return next;
}

/**
 * Buduje od nowa rozwoj BN po zmianie rasy, archetypu, poziomu lub profesji
 * w edytorze. Rzuty, imie i cechy stworzen zostaja.
 */
export function rebuildDevelopment(npc: Npc, professions: string[] | undefined, rng: Rng = defaultRng): Npc {
  const next: Npc = structuredClone(npc);
  next.careerPath = buildCareerPath({ professions }, next.archetype, next.tier, next.race, rng);
  developCareer(next, rng);
  const auto = new Set(TIER_IDS.map((t) => gd.getTier(t)?.heroProfile).filter(Boolean) as string[]);
  next.heroProfiles = next.heroProfiles.filter((h) => !auto.has(h));
  const tierProfile = gd.getTier(next.tier)?.heroProfile;
  if (tierProfile) next.heroProfiles.unshift(tierProfile);
  return next;
}
