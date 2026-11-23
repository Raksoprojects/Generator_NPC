/**
 * Symulator starc: walka wrecz wg WFRP 4 (Testy Przeciwstawne, PS, Miejsce Trafienia, Redukcja),
 * Przewaga Grupowa (Pod Bronia, PB 133-135), Rozmiar [dom], Suche Kosci [dom], Strach/Groza,
 * Stany (Oszolomienie, Zatrucie, Pochwycenie, Powalenie, Panika) i Cechy Stworzen z liczbami:
 * darmowe ataki za Przewage (Ugryzienie, Atak Ogonem, Atak Jezykiem, Macki, Staje Deba, Rogi),
 * Zioniecie, Wymiot, Upiorne Wycie, Lodowaty Uscisk, Petryfikujace Spojrzenie, Czempion, Ochrona,
 * Kwasowa Krew, Wampiryczny, Jad, Dusiciel, Siec, Dekoncentrujacy, Furia, Szal Bojowy, Nienawisc,
 * Zwierzecy (tylko Unik, ucieczka), Eteryczny, Demoniczny, Magiczny, Regeneracja i pociski magiczne.
 * Inicjatywa k10 + BI + BZw [dom HR-019], Zwiazanie Walka (skupienie na celu), przewaga liczebna [dom],
 * Rany Krytyczne jako opcja (Fuks, Pech, Tabela Ran Krytycznych PG 174-178, pionki - Nagla Smierc).
 * Pomija: ruch i dystans, talenty bez liczb.
 */
import { randInt, type Rng } from "./dice";
import { sizeOf } from "./creatures";
import { critEntry, critLocation, type CritLoc } from "./criticals";
import { computeNpc, type NpcView } from "./npc";
import { characteristicBonus } from "./rules";
import type { Npc } from "./types";

const SIZES = ["Drobny", "Niewielki", "Mały", "Średni", "Duży", "Wielki", "Monstrualny"];
const AVERAGE = 3;
const LOCS = ["głowa", "ręce", "korpus", "nogi"] as const;
type Loc = (typeof LOCS)[number];

/** Darmowy atak: koszt w Przewadze (0 = co Ture), Obrazenia (z BS), Powalenie mniejszych (ogon). */
interface FreeAttack {
  name: string;
  cost: number;
  damage: number;
  knockdown?: boolean;
  /** Tylko w pierwszej Rundzie (Rogi - z szarzy). */
  firstRound?: boolean;
  /** Tylko na mniejszych (Staje Deba - Tupniecie). */
  vsSmaller?: boolean;
  ranged?: boolean;
}

export interface Fighter {
  name: string;
  race: string;
  wounds: number;
  init: number;
  /** Zwinnosc (Inicjatywa k10 + BI + BZw [dom HR-019]) i modyfikator Inicjatywy z broni (Szybka +3, Powolna -3). */
  agility: number;
  initMod?: number;
  /** Rozumny: skupia ataki z sojusznikami na jednym celu (gracze, ludzie, rozumne stworzenia). */
  smart?: boolean;
  /** Pionek: przy Ranie Krytycznej wypada z walki (opcjonalna Nagla Smierc, PG 173). */
  minion?: boolean;
  /** Szybkosc (Ruch 2 x Sz m, Bieg 4 x Sz m) i Latanie (metrow na Ruch). */
  speed?: number;
  fly?: number;
  /** Bron zasiegowa (najlepsza): wartosc testu, Obrazenia, zasieg w m; shooter - woli strzelac niz walczyc wrecz. */
  shot?: { skill: number; damage: number; magical: boolean; range: number };
  shooter?: boolean;
  /** Nie czuje bolu (Ozywieniec, Demoniczny, Konstrukt, Nie Czuje Bolu): Rany Krytyczne bez Stanow - liczy sie tylko Smierc i Amputacja. */
  painless?: boolean;
  /** Odporny na Oszolomienie i Zatrucie (Ozywieniec, Demoniczny). */
  noStun?: boolean;
  /** Druzyna ma srodki na roje (ogien, czary obszarowe): kazdy jej atak w roj jest skuteczny. */
  antiSwarm?: boolean;
  /** Atak wrecz: wartosc testu i Obrazenia (z BS). */
  attack: { skill: number; damage: number; blunt: boolean; magical: boolean; slow: boolean; unbalanced: boolean };
  ranged: number;
  /** Parowanie (najlepsza Bron Biala) i Unik. */
  parry: number;
  dodge: number;
  cool: number;
  /** Odpornosc (Testy na Zatrucie, Oszolomienie) i Sila (Pochwycenie). */
  endurance: number;
  strength: number;
  willpower: number;
  /** Redukcja (BWt + PP) na lokacjach. */
  armour: Record<Loc, number>;
  tb: number;
  size: number;
  sb: number;
  fear: number;
  terror: number;
  ethereal: boolean;
  /** Demoniczny rzut ochronny (Prog), 0 = brak. */
  demonic: number;
  /** Ochrona (Prog): rzut ochronny przeciw kazdemu ciosowi. */
  ward: number;
  regenerate: boolean;
  dryBones: number;
  /** Srogi (X): pula Przewagi strony na poczatku Tury rosnie do X. */
  fierce: number;
  fortune: number;
  freeAttacks: FreeAttack[];
  breath?: { damage: number; ignoreAp: boolean; stun: boolean; poison: boolean; cost: number; bonus: number };
  howl?: boolean;
  icyGrip?: boolean;
  petrify?: boolean;
  /** Czempion (X) [dom]: kontry na Runde. */
  champion?: number;
  acidBlood?: boolean;
  vampiric?: boolean;
  venom?: boolean;
  entangle?: boolean;
  distracting?: boolean;
  fury?: boolean;
  frenzy?: boolean;
  /** Nienawisc: obiekt (Krasnoludy, Ludzie, Intruzi...). */
  hatred?: string;
  animal?: boolean;
  territorial?: boolean;
  /** Niewrazliwosc na Psychologie (Strach, Groza, Panika). */
  fearless?: boolean;
  /** Pocisk magiczny: test Rzucania, PZ, Obrazenia. */
  spell?: { cast: number; channel: number; cn: number; damage: number };
  /** Szansa (0-1), ze atak w danej Turze jest ognisty (pochodnia, olej, czar). */
  fire?: number;
  /** Osaczony albo broni mlodych: Zwierzecy nie ucieka, tylko wpada w Szal Bojowy. */
  cornered?: boolean;
  /** Roj: Rany na koniec Rundy kazdemu wrogowi (1 Przecietny, 2 Duzy, 3 Wielki, 4 Monstrualny); atakuje wszystkich. */
  swarm?: number;
  /** Roj Drobnych / Niewielkich stworzonek: zwykle ataki go nie rania, tylko ogien. */
  swarmTiny?: boolean;
}

/** Postac gracza z druzyna.json. */
export interface PartyMember {
  name: string;
  race?: string;
  I: number;
  Zw?: number;
  S: number;
  Wt: number;
  SW?: number;
  US?: number;
  Sz?: number;
  melee: number;
  weapon: { name: string; damage: number; qualities: string[] };
  dodge: number;
  cool: number;
  armour: number | Partial<Record<Loc, number>>;
  wounds: number;
  fortune: number;
  magical: boolean;
}

const BLUNT = /młot|buzdygan|maczug|pałk|kostur|kij|cep|morgenszter|obuch|kamień|głaz|kopyt|pięś/i;

export function partyFighter(p: PartyMember): Fighter {
  const armour = Object.fromEntries(LOCS.map((l) => [l, typeof p.armour === "number" ? p.armour : (p.armour[l] ?? characteristicBonus(p.Wt))])) as Record<Loc, number>;
  return {
    name: p.name,
    race: p.race ?? "Krasnolud",
    wounds: p.wounds,
    init: p.I,
    agility: p.Zw ?? 30,
    initMod: p.weapon.qualities.includes("Powolny") ? -3 : 0,
    smart: true,
    speed: p.Sz ?? (p.race && !/krasnolud/i.test(p.race) ? 4 : 3),
    attack: {
      skill: p.melee,
      damage: p.weapon.damage,
      blunt: BLUNT.test(p.weapon.name),
      magical: p.magical,
      slow: p.weapon.qualities.includes("Powolny"),
      unbalanced: p.weapon.qualities.includes("Niewyważony")
    },
    ranged: p.US ?? 30,
    parry: p.melee,
    dodge: p.dodge,
    cool: p.cool,
    endurance: p.Wt,
    strength: p.S,
    willpower: p.SW ?? p.cool,
    armour,
    tb: characteristicBonus(p.Wt),
    size: AVERAGE,
    sb: characteristicBonus(p.S),
    fear: 0,
    terror: 0,
    ethereal: false,
    demonic: 0,
    ward: 0,
    regenerate: false,
    dryBones: 0,
    fierce: 0,
    fortune: p.fortune,
    freeAttacks: []
  };
}

const rank = (traits: string[], re: RegExp) => {
  for (const t of traits) {
    const m = re.exec(t);
    if (m) return Number(m[1] ?? 1) || 1;
  }
  return 0;
};
const has = (traits: string[], re: RegExp) => traits.some((t) => re.test(t));

/** Pocisk magiczny BN: najtanszy czar z Obrazeniami (Obrażeniach +X). */
function missile(view: NpcView): Fighter["spell"] {
  if (!view.casting) return undefined;
  const spells = view.spells
    .map((s) => ({ s, dmg: Number(/Obrażeni\w*\s*\+(\d+)/.exec(s.description)?.[1] ?? NaN) }))
    .filter((x) => Number.isFinite(x.dmg) && x.dmg > 0)
    .sort((a, b) => b.dmg - b.s.cn - (a.dmg - a.s.cn));
  const best = spells[0];
  if (!best) return undefined;
  return { cast: view.casting.cast.value, channel: view.casting.channel.value, cn: Math.max(0, best.s.cn + view.casting.cnMod), damage: best.dmg };
}

/** Darmowe ataki z Cech Stworzen: Ugryzienie, Atak Ogonem i Jezykiem (1 Przewaga), Macki, Staje Deba, Rogi. */
function freeAttacks(traits: string[], mainDamage: number): FreeAttack[] {
  const out: FreeAttack[] = [];
  const dmg = (t: string) => Number(/\+(\d+)/.exec(t)?.[1] ?? mainDamage);
  for (const t of traits) {
    if (/^Ugryzienie/.test(t)) out.push({ name: "Ugryzienie", cost: 1, damage: dmg(t) });
    else if (/^Atak Ogonem/.test(t)) out.push({ name: "Atak Ogonem", cost: 1, damage: dmg(t), knockdown: true });
    else if (/^Atak Językiem/.test(t)) out.push({ name: "Atak Językiem", cost: 1, damage: dmg(t), ranged: true });
    else if (/Macki/.test(t)) {
      const n = Number(/^(\d+)×/.exec(t)?.[1] ?? 1);
      for (let i = 0; i < n; i++) out.push({ name: "Macka", cost: 0, damage: dmg(t) });
    } else if (/^Staje Dęba/.test(t)) out.push({ name: "Tupnięcie", cost: 0, damage: mainDamage, vsSmaller: true });
    else if (/^Rogi/.test(t)) out.push({ name: "Rogi", cost: 0, damage: dmg(t), firstRound: true });
  }
  return out;
}

/** Zioniecie +X (typ) albo Wymiot (BWt + 4): koszt 2 / 3 Przewagi. */
function breathOf(traits: string[], tb: number): Fighter["breath"] {
  const b = traits.find((t) => /^Zionięcie/.test(t));
  if (b) {
    const type = /\(([^)]+)\)/.exec(b)?.[1] ?? "";
    return {
      damage: Number(/\+(\d+)/.exec(b)?.[1] ?? 8),
      ignoreAp: /Ogień|Elektryczn|Trucizn|Zaraza/i.test(type),
      stun: /Elektryczn|Zimno|Usypiaj|Koszmar/i.test(type),
      poison: /Trucizn|Zaraza/i.test(type),
      cost: 2,
      bonus: 0
    };
  }
  const v = traits.find((t) => /^Wymiot/.test(t));
  if (v) return { damage: Number(/\+(\d+)/.exec(v)?.[1] ?? tb + 4), ignoreAp: false, stun: true, poison: false, cost: 3, bonus: 40 };
  return undefined;
}

/** Zasieg broni z tabeli ("50", "BS×3", "S×2"); bez liczby - 30 m. */
function rangeOf(text: string | undefined, sb: number): number {
  const mult = /(?:BS|S)\s*[×x*]\s*(\d+)/.exec(text ?? "");
  if (mult) return sb * Number(mult[1]);
  const n = Number(/\d+/.exec(text ?? "")?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/** Najlepsza bron zasiegowa BN (wartosc testu + 3 x Obrazenia). */
function bestShot(view: NpcView, s: number): Fighter["shot"] {
  const w = view.weapons.filter((x) => x.ranged && x.damage != null).sort((a, b) => b.skill + 3 * (b.damage ?? 0) - (a.skill + 3 * (a.damage ?? 0)))[0];
  if (!w) return undefined;
  return { skill: w.skill, damage: w.damage!, magical: !!w.magicItem, range: rangeOf(w.range, characteristicBonus(s)) };
}

/** Stworzenie albo BN z generatora jako walczacy. */
export function npcFighter(npc: Npc, view: NpcView = computeNpc(npc)): Fighter {
  const traits = [...view.creatureTraits, ...view.rolledTraits, ...view.heroTraits];
  const melee = view.weapons.filter((w) => !w.ranged && w.damage != null).sort((a, b) => b.skill + 3 * (b.damage ?? 0) - (a.skill + 3 * (a.damage ?? 0)))[0];
  const skill = (name: string) => view.skills.find((s) => s.name === name)?.total;
  const parry = Math.max(0, ...view.skills.filter((s) => s.name.startsWith("Broń Biała")).map((s) => s.total));
  // Rozmiar spoza ksiazki (linia wampira) ma pierwszenstwo przed profilem z ksiazki.
  const size = Math.max(0, SIZES.indexOf(sizeOf([...view.rolledTraits.filter((t) => /^Rozmiar/.test(t)), ...traits])));
  const demonicAll = has(traits, /^Demoniczny/);
  const char = (c: keyof NpcView["chars"], fallback: number) => (view.chars[c].absent ? fallback : view.chars[c].total);
  const damage = melee?.damage ?? characteristicBonus(char("S", 10));
  const tb = characteristicBonus(char("Wt", 10));
  const ranged = Math.max(char("US", 0), ...view.skills.filter((s) => s.name.startsWith("Broń Zasięgowa")).map((s) => s.total));
  return {
    name: npc.name,
    race: npc.race,
    wounds: view.wounds,
    init: char("I", 0),
    agility: char("Zw", 10),
    initMod: (melee?.qualities.includes("Szybka") ? 3 : 0) - (melee?.qualities.includes("Powolny") ? 3 : 0),
    // Rozumny: nie Zwierzecy i z Inteligencja co najmniej 20 (zombie, bestie - bez taktyki).
    smart: !has(traits, /^Zwierzęcy/) && !view.chars.Int.absent && view.chars.Int.total >= 20,
    speed: view.movement || 4,
    fly: rank(traits, /^Latanie \((\d+)\)/),
    shot: bestShot(view, char("S", 10)),
    painless: has(traits, /^(Ożywieniec|Demoniczny|Konstrukt|Nie Czuje Bólu)/),
    noStun: has(traits, /^(Ożywieniec|Demoniczny)/),
    attack: {
      skill: melee?.skill ?? char("WW", 20),
      damage,
      blunt: BLUNT.test(melee?.name ?? ""),
      magical: demonicAll || !!melee?.magicItem || has(traits, /^(Eteryczny|Magiczny)/),
      slow: !!melee?.qualities.includes("Powolny"),
      unbalanced: !!melee?.flaws.includes("Niewyważony")
    },
    ranged,
    parry: parry || (melee?.skill ?? char("WW", 20)),
    dodge: skill("Unik") ?? char("Zw", 0),
    cool: skill("Opanowanie") ?? char("SW", 100),
    endurance: skill("Odporność") ?? char("Wt", 30),
    strength: char("S", 30),
    willpower: char("SW", 30),
    armour: Object.fromEntries(LOCS.map((l) => [l, view.armour[l].total])) as Record<Loc, number>,
    tb,
    size,
    sb: characteristicBonus(char("S", 10)),
    fear: rank(traits, /^Strach \(?(\d+)/),
    terror: rank(traits, /^Groza \(?(\d+)/),
    ethereal: has(traits, /^Eteryczny/),
    demonic: rank(traits, /^Demoniczny \(?(\d+)/),
    // Ochrona (7+); Odbijanie (Wampiry, bez definicji) - jak Ochrona 8+.
    ward: rank(traits, /^Ochrona \(?(\d+)/) || (has(traits, /^Odbijanie/) ? 8 : 0),
    regenerate: has(traits, /^Regeneracja/),
    dryBones: Math.min(4, rank(traits, /^Suche Kości \((\d+)\)/)),
    fierce: rank(traits, /^Srogi \((\d+)\)/),
    fortune: 0,
    freeAttacks: freeAttacks(traits, damage),
    breath: breathOf(traits, tb),
    howl: has(traits, /^Upiorne Wycie/),
    icyGrip: has(traits, /^Lodowaty Uścisk/),
    petrify: has(traits, /^Petryfikujące/),
    champion: rank(traits, /^(?:Czempion|Mistrz)(?: \((\d+)\))?$/),
    acidBlood: has(traits, /^Kwasowa Krew/),
    vampiric: has(traits, /^Wampiryczny/),
    venom: has(traits, /^Jad/) || /\(Jad\)/.test(traits.join(" ")),
    entangle: has(traits, /^(Dusiciel|Sieć)/),
    distracting: has(traits, /^Dekoncentrujący/),
    fury: has(traits, /^Furia/),
    frenzy: has(traits, /^Szał Bojowy/),
    hatred: /^Nienawiść \(([^)]+)\)/.exec(traits.find((t) => /^Nienawiść/.test(t)) ?? "")?.[1],
    animal: has(traits, /^Zwierzęcy/),
    territorial: has(traits, /^Terytorialny/),
    // Roj z ksiazki (profil juz roju): Rany na koniec Rundy wg Rozmiaru, odporny na Psychologie.
    // "Rój (Rój Brzytw)" to zdolnosc stada opisana osobno - pojedynczy osobnik nie jest rojem.
    // Tylko z profilu ksiazki - wylosowana opcjonalna cecha Roj nie zmienia profilu, wiec nie robi z BN roju.
    swarm: has(view.creatureTraits, /^Rój( \(wliczony\))?$/) ? Math.max(1, size - AVERAGE + 1) : 0,
    fearless: has(traits, /^Niewrażliwość na Psychologię/) || has(view.creatureTraits, /^Rój( \(wliczony\))?$/),
    spell: missile(view)
  };
}

interface State {
  f: Fighter;
  hp: number;
  /** Stany. */
  broken: number;
  stunned: number;
  poisoned: number;
  entangled: number;
  prone: boolean;
  /** Strach: zebrane PS testu rozszerzonego (do pokonania strachu). */
  fearSl: number;
  fearDone: boolean;
  frenzied: boolean;
  hating: boolean;
  fled: boolean;
  /** PS Splatania zebrane na zaklecie. */
  channelled: number;
  fortune: number;
  /** Kontry Czempiona wykorzystane w tej Rundzie. */
  counters: number;
  /** Rany od ognia - Regeneracja ich nie leczy. */
  burnt: number;
  /** Wylaczony z walki: bez Krytykow 0 Zyw; z Krytykami Utrata Przytomnosci albo Smierc. */
  out: boolean;
  /** Krytyki: liczba Ran Krytycznych, Krwawienie, Oslepienie, Rundy na 0 Zyw, kara z okaleczen, stracone Akcje, odsloniecie po Pechu. */
  crits: number;
  bleed: number;
  blind: number;
  zeroRounds: number;
  maim: number;
  skip: number;
  exposed: number;
  /** Przeciwnik, z ktorym walczacy jest Zwiazany Walka. */
  target: State | null;
  /** Inicjatywa wylosowana na poczatku walki [dom HR-019]. */
  initRoll: number;
  /** Wlasna strona (sojusznicy razem z nim). */
  team: State[];
  /** Pozycja na linii walki (m) i premia z Szarzy do pierwszego Testu Broni Bialej. */
  pos: number;
  charge: number;
  dealt: number;
  taken: number;
  /** Pula Przewagi strony (wspolna dla wszystkich jej walczacych) i kara Dekoncentrujacy dla strony. */
  side: { pool: number; distracted: boolean };
}

/** Opcje walki: crits - Rany Krytyczne (Fuks, Pech, Tabela Ran Krytycznych; 0 Zyw = Powalenie, nie wylaczenie). */
export interface FightOptions {
  crits?: boolean;
  /** Dystans poczatkowy miedzy stronami [od, do] m (losowany); bez - wszyscy od razu w zwarciu. */
  distance?: [number, number];
}

/** Biezaca walka liczy Rany Krytyczne / dystans (ustawiane w fight). */
let CRITS = false;
let DIST = false;

/** W zasiegu walki wrecz (do 2 m). */
const near = (a: State, b: State) => Math.abs(a.pos - b.pos) <= 2;

/** Walczy dalej: nie wylaczony i nie uciekl; bez Krytykow 0 Zyw wylacza z walki. */
const up = (x: State) => !x.out && !x.fled && (CRITS || x.hp > 0);

function test(value: number, rng: Rng): { ok: boolean; sl: number; roll: number } {
  const roll = randInt(1, 100, rng);
  const ok = roll <= 5 || (roll <= value && roll <= 95);
  return { ok, sl: Math.floor(value / 10) - Math.floor(roll / 10), roll };
}

/** Dublet na kosciach (11, 22 ... 99, 00): Fuks przy sukcesie, Pech przy porazce [PG 160]. */
const double = (roll: number) => roll % 11 === 0 || roll === 100;

function location(roll: number): Loc {
  // Lokacja z odwroconego rzutu ataku.
  const r = (roll % 10) * 10 + Math.floor(roll / 10) || 100;
  return r <= 9 ? "głowa" : r <= 44 ? "ręce" : r <= 79 ? "korpus" : "nogi";
}

/**
 * Kary do Testow. Kary ze Stanow sie nie sumuja - liczy sie najwyzsza (Zatrucie, Oszolomienie,
 * Pochwycenie, Oslepienie, odsloniecie po Pechu: -10). Osobno: Strach (-10), Dekoncentrujacy (-20)
 * i okaleczenia z Ran Krytycznych.
 */
function penalty(s: State, enemy: State): number {
  let p = 0;
  if ((enemy.f.fear || enemy.f.terror) && !s.fearDone) p += 10;
  if (s.poisoned || s.stunned || s.entangled || s.blind || s.exposed) p += 10;
  if (s.side.distracted) p += 20;
  return p + s.maim;
}

/** Rzuty ochronne: Eteryczny (tylko Magiczne), Demoniczny (nie-Magiczne), Ochrona (kazdy cios). */
function warded(d: State, magical: boolean, rng: Rng): boolean {
  if (d.f.ethereal && !magical) return true;
  if (d.f.demonic && !magical && randInt(1, 10, rng) >= d.f.demonic) return true;
  return !!d.f.ward && randInt(1, 10, rng) >= d.f.ward;
}

/** Nienawisc (PG s. 191): +1 PS do wszystkich Testow walki, tylko wobec swojego obiektu: rasa celu, Zywi, Wszystko. Bez obiektu i Intruzi - brak premii. */
function hates(a: State, d: State): boolean {
  if (!a.f.hatred && !a.hating) return false;
  if (a.hating) return true;
  const o = a.f.hatred!.toLowerCase();
  const r = d.f.race.toLowerCase();
  return /^(żyw|wszys)/.test(o) || (o.startsWith("krasnolud") && r.startsWith("krasnolud")) || (o.startsWith("ludzi") && r.startsWith("człowiek")) || (o.startsWith("elf") && r.includes("elf"));
}

/**
 * Przewaga liczebna [dom, Kompendium MG; RAW PG 162: +20 / +40]: 2:1 +10, kazdy kolejny stopien +10;
 * wiekszy obronca liczy sie jak kilku (Duzy: 3:1 +10, 5:1 +20; Wielki: 4:1 +10, 7:1 +20).
 * Liczy sie, kto z kim jest Zwiazany Walka: atakujacy na tym samym celu przeciw obroncy i jego
 * sojusznikom, ktorzy walcza z ktoryms z atakujacych. Roje ignoruja liczebnosc.
 */
function outnumber(a: State, d: State): number {
  if (a.f.swarm || d.f.swarm) return 0;
  const att = a.team.filter((x) => up(x) && (x === a || (x.target === d && near(x, d))));
  const def = d.team.filter((x) => up(x) && (x === d || (x.target != null && att.includes(x.target) && near(x, x.target))));
  return outnumberBonus(Math.floor(att.length / Math.max(1, def.length)), d.f.size);
}

/** Premia z przewagi liczebnej przy stosunku ratio:1 wobec obroncy danego Rozmiaru (indeks SIZES). */
export function outnumberBonus(ratio: number, size: number): number {
  // Wiekszy obronca trudniej osaczyc [dom]: Duzy - +10 od 3:1 i co 2 kolejne, Wielki - od 4:1 i co 3 kolejne...
  const step = 1 + Math.max(0, size - AVERAGE);
  return 10 * Math.floor(Math.max(0, ratio - 1) / step);
}

/**
 * Cel ataku: walczacy trzyma sie przeciwnika, z ktorym jest Zwiazany Walka, az ten padnie.
 * Gracze i rozumne stworzenia potem przechodza na wroga, ktorego juz atakuja sojusznicy (skupienie),
 * a gdy takiego brak - na najbardziej ranionego; bestie bez rozumu biora losowego.
 */
function chooseTarget(s: State, foes: State[], rng: Rng): State | undefined {
  const live = foes.filter(up);
  if (!live.length) return undefined;
  if (s.target && live.includes(s.target)) return s.target;
  let t: State;
  if (s.f.smart) {
    const engaged = (x: State) => s.team.filter((y) => y !== s && up(y) && y.target === x).length;
    const best = Math.max(...live.map(engaged));
    const pool = best > 0 ? live.filter((x) => engaged(x) === best) : live;
    t = pool.reduce((m, x) => (x.hp / x.f.wounds < m.hp / m.f.wounds ? x : m));
  } else t = live[randInt(0, live.length - 1, rng)];
  s.target = t;
  return t;
}

interface Hit {
  damage: number;
  ignoreAp?: boolean;
  ignoreTb?: boolean;
  magical: boolean;
  blunt?: boolean;
  sl: number;
  roll: number;
  /** Strzal: bez premii z BS za Rozmiar i Szal Bojowy. */
  ranged?: boolean;
}

/** Miejsce Trafienia ostatniego ciosu (do Rany Krytycznej za przekroczenie Zywotnosci). */
let lastLoc: Loc = "korpus";

/** Rany z trafienia po Redukcji i zasadach domowych; 0 = brak Ran. */
function wounds(a: State, d: State, h: Hit, rng: Rng): number {
  if (warded(d, h.magical, rng)) return 0;
  const loc = location(h.roll);
  lastLoc = loc;
  // Rozmiar [dom]: +BS za kazdy stopien ponad Sredni. Suche Kosci [dom]: -2/poziom nieobuchowa, +2 obuchowa.
  // Szal Bojowy: +1 do BS - w Obrazeniach broni i w premii Rozmiaru.
  const frenzy = a.frenzied && !h.ranged ? 1 : 0;
  const sizeDmg = h.ranged ? 0 : (a.f.sb + frenzy) * Math.max(0, a.f.size - AVERAGE);
  const bones = d.f.dryBones && !h.magical ? (h.blunt ? 2 : -2 * d.f.dryBones) : 0;
  const red = h.ignoreTb ? 0 : h.ignoreAp ? d.f.tb : d.f.armour[loc];
  const raw = h.damage + sizeDmg + bones + frenzy + h.sl - red;
  const minOne = d.f.demonic && !h.magical ? 0 : 1;
  return Math.max(minOne, raw);
}

/** Rany bez trafienia (Zatrucie, Krwawienie, Kwasowa Krew, Pech); z Krytykami Zywotnosc nie spada ponizej 0. */
function hurt(s: State, n: number): void {
  s.hp = CRITS ? Math.max(0, s.hp - n) : s.hp - n;
}

/**
 * Rana Krytyczna [PG 174-178]: dodatkowe Rany bez BWt i PP (nie wywoluja kolejnej), Stany,
 * Utrata Przytomnosci, Smierc. Pionek (opcjonalna Nagla Smierc, PG 173) od razu wypada z walki.
 * [dom] Wiekszym trudniej odciac konczyne: -10 do rzutu za kazdy stopien Rozmiaru ponad Sredni.
 * Istota bez bolu (Ozywieniec, Demoniczny, Konstrukt, Nie Czuje Bolu) - tylko Rany, Amputacja i Smierc.
 */
function critical(d: State, loc: CritLoc, mod: number, rng: Rng): void {
  if (d.out) return;
  if (d.f.minion) {
    d.out = true;
    return;
  }
  const e = critEntry(loc, randInt(1, 100, rng) + mod - 10 * Math.max(0, d.f.size - AVERAGE));
  d.crits++;
  if (e.death) {
    d.out = true;
    return;
  }
  d.hp = Math.max(0, d.hp - e.wounds);
  if (d.f.painless) {
    if (e.amp && e.maim) d.maim = Math.min(30, Math.max(d.maim, e.maim));
    if (e.amp && e.drop) d.skip++;
    return;
  }
  d.bleed += e.bleed ?? 0;
  d.stunned += (e.stun ?? 0) + (e.stunD10 ? randInt(1, 10, rng) : 0);
  d.blind += e.blind ?? 0;
  if (e.prone) d.prone = true;
  if (e.drop) d.skip++;
  if (e.maim) d.maim = Math.min(30, Math.max(d.maim, e.maim));
  if (e.stunTest != null && !test(d.f.endurance + e.stunTest, rng).ok) d.stunned += e.stunFail ?? 1;
  if (e.proneTest != null && !test(d.f.endurance + e.proneTest, rng).ok) d.prone = true;
  if (e.ko || (e.koTest != null && !test(d.f.endurance + e.koTest, rng).ok)) d.out = true;
  // Oszolomienie konczy Szal Bojowy (PG s. 191).
  if (d.stunned) d.frenzied = false;
}

/** Pech (dublet przy porazce) - Tabela „Ożeż!” [PG 160], skutki liczace sie w walce. */
function oops(s: State, rng: Rng): void {
  const r = randInt(1, 100, rng);
  if (r <= 20) hurt(s, 1);
  else if (r > 40 && r <= 60) s.exposed = 1;
  else if (r > 70 && r <= 80) s.skip++;
  else if (r > 80 && r <= 90) s.crits++;
  else if (r > 90) s.stunned++;
}

/** Zadaje Rany (Kwasowa Krew, Jad, Wampiryczny, Pochwycenie, Krytyk za przekroczenie Zywotnosci). */
function apply(a: State, d: State, dmg: number, rng: Rng, opts: { venom?: boolean; bite?: boolean; entangle?: boolean; knockdown?: boolean; fire?: boolean } = {}): void {
  if (dmg <= 0) return;
  const before = Math.max(0, d.hp);
  const real = Math.min(dmg, before);
  d.hp -= dmg;
  a.dealt += real;
  d.taken += real;
  if (CRITS) {
    // Rany ponad Zywotnosc: Rana Krytyczna i Powalenie [PG 159]; -20 do rzutu, gdy nadwyzka mniejsza niz BWt [PG 172].
    const over = dmg - before;
    d.hp = Math.max(0, d.hp);
    if (over > 0) {
      d.prone = true;
      critical(d, lastLoc, over < d.f.tb ? -20 : 0, rng);
    }
  }
  // Ogien: Rany nie do zregenerowania; Zwierzecy w zetknieciu z ogniem dostaje Panike.
  if (opts.fire) {
    d.burnt += real;
    if (d.f.animal && !d.f.fearless && !d.frenzied) d.broken = Math.max(d.broken, 1);
  }
  if (opts.venom && !d.f.noStun) d.poisoned++;
  if (opts.entangle) d.entangled++;
  if (opts.knockdown && d.f.size < a.f.size) d.prone = true;
  if (opts.bite && a.f.vampiric) a.hp = Math.min(a.f.wounds, a.hp + real);
  // Kwasowa Krew: ranione stworzenie pryska na atakujacego (1k10 po Redukcji, min. 1).
  if (d.f.acidBlood && up(a)) {
    const acid = Math.max(1, randInt(1, 10, rng) - a.f.armour.korpus);
    hurt(a, acid);
    d.dealt += acid;
  }
}

/**
 * Atak wrecz (Test Przeciwstawny). bonus - premia z wydanej Przewagi; gain - Wygrana daje +1 do puli.
 * Obronca: parowanie (kara Rozmiaru [dom]) albo Unik (bez kary); Zwierzecy tylko Unik.
 * Premie: Powalenie +20, Oslepienie celu +10, przewaga liczebna. Czempion broniacy sie z wygrana
 * zadaje Obrazenia jak atakujacy. Z Krytykami: Fuks (dublet przy sukcesie, takze w obronie) i Pech.
 */
function melee(a: State, d: State, rng: Rng, bonus: number, gain: boolean, fa?: FreeAttack, fire = false): void {
  // Z dystansem: cios tylko w zasiegu (2 m); Atak Jezykiem siega dalej.
  if (DIST && !near(a, d) && !fa?.ranged) return;
  const att = a.f.attack;
  const prone = d.prone ? 20 : 0;
  const blind = d.blind ? 10 : 0;
  const hate = hates(a, d) ? 1 : 0;
  // Szarza: +10 do pierwszego Testu Broni Bialej po Ruchu [PG 165].
  const charge = fa ? 0 : a.charge;
  a.charge = 0;
  const atkTest = test(att.skill + bonus + prone + blind + charge + outnumber(a, d) - penalty(a, d), rng);
  const sizeGap = Math.max(0, a.f.size - d.f.size);
  const parryVal = d.f.parry - penalty(d, a);
  const dodgeVal = d.f.dodge - penalty(d, a);
  const parrySl = (v: { sl: number }) => v.sl - 2 * sizeGap + (att.slow ? 1 : 0) - (d.f.attack.unbalanced ? 1 : 0);
  const useParry = !d.f.animal && parryVal - 20 * sizeGap > dodgeVal;
  let def = test(useParry ? parryVal : dodgeVal, rng);
  const defHate = hates(d, a) ? 1 : 0;
  let defSl = (useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0)) + defHate;
  const atkSl = atkTest.sl + hate;
  const wins = () => atkTest.ok && (atkSl > defSl || (atkSl === defSl && att.skill >= (useParry ? d.f.parry : d.f.dodge)));
  if (wins() && d.fortune > 0 && !def.ok) {
    d.fortune--;
    def = test(useParry ? parryVal : dodgeVal, rng);
    defSl = (useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0)) + defHate;
  }
  if (CRITS) {
    if (!atkTest.ok && double(atkTest.roll)) oops(a, rng);
    if (!def.ok && double(def.roll)) oops(d, rng);
  }
  if (!wins()) {
    // Czempion (X) [dom]: wygrana obrona zadaje Obrazenia jak atak, najwyzej X razy na Runde.
    if (d.f.champion && d.counters < d.f.champion && def.ok && defSl > atkSl && !fa) {
      d.counters++;
      const dmg = wounds(d, a, { damage: d.f.attack.damage, magical: d.f.attack.magical, blunt: d.f.attack.blunt, sl: defSl - atkSl, roll: def.roll }, rng);
      apply(d, a, dmg, rng, { venom: d.f.venom });
    }
    // Fuks obroncy: udana obrona z dubletem - atakujacy dostaje Rane Krytyczna [PG 160].
    if (CRITS && def.ok && double(def.roll) && !fa && up(a) && !warded(a, d.f.attack.magical, rng)) critical(a, critLocation(randInt(1, 100, rng)), -20, rng);
    return;
  }
  // Wygrana: wygrany Test Przeciwstawny, ktory sam zainicjowales - +1 do puli strony [PB 133].
  if (gain) a.side.pool++;
  const hit: Hit = { damage: fa?.damage ?? att.damage, magical: att.magical, blunt: fa ? false : att.blunt, sl: atkSl - defSl, roll: atkTest.roll };
  // Roj Drobnych stworzonek: zwykly cios zabija garsc owadow, Rany zadaje tylko ogien.
  if (d.f.swarmTiny && !fire) return;
  const w = wounds(a, d, hit, rng);
  apply(a, d, w, rng, { venom: a.f.venom, bite: fa?.name === "Ugryzienie", entangle: a.f.entangle && !fa, knockdown: fa?.knockdown, fire });
  // Fuks: trafienie z dubletem - dodatkowo Rana Krytyczna (osobny rzut na Miejsce Trafienia) [PG 160];
  // [dom] Krytyk bez przekroczenia Zywotnosci rzucany z -20.
  if (CRITS && w > 0 && double(atkTest.roll) && up(d)) critical(d, critLocation(randInt(1, 100, rng)), -20, rng);
}

/**
 * Strzal (Test Prosty Umiejetnosci Strzeleckich / Broni Zasiegowej) [PG 159-162]: Rozmiar celu (Drobny -30 ... Monstrualny +60),
 * trafienie daje +1 Przewagi. Cel Zwiazany Walka z sojusznikiem: -20 [dom HR-020]; pudlo, ktore bez kary byloby
 * trafieniem, trafia losowego sojusznika z tego zwarcia (0 PS).
 */
function shoot(a: State, d: State, rng: Rng, bonus = 0): void {
  const sh = a.f.shot!;
  const allies = a.team.filter((x) => x !== a && up(x) && near(x, d));
  const base = sh.skill + bonus + ([-30, -20, -10, 0, 20, 40, 60][d.f.size] ?? 0) - penalty(a, d);
  const t = test(base - (allies.length ? 20 : 0), rng);
  if (CRITS && !t.ok && double(t.roll)) oops(a, rng);
  let victim = d;
  if (!t.ok) {
    if (!allies.length || t.roll > base || t.roll > 95) return;
    victim = allies[randInt(0, allies.length - 1, rng)];
  } else a.side.pool++;
  if (victim.f.swarmTiny && !a.f.antiSwarm) return;
  const w = wounds(a, victim, { damage: sh.damage, magical: sh.magical, sl: t.ok ? Math.max(0, t.sl) : 0, roll: t.roll, ranged: true }, rng);
  apply(a, victim, w, rng);
  if (CRITS && t.ok && w > 0 && double(t.roll) && up(victim)) critical(victim, critLocation(randInt(1, 100, rng)), -20, rng);
}

/** Ruch w strone celu: najwyzej m metrow, do 1,5 m od niego. */
function moveTo(s: State, t: State, m: number): void {
  const d = t.pos - s.pos;
  s.pos += Math.sign(d) * Math.max(0, Math.min(m, Math.abs(d) - 1.5));
}

/** Odejscie od najblizszego wroga o m metrow. */
function moveAway(s: State, foes: State[], m: number): void {
  const n = foes.reduce((x, y) => (Math.abs(y.pos - s.pos) < Math.abs(x.pos - s.pos) ? y : x));
  s.pos += (Math.sign(s.pos - n.pos) || (s.pos <= 0 ? -1 : 1)) * m;
}

/** Pocisk magiczny: kumulacja PS Splatania, potem Rzucanie (PS >= PZ), Obrazenia + PS ponad PZ. */
function castMissile(a: State, d: State, rng: Rng, bonus: number): boolean {
  const sp = a.f.spell;
  if (!sp) return false;
  if (a.channelled < sp.cn - 2) {
    const ch = test(sp.channel - penalty(a, d), rng);
    if (ch.ok) a.channelled += Math.max(1, ch.sl);
    return true;
  }
  const c = test(sp.cast + bonus - penalty(a, d), rng);
  if (!c.ok || c.sl + a.channelled < sp.cn) {
    a.channelled = 0;
    return true;
  }
  const over = c.sl + a.channelled - sp.cn;
  a.channelled = 0;
  // Wymanewrowanie: Obrazenia bez Testu Przeciwstawnego - +1 Przewagi.
  a.side.pool++;
  apply(a, d, wounds(a, d, { damage: sp.damage, magical: true, sl: over, roll: c.roll }, rng), rng);
  return true;
}

/** Zioniecie / Wymiot: jeden Test Umiejetnosci Strzeleckich przeciw Unikowi kazdego celu; foes[0] - glowny cel. */
function breathe(a: State, foes: State[], rng: Rng): void {
  const b = a.f.breath!;
  const t = test(a.f.ranged + b.bonus - penalty(a, foes[0]), rng);
  // Obszar: cel i jego otoczenie (promien BS / 2 m) - kazdy inny przeciwnik w nim z szansa 50%.
  const hit = foes.filter((_, i) => i === 0 || randInt(1, 2, rng) === 1);
  for (const d of hit) {
    const def = test(d.f.dodge - penalty(d, a), rng);
    if (!t.ok || (def.ok && def.sl >= t.sl)) continue;
    const dmg = wounds(a, d, { damage: b.damage, magical: true, ignoreAp: b.ignoreAp, sl: 0, roll: t.roll }, rng);
    apply(a, d, dmg, rng, { venom: b.poison });
    if (b.stun) d.stunned++;
  }
}

/** Upiorne Wycie: 1k10 Ran bez BWt i PP oraz Panika przy nieudanej Odpornosci (+20). */
function howl(a: State, foes: State[], rng: Rng): void {
  for (const d of foes) {
    apply(a, d, randInt(1, 10, rng), rng);
    d.stunned++;
    if (!d.f.fearless && !test(d.f.endurance + 20, rng).ok) d.broken++;
  }
}

/** Lodowaty Uscisk (2 Przewagi + Akcja): Magiczny, 1k10 + PS bez BWt i PP. */
function icyGrip(a: State, d: State, rng: Rng): void {
  const t = test(a.f.attack.skill - penalty(a, d), rng);
  const def = test(d.f.dodge - penalty(d, a), rng);
  if (!t.ok || (def.ok && def.sl >= t.sl)) return;
  if (warded(d, true, rng)) return;
  apply(a, d, randInt(1, 10, rng) + Math.max(0, t.sl - (def.ok ? def.sl : 0)), rng);
}

/** Petryfikujace Spojrzenie (wszystkie Przewagi): US + PS z Przewagi przeciw I; 2 PS = Oszolomienie, 6 PS = kamien. */
function petrify(a: State, d: State, spent: number, rng: Rng): void {
  const t = test(a.f.ranged - penalty(a, d), rng);
  const def = test(d.f.init - penalty(d, a), rng);
  const margin = (t.ok ? t.sl : -1) + spent - (def.ok ? def.sl : -1);
  if (margin >= 6) {
    d.hp = 0;
    d.out = true;
  } else if (margin >= 2) d.stunned += Math.floor(margin / 2);
}

export interface FightResult {
  /** "A" - wygrala strona A (druzyna), "B" - stworzenie, "remis" - limit rund. */
  winner: "A" | "B" | "remis";
  rounds: number;
  /** Obrazenia zadane przez strone B stronie A (do jej Zywotnosci) i odwrotnie. */
  dealtByB: number;
  dealtByA: number;
  /** Ilu z A wylaczonych z walki. */
  downedA: number;
  /** Stworzenie (Zwierzecy) uciekło z walki. */
  fledB: boolean;
}

/** Przewaga na start za Zagrozenie [PB 135]: ogr, troll 1 / mantikora, gryf 3 / smok, wielki demon 5 - wg Rozmiaru. */
const THREAT_START = [0, 0, 0, 0, 1, 3, 5];

/** Przewaga na start za liczebnosc [PB 135]: wiecej 1, 2:1 - 2, 3:1 - 3. */
function numbersStart(mine: number, theirs: number): number {
  if (mine <= theirs) return 0;
  return mine >= 3 * theirs ? 3 : mine >= 2 * theirs ? 2 : 1;
}

/** Strona w opalach: ktos juz wypadl z walki albo zostalo jej mniej niz 60% Zywotnosci. */
function badly(team: State[]): boolean {
  if (team.some((x) => !up(x))) return true;
  const hp = team.reduce((t, x) => t + Math.max(0, x.hp), 0);
  return hp < 0.6 * team.reduce((t, x) => t + x.f.wounds, 0);
}

/**
 * Tura stworzenia: najmocniejsza zdolnosc za Przewage, darmowe ataki, Dodatkowa Akcja.
 * Przewage zbiera na konkretne efekty; Dodatkowa Akcja i Dodatkowy wysilek, gdy idzie zle,
 * pula jest pelna (8+) albo Srogi i tak ja odnawia.
 */
function creatureTurn(s: State, foes: State[], round: number, rng: Rng, act: (bonus: number, gain: boolean) => void): void {
  const alive = () => foes.filter(up);
  const target = () => chooseTarget(s, foes, rng)!;
  const pool = s.side;
  const bad = badly(s.team);
  // Furia: wszystkie Przewagi (min. 1) na Nienawisc, a od 3 - na Szal Bojowy.
  if (s.f.fury && !s.frenzied && pool.pool >= 3) {
    pool.pool = 0;
    s.frenzied = true;
  } else if (s.f.fury && !s.hating && !s.frenzied && pool.pool >= 1) {
    pool.pool = 0;
    s.hating = true;
  }
  // Akcja: zdolnosc specjalna albo atak.
  let acted = false;
  if (s.f.breath && pool.pool >= s.f.breath.cost) {
    pool.pool -= s.f.breath.cost;
    const t = target();
    breathe(s, [t, ...alive().filter((x) => x !== t)], rng);
  } else if (s.f.howl && pool.pool >= 2) {
    pool.pool = 0;
    howl(s, alive(), rng);
  } else if (s.f.icyGrip && pool.pool >= 2) {
    pool.pool -= 2;
    icyGrip(s, target(), rng);
    acted = true;
  } else if (s.f.petrify && pool.pool >= 4) {
    // Petryfikujace Spojrzenie dopiero od 4 Przewag (realna szansa na 6 PS); wczesniej zwykly atak i darmowe ataki.
    const spent = pool.pool;
    pool.pool = 0;
    petrify(s, target(), spent, rng);
    acted = true;
  }
  if (!acted) {
    const reserve = s.f.freeAttacks.some((x) => x.cost) ? 1 : 0;
    const spend = bad || !!s.f.fierce;
    let extra = false;
    if (pool.pool >= 4 + reserve && (spend || pool.pool >= 8)) {
      pool.pool -= 4;
      extra = true;
    }
    // Dodatkowy wysilek [PB 134]: 2 Przewagi = +10, kazda kolejna +10.
    let bonus = 0;
    const spare = pool.pool - reserve;
    if (spend && spare >= 2) {
      bonus = 10 * (spare - 1);
      pool.pool -= spare;
    }
    act(bonus, bonus === 0);
    if (extra && alive().length) act(0, false);
    // Szal Bojowy: jeden darmowy atak co Ture.
    if (s.frenzied && alive().length) act(0, false);
  }
  // Darmowe ataki (Ugryzienie, Ogon, Jezyk za 1 Przewage; Macki, Tupniecie, Rogi bez kosztu) - w ten sam cel.
  for (const fa of s.f.freeAttacks) {
    if (!alive().length) break;
    if (fa.firstRound && round > 0) continue;
    const t = target();
    if (fa.vsSmaller && t.f.size >= s.f.size) continue;
    if (fa.cost && !s.f.swarm) {
      if (pool.pool < fa.cost) continue;
      pool.pool -= fa.cost;
    }
    melee(s, t, rng, 0, false, fa);
  }
}

/**
 * Starcie: strona A (druzyna albo jeden gracz) na stronie B (jedno stworzenie albo kilka).
 * Inicjatywa [dom HR-019]: k10 + BI + BZw (zalety broni), rzut raz na poczatku walki.
 * Przewaga Grupowa [PB 133-135]: dwie pule; +1 za wygrany wlasny Test Przeciwstawny; na koniec
 * Rundy strona liczniejsza zabiera 1 punkt (albo dostaje +1); na start liczebnosc i Zagrozenie.
 * Gracze trzymaja Przewage i wydaja ja, gdy idzie zle (albo pula pelna); stworzenia - na swoje zdolnosci.
 * opts.crits: Rany Krytyczne - przy 0 Zyw walczacy jest Powalony, a wypada z walki dopiero przez
 * Utrate Przytomnosci (Krytyk, Krwawienie, BWt Rund na 0 Zyw) albo Smierc; pionki (minion) - przy Krytyku.
 */
export function fight(sideA: Fighter[], sideB: Fighter[], rng: Rng, maxRounds = 30, opts: FightOptions = {}): FightResult {
  CRITS = !!opts.crits;
  DIST = !!opts.distance;
  const poolA = { pool: 0, distracted: false };
  const poolB = { pool: 0, distracted: false };
  const mk = (side: State["side"]) => (f: Fighter): State => ({
    f, hp: f.wounds, broken: 0, stunned: 0, poisoned: 0, entangled: 0, prone: false, fearSl: 0, fearDone: !!f.fearless,
    frenzied: false, hating: false, fled: false, channelled: 0, fortune: f.fortune, counters: 0, burnt: 0,
    out: false, crits: 0, bleed: 0, blind: 0, zeroRounds: 0, maim: 0, skip: 0, exposed: 0, target: null, initRoll: 0, team: [], pos: 0, charge: 0,
    dealt: 0, taken: 0, side
  });
  const A = sideA.map(mk(poolA));
  const B = sideB.map(mk(poolB));
  for (const s of A) s.team = A;
  for (const s of B) s.team = B;
  // Dystans: strona A w 0, strona B w wylosowanej odleglosci.
  if (opts.distance) {
    const gap = opts.distance[0] + rng() * (opts.distance[1] - opts.distance[0]);
    for (const s of B) s.pos = gap;
  }
  const alive = (xs: State[]) => xs.filter(up);
  const swarmFight = [...A, ...B].some((x) => x.f.swarm);
  poolA.pool = (swarmFight ? 0 : numbersStart(A.length, B.length)) + Math.max(0, ...A.map((x) => THREAT_START[x.f.size] ?? 0));
  poolB.pool = (swarmFight ? 0 : numbersStart(B.length, A.length)) + Math.max(0, ...B.map((x) => THREAT_START[x.f.size] ?? 0));
  // Dekoncentrujacy: -20 do wszystkich Testow strony przeciwnej (raz).
  poolA.distracted = B.some((x) => x.f.distracting);
  poolB.distracted = A.some((x) => x.f.distracting);
  // Inicjatywa [dom HR-019]: k10 + BI + BZw (+ zalety broni), raz na poczatku walki; remis - wyzsza Zwinnosc.
  for (const s of [...A, ...B]) s.initRoll = randInt(1, 10, rng) + Math.floor(s.f.init / 10) + Math.floor(s.f.agility / 10) + (s.f.initMod ?? 0);
  const order = [...A, ...B].sort((x, y) => y.initRoll - x.initRoll || y.f.agility - x.f.agility);
  // Groza: Test Opanowania na starcie, porazka = Zlamany (1 + PS porazki rund), potem Strach.
  for (const [side, foes] of [[A, B], [B, A]] as const) {
    const terror = Math.max(0, ...foes.map((x) => x.f.terror));
    for (const s of side) {
      if (terror && !s.f.fearless) {
        const t = test(s.f.cool, rng);
        if (!t.ok) s.broken = 1 + Math.max(0, -t.sl);
      }
    }
  }
  let round = 0;
  for (; round < maxRounds && alive(A).length && alive(B).length; round++) {
    for (const s of [...A, ...B]) {
      s.counters = 0;
      if (!s.f.regenerate || !up(s)) continue;
      // Regeneracja: 1k10 na poczatku Rundy; przy 0 Zyw - 1 Rana na 8+ (Krytyki).
      if (s.hp > 0 && s.hp < s.f.wounds - s.burnt) s.hp = Math.min(s.f.wounds - s.burnt, s.hp + randInt(1, 10, rng));
      else if (CRITS && s.hp === 0 && randInt(1, 10, rng) >= 8) s.hp = 1;
    }
    for (const s of order) {
      if (!up(s)) continue;
      const isA = A.includes(s);
      const foes = isA ? B : A;
      if (!alive(foes).length) break;
      // Powalenie mija w Turze; przy 0 Zyw (Krytyki) trwa, dopoki ktos nie uleczy Rany.
      s.prone = CRITS && s.hp === 0;
      // Ozywieniec, Demoniczny: odporni na Oszolomienie i Zatrucie.
      if (s.f.noStun) s.stunned = s.poisoned = 0;
      if (s.f.fierce && s.side.pool < s.f.fierce) s.side.pool = s.f.fierce;
      // Strach (Prog): rozszerzony Test Opanowania co Runde, az PS >= Prog.
      const fear = Math.max(0, ...foes.map((x) => Math.max(x.f.fear, x.f.terror)));
      if (fear && !s.fearDone && !s.frenzied) {
        const t = test(s.f.cool, rng);
        if (t.ok) s.fearSl += Math.max(0, t.sl) + 1;
        if (s.fearSl >= fear) s.fearDone = true;
      } else if (!fear) s.fearDone = true;
      if (s.stunned > 0) {
        // Oszolomienie: brak Akcji, wrog +1 Przewagi; konczy Szal Bojowy (PG s. 191).
        s.frenzied = false;
        (isA ? poolB : poolA).pool++;
        continue;
      }
      // Stracona Akcja (upuszczona bron po Krytyku, Pech).
      if (s.skip > 0) {
        s.skip--;
        continue;
      }
      if (s.broken > 0 && !s.frenzied) {
        const t = test(s.f.cool, rng);
        s.broken = t.ok ? Math.max(0, s.broken - 1 - Math.max(0, t.sl)) : s.broken;
        continue;
      }
      // Pochwycenie: Akcja na Przeciwstawna Sile (wygrana zrywa wszystkie).
      if (s.entangled) {
        const grip = alive(foes)[0];
        const t = test(s.f.strength - 10 * s.entangled, rng);
        const g = test(grip?.f.strength ?? 30, rng);
        if (t.ok && (!g.ok || t.sl > g.sl)) s.entangled = 0;
        continue;
      }
      // Szal Bojowy: Test Sily Woli na wejscie.
      if (s.f.frenzy && !s.frenzied && test(s.f.willpower, rng).ok) s.frenzied = true;
      // Ogien: z szansa fire atak w tej Turze jest ognisty - tylko na cel, na ktory warto go uzyc
      // (Regeneracja, roj drobnicy); na inne stworzenia (np. Bazyliszek) ognia sie nie uzywa.
      const fireRoll = !!s.f.fire && randInt(1, 100, rng) <= s.f.fire * 100;
      const fireOn = (t: State) => (!!t.f.swarm && !!s.f.antiSwarm) || (fireRoll && (t.f.regenerate || !!t.f.swarmTiny));
      let shooting = false;
      const act = (bonus: number, gain: boolean) => {
        const targets = alive(foes);
        if (!targets.length) return;
        // Roj: atakuje wszystkich wrogow w zasiegu.
        if (s.f.swarm) {
          targets.filter((t) => !DIST || near(s, t)).forEach((t, i) => melee(s, t, rng, bonus, gain && i === 0, undefined, fireOn(t)));
          return;
        }
        const target = chooseTarget(s, foes, rng)!;
        if (shooting) shoot(s, target, rng, bonus);
        else if (!castMissile(s, target, rng, bonus)) melee(s, target, rng, bonus, gain, undefined, fireOn(target));
      };
      // Dystans: Ruch przed Akcja. Strzelec strzela, a zwiazany walka odchodzi za 2 Przewagi (Ucieczka
      // przed zagrozeniem, PB 134); pozostali ida do celu: Ruch (2 x Sz) i atak, Szarza do Biegu (4 x Sz, +10),
      // dalej - sam Bieg bez Akcji. Latajacy pokonuje Latanie metrow. Zioniecie siega 20 m.
      if (DIST) {
        const t = chooseTarget(s, foes, rng)!;
        const walk = 2 * (s.f.speed ?? 4);
        const run = Math.max(2 * walk, s.f.fly ?? 0);
        const engaged = alive(foes).filter((x) => near(s, x));
        if (s.f.shooter && s.f.shot) {
          if (engaged.length && s.side.pool >= 2) {
            s.side.pool -= 2;
            moveAway(s, engaged, walk);
          }
          shooting = !alive(foes).some((x) => near(s, x));
          if (shooting && Math.abs(t.pos - s.pos) > s.f.shot.range) moveTo(s, t, walk);
        }
        const breathNow = !isA && !!s.f.breath && s.side.pool >= s.f.breath.cost && Math.abs(t.pos - s.pos) <= 20;
        if (!shooting && !breathNow && !near(s, t)) {
          const gap = Math.abs(t.pos - s.pos) - 1.5;
          if (gap <= walk) moveTo(s, t, walk);
          else if (gap <= run) {
            moveTo(s, t, run);
            s.charge = 10;
          } else {
            moveTo(s, t, run);
            continue;
          }
        }
      }
      if (!isA) creatureTurn(s, foes, round, rng, act);
      else {
        // Gracze trzymaja Przewage: Dodatkowa Akcja, gdy idzie zle albo pula pelna (8+);
        // przy zlej sytuacji i 2-3 punktach - Dodatkowy wysilek (+10 za 2, kazdy kolejny +10).
        const bad = badly(A);
        let extra = false;
        let bonus = 0;
        if (s.side.pool >= 4 && (bad || s.side.pool >= 8)) {
          s.side.pool -= 4;
          extra = true;
        } else if (bad && s.side.pool >= 2) {
          bonus = 10 * (s.side.pool - 1);
          s.side.pool = 0;
        }
        act(bonus, bonus === 0);
        if (extra) act(0, false);
      }
      // Zwierzecy: ponizej polowy Zywotnosci ucieka, a Terytorialny albo osaczony wpada w Szal Bojowy.
      if (s.f.animal && up(s) && s.hp < s.f.wounds / 2) {
        if (s.f.territorial || s.f.cornered) s.frenzied = true;
        else s.fled = true;
      }
    }
    // Koniec Rundy: Stany (Zatrucie - 1 Rana na poziom; Odpornosc zdejmuje 1 + PS z Zatrucia i Oszolomienia).
    for (const s of [...A, ...B]) {
      if (!up(s)) continue;
      if (s.poisoned) {
        hurt(s, s.poisoned);
        const t = test(s.f.endurance, rng);
        if (t.ok) s.poisoned = Math.max(0, s.poisoned - 1 - Math.max(0, t.sl));
      }
      if (s.stunned) {
        const t = test(s.f.endurance, rng);
        if (t.ok) s.stunned = Math.max(0, s.stunned - 1 - Math.max(0, t.sl));
      }
      if (CRITS) {
        // Krwawienie: 1 Rana na poziom; przy 0 Zyw Test Odpornosci albo omdlenie.
        if (s.bleed) {
          if (s.hp > 0) hurt(s, s.bleed);
          else if (!test(s.f.endurance, rng).ok) s.out = true;
        }
        // Na 0 Zyw dluzej niz BWt Rund - Utrata Przytomnosci [PG 172]; istota bez bolu nie mdleje,
        // pada dopiero, gdy ma wiecej Ran Krytycznych niz BWt.
        if (s.f.painless) {
          if (s.hp === 0 && s.crits > s.f.tb) s.out = true;
        } else if (s.hp === 0 && ++s.zeroRounds > s.f.tb) s.out = true;
        if (s.blind && round % 2 === 1) s.blind--;
        s.exposed = 0;
      }
    }
    // Roj: kazdy wrog Zwiazany walka traci Rany na koniec Rundy (bez BWt i PP).
    for (const [side, foes] of [[A, B], [B, A]] as const) {
      for (const s of alive(side)) {
        if (!s.f.swarm) continue;
        for (const t of alive(foes)) apply(s, t, s.f.swarm, rng);
      }
    }
    // Strona liczniejsza dominuje - zabiera 1 punkt (albo +1, gdy pula wroga pusta). Roje ignoruja liczebnosc.
    const nA = alive(A).length;
    const nB = alive(B).length;
    if (nA !== nB && nA && nB && !swarmFight) {
      const [win, lose] = nA > nB ? [poolA, poolB] : [poolB, poolA];
      if (lose.pool > 0) lose.pool--;
      win.pool++;
    }
  }
  const aAlive = alive(A).length;
  const bAlive = alive(B).length;
  const fledB = B.some((x) => x.fled);
  return {
    winner: aAlive && !bAlive ? "A" : bAlive && !aAlive ? "B" : "remis",
    rounds: round,
    dealtByB: B.reduce((s, x) => s + x.dealt, 0),
    dealtByA: A.reduce((s, x) => s + x.dealt, 0),
    downedA: A.filter((x) => !up(x) && !x.fled).length,
    fledB
  };
}
