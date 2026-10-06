/**
 * Biblioteka zapisanych BN: przechowywana w localStorage przegladarki,
 * z eksportem/importem pliku JSON (kopia zapasowa, przenoszenie miedzy
 * urzadzeniami, wlasna baza gotowych BN).
 */

import type { Artefact } from "./artefacts";
import type { LootResult } from "./loot";
import type { Npc } from "./types";

const LIBRARY_KEY = "wfrp4e-bn:library";
const SETTINGS_KEY = "wfrp4e-bn:settings";

export interface LibraryFile {
  format: "wfrp4e-bn-library";
  version: 1;
  exportedAt: string;
  npcs: Npc[];
}

export interface AppSettings {
  ruleset?: string;
}

export function loadLibrary(): Npc[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNpc) : [];
  } catch {
    return [];
  }
}

export function saveLibrary(npcs: Npc[]): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(npcs));
    return true;
  } catch (e) {
    console.warn("Zapis biblioteki nieudany:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Zapisane przedmioty magiczne i lupy (osobna biblioteka)
// ---------------------------------------------------------------------------

const TREASURES_KEY = "wfrp4e-bn:treasures";

export interface SavedTreasure {
  id: string;
  kind: "artefact" | "loot";
  name: string;
  savedAt: string;
  artefact?: Artefact;
  loot?: LootResult;
}

export interface TreasuresFile {
  format: "wfrp4e-bn-treasures";
  version: 1;
  exportedAt: string;
  treasures: SavedTreasure[];
}

const isTreasure = (t: unknown): t is SavedTreasure =>
  !!t && typeof t === "object" && typeof (t as SavedTreasure).id === "string" && ((t as SavedTreasure).kind === "artefact" ? !!(t as SavedTreasure).artefact : !!(t as SavedTreasure).loot);

export function loadTreasures(): SavedTreasure[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TREASURES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isTreasure) : [];
  } catch {
    return [];
  }
}

export function saveTreasures(list: SavedTreasure[]): boolean {
  try {
    localStorage.setItem(TREASURES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn("Zapis skarbów nieudany:", e);
    return false;
  }
}

export function treasuresToJson(list: SavedTreasure[]): string {
  const file: TreasuresFile = { format: "wfrp4e-bn-treasures", version: 1, exportedAt: new Date().toISOString(), treasures: list };
  return JSON.stringify(file, null, 2);
}

/** Plik eksportu albo sama tablica zapisanych skarbow. */
export function parseTreasuresJson(text: string): SavedTreasure[] {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed?.treasures;
  if (!Array.isArray(list)) throw new Error("To nie jest plik zapisanych przedmiotów i łupów.");
  return list.filter(isTreasure);
}

export function loadSettings(): AppSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as AppSettings;
  } catch {
    return {};
  }
}

export function saveSettings(patch: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch }));
  } catch {
    /* brak localStorage - ustawienia tylko na czas sesji */
  }
}

/** Minimalna walidacja wczytanego obiektu BN. */
export function isNpc(value: unknown): value is Npc {
  const v = value as Npc;
  return !!v && typeof v === "object" && typeof v.id === "string" && typeof v.name === "string" && !!v.rolls && Array.isArray(v.careerPath);
}

export function libraryToJson(npcs: Npc[]): string {
  const file: LibraryFile = {
    format: "wfrp4e-bn-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    npcs
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Odczytuje plik JSON: cala biblioteke, liste BN albo pojedynczego BN.
 * Zwraca poprawne wpisy (niepoprawne sa pomijane).
 */
export function parseNpcJson(text: string): Npc[] {
  const data = JSON.parse(text);
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.npcs) ? data.npcs : [data];
  return list.filter(isNpc);
}

/** Scala wpisy z importu: ten sam id nadpisuje, nowe sa dopisywane. */
export function mergeLibrary(current: Npc[], incoming: Npc[]): { merged: Npc[]; added: number; updated: number } {
  const merged = [...current];
  let added = 0;
  let updated = 0;
  for (const npc of incoming) {
    const i = merged.findIndex((n) => n.id === npc.id);
    if (i >= 0) {
      merged[i] = npc;
      updated++;
    } else {
      merged.push(npc);
      added++;
    }
  }
  return { merged, added, updated };
}
