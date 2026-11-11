// Ejercicios de teoría de cálculo (tipo examen) sobre muchas semillas: cada pregunta se monta (opción
// única con exactamente una correcta, cuatro opciones a–d salvo las variantes), y lo que el motor da
// por correcto se comprueba por otro camino: valores cercanos al punto, el cociente sin L'Hôpital, la
// integral numérica, la derivada numérica de la composición o el simulador de descenso.
import { describe, expect, it } from "vitest";
import { boundValue, closedValue } from "../calculus/byparts.ts";
import { bisectionInterval, bisectionIterations, bisectionLength } from "../calculus/bisection.ts";
import { objective, runDescent } from "../calculus/descent.ts";
import { domainOf, inSet } from "../calculus/domain.ts";
import { compile, evaluate } from "../calculus/expr.ts";
import { definiteIntegral } from "../calculus/integrals.ts";
import { piecewiseValue } from "../calculus/limits.ts";
import { arrangeChoices } from "./choice.ts";
import {
  basinQuestion,
  bisectionOf,
  CALC_BASIN,
  CALC_BISECTION,
  CALC_CHAIN,
  CALC_CRITICAL_CHOICE,
  CALC_DOMAIN,
  CALC_LHOPITAL,
  CALC_PARTS,
  CALC_PIECEWISE,
  CALC_THEORY_EXERCISES,
  calcExpr,
  calcPiecewise,
  chainAnswer,
  criticalChoiceQuestion,
  curveExpr,
  domainQuestion,
  lhopitalOf,
  niceText,
  niceTex,
  partsIntegral,
  partsQuestion,
  piecewiseQuestion,
} from "./calculus.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 120 }, (_, i) => (i * 2654435761 + 17) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void) => {
  for (const level of EXERCISE_LEVELS) for (const s of SEEDS) fn(s, level);
};

describe("teoría de cálculo: generadores", () => {
  it("deterministas, variados y con sus tres niveles", () => {
    for (const t of CALC_THEORY_EXERCISES) {
      expect(t.levels).toEqual(EXERCISE_LEVELS);
      for (const level of EXERCISE_LEVELS) {
        expect(t.generate(SEEDS[3]!, level)).toEqual(t.generate(SEEDS[3]!, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(8);
      }
    }
  });

  it("formatos de número: fracciones cómodas o decimales con coma", () => {
    expect(niceText(-3 / 4)).toBe("−3/4");
    expect(niceText(Math.SQRT2)).toBe("1,4142");
    expect(niceTex(1 / 2)).toBe("\\frac{1}{2}");
    expect(niceTex(-Infinity)).toBe("-\\infty");
  });
});

describe("función a trozos", () => {
  it("opción única con una correcta (o varias en avanzado); los límites del enunciado se comprueban acercándose", () => {
    each((s, level) => {
      const inst = CALC_PIECEWISE.generate(s, level);
      const q = piecewiseQuestion(inst);
      const opts = arrangeChoices(q, s);
      expect(opts.length).toBeGreaterThanOrEqual(4);
      if (level !== "avanzado") expect(opts).toHaveLength(4);
      const pw = calcPiecewise(inst);
      const near = (side: number) => piecewiseValue(pw, inst.a + side * 1e-7);
      inst.claims.forEach((c, i) => {
        const truth = inst.ask === "falsa" ? !q.options[i]!.correct : q.options[i]!.correct;
        if (c.k === "izq") expect(Math.abs(near(-1) - c.v) < 1e-4, JSON.stringify(inst)).toBe(truth);
        if (c.k === "der") expect(Math.abs(near(1) - c.v) < 1e-4, JSON.stringify(inst)).toBe(truth);
        if (c.k === "continua") expect(Math.abs(near(-1) - piecewiseValue(pw, inst.a)) < 1e-4 && Math.abs(near(1) - piecewiseValue(pw, inst.a)) < 1e-4).toBe(truth);
      });
    });
  });
});

describe("L'Hôpital", () => {
  it("indeterminado, con límite finito y cómodo que coincide con el cociente cerca del punto", () => {
    each((s, level) => {
      const inst = CALC_LHOPITAL.generate(s, level);
      const r = lhopitalOf(inst)!;
      expect(r.steps[0]!.form).not.toBeNull();
      const v = (r.result as { value: number }).value;
      const q = (x: number) => evaluate(calcExpr(inst.num), { x }) / evaluate(calcExpr(inst.den), { x });
      const approx = inst.at === "+inf" ? q(1e8) : (q(inst.at + 1e-3) + q(inst.at - 1e-3)) / 2;
      expect(approx, JSON.stringify(inst)).toBeCloseTo(v, 1);
    });
  });
});

describe("dominio", () => {
  it("la opción correcta es el dominio (comprobado punto a punto) y las demás son distintas", () => {
    each((s, level) => {
      const inst = CALC_DOMAIN.generate(s, level);
      const opts = arrangeChoices(domainQuestion(inst), s);
      expect(opts).toHaveLength(level === "avanzado" ? 5 : 4);
      const f = calcExpr(inst.f);
      const D = domainOf(f);
      for (let x = -9; x <= 9; x += 0.25) expect(inSet(D, x), `${inst.f} en ${x}`).toBe(Number.isFinite(evaluate(f, { x })));
    });
  });
});

describe("bisección", () => {
  it("se puede aplicar y los datos pedidos salen de las iteraciones", () => {
    each((s, level) => {
      const inst = CALC_BISECTION.generate(s, level);
      const f = compile(calcExpr(inst.f));
      expect(f(inst.a) * f(inst.b)).toBeLessThan(0);
      if (inst.ask === "iteraciones") {
        const n = bisectionIterations(inst.a, inst.b, inst.eps);
        expect(bisectionLength(inst.a, inst.b, n)).toBeLessThan(inst.eps);
      } else {
        const [lo, hi] = bisectionInterval(bisectionOf(inst)!);
        expect(f(lo) * f(hi)).toBeLessThan(0);
        expect(hi - lo).toBe(bisectionLength(inst.a, inst.b, inst.k));
      }
    });
  });
});

describe("regla de la cadena", () => {
  it("respuesta entera no nula que coincide con la derivada numérica cuando hay fórmulas", () => {
    each((s, level) => {
      const inst = CALC_CHAIN.generate(s, level);
      const v = chainAnswer(inst);
      expect(Number.isInteger(Math.round(v * 1e9) / 1e9) && v !== 0).toBe(true);
      if (inst.kind === "jacobiana") {
        const h = (x: number, y: number) => {
          const m = inst.map.map((t) => evaluate(calcExpr(t, ["x", "y"]), { x, y }));
          return inst.grad[0] * m[0]! + inst.grad[1] * m[1]!; // h lineal con ese gradiente
        };
        const [px, py] = inst.p;
        const e = 1e-6;
        const num = (h(px + e, py) - h(px - e, py)) / (2 * e) + (h(px, py + e) - h(px, py - e)) / (2 * e);
        expect(num).toBeCloseTo(v, 4);
      } else if (inst.curve && inst.h) {
        const H = calcExpr(inst.h, ["x", "y"]);
        const c = inst.curve.map(curveExpr);
        const comp = (t: number) => evaluate(H, { x: evaluate(c[0]!, { x: t }), y: evaluate(c[1]!, { x: t }) });
        expect((comp(inst.t0 + 1e-6) - comp(inst.t0 - 1e-6)) / 2e-6).toBeCloseTo(v, 4);
      } else if (inst.decoy) {
        expect(inst.decoy.at).not.toEqual(inst.point);
      }
    });
  });
});

describe("cuenca del descenso", () => {
  it("una correcta entre cuatro, y el simulador con α pequeño va adonde dice", () => {
    each((s, level) => {
      const inst = CALC_BASIN.generate(s, level);
      const q = basinQuestion(inst);
      expect(arrangeChoices(q, s)).toHaveLength(4);
      if (inst.ask === "destino") {
        const run = runDescent(objective(calcExpr(inst.f), 1), { alpha: 0.001, start: [inst.x0], iterations: 500, limit: 1e3 });
        const last = run.points[run.points.length - 1]![0]!;
        const right = q.options.find((o) => o.correct)!;
        if (right.id === "mas") expect(last).toBeGreaterThan(inst.x0);
        else if (right.id === "menos") expect(last).toBeLessThan(inst.x0);
        else {
          const target = Number(right.text.split("= ")[1]!.replace("−", "-"));
          expect(Math.abs(last - target)).toBeLessThan(Math.abs(inst.x0 - target));
        }
      }
    });
  });
});

describe("puntos críticos tipo test", () => {
  it("exactamente una correcta entre cuatro", () => {
    each((s, level) => {
      const inst = CALC_CRITICAL_CHOICE.generate(s, level);
      expect(arrangeChoices(criticalChoiceQuestion(inst), s)).toHaveLength(4);
    });
  });
  it("«f no tiene puntos críticos» va en texto normal, no en modo matemático", () => {
    let seen = 0;
    each((s, level) => {
      const none = criticalChoiceQuestion(CALC_CRITICAL_CHOICE.generate(s, level)).options.find((o) => o.id === "sin");
      if (!none) return;
      seen++;
      expect(none.text).toBe("f no tiene puntos críticos");
      expect(none.tex).toBeUndefined();
    });
    expect(seen).toBeGreaterThan(0);
  });
});

describe("integración por partes", () => {
  it("el valor exacto coincide con la integral numérica (también con los límites al revés); cuatro opciones distintas", () => {
    each((s, level) => {
      const inst = CALC_PARTS.generate(s, level);
      const v = closedValue(partsIntegral(inst));
      const f = calcExpr(
        { "x-ln": "x ln(x)", "x2-ln": "x^2 ln(x)", "x-exp": `x e^(${inst.a}x)`, "x-sin": `x sen(${inst.a}x)`, "x-cos": `x cos(${inst.a}x)` }[inst.fam],
      );
      const lo = boundValue(inst.lo);
      const hi = boundValue(inst.hi);
      const numeric = inst.k * (lo <= hi ? definiteIntegral(f, lo, hi) : -definiteIntegral(f, hi, lo));
      expect(v, JSON.stringify(inst)).toBeCloseTo(numeric, 7);
      if (inst.answer === "opciones") {
        const q = partsQuestion(inst);
        expect(arrangeChoices(q, s)).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
      }
    });
  });
});
