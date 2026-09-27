# Generator BN — WFRP 4ed

Aplikacja webowa do szybkiego tworzenia **bohaterów niezależnych** (BN) do
**Warhammer Fantasy Roleplay 4 edycja**. Działa w przeglądarce na komputerze i
telefonie, bez serwera i bez instalacji (PWA, także offline).

Bazuje na danych i wyglądzie
[Karty Postaci Interaktywnej](https://github.com/Raksoprojects/Program_postac_GUI):
te same profesje, talenty, umiejętności i rasy, ta sama ciemna szata graficzna.
Źródłem Cech Stworzeń i Profili Bohaterów jest *Bestiariusz 2.0*.

## Co potrafi

- **Ludzie i rasy albo stworzenia** — BN z profesji (5 ras, 14 archetypów) albo
  jedno ze 111 stworzeń z Bestiariusza podręcznika i *Imperialnego Zwierzyńca*.
- **Trzy metody generowania**
  - **Losowa** — jedno kliknięcie, wszystko losowe.
  - **Pół-losowa** — ustawiasz dowolne pola (archetyp, poziom, rasa, płeć, imię,
    profesja, stworzenie, Cechy Stworzeń, dowódca), resztę losuje program.
  - **Własna** — wybierasz wszystko sam; rzuty są średnie (11), rozwinięcia bez
    losowych odchyleń, bez losowych cech opcjonalnych.
- **Walka na pierwszy rzut oka** — pod cechami broń w formacie
  `Topór (+9/116)` (obrażenia / wartość testu) z Zaletami i Wadami z kart
  *Pod Bronią* oraz redukcja obrażeń na lokacjach (Bonus z Wytrzymałości + PP).
- **Zaklęcia** dla czarujących (Magia Prosta + tradycje tajemne, guślarstwo,
  czarownictwo, nekromancja, Chaos) z opisami po kliknięciu.
- **Mutacje** z *Mutant's Handbook* (224 mutacje, tabele błahe / pomniejsze /
  poważne) albo z tabel Spaczenia Fizycznego i Zepsucia Psychicznego podręcznika.
- **Edycja wyniku** — każdy element BN można zmienić: rzuty i rozwinięcia cech,
  umiejętności, talenty, broń, pancerz, zaklęcia, Cechy Stworzeń, profile
  bohaterów, mutacje, wyposażenie, pieniądze, notatki; można też przebudować
  rozwój po zmianie rasy, archetypu, poziomu lub profesji.
- **Blokady i ponowne losowanie** — zablokuj *Imię*, *Rzuty*, *Rozwój* lub
  *Cechy i mutacje* i wylosuj ponownie tylko resztę.
- **Grupy** — kilka rodzajów BN i stworzeń naraz (banda rozbójników, mała wioska,
  banda orków, wataha wilków, nieumarli z kurhanu…).
- **Zapisane BN** — biblioteka w przeglądarce z wyszukiwaniem i filtrami oraz
  eksport/import JSON.
- **Kopiuj** — zwarty blok statystyk jako tekst, gotowy do notatek sesyjnych.
- **Warianty zasad** — *Pod Bronią* (baza) i *Pełne Domowe*.

## Jak generator buduje BN (ludzie i rasy)

1. **Archetyp i poziom.** Archetyp (np. Wojownik, Złodziej, Czarodziej) określa
   kluczowe cechy, pasujące profesje, kluczowe umiejętności, preferowane talenty,
   wagi Cech Stworzeń i zestaw pancerza.
2. **Rasa, płeć, imię.** Rasa losowana wg tabeli k100 (Człowiek 90%), ale
   tylko spośród ras, które mogą wykonywać profesje archetypu.
3. **Rzuty.** Baza rasowa + 2k10. W kluczowych cechach archetypu wynik
   poniżej **9** jest przerzucany — wojownik nie bywa miernotą w WW.
4. **Ścieżka profesji.** Liczba poziomów zależy od poziomu BN:

   | Poziom BN | Poziomy profesji | Najwyższy poziom w profesji | Profil bohatera |
   |---|---|---|---|
   | Słaby | 1 (czasem 2) | 2 | — |
   | Średni | 2 | 2 | — |
   | Zaawansowany | 3–4 (np. 2× Żołnierz + 2× Rycerz) | 3 | 10% szans na Pomniejszego Bohatera (tylko przy losowaniu) |
   | Doświadczony | 4 (+ czasem 1 poziom poprzedniej profesji) | 4 | Pomniejszy Bohater |
   | Heroiczny | 5–6 (4. poziom + poprzednia profesja) | 4 | Wielki Bohater |

   Tylko Doświadczeni i Heroiczni dochodzą do 4. poziomu. Pozostali, gdy mają
   więcej poziomów, przechodzą do innej, powiązanej profesji.
5. **Rozwój.** Każdy ukończony poziom profesji daje pełne **+5** do cech i
   umiejętności dostępnych na tym poziomie (narastająco). Obecny, nieukończony
   poziom daje od +2 do +5. Talent z każdego poziomu dobierany wg preferencji
   archetypu; czarujący zawsze biorą swoje talenty magiczne.
6. **Premie archetypu.** 4 najważniejsze umiejętności i 2 najważniejsze cechy
   dostają premię zależną od poziomu BN, a ich łączne rozwinięcia trzymane są w
   progach, które na siebie nie nachodzą — najsłabszy zaawansowany jest w swoich
   kluczowych rzeczach lepszy od najsilniejszego średniego:

   | Poziom | Umiejętności: premia / łącznie | Cechy: premia / łącznie |
   |---|---|---|
   | Słaby | +1…+3 / do 13 | +0…+2 / do 12 |
   | Średni | +3…+8 / 15–18 | +2…+5 / 13–15 |
   | Zaawansowany | +5…+10 / 20–30 | +3…+7 / 17–27 |
   | Doświadczony | +8…+15 / 32–40 | +5…+10 / 20–35 + profil bohatera |
   | Heroiczny | +10…+15 / od 42 | +8…+12 / od 27 + profil bohatera |
7. **Cechy opcjonalne.** Jeden rzut k100: **1** = trzy Cechy Stworzeń,
   **2–5** = dwie, **6–20** = jedna. Losowane z wagami archetypu.
8. **Profile bohaterów** dają **stałe** premie, niezależne od rozwinięć. Siła i
   Wytrzymałość zawsze jak w Bestiariuszu; pozostałe wartości są rozkładane wg
   priorytetów archetypu (złodziej dostaje +45 do Zwinności, a nie do WW).
   *Dowódcę Oddziału* i inne profile można dodać ręcznie.
9. **Broń i pancerz.** Broń i pancerz z wyposażenia profesji; ogólne „broń ręczna”
   czy „broń (dowolna)” zamieniane są na konkretną broń pasującą do postaci
   (krasnolud — topór albo młot, elf — miecz, chłop — pałka albo topór). Brak
   broni? Dobierana jest wg najlepiej rozwiniętej umiejętności. Zestaw: do 2 broni
   białych, tarcza i 1 zasięgowa.
10. **Zaklęcia.** Magia Prosta: około Bonusu z Siły Woli zaklęć. Tradycja: Bonus z
    Inteligencji + odchylenie zależne od poziomu, zawsze z jednym zaklęciem z
    górnej półki. Słabi czarujący znają tylko Magię Prostą.

    | Poziom | Najwyższy PZ | Zaklęć tradycji |
    |---|---|---|
    | Słaby | 0 (tylko Magia Prosta) | — |
    | Średni | 6 | BInt −2…+1 |
    | Zaawansowany | 9 | BInt −1…+3 |
    | Doświadczony | 12 | BInt +0…+4 |
    | Heroiczny | bez limitu | BInt +1…+5 |
11. **Mutacje.** 1% szans na mutację u każdego BN (70% fizyczne, 30% psychiczne).
    Powaga wg *Mutant's Handbook*: k100 (+10 za każdą posiadaną mutację, maks. +40)
    — 01–60 błaha, 61–100 pomniejsza, 101+ poważna; wiersz „rzuć na wyższą tabelę”
    przenosi rzut wyżej. Kości w efektach (np. Zwinność −1k10) rzucane są od razu.
12. **Wyposażenie i pieniądze.** Rzuty w wyposażeniu (np. „3k10 szylingów”)
    wykonywane są od razu; pieniądze wg Statusu.

## Stworzenia

- **Cechy:** wartość z książki − 10 to baza, do której rzuca się 2k10 (jak dla
  ras). Cecha o wartości 5 lub mniej to po prostu 1k10; brak cechy zostaje „–”.
- **Żywotność** liczona wzorem Rozmiaru z podręcznika (Twardziel, Rój) —
  zgadza się z książką dla 110 ze 111 stworzeń (Hipogryf ma w książce błąd).
- **Stworzenia cywilizowane** (orkowie, gobliny, skaveny, zwierzoludzie, kultyści,
  ogry…) mogą dostać archetyp i rozwijać się przez profesje jak ludzie.
- **Bestie** rozwijają się bez profesji (`creature_families.json`). **Słaby to
  profil z książki plus pasujące umiejętności** — bestie z podręcznika głównego
  nie mają w książce żadnych umiejętności, więc dostają je z rodziny (połowa
  „pasowania”, np. niedźwiedź Broń Biała (Bijatyka) +15, wilk +10). Liczy się
  wyższa wartość: książka albo rodzina. Każdy wyższy poziom dodaje +5:

  | Poziom | Cechy (WW, S, Wt, I, Zw) | Umiejętności | Cechy Stworzeń z rodziny | Cechy „Opcjonalne” |
  |---|---|---|---|---|
  | Słaby — typowy osobnik | +0 | książka / rodzina | 0 | — |
  | Średni — rosły osobnik | +5 | +5 | 1 | 25% szans |
  | Zaawansowany — weteran stada | +10 | +10 | 1 | 50% |
  | Doświadczony — przewodnik stada | +15 | +15 | 2 | 75% |
  | Heroiczny — legendarna bestia | +20 | +20 | 3 | 100% |

  Niedźwiedź (WW 35): Bijatyka około 50 u słabego, 60 u średniego, 70 u zaawansowanego.

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
