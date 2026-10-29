import { describe, expect, it } from "vitest";
import { subformulas, toPlain, type Node } from "./ast.ts";
import { parseFormula } from "./parser.ts";
import { buildTable, classify, evaluate, MAX_VARIABLES } from "./truth-table.ts";

const ast = (s: string): Node => {
  const r = parseFormula(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.ast;
};
const table = (s: string, opts?: Parameters<typeof buildTable>[1]) => {
  const t = buildTable(ast(s), opts);
  if (!t.ok) throw new Error(t.code);
  return t;
};
const bits = (vals: boolean[]) => vals.map((v) => (v ? 1 : 0)).join("");

describe("buildTable", () => {
  it("(p ∧ q) → r golden fixture", () => {
    const t = table("(p ∧ q) → r");
    expect(t.vars).toEqual(["p", "q", "r"]);
    expect(t.rows).toHaveLength(8);
    expect(bits(t.rows[0]!.values)).toBe("111");
    expect(bits(t.rows[1]!.values)).toBe("110");
    expect(bits(t.rows[7]!.values)).toBe("000");
    expect(t.rows.map((r) => (r.result ? 1 : 0))).toEqual([1, 0, 1, 1, 1, 1, 1, 1]);
    expect(t.rows.filter((r) => !r.result).map((r) => r.minterm)).toEqual([6]);
    expect(classify(t.rows)).toEqual({ kind: "contingencia", trueCount: 7, total: 8 });
  });
  it("two variables in 11, 10, 01, 00 order", () => {
    expect(table("p ∧ q").rows.map((r) => bits(r.values))).toEqual(["11", "10", "01", "00"]);
  });
  it("implication vs converse vs contrapositive", () => {
    const vars = ["p", "q"];
    const imp = table("p → q", { vars });
    const conv = table("q → p", { vars });
    const contra = table("¬q → ¬p", { vars });
    const diff = imp.rows
      .filter((r, i) => r.result !== conv.rows[i]!.result)
      .map((r) => bits(r.values));
    expect(diff.sort()).toEqual(["01", "10"]);
    expect(imp.rows.map((r) => r.result)).toEqual(contra.rows.map((r) => r.result));
  });
  it("classification", () => {
    expect(classify(table("p ∨ ¬p").rows).kind).toBe("tautologia");
    expect(classify(table("p ∧ ¬p").rows).kind).toBe("contradiccion");
    const c = table("1 ∧ 0");
    expect(c.rows).toHaveLength(1);
    expect(classify(c.rows).kind).toBe("contradiccion");
  });
  it("minterm set is independent of display order", () => {
    const set = (o: "true-first" | "false-first") =>
      table("(p ∧ q) → r", { order: o })
        .rows.filter((r) => r.result)
        .map((r) => r.minterm)
        .sort((a, b) => a - b);
    expect(set("true-first")).toEqual(set("false-first"));
  });
  it("variable limit", () => {
    expect(MAX_VARIABLES).toBe(6);
    expect(buildTable(ast("a ∧ b ∧ c ∧ d ∧ e ∧ f ∧ g"))).toEqual({
      ok: false,
      code: "too-many-variables",
      count: 7,
    });
    expect(table("a ∧ b ∧ c ∧ d ∧ e ∧ f").rows).toHaveLength(64);
  });
  it("sub aligns with subformulas", () => {
    const t = table("(p ∧ q) → r");
    expect(t.subformulas.map(toPlain)).toEqual(["p ∧ q", "(p ∧ q) → r"]);
    expect(subformulas(ast("(p ∧ q) → r"))).toHaveLength(2);
    expect(t.rows[0]!.sub).toEqual([true, true]);
    expect(t.rows[1]!.sub).toEqual([true, false]);
    for (const r of t.rows) expect(r.sub.at(-1)).toBe(r.result);
  });
  it("evaluate agrees with the table", () => {
    const n = ast("p ⊻ q");
    expect(evaluate(n, { p: true, q: false })).toBe(true);
    expect(evaluate(n, { p: true, q: true })).toBe(false);
  });
});
