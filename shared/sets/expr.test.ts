import { describe, expect, it } from "vitest";
import {
  compareSetExprs,
  elementRegion,
  evalSetFinite,
  inRegion,
  parseSetExpr,
  regionExpr,
  regionLabel,
  sameSetExpr,
  setRegions,
  setToPlain,
  setToTex,
  setVars,
  vennVars,
  type SetExpr,
} from "./expr.ts";

const p = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.expr;
};

describe("lectura", () => {
  it("acepta la notación de clase y sus variantes ASCII", () => {
    const same: Array<[string, string]> = [
      ["A ∪ B", "A | B"],
      ["A ∩ B", "A & B"],
      ["A ∖ B", "A \\ B"],
      ["A ∖ B", "A − B"],
      ["A ∖ B", "A - B"],
      ["A Δ B", "A △ B"],
      ["A Δ B", "A ^ B"],
      ["Aᶜ", "A′"],
      ["Aᶜ", "A'"],
      ["Aᶜ", "A^c"],
      ["Aᶜ", "Ā"],
      ["Aᶜ", "Ā"],
      ["∅", "{}"],
      ["(A ∪ B)ᶜ", "(A|B)'"],
    ];
    for (const [a, b] of same) expect(sameSetExpr(p(a), p(b)), `${a} = ${b}`).toBe(true);
  });

  it("^c es complemento y ^C es diferencia simétrica con C", () => {
    expect(setToPlain(p("A^c"))).toBe("Aᶜ");
    expect(setToPlain(p("A^C"))).toBe("A Δ C");
  });

  it("pide paréntesis entre operaciones distintas y con dos diferencias", () => {
    const r = parseSetExpr("A ∪ B ∩ C");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/Entre ∪ y ∩ hacen falta paréntesis/);
      expect(r.error.start).toBe(6);
    }
    const d = parseSetExpr("A ∖ B ∖ C");
    expect(!d.ok && d.error.message).toMatch(/dos diferencias/);
    expect(parseSetExpr("A ∪ B ∪ C").ok).toBe(true);
    expect(parseSetExpr("A Δ B Δ C").ok).toBe(true);
  });

  it("errores con posición: letra desconocida, paréntesis, operandos", () => {
    const cases: Array<[string, RegExp]> = [
      ["A ∪ D", /«D» no es un conjunto/],
      ["(A ∪ B", /Falta cerrar este paréntesis/],
      ["A ∪ B)", /Sobra este paréntesis/],
      ["A ∪", /Falta un conjunto al final/],
      ["ᶜA", /El complemento va detrás/],
      ["A B", /Falta una operación/],
      ["", /Escribe una expresión/],
      ["A ∪ 3", /No reconozco «3»/],
    ];
    for (const [s, re] of cases) {
      const r = parseSetExpr(s);
      expect(r.ok, s).toBe(false);
      if (!r.ok) expect(r.error.message, s).toMatch(re);
    }
  });
});

describe("escritura de libro", () => {
  it("toPlain y toTex con paréntesis entre operaciones binarias y complemento posfijo", () => {
    // Al leer se normaliza como en Boole: los conjuntos sueltos van delante.
    const e = p("((A ∪ B) ∩ C)ᶜ");
    expect(setToPlain(e)).toBe("(C ∩ (A ∪ B))ᶜ");
    expect(setToTex(e)).toBe("\\left(C \\cap \\left(A \\cup B\\right)\\right)^{c}");
    expect(setToPlain(p("A''"))).toBe("(Aᶜ)ᶜ");
    expect(setToTex(p("A''"))).toBe("\\left(A^{c}\\right)^{c}");
    expect(setToTex(p("(A ∖ ∅) Δ U"))).toBe("U \\mathbin{\\Delta} \\left(A \\setminus \\varnothing\\right)");
    expect(setToPlain(p("B ∪ A ∪ Aᶜ"))).toBe("A ∪ Aᶜ ∪ B");
  });

  it("lo que escribe se vuelve a leer igual", () => {
    const samples = [
      "A ∩ Bᶜ",
      "(A ∪ B)ᶜ",
      "A Δ B Δ C",
      "(A ∖ B) ∪ (B ∖ C) ∪ (C ∖ A)",
      "((A ∪ B) ∩ C)ᶜ",
      "A ∖ (B ∖ C)",
      "(Aᶜ)ᶜ ∪ ∅ ∪ U",
    ];
    for (const s of samples) {
      const e = p(s);
      expect(sameSetExpr(p(setToPlain(e)), e), s).toBe(true);
      expect(setToPlain(p(setToPlain(e))), s).toBe(setToPlain(e));
    }
  });

  it("conmutatividad y asociatividad dan la misma clave", () => {
    expect(sameSetExpr(p("(A ∪ B) ∪ C"), p("C ∪ (B ∪ A)"))).toBe(true);
    expect(sameSetExpr(p("A Δ B"), p("B Δ A"))).toBe(true);
    expect(sameSetExpr(p("A ∖ B"), p("B ∖ A"))).toBe(false);
  });
});

describe("regiones del diagrama de Venn", () => {
  it("2ⁿ regiones con sus nombres", () => {
    expect(regionLabel(["A", "B", "C"], 0b101)).toBe("A ∩ Bᶜ ∩ C");
    expect(regionLabel(["A", "B"], 0)).toBe("Aᶜ ∩ Bᶜ");
    expect(setToPlain(regionExpr(["A", "B", "C"], 0b011))).toBe("A ∩ B ∩ Cᶜ");
    expect(setRegions(p("A Δ B"), ["A", "B"])).toEqual([false, true, true, false]);
    expect(setRegions(p("A ∖ (B ∪ C)"), ["A", "B", "C"]).filter(Boolean)).toHaveLength(1);
    expect(inRegion(p("U"), ["A", "B"], 0)).toBe(true);
    expect(() => inRegion(p("C"), ["A", "B"], 0)).toThrow();
  });

  it("vennVars elige 2 o 3 conjuntos", () => {
    expect(vennVars(p("A ∪ B"))).toEqual(["A", "B"]);
    expect(vennVars(p("A"), p("C"))).toEqual(["A", "B", "C"]);
    expect(setVars(p("C ∪ A"))).toEqual(["A", "C"]);
  });

  it("igualdad por regiones y contraejemplo", () => {
    expect(compareSetExprs(p("(A ∪ B)ᶜ"), p("Aᶜ ∩ Bᶜ")).equal).toBe(true);
    expect(compareSetExprs(p("A ∖ (B ∩ C)"), p("(A ∖ B) ∪ (A ∖ C)")).equal).toBe(true);
    const c = compareSetExprs(p("A ∖ (B ∖ C)"), p("(A ∖ B) ∖ C"));
    expect(c.equal).toBe(false);
    // Difieren en A ∩ B ∩ C (en la izquierda sí, en la derecha no) y en A ∩ Bᶜ ∩ C.
    expect(c.differ.map((r) => regionLabel(c.vars, r))).toEqual(["A ∩ Bᶜ ∩ C", "A ∩ B ∩ C"]);
  });
});

describe("evaluación con elementos", () => {
  const data = {
    universe: ["1", "2", "3", "4", "5", "6"],
    sets: { A: ["1", "2", "3"], B: ["2", "4"], C: ["3", "4", "5"] },
  };
  it("resultado en el orden del universo", () => {
    expect(evalSetFinite(p("A ∪ B"), data)).toEqual(["1", "2", "3", "4"]);
    expect(evalSetFinite(p("(A ∪ B ∪ C)ᶜ"), data)).toEqual(["6"]);
    expect(evalSetFinite(p("A Δ C"), data)).toEqual(["1", "2", "4", "5"]);
    expect(evalSetFinite(p("A ∖ B"), data)).toEqual(["1", "3"]);
    expect(evalSetFinite(p("∅"), data)).toEqual([]);
  });
  it("región de cada elemento", () => {
    expect(elementRegion("3", ["A", "B", "C"], data)).toBe(0b101);
    expect(elementRegion("6", ["A", "B", "C"], data)).toBe(0);
  });
});
