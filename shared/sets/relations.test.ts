import { describe, expect, it } from "vitest";
import { parseSetExpr, regionLabel } from "./expr.ts";
import {
  analyzeHypotheses,
  checkRelation,
  forcesNonEmptyAB,
  nestedShape,
  parseSetHypotheses,
  parseSetRelation,
  relationHolds,
  relationReason,
  relationToPlain,
  relationToTex,
  worldHas,
  worldPlace,
  type SetRelation,
} from "./relations.ts";

const rel = (s: string): SetRelation[] => {
  const r = parseSetRelation(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.relations;
};
const hyps = (s: string): SetRelation[] => {
  const r = parseSetHypotheses(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.relations;
};
const errorOf = (s: string) => {
  const r = parseSetRelation(s);
  if (r.ok) throw new Error(`se leyó ${s}`);
  return r.error;
};

describe("parseSetRelation", () => {
  it("lee las relaciones con símbolos y con sus alternativas ASCII", () => {
    const cases: Array<[string, string]> = [
      ["A ⊆ B", "A ⊆ B"],
      ["A <= B", "A ⊆ B"],
      ["A subseteq B", "A ⊆ B"],
      ["A \\subseteq B", "A ⊆ B"],
      ["A ⊂ B", "A ⊊ B"],
      ["A ⊊ B", "A ⊊ B"],
      ["A < B", "A ⊊ B"],
      ["A subset B", "A ⊊ B"],
      ["A ⊇ B", "A ⊇ B"],
      ["A >= B", "A ⊇ B"],
      ["A ⊃ B", "A ⊋ B"],
      ["A > B", "A ⊋ B"],
      ["A = B", "A = B"],
      ["A == B", "A = B"],
      ["A ≠ B", "A ≠ B"],
      ["A != B", "A ≠ B"],
      ["A \\neq B", "A ≠ B"],
      ["A ⊈ B", "A ⊈ B"],
      ["A ⊄ B", "A ⊈ B"],
      ["A ∩ B = ∅", "A ∩ B = ∅"],
      ["(A ∪ B)ᶜ ⊆ Aᶜ", "(A ∪ B)ᶜ ⊆ Aᶜ"],
      ["A\\B<=A", "A ∖ B ⊆ A"],
    ];
    for (const [src, plain] of cases) {
      const r = rel(src);
      expect(r).toHaveLength(1);
      expect(relationToPlain(r[0]!)).toBe(plain);
      // Lo que se escribe se vuelve a leer igual.
      expect(relationToPlain(rel(plain)[0]!)).toBe(plain);
    }
  });

  it("lee cadenas: ∅ ≠ A ⊆ B son dos relaciones", () => {
    expect(rel("∅ ≠ A ⊆ B").map(relationToPlain)).toEqual(["∅ ≠ A", "A ⊆ B"]);
    expect(rel("A ⊆ B ⊆ C").map(relationToPlain)).toEqual(["A ⊆ B", "B ⊆ C"]);
  });

  it("TeX con órdenes fijas", () => {
    expect(relationToTex(rel("A ⊂ B")[0]!)).toBe("A \\subsetneq B");
    expect(relationToTex(rel("A ∩ B ≠ ∅")[0]!)).toBe("A \\cap B \\neq \\varnothing");
    expect(relationToTex(rel("A ⊈ Bᶜ")[0]!)).toBe("A \\nsubseteq B^{c}");
  });

  it("errores claros: un conjunto no es una relación, lados vacíos, paréntesis y errores de cada lado", () => {
    expect(errorOf("A ∩ B").message).toBe(
      "A ∩ B es un conjunto, no una relación: compara dos conjuntos con ⊆, ⊊, ⊇, ⊋, = o ≠, por ejemplo A ⊆ B o A ∩ B = ∅.",
    );
    expect(errorOf("").message).toBe("Escribe una relación, como A ⊆ B.");
    expect(errorOf("⊆ B")).toMatchObject({ code: "missing-operand", start: 0, end: 1, message: "Falta un conjunto a la izquierda de «⊆»." });
    expect(errorOf("A ⊆ ")).toMatchObject({ code: "missing-operand", message: "Falta un conjunto a la derecha de «⊆»." });
    expect(errorOf("(A ⊆ B)").message).toMatch(/no puede ir dentro de un paréntesis/);
    // El error del lado derecho, en su sitio de la entrada completa.
    const e = errorOf("A ⊆ B ∪ D");
    expect(e.message).toMatch(/«D» no es un conjunto/);
    expect([e.start, e.end]).toEqual([8, 9]);
  });

  it("parseSetExpr explica que una relación no es un conjunto (el error de «Escribir la mía»)", () => {
    const r = parseSetExpr("A ⊆ B");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toBe(
      "A ⊆ B es una relación (verdadera o falsa), no un conjunto: aquí va una expresión que se pueda sombrear, como A ∩ B. Para suponerla, añádela en «Supuestos»; para decidir si es cierta, usa «Relaciones» en «Comprobar una igualdad».",
    );
    expect([r.error.start, r.error.end]).toEqual([2, 3]);
    for (const s of ["A = B", "A <= B", "A ≠ ∅", "A subset B", "A ∩ B != ∅"]) {
      const x = parseSetExpr(s);
      expect(x.ok).toBe(false);
      if (!x.ok) expect(x.error.message).toMatch(/es una relación \(verdadera o falsa\), no un conjunto/);
    }
    // Las operaciones siguen igual.
    expect(parseSetExpr("A - B").ok).toBe(true);
    expect(parseSetExpr("A \\ B").ok).toBe(true);
  });
});

describe("parseSetHypotheses", () => {
  it("varios supuestos separados por comas o punto y coma; vacío es ninguno", () => {
    expect(hyps("A ⊆ B, A ∩ C = ∅").map(relationToPlain)).toEqual(["A ⊆ B", "A ∩ C = ∅"]);
    expect(hyps("∅ ≠ A ⊆ B; B ⊆ C").map(relationToPlain)).toEqual(["∅ ≠ A", "A ⊆ B", "B ⊆ C"]);
    expect(hyps("  ")).toEqual([]);
  });
  it("errores con su posición en la lista", () => {
    const r = parseSetHypotheses("A ⊆ B, C");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/^C es un conjunto, no una relación/);
    const twice = parseSetHypotheses("A ⊆ B,, B ⊆ C");
    expect(twice.ok).toBe(false);
    const many = parseSetHypotheses("A ⊆ B, B ⊆ C, A ⊆ C, A ≠ ∅, B ≠ ∅, C ≠ ∅, A ≠ B");
    expect(many.ok).toBe(false);
  });
});

describe("supuestos y regiones vacías", () => {
  it("A ⊆ B vacía A ∩ Bᶜ y se dibuja A dentro de B", () => {
    const a = analyzeHypotheses(hyps("A ⊆ B"));
    expect(a.vars).toEqual(["A", "B"]);
    expect(a.consistent).toBe(true);
    expect(a.empty).toEqual([false, true, false, false]);
    expect(nestedShape(a)).toBe("A-en-B");
    expect(nestedShape(analyzeHypotheses(hyps("B ⊆ A")))).toBe("B-en-A");
    expect(nestedShape(analyzeHypotheses(hyps("A ⊇ B")))).toBe("B-en-A");
    expect(nestedShape(analyzeHypotheses(hyps("A ∩ B = ∅")))).toBe("separados");
    expect(nestedShape(analyzeHypotheses(hyps("A ⊆ Bᶜ")))).toBe("separados");
    expect(nestedShape(analyzeHypotheses(hyps("A = B")))).toBe("iguales");
    expect(nestedShape(analyzeHypotheses(hyps("A ⊊ B")))).toBe("A-en-B");
    // Sin forma: ninguno o una combinación que no es ninguna de esas.
    expect(nestedShape(analyzeHypotheses(hyps("A ≠ B")))).toBeNull();
    expect(nestedShape(analyzeHypotheses(hyps("A ⊆ B, A ∩ B = ∅")))).toBeNull();
  });

  it("⊊ y ≠ obligan a que haya elementos; los supuestos contradictorios se detectan", () => {
    const a = analyzeHypotheses(hyps("A ⊊ B"));
    expect(a.empty[1]).toBe(true);
    expect(a.occupied[2]).toBe(true);
    const c = analyzeHypotheses(hyps("A ⊊ B, B ⊆ A"));
    expect(c.consistent).toBe(false);
    expect(c.empty.some(Boolean)).toBe(false);
  });

  it("con C, el diagrama de tres conjuntos: A ⊆ B y A ∩ C = ∅", () => {
    const a = analyzeHypotheses(hyps("A ⊆ B, A ∩ C = ∅"));
    expect(a.vars).toEqual(["A", "B", "C"]);
    const empty = a.empty.flatMap((e, r) => (e ? [regionLabel(a.vars, r)] : []));
    expect(empty).toEqual(["A ∩ Bᶜ ∩ Cᶜ", "A ∩ Bᶜ ∩ C", "A ∩ B ∩ C"]);
    expect(nestedShape(a)).toBeNull();
  });
});

describe("checkRelation", () => {
  it("sin supuestos: siempre, nunca o depende", () => {
    expect(checkRelation(rel("A ∖ B ⊆ A")).verdict).toBe("siempre");
    expect(checkRelation(rel("A ∩ Aᶜ ≠ ∅")).verdict).toBe("nunca");
    expect(checkRelation(rel("A ⊆ B")).verdict).toBe("depende");
    expect(checkRelation(rel("(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ")).verdict).toBe("siempre");
  });

  it("con supuestos, como en el examen: si ∅ ≠ A ⊆ B…", () => {
    const h = hyps("∅ ≠ A ⊆ B");
    expect(checkRelation(rel("B ∖ A ⊆ A"), h).verdict).toBe("depende");
    expect(checkRelation(rel("A ∩ B = ∅"), h).verdict).toBe("nunca");
    expect(checkRelation(rel("A ∩ B = A"), h).verdict).toBe("siempre");
    expect(checkRelation(rel("Bᶜ ⊆ Aᶜ"), h).verdict).toBe("siempre");
    expect(forcesNonEmptyAB(h)).toBe(true);
    expect(forcesNonEmptyAB(hyps("A ⊆ B"))).toBe(false);
    expect(checkRelation(rel("A ∩ C = ∅"), hyps("A ⊆ B, B ∩ C = ∅")).verdict).toBe("siempre");
    expect(checkRelation(rel("A ∖ C ≠ ∅"), hyps("A ⊆ B, B ⊆ C")).verdict).toBe("nunca");
    expect(checkRelation(rel("A ∖ C ⊆ Bᶜ"), hyps("A ∩ B ⊆ C")).verdict).toBe("siempre");
  });

  it("contraejemplos: un diagrama que cumple los supuestos y en el que la relación falla, con la región culpable", () => {
    const h = hyps("∅ ≠ A ⊆ B");
    const c = checkRelation(rel("B ∖ A ⊆ A"), h);
    expect(c.counterexample).not.toBeNull();
    const w = c.counterexample!;
    // Cumple los supuestos…
    for (const x of h) expect(relationHolds(x, c.vars, w)).toBe(true);
    // …y la relación falla: hay elementos en Aᶜ ∩ B.
    expect(worldHas(w, 2)).toBe(true);
    expect(relationReason(rel("B ∖ A ⊆ A")[0]!, c.vars, w)).toBe("la región Aᶜ ∩ B tiene elementos y está en B ∖ A, pero no en A");
    // El ejemplo en que se cumple: B = A.
    expect(c.example).not.toBeNull();
    expect(worldHas(c.example!, 2)).toBe(false);
    // Siempre cierta: sin contraejemplo.
    expect(checkRelation(rel("A ⊆ B"), h).counterexample).toBeNull();
    // ≠ que falla: los dos lados coinciden.
    const eq = checkRelation(rel("A ≠ A ∩ B"), hyps("A ⊆ B"));
    expect(eq.verdict).toBe("nunca");
    expect(relationReason(rel("A ≠ A ∩ B")[0]!, eq.vars, eq.counterexample!)).toBe("A y A ∩ B tienen exactamente los mismos elementos");
  });

  it("supuestos contradictorios: sin veredicto", () => {
    expect(checkRelation(rel("A ⊆ B"), hyps("A ⊊ B, B ⊆ A")).verdict).toBeNull();
  });

  it("cada operación por regiones, en todos los diagramas de dos conjuntos", () => {
    const vars = ["A", "B"] as const;
    for (let w = 0; w < 16; w++) {
      const a = [1, 3].some((r) => worldHas(w, r));
      const b = [2, 3].some((r) => worldHas(w, r));
      const aMinusB = worldHas(w, 1);
      const bMinusA = worldHas(w, 2);
      const r = (s: string) => relationHolds(rel(s)[0]!, vars, w);
      expect(r("A ⊆ B")).toBe(!aMinusB);
      expect(r("A ⊇ B")).toBe(!bMinusA);
      expect(r("A = B")).toBe(!aMinusB && !bMinusA);
      expect(r("A ≠ B")).toBe(aMinusB || bMinusA);
      expect(r("A ⊊ B")).toBe(!aMinusB && bMinusA);
      expect(r("A ⊋ B")).toBe(aMinusB && !bMinusA);
      expect(r("A ⊈ B")).toBe(aMinusB);
      expect(r("A ≠ ∅")).toBe(a);
      expect(r("B = ∅")).toBe(!b);
    }
  });
});

describe("universo no vacío (U ≠ ∅)", () => {
  it("A = Aᶜ es siempre falsa y A ∪ Aᶜ ≠ ∅ siempre cierta: el mundo sin ningún elemento no cuenta", () => {
    expect(checkRelation(rel("A = Aᶜ")).verdict).toBe("nunca");
    expect(checkRelation(rel("A ∪ Aᶜ ≠ ∅")).verdict).toBe("siempre");
    expect(checkRelation(rel("A ∪ B = ∅")).verdict).toBe("depende");
  });

  it("si solo la región de fuera tiene elementos, se dice «fuera de A, B y C»", () => {
    expect(worldPlace(["A", "B"], 1)).toBe("fuera de A y B (los dos vacíos)");
    expect(worldPlace(["A", "B", "C"], 1)).toBe("fuera de A, B y C (todos vacíos)");
    expect(worldPlace(["A", "B"], 1 << 3)).toBe("en A ∩ B");
  });
});
