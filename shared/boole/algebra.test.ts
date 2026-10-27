import { describe, expect, it } from "vitest";
import {
  checkAllAxioms,
  checkAxiom,
  checkPartialOrder,
  counterexampleFor,
  cube,
  customStructure,
  defaultCustomTables,
  divisors,
  hasse,
  isBooleanAlgebra,
  leq,
  MAX_ELEMENTS,
  powerSet,
  product,
  twoElement,
  validateStructure,
  type FiniteStructure,
} from "./algebra.ts";

const el = (s: FiniteStructure, label: string) => {
  const i = s.elements.indexOf(label);
  if (i < 0) throw new Error(`${label} no está en ${s.name}`);
  return i;
};

describe("estructuras estándar que son álgebras de Boole", () => {
  it.each([
    ["{0,1}", twoElement()],
    ["P({1,2,3})", powerSet(["1", "2", "3"])],
    ["P(∅)… no: P({a})", powerSet(["a"])],
    ["{0,1}³", cube(3)],
    ["{0,1}²", cube(2)],
    ["D₃₀", divisors(30)],
    ["D₆", divisors(6)],
  ])("%s cumple B1–B5", (_name, s) => {
    expect(validateStructure(s)).toBeNull();
    const results = checkAllAxioms(s);
    expect(results.map((r) => r.holds)).toEqual([true, true, true, true, true]);
    expect(results.every((r) => r.counterexample === null)).toBe(true);
    expect(isBooleanAlgebra(s)).toBe(true);
  });

  it("D₃₀: 0 es 1, 1 es 30 y el complemento de 5 es 6", () => {
    const d = divisors(30);
    expect(d.elements).toEqual(["1", "2", "3", "5", "6", "10", "15", "30"]);
    expect(d.elements[d.zero]).toBe("1");
    expect(d.elements[d.one]).toBe("30");
    expect(d.elements[d.comp[el(d, "5")]!]).toBe("6");
  });

  it("el producto de dos álgebras de Boole es de Boole", () => {
    const p = product(twoElement(), divisors(30));
    expect(p.elements).toHaveLength(16);
    expect(isBooleanAlgebra(p)).toBe(true);
    expect(isBooleanAlgebra(product(powerSet(["a"]), cube(2)))).toBe(true);
  });

  it("el producto respeta el límite de elementos", () => {
    expect(() => product(cube(3), cube(2))).toThrow();
    expect(MAX_ELEMENTS).toBe(16);
  });
});

describe("estructuras que no lo son", () => {
  it("D₁₂ falla B5 y el primer contraejemplo es a = 2", () => {
    const d = divisors(12);
    const r = checkAllAxioms(d);
    expect(r.map((x) => [x.axiom, x.holds])).toEqual([
      ["B1", true],
      ["B2", true],
      ["B3", true],
      ["B4", true],
      ["B5", false],
    ]);
    const ce = r[4]!.counterexample!;
    expect(ce.identity).toBe("B5+");
    expect(d.elements[ce.a]).toBe("2");
    // 2 ⊕ 2′ = mcm(2, 6) = 6 ≠ 12
    expect(d.elements[ce.lhs]).toBe("6");
    expect(d.elements[ce.rhs]).toBe("12");
  });

  it("D₁₂: a = 2 y a = 6 son contraejemplos de B5; a = 4 no", () => {
    const d = divisors(12);
    expect(counterexampleFor(d, "B5", el(d, "2"))).not.toBeNull();
    expect(counterexampleFor(d, "B5", el(d, "6"))).not.toBeNull();
    expect(counterexampleFor(d, "B5", el(d, "4"))).toBeNull();
    expect(counterexampleFor(d, "B5", el(d, "1"))).toBeNull();
  });

  it("una tabla personalizada que rompe B1 se detecta", () => {
    const t = defaultCustomTables(4);
    const plus = t.plus.map((row) => row.slice());
    plus[1]![2] = 1; // a ⊕ b = a, pero b ⊕ a = 1
    const s = customStructure({ ...t, plus });
    const b1 = checkAxiom(s, "B1");
    expect(b1.holds).toBe(false);
    expect(b1.counterexample?.identity).toBe("B1+");
    expect(counterexampleFor(s, "B1", 1, 2)).not.toBeNull();
    expect(counterexampleFor(s, "B1", 0, 3)).toBeNull();
    expect(isBooleanAlgebra(s)).toBe(false);
  });

  it("la tabla personalizada de partida (4 elementos) es de Boole", () => {
    expect(isBooleanAlgebra(customStructure(defaultCustomTables(4)))).toBe(true);
    expect(isBooleanAlgebra(customStructure(defaultCustomTables(2)))).toBe(true);
    // Cadena de 3 elementos: a no tiene complemento.
    expect(checkAxiom(customStructure(defaultCustomTables(3)), "B5").holds).toBe(false);
  });

  it("si 0 y 1 coinciden, B3 falla con cualquier elección", () => {
    const s: FiniteStructure = { ...twoElement(), one: 0 };
    const r = checkAxiom(s, "B3");
    expect(r.holds).toBe(false);
    expect(r.counterexample?.identity).toBe("B3≠");
    expect(counterexampleFor(s, "B3", 1)).not.toBeNull();
  });

  it("valida tablas mal formadas", () => {
    expect(validateStructure({ ...twoElement(), comp: [1, 5] })).toMatch(/fila de ′/);
    expect(validateStructure({ ...twoElement(), plus: [[0, 1]] })).toMatch(/tablas/);
  });
});

describe("orden y diagrama de Hasse", () => {
  it("a ≤ b ⇔ a ⊕ b = b en P({a,b})", () => {
    const p = powerSet(["a", "b"]);
    expect(p.elements).toEqual(["∅", "{a}", "{b}", "{a,b}"]);
    expect(leq(p, el(p, "{a}"), el(p, "{a,b}"))).toBe(true);
    expect(leq(p, el(p, "{a}"), el(p, "{b}"))).toBe(false);
  });

  it("la relación de cobertura de P({a,b}) es correcta", () => {
    const p = powerSet(["a", "b"]);
    const h = hasse(p)!;
    const named = h.covers.map(([x, y]) => `${p.elements[x]}⋖${p.elements[y]}`).sort();
    expect(named).toEqual(["{a}⋖{a,b}", "{b}⋖{a,b}", "∅⋖{a}", "∅⋖{b}"].sort());
    expect(h.rank).toEqual([0, 1, 1, 2]);
  });

  it("D₃₀ es un cubo: 12 aristas y cuatro niveles", () => {
    const h = hasse(divisors(30))!;
    expect(h.covers).toHaveLength(12);
    expect(Math.max(...h.rank)).toBe(3);
  });

  it("con tablas que no dan un orden parcial no hay diagrama", () => {
    const t = defaultCustomTables(4);
    const plus = t.plus.map((row) => row.slice());
    plus[1]![2] = 2;
    plus[2]![1] = 1; // a ≤ b y b ≤ a con a ≠ b
    const s = customStructure({ ...t, plus });
    expect(checkPartialOrder(s)).toMatchObject({ ok: false, property: "antisimétrica" });
    expect(hasse(s)).toBeNull();
  });
});
