"""Ceny przedmiotow w lupach z cennika Skarbca Imperium (../Cennik_Warhammer_4ed/data/cennik.json).

Dopisuje do public/data/loot.json pole "prices": nazwa z loot.json albo weapons.json -> cena bazowa w pensach (cena_p:
cena wytworcy, bez osady i sytuacji), liczba sztuk w zestawie i Zalety z nazwy ("wytworne" = Wyśmienity).
Pozycje spoza cennika zostaja bez ceny.
Uruchom: python narzedzia/build_loot_prices.py
"""
import json, os, sys

sys.stdout.reconfigure(encoding="utf8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CENNIK = os.path.join(os.path.dirname(ROOT), "Cennik_Warhammer_4ed", "data", "cennik.json")
C = {p["nazwa"]: p for p in json.load(open(CENNIK, encoding="utf8"))["pozycje"]}
LOOT = json.load(open(os.path.join(ROOT, "public", "data", "loot.json"), encoding="utf8"))
W = json.load(open(os.path.join(ROOT, "public", "data", "weapons.json"), encoding="utf8"))

# nazwa w lupach -> (nazwa w cenniku, sztuk, Zalet z nazwy)
MAP = {
    # Pojemniki
    "beczka": ("Beczka (145 l)",), "beczułka": ("Beczułka (45 l)",), "bukłak": ("Bukłak",), "butelka": ("Butelka",),
    "duży worek": ("Duży worek",), "dzban": ("Dzban",), "juki": ("Juki",), "kufel cynowy": ("Kufel cynowy",),
    "plecak": ("Plecak",), "sakiewka": ("Sakiewka",), "torba na ramię": ("Torba na ramię",), "tuba na zwoje": ("Tuba na zwoje",),
    "worek": ("Worek",),
    # Jedzenie
    "beczułka piwa": ("Beczułka piwa (10 l)",), "butelka wina": ("Butelka wina",), "butelka dobrego wina": ("Butelka wina", 1, 1),
    "butelka rzadkiego wina": ("Butelka wina", 1, 2), "ciepły posiłek z gospody": ("Ciepły posiłek w gospodzie",),
    "kielich wina lub mocnego trunku": ("Kielich wina",), "prowiant na 1 dzień": ("Prowiant na 1 dzień",),
    "prowiant na tydzień": ("Prowiant na 1 dzień", 7), "pół litra Piwa Bugmana": ("Pół litra Piwa Bugmana",),
    "pół litra mocnego trunku": ("Pół litra mocnego trunku",), "pół litra piwa": ("Pół litra piwa",),
    "żywność na dzień": ("Jedzenie na zimno na 1 dzień",),
    # Ksiegi
    "arkusze pergaminu (12)": ("Arkusz pergaminu", 12), "dokument prawny": ("Dokument prawny",), "mapa": ("Mapa",),
    **{f"księga, {k}": (f"Księga, {k}",) for k in ("aptekarstwo", "inżynieria", "kryptografia", "literatura", "magia", "medycyna", "prawo", "religia", "sztuka")},
    # Protezy i przebrania
    "cud inżynierii (proteza)": ("Cud inżynierii",), "drewniana noga": ("Sztuczna noga",), "drewniane zęby": ("Drewniane zęby",),
    "kostium": ("Kostium",), "maska teatralna": ("Kaptur lub maska",), "maska wojenna": ("Kaptur lub maska",),
    "puder do twarzy": ("Puder do twarzy",), "zestaw do charakteryzacji": ("Zestaw do charakteryzacji",), "szklane oko": ("Sztuczne oko",),
    # Narzedzia
    "bosak": ("Bosak",), "drąg (3 metry)": ("Drąg (3 m)",), "dłuto": ("Dłuto",), "grabie": ("Grabie",),
    "grawerowana pieczęć": ("Grawerowana pieczęć",), "grzebień": ("Grzebień",), "gwoździe (12)": ("Gwoździe (12)",),
    "haczyki na ryby (12)": ("Haczyki na ryby (12)",), "kajdany": ("Kajdany",), "kilof": ("Kilof",), "klucz": ("Klucz",),
    "kołek": ("Kołek",), "liczydło": ("Liczydło",), "lusterko ręczne": ("Lusterko ręczne",), "miotła": ("Miotła",),
    "motyka": ("Motyka",), "moździerz z tłuczkiem": ("Moździerz z tłuczkiem",), "młotek": ("Młotek",),
    "młotek sędziego": ("Młotek sędziego",), "narzędzia pracy": ("Narzędzia Pracy",),
    "narzędzie do czyszczenia uszu": ("Narzędzie do czyszczenia uszu",), "pinceta": ("Pinceta",),
    "pióro do pisania": ("Pióro do pisania",), "piła": ("Piła",), "pędzel do malowania": ("Pędzel do malowania",),
    "sidła na zwierzęta": ("Sidła na zwierzęta",), "sierp": ("Sierp",), "soczewki do czytania": ("Soczewki do czytania",),
    "stalowe szczypce": ("Stalowe szczypce",), "szczotka do podłogi": ("Szczotka do podłogi",), "szpadel": ("Szpadel",),
    "teleskop": ("Teleskop",), "wiadro": ("Wiadro",), "wytrychy": ("Wytrychy",), "zestaw do pisania": ("Zestaw do pisania",),
    # Ziola
    "Grzybki Szalonego Kapelusznika": ("Grzybki Szalonego Kapelusznika",), "Rozkosz Ranalda": ("Rozkosz Ranalda",),
    "bandaż": ("Bandaż",), "czarny lotos": ("Czarny lotos",), "czyste szmaty (12 pasków)": ("Szmaty", 12),
    "dziwnokorzeń": ("Dziwnokorzeń",), "eliksir żywotności": ("Eliksir żywotności",), "fakstoryl": ("Fakstoryl",),
    "kataplazm leczniczy": ("Kataplazm leczniczy",), "korzeń mandragory": ("Korzeń mandragory",),
    "księżycowy kwiat": ("Księżycowy kwiat",), "mikstura lecznicza": ("Mikstura lecznicza",), "pluja": ("Pluja",),
    "salwort": ("Salwort",), "sercobój": ("Sercobój",), "tonik na trawienie": ("Tonik na trawienie",),
    "zestaw na zatrucia": ("Zestaw na zatrucia",), "ziemny korzeń": ("Ziemny korzeń",),
    # Odziez i tkaniny
    "amulet albo błyskotka": ("Amulet",), "berło": ("Berło",), "buty": ("Buty",), "buty i trzewiki": ("Buty",),
    "futrzane rękawice": ("Rękawiczki",), "kaptur": ("Kaptur lub maska",), "laska": ("Laska",),
    "maska (teatralna albo wojenna)": ("Kaptur lub maska",), "mundur": ("Mundur",), "perfumy": ("Perfumy",),
    "praktyczne rękawiczki": ("Rękawiczki",), "praktyczne ubranie": ("Ubranie",), "praktyczny kapelusz": ("Kapelusz",),
    "płaszcz": ("Płaszcz",), "strojny kapelusz": ("Kapelusz", 1, 1), "strój dworski": ("Strój dworski",),
    "sygnet": ("Sygnet",), "symbol religijny": ("Symbol religijny",), "szata": ("Szata",), "szaty": ("Szata",),
    "tatuaż": ("Tatuaż",), "ubranie podróżne": ("Ubranie",), "wysokie buty z ostrogami": ("Wysokie buty",),
    "wytworne rękawiczki": ("Rękawiczki", 1, 1), "wytworne ubranie": ("Ubranie", 1, 1), "zapinki (6)": ("Zapinki (6)",),
    "jedwabna chustka": ("Jedwabna bielizna",), "skóra zwierzęcia": ("Focza skóra",),
    # Rozne
    "afisz": ("Afisz",), "fajka i tytoń": ("Fajka i tytoń",), "hubka i krzesiwo": ("Pudełko na hubkę i krzesiwo",),
    "instrument muzyczny": ("Instrument",), "kotwiczka z liną": ("Kotwiczka",), "kości do gry": ("Kości do gry",),
    "kreda": ("Kreda / węgiel do rysowania",), "węgiel do rysowania": ("Kreda / węgiel do rysowania",), "kubek": ("Kubek",),
    "lalka": ("Lalka",), "lampa Davricha": ("Lampa Davricha",), "latarnia": ("Latarnia",), "latarnia sztormowa": ("Lampa sztormowa",),
    "lina (10 metrów)": ("Lina, 10 metrów",), "miska": ("Miska",), "namiot": ("Namiot",), "patelnia": ("Patelnia",),
    "piłka": ("Piłka",), "posłanie": ("Zwijane posłanie",), "płócienna płachta": ("Płócienna plandeka",), "szmaty": ("Szmaty",),
    "talerz": ("Talerz",), "talia kart": ("Talia kart",), "zapałki": ("Zapałka", 12), "zwykłe sztućce": ("Sztućce",),
    "świece (12)": ("Świece (tuzin)",), "kaganek": ("Lampa oliwna",),
    # Sprzety domowe (zestaw, Treasure & Artefacts s. 5) [dom]: liczba sztuk w zestawie
    "kandelabr ze świecami": ("Świece (tuzin)",), "kubki i kieliszki": ("Kubek", 6), "sztućce": ("Sztućce",),
    "puchary": ("Kufel cynowy", 4), "latarnia z oliwą": ("Latarnia",), "talerze i misy": ("Talerz", 12),
    "wino i trunki": ("Butelka wina", 6),
    # Tylko w cenniku Skarbca
    "łom": ("Łom",), "mop": ("Mop",), "koc": ("Koc",), "koce": ("Koc", 2), "garnek": ("Kociołek do gotowania",),
    "olej do lamp": ("Olej do lampy, rzepakowy albo tran (litr)",), "hak": ("Hak",), "przepaska na oko": ("Opaska na oko",),
    "pozłacany nos": ("Złoty nos",), "kula": ("Kule",), "pościel": ("Prześcieradło",), "zwykła pościel": ("Prześcieradło",),
    "wytworna pościel": ("Prześcieradło", 1, 1), "peleryna": ("Opończa",),
    # Dziela sztuki z cena w cenniku
    "cynowy kufel": ("Kufel cynowy",), "lusterko": ("Lusterko ręczne",),
}

out = {"note": "Ceny bazowe z cennika Skarbca Imperium (cena_p, cena wytwórcy bez osady i sytuacji) w pensach. "
               "Zalety przedmiotu: ×2 za każdą, Wady: ×½ za każdą (PG s. 292–293). qty = sztuk w zestawie [dom], q = Zalety z nazwy.",
       "items": {}, "gear": {}}
missing = []


def src(p):
    return f"Skarbiec: {p['id']}"


for loot, spec in MAP.items():
    name, qty, q = spec[0], (spec[1] if len(spec) > 1 else 1), (spec[2] if len(spec) > 2 else 0)
    p = C.get(name)
    if not p or p.get("cena_p") is None:
        missing.append((loot, name))
        continue
    e = {"p": p["cena_p"], "src": src(p)}
    if qty != 1:
        e["qty"] = qty
    if q:
        e["q"] = q
    out["items"][loot] = e
alias = {"Tarcza duża": "Tarcza (duża)", "Puklerz": "Tarcza (puklerz)", "Hełm otwarty": "Hełm otwarty (morion)", "Hełm": "Hełm zamknięty", "Nadziak": "Nadziak jednoręczny"}
for kind in ("melee", "ranged", "armour"):
    for n in W[kind]:
        p = C.get(n) or C.get(alias.get(n, ""))
        if p and p.get("cena_p") is not None:
            out["gear"][n] = {"p": p["cena_p"], "src": src(p)}
LOOT["prices"] = out
json.dump(LOOT, open(os.path.join(ROOT, "public", "data", "loot.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(len(out["items"]), "przedmiotow,", len(out["gear"]), "broni i pancerzy; bez ceny:", missing)
