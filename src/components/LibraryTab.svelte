<script lang="ts">
  import NpcCard from "./NpcCard.svelte";
  import { app } from "../lib/app.svelte";
  import { downloadText, pickFile } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { newId } from "../lib/generator";
  import { libraryToJson, mergeLibrary, parseNpcJson } from "../lib/library";
  import { careerLevelInfo } from "../lib/npc";
  import { TIER_IDS, type Npc } from "../lib/types";

  let query = $state("");
  let archetype = $state("");
  let tier = $state("");
  let group = $state("");
  /** Kopia robocza otwartego BN - zmiany trafiaja do biblioteki po "Zapisz zmiany". */
  let open = $state<Npc | null>(null);

  let groups = $derived([...new Set(app.library.map((n) => n.group).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pl")));

  let filtered = $derived.by(() => {
    const q = gd.normalize(query);
    return app.library
      .filter((n) => !archetype || n.archetype === archetype)
      .filter((n) => !tier || n.tier === tier)
      .filter((n) => !group || n.group === group)
      .filter((n) => !q || gd.normalize(`${n.name} ${n.label ?? ""} ${n.race} ${n.archetype} ${n.group ?? ""} ${currentTitle(n)}`).includes(q))
      .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "", "pl") || a.name.localeCompare(b.name, "pl"));
  });

  function currentTitle(n: Npc): string {
    const last = n.careerPath[n.careerPath.length - 1];
    return last ? careerLevelInfo(last.profession, last.level).title : "";
  }

  function toggle(n: Npc) {
    open = open?.id === n.id ? null : ($state.snapshot(n) as Npc);
  }

  function duplicate(n: Npc) {
    const copy = { ...($state.snapshot(n) as Npc), id: newId(), name: `${n.name} (kopia)`, createdAt: new Date().toISOString() };
    app.saveNpc(copy);
    open = copy;
  }

  function remove(n: Npc) {
    if (!confirm(`Usunąć „${n.name}” z biblioteki?`)) return;
    app.removeNpc(n.id);
    if (open?.id === n.id) open = null;
  }

  function exportAll() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`biblioteka_bn_${stamp}.json`, libraryToJson($state.snapshot(app.library) as Npc[]));
  }

  function exportFiltered() {
    downloadText(`bn_${group || "wybrane"}.json`.replace(/\s+/g, "_"), libraryToJson($state.snapshot(filtered) as Npc[]));
  }

  async function importJson() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const incoming = parseNpcJson(await file.text());
      if (!incoming.length) {
        app.notify("W pliku nie znaleziono żadnego BN.");
        return;
      }
      const { merged, added, updated } = mergeLibrary($state.snapshot(app.library) as Npc[], incoming);
      app.replaceLibrary(merged);
      app.notify(`Import: dodano ${added}, zaktualizowano ${updated}.`);
    } catch (e) {
      app.notify(`Błąd importu: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
</script>

<section class="tab">
  <div class="panel controls">
    <div class="filters">
      <input class="search" type="search" placeholder="Szukaj: imię, profesja, grupa…" bind:value={query} />
      <select bind:value={archetype} aria-label="Archetyp">
        <option value="">wszystkie archetypy</option>
        {#each gd.allArchetypeNames() as a (a)}<option value={a}>{a}</option>{/each}
      </select>
      <select bind:value={tier} aria-label="Poziom">
        <option value="">wszystkie poziomy</option>
        {#each TIER_IDS as t (t)}<option value={t}>{gd.getTier(t).label}</option>{/each}
      </select>
      <select bind:value={group} aria-label="Grupa">
        <option value="">wszystkie grupy</option>
        {#each groups as g (g)}<option value={g}>{g}</option>{/each}
      </select>
    </div>
    <div class="actions">
      <span class="text-dim">{filtered.length} z {app.library.length}</span>
      <button class="btn-sm" onclick={importJson}>Importuj JSON</button>
      <button class="btn-sm" onclick={exportFiltered} disabled={!filtered.length}>Eksportuj widoczne</button>
      <button class="btn-sm" onclick={exportAll} disabled={!app.library.length}>Eksportuj całą bibliotekę</button>
    </div>
    <p class="text-dim note">
      Biblioteka jest zapisana w tej przeglądarce. Eksport do pliku JSON to kopia zapasowa
      i sposób na przeniesienie BN na inne urządzenie albo zbudowanie własnej bazy gotowych postaci.
    </p>
  </div>

  {#if !app.library.length}
    <p class="text-dim empty">Brak zapisanych BN. Wygeneruj postać i kliknij „Zapisz”.</p>
  {/if}

  <ul class="list">
    {#each filtered as n (n.id)}
      <li>
        <div class="entry panel" class:active={open?.id === n.id}>
          <button class="entry-main" onclick={() => toggle(n)}>
            <b>{n.name}</b>
            {#if n.label}<span class="chip accent">{n.label}</span>{/if}
            <span class="text-dim">{n.race} · {n.archetype} · {gd.getTier(n.tier)?.label}</span>
            <span class="title">{currentTitle(n)}</span>
            {#if n.group}<span class="chip">{n.group}</span>{/if}
          </button>
          <div class="entry-actions">
            <button class="btn-sm ghost" title="Duplikuj" onclick={() => duplicate(n)}>Kopia</button>
            <button class="btn-sm ghost" title="Usuń z biblioteki" onclick={() => remove(n)}>✕</button>
          </div>
        </div>
        {#if open?.id === n.id}
          <NpcCard bind:npc={open} onremove={() => (open = null)} removeLabel="Zamknij" />
        {/if}
      </li>
    {/each}
  </ul>
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

  .filters,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .search {
    flex: 1 1 calc(220px * var(--ui-scale));
  }

  .note {
    margin: 0;
    font-size: var(--fs-sm);
  }

  .empty {
    padding: var(--space-3);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .list li {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
  }

  .entry.active {
    border-color: var(--accent);
  }

  .entry-main {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    text-align: left;
    background: transparent;
    border: none;
    min-width: 0;
  }

  .title {
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }

  .entry-actions {
    display: flex;
    gap: var(--space-1);
  }
</style>
