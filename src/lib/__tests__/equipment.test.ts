import { beforeAll, describe, expect, it } from "vitest";
import { seedRng } from "../dice";
import { armourPoints, matchTrapping } from "../equipment";
import * as gd from "../gameData";
import { generateNpc } from "../generator";
import { casterLores } from "../magic";
import { rollMutation } from "../mutations";
import { computeNpc, weaponLabel } from "../npc";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe("bron i pancerz", () => {
  it("rozpoznaje bron i pancerz w wyposazeniu profesji", () => {
    const rng = seedRng(1);
    expect(matchTrapping("broń ręczna (bosak)", rng)).toEqual({ kind: "weapon", names: ["Broń Ręczna"] });
    expect(matchTrapping("kusza z 10 bełtami", rng)).toEqual({ kind: "weapon", names: ["Kusza"] });
    expect(matchTrapping("kaftan kolczy", rng)).toEqual({ kind: "armour", names: ["Kaftan kolczy"] });
    expect(matchTrapping("zbroja płytowa z hełmem", rng)?.names).toContain("Hełm");
    expect(matchTrapping("naramienniki i nagolenniki płytowe", rng)?.names).toEqual(["Naramienniki", "Nagolenniki płytowe"]);
    expect(matchTrapping("młot i gwoździe", rng)).toBeNull();
    expect(matchTrapping("skórzane rękawice", rng)).toBeNull();
  });

  it("warstwy pancerza sumuja sie na lokacjach", () => {
    const ap = armourPoints(["Skórzana kurta", "Kolczuga", "Hełm"]);
    expect(ap).toEqual({ głowa: 2, ręce: 3, korpus: 3, nogi: 0 });
  });

  it("kazdy BN ma bron, a wojownik ma pancerz i redukcje ponad BWt", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Wojownik", tier: "sredni" }, seedRng(seed));
      const v = computeNpc(npc);
      expect(v.weapons.length).toBeGreaterThan(0);
      expect(v.armour.korpus.total).toBeGreaterThan(v.chars.Wt.bonus);
      expect(npc.trappings.some((t) => /kaftan kolczy|broń ręczna/i.test(t))).toBe(false);
    }
  });

  it("obrazenia broni = BS + bron, wartosc testu = umiejetnosc albo WW", () => {
    const npc = generateNpc({ archetype: "Wojownik", tier: "slaby", race: "Człowiek", professions: ["Żołnierz"], deterministic: true }, seedRng(4));
    npc.weapons = ["Broń Ręczna", "Halabarda"];
    const v = computeNpc(npc);
    const sword = v.weapons.find((w) => w.name === "Broń Ręczna")!;
    const halberd = v.weapons.find((w) => w.name === "Halabarda")!;
    expect(sword.damage).toBe(v.chars.S.bonus + 4);
    expect(sword.skill).toBe(v.skills.find((s) => s.name === "Broń Biała (Podstawowa)")!.total);
    expect(halberd.skillName).toBe(v.skills.some((s) => s.name === "Broń Biała (Drzewcowa)") ? "Broń Biała (Drzewcowa)" : "WW");
    expect(weaponLabel(sword)).toMatch(/^Broń Ręczna \(\+\d+\/\d+\)$/);
  });
});

describe("zaklecia", () => {
  it("slaby czarodziej zna tylko Magie Prosta", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Czarodziej", tier: "slaby" }, seedRng(seed));
      const v = computeNpc(npc);
      expect(v.spells.length).toBeGreaterThan(0);
      expect(v.spells.every((s) => s.lore === "Prosta")).toBe(true);
    }
  });

  it("doswiadczony czarodziej ma zaklecia swojej tradycji, w tym jedno z gornej polki", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const npc = generateNpc({ archetype: "Czarodziej", tier: "doswiadczony", race: "Człowiek", professions: ["Piromanta"] }, seedRng(seed));
      const { lores } = casterLores(npc, seedRng(1));
      expect(lores).toContain("Ognia");
      const spells = computeNpc(npc).spells;
      const arcane = spells.filter((s) => s.lore !== "Prosta");
      expect(arcane.length).toBeGreaterThan(0);
      expect(arcane.every((s) => s.cn <= 12)).toBe(true);
      expect(arcane.some((s) => s.lore === "Ognia" && s.cn >= 9)).toBe(true);
    }
  });

  it("wojownik nie czaruje", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(generateNpc({ archetype: "Wojownik" }, seedRng(seed)).spells).toEqual([]);
    }
  });

  it("stworzenie z Rzucaniem Czarow dostaje zaklecia", () => {
    const npc = generateNpc({ creature: "Szaman rykowców", tier: "zaawansowany" }, seedRng(5));
    expect(npc.spells.length).toBeGreaterThan(0);
  });
});

describe("mutacje", () => {
  it("mutacje pochodza z tabel i zmieniaja cechy", () => {
    const m = rollMutation(seedRng(3), "physical");
    expect(gd.getMutations().physical.some((r) => r.name === m.name)).toBe(true);
    const npc = generateNpc({ archetype: "Kupiec", tier: "slaby", deterministic: true }, seedRng(1));
    const before = computeNpc(npc).chars.S.total;
    npc.mutations = [{ kind: "physical", name: "Wychudzone ciało" }];
    expect(computeNpc(npc).chars.S.total).toBe(before - 10);
  });

  it("okolo 1% BN ma mutacje, a stworzenia z cecha Mutacja zawsze", () => {
    let mutated = 0;
    for (let seed = 1; seed <= 2000; seed++) if (generateNpc({ archetype: "Chłop", tier: "slaby" }, seedRng(seed)).mutations.length) mutated++;
    expect(mutated).toBeGreaterThan(5);
    expect(mutated).toBeLessThan(45);
    expect(generateNpc({ creature: "Mutant" }, seedRng(1)).mutations.length).toBeGreaterThan(0);
  });
});
