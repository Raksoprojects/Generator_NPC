/**
 * Spojnosc plikow danych. Gdy test nie przechodzi po recznej edycji JSON-a,
 * komunikat wskazuje plik i bledna nazwe.
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as gd from "../gameData";
import { ATTRIBUTES } from "../rules";
import { TIER_IDS } from "../types";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

describe("archetypes.json", () => {
  it("profesje, talenty, umiejetnosci i cechy istnieja w bazie", () => {
    const problems: string[] = [];
    const skillBases = new Set(gd.allSkillNames().map((s) => gd.normalize(gd.splitSpec(s).base)));
    for (const name of gd.allArchetypeNames()) {
      const a = gd.getArchetype(name)!;
      for (const p of Object.keys(a.professions)) if (!gd.getProfession(p)) problems.push(`${name}: profesja "${p}"`);
      for (const t of Object.keys(a.talents)) if (!gd.getTalent(t)) problems.push(`${name}: talent "${t}"`);
      for (const s of a.keySkills) {
        if (!skillBases.has(gd.normalize(gd.splitSpec(s).base))) problems.push(`${name}: umiejętność "${s}"`);
      }
      for (const t of Object.keys(a.traits ?? {})) if (!gd.getCreatureTrait(t)) problems.push(`${name}: cecha stworzenia "${t}"`);
      for (const c of a.characteristics) if (!(ATTRIBUTES as readonly string[]).includes(c)) problems.push(`${name}: cecha "${c}"`);
    }
    expect(problems).toEqual([]);
  });
});

describe("professions.json i races.json", () => {
  it("wszystkie talenty profesji i ras maja definicje w talents.json", () => {
    const problems: string[] = [];
    for (const name of gd.allProfessionNames()) {
      for (const lvl of gd.getProfession(name)!.levels) {
        for (const t of lvl.talents) if (!gd.getTalent(t)) problems.push(`${name} ${lvl.level}: "${t}"`);
      }
    }
    for (const race of gd.allRaceNames()) {
      for (const rt of gd.getRace(race)!.talents) {
        const names = rt.type === "fixed" ? [rt.name] : rt.type === "choice" ? rt.options : [];
        for (const t of names) if (!gd.getTalent(t)) problems.push(`${race}: "${t}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("rasy profesji istnieja w races.json", () => {
    const races = new Set(gd.allRaceNames());
    const problems = gd.allProfessionNames().flatMap((p) =>
      gd.getProfession(p)!.races.filter((r) => !races.has(r)).map((r) => `${p}: "${r}"`)
    );
    expect(problems).toEqual([]);
  });
});

describe("bestiariusz, zaklecia i bron", () => {
  it("rodziny stworzen istnieja, a ich cechy sa w creature_traits.json", () => {
    const fam = gd.getCreatureFamilies();
    for (const c of gd.getCreatures()) expect(fam.families[c.family], `${c.name}: ${c.family}`).toBeDefined();
    for (const [name, f] of Object.entries(fam.families)) {
      for (const t of Object.keys(f.traits)) expect(gd.getCreatureTrait(t), `${name}: ${t}`).toBeDefined();
    }
  });

  it("kazde zaklecie ma znana tradycje i poprawny PZ", () => {
    const lores = gd.getSpellsData().lores;
    for (const s of gd.getSpellsData().spells) {
      expect(lores[s.lore], s.name).toBeDefined();
      expect(s.cn, s.name).toBeGreaterThanOrEqual(0);
      expect(s.cn, s.name).toBeLessThanOrEqual(20);
    }
  });

  it("zestawy pancerza archetypow uzywaja istniejacych elementow", () => {
    const w = gd.getWeapons();
    for (const [set, pieces] of Object.entries(w.armourSets)) {
      for (const p of pieces) expect(w.armour[p], `${set}: ${p}`).toBeDefined();
    }
    for (const name of gd.allArchetypeNames()) {
      for (const set of Object.values(gd.getArchetype(name)!.armour ?? {})) expect(w.armourSets[set as string], `${name}: ${set}`).toBeDefined();
    }
  });
});

describe("pozostale pliki generatora", () => {
  it("kazda rasa ma tabele imion", () => {
    for (const race of gd.allRaceNames()) {
      const t = gd.getNames(race);
      expect(t, race).toBeDefined();
      expect(t!.male.length && t!.female.length && t!.surnames.length).toBeTruthy();
    }
  });

  it("poziomy wskazuja istniejace profile bohaterow", () => {
    for (const id of TIER_IDS) {
      const hp = gd.getTier(id).heroProfile;
      if (hp) expect(gd.getHeroProfile(hp), id).toBeDefined();
      for (const c of gd.getTier(id).heroProfileChances ?? []) expect(gd.getHeroProfile(c.profile), `${id} ${c.profile}`).toBeDefined();
    }
  });

  it("gotowe grupy uzywaja istniejacych archetypow i poziomow", () => {
    for (const [name, preset] of Object.entries(gd.getGroupPresets())) {
      for (const row of preset.rows) {
        if (row.creature) expect(gd.getCreature(row.creature), `${name}: ${row.creature}`).toBeDefined();
        if (row.archetype || !row.creature) expect(gd.getArchetype(row.archetype), `${name}: ${row.archetype}`).toBeDefined();
        if (row.creature && row.archetype) expect(gd.isCivilized(row.creature), `${name}: ${row.creature}`).toBe(true);
        expect(TIER_IDS, `${name}: ${row.tier}`).toContain(row.tier);
      }
    }
  });
});
