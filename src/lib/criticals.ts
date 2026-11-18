/**
 * Tabela Ran Krytycznych (PG s. 174-178) sprowadzona do skutkow, ktore licza sie w walce:
 * dodatkowe Rany (bez BWt i PP), Krwawienie, Oszolomienie, Oslepienie, Powalenie, Utrata
 * Przytomnosci (od razu albo po nieudanym Tescie Odpornosci), upuszczona bron (strata Akcji),
 * bezuzyteczna konczyna (kara do Testow) i Smierc (00). Opisy, Urazy i Amputacje poza walka pominiete.
 */
export type CritLoc = "głowa" | "ręce" | "korpus" | "nogi";

export interface CritEffect {
  /** Gorna granica rzutu k100 (01-max). */
  max: number;
  name: string;
  /** Dodatkowe Rany; 0 przy Smierci. */
  wounds: number;
  death?: boolean;
  bleed?: number;
  stun?: number;
  /** Oszolomienie 1k10 poziomow. */
  stunD10?: boolean;
  blind?: number;
  prone?: boolean;
  /** Utrata Przytomnosci bez Testu. */
  ko?: boolean;
  /** Test Odpornosci z modyfikatorem; porazka = Utrata Przytomnosci. */
  koTest?: number;
  /** Test Odpornosci z modyfikatorem; porazka = Oszolomienie (stunFail poziomow). */
  stunTest?: number;
  stunFail?: number;
  /** Test Odpornosci z modyfikatorem; porazka = Powalenie. */
  proneTest?: number;
  /** Upuszczona bron / chwilowo bezwladne ramie - strata nastepnej Akcji. */
  drop?: boolean;
  /** Trwale okaleczenie w walce: kara do Testow (bezwladne ramie, noga, zlamanie). */
  maim?: number;
}

export const CRIT_TABLE: Record<CritLoc, CritEffect[]> = {
  "głowa": [
    { max: 10, name: "Zawadiacka rana", wounds: 1, bleed: 1 },
    { max: 20, name: "Płytkie cięcie", wounds: 1, bleed: 1 },
    { max: 25, name: "Spuchnięte oko", wounds: 1, blind: 1 },
    { max: 30, name: "Prosto w ucho", wounds: 1 },
    { max: 35, name: "Bolesne uderzenie", wounds: 2, stun: 1 },
    { max: 40, name: "Podbite oko", wounds: 2, blind: 2 },
    { max: 45, name: "Rozcięte ucho", wounds: 2, bleed: 1 },
    { max: 50, name: "Uderzenie w czoło", wounds: 2, bleed: 2, blind: 1 },
    { max: 55, name: "Złamana szczęka", wounds: 3, stun: 2 },
    { max: 60, name: "Poważna rana oka", wounds: 3, bleed: 1, blind: 1 },
    { max: 65, name: "Poważna rana ucha", wounds: 3 },
    { max: 70, name: "Złamany nos", wounds: 3, bleed: 2, stunTest: 0, stunFail: 1 },
    { max: 75, name: "Zmiażdżona żuchwa", wounds: 4, stun: 3 },
    { max: 80, name: "Wstrząśnienie mózgu", wounds: 4, bleed: 2, stunD10: true },
    { max: 85, name: "Rozkwaszone usta", wounds: 4, bleed: 2 },
    { max: 90, name: "Zgruchotane ucho", wounds: 4, bleed: 2 },
    { max: 93, name: "Wybite oko", wounds: 5, blind: 3, bleed: 2, stun: 1 },
    { max: 96, name: "Oszpecający cios", wounds: 5, blind: 3, bleed: 3, stun: 2 },
    { max: 99, name: "Zgruchotana szczęka", wounds: 5, bleed: 4, stun: 3 },
    { max: 100, name: "Dekapitacja", wounds: 0, death: true }
  ],
  "ręce": [
    { max: 10, name: "Zdrętwiałe ramię", wounds: 1, drop: true },
    { max: 20, name: "Płytkie cięcie", wounds: 1, bleed: 1 },
    { max: 25, name: "Skręcenie", wounds: 1, maim: 10 },
    { max: 30, name: "Bardzo zdrętwiałe ramię", wounds: 1, drop: true },
    { max: 35, name: "Zerwane mięśnie", wounds: 2, bleed: 1, maim: 10 },
    { max: 40, name: "Krwawiąca dłoń", wounds: 2, bleed: 1 },
    { max: 45, name: "Wybicie stawu", wounds: 2, drop: true },
    { max: 50, name: "Ziejąca rana", wounds: 3, bleed: 2 },
    { max: 55, name: "Czyste złamanie", wounds: 3, drop: true, maim: 10, stunTest: -10, stunFail: 1 },
    { max: 60, name: "Zerwane więzadło", wounds: 3, drop: true, maim: 10 },
    { max: 65, name: "Głębokie cięcie", wounds: 3, bleed: 2, stun: 1, maim: 10, koTest: -20 },
    { max: 70, name: "Uszkodzona tętnica", wounds: 4, bleed: 4 },
    { max: 75, name: "Zmiażdżony łokieć", wounds: 4, drop: true, maim: 20 },
    { max: 80, name: "Wywichnięty bark", wounds: 4, drop: true, maim: 20, stun: 1, koTest: -20 },
    { max: 85, name: "Odcięty palec", wounds: 4, bleed: 1 },
    { max: 90, name: "Zmasakrowana dłoń", wounds: 4, bleed: 2, stun: 1 },
    { max: 93, name: "Rozszarpany biceps", wounds: 5, drop: true, maim: 20, bleed: 2, stun: 1 },
    { max: 96, name: "Zgruchotana dłoń", wounds: 5, drop: true, maim: 20, bleed: 2, koTest: -20 },
    { max: 99, name: "Przecięte ścięgna", wounds: 5, drop: true, maim: 20, prone: true, bleed: 3, stun: 1, koTest: -20 },
    { max: 100, name: "Odcięte ramię", wounds: 0, death: true }
  ],
  korpus: [
    { max: 10, name: "Ledwie draśnięcie", wounds: 1, bleed: 1 },
    { max: 20, name: "Cios w bebechy", wounds: 1, stun: 1, proneTest: 40 },
    { max: 25, name: "Poniżej pasa!", wounds: 1, stunTest: -20, stunFail: 3 },
    { max: 30, name: "Cios w krzyż", wounds: 1, maim: 10 },
    { max: 35, name: "Bez tchu", wounds: 2, stun: 1, proneTest: 20 },
    { max: 40, name: "Stłuczone żebra", wounds: 2 },
    { max: 45, name: "Stłuczony obojczyk", wounds: 2, drop: true },
    { max: 50, name: "Nierówne cięcie", wounds: 2, bleed: 2 },
    { max: 55, name: "Połamane żebra", wounds: 3, stun: 1, maim: 10 },
    { max: 60, name: "Ziejąca rana", wounds: 3, bleed: 3 },
    { max: 65, name: "Bolesne cięcie", wounds: 3, bleed: 2, stun: 1, koTest: -20 },
    { max: 70, name: "Uszkodzenie tętnicy", wounds: 3, bleed: 4 },
    { max: 75, name: "Naderwane mięśnie pleców", wounds: 4, maim: 10 },
    { max: 80, name: "Złamane biodro", wounds: 4, stun: 1, proneTest: 0, maim: 10 },
    { max: 85, name: "Poważna rana klatki piersiowej", wounds: 4, bleed: 4 },
    { max: 90, name: "Rana brzucha", wounds: 4, bleed: 2 },
    { max: 93, name: "Strzaskana klatka piersiowa", wounds: 5, stun: 1, maim: 20 },
    { max: 96, name: "Złamany obojczyk", wounds: 5, ko: true },
    { max: 99, name: "Krwotok wewnętrzny", wounds: 5, bleed: 1 },
    { max: 100, name: "Rozpłatanie", wounds: 0, death: true }
  ],
  nogi: [
    { max: 10, name: "Stłuczony palec", wounds: 1 },
    { max: 20, name: "Skręcona kostka", wounds: 1 },
    { max: 25, name: "Płytkie cięcie", wounds: 1, bleed: 1 },
    { max: 30, name: "Utrata równowagi", wounds: 1, proneTest: 0 },
    { max: 35, name: "Cios w udo", wounds: 2, bleed: 1, proneTest: 20 },
    { max: 40, name: "Zwichnięta kostka", wounds: 2, maim: 10 },
    { max: 45, name: "Nadwyrężone kolano", wounds: 2 },
    { max: 50, name: "Paskudnie przecięty paluch", wounds: 2, bleed: 1 },
    { max: 55, name: "Paskudne cięcie", wounds: 3, bleed: 2, proneTest: 0 },
    { max: 60, name: "Skręcone kolano", wounds: 3, maim: 10 },
    { max: 65, name: "Porąbana noga", wounds: 3, prone: true, bleed: 2, maim: 10, stunTest: 20, stunFail: 1 },
    { max: 70, name: "Poszarpane udo", wounds: 3, bleed: 3, proneTest: 0 },
    { max: 75, name: "Zerwane ścięgno", wounds: 4, prone: true, stun: 1, maim: 20, koTest: -20 },
    { max: 80, name: "Rozerwana łydka", wounds: 4, prone: true, stun: 1, maim: 10 },
    { max: 85, name: "Strzaskane kolano", wounds: 4, prone: true, bleed: 1, stun: 1, maim: 20 },
    { max: 90, name: "Zwichnięte kolano", wounds: 4, prone: true, stunTest: -20, stunFail: 1, maim: 10 },
    { max: 93, name: "Zmiażdżona stopa", wounds: 5, bleed: 2, proneTest: 20 },
    { max: 96, name: "Odcięta stopa", wounds: 5, prone: true, bleed: 3, stun: 2, maim: 20 },
    { max: 99, name: "Przecięte ścięgna", wounds: 5, prone: true, bleed: 2, stun: 2, maim: 20 },
    { max: 100, name: "Strzaskana miednica", wounds: 0, death: true }
  ]
};

/** Miejsce Trafienia z rzutu k100 (PG s. 159). */
export function critLocation(roll: number): CritLoc {
  return roll <= 9 ? "głowa" : roll <= 44 ? "ręce" : roll <= 79 ? "korpus" : "nogi";
}

/** Wpis tabeli dla rzutu k100 (1-100) w danej lokacji. */
export function critEntry(loc: CritLoc, roll: number): CritEffect {
  const r = Math.min(100, Math.max(1, roll));
  return CRIT_TABLE[loc].find((e) => r <= e.max)!;
}
