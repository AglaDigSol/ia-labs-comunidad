import { describe, expect, it } from "vitest";
import { ALL_SYMBOLS } from "../symbols/index.ts";
import { SEED_DECKS, seedCards } from "./decks.ts";
import { SEED_CARD_RE, SEED_DECK_RE } from "./types.ts";

describe("SEED_DECKS", () => {
  it("has the three 02MIAR session decks and the 01MIAR Python deck", () => {
    expect(SEED_DECKS.map((d) => [d.id, d.course, d.session])).toEqual([
      ["sym-02-s1", "02MIAR", 1],
      ["sym-02-s2", "02MIAR", 2],
      ["sym-02-gen", "02MIAR", null],
      ["sym-01-py", "01MIAR", null],
    ]);
    expect(SEED_DECKS.map((d) => d.name)).toEqual([
      "Sesión 1 · Símbolos",
      "Sesión 2 · Símbolos",
      "General · Símbolos",
      "Símbolos en Python",
    ]);
    for (const d of SEED_DECKS) {
      expect(d.id).toMatch(SEED_DECK_RE);
      expect(d.source).toBe("dictionary");
    }
  });
});

describe("seedCards", () => {
  it("covers every dictionary entry exactly once across the 02MIAR decks", () => {
    const ids = ["sym-02-s1", "sym-02-s2", "sym-02-gen"].flatMap((d) => seedCards(d).map((c) => c.id));
    expect(ids.sort()).toEqual(ALL_SYMBOLS.map((s) => `sym-${s.id}`).sort());
    const s1 = seedCards("sym-02-s1");
    expect(s1.length).toBe(ALL_SYMBOLS.filter((s) => s.session === 1).length);
    expect(seedCards("sym-02-gen").length).toBe(ALL_SYMBOLS.filter((s) => s.session === "posterior").length);
  });

  it("uses the symbol TeX as front and the lectura as back", () => {
    const sym = ALL_SYMBOLS[0]!;
    const deck = sym.session === 1 ? "sym-02-s1" : sym.session === 2 ? "sym-02-s2" : "sym-02-gen";
    const card = seedCards(deck).find((c) => c.id === `sym-${sym.id}`)!;
    expect(card.front).toBe(`$${sym.tex}$`);
    expect(card.back).toBe(sym.reading);
    expect(card.mono).toBeFalsy();
  });

  it("builds the 01MIAR deck from the code equivalents, in mono", () => {
    const withCode = ALL_SYMBOLS.filter((s) => s.code.length > 0);
    const py = seedCards("sym-01-py");
    expect(py.map((c) => c.id)).toEqual(withCode.map((s) => `symp-${s.id}`));
    for (const c of py) expect(c.mono).toBe(true);
    const first = withCode[0]!;
    expect(py[0]!.back).toBe(first.code.map((i) => `${i.lib}: ${i.code}`).join("\n"));
    expect(py[0]!.back.startsWith(`${first.code[0]!.lib}: `)).toBe(true);
  });

  it("has unique ids matching SEED_CARD_RE and is deterministic", () => {
    const all = SEED_DECKS.flatMap((d) => seedCards(d.id).map((c) => c.id));
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(SEED_CARD_RE);
    expect(SEED_DECKS.flatMap((d) => seedCards(d.id))).toEqual(SEED_DECKS.flatMap((d) => seedCards(d.id)));
  });

  it("returns nothing for an unknown deck", () => {
    expect(seedCards("abcdefghij12")).toEqual([]);
  });
});
