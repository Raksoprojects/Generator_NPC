import { beforeAll, describe, expect, it } from "vitest";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import {
  COMMANDER_PROFILE,
  generateNpc,
  levelCharacteristics,
  rebuildDevelopment,
  rerollNpc,
  resolveSpecName,
  rollMoney,
  traitCountForRoll
} from "../generator";
import { computeNpc, npcToText, shapedHeroModifiers } from "../npc";
import { ATTRIBUTES } from "../rules";
import { TIER_IDS, type TierId } from "../types";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

function maxLevel(npc: ReturnType<typeof generateNpc>): number {
  return Math.max(...npc.careerPath.map((s) => s.level));
}

describe("rzuty na cechy", () => {
  it("kluczowe cechy archetypu nigdy nie spadaja ponizej minimum", () => {
    const min = gd.getSettings().minKeyRoll;
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Wojownik" }, seedRng(seed));
      for (const code of gd.getArchetype("Wojownik")!.characteristics) {
        expect(npc.rolls[code]).toBeGreaterThanOrEqual(min);
      }
      for (const code of ATTRIBUTES) {
        expect(npc.rolls[code]).toBeGreaterThanOrEqual(2);
        expect(npc.rolls[code]).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("poziomy BN", () => {
  it("tylko doswiadczeni i heroiczni osiagaja 4. poziom profesji", () => {
    for (const tier of TIER_IDS) {
      for (const seed of SEEDS) {
        const npc = generateNpc({ tier }, seedRng(seed));
        const top = maxLevel(npc);
        if (tier === "doswiadczony" || tier === "heroiczny") expect(top).toBe(4);
        else expect(top).toBeLessThanOrEqual(3);
      }
    }
  });

  it("liczba poziomow i profesji zgadza sie z definicja poziomu", () => {
    const expected: Record<TierId, [number, number, number]> = {
      slaby: [1, 2, 1],
      sredni: [2, 2, 1],
      zaawansowany: [3, 4, 2],
      doswiadczony: [4, 5, 2],
      heroiczny: [5, 6, 2]
    };
    for (const tier of TIER_IDS) {
      const [min, max, careers] = expected[tier];
      for (const seed of SEEDS) {
        const npc = generateNpc({ tier }, seedRng(seed));
        expect(npc.careerPath.length).toBeGreaterThanOrEqual(min);
        expect(npc.careerPath.length).toBeLessThanOrEqual(max);
        expect(new Set(npc.careerPath.map((s) => s.profession)).size).toBeLessThanOrEqual(careers);
      }
    }
  });

  it("profesje pasuja do rasy", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({}, seedRng(seed));
      for (const step of npc.careerPath) expect(gd.professionAllowsRace(step.profession, npc.race)).toBe(true);
    }
  });

  it("sciezka profesji podana recznie jest zachowana", () => {
    const npc = generateNpc({ tier: "zaawansowany", archetype: "Wojownik", race: "Człowiek", professions: ["Żołnierz", "Rycerz"] }, seedRng(3));
    const names = npc.careerPath.map((s) => s.profession);
    expect(names[0]).toBe("Żołnierz");
    expect(names[names.length - 1]).toBe("Rycerz");
    expect(names.every((n) => n === "Żołnierz" || n === "Rycerz")).toBe(true);
  });
});

describe("rozwoj w trybie wlasnym (deterministycznym)", () => {
  it("slaby na 1. poziomie ma +5 w cechach profesji (plus premia archetypu)", () => {
    const npc = generateNpc(
      { archetype: "Wojownik", tier: "slaby", race: "Człowiek", professions: ["Żołnierz"], deterministic: true },
      seedRng(1)
    );
    // Deterministycznie: 1 lub 2 poziomy wg wag, ale zawsze kumulatywnie po 5.
    const levels = npc.careerPath.length;
    expect(npc.charAdvances.Wt).toBe(5 * levels);
    expect(npc.traits).toEqual([]);
  });

  it("profesja bez rozpisanych cech bierze 3 cechy archetypu na 1. poziomie", () => {
    const arch = gd.getArchetype("Wojownik");
    expect(levelCharacteristics("Halabardnik", 1, arch)).toEqual(["WW", "S", "I"]);
    expect(levelCharacteristics("Halabardnik", 2, arch)).toEqual(["WW", "S", "I", "Zw"]);
  });
});

describe("specjalizacje", () => {
  it("szkola magii i wiatr pasuja do siebie", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const choices: Record<string, string> = {};
      const rng = seedRng(seed);
      const lore = resolveSpecName("Magia Tajemna (Dowolna Tradycja)", choices, undefined, rng);
      const wind = resolveSpecName("Splatanie Magii (Dowolny Kolor)", choices, undefined, rng);
      const pair = gd.getSpecializations().lores.find((l) => lore.includes(`(${l.lore})`));
      expect(pair).toBeDefined();
      expect(wind).toBe(`Splatanie Magii (${pair!.wind})`);
    }
  });

  it("Hierofant zachowuje szkole Swiatla", () => {
    const npc = generateNpc({ archetype: "Czarodziej", race: "Człowiek", tier: "sredni", professions: ["Hierofant"] }, seedRng(5));
    expect(npc.skills.some((s) => s.name === "Splatanie Magii (Hysh)")).toBe(true);
    expect(npc.skills.some((s) => s.name.startsWith("Splatanie Magii") && s.name !== "Splatanie Magii (Hysh)")).toBe(false);
  });

  it("alternatywy 'albo' sa rozwiazywane", () => {
    const name = resolveSpecName("Skradanie (Miasto albo Wieś)", {}, undefined, seedRng(2));
    expect(["Skradanie (Miasto)", "Skradanie (Wieś)"]).toContain(name);
  });
});

describe("cechy opcjonalne", () => {
  it("jeden rzut k100: 1 = 3 cechy, 2-5 = 2, 6-20 = 1, reszta = 0", () => {
    expect(traitCountForRoll(1)).toBe(3);
    expect(traitCountForRoll(2)).toBe(2);
    expect(traitCountForRoll(5)).toBe(2);
    expect(traitCountForRoll(6)).toBe(1);
    expect(traitCountForRoll(20)).toBe(1);
    expect(traitCountForRoll(21)).toBe(0);
    expect(traitCountForRoll(100)).toBe(0);
  });

  it("cechy nie powtarzaja sie i pochodza z puli losowej", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({}, seedRng(seed));
      expect(new Set(npc.traits).size).toBe(npc.traits.length);
      for (const t of npc.traits) expect(gd.getCreatureTrait(t)?.randomPool).toBe(true);
    }
  });
});

describe("wartosci koncowe", () => {
  it("cechy stworzen i profil dowodcy wplywaja na wynik", () => {
    const base = generateNpc({ archetype: "Oprych", tier: "slaby", race: "Człowiek", deterministic: true }, seedRng(1));
    const plain = computeNpc(base);
    const boosted = computeNpc({ ...base, traits: ["Zabijaka"], heroProfiles: [COMMANDER_PROFILE] });
    const heroS = shapedHeroModifiers(COMMANDER_PROFILE, "Oprych").S;
    expect(boosted.chars.S.total - plain.chars.S.total).toBe(10 + Math.max(0, heroS - base.charAdvances.S));
    expect(boosted.chars.WW.total).toBeGreaterThan(plain.chars.WW.total);
  });

  it("profil bohatera jest rozkladany wg priorytetow archetypu", () => {
    const thief = shapedHeroModifiers("Wielki Bohater", "Złodziej");
    expect(thief.Zw).toBe(45);
    expect(thief.WW).toBe(30);
    const wizard = shapedHeroModifiers("Wielki Bohater", "Czarodziej");
    expect(wizard.SW).toBe(45);
    const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    expect(sum(thief)).toBe(sum(wizard));
  });

  it("Czujny daje +30 do Percepcji nawet bez tej umiejetnosci", () => {
    const npc = generateNpc({ archetype: "Kupiec", tier: "slaby", race: "Człowiek", deterministic: true }, seedRng(1));
    npc.skills = npc.skills.filter((s) => s.name !== "Percepcja");
    npc.traits = ["Czujny"];
    const view = computeNpc(npc);
    const per = view.skills.find((s) => s.name === "Percepcja")!;
    expect(per.total).toBe(view.chars.I.total + 30);
  });

  it("Zywotnosc liczy sie z bonusow (Niziolek bez Sily)", () => {
    const npc = generateNpc({ race: "Niziołek", archetype: "Złodziej", deterministic: true }, seedRng(1));
    npc.talents = [];
    const v = computeNpc(npc);
    expect(v.wounds).toBe(2 * v.chars.Wt.bonus + v.chars.SW.bonus);
  });

  it("blok tekstowy zawiera imie i cechy", () => {
    const npc = generateNpc({}, seedRng(9));
    const text = npcToText(npc);
    expect(text).toContain(npc.name);
    expect(text).toContain("WW ");
    expect(text).toContain("Żyw ");
  });
});

describe("ponowne losowanie", () => {
  it("zablokowane sekcje zostaja bez zmian", () => {
    const npc = generateNpc({ tier: "sredni" }, seedRng(11));
    npc.locks = { tozsamosc: true, rozwoj: true };
    const next = rerollNpc(npc, seedRng(99));
    expect(next.name).toBe(npc.name);
    expect(next.careerPath).toEqual(npc.careerPath);
    expect(next.skills).toEqual(npc.skills);
    expect(next.rolls).not.toEqual(npc.rolls);
  });

  it("przebudowa rozwoju ustawia profil bohatera wg poziomu", () => {
    const npc = generateNpc({ tier: "doswiadczony", archetype: "Wojownik" }, seedRng(4));
    expect(npc.heroProfiles).toContain("Pomniejszy Bohater");
    const next = rebuildDevelopment({ ...npc, tier: "sredni" }, undefined, seedRng(4));
    expect(next.heroProfiles).not.toContain("Pomniejszy Bohater");
    expect(Math.max(...next.careerPath.map((s) => s.level))).toBeLessThanOrEqual(2);
  });
});

describe("pieniadze", () => {
  it("rzut na Zarobki wg Statusu", () => {
    expect(rollMoney("Złoto 2", seedRng(1))).toBe("2 zk");
    expect(rollMoney("Brąz 0", seedRng(1))).toBe("brak");
    expect(rollMoney("Srebro 3", seedRng(1), true)).toBe("15 s");
    expect(rollMoney("Brąz 2", seedRng(1), true)).toBe("22 p");
  });
});
