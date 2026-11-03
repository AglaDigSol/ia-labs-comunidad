// Motores de la parte de teoría de cálculo: límites laterales y en ±∞ comparados con la aproximación
// numérica, L'Hôpital paso a paso, funciones a trozos (continuidad y derivabilidad frente al cociente
// incremental), dominios (frente a evaluar en muchos puntos), bisección, regla de la cadena (frente a
// la derivada numérica de la composición) y cuencas del descenso de gradiente (frente al simulador).
import { describe, expect, it } from "vitest";
import { createRng } from "../exercises/random.ts";
import { frac, toNumber } from "../rational.ts";
import { basinOf, criticalPoints1D, descentLimit1D } from "./basins.ts";
import { bisection, bisectionInterval, bisectionIterations, bisectionLength } from "./bisection.ts";
import { chainRule, chainRuleAt } from "./chain.ts";
import { objective, runDescent } from "./descent.ts";
import { domainOf, inSet, intervalSetEquals, intervalSetTex, intervalSetText, REALS, zerosOf } from "./domain.ts";
import { evaluate, type Expr } from "./expr.ts";
import { analyzePiecewise, lhopitalSteps, limitAt, oneSidedLimit, piecewiseValue, sameLimit, type Piecewise, snapNice, type LimitValue } from "./limits.ts";
import { parseExpr } from "./parser.ts";

const P = (s: string, vars: Array<"x" | "y"> = ["x"]): Expr => {
  const r = parseExpr(s, { vars });
  if (!r.ok) throw new Error(s);
  return r.expr;
};
const fin = (value: number): LimitValue => ({ kind: "finito", value });
const inf = (sign: 1 | -1): LimitValue => ({ kind: "infinito", sign });
const none: LimitValue = { kind: "no-existe" };

describe("límites", () => {
  it("laterales y en ±∞: los de clase, exactos", () => {
    const cases: Array<[string, number | "+inf" | "-inf", "izquierda" | "derecha", LimitValue]> = [
      ["x^2 + 3", 1, "izquierda", fin(4)],
      ["1/x", 0, "derecha", inf(1)],
      ["1/x", 0, "izquierda", inf(-1)],
      ["1/x^2", 0, "izquierda", inf(1)],
      ["sqrt(x)", 0, "derecha", fin(0)],
      ["sqrt(x)", 0, "izquierda", none],
      ["ln(x)", 0, "derecha", inf(-1)],
      ["|x|/x", 0, "izquierda", fin(-1)],
      ["|x|/x", 0, "derecha", fin(1)],
      ["sen(1/x)", 0, "derecha", none],
      ["x ln(x)", 0, "derecha", fin(0)],
      ["e^(1/x)", 0, "izquierda", fin(0)],
      ["e^(1/x)", 0, "derecha", inf(1)],
      ["ln(x)", "+inf", "derecha", inf(1)],
      ["(2x + 1)/(x - 3)", "+inf", "derecha", fin(2)],
      ["e^x", "-inf", "derecha", fin(0)],
      ["x^3 - x", "-inf", "derecha", inf(-1)],
    ];
    for (const [f, a, side, want] of cases) expect(oneSidedLimit(P(f), a, side), `${f} en ${a} ${side}`).toEqual(want);
    expect(limitAt(P("1/x"), 0)).toEqual(none);
    expect(limitAt(P("1/x^2"), 0)).toEqual(inf(1));
    expect(limitAt(P("(x^2 - 1)/(x - 1)"), 1)).toEqual(fin(2));
  });

  it("coinciden con la aproximación numérica en funciones continuas al azar", () => {
    const rng = createRng(11);
    for (let t = 0; t < 60; t++) {
      const a = rng.int(-3, 3);
      const f = P(`${rng.int(1, 4)}x^2 ${rng.pick(["+", "-"])} ${rng.pick(["sen(x)", "e^x", "cos(2x)", "x^3"])} + ${rng.int(0, 5)}`);
      for (const side of ["izquierda", "derecha"] as const) {
        const l = oneSidedLimit(f, a, side);
        const h = side === "derecha" ? 1e-6 : -1e-6;
        expect(l.kind).toBe("finito");
        expect((l as { value: number }).value).toBeCloseTo(evaluate(f, { x: a + h }), 4);
      }
    }
  });

  it("snapNice redondea solo a fracciones cómodas y sameLimit compara con tolerancia", () => {
    expect(snapNice(0.3333333333)).toBeCloseTo(1 / 3, 15);
    expect(snapNice(Math.PI)).toBe(Math.PI);
    expect(sameLimit(fin(1), fin(1 + 1e-12))).toBe(true);
    expect(sameLimit(inf(1), inf(-1))).toBe(false);
    expect(sameLimit(none, none)).toBe(true);
  });
});

describe("L'Hôpital", () => {
  const cases: Array<[string, string, number | "+inf", number, "0/0" | "∞/∞", number]> = [
    ["sen(3x)", "x", 0, 3, "0/0", 1],
    ["e^(2x) - 1", "x", 0, 2, "0/0", 1],
    ["1 - cos(2x)", "x^2", 0, 2, "0/0", 2],
    ["e^x - 1 - x", "x^2", 0, 1 / 2, "0/0", 2],
    ["x - sen(x)", "x^3", 0, 1 / 6, "0/0", 3],
    ["ln(x)", "x - 1", 1, 1, "0/0", 1],
    ["x^3 - 8", "x^2 - 4", 2, 3, "0/0", 1],
    ["ln(x)", "x", "+inf", 0, "∞/∞", 1],
    ["x^2", "e^x", "+inf", 0, "∞/∞", 2],
    ["3x^2 + 1", "2x^2 - x", "+inf", 3 / 2, "∞/∞", 2],
  ];

  it("deriva mientras sea 0/0 o ∞/∞ y el resultado coincide con el límite numérico", () => {
    for (const [n, d, a, want, form, times] of cases) {
      const r = lhopitalSteps(P(n), P(d), a);
      expect(r, `${n} / ${d}`).not.toBeNull();
      expect(r!.steps[0]!.form).toBe(form);
      expect(r!.steps).toHaveLength(times + 1);
      expect(r!.steps[times]!.form).toBeNull();
      expect(r!.result).toEqual(fin(want));
      // Contra la aproximación directa del cociente (lejos de la cancelación numérica).
      const q = (x: number) => evaluate(P(n), { x }) / evaluate(P(d), { x });
      const near = a === "+inf" ? q(1e7) : q(a + 1e-4);
      expect(near).toBeCloseTo(want, 2);
    }
  });

  it("si no es indeterminado, no deriva; y el límite por el cociente da lo mismo", () => {
    const r = lhopitalSteps(P("x + 1"), P("x + 2"), 0);
    expect(r!.steps).toHaveLength(1);
    expect(r!.result).toEqual(fin(1 / 2));
    expect(lhopitalSteps(P("1"), P("x"), 0)!.result).toEqual(none);
    expect(lhopitalSteps(P("1"), P("x^2"), 0)!.result).toEqual(inf(1));
    for (const [n, d, a, want] of cases) expect(limitAt(P(`(${n})/(${d})`), a)).toEqual(fin(want));
  });
});

describe("funciones a trozos", () => {
  const pw = (a: number, left: string, right: string, atPoint: string): Piecewise => ({
    a,
    left: P(left),
    right: P(right),
    atPoint: atPoint === "izquierda" || atPoint === "derecha" ? atPoint : P(atPoint),
  });

  it("los ejemplos de clase: laterales, continuidad y derivabilidad", () => {
    // x² (x ≤ 0) y √(x²) (x > 0): continua, no derivable (derivadas laterales 0 y 1).
    expect(analyzePiecewise(pw(0, "x^2", "sqrt(x^2)", "izquierda"))).toMatchObject({ continuous: true, differentiable: false, dLeft: fin(0), dRight: fin(1) });
    // ln(x + 1) + eˣ y √(x² + 1) en 0: continua (1 y 1) y no derivable (2 frente a 0).
    expect(analyzePiecewise(pw(0, "ln(x + 1) + e^x", "sqrt(x^2 + 1)", "izquierda"))).toMatchObject({ value: 1, continuous: true, dLeft: fin(2), dRight: fin(0), differentiable: false });
    // ln x, 1 en x = 1, x² − 1: tiene límite 0 pero f(1) = 1: discontinuidad evitable.
    expect(analyzePiecewise(pw(1, "ln(x)", "x^2 - 1", "1"))).toMatchObject({ value: 1, limit: fin(0), continuous: false, differentiable: false });
    // Salto: los laterales no coinciden.
    expect(analyzePiecewise(pw(2, "x + 1", "x^2", "derecha"))).toMatchObject({ left: fin(3), right: fin(4), limit: none, continuous: false });
    // Derivable: x² y 2x − 1 en 1.
    expect(analyzePiecewise(pw(1, "x^2", "2x - 1", "izquierda"))).toMatchObject({ continuous: true, differentiable: true, dLeft: fin(2), dRight: fin(2) });
    // Un cociente 0/0 en un trozo.
    expect(analyzePiecewise(pw(1, "(x^2 - 1)/(x - 1)", "3x - 1", "derecha"))).toMatchObject({ left: fin(2), right: fin(2), continuous: true, dLeft: fin(1), dRight: fin(3) });
  });

  it("las derivadas laterales coinciden con el cociente incremental", () => {
    const rng = createRng(5);
    for (let t = 0; t < 40; t++) {
      const a = rng.int(-2, 2);
      const m = rng.int(-3, 3);
      const c = a * a + rng.pick([0, 0, 1]);
      const p = pw(a, "x^2", `${m}x + ${c - m * a}`, rng.pick(["izquierda", "derecha"]));
      const r = analyzePiecewise(p);
      const fa = piecewiseValue(p, a);
      const h = 1e-6;
      if (r.continuous) {
        expect((r.dLeft as { value: number }).value).toBeCloseTo((fa - piecewiseValue(p, a - h)) / h, 4);
        expect((r.dRight as { value: number }).value).toBeCloseTo((piecewiseValue(p, a + h) - fa) / h, 4);
        expect(r.differentiable).toBe(m === 2 * a);
      } else expect(r.differentiable).toBe(false);
    }
  });
});

describe("dominio", () => {
  const num = (v: number) => String(snapNice(v)).replace("-", "−");
  it("los de clase", () => {
    const cases: Array<[string, string]> = [
      ["sqrt(4 - x^2)", "[−2, 2]"],
      ["ln(x - 1)", "(1, +∞)"],
      ["1/(x^2 - 9)", "ℝ ∖ {−3, 3}"],
      ["sqrt(x^2 - 4)", "(−∞, −2] ∪ [2, +∞)"],
      ["ln(9 - x^2)", "(−3, 3)"],
      ["sqrt(x + 2)/(x - 1)", "[−2, 1) ∪ (1, +∞)"],
      ["x^2 + 1", "ℝ"],
      ["ln(x)/(x - 1)", "(0, 1) ∪ (1, +∞)"],
      ["sqrt(x - 1) + sqrt(3 - x)", "[1, 3]"],
      ["1/sqrt(x - 2)", "(2, +∞)"],
      ["sqrt(-x^2)", "{0}"],
      ["1/(4x^2 - 4x + 1)", "ℝ ∖ {0.5}"],
      ["sqrt(-1 - x^2)", "∅"],
    ];
    for (const [f, want] of cases) expect(intervalSetText(domainOf(P(f)), num), f).toBe(want);
    expect(intervalSetTex(domainOf(P("sqrt(x^2 - 4)")), num)).toBe("(-\\infty, −2] \\cup [2, +\\infty)");
    expect(intervalSetEquals(domainOf(P("e^x")), REALS)).toBe(true);
    expect(zerosOf(P("9x^2 - 6x + 1"))[0]).toBeCloseTo(1 / 3, 9);
  });

  it("x está en el dominio si y solo si f(x) es un número", () => {
    const rng = createRng(3);
    const fs = ["sqrt(4 - x^2)", "ln(x^2 - 1)", "1/(x - 2) + sqrt(x)", "ln(x + 3)/(x^2 - 1)", "sqrt((x - 1)(x + 4))"];
    for (const text of fs) {
      const f = P(text);
      const d = domainOf(f);
      for (let t = 0; t < 400; t++) {
        const x = rng.int(-60, 60) / 8 + rng.pick([0, 1 / 3]);
        expect(inSet(d, x), `${text} en ${x}`).toBe(Number.isFinite(evaluate(f, { x })));
      }
    }
  });
});

describe("bisección", () => {
  it("x² − 2 en [1, 2]: las mitades buenas, la longitud y la raíz dentro", () => {
    const f = (x: number) => x * x - 2;
    const steps = bisection(f, 1, 2, 3)!;
    expect(steps.map((s) => s.m)).toEqual([1.5, 1.25, 1.375]);
    expect(steps.map((s) => s.keep)).toEqual(["izquierda", "derecha", "derecha"]);
    expect(bisectionInterval(steps)).toEqual([1.375, 1.5]);
    expect(bisectionLength(1, 2, 3)).toBe(1 / 8);
    const [lo, hi] = bisectionInterval(bisection(f, 1, 2, 20)!);
    expect(lo <= Math.SQRT2 && Math.SQRT2 <= hi).toBe(true);
    expect(hi - lo).toBe(bisectionLength(1, 2, 20));
  });

  it("no se aplica sin cambio de signo; se para si f(m) = 0; iteraciones para una tolerancia", () => {
    expect(bisection((x) => x * x + 1, -1, 1, 3)).toBeNull();
    const steps = bisection((x) => x - 1, 0, 2, 5)!;
    expect(steps).toHaveLength(1);
    expect(bisectionInterval(steps)).toEqual([1, 1]);
    expect(bisectionIterations(0, 1, 0.01)).toBe(7);
    expect(bisectionIterations(0, 4, 0.5)).toBe(4);
    expect(bisectionIterations(0, 4, 0.51)).toBe(3);
    for (let k = 0; k < 10; k++) {
      const n = bisectionIterations(-1, 3, 10 ** -k);
      expect(bisectionLength(-1, 3, n)).toBeLessThan(10 ** -k);
      if (n > 0) expect(bisectionLength(-1, 3, n - 1)).toBeGreaterThanOrEqual(10 ** -k);
    }
  });
});

describe("regla de la cadena", () => {
  it("∇h(c(t₀))·c′(t₀) coincide con la derivada numérica de h(c(t))", () => {
    expect(chainRule([4, 5], [3, -1])).toBe(7);
    const hs = ["x^2 y", "x y + y^2", "e^(x - y)", "sen(x) + x y^2"];
    const curves: Array<[string, string]> = [
      ["x^2", "3x - 1"],
      ["e^x", "sen(x)"],
      ["ln(1 + x)", "x^3"],
      ["cos(x)", "2x"],
    ];
    for (const h of hs) {
      for (const c of curves) {
        for (const t0 of [0, 0.5, 1]) {
          const H = P(h, ["x", "y"]);
          const C: [Expr, Expr] = [P(c[0]), P(c[1])];
          const comp = (t: number) => evaluate(H, { x: evaluate(C[0], { x: t }), y: evaluate(C[1], { x: t }) });
          const numeric = (comp(t0 + 1e-6) - comp(t0 - 1e-6)) / 2e-6;
          expect(chainRuleAt(H, C, t0).value, `${h} con ${c.join(", ")} en ${t0}`).toBeCloseTo(numeric, 5);
        }
      }
    }
  });
});

describe("cuencas del descenso de gradiente", () => {
  it("puntos críticos de un polinomio, con su tipo", () => {
    expect(criticalPoints1D(P("x^4 - 2x^2"))!.map((c) => [toNumber(c.x), c.kind])).toEqual([
      [-1, "minimo"],
      [0, "maximo"],
      [1, "minimo"],
    ]);
    expect(criticalPoints1D(P("x^3"))!.map((c) => c.kind)).toEqual(["inflexion"]);
    expect(criticalPoints1D(P("sen(x)"))).toBeNull();
  });

  it("adónde va desde x₀ coincide con el simulador con α pequeño", () => {
    const fs = ["x^4 - 2x^2", "x^4 - 4x^3 - 2x^2 + 12x", "x^3 - 3x", "-x^4 + 2x^2", "x^2 - 4x"];
    for (const text of fs) {
      const f = P(text);
      for (let x0 = -3; x0 <= 4; x0 += 0.25) {
        const lim = descentLimit1D(f, frac(BigInt(Math.round(x0 * 4)), 4n))!;
        const run = runDescent(objective(f, 1), { alpha: 0.002, start: [x0], iterations: 500, limit: 50 });
        // 500 iteraciones no siempre bastan para llegar: se mira hacia dónde va o dónde acaba.
        const last = run.points[run.points.length - 1]![0]!;
        if (lim.kind === "diverge") expect(Math.sign(last - x0) === lim.dir || run.status === "diverge", `${text} desde ${x0}`).toBe(true);
        else {
          const target = toNumber(lim.x);
          expect(Math.abs(last - target) <= Math.abs(x0 - target) + 1e-9, `${text} desde ${x0}`).toBe(true);
          const longer = runDescent(objective(f, 1), { alpha: 0.01, start: [x0], iterations: 500 });
          if (criticalPoints1D(f)!.find((c) => toNumber(c.x) === target)!.kind === "minimo") expect(longer.points[longer.points.length - 1]![0]!).toBeCloseTo(target, 2);
        }
      }
    }
  });

  it("la cuenca de un mínimo es el intervalo entre los críticos vecinos", () => {
    expect(basinOf(P("x^4 - 2x^2"), frac(1n))).toEqual({ lo: 0, hi: Infinity, loClosed: false, hiClosed: false });
    expect(basinOf(P("-x^4 + 2x^2"), frac(0n))).toEqual({ lo: -1, hi: 1, loClosed: false, hiClosed: false });
    expect(basinOf(P("x^4 - 2x^2"), frac(0n))).toBeNull();
  });
});
