/** Mutacje (Tabela Spaczenia Fizycznego i Zepsucia Psychicznego z podrecznika). */

import { chance, rollK100, type Rng } from "./dice";
import * as gd from "./gameData";
import type { MutationRow, NpcMutation } from "./types";

export function mutationRow(m: NpcMutation): MutationRow | undefined {
  const table = m.kind === "mental" ? gd.getMutations().mental : gd.getMutations().physical;
  return table.find((r) => r.name === m.name);
}

/** Losuje jedna mutacje (rodzaj losowy wg mentalShare, chyba ze podany). */
export function rollMutation(rng: Rng, kind?: NpcMutation["kind"], exclude: string[] = []): NpcMutation {
  const data = gd.getMutations();
  const k = kind ?? (chance(data.settings.mentalShare, rng) ? "mental" : "physical");
  const table = k === "mental" ? data.mental : data.physical;
  let row: MutationRow | undefined;
  for (let i = 0; i < 20; i++) {
    const roll = rollK100(rng);
    row = table.find((r) => roll >= r.min && roll <= r.max);
    if (row && !exclude.includes(row.name)) break;
  }
  const out: NpcMutation = { kind: k, name: row!.name };
  if (row?.rollLocation) {
    const roll = rollK100(rng);
    out.location = data.locations.find((l) => roll >= l.min && roll <= l.max)?.name;
  }
  return out;
}

/** Mutacje losowe dla BN: szansa z mutations.json (1%) + obowiazkowe z cech stworzenia. */
export function rollNpcMutations(creatureTraits: string[], rng: Rng, deterministic = false): NpcMutation[] {
  const out: NpcMutation[] = [];
  if (creatureTraits.some((t) => /^Mutacja/.test(t))) out.push(rollMutation(rng, "physical"));
  if (creatureTraits.some((t) => /^Spaczenie Umysłu/.test(t))) out.push(rollMutation(rng, "mental"));
  if (!deterministic && chance(gd.getMutations().settings.chance, rng)) {
    out.push(rollMutation(rng, undefined, out.map((m) => m.name)));
  }
  return out;
}

export function mutationLabel(m: NpcMutation): string {
  return m.location ? `${m.name} (${m.location})` : m.name;
}
