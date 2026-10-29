import { describe, expect, it } from "vitest";
import { isNegationNormalForm, predToPlain, type PredFormula } from "./ast.ts";
import { findPredDifference } from "./equivalence.ts";
import {
  applicableNegationLaws,
  checkNegationStep,
  negationLawJustifies,
  negationLawsJustifying,
  pushNegation,
} from "./negation.ts";
import { parsePredicate } from "./parser.ts";
import { PREDICADOS_PACK } from "../../content/predicados/practica.ts";

const parse = (s: string): PredFormula => {
  const r = parsePredicate(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.formula;
};
const D = ["1", "2", "3"];

describe("leyes de la negación", () => {
  it("cada ley justifica su forma de libro", () => {
    const cases: Array<[string, string, Parameters<typeof negationLawJustifies>[2]]> = [
      ["¬∀x P(x)", "∃x ¬P(x)", "neg-forall"],
      ["¬∃x P(x)", "∀x ¬P(x)", "neg-exists"],
      ["¬(P(a) ∧ Q(a))", "¬P(a) ∨ ¬Q(a)", "de-morgan-and"],
      ["¬(P(a) ∨ Q(a))", "¬P(a) ∧ ¬Q(a)", "de-morgan-or"],
      ["¬(P(a) → Q(a))", "P(a) ∧ ¬Q(a)", "neg-imp"],
      ["¬(P(a) ↔ Q(a))", "P(a) ↔ ¬Q(a)", "neg-iff"],
      ["¬(P(a) ↔ Q(a))", "¬P(a) ↔ Q(a)", "neg-iff"],
      ["¬¬P(a)", "P(a)", "double-neg"],
    ];
    for (const [a, b, law] of cases) {
      expect(negationLawJustifies(parse(a), parse(b), law), `${a} ⟶ ${b}`).toBe(true);
      expect(negationLawsJustifying(parse(a), parse(b)), `${a} ⟶ ${b}`).toEqual([law]);
    }
  });

  it("dentro de una fórmula y renombrando la variable ligada", () => {
    expect(negationLawJustifies(parse("∀x ¬∃y M(x, y)"), parse("∀x ∀z ¬M(x, z)"), "neg-exists")).toBe(true);
  });

  it("la misma ley en dos sitios a la vez cuenta como un paso", () => {
    expect(negationLawJustifies(parse("¬¬P(a) ∧ ¬¬Q(a)"), parse("P(a) ∧ Q(a)"), "double-neg")).toBe(true);
  });

  it("dos leyes distintas en un paso no se aceptan", () => {
    expect(negationLawsJustifying(parse("¬∀x (P(x) → Q(x))"), parse("∃x (P(x) ∧ ¬Q(x))"))).toEqual([]);
  });

  it("applicableNegationLaws va de fuera hacia dentro", () => {
    const list = applicableNegationLaws(parse("¬∀x (P(x) ∧ ¬¬Q(x))"));
    expect(list.map((l) => l.law)).toEqual(["neg-forall", "double-neg"]);
    expect(predToPlain(list[1]!.at)).toBe("¬¬Q(x)");
  });
});

describe("pushNegation", () => {
  it("¬∀x (P(x) → Q(x)) en dos pasos", () => {
    const steps = pushNegation(parse("¬∀x (P(x) → Q(x))"));
    expect(steps.map((s) => [predToPlain(s.formula), s.law])).toEqual([
      ["∃x ¬(P(x) → Q(x))", "neg-forall"],
      ["∃x (P(x) ∧ ¬Q(x))", "neg-imp"],
    ]);
  });

  it("cada ejercicio del contenido termina en forma normal negativa, con pasos equivalentes y de una ley", () => {
    for (const ex of PREDICADOS_PACK.negation) {
      let prev: PredFormula = { kind: "not", arg: parse(ex.formula) };
      const steps = pushNegation(prev);
      expect(steps.length, ex.id).toBeGreaterThan(0);
      for (const s of steps) {
        expect(negationLawJustifies(prev, s.formula, s.law), `${ex.id}: ${predToPlain(s.formula)}`).toBe(true);
        expect(findPredDifference(prev, s.formula, [D])).toBeNull();
        prev = s.formula;
      }
      expect(isNegationNormalForm(prev), ex.id).toBe(true);
    }
  });
});

describe("checkNegationStep", () => {
  const start = parse("¬∀x (P(x) → Q(x))");
  it("paso correcto", () => {
    expect(checkNegationStep(start, parse("∃x ¬(P(x) → Q(x))"), "neg-forall", D)).toEqual({ ok: true, done: false });
    expect(checkNegationStep(parse("∃x ¬(P(x) → Q(x))"), parse("∃x (P(x) ∧ ¬Q(x))"), "neg-imp", D)).toEqual({ ok: true, done: true });
  });

  it("no equivalente: el error típico de no negar el cuerpo", () => {
    const r = checkNegationStep(start, parse("∃x (P(x) → Q(x))"), "neg-forall", D);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-equivalent");
  });

  it("equivalente pero con la ley equivocada o con dos leyes a la vez", () => {
    expect(checkNegationStep(start, parse("∃x ¬(P(x) → Q(x))"), "neg-exists", D)).toEqual({
      ok: false,
      reason: "wrong-law",
      suggestions: ["neg-forall"],
    });
    expect(checkNegationStep(start, parse("∃x (P(x) ∧ ¬Q(x))"), "neg-forall", D)).toEqual({
      ok: false,
      reason: "wrong-law",
      suggestions: [],
    });
  });

  it("misma fórmula o aridades distintas", () => {
    expect(checkNegationStep(start, parse("¬∀y (P(y) → Q(y))"), "neg-forall", D)).toEqual({ ok: false, reason: "same" });
    expect(checkNegationStep(start, parse("∃x ¬P(x, x)"), "neg-forall", D)).toEqual({ ok: false, reason: "arity-conflict", name: "P" });
  });
});
