<script lang="ts">
  import { formatText } from "../lib/richText";

  /** Pola naglowka (PZ, Zasięg...), tekst opisu i zrodlo. */
  let { meta = [], text = "", source = "" }: { meta?: [string, string][]; text?: string; source?: string } = $props();
  let blocks = $derived(formatText(text));
</script>

<div class="rich">
  {#if meta.length}
    <dl class="meta">
      {#each meta as [k, v] (k)}
        <dt>{k}</dt>
        <dd>{v}</dd>
      {/each}
    </dl>
  {/if}
  {#each blocks as b, i (i)}
    {#if b.type === "p"}
      <p>{#if b.label}<b>{b.label}:</b> {/if}{b.text}</p>
    {:else}
      <ul>
        {#each b.items as it, j (j)}
          <li>{#if it.label}<b>{it.label}</b> {/if}{it.text}</li>
        {/each}
      </ul>
    {/if}
  {/each}
  {#if source}<p class="source text-dim">{source}</p>{/if}
</div>

<style>
  .rich {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    line-height: 1.45;
  }

  .rich p,
  .rich ul {
    margin: 0;
  }

  .rich ul {
    padding-left: 1.2em;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px var(--space-2);
    margin: 0 0 var(--space-1);
    font-size: var(--fs-sm);
  }

  .meta dt {
    color: var(--text-muted);
  }

  .meta dd {
    margin: 0;
  }

  .source {
    font-size: var(--fs-sm);
  }
</style>
