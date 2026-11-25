<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "",
    options,
    groups,
    max = 8,
    onpick
  }: {
    value?: string;
    placeholder?: string;
    options: string[];
    /** Grupa opcji (np. tradycja zaklecia) - tez przeszukiwana i pokazana obok nazwy. */
    groups?: Record<string, string>;
    max?: number;
    onpick?: (v: string) => void;
  } = $props();

  let open = $state(false);
  let active = $state(-1);

  /** Bez wielkosci liter i polskich znakow: "zolnierz" znajduje "Żołnierz". */
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");

  let matches = $derived.by(() => {
    const words = norm(value).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    // Kazde slowo w nazwie albo w grupie ("ogien pocisk" znajduje pociski Tradycji Ognia).
    return options.filter((o) => words.every((w) => norm(`${o} ${groups?.[o] ?? ""}`).includes(w))).slice(0, max);
  });

  function pick(o: string) {
    value = o;
    open = false;
    active = -1;
    onpick?.(o);
  }

  function onKey(e: KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % matches.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + matches.length) % matches.length;
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      open = false;
    }
  }
</script>

<div class="ac">
  <input
    type="text"
    {placeholder}
    bind:value
    oninput={() => {
      open = true;
      active = -1;
    }}
    onfocus={() => (open = true)}
    onblur={() => setTimeout(() => (open = false), 120)}
    onkeydown={onKey}
  />
  {#if open && matches.length > 0}
    <ul class="popup panel" role="listbox">
      {#each matches as m, i (m)}
        <li>
          <button
            type="button"
            class="opt"
            class:active={i === active}
            role="option"
            aria-selected={i === active}
            onmousedown={(e) => {
              e.preventDefault();
              pick(m);
            }}
          >
            {m}{#if groups?.[m]}<span class="grp"> · {groups[m]}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .ac {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .ac input {
    width: 100%;
  }

  .popup {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    margin: 0;
    padding: var(--space-1);
    list-style: none;
    z-index: 50;
    max-height: calc(220px * var(--ui-scale));
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .opt {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    min-height: auto;
    padding: var(--space-2);
  }

  .opt:hover,
  .opt.active {
    background: var(--bg-elevated);
  }

  .grp {
    color: var(--text-muted);
    font-size: 0.9em;
  }
</style>
