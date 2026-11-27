<script lang="ts">
  import { searchable } from "../lib/searchable";
  import NpcCard from "./NpcCard.svelte";
    import { pick } from "../lib/dice";
  import * as gd from "../lib/gameData";
  import { creatureTierRange, optionalTraitChoices, sizeOf, toggleOptionalTrait } from "../lib/creatures";
  import { COMMANDER_PROFILE, generateNpc, racesForArchetype, type GenSpec, type PathStep } from "../lib/generator";
  import PathEditor from "./PathEditor.svelte";
  import { TIER_IDS, type Npc, type Sex, type TierId } from "../lib/types";
  import { bloodlineFitsArchetype } from "../lib/vampires";

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
  const typicalCreatures = gd.bestiaryCreatures().filter((c) => !c.unique).map((c) => c.name);

  /** Filtry listy stworzen: Rozmiar ("duze" = Duzy i wiekszy) i Cecha Stworzenia z ksiazki. */
  let sizeFilter = $state("");
  let traitFilter = $state("");
  /** Filtr bazowego poziomu stworzenia (minTier z danych; brak = Nowicjusz). */
  let tierFilter = $state("");
  const baseTierOf = (c: { minTier?: TierId }) => c.minTier ?? "slaby";
  const baseTierLabel = (name: string) => {
    const c = gd.getCreature(name);
    return c ? gd.getTier(baseTierOf(c)).label : "";
  };
  const SIZE_NAMES = ["Drobny", "Niewielki", "Mały", "Średni", "Duży", "Wielki", "Monstrualny"];
  /** Nazwa cechy do filtra: klucz z listy cech bez "(wartość)", a spoza listy - sam rdzen nazwy. */
  const traitLabel = (t: string) =>
    (gd.findCreatureTrait(t)?.key ?? t.replace(/\s*\(.*?\)/g, "").replace(/\s*\+.*$/, "").replace(/\s+\d+\+?$/, "")).replace(/\s*\(wartość\)$/, "").trim();
  const traitOptions = [...new Set(gd.bestiaryCreatures().filter((c) => !c.unique).flatMap((c) => c.traits.map(traitLabel)))]
    .filter((t) => t && !t.startsWith("Rozmiar"))
    .sort((a, b) => a.localeCompare(b, "pl"));
  function passesFilters(c: { traits: string[]; minTier?: TierId }): boolean {
    if (tierFilter && baseTierOf(c) !== tierFilter) return false;
    const size = sizeOf(c.traits);
    if (sizeFilter === "duze" && SIZE_NAMES.indexOf(size) < SIZE_NAMES.indexOf("Duży")) return false;
    if (sizeFilter && sizeFilter !== "duze" && size !== sizeFilter) return false;
    return !traitFilter || c.traits.some((t) => traitLabel(t) === traitFilter);
  }
  let filtersOn = $derived(!!sizeFilter || !!traitFilter || !!tierFilter);

  /** Stworzenia wybranej grupy, pogrupowane wg podgrup (w kolejnosci drzewa grup). */
  let creatureGroups = $derived.by(() => {
    // Unikatowe postacie (Olbrzym szpieg, nazwane bestie) nie trafiaja do generatora - tylko rodzaje stworzen.
    const pool = (creatureGroup ? gd.creaturesInGroup(creatureGroup) : gd.bestiaryCreatures()).filter((c) => !c.unique && passesFilters(c));
    const out: Record<string, string[]> = {};
    for (const { group, subgroups } of groupTree) {
      for (const key of [group, ...subgroups.map((s) => `${group}${gd.GROUP_SEP}${s}`)]) {
        const names = pool.filter((c) => gd.creatureGroupKey(c) === key).map((c) => c.name);
        if (names.length) out[key] = names.sort((a, b) => a.localeCompare(b, "pl"));
      }
    }
    return out;
  });

  // Stworzenie spoza nowo wybranej grupy albo filtrow - wracamy do losowania z grupy.
  $effect(() => {
    if (creature && creatureGroup && !gd.creaturesInGroup(creatureGroup).some((c) => c.name === creature)) creature = "";
    const c = gd.getCreature(creature);
    if (c && filtersOn && !passesFilters(c)) creature = "";
  });

  let civilized = $derived(!!creature && gd.isCivilized(creature));
  /** Stworzenie rozumne bez profesji - wartosc listy archetypow. */
  const NO_CAREER = "-";
  /** Profile wyjatkowej jednostki do wyboru (Dowodca Oddzialu - osobna opcja dowodcy). */
  const HERO_CHOICES = ["Weteran", "Doborowy", "Pomniejszy Bohater", "Wielki Bohater"];
  /** Archetypy dozwolone dla stworzenia (ogr: tylko proste profesje). */
  let creatureArchetypes = $derived.by(() => {
    const allowed = gd.getCreature(creature)?.archetypes;
    const list = allowed ? archetypes.filter((a) => a in allowed) : archetypes;
    // Wampir z wybrana linia: tylko archetypy z jej Preferowanych Profesji (Strigoi nie bedzie czarodziejem).
    return showBloodline && bloodline ? list.filter((a) => bloodlineFitsArchetype(bloodline, a)) : list;
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


  const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: "losowy", label: "Losowy", hint: "Wszystko losowe — jedno kliknięcie." },
    { id: "polLosowy", label: "Pół-losowy", hint: "Ustaw, co chcesz, resztę wylosujemy." },
    { id: "wlasny", label: "Własny", hint: "Wszystko wybierasz sam; rzuty średnie (11), bez losowych odchyleń." }
  ];

  let mode = $state<Mode>("losowy");

  // Pola formularza. Pusty string = "losowo" (w trybie pół-losowym).
  let archetype = $state("");
  let tier = $state<TierId | "">("");
  /** Gorna granica losowania poziomu (pusta = dokladnie wybrany poziom). */
  let tierTo = $state<TierId | "">("");
  let race = $state("");
  let sex = $state<Sex | "">("");
  let name = $state("");
  /** Sciezka profesji: kroki po kolei, ostatni = obecna; poziom null = auto. */
  let path = $state<PathStep[]>([{ profession: "", level: null }]);
  /** Ogr i inne stworzenia wybierane jak rasa. */
  const raceLike = gd.raceLikeCreatures();
  let raceIsCreature = $derived(raceLike.includes(race));
  let chosenTraits = $state<string[]>([]);
  let randomTraits = $state(true);
  let commander = $state(false);
  /** Wyjatkowa jednostka: profil bohatera z Bestiariusza 2.0 ponad rozwoj z profesji. */
  let exceptional = $state("");
  /** PD podane recznie: zamiast budzetu poziomu albo dodane do niego. */
  let xpValue = $state<number | null>(null);
  /** Gorna granica losowania PD (pusta = dokladnie xpValue). */
  let xpToValue = $state<number | null>(null);
  let xpMode = $state<"zamiast" | "dodaj">("dodaj");
  let xpSpec = $derived.by((): Pick<GenSpec, "xp" | "xpBonus" | "xpTo"> => {
    const v = Math.round(Number(xpValue));
    const to = Math.round(Number(xpToValue));
    const hasTo = xpToValue != null && Number.isFinite(to) && to !== v;
    if (xpValue == null || !Number.isFinite(v) || (v === 0 && !hasTo)) return {};
    if (xpMode === "zamiast" || !tier) {
      // PD jako caly budzet - tylko dodatnie.
      const lo = Math.max(0, v);
      const hi = hasTo ? Math.max(0, to) : lo;
      return lo > 0 || hi > 0 ? { xp: lo, ...(hasTo ? { xpTo: hi } : {}) } : {};
    }
    // Ujemne PD odejmuja od budzetu poziomu (np. Ekspert przy dolnej granicy).
    return { xpBonus: v, ...(hasTo ? { xpTo: to } : {}) };
  });
  /** Rzuty bez ograniczen BN (pelne 2k10, najwyzsze do cech kluczowych); w trybie wlasnym domyslnie wlaczone. */
  let freeRolls = $state(false);
  $effect(() => {
    freeRolls = mode === "wlasny";
  });

  /**
   * Poziom stworzenia z przedzialem PD: u bestii PD ponad profil z ksiazki (liczone od
   * minimalnego poziomu stworzenia), u stworzen z profesja - jak u ras.
   */
  function creatureTierLabel(t: TierId, i: number): string {
    if (!beastMode) return gd.tierLabelXp(t);
    const label = gd.getTier(t).label;
    if (i < minTierIdx) return label;
    const [lo, hi] = gd.getTier(t).xp ?? [0, 0];
    const shift = gd.getTier(TIER_IDS[minTierIdx]).xp?.[0] ?? 0;
    const fmt = (n: number) => n.toLocaleString("pl-PL");
    return `${label} (${fmt(lo - shift)}${i === TIER_IDS.length - 1 ? "+" : `–${fmt(hi - shift)}`} PD)`;
  }

  /** Bestia (bez profesji) moze wystapic ponizej swojego minimum - osłabiona, z cechami negatywnymi. */
  let beastMode = $derived(!!creature && (!civilized || archetype === NO_CAREER));

  /** Dozwolone poziomy stworzenia (indeksy): domyslny -2..+3, z profesja bez gornej granicy; grupa - suma przedzialow. */
  let tierRange = $derived.by((): [number, number] => {
    const c = gd.getCreature(creature);
    if (c) return creatureTierRange(c, !beastMode);
    if (!creatureGroup) return [0, TIER_IDS.length - 1];
    const ranges = gd.creaturesInGroup(creatureGroup).filter((x) => !x.unique).map((x) => creatureTierRange(x));
    return ranges.length ? [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))] : [0, TIER_IDS.length - 1];
  });
  const tierAllowed = (i: number) => kind !== "stworzenia" || (i >= tierRange[0] && i <= tierRange[1]);

  $effect(() => {
    if (kind !== "stworzenia" || !tier) return;
    const i = TIER_IDS.indexOf(tier);
    if (!tierAllowed(i)) tier = TIER_IDS[Math.min(tierRange[1], Math.max(tierRange[0], i))];
  });
  // "Do poziomu" tylko powyzej "od" i w przedziale stworzenia.
  $effect(() => {
    if (tierTo && (!tier || TIER_IDS.indexOf(tierTo) <= TIER_IDS.indexOf(tier) || !tierAllowed(TIER_IDS.indexOf(tierTo)))) tierTo = "";
  });

  let npc = $state<Npc | null>(null);
  let history = $state<Npc[]>([]);

  let archetypes = $derived(gd.allArchetypeNames());
  let randomPool = $derived(
    Object.entries(gd.getCreatureTraits()).filter(([, t]) => t.randomPool).map(([n]) => n)
  );
  let otherTraits = $derived(
    Object.entries(gd.getCreatureTraits()).filter(([, t]) => !t.randomPool).map(([n]) => n)
  );
  /** Cechy Opcjonalne wybranego stworzenia z ksiazki (Rój ze stopniem z Bestiariusza 2.0). */
  let creatureOptional = $derived(kind === "stworzenia" && creature ? optionalTraitChoices(gd.getCreature(creature)) : []);

  // W trybie własnym każde pole ma wartość (brak opcji "losowo").
  $effect(() => {
    if (mode !== "wlasny") return;
    if (kind === "stworzenia") {
      // Z filtrami bez wynikow - zostaje puste (inaczej efekt filtrow i ten przestawialyby sie w petli).
      if (!creature) creature = Object.values(creatureGroups)[0]?.[0] ?? (filtersOn ? "" : typicalCreatures[0]);
      if (!tier) tier = "sredni";
      randomTraits = false;
      return;
    }
    if (!archetype) archetype = archetypes[0];
    if (!tier) tier = "slaby";
    if (!sex) sex = "M";
    if (!race || (!racesForArchetype(archetype).includes(race) && !raceLike.includes(race))) race = racesForArchetype(archetype)[0] ?? "Człowiek";
    randomTraits = false;
  });

  let allowedRaces = $derived(archetype ? racesForArchetype(archetype) : gd.allRaceNames());

  /** Ogr korzysta z profesji ludzi. */
  let professionRace = $derived(raceIsCreature ? "Człowiek" : race);

  let professionOptions = $derived.by(() => {
    const arch = archetype ? gd.getArchetype(archetype) : undefined;
    const names = arch ? Object.keys(arch.professions) : gd.allProfessionNames();
    return names.filter((p) => gd.getProfession(p) && (!professionRace || gd.professionAllowsRace(p, professionRace)));
  });

  let allProfessions = $derived(
    gd.allProfessionNames().filter((p) => !professionRace || gd.professionAllowsRace(p, professionRace))
  );

  /** Najpierw profesje archetypu, potem pozostale. */
  let pathOptions = $derived([...professionOptions, ...allProfessions.filter((p) => !professionOptions.includes(p))]);

  function toggleTrait(t: string) {
    chosenTraits = chosenTraits.includes(t) ? chosenTraits.filter((x) => x !== t) : [...chosenTraits, t];
  }

  function buildSpec(): GenSpec {
    if (kind === "stworzenia") {
      if (mode === "losowy") return { creature: pick(typicalCreatures) };
      // Z filtrami: losowo z przefiltrowanej listy (grupa juz w niej uwzgledniona).
      const filtered = filtersOn && !creature ? Object.values(creatureGroups).flat() : [];
      const chosen = creature || (filtered.length ? pick(filtered) : "");
      return {
        creature: chosen || (creatureGroup ? undefined : pick(typicalCreatures)),
        creatureGroup: chosen ? undefined : creatureGroup || undefined,
        bloodline: showBloodline && bloodline ? bloodline : undefined,
        archetype: civilized && archetype && archetype !== NO_CAREER ? archetype : undefined,
        noArchetype: civilized && archetype === NO_CAREER,
        tier: (tier || undefined) as TierId | undefined,
        tierTo: (tierTo || undefined) as TierId | undefined,
        name: name.trim() || undefined,
        traits: chosenTraits,
        randomTraits,
        commander,
        heroProfiles: exceptional ? [exceptional] : [],
        ...xpSpec,
        freeRolls,
        deterministic: mode === "wlasny"
      };
    }
    if (mode === "losowy") return {};
    // Poziom podany w ktoryms kroku albo kilka krokow - dokladna sciezka; sama obecna profesja - jak dotad.
    const chosen = path.filter((s) => s.profession);
    const main = path[path.length - 1]?.profession;
    const exact = path.some((s) => s.level != null) || (path.length > 1 && chosen.length > 0);
    return {
      archetype: archetype || undefined,
      tier: (tier || undefined) as TierId | undefined,
      tierTo: (tierTo || undefined) as TierId | undefined,
      ...(raceIsCreature ? { creature: race, asRace: true } : { race: race || undefined }),
      sex: (sex || undefined) as Sex | undefined,
      name: name.trim() || undefined,
      professions: !exact && main ? [main] : undefined,
      path: exact ? $state.snapshot(path) : undefined,
      traits: chosenTraits,
      randomTraits,
      commander,
      heroProfiles: exceptional ? [exceptional] : [],
      ...xpSpec,
      freeRolls,
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
    archetype = tier = tierTo = race = sex = creature = creatureGroup = bloodline = sizeFilter = traitFilter = tierFilter = "";
    name = "";
    xpToValue = null;
    path = [{ profession: "", level: null }];
    chosenTraits = [];
    randomTraits = true;
    commander = false;
    exceptional = "";
    xpValue = null;
    xpMode = "dodaj";
  }
</script>

{#snippet tierToField(labelOf: (t: TierId, i: number) => string)}
  {#if tier}
    <label title="Poziom losowany równo z przedziału od wybranego do tego">Do poziomu
      <select use:searchable bind:value={tierTo}>
        <option value="">— tylko wybrany —</option>
        {#each TIER_IDS as t, i (t)}
          {#if i > TIER_IDS.indexOf(tier) && tierAllowed(i)}<option value={t}>{labelOf(t, i)}</option>{/if}
        {/each}
      </select>
    </label>
  {/if}
{/snippet}

{#snippet xpField()}
  <label class="xp-field" title="PD ponad tworzenie postaci, wydawane wg priorytetów archetypu; liczba ujemna odejmuje PD od poziomu. Drugie pole: losuj PD z przedziału od–do.">PD
    <span class="xp-row">
      <input type="number" step="100" placeholder="wg poziomu" bind:value={xpValue} />
      {#if xpValue != null}
        <span class="text-dim">–</span>
        <input type="number" step="100" placeholder="do" aria-label="PD do (losowo z przedziału)" bind:value={xpToValue} />
      {/if}
      {#if tier}
        <select use:searchable bind:value={xpMode} aria-label="Sposób użycia PD">
          <option value="dodaj">dodaj do poziomu</option>
          <option value="zamiast">zamiast poziomu</option>
        </select>
      {:else}
        <span class="text-dim small xp-auto" title="Bez wybranego poziomu PD są całym budżetem, a poziom wynika z przedziału, w który wpadają">poziom wg PD</span>
      {/if}
    </span>
  </label>
{/snippet}

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
          <select use:searchable bind:value={creatureGroup}>
            <option value="">— wszystkie —</option>
            {#each groupTree as g (g.group)}
              <option value={g.group}>{g.group}</option>
              {#each g.subgroups as s (s)}<option value={`${g.group}${gd.GROUP_SEP}${s}`}>&nbsp;&nbsp;› {s}</option>{/each}
            {/each}
          </select>
        </label>
        <label>Rozmiar
          <select use:searchable bind:value={sizeFilter}>
            <option value="">— każdy —</option>
            <option value="duze">Duży i większy</option>
            {#each SIZE_NAMES as s (s)}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <label>Cecha
          <select use:searchable bind:value={traitFilter}>
            <option value="">— dowolna —</option>
            {#each traitOptions as t (t)}<option value={t}>{t}</option>{/each}
          </select>
        </label>
        <label>Poziom bazowy
          <select use:searchable bind:value={tierFilter}>
            <option value="">— każdy —</option>
            {#each TIER_IDS as t (t)}<option value={t}>{gd.getTier(t).label}</option>{/each}
          </select>
        </label>
        <label>Stworzenie
          <select use:searchable bind:value={creature}>
            {#if mode === "polLosowy"}<option value="">{creatureGroup ? "— losowo z grupy —" : "— losowo —"}</option>{/if}
            {#each Object.entries(creatureGroups) as [group, names] (group)}
              <optgroup label={group}>
                {#each names as c (c)}<option value={c}>{c} ({baseTierLabel(c)})</option>{/each}
              </optgroup>
            {/each}
          </select>
        </label>
        {#if showBloodline}
          <label>Linia krwi
            <select use:searchable bind:value={bloodline}>
              <option value="">— losowa —</option>
              {#each bloodlines as b (b)}<option value={b}>{b}</option>{/each}
            </select>
          </label>
        {/if}
        {#if civilized}
          <label>Archetyp (profesje)
            <select use:searchable bind:value={archetype}>
              <option value="">— losowo (wg stworzenia) —</option>
              {#if !showBloodline}<option value={NO_CAREER}>— bez profesji (jak bestia) —</option>{/if}
              {#each creatureArchetypes as a (a)}<option value={a}>{a}</option>{/each}
            </select>
          </label>
        {/if}
        <label>Poziom
          <select use:searchable bind:value={tier}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each TIER_IDS as t, i (t)}
              <option value={t} disabled={!tierAllowed(i)}>{creatureTierLabel(t, i)}{beastMode && i < minTierIdx ? ` — osłabiony (${minTierIdx - i} ${minTierIdx - i === 1 ? "cecha negatywna" : "cechy negatywne"})` : !civilized || !archetype
                  ? ` — ${gd.getCreatureFamilies().settings.tierLabels[TIER_IDS[Math.max(0, i - minTierIdx)]]}`
                  : ""}</option>
            {/each}
          </select>
        </label>
        {@render tierToField(creatureTierLabel)}
        {@render xpField()}
        <label>Imię
          <input type="text" placeholder="nazwa stworzenia" bind:value={name} />
        </label>
      </div>
      {#if creature}
        <p class="text-dim hint">
          {gd.getCreature(creature)?.source}, s. {gd.getCreature(creature)?.page} · rodzina: {gd.getCreature(creature)?.family}
          {civilized ? " · może rozwijać się przez profesje" : " · rozwój przez umiejętności i Cechy Stworzeń"}
          · domyślny poziom: {gd.getTier(TIER_IDS[minTierIdx]).label} (dozwolone: {gd.getTier(TIER_IDS[tierRange[0]]).label}–{gd.getTier(TIER_IDS[tierRange[1]]).label})
        </p>
        {@const entry = gd.getCreature(creature)}
        {#if entry}
          <details class="entry">
            <summary>Wpis z bestiariusza: {entry.name}</summary>
            <p class="small">{entry.group}{entry.subgroup ? ` › ${entry.subgroup}` : ""} · rodzina: {entry.family}{entry.unique ? " · istota unikatowa" : ""}</p>
            <p class="small mono">{Object.entries(entry.stats).filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
            <p class="small"><b>Cechy:</b> {entry.traits.join(", ") || "—"}</p>
            {#if entry.optional.length}<p class="small"><b>Opcjonalne:</b> {entry.optional.join(", ")}</p>{/if}
            {#each entry.abilities as a, ai (ai)}<p class="small">{typeof a === "string" ? a : `${a.name}: ${a.description}`}</p>{/each}
            {#if entry.trappings.length}<p class="small"><b>Wyposażenie:</b> {entry.trappings.join(", ")}</p>{/if}
          </details>
        {/if}
      {/if}
    {/if}

    {#if mode !== "losowy" && kind === "rasy"}
      <div class="form">
        <label>Archetyp
          <select use:searchable bind:value={archetype}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each archetypes as a (a)}<option value={a}>{a}</option>{/each}
          </select>
        </label>
        <label>Poziom
          <select use:searchable bind:value={tier}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each TIER_IDS as t (t)}<option value={t}>{gd.tierLabelXp(t)}</option>{/each}
          </select>
        </label>
        {@render tierToField((t) => gd.tierLabelXp(t))}
        {@render xpField()}
        <label>Rasa
          <select use:searchable bind:value={race}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            {#each gd.allRaceNames() as r (r)}<option value={r} disabled={!allowedRaces.includes(r)}>{r}</option>{/each}
            {#if raceLike.length}
              <optgroup label="Inne rasy (ze Stworzeń)">
                {#each raceLike as r (r)}<option value={r}>{r}</option>{/each}
              </optgroup>
            {/if}
          </select>
        </label>
        <label>Płeć
          <select use:searchable bind:value={sex}>
            {#if mode === "polLosowy"}<option value="">— losowo —</option>{/if}
            <option value="M">mężczyzna</option>
            <option value="K">kobieta</option>
          </select>
        </label>
        <label>Imię
          <input type="text" placeholder="losowe" bind:value={name} />
        </label>
      </div>
      <div class="path-box">
        <span class="lbl">Ścieżka profesji</span>
        <PathEditor bind:path professions={pathOptions} sex={(sex || "M") as Sex} />
      </div>
    {/if}

    {#if mode !== "losowy"}
      {#if creatureOptional.length}
        <div class="traits">
          <span class="lbl">Opcjonalne z bestiariusza:</span>
          {#each creatureOptional as t (t)}
            <button class="chip tap" class:warning={chosenTraits.includes(t)} aria-pressed={chosenTraits.includes(t)} title={gd.findCreatureTrait(t)?.trait.description} onclick={() => (chosenTraits = toggleOptionalTrait(chosenTraits, t))}>{t}</button>
          {/each}
        </div>
      {/if}
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
        <label class="check"><input type="checkbox" bind:checked={randomTraits} /> Dolosuj cechy opcjonalne (7% jedna, 1% dwie)</label>
        <label class="check" title={exceptional ? gd.heroProfileText(exceptional) : "Profil z Bestiariusza 2.0 dodawany do cech i umiejętności ponad rozwój z profesji"}>Wyjątkowa jednostka<select use:searchable bind:value={exceptional}><option value="">— losowo (mała szansa) —</option>{#each HERO_CHOICES as hp (hp)}<option value={hp} title={gd.heroProfileText(hp)}>{hp}</option>{/each}</select></label>
        <label class="check"><input type="checkbox" bind:checked={commander} /> {COMMANDER_PROFILE}</label>
        <label class="check" title="Domyślnie rzuty BN są przycięte do 5–17, połowa BN zostawia je w kolejności, reszta zamienia najwyżej 2 rzuty. Zaznaczone: pełne 2k10, najwyższe rzuty do cech kluczowych archetypu (w trybie Własnym rzuty i tak są średnie, 11).">
          <input type="checkbox" bind:checked={freeRolls} /> Rzuty bez ograniczeń (2–20, dowolne rozłożenie)
        </label>
        <button class="btn-sm ghost" onclick={resetForm}>Wyczyść</button>
      </div>
      {#if exceptional}
        <p class="text-dim hint">{exceptional}: {gd.heroProfileText(exceptional).replace("\n", " ")}</p>
      {/if}
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
  .path-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .path-box .lbl {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .entry {
    font-size: var(--fs-sm);
  }
  .entry summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  .entry p {
    margin: 0.25rem 0;
  }
  .xp-field {
    grid-column: span 2;
  }
  .xp-row {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .xp-row input {
    width: 5.5rem;
    flex: none;
  }
  .xp-row select {
    flex: 1;
    min-width: 0;
  }
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
