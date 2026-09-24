import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setGameData, type GameData } from "../gameData";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../../public/data");

export function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf-8")) as T;
}

/** Laduje kanoniczne dane z public/data do modulu gameData (dla testow). */
export function loadTestGameData(): void {
  setGameData({
    professions: readJson("professions.json"),
    classes: readJson("classes.json"),
    talents: readJson("talents.json"),
    skills: readJson("skills.json"),
    races: readJson("races.json"),
    creatureTraits: readJson("creature_traits.json"),
    heroProfiles: readJson("hero_profiles.json"),
    tiers: readJson("tiers.json"),
    archetypes: readJson("archetypes.json"),
    specializations: readJson("specializations.json"),
    names: readJson("names.json"),
    groupPresets: readJson("group_presets.json")
  } as GameData);
}
