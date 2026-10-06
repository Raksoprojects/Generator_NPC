<script lang="ts">
  import ArtefactCard from "./ArtefactCard.svelte";
  import LootCard from "./LootCard.svelte";
  import { app } from "../lib/app.svelte";
  import { downloadText, pickFile } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { parseTreasuresJson, treasuresToJson, type SavedTreasure } from "../lib/library";

  let kind = $state<"" | "artefact" | "loot">("");
  let query = $state("");

  let filtered = $derived.by(() => {
    const q = gd.normalize(query);
    return app.treasures
      .filter((t) => !kind || t.kind === kind)
      .filter((t) => !q || gd.normalize(`${t.name} ${t.artefact?.categoryName ?? ""} ${t.loot?.location.group ?? ""}`).includes(q))
      .slice()
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  });

  function remove(t: SavedTreasure) {
    if (!confirm(`Usunąć „${t.name}” z zapisanych?`)) return;
    app.removeTreasure(t.id);
  }

  function exportAll() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`skarby_${stamp}.json`, treasuresToJson($state.snapshot(app.treasures) as SavedTreasure[]));
  }

  async function importJson() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const incoming = parseTreasuresJson(await file.text());
      const known = new Set(app.treasures.map((t) => t.id));
      const added = incoming.filter((t) => !known.has(t.id));
      app.replaceTreasures([...app.treasures, ...added]);
      app.notify(`Wczytano ${added.length} pozycji (pominięto ${incoming.length - added.length} już zapisanych).`);
    } catch (e) {
      app.notify(e instanceof Error ? e.message : "Nie udało się wczytać pliku.");
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleDateString("pl-PL");
</script>

<section class="tab">
  <div class="panel controls">
    <div class="row">
      <div class="seg" role="group" aria-label="Rodzaj">
        <button class="seg-opt" class:active={kind === ""} onclick={() => (kind = "")}>Wszystko ({app.treasures.length})</button>
        <button class="seg-opt" class:active={kind === "artefact"} onclick={() => (kind = "artefact")}>Przedmioty</button>
        <button class="seg-opt" class:active={kind === "loot"} onclick={() => (kind = "loot")}>Łupy</button>
      </div>
      <input type="search" placeholder="Szukaj (nazwa, kategoria, miejsce)" bind:value={query} />
    </div>
    <div class="row">
      <button class="ghost" onclick={exportAll} disabled={!app.treasures.length}>Eksportuj do pliku JSON</button>
      <button class="ghost" onclick={importJson}>Wczytaj z pliku JSON</button>
      <span class="text-dim small">Zapisane są w tej przeglądarce — eksport to kopia zapasowa i sposób na przeniesienie ich gdzie indziej.</span>
    </div>
  </div>

  {#each filtered as t (t.id)}
    <div class="entry">
      <span class="text-dim small">zapisano {when(t.savedAt)}</span>
      {#if t.kind === "artefact" && t.artefact}
        <ArtefactCard artefact={t.artefact} compact saveable={false} onremove={() => remove(t)} />
      {:else if t.loot}
        <LootCard loot={t.loot} saveable={false} onremove={() => remove(t)} />
      {/if}
    </div>
  {:else}
    <p class="text-dim empty">
      {app.treasures.length ? "Nic nie pasuje do filtra." : "Brak zapisanych przedmiotów i łupów — użyj przycisku „Zapisz” w zakładkach Przedmioty i Łupy."}
    </p>
  {/each}
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .row input {
    flex: 1;
    min-width: calc(200px * var(--ui-scale));
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .seg-opt {
    background: var(--bg-panel);
    color: var(--text-muted);
    border: none;
    border-right: 1px solid var(--border);
    border-radius: 0;
    font-weight: 600;
  }

  .seg-opt:last-child {
    border-right: none;
  }

  .seg-opt.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .small {
    font-size: var(--fs-sm);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty {
    padding: var(--space-3);
  }
</style>
