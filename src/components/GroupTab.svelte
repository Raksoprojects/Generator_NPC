<script lang="ts">
  import NpcCard from "./NpcCard.svelte";
  import Autocomplete from "./Autocomplete.svelte";
  import PathEditor from "./PathEditor.svelte";
  import { app } from "../lib/app.svelte";
  import { copyText, downloadText, pickFile } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { generateNpc, racesForArchetype, type GenSpec, type PathStep } from "../lib/generator";
  import { groupsToJson, parseGroupsJson, type SavedGroup } from "../lib/library";
  import { computeNpc, normalizeNpc, npcToText } from "../lib/npc";
  import { TIER_IDS, type GroupRow, type Npc, type Sex, type TierId } from "../lib/types";
  import { bloodlineFitsArchetype } from "../lib/vampires";

  const presets = gd.getGroupPresets();
  const presetNames = Object.keys(presets);

  let presetName = $state(presetNames[0] ?? "");
  let groupName = $state(presetNames[0] ?? "Grupa");
  let rows = $state<GroupRow[]>(structuredClone(presets[presetNames[0]]?.rows ?? []));
  let members = $state<Npc[]>([]);
  let collapsed = $state<Record<string, boolean>>({});
  /** Id zapisanej grupy, ktora jest teraz na ekranie (zapis ja aktualizuje). */
  let savedId = $state<string | undefined>(undefined);
  let chosenSaved = $state("");

  let savedGroups = $derived([...app.groups].sort((a, b) => a.name.localeCompare(b.name, "pl")));

  function loadPreset() {
    const p = presets[presetName];
    if (!p) return;
    rows = structuredClone(p.rows);
    groupName = presetName;
  }

  /** Stworzenia wg grup i podgrup ("Chaos › Zwierzoludzie"), w kolejnosci drzewa grup. */
  const creatureGroups = (() => {
    const out: Record<string, string[]> = {};
    for (const { group, subgroups } of gd.creatureGroupTree()) {
      for (const key of [group, ...subgroups.map((s) => `${group}${gd.GROUP_SEP}${s}`)]) {
        const names = gd.bestiaryCreatures().filter((c) => gd.creatureGroupKey(c) === key && !c.unique).map((c) => c.name);
        if (names.length) out[key] = names.sort((a, b) => a.localeCompare(b, "pl"));
      }
    }
    return out;
  })();

  /** Wartosc listy "kto": "a:Archetyp", "c:Stworzenie" albo "g:Grupa stworzen". */
  function whoOf(row: GroupRow): string {
    if (row.creatureGroup) return `g:${row.creatureGroup}`;
    return row.creature ? `c:${row.creature}` : `a:${row.archetype}`;
  }

  /** Najnizszy (podstawowy) poziom stworzenia albo grupy - proponowany przy wyborze. */
  function baseTier(kind: string, name: string): TierId {
    const list = kind === "c" ? [gd.getCreature(name)].filter(Boolean) : gd.creaturesInGroup(name).filter((c) => !c.unique);
    const idx = Math.min(...list.map((c) => TIER_IDS.indexOf(c!.minTier ?? "slaby")));
    return TIER_IDS[Number.isFinite(idx) ? idx : 0];
  }

  function setWho(row: GroupRow, value: string) {
    const [kind, name] = [value.slice(0, 1), value.slice(2)];
    row.creatureGroup = kind === "g" ? name : undefined;
    if (kind === "c" || kind === "g") {
      row.creature = kind === "c" ? name : undefined;
      row.archetype = "";
      row.race = undefined;
      row.path = undefined;
      row.tier = baseTier(kind, name);
    } else {
      row.creature = undefined;
      row.archetype = name;
      row.noArchetype = undefined;
      row.bloodline = undefined;
    }
  }

  /** Wyszukiwanie w wierszu: archetyp, grupa albo stworzenie z podpowiedziami. */
  let queries = $state<Record<number, string>>({});
  const SEARCH: Record<string, string> = {};
  for (const a of gd.allArchetypeNames()) SEARCH[`Archetyp: ${a}`] = `a:${a}`;
  for (const g of Object.keys(creatureGroups)) SEARCH[`Grupa: ${g}`] = `g:${g}`;
  for (const t of gd.creatureGroupTree().filter((x) => x.subgroups.length)) SEARCH[`Grupa: ${t.group} (wszystkie)`] = `g:${t.group}`;
  for (const names of Object.values(creatureGroups)) for (const c of names) SEARCH[c] = `c:${c}`;
  const searchOptions = Object.keys(SEARCH);

  function addRow() {
    rows.push({ count: 1, archetype: gd.allArchetypeNames()[0], tier: "slaby" });
  }

  /** Szybki - tylko liczba, kto i poziom; dokladny - wszystkie opcje pojedynczego BN dla wiersza. */
  let detailed = $state(false);
  const bloodlines = gd.getVampires()?.bloodlines.map((b) => b.name) ?? [];
  const isVampire = (row: GroupRow) =>
    row.creature ? !!gd.getVampires()?.creatures.includes(row.creature) : !!row.creatureGroup && gd.creaturesInGroup(row.creatureGroup).some((c) => gd.getVampires()?.creatures.includes(c.name));
  const randomPool = Object.entries(gd.getCreatureTraits()).filter(([, t]) => t.randomPool).map(([n]) => n);
  /** Wiersz z profesja: archetyp rasy albo stworzenie rozumne z archetypem. */
  const hasCareer = (row: GroupRow) => !row.noArchetype && (!row.creature && !row.creatureGroup ? true : !!row.creature && gd.isCivilized(row.creature));

  function rowProfessions(row: GroupRow): string[] {
    const race = row.creature ? "Człowiek" : row.race;
    const allowed = (p: string) => !race || gd.professionAllowsRace(p, race);
    const own = Object.keys(gd.getArchetype(row.archetype)?.professions ?? {}).filter((p) => gd.getProfession(p) && allowed(p));
    return [...own, ...gd.allProfessionNames().filter((p) => allowed(p) && !own.includes(p))];
  }

  function toggleRowTrait(row: GroupRow, t: string) {
    const cur = row.traits ?? [];
    row.traits = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  }

  /** Opcje dokladnego kreatora wiersza -> GenSpec (jak w generatorze pojedynczego BN). */
  function detailSpec(row: GroupRow): Partial<GenSpec> {
    if (!detailed) return {};
    const spec: Partial<GenSpec> = { sex: row.sex, bloodline: row.bloodline || undefined, noArchetype: row.noArchetype };
    const xp = Math.round(Number(row.xp));
    // Ujemne PD odejmuja od budzetu poziomu.
    const xpTo = Math.round(Number(row.xpTo));
    const hasTo = row.xpTo != null && Number.isFinite(xpTo) && xpTo !== xp;
    if (row.xp != null && Number.isFinite(xp) && (xp !== 0 || hasTo)) {
      if (row.xpMode !== "zamiast") spec.xpBonus = xp;
      else if (xp > 0 || xpTo > 0) spec.xp = Math.max(0, xp);
      if (hasTo && (spec.xp != null || spec.xpBonus != null)) spec.xpTo = spec.xp != null ? Math.max(0, xpTo) : xpTo;
    }
    const steps = (row.path ?? []) as PathStep[];
    const main = steps[steps.length - 1]?.profession;
    const exact = steps.some((s) => s.level != null) || (steps.length > 1 && steps.some((s) => s.profession));
    if (hasCareer(row)) Object.assign(spec, exact ? { path: steps } : main ? { professions: [main] } : {});
    if (row.heroProfile) spec.heroProfiles = [row.heroProfile];
    if (row.traits?.length) spec.traits = row.traits;
    if (row.randomTraits === false) spec.randomTraits = false;
    return spec;
  }

  function generateGroup() {
    const out: Npc[] = [];
    for (const row of rows) {
      const count = Math.max(0, Math.min(30, Math.trunc(row.count)));
      for (let i = 0; i < count; i++) {
        const npc = generateNpc({
          creature: row.creature,
          creatureGroup: row.creature ? undefined : row.creatureGroup,
          archetype: row.archetype || undefined,
          tier: row.tier,
          tierTo: row.tierTo && TIER_IDS.indexOf(row.tierTo) > TIER_IDS.indexOf(row.tier) ? row.tierTo : undefined,
          race: row.race || undefined,
          commander: row.commander,
          label: row.label || undefined,
          ...detailSpec($state.snapshot(row) as GroupRow)
        });
        // Bestie bez imion numerujemy: Wilk 1, Wilk 2...
        if (npc.creature && npc.name === npc.creature && count > 1) npc.name = `${npc.creature} ${i + 1}`;
        npc.group = groupName.trim() || undefined;
        out.push(npc);
      }
    }
    members = out;
    collapsed = {};
    // Nowe losowanie to nowa grupa - zapis nie nadpisze wczytanej.
    savedId = undefined;
  }

  function saveGroup() {
    const name = groupName.trim() || "Grupa";
    for (const m of members) m.group = name;
    savedId = app.saveGroup({ id: savedId, name, rows, members });
    chosenSaved = savedId;
    app.notify(`Zapisano grupę „${name}” (${members.length} BN).`);
  }

  function saveGroupAsNew() {
    savedId = undefined;
    saveGroup();
  }

  function loadSaved() {
    const g = app.groups.find((x) => x.id === chosenSaved);
    if (!g) return;
    const copy = $state.snapshot(g) as SavedGroup;
    groupName = copy.name;
    rows = copy.rows.length ? copy.rows : rows;
    members = copy.members.map((m) => normalizeNpc(m));
    collapsed = Object.fromEntries(members.map((m) => [m.id, true]));
    savedId = copy.id;
  }

  function removeSaved() {
    const g = app.groups.find((x) => x.id === chosenSaved);
    if (!g || !confirm(`Usunąć zapisaną grupę „${g.name}”? BN zapisani osobno w bibliotece zostają.`)) return;
    app.removeGroup(g.id);
    if (savedId === g.id) savedId = undefined;
    chosenSaved = "";
  }

  function exportGroups() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`grupy_bn_${stamp}.json`, groupsToJson($state.snapshot(app.groups) as SavedGroup[]));
  }

  async function importGroups() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const { added, updated } = app.mergeGroups(parseGroupsJson(await file.text()));
      app.notify(`Import grup: dodano ${added}, zaktualizowano ${updated}.`);
    } catch (e) {
      app.notify(`Błąd importu: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function summary(npc: Npc): string {
    const v = computeNpc(npc);
    const s = (c: "WW" | "US" | "Wt") => (v.chars[c].absent ? "–" : v.chars[c].total);
    const w = v.weapons[0];
    return `WW ${s("WW")} · US ${s("US")} · Wt ${s("Wt")} · Żyw ${v.wounds}${w ? ` · ${w.name} +${w.damage ?? "–"}` : ""}`;
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

  /** Poziom w wierszu: przedzial PD; u stworzen - co poziom oznacza dla tej istoty. */
  function tierOption(row: GroupRow, t: TierId, i: number): string {
    if (!row.creature && !row.creatureGroup) return gd.tierLabelXp(t);
    const min = TIER_IDS.indexOf(baseTier(row.creature ? "c" : "g", (row.creature ?? row.creatureGroup)!));
    const label = gd.getTier(t).label;
    if (i < min) return `${label} — osłabiony`;
    const note = gd.getCreatureFamilies().settings.tierLabels[TIER_IDS[i - min]];
    return note ? `${label} — ${note}` : label;
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

    <div class="preset-row">
      <label>Zapisane grupy
        <select bind:value={chosenSaved}>
          <option value="">{savedGroups.length ? "— wybierz —" : "— brak —"}</option>
          {#each savedGroups as g (g.id)}<option value={g.id}>{g.name} ({g.members.length} BN)</option>{/each}
        </select>
      </label>
      <button class="btn-sm" onclick={loadSaved} disabled={!chosenSaved}>Wczytaj</button>
      <button class="btn-sm ghost" onclick={removeSaved} disabled={!chosenSaved}>Usuń</button>
      <button class="btn-sm ghost" onclick={exportGroups} disabled={!app.groups.length}>Eksportuj grupy</button>
      <button class="btn-sm ghost" onclick={importGroups}>Importuj grupy</button>
    </div>

    <div class="preset-row">
      <label class="group-name">Nazwa grupy
        <input type="text" bind:value={groupName} placeholder="np. Banda z traktu" />
      </label>
      <div class="seg" role="group" aria-label="Kreator">
        <button class="seg-opt" class:active={!detailed} aria-pressed={!detailed} onclick={() => (detailed = false)}>Szybki</button>
        <button class="seg-opt" class:active={detailed} aria-pressed={detailed} onclick={() => (detailed = true)}>Dokładny</button>
      </div>
      <span class="text-dim hint">{detailed ? "Każdy wiersz: płeć, PD, ścieżka profesji, Cechy Stworzeń, wyjątkowa jednostka, linia krwi." : "Liczba, kto i poziom — reszta losowo."}</span>
    </div>

    <div class="rows">
      {#each rows as row, i (i)}
        <div class="row" class:detailed>
          <div class="row-main">
          <input class="count" type="number" min="1" max="30" bind:value={row.count} aria-label="Liczba" />
          <span class="x">×</span>
          <div class="who-search">
            <Autocomplete bind:value={() => queries[i] ?? "", (v) => (queries[i] = v)} options={searchOptions} placeholder="szukaj…" onpick={(v) => { setWho(row, SEARCH[v]); queries[i] = ""; }} />
          </div>
          <select value={whoOf(row)} onchange={(e) => setWho(row, (e.currentTarget as HTMLSelectElement).value)} aria-label="Archetyp albo stworzenie">
            <optgroup label="Archetypy">
              {#each gd.allArchetypeNames() as a (a)}<option value={`a:${a}`}>{a}</option>{/each}
            </optgroup>
            <optgroup label="Grupy stworzeń (każdy losowo z grupy)">
              {#each Object.keys(creatureGroups) as g (g)}<option value={`g:${g}`}>{g}</option>{/each}
              {#each gd.creatureGroupTree().filter((t) => t.subgroups.length) as t (t.group)}
                <option value={`g:${t.group}`}>{t.group} (wszystkie)</option>
              {/each}
            </optgroup>
            {#each Object.entries(creatureGroups) as [group, names] (group)}
              <optgroup label={`Stworzenia: ${group}`}>
                {#each names as c (c)}<option value={`c:${c}`}>{c}</option>{/each}
              </optgroup>
            {/each}
          </select>
          {#if row.creature && gd.isCivilized(row.creature)}
            <select value={row.noArchetype ? "-" : row.archetype} onchange={(e) => { const v = e.currentTarget.value; row.noArchetype = v === "-" || undefined; row.archetype = v === "-" ? "" : v; }} aria-label="Archetyp stworzenia">
              <option value="">profesja wg stworzenia</option>
              {#if !isVampire(row)}<option value="-">bez profesji (jak bestia)</option>{/if}
              {#each gd.allArchetypeNames().filter((a) => (!gd.getCreature(row.creature)?.archetypes || a in gd.getCreature(row.creature)!.archetypes!) && bloodlineFitsArchetype(row.bloodline, a)) as a (a)}<option value={a}>{a}</option>{/each}
            </select>
          {/if}
          <select bind:value={row.tier} aria-label="Poziom">
            {#each TIER_IDS as t, ti (t)}<option value={t}>{tierOption(row, t, ti)}</option>{/each}
          </select>
          <select value={row.tierTo ?? ""} onchange={(e) => (row.tierTo = (e.currentTarget.value || undefined) as TierId | undefined)} aria-label="Do poziomu (losowo z przedziału)" title="Poziom losowany równo z przedziału od–do">
            <option value="">tylko ten poziom</option>
            {#each TIER_IDS as t, ti (t)}{#if ti > TIER_IDS.indexOf(row.tier)}<option value={t}>do: {gd.getTier(t).label}</option>{/if}{/each}
          </select>
          {#if !row.creature}
            <select bind:value={row.race} aria-label="Rasa">
              <option value={undefined}>rasa losowo</option>
              {#each racesForArchetype(row.archetype) as r (r)}<option value={r}>{r}</option>{/each}
            </select>
          {/if}
          <input class="label" type="text" placeholder="etykieta" bind:value={row.label} aria-label="Etykieta" />
          <label class="check"><input type="checkbox" bind:checked={row.commander} /> dowódca</label>
          <button class="btn-sm ghost" aria-label="Usuń wiersz" onclick={() => rows.splice(i, 1)}>✕</button>
          </div>
          {#if row.creature}
            {@const c = gd.getCreature(row.creature)}
            <span class="text-dim small src">{c?.source}, s. {c?.page} · domyślny poziom: {gd.getTier(c?.minTier ?? "slaby").label}</span>
          {/if}
          {#if detailed}
            <div class="row-detail">
              {#if !row.creature || hasCareer(row) || isVampire(row)}
                <label>Płeć
                  <select value={row.sex ?? ""} onchange={(e) => (row.sex = (e.currentTarget.value || undefined) as Sex | undefined)}>
                    <option value="">losowo</option>
                    <option value="M">mężczyzna</option>
                    <option value="K">kobieta</option>
                  </select>
                </label>
              {/if}
              {#if hasCareer(row)}
                <label title="PD ponad tworzenie postaci; liczba ujemna odejmuje PD od poziomu">PD
                  <span class="xp-row">
                    <input type="number" step="100" placeholder="wg poziomu" bind:value={row.xp} />
                    <input type="number" step="100" placeholder="do" aria-label="PD do (losowo z przedziału)" bind:value={row.xpTo} />
                    <select value={row.xpMode ?? "dodaj"} onchange={(e) => (row.xpMode = e.currentTarget.value as "zamiast" | "dodaj")} aria-label="Sposób użycia PD">
                      <option value="dodaj">dodaj do poziomu</option>
                      <option value="zamiast">zamiast poziomu</option>
                    </select>
                  </span>
                </label>
              {/if}
              {#if isVampire(row)}
                <label>Linia krwi
                  <select value={row.bloodline ?? ""} onchange={(e) => (row.bloodline = e.currentTarget.value || undefined)}>
                    <option value="">losowa</option>
                    {#each bloodlines as b (b)}<option value={b}>{b}</option>{/each}
                  </select>
                </label>
              {/if}
              <label title={row.heroProfile ? gd.heroProfileText(row.heroProfile) : "Profil z Bestiariusza 2.0"}>Wyjątkowa jednostka
                <select value={row.heroProfile ?? ""} onchange={(e) => (row.heroProfile = e.currentTarget.value || undefined)}>
                  <option value="">losowo (mała szansa)</option>
                  {#each ["Weteran", "Doborowy", "Pomniejszy Bohater", "Wielki Bohater"] as h (h)}<option value={h} title={gd.heroProfileText(h)}>{h}</option>{/each}
                </select>
              </label>
              <label class="check"><input type="checkbox" checked={row.randomTraits !== false} onchange={(e) => (row.randomTraits = e.currentTarget.checked ? undefined : false)} /> dolosuj cechy opcjonalne</label>
              <div class="traits">
                <span class="text-dim small">Cechy Stworzeń:</span>
                {#each randomPool as t (t)}
                  <button class="chip tap" class:warning={row.traits?.includes(t)} aria-pressed={!!row.traits?.includes(t)} title={gd.getCreatureTrait(t)?.description} onclick={() => toggleRowTrait(row, t)}>{t}</button>
                {/each}
              </div>
              {#if hasCareer(row)}
                <div class="path-box">
                  <span class="text-dim small">Ścieżka profesji</span>
                  <PathEditor bind:path={() => row.path ?? [{ profession: "", level: null }], (p) => (row.path = p)} professions={rowProfessions(row)} sex={row.sex ?? "M"} />
                </div>
              {/if}
            </div>
          {/if}
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
        <button class="btn-sm success" onclick={saveGroup} title="Cała grupa jako jeden wpis — do wczytania później w całości">{savedId ? "Zapisz zmiany grupy" : "Zapisz grupę"}</button>
        {#if savedId}<button class="btn-sm" onclick={saveGroupAsNew}>Zapisz jako nową</button>{/if}
        <button class="btn-sm" onclick={saveAll} title="Każdy BN osobno w bibliotece">Zapisz wszystkich do biblioteki</button>
      </div>
    </div>

    <div class="members">
      {#each members as m, i (m.id)}
        {#if collapsed[m.id]}
          <button class="panel collapsed" onclick={() => (collapsed[m.id] = false)}>
            <b>{m.name}</b>{#if m.label} <span class="chip accent">{m.label}</span>{/if}
            <span class="text-dim">{m.archetype || m.creature} · {gd.getTier(m.tier).label}</span>
            <span class="stats-line">{summary(m)}</span>
          </button>
        {:else}
          <div class="member">
            <NpcCard bind:npc={members[i]} onremove={() => members.splice(i, 1)} removeLabel="Usuń z grupy" oncollapse={() => (collapsed[m.id] = true)} />
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
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-panel-2);
  }

  .row-main,
  .row-detail {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .row-detail {
    align-items: flex-end;
    padding-top: var(--space-2);
    border-top: 1px dashed var(--border);
  }

  .row-detail .traits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    width: 100%;
  }

  .path-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .xp-row {
    display: flex;
    gap: 0.3rem;
  }

  .xp-row input {
    width: calc(90px * var(--ui-scale));
  }

  .who-search {
    display: flex;
    width: calc(150px * var(--ui-scale));
  }

  .src {
    font-size: var(--fs-sm);
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
