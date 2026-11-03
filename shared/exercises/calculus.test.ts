// Generadores de cálculo sobre muchas semillas: cada instancia se lee, está bien definida y pide
// números cómodos (pendientes y valores en el punto, integrales, puntos críticos enteros, decimales
// cortos en el descenso de gradiente).
import { describe, expect, it } from "vitest";
import { antiderivative } from "../calculus/antiderivative.ts";
import { criticalPoints } from "../calculus/critical.ts";
import { derivative, derivativeTidy } from "../calculus/derive.ts";
import { exactDescentSteps } from "../calculus/descent.ts";
import { isEquivalent } from "../calculus/equivalence.ts";
import { evaluate, toPlain } from "../calculus/expr.ts";
import { definiteIntegral } from "../calculus/integrals.ts";
import { parseExpr } from "../calculus/parser.ts";
import { derivationSteps } from "../calculus/steps.ts";
import { frac } from "../rational.ts";
import {
  alphaFrac,
  CALC_ANTIDERIVATIVE,
  CALC_CRITICAL,
  CALC_DEFINITE,
  CALC_DERIVATIVE,
  CALC_DESCENT,
  CALC_EXERCISES,
  CALC_GRADIENT,
  CALC_TANGENT,
  calcExpr,
  calcNumber,
  niceValue,
} from "./calculus.ts";
import { exerciseTopics, exercisesOfTopic, mixedType } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 150 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void, seeds = SEEDS) => {
  for (const level of EXERCISE_LEVELS) for (const s of seeds) fn(s, level);
};

describe("registro de cálculo", () => {
  it("quince tipos en el tema «Cálculo» (siete de cálculo y ocho de teoría), tras «Álgebra lineal»", () => {
    const ids = exerciseTopics().map((t) => t.id);
    expect(ids.indexOf("calculo")).toBe(ids.indexOf("algebra-lineal") + 1);
    expect(exercisesOfTopic("calculo").map((t) => t.id)).toEqual(CALC_EXERCISES.map((t) => t.id));
    expect(CALC_EXERCISES).toHaveLength(15);
    const mixed = new Set(SEEDS.slice(0, 150).map((s) => mixedType("calculo", "medio", s).id));
    expect(mixed.size).toBe(15);
  });

  it("deterministas y variados", () => {
    for (const t of CALC_EXERCISES) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS.slice(0, 10)) expect(t.generate(s, level)).toEqual(t.generate(s, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(15);
      }
    }
  });
});

describe("generadores", () => {
  it("derivadas: se leen, su derivada es legible y la solución paso a paso acaba en f′", () => {
    each((s, level) => {
      const { f } = CALC_DERIVATIVE.generate(s, level);
      const e = calcExpr(f);
      // Escrita por la app, se vuelve a leer como la misma función.
      const back = parseExpr(toPlain(e));
      expect(back.ok && isEquivalent(back.expr, e), f).toBe(true);
      const steps = derivationSteps(e);
      expect(isEquivalent(steps.at(-1)!.line, derivativeTidy(e)), f).toBe(true);
    }, SEEDS.slice(0, 60));
  });

  it("tangentes: f(x₀) y f′(x₀) son números cómodos", () => {
    each((s, level) => {
      const t = CALC_TANGENT.generate(s, level);
      const e = calcExpr(t.f);
      expect(niceValue(evaluate(e, { x: t.x0 })), t.f).toBe(true);
      expect(niceValue(evaluate(derivative(e), { x: t.x0 })), t.f).toBe(true);
    });
  });

  it("primitivas: siempre inmediatas y la solución se comprueba derivando", () => {
    each((s, level) => {
      const { f } = CALC_ANTIDERIVATIVE.generate(s, level);
      const e = calcExpr(f);
      const F = antiderivative(e);
      expect(F, f).not.toBeNull();
      expect(isEquivalent(derivative(F!), e), f).toBe(true);
    }, SEEDS.slice(0, 80));
  });

  it("integrales definidas: finitas; en básico y medio, racionales cómodas y de polinomios", () => {
    each((s, level) => {
      const inst = CALC_DEFINITE.generate(s, level);
      const v = definiteIntegral(calcExpr(inst.f), calcNumber(inst.a), calcNumber(inst.b));
      expect(Number.isFinite(v)).toBe(true);
      expect(calcNumber(inst.a)).toBeLessThan(calcNumber(inst.b));
      if (level !== "avanzado") expect(niceValue(v, 12, 80), inst.f).toBe(true);
      expect(antiderivative(calcExpr(inst.f)), inst.f).not.toBeNull();
    });
  });

  it("gradiente: las dos parciales dependen de algo y valen números cómodos en el punto", () => {
    each((s, level) => {
      const g = CALC_GRADIENT.generate(s, level);
      const e = calcExpr(g.f, ["x", "y"]);
      for (const v of ["x", "y"] as const) expect(niceValue(evaluate(derivative(e, v), { x: g.point[0], y: g.point[1] })), g.f).toBe(true);
    });
  });

  it("puntos críticos: entre 1 y 4, enteros, y el criterio decide en todos; aparecen mínimos, máximos y sillas", () => {
    const kinds = new Set<string>();
    each((s, level) => {
      const { f } = CALC_CRITICAL.generate(s, level);
      const r = criticalPoints(calcExpr(f, ["x", "y"]));
      expect(r.ok, f).toBe(true);
      if (!r.ok) return;
      expect(r.points.length).toBeGreaterThanOrEqual(level === "avanzado" ? 2 : 1);
      expect(r.points.length).toBeLessThanOrEqual(4);
      for (const p of r.points) {
        expect(p.x.d === 1n && p.y.d === 1n).toBe(true);
        expect(p.kind).not.toBe("no-concluyente");
        kinds.add(p.kind);
      }
    });
    expect(kinds).toEqual(new Set(["minimo", "maximo", "silla"]));
  });

  it("descenso: x₁ y x₂ con decimales cortos; en avanzado, en dos variables", () => {
    each((s, level) => {
      const d = CALC_DESCENT.generate(s, level);
      expect(d.start.length).toBe(level === "avanzado" ? 2 : 1);
      const steps = exactDescentSteps(calcExpr(d.f, d.start.length === 2 ? ["x", "y"] : ["x"]), d.start.map((v) => frac(BigInt(v))), alphaFrac(d.alpha), d.steps)!;
      expect(steps).toHaveLength(3);
      for (const v of steps.flat()) expect(10000n % v.d, d.f).toBe(0n);
    });
    expect(alphaFrac(0.25)).toEqual(frac(1n, 4n));
  });

  it("todas las funciones se leen con el analizador", () => {
    each((s, level) => {
      // Los de teoría (sin campo f o con otras formas) se validan en calculus-theory.test.ts.
      for (const t of CALC_EXERCISES.slice(0, 7)) {
        const inst = t.generate(s, level) as { f: string; point?: unknown; start?: number[] };
        const two = t === CALC_GRADIENT || t === CALC_CRITICAL || (t === CALC_DESCENT && inst.start!.length === 2);
        expect(parseExpr(inst.f, { vars: two ? ["x", "y"] : ["x"] }).ok, inst.f).toBe(true);
      }
    }, SEEDS.slice(0, 30));
  });
});
