import { beforeAll, describe, expect, it } from "vitest";
import { creatureBase, creatureTierRange, naturalAttacks } from "../creatures";
import { findMagicItem } from "../magicItems";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import { generateNpc, isBeast } from "../generator";
import { isDirectSpell } from "../magic";
import { armourLine, computeNpc } from "../npc";
import { ATTRIBUTES, type Attribute } from "../rules";
import { TIER_IDS, type CreatureDef, type Npc, type TierId } from "../types";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

/** BN o cechach dokladnie jak w ksiazce (rzut = 10, a dla cech <= 5 rzut = wartosc). */
function bookNpc(c: CreatureDef): Npc {
  const npc = generateNpc({ creature: c.name, tier: "slaby", deterministic: true, randomTraits: false, noArchetype: true }, seedRng(1));
  for (const code of ATTRIBUTES) {
    const v = c.stats[code];
    const { die } = creatureBase(c, code);
    npc.rolls[code as Attribute] = die === "1k10" ? (v ?? 0) : 10;
  }
  // Wampir zawsze powstaje z przemiany - tu potrzebny sam profil z ksiazki (bez talentow z profesji).
  if (npc.turned) {
    delete npc.turned;
    npc.archetype = "";
    npc.talents = [];
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
  it("bestia nie ma profesji ani profilu bohatera, a rozwoj za PD rosnie z poziomem", () => {
    const weak = generateNpc({ creature: "Dziki kot", tier: "sredni", deterministic: true }, seedRng(2));
    const mid = generateNpc({ creature: "Dziki kot", tier: "obyty", deterministic: true }, seedRng(2));
    const top = generateNpc({ creature: "Dziki kot", tier: "doswiadczony", deterministic: true }, seedRng(2));
    expect(isBeast(weak)).toBe(true);
    expect(weak.careerPath).toEqual([]);
    expect(top.heroProfiles).toEqual([]);
    const stealth = (n: Npc) => n.skills.find((s) => s.name === "Skradanie (Wieś)")!.advances;
    // Ksiazka: Skradanie 75 przy Zw 55 = +20 (rodzina Kot: 40 x 0.5 = 20), dalej PD.
    expect(stealth(weak)).toBeGreaterThanOrEqual(20);
    expect(weak.traits).toEqual([]);
    // Domyslny poziom kota - Zwykly: PD 500-950 ponad poczatek przedzialu (500) - srodek 225.
    expect(weak.xp).toEqual({ budget: 225, spent: expect.any(Number) });
    expect(weak.xp!.spent).toBeLessThanOrEqual(225);
    const advances = (n: Npc) => Object.values(n.charAdvances).reduce((a, b) => a + b, 0) + n.skills.reduce((a, s) => a + s.advances, 0);
    expect(advances(mid)).toBeGreaterThan(advances(weak));
    // Cechy Stworzen wg poziomu ponad domyslny: +1 - 0,25, +3 - 0,75 (deterministycznie: 0 i 1).
    expect(mid.traits.length).toBe(0);
    expect(advances(top)).toBeGreaterThan(advances(mid));
    expect(top.traits.length).toBe(1);
  });

  it("slaba bestia z podrecznika dostaje umiejetnosci rodziny (niedzwiedz: Bijatyka)", () => {
    const bear = generateNpc({ creature: "Niedźwiedź", tier: "slaby", deterministic: true }, seedRng(1));
    expect(gd.getCreature("Niedźwiedź")!.skills).toEqual([]);
    expect(bear.skills.find((s) => s.name === "Broń Biała (Bijatyka)")?.advances).toBeGreaterThanOrEqual(15);
    // Bez PD (ponizej minimum nie schodzi - podajemy budzet 0): same umiejetnosci rodziny.
    const bare = generateNpc({ creature: "Niedźwiedź", tier: "slaby", xp: 0, deterministic: true }, seedRng(1));
    expect(bare.skills.find((s) => s.name === "Broń Biała (Bijatyka)")?.advances).toBe(15);
    expect(Object.values(bare.charAdvances).every((v) => v === 0)).toBe(true);
  });

  it("wyzszy poziom tej samej bestii jest zawsze silniejszy", () => {
    const tiers = TIER_IDS;
    for (const c of gd.getCreatures().filter((x) => !gd.isCivilized(x.name))) {
      let prev: ReturnType<typeof computeNpc> | null = null;
      let prevSpent = 0;
      // Od domyslnego poziomu do gornej granicy przedzialu stworzenia (wyzej poziom jest przycinany).
      const [, hi] = creatureTierRange(c);
      for (const tier of tiers.slice(tiers.indexOf(c.minTier ?? "slaby"), hi + 1)) {
        const npc = generateNpc({ creature: c.name, tier, deterministic: true, randomTraits: false }, seedRng(5));
        npc.traits = [];
        npc.mutations = [];
        const v = computeNpc(npc);
        // Za PD: wiecej wydanych PD, cechy nie maleja (pojedyncza umiejetnosc moze stanac, gdy PD ida gdzie indziej).
        const sum = (x: ReturnType<typeof computeNpc>) => ATTRIBUTES.reduce((a, code) => a + (x.chars[code].absent ? 0 : x.chars[code].total), 0);
        if (prev) {
          expect(npc.xp!.spent, `${c.name} ${tier}`).toBeGreaterThan(prevSpent);
          // Koncowka budzetu idzie w to, na co jeszcze starcza - suma cech moze drgnac o kilka punktow.
          expect(sum(v), `${c.name} ${tier}`).toBeGreaterThanOrEqual(sum(prev) - 5);
        }
        prev = v;
        prevSpent = npc.xp!.spent;
      }
    }
  });

  it("bestia ponizej minimum jest osłabiona (cechy negatywne), na minimum ma profil z ksiazki", () => {
    const negative = (n: Npc) => n.traits.filter((t) => gd.getCreatureTraits()[t]?.negative);
    // Najwyzej dwa poziomy ponizej domyslnego (Niezwykly): Nowicjusz przycinany do Zwyklego.
    const weak = generateNpc({ creature: "Wojownik Chaosu", tier: "slaby" }, seedRng(1));
    expect(weak.tier).toBe("sredni");
    // Jedna cecha negatywna na poziom ponizej domyslnego.
    expect(negative(weak)).toHaveLength(2);
    // Poziom losowy (nie wybrany) - nie schodzi ponizej minimum.
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateNpc({ creature: "Wojownik Chaosu" }, seedRng(seed));
      expect(TIER_IDS.indexOf(r.tier)).toBeGreaterThanOrEqual(TIER_IDS.indexOf("zaawansowany"));
    }
    // Ponizej minimum - bez PD (sam profil z ksiazki i cechy negatywne).
    expect(weak.xp?.budget).toBe(0);
    // Na domyslnym (Wybitny 6500-10000, srodek 8250 - 6500): PD ponad poczatek przedzialu.
    const chosen = generateNpc({ creature: "Wybraniec Chaosu", tier: "wybitny", deterministic: true }, seedRng(1));
    expect(chosen.xp?.budget).toBe(1750);
    const lord = generateNpc({ creature: "Wybraniec Chaosu", tier: "mistrz", deterministic: true }, seedRng(1));
    expect(lord.charAdvances.WW).toBeGreaterThan(chosen.charAdvances.WW);
    // Powyzej przedzialu (domyslny +3) - przycinany: Wybraniec (Wybitny) najwyzej Arcymistrz.
    expect(generateNpc({ creature: "Wybraniec Chaosu", tier: "heros" }, seedRng(1)).tier).toBe("arcymistrz");
  });

  it("szkielet najwyzej Doswiadczony, czempion na profilu szkieletu z Suchymi Kosciami", () => {
    const skel = generateNpc({ creature: "Szkielet", tier: "heros" }, seedRng(1));
    expect(skel.tier).toBe("obyty");
    expect(gd.getCreature("Szkielet")!.traits).toContain("Suche Kości (1)");
    const champ = generateNpc({ creature: "Szkieletowy czempion", tier: "zaawansowany", deterministic: true }, seedRng(1));
    // Czempion: Suche Kosci co najmniej 3, wyzej szansa na 4 (limit cechy).
    expect(champ.traits).toContain("Suche Kości (3)");
    // Redukcja w nawiasie: +2 za poziom przeciw broni nieobuchowej.
    const view = computeNpc(champ);
    expect(view.armour.głowa.conditional).toBe(view.armour.głowa.total + 6);
    expect(armourLine(view)).toMatch(/^Głowa \d+ \(\d+\)/);
    // Pancerz 4 na domyslnym poziomie, wyzej szansa na 5-6.
    expect(champ.traits.filter((t) => t.startsWith("Pancerz"))).toEqual(["Pancerz (4)"]);
    // PD od poczatku Nowicjusza minus przemiana: (2000 - 100 - 500).
    expect(champ.xp?.budget).toBe(1400);
    const armours = new Set<string>();
    const bones = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const top = generateNpc({ creature: "Szkieletowy czempion", tier: "heros" }, seedRng(seed));
      expect(top.tier).toBe("wybitny");
      armours.add(top.traits.find((t) => t.startsWith("Pancerz"))!);
      bones.add(top.traits.find((t) => t.startsWith("Suche"))!);
    }
    expect([...armours].sort()).toEqual(["Pancerz (5)", "Pancerz (6)"]);
    expect([...bones].sort()).toEqual(["Suche Kości (3)", "Suche Kości (4)"]);
    // Bez wybranego poziomu - domyslny albo wyzszy, nigdy nizszy.
    for (let seed = 1; seed <= 10; seed++) {
      expect(TIER_IDS.indexOf(generateNpc({ creature: "Szkieletowy czempion" }, seedRng(seed)).tier)).toBeGreaterThanOrEqual(TIER_IDS.indexOf("zaawansowany"));
    }
  });

  it("stworzenie z profesja bez gornej granicy poziomu, bestia w przedziale", () => {
    // Ork: domyslnie Zwykly; z profesja dowolnie wysoko, bez profesji najwyzej domyslny +3.
    expect(generateNpc({ creature: "Ork", archetype: "Wojownik", tier: "heros" }, seedRng(1)).tier).toBe("heros");
    expect(generateNpc({ creature: "Ork", noArchetype: true, tier: "heros" }, seedRng(1)).tier).toBe("doswiadczony");
  });

  it("poziom i PD losowane z przedzialu od-do", () => {
    const tiers = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const n = generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "sredni", tierTo: "zaawansowany" }, seedRng(seed));
      tiers.add(n.tier);
      const x = generateNpc({ archetype: "Wojownik", race: "Człowiek", xp: 1000, xpTo: 2000 }, seedRng(seed));
      expect(x.xp!.budget).toBeGreaterThanOrEqual(1000);
      expect(x.xp!.budget).toBeLessThanOrEqual(2000);
      expect(x.xp!.budget % 50).toBe(0);
    }
    expect([...tiers].sort()).toEqual(["obyty", "sredni", "zaawansowany"]);
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
      // Silniejsze stworzenie (od zaawansowanego) na srednim wypada rzadko i zawsze osłabione.
      if (TIER_IDS.indexOf(def.minTier ?? "slaby") > TIER_IDS.indexOf("sredni")) {
        expect(undead.traits.some((t) => gd.getCreatureTraits()[t]?.negative), undead.creature).toBe(true);
      }
      const beastman = generateNpc({ creatureGroup: `Chaos${gd.GROUP_SEP}Zwierzoludzie` }, seedRng(seed));
      expect(gd.getCreature(beastman.creature)!.subgroup).toBe("Zwierzoludzie");
    }
  });

  it("wampir rozwija sie jak czlowiek (profesja z tabeli linii, archetyp z profesji), czaruje wg linii", () => {
    const casters: Record<string, number> = {};
    const adv = (v: ReturnType<typeof generateNpc>, name: string) => v.skills.find((s) => s.name === name)?.advances ?? 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const line of ["Nekrarcha", "Lahmianin", "Krwawy Smok", "Strigoi"]) {
        for (const tier of ["zaawansowany", "doswiadczony", "heroiczny"] as const) {
          const v = generateNpc({ creature: "Wampir", tier, bloodline: line }, seedRng(seed));
          const def = gd.getVampires()!.bloodlines.find((b) => b.name === line)!;
          // Obecna profesja z tabeli Preferowanych Profesji linii (Wampirzy X = zwykla profesja X), archetyp ja ma.
          const alt = gd.getVampires()!.careerAlternatives ?? {};
          const main = v.careerPath.at(-1)!.profession;
          expect(Object.keys(def.careers!).map((c) => alt[c] ?? c), `${line} ${tier}`).toContain(main);
          expect(Object.keys(gd.getArchetype(v.archetype)!.professions)).toContain(main);
          // Tradycje z wyborem sa rozstrzygniete, jak przy wyposazeniu.
          for (const t of [...v.traits, ...computeNpc(v).creatureTraits]) expect(t, t).not.toMatch(/\s(albo|lub)\s/);
          const caster = v.traits.some((t) => t.startsWith("Rzucanie Czarów"));
          if (!caster) {
            // Bez cechy - tylko magia z Talentow profesji, jak u czlowieka (np. Świecki Alchemik:
            // Magia Prosta na 3. poziomie, Magia Tajemna (Metalu) na 4. - Wiatry Magii s. 38).
            // "Nekromancja" w talencie (Lektor) = tradycja "Nekromancji" w zakleciach - porownanie po rdzeniu.
            const lores = v.talents.map((t) => /^Magia Tajemna \((.+)\)$/.exec(t.name)?.[1]).filter((x): x is string => !!x);
            const stem = (x: string) => x.slice(0, 6);
            for (const s of v.spells) {
              const lore = gd.getSpell(s)!.lore;
              if (!/^Prosta/.test(lore)) expect([...lores, "Tajemna"].map(stem), `${line} ${tier}: ${s}`).toContain(stem(lore));
            }
            continue;
          }
          casters[`${line}|${tier}`] = (casters[`${line}|${tier}`] ?? 0) + 1;
          expect(adv(v, "Język (Magiczny)")).toBeGreaterThanOrEqual(def.casting?.minAdvances ?? 1);
          expect(v.skills.some((s) => s.name.startsWith("Splatanie Magii"))).toBe(true);
          if (line === "Krwawy Smok") expect(v.spells.length).toBeLessThanOrEqual(3);
          if (line === "Strigoi") {
            for (const s of v.spells) {
              const spell = gd.getSpell(s)!;
              expect(["Zwierząt", "Nekromancji", "Tajemna"], s).toContain(spell.lore);
              expect(isDirectSpell(spell), s).toBe(true);
            }
          }
        }
      }
    }
    expect(casters["Nekrarcha|zaawansowany"]).toBe(40);
    expect(casters["Lahmianin|doswiadczony"]).toBeGreaterThan(10);
    expect(casters["Lahmianin|doswiadczony"]).toBeLessThan(40);
    expect(casters["Krwawy Smok|doswiadczony"]).toBeUndefined();
    expect(casters["Krwawy Smok|heroiczny"]).toBeGreaterThan(0);
    expect(casters["Strigoi|zaawansowany"]).toBeUndefined();
  });

  it("przemiana czlowieka: cechy czlowieka + premie Linii Krwi, Umiejetnosci i Talenty linii", () => {
    for (const line of gd.getVampires()!.bloodlines) {
      const turned = generateNpc({ creature: "Wampir", tier: "zaawansowany", bloodline: line.name, turned: true, deterministic: true }, seedRng(1));
      expect(turned.turned).toBe(true);
      expect(turned.archetype).not.toBe("");
      expect(turned.careerPath.length).toBeGreaterThan(0);
      const view = computeNpc(turned);
      for (const code of ATTRIBUTES) {
        if (code === "Sz") continue;
        const bonus = (line.turning!.modifiers as Record<string, number>)[code] ?? 0;
        const c = view.chars[code];
        // Baza czlowieka (20) + rzut + rozwiniecia + premia przemiany.
        expect(c.base, `${line.name} ${code}`).toBe(20);
        expect(c.sources.some((s) => s.label.startsWith("przemiana") && s.value === bonus) || bonus === 0, `${line.name} ${code}`).toBe(true);
      }
      // Dary Krwi moga dodac Szybkosci.
      expect(view.movement).toBeGreaterThanOrEqual(4 + line.turning!.movement);
      const owned = new Set(turned.skills.map((s) => gd.splitSpec(s.name).base));
      expect(line.turning!.skills.filter((s) => owned.has(gd.splitSpec(s).base)).length).toBeGreaterThanOrEqual(6);
      expect(turned.heroProfiles).toEqual([]);
    }
    // Jedyna metoda: przemiana (bez profilu z bestiariusza).
    const any = generateNpc({ creature: "Wampir", tier: "zaawansowany", bloodline: "Von Carstein", deterministic: true }, seedRng(1));
    expect(any.turned).toBe(true);
    // Wybrany archetyp: profesja z tabeli linii, ktora do niego pasuje (Strigoi-czarodziej to tylko Lektor).
    for (let seed = 1; seed <= 40; seed++) {
      const w = generateNpc({ creature: "Wampir", archetype: "Czarodziej", tier: "doswiadczony" }, seedRng(seed));
      expect(w.archetype).toBe("Czarodziej");
      if (w.mutations.find((m) => m.kind === "bloodline")?.name === "Strigoi") expect(w.careerPath.at(-1)!.profession).toBe("Lektor");
    }
  });

  it("orki i zwierzoludzie: profesje z listy rodziny, bez Wiedzy (poza Lokalna) i Czytania/Pisania", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const creature of ["Ork", "Goblin", "Gor", "Ungor"]) {
        const v = generateNpc({ creature, archetype: "Wojownik", tier: "heroiczny" }, seedRng(seed));
        const fam = gd.getCreatureFamilies().families[gd.getCreature(creature)!.family];
        for (const step of v.careerPath) expect(Object.keys(fam.careers!), `${creature}: ${step.profession}`).toContain(step.profession);
        for (const s of v.skills) if (s.name.startsWith("Wiedza")) expect(s.name, creature).toBe("Wiedza (Lokalna)");
        expect(v.talents.some((t) => t.name === "Czytanie/Pisanie"), creature).toBe(false);
      }
    }
    // Profesja wlasna zwierzoludzi tylko dla nich.
    expect(gd.professionAllowsRace("Bestigor", "Człowiek")).toBe(false);
  });

  it("Strigoi: proste profesje, bez zwyklego pancerza", () => {
    const allowed = gd.getVampires()!.bloodlines.find((b) => b.name === "Strigoi")!.professions!;
    for (let seed = 1; seed <= 40; seed++) {
      const v = generateNpc({ creature: "Wampir", tier: "doswiadczony", bloodline: "Strigoi" }, seedRng(seed));
      for (const step of v.careerPath) expect(allowed, step.profession).toContain(step.profession);
      expect(v.armour).toEqual([]);
    }
  });

  it("demony i inne stworzenia czarujace z cechy maja Splatanie Magii i Jezyk (Magiczny)", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const horror = generateNpc({ creature: "Różowy Horror Tzeentcha", tier: "zaawansowany" }, seedRng(seed));
      expect(horror.skills.some((s) => s.name === "Splatanie Magii (Dhar)")).toBe(true);
      expect(horror.skills.some((s) => s.name === "Język (Magiczny)")).toBe(true);
      const lammasu = generateNpc({ creature: "Lammasu", tier: "heroiczny" }, seedRng(seed));
      const channel = lammasu.skills.filter((s) => s.name.startsWith("Splatanie Magii"));
      // Wiatr z wyboru w ksiazce zgodny z wylosowana tradycja.
      const lore = computeNpc(lammasu).creatureTraits.find((t) => t.startsWith("Rzucanie Czarów"))!;
      const wind = gd.getSpellsData().lores[/\((.+)\)/.exec(lore)![1]]?.wind;
      expect(channel.map((s) => s.name)).toEqual([`Splatanie Magii (${wind})`]);
    }
  });

  it("ogr moze miec tylko proste profesje; unikaty nie trafiaja do losowania z grupy", () => {
    const allowed = Object.keys(gd.getCreature("Ogr")!.archetypes!);
    for (let seed = 1; seed <= 30; seed++) {
      const o = generateNpc({ creature: "Ogr", tier: "sredni" }, seedRng(seed));
      if (o.archetype) expect(allowed).toContain(o.archetype);
    }
    expect(generateNpc({ creature: "Ogr", archetype: "Kapłan", tier: "sredni" }, seedRng(1)).archetype).toBe("");
    for (let seed = 1; seed <= 40; seed++) {
      expect(gd.getCreature(generateNpc({ creatureGroup: "Potwory" }, seedRng(seed)).creature)!.unique).toBeFalsy();
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

  it("legenda: ostatnia profesja na 4. poziomie, bez profili bohaterow (takze stworzenia z profesja)", () => {
    const hero = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Człowiek" }, seedRng(3));
    expect(Math.max(...hero.careerPath.map((s) => s.level))).toBe(4);
    expect(hero.heroProfiles).toEqual([]);
    const orc = generateNpc({ archetype: "Wojownik", tier: "legendarny", creature: "Ork" }, seedRng(3));
    expect(orc.heroProfiles).toEqual([]);
    const heroic = generateNpc({ archetype: "Wojownik", tier: "heroiczny", race: "Człowiek", deterministic: true }, seedRng(3));
    const legend = generateNpc({ archetype: "Wojownik", tier: "legendarny", race: "Człowiek", deterministic: true }, seedRng(3));
    expect(computeNpc(legend).chars.WW.total).toBeGreaterThan(computeNpc(heroic).chars.WW.total + 10);
  });

  it("wampir dostaje Linie Krwi, 6 Slabosci, Dary Krwi wg poziomu, Wiek i nekromancje", () => {
    // Nekrarcha czaruje zawsze (inne linie - z szansa poziomu).
    const v = generateNpc({ creature: "Wampir", tier: "heroiczny", bloodline: "Nekrarcha" }, seedRng(2));
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

  it("elfi Mag: Wysoka Magia dopiero od heroicznego, herosowy Arcymag na 5. poziomie", () => {
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
      const legend = generateNpc({ archetype: "Czarodziej", tier: "heros", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      expect(legend.careerPath.at(-1)).toEqual({ profession: "Mag", level: 5 });
    }
  });

  it("elfi kaplani: od heroicznego, po 2. poziomie Maga, z glowna tradycja swojego boga", () => {
    const lore: Record<string, string> = { "Kapłan-Kowal Vaula": "Vaula", "Tkacz Burzy": "Morza", "Mistrz Wiedzy Hoetha": "Hoetha" };
    for (let seed = 1; seed <= 30; seed++) {
      const hero = generateNpc({ archetype: "Kapłan", tier: "heroiczny", race: "Wysoki elf" }, seedRng(seed));
      const last = hero.careerPath.at(-1)!;
      if (lore[last.profession]) {
        // Wczesniej moga byc inne profesje, ale tuz przed kaplanem - Mag 1-2.
        const mag = hero.careerPath.findIndex((s) => s.profession === "Mag");
        expect(hero.careerPath.slice(mag, mag + 2)).toEqual([{ profession: "Mag", level: 1 }, { profession: "Mag", level: 2 }]);
        expect(hero.careerPath[mag + 2]).toEqual({ profession: last.profession, level: 3 });
        expect(hero.spells.some((s) => gd.getSpell(s)?.lore === lore[last.profession]), last.profession).toBe(true);
      }
      const adv = generateNpc({ archetype: "Kapłan", tier: "zaawansowany", race: "Wysoki elf" }, seedRng(seed));
      expect(adv.careerPath.some((s) => lore[s.profession])).toBe(false);
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
    let wizards = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = generateNpc({ archetype: "Czarodziej", tier: "doswiadczony", race: "Człowiek" }, seedRng(seed));
      const last = w.careerPath.at(-1)!;
      const levels = gd.getProfession(last.profession)!.levels.filter((l) => l.level <= last.level);
      // Archetyp Czarodzieja obejmuje tez nie-magow (np. Aptekarz) - bez przedmiotu magicznego w profesji.
      if (!levels.some((l) => l.trappings.some((t) => /^(przedmiot magiczny|magiczny przedmiot)$/i.test(t)))) continue;
      wizards++;
      // Kto ma kostur z profesji, ten musi wylosowac cos innego.
      const hasStaff = gd.getProfession(last.profession)!.levels.some((l) => l.trappings.includes("kostur"));
      const extra = w.trappings.filter((t) => {
        const item = findMagicItem(t);
        return (item && !item.group && !(hasStaff && item.name === "umagiczniony kostur")) || t.startsWith("zwój z zaklęciem");
      });
      expect(extra.length, `${seed}: ${w.careerPath.at(-1)?.profession} ${w.trappings.join(", ")}`).toBeGreaterThan(0);
    }
    expect(wizards).toBeGreaterThan(20);
    const npc = generateNpc({ archetype: "Czarodziej", tier: "sredni", race: "Człowiek", professions: ["Piromanta"], deterministic: true }, seedRng(1));
    npc.trappings = ["zwykłe szaty", "umagiczniony kostur"];
    npc.talents = [...npc.talents, { name: "Precyzyjne Inkantowanie", level: 1 }];
    const c = computeNpc(npc).casting!;
    expect(c.channel.sl).toBe(2);
    expect(c.cast.sl).toBe(1);
    expect(c.cnMod).toBe(-1);
  });

  it("stworzenie cywilizowane z archetypem rozwija sie przez profesje", () => {
    const orc = generateNpc({ creature: "Ork", archetype: "Wojownik", tier: "zaawansowany" }, seedRng(3));
    // Bez darmowych rozwiniec tworzenia postaci - wszystko z PD (Niezwykly: 2. poziom profesji).
    expect(orc.careerPath.at(-1)?.level).toBe(2);
    expect(orc.weapons.length).toBeGreaterThan(0);
    // Orki zawsze z profesja.
    for (let seed = 1; seed <= 10; seed++) expect(generateNpc({ creature: "Ork" }, seedRng(seed)).archetype).not.toBe("");
    expect(gd.isCivilized("Ork")).toBe(true);
    expect(gd.isCivilized("Wilk")).toBe(false);
  });
});
