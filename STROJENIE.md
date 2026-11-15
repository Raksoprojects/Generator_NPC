# Strojenie generatora: gdzie zmieniać wartości

Ten plik wskazuje, gdzie leży każda liczba, od której zależy siła i wyposażenie BN.
Prawie wszystko jest w plikach JSON w `public/data/`. Kod zmieniasz tylko w kilku miejscach z ostatniej części.

## Jak zmieniać

1. Otwórz plik JSON z tabeli poniżej i zmień liczbę.
2. Zapisz plik i odśwież stronę generatora (`npx vite`). Nie trzeba niczego budować.
3. Uruchom testy: `npx vitest run --config vitest.config.ts`.
4. Jeśli test padnie na liczbie, którą świadomie zmieniłeś, popraw próg w teście. Jeśli padnie gdzie indziej, zmiana coś zepsuła.

Zapis szans: `0.01` to 1%, `0.001` to 0,1%, `1` to pewność.
Każda szansa dotyczy jednego BN. `0.01` znaczy, że mniej więcej co setny BN ma daną rzecz.

Identyfikatory poziomów w plikach i ich nazwy w programie:

| W pliku | W programie |
|---|---|
| `slaby` | Nowicjusz |
| `sredni` | Zwykły |
| `zaawansowany` | Niezwykły |
| `doswiadczony` | Zaawansowany |
| `heroiczny` | Ekspert |
| `legendarny` | Legenda |
| `heros` | Heros |

## Poziomy i PD — `tiers.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Przedział PD poziomu | `tiers.<poziom>.xp` = `[od, do]` | PD ponad tworzenie postaci. Losowane z przedziału. Główne pokrętło siły BN. |
| Liczba profesji | `tiers.<poziom>.maxCareers` | |
| Częstość poziomu przy losowym | `tiers.<poziom>.randomWeight` | Waga względna. |
| Opis poziomu | `tiers.<poziom>.description` | Tekst w podpowiedzi. Zmień, gdy zmieniasz PD. |
| Czary | `tiers.<poziom>.spells` | `maxCn` najwyższy PZ, `arcane` liczba zaklęć tajemnych, `extraLores` szanse na kolejne tradycje, `casterAdvances` rozwinięcia Splatania i Języka. |
| Profile bohaterskie | `tiers.<poziom>.heroProfileChances` | Weteran, Doborowy itd. z szansami. |
| 5. poziom profesji | `tiers.<poziom>.level5Chance` | |
| Losowe cechy stworzeń u ludzi | `settings.traitRoll` | Na k100: `upTo: 1` daje 2 cechy (1%), `upTo: 8` daje 1 cechę (7%). |
| Krew Aenariona i podobne | `settings.raceTalents` | Szansa na talent rasowy, mnożona dla archetypów. |

## Archetypy — `archetypes.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Cechy kluczowe | `<archetyp>.characteristics` | Kolejność ma znaczenie: najwyższe rzuty 2k10 trafiają do pierwszych cech. Tu leży siła Wojownika-Nowicjusza w WW. |
| Profesje | `<archetyp>.professions` | Wagi. Waga 0.01 i mniej oznacza profesję zapasową. |
| Umiejętności kluczowe | `<archetyp>.keySkills` | Na nie idą rozwinięcia z tworzenia postaci i PD. |
| Talenty | `<archetyp>.talents` | Wagi. Brak talentu na liście (np. Twardziel) oznacza, że BN prawie go nie kupuje. |
| Cechy stworzeń | `<archetyp>.traits` | Wagi przy losowaniu cech z `traitRoll`. |
| Pancerz | `<archetyp>.armour` | |

## Stworzenia

### Profile — `creatures.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Profil z podręcznika | `<stworzenie>.stats` | Baza do rzutu: wartość − 10 + 2k10. `null` oznacza brak cechy. |
| Najniższy poziom | `<stworzenie>.minTier` | Niższy poziom podnosi się do tego. Od początku tego przedziału liczy się budżet PD bestii. |
| Rodzina | `<stworzenie>.family` | Wskazuje wpis w `creature_families.json`. |

### Rodziny i rozwój — `creature_families.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Na co bestia wydaje PD | `settings.xpDevelopment.chars` | Priorytety cech, np. `WW: 2`. Wyższy priorytet oznacza częstszy zakup (waga = priorytet² / koszt). |
| Priorytet umiejętności | `settings.xpDevelopment.fitPriority` | `[[30,3],[20,2],[0,1]]`: umiejętność rodziny z wartością 30+ ma priorytet 3 itd. |
| Dodatkowe umiejętności | `settings.xpDevelopment.extraSkills` | Odporność, Opanowanie, Unik. Tylko gdy stworzenie ma cechę umiejętności. |
| Liczba cech stworzeń | `settings.traitCount.<poziom>` | Ułamek: 0.5 oznacza 50% na jedną cechę, 1.5 oznacza jedną cechę i 50% na drugą. |
| Cechy opcjonalne z podręcznika | `settings.optionalChance.<poziom>` | Szansa na każdą cechę opcjonalną z bestiariusza. |
| Opis poziomu stworzenia | `settings.tierLabels.<poziom>` | |
| Umiejętności rodziny | `families.<rodzina>.skills` | Np. Skradanie u kotów. Liczba to dopasowanie (do 40). Na Nowicjuszu stworzenie ma połowę (`tierFactor`). Wyższe dopasowanie daje wyższy priorytet przy PD. |
| Cechy rodziny | `families.<rodzina>.traits` | Wagi losowania. Silne cechy (Elitarny) dostają dodatkowo mnożnik siły z kodu. |
| Stworzenia „dzikie” | `notCivilized` | Lista dopisanych ręcznie. Nie dostają cech podnoszących Ogd. |

### Cechy stworzeń — `creature_traits.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Premie cechy | `<cecha>.modifiers` | Premie do cech profilu. Suma dodatnich premii to „siła” cechy. |
| Czy losowana | `<cecha>.randomPool` | `false` wyłącza ją z losowania. |

### Wampiry — `vampires.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Linie krwi | `bloodlines` | Zakresy k100, archetypy linii, przemiana (`turning`). |
| Dary wg poziomu | `giftsPerTier` | |
| Waga darów linii | `bloodlineGiftWeight` | |
| Wiek wg poziomu | `ageByTier` | |

## Przedmioty magiczne — `treasures.json`

| Co | Gdzie | Uwagi |
|---|---|---|
| Szanse na kolejne przedmioty | `chances.<poziom>` | Lista: pierwsza liczba to szansa na 1. przedmiot, druga na 2. itd. `[0.04, 0.005]` = 4% na jeden i 0,5% na drugi. |
| Rodzaj przedmiotu | `kindWeight` | `weapon` broń, `armour` pancerz, `item` drobiazg, `potion` mikstura. Wyższa waga oznacza częstszy wybór. |
| Mnożnik rasy (bez run) | `itemRaceMult` | Krasnolud 0.3. Nie działa na szanse równe 1. |
| Przedmiot pasujący do profesji | `fitWeight` | Mnożnik wagi szablonu pasującego do BN. |
| Runy tymczasowe | `runic.temporary.<poziom>` | Szansa dla człowieka. |
| Runy trwałe | `runic.permanent.<poziom>` | Szansa dla człowieka. |
| Mnożnik rasy dla run | `runic.raceMult` | Krasnolud 12, elfy 0.2. Szansa krasnoluda = szansa z tabeli × 12. |
| Liczba run | `runic.regularCount`, `runic.temporaryCount` | `[od, do]` wg poziomu. |
| Runa mistrzowska | `runic.masterChance.<poziom>` | |
| Waga szablonu | `items[].weight` | Pojedynczy przedmiot: amulet, miecz runiczny itd. |

Przykład: krasnolud Niezwykły, runa tymczasowa: `runic.temporary.zaawansowany` = 0.001, razy 12 daje 1,2%.

## Mutacje — `mutations.json`

`settings.chance` to szansa na mutację u BN (0.01 = 1%). `settings.mentalShare` to udział mutacji umysłu.

## W kodzie (zmieniaj rzadko)

| Co | Gdzie | Uwagi |
|---|---|---|
| Koszty PD cech i umiejętności | `src/lib/xp.ts` (`CHAR_COST`, `SKILL_COST`) | Z podręcznika. Nie zmieniaj. |
| Kara wagi za silną cechę | `src/lib/creatures.ts`, `traitStrengthFactor` | `(20 / siła)²`: Twardy ×1, Zabijaka ×0,44, Elitarny ×0,11. Większa liczba niż 20 łagodzi karę. |
| Tworzenie postaci | `src/lib/generator.ts`, `creationStart` | 5 rozwinięć cech, 40 rozwinięć umiejętności (najwyżej 10 w jednej), 1 talent. Z podręcznika. |
| Rzuty cech | `src/lib/generator.ts`, `assignRolls` | Najwyższe rzuty 2k10 do cech kluczowych archetypu. |

## Sprawdzenie skutków

Tablica „Bilans BN i stworzeń” pokazuje średnie cech i umiejętności na każdym poziomie.
Dane pochodzą z jednorazowej symulacji i same się nie odświeżają.
Po większej zmianie poproś o ponowne przeliczenie.
