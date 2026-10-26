<script lang="ts">
  /**
   * Edytor sciezki profesji: kroki po kolei (ostatni = obecna profesja) z poziomem docelowym.
   * Poziom "auto" - program dobiera sam (wg PD). Pusta ostatnia profesja - wg archetypu.
   */
  import * as gd from "../lib/gameData";
  import type { PathStep } from "../lib/generator";
  import type { Sex } from "../lib/types";

  let {
    path = $bindable(),
    professions,
    sex = "M",
    allowEmptyMain = true
  }: { path: PathStep[]; professions: string[]; sex?: Sex; allowEmptyMain?: boolean } = $props();

  const levelsOf = (p: string) => gd.getProfession(p)?.levels.map((l) => l.level) ?? [];

  function addBefore() {
    path = [...path.slice(0, -1), { profession: "", level: null }, path[path.length - 1]];
  }

  function remove(i: number) {
    path = path.filter((_, j) => j !== i);
  }

  function setProfession(i: number, p: string) {
    const step = path[i];
    const lv = levelsOf(p);
    // Poziom spoza nowej profesji - z powrotem "auto".
    path[i] = { profession: p, level: step.level != null && lv.includes(step.level) ? step.level : null };
  }

  let warning = $derived.by(() => {
    const last = path[path.length - 1];
    if (last?.level == null) return "";
    const higher = path.slice(0, -1).some((s) => s.level != null && s.level > last.level!);
    return higher ? "Ostatnia (obecna) profesja ma zwykle najwyższy poziom — sprawdź ścieżkę." : "";
  });
</script>

<div class="path-editor">
  {#each path as step, i (i)}
    {@const last = i === path.length - 1}
    <div class="path-row">
      <span class="text-dim idx">{last ? "Obecna" : `${i + 1}.`}</span>
      <select value={step.profession} onchange={(e) => setProfession(i, e.currentTarget.value)} aria-label="Profesja">
        {#if last && allowEmptyMain}<option value="">— wg archetypu —</option>{:else if !step.profession}<option value="">— wybierz —</option>{/if}
        {#each professions as p (p)}<option value={p} title={gd.professionSourceFull(p)}>{gd.withSource(gd.professionName(p, sex), gd.getProfession(p)?.source)}</option>{/each}
      </select>
      <select
        value={step.level == null ? "" : String(step.level)}
        onchange={(e) => (path[i] = { ...step, level: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
        aria-label="Poziom docelowy"
        disabled={!step.profession && !last}
      >
        <option value="">poziom: auto</option>
        {#each levelsOf(step.profession) as lv (lv)}
          <option value={String(lv)}>{lv} · {gd.professionTitle(step.profession, lv, sex)}</option>
        {/each}
      </select>
      {#if path.length > 1}<button class="btn-sm ghost" aria-label="Usuń krok" onclick={() => remove(i)}>✕</button>{/if}
    </div>
  {/each}
  <div class="path-actions">
    <button class="btn-sm" onclick={addBefore}>+ wcześniejsza profesja</button>
    <span class="text-dim hint">Poziom „auto” — program dobiera sam wg PD. Podany poziom jest osiągany nawet ponad budżet PD (karta pokaże brak).</span>
  </div>
  {#if warning}<p class="warn">{warning}</p>{/if}
</div>

<style>
  .path-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .path-row,
  .path-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .path-row select:first-of-type {
    flex: 1 1 calc(220px * var(--ui-scale));
    min-width: 0;
  }

  .idx {
    min-width: 3.5em;
    font-size: var(--fs-sm);
  }

  .hint {
    font-size: var(--fs-sm);
  }

  .warn {
    margin: 0;
    color: var(--warning-strong, var(--danger-strong));
    font-size: var(--fs-sm);
  }
</style>
