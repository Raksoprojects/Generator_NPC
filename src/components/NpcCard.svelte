<script lang="ts">
  import Autocomplete from "./Autocomplete.svelte";
  import Modal from "./Modal.svelte";
  import RichText from "./RichText.svelte";
  import { spellBook } from "../lib/magic";
  import { app } from "../lib/app.svelte";
  import { allArmourNames, allWeaponNames, qualityDescription } from "../lib/equipment";
  import { copyText, downloadText, safeFileName } from "../lib/files";
  import * as gd from "../lib/gameData";
  import { isBeast, pickName, racesForArchetype, rebuildDevelopment, rerollNpc } from "../lib/generator";
  import { beastTier } from "../lib/creatures";
  import { mutationIcon, mutationLabel, mutationRow, mutationTable, rollLocation, rollMutation, rollMutationDice, usesHandbook } from "../lib/mutations";
  import { findMagicItem } from "../lib/magicItems";
  import { craftDescription } from "../lib/treasures";
  import { armourLine, computeNpc, effectiveCn, normalizeNpc, npcToText, weaponLabel } from "../lib/npc";
  import { ATTRIBUTES, ATTRIBUTE_NAMES } from "../lib/rules";
  import { TIER_IDS, type MutationSeverity, type Npc, type NpcMutation, type NpcSection, type SpellDef, type TierId } from "../lib/types";

  let {
    npc = $bindable(),
    onremove,
    removeLabel = "Usuń"
  }: {
    npc: Npc;
    onremove?: () => void;
    removeLabel?: string;
  } = $props();

  normalizeNpc(npc);

  let editing = $state(false);
  let openInfo = $state<string | null>(null);

  let view = $derived.by(() => {
    void app.dataVersion;
    return computeNpc(npc);
  });
  /** Zaklecia poza najwazniejszymi - na dole karty. */
  let otherSpells = $derived(view.spells.filter((s) => !view.keySpells.includes(s)));
  /** Opis zaklecia z dolnej listy pokazujemy pod nia, nie w srodku karty. */
  let bottomInfo = $derived(!!openInfo?.startsWith("s|") && otherSpells.some((s) => `s|${s.name}` === openInfo));

  function spellCn(s: SpellDef): string {
    const cn = effectiveCn(s, view.casting);
    return cn !== s.cn ? `${cn} (z ${s.cn})` : `${cn}`;
  }

  let creature = $derived(gd.getCreature(npc.creature));
  let beast = $derived(isBeast(npc));
  let keySkills = $derived(gd.getArchetype(npc.archetype)?.keySkills ?? []);
  let tierLabel = $derived.by(() => {
    const label = gd.getTier(npc.tier)?.label ?? npc.tier;
    const shifted = creature ? beastTier(npc, creature) : npc.tier;
    return beast ? `${label} — ${gd.getCreatureFamilies().settings.tierLabels[shifted] ?? ""}` : label;
  });
  let saved = $derived(app.isSaved(npc.id));

  function isKeySkill(name: string): boolean {
    const n = gd.normalize(name);
    const base = gd.normalize(gd.splitSpec(name).base);
    return keySkills.some((k) => gd.normalize(k) === n || gd.normalize(k) === base);
  }

  function charTitle(code: (typeof ATTRIBUTES)[number]): string {
    const c = view.chars[code];
    if (c.absent) return `${ATTRIBUTE_NAMES[code]}: stworzenie nie posiada tej cechy`;
    const parts = [`baza ${c.base}`, `rzut ${c.roll}`, `rozw. ${c.advances}`];
    for (const s of c.sources) parts.push(`${s.label} ${signed(s.value)}`);
    return `${ATTRIBUTE_NAMES[code]}: ${parts.join(" + ")} = ${c.total}`;
  }

  const signed = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

  /** Modyfikatory z Cech Stworzen, mutacji, Linii Krwi i przedmiotow - widoczne pod tabela cech. */
  let hiddenModifiers = $derived(
    ATTRIBUTES.flatMap((code) =>
      view.chars[code].absent ? [] : view.chars[code].sources.filter((s) => s.kind !== "hero" && s.kind !== "talent").map((s) => ({ code, ...s }))
    )
  );

  function snapshot(): Npc {
    return $state.snapshot(npc) as Npc;
  }

  // --- Akcje ---

  const LOCKS: { id: NpcSection; label: string }[] = [
    { id: "tozsamosc", label: "Imię" },
    { id: "rzuty", label: "Rzuty" },
    { id: "rozwoj", label: "Rozwój" },
    { id: "cechyStworzen", label: "Cechy i mutacje" }
  ];

  function toggleLock(id: NpcSection) {
    npc.locks = { ...npc.locks, [id]: !npc.locks[id] };
  }

  function reroll() {
    npc = rerollNpc(snapshot());
  }

  function newName() {
    npc.name = pickName(npc.race, npc.sex, Math.random);
  }

  function save() {
    app.saveNpc(npc);
    app.notify(`Zapisano: ${npc.name}`);
  }

  async function copy() {
    const ok = await copyText(npcToText(snapshot(), view));
    app.notify(ok ? "Skopiowano blok statystyk." : "Nie udało się skopiować.");
  }

  function exportJson() {
    downloadText(safeFileName(npc.name, "json"), JSON.stringify(snapshot(), null, 2));
  }

  // --- Edycja: przebudowa rozwoju ---

  let mainProfession = $state("");
  let prevProfession = $state("");

  $effect(() => {
    if (!editing) return;
    const careers = [...new Set(npc.careerPath.map((s) => s.profession))];
    mainProfession = careers[careers.length - 1] ?? "";
    prevProfession = careers.length > 1 ? careers[0] : "";
  });

  let professionOptions = $derived(
    gd.allProfessionNames().filter((p) => gd.professionAllowsRace(p, creature ? "Człowiek" : npc.race))
  );

  function rebuild() {
    const profs = [prevProfession, mainProfession].filter(Boolean);
    npc = rebuildDevelopment(snapshot(), profs.length ? profs : undefined);
  }

  // --- Edycja: umiejetnosci, talenty, bron, zaklecia, cechy ---

  let newSkill = $state("");
  let newTalent = $state("");
  let newWeapon = $state("");
  let newArmour = $state("");
  let newSpell = $state("");
  let newMutation = $state("");

  const weaponNames = allWeaponNames();
  const armourNames = allArmourNames();
  const spellNames = gd.getSpellsData().spells.map((s) => s.name);
  const KIND_LABEL = { physical: "Fizyczne", mental: "Psychiczne" } as const;
  const SEVERITY_LABEL = { trivial: "błahe", minor: "pomniejsze", major: "poważne" } as const;
  const mutationGroups = (["physical", "mental"] as const).flatMap((kind) =>
    usesHandbook()
      ? (["trivial", "minor", "major"] as const).map((table) => ({
          label: `${KIND_LABEL[kind]} — ${SEVERITY_LABEL[table]}`,
          options: mutationTable(kind, table)
            .filter((r) => !r.reroll)
            .map((r) => ({ value: `${kind}|${table}|${r.name}`, text: r.name }))
        }))
      : [{ label: KIND_LABEL[kind], options: mutationTable(kind).map((r) => ({ value: `${kind}||${r.name}`, text: r.name })) }]
  ).concat(
    (
      [
        ["gift", "Dary Chaosu"],
        ["bloodline", "Wampiry — Linia Krwi"],
        ["blood", "Wampiry — Dary Krwi"],
        ["weakness", "Wampiry — Słabości"]
      ] as const
    ).map(([kind, label]) => ({ label, options: mutationTable(kind).map((r) => ({ value: `${kind}||${r.name}`, text: r.name })) }))
  );

  function addSkill() {
    const name = newSkill.trim();
    if (!name || npc.skills.some((s) => s.name === name)) return;
    npc.skills.push({ name, advances: 5 });
    newSkill = "";
  }

  function addTalent() {
    const name = newTalent.trim();
    if (!name || npc.talents.some((t) => t.name === name)) return;
    npc.talents.push({ name, level: 1 });
    newTalent = "";
  }

  function addTo(list: "weapons" | "armour" | "spells", value: string, reset: () => void) {
    const name = value.trim();
    if (!name || npc[list].includes(name)) return;
    npc[list] = [...npc[list], name];
    reset();
  }

  function addMutation() {
    if (!newMutation) return;
    const [kind, table, name] = newMutation.split("|") as [NpcMutation["kind"], MutationSeverity | "", string];
    const m: NpcMutation = { kind, name };
    if (table) m.table = table;
    const row = mutationRow(m);
    if (row?.rollLocation) m.location = rollLocation(Math.random);
    const rolled = row && rollMutationDice(row, Math.random);
    if (rolled) m.rolled = rolled;
    npc.mutations = [...npc.mutations, m];
    newMutation = "";
  }

  function addRandomMutation() {
    const m = rollMutation(Math.random, undefined, npc.mutations.map((x) => x.name), npc.mutations.length);
    npc.mutations = [...npc.mutations, m];
  }

  function toggleTrait(name: string) {
    npc.traits = npc.traits.includes(name) ? npc.traits.filter((t) => t !== name) : [...npc.traits, name];
  }

  function toggleProfile(name: string) {
    npc.heroProfiles = npc.heroProfiles.includes(name)
      ? npc.heroProfiles.filter((t) => t !== name)
      : [...npc.heroProfiles, name];
  }

  let trappingsText = $derived(npc.trappings.join("\n"));

  function setTrappings(text: string) {
    npc.trappings = text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }

  // --- Opisy po kliknieciu ---

  function toggleInfo(key: string) {
    openInfo = openInfo === key ? null : key;
  }

  /** Opis cechy stworzenia: najpierw dokladna nazwa, potem nazwa bazowa ("Pancerz (2)" -> "Pancerz (wartość)"). */
  function traitText(name: string): string {
    // Premie z profili bohaterow (Bestiariusz 2.0).
    const bonus = /^\+(\d+) do (Pancerza|Broni)/.exec(name);
    if (bonus) {
      return bonus[2] === "Pancerza"
        ? `Stworzenie ma dodatkowe ${bonus[1]} PP na wszystkich Miejscach Trafienia (profil bohatera, Bestiariusz 2.0).`
        : `Ataki stworzenia zadają +${bonus[1]} Obrażeń (profil bohatera, Bestiariusz 2.0).`;
    }
    const hit = gd.findCreatureTrait(name);
    if (hit) {
      const text = hit.trait.rules || hit.trait.description;
      // Inna nazwa tej samej cechy (np. "Mistrz" = Czempion) - pokaz nazwe z podrecznika.
      return gd.traitBase(hit.key) === gd.traitBase(name) ? text : `${hit.key}: ${text}`;
    }
    // Zdolnosc wlasna stworzenia zapisana jako cecha (np. Pochlonięcie ameby).
    return view.abilities.find((a) => gd.normalize(a.name) === gd.normalize(name))?.description ?? "";
  }

  /** Opis zalety/wady; "A albo B" - opisy obu opcji. */
  function qualityText(q: string): string {
    return q
      .split(" albo ")
      .map((part) => `${part}: ${craftDescription(part) || qualityDescription(part) || "—"}`)
      .join(" ALBO ");
  }

  interface InfoBody {
    meta?: [string, string][];
    text: string;
    source?: string;
  }

  const where = (source?: string, page?: number | string) => (source ? `${source}${page ? `, s. ${page}` : ""}` : "");

  function spellMeta(s: SpellDef): [string, string][] {
    return [
      ["PZ", spellCn(s)],
      ["Zasięg", s.range],
      ["Cel", s.target],
      ["Czas trwania", s.duration],
      ["Tradycja", gd.getSpellsData().lores[s.lore]?.label ?? s.lore]
    ];
  }

  function infoBody(key: string): InfoBody {
    const [kind, name] = key.split("|");
    if (kind === "t") {
      const t = gd.getTalent(name);
      if (!t) return { text: "Talent spoza bazy." };
      const meta: [string, string][] = [];
      if (t.max_raw) meta.push(["Maksimum", t.max_raw]);
      if (t.tests) meta.push(["Testy", t.tests]);
      return { meta, text: t.description ?? "Brak opisu." };
    }
    if (kind === "c") return { text: traitText(name) };
    if (kind === "p") return { text: gd.getHeroProfile(name)?.description ?? "" };
    if (kind === "q") return { text: qualityText(name).split(" ALBO ").join("\nALBO\n") };
    if (kind === "x") return { text: view.magicItems.find((m) => m.name === name)?.description ?? "" };
    if (kind === "g") {
      const mat = gd.getTreasures()?.craft.materials[name];
      return mat ? { text: mat.description, source: where(mat.source, mat.page) } : { text: "" };
    }
    if (kind === "a") return { text: view.abilities.find((a) => a.name === name)?.description ?? "" };
    if (kind === "m") return { text: view.mutations.find((m) => m.label === name)?.effect ?? "" };
    if (kind === "l") return { text: gd.getSpellsData().lores[name]?.rule ?? "" };
    if (kind === "i") {
      const item = findMagicItem(name);
      const scroll = /^zwój z zaklęciem: (.+)$/.exec(name);
      const spell = scroll ? gd.getSpell(scroll[1]) : undefined;
      const base = item?.description ?? "";
      if (!spell) return { text: base, source: where(item?.source, item?.page) };
      return { meta: spellMeta(spell), text: `${base}\n${spell.description}`.trim(), source: where(spell.source, spell.page) };
    }
    if (kind === "s") {
      const s = gd.getSpell(name);
      return s ? { meta: spellMeta(s), text: s.description, source: where(s.source, s.page) } : { text: "" };
    }
    return { text: "" };
  }

  function infoTitle(key: string): string {
    const [kind, name] = key.split("|");
    return kind === "l" ? (gd.getSpellsData().lores[name]?.label ?? name) : name;
  }

  // --- Ksiega zaklec: wszystkie zaklecia tradycji BN ---

  let bookOpen = $state(false);
  let bookLore = $state("");
  let bookSpell = $state<string | null>(null);
  let book = $derived(bookOpen ? spellBook(npc) : []);
  let bookGroup = $derived(book.find((g) => g.lore === bookLore) ?? book[0]);
  let knownSpells = $derived(new Set(npc.spells));

  function openBook() {
    bookOpen = true;
    bookSpell = null;
    bookLore = "";
  }
</script>

{#snippet infoPanel(key: string)}
  {@const body = infoBody(key)}
  <div class="info" role="note">
    <div class="info-body">
      <b class="info-title">{infoTitle(key)}</b>
      <RichText meta={body.meta} text={body.text} source={body.source} />
    </div>
    <button class="btn-sm ghost" onclick={() => (openInfo = null)} aria-label="Zamknij opis">✕</button>
  </div>
{/snippet}

<article class="npc panel" class:editing>
  <header class="head">
    <div class="title">
      {#if editing}
        <div class="name-edit">
          <input class="name-input" type="text" bind:value={npc.name} aria-label="Imię" />
          {#if !beast}<button class="btn-sm ghost" title="Wylosuj nowe imię" onclick={newName}>🎲</button>{/if}
        </div>
      {:else}
        <h3>
          {npc.name}
          {#if npc.label}<span class="chip accent">{npc.label}</span>{/if}
        </h3>
      {/if}
      <p class="meta">
        {#if creature}
          <b>{creature.name}</b> <span class="text-dim">({gd.creatureGroupKey(creature)})</span>
          {#if npc.turned}<span class="text-dim" title="Wampir przemieniony z człowieka: cechy człowieka, profesje za życia i premie Linii Krwi"> · przemieniony człowiek, {npc.sex === "K" ? "kobieta" : "mężczyzna"}</span>{/if}
          {#if npc.archetype} · {npc.archetype}{/if}
        {:else}
          {npc.race} · {npc.sex === "K" ? "kobieta" : "mężczyzna"} · <b>{npc.archetype}</b>
        {/if}
        · {tierLabel}
        {#if npc.group}<span class="text-dim"> · {npc.group}</span>{/if}
      </p>
      {#if view.career}
        <p class="career">
          <b>{view.career.title}</b>
          <span class="text-dim">({view.career.professionName} {view.career.level}{view.career.status ? `, ${view.career.status}` : ""})</span>
        </p>
        {#if npc.careerPath.length > 1}
          <p class="path text-dim">{view.careerPathText}</p>
        {/if}
      {/if}
    </div>
    <div class="head-actions">
      <button class="btn-sm" class:primary={editing} onclick={() => (editing = !editing)}>
        {editing ? "Gotowe" : "Edytuj"}
      </button>
      <button class="btn-sm" title="Kopiuj blok statystyk jako tekst" onclick={copy}>Kopiuj</button>
      <button class="btn-sm" class:success={!saved} title="Zapisz w bibliotece" onclick={save}>
        {saved ? "Zapisz zmiany" : "Zapisz"}
      </button>
    </div>
  </header>

  <!-- Cechy -->
  <div class="stats" role="table" aria-label="Cechy">
    {#each ATTRIBUTES as code (code)}
      <div class="stat" role="cell" title={charTitle(code)}>
        <span class="code">{code}</span>
        <span class="val">{view.chars[code].absent ? "–" : view.chars[code].total}</span>
        {#if editing && !view.chars[code].absent}
          <label class="mini">rzut <input type="number" min="1" max="20" bind:value={npc.rolls[code]} /></label>
          <label class="mini">rozw. <input type="number" min="0" bind:value={npc.charAdvances[code]} /></label>
        {/if}
      </div>
    {/each}
    <div class="stat derived" role="cell" title="Żywotność">
      <span class="code">Żyw</span>
      <span class="val">{view.wounds}</span>
    </div>
    <div class="stat derived" role="cell" title="Szybkość (Chód {view.movement * 2} / Bieg {view.movement * 4})">
      <span class="code">Sz</span>
      <span class="val">{view.movement}</span>
    </div>
  </div>
  {#if hiddenModifiers.length}
    <p class="char-mods small">
      <span class="text-dim">Modyfikatory cech:</span>
      {#each hiddenModifiers as m, i (i)}
        <span class:neg={m.value < 0} class:pos={m.value > 0}>{m.code} {signed(m.value)}</span>
        <span class="text-dim">({m.label}){i < hiddenModifiers.length - 1 ? "," : ""}</span>
      {/each}
    </p>
  {/if}

  <!-- Walka: bron i redukcja obrazen -->
  <section class="combat">
    {#each view.weapons as w (w.name)}
      <div class="weapon">
        {#if w.magicItem}<button class="magic-mark tap" title="Przedmiot magiczny" onclick={() => toggleInfo(`x|${w.magicItem}`)}>✦ {w.magicItem}</button>{/if}
        <b title={[w.reach ? `Długość: ${w.reach}` : "", w.note ?? ""].filter(Boolean).join(" · ")}>{weaponLabel(w)}</b>
        {#if w.craftLabel}<span class="text-dim small">{w.craftLabel}</span>{/if}
        <span class="text-dim small">{w.skillName}</span>
        {#each w.qualities as q (q)}
          <button class="quality tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
        {/each}
        {#each w.flaws as q (q)}
          <button class="quality flaw tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
        {/each}
        {#each w.craftQualities as q (q)}
          <button class="quality craft tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
        {/each}
        {#each w.craftFlaws as q (q)}
          <button class="quality flaw craft tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
        {/each}
      </div>
    {/each}
    {#if view.casting}
      {@const c = view.casting}
      <div class="casting">
        <span title={c.channel.sources.join(", ")}>
          <span class="text-dim">Splatanie:</span> <b>{c.channel.value}</b>
          <span class="text-dim small">{c.channel.name}</span>{#if c.channel.sl}<b class="bonus">+{c.channel.sl} PS</b>{/if}
        </span>
        <span title={c.cast.sources.join(", ")}>
          <span class="text-dim">Rzucanie:</span> <b>{c.cast.value}</b>
          <span class="text-dim small">{c.cast.name}</span>{#if c.cast.sl}<b class="bonus">+{c.cast.sl} PS</b>{/if}
        </span>
        {#if c.cnMod}<span class="chip info" title={c.cnSources.join(", ")}>PZ −{Math.abs(c.cnMod)} ({c.cnSources.join(", ")})</span>{/if}
        {#each c.lores.filter((l) => l.rule) as l (l.key)}
          <button class="chip tap" title={l.rule} onclick={() => toggleInfo(`l|${l.key}`)}>{l.label}</button>
        {/each}
        {#if c.channel.sources.length || c.cast.sources.length}
          <span class="text-dim small">{[...c.channel.sources, ...c.cast.sources].join(" · ")}</span>
        {/if}
        {#if view.keySpells.length && !editing}
          <span class="key-spells">
            <span class="text-dim">Najważniejsze zaklęcia:</span>
            {#each view.keySpells as s (s.name)}
              <button class="item tap" onclick={() => toggleInfo(`s|${s.name}`)}>
                {s.name} <span class="text-dim">PZ {spellCn(s)}</span>
              </button>
            {/each}
          </span>
        {/if}
      </div>
    {/if}
    <div class="armour" title="Redukcja obrażeń = Bonus z Wytrzymałości + Punkty Pancerza">
      <span class="text-dim">Redukcja obrażeń:</span>
      <b>{armourLine(view)}</b>
      {#each view.armourPenalties as p (p)}<span class="chip warning">{p}</span>{/each}
    </div>
    {#if view.armourPieces.length}
      <div class="armour-pieces">
        {#each view.armourPieces as a (a.name)}
          <span class="piece">
            {#if a.magicItem}<button class="magic-mark tap" onclick={() => toggleInfo(`x|${a.magicItem}`)}>✦</button>{/if}
            <b>{a.name}</b> <span class="text-dim small">{a.ap} PP{a.craftLabel ? `, ${a.craftLabel}` : ""}</span>
            {#each a.qualities as q (q)}
              <button class="quality tap" class:flaw={/Częściow|Wrażliw/.test(q)} title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
            {/each}
            {#each a.craftQualities as q (q)}
              <button class="quality craft tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
            {/each}
            {#each a.craftFlaws as q (q)}
              <button class="quality flaw craft tap" title={qualityText(q)} onclick={() => toggleInfo(`q|${q}`)}>{q}</button>
            {/each}
          </span>
        {/each}
      </div>
    {/if}
    {#if view.magicItems.length}
      <div class="magic-items">
        <span class="text-dim">Przedmioty magiczne:</span>
        {#each view.magicItems as m (m.name)}
          <button class="item tap magic" title={m.description} onclick={() => toggleInfo(`x|${m.name}`)}>✦ {m.name}</button>
        {/each}
      </div>
    {/if}
  </section>

  {#if !editing}
    <section class="block">
      <h4>Umiejętności</h4>
      <p class="list">
        {#each view.skills as s (s.name)}
          <span class="item" class:key={isKeySkill(s.name)} title="{s.attr} + {s.advances}{s.traitBonus ? ` + ${s.traitBonus} (cecha)` : ''}">
            {s.name} <b>{s.total}</b>
          </span>
        {:else}
          <span class="text-dim">brak</span>
        {/each}
      </p>
    </section>

    {#if view.talents.length}
      <section class="block">
        <h4>Talenty</h4>
        <p class="list">
          {#each view.talents as t (t.name)}
            <button class="item tap" class:unknown={!t.known} onclick={() => toggleInfo(`t|${t.name}`)}>
              {t.name}{t.level > 1 ? ` ${t.level}` : ""}
            </button>
          {/each}
        </p>
      </section>
    {/if}

    {#if view.creatureTraits.length || npc.traits.length || npc.heroProfiles.length || view.heroTraits.length || view.mutations.length}
      <section class="block">
        <h4>Cechy Stworzeń, profile i mutacje</h4>
        <p class="list">
          {#each view.creatureTraits as tr (tr)}
            <button class="chip tap" onclick={() => toggleInfo(`c|${tr}`)}>{tr}</button>
          {/each}
          {#each npc.traits as tr (tr)}
            <button class="chip warning tap" title="Wylosowana cecha — zmienia statystyki" onclick={() => toggleInfo(`c|${tr}`)}>{tr}</button>
          {/each}
          {#each npc.heroProfiles as hp (hp)}
            <button class="chip info tap" onclick={() => toggleInfo(`p|${hp}`)}>{hp}</button>
          {/each}
          {#each view.heroTraits as ht (ht)}
            <span class="chip">{ht}</span>
          {/each}
          {#each view.mutations as m (m.label)}
            <button class="chip danger tap" title={m.effect} onclick={() => toggleInfo(`m|${m.label}`)}>{mutationIcon(m.kind)} {m.label}</button>
          {/each}
        </p>
      </section>
    {/if}

    {#if view.abilities.length}
      <section class="block">
        <h4>Zdolności</h4>
        <p class="list">
          {#each view.abilities as a (a.name)}
            <button class="item tap" onclick={() => toggleInfo(`a|${a.name}`)}>{a.name}</button>
          {/each}
        </p>
      </section>
    {/if}

    {#if openInfo && !bottomInfo}
      {@render infoPanel(openInfo)}
    {/if}

    {#if npc.trappings.length || npc.money}
      <section class="block">
        <h4>Wyposażenie</h4>
        <p class="plain">
          {#each npc.trappings as t, i (i)}{#if i}{", "}{/if}{#if findMagicItem(t) || t.startsWith("zwój z zaklęciem")}<button
                class="item tap magic"
                title={findMagicItem(t)?.description}
                onclick={() => toggleInfo(`i|${t}`)}>✦ {t}</button
              >{:else}{t}{/if}{/each}{#if npc.money}{npc.trappings.length ? " · " : ""}<b>{npc.money}</b>{/if}
        </p>
      </section>
    {/if}

    {#if otherSpells.length || view.casting}
      <section class="block">
        <div class="block-head">
          <h4>{view.keySpells.length ? "Pozostałe zaklęcia" : "Zaklęcia"}</h4>
          {#if view.casting}
            <button class="btn-sm ghost" onclick={openBook}>📖 Wszystkie zaklęcia tradycji</button>
          {/if}
        </div>
        {#if otherSpells.length}
          <p class="list">
            {#each otherSpells as s (s.name)}
              <button class="item tap" class:petty={s.lore.startsWith("Prosta")} onclick={() => toggleInfo(`s|${s.name}`)}>
                {s.name} <span class="text-dim">PZ {spellCn(s)}</span>
              </button>
            {/each}
          </p>
        {/if}
      </section>
      {#if openInfo && bottomInfo}
        {@render infoPanel(openInfo)}
      {/if}
    {/if}

    {#if bookOpen}
      <Modal title="Zaklęcia — {npc.name}" onClose={() => (bookOpen = false)}>
          {#if book.length}
            <nav class="book-tabs">
              {#each book as g (g.lore)}
                <button class="chip tap" class:active={g === bookGroup} onclick={() => ((bookLore = g.lore), (bookSpell = null))}>
                  {g.label} <span class="text-dim">{g.spells.filter((s) => knownSpells.has(s.name)).length}/{g.spells.length}</span>
                </button>
              {/each}
            </nav>
            {#if bookGroup}
              <p class="text-dim small book-note">
                {#if bookGroup.allKnown}
                  Cecha Rzucanie Czarów — stworzenie zna wszystkie zaklęcia tej tradycji; ★ to zaklęcia, po które sięga najchętniej.
                {:else}
                  ★ — zaklęcia znane postaci; pozostałe może poznać, rozwijając się w tej tradycji.
                {/if}
                {#if gd.getSpellsData().lores[bookGroup.lore]?.rule}
                  <button class="item tap" onclick={() => (bookSpell = bookSpell === `l|${bookGroup.lore}` ? null : `l|${bookGroup.lore}`)}>Zasada tradycji</button>
                {/if}
              </p>
              {#if bookSpell === `l|${bookGroup.lore}`}
                <div class="book-detail"><RichText text={gd.getSpellsData().lores[bookGroup.lore]?.rule ?? ""} /></div>
              {/if}
              <ul class="book-list">
                {#each bookGroup.spells as s (s.name)}
                  {@const open = bookSpell === s.name}
                  <li class:known={knownSpells.has(s.name) || bookGroup.allKnown}>
                    <button class="book-row tap" class:open onclick={() => (bookSpell = open ? null : s.name)} aria-expanded={open}>
                      <span class="star">{knownSpells.has(s.name) ? "★" : ""}</span>
                      <span class="book-name">{s.name}</span>
                      <span class="text-dim small">PZ {spellCn(s)} · {s.range} · {s.duration}</span>
                    </button>
                    {#if open}
                      <div class="book-detail">
                        <RichText meta={spellMeta(s).slice(1, 4)} text={s.description} source={where(s.source, s.page)} />
                      </div>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            <p class="text-dim">Brak zaklęć w bazie dla tradycji tej postaci.</p>
          {/if}
      </Modal>
    {/if}

    {#if npc.notes.trim()}
      <section class="block">
        <h4>Notatki</h4>
        <p class="plain notes">{npc.notes}</p>
      </section>
    {/if}
  {:else}
    <!-- Tryb edycji -->
    <section class="block edit-grid">
      {#if !creature}
        <label>Płeć
          <select bind:value={npc.sex}>
            <option value="M">mężczyzna</option>
            <option value="K">kobieta</option>
          </select>
        </label>
      {/if}
      <label>Etykieta
        <input type="text" placeholder="np. Herszt" bind:value={npc.label} />
      </label>
      <label>Grupa
        <input type="text" placeholder="np. Banda z traktu" bind:value={npc.group} />
      </label>
    </section>

    <section class="block">
      <h4>{creature ? "Archetyp, poziom i profesja" : "Rasa, archetyp, poziom i profesja"}</h4>
      <div class="edit-grid">
        {#if !creature}
          <label>Rasa
            <select bind:value={npc.race}>
              {#each gd.allRaceNames() as r (r)}<option value={r} disabled={!racesForArchetype(npc.archetype).includes(r)}>{r}</option>{/each}
            </select>
          </label>
        {/if}
        {#if !creature || gd.isCivilized(npc.creature)}
          <label>Archetyp
            <select bind:value={npc.archetype}>
              {#if creature}<option value="">— bestia (bez profesji) —</option>{/if}
              {#each gd.allArchetypeNames() as a (a)}<option value={a}>{a}</option>{/each}
            </select>
          </label>
        {/if}
        <label>Poziom
          <select bind:value={npc.tier}>
            {#each TIER_IDS as t (t)}<option value={t as TierId}>{gd.getTier(t).label}</option>{/each}
          </select>
        </label>
        {#if !beast}
          <label>Profesja obecna
            <select bind:value={mainProfession}>
              <option value="">— losowo —</option>
              {#each professionOptions as p (p)}<option value={p}>{p}</option>{/each}
            </select>
          </label>
          <label>Profesja poprzednia
            <select bind:value={prevProfession}>
              <option value="">— brak / losowo —</option>
              {#each professionOptions as p (p)}<option value={p}>{p}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
      <div class="row">
        <button class="btn-sm primary" onclick={rebuild}>Przebuduj rozwój</button>
        <span class="hint text-dim">Nowe rozwinięcia, umiejętności, talenty, broń i zaklęcia. Rzuty, imię i cechy stworzeń zostają.</span>
      </div>
    </section>

    <section class="block">
      <h4>Broń i pancerz</h4>
      <div class="edit-list">
        {#each npc.weapons as w, i (i)}
          <div class="edit-row">
            <span class="grow">⚔ {w}</span>
            <button class="btn-sm ghost" aria-label="Usuń broń" onclick={() => npc.weapons.splice(i, 1)}>✕</button>
          </div>
        {/each}
        {#each npc.armour as a, i (i)}
          <div class="edit-row">
            <span class="grow">🛡 {a}</span>
            <button class="btn-sm ghost" aria-label="Usuń pancerz" onclick={() => npc.armour.splice(i, 1)}>✕</button>
          </div>
        {/each}
      </div>
      <div class="edit-row wrap">
        <select bind:value={newWeapon} aria-label="Dodaj broń">
          <option value="">+ broń…</option>
          {#each weaponNames as w (w)}<option value={w}>{w}</option>{/each}
        </select>
        <button class="btn-sm" onclick={() => addTo("weapons", newWeapon, () => (newWeapon = ""))}>Dodaj</button>
        <select bind:value={newArmour} aria-label="Dodaj pancerz">
          <option value="">+ pancerz…</option>
          {#each armourNames as a (a)}<option value={a}>{a}</option>{/each}
        </select>
        <button class="btn-sm" onclick={() => addTo("armour", newArmour, () => (newArmour = ""))}>Dodaj</button>
      </div>
    </section>

    <section class="block">
      <h4>Umiejętności <span class="hint text-dim">(rozwinięcia)</span></h4>
      <div class="edit-list">
        {#each npc.skills as s, i (i)}
          <div class="edit-row">
            <input class="grow" type="text" bind:value={s.name} />
            <input class="num" type="number" min="0" bind:value={s.advances} />
            <button class="btn-sm ghost" aria-label="Usuń umiejętność" onclick={() => npc.skills.splice(i, 1)}>✕</button>
          </div>
        {/each}
      </div>
      <div class="edit-row">
        <Autocomplete bind:value={newSkill} options={gd.allSkillNames()} placeholder="Dodaj umiejętność…" />
        <button class="btn-sm" onclick={addSkill}>Dodaj</button>
      </div>
    </section>

    <section class="block">
      <h4>Talenty <span class="hint text-dim">(poziom)</span></h4>
      <div class="edit-list">
        {#each npc.talents as t, i (i)}
          <div class="edit-row">
            <input class="grow" type="text" bind:value={t.name} />
            <input class="num" type="number" min="1" bind:value={t.level} />
            <button class="btn-sm ghost" aria-label="Usuń talent" onclick={() => npc.talents.splice(i, 1)}>✕</button>
          </div>
        {/each}
      </div>
      <div class="edit-row">
        <Autocomplete bind:value={newTalent} options={gd.allTalentNames()} placeholder="Dodaj talent…" />
        <button class="btn-sm" onclick={addTalent}>Dodaj</button>
      </div>
    </section>

    <section class="block">
      <h4>Zaklęcia</h4>
      <div class="edit-list">
        {#each npc.spells as s, i (i)}
          <div class="edit-row">
            <span class="grow">{s} <span class="text-dim">PZ {gd.getSpell(s)?.cn ?? "?"}</span></span>
            <button class="btn-sm ghost" aria-label="Usuń zaklęcie" onclick={() => npc.spells.splice(i, 1)}>✕</button>
          </div>
        {/each}
      </div>
      <div class="edit-row">
        <Autocomplete bind:value={newSpell} options={spellNames} placeholder="Dodaj zaklęcie…" />
        <button class="btn-sm" onclick={() => addTo("spells", newSpell, () => (newSpell = ""))}>Dodaj</button>
      </div>
    </section>

    <section class="block">
      <h4>Cechy Stworzeń <span class="hint text-dim">(wylosowane — zmieniają statystyki)</span></h4>
      <p class="list">
        {#each Object.entries(gd.getCreatureTraits()).filter(([, t]) => t.randomPool).map(([n]) => n) as tr (tr)}
          <button class="chip tap" class:warning={npc.traits.includes(tr)} aria-pressed={npc.traits.includes(tr)} title={traitText(tr)} onclick={() => toggleTrait(tr)}>{tr}</button>
        {/each}
        {#each npc.traits.filter((t) => !gd.getCreatureTrait(t)?.randomPool) as tr (tr)}
          <button class="chip warning tap" aria-pressed="true" title="Kliknij, aby usunąć" onclick={() => toggleTrait(tr)}>{tr} ✕</button>
        {/each}
      </p>
      <h4>Profile bohaterów</h4>
      <p class="list">
        {#each Object.keys(gd.getHeroProfiles()) as hp (hp)}
          <button class="chip tap" class:info={npc.heroProfiles.includes(hp)} aria-pressed={npc.heroProfiles.includes(hp)} title={gd.getHeroProfile(hp)?.description} onclick={() => toggleProfile(hp)}>{hp}</button>
        {/each}
      </p>
      <h4>Mutacje</h4>
      <p class="list">
        {#each npc.mutations as m, i (i)}
          <button class="chip danger tap" title="Kliknij, aby usunąć" onclick={() => npc.mutations.splice(i, 1)}>{mutationIcon(m.kind)} {mutationLabel(m)} ✕</button>
        {/each}
      </p>
      <div class="edit-row wrap">
        <select bind:value={newMutation} aria-label="Dodaj mutację">
          <option value="">+ mutacja…</option>
          {#each mutationGroups as g (g.label)}
            <optgroup label={g.label}>
              {#each g.options as o (o.value)}<option value={o.value}>{o.text}</option>{/each}
            </optgroup>
          {/each}
        </select>
        <button class="btn-sm" onclick={addMutation}>Dodaj</button>
        <button class="btn-sm" onclick={addRandomMutation} title="Losuj mutację z tabel">🎲 Losuj</button>
      </div>
    </section>

    <section class="block edit-grid">
      <label class="wide">Wyposażenie <span class="hint text-dim">(jedno na linię)</span>
        <textarea rows="4" value={trappingsText} onchange={(e) => setTrappings((e.currentTarget as HTMLTextAreaElement).value)}></textarea>
      </label>
      <label>Pieniądze
        <input type="text" bind:value={npc.money} />
      </label>
      <label class="wide">Notatki
        <textarea rows="3" bind:value={npc.notes}></textarea>
      </label>
    </section>
  {/if}

  <footer class="foot">
    <div class="locks" role="group" aria-label="Blokady przed ponownym losowaniem">
      <span class="text-dim">Blokuj:</span>
      {#each LOCKS as l (l.id)}
        <button class="lock btn-sm" class:on={npc.locks[l.id]} aria-pressed={!!npc.locks[l.id]} onclick={() => toggleLock(l.id)}>
          {npc.locks[l.id] ? "🔒" : "🔓"} {l.label}
        </button>
      {/each}
    </div>
    <div class="foot-actions">
      <button class="btn-sm" title="Wylosuj ponownie wszystko, co nie jest zablokowane" onclick={reroll}>🎲 Losuj ponownie</button>
      <button class="btn-sm ghost" title="Pobierz BN jako plik JSON" onclick={exportJson}>JSON</button>
      {#if onremove}
        <button class="btn-sm ghost" onclick={onremove}>{removeLabel}</button>
      {/if}
    </div>
  </footer>
</article>

<style>
  .npc {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .npc.editing {
    border-color: var(--accent);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
  }

  .title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  h3 {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .meta,
  .career,
  .path {
    margin: 0;
    font-size: var(--fs-sm);
  }

  .meta {
    color: var(--text-muted);
  }

  .name-edit {
    display: flex;
    gap: var(--space-1);
  }

  .name-input {
    font-size: var(--fs-lg);
    font-weight: 600;
    min-width: 0;
  }

  .head-actions,
  .foot-actions,
  .locks,
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .head-actions {
    align-self: flex-start;
  }

  /* Wiersz cech: 12 kolumn na komputerze, 6 na telefonie. */
  .stats {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) 2px;
    border-right: 1px solid var(--border);
    background: var(--bg-panel-2);
    cursor: help;
  }

  .stat:last-child {
    border-right: none;
  }

  .stat.derived {
    background: var(--bg-elevated);
  }

  .code {
    font-size: var(--fs-sm);
    color: var(--text-dim);
    font-weight: 600;
  }

  .val {
    font-size: var(--fs-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .mini {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 11px;
    color: var(--text-dim);
  }

  .mini input {
    width: 100%;
    max-width: calc(52px * var(--ui-scale));
    padding: 2px;
    text-align: center;
  }

  .combat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--danger);
    background: var(--bg-panel-2);
    border-radius: var(--radius-sm);
  }

  .weapon,
  .armour,
  .casting {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
  }

  .small {
    font-size: var(--fs-sm);
  }

  .char-mods {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px var(--space-1);
  }

  .char-mods .neg {
    color: var(--danger-strong);
    font-weight: 600;
  }

  .char-mods .pos {
    color: var(--success-strong);
    font-weight: 600;
  }

  .armour-pieces,
  .magic-items {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    font-size: var(--fs-sm);
  }

  .piece {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px var(--space-1);
  }

  button.magic-mark {
    background: none;
    border: none;
    padding: 0;
    min-height: auto;
    color: var(--info-strong, var(--accent-strong));
    font-weight: 600;
    cursor: pointer;
  }

  .key-spells {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
  }

  button.quality {
    background: none;
    border: none;
    border-bottom: 1px dotted var(--border-strong);
    border-radius: 0;
    padding: 0;
    min-height: auto;
    font-size: var(--fs-sm);
    color: var(--success-strong);
  }

  button.quality.flaw {
    color: var(--danger-strong);
  }

  /* Zalety/Wady wykonania (Wytrzymały, Tandetny) - kursywa, by odroznic od cech broni. */
  button.quality.craft {
    font-style: italic;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  h4 {
    margin: 0;
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .list {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
  }

  .item {
    font-size: var(--fs-base);
    white-space: nowrap;
  }

  .item.key {
    color: var(--accent-strong);
  }

  .item.unknown {
    color: var(--text-dim);
    font-style: italic;
  }

  .item.petty {
    color: var(--text-muted);
  }

  .bonus {
    margin-left: var(--space-1);
    color: var(--success-strong);
  }

  .item.magic {
    color: var(--info-strong, var(--accent-strong));
    white-space: normal;
  }

  button.item.tap {
    background: none;
    border: none;
    border-bottom: 1px dotted var(--border-strong);
    border-radius: 0;
    padding: 0;
    min-height: auto;
    font-size: var(--fs-base);
  }

  button.chip.tap {
    min-height: auto;
    cursor: pointer;
  }

  .chip.danger {
    background: rgba(181, 82, 74, 0.16);
    border-color: var(--danger-strong);
    color: var(--danger-strong);
  }

  .info {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--accent);
    background: var(--bg-panel-2);
    font-size: var(--fs-sm);
  }

  .info-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    max-width: 72ch;
  }

  .info-title {
    color: var(--accent-strong);
  }

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .book-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .chip.active {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--bg-panel-2);
  }

  .book-note {
    margin: 0;
  }

  .book-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .book-list li {
    border-bottom: 1px solid var(--border);
  }

  .book-row {
    display: grid;
    grid-template-columns: 1.2em auto 1fr;
    align-items: baseline;
    gap: var(--space-2);
    width: 100%;
    min-height: auto;
    padding: var(--space-2) 0;
    background: transparent;
    border: none;
    text-align: left;
    color: var(--text-muted);
  }

  .book-list li.known .book-row {
    color: var(--text);
  }

  .book-row .star {
    color: var(--accent-strong);
  }

  .book-row.open .book-name {
    color: var(--accent-strong);
    font-weight: 600;
  }

  .book-detail {
    padding: 0 0 var(--space-3) calc(1.2em + var(--space-2));
    font-size: var(--fs-sm);
  }

  .plain {
    margin: 0;
  }

  .notes {
    white-space: pre-wrap;
  }

  .edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(170px * var(--ui-scale)), 1fr));
    gap: var(--space-2) var(--space-3);
  }

  .edit-grid label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  .edit-grid .wide {
    grid-column: 1 / -1;
  }

  textarea {
    font-family: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    resize: vertical;
  }

  .edit-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(260px * var(--ui-scale)), 1fr));
    gap: var(--space-1) var(--space-3);
  }

  .edit-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .edit-row.wrap {
    flex-wrap: wrap;
  }

  .edit-row .grow {
    flex: 1;
    min-width: 0;
  }

  .edit-row .num {
    width: calc(60px * var(--ui-scale));
  }

  .hint {
    font-size: var(--fs-sm);
    text-transform: none;
    letter-spacing: 0;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
    font-size: var(--fs-sm);
  }

  .lock {
    background: var(--bg-panel);
    color: var(--text-muted);
  }

  .lock.on {
    border-color: var(--warning);
    color: var(--warning);
  }

  @media (max-width: 640px) {
    .npc {
      padding: var(--space-3);
    }

    .stats {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .stat:nth-child(6n) {
      border-right: none;
    }

    .stat:nth-child(-n + 6) {
      border-bottom: 1px solid var(--border);
    }
  }
</style>
