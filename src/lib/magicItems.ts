/**
 * Przedmioty magiczne i premie czarodziejow (Wiatry Magii, s. 151-163).
 *
 * - "przedmiot magiczny" w wyposazeniu profesji zamieniany jest na wylosowany
 *   przedmiot pasujacy do tradycji BN (mikstura, zwoj z zakleciem, kostur),
 * - czarodziej z tradycja kolegium: od 2. poziomu kostur jest umagiczniony,
 *   Mistrz Magii (3.) ma zwykle szaty, Arcymag (4.) - wyszukane,
 * - podsumowanie czarowania: Splatanie i Rzucanie z premiami PS oraz zmiana PZ.
 */

import { weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import type { MagicItem, Npc } from "./types";

const norm = (s: string) => s.toLowerCase().trim();

export function findMagicItem(trapping: string): MagicItem | undefined {
  const t = norm(trapping);
  return gd.getMagicItems()?.items.find((i) => i.matches.some((m) => t.includes(norm(m))));
}

function isMagicPlaceholder(trapping: string): boolean {
  const t = norm(trapping);
  return !!gd.getMagicItems()?.magicItemTrappings.some((m) => t === norm(m) || t.startsWith(norm(m)));
}

/** Tradycje czarujacego z jego talentow Magia Tajemna / Magia Chaosu. */
function loresOf(npc: Npc): string[] {
  const out: string[] = [];
  for (const t of npc.talents) {
    const { base, spec } = gd.splitSpec(t.name);
    if ((base === "Magia Tajemna" || base === "Magia Chaosu") && spec) {
      const key = gd.spellLoreKey(spec);
      if (key) out.push(key);
    }
  }
  return out;
}

/** Zwoj: zaklecie tradycji BN (albo wspolne tajemne) o PZ nie wyzszym niz dopuszcza poziom. */
function scrollSpell(npc: Npc, rng: Rng, deterministic: boolean): string | undefined {
  const lores = new Set([...loresOf(npc), "Tajemna"]);
  const maxCn = Math.max(gd.getTier(npc.tier)?.spells.maxCn ?? 6, 4);
  const pool = gd.getSpellsData().spells.filter((s) => lores.has(s.lore) && s.cn <= maxCn && !npc.spells.includes(s.name));
  if (!pool.length) return undefined;
  return deterministic ? pool.sort((a, b) => b.cn - a.cn)[0].name : weightedPick(pool, () => 1, rng)?.name;
}

/** Losuje przedmiot magiczny pasujacy do tradycji BN. */
export function rollMagicItem(npc: Npc, rng: Rng, deterministic = false): string {
  const data = gd.getMagicItems();
  const lores = new Set(loresOf(npc));
  const owned = new Set(npc.trappings.map((t) => findMagicItem(t)?.name));
  // Kostur niesie (i dostaje umagiczniony) kazdy czarodziej - nie losujemy go ponownie.
  if (npc.trappings.some((t) => /kostur/i.test(t))) owned.add("umagiczniony kostur");
  const pool = (data?.items ?? []).filter((i) => i.random && !owned.has(i.name));
  const weight = (i: MagicItem) => (i.random!.weight ?? 1) * (i.random!.lores?.some((l) => lores.has(l)) ? 3 : 1);
  const item = deterministic ? [...pool].sort((a, b) => weight(b) - weight(a))[0] : weightedPick(pool, weight, rng);
  if (!item) return "przedmiot magiczny";
  if (item.scroll) {
    const spell = scrollSpell(npc, rng, deterministic);
    return spell ? `zwój z zaklęciem: ${spell}` : item.name;
  }
  return item.name;
}

/** Zamienia "przedmiot magiczny" na konkretny i podnosi szaty/kostur czarodzieja wg poziomu profesji. */
export function resolveMagicTrappings(npc: Npc, rng: Rng, deterministic = false): void {
  const last = npc.careerPath[npc.careerPath.length - 1];
  const wizard = loresOf(npc).length > 0;
  const level = last?.level ?? 0;
  // Najpierw ulepszenia (kostur, szaty), potem losowanie - inaczej wylosowany kostur
  // pokrywal sie z ulepszonym zwyklym i przedmiot magiczny znikal.
  npc.trappings = npc.trappings.map((t) => {
    if (wizard && level >= 2 && norm(t) === "kostur") return "umagiczniony kostur";
    if (wizard && norm(t) === "praktyczne szaty" && level >= 3) return level >= 4 ? "wyszukane szaty" : "zwykłe szaty";
    return t;
  });
  const mapped = npc.trappings.map((t) => (isMagicPlaceholder(t) ? rollMagicItem(npc, rng, deterministic) : t));
  // Z grupy (szaty) zostaje tylko najlepszy komplet; bez duplikatow.
  const best = new Map<string, string>();
  for (const t of mapped) {
    const item = findMagicItem(t);
    if (!item?.group) continue;
    const cur = best.get(item.group);
    if (!cur || (findMagicItem(cur)?.channelSL ?? 0) < (item.channelSL ?? 0)) best.set(item.group, t);
  }
  npc.trappings = [...new Set(mapped)].filter((t) => {
    const g = findMagicItem(t)?.group;
    return !g || best.get(g) === t;
  });
}

export interface CastingView {
  channel: { name: string; value: number; sl: number; sources: string[] };
  cast: { name: string; value: number; sl: number; sources: string[] };
  cnMod: number;
  cnSources: string[];
  /** Tradycje, do ktorych stosuje sie zmiana PZ (tradycje BN + wspolne tajemne). */
  cnLores: string[];
  lores: { key: string; label: string; rule?: string }[];
}

/** Podsumowanie czarowania: wartosci Testow, premie PS z przedmiotow i talentow, zmiana PZ. */
export function castingSummary(
  npc: Npc,
  skills: { name: string; total: number }[],
  chars: Record<string, { total: number }>
): CastingView | null {
  const spells = npc.spells.map((s) => gd.getSpell(s)).filter(Boolean);
  const loreKeys = [...new Set([...loresOf(npc), ...spells.map((s) => s!.lore).filter((l) => l !== "Tajemna")])];
  if (!spells.length && !loreKeys.length) return null;
  const channelSkill = skills.filter((s) => s.name.startsWith("Splatanie Magii")).sort((a, b) => b.total - a.total)[0];
  const castSkill = skills.find((s) => s.name === "Język (Magiczny)");
  const view: CastingView = {
    channel: { name: channelSkill?.name ?? "Siła Woli", value: channelSkill?.total ?? chars.SW.total, sl: 0, sources: [] },
    cast: { name: castSkill?.name ?? "Inteligencja", value: castSkill?.total ?? chars.Int.total, sl: 0, sources: [] },
    cnMod: 0,
    cnSources: [],
    cnLores: [...loresOf(npc), "Tajemna", ...(npc.talents.some((t) => t.name === "Wysoka Magia") ? ["Wysokiej Magii"] : [])],
    lores: loreKeys
      .filter((k) => !k.startsWith("Prosta"))
      .map((k) => ({ key: k, label: gd.getSpellsData().lores[k]?.label ?? k, rule: gd.getSpellsData().lores[k]?.rule }))
  };
  const data = gd.getMagicItems();
  // Z grupy (szaty) liczy sie tylko najlepszy przedmiot.
  const items = npc.trappings.map(findMagicItem).filter(Boolean) as MagicItem[];
  const counted = items.filter(
    (i, idx) => !i.group || !items.some((o, j) => o.group === i.group && ((o.channelSL ?? 0) > (i.channelSL ?? 0) || ((o.channelSL ?? 0) === (i.channelSL ?? 0) && j < idx)))
  );
  for (const item of counted) {
    if (item.channelSL) (view.channel.sl += item.channelSL), view.channel.sources.push(`+${item.channelSL} ${item.name}`);
    if (item.castSL) (view.cast.sl += item.castSL), view.cast.sources.push(`+${item.castSL} ${item.name}`);
    if (item.cnMod) (view.cnMod += item.cnMod), view.cnSources.push(item.name);
  }
  for (const t of npc.talents) {
    const bonus = data?.talents[gd.resolveTalentKey(t.name) ?? t.name];
    if (!bonus) continue;
    // Premia za kazdy poziom talentu (Zmysl Magii 2 = +2 PS).
    const lvl = Math.max(1, t.level);
    if (bonus.castSL) (view.cast.sl += bonus.castSL * lvl), view.cast.sources.push(`+${bonus.castSL * lvl} ${t.name}${lvl > 1 ? ` ${lvl}` : ""}`);
    if (bonus.channelSL) (view.channel.sl += bonus.channelSL * lvl), view.channel.sources.push(`+${bonus.channelSL * lvl} ${t.name}${lvl > 1 ? ` ${lvl}` : ""}`);
  }
  return view;
}
