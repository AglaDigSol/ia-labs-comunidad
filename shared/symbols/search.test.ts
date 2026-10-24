import { describe, expect, it } from "vitest";
import { ALL_SYMBOLS, symbolById } from "./index.ts";
import { normalizeEs, searchSymbols } from "./search.ts";

const first = (q: string) => searchSymbols(ALL_SYMBOLS, q)[0]?.id;

describe("normalizeEs", () => {
  it("strips accents and lower-cases", () => {
    expect(normalizeEs("  Implicación ")).toBe("implicacion");
  });
});

describe("searchSymbols", () => {
  it.each(["implicación", "implicacion", "IMPLICACION", "si entonces", "->", "⇒"])(
    "%s finds implicacion first",
    (q) => {
      expect(first(q)).toBe("implicacion");
    },
  );

  it("implication entry carries notation variants, readings and NumPy code", () => {
    const e = symbolById("implicacion")!;
    const texs = e.variants.map((v) => v.tex ?? "").join(" ");
    expect(texs).toMatch(/\\to|\\rightarrow/);
    expect(texs).toContain("\\Rightarrow");
    expect(e.reading).toBe("p implica q");
    expect(e.altReadings).toContain("si p entonces q");
    expect(e.code.some((c) => c.lib === "numpy" && c.code.includes("~p | q"))).toBe(true);
  });

  it("finds connectives by glyph, TeX and ASCII", () => {
    expect(first("∧")).toBe("conjuncion");
    expect(first("\\land")).toBe("conjuncion");
    expect(first("&")).toBe("conjuncion");
    expect(first("negacion")).toBe("negacion");
    expect(first("xor")).toBe("disyuncion-exclusiva");
    expect(first("o exclusivo")).toBe("disyuncion-exclusiva");
  });

  it("filters by category and returns [] without hits", () => {
    const only = searchSymbols(ALL_SYMBOLS, "", "boole-fn");
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((e) => e.category === "boole-fn")).toBe(true);
    expect(searchSymbols(ALL_SYMBOLS, "zzzzqqq")).toEqual([]);
  });

  it("documents both meanings of oplus", () => {
    const e = symbolById("oplus")!;
    const text = [e.reading, ...(e.altReadings ?? []), e.codeNote ?? ""].join(" ");
    expect(text).toContain("B1–B5");
    expect(text.toLowerCase()).toContain("disyunción exclusiva");
    expect(first("⊕")).toBe("oplus");
  });

  it("caps very long queries", () => {
    expect(() => searchSymbols(ALL_SYMBOLS, "a".repeat(5000))).not.toThrow();
  });
});

describe("dictionary invariants", () => {
  const BANNED = /[∀∃∧∨¬→↔⊕⊻⊙∈∉⊆⊂∪∩∅∑∏\\]|->|=>/;

  it("unique ids", () => {
    const ids = ALL_SYMBOLS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ALL_SYMBOLS.map((e) => [e.id, e] as const))("%s is well formed", (_id, e) => {
    expect(e.name.length).toBeGreaterThan(0);
    expect(e.reading.length).toBeGreaterThan(0);
    expect(e.spoken.length).toBeGreaterThan(0);
    expect(e.spoken).not.toMatch(BANNED);
    if (e.example) {
      expect(e.example.spoken.length).toBeGreaterThan(0);
      expect(e.example.spoken).not.toMatch(BANNED);
    }
    expect(e.code.length > 0 || !!e.codeNote).toBe(true);
    for (const c of e.code) {
      if (c.code.includes("~")) expect(/np\.|torch\.|dtype=bool/.test(c.code)).toBe(true);
    }
    for (const r of e.related ?? []) expect(symbolById(r)).toBeTruthy();
    const all = JSON.stringify(e);
    expect(all).not.toContain("http");
    expect(all).not.toMatch(/\w@\w+\.[a-z]/i);
  });
});
