import { beforeAll, describe, expect, it } from "vitest";
import { seedRng } from "../dice";
import { generateNpc } from "../generator";
import { libraryToJson, mergeLibrary, parseNpcJson } from "../library";
import { loadTestGameData } from "./loadData";

beforeAll(() => loadTestGameData());

describe("biblioteka BN", () => {
  it("eksport i import calej biblioteki zachowuje BN", () => {
    const npcs = [generateNpc({}, seedRng(1)), generateNpc({}, seedRng(2))];
    const back = parseNpcJson(libraryToJson(npcs));
    expect(back).toEqual(npcs);
  });

  it("import przyjmuje tez pojedynczego BN i pomija smieci", () => {
    const npc = generateNpc({}, seedRng(3));
    expect(parseNpcJson(JSON.stringify(npc))).toHaveLength(1);
    expect(parseNpcJson(JSON.stringify([npc, { foo: 1 }]))).toHaveLength(1);
  });

  it("scalanie nadpisuje ten sam id i dopisuje nowe", () => {
    const a = generateNpc({}, seedRng(4));
    const b = generateNpc({}, seedRng(5));
    const renamed = { ...a, name: "Nowe Imię" };
    const { merged, added, updated } = mergeLibrary([a], [renamed, b]);
    expect(added).toBe(1);
    expect(updated).toBe(1);
    expect(merged.find((n) => n.id === a.id)?.name).toBe("Nowe Imię");
  });
});
