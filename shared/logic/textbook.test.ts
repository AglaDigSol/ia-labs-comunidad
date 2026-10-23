// Casos de libro del motor de lógica: tautologías y equivalencias clásicas, De Morgan.
import { describe, expect, it } from "vitest";
import { canonicalForms } from "./canonical.ts";
import { compareFormulas } from "./compare.ts";
import { parseFormula } from "./parser.ts";
import { buildTable, classify } from "./truth-table.ts";

const ast = (s: string) => {
  const p = parseFormula(s);
  if (!p.ok) throw new Error(`parse ${s}: ${p.error.message}`);
  return p.ast;
};
const kind = (s: string) => {
  const t = buildTable(ast(s));
  if (!t.ok) throw new Error("table");
  return classify(t.rows).kind;
};
const equivalent = (a: string, b: string) => {
  const r = compareFormulas(ast(a), ast(b));
  if (!r.ok) throw new Error("compare");
  return r.equivalent;
};

describe("tautologías clásicas", () => {
  it.each([
    ["p ∨ ¬p", "tercero excluido"],
    ["¬(p ∧ ¬p)", "no contradicción"],
    ["p → p", "identidad"],
    ["((p → q) ∧ p) → q", "modus ponens"],
    ["((p → q) ∧ ¬q) → ¬p", "modus tollens"],
    ["((p → q) ∧ (q → r)) → (p → r)", "silogismo hipotético"],
    ["((p ∨ q) ∧ ¬p) → q", "silogismo disyuntivo"],
    ["p → (p ∨ q)", "adición"],
    ["(p ∧ q) → p", "simplificación"],
    ["((p → q) → p) → p", "ley de Peirce"],
  ])("%s es tautología (%s)", (f) => {
    expect(kind(f)).toBe("tautologia");
  });

  it("p ∧ ¬p es contradicción y p → q es contingencia", () => {
    expect(kind("p ∧ ¬p")).toBe("contradiccion");
    expect(kind("p → q")).toBe("contingencia");
  });
});

describe("equivalencias clásicas", () => {
  it.each([
    ["¬(p ∧ q)", "¬p ∨ ¬q", "De Morgan (conjunción)"],
    ["¬(p ∨ q)", "¬p ∧ ¬q", "De Morgan (disyunción)"],
    ["¬¬p", "p", "doble negación"],
    ["p → q", "¬p ∨ q", "implicación material"],
    ["p → q", "¬q → ¬p", "contrarrecíproco"],
    ["p ↔ q", "(p → q) ∧ (q → p)", "bicondicional"],
    ["p ∧ (q ∨ r)", "(p ∧ q) ∨ (p ∧ r)", "distributiva de ∧ sobre ∨"],
    ["p ∨ (q ∧ r)", "(p ∨ q) ∧ (p ∨ r)", "distributiva de ∨ sobre ∧"],
    ["p ∨ (p ∧ q)", "p", "absorción"],
    ["p ∧ (p ∨ q)", "p", "absorción dual"],
    ["p ⊻ q", "(p ∨ q) ∧ ¬(p ∧ q)", "disyunción exclusiva"],
    ["(p ∧ q) → r", "p → (q → r)", "exportación"],
  ])("%s ≡ %s (%s)", (a, b) => {
    expect(equivalent(a, b)).toBe(true);
  });

  it("el recíproco y el inverso no son equivalentes a la implicación", () => {
    expect(equivalent("p → q", "q → p")).toBe(false);
    expect(equivalent("p → q", "¬p → ¬q")).toBe(false);
  });

  it("De Morgan con tres variables", () => {
    expect(equivalent("¬(p ∧ q ∧ r)", "¬p ∨ ¬q ∨ ¬r")).toBe(true);
    expect(equivalent("¬(p ∨ q ∨ r)", "¬p ∧ ¬q ∧ ¬r")).toBe(true);
  });
});

describe("formas canónicas", () => {
  it("una tautología no tiene maxtérminos y una contradicción no tiene mintérminos", () => {
    const taut = buildTable(ast("p ∨ ¬p"));
    const contra = buildTable(ast("p ∧ ¬p"));
    if (!taut.ok || !contra.ok) throw new Error("table");
    expect(canonicalForms(taut).maxterms).toEqual([]);
    expect(canonicalForms(contra).minterms).toEqual([]);
  });
});
