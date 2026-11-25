/**
 * Akcja `use:searchable` dla <select>: zamiast rozwijanej listy pole, w ktore mozna pisac. Szuka po nazwie
 * opcji i po nazwie grupy (<optgroup>), bez wielkosci liter i polskich znakow ("zolnierz" -> "Żołnierz").
 * Oryginalny <select> zostaje (ukryty) i to on trzyma wartosc - bind:value i onchange dzialaja jak dotad.
 */

/** Bez wielkosci liter i polskich znakow. */
export const norm = (s: string) => s.trim().toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");

interface Opt {
  value: string;
  label: string;
  group: string;
  disabled: boolean;
}

/** Instancje z polami do odswiezenia, gdy wartosc <select> zmieni sie z kodu (Svelte ustawia ja bez zdarzenia). */
const live = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

export function searchable(select: HTMLSelectElement) {
  const wrap = document.createElement("div");
  wrap.className = "srch";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "srch-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  const label = select.getAttribute("aria-label") ?? select.title;
  if (label) input.setAttribute("aria-label", label);
  const list = document.createElement("ul");
  list.className = "srch-popup panel";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  // <select> zostaje na swoim miejscu (wezel nalezy do Svelte); pole wstawiamy zaraz za nim.
  // Szerokosc jak lista: pelna, gdy lista wypelniala rodzica, inaczej jej szerokosc.
  const w = select.getBoundingClientRect().width;
  const pw = select.parentElement?.getBoundingClientRect().width ?? 0;
  const grow = getComputedStyle(select).flexGrow;
  if (pw && w >= pw - 4) wrap.style.width = "100%";
  else if (w) wrap.style.minWidth = `${Math.round(w)}px`;
  if (grow && grow !== "0") wrap.style.flexGrow = grow;
  wrap.append(input, list);
  select.after(wrap);
  select.classList.add("srch-native");
  select.tabIndex = -1;

  let opts: Opt[] = [];
  let shown: Opt[] = [];
  let active = -1;
  let open = false;
  let typed = false;

  const read = () => {
    opts = [...select.options].map((o) => ({
      value: o.value,
      label: o.textContent?.trim() ?? o.value,
      group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : "",
      disabled: o.disabled
    }));
  };
  const currentLabel = () => select.selectedOptions[0]?.textContent?.trim() ?? "";
  const sync = () => {
    if (open) return;
    const l = currentLabel();
    if (input.value !== l) input.value = l;
    input.placeholder = l;
    input.disabled = select.disabled;
  };

  const render = () => {
    const q = typed ? norm(input.value) : "";
    // Kazde slowo zapytania musi wystapic w nazwie albo w nazwie grupy.
    const words = q.split(/\s+/).filter(Boolean);
    shown = opts.filter((o) => !o.disabled && words.every((w) => norm(`${o.label} ${o.group}`).includes(w))).slice(0, 300);
    list.replaceChildren();
    let group: string | null = null;
    shown.forEach((o, i) => {
      if (o.group !== group) {
        group = o.group;
        if (group) {
          const h = document.createElement("li");
          h.className = "srch-group";
          h.textContent = group;
          list.append(h);
        }
      }
      const li = document.createElement("li");
      li.className = "srch-opt" + (i === active ? " active" : "") + (o.value === select.value ? " selected" : "");
      li.setAttribute("role", "option");
      li.textContent = o.label || "—";
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(o);
      });
      list.append(li);
    });
    if (!shown.length) {
      const li = document.createElement("li");
      li.className = "srch-empty";
      li.textContent = "brak wyników";
      list.append(li);
    }
    list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  };

  const show = () => {
    read();
    open = true;
    typed = false;
    active = shown.findIndex((o) => o.value === select.value);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    render();
    list.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  };
  const hide = () => {
    open = false;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    sync();
  };
  const choose = (o: Opt) => {
    if (select.value !== o.value) {
      select.value = o.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    hide();
    input.blur();
  };

  input.addEventListener("focus", () => {
    show();
    input.select();
  });
  input.addEventListener("blur", () => setTimeout(hide, 120));
  input.addEventListener("input", () => {
    if (!open) show();
    typed = true;
    active = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = shown.length;
      if (!n) return;
      active = e.key === "ArrowDown" ? (active + 1) % n : (active - 1 + n) % n;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape") {
      hide();
      input.blur();
    }
  });

  // Opcje zmieniaja sie z danymi (np. lista stworzen po filtrze) - czytamy je od nowa.
  const mo = new MutationObserver(() => {
    read();
    if (open) render();
    sync();
  });
  mo.observe(select, { childList: true, subtree: true, characterData: true, attributes: true });
  read();
  sync();
  live.add(sync);
  timer ??= setInterval(() => live.forEach((f) => f()), 250);

  return {
    destroy() {
      mo.disconnect();
      live.delete(sync);
      if (!live.size && timer) {
        clearInterval(timer);
        timer = undefined;
      }
      wrap.remove();
      select.classList.remove("srch-native");
      select.tabIndex = 0;
    }
  };
}
