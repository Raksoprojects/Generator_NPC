/**
 * Osobowosc i wyglad BN (personality.json):
 * - Motywacja [Ekran MG, s. 11-13], waga wg archetypu [dom];
 * - potrzeba BN [EMG s. 19-23, kolumna "Dlaczego"] i powiazanie z BG [EMG s. 23-25];
 * - wiek, wzrost, kolor oczu i wlosow [PG s. 39-40]; przyrost wieku z poziomem BN [dom];
 * - cechy charakteru, manieryzm i znak szczegolny [dom - EMG s. 16 odsyla do list spoza podrecznika].
 */

import { chance, defaultRng, pick, randInt, rollDie, weightedKey, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import { TIER_IDS, type Npc, type NpcPersona, type PersonaEntry, type Sex } from "./types";

/** "{go|ją}" -> forma wg plci; "{accent}" itp. -> losowy element listy z personality.json. */
export function fillTemplate(text: string, sex: Sex, rng: Rng): string {
  const data = gd.getPersonality();
  const lists: Record<string, string[] | undefined> = {
    accent: data?.accents,
    scarPlace: data?.scarPlaces,
    tattoo: data?.tattoos,
    birthmark: data?.birthmarks,
    smell: data?.smells,
    pet: data?.pets
  };
  return text.replace(/\{([^}]*)\}/g, (_, inner: string) => {
    if (inner.includes("|")) {
      const [m, k] = inner.split("|");
      return sex === "K" ? k : m;
    }
    return pick(lists[inner] ?? [], rng) ?? "";
  });
}

/** "porywczy|porywcza" -> forma wg plci. */
const gendered = (pair: string, sex: Sex) => {
  const [m, k] = pair.split("|");
  return sex === "K" ? (k ?? m) : m;
};

function entryFits(e: PersonaEntry, race: string, sex: Sex): boolean {
  if (e.sex && e.sex !== sex) return false;
  if (e.races && !e.races.includes(race)) return false;
  return !e.notRaces?.includes(race);
}

/** Rzut "Xk10" (PG: wiek). */
function rollDice(dice: string, rng: Rng): number {
  const m = /^(\d*)k(\d+)$/.exec(dice);
  if (!m) return 0;
  let sum = 0;
  for (let i = 0; i < Number(m[1] || 1); i++) sum += rollDie(Number(m[2]), rng);
  return sum;
}

/** Tabela 2k10 z pasmami (2, 3, 4, 5-7, 8-11, 12-14, 15-17, 18, 19, 20). */
function rollBand(values: string[], bands: number[], rng: Rng): string {
  const r = rollDie(10, rng) + rollDie(10, rng);
  const i = bands.findIndex((b) => r <= b);
  return values[i < 0 ? values.length - 1 : i];
}

/** Bostwo BN: z talentu profesji (Błogosławieństwo/Inwokacja), inaczej losowe wg rasy. */
function deityOf(npc: Npc, race: string, rng: Rng): string | undefined {
  for (const t of npc.talents) {
    const m = /^(?:Błogosławieństwo|Inwokacja) \((.+)\)$/.exec(t.name);
    if (m && !/Dowoln/i.test(m[1])) return m[1];
    if (/Ishę$/.test(t.name)) return "Isha";
    if (/Lileath$/.test(t.name)) return "Lileath";
  }
  return pick(gd.getPersonality()?.deities[race] ?? gd.getPersonality()?.deities["Człowiek"] ?? [], rng);
}

/** Losuje osobowosc i wyglad BN. Bestie (bez archetypu) nie dostaja nic. */
export function rollPersona(npc: Npc, rng: Rng = defaultRng): NpcPersona | undefined {
  const data = gd.getPersonality();
  if (!data || (npc.creature && !npc.archetype && !npc.turned)) return undefined;
  // Wampir przemieniony wyglada jak czlowiek; stworzenia rozumne (ork, skaven) bez tabel wygladu.
  const race = npc.turned ? "Człowiek" : npc.race;
  const sex = npc.sex;
  const out: NpcPersona = {};

  const weights: Record<string, number> = {};
  for (const m of data.motivations) weights[m.name] = 1 + (data.motivationWeights[npc.archetype]?.[m.name] ?? 0);
  const motivation = weightedKey(weights, rng);
  if (motivation) {
    const def = data.motivations.find((m) => m.name === motivation);
    const deity = def?.deity ? deityOf(npc, race, rng) : undefined;
    out.motivation = deity ? `${motivation} (${deity})` : motivation;
  }

  // Dwie cechy charakteru z roznych par przeciwienstw.
  const pairs = [...data.traits];
  out.traits = [];
  for (let i = 0; i < 2 && pairs.length; i++) {
    const pair = pairs.splice(randInt(0, pairs.length - 1, rng), 1)[0];
    out.traits.push(gendered(pair[randInt(0, 1, rng)], sex));
  }

  const mannerism = pick(data.mannerisms.filter((e) => entryFits(e, race, sex)), rng);
  if (mannerism) out.mannerism = fillTemplate(mannerism.text, sex, rng);
  const feature = pick(data.features.filter((e) => entryFits(e, race, sex)), rng);
  if (feature) out.feature = fillTemplate(feature.text, sex, rng);

  // Potrzeby "mroczne" (pakt z demonem, zdrada) rzadziej.
  const need = weightedPick(data.needs, (n) => (n.dark ? 0.4 : 1), rng);
  if (need) out.need = fillTemplate(need.text, sex, rng);
  out.acquaintance = pick(data.acquaintances, rng);

  const look = data.appearance[race];
  if (look) {
    const tierIdx = Math.max(0, TIER_IDS.indexOf(npc.tier));
    const extra = tierIdx * look.age.tierYears + randInt(0, tierIdx * look.age.tierYears, rng);
    out.age = look.age.base + rollDice(look.age.dice, rng) + extra;
    let height = look.height.base;
    for (let i = 0; i < look.height.dice; i++) {
      let r = rollDie(10, rng);
      height += r;
      // PG: u ludzi "10" na kostce - dorzuc kolejna.
      while (look.height.explode && r === 10) {
        r = rollDie(10, rng);
        height += r;
      }
    }
    out.height = height;
    const eyes = () => {
      let e = rollBand(look.eyes, data.colorBands, rng);
      // "Dowolny wybór" - losujemy ktorys z pozostalych kolorow.
      if (/Dowolny/.test(e)) e = pick(look.eyes.filter((x) => !/Dowolny/.test(x)), rng) ?? e;
      return e.toLowerCase();
    };
    // Elfy: dwa rzuty - oczy mieniace sie dwiema barwami (PG s. 40).
    const first = eyes();
    const second = look.eyesTwice ? eyes() : first;
    out.eyes = second !== first ? `${first} z domieszką ${second}` : first;
    // Siwizna z wiekiem (PG s. 40) - elfy nie siwieja.
    const old = !race.includes("elf") && chance(Math.min(0.9, Math.max(0, (out.age - lifespanMid(race)) / lifespanMid(race))), rng);
    out.hair = old ? "siwy" : rollBand(look.hair, data.colorBands, rng).toLowerCase();
  }
  return out;
}

/** Wiek sredni (PG s. 39: srednia dlugosc zycia 60 / 120 / 200) - od niego wlosy siwieja. */
function lifespanMid(race: string): number {
  return race === "Krasnolud" ? 100 : race === "Niziołek" ? 60 : 35;
}

/** Wiersze osobowosci do bloku tekstowego i karty. */
export function personaLines(p: NpcPersona | undefined): { label: string; text: string }[] {
  if (!p) return [];
  const look = [
    p.age ? `${p.age} lat` : "",
    p.height ? `${p.height} cm` : "",
    p.eyes ? `oczy: ${p.eyes}` : "",
    p.hair ? `włosy: ${p.hair}` : ""
  ].filter(Boolean);
  return [
    { label: "Wygląd", text: [look.join(", "), p.feature ?? ""].filter(Boolean).join(" · ") },
    { label: "Charakter", text: [(p.traits ?? []).join(", "), p.mannerism ?? ""].filter(Boolean).join(" · ") },
    { label: "Motywacja", text: p.motivation ?? "" },
    { label: "Potrzeba", text: p.need ? `chce ${p.need}` : "" },
    { label: "Skąd zna BG", text: p.acquaintance ?? "" }
  ].filter((l) => l.text);
}
