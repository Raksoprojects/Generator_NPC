/**
 * Symulator starc (pierwszy przebieg): walka wrecz wg WFRP 4 (Testy Przeciwstawne, PS, Przewaga,
 * lokacje i Redukcja), Rozmiar [dom], Strach/Groza, Eteryczny, Demoniczny, Regeneracja,
 * Suche Kosci [dom], Przewage Grupowa (Pod Bronia) ze Srogim i pociski magiczne. Pomija: Rany Krytyczne (0 Zyw = wylaczony z walki),
 * Zalety broni poza Powolny/Niewywazony, talenty bez liczb, ruch i dystans.
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

export interface Fighter {
  name: string;
  wounds: number;
  init: number;
  /** Atak wrecz: wartosc testu i Obrazenia (z BS). */
  attack: { skill: number; damage: number; blunt: boolean; magical: boolean; slow: boolean; unbalanced: boolean };
  /** Parowanie (najlepsza Bron Biala) i Unik. */
  parry: number;
  dodge: number;
  cool: number;
  /** Redukcja (BWt + PP) na lokacjach. */
  armour: Record<Loc, number>;
  size: number;
  sb: number;
  fear: number;
  terror: number;
  ethereal: boolean;
  /** Demoniczny rzut ochronny (Prog), 0 = brak. */
  demonic: number;
  regenerate: boolean;
  dryBones: number;
  /** Srogi (X): pula Przewagi strony na poczatku Tury rosnie do X. */
  fierce: number;
  fortune: number;
  /** Pocisk magiczny: test Rzucania, PZ, Obrazenia. */
  spell?: { cast: number; channel: number; cn: number; damage: number };
}

/** Postac gracza z druzyna.json. */
export interface PartyMember {
  name: string;
  I: number;
  S: number;
  Wt: number;
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
    parry: p.melee,
    dodge: p.dodge,
    cool: p.cool,
    armour,
    size: AVERAGE,
    sb: characteristicBonus(p.S),
    fear: 0,
    terror: 0,
    ethereal: false,
    demonic: 0,
    regenerate: false,
    dryBones: 0,
    fierce: 0,
    fortune: p.fortune
  };
}

const rank = (traits: string[], re: RegExp) => {
  for (const t of traits) {
    const m = re.exec(t);
    if (m) return Number(m[1] ?? 1) || 1;
  }
  return 0;
};

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

/** Stworzenie albo BN z generatora jako walczacy. */
export function npcFighter(npc: Npc, view: NpcView = computeNpc(npc)): Fighter {
  const traits = [...(gd.getCreature(npc.creature)?.traits ?? []), ...npc.traits, ...view.heroTraits];
  const melee = view.weapons.filter((w) => !w.ranged && w.damage != null).sort((a, b) => b.skill + 3 * (b.damage ?? 0) - (a.skill + 3 * (a.damage ?? 0)))[0];
  const skill = (name: string) => view.skills.find((s) => s.name === name)?.total;
  const parry = Math.max(0, ...view.skills.filter((s) => s.name.startsWith("Broń Biała")).map((s) => s.total));
  const size = Math.max(0, SIZES.indexOf(sizeOf(traits)));
  const demonicAll = traits.some((t) => /^Demoniczny/.test(t));
  return {
    name: npc.name,
    wounds: view.wounds,
    init: view.chars.I.absent ? 0 : view.chars.I.total,
    attack: {
      skill: melee?.skill ?? view.chars.WW.total,
      damage: melee?.damage ?? characteristicBonus(view.chars.S.total),
      blunt: BLUNT.test(melee?.name ?? ""),
      magical: demonicAll || !!melee?.magicItem || traits.some((t) => /^Eteryczny/.test(t)),
      slow: !!melee?.qualities.includes("Powolny"),
      unbalanced: !!melee?.flaws.includes("Niewyważony")
    },
    parry: parry || (melee?.skill ?? view.chars.WW.total),
    dodge: skill("Unik") ?? (view.chars.Zw.absent ? 0 : view.chars.Zw.total),
    cool: skill("Opanowanie") ?? (view.chars.SW.absent ? 100 : view.chars.SW.total),
    armour: Object.fromEntries(LOCS.map((l) => [l, view.armour[l].total])) as Record<Loc, number>,
    size,
    sb: characteristicBonus(view.chars.S.total),
    fear: rank(traits, /^Strach \((\d+)\)/),
    terror: rank(traits, /^Groza \((\d+)\)/),
    ethereal: traits.some((t) => /^Eteryczny/.test(t)),
    demonic: rank(traits, /^Demoniczny \((\d+)\+?\)/),
    regenerate: traits.some((t) => /^Regeneracja/.test(t)),
    dryBones: Math.min(4, rank(traits, /^Suche Kości \((\d+)\)/)),
    fierce: rank(traits, /^Srogi \((\d+)\)/),
    fortune: 0,
    spell: missile(view)
  };
}

interface State {
  f: Fighter;
  hp: number;
  broken: number;
  /** Strach: zebrane PS testu rozszerzonego (do pokonania strachu). */
  fearSl: number;
  fearDone: boolean;
  /** PS Splatania zebrane na zaklecie. */
  channelled: number;
  fortune: number;
  dealt: number;
  taken: number;
  /** Pula Przewagi strony (wspolna dla wszystkich jej walczacych). */
  side: { pool: number };
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

function fearPenalty(s: State, enemy: State): number {
  return (enemy.f.fear || enemy.f.terror) && !s.fearDone ? 10 : 0;
}

/**
 * Jeden atak wrecz. bonus - premia z wydanej Przewagi (Dodatkowy wysiłek, +10 za 2 punkty);
 * gain - czy Wygrana daje +1 Przewagi stronie (Test z wydana Przewaga albo dodatkowa Akcja - nie).
 */
function melee(a: State, d: State, rng: Rng, bonus: number, gain: boolean): number {
  const att = a.f.attack;
  const atkTest = test(att.skill + bonus - fearPenalty(a, d), rng);
  // Obronca wybiera lepsze: parowanie (kara Rozmiaru [dom]: -2 PS za stopien) albo Unik (bez kary).
  const sizeGap = Math.max(0, a.f.size - d.f.size);
  const parryVal = d.f.parry - fearPenalty(d, a);
  const dodgeVal = d.f.dodge - fearPenalty(d, a);
  const parrySl = (v: { sl: number }) => v.sl - 2 * sizeGap + (att.slow ? 1 : 0) - (d.f.attack.unbalanced ? 1 : 0);
  const useParry = parryVal - 20 * sizeGap > dodgeVal;
  let def = test(useParry ? parryVal : dodgeVal, rng);
  let defSl = useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0);
  const wins = () => atkTest.ok && (atkTest.sl > defSl || (atkTest.sl === defSl && att.skill >= (useParry ? d.f.parry : d.f.dodge)));
  if (wins() && d.fortune > 0 && !def.ok) {
    d.fortune--;
    def = test(useParry ? parryVal : dodgeVal, rng);
    defSl = useParry ? parrySl(def) : def.sl + (att.slow ? 1 : 0);
  }
  if (!wins()) return 0;
  // Wygrana: wygrany Test Przeciwstawny, ktory sam zainicjowales - +1 do puli strony [PB 133].
  if (gain) a.side.pool++;
  // Eteryczny: tylko ataki magiczne; Demoniczny: rzut ochronny przeciw nie-Magicznym.
  if (d.f.ethereal && !att.magical) return 0;
  if (d.f.demonic && !att.magical && randInt(1, 10, rng) >= d.f.demonic) return 0;
  const loc = location(atkTest.roll);
  // Rozmiar [dom]: +BS za kazdy stopien ponad Sredni. Suche Kosci [dom]: -2/poziom nieobuchowa, +2 obuchowa.
  const sizeDmg = a.f.sb * Math.max(0, a.f.size - AVERAGE);
  const bones = d.f.dryBones && !att.magical ? (att.blunt ? 2 : -2 * d.f.dryBones) : 0;
  const raw = att.damage + sizeDmg + bones + (atkTest.sl - defSl) - d.f.armour[loc];
  const minOne = d.f.demonic && !att.magical ? 0 : 1;
  return Math.max(minOne, raw);
}

/** Pocisk magiczny: kumulacja PS Splatania, potem Rzucanie (PS >= PZ), Obrazenia + PS ponad PZ. */
function castMissile(a: State, d: State, rng: Rng, bonus: number): number | null {
  const sp = a.f.spell;
  if (!sp) return null;
  if (a.channelled < sp.cn - 2) {
    const ch = test(sp.channel, rng);
    if (ch.ok) a.channelled += Math.max(1, ch.sl);
    return 0;
  }
  const c = test(sp.cast + bonus, rng);
  if (!c.ok || c.sl + a.channelled < sp.cn) {
    a.channelled = 0;
    return 0;
  }
  const over = c.sl + a.channelled - sp.cn;
  a.channelled = 0;
  // Wymanewrowanie: Obrazenia bez Testu Przeciwstawnego - +1 Przewagi.
  a.side.pool++;
  return Math.max(1, sp.damage + over - d.f.armour[location(c.roll)]);
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
}

/** Przewaga na start za Zagrozenie [PB 135]: ogr, troll 1 / mantikora, gryf 3 / smok, wielki demon 5 - wg Rozmiaru. */
const THREAT_START = [0, 0, 0, 0, 1, 3, 5];

/** Przewaga na start za liczebnosc [PB 135]: wiecej 1, 2:1 - 2, 3:1 - 3. */
function numbersStart(mine: number, theirs: number): number {
  if (mine <= theirs) return 0;
  return mine >= 3 * theirs ? 3 : mine >= 2 * theirs ? 2 : 1;
}

/**
 * Starcie: strona A (druzyna albo jeden gracz) na stronie B (jedno stworzenie albo kilka).
 * Przewaga Grupowa [PB 133-135]: dwie pule; +1 za wygrany wlasny Test Przeciwstawny; na koniec
 * Rundy strona liczniejsza zabiera 1 punkt (albo dostaje +1); wydawanie: 4 = dodatkowa Akcja,
 * a stworzenie ze Srogim (pula odnawia sie co Ture) wydaje po 2 na +10 do ataku.
 */
export function fight(sideA: Fighter[], sideB: Fighter[], rng: Rng, maxRounds = 30): FightResult {
  const poolA = { pool: 0 };
  const poolB = { pool: 0 };
  const mk = (side: { pool: number }) => (f: Fighter): State => ({ f, hp: f.wounds, broken: 0, fearSl: 0, fearDone: false, channelled: 0, fortune: f.fortune, dealt: 0, taken: 0, side });
  const A = sideA.map(mk(poolA));
  const B = sideB.map(mk(poolB));
  const alive = (xs: State[]) => xs.filter((x) => x.hp > 0);
  poolA.pool = numbersStart(A.length, B.length) + Math.max(0, ...A.map((x) => THREAT_START[x.f.size] ?? 0));
  poolB.pool = numbersStart(B.length, A.length) + Math.max(0, ...B.map((x) => THREAT_START[x.f.size] ?? 0));
  // Groza: Test Opanowania na starcie, porazka = Zlamany (1 + PS porazki rund), potem Strach.
  for (const [side, foes] of [[A, B], [B, A]] as const) {
    const terror = Math.max(0, ...foes.map((x) => x.f.terror));
    for (const s of side) {
      if (terror) {
        const t = test(s.f.cool, rng);
        if (!t.ok) s.broken = 1 + Math.max(0, -t.sl);
      }
    }
  }
  const act = (s: State, foes: State[], bonus: number, gain: boolean) => {
    const targets = alive(foes);
    if (!targets.length) return;
    const target = targets[randInt(0, targets.length - 1, rng)];
    const spell = castMissile(s, target, rng, bonus);
    const dmg = spell ?? melee(s, target, rng, bonus, gain);
    if (dmg > 0) {
      const real = Math.min(dmg, target.hp);
      target.hp -= dmg;
      s.dealt += real;
      target.taken += real;
    }
  };
  let round = 0;
  for (; round < maxRounds && alive(A).length && alive(B).length; round++) {
    for (const s of [...A, ...B]) {
      if (s.f.regenerate && s.hp > 0 && s.hp < s.f.wounds) s.hp = Math.min(s.f.wounds, s.hp + randInt(1, 10, rng));
    }
    const order = [...A, ...B].sort((x, y) => y.f.init - x.f.init);
    for (const s of order) {
      if (s.hp <= 0) continue;
      const foes = A.includes(s) ? B : A;
      if (!alive(foes).length) break;
      // Srogi (X): na poczatku Tury pula strony rosnie do X.
      if (s.f.fierce && s.side.pool < s.f.fierce) s.side.pool = s.f.fierce;
      // Strach (Prog): rozszerzony Test Opanowania co Runde, az PS >= Prog.
      const fear = Math.max(0, ...foes.map((x) => Math.max(x.f.fear, x.f.terror)));
      if (fear && !s.fearDone) {
        const t = test(s.f.cool, rng);
        if (t.ok) s.fearSl += Math.max(0, t.sl) + 1;
        if (s.fearSl >= fear) s.fearDone = true;
      } else if (!fear) s.fearDone = true;
      if (s.broken > 0) {
        const t = test(s.f.cool, rng);
        s.broken = t.ok ? Math.max(0, s.broken - 1 - Math.max(0, t.sl)) : s.broken;
        continue;
      }
      // Dodatkowa Akcja za 4 (raz na Ture, bez Przewagi); Srogi - Dodatkowy wysilek po 2 (+10).
      let extra = false;
      if (s.side.pool >= 4) {
        s.side.pool -= 4;
        extra = true;
      }
      let bonus = 0;
      if (s.f.fierce) {
        while (s.side.pool >= 2) {
          s.side.pool -= 2;
          bonus += 10;
        }
      }
      act(s, foes, bonus, bonus === 0);
      if (extra) act(s, foes, 0, false);
    }
    // Koniec Rundy: strona liczniejsza dominuje - zabiera 1 punkt (albo +1, gdy pula wroga pusta).
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
  return {
    winner: aAlive && !bAlive ? "A" : bAlive && !aAlive ? "B" : "remis",
    rounds: round,
    dealtByB: B.reduce((s, x) => s + x.dealt, 0),
    dealtByA: A.reduce((s, x) => s + x.dealt, 0),
    downedA: A.filter((x) => x.hp <= 0).length
  };
}
