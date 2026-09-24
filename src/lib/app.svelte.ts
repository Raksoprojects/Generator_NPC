/**
 * Reaktywny stan aplikacji (Svelte 5 runes): dane gry, wariant zasad,
 * biblioteka zapisanych BN i komunikaty. Logika generowania zyje w
 * generator.ts - tutaj tylko jej wywolania i trwalosc.
 */

import * as gd from "./gameData";
import { loadLibrary, loadSettings, saveLibrary, saveSettings } from "./library";
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
  toast = $state("");
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  async init(): Promise<void> {
    const saved = loadSettings().ruleset;
    const ruleset: Ruleset = saved === "domowe" ? "domowe" : "pod_bronia";
    try {
      await gd.loadGameData(import.meta.env.BASE_URL, ruleset);
      this.ruleset = ruleset;
      this.library = loadLibrary();
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
