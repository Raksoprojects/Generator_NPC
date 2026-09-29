/**
 * Generator BN. Budowa postaci przebiega etapami:
 *
 *   1. archetyp i poziom zaawansowania,
 *   2. rasa, plec, imie                        (sekcja "tozsamosc"),
 *   3. rzuty 2k10 na cechy                     (sekcja "rzuty"),
 *   4. sciezka profesji i rozwoj przez poziomy (sekcja "rozwoj"),
 *   5. cechy opcjonalne i mutacje              (sekcja "cechyStworzen"),
 *   6. profile bohaterow (poziom BN + dowodca), bron, pancerz, zaklecia.
 *
 * Stworzenia z bestiariusza (GenSpec.creature) maja baze cech z ksiazki;
 * bestie rozwijaja sie przez umiejetnosci i Cechy Stworzen (creatures.ts),
 * stworzenia cywilizowane z archetypem - przez profesje jak ludzie.
 *
 * Kazdy parametr GenSpec moze byc ustawiony recznie (tryb pol-losowy) albo
 * pominiety - wtedy jest losowany. rerollNpc() losuje ponownie tylko
 * niezablokowane sekcje istniejacego BN.
 */

import { beastSkills, beastTraits, bookSkillsAndTalents, familyTraitWeights, rollCreature } from "./creatures";
import { chance, defaultRng, pick, randInt, roll2k10, rollDie, rollK100, weightedKey, weightedPick, type Rng } from "./dice";
import { equipNpc } from "./equipment";
import * as gd from "./gameData";
import { pickSpells, rollExtraLores } from "./magic";
import { rollChaosGifts, rollNpcMutations } from "./mutations";
import { rollVampire } from "./vampires";
import { resolveMagicTrappings } from "./magicItems";
import { rollCraft, rollTreasures } from "./treasures";
import { ATTRIBUTES, characteristicBonus, characteristicToCode, type Attribute } from "./rules";
import type { Archetype, CareerStep, CreatureDef, KeyBonus, Npc, NpcSection, Sex, TierDef, TierId } from "./types";
import { TIER_IDS } from "./types";

/** Parametry generowania. Brak pola = wartosc losowa. */
export interface GenSpec {
  /** Stworzenie z bestiariusza zamiast rasy (archetyp tylko dla cywilizowanych). */
  creature?: string;
  /** Bez konkretnego stworzenia: losuj z grupy ("Nieumarli") albo podgrupy ("Chaos › Zwierzoludzie"). */
  creatureGroup?: string;
  /** Linia Krwi wampira (brak = losowa z tabeli k100). */
  bloodline?: string;
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
  const creature = gd.getCreature(race);
  const table = creature
    ? (gd.getNames(creature.subgroup ?? "") ?? gd.getNames(creature.group))
    : (gd.getNames(race) ?? gd.getNames("Człowiek"));
  if (creature && !table) return creature.name;
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

/** Czy rasa moze wykonywac profesje; stworzenia cywilizowane - te dostepne dla ludzi. */
function raceOk(profession: string, race: string): boolean {
  return gd.professionAllowsRace(profession, gd.getCreature(race) ? "Człowiek" : race);
}

function professionCandidates(arch: Archetype, race: string, withFallback = false): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, w] of Object.entries(arch.professions)) {
    if (gd.getProfession(name) && raceOk(name, race)) out[name] = w;
  }
  // Waga <= 0.01 = profesja zapasowa, tylko gdy rasa nie ma innej (np. ogolny Czarodziej dla elfow).
  if (!withFallback && Object.values(out).some((w) => w > 0.01)) {
    for (const [name, w] of Object.entries(out)) if (w <= 0.01) delete out[name];
  }
  if (Object.keys(out).length) return out;
  // Zadna profesja archetypu nie pasuje do rasy - bierzemy dowolna istniejaca.
  for (const [name, w] of Object.entries(arch.professions)) if (gd.getProfession(name)) out[name] = w;
  return out;
}

/** Czy w profesji jest umiejetnosc/talent zaczynajacy sie od ktoregos z przedrostkow. */
function careerHas(name: string, prefixes: string[]): boolean {
  return !!gd.getProfession(name)?.levels.some((l) =>
    [...l.skills, ...l.talents].some((n) => prefixes.some((p) => n.startsWith(p)))
  );
}
const ARCANE = ["Splatanie Magii", "Magia Tajemna"];
const DIVINE = ["Błogosławieństwo", "Cud"];

/**
 * Czarodziej nie zmienia tradycji ani nie bywa wczesniej kaplanem: przed profesja
 * magiczna moze byc inna magiczna tylko, gdy obecna jest profesja renegata (np. Czarownica).
 */
function careerSwitchOk(prev: string, main: string): boolean {
  return !careerHas(main, ARCANE) || !careerHas(prev, [...ARCANE, ...DIVINE]) || !!gd.getProfession(main)?.renegade;
}

/** Druga (wczesniejsza) profesja: inna niz glowna, preferowana ta sama klasa. */
function pickPreviousCareer(arch: Archetype, race: string, main: string, rng: Rng): string | undefined {
  const mainClass = gd.getProfession(main)?.class;
  const cands = professionCandidates(arch, race, true);
  delete cands[main];
  const weights: Record<string, number> = {};
  for (const [name, w] of Object.entries(cands)) {
    if (!raceOk(name, race) || !careerSwitchOk(name, main)) continue;
    weights[name] = w * (gd.getProfession(name)?.class === mainClass ? 2 : 1);
  }
  if (Object.keys(weights).length) return weightedKey(weights, rng);
  // Archetyp nie ma drugiej profesji dla tej rasy - dowolna z tej samej klasy.
  const sameClass = gd.allProfessionNames().filter(
    (p) => p !== main && gd.getProfession(p)?.class === mainClass && raceOk(p, race) && careerSwitchOk(p, main)
  );
  if (sameClass.length) return pick(sameClass, rng);
  // Np. elf czarodziej: jego klasa to same profesje magiczne - wczesniej byl kimkolwiek innym.
  return pick(gd.allProfessionNames().filter((p) => p !== main && raceOk(p, race) && careerSwitchOk(p, main)), rng);
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

  // Legendarni moga dojsc do 5. poziomu, jesli profesja go ma (elfi Mag -> Arcymag).
  if (tier.allowLevel5 && mainLevels === 4 && gd.getProfession(main)?.levels.some((l) => l.level === 5)) mainLevels = 5;

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

/**
 * Rozwiniecia za jeden poziom profesji. Ukonczony poziom daje pelne +5;
 * poziom obecny (ostatni w sciezce, jeszcze w toku) moze dac mniej.
 */
/**
 * Rozwiniecia za poziom profesji. Mnoznik poziomu BN (tiers.json -> advanceMultiplier)
 * zastepuje u ras profile bohaterow: heroiczny rozwija sie w profesji mocniej, niz nakazuje minimum.
 */
function advanceAmount(current: boolean, rng: Rng, deterministic: boolean, mult = 1): number {
  const { advancePerLevel, currentLevelMin } = gd.getSettings();
  const full = Math.round(advancePerLevel * mult);
  if (!current || deterministic) return full;
  return randInt(Math.min(Math.round(currentLevelMin * mult), full), full, rng);
}

/** Profile bohaterow, ktore u ras zastepuje rozwoj profesji (zostaja dla stworzen i do recznego dodania). */
function creatureOnlyProfile(profile: string, creature: boolean): boolean {
  return !creature && !!gd.getSettings().creatureOnlyProfiles?.includes(profile);
}

/** Zamienia rzuty w tekscie na wyniki, np. "3k10 szylingów" -> "17 szylingów". */
export function rollDiceText(text: string, rng: Rng, deterministic = false): string {
  return text.replace(/(\d*)\s?[kK](\d+)/g, (_, count: string, sides: string) => {
    const n = Number(count || 1);
    const s = Number(sides);
    if (deterministic) return String(Math.round((n * (s + 1)) / 2));
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rollDie(s, rng);
    return String(sum);
  });
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

  npc.careerPath.forEach((step, index) => {
    const prof = gd.getProfession(step.profession);
    const lvl = prof?.levels.find((l) => l.level === step.level);
    if (!prof || !lvl) return;
    const current = index === npc.careerPath.length - 1;
    // Stworzenia dostaja profile bohaterow, rasy - mocniejszy rozwoj w profesji.
    const mult = npc.creature ? 1 : (tier?.advanceMultiplier ?? 1);

    for (const code of levelCharacteristics(step.profession, step.level, arch)) {
      npc.charAdvances[code] += advanceAmount(current, rng, deterministic, mult);
    }
    for (const raw of levelSkills(step.profession, step.level)) {
      addSkill(npc, resolveSkill(step.profession, raw), advanceAmount(current, rng, deterministic, mult));
    }

    const chars = approxChars(npc);
    // Talenty z minimalnym poziomem BN (np. Wysoka Magia od heroicznego) nizej nie wypadaja.
    const tierIdx = TIER_IDS.indexOf(npc.tier);
    const pool = lvl.talents
      .filter((t) => TIER_IDS.indexOf(gd.getTalent(t)?.minTier ?? "slaby") <= tierIdx)
      .map((t) => resolveSpecName(t, npc.specChoices, arch, rng, deterministic));
    let picks = tier?.talentsPerLevel ?? 1;
    if (!deterministic && tier && chance(tier.extraTalentChance, rng)) picks += 1;
    const available = [...pool];
    // Talenty tozsamosci archetypu (np. Magia Prosta u czarodzieja) - zawsze.
    for (const t of pool) {
      if (arch?.requiredTalents?.some((r) => matchesKey(t, r))) {
        gainTalent(npc, t, chars);
        available.splice(available.indexOf(t), 1);
      }
    }
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
      for (const raw of lvl.trappings) {
        // "kreda albo dłuto", "koń wierzchowy albo mała łódź" - jedna z możliwości (poza nawiasami).
        const options = raw.includes("(") ? [raw] : raw.split(/\s+albo\s+/);
        const chosen = deterministic ? options[0] : (pick(options, rng) ?? raw);
        const item = rollDiceText(chosen, rng, deterministic);
        if (!npc.trappings.includes(item)) npc.trappings.push(item);
      }
    }
  });

  applyArchetypeBonuses(npc, arch, rng, deterministic);

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

/**
 * Premie archetypu ponad rozwoj z profesji: kilka najwazniejszych umiejetnosci
 * (domyslnie 4) i cech (domyslnie 2). Wysokosc premii i progi zalezne od
 * poziomu BN (tiers.json: keySkills, keyChars) - np. sredni +3..+8 i razem
 * 15..18 rozwiniec, zaawansowany +5..+10 i razem 20..30. Progi nie nachodza
 * na siebie: najslabszy zaawansowany jest lepszy od najsilniejszego sredniego.
 */
function applyArchetypeBonuses(npc: Npc, arch: Archetype | undefined, rng: Rng, deterministic: boolean): void {
  const tier = gd.getTier(npc.tier);
  if (!arch || !tier) return;
  const s = gd.getSettings();
  const roll = ([lo, hi]: [number, number]) => (deterministic ? Math.round((lo + hi) / 2) : randInt(lo, hi, rng));
  const clamp = (v: number, band: KeyBonus) => Math.min(band.max ?? Infinity, Math.max(band.min ?? 0, v));

  arch.keySkills.slice(0, s.keySkillCount).forEach((key) => {
    const bonus = roll(tier.keySkills.bonus);
    const owned = npc.skills.filter((sk) => matchesKey(sk.name, key));
    if (owned.length) {
      // Najbardziej rozwinieta pasujaca umiejetnosc dostaje premie (np. jedna bron).
      const best = owned.sort((a, b) => b.advances - a.advances)[0];
      best.advances = clamp(best.advances + bonus, tier.keySkills);
    } else {
      const value = clamp(bonus, tier.keySkills);
      if (value <= 0) return;
      const name = gd.splitSpec(key).spec === null && gd.getSpecializations().options[key]
        ? resolveSpecName(`${key} (Dowolna)`, npc.specChoices, arch, rng, deterministic)
        : key;
      addSkill(npc, name, value);
    }
  });

  arch.characteristics.slice(0, s.keyCharCount).forEach((code) => {
    npc.charAdvances[code] = clamp(npc.charAdvances[code] + roll(tier.keyChars.bonus), tier.keyChars);
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

/**
 * Losuje cechy opcjonalne bez powtorzen, z wagami archetypu (albo rodziny
 * stworzenia - wtedy cechy spoza rodziny maja wage 0.2).
 */
export function pickTraits(count: number, archetype: string, exclude: string[], rng: Rng, weights?: Record<string, number>): string[] {
  const arch = gd.getArchetype(archetype);
  const def = weights ? 0.2 : gd.getSettings().defaultTraitWeight;
  const table = weights ?? arch?.traits;
  const pool = Object.entries(gd.getCreatureTraits())
    .filter(([name, t]) => t.randomPool && !exclude.includes(name))
    .map(([name]) => name);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const t = weightedPick(pool, (name) => table?.[name] ?? def, rng);
    if (!t) break;
    out.push(t);
    pool.splice(pool.indexOf(t), 1);
  }
  return out;
}

function rollTraits(spec: GenSpec, npc: Npc, rng: Rng): string[] {
  const chosen = [...(spec.traits ?? [])];
  const random = spec.randomTraits ?? !spec.deterministic;
  if (!random) return chosen;
  const weights = isBeast(npc) ? familyTraitWeights(gd.getCreature(npc.creature)) : undefined;
  return [...chosen, ...pickTraits(traitCountForRoll(rollK100(rng)), npc.archetype, chosen, rng, weights)];
}

/** Bestia = stworzenie bez archetypu (rozwoj przez cechy, nie profesje). */
export function isBeast(npc: Pick<Npc, "creature" | "archetype">): boolean {
  return !!npc.creature && !npc.archetype;
}

function heroProfilesFor(spec: GenSpec, tierId: TierId, beast: boolean, rng: Rng, creature: boolean): string[] {
  const out = new Set<string>(spec.heroProfiles ?? []);
  const tier = gd.getTier(tierId);
  const autoOn = !beast && spec.autoHeroProfile !== false;
  if (tier?.heroProfile && autoOn && !creatureOnlyProfile(tier.heroProfile, creature)) out.add(tier.heroProfile);
  // Mala szansa na dodatkowy profil (Weteran, Doborowy, Pomniejszy Bohater) - tylko przy losowaniu.
  if (autoOn && !spec.deterministic && tier?.heroProfileChances?.length) {
    let roll = rng();
    for (const c of tier.heroProfileChances) {
      if (roll < c.chance) {
        if (!creatureOnlyProfile(c.profile, creature)) out.add(c.profile);
        break;
      }
      roll -= c.chance;
    }
  }
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

function rollAttributes(npc: Npc, rng: Rng, deterministic = false): Record<Attribute, number> {
  const arch = gd.getArchetype(npc.archetype);
  const creature = gd.getCreature(npc.creature);
  return creature
    ? rollCreature(creature, arch?.characteristics ?? [], rng, deterministic)
    : rollCharacteristics(arch, rng, deterministic);
}

/**
 * Sekcja "rozwoj": sciezka profesji (ludzie, stworzenia cywilizowane) albo
 * rozwoj bestii, a do tego bron i pancerz.
 */
function develop(npc: Npc, professions: string[] | undefined, rng: Rng, deterministic: boolean): void {
  const creature = gd.getCreature(npc.creature);
  if (creature && isBeast(npc)) {
    npc.careerPath = [];
    npc.charAdvances = emptyAttrs();
    npc.skills = [];
    npc.talents = [];
    npc.specChoices = {};
    bookSkillsAndTalents(npc, creature);
    beastSkills(npc, creature);
    npc.trappings = creature.trappings.map((t) => rollDiceText(t, rng, deterministic));
    npc.weapons = [];
    npc.armour = [];
    npc.craft = {};
    npc.money = "";
    return;
  }
  npc.careerPath = buildCareerPath({ professions }, npc.archetype, npc.tier, npc.race, rng);
  developCareer(npc, rng, deterministic);
  rollExtraLores(npc, rng, deterministic);
  if (creature) bookSkillsAndTalents(npc, creature);
  resolveMagicTrappings(npc, rng, deterministic);
  equipNpc(npc, rng);
  rollCraft(npc, rng, deterministic);
}

/** Sekcja "cechyStworzen": cechy opcjonalne (15/5/1%), cechy poziomu bestii, mutacje. */
function rollFeatures(npc: Npc, spec: GenSpec, rng: Rng, deterministic: boolean): void {
  const creature = gd.getCreature(npc.creature);
  npc.traits = rollTraits(spec, npc, rng);
  if (creature && isBeast(npc)) beastTraits(npc, creature, rng, deterministic);
  const vampire = rollVampire(npc, rng, deterministic, spec.bloodline);
  npc.traits = [...npc.traits, ...vampire.traits.filter((t) => !npc.traits.includes(t))];
  npc.mutations = [
    ...vampire.entries,
    ...rollNpcMutations(creature?.traits ?? [], rng, deterministic),
    ...rollChaosGifts(npc, rng, deterministic)
  ];
}

/** Poziom BN nie nizszy niz minimalny poziom stworzenia (np. Wojownik Chaosu: od zaawansowanego). */
export function clampTier(tier: TierId, creature: CreatureDef | undefined): TierId {
  const min = TIER_IDS.indexOf(creature?.minTier ?? "slaby");
  return TIER_IDS.indexOf(tier) < min ? TIER_IDS[min] : tier;
}

/**
 * Typowe (nie unikatowe) stworzenie z grupy, ktore wystepuje na wybranym poziomie;
 * bez poziomu - dowolne z grupy.
 */
export function pickCreatureFromGroup(group: string, tier: TierId | undefined, rng: Rng): string | undefined {
  const all = gd.creaturesInGroup(group).filter((c) => !c.unique);
  const fits = tier ? all.filter((c) => TIER_IDS.indexOf(c.minTier ?? "slaby") <= TIER_IDS.indexOf(tier)) : all;
  return pick(fits.length ? fits : all, rng)?.name;
}

/** Generuje kompletnego BN wg specyfikacji. */
export function generateNpc(spec: GenSpec = {}, rng: Rng = defaultRng): Npc {
  const creatureName = spec.creature ?? (spec.creatureGroup ? pickCreatureFromGroup(spec.creatureGroup, spec.tier, rng) : undefined);
  const creature: CreatureDef | undefined = gd.getCreature(creatureName);
  const civilized = creature ? gd.isCivilized(creature.name) : false;
  const archetype = creature
    ? (civilized && spec.archetype && gd.getArchetype(spec.archetype) ? spec.archetype : "")
    : pickArchetype(spec, rng);
  const tier = clampTier(pickTier(spec, rng), creature);
  const race = creature ? creature.name : pickRace(spec, archetype, rng);
  const sex: Sex = spec.sex ?? (chance(0.5, rng) ? "M" : "K");
  const det = !!spec.deterministic;
  const beast = !!creature && !archetype;

  const npc: Npc = {
    id: newId(),
    version: 1,
    name: spec.name?.trim() || (beast ? creature!.name : pickName(race, sex, rng)),
    sex,
    race,
    creature: creature?.name,
    archetype,
    tier,
    label: spec.label,
    careerPath: [],
    rolls: emptyAttrs(),
    charAdvances: emptyAttrs(),
    skills: [],
    talents: [],
    traits: [],
    heroProfiles: heroProfilesFor(spec, tier, beast, rng, !!creature),
    weapons: [],
    armour: [],
    spells: [],
    mutations: [],
    trappings: [],
    money: "",
    notes: "",
    specChoices: {},
    locks: {},
    createdAt: new Date().toISOString()
  };
  npc.rolls = rollAttributes(npc, rng, det);
  develop(npc, spec.professions, rng, det);
  rollFeatures(npc, spec, rng, det);
  // Po cechach: przedmioty wampirow zaleza od Linii Krwi.
  rollTreasures(npc, rng, det);
  npc.spells = pickSpells(npc, rng, det);
  return npc;
}

/**
 * Losuje ponownie niezablokowane sekcje BN. Rasa, archetyp i poziom zostaja;
 * zablokowana sekcja "rozwoj" zachowuje sciezke profesji, bron i zaklecia.
 */
export function rerollNpc(npc: Npc, rng: Rng = defaultRng): Npc {
  const next: Npc = structuredClone(npc);
  next.weapons ??= [];
  next.armour ??= [];
  next.spells ??= [];
  next.mutations ??= [];
  const unlocked = (s: NpcSection) => !npc.locks[s];
  if (unlocked("tozsamosc") && !isBeast(next)) {
    next.sex = chance(0.5, rng) ? "M" : "K";
    next.name = pickName(next.race, next.sex, rng);
  }
  if (unlocked("rzuty")) next.rolls = rollAttributes(next, rng);
  if (unlocked("rozwoj")) develop(next, undefined, rng, false);
  // Linia Krwi jest jak rasa - zostaje przy ponownym losowaniu cech.
  const bloodline = npc.mutations?.find((m) => m.kind === "bloodline")?.name;
  if (unlocked("cechyStworzen")) rollFeatures(next, { bloodline }, rng, false);
  if (unlocked("rozwoj")) rollTreasures(next, rng);
  if (unlocked("rozwoj") || unlocked("cechyStworzen")) next.spells = pickSpells(next, rng);
  return next;
}

/**
 * Buduje od nowa rozwoj BN po zmianie rasy, archetypu, poziomu lub profesji
 * w edytorze. Rzuty, imie i cechy stworzen zostaja.
 */
export function rebuildDevelopment(npc: Npc, professions: string[] | undefined, rng: Rng = defaultRng): Npc {
  const next: Npc = structuredClone(npc);
  next.tier = clampTier(next.tier, gd.getCreature(next.creature));
  develop(next, professions, rng, false);
  rollTreasures(next, rng);
  next.spells = pickSpells(next, rng);
  const auto = new Set(TIER_IDS.map((t) => gd.getTier(t)?.heroProfile).filter(Boolean) as string[]);
  // Profil, ktory nowy poziom moze wylosowac (np. zaawansowany Pomniejszy Bohater), zostaje.
  for (const c of gd.getTier(next.tier)?.heroProfileChances ?? []) auto.delete(c.profile);
  next.heroProfiles = next.heroProfiles.filter((h) => !auto.has(h));
  const tierProfile = gd.getTier(next.tier)?.heroProfile;
  if (tierProfile && !isBeast(next) && !creatureOnlyProfile(tierProfile, !!next.creature)) next.heroProfiles.unshift(tierProfile);
  return next;
}
