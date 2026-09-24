# Edycja danych generatora

Wszystkie dane leżą w [public/data/](../public/data/) jako pliki JSON (UTF-8).
Po każdej zmianie:

1. uruchom `npm test` — test spójności wskaże literówki w nazwach profesji,
   talentów, umiejętności i cech (plik i nazwę),
2. odśwież stronę w `npm run dev`.

Nazwy muszą być **identyczne** jak w bazie (wielkość liter nie ma znaczenia
przy talentach, ale polskie znaki tak).

| Plik | Co zawiera |
|---|---|
| `archetypes.json` | Archetypy BN |
| `tiers.json` | Poziomy BN (Słaby…Heroiczny) i ustawienia generatora |
| `creature_traits.json` | Cechy Stworzeń (Duży, Zabijaka…) |
| `hero_profiles.json` | Profile Bohaterów (Dowódca Oddziału, Pomniejszy, Wielki) |
| `specializations.json` | Listy specjalizacji dla „Dowolnych” (broń, język, bóstwo, szkoła magii) |
| `names.json` | Imiona i nazwiska wg ras |
| `group_presets.json` | Gotowe grupy (banda, wioska, patrol…) |
| `talents.json`, `skills.json`, `professions.json`, `classes.json`, `races.json` | Dane gry przeniesione z karty postaci |

---

## Archetyp (`archetypes.json`)

```json
"Wojownik": {
  "description": "Zawodowy żołnierz lub najemnik nastawiony na walkę wręcz.",
  "characteristics": ["WW", "S", "I", "Zw", "SW", "Wt"],
  "professions": { "Żołnierz": 4, "Ochroniarz": 2, "Rycerz": 1 },
  "keySkills": ["Broń Biała", "Odporność", "Opanowanie", "Unik"],
  "talents": { "Urodzony Wojownik": 5, "Silny Cios": 4 },
  "traits": { "Zabijaka": 4, "Elitarny": 3, "Uczony": 0.2 },
  "specializations": {
    "Broń Biała": { "Podstawowa": 5, "Dwuręczna": 2, "Drzewcowa": 2 }
  }
}
```

| Pole | Znaczenie |
|---|---|
| `characteristics` | Kluczowe cechy **w kolejności ważności** (kody: `WW, US, S, Wt, I, Zw, Zr, Int, SW, Ogd`). Wszystkie mają minimalny rzut 9; dwie pierwsze dostają premię poziomu; kolejność decyduje o rozkładzie profilu bohatera i o cechach profesji bez rozpisanych cech. |
| `professions` | Profesje archetypu z wagami losowania (większa waga = częściej). |
| `keySkills` | Kluczowe umiejętności. Można podać nazwę bazową (`"Broń Biała"` pasuje do każdej broni) albo pełną (`"Wiedza (Magia)"`). Dwie pierwsze dostają największą premię. Brakująca umiejętność zostanie dodana. |
| `talents` | Preferowane talenty z wagami (nazwa bazowa lub pełna). Talent spoza listy ma wagę 1. |
| `traits` | Wagi Cech Stworzeń przy losowaniu cech opcjonalnych. Brak cechy = waga domyślna (`defaultTraitWeight`). Waga 0 wyklucza cechę. |
| `specializations` | Preferowane specjalizacje przy „Dowolnych”, np. jaką bronią walczy archetyp. |

Nowy archetyp = nowy klucz w pliku. Pojawi się od razu we wszystkich listach.

---

## Poziomy BN (`tiers.json`)

`settings` — ustawienia wspólne:

| Pole | Znaczenie |
|---|---|
| `minKeyRoll` | Minimalny wynik 2k10 w kluczowych cechach (domyślnie 9). |
| `advancePerLevel`, `advanceJitter` | Rozwinięcia za poziom profesji (5) i losowe odchylenie (±2). |
| `heroProfileMode` | `"max"` — profil bohatera liczy się tylko ponad rozwinięcia; `"add"` — sumuje się z nimi. |
| `heroProfileShape` | `"archetype"` — wartości profilu rozkładane wg kolejności cech archetypu; `"bestiary"` — dosłownie jak w Bestiariuszu. |
| `traitRoll` | Progi k100 dla liczby cech opcjonalnych (`upTo` = do jakiego wyniku, `count` = ile cech). |
| `unlimitedTalentCap` | Ile poziomów może mieć talent bez maksimum. |

`tiers` — każdy poziom:

| Pole | Znaczenie |
|---|---|
| `randomWeight` | Jak często poziom wypada w trybie losowym. |
| `totalLevels` | Łączna liczba poziomów profesji → waga, np. `{ "1": 3, "2": 1 }`. |
| `maxCareerLevel` | Najwyższy poziom w jednej profesji. |
| `requireLevel4` | Główna profesja zawsze na 4. poziomie. |
| `maxCareers` | Ile profesji może mieć ścieżka (1 lub 2). |
| `keySkillBonus`, `keyCharBonus` | Maks. dodatkowe rozwinięcia kluczowych umiejętności i cech. |
| `talentsPerLevel`, `extraTalentChance`, `talentLevelUpChance` | Talenty za poziom, szansa na dodatkowy talent, szansa na kolejny poziom talentu. |
| `heroProfile` | Profil nakładany automatycznie (`null` = brak). |

---

## Cechy Stworzeń (`creature_traits.json`)

```json
"Czujny": {
  "modifiers": { "WW": 10 },
  "skills": { "Percepcja": 30 },
  "movement": 0,
  "randomPool": true,
  "description": "…",
  "source": "Bestiariusz 2.0"
}
```

`randomPool: true` — cecha bierze udział w losowaniu cech opcjonalnych
(15% / 5% / 1%). Cechy z `false` można dodać tylko ręcznie. Tutaj trafią też
cechy bestii i potworów.

## Profile Bohaterów (`hero_profiles.json`)

`modifiers` — premie do cech, `traits` — dodatkowe Cechy Stworzeń wypisywane
przy BN (np. „+1 do Pancerza”, „Mistrz”).

## Specjalizacje (`specializations.json`)

- `options` — lista wyboru dla nazw z „Dowolna/Dowolny” (np. `Broń Biała (Dowolna)`).
- `linked` — grupy, które mają wspólny wybór (Błogosławieństwo i Inwokacja tego samego bóstwa).
- `lores` — pary szkoła magii ↔ wiatr (Magia Tajemna (Ognia) ↔ Splatanie Magii (Aqshy)).

## Imiona (`names.json`) i grupy (`group_presets.json`)

Imiona: listy `male`, `female`, `surnames` dla każdej rasy z `races.json`.

Grupa:

```json
"Banda rozbójników": {
  "description": "Kilku oprychów i łucznik pod wodzą herszta.",
  "rows": [
    { "count": 4, "archetype": "Oprych", "tier": "slaby" },
    { "count": 1, "archetype": "Oprych", "tier": "sredni", "commander": true, "label": "Herszt" }
  ]
}
```

Poziomy: `slaby`, `sredni`, `zaawansowany`, `doswiadczony`, `heroiczny`.
Opcjonalnie `"race": "Krasnolud"`.

---

## Talenty do uzupełnienia

W `talents.json` są 4 talenty bez opisu i limitu. Znajdziesz je, szukając
`"source": "Do uzupełnienia"`:

| Talent | Gdzie występuje | Uwaga |
|---|---|---|
| Pamiętliwy | Kowal Run 3 | talent z Podręcznika gracza Krasnoluda |
| Mistrzowska Magia Runiczna | Kowal Run 3 | talent z Podręcznika gracza Krasnoluda |
| Zręczne Palce | Zielarka 2, Złodziej 3 | możliwe, że to inna nazwa talentu *Ruchliwe Dłonie* — do sprawdzenia w podręczniku |
| Przemawianie | Zarządca 2 | możliwe, że to inna nazwa talentu *Mówca* — do sprawdzenia w podręczniku |

Uzupełnij pola `max`, `max_raw`, `tests`, `description` i `source` (schemat jak
w innych talentach). Jeśli okaże się, że to inna nazwa istniejącego talentu,
popraw nazwę w `professions.json` i usuń pusty wpis.

## Zasady domowe

Wariant *Pełne Domowe* nakłada na dane:

- pola z bloku `"variants": { "domowe": { … } }` w talentach i profesjach,
- opcjonalny plik `professions.domowe.json` (nadpisania i nowe profesje).

Pole nieobecne w wariancie = wartość bazowa (*Pod Bronią*).
