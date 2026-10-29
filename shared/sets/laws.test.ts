import { describe, expect, it } from "vitest";
import { parseSetExpr, type SetExpr } from "./expr.ts";
import { checkSetStep, setApplicableLaws, setLawJustifies, setLawsJustifying, SET_LAWS, type SetLawId } from "./laws.ts";

const p = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.expr;
};
const just = (a: string, b: string, law: SetLawId) => setLawJustifies(p(a), p(b), law);

describe("cada ley: casos positivos y negativos", () => {
  const cases: Array<[SetLawId, Array<[string, string]>, Array<[string, string]>]> = [
    ["conmutativa", [["A ∪ B", "B ∪ A"], ["A Δ B", "B Δ A"]], [["A ∖ B", "B ∖ A"]]],
    ["asociativa", [["A ∩ (B ∩ C)", "(A ∩ B) ∩ C"]], [["A ∖ (B ∖ C)", "(A ∖ B) ∖ C"]]],
    ["identidad", [["A ∪ ∅", "A"], ["A ∩ U", "A"], ["(A ∪ ∅) ∖ B", "A ∖ B"]], [["A ∪ U", "A"]]],
    ["complemento", [["A ∪ Aᶜ", "U"], ["A ∩ Aᶜ", "∅"], ["∅ᶜ", "U"], ["B ∖ (A ∩ Aᶜ)", "B ∖ ∅"]], [["A ∪ Aᶜ", "∅"]]],
    ["idempotencia", [["A ∪ A", "A"], ["(A ∖ B) ∪ (A ∖ B)", "A ∖ B"]], [["A ∪ Aᶜ", "A"]]],
    ["dominacion", [["A ∪ U", "U"], ["A ∩ ∅", "∅"]], [["A ∪ ∅", "∅"]]],
    ["absorcion", [["A ∪ (A ∩ B)", "A"], ["A ∩ (A ∪ B)", "A"], ["A ∪ (Aᶜ ∩ B)", "A ∪ B"]], [["A ∪ B", "A"]]],
    ["involucion", [["(Aᶜ)ᶜ", "A"], ["((A ∖ B)ᶜ)ᶜ", "A ∖ B"]], [["Aᶜ", "A"]]],
    [
      "distributiva",
      [
        ["A ∩ (B ∪ C)", "(A ∩ B) ∪ (A ∩ C)"],
        ["(A ∩ B) ∪ (A ∩ C)", "A ∩ (B ∪ C)"],
        ["A ∪ (B ∩ C)", "(A ∪ B) ∩ (A ∪ C)"],
        ["(A ∖ C) ∩ (B ∪ Cᶜ)", "((A ∖ C) ∩ B) ∪ ((A ∖ C) ∩ Cᶜ)"],
      ],
      [["A ∩ (B ∪ C)", "(A ∩ B) ∪ C"]],
    ],
    ["demorgan", [["(A ∪ B)ᶜ", "Aᶜ ∩ Bᶜ"], ["(A ∩ B)ᶜ", "Aᶜ ∪ Bᶜ"], ["(A ∩ Bᶜ)ᶜ", "Aᶜ ∪ B"]], [["(A ∩ B)ᶜ", "Aᶜ ∩ Bᶜ"]]],
    [
      "diferencia",
      [
        ["A ∖ B", "A ∩ Bᶜ"],
        ["A ∩ Bᶜ", "A ∖ B"],
        ["A ∖ Bᶜ", "A ∩ B"],
        ["(A ∖ B) ∪ C", "(A ∩ Bᶜ) ∪ C"],
        ["A ∖ (A ∖ B)", "A ∖ (A ∩ Bᶜ)"],
        ["A ∖ (A ∩ Bᶜ)", "A ∩ (A ∩ Bᶜ)ᶜ"],
      ],
      [["A ∖ B", "B ∩ Aᶜ"]],
    ],
    ["simetrica", [["A Δ B", "(A ∖ B) ∪ (B ∖ A)"], ["(A ∖ B) ∪ (B ∖ A)", "A Δ B"]], [["A Δ B", "A ∪ B"]]],
  ];
  for (const [law, yes, no] of cases) {
    it(law, () => {
      for (const [a, b] of yes) expect(just(a, b, law), `${a} ⇒ ${b}`).toBe(true);
      for (const [a, b] of no) expect(just(a, b, law), `${a} ⇏ ${b}`).toBe(false);
    });
  }

  it("todas las leyes tienen su caso", () => {
    expect(new Set(cases.map(([id]) => id))).toEqual(new Set(SET_LAWS.map((l) => l.id)));
  });
});

describe("checkSetStep", () => {
  it("rechaza un paso que no es igual y da una región donde difieren", () => {
    const r = checkSetStep(p("A ∖ B"), p("A"), "diferencia");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.region.label).toBe("A ∩ B");
      expect(r.region.before).toBe(false);
      expect(r.region.after).toBe(true);
    }
  });

  it("acepta un paso igual con otra ley, con sugerencias", () => {
    const r = checkSetStep(p("(A ∪ B)ᶜ"), p("Aᶜ ∩ Bᶜ"), "distributiva");
    expect(r).toEqual({ ok: true, lawMatches: false, suggestions: ["demorgan"] });
    expect(setLawsJustifying(p("A ∖ B"), p("A ∩ Bᶜ"))).toEqual(["diferencia"]);
  });

  it("una demostración completa: (A ∖ B) ∪ (A ∩ B) = A", () => {
    const chain: Array<[string, SetLawId]> = [
      ["(A ∩ Bᶜ) ∪ (A ∩ B)", "diferencia"],
      ["A ∩ (Bᶜ ∪ B)", "distributiva"],
      ["A ∩ U", "complemento"],
      ["A", "identidad"],
    ];
    let prev = p("(A ∖ B) ∪ (A ∩ B)");
    for (const [s, law] of chain) {
      const r = checkSetStep(prev, p(s), law);
      expect(r, s).toEqual({ ok: true, lawMatches: true, suggestions: [] });
      prev = p(s);
    }
  });

  it("setApplicableLaws no aplica nada, solo dice qué leyes tienen instancia", () => {
    expect(setApplicableLaws(p("A ∖ B"))).toEqual(["diferencia"]);
    expect(setApplicableLaws(p("A ∪ Aᶜ"))).toContain("complemento");
    expect(setApplicableLaws(p("A"))).toEqual([]);
  });
});
