/**
 * Symulator starc: walka wrecz wg WFRP 4 (Testy Przeciwstawne, PS, Miejsce Trafienia, Redukcja),
 * Przewaga Grupowa (Pod Bronia, PB 133-135), Rozmiar [dom], Suche Kosci [dom], Strach/Groza,
 * Stany (Oszolomienie, Zatrucie, Pochwycenie, Powalenie, Panika) i Cechy Stworzen z liczbami:
 * darmowe ataki za Przewage (Ugryzienie, Atak Ogonem, Atak Jezykiem, Macki, Staje Deba, Rogi),
 * Zioniecie, Wymiot, Upiorne Wycie, Lodowaty Uscisk, Petryfikujace Spojrzenie, Czempion, Ochrona,
 * Kwasowa Krew, Wampiryczny, Jad, Dusiciel, Siec, Dekoncentrujacy, Furia, Szal Bojowy, Nienawisc,
 * Zwierzecy (tylko Unik, ucieczka), Eteryczny, Demoniczny, Magiczny, Regeneracja i pociski magiczne.
 * Pomija: Rany Krytyczne (0 Zyw = wylaczony z walki), ruch i dystans, talenty bez liczb.
 */
import { randInt, type Rng } from "./dice";
import { sizeOf } from "./creatures";
import * as gd from "./gameData";
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
  champion?: boolean;
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
}

/** Postac gracza z druzyna.json. */
export interface PartyMember {
  name: string;
  race?: string;
  I: number;
  S: number;
  Wt: number;
  SW?: number;
  US?: number;
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

/** Stworzenie albo BN z generatora jako walczacy. */
export function npcFighter(npc: Npc, view: NpcView = computeNpc(npc)): Fighter {
  const traits = [...(gd.getCreature(npc.creature)?.traits ?? []), ...npc.traits, ...view.heroTraits];
  const melee = view.weapons.filter((w) => !w.ranged && w.damage != null).sort((a, b) => b.skill + 3 * (b.damage ?? 0) - (a.skill + 3 * (a.damage ?? 0)))[0];
  const skill = (name: string) => view.skills.find((s) => s.name === name)?.total;
  const parry = Math.max(0, ...view.skills.filter((s) => s.name.startsWith("Broń Biała")).map((s) => s.total));
  const size = Math.max(0, SIZES.indexOf(sizeOf(traits)));
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
    champion: has(traits, /^(Czempion|Mistrz)$/),
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
    fearless: has(traits, /^Niewrażliwość na Psychologię/),
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
  dealt: number;
  taken: number;
  /** Pula Przewagi strony (wspolna dla wszystkich jej walczacych) i kara Dekoncentrujacy dla strony. */
  side: { pool: number; distracted: boolean };
}

function test(value: number, rng: Rng): { ok: boolean; sl: number; roll: number } {
  const roll = randInt(1, 100, rng);
  const ok = roll <= 5 || (roll <= value && roll <= 95);
  return { ok, sl: Math.floor(value / 10) - Math.floor(roll / 10), roll };
}

function location(roll: number): Loc {
  // Lokacja z odwroconego rzutu ataku.
  const r = (roll % 10) * 10 + Math.floor(roll / 10) || 100;
  return r <= 9 ? "głowa" : r <= 44 ? "ręce" : r <= 79 ? "korpus" : "nogi";
}

/** Kary do Testow walczacego: Strach (-10 do wroga), Zatrucie, Oszolomienie, Pochwycenie, Dekoncentrujacy. */
function penalty(s: State, enemy: State): number {
  let p = 0;
  if ((enemy.f.fear || enemy.f.terror) && !s.fearDone) p += 10;
  if (s.poisoned) p += 10;
  if (s.stunned) p += 10;
  if (s.entangled) p += 10;
  if (s.side.distracted) p += 20;
  return p;
}

/** Rzuty ochronne: Eteryczny (tylko Magiczne), Demoniczny (nie-Magiczne), Ochrona (kazdy cios). */
function warded(d: State, magical: boolean, rng: Rng): boolean {
  if (d.f.ethereal && !magical) return true;
  if (d.f.demonic && !magical && randInt(1, 10, rng) >= d.f.demonic) return true;
  return !!d.f.ward && randInt(1, 10, rng) >= d.f.ward;
}

/** Nienawisc dziala tylko na swoj obiekt: rasa celu, Zywi, Wszystko. Bez obiektu i Intruzi - brak premii. */
function hates(a: State, d: State): boolean {
  if (!a.f.hatred && !a.hating) return false;
  if (a.hating) return true;
  const o = a.f.hatred!.toLowerCase();
  const r = d.f.race.toLowerCase();
  return /^(żyw|wszys)/.test(o) || (o.startsWith("krasnolud") && r.startsWith("krasnolud")) || (o.startsWith("ludzi") && r.startsWith("człowiek")) || (o.startsWith("elf") && r.includes("elf"));
}

interface Hit {
  damage: number;
  ignoreAp?: boolean;
  ignoreTb?: boolean;
  magical: boolean;
  blunt?: boolean;
  sl: number;
  roll: number;
}

/** Rany z trafienia po Redukcji i zasadach domowych; 0 = brak Ran. */
function wounds(a: State, d: State, h: Hit, rng: Rng): number {
  if (warded(d, h.magical, rng)) return 0;
  const loc = location(h.roll);
  // Rozmiar [dom]: +BS za kazdy stopien ponad Sredni. Suche Kosci [dom]: -2/poziom nieobuchowa, +2 obuchowa.
  // Szal Bojowy: +1 do BS - w Obrazeniach broni i w premii Rozmiaru.
  const frenzy = a.frenzied ? 1 : 0;
  const sizeDmg = (a.f.sb + frenzy) * Math.max(0, a.f.size - AVERAGE);
  const bones = d.f.dryBones && !h.magical ? (h.blunt ? 2 : -2 * d.f.dryBones) : 0;
  const red = h.ignoreTb ? 0 : h.ignoreAp ? d.f.tb : d.f.armour[loc];
  const raw = h.damage + sizeDmg + bones + frenzy + h.sl - red;
  const minOne = d.f.demonic && !h.magical ? 0 : 1;
  return Math.max(minOne, raw);
}

/** Zadaje Rany (Kwasowa Krew, Jad, Wampiryczny, Pochwycenie), zwraca zadane. */
function apply(a: State, d: State, dmg: number, rng: Rng, opts: { venom?: boolean; bite?: boolean; entangle?: boolean; knockdown?: boolean } = {}): void {
  if (dmg <= 0) return;
  const real = Math.min(dmg, Math.max(0, d.hp));
  d.hp -= dmg;
  a.dealt += real;
  d.taken += real;
  if (opts.venom) d.poisoned++;
  if (opts.entangle) d.entangled++;
  if (opts.knockdown && d.f.size < a.f.size) d.prone = true;
  if (opts.bite && a.f.vampiric) a.hp = Math.min(a.f.wounds, a.hp + real);
  // Kwasowa Krew: ranione stworzenie pryska na atakujacego (1k10 po Redukcji, min. 1).
  if (d.f.acidBlood && a.hp > 0) {
    const acid = Math.max(1, randInt(1, 10, rng) - a.f.armour.korpus);
    a.hp -= acid;
    d.dealt += acid;
  }
}

/**
 * Atak wrecz (Test Przeciwstawny). bonus - premia z wydanej Przewagi; gain - Wygrana daje +1 do puli.
 * Obronca: parowanie (kara Rozmiaru [dom]) albo Unik (bez kary); Zwierzecy tylko Unik.
 * Czempion broniacy sie z wygrana zadaje Obrazenia jak atakujacy.
 */
function melee(a: State, d: State, rng: Rng, bonus: number, gain: boolean, fa?: FreeAttack): void {
  const att = a.f.attack;
  const prone = d.prone ? 20 : 0;
  const hate = hates(a, d) ? 1 : 0;
  const atkTest = test(att.skill + bonus + prone - penalty(a, d), rng);
  const sizeGap = Math.max(0, a.f.size - d.f.size);
  const parryVal = d.f.parry - penalty(d, a);
  const dodgeVal = d.f.dodge - penalty(d, a);
  const parrySl = (v: { sl: number }) => v.sl - 2 * sizeGap + (att.slow ? 1 : 0) - (d.f.attack.unbalanced ? 1 : 0);
  const useParry = !d.f.animal && parryVal - 20 * sizeGap > dodgeVal;
  let def = test(useParry ? parryVal : dodgeVal, rng);
  let defSl = useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0);
  const atkSl = atkTest.sl + hate;
  const wins = () => atkTest.ok && (atkSl > defSl || (atkSl === defSl && att.skill >= (useParry ? d.f.parry : d.f.dodge)));
  if (wins() && d.fortune > 0 && !def.ok) {
    d.fortune--;
    def = test(useParry ? parryVal : dodgeVal, rng);
    defSl = useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0);
  }
  if (!wins()) {
    // Czempion: wygrana obrona zadaje Obrazenia jak atak.
    if (d.f.champion && def.ok && defSl > atkSl && !fa) {
      const dmg = wounds(d, a, { damage: d.f.attack.damage, magical: d.f.attack.magical, blunt: d.f.attack.blunt, sl: defSl - atkSl, roll: def.roll }, rng);
      apply(d, a, dmg, rng, { venom: d.f.venom });
    }
    return;
  }
  // Wygrana: wygrany Test Przeciwstawny, ktory sam zainicjowales - +1 do puli strony [PB 133].
  if (gain) a.side.pool++;
  const hit: Hit = { damage: fa?.damage ?? att.damage, magical: att.magical, blunt: fa ? false : att.blunt, sl: atkSl - defSl, roll: atkTest.roll };
  apply(a, d, wounds(a, d, hit, rng), rng, { venom: a.f.venom, bite: fa?.name === "Ugryzienie", entangle: a.f.entangle && !fa, knockdown: fa?.knockdown });
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

/** Zioniecie / Wymiot: jeden Test Umiejetnosci Strzeleckich przeciw Unikowi kazdego celu. */
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
  if (margin >= 6) d.hp = 0;
  else if (margin >= 2) d.stunned += Math.floor(margin / 2);
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

/** Tura stworzenia ze zdolnosciami za Przewage: najmocniejsza zdolnosc, darmowe ataki, Dodatkowa Akcja. */
function creatureTurn(s: State, foes: State[], round: number, rng: Rng, act: (bonus: number, gain: boolean) => void): void {
  const alive = () => foes.filter((x) => x.hp > 0 && !x.fled);
  const pick = () => {
    const t = alive();
    return t[randInt(0, t.length - 1, rng)];
  };
  const pool = s.side;
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
    breathe(s, alive(), rng);
  } else if (s.f.howl && pool.pool >= 2) {
    pool.pool = 0;
    howl(s, alive(), rng);
  } else if (s.f.icyGrip && pool.pool >= 2) {
    pool.pool -= 2;
    icyGrip(s, pick(), rng);
    acted = true;
  } else if (s.f.petrify && pool.pool >= 1) {
    const spent = pool.pool;
    pool.pool = 0;
    petrify(s, pick(), spent, rng);
    acted = true;
  }
  if (!acted) {
    let extra = false;
    if (pool.pool >= 4 + (s.f.freeAttacks.some((x) => x.cost) ? 1 : 0)) {
      pool.pool -= 4;
      extra = true;
    }
    let bonus = 0;
    if (s.f.fierce) {
      while (pool.pool >= 2 + (s.f.freeAttacks.some((x) => x.cost) ? 1 : 0)) {
        pool.pool -= 2;
        bonus += 10;
      }
    }
    act(bonus, bonus === 0);
    if (extra && alive().length) act(0, false);
    // Szal Bojowy: jeden darmowy atak co Ture.
    if (s.frenzied && alive().length) act(0, false);
  }
  // Darmowe ataki (Ugryzienie, Ogon, Jezyk za 1 Przewage; Macki, Tupniecie, Rogi bez kosztu).
  for (const fa of s.f.freeAttacks) {
    const t = alive();
    if (!t.length) break;
    if (fa.firstRound && round > 0) continue;
    const target = pick();
    if (fa.vsSmaller && target.f.size >= s.f.size) continue;
    if (fa.cost) {
      if (pool.pool < fa.cost) continue;
      pool.pool -= fa.cost;
    }
    melee(s, target, rng, 0, false, fa);
  }
}

/**
 * Starcie: strona A (druzyna albo jeden gracz) na stronie B (jedno stworzenie albo kilka).
 * Przewaga Grupowa [PB 133-135]: dwie pule; +1 za wygrany wlasny Test Przeciwstawny; na koniec
 * Rundy strona liczniejsza zabiera 1 punkt (albo dostaje +1); na start liczebnosc i Zagrozenie;
 * gracze wydaja 4 na Dodatkowa Akcje; stworzenia - na swoje zdolnosci (Zioniecie 2, Ugryzienie 1...).
 */
export function fight(sideA: Fighter[], sideB: Fighter[], rng: Rng, maxRounds = 30): FightResult {
  const poolA = { pool: 0, distracted: false };
  const poolB = { pool: 0, distracted: false };
  const mk = (side: State["side"]) => (f: Fighter): State => ({
    f, hp: f.wounds, broken: 0, stunned: 0, poisoned: 0, entangled: 0, prone: false, fearSl: 0, fearDone: !!f.fearless,
    frenzied: false, hating: false, fled: false, channelled: 0, fortune: f.fortune, dealt: 0, taken: 0, side
  });
  const A = sideA.map(mk(poolA));
  const B = sideB.map(mk(poolB));
  const alive = (xs: State[]) => xs.filter((x) => x.hp > 0 && !x.fled);
  poolA.pool = numbersStart(A.length, B.length) + Math.max(0, ...A.map((x) => THREAT_START[x.f.size] ?? 0));
  poolB.pool = numbersStart(B.length, A.length) + Math.max(0, ...B.map((x) => THREAT_START[x.f.size] ?? 0));
  // Dekoncentrujacy: -20 do wszystkich Testow strony przeciwnej (raz).
  poolA.distracted = B.some((x) => x.f.distracting);
  poolB.distracted = A.some((x) => x.f.distracting);
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
      if (s.f.regenerate && s.hp > 0 && s.hp < s.f.wounds) s.hp = Math.min(s.f.wounds, s.hp + randInt(1, 10, rng));
    }
    const order = [...A, ...B].sort((x, y) => y.f.init - x.f.init);
    for (const s of order) {
      if (s.hp <= 0 || s.fled) continue;
      const isA = A.includes(s);
      const foes = isA ? B : A;
      if (!alive(foes).length) break;
      s.prone = false;
      if (s.f.fierce && s.side.pool < s.f.fierce) s.side.pool = s.f.fierce;
      // Strach (Prog): rozszerzony Test Opanowania co Runde, az PS >= Prog.
      const fear = Math.max(0, ...foes.map((x) => Math.max(x.f.fear, x.f.terror)));
      if (fear && !s.fearDone && !s.frenzied) {
        const t = test(s.f.cool, rng);
        if (t.ok) s.fearSl += Math.max(0, t.sl) + 1;
        if (s.fearSl >= fear) s.fearDone = true;
      } else if (!fear) s.fearDone = true;
      if (s.stunned > 0) {
        // Oszolomienie: brak Akcji, wrog +1 Przewagi.
        (isA ? poolB : poolA).pool++;
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
      const act = (bonus: number, gain: boolean) => {
        const targets = alive(foes);
        if (!targets.length) return;
        const target = targets[randInt(0, targets.length - 1, rng)];
        if (!castMissile(s, target, rng, bonus)) melee(s, target, rng, bonus, gain);
      };
      if (!isA) creatureTurn(s, foes, round, rng, act);
      else {
        const extra = s.side.pool >= 4;
        if (extra) s.side.pool -= 4;
        act(0, true);
        if (extra) act(0, false);
      }
      // Zwierzecy: ponizej polowy Zywotnosci ucieka, a Terytorialny wpada w Szal Bojowy.
      if (s.f.animal && s.hp > 0 && s.hp < s.f.wounds / 2) {
        if (s.f.territorial) s.frenzied = true;
        else s.fled = true;
      }
    }
    // Koniec Rundy: Stany (Zatrucie - 1 Rana na poziom; Odpornosc zdejmuje 1 + PS z Zatrucia i Oszolomienia).
    for (const s of [...A, ...B]) {
      if (s.hp <= 0) continue;
      if (s.poisoned) {
        s.hp -= s.poisoned;
        const t = test(s.f.endurance, rng);
        if (t.ok) s.poisoned = Math.max(0, s.poisoned - 1 - Math.max(0, t.sl));
      }
      if (s.stunned) {
        const t = test(s.f.endurance, rng);
        if (t.ok) s.stunned = Math.max(0, s.stunned - 1 - Math.max(0, t.sl));
      }
    }
    // Strona liczniejsza dominuje - zabiera 1 punkt (albo +1, gdy pula wroga pusta).
    const nA = alive(A).length;
    const nB = alive(B).length;
    if (nA !== nB && nA && nB) {
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
    downedA: A.filter((x) => x.hp <= 0).length,
    fledB
  };
}
