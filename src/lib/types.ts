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
  /** Maks. dodatkowe rozwiniecia kluczowych umiejetnosci archetypu. */
  keySkillBonus: number;
  /** Maks. dodatkowe rozwiniecia kluczowych cech archetypu. */
  keyCharBonus: number;
  talentsPerLevel: number;
  extraTalentChance: number;
  talentLevelUpChance: number;
  /** Profil bohatera nakladany automatycznie (lub null). */
  heroProfile: string | null;
}

export interface GeneratorSettings {
  /** Minimalny wynik 2k10 w kluczowych cechach archetypu (nizszy = przerzut). */
  minKeyRoll: number;
  advancePerLevel: number;
  /** Losowe odchylenie rozwiniec na poziom (+/-). */
  advanceJitter: number;
  /** "max": profil bohatera zastepuje rozwiniecia, gdy jest wyzszy; "add": sumuje. */
  heroProfileMode: "max" | "add";
  /** "archetype": wartosci profilu przydzielane wg kolejnosci cech archetypu; "bestiary": doslownie. */
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
  archetype: string;
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

/** Sekcje BN, ktore mozna zablokowac przed ponownym losowaniem. */
export type NpcSection = "tozsamosc" | "rzuty" | "rozwoj" | "cechyStworzen";

export const NPC_SECTIONS: readonly NpcSection[] = ["tozsamosc", "rzuty", "rozwoj", "cechyStworzen"];

/** Zapisywalny BN - tylko dane zrodlowe; wartosci koncowe liczy computeNpc(). */
export interface Npc {
  id: string;
  version: 1;
  name: string;
  sex: Sex;
  race: string;
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
  trappings: string[];
  money: string;
  notes: string;
  /** Wybrane specjalizacje (nazwa bazowa -> specjalizacja), dla spojnosci. */
  specChoices: Record<string, string>;
  locks: Partial<Record<NpcSection, boolean>>;
  createdAt: string;
}
