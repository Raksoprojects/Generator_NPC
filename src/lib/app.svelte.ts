/**
 * Reaktywny stan aplikacji (Svelte 5 runes): dane gry, wariant zasad,
 * biblioteka zapisanych BN i komunikaty. Logika generowania zyje w
 * generator.ts - tutaj tylko jej wywolania i trwalosc.
 */

import * as gd from "./gameData";
import { newId } from "./generator";
import {
  loadGroups,
  loadLibrary,
  loadSettings,
  loadTreasures,
  saveGroups,
  saveLibrary,
  saveSettings,
  saveTreasures,
  type SavedGroup,
  type SavedTreasure
} from "./library";
import type { Npc, Ruleset } from "./types";

export const RULESET_LABELS: Record<Ruleset, string> = {
  pod_bronia: "Pod Bronią",
  domowe: "Pełne Domowe"
};

class AppState {
  ready = $state(false);
  loadError = $state("");
  ruleset = $state<Ruleset>("pod_bronia");
  /** Zmienia sie po przelaczeniu zasad - widoki licza wartosci od nowa. */
  dataVersion = $state(0);
  library = $state<Npc[]>([]);
  /** Zapisane przedmioty magiczne i lupy. */
  treasures = $state<SavedTreasure[]>([]);
  /** Zapisane grupy BN (cala grupa jako jeden wpis). */
  groups = $state<SavedGroup[]>([]);
  toast = $state("");
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  async init(): Promise<void> {
    const saved = loadSettings().ruleset;
    const ruleset: Ruleset = saved === "domowe" ? "domowe" : "pod_bronia";
    try {
      await gd.loadGameData(import.meta.env.BASE_URL, ruleset);
      this.ruleset = ruleset;
      this.library = loadLibrary();
      this.treasures = loadTreasures();
      this.groups = loadGroups();
      this.ready = true;
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  setRuleset(ruleset: Ruleset): void {
    gd.setRuleset(ruleset);
    this.ruleset = ruleset;
    this.dataVersion++;
    saveSettings({ ruleset });
  }

  notify(message: string): void {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ""), 3000);
  }

  isSaved(id: string): boolean {
    return this.library.some((n) => n.id === id);
  }

  /** Zapisuje BN w bibliotece (ten sam id = aktualizacja). */
  saveNpc(npc: Npc): void {
    const copy = $state.snapshot(npc) as Npc;
    const i = this.library.findIndex((n) => n.id === copy.id);
    if (i >= 0) this.library[i] = copy;
    else this.library.push(copy);
    this.persist();
  }

  saveMany(npcs: Npc[]): void {
    for (const npc of npcs) {
      const copy = $state.snapshot(npc) as Npc;
      const i = this.library.findIndex((n) => n.id === copy.id);
      if (i >= 0) this.library[i] = copy;
      else this.library.push(copy);
    }
    this.persist();
  }

  /** Zapisuje przedmiot magiczny albo lup w osobnej bibliotece; zwraca id wpisu. */
  saveTreasure(entry: Omit<SavedTreasure, "id" | "savedAt">): string {
    const id = newId();
    this.treasures = [...this.treasures, { ...($state.snapshot(entry) as typeof entry), id, savedAt: new Date().toISOString() }];
    this.persistTreasures();
    return id;
  }

  removeTreasure(id: string): void {
    this.treasures = this.treasures.filter((t) => t.id !== id);
    this.persistTreasures();
  }

  replaceTreasures(list: SavedTreasure[]): void {
    this.treasures = list;
    this.persistTreasures();
  }

  private persistTreasures(): void {
    if (!saveTreasures($state.snapshot(this.treasures) as SavedTreasure[])) {
      this.notify("Nie udało się zapisać skarbów w przeglądarce — wyeksportuj je do pliku JSON.");
    }
  }

  /** Zapisuje grupe (ten sam id = aktualizacja); zwraca id wpisu. */
  saveGroup(entry: Omit<SavedGroup, "id" | "savedAt"> & { id?: string }): string {
    const copy = $state.snapshot(entry) as typeof entry;
    const id = copy.id ?? newId();
    const saved: SavedGroup = { ...copy, id, savedAt: new Date().toISOString() };
    const i = this.groups.findIndex((g) => g.id === id);
    if (i >= 0) this.groups[i] = saved;
    else this.groups.push(saved);
    this.persistGroups();
    return id;
  }

  removeGroup(id: string): void {
    this.groups = this.groups.filter((g) => g.id !== id);
    this.persistGroups();
  }

  /** Import grup: ten sam id nadpisuje, nowe sa dopisywane. */
  mergeGroups(incoming: SavedGroup[]): { added: number; updated: number } {
    let added = 0;
    let updated = 0;
    for (const g of incoming) {
      const i = this.groups.findIndex((x) => x.id === g.id);
      if (i >= 0) {
        this.groups[i] = g;
        updated++;
      } else {
        this.groups.push(g);
        added++;
      }
    }
    this.persistGroups();
    return { added, updated };
  }

  private persistGroups(): void {
    if (!saveGroups($state.snapshot(this.groups) as SavedGroup[])) {
      this.notify("Nie udało się zapisać grup w przeglądarce — wyeksportuj je do pliku JSON.");
    }
  }

  removeNpc(id: string): void {
    this.library = this.library.filter((n) => n.id !== id);
    this.persist();
  }

  replaceLibrary(npcs: Npc[]): void {
    this.library = npcs;
    this.persist();
  }

  private persist(): void {
    if (!saveLibrary($state.snapshot(this.library) as Npc[])) {
      this.notify("Nie udało się zapisać biblioteki w przeglądarce — wyeksportuj ją do pliku JSON.");
    }
  }
}

export const app = new AppState();
