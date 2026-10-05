<script lang="ts">
  import ArtefactCard from "./ArtefactCard.svelte";
  import { app } from "../lib/app.svelte";
  import { rollArtefact } from "../lib/artefacts";
  import { copyText } from "../lib/files";
  import { formatPence, lootLevels, lootLocations, lootToText, rollLoot, type LootOptions, type LootResult } from "../lib/loot";

  type Mode = "losowy" | "polLosowy" | "wlasny";
  const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: "losowy", label: "Losowy", hint: "Losowe miejsce i jego zamożność — jedno kliknięcie." },
    { id: "polLosowy", label: "Pół-losowy", hint: "Wybierz rodzaj miejsca albo konkretne miejsce i poziom, resztę wylosujemy." },
    { id: "wlasny", label: "Własny", hint: "Wybierasz miejsce, poziom i to, czego szukają bohaterowie." }
  ];

  const locations = lootLocations();
  const levels = lootLevels();
  const groups = [...new Set(locations.map((l) => l.group))];
  const STATUS_LABEL = { brąz: "Brąz", srebro: "Srebro", złoto: "Złoto" } as const;

  let mode = $state<Mode>("losowy");
  let group = $state("");
  let location = $state("");
  let level = $state<number | "">("");
  let money = $state(true);
  let valuables = $state(true);
  let goods = $state(true);
  let magic = $state(true);
  let allowCursed = $state(true);

  let groupLocations = $derived(locations.filter((l) => !group || l.group === group));
  let chosen = $derived(locations.find((l) => l.id === location));

  $effect(() => {
    if (location && group && chosen?.group !== group) location = "";
  });
  $effect(() => {
    if (mode !== "wlasny") return;
    if (!location) location = locations[0].id;
    if (level === "") level = 1;
  });

  interface Entry {
    id: number;
    spec: LootOptions;
    loot: LootResult;
  }
  let results = $state<Entry[]>([]);
  let nextId = 0;

  function spec(): LootOptions {
    if (mode === "losowy") return {};
    const base: LootOptions = { location: location || undefined, group: group || undefined, level: level === "" ? undefined : Number(level), allowCursed };
    return mode === "wlasny" ? { ...base, money, valuables, goods, magic } : base;
  }

  function generate() {
    const s = spec();
    results = [{ id: nextId++, spec: s, loot: rollLoot(s) }, ...results].slice(0, 20);
  }

  function reroll(id: number) {
    results = results.map((e) => (e.id === id ? { ...e, loot: rollLoot({ ...e.spec, location: e.loot.location.id, level: e.loot.level }) } : e));
  }

  function rerollArtefact(id: number, index: number) {
    results = results.map((e) => {
      if (e.id !== id) return e;
      const artefacts = [...e.loot.artefacts];
      const old = artefacts[index];
      artefacts[index] = rollArtefact({ category: old.category, allowCursed: e.spec.allowCursed });
      return { ...e, loot: { ...e.loot, artefacts } };
    });
  }

  async function copy(r: LootResult) {
    const ok = await copyText(lootToText(r));
    app.notify(ok ? "Skopiowano łup." : "Nie udało się skopiować.");
  }

  const coins = (r: LootResult) =>
    [r.money.zk && `${r.money.zk} zk`, r.money.s && `${r.money.s} s`, r.money.p && `${r.money.p} p`].filter(Boolean) as string[];
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
        <label>Rodzaj miejsca
          <select bind:value={group}>
            <option value="">— wszystkie —</option>
            {#each groups as g (g)}<option value={g}>{g}</option>{/each}
          </select>
        </label>
        <label>Miejsce
          <select bind:value={location}>
            {#if mode === "polLosowy"}<option value="">— losowe —</option>{/if}
            {#each groupLocations as l (l.id)}<option value={l.id}>{l.name} ({STATUS_LABEL[l.status]})</option>{/each}
          </select>
        </label>
        <label>Poziom miejsca
          <select bind:value={level}>
            {#if mode === "polLosowy"}<option value="">— losowy —</option>{/if}
            {#each levels as l (l.level)}<option value={l.level}>{l.level} — {l.label}</option>{/each}
          </select>
        </label>
      </div>
      {#if chosen}<p class="intro text-dim">{chosen.description}{chosen.added ? " (miejsce dodane w generatorze, poza źródłem)" : ""}</p>{/if}
      <div class="checks">
        {#if mode === "wlasny"}
          <label class="check"><input type="checkbox" bind:checked={money} /> Pieniądze</label>
          <label class="check"><input type="checkbox" bind:checked={valuables} /> Kosztowności</label>
          <label class="check"><input type="checkbox" bind:checked={goods} /> Przedmioty codzienne i broń</label>
          <label class="check"><input type="checkbox" bind:checked={magic} /> Przedmioty magiczne</label>
        {/if}
        <label class="check"><input type="checkbox" bind:checked={allowCursed} /> Dopuszczaj przedmioty przeklęte</label>
      </div>
    {/if}

    <div class="buttons">
      <button class="primary generate" onclick={generate}>💰 Losuj łup</button>
      {#if results.length}<button class="ghost" onclick={() => (results = [])}>Wyczyść</button>{/if}
    </div>
    <p class="text-dim small">
      Wg tabeli skarbów nieoficjalnego kompendium <i>Treasure &amp; Artefacts</i>. Poziom miejsca mnoży pieniądze i wartość kosztowności (jak Tier w źródle),
      a szanse na przedmioty magiczne rosną o połowę za każdy poziom. Kości k10 i k100 „wybuchają” — przy maksimum rzuca się jeszcze raz.
    </p>
  </div>

  {#each results as e (e.id)}
    {@const r = e.loot}
    <article class="loot panel">
      <header class="head">
        <div>
          <h3>{r.location.name} <span class="text-dim small">· {STATUS_LABEL[r.location.status]} · poziom {r.level}: {r.levelLabel}</span></h3>
          <p class="text-dim small">{r.location.description}</p>
        </div>
        <div class="actions">
          <button class="btn-sm ghost" onclick={() => reroll(e.id)} title="Wylosuj ponownie to samo miejsce">🎲</button>
          <button class="btn-sm ghost" onclick={() => copy(r)}>Kopiuj</button>
          <button class="btn-sm ghost" onclick={() => (results = results.filter((x) => x.id !== e.id))} aria-label="Usuń">✕</button>
        </div>
      </header>

      {#if coins(r).length}
        <p class="row"><span class="lbl">Pieniądze:</span> {#each coins(r) as c (c)}<span class="chip accent">{c}</span>{/each}</p>
      {/if}
      {#each r.sections as s (s.label)}
        <div class="section">
          <span class="lbl">{s.label}:</span>
          <ul>
            {#each s.items as i, k (k)}
              <li>{i.name}{#if i.value}<span class="text-dim">{" — "}{i.value}</span>{/if}{#if i.note}<span class="chip warning flaw">{i.note}</span>{/if}</li>
            {/each}
          </ul>
        </div>
      {/each}
      {#if !coins(r).length && !r.sections.length && !r.artefacts.length}
        <p class="text-dim">Nic wartościowego — ktoś był tu przed bohaterami.</p>
      {/if}
      {#if r.totalPence}
        <p class="row"><span class="lbl">Łączna wartość pieniędzy i kosztowności:</span> <b>{formatPence(r.totalPence)}</b></p>
      {/if}
      {#if r.artefacts.length}
        <div class="magic">
          <span class="lbl">Przedmioty magiczne (kliknij, by rozwinąć):</span>
          {#each r.artefacts as a, k (k)}
            <ArtefactCard artefact={a} compact onreroll={() => rerollArtefact(e.id, k)} />
          {/each}
        </div>
      {/if}
    </article>
  {:else}
    <p class="text-dim empty">Wybierz metodę i kliknij „Losuj łup”.</p>
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
  .buttons,
  .checks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
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
  }

  .form label {
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

  .loot {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .head h3 {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
  }

  .head p {
    margin: 2px 0 0;
  }

  .actions {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    margin: 0;
  }

  .lbl {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    font-weight: 600;
  }

  .section ul {
    margin: 2px 0 0;
    padding-left: 1.2em;
    columns: 2 calc(220px * var(--ui-scale));
    column-gap: var(--space-4);
  }

  .section li {
    break-inside: avoid;
  }

  .flaw {
    margin-left: var(--space-1);
    padding: 0 var(--space-1);
  }

  .magic {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
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
