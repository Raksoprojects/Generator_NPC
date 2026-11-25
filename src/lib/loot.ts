/**
 * Lupy i znaleziska wg lokacji (loot.json, Random Treasure Table z Treasure & Artefacts):
 * pieniadze, kosztownosci z wycena, przedmioty codzienne, bron i pancerze z Wadami
 * oraz przedmioty magiczne z generatora artefaktow. Poziom lokacji (1-5) mnozy wartosci
 * jak Tier w zrodle, a szanse na magie rosna o polowe za kazdy poziom ponad pierwszy.
 */

import { rollArtefact, rollDice, rollOn, type Artefact } from "./artefacts";
import { rollDie, type Rng } from "./dice";
import * as gd from "./gameData";
import type { LootData, LootLocation, TableRow } from "./types";

export interface LootItem {
  name: string;
  /** Wartosc w monetach Statusu lokacji ("14 s"). */
  value?: string;
  note?: string;
}

export interface LootSection {
  label: string;
  items: LootItem[];
}

export interface LootResult {
  location: LootLocation;
  level: number;
  levelLabel: string;
  money: { p: number; s: number; zk: number };
  sections: LootSection[];
  artefacts: Artefact[];
  /** Laczna wartosc pieniedzy i wycenionych kosztownosci w pensach. */
  totalPence: number;
}

export interface LootOptions {
  location?: string;
  /** Grupa lokacji (gdy brak konkretnej). */
  group?: string;
  level?: number;
  money?: boolean;
  valuables?: boolean;
  goods?: boolean;
  magic?: boolean;
  allowCursed?: boolean;
}

const data = (): LootData => {
  const d = gd.getLoot();
  if (!d) throw new Error("Brak danych loot.json.");
  return d;
};

const PENCE = { p: 1, s: 12, zk: 240 } as const;
const COIN_LABEL = { p: "p", s: "s", zk: "zk" } as const;

/** k10 i k100 wybuchaja: maksimum - rzuc jeszcze raz i dodaj (Treasure & Artefacts). */
function explodingDice(text: string, rng: Rng): number {
  const m = /^(\d*)k(\d+)$/.exec(text.trim());
  if (!m) return rollDice(text, rng);
  const sides = Number(m[2]);
  const explode = sides === 10 || sides === 100;
  let sum = 0;
  for (let i = 0; i < Number(m[1] || 1); i++) {
    let r = rollDie(sides, rng);
    sum += r;
    for (let guard = 0; explode && r === sides && guard < 5; guard++) {
      r = rollDie(sides, rng);
      sum += r;
    }
  }
  return sum;
}

/** "25:1k10" - 25% szans na 1k10; "1k10" - zawsze; null - nic. */
function chanceAmount(spec: string | null, rng: Rng, chanceMult = 1): number {
  if (!spec) return 0;
  const [a, b] = spec.includes(":") ? spec.split(":") : ["100", spec];
  const p = Math.min(100, Number(a) * chanceMult);
  if (rng() * 100 >= p) return 0;
  return /k/.test(b) ? explodingDice(b, rng) : Number(b);
}

export function lootLocations(): LootLocation[] {
  return data().locations;
}

export function lootLevels() {
  return data().levels;
}

function coinText(amount: number, coin: "p" | "s" | "zk"): string {
  return `${amount} ${COIN_LABEL[coin]}`;
}

function rowsFor(table: string, status: string): TableRow[] {
  const t = data().tables[table];
  return t?.rows ?? t?.byStatus?.[status] ?? [];
}

/**
 * Jakosc zwyklego przedmiotu wg Statusu i poziomu lokacji [dom]: Braz - polowa z Wada Brzydki,
 * Srebro - od poziomu 4 Wyśmienity, Zloto - Wyśmienity tyle razy, ile polowa poziomu (w gore).
 * Cena wg PG s. 292-293: kazda Zaleta x2, kazda Wada x1/2.
 */
function rollQuality(loc: LootLocation, level: number, rng: Rng): number {
  if (loc.status === "złoto") return Math.ceil(level / 2);
  if (loc.status === "srebro") return level >= 4 ? 1 : 0;
  return rng() < 0.5 ? -1 : 0;
}

function qualityNote(q: number): string | undefined {
  if (q < 0) return q === -1 ? "Brzydki" : `Wady: ${-q}`;
  if (q > 0) return q === 1 ? "Wyśmienity" : `Wyśmienity (${q}×)`;
  return undefined;
}

/** Cena z listy PG razy zestaw i jakosc; null, gdy PG nie podaje ceny. */
function listPrice(name: string, q: number): number | null {
  const e = data().prices?.items[name];
  if (!e) return null;
  return Math.max(1, Math.round(e.p * (e.qty ?? 1) * 2 ** (q + (e.q ?? 0))));
}

/** Grupuje te same rzeczy: "diament ×3 (96 zk)". */
function grouped(list: { name: string; pence?: number; coin?: number; note?: string }[], coin: "p" | "s" | "zk"): LootItem[] {
  const by = new Map<string, { name: string; n: number; pence: number; coin: number; note?: string; priced: boolean }>();
  for (const x of list) {
    const key = `${x.name}|${x.note ?? ""}`;
    const cur = by.get(key) ?? { name: x.name, n: 0, pence: 0, coin: 0, note: x.note, priced: false };
    cur.n++;
    cur.pence += x.pence ?? 0;
    cur.coin += x.coin ?? 0;
    cur.priced ||= x.pence !== undefined || x.coin !== undefined;
    by.set(key, cur);
  }
  return [...by.values()].map((g) => ({
    name: g.n > 1 ? `${g.name} ×${g.n}` : g.name,
    value: !g.priced ? undefined : g.coin ? coinText(g.coin, coin) : formatPence(g.pence),
    note: g.note
  }));
}

function valued(table: string, count: number, loc: LootLocation, level: number, rng: Rng): { items: LootItem[]; pence: number } {
  const t = data().tables[table];
  const coin = data().coinByStatus[loc.status] ?? "s";
  const list: { name: string; pence?: number; coin?: number; note?: string }[] = [];
  let pence = 0;
  for (let i = 0; i < count; i++) {
    const row = rollOn(rowsFor(table, loc.status), rng);
    // Zwykle przedmioty z cena w PG: cena z listy i jakosc; kosztownosci i reszta - kosci w monecie Statusu x poziom.
    const q = rollQuality(loc, level, rng);
    const lp = listPrice(row.name, q);
    if (lp !== null) {
      pence += lp;
      list.push({ name: row.name, pence: lp, note: qualityNote(q) });
      continue;
    }
    const value = t.valueDice ? rollDice(t.valueDice, rng) * level : 0;
    pence += value * PENCE[coin];
    list.push({ name: row.name, coin: value || undefined });
  }
  return { items: grouped(list, coin), pence };
}

/** Bron i pancerz z pobojowiska albo obozu: czesc ma Wady (Treasure & Artefacts, s. 3). */
function gear(kind: "bron" | "pancerz", count: number, rng: Rng): { items: LootItem[]; pence: number } {
  const w = gd.getWeapons();
  const names = kind === "bron" ? [...Object.keys(w.melee), ...Object.keys(w.ranged)].filter((n) => !/Pięści|improwizowana|Krasnoludzk|Hoetha|Wirujące|pistolet|Rusznica|Arkebuz|Garłacz|Muszkiet|Moździerz|Pieprzniczka|Gryfia|Płaszcz|Garota|Arkan|sieć|Kamień|Bolas|Bicz/i.test(n)) : Object.keys(w.armour);
  const flaws = kind === "bron" ? data().weaponFlaws : data().armourFlaws;
  const items: LootItem[] = [];
  let pence = 0;
  for (let i = 0; i < count; i++) {
    const name = names[Math.floor(rng() * names.length)];
    const got: string[] = [];
    // Polowa lupow z ciał jest zaniedbana albo uszkodzona.
    for (let n = rng() < 0.5 ? 1 : 0, guard = 0; n > 0 && guard < 4; n--, guard++) {
      const f = rollOn(flaws, rng);
      if (f.name === "rzuć dwa razy") n += 2;
      else if (!got.includes(f.name)) got.push(f.name);
    }
    // Cena z listy PG, kazda Wada x1/2 (PG s. 293).
    const e = data().prices?.gear[name];
    const p = e ? Math.max(1, Math.round(e.p / 2 ** got.length)) : undefined;
    pence += p ?? 0;
    items.push({ name, value: p !== undefined ? formatPence(p) : undefined, note: got.length ? got.join(", ") : undefined });
  }
  return { items, pence };
}

export function rollLoot(opts: LootOptions = {}, rng: Rng = Math.random): LootResult {
  const d = data();
  const pool = d.locations.filter((l) => !opts.group || l.group === opts.group);
  const location = d.locations.find((l) => l.id === opts.location) ?? pool[Math.floor(rng() * pool.length)] ?? d.locations[0];
  // Bez wybranego poziomu czesciej trafiaja sie skromne miejsca.
  const level = opts.level ?? [1, 1, 1, 2, 2, 2, 3, 3, 4, 5][rollDie(10, rng) - 1];
  const magicMult = 1 + (level - 1) * 0.5;
  const want = (k: keyof LootOptions) => opts[k] !== false;

  const money = { p: 0, s: 0, zk: 0 };
  if (want("money")) {
    money.p = chanceAmount(location.money.p, rng) * level;
    money.s = chanceAmount(location.money.s, rng) * level;
    money.zk = chanceAmount(location.money.zk, rng) * level;
  }
  let totalPence = money.p + money.s * 12 + money.zk * 240;
  const sections: LootSection[] = [];
  const addSection = (label: string, items: LootItem[]) => items.length && sections.push({ label, items });

  if (want("valuables")) {
    for (const [field, table] of [["domestic", "domowe"], ["gems", "kamienie"], ["art", "sztuka"], ["cloth", "tkaniny"]] as const) {
      const n = chanceAmount(location[field], rng);
      if (!n) continue;
      // Kamienie i bizuteria: 1-5 kamien, 6-10 wyrob jubilerski.
      if (table === "kamienie") {
        let stones = 0;
        for (let i = 0; i < n; i++) if (rollDie(10, rng) <= 5) stones++;
        const a = valued("kamienie", stones, location, level, rng);
        const b = valued("bizuteria", n - stones, location, level, rng);
        totalPence += a.pence + b.pence;
        addSection("Kamienie szlachetne i biżuteria", [...a.items, ...b.items]);
        continue;
      }
      const v = valued(table, n, location, level, rng);
      totalPence += v.pence;
      addSection(d.tables[table].label, v.items);
    }
  }

  if (want("goods")) {
    for (const [table, spec] of location.extra) {
      const n = chanceAmount(spec, rng);
      if (!n) continue;
      if (table === "bron" || table === "pancerz") {
        const g = gear(table, n, rng);
        totalPence += g.pence;
        addSection(table === "bron" ? "Broń" : "Pancerze", g.items);
        continue;
      }
      const v = valued(table, n, location, level, rng);
      totalPence += v.pence;
      addSection(d.tables[table]?.label ?? table, v.items);
    }
  }

  const artefacts: Artefact[] = [];
  if (want("magic")) {
    const allowCursed = opts.allowCursed;
    const scrolls = chanceAmount(location.scrolls, rng, magicMult);
    for (let i = 0; i < scrolls; i++) artefacts.push(rollArtefact({ category: "zwoje", allowCursed }, rng));
    const grimoires = chanceAmount(location.grimoire, rng, magicMult);
    for (let i = 0; i < grimoires; i++) artefacts.push(rollArtefact({ category: "ksiegi", item: "Grimuar" }, rng));
    const random = chanceAmount(location.magic, rng, magicMult);
    for (let i = 0; i < random; i++) artefacts.push(rollArtefact({ allowCursed }, rng));
  }

  return {
    location,
    level,
    levelLabel: d.levels.find((l) => l.level === level)?.label ?? String(level),
    money,
    sections,
    artefacts,
    totalPence
  };
}

/** Pensy -> "3 zk 4 s 2 p". */
export function formatPence(pence: number): string {
  const zk = Math.floor(pence / 240);
  const s = Math.floor((pence % 240) / 12);
  const p = pence % 12;
  return [zk && `${zk} zk`, s && `${s} s`, p && `${p} p`].filter(Boolean).join(" ") || "0 p";
}

export function lootToText(r: LootResult): string {
  const lines = [`${r.location.name} (poziom ${r.level}: ${r.levelLabel})`];
  const coins = [r.money.zk && `${r.money.zk} zk`, r.money.s && `${r.money.s} s`, r.money.p && `${r.money.p} p`].filter(Boolean).join(", ");
  if (coins) lines.push(`Pieniądze: ${coins}`);
  for (const s of r.sections) lines.push(`${s.label}: ${s.items.map((i) => `${i.name}${i.value ? ` (${i.value})` : ""}${i.note ? ` [${i.note}]` : ""}`).join("; ")}`);
  for (const a of r.artefacts) lines.push(`Przedmiot magiczny: ${a.name} (${a.categoryName})`);
  lines.push(`Łączna wartość (pieniądze i wycenione przedmioty): ${formatPence(r.totalPence)}`);
  return lines.join("\n");
}
