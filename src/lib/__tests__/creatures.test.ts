import { beforeAll, describe, expect, it } from "vitest";
import { creatureBase, naturalAttacks } from "../creatures";
import { findMagicItem } from "../magicItems";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import { generateNpc, isBeast } from "../generator";
import { computeNpc } from "../npc";
import { ATTRIBUTES, type Attribute } from "../rules";
import { TIER_IDS, type CreatureDef, type Npc, type TierId } from "../types";
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
    // Tylko oficjalne podreczniki - fanowskie dodatki (Warriors of Chaos) maja w blokach bledy rachunkowe.
    const official = new Set(["Podręcznik podstawowy", "Imperialny Zwierzyniec"]);
    for (const c of gd.getCreatures().filter((x) => !bookErrata.has(x.name) && official.has(x.source))) {
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
    // Ksiazka: Skradanie 75 przy Zw 55 = +20; rodzina Kot: 40 x 0.5 = 20. Kazdy poziom wyzej +10.
    expect(stealth(weak)).toBe(20);
    expect(weak.traits).toEqual([]);
    expect(Object.values(weak.charAdvances).every((v) => v === 0)).toBe(true);
    expect(stealth(mid)).toBe(30);
    expect(mid.charAdvances.Zw).toBe(10);
    expect(mid.traits.length).toBe(1);
    expect(stealth(top)).toBe(50);
    expect(top.traits.length).toBe(2);
  });

  it("slaba bestia z podrecznika dostaje umiejetnosci rodziny (niedzwiedz: Bijatyka)", () => {
    const bear = generateNpc({ creature: "Niedźwiedź", tier: "slaby", deterministic: true }, seedRng(1));
    expect(gd.getCreature("Niedźwiedź")!.skills).toEqual([]);
    expect(bear.skills.find((s) => s.name === "Broń Biała (Bijatyka)")?.advances).toBe(15);
    expect(Object.values(bear.charAdvances).every((v) => v === 0)).toBe(true);
  });

  it("wyzszy poziom tej samej bestii jest zawsze silniejszy", () => {
    const tiers = TIER_IDS;
    for (const c of gd.getCreatures().filter((x) => !gd.isCivilized(x.name))) {
      let prev: ReturnType<typeof computeNpc> | null = null;
      // Ponizej minimalnego poziomu stworzenie i tak jest podnoszone do minimum.
      for (const tier of tiers.slice(tiers.indexOf(c.minTier ?? "slaby"))) {
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

  it("stworzenie z minimalnym poziomem nie wystepuje nizej, a na minimalnym ma profil z ksiazki", () => {
    expect(generateNpc({ creature: "Wojownik Chaosu", tier: "slaby" }, seedRng(1)).tier).toBe("zaawansowany");
    const chosen = generateNpc({ creature: "Wybraniec Chaosu", tier: "sredni", deterministic: true }, seedRng(1));
    expect(chosen.tier).toBe("doswiadczony");
    expect(Object.values(chosen.charAdvances).every((v) => v === 0)).toBe(true);
    const lord = generateNpc({ creature: "Wybraniec Chaosu", tier: "heroiczny", deterministic: true }, seedRng(1));
    expect(lord.charAdvances.WW).toBe(10);
  });

  it("cecha Broń trafia najlepsza Bronia Biala, nie sama WW", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = generateNpc({ creature: "Goblin", tier: "sredni" }, seedRng(seed));
      const v = computeNpc(g);
      const best = Math.max(...v.skills.filter((s) => s.name.startsWith("Broń Biała")).map((s) => s.total));
      const weapon = v.weapons.find((w) => w.name === "Broń");
      if (weapon && Number.isFinite(best)) expect(weapon.skill).toBe(best);
    }
  });

  it("talenty z bloku stworzenia nie podwajaja premii do cech", () => {
    const c = gd.getCreature("Maruder Chaosu")!;
    const v = computeNpc(bookNpc(c));
    expect(v.chars.WW.total).toBe(c.stats.WW);
    expect(v.chars.S.total).toBe(c.stats.S);
  });

  it("dary Chaosu: wojownicy dostaja je czesciej i tym czesciej, im wyzszy poziom", () => {
    const gifts = (creature: string, tier: TierId) => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        n += generateNpc({ creature, tier }, seedRng(seed)).mutations.filter((m) => m.kind === "gift").length;
      }
      return n;
    };
    expect(gifts("Kultysta", "slaby")).toBe(0);
    expect(gifts("Wojownik Chaosu z Pustkowi", "zaawansowany")).toBeGreaterThan(gifts("Kultysta", "zaawansowany"));
    expect(gifts("Wybraniec Chaosu", "heroiczny")).toBeGreaterThan(gifts("Wybraniec Chaosu", "doswiadczony"));
    const npc = bookNpc(gd.getCreature("Wybraniec Chaosu")!);
    const before = computeNpc(npc);
    npc.mutations = [{ kind: "gift", name: "Żelazna skóra" }];
    const after = computeNpc(npc);
    expect(after.armour.korpus.ap).toBe(before.armour.korpus.ap + 2);
    expect(after.chars.Zw.total).toBe(before.chars.Zw.total - 10);
  });

  it("czarnoksieznik Chaosu zna zaklecia Tradycji Chaosu", () => {
    const s = generateNpc({ creature: "Czarnoksiężnik Chaosu", tier: "zaawansowany" }, seedRng(3));
    expect(s.spells.length).toBeGreaterThan(0);
  });

  it("grupa stworzen: losowanie z grupy i podgrupy, z uwzglednieniem poziomu", () => {
    const tree = gd.creatureGroupTree();
    expect(tree.find((g) => g.group === "Chaos")?.subgroups).toContain("Zwierzoludzie");
    expect(tree.some((g) => g.group === "Wampiry")).toBe(true);
    for (let seed = 1; seed <= 30; seed++) {
      const undead = generateNpc({ creatureGroup: "Nieumarli", tier: "sredni" }, seedRng(seed));
      const def = gd.getCreature(undead.creature)!;
      expect(def.group).toBe("Nieumarli");
      // Na srednim nie wypada nic, co wystepuje dopiero od zaawansowanego.
      expect(TIER_IDS.indexOf(def.minTier ?? "slaby")).toBeLessThanOrEqual(TIER_IDS.indexOf("sredni"));
      const beastman = generateNpc({ creatureGroup: `Chaos${gd.GROUP_SEP}Zwierzoludzie` }, seedRng(seed));
      expect(gd.getCreature(beastman.creature)!.subgroup).toBe("Zwierzoludzie");
    }
  });

  it("wampir: od zaawansowanego, z wybrana Linia Krwi", () => {
    const weak = generateNpc({ creature: "Wampir", tier: "slaby" }, seedRng(4));
    expect(weak.tier).toBe("zaawansowany");
    for (const line of gd.getVampires()!.bloodlines) {
      const v = generateNpc({ creature: "Wampir", tier: "doswiadczony", bloodline: line.name }, seedRng(7));
      expect(v.mutations.find((m) => m.kind === "bloodline")?.name).toBe(line.name);
    }
  });

  it("legendarny BN: dwie pelne profesje i profil Legendarnego Bohatera", () => {
    const hero = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Człowiek" }, seedRng(3));
    expect(hero.careerPath).toHaveLength(7);
    expect(hero.heroProfiles).toContain("Legendarny Bohater");
    const heroic = generateNpc({ archetype: "Wojownik", tier: "heroiczny", race: "Człowiek", deterministic: true }, seedRng(3));
    const legend = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Człowiek", deterministic: true }, seedRng(3));
    expect(computeNpc(legend).chars.WW.total).toBeGreaterThan(computeNpc(heroic).chars.WW.total + 10);
  });

  it("wampir dostaje Linie Krwi, 6 Slabosci, Dary Krwi wg poziomu, Wiek i nekromancje", () => {
    const v = generateNpc({ creature: "Wampir", tier: "heroiczny" }, seedRng(2));
    const kinds = (k: string) => v.mutations.filter((m) => m.kind === k);
    expect(kinds("bloodline")).toHaveLength(1);
    expect(kinds("weakness")).toHaveLength(6);
    expect(kinds("blood")).toHaveLength(gd.getVampires()!.giftsPerTier.heroiczny);
    expect(v.traits).toContain("Wiek (5)");
    expect(v.spells.some((s) => gd.getSpell(s)?.lore === "Nekromancji")).toBe(true);
    const line = gd.getVampires()!.bloodlines.find((b) => b.name === kinds("bloodline")[0].name)!;
    expect(kinds("weakness").map((m) => m.name).sort()).toEqual([...line.weaknesses].sort());
    // modyfikatory linii (np. Nekrarcha +30 Int) dzialaja jak mutacje
    const npc = bookNpc(gd.getCreature("Wampir")!);
    const before = computeNpc(npc).chars.Int.total;
    npc.mutations = [{ kind: "bloodline", name: "Nekrarcha" }];
    expect(computeNpc(npc).chars.Int.total).toBe(before + 30);
    expect(generateNpc({ creature: "Wilk", tier: "sredni" }, seedRng(2)).mutations.some((m) => m.kind === "bloodline")).toBe(false);
  });

  it("zaklecia Grimuaru: elementalista, druid, skaveny i zielonoskorzy maja swoje tradycje", () => {
    const lores = new Set(gd.getSpellsData().spells.map((s) => s.lore));
    for (const l of ["Elementalizmu", "Pór Roku", "Prosta (Druidzka)", "Spaczenia", "Wielkiego Waaagh!", "Tajemna Chaosu"]) {
      expect(lores.has(l), l).toBe(true);
    }
    const el = generateNpc({ archetype: "Czarodziej", tier: "zaawansowany", race: "Człowiek", professions: ["Elementalista"] }, seedRng(4));
    expect(el.spells.some((s) => gd.getSpell(s)?.lore === "Elementalizmu")).toBe(true);
    // Ogolny Czarodziej zostaje tylko dla elfow (8 tradycji jest dla ludzi).
    for (let seed = 1; seed <= 60; seed++) {
      const w = generateNpc({ archetype: "Czarodziej", tier: "sredni", race: "Człowiek" }, seedRng(seed));
      expect(w.careerPath.some((s) => s.profession === "Czarodziej")).toBe(false);
    }
    expect(generateNpc({ archetype: "Czarodziej", tier: "sredni", race: "Wysoki elf" }, seedRng(1)).careerPath.length).toBeGreaterThan(0);
  });

  it("elfi Mag: Wysoka Magia dopiero od heroicznego, legendarny Arcymag na 5. poziomie", () => {
    const has = (n: Npc, t: string) => n.talents.some((x) => x.name === t);
    for (let seed = 1; seed <= 20; seed++) {
      const adv = generateNpc({ archetype: "Czarodziej", tier: "zaawansowany", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      expect(has(adv, "Wysoka Magia")).toBe(false);
      expect(adv.spells.some((s) => gd.getSpell(s)?.lore === "Wysokiej Magii")).toBe(false);
      const hero = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      expect(has(hero, "Wysoka Magia")).toBe(true);
      expect(hero.spells.some((s) => gd.getSpell(s)?.lore === "Wysokiej Magii")).toBe(true);
      expect(hero.spells.some((s) => gd.getSpell(s)?.lore === "Prosta (Elfia)")).toBe(true);
      // Doswiadczony i wyzszy elfi czarodziej zna co najmniej dwie tradycje kolorow.
      expect(hero.talents.filter((t) => t.name.startsWith("Magia Tajemna")).length).toBeGreaterThanOrEqual(2);
      const legend = generateNpc({ archetype: "Czarodziej", tier: "legendarny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      expect(legend.careerPath.at(-1)).toEqual({ profession: "Mag", level: 5 });
    }
  });

  it("czarodziej nie zmienia tradycji; elfy od zaawansowanego moga znac kolejne", () => {
    const magic = (p: string) =>
      gd.getProfession(p)!.levels.some((l) => [...l.skills, ...l.talents].some((n) => n.startsWith("Splatanie Magii")));
    let elfExtra = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const w = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Człowiek" }, seedRng(seed));
      const profs = [...new Set(w.careerPath.map((s) => s.profession))];
      expect(profs.filter(magic).length, profs.join(" -> ")).toBeLessThanOrEqual(1);

      const elf = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Wysoki elf" }, seedRng(seed));
      const lores = elf.talents.filter((t) => t.name.startsWith("Magia Tajemna"));
      if (lores.length > 1) {
        elfExtra++;
        // Kolejna tradycja ma swoje zaklecia, ale mniej niz glowna.
        const byLore = lores.map((t) => elf.spells.filter((s) => gd.getSpell(s)?.lore === gd.spellLoreKey(gd.splitSpec(t.name).spec!)).length);
        expect(byLore[1], `${seed}: ${lores.map((t) => t.name)} ${byLore}`).toBeGreaterThan(0);
        expect(byLore[1]).toBeLessThanOrEqual(byLore[0]);
      }
    }
    expect(elfExtra).toBeGreaterThan(50);
    const human = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Człowiek" }, seedRng(3));
    expect(human.talents.filter((t) => t.name.startsWith("Magia Tajemna")).length).toBe(1);
  });

  it("czarodziej: przedmiot magiczny jest losowany, szaty i kostur daja premie widoczne w podsumowaniu", () => {
    let staff = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const npc = generateNpc({ archetype: "Czarodziej", tier: "zaawansowany", race: "Człowiek", professions: ["Piromanta"] }, seedRng(seed));
      expect(npc.trappings.some((t) => /^(przedmiot magiczny|magiczny przedmiot)$/i.test(t))).toBe(false);
      const v = computeNpc(npc);
      expect(v.casting).not.toBeNull();
      expect(v.casting!.lores.some((l) => l.key === "Ognia" && l.rule)).toBe(true);
      if (npc.trappings.includes("umagiczniony kostur")) {
        staff++;
        expect(v.casting!.cnMod).toBe(-1);
      }
    }
    expect(staff).toBeGreaterThan(0);
    // Czarodziej od 3. poziomu zawsze ma wylosowany przedmiot magiczny (poza kosturem i szatami).
    for (let seed = 1; seed <= 40; seed++) {
      const w = generateNpc({ archetype: "Czarodziej", tier: "doswiadczony", race: "Człowiek" }, seedRng(seed));
      // Kto ma kostur z profesji, ten musi wylosowac cos innego.
      const hasStaff = gd.getProfession(w.careerPath.at(-1)!.profession)!.levels.some((l) => l.trappings.includes("kostur"));
      const extra = w.trappings.filter((t) => {
        const item = findMagicItem(t);
        return (item && !item.group && !(hasStaff && item.name === "umagiczniony kostur")) || t.startsWith("zwój z zaklęciem");
      });
      expect(extra.length, `${seed}: ${w.careerPath.at(-1)?.profession} ${w.trappings.join(", ")}`).toBeGreaterThan(0);
    }
    const npc = generateNpc({ archetype: "Czarodziej", tier: "sredni", race: "Człowiek", professions: ["Piromanta"], deterministic: true }, seedRng(1));
    npc.trappings = ["zwykłe szaty", "umagiczniony kostur"];
    npc.talents = [...npc.talents, { name: "Precyzyjne Inkantowanie", level: 1 }];
    const c = computeNpc(npc).casting!;
    expect(c.channel.sl).toBe(2);
    expect(c.cast.sl).toBe(1);
    expect(c.cnMod).toBe(-1);
  });

  it("stworzenie cywilizowane z archetypem rozwija sie przez profesje", () => {
    const orc = generateNpc({ creature: "Ork", archetype: "Wojownik", tier: "sredni" }, seedRng(3));
    expect(orc.careerPath.length).toBe(2);
    expect(orc.weapons.length).toBeGreaterThan(0);
    expect(gd.isCivilized("Ork")).toBe(true);
    expect(gd.isCivilized("Wilk")).toBe(false);
  });
});
