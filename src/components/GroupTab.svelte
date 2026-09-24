<script lang="ts">
  import NpcCard from "./NpcCard.svelte";
  import { app } from "../lib/app.svelte";
  import { copyText } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { generateNpc, racesForArchetype } from "../lib/generator";
  import { computeNpc, npcToText } from "../lib/npc";
  import { TIER_IDS, type GroupRow, type Npc } from "../lib/types";

  const presets = gd.getGroupPresets();
  const presetNames = Object.keys(presets);

  let presetName = $state(presetNames[0] ?? "");
  let groupName = $state(presetNames[0] ?? "Grupa");
  let rows = $state<GroupRow[]>(structuredClone(presets[presetNames[0]]?.rows ?? []));
  let members = $state<Npc[]>([]);
  let collapsed = $state<Record<string, boolean>>({});

  function loadPreset() {
    const p = presets[presetName];
    if (!p) return;
    rows = structuredClone(p.rows);
    groupName = presetName;
  }

  function addRow() {
    rows.push({ count: 1, archetype: gd.allArchetypeNames()[0], tier: "slaby" });
  }

  function generateGroup() {
    const out: Npc[] = [];
    for (const row of rows) {
      const count = Math.max(0, Math.min(30, Math.trunc(row.count)));
      for (let i = 0; i < count; i++) {
        const npc = generateNpc({
          archetype: row.archetype,
          tier: row.tier,
          race: row.race || undefined,
          commander: row.commander,
          label: row.label || undefined
        });
        npc.group = groupName.trim() || undefined;
        out.push(npc);
      }
    }
    members = out;
    collapsed = {};
  }

  function summary(npc: Npc): string {
    const v = computeNpc(npc);
    return `WW ${v.chars.WW.total} · US ${v.chars.US.total} · Wt ${v.chars.Wt.total} · Żyw ${v.wounds}`;
  }

  function saveAll() {
    app.saveMany(members);
    app.notify(`Zapisano ${members.length} BN w bibliotece.`);
  }

  async function copyAll() {
    const text = members.map((n) => npcToText($state.snapshot(n) as Npc)).join("\n\n");
    const ok = await copyText(text);
    app.notify(ok ? "Skopiowano całą grupę." : "Nie udało się skopiować.");
  }

  function toggleAll(value: boolean) {
    collapsed = Object.fromEntries(members.map((m) => [m.id, value]));
  }
</script>

<section class="tab">
  <div class="panel controls">
    <div class="preset-row">
      <label>Gotowa grupa
        <select bind:value={presetName}>
          {#each presetNames as p (p)}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <button class="btn-sm" onclick={loadPreset}>Wczytaj</button>
      <span class="text-dim hint">{presets[presetName]?.description}</span>
    </div>

    <label class="group-name">Nazwa grupy
      <input type="text" bind:value={groupName} placeholder="np. Banda z traktu" />
    </label>

    <div class="rows">
      {#each rows as row, i (i)}
        <div class="row">
          <input class="count" type="number" min="1" max="30" bind:value={row.count} aria-label="Liczba" />
          <span class="x">×</span>
          <select bind:value={row.archetype} aria-label="Archetyp">
            {#each gd.allArchetypeNames() as a (a)}<option value={a}>{a}</option>{/each}
          </select>
          <select bind:value={row.tier} aria-label="Poziom">
            {#each TIER_IDS as t (t)}<option value={t}>{gd.getTier(t).label}</option>{/each}
          </select>
          <select bind:value={row.race} aria-label="Rasa">
            <option value={undefined}>rasa losowo</option>
            {#each racesForArchetype(row.archetype) as r (r)}<option value={r}>{r}</option>{/each}
          </select>
          <input class="label" type="text" placeholder="etykieta" bind:value={row.label} aria-label="Etykieta" />
          <label class="check"><input type="checkbox" bind:checked={row.commander} /> dowódca</label>
          <button class="btn-sm ghost" aria-label="Usuń wiersz" onclick={() => rows.splice(i, 1)}>✕</button>
        </div>
      {/each}
    </div>

    <div class="actions">
      <button class="btn-sm" onclick={addRow}>+ Dodaj wiersz</button>
      <button class="primary" onclick={generateGroup} disabled={!rows.length}>🎲 Generuj grupę</button>
    </div>
  </div>

  {#if members.length}
    <div class="panel result-bar">
      <strong>{groupName || "Grupa"}</strong>
      <span class="text-dim">{members.length} BN</span>
      <div class="actions">
        <button class="btn-sm ghost" onclick={() => toggleAll(true)}>Zwiń</button>
        <button class="btn-sm ghost" onclick={() => toggleAll(false)}>Rozwiń</button>
        <button class="btn-sm" onclick={copyAll}>Kopiuj wszystko</button>
        <button class="btn-sm success" onclick={saveAll}>Zapisz wszystkich</button>
      </div>
    </div>

    <div class="members">
      {#each members as m, i (m.id)}
        {#if collapsed[m.id]}
          <button class="panel collapsed" onclick={() => (collapsed[m.id] = false)}>
            <b>{m.name}</b>{#if m.label} <span class="chip accent">{m.label}</span>{/if}
            <span class="text-dim">{m.archetype} · {gd.getTier(m.tier).label}</span>
            <span class="stats-line">{summary(m)}</span>
          </button>
        {:else}
          <div class="member">
            <NpcCard bind:npc={members[i]} onremove={() => members.splice(i, 1)} removeLabel="Usuń z grupy" />
            <button class="btn-sm ghost collapse-btn" onclick={() => (collapsed[m.id] = true)}>Zwiń ▲</button>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
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

  .preset-row,
  .actions,
  .row,
  .result-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .preset-row {
    align-items: flex-end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  label.check {
    flex-direction: row;
  }

  .group-name {
    max-width: calc(320px * var(--ui-scale));
  }

  .hint {
    font-size: var(--fs-sm);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .row {
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-panel-2);
  }

  .count {
    width: calc(58px * var(--ui-scale));
  }

  .label {
    width: calc(130px * var(--ui-scale));
  }

  .x {
    color: var(--text-dim);
  }

  .result-bar {
    padding: var(--space-2) var(--space-4);
    justify-content: space-between;
  }

  .members {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .member {
    display: flex;
    flex-direction: column;
  }

  .collapse-btn {
    align-self: flex-end;
    margin-top: var(--space-1);
  }

  .collapsed {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    text-align: left;
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: var(--bg-panel);
  }

  .stats-line {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-size: var(--fs-sm);
  }
</style>
