import { beforeAll, describe, expect, it } from "vitest";
import { artefactToText, categoryChoices, categoryList, rollArtefact } from "../artefacts";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import { findRune } from "../treasures";
import { formatPence, lootLocations, rollLoot } from "../loot";
import { loadTestGameData } from "./loadData";

beforeAll(loadTestGameData);

describe("generator przedmiotow magicznych", () => {
  it("kazda kategoria daje przedmiot z nazwa, opisem i poprawnymi zakleciami", () => {
    const spells = new Set(gd.getSpellsData().spells.map((s) => s.name));
    for (const { key } of categoryList()) {
      for (let seed = 1; seed <= 40; seed++) {
        const a = rollArtefact({ category: key }, seedRng(seed));
        expect(a.category, key).toBe(key);
        expect(a.name.length, key).toBeGreaterThan(2);
        expect(a.lines.length + a.runes.length, `${key}: ${a.name}`).toBeGreaterThan(0);
        for (const s of a.spells) expect(spells.has(s), s).toBe(true);
        if (a.wp !== undefined) expect(a.wp, `${key}: ${a.name}`).toBeGreaterThan(0);
        expect(artefactToText(a)).toContain(a.name);
      }
    }
  });

  it("runy krasnoludzkie: najwyzej 3 zwykle i 1 mistrzowska; bez klatw - nic przekletego", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const a = rollArtefact({ category: seed % 2 ? "bronie" : "pancerze" }, seedRng(seed));
      const dwarven = a.runes.filter((r) => findRune(r));
      expect(dwarven.filter((r) => findRune(r)!.master).length).toBeLessThanOrEqual(1);
      expect(dwarven.filter((r) => !findRune(r)!.master).length).toBeLessThanOrEqual(3);
      const clean = rollArtefact({ allowCursed: false }, seedRng(seed));
      expect(clean.cursed, clean.name).toBe(false);
    }
  });

  it("tryb wlasny: wybrana pozycja kategorii", () => {
    for (const { key } of categoryList()) {
      const choices = categoryChoices(key);
      expect(choices.length, key).toBeGreaterThan(0);
      const a = rollArtefact({ category: key, item: choices[choices.length - 1] }, seedRng(3));
      expect(a.name + (a.base ?? ""), key).toContain(choices[choices.length - 1].split(" (")[0]);
    }
  });
});

describe("lupy wg lokacji", () => {
  it("kazda lokacja i poziom daje wynik; wyzszy poziom - wiecej pieniedzy", () => {
    for (const loc of lootLocations()) {
      for (let level = 1; level <= 5; level++) {
        const r = rollLoot({ location: loc.id, level }, seedRng(level));
        expect(r.location.id).toBe(loc.id);
        expect(r.totalPence).toBeGreaterThanOrEqual(0);
        for (const s of r.sections) for (const i of s.items) expect(i.name.length, `${loc.id}: ${s.label}`).toBeGreaterThan(1);
      }
    }
    const sum = (level: number) => {
      let t = 0;
      for (let seed = 1; seed <= 100; seed++) t += rollLoot({ location: "posiadlosc", level, magic: false }, seedRng(seed)).totalPence;
      return t;
    };
    expect(sum(4)).toBeGreaterThan(sum(1) * 2);
    expect(formatPence(253)).toBe("1 zk 1 s 1 p");
  });

  it("dom czarodzieja czesto ma zwoje i grimuary, chata prawie nigdy przedmiotow magicznych", () => {
    let wizard = 0;
    let hovel = 0;
    for (let seed = 1; seed <= 100; seed++) {
      wizard += rollLoot({ location: "dom_czarodzieja", level: 1 }, seedRng(seed)).artefacts.length;
      hovel += rollLoot({ location: "chata", level: 1 }, seedRng(seed)).artefacts.length;
    }
    expect(wizard).toBeGreaterThan(100);
    expect(hovel).toBe(0);
  });
});
