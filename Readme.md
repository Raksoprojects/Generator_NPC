# Generator BN — WFRP 4ed

Aplikacja webowa do szybkiego tworzenia **bohaterów niezależnych** (BN) do
**Warhammer Fantasy Roleplay 4 edycja**. Działa w przeglądarce na komputerze i
telefonie, bez serwera i bez instalacji (PWA, także offline).

Bazuje na danych i wyglądzie
[Karty Postaci Interaktywnej](https://github.com/Raksoprojects/Program_postac_GUI):
te same profesje, talenty, umiejętności i rasy, ta sama ciemna szata graficzna.
Źródłem Cech Stworzeń i Profili Bohaterów jest *Bestiariusz 2.0*.

## Co potrafi

- **Trzy metody generowania**
  - **Losowa** — jedno kliknięcie, wszystko losowe.
  - **Pół-losowa** — ustawiasz dowolne pola (archetyp, poziom, rasa, płeć, imię,
    profesja, Cechy Stworzeń, dowódca), resztę losuje program.
  - **Własna** — wybierasz wszystko sam; rzuty są średnie (11), rozwinięcia bez
    losowych odchyleń, bez losowych cech opcjonalnych.
- **Edycja wyniku** — każdy element BN można zmienić: rzuty i rozwinięcia cech,
  umiejętności, talenty, Cechy Stworzeń, profile bohaterów, wyposażenie,
  pieniądze, notatki, a także przebudować rozwój po zmianie rasy, archetypu,
  poziomu lub profesji.
- **Blokady i ponowne losowanie** — zablokuj *Imię*, *Rzuty*, *Rozwój* lub
  *Cechy stworzeń* i wylosuj ponownie tylko resztę.
- **Grupy** — kilka rodzajów BN naraz (banda rozbójników, mała wioska, patrol
  straży…), z gotowych zestawów albo własnych wierszy.
- **Zapisane BN** — biblioteka w przeglądarce z wyszukiwaniem i filtrami oraz
  eksport/import JSON (kopia zapasowa, przenoszenie na inne urządzenie, własna
  baza gotowych BN).
- **Kopiuj** — zwarty blok statystyk jako tekst, gotowy do notatek sesyjnych.
- **Warianty zasad** — *Pod Bronią* (baza) i *Pełne Domowe*.

## Jak generator buduje BN

1. **Archetyp i poziom.** Archetyp (np. Wojownik, Złodziej, Czarodziej) określa
   kluczowe cechy, pasujące profesje, kluczowe umiejętności, preferowane talenty
   i wagi Cech Stworzeń.
2. **Rasa, płeć, imię.** Rasa losowana wg tabeli k100 (Człowiek 90%), ale
   tylko spośród ras, które mogą wykonywać profesje archetypu.
3. **Rzuty.** Baza rasowa + 2k10. W kluczowych cechach archetypu wynik
   poniżej **9** jest przerzucany — wojownik nie bywa miernotą w WW.
4. **Ścieżka profesji.** Liczba poziomów zależy od poziomu BN:

   | Poziom BN | Poziomy profesji | Najwyższy poziom w profesji | Profil bohatera |
   |---|---|---|---|
   | Słaby | 1 (czasem 2) | 2 | — |
   | Średni | 2 | 2 | — |
   | Zaawansowany | 3–4 (np. 2× Żołnierz + 2× Rycerz) | 3 | — |
   | Doświadczony | 4 (+ czasem 1 poziom poprzedniej profesji) | 4 | Pomniejszy Bohater |
   | Heroiczny | 5–6 (4. poziom + poprzednia profesja) | 4 | Wielki Bohater |

   Tylko Doświadczeni i Heroiczni dochodzą do 4. poziomu. Pozostali, gdy mają
   więcej poziomów, przechodzą do innej, powiązanej profesji.
5. **Rozwój.** Za każdy przebyty poziom profesji: ok. **+5** (±2) do cech i
   umiejętności dostępnych na tym poziomie (narastająco, jak w Bestiariuszu) oraz
   talent z tego poziomu, dobierany wg preferencji archetypu. Wyżsi BN mają
   szansę na dodatkowe talenty i kolejne poziomy talentów.
   Profesja bez rozpisanych cech (część profesji z *Pod Bronią*) bierze 3
   pierwsze cechy archetypu na 1. poziomie i jedną kolejną na każdy następny.
6. **Premie archetypu.** Dwie pierwsze kluczowe umiejętności dostają dodatkowo
   do +5 (Słaby, Średni), +10 (Zaawansowany) albo +15 (Doświadczony, Heroiczny);
   pozostałe kluczowe — do połowy tej wartości. Dwie pierwsze kluczowe cechy
   dostają do +3 / +5 / +10.
7. **Cechy opcjonalne.** Jeden rzut k100: **1** = trzy Cechy Stworzeń,
   **2–5** = dwie, **6–20** = jedna. Losowane z wagami archetypu (Oprych częściej
   dostaje Brutalnego lub Zabijakę, ale uczony zabijaka też się zdarza).
8. **Profile bohaterów.** Profil wynikający z poziomu BN jest **rozkładany wg
   priorytetów cech archetypu** (złodziej dostaje +45 do Zwinności, a nie do
   Walki Wręcz; łączna siła profilu jest ta sama) i **nie sumuje się** z
   rozwinięciami — liczy się tylko nadwyżka ponad nie. *Dowódcę Oddziału* i
   pozostałe profile można dodać do każdego BN ręcznie.
9. **Wyposażenie i pieniądze.** Wyposażenie z obecnej profesji; pieniądze wg
   Statusu (Brąz: 2k10 × poziom pensów, Srebro: 1k10 × poziom szylingów,
   Złoto: poziom koron).

Wszystkie liczby z tej listy są w plikach danych i można je zmieniać — patrz
[docs/EDYCJA_DANYCH.md](docs/EDYCJA_DANYCH.md).

## Uruchomienie lokalne

Projekt używa **lokalnego środowiska** w katalogu `.venv` (Python venv + Node.js
zainstalowany do niego przez `nodeenv`). Nic nie jest instalowane globalnie.

Pierwsza konfiguracja (PowerShell, z katalogu projektu):

```powershell
py -m venv .venv
.venv\Scripts\python.exe -m pip install nodeenv
.venv\Scripts\nodeenv.exe -p --node=20.18.0 --prebuilt
.venv\Scripts\Activate.ps1
npm install
```

Na co dzień:

```powershell
.venv\Scripts\Activate.ps1   # aktywuje Pythona i Node z .venv
npm run dev                  # serwer deweloperski: http://localhost:5173/Generator_NPC/
npm test                     # testy (Vitest)
npm run check                # sprawdzenie typów
npm run build                # build produkcyjny (dist/)
```

## Wdrożenie

Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) po
każdym `push` na `master` buduje aplikację i publikuje ją na GitHub Pages pod
adresem `https://raksoprojects.github.io/Generator_NPC/`. W ustawieniach repo
(*Settings → Pages*) źródłem musi być **GitHub Actions**.

## Struktura

| Ścieżka | Zawartość |
|---|---|
| [public/data/](public/data/) | Dane gry i generatora (JSON) — edytowalne ręcznie |
| [src/lib/generator.ts](src/lib/generator.ts) | Generator: etapy losowania, ścieżka profesji, rozwój, cechy opcjonalne |
| [src/lib/npc.ts](src/lib/npc.ts) | Wartości końcowe BN i blok tekstowy |
| [src/lib/gameData.ts](src/lib/gameData.ts) | Wczytywanie danych, warianty zasad, wyszukiwanie nazw |
| [src/lib/library.ts](src/lib/library.ts) | Biblioteka zapisanych BN, import/eksport JSON |
| [src/components/](src/components/) | Widoki: Generator, Grupa, Zapisane, karta BN |
| [src/lib/\_\_tests\_\_/](src/lib/__tests__/) | Testy logiki i spójności danych |
| [docs/EDYCJA_DANYCH.md](docs/EDYCJA_DANYCH.md) | Jak edytować archetypy, poziomy, talenty i resztę danych |
