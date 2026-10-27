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
  rollDiceText,
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
  it("najwyzsze rzuty trafiaja do kluczowych cech archetypu (w ich kolejnosci)", () => {
    const keys = gd.getArchetype("Wojownik")!.characteristics;
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Wojownik" }, seedRng(seed));
      const others = ATTRIBUTES.filter((c) => !keys.includes(c)).map((c) => npc.rolls[c]);
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) expect(npc.rolls[keys[i]]).toBeLessThanOrEqual(npc.rolls[keys[i - 1]]);
        for (const o of others) expect(npc.rolls[keys[i]]).toBeGreaterThanOrEqual(o);
      }
      for (const code of ATTRIBUTES) {
        expect(npc.rolls[code]).toBeGreaterThanOrEqual(2);
        expect(npc.rolls[code]).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("poziomy BN", () => {
  it("tylko doswiadczeni i wyzsi osiagaja 4. poziom profesji", () => {
    for (const tier of TIER_IDS) {
      for (const seed of SEEDS) {
        const npc = generateNpc({ tier }, seedRng(seed));
        const top = maxLevel(npc);
        if (tier === "legendarny" || tier === "heros") expect(top).toBeGreaterThanOrEqual(4);
        else if (tier === "doswiadczony") expect(top).toBeGreaterThanOrEqual(3);
        else if (tier === "heroiczny") expect(top).toBeGreaterThanOrEqual(3);
        // Niezwykly przy gornej granicy PD (ok. 5000) bywa juz na 4. poziomie.
        else if (tier === "zaawansowany") expect(top).toBeLessThanOrEqual(4);
        else expect(top).toBeLessThanOrEqual(3);
      }
    }
  });

  it("budzet PD z zakresu poziomu BN, wydane nie wiecej niz budzet", () => {
    for (const tier of TIER_IDS) {
      const [lo, hi] = gd.getTier(tier).xp;
      for (const seed of SEEDS) {
        const npc = generateNpc({ tier }, seedRng(seed));
        expect(npc.xp!.budget, tier).toBeGreaterThanOrEqual(lo);
        expect(npc.xp!.budget, tier).toBeLessThanOrEqual(hi);
        expect(npc.xp!.spent, tier).toBeLessThanOrEqual(npc.xp!.budget);
        // Reszta PD to najwyzej koszt jednego rozwiniecia, ktorego juz nie starczylo.
        expect(npc.xp!.budget - npc.xp!.spent, tier).toBeLessThan(600);
        expect(new Set(npc.careerPath.map((s) => s.profession)).size).toBeLessThanOrEqual(gd.getTier(tier).maxCareers);
      }
    }
  });

  it("PD podane recznie: zamiast budzetu poziomu (poziom wg PD) albo dodane do niego", () => {
    const a = generateNpc({ archetype: "Szlachcic", race: "Człowiek", xp: 3000 }, seedRng(1));
    expect(a.tier).toBe("zaawansowany");
    expect(a.xp!.budget).toBe(3000);
    const b = generateNpc({ archetype: "Szlachcic", race: "Człowiek", tier: "sredni", xpBonus: 500 }, seedRng(1));
    expect(b.xp!.budget).toBeGreaterThanOrEqual(1500);
    expect(b.xp!.budget).toBeLessThanOrEqual(2400);
    // Przebudowa zachowuje recznie podane PD.
    expect(rebuildDevelopment(a, undefined, seedRng(2)).xp!.budget).toBe(3000);
    // Zwykly z 1500 PD jest na 2. poziomie profesji.
    let second = 0;
    for (const seed of SEEDS) {
      if (generateNpc({ tier: "sredni", race: "Człowiek", xp: 1500 }, seedRng(seed)).careerPath.at(-1)!.level >= 2) second++;
    }
    expect(second / SEEDS.length).toBeGreaterThan(0.85);
  });

  it("przed kazdym awansem poziom jest skompletowany (Cechy i Umiejetnosci na 5 x poziom, Talent)", () => {
    for (const tier of TIER_IDS) {
      for (const seed of SEEDS.slice(0, 20)) {
        const npc = generateNpc({ tier, race: "Człowiek" }, seedRng(seed));
        const arch = gd.getArchetype(npc.archetype);
        for (const step of npc.careerPath.slice(0, -1)) {
          const req = 5 * step.level;
          const label = `${tier} ${seed} ${step.profession} ${step.level}`;
          for (const c of levelCharacteristics(step.profession, step.level, arch)) expect(npc.charAdvances[c], label).toBeGreaterThanOrEqual(req);
          const lvls = gd.getProfession(step.profession)!.levels.filter((l) => l.level <= step.level);
          const bases = new Set(lvls.flatMap((l) => l.skills.map((s) => gd.splitSpec(s.replace(/\+$/, "").trim()).base)));
          const done = npc.skills.filter((s) => s.advances >= req && bases.has(gd.splitSpec(s.name).base)).length;
          expect(done, label).toBeGreaterThanOrEqual(Math.min(8, bases.size));
          const talents = gd.getProfession(step.profession)!.levels.find((l) => l.level === step.level)!.talents;
          if (talents.length) {
            const tb = new Set(talents.map((t) => gd.splitSpec(t).base));
            expect(npc.talents.some((t) => tb.has(gd.splitSpec(t.name).base)), label).toBe(true);
          }
        }
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
  it("tworzenie postaci: Umiejetnosci i Talenty rasowe, rozwiniecia 1. poziomu profesji", () => {
    const npc = generateNpc(
      { archetype: "Wojownik", tier: "slaby", race: "Człowiek", professions: ["Żołnierz"], deterministic: true },
      seedRng(1)
    );
    const race = gd.getRace("Człowiek")!;
    const raceBases = new Set(race.skills.map((s) => gd.splitSpec(s).base));
    // 3 Umiejetnosci rasowe po +5 i 3 po +3 (PG s. 35).
    expect(npc.skills.filter((s) => raceBases.has(gd.splitSpec(s.name).base) && s.advances >= 3).length).toBeGreaterThanOrEqual(6);
    for (const rt of race.talents.filter((t) => t.type === "fixed")) {
      expect(npc.talents.some((t) => gd.splitSpec(t.name).base === gd.splitSpec(rt.name).base), rt.name).toBe(true);
    }
    const chars = levelCharacteristics("Żołnierz", 1, gd.getArchetype("Wojownik"));
    expect(chars.reduce((n, c) => n + npc.charAdvances[c], 0)).toBeGreaterThanOrEqual(5);
    expect(npc.traits).toEqual([]);
  });

  it("profesja bez rozpisanych cech bierze 3 cechy archetypu na 1. poziomie", () => {
    const arch = gd.getArchetype("Wojownik");
    expect(levelCharacteristics("Halabardnik", 1, arch)).toEqual(["WW", "S", "I"]);
    expect(levelCharacteristics("Halabardnik", 2, arch)).toEqual(["WW", "S", "I", "Zw"]);
  });
});

describe("rozwoj losowy", () => {
  it("priorytety archetypu: Umiejetnosci pierwszorzedne rozwijane mocniej niz zwykle", () => {
    let key = 0;
    let normal = 0;
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Kupiec", tier: "zaawansowany", race: "Człowiek", professions: ["Kupiec"] }, seedRng(seed));
      const arch = gd.getArchetype("Kupiec")!;
      const isKey = (n: string) => arch.keySkills.slice(0, 5).some((k) => n === k || n.startsWith(`${k} (`));
      const ks = npc.skills.filter((s) => isKey(s.name));
      const ns = npc.skills.filter((s) => !isKey(s.name));
      key += ks.reduce((n, s) => n + s.advances, 0) / Math.max(1, ks.length);
      normal += ns.reduce((n, s) => n + s.advances, 0) / Math.max(1, ns.length);
    }
    expect(key).toBeGreaterThan(normal * 1.5);
  });

  it("wyzszy poziom BN ma srednio wiecej rozwiniec w kluczowych Cechach i Umiejetnosciach", () => {
    for (const archName of gd.allArchetypeNames()) {
      const arch = gd.getArchetype(archName)!;
      const mean = (tier: TierId) => {
        let sum = 0;
        for (let seed = 1; seed <= 15; seed++) {
          const npc = generateNpc({ archetype: archName, tier, race: "Człowiek" }, seedRng(seed));
          sum += npc.charAdvances[arch.characteristics[0]];
          const k = arch.keySkills[0];
          sum += Math.max(0, ...npc.skills.filter((x) => x.name === k || x.name.startsWith(`${k} (`)).map((x) => x.advances));
        }
        return sum / 15;
      };
      const means = TIER_IDS.map(mean);
      for (let i = 1; i < means.length; i++) expect(means[i], `${archName} ${TIER_IDS[i]}`).toBeGreaterThan(means[i - 1]);
    }
  });
  it("rzuty w wyposazeniu sa wykonywane", () => {
    const rng = seedRng(3);
    for (let i = 0; i < 20; i++) {
      const out = rollDiceText("3k10 szylingów i k10 szmat", rng);
      const [a, b] = out.match(/\d+/g)!.map(Number);
      expect(a).toBeGreaterThanOrEqual(3);
      expect(a).toBeLessThanOrEqual(30);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(10);
      expect(out).not.toMatch(/k10/);
    }
    expect(rollDiceText("2k10 monet", rng, true)).toBe("11 monet");
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
    expect(heroS).toBe(5);
    expect(boosted.chars.S.total - plain.chars.S.total).toBe(10 + heroS);
    expect(boosted.chars.WW.total).toBeGreaterThan(plain.chars.WW.total);
  });

  it("profil bohatera: S i Wt stale, reszta wg priorytetow archetypu", () => {
    const thief = shapedHeroModifiers("Wielki Bohater", "Złodziej");
    expect(thief.Zw).toBe(45);
    expect(thief.WW).toBe(30);
    expect(thief.S).toBe(20);
    expect(thief.Wt).toBe(20);
    const wizard = shapedHeroModifiers("Wielki Bohater", "Czarodziej");
    expect(wizard.SW).toBe(45);
    expect(wizard.S).toBe(20);
    const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    expect(sum(thief)).toBe(sum(wizard));
  });

  it("zmiana rozwiniec zawsze zmienia ceche, takze z profilem bohatera", () => {
    const npc = generateNpc({ archetype: "Wojownik", tier: "doswiadczony" }, seedRng(8));
    const before = computeNpc(npc);
    for (const code of ATTRIBUTES) {
      const changed = computeNpc({ ...npc, charAdvances: { ...npc.charAdvances, [code]: npc.charAdvances[code] + 1 } });
      expect(changed.chars[code].total, code).toBe(before.chars[code].total + 1);
    }
  });

  it("profil bohatera daje stala premie niezaleznie od rozwiniec", () => {
    const npc = generateNpc({ archetype: "Złodziej", tier: "slaby" }, seedRng(21));
    const with1 = computeNpc({ ...npc, heroProfiles: ["Pomniejszy Bohater"] });
    const with2 = computeNpc({ ...npc, heroProfiles: ["Pomniejszy Bohater"], charAdvances: { ...npc.charAdvances, Zw: 40 } });
    expect(with1.chars.Zw.hero).toBe(30);
    expect(with2.chars.Zw.hero).toBe(30);
    expect(with1.chars.S.hero).toBe(10);
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

  it("przebudowa rozwoju zachowuje wybrany profil bohatera i nowy poziom", () => {
    const npc = generateNpc({ tier: "doswiadczony", archetype: "Wojownik", creature: "Ork", heroProfiles: ["Pomniejszy Bohater"] }, seedRng(4));
    expect(npc.heroProfiles).toEqual(["Pomniejszy Bohater"]);
    const next = rebuildDevelopment({ ...npc, tier: "sredni" }, undefined, seedRng(4));
    expect(next.heroProfiles).toEqual(["Pomniejszy Bohater"]);
    expect(Math.max(...next.careerPath.map((s) => s.level))).toBeLessThanOrEqual(2);
  });
});

describe("profile bohaterow i sciezki profesji", () => {
  it("profile bohaterow: z wyboru albo z malej szansy poziomu (najwyzej kilka procent)", () => {
    for (const tier of TIER_IDS) {
      let any = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const hp = generateNpc({ archetype: "Wojownik", tier, race: "Człowiek" }, seedRng(seed)).heroProfiles;
        expect(hp.length).toBeLessThanOrEqual(1);
        if (hp.length) any++;
      }
      expect(any / 300, tier).toBeLessThanOrEqual(0.09);
      for (let seed = 1; seed <= 20; seed++) {
        expect(generateNpc({ archetype: "Wojownik", tier, deterministic: true }, seedRng(seed)).heroProfiles).toEqual([]);
      }
    }
    const chosen = generateNpc({ archetype: "Wojownik", tier: "zaawansowany", heroProfiles: ["Wielki Bohater"], commander: true }, seedRng(1));
    expect(chosen.heroProfiles.sort()).toEqual(["Dowódca Oddziału", "Wielki Bohater"]);
  });

  it("legenda: Arcymag (5. poziom) w okolo polowie przypadkow, ekspert prawie nigdy", () => {
    let legend5 = 0;
    let expert5 = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const l = generateNpc({ archetype: "Czarodziej", tier: "legendarny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      if (l.careerPath.at(-1)!.level === 5) legend5++;
      const e = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      if (e.careerPath.at(-1)!.level === 5) expert5++;
    }
    expect(legend5).toBeGreaterThan(30);
    expect(legend5).toBeLessThan(70);
    expect(expert5).toBeLessThanOrEqual(3);
  });

  it("ostatnia profesja ma zawsze najwyzszy poziom; liczba profesji wg poziomu BN", () => {
    const maxCareers: Record<string, number> = {};
    for (let seed = 1; seed <= 120; seed++) {
      for (const tier of TIER_IDS) {
        const npc = generateNpc({ tier, race: "Człowiek" }, seedRng(seed));
        const byProf = new Map<string, number>();
        for (const s of npc.careerPath) byProf.set(s.profession, Math.max(byProf.get(s.profession) ?? 0, s.level));
        const last = npc.careerPath[npc.careerPath.length - 1];
        for (const [, lvl] of byProf) expect(lvl, `${tier}: ${JSON.stringify(npc.careerPath)}`).toBeLessThanOrEqual(last.level);
        maxCareers[tier] = Math.max(maxCareers[tier] ?? 0, byProf.size);
        expect(byProf.size).toBeLessThanOrEqual(gd.getTier(tier).maxCareers);
        if (tier === "heroiczny") expect(last.level).toBeGreaterThanOrEqual(3);
        if (tier === "legendarny") expect(last.level).toBe(4);
        if (tier === "heros") expect(last.level).toBeGreaterThanOrEqual(4);
      }
    }
    expect(maxCareers.sredni).toBe(2);
    expect(maxCareers.heroiczny).toBe(3);
    expect(maxCareers.legendarny).toBe(3);
    expect(maxCareers.heros).toBe(4);
  });
});

describe("tytuly wg plci", () => {
  it("kazda profesja i kazdy poziom maja forme meska i zenska", () => {
    for (const name of gd.allProfessionNames()) {
      expect(gd.professionName(name, "M"), name).toBeTruthy();
      for (const lvl of gd.getProfession(name)!.levels) {
        expect(gd.professionTitle(name, lvl.level, "M"), `${name} ${lvl.level}`).toBeTruthy();
        expect(gd.professionTitle(name, lvl.level, "K"), `${name} ${lvl.level}`).toBeTruthy();
      }
    }
  });

  it("tytul i nazwa profesji zgadzaja sie z plcia BN", () => {
    const npc = generateNpc({ archetype: "Czarodziej", tier: "sredni", sex: "M", race: "Człowiek", professions: ["Druidka"] }, seedRng(1));
    npc.careerPath = [{ profession: "Druidka", level: 1 }, { profession: "Druidka", level: 2 }];
    const view = computeNpc(npc);
    expect(view.career!.professionName).toBe("Druid");
    expect(view.careerPathText).toBe("Uczeń Druida → Druid");
    npc.sex = "K";
    expect(computeNpc(npc).careerPathText).toBe("Uczennica Druidki → Druidka");
    npc.careerPath = [{ profession: "Czarodziej", level: 4 }];
    expect(computeNpc(npc).career!.title).toBe("Arcymagini");
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

describe("dokladna sciezka (edycja poglebiona)", () => {
  it("sciezka z poziomami jest realizowana w calosci, takze ponad budzet - brak widac jako spent > budget", () => {
    const path = [{ profession: "Żołnierz", level: 2 }, { profession: "Rycerz", level: 3 }];
    let deficit = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const npc = generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "slaby", path }, seedRng(seed));
      const steps = npc.careerPath.map((s) => `${s.profession} ${s.level}`);
      expect(steps).toContain("Żołnierz 2");
      expect(npc.careerPath.at(-1)).toEqual({ profession: "Rycerz", level: 3 });
      // Kazdy przebyty poziom skompletowany (cechy na 5 x poziom).
      const arch = gd.getArchetype("Wojownik");
      for (const step of npc.careerPath.slice(0, -1)) {
        for (const c of levelCharacteristics(step.profession, step.level, arch)) expect(npc.charAdvances[c]).toBeGreaterThanOrEqual(5 * step.level);
      }
      if (npc.xp!.spent > npc.xp!.budget) deficit++;
    }
    // Nowicjusz (200-800 PD) nie stac na Rycerza 3 - zawsze brak PD.
    expect(deficit).toBe(10);
  });

  it("ostatnia profesja bez poziomu - poziom wg PD; bez sciezki zachowanie bez zmian", () => {
    const npc = generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "doswiadczony", path: [{ profession: "Żołnierz", level: 1 }, { profession: "Rycerz", level: null }] }, seedRng(3));
    expect(npc.careerPath[0]).toEqual({ profession: "Żołnierz", level: 1 });
    expect(npc.careerPath.at(-1)!.profession).toBe("Rycerz");
    expect(npc.xp!.spent).toBeLessThanOrEqual(npc.xp!.budget);
    const plain = generateNpc({ archetype: "Wojownik", race: "Człowiek", tier: "slaby", professions: ["Rycerz"] }, seedRng(3));
    expect(plain.xp!.spent).toBeLessThanOrEqual(plain.xp!.budget);
  });

  it("przebudowa ze sciezka odtwarza ja dokladnie", () => {
    const npc = generateNpc({ archetype: "Uczony", race: "Człowiek", tier: "zaawansowany" }, seedRng(5));
    const rebuilt = rebuildDevelopment(npc, undefined, seedRng(6), [{ profession: "Uczony", level: 4 }]);
    expect(rebuilt.careerPath.at(-1)).toEqual({ profession: "Uczony", level: 4 });
  });

  it("ogr jak rasa: zawsze z profesja, dowolny archetyp", () => {
    const ogre = generateNpc({ creature: "Ogr", asRace: true, archetype: "Uczony", tier: "sredni" }, seedRng(2));
    expect(ogre.archetype).toBe("Uczony");
    expect(ogre.careerPath.length).toBeGreaterThan(0);
    const any = generateNpc({ creature: "Ogr", asRace: true, tier: "sredni" }, seedRng(7));
    expect(any.archetype).not.toBe("");
    expect(gd.raceLikeCreatures()).toContain("Ogr");
    expect(gd.bestiaryCreatures().some((c) => c.name === "Ogr")).toBe(false);
    // Poziom ustawiony recznie nie jest podnoszony do minimum ogra (Zwykły).
    expect(generateNpc({ creature: "Ogr", asRace: true, archetype: "Wojownik", tier: "slaby" }, seedRng(1)).tier).toBe("slaby");
  });

  it("zrodlo profesji i Percepcja w linii kluczowych", () => {
    expect(gd.professionSourceFull("Świecki Alchemik")).toBe("Wiatry Magii, s. 38");
    expect(gd.withSource("Żołnierz", gd.getProfession("Żołnierz")?.source)).toBe("Żołnierz (Podstawka)");
    const v = computeNpc(generateNpc({ archetype: "Wojownik", race: "Człowiek" }, seedRng(1)));
    expect(v.keyStats.defence.map((k) => k.name)).toContain("Percepcja");
    expect(v.career!.source).toMatch(/s\. \d+/);
    expect(v.careerSteps.length).toBeGreaterThan(0);
  });
});
