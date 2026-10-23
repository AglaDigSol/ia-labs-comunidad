import { describe, expect, it } from "vitest";
import { parseFormula } from "./parser.ts";
import { compareFormulas } from "./compare.ts";

const ast = (s: string) => {
  const p = parseFormula(s);
  if (!p.ok) throw new Error("parse " + s);
  return p.ast;
};

describe("compareFormulas", () => {
  it("contrapositive is equivalent", () => {
    const r = compareFormulas(ast("p → q"), ast("¬q → ¬p"));
    expect(r.ok && r.equivalent && r.differing === 0).toBe(true);
  });
  it("converse differs in 2 rows", () => {
    const r = compareFormulas(ast("p → q"), ast("q → p"));
    if (!r.ok) throw new Error();
    expect(r.equivalent).toBe(false);
    expect(r.differing).toBe(2);
    const diff = r.rows.filter((x) => !x.equal).map((x) => x.values);
    expect(diff).toContainEqual([true, false]);
    expect(diff).toContainEqual([false, true]);
  });
  it("inverse differs in 2 rows", () => {
    const r = compareFormulas(ast("p → q"), ast("¬p → ¬q"));
    expect(r.ok && r.differing).toBe(2);
  });
  it("union of variables", () => {
    const r = compareFormulas(ast("p ∨ (q ∧ ¬q)"), ast("p"));
    if (!r.ok) throw new Error();
    expect(r.equivalent).toBe(true);
    expect(r.vars).toEqual(["p", "q"]);
    expect(r.onlyA).toEqual(["q"]);
  });
  it("too many variables", () => {
    const r = compareFormulas(ast("a ∧ b ∧ c ∧ d"), ast("e ∧ f ∧ g"));
    expect(r.ok).toBe(false);
  });
});
