/**
 * Stworzenia z bestiariusza.
 *
 * Cechy: wartosc z ksiazki minus 10 to baza, do ktorej rzucamy 2k10 (jak dla
 * ras). Cecha o wartosci 5 lub mniejszej to po prostu 1k10. Brak cechy ("–")
 * zostaje brakiem. Statystyki ksiazkowe zawieraja juz Cechy Stworzen
 * stworzenia (np. Twardy trolla) - dodajemy tylko cechy wylosowane.
 *
 * Rozwoj bestii (bez profesji) - patrz creature_families.json:
 *   - slaby = profil z ksiazki + umiejetnosci rodziny; kazdy poziom wyzej +5 do cech i umiejetnosci,
 *   - umiejetnosci rodziny: premia = pasowanie (10–40) x wspolczynnik poziomu,
 *   - Cechy Stworzen z wag rodziny: 0/1/1/2/3 wg poziomu,
 *   - cechy "Opcjonalne" z ksiazki: szansa rosnaca z poziomem.
 * Stworzenia cywilizowane (orkowie, skaveny, kultysci...) z archetypem
 * rozwijaja sie przez profesje jak ludzie.
 */

import { chance, randInt, rollDie, weightedKey, weightedPick, type Rng } from "./dice";
import { arrangeRolls } from "./charRolls";
import { nextAdvanceCost } from "./xp";
import * as gd from "./gameData";
import { ATTRIBUTES, characteristicBonus, type Attribute } from "./rules";
import { TIER_IDS, type CreatureDef, type Npc, type TierId } from "./types";

/** Baza cechy stworzenia i rodzaj rzutu. */
export function creatureBase(creature: CreatureDef, code: Attribute): { base: number; die: "2k10" | "1k10" | null } {
  const v = creature.stats[code];
  if (v == null) return { base: 0, die: null };
  if (v <= 5) return { base: 0, die: "1k10" };
  return { base: v - 10, die: "2k10" };
}

/**
 * Rzuty na cechy stworzenia (minimum kluczowych cech archetypu dla cywilizowanych).
 * book [dom]: profil z ksiazki to baza z rzutami 10 (cechy do 5 - sama wartosc); osobniki roznia sie dopiero rozwojem.
 */
export function rollCreature(
  creature: CreatureDef,
  keyChars: Attribute[],
  rng: Rng,
  deterministic = false,
  spread?: number,
  free = false,
  book = false
): Record<Attribute, number> {
  const out = {} as Record<Attribute, number>;
  const twoDice: Attribute[] = [];
  for (const code of ATTRIBUTES) {
    const { die } = creatureBase(creature, code);
    if (!die) out[code] = 0;
    else if (die === "1k10") out[code] = book ? (creature.stats[code] ?? 0) : deterministic ? 5 : rollDie(10, rng);
    else twoDice.push(code);
  }
  if (book) {
    for (const c of twoDice) out[c] = 10;
    return out;
  }
  // Cechy 2k10: rozdzielane jak u ras (charRolls.ts); rollSpread zaweza rozrzut stworzen.
  if (deterministic) {
    for (const c of twoDice) out[c] = 11;
    return out;
  }
  return { ...out, ...arrangeRolls(twoDice, keyChars, rng, spread, free) };
}

export function sizeOf(traits: string[]): string {
  for (const t of traits) {
    const m = /^Rozmiar \(([^)]+)\)/.exec(t);
    if (m) return m[1].split(/\s/)[0];
  }
  return "Średni";
}

/**
 * Zywotnosc stworzenia wg Rozmiaru (podrecznik s. 341): Drobny 1, Niewielki BWt,
 * Maly 2xBWt+BSW, Sredni BS+2xBWt+BSW, Duzy x2, Wielki x4, Monstrualny x8;
 * Twardziel dodaje BWt przed mnoznikiem; Roj x5 i ignoruje Rozmiar.
 * Stworzenie bez Sily Woli uzywa Bonusu z Sily.
 */
export function creatureWounds(
  s: number,
  t: number,
  wp: number | null,
  traits: string[],
  hardy: number
): number {
  const sb = characteristicBonus(s);
  const tb = characteristicBonus(t);
  const wpb = wp == null ? sb : characteristicBonus(wp);
  const swarm = traits.some((x) => /^Rój/.test(x));
  const size = swarm ? "Średni" : sizeOf(traits);
  let w: number;
  if (size === "Drobny") w = 1;
  else if (size === "Niewielki") w = tb;
  else if (size === "Mały") w = 2 * tb + wpb;
  else w = sb + 2 * tb + wpb;
  w += hardy * tb;
  const mult: Record<string, number> = { Duży: 2, Wielki: 4, Monstrualny: 8 };
  w *= mult[size] ?? 1;
  if (swarm) w *= 5;
  return w;
}

/** Naturalne ataki z cech ksiazkowych (Broń +X, Ugryzienie +X, Ogon, Rogi, Macki, Język, Strzelanie, Zionięcie). */
export interface NaturalAttack {
  name: string;
  /** Obrazenia bez Bonusu z Sily (dla ataków wręcz) albo stale. */
  base: number;
  addsSb: boolean;
  range?: string;
  count?: number;
  trait: string;
}

export function naturalAttacks(creature: CreatureDef): NaturalAttack[] {
  const sb = characteristicBonus(creature.stats.S ?? 0);
  const out: NaturalAttack[] = [];
  for (const t of creature.traits) {
    let m: RegExpExecArray | null;
    if ((m = /^Broń(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ?? "Broń", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^Ugryzienie(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ? `Ugryzienie (${m[1]})` : "Ugryzienie", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^(?:Atak Ogonem|Ogon) \+(\d+)/.exec(t))) out.push({ name: "Ogon", base: +m[1] - sb, addsSb: true, trait: t });
    else if ((m = /^Rogi(?: \(([^)]+)\))? \+(\d+)/.exec(t))) out.push({ name: m[1] ? `Rogi (${m[1]})` : "Rogi", base: +m[2] - sb, addsSb: true, trait: t });
    else if ((m = /^(?:(\d+)× )?Macki \+(\d+)/.exec(t))) out.push({ name: "Macki", base: +m[2] - sb, addsSb: true, count: m[1] ? +m[1] : 1, trait: t });
    else if ((m = /^Atak Językiem \+(\d+) \((\d+)\)/.exec(t))) out.push({ name: "Język", base: +m[1], addsSb: false, range: m[2], trait: t });
    else if ((m = /^Strzelanie(?: \(([^)]+)\))? \+(\d+) \((\d+)\)/.exec(t))) out.push({ name: m[1] ?? "Strzelanie", base: +m[2], addsSb: false, range: m[3], trait: t });
    else if ((m = /^Zionięcie(?: \(([^)]+)\))? \+(\d+)(?: \(([^)]+)\))?/.exec(t))) out.push({ name: `Zionięcie (${m[1] ?? m[3] ?? "różne"})`, base: +m[2], addsSb: false, trait: t });
    else if ((m = /^Wymiot \+(\d+)/.exec(t))) out.push({ name: "Wymiot", base: +m[1], addsSb: false, trait: t });
  }
  return out;
}

/** Punkty Pancerza z cechy "Pancerz (N)". */
export function creatureArmour(traits: string[]): number {
  for (const t of traits) {
    const m = /^Pancerz\s*\(?(\d+)/.exec(t);
    if (m) return +m[1];
  }
  return 0;
}

/** Umiejetnosci i talenty z ksiazki (wartosci -> rozwiniecia wzgledem cech ksiazkowych). */
export function bookSkillsAndTalents(npc: Npc, creature: CreatureDef): void {
  for (const s of creature.skills) {
    const attr = (gd.skillAttr(s.name) ?? "WW") as Attribute;
    const charValue = creature.stats[attr] ?? 0;
    const adv = Math.max(0, s.value - charValue);
    const owned = npc.skills.find((x) => x.name === s.name);
    if (owned) owned.advances = Math.max(owned.advances, adv);
    else npc.skills.push({ name: s.name, advances: adv });
  }
  for (const t of creature.talents) {
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(t)!;
    const name = m[1].trim();
    const level = m[2] ? +m[2] : 1;
    const owned = npc.talents.find((x) => x.name === name);
    if (owned) owned.level = Math.max(owned.level, level);
    else npc.talents.push({ name, level });
  }
}

/** Cechy "Opcjonalne", ktore mozna nadac automatycznie (bez instrukcji, zmian Rozmiaru i umiejetnosci). */
export function usableOptional(creature: CreatureDef): string[] {
  return creature.optional.filter(
    (o) =>
      // Roj zmienia stworzenie w stado - tylko recznie, nie z losowania.
      !/usuń|dodaj|zmień|zwiększ|^Rozmiar|^Rój|Wszystkie Cechy|^Mutacja|jedynie/i.test(o) &&
      o.length < 60 &&
      !gd.skillAttr(o.replace(/\s+\d+$/, ""))
  );
}

/**
 * Rozwoj bestii ponad profil z ksiazki:
 *   - umiejetnosci rodziny: pasowanie x wspolczynnik poziomu (do 5), liczy sie
 *     wyzsza wartosc (ksiazka albo rodzina) - bestie z podrecznika nie maja
 *     w ksiazce umiejetnosci, wiec slaby niedzwiedz dostaje np. Bijatyke,
 *   - kazda umiejetnosc dostaje skillBonus poziomu,
 *   - cechy z charCodes dostaja charAdvances poziomu.
 * Kazdy skladnik rosnie z poziomem, wiec wyzszy poziom tej samej bestii jest zawsze silniejszy.
 */
/**
 * Poziom rozwoju bestii liczony od jej minimalnego poziomu: Wybraniec Chaosu
 * (od doswiadczonego) na poziomie doswiadczonym to profil z ksiazki, jak slaby wilk.
 */
export function beastTier(npc: Pick<Npc, "tier">, creature: CreatureDef): TierId {
  const shift = TIER_IDS.indexOf(creature.minTier ?? "slaby");
  return TIER_IDS[Math.max(0, TIER_IDS.indexOf(npc.tier) - shift)];
}

/**
 * Budzet PD bestii. Baza stworzenia (domyslny poziom) to profil z ksiazki i rozwiniecia jak u
 * Nowicjusza - PD z przedzialu najnizszego poziomu (tiers.json); na wyzszych poziomach dochodza
 * PD ponad koniec przedzialu domyslnego poziomu. Profil "od" nizszego poziomu (xpFrom: czempion
 * od szkieleta) - PD ponad poczatek tamtego poziomu i przemiane, jak dotad.
 */
export function beastXpBudget(npc: Npc, creature: CreatureDef, rng: Rng, deterministic = false): number {
  if (npc.xpSpec?.budget != null) return npc.xpSpec.budget;
  const roll = (range: [number, number]) => (deterministic ? Math.round((range[0] + range[1]) / 2) : randInt(range[0], range[1], rng));
  const raw = roll((gd.getTier(npc.tier)?.xp ?? [0, 0]) as [number, number]);
  const bonus = npc.xpSpec?.bonus ?? 0;
  if (creature.xpFrom) return Math.max(0, Math.max(0, raw - beastXpShift(creature)) + bonus);
  // Ponizej minimum (oslabiony osobnik) - sam profil z ksiazki.
  const minTier = creature.minTier ?? "slaby";
  if (TIER_IDS.indexOf(npc.tier) < TIER_IDS.indexOf(minTier)) return Math.max(0, bonus);
  const base = roll((gd.getTier(TIER_IDS[0])?.xp ?? [0, 0]) as [number, number]);
  const minEnd = gd.getTier(minTier)?.xp?.[1] ?? 0;
  return Math.max(0, base + Math.max(0, raw - minEnd) + bonus);
}

/**
 * PD zawarte w profilu z ksiazki: poczatek domyslnego poziomu (albo xpFrom) plus koszt przemiany
 * (turningXp) - czempion rozwija sie dalej jak szkielet, ale przemiana zjada czesc PD.
 */
export function beastXpShift(creature: CreatureDef): number {
  return (gd.getTier(creature.xpFrom ?? creature.minTier ?? "slaby")?.xp?.[0] ?? 0) + (creature.turningXp ?? 0);
}

/**
 * Indeksy (TIER_IDS) najnizszego i najwyzszego poziomu stworzenia: domyslny + tierSpan.
 * Stworzenie z profesja (career) nie ma gornej granicy - rozwija sie jak czlowiek.
 */
export function creatureTierRange(creature: CreatureDef, career = false): [number, number] {
  const span = creature.tierSpan ?? gd.getCreatureFamilies().settings.tierSpan ?? [-(TIER_IDS.length - 1), TIER_IDS.length - 1];
  const d = TIER_IDS.indexOf(creature.minTier ?? "slaby");
  return [Math.max(0, d + span[0]), career ? TIER_IDS.length - 1 : Math.min(TIER_IDS.length - 1, d + span[1])];
}

/**
 * Wartosc cechy z tierTraits wg poziomu BN wzgledem domyslnego ("Pancerz (5)"); pozycja z lista
 * wartosci losuje jedna z nich (powtorzenia = wieksza szansa), deterministycznie - pierwsza.
 */
export function tierTraitsFor(npc: Pick<Npc, "tier">, creature: CreatureDef, rng: Rng = Math.random, deterministic = false): string[] {
  const offset = Math.max(0, TIER_IDS.indexOf(npc.tier) - TIER_IDS.indexOf(creature.minTier ?? "slaby"));
  return Object.entries(creature.tierTraits ?? {}).map(([name, ranks]) => {
    const r = ranks[Math.min(offset, ranks.length - 1)];
    const v = Array.isArray(r) ? (deterministic ? r[0] : r[Math.floor(rng() * r.length)]) : r;
    return `${name} (${v})`;
  });
}

/**
 * Rozwoj bestii za PD wg kosztow z podrecznika (PG s. 47): cechy z charCodes i umiejetnosci
 * rodziny (+ Odporność, Opanowanie), waga = priorytet^2 / koszt - drozsze rozwiniecia
 * kupowane rzadziej, wiec wzrost z poziomem lagodnieje jak u ludzi. Bez talentow.
 */
export function beastXpDevelop(npc: Npc, creature: CreatureDef, budget: number, rng: Rng, deterministic = false): number {
  const fam = gd.getCreatureFamilies();
  const cfg = fam.settings.xpDevelopment!;
  const family = fam.families[creature.family];
  const prioOf = (fit: number) => cfg.fitPriority.find(([min]) => fit >= min)?.[1] ?? 1;
  const skills = new Map<string, number>();
  for (const s of npc.skills) skills.set(s.name, 1);
  for (const [name, fit] of Object.entries(family?.skills ?? {})) skills.set(name, prioOf(fit));
  for (const [name, p] of Object.entries(cfg.extraSkills)) {
    const attr = gd.skillAttr(name) as Attribute | undefined;
    if (!attr || creature.stats[attr] != null) skills.set(name, Math.max(skills.get(name) ?? 0, p));
  }
  const chars = (fam.settings.charCodes ?? []).filter((c) => creature.stats[c] != null);
  // Przelicznik PD bestii: wpisane PD to poziom jak u czlowieka, na rozwoj idzie ich czesc.
  const scaled = Math.round(budget * (cfg.xpScale ?? 1));
  // Limit rozwiniec KUPIONYCH za PD (ponad umiejetnosci rodziny i profil z ksiazki) wg wpisanych PD:
  // [od PD, umiejetnosc, cecha]; brak cechy = bez limitu cech.
  const capRow = [...(cfg.advanceCap ?? [])].reverse().find(([from]) => budget >= from);
  const base = new Map(npc.skills.map((s) => [s.name, s.advances]));
  const charBase = Object.fromEntries(chars.map((c) => [c, npc.charAdvances[c] ?? 0])) as Record<Attribute, number>;
  const skillCap = (name: string) => (base.get(name) ?? 0) + (capRow?.[1] ?? Infinity);
  const charCap = (code: Attribute) => charBase[code] + (capRow?.[2] ?? Infinity);
  let spent = 0;
  const skillAdv = (name: string) => npc.skills.find((s) => s.name === name)?.advances ?? 0;
  for (let guard = 0; guard < 5000; guard++) {
    const left = scaled - spent;
    const cands: { kind: "char" | "skill"; name: string; cost: number; weight: number }[] = [];
    for (const code of chars) {
      const cost = nextAdvanceCost("char", npc.charAdvances[code] ?? 0);
      if (cost <= left && (npc.charAdvances[code] ?? 0) < charCap(code)) cands.push({ kind: "char", name: code, cost, weight: (cfg.chars[code] ?? 1) ** 2 / cost });
    }
    for (const [name, p] of skills) {
      const cost = nextAdvanceCost("skill", skillAdv(name));
      if (cost <= left && skillAdv(name) < skillCap(name)) cands.push({ kind: "skill", name, cost, weight: p ** 2 / cost });
    }
    if (!cands.length) break;
    const c = deterministic ? cands.sort((a, b) => b.weight - a.weight)[0] : weightedPick(cands, (x) => x.weight, rng)!;
    // Do konca przedzialu kosztu (koszt w przedziale staly), jesli PD starcza.
    const owned = c.kind === "char" ? (npc.charAdvances[c.name as Attribute] ?? 0) : skillAdv(c.name);
    const cap = c.kind === "char" ? charCap(c.name as Attribute) : skillCap(c.name);
    const n = Math.max(1, Math.min(5 - (owned % 5), Math.floor(left / c.cost), cap - owned));
    spent += n * c.cost;
    if (c.kind === "char") npc.charAdvances[c.name as Attribute] = owned + n;
    else {
      const s = npc.skills.find((x) => x.name === c.name);
      if (s) s.advances += n;
      else npc.skills.push({ name: c.name, advances: n });
    }
  }
  return spent;
}

export function beastSkills(npc: Npc, creature: CreatureDef): void {
  const fam = gd.getCreatureFamilies();
  const family = fam.families[creature.family];
  // Rozwoj za PD: umiejetnosci rodziny jak u typowego osobnika, reszta z PD (beastXpDevelop).
  const tier = fam.settings.xpDevelopment ? "slaby" : beastTier(npc, creature);
  const factor = fam.settings.tierFactor[tier] ?? 0;
  if (factor > 0) {
    for (const [skill, fit] of Object.entries(family?.skills ?? {})) {
      const bonus = Math.max(5, Math.round((fit * factor) / 5) * 5);
      const owned = npc.skills.find((s) => s.name === skill);
      if (owned) owned.advances = Math.max(owned.advances, bonus);
      else npc.skills.push({ name: skill, advances: bonus });
    }
  }
  const bump = fam.settings.skillBonus?.[tier] ?? 0;
  for (const s of npc.skills) s.advances += bump;
  const adv = fam.settings.charAdvances?.[tier] ?? 0;
  for (const code of fam.settings.charCodes ?? []) {
    if (creature.stats[code] != null) npc.charAdvances[code] = (npc.charAdvances[code] ?? 0) + adv;
  }
}

/** Sila Cechy Stworzenia: suma dodatnich modyfikatorow (Elitarny 60, Zabijaka 30, Twardy 20). */
export function traitStrength(name: string): number {
  const mods = gd.getCreatureTrait(name)?.modifiers ?? {};
  return Object.values(mods).reduce((s: number, v) => s + Math.max(0, Number(v) || 0), 0);
}

/**
 * Mnoznik wagi cechy wg sily: (20 / sila)^2, najwyzej 1 - Twardy (20) bez zmian,
 * Zabijaka (30) x0,44, Elitarny (60) x0,11. Mocne cechy rzadsze, ale mozliwe na kazdym poziomie.
 */
export function traitStrengthFactor(name: string): number {
  return Math.min(1, (20 / Math.max(traitStrength(name), 1)) ** 2);
}

/**
 * Czy cecha pasuje do stworzenia: nie zmienia Int, SW ani Ogd istoty, ktora tej cechy
 * nie ma (szkielet bez SW), a Ogladu nie podnosi bestiom (zwierzeta, potwory).
 */
export function traitFitsCreature(creature: CreatureDef | undefined, name: string): boolean {
  if (!creature) return true;
  const mods = gd.getCreatureTrait(name)?.modifiers ?? {};
  for (const code of ["Int", "SW", "Ogd"] as const) if (mods[code] && creature.stats[code] == null) return false;
  return !((mods.Ogd ?? 0) > 0 && !gd.isCivilized(creature.name));
}

/** Wagi Cech Stworzen rodziny (losowanie cech bestii): tylko pasujace do stworzenia. */
export function familyTraitWeights(creature: CreatureDef | undefined): Record<string, number> | undefined {
  const base = creature ? gd.getCreatureFamilies().families[creature.family]?.traits : undefined;
  if (!base || !creature) return base;
  return Object.fromEntries(Object.entries(base).filter(([name]) => traitFitsCreature(creature, name)));
}

/** Liczba z ulamkiem: 1,5 = jedna i 50% szans na druga. */
function fractionalCount(x: number, rng: Rng, deterministic: boolean): number {
  const whole = Math.floor(x);
  return whole + (deterministic ? (x - whole >= 0.5 ? 1 : 0) : chance(x - whole, rng) ? 1 : 0);
}

/** Cechy Stworzen wynikajace z poziomu bestii oraz cechy "Opcjonalne" z ksiazki. */
export function beastTraits(npc: Npc, creature: CreatureDef, rng: Rng, deterministic = false): void {
  const fam = gd.getCreatureFamilies();
  const family = fam.families[creature.family];
  const tier: TierId = beastTier(npc, creature);
  for (const t of tierTraitsFor(npc, creature, rng, deterministic)) if (!npc.traits.includes(t)) npc.traits.push(t);
  const count = fractionalCount(fam.settings.traitCount[tier] ?? 0, rng, deterministic);
  const weights = Object.fromEntries(
    Object.entries(familyTraitWeights(creature) ?? family?.traits ?? {}).map(([n, w]) => [n, w * traitStrengthFactor(n)])
  );
  for (let i = 0; i < count; i++) {
    for (const t of npc.traits) delete weights[t];
    const t = deterministic ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] : weightedKey(weights, rng);
    if (t) npc.traits.push(t);
  }

  // Bestia ponizej swojego minimalnego poziomu (np. olbrzym na Nowicjuszu): mlody, chory albo slaby
  // osobnik - jedna cecha negatywna (Slaby, Chorowity...) za kazdy poziom ponizej minimum.
  const below = TIER_IDS.indexOf(creature.minTier ?? "slaby") - TIER_IDS.indexOf(npc.tier);
  const negative = Object.entries(gd.getCreatureTraits())
    .filter(([n, t]) => t.negative && !npc.traits.includes(n) && traitFitsCreature(creature, n))
    .map(([n]) => n);
  for (let i = 0; i < below && negative.length; i++) {
    const n = deterministic ? negative[0] : negative[randInt(0, negative.length - 1, rng)];
    npc.traits.push(n);
    negative.splice(negative.indexOf(n), 1);
  }

  rollBookOptional(npc, creature, tier, rng, deterministic);
}

/**
 * Cecha "Opcjonalna" z bloku stworzenia z szansa poziomu (optionalChance) - u bestii
 * i u przemienionych wampirow (profil Wampira z bestiariusza ma liste opcjonalnych).
 */
export function rollBookOptional(npc: Npc, creature: CreatureDef, tier: TierId, rng: Rng, deterministic = false, skip: (t: string) => boolean = () => false): void {
  const optional = usableOptional(creature).filter((o) => !npc.traits.includes(o) && !skip(o));
  if (optional.length && !deterministic && chance(gd.getCreatureFamilies().settings.optionalChance[tier] ?? 0, rng)) {
    npc.traits.push(optional[randInt(0, optional.length - 1, rng)]);
  }
}
