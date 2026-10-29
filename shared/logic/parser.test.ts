import { describe, expect, it } from "vitest";
import { toPlain, collectVars, toTex } from "./ast.ts";
import { MAX_FORMULA_LENGTH, parseFormula } from "./parser.ts";

const plain = (s: string) => {
  const r = parseFormula(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return toPlain(r.ast);
};
const err = (s: string) => {
  const r = parseFormula(s);
  if (r.ok) throw new Error(`${s} should fail`);
  return r.error;
};

describe("aliases", () => {
  const groups: Array<[string, string[]]> = [
    ["¬p", ["¬p", "∼p", "~p", "!p", "p'", "p’", "p‘", "p′", "p/", "not p", "NOT p"]],
    ["p ∧ q", ["p∧q", "p·q", "p*q", "p&q", "p&&q", "p⊙q", "p and q", "p⋅q", "p∙q"]],
    ["p ∨ q", ["p∨q", "p+q", "p|q", "p||q", "p or q"]],
    ["p ⊻ q", ["p⊻q", "p⊕q", "p^q", "p xor q"]],
    ["p → q", ["p→q", "p⇒q", "p->q", "p=>q", "p⟶q", "p⊃q"]],
    ["p ↔ q", ["p↔q", "p⇔q", "p<->q", "p<=>q", "p≡q", "p⟷q"]],
  ];
  for (const [canon, forms] of groups) {
    it(`all forms of ${canon}`, () => {
      for (const f of forms) expect(plain(f)).toBe(canon);
    });
  }
  it("flags ⊕ only", () => {
    const flag = (s: string) => {
      const r = parseFormula(s);
      return r.ok && r.usedOplus;
    };
    expect(flag("p⊕q")).toBe(true);
    for (const s of ["p⊻q", "p^q", "p xor q"]) expect(flag(s)).toBe(false);
  });
  it("brackets and constants and exotic spaces", () => {
    expect(plain("[p ∨ q] ∧ r")).toBe(plain("(p ∨ q) ∧ r"));
    expect(plain("0 ∨ 1")).toBe("0 ∨ 1");
    expect(plain("⊤ ∧ ⊥")).toBe("1 ∧ 0");
    expect(plain("p ∧ q")).toBe("p ∧ q");
  });
  it("V F v y T are variables", () => {
    const r = parseFormula("V ∧ F");
    expect(r.ok && collectVars(r.ast)).toEqual(["F", "V"]);
    expect(err("p v q").code).toBe("missing-operator");
    expect(plain("y ∧ T")).toBe("y ∧ T");
  });
});

describe("precedence", () => {
  it.each([
    ["¬p ∧ q", "¬p ∧ q"],
    ["p ∨ q ∧ r", "p ∨ (q ∧ r)"],
    ["p ⊻ q ∨ r", "p ⊻ (q ∨ r)"],
    ["p → q → r", "p → q → r"],
    ["p ↔ q → r", "p ↔ (q → r)"],
    ["¬p'", "¬¬p"],
    ["(p ∧ q)'", "¬(p ∧ q)"],
    ["p ∧ q'", "p ∧ ¬q"],
    ["p''", "¬¬p"],
  ])("%s", (src, out) => {
    expect(plain(src)).toBe(out);
  });
  it("structure, not only printing", () => {
    const r = parseFormula("p ∨ q ∧ r");
    expect(r.ok && r.ast).toMatchObject({ kind: "or", right: { kind: "and" } });
    const i = parseFormula("p → q → r");
    expect(i.ok && i.ast).toMatchObject({ kind: "imp", right: { kind: "imp" } });
    const a = parseFormula("p ∧ q ∧ r");
    expect(a.ok && a.ast).toMatchObject({ kind: "and", left: { kind: "and" } });
  });
});

describe("errors", () => {
  it("trailing operator", () => {
    const e = err("p ∧");
    expect(e).toMatchObject({ code: "missing-operand", start: 2, end: 3 });
    expect(e.message).toContain("posición 3");
    expect(e.message).toContain("se esperaba una variable o una negación después de «∧»");
  });
  it("unclosed", () => {
    const e = err("(p ∨ q");
    expect(e).toMatchObject({ code: "unclosed-paren", start: 0, end: 1 });
    expect(e.message).toContain("falta cerrar un paréntesis");
  });
  it("unmatched close", () => {
    const e = err("p ∨ q)");
    expect(e).toMatchObject({ code: "unmatched-close", start: 5, end: 6 });
    expect(e.message).toContain("sobra un paréntesis de cierre");
  });
  it("mismatched", () => {
    expect(err("(p ∨ q]").code).toBe("mismatched-paren");
  });
  it("missing operator", () => {
    const e = err("p q");
    expect(e.code).toBe("missing-operator");
    expect(e.message).toContain("falta un operador entre «p» y «q»");
  });
  it("double operator and leading operator", () => {
    expect(err("p ∨ ∨ q")).toMatchObject({ code: "missing-operand", start: 4, end: 5 });
    expect(err("∧ p").message).toContain("falta un operando antes de «∧»");
  });
  it("unexpected char", () => {
    const e = err("p # q");
    expect(e).toMatchObject({ code: "unexpected-char", start: 2, end: 3 });
    expect(e.message).toContain("símbolo no reconocido «#»");
  });
  it("empty", () => {
    expect(err("").code).toBe("empty");
    expect(err("   ").code).toBe("empty");
  });
  it("arrow without right side", () => {
    expect(err("p ->").code).toBe("missing-operand");
  });
  it("too long", () => {
    expect(err("p".repeat(MAX_FORMULA_LENGTH + 1)).code).toBe("too-long");
  });
  it("positions after multi-char aliases", () => {
    expect(err("p <-> #")).toMatchObject({ code: "unexpected-char", start: 6, end: 7 });
  });
  it("accepts deep nesting at the limit", () => {
    expect(parseFormula("(".repeat(200) + "p" + ")".repeat(200)).ok).toBe(true);
  });
});

describe("toTex", () => {
  it("minimal parentheses and subscripts", () => {
    const r = parseFormula("¬(p ∧ q) ∨ x1");
    expect(r.ok && toTex(r.ast)).toBe("\\lnot (p \\land q) \\lor x_{1}");
  });
  it("only whitelisted characters", () => {
    const r = parseFormula("(p ⊻ ab_c) → (q ↔ x10) ∧ 1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(toTex(r.ast)).toMatch(/^[A-Za-z0-9_{}\\() ]+$/);
  });
});
