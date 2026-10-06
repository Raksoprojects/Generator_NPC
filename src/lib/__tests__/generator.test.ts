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
        else expect(top).toBeLessThanOrEqual(3);
      }
    }
  });

  it("liczba poziomow i profesji zgadza sie z definicja poziomu", () => {
    const expected: Record<TierId, [number, number, number]> = {
      slaby: [1, 2, 1],
      sredni: [2, 3, 2],
      zaawansowany: [3, 4, 2],
      doswiadczony: [4, 5, 2],
      heroiczny: [6, 8, 3],
      legendarny: [8, 10, 3],
      heros: [10, 14, 4]
    };
    for (const tier of TIER_IDS) {
      const [min, max, careers] = expected[tier];
      for (const seed of SEEDS) {
        const npc = generateNpc({ tier }, seedRng(seed));
        expect(npc.careerPath.length, `${tier} ${npc.race} ${JSON.stringify(npc.careerPath)}`).toBeGreaterThanOrEqual(min);
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

describe("rozwoj losowy", () => {
  it("ukonczone poziomy daja pelne +5, obecny od 2 do 5", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Kupiec", tier: "sredni", race: "Człowiek", professions: ["Kupiec"] }, seedRng(seed));
      // Kupiec 1: Zw, SW, Ogd; poziom 2 dodaje Int. Zw nie jest cecha kluczowa Kupca (Ogd, SW).
      // Zwykly czasem ma 3. poziom rozwoju - jako dodatkowe rozwiniecia na przebytym poziomie.
      const extra = npc.careerPath.filter((s) => s.extra).length;
      expect(npc.charAdvances.Zw).toBeGreaterThanOrEqual(5 + 2);
      expect(npc.charAdvances.Zw).toBeLessThanOrEqual(10 + 5 * extra);
      expect(npc.charAdvances.Int).toBeGreaterThanOrEqual(2);
      expect(npc.charAdvances.Int).toBeLessThanOrEqual(5 + 5 * extra);
    }
  });

  it("premia archetypu zalezy od poziomu BN (sredni: umiejetnosci 15-18, cechy 13-15)", () => {
    for (const seed of SEEDS) {
      const npc = generateNpc({ archetype: "Kupiec", tier: "sredni", race: "Człowiek", professions: ["Kupiec"] }, seedRng(seed));
      expect(npc.charAdvances.Ogd).toBeGreaterThanOrEqual(13);
      expect(npc.charAdvances.Ogd).toBeLessThanOrEqual(15);
      const barter = npc.skills.find((s) => s.name === "Targowanie")!;
      expect(barter.advances).toBeGreaterThanOrEqual(15);
      expect(barter.advances).toBeLessThanOrEqual(18);
    }
  });

  it("najslabszy BN wyzszego poziomu jest lepszy w kluczowych rzeczach od najsilniejszego nizszego", () => {
    const s = gd.getSettings();
    const tiers = TIER_IDS;
    // Progi z tiers.json nie nachodza na siebie (cechy od doswiadczonego rozdziela profil bohatera).
    for (let i = 1; i < tiers.length; i++) {
      const lower = gd.getTier(tiers[i - 1])!;
      const upper = gd.getTier(tiers[i])!;
      expect(upper.keySkills.min ?? 0, `${tiers[i]} umiejetnosci`).toBeGreaterThan(lower.keySkills.max ?? Infinity);
      expect(upper.keyChars.min ?? 0, `${tiers[i]} cechy`).toBeGreaterThan(lower.keyChars.max ?? Infinity);
    }
    for (const archName of gd.allArchetypeNames()) {
      const arch = gd.getArchetype(archName)!;
      // Dla kazdej kluczowej cechy i umiejetnosci: [najmniej, najwiecej] rozwiniec na poziomie.
      const range = (tier: TierId) => {
        const out: Record<string, [number, number]> = {};
        const note = (key: string, value: number) => {
          const [lo, hi] = out[key] ?? [Infinity, -Infinity];
          out[key] = [Math.min(lo, value), Math.max(hi, value)];
        };
        for (let seed = 1; seed <= 25; seed++) {
          const npc = generateNpc({ archetype: archName, tier, race: "Człowiek" }, seedRng(seed));
          const v = computeNpc(npc);
          for (const c of arch.characteristics.slice(0, s.keyCharCount)) note(c, npc.charAdvances[c]);
          for (const k of arch.keySkills.slice(0, s.keySkillCount)) {
            note(k, Math.max(0, ...npc.skills.filter((x) => x.name === k || x.name.startsWith(`${k} (`)).map((x) => x.advances)));
          }
        }
        return out;
      };
      const ranges = tiers.map(range);
      for (let i = 1; i < tiers.length; i++) {
        for (const [key, [lo]] of Object.entries(ranges[i])) {
          expect(lo, `${archName} ${tiers[i]} ${key}`).toBeGreaterThan(ranges[i - 1][key][1]);
        }
      }
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

  it("legenda: Arcymag (5. poziom) w okolo polowie przypadkow, ekspert prawie nigdy; dodatkowe rozwiniecia liczone", () => {
    let legend5 = 0;
    let expert5 = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const l = generateNpc({ archetype: "Czarodziej", tier: "legendarny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      if (l.careerPath.at(-1)!.level === 5) legend5++;
      const e = generateNpc({ archetype: "Czarodziej", tier: "heroiczny", race: "Wysoki elf", professions: ["Mag"] }, seedRng(seed));
      if (e.careerPath.at(-1)!.level === 5) expert5++;
      // Sama jedna profesja na Legendzie - reszta poziomow to dodatkowe rozwiniecia.
      expect(l.careerPath.length).toBeGreaterThanOrEqual(8);
      expect(new Set(l.careerPath.map((s) => s.profession)).size).toBe(1);
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
