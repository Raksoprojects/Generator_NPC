"""Miejsca lupow dodane poza Treasure & Artefacts (added: true) i podzial na grupy. Idempotentny (po id).
Uruchom: python narzedzia/add_loot_locations.py
"""
import json, os, sys

sys.stdout.reconfigure(encoding="utf8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "public", "data", "loot.json")
L = json.load(open(F, encoding="utf8"))

REGROUP = {
    "oboz_bandytow": "W drodze i obozy", "pole_bitwy": "W drodze i obozy",
    "krypta": "Ruiny i grobowce", "wrak": "Ruiny i grobowce",
    "oboz_zwierzoludzi": "Legowiska", "kanaly": "Legowiska",
}


def loc(id, name, group, status, description, money, domestic=None, gems=None, art=None, cloth=None,
        scrolls=None, grimoire=None, magic=None, extra=()):
    return {"id": id, "name": name, "group": group, "status": status, "description": description,
            "money": dict(zip(("p", "s", "zk"), money)), "domestic": domestic, "gems": gems, "art": art, "cloth": cloth,
            "scrolls": scrolls, "grimoire": grimoire, "magic": magic, "extra": [list(e) for e in extra], "added": True}


NEW = [
    # Ruiny i grobowce
    loc("ruiny_twierdzy", "Ruiny twierdzy albo zamku", "Ruiny i grobowce", "srebro",
        "Opuszczona warownia: zbrojownia, piwnice, komnata dawnego pana. Stare monety i rdzewiejący oręż.",
        ("50:2k10", "50:2k10", "25:1k10"), domestic="25:1k5", gems="15:1k5", art="25:1k2", cloth="10:1k2",
        scrolls="2:1", grimoire="1:1", magic="5:1", extra=(("bron", "1k5"), ("pancerz", "50:1k2"), ("pojemniki", "50:1k2"), ("rozne", "1k5"))),
    loc("zrujnowana_swiatynia", "Zrujnowana świątynia", "Ruiny i grobowce", "srebro",
        "Splądrowany przybytek dawnego boga: ołtarz, zakrystia, skrytki kapłanów.",
        ("75:1k100", "25:1k10", "10:1k5"), domestic="10:1k5", gems="25:1k2", art="50:1k2", cloth="10:1",
        scrolls="10:1", grimoire="5:1", magic="5:1", extra=(("ksiazki", "25:1"), ("rozne", "50:1k5"))),
    loc("opuszczona_kopalnia", "Opuszczona kopalnia albo krasnoludzka sztolnia", "Ruiny i grobowce", "srebro",
        "Zawalone chodniki, porzucone narzędzia i niewywiezione urobki.",
        ("25:1k10", "10:1k10", "5:1k5"), gems="50:1k5", cloth="5:1", magic="2:1",
        extra=(("narzedzia", "1k5"), ("pojemniki", "50:1k2"), ("rozne", "50:1k5"), ("bron", "15:1"), ("pancerz", "10:1"))),
    # Legowiska
    loc("leze_nekromanty", "Leże nekromanty", "Legowiska", "srebro",
        "Ukryta pracownia nekromanty: księgi zakazanej wiedzy, ingrediencje i łupy z rozkopanych grobów.",
        ("50:2k10", "50:3k10", "25:1k10"), domestic="25:1k5", gems="50:1k5", art="25:1k2", cloth="10:1k2",
        scrolls="75:1k5", grimoire="75:1", magic="50:1k2", extra=(("ksiazki", "1k5"), ("ziola", "1k5"), ("pojemniki", "50:1k2"), ("bron", "25:1k2"))),
    loc("leze_wampira", "Leże wampira", "Legowiska", "złoto",
        "Siedziba wampira: stare monety z dawnych wieków, wytworne stroje, dzieła sztuki i rodowe kosztowności.",
        ("25:1k100", "50:1k100", "1k100"), domestic="1k10", gems="90:1k10", art="90:1k10", cloth="1k10",
        scrolls="25:1k2", grimoire="25:1", magic="50:1k2", extra=(("odziez", "1k5"), ("ksiazki", "50:1k2"), ("bron", "25:1k2"))),
    loc("kryjowka_kultystow", "Kryjówka kultystów Chaosu", "Legowiska", "srebro",
        "Piwnica albo zapomniana kaplica, w której spotyka się kult: składki wyznawców, zakazane pisma, przeklęte pamiątki.",
        ("75:3k10", "75:2k10", "25:1k10"), domestic="25:1k5", gems="25:1k2", art="15:1", cloth="25:1k5",
        scrolls="25:1k2", grimoire="15:1", magic="15:1", extra=(("ksiazki", "50:1k2"), ("ziola", "25:1k2"), ("odziez", "50:1k2"), ("bron", "25:1k2"))),
    loc("oboz_orkow", "Obóz orków albo goblinów", "Legowiska", "brąz",
        "Zielonoskórzy znoszą wszystko, co błyszczy: łupy z napadów, poobijany oręż, rzeczy bez wartości.",
        ("50:2k10", "25:1k10", "5:1k5"), domestic="10:1k5", gems="10:1k2", art="5:1", cloth="10:1k2", magic="2:1",
        extra=(("bron", "1k5"), ("pancerz", "50:1k2"), ("rozne", "1k5"), ("jedzenie", "50:1k2"))),
    loc("smocze_leze", "Smocze leże", "Legowiska", "złoto",
        "Skarb zbierany przez wieki przez wielką bestię — góra monet, klejnotów i dawnego oręża.",
        ("5k100", "5k100", "3k100"), domestic="1k10", gems="1k100", art="1k10", cloth="25:1k5",
        scrolls="25:1k5", grimoire="10:1k2", magic="50:1k5", extra=(("bron", "1k5"), ("pancerz", "1k2"))),
    # W drodze i obozy
    loc("karawana", "Wóz albo karawana kupiecka", "W drodze i obozy", "srebro",
        "Towar kupca w drodze, jego kasetka i zapasy woźniców.",
        ("75:3k10", "75:3k10", "25:1k10"), domestic="25:1k5", gems="10:1k2", art="10:1", cloth="50:1k10",
        scrolls="1:1", magic="1:1", extra=(("pojemniki", "1k5"), ("jedzenie", "1k5"), ("odziez", "50:1k5"), ("narzedzia", "25:1k2"))),
    loc("oboz_wojskowy", "Obóz wojskowy albo strażnica", "W drodze i obozy", "srebro",
        "Namioty i kwatery żołnierzy, kasa oddziału, zbrojownia, prowiant.",
        ("75:3k10", "50:2k10", "15:1k10"), domestic="15:1k5", gems="5:1", cloth="25:1k2", scrolls="1:1", magic="2:1",
        extra=(("bron", "1k10"), ("pancerz", "1k5"), ("jedzenie", "1k5"), ("pojemniki", "1k2"), ("rozne", "1k5"))),
    loc("kryjowka_przemytnikow", "Kryjówka przemytników albo złodziei", "W drodze i obozy", "srebro",
        "Melina, w której leży kontrabanda, łupy z kradzieży i wspólna kasa bandy.",
        ("1k100", "75:3k10", "25:1k10"), domestic="50:1k5", gems="50:1k5", art="25:1k2", cloth="25:1k5",
        scrolls="2:1", magic="3:1", extra=(("pojemniki", "1k5"), ("ziola", "50:1k2"), ("narzedzia", "50:1k2"), ("rozne", "1k5"))),
    # Domostwa
    loc("gospoda", "Gospoda albo zajazd", "Domostwa", "srebro",
        "Szynk, kuchnia i izby gości: utarg w szufladzie, zapasy, rzeczy zostawione przez podróżnych.",
        ("1k100", "3k10", "10:1k10"), domestic="1k10", gems="5:1", art="5:1", cloth="25:1k5", scrolls="1:1", magic="1:1",
        extra=(("jedzenie", "1k10"), ("pojemniki", "1k5"), ("rozne", "1k5"), ("odziez", "25:1k2"))),
    loc("kantor", "Kantor kupiecki", "Domostwa", "złoto",
        "Biuro i skład zamożnego kupca: kasa, weksle, próbki towaru, kosztowności zastawione przez dłużników.",
        ("1k100", "1k100", "2k10"), domestic="25:1k5", gems="75:1k5", art="25:1k2", cloth="50:1k5", scrolls="1:1", magic="2:1",
        extra=(("ksiazki", "50:1k2"), ("pojemniki", "1k5"), ("narzedzia", "25:1k2"))),
    loc("pracownia_alchemika", "Pracownia alchemika albo aptekarza", "Domostwa", "srebro",
        "Tygle, alembiki, zioła i specyfiki, notatki z doświadczeń.",
        ("50:3k10", "50:2k10", "25:1k10"), domestic="25:1k5", gems="15:1k2", cloth="10:1", scrolls="5:1", grimoire="2:1", magic="3:1",
        extra=(("ziola", "1k10"), ("narzedzia", "1k5"), ("ksiazki", "50:1k2"), ("pojemniki", "1k5"))),
]

# Poprawki MG (2026-11-27): skaveny to Braz, ale z szansa na cos lsniacego.
PATCH = {
    "kanaly": {"status": "brąz", "gems": "25:1k2", "art": "10:1"},
}
for l in L["locations"]:
    if l["id"] in REGROUP:
        l["group"] = REGROUP[l["id"]]
    l.update(PATCH.get(l["id"], {}))
# Dodane tu miejsca zawsze nadpisywane aktualna wersja.
new_ids = {n["id"] for n in NEW}
L["locations"] = [l for l in L["locations"] if l["id"] not in new_ids] + NEW
ORDER = ["Domostwa", "Świątynie", "Legowiska", "Ruiny i grobowce", "W drodze i obozy", "Skrzynie", "Ciała"]
L["locations"].sort(key=lambda l: ORDER.index(l["group"]) if l["group"] in ORDER else 99)
json.dump(L, open(F, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(len(L["locations"]), "miejsc:", {g: sum(l["group"] == g for l in L["locations"]) for g in ORDER})
