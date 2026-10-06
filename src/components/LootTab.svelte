<script lang="ts">
  import LootCard from "./LootCard.svelte";
  import { rollArtefact } from "../lib/artefacts";
  import { lootLevels, lootLocations, rollLoot, type LootOptions, type LootResult } from "../lib/loot";

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
    <LootCard
      loot={e.loot}
      onreroll={() => reroll(e.id)}
      onremove={() => (results = results.filter((x) => x.id !== e.id))}
      onrerollArtefact={(k) => rerollArtefact(e.id, k)}
    />
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

  .empty {
    padding: var(--space-3);
  }

  @media (max-width: 640px) {
    .generate {
      flex: 1;
    }
  }
</style>
