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
import { advanceCost, CAREER_STEP_COST, CLASS_CHANGE_EXTRA, levelRequirement, nextAdvanceCost, talentCost } from "./xp";
import { chance, defaultRng, pick, randInt, roll2k10, rollDie, rollK100, weightedKey, weightedPick, type Rng } from "./dice";
import { equipNpc } from "./equipment";
import * as gd from "./gameData";
import { addCasterSkills, pickSpells, resolveTraitChoice, rollExtraLores } from "./magic";
import { rollChaosGifts, rollNpcMutations } from "./mutations";
import { findBloodline, isVampire, npcBloodline, rollBloodline, rollVampire, stripVampireArmour, vampireArchetype, vampireProfessions } from "./vampires";
import { resolveMagicTrappings } from "./magicItems";
import { rollPersona } from "./persona";
import { rollCraft, rollTreasures } from "./treasures";
import { ATTRIBUTES, characteristicBonus, characteristicToCode, type Attribute } from "./rules";
import type { Archetype, CareerStep, CreatureDef, Npc, NpcSection, Sex, TierDef, TierId } from "./types";
import { TIER_IDS } from "./types";

/** Parametry generowania. Brak pola = wartosc losowa. */
export interface GenSpec {
  /** Stworzenie z bestiariusza zamiast rasy (archetyp tylko dla cywilizowanych). */
  creature?: string;
  /** Bez konkretnego stworzenia: losuj z grupy ("Nieumarli") albo podgrupy ("Chaos › Zwierzoludzie"). */
  creatureGroup?: string;
  /** Linia Krwi wampira (brak = losowa z tabeli k100). */
  bloodline?: string;
  /** Stworzenie rozumne bez profesji (jak bestia), nawet jesli zwykle ja ma. */
  noArchetype?: boolean;
  /** Jedyne dozwolone profesje (np. Strigoi - proste, dzikie). */
  onlyProfessions?: string[];
  /** Wampir przemieniony z czlowieka (profesje za zycia + premie Linii Krwi) zamiast profilu z bestiariusza. */
  turned?: boolean;
  race?: string;
  sex?: Sex;
  name?: string;
  archetype?: string;
  tier?: TierId;
  /** PD do wydania zamiast budzetu poziomu (bez poziomu - poziom wg PD). */
  xp?: number;
  /** PD dodane do budzetu poziomu. */
  xpBonus?: number;
  /** Profesje sciezki w kolejnosci (ostatnia = obecna). */
  professions?: string[];
  /** Cechy Stworzen wybrane recznie. */
  traits?: string[];
  /** Czy dolosowac cechy opcjonalne (15/5/1%). Domyslnie tak. */
  randomTraits?: boolean;
  /** Dodatkowe profile bohaterow. */
  heroProfiles?: string[];
  /** Dodaje profil Dowodcy Oddzialu. */
  commander?: boolean;
  label?: string;
  /** Tryb "wlasny": srednie rzuty, bez losowych odchylen i cech opcjonalnych. */
  deterministic?: boolean;
  /**
   * Dokladna sciezka (edycja poglebiona): profesje po kolei z poziomem docelowym; brak poziomu
   * w ostatniej - program dobiera sam. Sciezka jest realizowana nawet ponad budzet PD (npc.xp.spent
   * > budget), a karta proponuje dodanie brakujacych PD albo zmiane sciezki.
   */
  path?: PathStep[];
  /** Stworzenie wybrane jak rasa (ogr): zawsze z archetypem, dowolny archetyp. */
  asRace?: boolean;
}

/** Krok sciezki podanej recznie. Pusta profesja w ostatnim kroku - wg archetypu. */
export interface PathStep {
  profession: string;
  level?: number | null;
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
 * Rzuty 2k10 na wszystkie cechy; najwyzsze trafiaja do kluczowych cech archetypu.
 */
export function rollCharacteristics(archetype: Archetype | undefined, rng: Rng, deterministic = false): Record<Attribute, number> {
  return assignRolls([...ATTRIBUTES], archetype?.characteristics ?? [], rng, deterministic);
}

/**
 * Rzuty 2k10 dla podanych cech: najwyzsze trafiaja do cech kluczowych archetypu (w ich kolejnosci),
 * reszta losowo. Bez minimum rzutu - zdarzaja sie i slabsi, i silniejsi BN.
 */
export function assignRolls(codes: Attribute[], keys: Attribute[], rng: Rng, deterministic = false): Record<Attribute, number> {
  const out = {} as Record<Attribute, number>;
  if (deterministic) {
    for (const c of codes) out[c] = 11;
    return out;
  }
  const rolls = codes.map(() => roll2k10(rng)).sort((a, b) => b - a);
  const keyCodes = keys.filter((k) => codes.includes(k));
  keyCodes.forEach((k, i) => (out[k] = rolls[i]));
  const rest = rolls.slice(keyCodes.length);
  for (const c of codes.filter((c) => !keyCodes.includes(c))) out[c] = rest.splice(Math.floor(rng() * rest.length), 1)[0];
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
 * Nie-mag nie bywa wczesniej magiem - inaczej mialby czary bez tradycji w obecnej profesji.
 */
function careerSwitchOk(prev: string, main: string): boolean {
  if (!careerHas(main, ARCANE)) return !careerHas(prev, ARCANE);
  return !careerHas(prev, [...ARCANE, ...DIVINE]) || !!gd.getProfession(main)?.renegade;
}

/** Druga (wczesniejsza) profesja: inna niz glowna, preferowana ta sama klasa. */
function pickPreviousCareer(arch: Archetype, race: string, main: string, rng: Rng, only?: string[], taken: string[] = []): string | undefined {
  const mainClass = gd.getProfession(main)?.class;
  const cands = professionCandidates(arch, race, true);
  delete cands[main];
  for (const t of taken) delete cands[t];
  const weights: Record<string, number> = {};
  for (const [name, w] of Object.entries(cands)) {
    if (!raceOk(name, race) || !careerSwitchOk(name, main) || firstLevel(name) > 1) continue;
    weights[name] = w * (gd.getProfession(name)?.class === mainClass ? 2 : 1);
  }
  if (Object.keys(weights).length) return weightedKey(weights, rng);
  // Archetyp nie ma kolejnej profesji dla tej rasy - dowolna z tej samej klasy.
  const usable = (p: string) =>
    p !== main && !taken.includes(p) && raceOk(p, race) && careerSwitchOk(p, main) && firstLevel(p) === 1 && (!only?.length || only.includes(p));
  const sameClass = gd.allProfessionNames().filter((p) => gd.getProfession(p)?.class === mainClass && usable(p));
  if (sameClass.length) return pick(sameClass, rng);
  // Np. elf czarodziej: jego klasa to same profesje magiczne - wczesniej byl kimkolwiek innym.
  return pick(gd.allProfessionNames().filter(usable), rng);
}


/** 4. poziom profesji z 5. poziomem (elfi Mag -> Arcymag) przechodzi na 5. z szansa poziomu BN. */
function maybeLevel5(profession: string, level: number, tier: TierDef, rng: Rng): number {
  const has5 = gd.getProfession(profession)?.levels.some((l) => l.level === 5);
  return level === 4 && has5 && chance(tier.level5Chance ?? 0, rng) ? 5 : level;
}

const firstLevel = (profession: string) => Math.min(...(gd.getProfession(profession)?.levels.map((l) => l.level) ?? [1]));


/** Archetyp ograniczony do dozwolonych profesji; gdy zadna nie zostaje - same dozwolone. */
function restrictArchetype(arch: Archetype | undefined, only: string[] | undefined): Archetype | undefined {
  if (!arch || !only?.length) return arch;
  const kept = Object.fromEntries(Object.entries(arch.professions).filter(([p]) => only.includes(p)));
  return { ...arch, professions: Object.keys(kept).length ? kept : Object.fromEntries(only.map((p) => [p, 1])) };
}

/** Krok planu sciezki: profesja, poziom startowy i docelowy. Ostatni krok - profesja glowna. */
export interface CareerPlanStep {
  profession: string;
  start: number;
  target: number;
  /** Poziom docelowy podany recznie - osiagany nawet ponad budzet PD. */
  fixed?: boolean;
}

const maxLevelOf = (profession: string) => Math.max(...(gd.getProfession(profession)?.levels.map((l) => l.level) ?? [1]));

/**
 * Plan profesji BN: 0..maxCareers-1 wczesniejszych (cel 1.-3. poziom) i glowna (cel 4., a 5. z szansa
 * poziomu BN). Ile z planu BN faktycznie przejdzie, rozstrzyga budzet PD (developByXp).
 */
export function buildCareerPlan(spec: GenSpec, archetype: string, tierId: TierId, race: string, rng: Rng): CareerPlanStep[] {
  const arch = restrictArchetype(gd.getArchetype(archetype), spec.onlyProfessions);
  const tier = gd.getTier(tierId);
  if (!arch || !tier) return [];
  const chosen = (spec.professions ?? []).filter((p) => gd.getProfession(p));

  // Profesje zaczynajace sie od wyzszego poziomu (kaplani) tylko tam, gdzie da sie do nich dojsc.
  const minOk = (p: string) => TIER_IDS.indexOf(gd.getProfession(p)?.minTier ?? "slaby") <= TIER_IDS.indexOf(tierId);
  const candidates = Object.fromEntries(Object.entries(professionCandidates(arch, race)).filter(([p]) => minOk(p)));
  // Nic nie zostalo (np. elfi kaplan na nizszym poziomie) - profesja wejsciowa kaplanow (Mag).
  const entries = Object.keys(professionCandidates(arch, race))
    .map((p) => gd.getProfession(p)?.entry?.from)
    .filter((p): p is string => !!p && raceOk(p, race));
  const fallback = entries.length ? Object.fromEntries(entries.map((p) => [p, 1])) : professionCandidates(arch, race);
  const main = chosen[chosen.length - 1] ?? weightedKey(Object.keys(candidates).length ? candidates : fallback, rng);
  if (!main) return [];
  const mainTarget = maybeLevel5(main, Math.min(4, maxLevelOf(main)), tier, rng);

  const def = gd.getProfession(main)!;
  // Profesja zaawansowana (elfi kaplani): najpierw profesja wejsciowa (Mag 1-2), potem kaplan od 3. poziomu.
  if (firstLevel(main) > 1 && def.entry) {
    return [
      { profession: def.entry.from, start: 1, target: def.entry.level },
      { profession: main, start: firstLevel(main), target: Math.max(firstLevel(main), mainTarget) }
    ];
  }
  const manual = chosen.slice(0, -1);
  const count = chosen.length ? manual.length : randInt(0, Math.max(0, tier.maxCareers - 1), rng);
  const plan: CareerPlanStep[] = [];
  const taken: string[] = [];
  for (let i = 0; i < count; i++) {
    const prof = manual[i] ?? pickPreviousCareer(arch, race, main, rng, spec.onlyProfessions, taken);
    if (!prof) break;
    taken.push(prof);
    plan.push({ profession: prof, start: 1, target: Math.min(maxLevelOf(prof), randInt(1, 3, rng)) });
  }
  plan.push({ profession: main, start: firstLevel(main), target: mainTarget });
  return plan;
}

/**
 * Plan z dokladnej sciezki: kazdy krok od pierwszego poziomu profesji do podanego (bez poziomu:
 * wczesniejsze 1.-3., ostatnia 4. albo 5. wg szansy poziomu BN). Profesja zaawansowana (elfi kaplan)
 * bez profesji wejsciowej przed soba dostaje ja automatycznie.
 */
export function buildExactPlan(path: PathStep[], archetype: string, tierId: TierId, race: string, rng: Rng): CareerPlanStep[] {
  const tier = gd.getTier(tierId);
  const steps = path.filter((s, i) => gd.getProfession(s.profession) || (i === path.length - 1 && !s.profession));
  if (!steps.length || !tier) return [];
  const last = steps[steps.length - 1];
  if (!last.profession) {
    const arch = gd.getArchetype(archetype);
    const cands = arch ? professionCandidates(arch, race) : {};
    const main = weightedKey(cands, rng);
    if (!main) return [];
    steps[steps.length - 1] = { ...last, profession: main };
  }
  const plan: CareerPlanStep[] = [];
  steps.forEach((s, i) => {
    const def = gd.getProfession(s.profession)!;
    const start = firstLevel(s.profession);
    const max = maxLevelOf(s.profession);
    if (start > 1 && def.entry && plan[plan.length - 1]?.profession !== def.entry.from) {
      plan.push({ profession: def.entry.from, start: 1, target: def.entry.level, fixed: true });
    }
    const isLast = i === steps.length - 1;
    const auto = isLast ? maybeLevel5(s.profession, Math.min(4, max), tier, rng) : Math.min(max, randInt(1, 3, rng));
    const target = Math.max(start, Math.min(max, s.level ?? auto));
    plan.push({ profession: s.profession, start, target, fixed: s.level != null });
  });
  return plan;
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

// ---------------------------------------------------------------------------
// Etap 4c: rozwoj za PD (podrecznik s. 36-37 i 47-49)
// ---------------------------------------------------------------------------

/** Waga rozwoju: 1 cecha kluczowa i 2 drugorzedne; 2 umiejetnosci pierwszorzedne i 3 drugorzedne; 3 kluczowe talenty. */
const PRIMARY = 3;
const SECONDARY = 2;
const NORMAL = 1;

function charPriority(arch: Archetype | undefined, code: Attribute): number {
  const i = arch?.characteristics.indexOf(code) ?? -1;
  return i === 0 ? PRIMARY : i === 1 || i === 2 ? SECONDARY : NORMAL;
}

function skillPriority(arch: Archetype | undefined, name: string): number {
  const i = (arch?.keySkills ?? []).findIndex((k) => matchesKey(name, k));
  return i < 0 ? NORMAL : i < 2 ? PRIMARY : i < 5 ? SECONDARY : NORMAL;
}

function talentPriority(arch: Archetype | undefined, name: string): number {
  if (!arch) return NORMAL;
  const ranked = Object.entries(arch.talents).sort((a, b) => b[1] - a[1]);
  const i = ranked.findIndex(([k]) => matchesKey(name, k));
  return i < 0 ? NORMAL : i < 3 ? PRIMARY : SECONDARY;
}

interface Candidate {
  kind: "char" | "skill" | "talent";
  name: string;
  cost: number;
  weight: number;
}

/** Wydawanie PD na rozwoj BN - wylacznie w ramach dostepnych profesji (bez rozwoju poza profesja). */
class XpDeveloper {
  spent = 0;
  private resolved = new Map<string, string>();

  constructor(
    readonly npc: Npc,
    readonly arch: Archetype | undefined,
    readonly budget: number,
    readonly rng: Rng,
    readonly det: boolean,
    /** Dokladna sciezka: wymagane Talenty archetypu kupowane takze na kredyt PD. */
    readonly allowDebt = false
  ) {}

  get left(): number {
    return this.budget - this.spent;
  }

  /** "Dowolne" rozwiazujemy raz na profesje, by rozwiniecia sie kumulowaly. */
  resolve(profession: string, raw: string): string {
    const key = `${profession}|${raw}`;
    if (!this.resolved.has(key)) this.resolved.set(key, resolveSpecName(raw, this.npc.specChoices, this.arch, this.rng, this.det));
    return this.resolved.get(key)!;
  }

  chars(profession: string, level: number): Attribute[] {
    return levelCharacteristics(profession, level, this.arch);
  }

  skills(profession: string, level: number): string[] {
    return [...new Set(levelSkills(profession, level).map((s) => this.resolve(profession, s)))];
  }

  /** Talenty sa dostepne tylko na poziomie, przy ktorym je wymieniono (PG s. 48). */
  talents(profession: string, level: number): string[] {
    const tierIdx = TIER_IDS.indexOf(this.npc.tier);
    const lvl = gd.getProfession(profession)?.levels.find((l) => l.level === level);
    return (lvl?.talents ?? [])
      .filter((t) => TIER_IDS.indexOf(gd.getTalent(t)?.minTier ?? "slaby") <= tierIdx)
      .map((t) => this.resolve(profession, t));
  }

  skillAdv(name: string): number {
    return this.npc.skills.find((s) => s.name === name)?.advances ?? 0;
  }

  talentLevel(name: string): number {
    return this.npc.talents.find((t) => t.name === name)?.level ?? 0;
  }

  private caps = new Map<string, number>();

  /** Maksimum Talentu (zalezne od Cech) - liczone raz na kazde 5 rozwiniec Cech. */
  canGrowTalent(name: string): boolean {
    const key = `${name}|${Object.values(this.npc.charAdvances).map((v) => Math.floor(v / 5)).join(",")}`;
    if (!this.caps.has(key)) this.caps.set(key, talentCap(name, approxChars(this.npc)));
    return this.talentLevel(name) < this.caps.get(key)!;
  }

  pick<T>(items: T[], weight: (x: T) => number): T | undefined {
    if (!items.length) return undefined;
    if (this.det) return [...items].sort((a, b) => weight(b) - weight(a))[0];
    return weightedPick(items, weight, this.rng);
  }

  buyChar(code: Attribute, pay = true): void {
    if (pay) this.spent += nextAdvanceCost("char", this.npc.charAdvances[code]);
    this.npc.charAdvances[code] += 1;
  }

  buySkill(name: string, pay = true): void {
    if (pay) this.spent += nextAdvanceCost("skill", this.skillAdv(name));
    addSkill(this.npc, name, 1);
  }

  buyTalent(name: string, pay = true): boolean {
    const cost = talentCost(this.talentLevel(name));
    if (!this.canGrowTalent(name)) return false;
    if (pay) this.spent += cost;
    gainTalent(this.npc, name, approxChars(this.npc));
    return true;
  }

  /** Talenty tozsamosci archetypu (np. Magia Prosta czarodzieja) - kupowane, gdy tylko sa dostepne. */
  buyRequired(profession: string, level: number, pay = true): void {
    for (const t of this.talents(profession, level)) {
      if (!this.arch?.requiredTalents?.some((r) => matchesKey(t, r)) || this.talentLevel(t) > 0) continue;
      if (pay && !this.allowDebt && talentCost(0) > this.left) continue;
      this.buyTalent(t, pay);
    }
  }

  /**
   * Czego brakuje do skompletowania poziomu: Cechy poziomu na 5 x poziom, 8 Umiejetnosci
   * (najtansze do dociagniecia, przy rownym koszcie - wazniejsze) i 1 Talent z poziomu.
   */
  needs(profession: string, level: number): { cost: number; chars: [Attribute, number][]; skills: [string, number][]; talent?: string } {
    const req = levelRequirement(level);
    const chars: [Attribute, number][] = [];
    let cost = 0;
    for (const code of this.chars(profession, level)) {
      const have = this.npc.charAdvances[code];
      if (have < req) {
        chars.push([code, req - have]);
        cost += advanceCost("char", have, req);
      }
    }
    const skillCosts = this.skills(profession, level)
      .map((s) => ({ s, c: advanceCost("skill", this.skillAdv(s), Math.max(req, this.skillAdv(s))) }))
      .sort((x, y) => x.c - y.c || skillPriority(this.arch, y.s) - skillPriority(this.arch, x.s))
      .slice(0, 8);
    const skills: [string, number][] = [];
    for (const { s, c } of skillCosts) {
      if (c > 0) {
        skills.push([s, req - this.skillAdv(s)]);
        cost += c;
      }
    }
    const pool = this.talents(profession, level);
    let talent: string | undefined;
    if (pool.length && !pool.some((t) => this.talentLevel(t) > 0)) {
      talent = this.pick(pool.filter((t) => this.canGrowTalent(t)), (t) => talentPriority(this.arch, t) ** 2);
      if (talent) cost += talentCost(0);
    }
    return { cost, chars, skills, talent };
  }

  applyNeeds(n: ReturnType<XpDeveloper["needs"]>): void {
    for (const [code, k] of n.chars) for (let i = 0; i < k; i++) this.buyChar(code);
    for (const [s, k] of n.skills) for (let i = 0; i < k; i++) this.buySkill(s);
    if (n.talent) this.buyTalent(n.talent);
  }

  /** Swobodny rozwoj w obecnej profesji: waga = priorytet^2 / koszt; nizsze poziomy BN rzadziej kupuja talenty. */
  spendFree(profession: string, level: number): void {
    const chars = this.chars(profession, level);
    const skills = this.skills(profession, level);
    const talents = this.talents(profession, level);
    const talentFactor = TIER_IDS.indexOf(this.npc.tier) < TIER_IDS.indexOf("doswiadczony") ? 0.5 : 1;
    for (let guard = 0; guard < 5000; guard++) {
      const cands: Candidate[] = [];
      for (const code of chars) {
        const cost = nextAdvanceCost("char", this.npc.charAdvances[code]);
        if (cost <= this.left) cands.push({ kind: "char", name: code, cost, weight: charPriority(this.arch, code) ** 2 / cost });
      }
      for (const s of skills) {
        const cost = nextAdvanceCost("skill", this.skillAdv(s));
        if (cost <= this.left) cands.push({ kind: "skill", name: s, cost, weight: skillPriority(this.arch, s) ** 2 / cost });
      }
      for (const t of talents) {
        const cost = talentCost(this.talentLevel(t));
        if (cost <= this.left && this.canGrowTalent(t)) {
          cands.push({ kind: "talent", name: t, cost, weight: (talentPriority(this.arch, t) ** 2 * talentFactor) / cost });
        }
      }
      const c = this.pick(cands, (x) => x.weight);
      if (!c) return;
      if (c.kind === "talent") {
        this.buyTalent(c.name);
        continue;
      }
      // Przy duzym zapasie PD kupujemy od razu do konca przedzialu kosztu (koszt w przedziale jest staly).
      const owned = c.kind === "char" ? this.npc.charAdvances[c.name as Attribute] : this.skillAdv(c.name);
      const inBracket = 5 - (owned % 5);
      const n = this.left > 20 * c.cost ? Math.min(inBracket, Math.floor(this.left / c.cost)) : 1;
      for (let i = 0; i < n; i++) {
        if (c.kind === "char") this.buyChar(c.name as Attribute);
        else this.buySkill(c.name);
      }
    }
  }
}

/**
 * Tworzenie postaci (PG s. 33-37): 3 Umiejetnosci rasowe +5 i 3 +3, Talenty rasowe (stale, do
 * wyboru i z Tabeli Losowych Talentow), a z 1. poziomu profesji 5 rozwiniec jej Cech,
 * 40 rozwiniec jej 8 Umiejetnosci (najwyzej 10 w jednej) i 1 Talent. Bez kosztu PD.
 */
function creationStart(dev: XpDeveloper, profession: string, species: boolean): void {
  const { npc, arch } = dev;
  if (species) {
    const race = gd.getRace(npc.turned ? "Człowiek" : npc.race);
    const pool = [...new Set((race?.skills ?? []).map((s) => resolveSpecName(s, npc.specChoices, arch, dev.rng, dev.det)))];
    for (const amount of [5, 5, 5, 3, 3, 3]) {
      const s = dev.pick(pool, (x) => skillPriority(arch, x) ** 2);
      if (!s) break;
      pool.splice(pool.indexOf(s), 1);
      addSkill(npc, s, amount);
    }
    const chars = approxChars(npc);
    for (const rt of race?.talents ?? []) {
      if (rt.type === "fixed") gainTalent(npc, resolveSpecName(rt.name, npc.specChoices, arch, dev.rng, dev.det), chars);
      else if (rt.type === "choice") {
        const t = dev.pick(rt.options, (x) => talentPriority(arch, x) ** 2);
        if (t) gainTalent(npc, resolveSpecName(t, npc.specChoices, arch, dev.rng, dev.det), chars);
      } else if (rt.type === "random") {
        for (let i = 0; i < (rt.count ?? 1); i++) {
          for (let tries = 0; tries < 20; tries++) {
            const roll = dev.det ? 50 + i * 17 + tries : rollK100(dev.rng);
            const name = gd.randomTalentsTable().find((r) => roll >= r.min && roll <= r.max)?.name;
            const resolved = name && resolveSpecName(name, npc.specChoices, arch, dev.rng, dev.det);
            if (resolved && !npc.talents.some((t) => t.name === resolved)) {
              gainTalent(npc, resolved, chars);
              break;
            }
          }
        }
      }
    }
  }
  const chars = dev.chars(profession, 1);
  for (let i = 0; i < 5 && chars.length; i++) dev.buyChar(dev.pick(chars, (c) => charPriority(arch, c) ** 2)!, false);
  const skills = dev.skills(profession, 1);
  const career = new Map<string, number>();
  for (let i = 0; i < 40 && skills.length; i++) {
    const open = skills.filter((s) => (career.get(s) ?? 0) < 10);
    const s = dev.pick(open, (x) => skillPriority(arch, x) ** 2);
    if (!s) break;
    career.set(s, (career.get(s) ?? 0) + 1);
    dev.buySkill(s, false);
  }
  const required = dev.talents(profession, 1).filter((t) => arch?.requiredTalents?.some((r) => matchesKey(t, r)));
  const free = required[0] ?? dev.pick(dev.talents(profession, 1), (t) => talentPriority(arch, t) ** 2);
  if (free) dev.buyTalent(free, false);
  dev.buyRequired(profession, 1);
}

/** Poziom BN dla podanej liczby PD: najwyzszy, ktorego zakres zaczyna sie nie wyzej. */
export function tierForXp(xp: number): TierId {
  return [...TIER_IDS].reverse().find((t) => (gd.getTier(t)?.xp?.[0] ?? 0) <= xp) ?? "slaby";
}

/** Budzet PD poziomu BN (tiers.json -> xp) - PD ponad rozwiniecia z tworzenia postaci. */
function xpBudget(tier: TierDef | undefined, rng: Rng, deterministic: boolean): number {
  const [lo, hi] = tier?.xp ?? [0, 0];
  return deterministic ? Math.round((lo + hi) / 2) : randInt(lo, hi, rng);
}

/**
 * Rozwoj BN za PD wg zasad podrecznika: tworzenie postaci, potem kompletowanie poziomow
 * (minima Cech, 8 Umiejetnosci, 1 Talent) i awans za 100 PD (+100 przy zmianie Klasy).
 * Awans tylko, gdy starczy PD na skompletowanie poziomu; zmiana profesji tylko, gdy nowa
 * profesja zdazy dojsc do obecnego poziomu (ostatnia profesja zawsze najwyzej). Reszta PD -
 * swobodny rozwoj w obecnej profesji wg priorytetow archetypu.
 */
/**
 * exact = dokladna sciezka podana recznie: zadnej profesji z planu nie pomijamy, a poziomy z `fixed`
 * (i dojscie do poziomu poprzedniej profesji) osiagamy nawet ponad budzet - brak PD widac jako
 * npc.xp.spent > npc.xp.budget.
 */
export function developByXp(npc: Npc, plan: CareerPlanStep[], rng: Rng, deterministic = false, fixedBudget?: number, exact = false): void {
  const arch = gd.getArchetype(npc.archetype);
  const tier = gd.getTier(npc.tier);
  npc.charAdvances = emptyAttrs();
  npc.skills = [];
  npc.talents = [];
  npc.trappings = [];
  npc.careerPath = [];
  // Wybory cech stworzenia ("cecha|...") naleza do cech, nie do rozwoju - zostaja.
  npc.specChoices = Object.fromEntries(Object.entries(npc.specChoices ?? {}).filter(([k]) => k.startsWith("cecha|")));
  if (!plan.length) return;

  // Konkretne szkoly/bostwa z calego planu - zanim zaczniemy rozwiazywac "Dowolne".
  for (const step of plan) {
    for (const lvl of gd.getProfession(step.profession)?.levels ?? []) {
      for (const n of [...lvl.skills, ...lvl.talents]) {
        const { base, spec } = gd.splitSpec(n);
        if (spec && !gd.isOpenSpec(spec) && !gd.specAlternatives(spec)) registerConcrete(base, spec, npc.specChoices);
      }
    }
  }

  const budget = fixedBudget ?? npc.xpSpec?.budget ?? xpBudget(tier, rng, deterministic) + (npc.xpSpec?.bonus ?? 0);
  const dev = new XpDeveloper(npc, arch, budget, rng, deterministic, exact);
  creationStart(dev, plan[0].profession, !npc.creature || !!npc.turned);

  const steps: CareerStep[] = [{ profession: plan[0].profession, level: plan[0].start }];
  let ci = 0;
  let prof = plan[0].profession;
  let level = plan[0].start;
  // Poziom, do ktorego obecna profesja musi dojsc (po zmianie profesji - poziom poprzedniej).
  let mustReach = 0;
  for (let guard = 0; guard < 40; guard++) {
    const step = plan[ci];
    const lastStep = ci === plan.length - 1;
    let next: { profession: string; level: number; cost: number; switching: boolean } | undefined;
    if (level < step.target && level < maxLevelOf(prof)) next = { profession: prof, level: level + 1, cost: CAREER_STEP_COST, switching: false };
    else if (!lastStep) {
      const n = plan[ci + 1];
      const otherClass = gd.getProfession(n.profession)?.class !== gd.getProfession(prof)?.class;
      next = { profession: n.profession, level: n.start, cost: CAREER_STEP_COST + (otherClass ? CLASS_CHANGE_EXTRA : 0), switching: true };
    }
    if (!next) break;
    const need = dev.needs(prof, level);
    // Po awansie trzeba miec za co pracowac na nowym poziomie; przy zmianie profesji - dojsc do obecnego poziomu.
    let reserve: number;
    if (next.switching) {
      const reach = Math.max(level, next.level);
      reserve = dev.needs(next.profession, reach).cost + (CAREER_STEP_COST + talentCost(0)) * Math.max(0, reach - next.level);
    } else {
      // Rezerwa: 1/4 tego, co nowy poziom dokłada do obecnego (Zwykly z 1500 PD jest na 2. poziomie).
      reserve = level + 1 <= mustReach ? 0 : Math.round(Math.max(0, dev.needs(next.profession, next.level).cost - need.cost) / 4);
    }
    // Dokladna sciezka: zmiana profesji i poziomy podane recznie zawsze, takze na kredyt PD.
    const forced = exact && (next.switching || step.fixed || level + 1 <= mustReach);
    if (!forced && need.cost + next.cost + reserve > dev.left) {
      if (next.switching && plan[ci + 1].start <= 1) {
        // Na zmiane profesji nie starczy PD - bez tej wczesniejszej profesji, od nowa (ostatnia profesja to zawsze glowna).
        developByXp(npc, plan.filter((_, i) => i !== ci), rng, deterministic, budget);
        return;
      }
      if (next.switching && level < maxLevelOf(prof)) {
        // Profesja zaawansowana (np. elfi kaplan od 3. poziomu) - zostaje w obecnej i rozwija ja dalej.
        plan = [...plan.slice(0, ci), { ...step, target: Math.min(4, maxLevelOf(prof)) }];
        continue;
      }
      break;
    }
    dev.applyNeeds(need);
    dev.spent += next.cost;
    if (next.switching) {
      ci++;
      mustReach = level;
    }
    prof = next.profession;
    level = next.level;
    steps.push({ profession: prof, level });
    dev.buyRequired(prof, level);
  }
  dev.spendFree(prof, level);
  npc.careerPath = steps;
  npc.xp = { budget, spent: dev.spent };

  // Wyposazenie z obecnej profesji (jej poziomow do obecnego wlacznie).
  for (const lvl of gd.getProfession(prof)?.levels ?? []) {
    if (lvl.level > level) continue;
    for (const raw of lvl.trappings) {
      // "kreda albo dłuto", "koń wierzchowy albo mała łódź" - jedna z możliwości (poza nawiasami).
      const options = raw.includes("(") ? [raw] : raw.split(/\s+albo\s+/);
      const chosen = deterministic ? options[0] : (pick(options, rng) ?? raw);
      const item = rollDiceText(chosen, rng, deterministic);
      if (!npc.trappings.includes(item)) npc.trappings.push(item);
    }
  }
  const last = gd.getProfession(prof)?.levels.find((l) => l.level === level);
  npc.money = rollMoney(last?.status ?? "", rng, deterministic);
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

/**
 * Profile bohaterow (Weteran, Doborowy, Pomniejszy i Wielki Bohater, Dowodca Oddzialu): z wyboru albo
 * z malej szansy poziomu (tiers.json -> heroProfileChances). Poziom BN rozwija postac przez profesje.
 */
function heroProfilesFor(spec: GenSpec, tierId: TierId, rng: Rng): string[] {
  const out = new Set<string>((spec.heroProfiles ?? []).filter((h) => gd.getHeroProfile(h)));
  // Mala losowa szansa (najwyzej kilka procent) na wyjatkowa jednostke - tylko przy losowaniu.
  const chances = gd.getTier(tierId)?.heroProfileChances ?? [];
  if (!spec.deterministic && !out.size && chances.length) {
    let roll = rng();
    for (const c of chances) {
      if (roll < c.chance) {
        if (gd.getHeroProfile(c.profile)) out.add(c.profile);
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
  // Przemieniony wampir rodzil sie czlowiekiem - rzuty jak czlowiek.
  return creature && !npc.turned
    ? rollCreature(creature, arch?.characteristics ?? [], rng, deterministic)
    : rollCharacteristics(arch, rng, deterministic);
}

/**
 * Sekcja "rozwoj": sciezka profesji (ludzie, stworzenia cywilizowane) albo
 * rozwoj bestii, a do tego bron i pancerz.
 */
function develop(npc: Npc, professions: string[] | undefined, rng: Rng, deterministic: boolean, path?: PathStep[]): void {
  const creature = gd.getCreature(npc.creature);
  if (creature && isBeast(npc)) {
    npc.careerPath = [];
    npc.charAdvances = emptyAttrs();
    npc.skills = [];
    npc.talents = [];
    npc.specChoices = Object.fromEntries(Object.entries(npc.specChoices ?? {}).filter(([k]) => k.startsWith("cecha|")));
    bookSkillsAndTalents(npc, creature);
    beastSkills(npc, creature);
    npc.trappings = creature.trappings.map((t) => rollDiceText(t, rng, deterministic));
    npc.weapons = [];
    npc.armour = [];
    npc.craft = {};
    npc.money = "";
    return;
  }
  const exact = !!path?.some((s) => s.profession || s.level != null);
  const plan = exact
    ? buildExactPlan(path!, npc.archetype, npc.tier, npc.race, rng)
    : buildCareerPlan({ professions, onlyProfessions: vampireProfessions(npc) }, npc.archetype, npc.tier, npc.race, rng);
  developByXp(npc, plan, rng, deterministic, undefined, exact);
  // Rzadkie talenty rasy (Krew Aenariona) - tylko przy losowaniu.
  for (const rt of gd.getSettings().raceTalents ?? []) {
    if (deterministic || creature || rt.race !== npc.race || npc.talents.some((t) => t.name === rt.talent)) continue;
    if (chance(rt.archetypes?.[npc.archetype] ?? rt.chance, rng)) npc.talents.push({ name: rt.talent, level: 1 });
  }
  rollExtraLores(npc, rng, deterministic);
  if (npc.turned) applyTurning(npc, rng, deterministic);
  else if (creature) bookSkillsAndTalents(npc, creature);
  resolveMagicTrappings(npc, rng, deterministic);
  equipNpc(npc, rng);
  rollCraft(npc, rng, deterministic);
}

/**
 * Krwawy Pocałunek: czlowiek po profesjach za zycia dostaje Umiejetnosci Rasowe Linii Krwi
 * (3 x +5, 3 x +3 z dwunastu), jej 5 Talentow i wyposazenie (vampires.json -> turning).
 * Premie do Cech i Szybkosci liczy computeNpc.
 */
function applyTurning(npc: Npc, rng: Rng, deterministic: boolean): void {
  const turning = npcBloodline(npc)?.turning;
  if (!turning) return;
  const arch = gd.getArchetype(npc.archetype);
  const skills = deterministic ? [...turning.skills] : shuffle([...turning.skills], rng);
  skills.slice(0, 6).forEach((raw, i) => addSkill(npc, resolveSpecName(raw, npc.specChoices, arch, rng, deterministic), i < 3 ? 5 : 3));
  const chars = approxChars(npc);
  for (const raw of turning.talents) {
    let name = raw;
    if (raw === "losowy") {
      const roll = deterministic ? 50 : rollK100(rng);
      name = gd.randomTalentsTable().find((r) => roll >= r.min && roll <= r.max)?.name ?? "";
    } else if (raw.includes(" lub ")) {
      const options = raw.split(" lub ");
      name = deterministic ? options[0] : pick(options, rng)!;
    }
    if (name) gainTalent(npc, resolveSpecName(name, npc.specChoices, arch, rng, deterministic), chars);
  }
  for (const t of turning.trappings) {
    const item = rollDiceText(t, rng, deterministic);
    if (!npc.trappings.includes(item)) npc.trappings.push(item);
  }
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Po cechach i skarbach: Splatanie i Jezyk (Magiczny) stworzen czarujacych z cechy,
 * pancerz Strigoi (tylko magiczny od heroicznego), na koniec zaklecia.
 */
function finish(npc: Npc, rng: Rng, deterministic: boolean): void {
  addCasterSkills(npc, rng, deterministic);
  stripVampireArmour(npc);
  npc.spells = pickSpells(npc, rng, deterministic);
}

/** Sekcja "cechyStworzen": cechy opcjonalne (15/5/1%), cechy poziomu bestii, mutacje. */
function rollFeatures(npc: Npc, spec: GenSpec, rng: Rng, deterministic: boolean): void {
  const creature = gd.getCreature(npc.creature);
  npc.traits = rollTraits(spec, npc, rng);
  if (creature && isBeast(npc)) beastTraits(npc, creature, rng, deterministic);
  // Czy wampir czaruje, rozstrzyga Linia Krwi - nie opcjonalna cecha z ksiazki.
  if (isVampire(npc)) npc.traits = npc.traits.filter((t) => !t.startsWith("Rzucanie Czarów"));
  const vampire = rollVampire(npc, rng, deterministic, spec.bloodline);
  npc.traits = [...npc.traits, ...vampire.traits.filter((t) => !npc.traits.includes(t))];
  // Cechy z wyborem ("Rzucanie Czarów (Śmierci albo Cieni)") - jedna opcja, jak przy wyposazeniu.
  npc.traits = [...new Set(npc.traits.map((t) => resolveTraitChoice(t, rng, deterministic)))];
  for (const t of creature?.traits ?? []) {
    const r = resolveTraitChoice(t, rng, deterministic);
    if (r !== t) npc.specChoices[`cecha|${t}`] = r;
  }
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
  // Zwykle stworzenia pasujace do poziomu; czasem (15%) silniejsze, osłabione do tego poziomu.
  const fits = tier && !chance(0.15, rng) ? all.filter((c) => TIER_IDS.indexOf(c.minTier ?? "slaby") <= TIER_IDS.indexOf(tier)) : all;
  return pick(fits.length ? fits : all, rng)?.name;
}

/**
 * Archetyp stworzenia: tylko rozumne; wybrany (jesli dozwolony), a bez wyboru - z szansa
 * archetypeChance, wg wag stworzenia (ogr: proste profesje) albo linii krwi (wampir).
 */
function creatureArchetype(spec: GenSpec, creature: CreatureDef, bloodline: string | undefined, rng: Rng, det: boolean): string {
  if (!gd.isCivilized(creature.name) || spec.noArchetype) return "";
  const allowed = (a: string) => !!gd.getArchetype(a) && (!creature.archetypes || a in creature.archetypes);
  if (spec.archetype) return allowed(spec.archetype) ? spec.archetype : "";
  const p = creature.archetypeChance ?? 0;
  if (!(det ? p >= 0.5 : chance(p, rng))) return "";
  const pick = bloodline ? vampireArchetype(bloodline, rng, det) : creature.archetypes && weightedKey(creature.archetypes, rng);
  return pick && allowed(pick) ? pick : "";
}

/** Generuje kompletnego BN wg specyfikacji. */
export function generateNpc(spec: GenSpec = {}, rng: Rng = defaultRng): Npc {
  if (spec.xp != null && !spec.tier) spec = { ...spec, tier: tierForXp(spec.xp) };
  const creatureName = spec.creature ?? (spec.creatureGroup ? pickCreatureFromGroup(spec.creatureGroup, spec.tier, rng) : undefined);
  const creature: CreatureDef | undefined = gd.getCreature(creatureName);
  const det = !!spec.deterministic;
  // Wampir: Linia Krwi od razu - od niej zalezy archetyp (Preferowane Profesje).
  const bloodline = creature && isVampire({ creature: creature.name }) ? rollBloodline(rng, det, spec.bloodline) : undefined;
  // Przemiana: wampir zawsze przeszedl za zycia przez profesje (archetyp wg Linii Krwi).
  const turned = !!bloodline && !!spec.turned && !!findBloodline(bloodline)?.turning;
  let archetype = creature ? creatureArchetype({ ...spec, noArchetype: spec.noArchetype && !turned }, creature, bloodline, rng, det) : pickArchetype(spec, rng);
  // Ogr wybrany jak rasa: zawsze z profesja, dowolny archetyp (bez wyboru - wg wag stworzenia).
  if (creature?.asRace && spec.asRace && !archetype) {
    archetype = spec.archetype && gd.getArchetype(spec.archetype) ? spec.archetype : (creature.archetypes && weightedKey(creature.archetypes, rng)) || pickArchetype(spec, rng);
  }
  if (turned && !archetype) archetype = vampireArchetype(bloodline, rng, det) ?? "Wojownik";
  // Bestia moze wystapic ponizej swojego minimum, gdy poziom wybrano recznie (dostaje wtedy cechy negatywne).
  const beastSpec = !!creature && !archetype;
  // Ogr wybrany jak rasa z poziomem ustawionym recznie - bez podnoszenia do minimum stworzenia.
  const tier = (beastSpec || (creature?.asRace && archetype)) && spec.tier ? pickTier(spec, rng) : clampTier(pickTier(spec, rng), creature);
  const race = creature ? creature.name : pickRace(spec, archetype, rng);
  const sex: Sex = spec.sex ?? (chance(0.5, rng) ? "M" : "K");
  const beast = !!creature && !archetype;

  const npc: Npc = {
    id: newId(),
    version: 1,
    name: spec.name?.trim() || (beast ? creature!.name : pickName(turned ? "Człowiek" : race, sex, rng)),
    sex,
    race,
    creature: creature?.name,
    ...(turned ? { turned: true } : {}),
    archetype,
    tier,
    label: spec.label,
    ...(spec.xp != null || spec.xpBonus ? { xpSpec: { budget: spec.xp ?? undefined, bonus: spec.xpBonus || undefined } } : {}),
    careerPath: [],
    rolls: emptyAttrs(),
    charAdvances: emptyAttrs(),
    skills: [],
    talents: [],
    traits: [],
    heroProfiles: heroProfilesFor(spec, tier, rng),
    weapons: [],
    armour: [],
    spells: [],
    // Linia Krwi znana juz przy rozwoju (magia wampira), cechy dolosuja reszte.
    mutations: bloodline ? [{ kind: "bloodline", name: bloodline }] : [],
    trappings: [],
    money: "",
    notes: "",
    specChoices: {},
    locks: {},
    createdAt: new Date().toISOString()
  };
  npc.rolls = rollAttributes(npc, rng, det);
  develop(npc, spec.professions, rng, det, spec.path);
  rollFeatures(npc, { ...spec, bloodline }, rng, det);
  // Po cechach: przedmioty wampirow zaleza od Linii Krwi.
  rollTreasures(npc, rng, det);
  finish(npc, rng, det);
  // Po rozwoju: Motywacja Wiara bierze bostwo z talentow profesji.
  npc.persona = rollPersona(npc, rng);
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
  if (unlocked("rozwoj") || unlocked("cechyStworzen")) finish(next, rng, false);
  // Osobowosc i wyglad naleza do tozsamosci (blokada "Imię").
  if (unlocked("tozsamosc")) next.persona = rollPersona(next, rng);
  return next;
}

/**
 * Buduje od nowa rozwoj BN po zmianie rasy, archetypu, poziomu lub profesji
 * w edytorze. Rzuty, imie i cechy stworzen zostaja.
 */
export function rebuildDevelopment(npc: Npc, professions: string[] | undefined, rng: Rng = defaultRng, path?: PathStep[]): Npc {
  const next: Npc = structuredClone(npc);
  if (!isBeast(next) && !gd.getCreature(next.creature)?.asRace) next.tier = clampTier(next.tier, gd.getCreature(next.creature));
  develop(next, professions, rng, false, path);
  rollTreasures(next, rng);
  finish(next, rng, false);
  return next;
}
