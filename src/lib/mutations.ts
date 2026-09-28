/**
 * Mutacje: tabele Mutant's Handbook (wg powagi) albo Tabela Spaczenia Fizycznego
 * i Zepsucia Psychicznego z podrecznika - wybor w mutations.json (settings.source).
 */

import { chance, rollDie, rollK100, type Rng } from "./dice";
import * as gd from "./gameData";
import type { MutationRow, MutationSeverity, MutationValue, Npc, NpcMutation } from "./types";

type Kind = NpcMutation["kind"];

export function mutationTable(kind: Kind, table?: MutationSeverity): MutationRow[] {
  const data = gd.getMutations();
  if (kind === "gift") return data.chaosGifts?.rows ?? [];
  if (kind === "bloodline") return gd.getVampires()?.bloodlines ?? [];
  if (kind === "blood") return gd.getVampires()?.gifts ?? [];
  if (kind === "weakness") return gd.getVampires()?.weaknesses ?? [];
  if (table) return data.handbook?.[kind]?.[table] ?? [];
  return kind === "mental" ? data.mental : data.physical;
}

export function mutationRow(m: NpcMutation): MutationRow | undefined {
  return mutationTable(m.kind, m.table).find((r) => r.name === m.name);
}

export function usesHandbook(): boolean {
  const data = gd.getMutations();
  return (data.settings.source ?? "handbook") === "handbook" && !!data.handbook;
}

/** "k10" / "-2k10" / 5 -> liczba (kosci rzucane). */
function rollValue(v: MutationValue, rng: Rng): number {
  if (typeof v === "number") return v;
  const m = /^(-?)(\d*)k(\d+)$/.exec(v.trim());
  if (!m) return Number(v) || 0;
  let sum = 0;
  for (let i = 0; i < (+m[2] || 1); i++) sum += rollDie(+m[3], rng);
  return m[1] ? -sum : sum;
}

/** Srednia wartosc - gdy mutacja nie ma zapisanego rzutu (dodana starsza wersja). */
function averageValue(v: MutationValue): number {
  if (typeof v === "number") return v;
  const m = /^(-?)(\d*)k(\d+)$/.exec(v.trim());
  if (!m) return Number(v) || 0;
  const avg = Math.round(((+m[2] || 1) * (+m[3] + 1)) / 2);
  return m[1] ? -avg : avg;
}

/** Rzuca kosci z modyfikatorow wiersza i zapisuje wyniki. */
export function rollMutationDice(row: MutationRow, rng: Rng): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row.modifiers ?? {})) if (typeof v === "string") out[k] = rollValue(v, rng);
  for (const [k, v] of Object.entries(row.skills ?? {})) if (typeof v === "string") out[`skill:${k}`] = rollValue(v, rng);
  return Object.keys(out).length ? out : undefined;
}

/** Modyfikatory cech i umiejetnosci mutacji z rozstrzygnietymi kosciami. */
export function mutationEffects(m: NpcMutation, row = mutationRow(m)) {
  const value = (key: string, v: MutationValue) => m.rolled?.[key] ?? averageValue(v);
  const chars: Record<string, number> = {};
  const skills: Record<string, number> = {};
  for (const [k, v] of Object.entries(row?.modifiers ?? {})) if (v != null) chars[k] = value(k, v);
  for (const [k, v] of Object.entries(row?.skills ?? {})) skills[k] = value(`skill:${k}`, v);
  return { chars, skills };
}

function pickRow(table: MutationRow[], rng: Rng, exclude: string[]): MutationRow | undefined {
  let row: MutationRow | undefined;
  for (let i = 0; i < 20; i++) {
    const roll = rollK100(rng);
    row = table.find((r) => roll >= r.min && roll <= r.max);
    if (row && !row.reroll && !exclude.includes(row.name)) break;
  }
  return row;
}

export function rollLocation(rng: Rng): string | undefined {
  const roll = rollK100(rng);
  return gd.getMutations().locations.find((l) => roll >= l.min && roll <= l.max)?.name;
}

/** Tabela Mutant's Handbook: k100 + premia za posiadane mutacje. */
export function rollSeverity(rng: Rng, owned = 0): MutationSeverity {
  const s = gd.getMutations().settings;
  const bonus = Math.min(owned * (s.severityPerMutation ?? 10), s.severityMaxBonus ?? 40);
  const roll = rollK100(rng) + bonus;
  const bands = s.severity ?? [];
  return bands.find((b) => roll >= b.min && roll <= b.max)?.table ?? bands[bands.length - 1]?.table ?? "trivial";
}

/** Losuje jedna mutacje (rodzaj losowy wg mentalShare, chyba ze podany). */
export function rollMutation(rng: Rng, kind?: Kind, exclude: string[] = [], owned = 0): NpcMutation {
  const data = gd.getMutations();
  const k = kind ?? (chance(data.settings.mentalShare, rng) ? "mental" : "physical");
  let table: MutationSeverity | undefined = usesHandbook() ? rollSeverity(rng, owned) : undefined;
  let row = pickRow(mutationTable(k, table), rng, exclude);
  // "Rzuc na tabele ..." - przejscie na wyzsza tabele.
  for (let i = 0; row?.reroll && i < 3; i++) {
    table = row.reroll;
    row = pickRow(mutationTable(k, table), rng, exclude);
  }
  const out: NpcMutation = { kind: k, name: row!.name };
  if (table) out.table = table;
  if (row?.rollLocation) out.location = rollLocation(rng);
  const rolled = row ? rollMutationDice(row, rng) : undefined;
  if (rolled) out.rolled = rolled;
  return out;
}

/** Mutacje losowe dla BN: szansa z mutations.json (1%) + obowiazkowe z cech stworzenia. */
export function rollNpcMutations(creatureTraits: string[], rng: Rng, deterministic = false): NpcMutation[] {
  const out: NpcMutation[] = [];
  const add = (kind?: Kind) => out.push(rollMutation(rng, kind, out.map((m) => m.name), out.length));
  if (creatureTraits.some((t) => /^Mutacja/.test(t))) add("physical");
  if (creatureTraits.some((t) => /^Spaczenie Umysłu/.test(t))) add("mental");
  if (!deterministic && chance(gd.getMutations().settings.chance, rng)) add();
  return out;
}

/**
 * Dary Chaosu (tabela Oka Bogow, k10) dla slug Chaosu wg grup z mutations.json:
 * kazda liczba w chances[poziom] to szansa na kolejny dar; dary sie nie powtarzaja.
 */
export function rollChaosGifts(npc: Pick<Npc, "creature" | "tier" | "talents">, rng: Rng, deterministic = false): NpcMutation[] {
  const cfg = gd.getMutations().chaosGifts;
  if (!cfg || deterministic) return [];
  const group = Object.values(cfg.groups).find(
    (g) =>
      (npc.creature && g.creatures?.includes(npc.creature)) ||
      g.talents?.some((t) => npc.talents.some((x) => x.name.startsWith(t)))
  );
  const out: NpcMutation[] = [];
  for (const p of group?.chances[npc.tier] ?? []) {
    if (!chance(p, rng)) break;
    const free = cfg.rows.filter((r) => !out.some((m) => m.name === r.name));
    const roll = rollDie(10, rng);
    const row = free.find((r) => roll >= r.min && roll <= r.max) ?? free[roll % Math.max(1, free.length)];
    if (row) out.push({ kind: "gift", name: row.name });
  }
  return out;
}

/** Ikona wpisu: mutacja, Dar Chaosu, Linia Krwi, Dar Krwi, Slabosc. */
export function mutationIcon(kind: Kind): string {
  return { gift: "✴", bloodline: "🦇", blood: "🩸", weakness: "⚠" }[kind as string] ?? "☣";
}

export function mutationLabel(m: NpcMutation): string {
  return m.location ? `${m.name} (${m.location})` : m.name;
}

/** Opis efektu z wynikami kosci, np. "Zwinność −1k10 [−7]". */
export function mutationEffectText(m: NpcMutation, row = mutationRow(m)): string {
  const effect = row?.effect ?? "";
  const rolled = Object.entries(m.rolled ?? {});
  if (!rolled.length) return effect;
  const parts = rolled.map(([k, v]) => `${k.replace(/^skill:/, "")} ${v >= 0 ? "+" : "−"}${Math.abs(v)}`);
  return `${effect} [rzut: ${parts.join(", ")}]`;
}
