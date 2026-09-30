<script lang="ts">
  import NpcCard from "./NpcCard.svelte";
  import { pick } from "../lib/dice";
  import * as gd from "../lib/gameData";
  import { COMMANDER_PROFILE, generateNpc, racesForArchetype, type GenSpec } from "../lib/generator";
  import { TIER_IDS, type Npc, type Sex, type TierId } from "../lib/types";

  type Mode = "losowy" | "polLosowy" | "wlasny";
  type Kind = "rasy" | "stworzenia";

  let kind = $state<Kind>("rasy");
  let creature = $state("");
  /** Grupa albo podgrupa stworzen ("Chaos › Zwierzoludzie"); pusta = wszystkie. */
  let creatureGroup = $state("");
  let bloodline = $state("");

  const groupTree = gd.creatureGroupTree();
  const bloodlines = gd.getVampires()?.bloodlines.map((b) => b.name) ?? [];
  const isVampireName = (name: string) => !!gd.getVampires()?.creatures.includes(name);
  const typicalCreatures = gd.getCreatures().filter((c) => !c.unique).map((c) => c.name);

  /** Stworzenia wybranej grupy, pogrupowane wg podgrup (w kolejnosci drzewa grup). */
  let creatureGroups = $derived.by(() => {
    // Unikatowe postacie (Olbrzym szpieg, nazwane bestie) nie trafiaja do generatora - tylko rodzaje stworzen.
    const pool = (creatureGroup ? gd.creaturesInGroup(creatureGroup) : gd.getCreatures()).filter((c) => !c.unique);
    const out: Record<string, string[]> = {};
    for (const { group, subgroups } of groupTree) {
      for (const key of [group, ...subgroups.map((s) => `${group}${gd.GROUP_SEP}${s}`)]) {
        const names = pool.filter((c) => gd.creatureGroupKey(c) === key).map((c) => c.name);
        if (names.length) out[key] = names.sort((a, b) => a.localeCompare(b, "pl"));
      }
    }
    return out;
  });

  // Stworzenie spoza nowo wybranej grupy - wracamy do losowania z grupy.
  $effect(() => {
    if (creature && creatureGroup && !gd.creaturesInGroup(creatureGroup).some((c) => c.name === creature)) creature = "";
  });

  let civilized = $derived(!!creature && gd.isCivilized(creature));
  /** Stworzenie rozumne bez profesji - wartosc listy archetypow. */
  const NO_CAREER = "-";
  /** Archetypy dozwolone dla stworzenia (ogr: tylko proste profesje). */
  let creatureArchetypes = $derived.by(() => {
    const allowed = gd.getCreature(creature)?.archetypes;
    return allowed ? archetypes.filter((a) => a in allowed) : archetypes;
  });
  /** Najnizszy poziom stworzenia (np. Wojownik Chaosu: od zaawansowanego); dla grupy - najnizszy w grupie. */
  let minTierIdx = $derived.by(() => {
    if (creature) return TIER_IDS.indexOf(gd.getCreature(creature)?.minTier ?? "slaby");
    if (!creatureGroup) return 0;
    const typical = gd.creaturesInGroup(creatureGroup).filter((c) => !c.unique);
    return Math.min(...typical.map((c) => TIER_IDS.indexOf(c.minTier ?? "slaby")));
  });
  /** Linia Krwi - gdy wybrany jest wampir albo grupa, z ktorej moze wypasc wampir. */
  let showBloodline = $derived(
    creature ? isVampireName(creature) : !!creatureGroup && gd.creaturesInGroup(creatureGroup).some((c) => isVampireName(c.name))
  );

  $effect(() => {
    if (kind === "stworzenia" && tier && TIER_IDS.indexOf(tier) < minTierIdx) tier = TIER_IDS[minTierIdx];
  });

  const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: "losowy", label: "Losowy", hint: "Wszystko losowe — jedno kliknięcie." },
    { id: "polLosowy", label: "Pół-losowy", hint: "Ustaw, co chcesz, resztę wylosujemy." },
    { id: "wlasny", label: "Własny", hint: "Wszystko wybierasz sam; rzuty średnie (11), bez losowych odchyleń." }
  ];

  let mode = $state<Mode>("losowy");

  // Pola formularza. Pusty string = "losowo" (w trybie pół-losowym).
  let archetype = $state("");
  let tier = $state<TierId | "">("");
  let race = $state("");
  let sex = $state<Sex | "">("");
  let name = $state("");
  let mainProfession = $state("");
  let prevProfession = $state("");
  let chosenTraits = $state<string[]>([]);
  let randomTraits = $state(true);
  let commander = $state(false);
  let autoHero = $state(true);

  let npc = $state<Npc | null>(null);
  let history = $state<Npc[]>([]);

  let archetypes = $derived(gd.allArchetypeNames());
  let randomPool = $derived(
    Object.entries(gd.getCreatureTraits()).filter(([, t]) => t.randomPool).map(([n]) => n)
  );
  let otherTraits = $derived(
    Object.entries(gd.getCreatureTraits()).filter(([, t]) => !t.randomPool).map(([n]) => n)
  );

  // W trybie własnym każde pole ma wartość (brak opcji "losowo").
  $effect(() => {
    if (mode !== "wlasny") return;
    if (kind === "stworzenia") {
      if (!creature) creature = Object.values(creatureGroups)[0]?.[0] ?? typicalCreatures[0];
      if (!tier) tier = "sredni";
      randomTraits = false;
      return;
    }
    if (!archetype) archetype = archetypes[0];
    if (!tier) tier = "slaby";
    if (!sex) sex = "M";
    if (!race || !racesForArchetype(archetype).includes(race)) race = racesForArchetype(archetype)[0] ?? "Człowiek";
    randomTraits = false;
  });

  let allowedRaces = $derived(archetype ? racesForArchetype(archetype) : gd.allRaceNames());

  let professionOptions = $derived.by(() => {
    const arch = archetype ? gd.getArchetype(archetype) : undefined;
    const names = arch ? Object.keys(arch.professions) : gd.allProfessionNames();
    return names.filter((p) => gd.getProfession(p) && (!race || gd.professionAllowsRace(p, race)));
  });

  let allProfessions = $derived(
    gd.allProfessionNames().filter((p) => !race || gd.professionAllowsRace(p, race))
  );

  let tierAllowsTwo = $derived(!tier || (gd.getTier(tier as TierId)?.maxCareers ?? 1) > 1);

  function toggleTrait(t: string) {
    chosenTraits = chosenTraits.includes(t) ? chosenTraits.filter((x) => x !== t) : [...chosenTraits, t];
  }

  function buildSpec(): GenSpec {
    if (kind === "stworzenia") {
      if (mode === "losowy") return { creature: pick(typicalCreatures) };
      return {
        creature: creature || (creatureGroup ? undefined : pick(typicalCreatures)),
        creatureGroup: creature ? undefined : creatureGroup || undefined,
        bloodline: showBloodline && bloodline ? bloodline : undefined,
        archetype: civilized && archetype && archetype !== NO_CAREER ? archetype : undefined,
        noArchetype: civilized && archetype === NO_CAREER,
        tier: (tier || undefined) as TierId | undefined,
        name: name.trim() || undefined,
        traits: chosenTraits,
        randomTraits,
        commander,
        autoHeroProfile: autoHero,
        deterministic: mode === "wlasny"
      };
    }
    if (mode === "losowy") return {};
    const professions = [prevProfession, mainProfession].filter(Boolean);
    return {
      archetype: archetype || undefined,
      tier: (tier || undefined) as TierId | undefined,
      race: race || undefined,
      sex: (sex || undefined) as Sex | undefined,
      name: name.trim() || undefined,
      professions: mainProfession ? professions : undefined,
      traits: chosenTraits,
      randomTraits,
      commander,
      autoHeroProfile: autoHero,
      deterministic: mode === "wlasny"
    };
  }

  function generate() {
    if (npc) history = [npc, ...history].slice(0, 8);
    npc = generateNpc(buildSpec());
  }

  function restore(i: number) {
    const picked = history[i];
    history = [...(npc ? [npc] : []), ...history.filter((_, j) => j !== i)].slice(0, 8);
    npc = picked;
  }

  function resetForm() {
    archetype = tier = race = sex = creature = creatureGroup = bloodline = "";
    name = mainProfession = prevProfession = "";
    chosenTraits = [];
    randomTraits = true;
    commander = false;
    autoHero = true;
  }
</script>

<section class="tab">
  <div class="panel controls">
    <div class="mode-row">
      <div class="seg" role="group" aria-label="Rodzaj BN">
        <button class="seg-opt" class:active={kind === "rasy"} aria-pressed={kind === "rasy"} onclick={() => (kind = "rasy")}>Ludzie i rasy</button>
        <button class="seg-opt" class:active={kind === "stworzenia"} aria-pressed={kind === "stworzenia"} onclick={() => { kind = "stworzenia"; archetype = ""; }}>Stworzenia</button>
      </div>
    </div>
    <div class="mode-row">
      <div class="seg" role="group" aria-label="Metoda generowania">
        {#each MODES as m (m.id)}
          <button class="seg-opt" class:active={mode === m.id} aria-pressed={mode === m.id} onclick={() => (mode = m.id)}>{m.label}</button>
        {/each}
      </div>
      <span class="text-dim hint">{MODES.find((m) => m.id === mode)?.hint}</span>
    </div>

    {#if mode !== "losowy" && kind === "stworzenia"}
      <div class="form">
        <label>Grupa
          <select bind:value={creatureGroup}>
            <option value="">— wszystkie —</option>
            {#each groupTree as g (g.group)}
              <option value={g.group}>{g.group}</option>
              {#each g.subgroups as s (s)}<option value={`${g.group}${gd.GROUP_SEP}${s}`}>&nbsp;&nbsp;› {s}</option>{/each}
            {/each}
          </select>
        </label>
        <label>Stworzenie
          <select bind:value={creature}>
            {#if mode === "polLosowy"}<option value="">{creatureGroup ? "— losowo z grupy —" : "— losowo —"}</option>{/if}
            {#each Object.entries(creatureGroups) as [group, names] (group)}
              <optgroup label={group}>
                {#each names as c (c)}<option value={c}>{c}</option>{/each}
              </optgroup>
            {/each}
          </select>
        </label>
        {#if showBloodline}
          <label>Linia krwi
            <select bind:value={bloodline}>
              <option value="">— losowa —</option>
              {#each bloodlines as b (b)}<option value={b}>{b}</option>{/each}
            </select>
          </label>
        {/if}
        {#if civilized}
          <label>Archetyp (profesje)
            <select bind:value={archetype}>
              <option value="">— losowo (wg stworzenia) —</option>
              <option value={NO_CAREER}>— bez profesji (jak bestia) —</option>
              {#each creatureArchetypes as a (a)}<option value={a}>{a}</option>{/each}
            </select>
          </label>
        {/if}
        <label>Poziom
          <select bind:value={tier}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each TIER_IDS as t, i (t)}
              <option value={t} disabled={i < minTierIdx}>{gd.getTier(t).label}{!civilized || !archetype
                  ? ` — ${gd.getCreatureFamilies().settings.tierLabels[TIER_IDS[Math.max(0, i - minTierIdx)]]}`
                  : ""}</option>
            {/each}
          </select>
        </label>
        <label>Imię
          <input type="text" placeholder="nazwa stworzenia" bind:value={name} />
        </label>
      </div>
      {#if creature}
        <p class="text-dim hint">
          {gd.getCreature(creature)?.source}, s. {gd.getCreature(creature)?.page} · rodzina: {gd.getCreature(creature)?.family}
          {civilized ? " · może rozwijać się przez profesje" : " · rozwój przez umiejętności i Cechy Stworzeń"}
          {minTierIdx > 0 ? ` · występuje od poziomu: ${gd.getTier(TIER_IDS[minTierIdx]).label}` : ""}
        </p>
      {/if}
    {/if}

    {#if mode !== "losowy" && kind === "rasy"}
      <div class="form">
        <label>Archetyp
          <select bind:value={archetype}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each archetypes as a (a)}<option value={a}>{a}</option>{/each}
          </select>
        </label>
        <label>Poziom
          <select bind:value={tier}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each TIER_IDS as t (t)}<option value={t}>{gd.getTier(t).label}</option>{/each}
          </select>
        </label>
        <label>Rasa
          <select bind:value={race}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each gd.allRaceNames() as r (r)}<option value={r} disabled={!allowedRaces.includes(r)}>{r}</option>{/each}
          </select>
        </label>
        <label>Płeć
          <select bind:value={sex}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            <option value="M">mężczyzna</option>
            <option value="K">kobieta</option>
          </select>
        </label>
        <label>Imię
          <input type="text" placeholder="losowe" bind:value={name} />
        </label>
        <label>Profesja obecna
          <select bind:value={mainProfession}>
            <option value="">— wg archetypu —</option>
            {#each professionOptions as p (p)}<option value={p}>{p}</option>{/each}
            {#if professionOptions.length < allProfessions.length}
              <optgroup label="Inne profesje">
                {#each allProfessions.filter((p) => !professionOptions.includes(p)) as p (p)}<option value={p}>{p}</option>{/each}
              </optgroup>
            {/if}
          </select>
        </label>
        {#if tierAllowsTwo}
          <label>Profesja poprzednia
            <select bind:value={prevProfession} disabled={!mainProfession}>
              <option value="">— losowo, jeśli potrzebna —</option>
              {#each allProfessions as p (p)}<option value={p}>{p}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
    {/if}

    {#if mode !== "losowy"}
      <div class="traits">
        <span class="lbl">Cechy Stworzeń:</span>
        {#each randomPool as t (t)}
          <button class="chip tap" class:warning={chosenTraits.includes(t)} aria-pressed={chosenTraits.includes(t)} title={gd.getCreatureTrait(t)?.description} onclick={() => toggleTrait(t)}>{t}</button>
        {/each}
        {#if otherTraits.length}
          <details class="more">
            <summary class="text-dim">inne…</summary>
            {#each otherTraits as t (t)}
              <button class="chip tap" class:warning={chosenTraits.includes(t)} aria-pressed={chosenTraits.includes(t)} title={gd.getCreatureTrait(t)?.description} onclick={() => toggleTrait(t)}>{t}</button>
            {/each}
          </details>
        {/if}
      </div>

      <div class="checks">
        <label class="check"><input type="checkbox" bind:checked={randomTraits} /> Dolosuj cechy opcjonalne (15% / 5% / 1%)</label>
        <label class="check"><input type="checkbox" bind:checked={autoHero} /> Profil bohatera wg poziomu</label>
        <label class="check"><input type="checkbox" bind:checked={commander} /> {COMMANDER_PROFILE}</label>
        <button class="btn-sm ghost" onclick={resetForm}>Wyczyść</button>
      </div>
    {/if}

    <button class="primary generate" onclick={generate}>🎲 Generuj BN</button>
  </div>

  {#if npc}
    <NpcCard bind:npc />
  {:else}
    <p class="text-dim empty">Wybierz metodę i kliknij „Generuj BN”. Każdy element wyniku możesz potem edytować, zablokować i wylosować ponownie.</p>
  {/if}

  {#if history.length}
    <div class="history">
      <span class="text-dim">Poprzednie:</span>
      {#each history as h, i (h.id)}
        <button class="btn-sm ghost" onclick={() => restore(i)}>{h.name} <span class="text-dim">({h.archetype || h.creature})</span></button>
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

  .mode-row {
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

  .hint {
    font-size: var(--fs-sm);
  }

  .form {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(180px * var(--ui-scale)), 1fr));
    gap: var(--space-2) var(--space-3);
  }

  .form label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  .traits {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .lbl {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  button.chip.tap {
    min-height: auto;
    cursor: pointer;
  }

  .more {
    display: contents;
  }

  .more summary {
    cursor: pointer;
    font-size: var(--fs-sm);
  }

  .checks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .generate {
    align-self: flex-start;
    font-size: var(--fs-base);
    padding: var(--space-2) var(--space-4);
  }

  .empty {
    padding: var(--space-3);
  }

  .history {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
  }

  @media (max-width: 640px) {
    .generate {
      align-self: stretch;
    }
  }
</style>
