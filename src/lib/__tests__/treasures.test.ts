import { beforeAll, describe, expect, it } from "vitest";
import { seedRng } from "../dice";
import { allArmourNames, allWeaponNames, getArmourDef, getWeaponDef, qualityDescription } from "../equipment";
import * as gd from "../gameData";
import { generateNpc } from "../generator";
import { computeNpc } from "../npc";
import { craftDescription, findRune, rollTreasures } from "../treasures";
import type { Npc, TierId } from "../types";
import { loadTestGameData } from "./loadData";

beforeAll(loadTestGameData);

const magicCount = (spec: Parameters<typeof generateNpc>[0], n = 200) => {
  let items = 0;
  let npcs = 0;
  for (let seed = 1; seed <= n; seed++) {
    const npc = generateNpc(spec, seedRng(seed));
    items += npc.magicItems?.length ?? 0;
    if (npc.magicItems?.length) npcs++;
  }
  return { items, npcs };
};

describe("przedmioty magiczne", () => {
  it("szanse rosna z poziomem; legendarny ma co najmniej dwa, bestie zadnego", () => {
    const tiers: TierId[] = ["sredni", "zaawansowany", "doswiadczony", "heroiczny"];
    const counts = tiers.map((tier) => magicCount({ archetype: "Wojownik", tier, race: "Człowiek" }).npcs);
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeLessThan(10);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeGreaterThan(60);
    for (let seed = 1; seed <= 30; seed++) {
      const legend = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Człowiek" }, seedRng(seed));
      expect(legend.magicItems!.length).toBeGreaterThanOrEqual(2);
      const dragon = generateNpc({ creature: "Smok", tier: "legendarny" }, seedRng(seed));
      expect(dragon.magicItems ?? []).toEqual([]);
    }
  });

  it("przedmioty pasuja do istoty: krasnoludy runy, sludzy Chaosu Bron Chaosu, gobliny swoje", () => {
    const templates = (spec: Parameters<typeof generateNpc>[0]) => {
      const out = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) for (const m of generateNpc(spec, seedRng(seed)).magicItems ?? []) out.add(m.template);
      return out;
    };
    const dwarf = templates({ archetype: "Wojownik", tier: "heroiczny", race: "Krasnolud" });
    expect([...dwarf].some((t) => t.startsWith("Runiczn"))).toBe(true);
    const chosen = templates({ creature: "Wybraniec Chaosu", tier: "legendarny" });
    expect(chosen.has("Broń Chaosu") || chosen.has("Broń demoniczna")).toBe(true);
    expect(chosen.has("Runiczna broń")).toBe(false);
    const goblin = templates({ creature: "Goblin", tier: "legendarny" });
    expect([...goblin].some((t) => ["Fetysz szamana", "Zaklęty rębacz"].includes(t))).toBe(true);
    expect(goblin.has("Pióro Płomiennego Feniksa")).toBe(false);
  });

  it("runy: najwyzej trzy, jedna mistrzowska; Runa Rozłupywania dodaje Obrażenia", () => {
    for (let seed = 1; seed <= 80; seed++) {
      const d = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Krasnolud" }, seedRng(seed));
      for (const m of d.magicItems ?? []) {
        if (!m.runes) continue;
        expect(m.runes.length).toBeLessThanOrEqual(3);
        expect(m.runes.filter((r) => findRune(r)?.master).length).toBeLessThanOrEqual(1);
      }
    }
    const npc: Npc = generateNpc({ archetype: "Wojownik", tier: "sredni", race: "Krasnolud", deterministic: true }, seedRng(1));
    const weapon = npc.weapons.find((w) => !getWeaponDef(w)?.ranged && !getWeaponDef(w)?.def.shield)!;
    const before = computeNpc(npc).weapons.find((w) => w.name === weapon)!.damage!;
    npc.magicItems = [{ template: "Runiczna broń", name: "runiczny", base: weapon, runes: ["Runa Rozłupywania", "Runa Rozłupywania"] }];
    expect(computeNpc(npc).weapons.find((w) => w.name === weapon)!.damage).toBe(before + 2);
  });

  it("szablony odwoluja sie do istniejacych ras, grup, broni i umiejetnosci", () => {
    const groups = new Set(gd.creatureGroupTree().flatMap((g) => [g.group, ...g.subgroups.map((s) => `${g.group}${gd.GROUP_SEP}${s}`)]));
    const lores = new Set(Object.keys(gd.getSpellsData().lores));
    for (const t of gd.getTreasures()!.items) {
      for (const r of t.forRaces ?? []) expect(gd.getRace(r), `${t.name}: ${r}`).toBeTruthy();
      for (const g of t.forGroups ?? []) expect(groups.has(g), `${t.name}: ${g}`).toBe(true);
      for (const l of t.forLores ?? []) expect(lores.has(l), `${t.name}: ${l}`).toBe(true);
      if (t.replaces) expect(getWeaponDef(t.replaces) || getArmourDef(t.replaces), `${t.name}: ${t.replaces}`).toBeTruthy();
      expect(t.description.length, t.name).toBeGreaterThan(20);
    }
    // Losowanie nie wywraca sie dla zadnego poziomu.
    const npc = generateNpc({ archetype: "Czarodziej", tier: "legendarny", race: "Wysoki elf" }, seedRng(2));
    rollTreasures(npc, seedRng(3));
    expect(npc.magicItems!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("jakosc wykonania", () => {
  it("slabe gobliny czesto maja Wady, elfy zawsze Wytrzymały i Wyśmienity", () => {
    let flawed = 0;
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const g = generateNpc({ creature: "Goblin", archetype: "Wojownik", tier: "slaby" }, seedRng(seed));
      for (const w of g.weapons) {
        total++;
        if (g.craft?.[w]?.flaws.length) flawed++;
      }
      const elf = generateNpc({ archetype: "Wojownik", tier: "sredni", race: "Wysoki elf" }, seedRng(seed));
      for (const w of elf.weapons) {
        const q = elf.craft?.[w]?.qualities ?? [];
        expect(q.some((x) => x.startsWith("Wytrzymały")) && q.some((x) => x.startsWith("Wyśmienity")), `${w}: ${q}`).toBe(true);
        expect(elf.craft?.[w]?.flaws ?? []).toEqual([]);
      }
    }
    expect(flawed / total).toBeGreaterThan(0.35);
  });

  it("heroiczne krasnoludy nosza czasem gromril (+1 PP na plytach)", () => {
    let gromril = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const d = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Krasnolud" }, seedRng(seed));
      const plate = d.armour.find((a) => getArmourDef(a)?.type === "Płytowy" && d.craft?.[a]?.material === "gromril");
      if (!plate) continue;
      gromril++;
      const piece = computeNpc(d).armourPieces.find((p) => p.name === plate)!;
      expect(piece.ap).toBeGreaterThanOrEqual(getArmourDef(plate)!.ap + 1);
    }
    expect(gromril).toBeGreaterThan(10);
  });

  it("kazda Zaleta i Wada broni, pancerza i wykonania ma opis", () => {
    const names = new Set<string>();
    for (const w of allWeaponNames()) {
      const d = getWeaponDef(w)!.def;
      for (const q of [...d.qualities, ...(d.flaws ?? [])]) for (const part of q.split(" albo ")) names.add(part);
    }
    for (const a of allArmourNames()) for (const q of getArmourDef(a)!.qualities) names.add(q);
    const craft = gd.getTreasures()!.craft;
    for (const q of [...Object.keys(craft.qualities), ...Object.keys(craft.flaws)]) names.add(q);
    for (const n of names) expect(craftDescription(n) || qualityDescription(n), n).toBeTruthy();
  });
});
