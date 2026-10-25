import { beforeAll, describe, expect, it } from "vitest";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import { generateNpc, rerollNpc } from "../generator";
import { computeNpc, npcToText } from "../npc";
import { fillTemplate } from "../persona";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

describe("osobowosc i wyglad", () => {
  it("BN rasy rozumnej dostaje Motywacje z EMG, dwie cechy z roznych par i wyglad z PG", () => {
    const data = gd.getPersonality()!;
    const motivations = new Set(data.motivations.map((m) => m.name));
    for (let seed = 1; seed <= 80; seed++) {
      const npc = generateNpc({ race: "Człowiek" }, seedRng(seed));
      const p = npc.persona!;
      expect(motivations.has(p.motivation!.replace(/ \(.+\)$/, "")), p.motivation).toBe(true);
      expect(p.traits).toHaveLength(2);
      const pairOf = (t: string) => data.traits.findIndex((pair) => pair.some((x) => x.split("|").includes(t)));
      expect(pairOf(p.traits![0])).toBeGreaterThanOrEqual(0);
      expect(pairOf(p.traits![0])).not.toBe(pairOf(p.traits![1]));
      // PG s. 39-40: czlowiek 15+k10 lat (plus lata wg poziomu BN), 150 cm + 4k10.
      expect(p.age!).toBeGreaterThanOrEqual(16);
      expect(p.height!).toBeGreaterThanOrEqual(154);
      expect(p.eyes).toBeTruthy();
      expect(p.hair).toBeTruthy();
      for (const text of [p.need, p.feature, p.mannerism]) expect(text, text).not.toMatch(/[{}]/);
    }
  });

  it("formy wg plci i szablony", () => {
    expect(fillTemplate("Rozmawia sam{|a} ze sobą.", "K", seedRng(1))).toBe("Rozmawia sama ze sobą.");
    expect(fillTemplate("Lekko zgarbion{y|a}.", "M", seedRng(1))).toBe("Lekko zgarbiony.");
    expect(fillTemplate("Mówi z wyraźnym {accent} akcentem.", "M", seedRng(1))).toMatch(/^Mówi z wyraźnym \S+ akcentem\.$/);
    for (let seed = 1; seed <= 40; seed++) {
      const npc = generateNpc({ race: "Człowiek", sex: "K" }, seedRng(seed));
      // Zenskie formy przymiotnikow (cierpliwa, wesoła...) - nigdy meska koncowka -y/-i.
      for (const t of npc.persona!.traits!) expect(t, t).not.toMatch(/(y|i)$/);
      // Brody i wasy tylko u mezczyzn.
      expect(npc.persona!.feature ?? "").not.toMatch(/Broda|Wąsy|Łysy/);
    }
  });

  it("Wiara bierze bostwo z talentu profesji kaplana", () => {
    let checked = 0;
    for (let seed = 1; seed <= 200 && checked < 5; seed++) {
      const npc = generateNpc({ archetype: "Kapłan", race: "Człowiek", tier: "zaawansowany" }, seedRng(seed));
      const god = npc.talents.map((t) => /^(?:Błogosławieństwo|Inwokacja) \((.+)\)$/.exec(t.name)?.[1]).find((g) => g && !/Dowoln/.test(g));
      if (!god || !npc.persona!.motivation!.startsWith("Wiara")) continue;
      expect(npc.persona!.motivation).toBe(`Wiara (${god})`);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("bestia nie ma osobowosci; ponowne losowanie z blokada Imię zachowuje osobowosc", () => {
    expect(generateNpc({ creature: "Wilk" }, seedRng(1)).persona).toBeUndefined();
    const npc = generateNpc({ race: "Krasnolud" }, seedRng(2));
    const locked = rerollNpc({ ...npc, locks: { tozsamosc: true } }, seedRng(3));
    expect(locked.persona).toEqual(npc.persona);
    // Krasnolud: 130 cm + 2k10 (PG s. 40).
    expect(npc.persona!.height!).toBeGreaterThanOrEqual(132);
    expect(npc.persona!.height!).toBeLessThanOrEqual(150);
  });

  it("linia kluczowych: walka, Unik, Odporność, Opanowanie (bez rozwinięć - sama cecha) i najlepsze umiejętności", () => {
    const npc = generateNpc({ archetype: "Uczony", race: "Człowiek" }, seedRng(4));
    const v = computeNpc(npc);
    const names = v.keyStats.defence.map((k) => k.name);
    expect(names).toEqual(expect.arrayContaining(["Unik", "Odporność", "Opanowanie"]));
    expect(names.some((n) => n.startsWith("Broń Biała"))).toBe(true);
    const unik = v.keyStats.defence.find((k) => k.name === "Unik")!;
    if (unik.untrained) expect(unik.value).toBe(v.chars.Zw.total);
    expect(v.keyStats.best.length).toBeLessThanOrEqual(4);
    const text = npcToText(npc, v);
    expect(text).toMatch(/Kluczowe: .*Unik \d+/);
    expect(text).toMatch(/Motywacja: /);
    expect(text).toMatch(/Wygląd: \d+ lat/);
  });
});
