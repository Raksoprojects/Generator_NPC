/**
 * Dostep do danych gry i generatora (public/data/*.json).
 *
 * Dane laduje sie raz przy starcie (loadGameData) albo wstrzykuje w testach
 * (setGameData). Akcesory dzialaja synchronicznie.
 */

import type {
  Archetype,
  ClassesData,
  CreatureDef,
  CreatureFamiliesData,
  CreatureTrait,
  MutationsData,
  ProfessionTitlesData,
  Sex,
  VampiresData,
  MagicItemsData,
  TreasuresData,
  SpellDef,
  SpellsData,
  WeaponsData,
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
  /** Tabela imion albo nazwa innej tabeli (alias, np. Krasnoludy Chaosu -> Krasnolud). */
  names: Record<string, NameTable | string>;
  groupPresets: Record<string, GroupPreset>;
  spells: SpellsData;
  weapons: WeaponsData;
  creatures: { creatures: CreatureDef[] };
  creatureFamilies: CreatureFamiliesData;
  mutations: MutationsData;
  /** Formy [meska, zenska] nazw profesji i tytulow. */
  professionTitles?: ProfessionTitlesData;
  /** Wampiry: Linie Krwi, Dary Krwi, Slabosci. */
  vampires?: VampiresData;
  /** Przedmioty magiczne i premie do czarowania. */
  magicItems?: MagicItemsData;
  treasures?: TreasuresData;
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
  groupPresets: "group_presets.json",
  spells: "spells.json",
  weapons: "weapons.json",
  creatures: "creatures.json",
  creatureFamilies: "creature_families.json",
  mutations: "mutations.json",
  professionTitles: "profession_titles.json",
  vampires: "vampires.json",
  magicItems: "magic_items.json",
  treasures: "treasures.json"
} as const;

/** Wstrzykuje dane bezposrednio (testy). */
export function setGameData(data: GameData, ruleset: Ruleset = "pod_bronia"): void {
  raw = data;
  activeRuleset = ruleset;
  traitIndex = null;
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

/** Nazwa cechy bez wartosci: "Demoniczny 8+" / "Srogi (2)" / "2× Macki +5" / "Broń (Pazury) +7" -> rdzen. */
export function traitBase(name: string): string {
  return normalize(
    name
      .replace(/^\d+(k\d+)?\s*×?\s*/, "")
      .replace(/\s+[–-]\s+.*$/, "")
      .replace(/\s*\(.*?\)/g, "")
      .replace(/\s*\+.*$/, "")
      .replace(/\s+\d+\+?$/, "")
      .replace(/^#\s*/, "")
  );
}

let traitIndex: Map<string, string> | null = null;

/** Cecha Stworzenia po nazwie z ksiazki - takze z wartoscia i pod inna nazwa (aliasy). */
export function findCreatureTrait(name: string): { key: string; trait: CreatureTrait } | undefined {
  const all = data().creatureTraits;
  if (all[name]) return { key: name, trait: all[name] };
  if (!traitIndex) {
    traitIndex = new Map();
    for (const [key, t] of Object.entries(all)) {
      traitIndex.set(traitBase(key), key);
      for (const a of t.aliases ?? []) traitIndex.set(traitBase(a), key);
    }
  }
  const key = traitIndex.get(traitBase(name));
  return key ? { key, trait: all[key] } : undefined;
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
  const t = data().names[race];
  return typeof t === "string" ? (data().names[t] as NameTable | undefined) : t;
}

export function getGroupPresets(): Record<string, GroupPreset> {
  return data().groupPresets;
}

// ---------------------------------------------------------------------------
// Zaklecia, bron, stworzenia, mutacje
// ---------------------------------------------------------------------------

export function getSpellsData(): SpellsData {
  return data().spells;
}

export function getSpell(name: string): SpellDef | undefined {
  const target = normalize(name);
  return data().spells.spells.find((s) => normalize(s.name) === target);
}

/** Klucz tradycji zaklec dla nazwy z talentu, np. "Cienia" -> "Cieni", "Guślarstwo" -> "Guślarstwa". */
export function spellLoreKey(name: string): string | undefined {
  const lores = Object.keys(data().spells.lores);
  const n = normalize(name);
  if (!n) return undefined;
  return lores.find((l) => normalize(l) === n) ?? lores.find((l) => normalize(l).slice(0, 5) === n.slice(0, 5));
}

export function getWeapons(): WeaponsData {
  return data().weapons;
}

export function allCreatureNames(): string[] {
  return data().creatures.creatures.map((c) => c.name);
}

export function getCreature(name: string | undefined): CreatureDef | undefined {
  if (!name) return undefined;
  return data().creatures.creatures.find((c) => c.name === name);
}

export function getCreatures(): CreatureDef[] {
  return data().creatures.creatures;
}

/** Cecha z bloku stworzenia z rozstrzygnieta alternatywa ("Rzucanie Czarów (Śmierci albo Cieni)" -> wybrana). */
export function resolvedBookTrait(choices: Record<string, string> | undefined, trait: string): string {
  return choices?.[`cecha|${trait}`] ?? trait;
}

export const GROUP_SEP = " › ";

/** "Chaos › Zwierzoludzie" albo samo "Zwierzęta". */
export function creatureGroupKey(c: CreatureDef): string {
  return c.subgroup ? `${c.group}${GROUP_SEP}${c.subgroup}` : c.group;
}

/** Grupy stworzen z podgrupami, w kolejnosci settings.groupOrder (reszta wg pliku). */
export function creatureGroupTree(): { group: string; subgroups: string[] }[] {
  const tree = new Map<string, Set<string>>();
  for (const c of getCreatures()) {
    const subs = tree.get(c.group) ?? new Set<string>();
    if (c.subgroup) subs.add(c.subgroup);
    tree.set(c.group, subs);
  }
  const order = getCreatureFamilies().settings.groupOrder ?? [];
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
  return [...tree.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([group, subs]) => ({ group, subgroups: [...subs].sort((a, b) => a.localeCompare(b, "pl")) }));
}

/** Stworzenia grupy ("Chaos") albo podgrupy ("Chaos › Zwierzoludzie"). */
export function creaturesInGroup(key: string): CreatureDef[] {
  return getCreatures().filter((c) => c.group === key || creatureGroupKey(c) === key);
}

export function getCreatureFamilies(): CreatureFamiliesData {
  return data().creatureFamilies;
}

/** Czy stworzenie moze rozwijac sie przez profesje (orkowie, skaveny, kultysci...). */
export function isCivilized(creature: string | undefined): boolean {
  const c = getCreature(creature);
  if (!c) return false;
  const fam = data().creatureFamilies;
  if (c.civilized !== undefined) return c.civilized;
  return !!fam.families[c.family]?.civilized && !fam.notCivilized.includes(c.name);
}

/** Nazwa profesji w formie dla plci (brak danych = nazwa z ksiazki). */
export function professionName(profession: string, sex: Sex | undefined): string {
  const forms = data().professionTitles?.professions[profession];
  return forms && sex ? forms[sex === "K" ? 1 : 0] : profession;
}

/** Tytul poziomu profesji w formie dla plci (bez plci - tytul z ksiazki). */
export function professionTitle(profession: string, level: number, sex: Sex | undefined): string | undefined {
  const forms = data().professionTitles?.titles[`${profession}|${level}`];
  if (forms && sex) return forms[sex === "K" ? 1 : 0];
  return getProfession(profession)?.levels.find((l) => l.level === level)?.title;
}

export function getMagicItems(): MagicItemsData | undefined {
  return data().magicItems;
}

export function getTreasures(): TreasuresData | undefined {
  return data().treasures;
}

export function getVampires(): VampiresData | undefined {
  return data().vampires;
}

export function getMutations(): MutationsData {
  return data().mutations;
}
