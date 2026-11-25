import { beforeAll, describe, expect, it } from "vitest";
import { fight, npcFighter, outnumberBonus } from "../combatSim";
import { seedRng } from "../dice";
import { generateNpc } from "../generator";
import { computeNpc } from "../npc";
import { CRIT_TABLE, critEntry } from "../criticals";
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

  it("Tabela Ran Krytycznych pokrywa 01-00 w kazdej lokacji, 00 to Smierc", () => {
    for (const [loc, rows] of Object.entries(CRIT_TABLE)) {
      expect(rows.at(-1)!.max, loc).toBe(100);
      expect(rows.at(-1)!.death, loc).toBe(true);
      for (let i = 1; i < rows.length; i++) expect(rows[i].max, loc).toBeGreaterThan(rows[i - 1].max);
    }
    expect(critEntry("głowa", 1).name).toBe("Zawadiacka rana");
    expect(critEntry("nogi", -15).max).toBe(10);
  });

  it("walka z Krytykami konczy sie rozstrzygnieciem (pionki wypadaja przy Krytyku)", () => {
    const party = () => [1, 2, 3, 4].map((i) => npcFighter(generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "obyty" }, seedRng(i))));
    const mobs = () => [1, 2, 3, 4].map((i) => ({ ...npcFighter(generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "slaby" }, seedRng(50 + i))), minion: true }));
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const r = fight(party(), mobs(), seedRng(i), 30, { crits: true });
      if (r.winner !== "remis") done++;
    }
    expect(done).toBeGreaterThan(20);
  });

  it("przewaga liczebna [dom]: 2:1 +10 na Sredniego; Duzy od 3:1, +20 od 5:1; Wielki od 4:1", () => {
    expect([1, 2, 3, 4].map((r) => outnumberBonus(r, 3))).toEqual([0, 10, 20, 30]);
    expect([2, 3, 4, 5].map((r) => outnumberBonus(r, 4))).toEqual([0, 10, 10, 20]);
    expect([3, 4, 6, 7].map((r) => outnumberBonus(r, 5))).toEqual([0, 10, 10, 20]);
  });

  it("strzelec trzyma dystans i strzela, walka z dystansem sie rozstrzyga", () => {
    const archer = { ...npcFighter(generateNpc({ archetype: "Strzelec", race: "Człowiek", tier: "obyty" }, seedRng(3))), shooter: true };
    expect(archer.shot).toBeDefined();
    let done = 0;
    for (let i = 0; i < 20; i++) {
      const foe = npcFighter(generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "obyty" }, seedRng(40 + i)));
      if (fight([archer], [foe], seedRng(i), 30, { distance: [12, 30] }).winner !== "remis") done++;
    }
    expect(done).toBeGreaterThan(14);
  });

  it("[dom] Czempion bez stopni: kontra po wygranej obronie kosztuje 1 Przewage", () => {
    const w = generateNpc({ creature: "Wojownik Chaosu", noArchetype: true }, seedRng(1));
    const view = computeNpc(w);
    expect(view.creatureTraits).toContain("Czempion");
    expect(npcFighter(w, view).champion).toBe(1);
    // Bez Przewagi Czempion nie kontruje: walka z pula 0 i bez wygranych atakow trwa jak bez cechy.
    const f = npcFighter(w, view);
    const plain = { ...f, champion: 0 };
    let a = 0, b = 0;
    for (let s = 0; s < 200; s++) {
      a += fight([plain], [f], seedRng(s)).dealtByB;
      b += fight([plain], [plain], seedRng(s)).dealtByB;
    }
    expect(a).toBeGreaterThanOrEqual(b);
  });
});
