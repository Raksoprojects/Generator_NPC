import { beforeAll, describe, expect, it } from "vitest";
import { creatureBase, naturalAttacks } from "../creatures";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import { generateNpc, isBeast } from "../generator";
import { computeNpc } from "../npc";
import { ATTRIBUTES, type Attribute } from "../rules";
import type { CreatureDef, Npc } from "../types";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

/** BN o cechach dokladnie jak w ksiazce (rzut = 10, a dla cech <= 5 rzut = wartosc). */
function bookNpc(c: CreatureDef): Npc {
  const npc = generateNpc({ creature: c.name, tier: "slaby", deterministic: true, randomTraits: false }, seedRng(1));
  for (const code of ATTRIBUTES) {
    const v = c.stats[code];
    const { die } = creatureBase(c, code);
    npc.rolls[code as Attribute] = die === "1k10" ? (v ?? 0) : 10;
  }
  npc.traits = [];
  npc.mutations = [];
  npc.charAdvances = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Npc["charAdvances"];
  return npc;
}

describe("stworzenia z bestiariusza", () => {
  it("baza = wartosc z ksiazki - 10; cecha do 5 to rzut 1k10; brak cechy zostaje brakiem", () => {
    const wolf = gd.getCreature("Wilk")!;
    expect(creatureBase(wolf, "WW")).toEqual({ base: 25, die: "2k10" });
    expect(creatureBase(wolf, "US").die).toBeNull();
    const ameba = gd.getCreature("Ameba")!;
    expect(creatureBase(ameba, "I")).toEqual({ base: 0, die: "1k10" });
  });

  it("cechy z ksiazki odtwarzaja sie przy rzucie 10", () => {
    for (const c of gd.getCreatures()) {
      const v = computeNpc(bookNpc(c));
      for (const code of ATTRIBUTES) {
        const book = c.stats[code];
        if (book == null) expect(v.chars[code].absent, `${c.name} ${code}`).toBe(true);
        else expect(v.chars[code].total, `${c.name} ${code}`).toBe(book);
      }
    }
  });

  it("Zywotnosc liczona ze wzoru Rozmiaru zgadza sie z ksiazka", () => {
    // Hipogryf: Rozmiar (Duży) daje ze wzoru 36, w ksiazce wydrukowano 72 (wartosc dla Wielkiego).
    const bookErrata = new Set(["Hipogryf"]);
    const wrong: string[] = [];
    for (const c of gd.getCreatures().filter((x) => !bookErrata.has(x.name))) {
      const v = computeNpc(bookNpc(c));
      if (v.wounds !== c.stats["Żyw"]) wrong.push(`${c.name}: ${v.wounds} zamiast ${c.stats["Żyw"]}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("naturalna bron przelicza Bonus z Sily z wylosowanych cech", () => {
    const wolf = gd.getCreature("Wilk")!;
    expect(naturalAttacks(wolf)[0]).toMatchObject({ name: "Broń", base: 3, addsSb: true });
    const npc = bookNpc(wolf);
    npc.rolls.S = 20; // S = 45 -> BS 4
    const v = computeNpc(npc);
    expect(v.weapons.find((w) => w.name === "Broń")!.damage).toBe(7);
  });

  it("pancerz stworzenia i BWt daja redukcje na kazdej lokacji", () => {
    const orc = gd.getCreature("Ork")!;
    const v = computeNpc({ ...bookNpc(orc), armour: [] });
    expect(v.armour.korpus.total).toBe(3 + 4);
    expect(v.armour.głowa.total).toBe(7);
  });
});

describe("rozwoj bestii", () => {
  it("bestia nie ma profesji ani profilu bohatera, a premie rosna z poziomem", () => {
    const weak = generateNpc({ creature: "Dziki kot", tier: "slaby", deterministic: true }, seedRng(2));
    const mid = generateNpc({ creature: "Dziki kot", tier: "sredni", deterministic: true }, seedRng(2));
    const top = generateNpc({ creature: "Dziki kot", tier: "doswiadczony", deterministic: true }, seedRng(2));
    expect(isBeast(weak)).toBe(true);
    expect(weak.careerPath).toEqual([]);
    expect(top.heroProfiles).toEqual([]);
    const stealth = (n: Npc) => n.skills.find((s) => s.name === "Skradanie (Wieś)")!.advances;
    // Ksiazka: Skradanie 75 przy Zw 55 = +20. Slaby = ksiazka; sredni max(20, 40 x 0.25) + 3;
    // doswiadczony max(20, 40 x 0.75) + 9.
    expect(stealth(weak)).toBe(20);
    expect(weak.traits).toEqual([]);
    expect(Object.values(weak.charAdvances).every((v) => v === 0)).toBe(true);
    expect(stealth(mid)).toBe(23);
    expect(mid.charAdvances.Zw).toBe(3);
    expect(mid.traits.length).toBe(1);
    expect(stealth(top)).toBe(39);
    expect(top.traits.length).toBe(2);
  });

  it("wyzszy poziom tej samej bestii jest zawsze silniejszy", () => {
    const tiers = ["slaby", "sredni", "zaawansowany", "doswiadczony", "heroiczny"] as const;
    for (const c of gd.getCreatures().filter((x) => !gd.isCivilized(x.name))) {
      let prev: ReturnType<typeof computeNpc> | null = null;
      for (const tier of tiers) {
        const npc = generateNpc({ creature: c.name, tier, deterministic: true, randomTraits: false }, seedRng(5));
        npc.traits = [];
        npc.mutations = [];
        const v = computeNpc(npc);
        if (prev) {
          for (const code of ATTRIBUTES) expect(v.chars[code].total, `${c.name} ${tier} ${code}`).toBeGreaterThanOrEqual(prev.chars[code].total);
          for (const s of prev.skills) {
            expect(v.skills.find((x) => x.name === s.name)!.total, `${c.name} ${tier} ${s.name}`).toBeGreaterThan(s.total);
          }
        }
        prev = v;
      }
    }
  });

  it("stworzenie cywilizowane z archetypem rozwija sie przez profesje", () => {
    const orc = generateNpc({ creature: "Ork", archetype: "Wojownik", tier: "sredni" }, seedRng(3));
    expect(orc.careerPath.length).toBe(2);
    expect(orc.weapons.length).toBeGreaterThan(0);
    expect(gd.isCivilized("Ork")).toBe(true);
    expect(gd.isCivilized("Wilk")).toBe(false);
  });
});
