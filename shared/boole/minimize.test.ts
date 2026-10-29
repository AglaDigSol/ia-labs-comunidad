import { describe, expect, it } from "vitest";
import { booleToPlain, parseBoole, type BExpr } from "./expr.ts";
import { implicantProduct, implicantSum, minimalPOS, minimalSOP, minimizeBoole, primeImplicants } from "./minimize.ts";
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

describe("indiferencias (X)", () => {
  const V = ["w", "x", "y", "z"];

  it("las X agrandan los grupos sin tener que cubrirlas", () => {
    // Sin X: Σm(1,3,7,11,15) = w′x′z + yz (5 literales). Con d(0,2,5): w′z + yz (4).
    expect(minimalSOP(V, [1, 3, 7, 11, 15]).literals).toBe(5);
    const sop = minimalSOP(V, [1, 3, 7, 11, 15], [0, 2, 5]);
    expect(booleToPlain(sop.expr)).toBe("w′ ⊙ z ⊕ y ⊙ z");
    expect(sop.literals).toBe(4);
    expect(sop.terms).toBe(2);
  });

  it("una X que no ayuda se queda fuera", () => {
    const sop = minimalSOP(["x", "y", "z"], [7], [0]);
    expect(booleToPlain(sop.expr)).toBe("x ⊙ y ⊙ z");
  });

  it("si los 1 y las X llenan el mapa, la función puede ser 1; sin ningún 1, es 0", () => {
    expect(booleToPlain(minimalSOP(["x", "y"], [0, 1, 2], [3]).expr)).toBe("1");
    expect(booleToPlain(minimalSOP(["x", "y"], [], [3]).expr)).toBe("0");
    expect(booleToPlain(minimalPOS(["x", "y"], [], [3]).expr)).toBe("0");
    expect(booleToPlain(minimalPOS(["x", "y"], [3], [0, 1, 2]).expr)).toBe("1");
  });

  it("producto de sumas con indiferencias", () => {
    // Ceros en 0 y 4, X en 2 y 6: el factor es z (los cuatro tienen z = 0).
    const pos = minimalPOS(["x", "y", "z"], [1, 3, 5, 7], [2, 6]);
    expect(booleToPlain(pos.expr)).toBe("z");
    expect(pos.literals).toBe(1);
  });

  it("un mintérmino que también aparece como X cuenta como 1", () => {
    expect(minimalSOP(["x", "y"], [3], [3]).literals).toBe(2);
  });

  it("producto y suma de un implicante", () => {
    expect(booleToPlain(implicantProduct(["x", "y", "z"], { care: 0b101, value: 0b100 }))).toBe("x ⊙ z′");
    expect(booleToPlain(implicantSum(["x", "y", "z"], { care: 0b101, value: 0b100 }))).toBe("x′ ⊕ z");
    expect(booleToPlain(implicantProduct(["x", "y"], { care: 0, value: 0 }))).toBe("1");
    expect(booleToPlain(implicantSum(["x", "y"], { care: 0, value: 0 }))).toBe("0");
  });
});
