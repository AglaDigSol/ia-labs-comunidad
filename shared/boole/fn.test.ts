import { describe, expect, it } from "vitest";
import { NOTATION } from "../../content/notation/index.ts";
import { checkAllAxioms, isBooleanAlgebra } from "./algebra.ts";
import { booleToPlain, parseBoole } from "./expr.ts";
import {
  enumerateFn,
  F2_NAMES,
  fnAnd,
  fnComp,
  fnCount,
  fnExpression,
  fnFromExpr,
  fnMatches,
  fnName,
  fnOr,
  fnStructure,
  listFn,
} from "./fn.ts";
import { hasse } from "./algebra.ts";
import { presetStructure } from "./presets.ts";

const p = (s: string) => {
  const r = parseBoole(s, { xor: true });
  if (!r.ok) throw new Error(r.error.message);
  return r.expr;
};

describe("Fₙ", () => {
  it("F₁ tiene 4 funciones y F₂ tiene 16, todas distintas", () => {
    expect(fnCount(1)).toBe(4);
    expect(fnCount(2)).toBe(16);
    expect(enumerateFn(1)).toEqual(["00", "01", "10", "11"]);
    expect(new Set(enumerateFn(2)).size).toBe(16);
    expect(enumerateFn(2)[0]).toBe("0000");
    expect(enumerateFn(2)[15]).toBe("1111");
  });

  it("⊕, ⊙ y ′ punto a punto son cerradas en F₁ y en F₂", () => {
    for (const n of [1, 2] as const) {
      const all = new Set(enumerateFn(n));
      for (const a of all) {
        expect(all.has(fnComp(a))).toBe(true);
        for (const b of all) {
          expect(all.has(fnOr(a, b))).toBe(true);
          expect(all.has(fnAnd(a, b))).toBe(true);
        }
      }
    }
    expect(fnOr("0011", "0101")).toBe("0111");
    expect(fnAnd("0011", "0101")).toBe("0001");
    expect(fnComp("0110")).toBe("1001");
  });

  it("el preset F₂ del verificador cumple B1–B5, tiene 16 elementos y un Hasse de 5 niveles", () => {
    const s = presetStructure("f2");
    expect(s.elements).toHaveLength(16);
    expect(checkAllAxioms(s).every((r) => r.holds)).toBe(true);
    expect(s.elements[s.zero]).toBe("0000");
    expect(s.elements[s.one]).toBe("1111");
    const h = hasse(s)!;
    expect(Math.max(...h.rank)).toBe(4);
    expect(h.covers).toHaveLength(32);
    expect(isBooleanAlgebra(fnStructure(1))).toBe(true);
  });

  it("F₁ usa los nombres de content/notation", () => {
    const s = fnStructure(1);
    expect(s.elements).toEqual(NOTATION.f1.map((e) => e.name));
    for (const e of NOTATION.f1) expect(fnName(e.values.join(""))).toBe(e.name);
    // Con la notación de 02MIAR: Id, f, g, h.
    expect(fnName("01")).toBe("Id");
    expect(s.elements[s.zero]).toBe("f");
    expect(s.elements[s.one]).toBe("g");
  });

  it("nombres habituales de F₂", () => {
    expect(Object.keys(F2_NAMES)).toHaveLength(16);
    expect(new Set(Object.values(F2_NAMES)).size).toBe(16);
    expect(fnName("0111")).toMatch(/^OR/);
    expect(fnName("0001")).toMatch(/^AND/);
    expect(fnName("0110")).toMatch(/^XOR/);
    expect(fnName("1001")).toMatch(/^XNOR/);
    expect(fnName("1110")).toBe("NAND");
    expect(fnName("1000")).toBe("NOR");
    expect(fnName("1101")).toBe("Implicación x → y");
    expect(fnName("0010")).toBe("Negación de la implicación x → y");
    expect(fnName("012")).toBeNull();
  });

  it("cada función tiene una expresión mínima que la calcula", () => {
    for (const e of listFn(2)) {
      expect(fnFromExpr(e.expr, 2)).toBe(e.vector);
      expect(fnMatches(e.expr, e.vector)).toBe(true);
    }
    expect(booleToPlain(fnExpression("0001"))).toBe("x ⊙ y");
    expect(booleToPlain(fnExpression("0111"))).toBe("x ⊕ y");
    expect(booleToPlain(fnExpression("1100"))).toBe("x′");
    expect(booleToPlain(fnExpression("0000"))).toBe("0");
    expect(booleToPlain(fnExpression("10"))).toBe("x′");
  });

  it("fnFromExpr y fnMatches aceptan cualquier expresión equivalente y rechazan otras variables", () => {
    expect(fnFromExpr(p("x ⊻ y"), 2)).toBe("0110");
    expect(fnMatches(p("(x ⊙ y)′ ⊙ (x ⊕ y)"), "0110")).toBe(true);
    expect(fnMatches(p("x ⊕ y"), "0110")).toBe(false);
    expect(fnFromExpr(p("x ⊙ z"), 2)).toBeNull();
    expect(fnMatches(p("x ⊕ z ⊙ z′"), "0011")).toBe(false);
  });
});
