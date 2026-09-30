import { describe, expect, it } from "vitest";
import { formatText } from "../richText";

describe("formatowanie opisow", () => {
  it("etykiety zaklec zaczynaja nowy akapit", () => {
    const b = formatText("Cel płonie. Wzmocnienie: Za każde +2 PS zasięg rośnie. Nadczarowanie: Cel ginie.");
    expect(b).toEqual([
      { type: "p", label: undefined, text: "Cel płonie." },
      { type: "p", label: "Wzmocnienie", text: "Za każde +2 PS zasięg rośnie." },
      { type: "p", label: "Nadczarowanie", text: "Cel ginie." }
    ]);
  });

  it("wypunktowania '0' tylko po dwukropku albo koncu zdania", () => {
    const b = formatText("Wybierz efekt: 0 Poznajesz moment. 0 Określasz położenie.");
    expect(b[1]).toEqual({ type: "list", items: [{ text: "Poznajesz moment." }, { text: "Określasz położenie." }] });
    expect(formatText("Gdy ma ponad 0 Żywotności, leczy się.")).toHaveLength(1);
  });

  it("progi Przeciazania jako lista, 'Patrz:' zostaje w tekscie", () => {
    const b = formatText("Leczy. Przeciążanie: Za każde +1 PS zasięg rośnie. +4 PS — Cel płonie. +8 PS — Cel ginie.");
    expect(b[1]).toEqual({ type: "p", label: "Przeciążanie", text: "Za każde +1 PS zasięg rośnie." });
    expect(b[2]).toEqual({ type: "list", items: [{ text: "+4 PS — Cel płonie." }, { text: "+8 PS — Cel ginie." }] });
    expect(formatText("Dusi ofiarę. Patrz: strona 163.")).toHaveLength(1);
  });

  it("tabela k10 w jednym ciagu", () => {
    const b = formatText("Rzuć 1k10, by określić efekt: Rzut 1k10 Efekt 1-2 Otępienie: stoi. 3-6 Atak: szarżuje. 7-9 Ucieczka: biegnie. 10 Zguba: znika.");
    expect(b[0]).toEqual({ type: "p", label: undefined, text: "Rzuć 1k10, by określić efekt:" });
    expect(b[1].type === "list" && b[1].items.map((i) => i.label)).toEqual(["1-2", "3-6", "7-9", "10"]);
  });

  it("wiersze tabeli w osobnych liniach i naglowki bez dwukropka", () => {
    const b = formatText("Wstęp.\n1-2 Pierwsze.\n3-10 Drugie.\nZabicie Roju Kiedy Rój spada do 0.");
    expect(b[1]).toEqual({ type: "list", items: [{ label: "1-2", text: "Pierwsze." }, { label: "3-10", text: "Drugie." }] });
    expect(b[2]).toEqual({ type: "p", label: "Zabicie Roju", text: "Kiedy Rój spada do 0." });
  });
});
