import { describe, expect, it } from "vitest";
import { compareFormulas } from "../logic/compare.ts";
import {
  booleVector,
  canonicalProduct,
  canonicalShape,
  canonicalSum,
  compareIndexList,
  indexListText,
  isBooleVector,
  maxtermSum,
  mintermProduct,
  readIndexList,
  rowBits,
  vectorDontCares,
  vectorFromLists,
  vectorOnes,
  vectorZeros,
} from "./canonical.ts";
import { booleToPlain, booleVars, parseBoole, toLogicNode, type BExpr } from "./expr.ts";

const p = (s: string): BExpr => {
  const r = parseBoole(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};
const equivalent = (a: BExpr, b: BExpr) => {
  const c = compareFormulas(toLogicNode(a), toLogicNode(b));
  return c.ok && c.equivalent;
};
const XYZ = ["x", "y", "z"];

describe("vectores y listas de índices", () => {
  it("vector de verdad de una expresión: la primera variable es el bit alto", () => {
    // x ⊙ y′ ⊕ z vale 1 en 001, 011, 100, 101, 111.
    const v = booleVector(p("x ⊙ y′ ⊕ z"), XYZ);
    expect(v).toBe("01011101");
    expect(vectorOnes(v)).toEqual([1, 3, 4, 5, 7]);
    expect(vectorZeros(v)).toEqual([0, 2, 6]);
    expect(rowBits(3, 6)).toBe("110");
  });

  it("indiferencias", () => {
    const v = vectorFromLists(3, [1, 3], [5, 7]);
    expect(v).toBe("01010X0X");
    expect(isBooleVector(v, 3)).toBe(true);
    expect(isBooleVector(v, 2)).toBe(false);
    expect(isBooleVector("01x0", 2)).toBe(false);
    expect(vectorDontCares(v)).toEqual([5, 7]);
    expect(vectorZeros(v)).toEqual([0, 2, 4, 6]);
  });

  it("texto de las listas", () => {
    expect(indexListText("sop", [5, 1, 3])).toBe("Σm(1, 3, 5)");
    expect(indexListText("pos", [0, 2])).toBe("ΠM(0, 2)");
    expect(indexListText("sop", [1, 3], [5])).toBe("Σm(1, 3) + d(5)");
    expect(indexListText("pos", [0], [5])).toBe("ΠM(0) · d(5)");
    expect(indexListText("sop", [])).toBe("Σm()");
  });
});

describe("formas canónicas", () => {
  it("mintérminos y maxtérminos: m₅ = x ⊙ y′ ⊙ z y M₅ = x′ ⊕ y ⊕ z′", () => {
    expect(booleToPlain(mintermProduct(XYZ, 5))).toBe("x ⊙ y′ ⊙ z");
    expect(booleToPlain(maxtermSum(XYZ, 5))).toBe("x′ ⊕ y ⊕ z′");
    expect(booleToPlain(mintermProduct(XYZ, 0))).toBe("x′ ⊙ y′ ⊙ z′");
    expect(booleToPlain(maxtermSum(XYZ, 7))).toBe("x′ ⊕ y′ ⊕ z′");
  });

  it("suma de mintérminos y producto de maxtérminos, en orden de índice", () => {
    expect(booleToPlain(canonicalSum(XYZ, [5, 1]))).toBe("x′ ⊙ y′ ⊙ z ⊕ x ⊙ y′ ⊙ z");
    expect(booleToPlain(canonicalProduct(["x", "y"], [2, 0]))).toBe("(x ⊕ y) ⊙ (x′ ⊕ y)");
    expect(booleToPlain(canonicalSum(XYZ, []))).toBe("0");
    expect(booleToPlain(canonicalProduct(XYZ, []))).toBe("1");
  });

  it("las dos formas canónicas son equivalentes a la expresión (ida y vuelta por el analizador)", () => {
    for (const s of ["x ⊙ y′ ⊕ z", "(x ⊕ y)′ ⊕ x ⊙ z", "x ⊕ x′", "w ⊙ x ⊕ y′ ⊙ z", "x ⊙ x′"]) {
      const e = p(s);
      const vars = booleVars(e);
      const v = booleVector(e, vars);
      const sop = canonicalSum(vars, vectorOnes(v));
      const pos = canonicalProduct(vars, vectorZeros(v));
      expect(equivalent(e, sop), s).toBe(true);
      expect(equivalent(e, pos), s).toBe(true);
      expect(equivalent(p(booleToPlain(sop)), sop), s).toBe(true);
      expect(equivalent(p(booleToPlain(pos)), pos), s).toBe(true);
    }
  });
});

describe("readIndexList", () => {
  it("acepta Σm(…), ΠM(…), espacios, punto y coma y m1 + m3", () => {
    for (const s of ["Σm(1, 3, 5)", "∑m(5,3,1)", "1 3 5", "m1 + m3 + m5", "{1; 3; 5}", "sum m(1,3,5)"]) {
      expect(readIndexList(s, 3), s).toEqual({ ok: true, indices: [1, 3, 5] });
    }
    expect(readIndexList("ΠM(0, 2)", 2)).toEqual({ ok: true, indices: [0, 2] });
    expect(readIndexList("∏ M (7)", 3)).toEqual({ ok: true, indices: [7] });
  });

  it("una lista vacía es válida", () => {
    expect(readIndexList("Σm()", 2)).toEqual({ ok: true, indices: [] });
    expect(readIndexList("  ", 2)).toEqual({ ok: true, indices: [] });
  });

  it("rechaza índices fuera de rango, repetidos o que no son números", () => {
    expect(readIndexList("1, 8", 3)).toEqual({ ok: false, message: "El 8 no existe: con 3 variables, los índices van de 0 a 7." });
    expect(readIndexList("1, 3, 1", 3)).toEqual({ ok: false, message: "El 1 aparece dos veces." });
    const bad = readIndexList("1, x, 3", 3);
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.message).toMatch(/^«x» no es un índice/);
    expect(readIndexList("Σm(1) + d(5)", 3).ok).toBe(false);
  });
});

describe("compareIndexList", () => {
  it("cuenta lo que falta sin decir qué es, y nombra lo que sobra", () => {
    expect(compareIndexList([1, 3, 5], [1, 3, 5])).toEqual({ ok: true, extra: [], dontCares: [], missing: 0 });
    expect(compareIndexList([1, 4], [1, 3, 5])).toEqual({ ok: false, extra: [4], dontCares: [], missing: 2 });
  });

  it("separa las indiferencias que se han colado en la lista", () => {
    expect(compareIndexList([1, 3, 6], [1, 3], [6, 7])).toEqual({ ok: false, extra: [], dontCares: [6], missing: 0 });
  });
});

describe("canonicalShape", () => {
  it("reconoce una suma de mintérminos y sus índices", () => {
    expect(canonicalShape(p("x′y′z + xy′z"), XYZ, "sop")).toEqual({ ok: true, indices: [1, 5] });
    expect(canonicalShape(p("x y z′"), XYZ, "sop")).toEqual({ ok: true, indices: [6] });
    expect(canonicalShape(p("0"), XYZ, "sop")).toEqual({ ok: true, indices: [] });
  });

  it("reconoce un producto de maxtérminos y sus índices", () => {
    expect(canonicalShape(p("(x + y + z′)(x′ + y + z)"), XYZ, "pos")).toEqual({ ok: true, indices: [1, 4] });
    expect(canonicalShape(p("x′ + y′ + z′"), XYZ, "pos")).toEqual({ ok: true, indices: [7] });
    expect(canonicalShape(p("1"), XYZ, "pos")).toEqual({ ok: true, indices: [] });
  });

  it("explica por qué no es canónica", () => {
    expect(canonicalShape(p("x′z + xy′z"), XYZ, "sop")).toEqual({ ok: false, reason: "incomplete-term" });
    expect(canonicalShape(p("x x′ y z"), XYZ, "sop")).toEqual({ ok: false, reason: "incomplete-term" });
    expect(canonicalShape(p("x y z + x y z"), XYZ, "sop")).toEqual({ ok: false, reason: "repeated-term" });
    expect(canonicalShape(p("x (y + z) + x y z"), XYZ, "sop")).toEqual({ ok: false, reason: "not-two-level" });
    expect(canonicalShape(p("(x y z)′"), XYZ, "sop")).toEqual({ ok: false, reason: "not-two-level" });
    expect(canonicalShape(p("x y z + w"), XYZ, "sop")).toEqual({ ok: false, reason: "incomplete-term" });
    // Una suma de mintérminos no es un producto de maxtérminos.
    expect(canonicalShape(p("x y z + x′ y z"), XYZ, "pos")).toEqual({ ok: false, reason: "not-two-level" });
  });

  it("la forma canónica que genera la app se reconoce con sus índices", () => {
    const sop = p(booleToPlain(canonicalSum(XYZ, [0, 3, 6])));
    expect(canonicalShape(sop, XYZ, "sop")).toEqual({ ok: true, indices: [0, 3, 6] });
    const pos = p(booleToPlain(canonicalProduct(XYZ, [2, 5])));
    expect(canonicalShape(pos, XYZ, "pos")).toEqual({ ok: true, indices: [2, 5] });
  });
});
