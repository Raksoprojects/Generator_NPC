# Generator BN WFRP 4ed — baza wiedzy

Opis zasad, według których generator tworzy bohaterów niezależnych (BN), stworzenia, wampiry, przedmioty magiczne i łupy. Służy do odtworzenia tej logiki w innym narzędziu (np. symulatorze tworzenia postaci).

**Oznaczenia źródeł:**
- **[PG]** — podręcznik podstawowy WFRP 4ed (polskie wydanie);
- **[B2.0]** — Bestiariusz 2.0;
- **[Wampiry]** — dodatek o wampirach (Vampire Counts + Aristocracy of the Night);
- **[Kras.]** — Podręcznik Gracza: Krasnoludy;
- **[Elfy]** — Podręcznik Gracza: Wysokie Elfy;
- **[T&A]** — nieoficjalne kompendium Treasure & Artefacts;
- **[dom]** — zasada domowa albo decyzja projektowa generatora.

Oficjalne polskie nazwy Talentów, Cech i Umiejętności pochodzą z podręcznika podstawowego.

---

## 1. Poziomy zaawansowania (7)

Każdy BN ma poziom zaawansowania. Od niego zależą:
- liczba poziomów profesji i siła rozwoju;
- talenty;
- rozwój bestii;
- magia;
- przedmioty i dary.

W danych poziomy mają stałe identyfikatory, a nazwy wyświetlane to:

| # | Nazwa | Identyfikator | Dawna nazwa | Kogo opisuje |
|---|---|---|---|---|
| 1 | **Nowicjusz** | `slaby` | Słaby | żółtodziób, 1. (czasem 2.) poziom profesji |
| 2 | **Zwykły** | `sredni` | Średni | typowy przedstawiciel fachu, 2. poziom profesji |
| 3 | **Niezwykły** | `zaawansowany` | Zaawansowany | 3–4 poziomy profesji, często dwie profesje |
| 4 | **Zaawansowany** | `doswiadczony` | Doświadczony | 4. poziom profesji — mistrz w fachu |
| 5 | **Ekspert** | `heroiczny` | Heroiczny | 4. poziom i mocny rozwój, wódz, boss przygody |
| 6 | **Legenda** | `legendarny` | Legendarny | pełna profesja (5. poziom, jeśli istnieje), bohater opowieści |
| 7 | **Heros** | `heros` | *nowy* | ponad legendą: wybrańcy bogów, półbogowie, najstarsze wampiry, książęta demonów |

### 1.1 Rozwój w profesji (rasy rozumne i stworzenia z profesją)

| Parametr | Nowicjusz | Zwykły | Niezwykły | Zaawansowany | Ekspert | Legenda | Heros |
|---|---|---|---|---|---|---|---|
| Łączna liczba poziomów rozwoju (waga losowania) | 1 (×3), 2 (×1) | 2 (×3), 3 (×1) | 3, 4 | 4 (×2), 5 (×1) | 6, 7 (×2), 8 | 8, 9 (×2), 10 | 10, 11 (×2), 12 (×2), 13 |
| Maks. liczba profesji (losowo 1…maks.) | 1 | 2 | 2 | 2 | 3 | 3 | 4 |
| Poziom ostatniej profesji | 1–2 | 2 | 2–3 | 3–4 | 3–4 | 4 | 4 |
| Szansa na 5. poziom (jeśli profesja go ma, np. Arcymag) | — | — | — | — | 0,5% | 50% | 100% |
| Losowy profil bohatera (wykluczające się) | — | Weteran 3% | Weteran 4%, Doborowy 1% | Weteran 2%, Doborowy 2%, Pomniejszy 1% | Doborowy 2%, Pomniejszy 2%, Wielki 1% | Pomniejszy 3%, Wielki 2% | Pomniejszy 2%, Wielki 3% |
| Talenty na poziom profesji | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
| Szansa na dodatkowy talent na poziom | 0% | 50% | 50% | 90% | 50% | 80% | 100% |
| Szansa na wzrost poziomu talentu (za każdy poziom profesji ponad 1.) | 0% | 30% | 50% | 70% | 80% | 90% | 100% |
| Premia do 4 kluczowych umiejętności archetypu (łączne rozwinięcia min–maks.) | +1…+3 (do 13) | +3…+8 (15–18) | +5…+10 (20–32) | +8…+15 (34–48) | +10…+15 (50–70) | +15…+20 (72–88) | +20…+25 (od 90) |
| Premia do 2 kluczowych cech archetypu (łączne rozwinięcia min–maks.) | +0…+2 (do 12) | +2…+5 (13–15) | +3…+7 (17–28) | +6…+10 (30–42) | +8…+12 (44–62) | +12…+18 (64–78) | +15…+22 (od 80) |
| Waga przy losowaniu poziomu | 4 | 4 | 2 | 1 | 0,3 | 0,1 | 0,03 |

**Zasady rozwoju [PG + dom]**
- Każdy ukończony poziom profesji daje **+5** do cech i umiejętności tego poziomu. Poziom bieżący (ostatni w ścieżce) daje +2…+5. Rozwinięcia się kumulują (Żołnierz 1–4: WW z 1. poziomu dostaje 4 × 5).
- **Ostatnia (obecna) profesja ma zawsze najwyższy poziom.** Żołnierz 2 + Rycerz 2 jest w porządku, Żołnierz 1 + Rycerz 3 też. Żołnierz 3 + Rycerz 1 jest niedozwolony.
- **Poziomy rozwoju ≠ poziomy profesji.** Poziom BN wyznacza liczbę poziomów rozwoju. Tyle, ile nie pokrywa ścieżka profesji, to **dodatkowe rozwinięcia** na przebytych poziomach ostatniej profesji (+5 do cech i umiejętności losowego przebytego poziomu plus talent z jego puli). Legenda może więc być samym Żołnierzem 4 — z rozwinięciami jak za 8–10 poziomów. Na karcie: „Żołnierz 4 (+5 poziomów doświadczenia)”.
- Liczba wcześniejszych profesji jest losowana od 0 do maksimum; każda ma 1 poziom … poziom ostatniej.
- Czarodziej nie zmienia tradycji i nie był wcześniej kapłanem. Wyjątek to profesje renegatów (Czarownica).
- **Profesje zaawansowane** (elfi kapłani od 3. poziomu): Mag 1–2, potem kapłan od 3. Pozostałe poziomy BN idą na wcześniejsze profesje.
- Jeśli profesje podano ręcznie, generator używa tylko ich.
- **Premie archetypu** to dodatkowe rozwinięcia tylko dla 4 kluczowych umiejętności i 2 kluczowych cech archetypu. Losowa premia jest dodawana, a wynik przycinany do zakresu poziomu. Pozostałe cechy i umiejętności rosną wyłącznie z profesji — wojownik nie staje się mądry, jego Inteligencja to 20 + 2k10, chyba że któraś profesja ją rozwija.
- Progi premii nie nachodzą na siebie: najsłabszy BN wyższego poziomu ma w kluczowych rzeczach więcej niż najsilniejszy niższego.
- **Mnożnik rozwinięć** (pole `advanceMultiplier`, domyślnie 1) mnożył +5 za poziom profesji. Został wyłączony, a poziom różnicują teraz liczba poziomów profesji i premie archetypu. Zostaje jako pokrętło, gdyby postacie wyszły za słabe.
- **Profile bohaterów** nie wynikają z poziomu. Dostępne: Weteran i Doborowy (generator), Pomniejszy i Wielki Bohater [B2.0], Dowódca Oddziału. Nadawane ręcznie („Wyjątkowa jednostka”) albo z małej szansy poziomu (tabela wyżej, najwyżej 5% łącznie). Legendarny Bohater usunięty.

**Przykładowe wartości** (człowiek, średnia z 40 losowań, w nawiasie zakres):

| Poziom | Poziomy / profesje | Wojownik: WW | Broń Biała | Unik | Wt | Int | Czarodziej: Splatanie | Język (Magiczny) | Zaklęcia |
|---|---|---|---|---|---|---|---|---|---|
| Nowicjusz | 1 / 1 | 42 | 48 | 39 | 36 | 31 | 48 | 48 | 4 |
| Zwykły | 2 / 1–2 | 53 | 68 | 50 | 39 | 31 | 65 | 65 | 7 |
| Niezwykły | 3 / 1–2 | 58 | 80 | 62 | 40 | 31 | 77 | 78 | 12 |
| Zaawansowany | 4 / 1–2 | 69 | 105 | 79 | 44 | 32 | 99 | 101 | 14 |
| Ekspert | 7 / 2–3 | 83 | 135 | 100 | 50 | 32 | 130 | 134 | 17 |
| Legenda | 9 / 2–3 | 105 | 178 | 130 | 56 | 32 | 172 | 177 | 23 |
| Heros | 11 / 3–4 | 119 | 210 | 158 | 63 | 33 | 205 | 210 | 28 |

Splatanie i Rzucanie mają też premie PS (rozdział 4), których tabela nie zawiera.

### 1.2 Bestie (stworzenia bez profesji)

Bazą jest profil z bestiariusza i umiejętności rodziny stworzenia. Poziom liczy się od minimalnego poziomu stworzenia: Wybraniec Chaosu występuje od Zaawansowanego, więc na Zaawansowanym ma profil z książki. Bestie nie dostają premii archetypu.

**Bestia poniżej swojego minimum [dom]** (np. olbrzym na Nowicjuszu, gdy poziom wybrano ręcznie, albo 15% losowań z grupy): profil z książki i **jedna cecha negatywna za każdy poziom poniżej minimum**. Cechy negatywne (zasada domowa — podręcznik ich nie ma) są też w zwykłej puli losowanych Cech Stworzeń:

| Cecha | Modyfikatory |
|---|---|
| Słaby | S −10, Wt −10 |
| Chorowity | Wt −10, SW −10 |
| Powolny | Zw −10, Szybkość −1 |
| Tępy | Int −20, I −10 |
| Niezdarny | WW −10, US −10, Zr −10 |
| Tchórzliwy | SW −20, WW −10 |
| Niedorosły | WW −10, S −10, Wt −10 |

| Poziom (od minimum stworzenia) | 1. | 2. | 3. | 4. | 5. | 6. | 7. |
|---|---|---|---|---|---|---|---|
| Premia do wszystkich umiejętności | 0 | +10 | +20 | +30 | +40 | +60 | +80 |
| Rozwinięcia WW, S, Wt, I, Zw | 0 | +10 | +20 | +30 | +40 | +60 | +80 |
| Cechy Stworzeń rodziny | 0 | 1 | 1 | 2 | 3 | 4 | 5 |
| Szansa na cechę opcjonalną | 0 | 25% | 50% | 75% | 100% | 100% | 100% |

- Int, SW i Ogd bestii zostają jak w książce.
- Opisy poziomów: typowy osobnik → rosły osobnik → doświadczony łowca/weteran stada → przewodnik stada → bestia z legend → mityczna bestia → boska bestia, awatar pradawnej potęgi.

**Profile bohaterów** — z wyboru albo małej szansy poziomu, dodawane do cech:

| Profil | WW | US | S | Wt | I | Zw | Zr | Int | SW | Ogd | Cechy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Weteran | +10 | +5 | +5 | +5 | +10 | +5 | — | — | +10 | — | — |
| Doborowy | +20 | +15 | +5 | +5 | +15 | +10 | +5 | +5 | +15 | +5 | +1 do Broni |
| Dowódca Oddziału | +15 | +10 | +5 | +5 | +10 | +5 | — | +5 | +10 | +10 | — |
| Pomniejszy Bohater | +30 | +20 | +10 | +10 | +20 | +10 | +5 | +10 | +20 | +20 | +1 do Pancerza, Mistrz, +1 do Broni |
| Wielki Bohater | +45 | +30 | +20 | +20 | +30 | +20 | +10 | +20 | +30 | +30 | +2 do Pancerza, Mistrz, Twardziel, Tropiciel, +2 do Broni |

### 1.3 Magia według poziomu

| | Nowicjusz | Zwykły | Niezwykły | Zaawansowany | Ekspert | Legenda | Heros |
|---|---|---|---|---|---|---|---|
| Najwyższe PZ zaklęć tajemnych | 0 (tylko Magia Prosta) | 6 | 9 | 12 | bez limitu | bez limitu | bez limitu |
| Odchylenie liczby zaklęć tajemnych od BInt | — | −2…+1 | −1…+3 | 0…+4 | +1…+5 | +3…+7 | +5…+9 |
| Pewne zaklęcia z górnej półki głównej tradycji | — | 1 | 1 | 2 | 3 | 4 | 5 |
| Elfy: szanse na kolejne tradycje (po kolei) | — | — | 60%, 10% | 100%, 35%, 10% | 100%, 80%, 50%, 30%, 15% | 100%, 100%, 80%, 65%, 50%, 35%, 20% | 100%, 100%, 100%, 80%, 65%, 50%, 35% |
| Splatanie i Język (Magiczny) stworzeń czarujących z cechy | 10 | 15 | 20 | 25 | 30 | 40 | 55 |

### 1.4 Przedmioty, dary i mutacje według poziomu

| | Nowicjusz | Zwykły | Niezwykły | Zaawansowany | Ekspert | Legenda | Heros |
|---|---|---|---|---|---|---|---|
| Kolejne przedmioty magiczne (istoty rozumne) | — | — | 1% | 10%, 3% | 50%, 20%, 5% | 100%, 100%, 50%, 20% | 100%, 100%, 100%, 50%, 20% |
| Przedmiot z runami tymczasowymi | — | 3% | 12% | 18% | 22% | 25% | 28% |
| Trwały przedmiot runiczny | — | — | 2% | 5% | 12% | 25% | 38% |
| Wady wykonania broni/pancerza | 35% | 20% | 10% | 4% | 0 | 0 | 0 |
| Zalety wykonania (szansa / maks.) | 2% / 1 | 6% / 1 | 15% / 1 | 30% / 2 | 55% / 2 | 80% / 3 | 100% / 3 |
| Gromril (krasnoludy) | — | — | 2% | 10% | 35% | 70% | 90% |
| Ithilmar (wysokie elfy) | — | — | — | 10% | 40% | 80% | 90% |
| Dary Krwi wampira | 3 | 4 | 5 | 6 | 8 | 10 | 12 |
| Cecha Wiek wampira | 1 | 2 | 3 | 4 | 5 | 5 | 6 |
| Dary Chaosu — Wojownicy Chaosu | — | 10% | 30% | 50%, 20% | 75%, 40%, 15% | 90%, 60%, 30%, 15% | 100%, 80%, 50%, 30%, 15% |
| Dary Chaosu — Słudzy Chaosu | — | — | 5% | 15% | 30%, 10% | 50%, 20%, 5% | 70%, 35%, 10% |

Mnożniki run: krasnoludy ×2,3, elfy ×0,2. Stworzenia nie mają run.

---

## 2. Tworzenie BN rasy rozumnej (kolejność kroków)

1. **Archetyp** (Wojownik, Strzelec, Złodziej, Uczony, Czarodziej, Kapłan, Szlachcic…). Wyznacza:
   - pulę profesji z wagami;
   - kluczowe cechy i umiejętności;
   - preferowane talenty i cechy;
   - pancerz wg poziomu.
2. **Poziom** (losowany wg wag z tabeli 1.1) i **rasa** zgodna z archetypem.
3. **Cechy:** baza rasy + 2k10 [PG].

   | Rasa | WW | US | S | Wt | I | Zw | Zr | Int | SW | Ogd | Szybkość |
   |---|---|---|---|---|---|---|---|---|---|---|---|
   | Człowiek | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 4 |
   | Krasnolud | 30 | 20 | 20 | 30 | 20 | 10 | 30 | 20 | 40 | 10 | 3 |
   | Niziołek | 10 | 30 | 10 | 20 | 20 | 20 | 30 | 20 | 30 | 30 | 3 |
   | Wysoki / Leśny elf | 30 | 30 | 20 | 20 | 40 | 30 | 30 | 30 | 30 | 20 | 5 |

   Rzuca się 2k10 dla wszystkich cech, a najwyższe wyniki przypisuje do kluczowych cech archetypu (w ich kolejności); resztę losowo [dom]. Nie ma minimum rzutu, więc trafiają się i słabsi, i silniejsi BN. Stworzenia tak samo dla cech 2k10.
4. **Ścieżka profesji** (liczba profesji i poziomów wg tabeli 1.1, ostatnia profesja najwyżej). Rozwinięcia cech i umiejętności z każdego poziomu oraz talenty z puli poziomu (wagi archetypu). Specjalizacje „dowolne” rozwiązuje się raz na profesję.
5. **Premie archetypu** do 4 kluczowych umiejętności i 2 cech (tabela 1.1).
6. **Rzadkie talenty rasowe [dom]:** np. Krew Aenariona u wysokich elfów — 1%, Szlachcic 5%.
7. **Cechy opcjonalne (Cechy Stworzeń) [dom]:** rzut k100 — 1: trzy cechy, 2–5: dwie, 6–20: jedna, 21+: brak. Wybór wg wag archetypu.
8. **Wyposażenie** z bieżącej profesji. Broń i pancerz wg archetypu i poziomu. Do tego zalety/wady wykonania i materiał (tabela 1.4).
9. **Przedmioty magiczne i runiczne** (tabela 1.4), dopasowane do istoty: krasnoludy runy, słudzy Chaosu Broń Chaosu, wampiry artefakty linii, elfy przedmioty elfów.
10. **Zaklęcia**, jeśli BN czaruje (rozdział 4).
11. **Żywotność [PG]:** BS + 2×BWt + BSW. Niziołki nie liczą BS. Talent Twardziel dodaje BWt za poziom.
12. **Pieniądze wg Statusu [PG]:** Brąz = 2k10 × poziom pensów, Srebro = 1k10 × poziom szylingów, Złoto = poziom w koronach.

---

## 3. Stworzenia

- **Bestie** (bez archetypu) rozwijają się wg tabeli 1.2.
- **Stworzenia rozumne** (cywilizowane: gobliny, orki, zwierzoludzie, wampiry, ogry…) mogą mieć archetyp i przechodzić profesje dostępne dla ludzi.
  - Ogry dostają profesję w ~50% przypadków i tylko proste: Wojownik 3, Oprych 3, Strażnik 1, Zwiadowca 1, Chłop 1, Strzelec 0,5.
  - Wampiry mają profesję zawsze — wg linii krwi (rozdział 5).
- Stworzenia z profesją rozwijają się dokładnie jak rasy (tabela 1.1), bez profili bohaterów — chyba że są wyjątkową jednostką.
- **Minimalny poziom stworzenia:** np. Wampir od Niezwykłego. Niższy poziom podnosi się do minimum.
- **Cechy z wyborem** z bestiariusza („Rzucanie Czarów (Śmierci albo Cieni)”, „(dowolna Tradycja)”) losuje się do jednej opcji, jak wybory w wyposażeniu.
- Generator nie tworzy stworzeń unikatowych (np. nazwanych olbrzymów) — tylko rodzaje.

---

## 4. Magia

- **Magia Prosta:** ok. BSW zaklęć (±1, min. 1).
- **Tradycja tajemna:** BInt + odchylenie poziomu (tabela 1.3), PZ nie wyższe niż limit poziomu. Zawsze są zaklęcia z górnej półki głównej tradycji. Wspólne zaklęcia tajemne zna każdy czarodziej tradycji tajemnej.
- **Druga i kolejne tradycje:** druga dostaje połowę zaklęć głównej, trzecia jedną trzecią.
- **Elfy [Elfy]:**
  - mogą znać tyle tradycji, ile wynosi ich BSW (szanse w tabeli 1.3);
  - każda nowa tradycja to talent Magia Tajemna i Splatanie Magii jej wiatru na połowie rozwinięć;
  - znają też elfią Magię Prostą; Mag musi znać co najmniej cztery jej zaklęcia;
  - Elfie Zaklęcia Tajemne łączące dwa wiatry są dostępne, gdy elf zna obie tradycje (50% na każde).
- **Stworzenia czarujące z cechy Rzucanie Czarów** (demony, szamani, wampiry):
  - mają Splatanie Magii wiatru tradycji i Język (Magiczny). Tradycje Chaosu i nekromancja → Dhar, kolory → wiatr koloru, czarownictwo i Waaagh! → samo „Splatanie Magii”;
  - rozwinięcia wg tabeli 1.3 ±3; wampiry wg rozdziału 5;
  - zaklęć tajemnych 1 + ⌊Język (Magiczny)/6⌋, prostych 1 + ⌊Język/8⌋;
  - wybór wiatru zapisany w bestiariuszu („Aqshy, Shyish albo Ulgu”) dopasowuje się do wylosowanej tradycji.
- **Premie do Splatania i Rzucania** (PS doliczane do udanych testów, pokazywane na karcie BN):
  - szaty: praktyczne +1, zwykłe +2, wyszukane +3 PS do Splatania [dom]; liczy się tylko najlepsza szata;
  - Talent Zmysł Magii: +1 PS do Splatania **za każdy poziom** [dom];
  - Talent Precyzyjne Inkantowanie: +1 PS do Języka (Magicznego) **za każdy poziom** [dom];
  - umagiczniony kostur i laska Lileath: −1 PZ zaklęć tradycji właściciela i wspólnych tajemnych;
  - przedmioty z generatora artefaktów: Kostur Splatania +1 PS, Klejnot Tajemny i Pierścień Tajemny +1k10 PS do jednego zaklęcia na sesję itd.
- Czarodzieje nie zmieniają tradycji; wyjątek to profesje renegatów (Czarownica).

---

## 5. Wampiry

Linię krwi losuje się k100 [Wampiry]:

| k100 | Linia krwi |
|---|---|
| 01–15 | Krwawy Smok |
| 16–40 | Lahmianin |
| 41–50 | Nekrarcha |
| 51–65 | Strigoi |
| 66–90 | Von Carstein |
| 91–00 | Niezależny |

Są **dwa sposoby tworzenia** (w generatorze do wyboru).

### 5.1 Sposób A — profil z bestiariusza

- **Baza:** profil Wampira [PG] — Sz 6, WW 60, US 40, S 50, Wt 40, I 50, Zw 70, Zr 40, Int 40, SW 60, Ogd 40, Żyw 19.
- **Cechy:** Broń +9, Ożywieniec, Ugryzienie +8, Wampiryczny, Widzenie w Ciemności.
- **Linia krwi zmienia profil względem von Carsteina:**

  | Linia | Modyfikatory |
  |---|---|
  | Krwawy Smok | WW +15, S +10, Ogd −10 |
  | Lahmianin | WW −10, I +10, Ogd +10 |
  | Nekrarcha | WW −20, Zw −20, Int +30, Ogd −20 |
  | Strigoi | WW −10, S +10, Zw +10, SW −10, Ogd −20 |
  | Von Carstein | brak |
  | Niezależny | −10 do wszystkich cech poza US i Int |

- Do tego profesje wg poziomu (tabela 1.1).

### 5.2 Sposób B — przemiana człowieka (Krwawy Pocałunek)

1. Tworzy się **człowieka**: cechy 20 + 2k10, profesje za życia wg poziomu (tabela 1.1).
   - Archetyp wg preferowanych profesji linii.
   - Imię ludzkie, płeć ma znaczenie.
2. **Przemiana** — premie do cech wg linii krwi [dom: wartości ustalone przez MG, wyższe niż w dodatku]:

   | Linia | WW | US | S | Wt | I | Zw | Zr | Int | SW | Ogd | Szybkość |
   |---|---|---|---|---|---|---|---|---|---|---|---|
   | Von Carstein | +25 | 0 | +20 | +10 | +20 | +20 | +10 | 0 | +20 | +10 | +2 |
   | Lahmianin | +20 | 0 | +10 | +10 | +30 | +20 | 0 | 0 | +20 | +20 | +2 |
   | Krwawy Smok | +30 | 0 | +20 | +20 | +10 | +20 | +10 | 0 | +20 | 0 | +2 |
   | Nekrarcha | +10 | 0 | +20 | +20 | +20 | 0 | +20 | +30 | +30 | −20 | +2 |
   | Strigoi | +20 | 0 | +30 | +20 | +20 | +30 | +10 | 0 | +20 | −20 | +2 |
   | Niezależny | +10 | 0 | +10 | +10 | +10 | +10 | +10 | 0 | +20 | 0 | +1 |

   Dla porównania oficjalna tabela [Wampiry, przemiana istniejących bohaterów]:
   - Von Carstein: WW +10, S +20, Wt +10, I +10, Zw +10, Zr +10, SW +20, Ogd +10;
   - Lahmianin: +10/+10/+10/+10/+10/+10, SW +20, Ogd +20;
   - Krwawy Smok: WW +20, S +20, reszta +10;
   - Nekrarcha: Zw 0, Int +20, SW +20, Ogd −20;
   - Strigoi: S +20, Zw +20, Int +10, SW +10, Ogd −20;
   - Niezależny: +10, SW +20, Ogd +10.

   We wszystkich liniach Przeznaczenie −1, Bohater +1, Szybkość +2 (Niezależny +1).
3. **Umiejętności rasowe linii [Wampiry]:** z 12 umiejętności linii 3 dostają +5, a 3 kolejne +3.
   - **Krwawy Smok:** Charyzma, Opanowanie, Unik, Występy (Aktorstwo), Zastraszanie, Język (dowolny), Język (Bretoński), Wiedza (Heraldyka), Broń Biała (Podstawowa), Percepcja, Jeździectwo (Konie), Skradanie (Wieś).
   - **Lahmianin:** Charyzma, Unik, Plotkowanie, Targowanie, Zastraszanie, Intuicja, Język (dowolny), Dowodzenie, Wiedza (Historia), Broń Biała (Podstawowa), Percepcja, Skradanie (Miasto).
   - **Nekrarcha:** Splatanie Magii (Dhar), Odporność, Zastraszanie, Język (dowolny), Język (Magiczny), Wiedza (Alchemia), Wiedza (Nekromancja), Wiedza (Nauka), Broń Biała (Podstawowa), Percepcja, Zwinne Palce, Skradanie (Wieś).
   - **Strigoi:** Atletyka, Oswajanie, Wspinaczka, Unik, Odporność, Zastraszanie, Broń Biała (Podstawowa), Broń Biała (Bijatyka), Sztuka Przetrwania, Percepcja, Skradanie (Wieś), Tropienie.
   - **Von Carstein:** Charyzma, Unik, Plotkowanie, Targowanie, Zastraszanie, Dowodzenie, Język (dowolny), Wiedza (Heraldyka), Wiedza (Polityka), Broń Biała (Podstawowa), Percepcja, Skradanie (Wieś).
   - **Niezależny:** Charyzma, Unik, Odporność, Plotkowanie, Targowanie, Zastraszanie, Język (dowolny), Broń Biała (Podstawowa), Nawigacja, Sztuka Przetrwania, Percepcja, Skradanie (dowolne).
4. **Talenty linii** (5; z „A lub B” jeden do wyboru):
   - **Krwawy Smok:** Wyczulony Zmysł (dowolny), Wyczucie Kierunku, Obieżyświat, Doświadczony Wędrowiec (dowolny teren), Bardzo Silny lub Urodzony Wojownik.
   - **Lahmianin:** Wyczulony Zmysł, Ulicznik lub Cień, Atrakcyjny lub Słuch Absolutny, Mistrz Charakteryzacji, Charyzmatyczny.
   - **Nekrarcha:** Wyczulony Zmysł, Straszny lub Szósty Zmysł, Poliglota lub Znawca (Magia), Percepcja Magiczna, Czytanie/Pisanie.
   - **Strigoi:** Wyczulony Zmysł, Oburęczność lub Doświadczony Wędrowiec, Twardziel, Tragarz lub Silne Nogi, Bardzo Silny.
   - **Von Carstein:** Wyczulony Zmysł, Żyłka Handlowa lub Intrygant, Błękitna Krew, Czytanie/Pisanie, Błyskotliwość lub Urodzony Wojownik.
   - **Niezależny:** Wyczulony Zmysł, Ulicznik lub Obieżyświat, Błyskotliwość lub Charyzmatyczny, 2 losowe talenty z Tabeli Losowych Talentów [PG].
5. **Wyposażenie linii [Wampiry]:**
   - **Krwawy Smok:** płaszcz, ubranie, sztylet, broń ręczna, sakiewka.
   - **Lahmianin:** sztylet, wytworne ubranie, kapelusz, kaptur albo maska, sakiewka, torba.
   - **Nekrarcha:** płaszcz, sztylet, wytworne ubranie, torba z przyborami do pisania i k10 arkuszami pergaminu.
   - **Strigoi i Niezależny:** płaszcz, sztylet, broń ręczna, kaptur albo maska, znoszone ubranie, torba.
   - **Von Carstein:** płaszcz, sztylet, wytworne ubranie, broń ręczna, sakiewka.
6. **Cechy Stworzeń wampira [Wampiry]:** Wiek 2 (w generatorze wg poziomu), Ugryzienie (+BS+3), Pazur (+BS+4), Widzenie w Ciemności, Strach 1, Klątwa Nocy, Nie Czuje Bólu, Ożywieniec, Wampiryczny.
   - Generator korzysta z cech profilu bestiariusza i dodaje Wiek oraz Klątwę Nocy.
7. Przemieniony z SW poniżej 30 [Wampiry]: Wymagający (+0) Test Opanowania albo rzut w Tabeli Zepsucia Psychicznego (Pech — dwa rzuty).
8. **Brakuje jeszcze** profesji po przemianie z dodatku (Krwawy Rycerz, Wampirzy Hrabia, Lektor, Król Ghuli i inne — ok. 20, każda z Darem Krwi na poziomie). Zasada docelowa: po przemianie zwykłe albo wampirze profesje odpowiednie dla linii, a przed przemianą do 3 profesji.

### 5.3 Wspólne dla obu sposobów

- **Dary Krwi:**
  - liczba wg poziomu (tabela 1.4);
  - losowane z 10 darów linii (waga ×4) i darów „dowolnych” (waga ×1).
- **Słabości:** 6 słabości linii.
- **Archetypy (preferowane profesje):**

  | Linia | Archetypy i wagi |
  |---|---|
  | Krwawy Smok | Wojownik 4, Szlachcic 1 |
  | Lahmianin | Szlachcic 3, Uczony 1, Zwiadowca 1 |
  | Nekrarcha | Uczony 3, Szlachcic 1, Złodziej 1 |
  | Strigoi | Zwiadowca 3, Oprych 2, Wojownik 1,5, Złodziej 1,5 |
  | Von Carstein | Szlachcic 3, Wojownik 2, Uczony 1 |
  | Niezależny | Zwiadowca 2, Złodziej 2, Oprych 1, Wojownik 1 |

- **Strigoi [dom]:**
  - tylko proste, dzikie profesje: Banita, Zwiadowca, Łowczyni, Łowczyni Nagród, Hiena Cmentarna, Żebrak, Złodziej, Przemytniczka, Szczurołap, Oprych, Rekietierka, Gladiator, Żołnierz;
  - bez zwykłego pancerza — magiczny tylko od Eksperta.
- **Czarowanie wg linii [dom]:**

  | Linia | Szansa, że czaruje | Min. Splatanie / Język | Ograniczenia |
  |---|---|---|---|
  | Nekrarcha | zawsze | 15 | — |
  | Lahmianin | 50 / 60 / 70 / 80 / 90% (Niezwykły → Heros) | 15 | — |
  | Von Carstein | 50 / 60 / 70 / 80 / 90% (Niezwykły → Heros) | 15 | — |
  | Niezależny | 30 / 40 / 50 / 60 / 70% (Niezwykły → Heros) | 10 | — |
  | Krwawy Smok | tylko od Eksperta: 35 / 50 / 65% | 10 | najwyżej 2 tajemne i 1 proste |
  | Strigoi | od Zaawansowanego: 10 / 15 / 25 / 35% | brak | 1 tradycja (Zwierząt albo Nekromancja), najwyżej 3 zaklęcia, bez Magii Prostej, tylko bezpośrednie (obrażenia albo proste czary na siebie, PZ ≤ 8) |

  - Rozwinięcia Splatania i Języka (Magicznego) = rozwinięcia magiczne poziomu × zamiłowanie linii / 2, ±2, nie mniej niż minimum.
  - Rozwinięcia magiczne poziomu: 4 / 6 / 10 / 15 / 25 / 40 / 55.
  - Zamiłowanie linii: Nekrarcha 3, Lahmianin 2, Von Carstein 2, Niezależny 1,5, Krwawy Smok 0,5, Strigoi 0,5.
  - Tradycje: jedna kolorowa + nekromancja/czarownictwo wg preferencji linii. Nekrarcha: Śmierci, Ognia, Metalu albo Cieni + Nekromancja.

---

## 6. Przedmioty, wykonanie i runy

- **Wykonanie [PG + dom]** (tabela 1.4):
  - Wady (Tandetny, Brzydki, Nieporęczny, Zawodny) częstsze u słabych BN, zielonoskórych i skavenów.
  - Zalety (Wytrzymały, Wyśmienity, Poręczny, Praktyczny) częstsze u wyższych poziomów, krasnoludów i elfów.
  - Elfie wyroby mają zawsze Wytrzymały 1 i Wyśmienity 1.
  - Gromril: Wytrzymały 4, Wyśmienity 1, płyta +1 PP.
- **Runy krasnoludzkie [Kras.]:**
  - trwały przedmiot ma najwyżej **3 zwykłe runy + 1 mistrzową** (Prawo Trzech, Prawo Zazdrości);
  - runy pasują do przedmiotu (broń / zbroja / talizman); runy zbroi tylko na metalu;
  - **runy tymczasowe [dom]:** 1–3 zwykłe (nigdy mistrzowskie), każda gaśnie, gdy raz zadziała.
- **Broń Chaosu i demoniczna [Warriors of Chaos]:** właściwości zgodne z bogiem nosiciela (wrogie potęgi się nie łączą). Demon większy na Legendzie 60%, na Herosie 85%.
- Przedmioty magiczne dostają tylko istoty rozumne. Przedmiot dopasowany do istoty (rasa, grupa, talent, linia krwi) jest 3× bardziej prawdopodobny niż ogólny.

---

## 7. Generator przedmiotów magicznych i łupów [T&A, przełożone]

- **Przedmioty:**
  - k100 kategorii: lustra, amunicja, amulety, pancerze, buty, płaszcze, pojemniki, rękawice, rogi, klejnoty, mikstury, pierścienie, szaty, różdżki, zwoje, księgi, błyskotki, bronie, kostury, przedmioty sławne;
  - w kategorii: tabela k100 pozycji, Siła Woli przedmiotu (opanowanie: Przeciwstawny Test SW), limit noszonych, zalety/wady;
  - klątwy: drobne (czas 1k10 sesji), a 91–00 to poważne (trwałe).
  - **Broń:** rodzaj (k100 + k10), liczba mocy (0–4 albo posrebrzana / runiczna / Chaosu / demoniczna), moce z kolumny walki wręcz albo dystansowej.
  - **Pancerz:** element, liczba zaczarowań, wzmocniona ochrona (+1…+3 PP albo gromril), dalsze zaczarowania.
  - Zaklęcia w zwojach, klejnotach i grimuarach losuje się z polskiej bazy zaklęć wg tabeli tradycji k100.
- **Łupy wg miejsca:**
  - miejsca ze statusem: chata, dom, posiadłość, dom czarodzieja, warsztat, kapliczka, świątynia, legowiska, skrzynie, skarbiec, ciała (chłop, mieszczanin, szlachcic, czarodziej);
  - dodane [dom]: obóz bandytów, krypta, obóz zwierzoludzi, kanały, pole bitwy, wrak;
  - każde pole to „szansa : kości”; kości k10 i k100 wybuchają;
  - **poziom miejsca 1–5** (biedna → legendarna) mnoży pieniądze i wycenę kosztowności, a szanse na magię rosną o 50% za poziom;
  - kosztowności wyceniane w monetach statusu: kamienie i biżuteria 2k10, sprzęty domowe i tkaniny 1k10, sztuka 1k10×5;
  - broń i pancerz z pobojowiska w połowie z wadami.

---

## 8. Wskazówki dla symulatora

- Identyfikatory poziomów są stabilne (`slaby` … `heros`), a nazwy wyświetlane mogą się zmieniać.
- Każda wartość per poziom to mapa poziom → wartość. Nowy poziom wymaga wpisu w każdej takiej mapie: `tiers.json`, rozwój bestii, dary wampirów, szanse przedmiotów, run i Darów Chaosu, pancerz archetypów.
- Kolejność generowania ma znaczenie:
  1. linia krwi;
  2. archetyp;
  3. rzuty;
  4. profesje;
  5. cechy stworzeń i dary;
  6. przedmioty;
  7. umiejętności magiczne;
  8. zaklęcia.

  Zaklęcia zależą od Języka (Magicznego), a przedmioty od linii krwi.
