import { describe, expect, it } from "vitest";
import { countOf, inclusionExclusion2, inclusionExclusion3, regionLayers, solveRegions } from "./cardinal.ts";
import { parseSetExpr, regionLabel, type SetExpr } from "./expr.ts";

const p = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};

describe("inclusión–exclusión", () => {
  it("dos y tres conjuntos", () => {
    expect(inclusionExclusion2(35, 28, 10)).toBe(53);
    expect(inclusionExclusion3(45, 30, 32, 12, 15, 9, 5)).toBe(76);
  });

  it("coincide con contar elementos de conjuntos al azar (semilla fija)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);
    for (let t = 0; t < 200; t++) {
      const U = Array.from({ length: 20 }, (_, i) => i);
      const [A, B, C] = [0, 1, 2].map(() => new Set(U.filter(() => rnd() < 0.4)));
      const n = (f: (x: number) => boolean) => U.filter(f).length;
      const a = A!, b = B!, c = C!;
      expect(inclusionExclusion2(a.size, b.size, n((x) => a.has(x) && b.has(x)))).toBe(n((x) => a.has(x) || b.has(x)));
      expect(
        inclusionExclusion3(
          a.size,
          b.size,
          c.size,
          n((x) => a.has(x) && b.has(x)),
          n((x) => a.has(x) && c.has(x)),
          n((x) => b.has(x) && c.has(x)),
          n((x) => a.has(x) && b.has(x) && c.has(x)),
        ),
      ).toBe(n((x) => a.has(x) || b.has(x) || c.has(x)));
    }
  });
});

describe("regiones a partir de los datos", () => {
  it("capas de dentro hacia fuera", () => {
    expect(regionLayers(2).map((l) => l.map((r) => regionLabel(["A", "B"], r)))).toEqual([
      ["A ∩ B"],
      ["Aᶜ ∩ B", "A ∩ Bᶜ"],
      ["Aᶜ ∩ Bᶜ"],
    ]);
    expect(regionLayers(3).map((l) => l.length)).toEqual([1, 3, 3, 1]);
  });

  it("tres conjuntos con la intersección triple", () => {
    const vars = ["A", "B", "C"] as const;
    const data = [
      ["U", 80],
      ["A", 45],
      ["B", 30],
      ["C", 32],
      ["A ∩ B", 12],
      ["A ∩ C", 15],
      ["B ∩ C", 9],
      ["A ∩ B ∩ C", 5],
    ] as const;
    const r = solveRegions(vars, data.map(([e, v]) => ({ expr: p(e), value: v })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(countOf(p("A ∖ (B ∪ C)"), vars, r.counts)).toBe(23);
    expect(countOf(p("(A ∪ B ∪ C)ᶜ"), vars, r.counts)).toBe(4);
    expect(countOf(p("U"), vars, r.counts)).toBe(80);
  });

  it("con la unión en lugar de la intersección", () => {
    const r = solveRegions(["A", "B"], [
      { expr: p("U"), value: 50 },
      { expr: p("A"), value: 38 },
      { expr: p("B"), value: 20 },
      { expr: p("A ∪ B"), value: 45 },
    ]);
    expect(r.ok && countOf(p("A ∩ B"), ["A", "B"], r.counts)).toBe(13);
  });

  it("datos insuficientes, contradictorios o que no dan naturales", () => {
    const vars = ["A", "B"] as const;
    expect(solveRegions(vars, [{ expr: p("A"), value: 3 }])).toEqual({ ok: false, reason: "underdetermined" });
    expect(
      solveRegions(vars, [
        { expr: p("U"), value: 10 },
        { expr: p("A"), value: 3 },
        { expr: p("B"), value: 4 },
        { expr: p("A ∩ B"), value: 1 },
        { expr: p("A ∪ B"), value: 9 },
      ]),
    ).toEqual({ ok: false, reason: "inconsistent" });
    expect(
      solveRegions(vars, [
        { expr: p("U"), value: 10 },
        { expr: p("A"), value: 3 },
        { expr: p("B"), value: 4 },
        { expr: p("A ∩ B"), value: 5 },
      ]),
    ).toEqual({ ok: false, reason: "not-natural" });
  });
});
