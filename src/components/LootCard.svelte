<script lang="ts">
  import ArtefactCard from "./ArtefactCard.svelte";
  import { app } from "../lib/app.svelte";
  import { copyText } from "../lib/files";
  import { formatPence, lootToText, type LootResult } from "../lib/loot";

  let {
    loot,
    onreroll,
    onremove,
    onrerollArtefact,
    saveable = true
  }: {
    loot: LootResult;
    onreroll?: () => void;
    onremove?: () => void;
    onrerollArtefact?: (index: number) => void;
    saveable?: boolean;
  } = $props();

  const STATUS_LABEL = { brąz: "Brąz", srebro: "Srebro", złoto: "Złoto" } as const;

  let savedFor = $state<LootResult | null>(null);

  let coins = $derived(
    [loot.money.zk && `${loot.money.zk} zk`, loot.money.s && `${loot.money.s} s`, loot.money.p && `${loot.money.p} p`].filter(Boolean) as string[]
  );

  function save() {
    const name = `${loot.location.name} (poziom ${loot.level}: ${loot.levelLabel})`;
    app.saveTreasure({ kind: "loot", name, loot });
    savedFor = loot;
    app.notify(`Zapisano łup: ${name}`);
  }

  async function copy() {
    const ok = await copyText(lootToText(loot));
    app.notify(ok ? "Skopiowano łup." : "Nie udało się skopiować.");
  }
</script>

<article class="loot panel">
  <header class="head">
    <div>
      <h3>{loot.location.name} <span class="text-dim small">· {STATUS_LABEL[loot.location.status]} · poziom {loot.level}: {loot.levelLabel}</span></h3>
      <p class="text-dim small">{loot.location.description}</p>
    </div>
    <div class="actions">
      {#if onreroll}<button class="btn-sm ghost" onclick={onreroll} title="Wylosuj ponownie to samo miejsce">🎲</button>{/if}
      {#if saveable}
        <button class="btn-sm" class:success={savedFor === loot} onclick={save} disabled={savedFor === loot} title="Zapisz w zakładce zapisanych skarbów">{savedFor === loot ? "Zapisano" : "Zapisz"}</button>
      {/if}
      <button class="btn-sm ghost" onclick={copy}>Kopiuj</button>
      {#if onremove}<button class="btn-sm ghost" onclick={onremove} aria-label="Usuń">✕</button>{/if}
    </div>
  </header>

  {#if coins.length}
    <p class="row"><span class="lbl">Pieniądze:</span> {#each coins as c (c)}<span class="chip accent">{c}</span>{/each}</p>
  {/if}
  {#each loot.sections as s (s.label)}
    <div class="section">
      <span class="lbl">{s.label}:</span>
      <ul>
        {#each s.items as i, k (k)}
          <li>{i.name}{#if i.value}<span class="text-dim">{" — "}{i.value}</span>{/if}{#if i.note}<span class="chip warning flaw">{i.note}</span>{/if}</li>
        {/each}
      </ul>
    </div>
  {/each}
  {#if !coins.length && !loot.sections.length && !loot.artefacts.length}
    <p class="text-dim">Nic wartościowego — ktoś był tu przed bohaterami.</p>
  {/if}
  {#if loot.totalPence}
    <p class="row"><span class="lbl">Łączna wartość pieniędzy i kosztowności:</span> <b>{formatPence(loot.totalPence)}</b></p>
  {/if}
  {#if loot.artefacts.length}
    <div class="magic">
      <span class="lbl">Przedmioty magiczne (kliknij, by rozwinąć):</span>
      {#each loot.artefacts as a, k (k)}
        <ArtefactCard artefact={a} compact onreroll={onrerollArtefact ? () => onrerollArtefact(k) : undefined} />
      {/each}
    </div>
  {/if}
</article>

<style>
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

  .small {
    font-size: var(--fs-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
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
</style>
