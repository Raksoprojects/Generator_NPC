/**
 * Dobor zaklec dla BN czarujacych.
 *
 * - Magia Prosta: okolo Bonusu z Siły Woli zaklec (±1).
 * - Tradycja tajemna: Bonus z Inteligencji + odchylenie zalezne od poziomu BN
 *   (tiers.json -> spells.arcane), z PZ nie wyzszym niz spells.maxCn.
 *   Zawsze co najmniej jedno zaklecie z gornej polki dostepnej dla poziomu.
 * - Poczatkujacy (maxCn = 0) znaja tylko Magie Prosta.
 */

import { pick, randInt, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import { computeNpc } from "./npc";
import type { Npc, SpellDef } from "./types";

const CHAOS_LORES = ["Nurgla", "Slaanesha", "Tzeentcha"];
const COLLEGE_LORES = ["Ognia", "Metalu", "Życia", "Niebios", "Cieni", "Śmierci", "Światła", "Zwierząt"];

/** Tradycja z opisu cechy "Rzucanie Czarów (…)" - moze zawierac alternatywy. */
function loreFromTrait(spec: string, rng: Rng): string | undefined {
  const s = spec.toLowerCase();
  if (/dowoln|różne/.test(s) && !s.includes("chaos")) return pick(COLLEGE_LORES, rng);
  const options = spec
    .split(/\s*,\s*|\s+albo\s+|\s+lub\s+/)
    .map((o) => o.replace(/dowolna tradycja|tradycji|tradycja/gi, "").trim())
    .filter(Boolean);
  const resolved: string[] = [];
  for (const o of options) {
    if (/chaos/i.test(o)) resolved.push(pick(CHAOS_LORES, rng) ?? "Tzeentcha");
    else if (/nekromanc/i.test(o)) resolved.push("Nekromancji");
    else if (/demonolog/i.test(o)) resolved.push("Demonologii");
    else if (/nurgl/i.test(o)) resolved.push("Nurgla");
    else if (/slaanesh/i.test(o)) resolved.push("Slaanesha");
    else if (/tzeentch/i.test(o)) resolved.push("Tzeentcha");
    else {
      const key = gd.spellLoreKey(o);
      if (key) resolved.push(key);
    }
  }
  return pick(resolved, rng);
}

/** Czy BN czaruje i z jakich tradycji (z talentow oraz cech stworzenia). */
export function casterLores(npc: Npc, rng: Rng): { petty: boolean; lores: string[] } {
  let petty = false;
  const lores = new Set<string>();
  for (const t of npc.talents) {
    const { base, spec } = gd.splitSpec(t.name);
    if (base === "Magia Prosta") petty = true;
    if ((base === "Magia Tajemna" || base === "Magia Chaosu") && spec) {
      const key = base === "Magia Chaosu" ? loreFromTrait(spec, rng) : gd.spellLoreKey(spec) ?? loreFromTrait(spec, rng);
      if (key) lores.add(key);
    }
  }
  const creature = gd.getCreature(npc.creature);
  for (const tr of [...(creature?.traits ?? []), ...npc.traits]) {
    const m = /^Rzucanie Czarów \((.+)\)$/.exec(tr);
    if (!m) continue;
    petty = true;
    const key = loreFromTrait(m[1], rng);
    if (key) lores.add(key);
  }
  return { petty, lores: [...lores] };
}

/** Bonusy z Siły Woli i Inteligencji z pelnych wartosci BN (z profilem bohatera i cechami). */
function bonuses(npc: Npc): { wp: number; int: number } {
  const v = computeNpc(npc);
  return { wp: v.chars.SW.bonus, int: v.chars.Int.bonus };
}

/** Wybiera zaklecia dla BN (nazwy z spells.json). */
export function pickSpells(npc: Npc, rng: Rng, deterministic = false): string[] {
  const { petty, lores } = casterLores(npc, rng);
  if (!petty && !lores.length) return [];
  const tier = gd.getTier(npc.tier);
  const all = gd.getSpellsData().spells;
  const { wp, int } = bonuses(npc);
  const out: string[] = [];

  const pettyPool = all.filter((s) => s.lore === "Prosta");
  const pettyCount = Math.max(1, wp + (deterministic ? 0 : randInt(-1, 1, rng)));
  out.push(...drawSpells(pettyPool, pettyCount, () => 1, rng, deterministic).map((s) => s.name));

  const maxCn = tier?.spells.maxCn ?? 0;
  if (!lores.length || maxCn <= 0) return out;

  const loreSet = new Set(lores);
  const arcanePool = all.filter(
    (s) => s.lore !== "Prosta" && (loreSet.has(s.lore) || s.lore === "Tajemna") && s.cn <= maxCn && !out.includes(s.name)
  );
  if (!arcanePool.length) return out;
  const [lo, hi] = tier?.spells.arcane ?? [0, 0];
  let count = Math.max(1, int + (deterministic ? Math.round((lo + hi) / 2) : randInt(lo, hi, rng)));
  count = Math.min(count, arcanePool.length);

  // Jedno zaklecie z gornej polki (najwyzsze PZ osiagalne na tym poziomie).
  const topCn = Math.max(...arcanePool.map((s) => s.cn));
  const topPool = arcanePool.filter((s) => s.cn >= Math.max(1, topCn - 3) && loreSet.has(s.lore));
  const top = drawSpells(topPool.length ? topPool : arcanePool, 1, (s) => s.cn, rng, deterministic);
  out.push(...top.map((s) => s.name));

  const rest = arcanePool.filter((s) => !out.includes(s.name));
  const weight = (s: SpellDef) => (loreSet.has(s.lore) ? 3 : 1);
  out.push(...drawSpells(rest, count - 1, weight, rng, deterministic).map((s) => s.name));
  return out;
}

function drawSpells(pool: SpellDef[], count: number, weight: (s: SpellDef) => number, rng: Rng, deterministic: boolean): SpellDef[] {
  const left = [...pool];
  const out: SpellDef[] = [];
  for (let i = 0; i < count && left.length; i++) {
    const s = deterministic ? [...left].sort((a, b) => weight(b) - weight(a) || b.cn - a.cn)[0] : weightedPick(left, weight, rng);
    if (!s) break;
    out.push(s);
    left.splice(left.indexOf(s), 1);
  }
  return out;
}
