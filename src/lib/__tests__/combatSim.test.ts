import { beforeAll, describe, expect, it } from "vitest";
import { fight, npcFighter } from "../combatSim";
import { seedRng } from "../dice";
import { generateNpc } from "../generator";
import { championRank, computeNpc } from "../npc";
import { loadTestGameData } from "./loadData";

beforeAll(loadTestGameData);

describe("symulator starc", () => {
  const wins = (a: Parameters<typeof generateNpc>[0], b: Parameters<typeof generateNpc>[0], n = 40) => {
    let w = 0;
    for (let i = 1; i <= n; i++) {
      const r = fight([npcFighter(generateNpc(a, seedRng(i)))], [npcFighter(generateNpc(b, seedRng(100 + i)))], seedRng(i));
      w += r.winner === "A" ? 1 : 0;
    }
    return w / n;
  };

  it("wyzszy poziom wygrywa czesciej", () => {
    expect(wins({ archetype: "Wojownik", race: "Człowiek", tier: "mistrz" }, { archetype: "Wojownik", race: "Człowiek", tier: "slaby" })).toBeGreaterThan(0.9);
  });

  it("Rozmiar [dom] i Eteryczny dzialaja", () => {
    const troll = npcFighter(generateNpc({ creature: "Troll", tier: "sredni" }, seedRng(1)));
    expect(troll.size).toBe(4);
    const ghost = npcFighter(generateNpc({ creature: "Duch", tier: "slaby" }, seedRng(1)));
    expect(ghost.ethereal).toBe(true);
    // Zwykly wojownik bez magicznej broni nie zrani ducha.
    const r = fight([npcFighter(generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "weteran" }, seedRng(2)))], [ghost], seedRng(3));
    expect(r.dealtByA).toBe(0);
  });

  it("Czempion (X): 1 do Weterana, +1 za 2 poziomy i BWW 7+, najwyzej polowa BWW", () => {
    expect(championRank("slaby", 60)).toBe(1);
    expect(championRank("slaby", 70)).toBe(2);
    expect(championRank("zaawansowany", 65)).toBe(1);
    expect(championRank("zaawansowany", 75)).toBe(2);
    expect(championRank("wybitny", 60)).toBe(2);
    expect(championRank("mistrz", 65)).toBe(3);
    expect(championRank("legendarny", 90)).toBe(4);
    expect(championRank("legendarny", 39)).toBe(1);
    const w = generateNpc({ creature: "Wojownik Chaosu", noArchetype: true }, seedRng(1));
    const view = computeNpc(w);
    expect(view.creatureTraits.some((t) => /^Czempion \(\d\)$/.test(t))).toBe(true);
    expect(npcFighter(w, view).champion).toBeGreaterThanOrEqual(1);
  });
});
