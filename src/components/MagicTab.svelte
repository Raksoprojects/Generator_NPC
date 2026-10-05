<script lang="ts">
  import ArtefactCard from "./ArtefactCard.svelte";
  import { categoryChoices, categoryList, rollArtefact, type Artefact, type ArtefactOptions } from "../lib/artefacts";
  import * as gd from "../lib/gameData";

  type Mode = "losowy" | "polLosowy" | "wlasny";
  const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: "losowy", label: "Losowy", hint: "Kategoria i przedmiot z tabel k100 — jedno kliknięcie." },
    { id: "polLosowy", label: "Pół-losowy", hint: "Wybierz kategorię albo liczbę przedmiotów, resztę wylosujemy." },
    { id: "wlasny", label: "Własny", hint: "Wybierasz kategorię i konkretny przedmiot; losują się tylko jego szczegóły." }
  ];

  let mode = $state<Mode>("losowy");
  let category = $state("");
  let item = $state("");
  let count = $state(1);
  let allowCursed = $state(true);

  const categories = categoryList();
  let choices = $derived(category ? categoryChoices(category) : []);
  let intro = $derived(category ? gd.getArtefacts()?.categories[category]?.intro : undefined);

  // W trybie wlasnym zawsze jest kategoria i pozycja.
  $effect(() => {
    if (mode !== "wlasny") return;
    if (!category) category = categories[0].key;
    if (!choices.includes(item)) item = choices[0] ?? "";
  });

  interface Entry {
    id: number;
    spec: ArtefactOptions;
    artefact: Artefact;
  }
  let results = $state<Entry[]>([]);
  let nextId = 0;

  function spec(): ArtefactOptions {
    if (mode === "losowy") return {};
    if (mode === "polLosowy") return { category: category || undefined, allowCursed };
    return { category, item };
  }

  function generate() {
    const s = spec();
    const n = mode === "polLosowy" ? count : 1;
    const fresh = Array.from({ length: n }, () => ({ id: nextId++, spec: s, artefact: rollArtefact(s) }));
    results = [...fresh, ...results].slice(0, 30);
  }

  function reroll(id: number) {
    results = results.map((e) => (e.id === id ? { ...e, artefact: rollArtefact(e.spec) } : e));
  }

  function remove(id: number) {
    results = results.filter((e) => e.id !== id);
  }
</script>

<section class="tab">
  <div class="panel controls">
    <div class="mode-row">
      <div class="seg" role="group" aria-label="Metoda losowania">
        {#each MODES as m (m.id)}
          <button class="seg-opt" class:active={mode === m.id} aria-pressed={mode === m.id} onclick={() => (mode = m.id)}>{m.label}</button>
        {/each}
      </div>
      <span class="text-dim hint">{MODES.find((m) => m.id === mode)?.hint}</span>
    </div>

    {#if mode !== "losowy"}
      <div class="form">
        <label>Kategoria
          <select bind:value={category}>
            {#if mode === "polLosowy"}<option value="">— losowa (k100) —</option>{/if}
            {#each categories as c (c.key)}<option value={c.key}>{c.name}</option>{/each}
          </select>
        </label>
        {#if mode === "wlasny"}
          <label>Przedmiot
            <select bind:value={item}>
              {#each choices as c (c)}<option value={c}>{c}</option>{/each}
            </select>
          </label>
        {:else}
          <label>Liczba przedmiotów
            <select bind:value={count}>
              {#each [1, 2, 3, 4, 5, 6] as n (n)}<option value={n}>{n}</option>{/each}
            </select>
          </label>
          <label class="check"><input type="checkbox" bind:checked={allowCursed} /> Dopuszczaj przedmioty przeklęte</label>
        {/if}
      </div>
      {#if intro}<p class="intro text-dim">{intro}</p>{/if}
    {/if}

    <div class="buttons">
      <button class="primary generate" onclick={generate}>✦ Losuj przedmiot{mode === "polLosowy" && count > 1 ? "y" : ""}</button>
      {#if results.length}<button class="ghost" onclick={() => (results = [])}>Wyczyść</button>{/if}
    </div>
    <p class="text-dim small">
      Źródło: nieoficjalne kompendium <i>Treasure &amp; Artefacts</i> (przełożone); zaklęcia z polskiej bazy, runy krasnoludzkie z <i>Podręcznika Gracza: Krasnoludy</i>,
      Broń Chaosu z <i>Warriors of Chaos</i>. Magiczne przedmioty to rzadkość — wiele z nich jest przeklętych.
    </p>
  </div>

  {#each results as e (e.id)}
    <ArtefactCard artefact={e.artefact} onreroll={() => reroll(e.id)} onremove={() => remove(e.id)} />
  {:else}
    <p class="text-dim empty">Wybierz metodę i kliknij „Losuj przedmiot”.</p>
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
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .mode-row,
  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
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

  .hint,
  .small,
  .intro {
    font-size: var(--fs-sm);
    margin: 0;
  }

  .form {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(200px * var(--ui-scale)), 1fr));
    gap: var(--space-2) var(--space-3);
    align-items: end;
  }

  .form label:not(.check) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  .generate {
    font-size: var(--fs-base);
    padding: var(--space-2) var(--space-4);
  }

  .empty {
    padding: var(--space-3);
  }

  @media (max-width: 640px) {
    .generate {
      flex: 1;
    }
  }
</style>
