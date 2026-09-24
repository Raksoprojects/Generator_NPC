<script lang="ts">
  import GeneratorTab from "./components/GeneratorTab.svelte";
  import GroupTab from "./components/GroupTab.svelte";
  import LibraryTab from "./components/LibraryTab.svelte";
  import { app, RULESET_LABELS } from "./lib/app.svelte";
  import { uiScale } from "./lib/uiScale";
  import type { Ruleset } from "./lib/types";

  const tabs = [
    { id: "generator", label: "Generator" },
    { id: "grupa", label: "Grupa" },
    { id: "zapisane", label: "Zapisane" }
  ] as const;

  const rulesets: Ruleset[] = ["pod_bronia", "domowe"];

  let activeTab = $state<(typeof tabs)[number]["id"]>("generator");
  let scale = $state(1);
  uiScale.subscribe((v) => (scale = v));

  app.init();

  // Ctrl + kolko myszy = zoom calego interfejsu.
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) uiScale.increase();
    else uiScale.decrease();
  }
</script>

<svelte:window onwheel={onWheel} />

<div class="app-shell">
  <header class="app-header panel">
    <div class="brand">
      <h1>Generator BN <span class="edition">WFRP 4ed</span></h1>
      <span class="sub text-dim">Bohaterowie niezależni w kilka sekund</span>
    </div>

    <div class="header-actions">
      <div class="seg" role="group" aria-label="Wariant zasad">
        {#each rulesets as r (r)}
          <button class="seg-opt" class:active={app.ruleset === r} aria-pressed={app.ruleset === r} onclick={() => app.setRuleset(r)} disabled={!app.ready}>
            {RULESET_LABELS[r]}
          </button>
        {/each}
      </div>

      <div class="zoom-control" role="group" aria-label="Powiększenie interfejsu">
        <button class="zoom-btn" title="Zmniejsz interfejs" aria-label="Zmniejsz" onclick={() => uiScale.decrease()}>−</button>
        <button class="zoom-value" title="Przywróć domyślne powiększenie" onclick={() => uiScale.reset()}>{Math.round(scale * 100)}%</button>
        <button class="zoom-btn" title="Powiększ interfejs" aria-label="Powiększ" onclick={() => uiScale.increase()}>+</button>
      </div>
    </div>
  </header>

  <nav class="tab-bar" aria-label="Sekcje">
    {#each tabs as tab (tab.id)}
      <button class="tab" class:active={activeTab === tab.id} aria-pressed={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
        {tab.label}
        {#if tab.id === "zapisane" && app.library.length}
          <span class="badge">{app.library.length}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <main class="content">
    {#if app.loadError}
      <section class="panel placeholder">
        <h2>Błąd ładowania danych</h2>
        <p class="val-danger">{app.loadError}</p>
        <p class="text-dim">Sprawdź, czy pliki w katalogu data/ są dostępne i poprawne (JSON).</p>
      </section>
    {:else if !app.ready}
      <section class="panel placeholder">
        <h2>Wczytywanie danych gry…</h2>
      </section>
    {:else}
      <!-- Zakładki zostają zamontowane, by nie tracić wygenerowanych BN przy przełączaniu. -->
      <div hidden={activeTab !== "generator"}><GeneratorTab /></div>
      <div hidden={activeTab !== "grupa"}><GroupTab /></div>
      <div hidden={activeTab !== "zapisane"}><LibraryTab /></div>
    {/if}
  </main>

  {#if app.toast}
    <div class="toast panel" role="status">{app.toast}</div>
  {/if}

  <footer class="app-footer text-dim">
    Warhammer Fantasy Roleplay 4ed · narzędzie pomocnicze MG · zasady: {RULESET_LABELS[app.ruleset]}
  </footer>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-3);
    gap: var(--space-3);
    padding-top: max(var(--space-3), env(safe-area-inset-top));
    padding-left: max(var(--space-3), env(safe-area-inset-left));
    padding-right: max(var(--space-3), env(safe-area-inset-right));
    padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
  }

  .app-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand h1 {
    font-size: var(--fs-xl);
  }

  .edition {
    color: var(--accent);
    font-weight: 700;
  }

  .sub {
    font-size: var(--fs-sm);
  }

  .header-actions {
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

  .zoom-control {
    display: inline-flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .zoom-control button {
    border: none;
    border-radius: 0;
    background: transparent;
    min-height: calc(32px * var(--ui-scale));
  }

  .zoom-btn {
    font-size: var(--fs-lg);
    line-height: 1;
    padding: var(--space-1) var(--space-3);
  }

  .zoom-value {
    min-width: calc(54px * var(--ui-scale));
    font-variant-numeric: tabular-nums;
    border-left: 1px solid var(--border) !important;
    border-right: 1px solid var(--border) !important;
  }

  .tab-bar {
    display: flex;
    gap: var(--space-2);
  }

  .tab {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: var(--fs-base);
    padding: var(--space-2) var(--space-4);
  }

  .tab.active {
    background: var(--bg-elevated);
    color: var(--accent-strong);
    border-color: var(--accent);
    font-weight: 600;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: calc(18px * var(--ui-scale));
    margin-left: var(--space-1);
    padding: 0 5px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.75em;
    font-weight: 700;
  }

  .content {
    flex: 1;
  }

  .placeholder {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .placeholder h2 {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: max(var(--space-4), env(safe-area-inset-bottom));
    transform: translateX(-50%);
    padding: var(--space-2) var(--space-4);
    border-color: var(--accent);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 200;
    max-width: calc(100% - 32px);
  }

  .app-footer {
    font-size: var(--fs-sm);
    text-align: center;
    padding: var(--space-2);
  }

  @media (max-width: 640px) {
    .app-shell {
      padding: var(--space-2);
    }

    .tab-bar .tab {
      flex: 1;
      padding: var(--space-2);
    }
  }
</style>
