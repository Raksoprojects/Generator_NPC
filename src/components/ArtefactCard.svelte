<script lang="ts">
  import { untrack } from "svelte";
  import RichText from "./RichText.svelte";
  import { app } from "../lib/app.svelte";
  import { artefactToText, type Artefact } from "../lib/artefacts";
  import { qualityDescription } from "../lib/equipment";
  import { copyText } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { craftDescription } from "../lib/treasures";

  let {
    artefact,
    onreroll,
    onremove,
    compact = false
  }: {
    artefact: Artefact;
    onreroll?: () => void;
    onremove?: () => void;
    /** Zwiniety do naglowka (np. na liscie lupow) - rozwija sie po kliknieciu. */
    compact?: boolean;
  } = $props();

  // compact ustawia tylko stan poczatkowy - potem karte rozwija klikniecie.
  let open = $state(untrack(() => !compact));
  let spellOpen = $state<string | null>(null);

  const describe = (q: string) => craftDescription(q) ?? qualityDescription(q.replace(/\s+\d+$/, "")) ?? "";

  async function copy() {
    const ok = await copyText(artefactToText(artefact));
    app.notify(ok ? "Skopiowano opis przedmiotu." : "Nie udało się skopiować.");
  }
</script>

<article class="artefact panel" class:cursed={artefact.cursed}>
  <header class="head">
    <button class="title tap" onclick={() => (open = !open)} aria-expanded={open}>
      <span class="icon">{artefact.cursed ? "☠" : "✦"}</span>
      <span class="name">{artefact.name}</span>
      <span class="text-dim small">{artefact.categoryName}</span>
    </button>
    <div class="actions">
      {#if onreroll}<button class="btn-sm ghost" onclick={onreroll} title="Wylosuj ponownie z tymi samymi ustawieniami">🎲</button>{/if}
      <button class="btn-sm ghost" onclick={copy} title="Kopiuj opis">Kopiuj</button>
      {#if onremove}<button class="btn-sm ghost" onclick={onremove} aria-label="Usuń">✕</button>{/if}
    </div>
  </header>

  {#if open}
    <div class="body">
      <p class="meta">
        {#if artefact.wp}<span class="chip accent" title="Siła Woli przedmiotu — opanowanie: Przeciwstawny Test Siły Woli">SW {artefact.wp}</span>{/if}
        {#if artefact.limit}<span class="chip" title="Ile takich przedmiotów może działać naraz">limit: {artefact.limit}</span>{/if}
        {#each artefact.qualities as q (q)}<span class="chip success" title={describe(q)}>{q}</span>{/each}
        {#each artefact.flaws as q (q)}<span class="chip warning" title={describe(q)}>{q}</span>{/each}
      </p>

      {#each artefact.lines as l, i (i)}
        <div class="line">
          {#if l.label}<b class="label">{l.label}</b>{/if}
          <RichText text={l.text} />
        </div>
      {/each}

      {#if artefact.spells.length}
        <p class="spells">
          <span class="text-dim small">Opisy zaklęć:</span>
          {#each artefact.spells as s (s)}
            <button class="chip tap" class:active={spellOpen === s} onclick={() => (spellOpen = spellOpen === s ? null : s)}>{s}</button>
          {/each}
        </p>
        {#if spellOpen}
          {@const sp = gd.getSpell(spellOpen)}
          {#if sp}
            <div class="spell">
              <b>{sp.name}</b>
              <RichText
                meta={[["PZ", String(sp.cn)], ["Zasięg", sp.range], ["Cel", sp.target], ["Czas trwania", sp.duration]]}
                text={sp.description}
                source={`${sp.source}, s. ${sp.page}`}
              />
            </div>
          {/if}
        {/if}
      {/if}

      {#if artefact.curse}
        <div class="curse">
          <b>☠ Klątwa — {artefact.curse.name}</b>{#if artefact.curse.duration}<span class="text-dim small"> ({artefact.curse.duration})</span>{/if}
          <RichText text={artefact.curse.text} />
          <p class="text-dim small">Klątwa działa po opanowaniu albo pierwszym użyciu; zdejmuje ją Talent Zdjęcie Klątwy (PZ = 2 × BSW przedmiotu) albo świątynia Shallyi.</p>
        </div>
      {/if}

      <p class="source text-dim small">{artefact.source}</p>
    </div>
  {/if}
</article>

<style>
  .artefact {
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .artefact.cursed {
    border-color: var(--danger);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    background: transparent;
    border: none;
    padding: 0;
    min-height: auto;
    text-align: left;
  }

  .icon {
    color: var(--accent-strong);
  }

  .cursed .icon {
    color: var(--danger-strong);
  }

  .name {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
    font-weight: 600;
  }

  .small {
    font-size: var(--fs-sm);
  }

  .actions {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .meta,
  .spells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    align-items: center;
  }

  .line {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }

  button.chip.tap {
    min-height: auto;
    cursor: pointer;
  }

  .chip.active {
    border-color: var(--accent);
    color: var(--accent-strong);
  }

  .spell,
  .curse {
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--accent);
    background: var(--bg-panel-2);
    font-size: var(--fs-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .curse {
    border-left-color: var(--danger-strong);
  }

  .curse p,
  .source {
    margin: 0;
  }
</style>
