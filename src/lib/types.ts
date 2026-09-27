/** Typy danych gry (public/data/*.json) i modelu BN. */

import type { Attribute } from "./rules";

// ---------------------------------------------------------------------------
// Dane gry przeniesione z karty postaci
// ---------------------------------------------------------------------------

/** Wariant zasad: Pod Bronia (baza) albo Pelne Domowe. */
export type Ruleset = "pod_bronia" | "domowe";

/** Pola nadpisujace baze w wariancie domowym (fallback pole-po-polu). */
export interface EntryVariants<T> {
  domowe?: Partial<T>;
}

export interface ProfessionLevel {
  level: number;
  title: string;
  status: string;
  characteristics: string[];
  skills: string[];
  talents: string[];
  trappings: string[];
}

export interface Profession {
  races: string[];
  characteristics_pending?: boolean;
  levels: ProfessionLevel[];
  class?: string;
  source?: string;
  page?: number | string;
  variants?: EntryVariants<Profession>;
}

export interface GameClass {
  description: string;
  careers: string[];
}

export type ClassesData = Record<string, GameClass>;

export type TalentMaxType = "none" | "fixed" | "characteristic" | "special";

export interface TalentMax {
  type: TalentMaxType;
  value?: number;
  attr?: string;
  attr_name?: string;
}

export interface Talent {
  max: TalentMax;
  max_raw?: string | null;
  tests?: string | null;
  description?: string;
  source?: string;
  /** Kod cechy, do ktorej talent dodaje +5 (np. Urodzony Wojownik -> WW). */
  adds_characteristic?: string;
  /** Talent zwieksza Zywotnosc o Bonus z Wytrzymalosci (Twardziel). */
  wounds_toughness_bonus?: boolean;
  variants?: EntryVariants<Talent>;
}

export interface SkillDef {
  name: string;
  attr: string;
  grouped: boolean;
}

export type RaceTalent =
  | { type: "fixed"; name: string }
  | { type: "choice"; options: string[] }
  | { type: "random"; count: number };

export interface RaceDef {
  randomMin: number;
  randomMax: number;
  characteristics: Record<string, number>;
  woundsIncludeStrength: boolean;
  fate: number;
  resilience: number;
  extraPoints: number;
  movement: number;
  skills: string[];
  talents: RaceTalent[];
}

export interface RacesData {
  randomTalentsTable: { min: number; max: number; name: string }[];
  races: Record<string, RaceDef>;
}

// ---------------------------------------------------------------------------
// Dane generatora (edytowalne recznie)
// ---------------------------------------------------------------------------

/** Cecha Stworzenia (creature_traits.json). */
export interface CreatureTrait {
  /** Modyfikatory cech (kod -> wartosc). */
  modifiers?: Partial<Record<Attribute, number>>;
  /** Premie do umiejetnosci (nazwa -> wartosc), np. Czujny: Percepcja +30. */
  skills?: Record<string, number>;
  /** Zmiana Szybkosci. */
  movement?: number;
  /** Czy cecha bierze udzial w losowaniu cech opcjonalnych. */
  randomPool: boolean;
  description: string;
  /** Pelny tekst zasady z podrecznika (jesli rozni sie od krotkiego opisu). */
  rules?: string;
  source?: string;
}

/** Profil Bohatera z Bestiariusza (hero_profiles.json). */
export interface HeroProfile {
  modifiers: Partial<Record<Attribute, number>>;
  traits: string[];
  description: string;
  source?: string;
}

export type TierId = "slaby" | "sredni" | "zaawansowany" | "doswiadczony" | "heroiczny";

export const TIER_IDS: readonly TierId[] = ["slaby", "sredni", "zaawansowany", "doswiadczony", "heroiczny"];

/** Poziom zaawansowania BN (tiers.json). */
export interface TierDef {
  label: string;
  description: string;
  /** Waga przy calkowicie losowym wyborze poziomu. */
  randomWeight: number;
  /** Laczna liczba poziomow profesji -> waga. */
  totalLevels: Record<string, number>;
  /** Najwyzszy poziom, jaki BN moze osiagnac w jednej profesji. */
  maxCareerLevel: number;
  /** Czy glowna profesja musi dojsc do 4. poziomu. */
  requireLevel4?: boolean;
  /** Maksymalna liczba profesji w sciezce. */
  maxCareers: number;
  talentsPerLevel: number;
  extraTalentChance: number;
  talentLevelUpChance: number;
  /** Profil bohatera nakladany automatycznie (lub null). */
  heroProfile: string | null;
  /** Zaklecia: najwyzszy PZ oraz odchylenie liczby zaklec tajemnych od Bonusu z Int. */
  spells: { maxCn: number; arcane: [number, number] };
}

export interface GeneratorSettings {
  /** Minimalny wynik 2k10 w kluczowych cechach archetypu (nizszy = przerzut). */
  minKeyRoll: number;
  /** Rozwiniecia za kazdy ukonczony poziom profesji (minimum na poziom). */
  advancePerLevel: number;
  /** Najmniejsze rozwiniecie za obecny, nieukonczony poziom profesji. */
  currentLevelMin: number;
  /** Ile najwazniejszych umiejetnosci archetypu dostaje premie i jaka maksymalnie. */
  keySkillCount: number;
  keySkillBonus: number;
  /** Ile najwazniejszych cech archetypu dostaje premie i jaka maksymalnie. */
  keyCharCount: number;
  keyCharBonus: number;
  /** "add": profil bohatera dodaje stale wartosci; "max": liczy sie tylko nadwyzka ponad rozwiniecia. */
  heroProfileMode: "max" | "add";
  /** "archetype": S i Wt stale, reszta wg kolejnosci cech archetypu; "bestiary": doslownie. */
  heroProfileShape: "archetype" | "bestiary";
  /** Progi k100 dla liczby cech opcjonalnych. */
  traitRoll: { upTo: number; count: number }[];
  defaultTraitWeight: number;
  /** Limit poziomow talentu bez maksimum (dla czytelnosci BN). */
  unlimitedTalentCap: number;
}

export interface TiersData {
  settings: GeneratorSettings;
  tiers: Record<TierId, TierDef>;
}

/** Archetyp BN (archetypes.json). */
export interface Archetype {
  description: string;
  /** Kluczowe cechy w kolejnosci waznosci (kody). */
  characteristics: Attribute[];
  /** Profesje -> waga. */
  professions: Record<string, number>;
  /** Kluczowe umiejetnosci (pelna nazwa lub nazwa bazowa, np. "Broń Biała"). */
  keySkills: string[];
  /** Preferowane talenty (nazwa lub nazwa bazowa) -> waga. */
  talents: Record<string, number>;
  /** Wagi cech opcjonalnych (brak = waga domyslna). */
  traits?: Record<string, number>;
  /** Preferowane specjalizacje: nazwa bazowa -> {specjalizacja: waga}. */
  specializations?: Record<string, Record<string, number>>;
  /** Talenty brane zawsze, gdy pojawia sie na poziomie profesji (np. Magia Prosta). */
  requiredTalents?: string[];
  /** Zestaw pancerza (klucz z weapons.json armourSets) wg poziomu BN. */
  armour?: Partial<Record<TierId, string>>;
}

// ---------------------------------------------------------------------------
// Zaklecia, bron, stworzenia, mutacje
// ---------------------------------------------------------------------------

export interface SpellDef {
  name: string;
  /** Klucz tradycji (Prosta, Tajemna, Ognia, Metalu...). */
  lore: string;
  /** Poziom Zaklecia (PZ). */
  cn: number;
  range: string;
  target: string;
  duration: string;
  description: string;
  source: string;
  page: number;
}

export interface SpellsData {
  lores: Record<string, { label: string; wind: string | null }>;
  spells: SpellDef[];
}

export interface WeaponDef {
  group: string;
  twoHanded?: boolean;
  reach?: string;
  range?: string;
  /** Obrazenia broni (bez BS); null = brak obrazen (np. arkan). */
  damage: number | null;
  /** Czy do obrazen dodaje sie Bonus z Sily. */
  sb: boolean;
  qualities: string[];
  shield?: number;
  note?: string;
}

export interface ArmourDef {
  type: string;
  locations: string[];
  ap: number;
  qualities: string[];
  penalty?: string;
}

export interface WeaponsData {
  melee: Record<string, WeaponDef>;
  ranged: Record<string, WeaponDef>;
  armour: Record<string, ArmourDef>;
  armourSets: Record<string, string[]>;
  aliases: Record<string, string>;
  qualities: Record<string, string>;
}

/** Stworzenie z bestiariusza (creatures.json). Wartosci cech jak w ksiazce. */
export interface CreatureDef {
  name: string;
  source: string;
  page: number;
  group: string;
  family: string;
  unique?: boolean;
  /** Sz, WW ... Ogd, Żyw; null = stworzenie nie posiada cechy ("–"). */
  stats: Record<string, number | null>;
  skills: { name: string; value: number }[];
  talents: string[];
  traits: string[];
  optional: string[];
  abilities: { name: string; description: string }[];
  trappings: string[];
}

export interface CreatureFamily {
  civilized?: boolean;
  skills: Record<string, number>;
  traits: Record<string, number>;
}

export interface CreatureFamiliesData {
  settings: {
    tierFactor: Record<TierId, number>;
    traitCount: Record<TierId, number>;
    optionalChance: Record<TierId, number>;
    tierLabels: Record<TierId, string>;
  };
  families: Record<string, CreatureFamily>;
  notCivilized: string[];
}

export interface MutationRow {
  min: number;
  max: number;
  name: string;
  effect: string;
  modifiers?: Partial<Record<Attribute, number>>;
  movement?: number;
  armour?: number;
  headArmour?: number;
  trait?: string;
  rollLocation?: boolean;
}

export interface MutationsData {
  settings: { chance: number; mentalShare: number };
  physical: MutationRow[];
  mental: MutationRow[];
  locations: { min: number; max: number; name: string }[];
}

export interface SpecializationsData {
  options: Record<string, string[]>;
  linked: string[][];
  lores: { lore: string; wind: string }[];
}

export interface NameTable {
  male: string[];
  female: string[];
  surnames: string[];
}

export interface GroupRow {
  count: number;
  /** Archetyp (dla ras i stworzen cywilizowanych); pusty dla bestii. */
  archetype: string;
  /** Stworzenie z bestiariusza (zamiast rasy). */
  creature?: string;
  tier: TierId;
  race?: string;
  commander?: boolean;
  label?: string;
}

export interface GroupPreset {
  description: string;
  rows: GroupRow[];
}

// ---------------------------------------------------------------------------
// Model BN
// ---------------------------------------------------------------------------

export type Sex = "M" | "K";

/** Jeden przebyty poziom profesji. */
export interface CareerStep {
  profession: string;
  level: number;
}

export interface NpcSkill {
  name: string;
  advances: number;
}

export interface NpcTalent {
  name: string;
  level: number;
}

export interface NpcMutation {
  kind: "physical" | "mental";
  name: string;
  location?: string;
}

/** Sekcje BN, ktore mozna zablokowac przed ponownym losowaniem. */
export type NpcSection = "tozsamosc" | "rzuty" | "rozwoj" | "cechyStworzen";

export const NPC_SECTIONS: readonly NpcSection[] = ["tozsamosc", "rzuty", "rozwoj", "cechyStworzen"];

/** Zapisywalny BN - tylko dane zrodlowe; wartosci koncowe liczy computeNpc(). */
export interface Npc {
  id: string;
  version: 1;
  name: string;
  sex: Sex;
  /** Rasa (dla stworzen: nazwa stworzenia). */
  race: string;
  /** Stworzenie z bestiariusza - baza cech to wartosci z ksiazki minus 10. */
  creature?: string;
  /** Archetyp; pusty dla bestii bez profesji. */
  archetype: string;
  tier: TierId;
  /** Etykieta w grupie (np. "Herszt"). */
  label?: string;
  /** Nazwa grupy/spotkania w bibliotece (np. "Banda z traktu"). */
  group?: string;
  careerPath: CareerStep[];
  /** Wyniki 2k10 na cechy. */
  rolls: Record<Attribute, number>;
  /** Rozwiniecia cech (profesja + premie archetypu). */
  charAdvances: Record<Attribute, number>;
  skills: NpcSkill[];
  talents: NpcTalent[];
  /** Cechy Stworzen. */
  traits: string[];
  /** Profile bohaterow (np. Dowodca Oddzialu). */
  heroProfiles: string[];
  /** Bron (nazwy z weapons.json). */
  weapons: string[];
  /** Elementy pancerza (nazwy z weapons.json). */
  armour: string[];
  /** Zaklecia (nazwy z spells.json). */
  spells: string[];
  mutations: NpcMutation[];
  trappings: string[];
  money: string;
  notes: string;
  /** Wybrane specjalizacje (nazwa bazowa -> specjalizacja), dla spojnosci. */
  specChoices: Record<string, string>;
  locks: Partial<Record<NpcSection, boolean>>;
  createdAt: string;
}
