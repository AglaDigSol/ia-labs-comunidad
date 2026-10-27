import { describe, expect, it } from "vitest";
import { booleToPlain, parseBoole, type BExpr } from "./expr.ts";
import { minimalSOP, minimizeBoole, primeImplicants } from "./minimize.ts";
import { compareFormulas } from "../logic/compare.ts";
import { toLogicNode } from "./expr.ts";

const p = (s: string): BExpr => {
  const r = parseBoole(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};
const equivalent = (a: BExpr, b: BExpr) => {
  const c = compareFormulas(toLogicNode(a), toLogicNode(b));
  return c.ok && c.equivalent;
};

describe("Quine–McCluskey", () => {
  it("x′y′z + x′yz + xyz → x′z + yz", () => {
    const e = p("x′y′z + x′yz + xyz");
    const m = minimizeBoole(e);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(booleToPlain(m.sop.expr)).toBe("x′ ⊙ z ⊕ y ⊙ z");
    expect(m.sop.literals).toBe(4);
    expect(m.sop.terms).toBe(2);
    expect(equivalent(e, m.sop.expr)).toBe(true);
    expect(equivalent(e, m.pos.expr)).toBe(true);
    // Producto de sumas: z(x′ + y), con 3 literales.
    expect(m.pos.literals).toBe(3);
    expect(m.minLiterals).toBe(3);
  });

  it("caso de 4 variables: Σm(0,1,2,5,8,9,10) = x′y′ + x′z′ + w′y′z", () => {
    const sop = minimalSOP(["w", "x", "y", "z"], [0, 1, 2, 5, 8, 9, 10]);
    expect(sop.literals).toBe(7);
    expect(sop.terms).toBe(3);
    expect(booleToPlain(sop.expr)).toBe("w′ ⊙ y′ ⊙ z ⊕ x′ ⊙ y′ ⊕ x′ ⊙ z′");
  });

  it("otro caso de 4 variables: Σm(0,1,2,5,6,7,8,9,10,14) = x′y′ + yz′ + w′xz", () => {
    const sop = minimalSOP(["w", "x", "y", "z"], [0, 1, 2, 5, 6, 7, 8, 9, 10, 14]);
    expect(sop.terms).toBe(3);
    expect(sop.literals).toBe(7);
    expect(booleToPlain(sop.expr)).toBe("w′ ⊙ x ⊙ z ⊕ x′ ⊙ y′ ⊕ y ⊙ z′");
  });

  it("núcleo cíclico de 3 variables: Σm(0,1,2,5,6,7) necesita 3 términos de 2 literales", () => {
    const sop = minimalSOP(["x", "y", "z"], [0, 1, 2, 5, 6, 7]);
    expect(sop.terms).toBe(3);
    expect(sop.literals).toBe(6);
  });

  it("implicantes primos de la función mayoría", () => {
    expect(primeImplicants(3, [3, 5, 6, 7])).toHaveLength(3);
  });

  it("constantes y una variable", () => {
    const t = minimizeBoole(p("x + x′"));
    expect(t.ok && booleToPlain(t.sop.expr)).toBe("1");
    const f = minimizeBoole(p("x x′"));
    expect(f.ok && booleToPlain(f.sop.expr)).toBe("0");
    const v = minimizeBoole(p("x + xy"));
    expect(v.ok && booleToPlain(v.sop.expr)).toBe("x");
  });

  it("forma factorizada mejor que la suma de productos", () => {
    const m = minimizeBoole(p("xyz + xy′z + xyz′ + wx"));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.sop.literals).toBe(6); // wx + xy + xz
    expect(m.pos.literals).toBe(4); // x(w + y + z)
    expect(m.minLiterals).toBe(4);
  });
});
