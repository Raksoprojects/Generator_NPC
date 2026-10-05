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
  /** Profesja renegata: moze po niej przyjsc ktos z innej profesji magicznej (np. zbiegly czarodziej). */
  renegade?: boolean;
  /** Profesja zaawansowana (np. elfi kaplani, poziomy 3-5): wchodzi sie po danym poziomie innej profesji. */
  entry?: { from: string; level: number };
  /** Tradycja zaklec profesji, glowna dla BN (np. Magia Vaula u Kaplana-Kowala). */
  spellLore?: string;
  /** Najnizszy poziom BN, na ktorym generator losuje te profesje (elfi kaplani - heroiczny). */
  minTier?: TierId;
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
  /** Najnizszy poziom BN, na ktorym generator daje ten talent (np. Wysoka Magia - heroiczny). */
  minTier?: TierId;
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
  /** Inne nazwy tej cechy (Bestiariusz 2.0, opisy stworzen), np. Czempion: ["Mistrz"]. */
  aliases?: string[];
}

/** Profil Bohatera z Bestiariusza (hero_profiles.json). */
export interface HeroProfile {
  modifiers: Partial<Record<Attribute, number>>;
  traits: string[];
  description: string;
  source?: string;
}

export type TierId = "slaby" | "sredni" | "zaawansowany" | "doswiadczony" | "heroiczny" | "legendarny";

export const TIER_IDS: readonly TierId[] = ["slaby", "sredni", "zaawansowany", "doswiadczony", "heroiczny", "legendarny"];

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
  /**
   * Dodatkowy profil przy losowaniu - najwyzej jeden, szanse sie wykluczaja
   * (np. zaawansowany: Weteran 10%, Doborowy 5%, Pomniejszy Bohater 10%).
   */
  heroProfileChances?: { profile: string; chance: number }[];
  /** Premia kluczowych umiejetnosci archetypu i laczne rozwiniecia min/max. */
  keySkills: KeyBonus;
  /** Premia kluczowych cech archetypu i laczne rozwiniecia min/max (bez profilu bohatera). */
  keyChars: KeyBonus;
  /** Zaklecia: najwyzszy PZ oraz odchylenie liczby zaklec tajemnych od Bonusu z Int. */
  /**
   * extraLores: szanse na kolejne tradycje (po kolei) dla ras z settings.multiLoreRaces.
   * topSpells: ile najsilniejszych zaklec glownej tradycji BN zna na pewno.
   */
  /** casterAdvances: rozwiniecia Splatania i Jezyka (Magicznego) stworzen czarujacych z cechy Rzucanie Czarow. */
  spells: { maxCn: number; arcane: [number, number]; extraLores?: number[]; topSpells?: number; casterAdvances?: number };
  /** Profesja z 5. poziomem (np. elfi Mag -> Arcymag) moze na nim dojsc do 5. poziomu. */
  allowLevel5?: boolean;
  /** Mnoznik rozwiniec za poziom profesji u ras (stworzenia maja zamiast tego profile bohaterow). */
  advanceMultiplier?: number;
}

/**
 * Premia archetypu na poziomie BN: losowa premia z zakresu `bonus`, a potem
 * laczne rozwiniecia przyciete do [min, max]. Progi nie nachodza na siebie,
 * wiec wyzszy poziom tego samego BN jest zawsze lepszy w kluczowych rzeczach.
 */
export interface KeyBonus {
  bonus: [number, number];
  min?: number;
  max?: number;
}

export interface GeneratorSettings {
  /** Minimalny wynik 2k10 w kluczowych cechach archetypu (nizszy = przerzut). */
  minKeyRoll: number;
  /** Rozwiniecia za kazdy ukonczony poziom profesji (minimum na poziom). */
  advancePerLevel: number;
  /** Najmniejsze rozwiniecie za obecny, nieukonczony poziom profesji. */
  currentLevelMin: number;
  /** Ile najwazniejszych umiejetnosci archetypu dostaje premie (wysokosc - w poziomie BN). */
  keySkillCount: number;
  /** Ile najwazniejszych cech archetypu dostaje premie (wysokosc - w poziomie BN). */
  keyCharCount: number;
  /** "archetype": S i Wt stale, reszta wg kolejnosci cech archetypu; "bestiary": doslownie. */
  heroProfileShape: "archetype" | "bestiary";
  /** Progi k100 dla liczby cech opcjonalnych. */
  traitRoll: { upTo: number; count: number }[];
  defaultTraitWeight: number;
  /** Limit poziomow talentu bez maksimum (dla czytelnosci BN). */
  unlimitedTalentCap: number;
  /** Rasy, ktorych czarodzieje moga poznac kolejne tradycje tajemne (spells.extraLores). */
  multiLoreRaces?: string[];
  /** Profile nakladane automatycznie tylko na stworzenia; rasy dostaja zamiast nich mocniejszy rozwoj (advanceMultiplier). */
  creatureOnlyProfiles?: string[];
  /** Rzadkie talenty rasy (np. Krew Aenariona u Wysokich Elfow: 1%, u szlachty 5%). */
  raceTalents?: { race: string; talent: string; chance: number; archetypes?: Record<string, number> }[];
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
  /** Elfie Zaklecia Tajemne: tradycje, ktore czarujacy musi znac wszystkie. */
  requires?: string[];
  winds?: string[];
}

export interface SpellsData {
  /** rule = regula tradycji z podrecznika (np. Ognia: +1 poziom Podpalenia). */
  lores: Record<string, { label: string; wind: string | null; rule?: string }>;
  spells: SpellDef[];
}

export interface WeaponDef {
  group: string;
  /** "jednoręczna", "dwuręczna", "druga ręka", "z siodła"... */
  hands?: string;
  twoHanded?: boolean;
  reach?: string;
  range?: string;
  /** Obrazenia broni (bez BS); null = brak obrazen (np. arkan). */
  damage: number | null;
  /** Czy do obrazen dodaje sie Bonus z Sily. */
  sb: boolean;
  /** Zalety ("A albo B" = wybor przed rzutem). */
  qualities: string[];
  /** Wady. */
  flaws?: string[];
  shield?: number;
  note?: string;
  enc?: string;
  availability?: string;
  source?: string;
  page?: number;
}

/** Wagi wyboru broni dla wyposazenia "broń ręczna" / "broń dwuręczna". */
export interface WeaponChoice {
  default: Record<string, number>;
  race?: Record<string, Record<string, number>>;
  archetype?: Record<string, Record<string, number>>;
  creatureGroup?: Record<string, Record<string, number>>;
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
  /** Stare nazwy broni (zapisane BN) -> nazwy z kart. */
  legacy: Record<string, string>;
  handWeapon: WeaponChoice;
  twoHandedWeapon: WeaponChoice;
  qualities: Record<string, string>;
  /** Wlasne odmiany broni rasy (krasnoludzki topor zamiast topora), z szansa. */
  raceVariants?: Record<string, { chance: number; weapons: Record<string, string> }>;
}

/** Warunki dopasowania (rasa, grupa stworzen, archetyp) - wszystkie podane musza pasowac do jednego z wpisow. */
export interface CraftModifier {
  races?: string[];
  groups?: string[];
  archetypes?: string[];
  /** Opis pochodzenia wyrobu ("krasnoludzka robota"). */
  label?: string;
  /** Zalety, ktore przedmiot ma zawsze (np. elfie "Wytrzymały 1", "Wyśmienity 1"). */
  always?: string[];
  flawMult?: number;
  qualityMult?: number;
  flaws?: Record<string, number>;
  qualities?: Record<string, number>;
}

export interface CraftMaterial {
  label: string;
  races: string[];
  chance: Partial<Record<TierId, number>>;
  weapon?: { qualities: string[]; byName?: Record<string, string[]> };
  armour?: { types: string[]; qualities: string[]; apBonus?: Record<string, number> };
  description: string;
  source: string;
  page: number;
}

export interface CraftData {
  qualities: Record<string, string>;
  flaws: Record<string, string>;
  tiers: Record<TierId, { flaw: number; quality: number; maxQualities: number }>;
  defaultFlaws: Record<string, number>;
  defaultQualities: Record<string, number>;
  modifiers: CraftModifier[];
  materials: Record<string, CraftMaterial>;
}

/** Efekty przedmiotu magicznego, runy albo wlasciwosci Broni Chaosu liczone w statystykach. */
export interface ItemEffects {
  damage?: number;
  /** Premia do umiejetnosci broni, na ktorej jest przedmiot. */
  skill?: number;
  chars?: Partial<Record<Attribute, number>>;
  ap?: number;
  wounds?: number;
  qualities?: string[];
}

// ---------------------------------------------------------------------------
// Generator przedmiotow magicznych i lupow (artefacts.json, loot.json)
// ---------------------------------------------------------------------------

/** Wiersz tabeli k100 (min-max) z opcjonalnymi zasadami dla generatora. */
export interface TableRow {
  min: number;
  max: number;
  name: string;
  text?: string;
  cursed?: boolean;
  /** Przeklety wynik: rzuc jeszcze raz w tej tabeli, by ustalic moc. */
  reroll?: boolean;
  /** Wyniki, przy ktorych przeklety przedmiot ma tez dobroczynna moc (mikstury 99-100). */
  rerollOn?: number[];
  /** Dodatkowe rzuty generatora: species, attack, spell, powerStone... */
  rolls?: string[];
  runes?: "weapon" | "armour" | "talisman";
  noWp?: boolean;
  wp?: string | number;
  effects?: ItemEffects;
  duration?: string;
  ingredients?: string;
  noEffect?: boolean;
  twice?: boolean;
  thrice?: boolean;
  flaw?: boolean;
  major?: boolean;
  permanentMinor?: boolean;
  lores?: string[];
  lore?: string;
  count?: number | string;
  wpDice?: string;
  ap?: number;
  qualities?: string[];
  column?: string;
  dice?: string;
  value?: number;
  damage?: number;
  /** Podtabela k10 rodzaju broni: [od, do, nazwa]. */
  d10?: [number, number, string][];
  ranged?: boolean;
  special?: "silver" | "runes" | "chaos" | "daemon";
  klauser?: number;
  regular?: number;
  master?: number;
  death?: boolean;
  melee?: boolean;
  thrown?: boolean;
}

export interface WeaponAbility {
  name: string;
  text: string;
  melee?: [number, number];
  ranged?: [number, number];
  cursed?: boolean;
  rolls?: string[];
  effects?: ItemEffects;
}

export interface RenownedItem {
  name: string;
  wp: number | null;
  value: string;
  enc: number;
  availability: string;
  text: string;
}

export interface ArtefactCategory {
  name: string;
  wp?: string;
  limit?: string;
  intro?: string;
  /** Rzut w ogolnej tabeli Zalet i Wad przedmiotow magicznych. */
  itemQualities?: boolean;
  items?: TableRow[];
  // Amunicja
  kinds?: TableRow[];
  columns?: Record<string, TableRow[]>;
  powers?: Record<string, { text: string; cursed?: boolean; rolls?: string[] }>;
  // Pancerze
  pieces?: TableRow[];
  enchantmentCount?: TableRow[];
  protection?: TableRow[];
  enchantments?: TableRow[];
  wizardry?: TableRow[];
  // Bronie
  types?: TableRow[];
  abilityCount?: TableRow[];
  abilities?: WeaponAbility[];
  might?: TableRow[];
  silver?: string;
  chaos?: string;
  daemon?: string;
  renowned?: RenownedItem[];
}

export interface ArtefactsData {
  note: string;
  source: string;
  categoryTable: TableRow[];
  categories: Record<string, ArtefactCategory>;
  tables: {
    characteristic: string[];
    species: TableRow[];
    attackProtection: TableRow[];
    spellLore: TableRow[];
    powerStones: TableRow[];
    blessings: TableRow[];
    qualities: { qualities: TableRow[]; flaws: TableRow[] };
    weaponQualities: { qualities: TableRow[]; flaws: TableRow[] };
    charArmour: TableRow[];
    charWeapon: TableRow[];
    minorCurses: TableRow[];
    majorCurses: TableRow[];
  };
  klauser: { intro: string; armour: TableRow[]; weapon: TableRow[]; death: TableRow[] };
  runeCount: TableRow[];
}

/** Lokacja w tabeli lupow; pola "szansa:kosci" ("25:1k10") albo same kosci; null = brak. */
export interface LootLocation {
  id: string;
  name: string;
  group: string;
  status: "brąz" | "srebro" | "złoto";
  description: string;
  money: { p: string | null; s: string | null; zk: string | null };
  domestic: string | null;
  gems: string | null;
  art: string | null;
  cloth: string | null;
  scrolls: string | null;
  grimoire: string | null;
  magic: string | null;
  /** Dodatkowe tabele przedmiotow: [klucz tabeli, "szansa:kosci"]; "bron"/"pancerz" - z Wadami. */
  extra: [string, string][];
  added?: boolean;
}

export interface LootTable {
  label: string;
  /** Wartosc sztuki w monetach Statusu lokacji ("2k10", "1k10*5"). */
  valueDice?: string;
  rows?: TableRow[];
  byStatus?: Record<string, TableRow[]>;
}

export interface LootData {
  note: string;
  levels: { level: number; label: string }[];
  coinByStatus: Record<string, "p" | "s" | "zk">;
  locations: LootLocation[];
  tables: Record<string, LootTable>;
  weaponFlaws: TableRow[];
  armourFlaws: TableRow[];
}

export interface RuneDef {
  name: string;
  sl: number;
  effect: string;
  page: number;
  master?: boolean;
  effects?: ItemEffects;
}

export interface ChaosPropertyDef {
  name: string;
  god: string;
  effect: string;
  page: number;
  effects?: ItemEffects;
}

/** Szablon przedmiotu magicznego do losowania (treasures.json). */
export interface TreasureDef {
  name: string;
  /** weapon/armour = zaklina bron albo pancerz BN; item = osobny przedmiot; potion = losowa mikstura. */
  kind: "weapon" | "armour" | "item" | "potion";
  description: string;
  source: string;
  page?: number;
  weight: number;
  minTier?: TierId;
  forRaces?: string[];
  forGroups?: string[];
  forTalents?: string[];
  forLores?: string[];
  forCasters?: boolean;
  forBloodlines?: string[];
  /** Umiejetnosc, ktora BN musi miec (np. Broń Zasięgowa (Łuk) dla przekletego luku). */
  needsSkill?: string;
  /** Bron/pancerz tego rodzaju, ktory przedmiot zastepuje (albo dodaje, gdy extra). */
  replaces?: string | null;
  extra?: boolean;
  runes?: "weapon" | "armour" | "talisman";
  chaos?: [number, number];
  /** Bron demoniczna - demon wg boga BN (daemons w treasures.json). */
  daemon?: boolean;
  material?: string;
  cursed?: boolean;
  effects?: ItemEffects;
}

/** Przedmioty runiczne - losowane osobno od pozostalych przedmiotow magicznych. */
export interface RunicData {
  /** Szansa na przedmiot z runa tymczasowa wg poziomu. */
  temporary: Partial<Record<TierId, number>>;
  /** Szansa na trwaly przedmiot runiczny wg poziomu. */
  permanent: Partial<Record<TierId, number>>;
  /** Mnoznik obu szans wg rasy (krasnoludy czesciej, elfy rzadko); stworzenia nie maja run. */
  raceMult: Record<string, number>;
  /** Zwykle runy trwalego przedmiotu (najwyzej 3 - Prawo Trzech). */
  regularCount: Partial<Record<TierId, [number, number]>>;
  /** Szansa na dodatkowa rune mistrzowska (najwyzej 1 - Prawo Zazdrosci). */
  masterChance: Partial<Record<TierId, number>>;
  /** Liczba run tymczasowych (najwyzej 3, bez mistrzowskich). */
  temporaryCount: Partial<Record<TierId, [number, number]>>;
  temporaryNote: string;
}

export interface TreasuresData {
  chances: Record<TierId, number[]>;
  runic: RunicData;
  fitWeight: number;
  craft: CraftData;
  runes: Record<"weapon" | "armour" | "talisman", RuneDef[]>;
  chaosProperties: ChaosPropertyDef[];
  /** Demony broni demonicznej: bog -> pomniejszy/wiekszy. */
  daemons: Record<string, Record<"lesser" | "greater", { name: string; benefit: string }>>;
  greaterDaemonChance: Partial<Record<TierId, number>>;
  items: TreasureDef[];
}

/** Jakosc wykonania broni/pancerza BN. */
export interface ItemCraft {
  qualities: string[];
  flaws: string[];
  material?: string;
  label?: string;
}

/** Przedmiot magiczny BN. */
export interface NpcMagicItem {
  /** Szablon z treasures.json (albo nazwa mikstury). */
  template: string;
  name: string;
  /** Bron albo "pancerz", na ktorej jest przedmiot. */
  base?: string;
  runes?: string[];
  /** Runa tymczasowa - gasnie po pierwszym zadzialaniu. */
  temporary?: boolean;
  properties?: string[];
  /** Demon uwieziony w broni demonicznej. */
  daemon?: string;
}

/** Stworzenie z bestiariusza (creatures.json). Wartosci cech jak w ksiazce. */
export interface CreatureDef {
  name: string;
  source: string;
  page: number;
  /** Grupa w generatorze (Chaos, Nieumarli, Wampiry...) i opcjonalna podgrupa (Zwierzoludzie...). */
  group: string;
  subgroup?: string;
  family: string;
  unique?: boolean;
  /** Nadpisuje rodzine: istota rozumna, moze miec profesje (wampir, ogr). */
  civilized?: boolean;
  /** Dozwolone archetypy (z wagami przy losowaniu); brak = wszystkie. */
  archetypes?: Record<string, number>;
  /** Szansa, ze BN tego stworzenia bez wybranego archetypu dostanie profesje (wampir 1, ogr 0,5). */
  archetypeChance?: number;
  /** Sz, WW ... Ogd, Żyw; null = stworzenie nie posiada cechy ("–"). */
  stats: Record<string, number | null>;
  skills: { name: string; value: number }[];
  talents: string[];
  traits: string[];
  optional: string[];
  abilities: { name: string; description: string }[];
  trappings: string[];
  /** Najnizszy poziom BN, na jakim stworzenie wystepuje (np. Wojownik Chaosu: zaawansowany). */
  minTier?: TierId;
  /** Status z bloku (dodatki, np. "Srebro 4"). */
  status?: string | null;
}

export interface CreatureFamily {
  civilized?: boolean;
  skills: Record<string, number>;
  traits: Record<string, number>;
}

export interface CreatureFamiliesData {
  settings: {
    tierFactor: Record<TierId, number>;
    /** Rozwiniecia ponad umiejetnosci z ksiazki. */
    skillBonus?: Record<TierId, number>;
    /** Rozwiniecia cech z charCodes (tylko cechy, ktore stworzenie ma). */
    charAdvances?: Record<TierId, number>;
    charCodes?: Attribute[];
    traitCount: Record<TierId, number>;
    optionalChance: Record<TierId, number>;
    tierLabels: Record<TierId, string>;
    /** Kolejnosc grup stworzen w generatorze (pozostale na koncu). */
    groupOrder?: string[];
  };
  families: Record<string, CreatureFamily>;
  notCivilized: string[];
}

/** Przedmiot magiczny (Wiatry Magii) z premiami do czarowania. */
export interface MagicItem {
  name: string;
  /** Nazwy w wyposazeniu profesji oznaczajace ten przedmiot. */
  matches: string[];
  description: string;
  channelSL?: number;
  castSL?: number;
  /** Zmiana PZ zaklec tradycji wlasciciela i wspolnych tajemnych. */
  cnMod?: number;
  scroll?: boolean;
  /** Przedmioty z tej samej grupy (np. szaty) nie sumuja sie - liczy sie najlepszy. */
  group?: string;
  source?: string;
  page?: number;
  random?: { weight?: number; lores?: string[] };
}

export interface MagicItemsData {
  talents: Record<string, { castSL?: number; channelSL?: number; note?: string }>;
  items: MagicItem[];
  magicItemTrappings: string[];
}

/** Wampiry (dodatek): Linie Krwi, Dary Krwi i Slabosci w formacie wierszy mutacji. */
export interface VampiresData {
  creatures: string[];
  giftsPerTier: Record<TierId, number>;
  bloodlineGiftWeight: number;
  ageByTier: Record<TierId, number>;
  bloodlines: (MutationRow & {
    gifts: string[];
    weaknesses: string[];
    lores: string;
    /** Archetypy wg Preferowanych Profesji linii (z wagami). */
    archetypes?: Record<string, number>;
    /** Zamilowanie linii do czarow (Nekrarcha 3, Strigoi 0,5). */
    magic?: number;
    casting?: VampireCasting;
    /** Jedyne dozwolone profesje (Strigoi: proste, dzikie). */
    professions?: string[];
    /** Bez pancerza - poza magicznym od heroicznego (Strigoi). */
    noArmour?: boolean;
    turning?: VampireTurning;
  })[];
  gifts: (MutationRow & { limit?: string; recommended?: string })[];
  weaknesses: MutationRow[];
  /** Rozwiniecia Splatania i Jezyka (Magicznego) wampira na poziomie, mnozone przez magic / 2. */
  magicAdvances?: Partial<Record<TierId, number>>;
}

/** Przemiana czlowieka w wampira tej Linii Krwi (Krwawy Pocałunek). */
export interface VampireTurning {
  /** Premie do Cech wzgledem czlowieka. */
  modifiers: Partial<Record<"WW" | "US" | "S" | "Wt" | "I" | "Zw" | "Zr" | "Int" | "SW" | "Ogd", number>>;
  movement: number;
  /** 12 Umiejetnosci Rasowych linii: 3 dostaja +5, 3 kolejne +3. */
  skills: string[];
  /** 5 Talentow linii; "A lub B" - jeden z nich, "losowy" - z Tabeli Losowych Talentow. */
  talents: string[];
  trappings: string[];
}

/** Czarowanie wampirow danej Linii Krwi. */
export interface VampireCasting {
  /** Szansa, ze wampir czaruje, wg poziomu (brak poziomu = wcale). */
  chance: Partial<Record<TierId, number>>;
  /** Co najmniej tyle rozwiniec Splatania i Jezyka (Magicznego). */
  minAdvances?: number;
  maxArcane?: number;
  maxPetty?: number;
  /** Tradycje zamiast tradycji linii (np. "Zwierząt albo Nekromancja"). */
  lores?: string;
  /** Tylko zaklecia bezposrednie: zadajace Obrazenia albo rzucane na siebie. */
  direct?: boolean;
}

/** Formy [meska, zenska]: nazwy profesji i tytuly poziomow ("Profesja|poziom"). */
export interface ProfessionTitlesData {
  professions: Record<string, [string, string]>;
  titles: Record<string, [string, string]>;
}

/** Liczba albo kosci rzucane przy losowaniu mutacji, np. "k10", "-2k10". */
export type MutationValue = number | string;

export type MutationSeverity = "trivial" | "minor" | "major";

export interface MutationRow {
  min: number;
  max: number;
  name: string;
  effect?: string;
  modifiers?: Partial<Record<Attribute, MutationValue>>;
  skills?: Record<string, MutationValue>;
  movement?: number;
  wounds?: number;
  armour?: number;
  headArmour?: number;
  /** Gorny limit cechy, np. Ogłada nie wyzej niz 0. */
  maxChar?: Partial<Record<Attribute, number>>;
  trait?: string;
  rollLocation?: boolean;
  /** Wiersz "rzuc na wyzsza tabele". */
  reroll?: MutationSeverity;
}

export interface MutationsData {
  settings: {
    chance: number;
    mentalShare: number;
    /** "handbook" - tabele Mutant's Handbook wg powagi; "core" - tabele z podrecznika. */
    source?: "handbook" | "core";
    severity?: { min: number; max: number; table: MutationSeverity }[];
    severityPerMutation?: number;
    severityMaxBonus?: number;
  };
  physical: MutationRow[];
  mental: MutationRow[];
  handbook?: Record<"physical" | "mental", Record<MutationSeverity, MutationRow[]>>;
  /** Dary Chaosu (Warriors of Chaos): grupy BN i ich szanse wg poziomu oraz tabela k10. */
  chaosGifts?: {
    groups: Record<string, { creatures?: string[]; talents?: string[]; chances: Record<TierId, number[]> }>;
    rows: MutationRow[];
  };
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
  /** Grupa stworzen - kazdy BN wiersza losowany z niej osobno ("Nieumarli", "Chaos › Zwierzoludzie"). */
  creatureGroup?: string;
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
  /** gift = Dar Chaosu (tabela Oka Bogow); bloodline/blood/weakness = Linia Krwi, Dar Krwi, Slabosc wampira. */
  kind: "physical" | "mental" | "gift" | "bloodline" | "blood" | "weakness";
  name: string;
  /** Tabela Mutant's Handbook; brak = tabele z podrecznika. */
  table?: MutationSeverity;
  location?: string;
  /** Wyniki kosci z wiersza, np. { "Zw": -7, "skill:Atletyka": 4 }. */
  rolled?: Record<string, number>;
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
  /** Wampir przemieniony z czlowieka: cechy czlowieka + premie Linii Krwi zamiast profilu z bestiariusza. */
  turned?: boolean;
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
  /** Jakosc wykonania broni i pancerza (nazwa -> Zalety/Wady, material). */
  craft?: Record<string, ItemCraft>;
  /** Przedmioty magiczne (zaklete bronie, runy, talizmany...). */
  magicItems?: NpcMagicItem[];
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
