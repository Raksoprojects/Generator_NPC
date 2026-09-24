/**
 * Dostep do danych gry i generatora (public/data/*.json).
 *
 * Dane laduje sie raz przy starcie (loadGameData) albo wstrzykuje w testach
 * (setGameData). Akcesory dzialaja synchronicznie.
 */

import type {
  Archetype,
  ClassesData,
  CreatureTrait,
  GeneratorSettings,
  GroupPreset,
  HeroProfile,
  NameTable,
  Profession,
  RaceDef,
  RacesData,
  Ruleset,
  SkillDef,
  SpecializationsData,
  Talent,
  TierDef,
  TierId,
  TiersData
} from "./types";

type ProfessionsData = Record<string, Profession>;
type TalentsData = Record<string, Talent>;

export interface GameData {
  professions: ProfessionsData;
  classes: ClassesData;
  talents: TalentsData;
  skills: SkillDef[];
  races: RacesData;
  creatureTraits: Record<string, CreatureTrait>;
  heroProfiles: Record<string, HeroProfile>;
  tiers: TiersData;
  archetypes: Record<string, Archetype>;
  specializations: SpecializationsData;
  names: Record<string, NameTable>;
  groupPresets: Record<string, GroupPreset>;
  /** Opcjonalna nakladka profesji dla zasad domowych. */
  professionsDomowe?: ProfessionsData;
}

let raw: GameData | null = null;
let professions: ProfessionsData = {};
let talents: TalentsData = {};
let talentIndex = new Map<string, string>();
let activeRuleset: Ruleset = "pod_bronia";

const FILES = {
  professions: "professions.json",
  classes: "classes.json",
  talents: "talents.json",
  skills: "skills.json",
  races: "races.json",
  creatureTraits: "creature_traits.json",
  heroProfiles: "hero_profiles.json",
  tiers: "tiers.json",
  archetypes: "archetypes.json",
  specializations: "specializations.json",
  names: "names.json",
  groupPresets: "group_presets.json"
} as const;

/** Wstrzykuje dane bezposrednio (testy). */
export function setGameData(data: GameData, ruleset: Ruleset = "pod_bronia"): void {
  raw = data;
  activeRuleset = ruleset;
  applyRuleset();
}

/** Laduje wszystkie pliki danych z katalogu data/ (fetch). */
export async function loadGameData(
  baseUrl: string = import.meta.env.BASE_URL,
  ruleset: Ruleset = "pod_bronia"
): Promise<void> {
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(`${prefix}data/${file}`);
      if (!res.ok) throw new Error(`Nie udało się wczytać data/${file} (${res.status}).`);
      return [key, await res.json()] as const;
    })
  );
  const data = Object.fromEntries(entries) as unknown as GameData;
  data.professionsDomowe = (await fetchOptional<ProfessionsData>(`${prefix}data/professions.domowe.json`)) ?? {};
  setGameData(data, ruleset);
}

async function fetchOptional<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function isLoaded(): boolean {
  return raw !== null;
}

function data(): GameData {
  if (!raw) throw new Error("Dane gry nie zostały załadowane.");
  return raw;
}

// ---------------------------------------------------------------------------
// Warianty zasad
// ---------------------------------------------------------------------------

export function getRuleset(): Ruleset {
  return activeRuleset;
}

export function setRuleset(ruleset: Ruleset): void {
  activeRuleset = ruleset;
  applyRuleset();
}

/** Nakłada wariant domowy (pola z `variants.domowe` i professions.domowe.json). */
function applyRuleset(): void {
  const d = data();
  const domowe = activeRuleset === "domowe";

  talents = {};
  for (const [name, base] of Object.entries(d.talents)) {
    const { variants, ...rest } = base;
    talents[name] = (domowe && variants?.domowe ? { ...rest, ...variants.domowe } : rest) as Talent;
  }

  professions = {};
  for (const [name, base] of Object.entries(d.professions)) {
    const { variants, ...rest } = base;
    let out = rest as Profession;
    if (domowe && variants?.domowe) out = { ...out, ...variants.domowe };
    if (domowe && d.professionsDomowe?.[name]) out = { ...out, ...d.professionsDomowe[name] };
    professions[name] = out;
  }
  if (domowe) {
    for (const [name, prof] of Object.entries(d.professionsDomowe ?? {})) {
      if (!(name in professions)) professions[name] = prof;
    }
  }

  talentIndex = new Map();
  for (const key of Object.keys(talents)) {
    talentIndex.set(normalize(key), key);
    const base = splitSpec(key).base;
    const nb = normalize(base);
    if (base !== key && !talentIndex.has(nb)) talentIndex.set(nb, key);
  }
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

/** Male litery, pojedyncze spacje - do porownan nazw. */
export function normalize(text: string | null | undefined): string {
  return String(text ?? "").trim().toLowerCase().split(/\s+/).join(" ");
}

/** Rozbija "Wiedza (Prawo)" na { base: "Wiedza", spec: "Prawo" }. */
export function splitSpec(name: string): { base: string; spec: string | null } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(name);
  if (!m) return { base: name.trim(), spec: null };
  return { base: m[1].trim(), spec: m[2].trim() };
}

/** Czy specjalizacja jest dowolna ("Dowolna", "...", "Dowolny Kolor"). */
export function isOpenSpec(spec: string | null): boolean {
  if (spec === null) return false;
  const s = normalize(spec);
  return s === "" || s.includes("dowoln") || s.includes("...") || s.includes("wszystkie");
}

/** Opcje specjalizacji z zapisu "Miasto albo Wieś" / "Prochowa, Kusza albo ..." (lub null). */
export function specAlternatives(spec: string | null): string[] | null {
  if (!spec) return null;
  const parts = spec.split(/\s*,\s*|\s+albo\s+|\s+lub\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : null;
}

// ---------------------------------------------------------------------------
// Akcesory
// ---------------------------------------------------------------------------

export function getProfession(name: string): Profession | undefined {
  if (professions[name]) return professions[name];
  const target = normalize(name);
  const key = Object.keys(professions).find((k) => normalize(k) === target);
  return key ? professions[key] : undefined;
}

export function allProfessionNames(): string[] {
  return Object.keys(professions).sort((a, b) => a.localeCompare(b, "pl"));
}

/** Czy rasa moze wykonywac profesje. */
export function professionAllowsRace(profession: string, race: string): boolean {
  const prof = getProfession(profession);
  return !!prof && prof.races.some((r) => normalize(r) === normalize(race));
}

/**
 * Klucz talentu w bazie: dokladna nazwa, potem bez wielkosci liter, potem po
 * nazwie bazowej (np. "Etykieta (Uczeni)" -> "Etykieta (Grupa Społeczna)").
 */
export function resolveTalentKey(name: string): string | undefined {
  if (talents[name]) return name;
  return talentIndex.get(normalize(name)) ?? talentIndex.get(normalize(splitSpec(name).base));
}

export function getTalent(name: string): Talent | undefined {
  const key = resolveTalentKey(name);
  return key ? talents[key] : undefined;
}

export function allTalentNames(): string[] {
  return Object.keys(talents).sort((a, b) => a.localeCompare(b, "pl"));
}

export function allSkillNames(): string[] {
  return data().skills.map((s) => s.name).sort((a, b) => a.localeCompare(b, "pl"));
}

/** Kod cechy wiodacej umiejetnosci (takze dla specjalizacji grupowych). */
export function skillAttr(name: string): string | undefined {
  const skills = data().skills;
  const exact = skills.find((s) => s.name === name);
  if (exact) return exact.attr;
  const base = normalize(splitSpec(name).base);
  return skills.find((s) => normalize(splitSpec(s.name).base) === base)?.attr;
}

export function allRaceNames(): string[] {
  return Object.keys(data().races.races);
}

export function getRace(name: string): RaceDef | undefined {
  return data().races.races[name];
}

export function getClasses(): ClassesData {
  return data().classes;
}

export function allArchetypeNames(): string[] {
  return Object.keys(data().archetypes);
}

export function getArchetype(name: string): Archetype | undefined {
  return data().archetypes[name];
}

export function getTier(id: TierId): TierDef {
  return data().tiers.tiers[id];
}

export function getTiers(): Record<TierId, TierDef> {
  return data().tiers.tiers;
}

export function getSettings(): GeneratorSettings {
  return data().tiers.settings;
}

export function getCreatureTraits(): Record<string, CreatureTrait> {
  return data().creatureTraits;
}

export function getCreatureTrait(name: string): CreatureTrait | undefined {
  return data().creatureTraits[name];
}

export function getHeroProfiles(): Record<string, HeroProfile> {
  return data().heroProfiles;
}

export function getHeroProfile(name: string): HeroProfile | undefined {
  return data().heroProfiles[name];
}

export function getSpecializations(): SpecializationsData {
  return data().specializations;
}

export function getNames(race: string): NameTable | undefined {
  return data().names[race];
}

export function getGroupPresets(): Record<string, GroupPreset> {
  return data().groupPresets;
}
