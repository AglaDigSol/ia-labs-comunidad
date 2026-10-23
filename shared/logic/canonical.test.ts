import { describe, expect, it } from "vitest";
import { parseFormula } from "./parser.ts";
import { buildTable } from "./truth-table.ts";
import { canonicalForms, formatFND, formatFNC } from "./canonical.ts";

function table(src: string, order?: "true-first" | "false-first") {
  const p = parseFormula(src);
  if (!p.ok) throw new Error("parse");
  const t = buildTable(p.ast, { order });
  if (!t.ok) throw new Error("table");
  return t;
}

describe("canonical forms", () => {
  it("(p ∧ q) → r", () => {
    const t = table("(p ∧ q) → r");
    const c = canonicalForms(t);
    expect(c.minterms).toEqual([0, 1, 2, 3, 4, 5, 7]);
    expect(c.maxterms).toEqual([6]);
    const fnc = formatFNC(t.vars, c.maxterms, "logica");
    expect(fnc.plain).toBe("(¬p ∨ ¬q ∨ r)");
    expect(fnc.compact).toContain("\\prod M(6)");
    const fnd = formatFND(t.vars, c.minterms, "logica");
    expect(fnd.compact).toContain("\\sum m(0,1,2,3,4,5,7)");
    expect(fnd.terms[3]).toMatchObject({ index: 3, bits: "011", plain: "¬p ∧ q ∧ r" });
  });
  it("Boole style", () => {
    expect(formatFND(["p", "q"], [3], "boole").plain).toBe("p·q");
    expect(formatFND(["p", "q"], [1], "boole").plain).toBe("p′·q");
    expect(formatFND(["p", "q"], [1], "boole").tex).toContain("\\overline{p}");
  });
  it("constants", () => {
    const taut = canonicalForms(table("p ∨ ¬p"));
    expect(taut).toEqual({ minterms: [0, 1], maxterms: [] });
    expect(formatFNC(["p"], [], "logica")).toMatchObject({ tex: "1", plain: "1" });
    expect(formatFND(["p"], [], "logica")).toMatchObject({ tex: "0", plain: "0" });
  });
  it("order invariance", () => {
    const a = canonicalForms(table("p → q", "true-first"));
    const b = canonicalForms(table("p → q", "false-first"));
    expect(a).toEqual(b);
  });
});
