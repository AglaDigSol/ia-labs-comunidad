// Ejercicios de cálculo: derivadas por reglas (tres niveles), recta tangente, primitivas, integrales
// definidas, derivadas parciales y gradiente, puntos críticos con la hessiana y pasos de descenso de
// gradiente. Las funciones se generan desde plantillas con coeficientes al azar y se guardan como
// texto (lo que lee el analizador); lo que se corrige lo calcula el motor de shared/calculus al
// resolver. Los números que se piden salen cómodos: enteros o fracciones pequeñas, decimales finitos.
import { antiderivative } from "../calculus/antiderivative.ts";
import { basinOf, criticalPoints1D, CRITICAL_1D_LABEL, descentLimit1D } from "../calculus/basins.ts";
import { bisection } from "../calculus/bisection.ts";
import { closedRekey, closedScale, closedTex, closedText, closedValue, PARTS_FAMILIES, partsDefinite, type Bound, type ClosedForm, type PartsFamily } from "../calculus/byparts.ts";
import { chainRule, chainRuleAt, chainRuleJacobian, jacobianAt } from "../calculus/chain.ts";
import { CRITICAL_LABEL, criticalPoints } from "../calculus/critical.ts";
import { derivative, derivativeTidy } from "../calculus/derive.ts";
import { exactDescentSteps } from "../calculus/descent.ts";
import {
  complementSet,
  domainOf,
  intervalSetEquals,
  intervalSetTex,
  intervalSetText,
  mirrorSet,
  normalizeSet,
  REALS,
  setFromCuts,
  toggleEndpoints,
  withEndpoints,
  type IntervalSet,
} from "../calculus/domain.ts";
import { compile, evaluate, exprSize, toPlain, toTex, type Expr, type VarName } from "../calculus/expr.ts";
import { definiteIntegral, parseNumberAnswer } from "../calculus/integrals.ts";
import { analyzePiecewise, lhopitalSteps, limitText, snapNice, type LimitValue, type Piecewise, type PiecewiseAnalysis } from "../calculus/limits.ts";
import { parseExpr } from "../calculus/parser.ts";
import { classifyPoint, hasNoCriticalPoints } from "../calculus/points.ts";
import { frac, toNumber, type Frac } from "../rational.ts";
import { seedFromKey, type ChoiceOption, type ChoiceQuestion } from "./choice.ts";
import { pickHints, type TaggedHint } from "./hints.ts";
import { createRng, generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

/** Una función escrita como en clase. */
export type CalcFnInstance = { f: string };
export type CalcTangentInstance = { f: string; x0: number };
/** Límites como texto: "0", "π", "π/2", "e". */
export type CalcIntegralInstance = { f: string; a: string; b: string };
export type CalcGradientInstance = { f: string; point: [number, number] };
export type CalcDescentInstance = { f: string; start: number[]; alpha: number; steps: number };

/** Lee una función generada (si no se lee, es un error de programación: los tests lo cubren). */
export function calcExpr(text: string, vars: readonly VarName[] = ["x"]): Expr {
  const r = parseExpr(text, { vars });
  if (!r.ok) throw new Error(`función ilegible: ${text} (${r.error.message})`);
  return r.expr;
}

/** Valor de un límite de integración o de un α escrito como texto. */
export function calcNumber(text: string): number {
  const r = parseNumberAnswer(text);
  if (!r.ok) throw new Error(`número ilegible: ${text}`);
  return r.value;
}

/** α como fracción exacta (0,1 = 1/10). */
export function alphaFrac(alpha: number): Frac {
  const s = String(alpha);
  const [int, dec = ""] = s.split(".");
  return frac(BigInt(int! + dec), 10n ** BigInt(dec.length));
}

/** ¿Número cómodo? Entero o fracción de denominador pequeño, y no muy grande. */
export function niceValue(v: number, maxDen = 12, maxAbs = 60): boolean {
  if (!Number.isFinite(v) || Math.abs(v) > maxAbs) return false;
  for (let d = 1; d <= maxDen; d++) if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return true;
  return false;
}

// ---------------------------------------------------------------- Escritura de sumas

/** Coeficiente delante de algo: 1 no se escribe y −1 es «−». */
const coefText = (c: number, body: string) => (body === "" ? String(Math.abs(c)) : Math.abs(c) === 1 ? body : `${Math.abs(c)}${/^[a-z(]/.test(body) ? "" : "·"}${body}`);

/** «3x^4 − 2x^2 + 5»: términos (coeficiente, cuerpo) sin los de coeficiente 0. */
function sumText(terms: Array<[number, string]>): string {
  let out = "";
  for (const [c, body] of terms) {
    if (c === 0) continue;
    const t = body.startsWith("/") ? `${Math.abs(c)}${body}` : coefText(c, body);
    out += out === "" ? (c < 0 ? `−${t}` : t) : c < 0 ? ` − ${t}` : ` + ${t}`;
  }
  return out === "" ? "0" : out;
}

const nz = (rng: Rng, lo: number, hi: number) => {
  for (;;) {
    const v = rng.int(lo, hi);
    if (v !== 0) return v;
  }
};
const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
const xPow = (n: number) => (n === 1 ? "x" : `x^${n}`);

// ---------------------------------------------------------------- Derivadas

function derivativeTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    switch (rng.int(0, 3)) {
      case 0: {
        const n = rng.int(3, 5);
        return sumText([
          [nz(rng, -5, 5), xPow(n)],
          [rng.int(-6, 6), "x^2"],
          [rng.int(-9, 9), "x"],
          [rng.int(-9, 9), ""],
        ]);
      }
      case 1:
        return sumText([
          [nz(rng, -5, 5), rng.pick(["sen(x)", "cos(x)"])],
          [nz(rng, -4, 4), "e^x"],
          [rng.int(-5, 5), "x^2"],
        ]);
      case 2:
        return sumText([
          [nz(rng, -6, 6), "ln(x)"],
          [nz(rng, -4, 4), xPow(rng.int(2, 4))],
        ]);
      default:
        return sumText([
          [nz(rng, 1, 6), "sqrt(x)"],
          [nz(rng, -6, 6), "/x"],
          [rng.int(-4, 4), "x"],
        ]);
    }
  }
  const a = nz(rng, 1, 4);
  const b = nz(rng, -5, 5);
  const n = rng.int(2, 5);
  if (level === "medio") {
    return rng.pick([
      `${xPow(rng.int(1, 3))} ${rng.pick(["sen(x)", "cos(x)", "e^x"])}`,
      `${xPow(rng.int(1, 2))} ln(x)`,
      `(${a}x ${signed(b)})^${n}`,
      `${rng.pick(["sen", "cos"])}(${a}x^2)`,
      `e^(${a === 1 ? "" : a}x^2 ${signed(b)})`,
      `ln(${a}x^2 + ${Math.abs(b)})`,
      `(x ${signed(b)})/(x ${signed(nz(rng, -5, 5))})`,
      `x^2/(x ${signed(b)})`,
    ]);
  }
  return rng.pick([
    `${xPow(rng.int(1, 3))} e^(${b}x)`,
    `e^(${b}x) ${rng.pick(["sen", "cos"])}(${a}x)`,
    `sqrt(x^2 + ${a * a})`,
    `x/(x^2 + ${a})`,
    `${rng.pick(["sen", "cos"])}(${a}x)^${n}`,
    `e^(${rng.pick(["sen", "cos"])}(x))`,
    `x^2 ln(${a}x)`,
    `1/(1 + e^(${-a}x))`,
    `x (x^2 ${signed(b)})^${n}`,
    `ln(${rng.pick(["sen", "cos"])}(x)^2 + ${a})`,
  ]);
}

const definedSomewhere = (f: Expr) => [0.3, 0.7, 1.3, 2.1].some((x) => Number.isFinite(evaluate(f, { x })));

export const CALC_DERIVATIVE: ExerciseType<CalcFnInstance> = {
  id: "calculo-derivada",
  topic: "calculo",
  title: "Derivada por reglas",
  description: "Deriva paso a paso, eligiendo en cada línea la regla (suma, producto, cociente, potencia, cadena…), o escribe solo el resultado.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-derivada", seed),
      (r) => derivativeTemplate(r, level),
      (text) => {
        const e = calcExpr(text);
        return definedSomewhere(e) && exprSize(derivativeTidy(e)) <= 60 && derivativeTidy(e).k !== "num";
      },
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Recta tangente

function tangentTemplate(rng: Rng, level: ExerciseLevel): CalcTangentInstance {
  if (level === "básico") {
    return { f: sumText([[nz(rng, -3, 3), "x^2"], [rng.int(-6, 6), "x"], [rng.int(-6, 6), ""]]), x0: rng.int(-2, 3) };
  }
  if (level === "medio") {
    return { f: sumText([[nz(rng, -2, 2), "x^3"], [rng.int(-3, 3), "x^2"], [rng.int(-6, 6), "x"], [rng.int(-5, 5), ""]]), x0: rng.int(-2, 2) };
  }
  const a = nz(rng, 1, 3);
  const b = rng.int(2, 4);
  return rng.pick([
    { f: `x e^(${a}x)`, x0: 0 },
    { f: `x ln(x)`, x0: 1 },
    { f: `${xPow(rng.int(2, 3))} ln(x)`, x0: 1 },
    { f: `${rng.pick(["sen", "cos"])}(${a}x) + x^2`, x0: 0 },
    { f: `ln(${a}x + 1)`, x0: 0 },
    { f: `sqrt(x + ${b * b})`, x0: 0 },
    { f: `(x + ${a})/(x + ${b})`, x0: 0 },
    { f: `e^(x^2 - ${a}x)`, x0: rng.pick([0, a]) },
  ]);
}

export const CALC_TANGENT: ExerciseType<CalcTangentInstance> = {
  id: "calculo-tangente",
  topic: "calculo",
  title: "Recta tangente",
  description: "Calcula f(x₀), la pendiente f′(x₀) y la ecuación de la recta tangente y = f(x₀) + f′(x₀)(x − x₀); la ves dibujada sobre la curva.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-tangente", seed),
      (r) => tangentTemplate(r, level),
      (t) => {
        const e = calcExpr(t.f);
        return niceValue(evaluate(e, { x: t.x0 })) && niceValue(evaluate(derivative(e), { x: t.x0 }));
      },
    );
  },
};

// ---------------------------------------------------------------- Primitivas

function antiderivativeTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    const top = rng.int(2, 4);
    return sumText([
      [(top + 1) * nz(rng, -3, 3), xPow(top)],
      [rng.int(-4, 4) * (rng.chance(0.5) ? 3 : 1), top > 2 ? "x^2" : ""],
      [rng.int(-6, 6), "x"],
      [rng.int(-6, 6), ""],
    ]);
  }
  if (level === "medio") {
    const pool: Array<[number, string]> = [
      [nz(rng, -3, 3) * 3, "sqrt(x)"],
      [nz(rng, -5, 5), "/x"],
      [nz(rng, -4, 4), "e^x"],
      [nz(rng, -4, 4), "sen(x)"],
      [nz(rng, -4, 4), "cos(x)"],
      [nz(rng, -3, 3), "/x^2"],
      [nz(rng, -3, 3) * 2, "x"],
    ];
    return sumText(rng.shuffle(pool).slice(0, rng.int(2, 3)));
  }
  const a = nz(rng, 2, 4);
  const b = nz(rng, -3, 3);
  const pool = [
    `e^(${a}x)`,
    `${rng.pick(["sen", "cos"])}(${a}x ${signed(b)})`,
    `${a}/(${a}x ${signed(b)})`,
    `(${a}x ${signed(b)})^${rng.int(2, 3)}`,
    `1/(x ${signed(b)})^2`,
    `sqrt(${a}x + ${Math.abs(b)})`,
  ];
  const picked = rng.shuffle(pool).slice(0, 2);
  return picked.join(rng.chance(0.5) ? " + " : " − ");
}

export const CALC_ANTIDERIVATIVE: ExerciseType<CalcFnInstance> = {
  id: "calculo-primitiva",
  topic: "calculo",
  title: "Primitiva",
  description: "Escribe una primitiva F(x) (con + C si quieres): se comprueba derivándola, así que vale cualquier forma equivalente.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-primitiva", seed),
      (r) => antiderivativeTemplate(r, level),
      (text) => antiderivative(calcExpr(text)) !== null && definedSomewhere(calcExpr(text)),
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Integral definida

function integralTemplate(rng: Rng, level: ExerciseLevel): CalcIntegralInstance {
  if (level !== "avanzado") {
    const a = rng.int(-2, 1);
    const b = a + rng.int(1, 3);
    const f =
      level === "básico"
        ? sumText([[nz(rng, -3, 3), "x^2"], [rng.int(-4, 4), "x"], [rng.int(-4, 4), ""]])
        : sumText([[nz(rng, -2, 2), "x^3"], [rng.int(-3, 3), "x^2"], [rng.int(-4, 4), "x"], [rng.int(-3, 3), ""]]);
    return { f, a: String(a), b: String(b) };
  }
  const k = rng.int(1, 4);
  const kx = k === 1 ? "" : String(k);
  return rng.pick<CalcIntegralInstance>([
    { f: `${kx}e^x + ${xPow(rng.int(1, 3))}`, a: "0", b: "1" },
    { f: `e^(${k}x)`, a: "0", b: rng.pick(["1", "2"]) },
    { f: `${k}/x`, a: "1", b: rng.pick(["e", "2", "4", "e^2"]) },
    { f: `${kx}sen(x)`, a: "0", b: rng.pick(["π", "π/2"]) },
    { f: `cos(${k}x)`, a: "0", b: k === 1 ? "π/2" : `π/${2 * k}` },
    { f: `${kx}sqrt(x)`, a: rng.pick(["0", "1"]), b: rng.pick(["4", "9"]) },
    { f: `${k}/(x + 1)`, a: "0", b: rng.pick(["1", "e − 1", "3"]) },
    { f: `e^(-x)`, a: "0", b: rng.pick(["1", "ln(2)", "2"]) },
  ]);
}

export const CALC_DEFINITE: ExerciseType<CalcIntegralInstance> = {
  id: "calculo-integral",
  topic: "calculo",
  title: "Integral definida",
  description: "Calcula ∫ₐᵇ f(x) dx con la regla de Barrow; escribe el número (con tres decimales) o el valor exacto (como 7/2, 2 + ln 3 o π/6).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-integral", seed),
      (r) => integralTemplate(r, level),
      (inst) => {
        const v = definiteIntegral(calcExpr(inst.f), calcNumber(inst.a), calcNumber(inst.b));
        // En básico y medio, un número racional cómodo y no nulo.
        return Number.isFinite(v) && Math.abs(v) > 1e-9 && (level === "avanzado" || niceValue(v, 12, 80));
      },
    );
  },
};

// ---------------------------------------------------------------- Gradiente

function gradientTemplate(rng: Rng, level: ExerciseLevel): CalcGradientInstance {
  const point: [number, number] = [rng.int(-2, 2), rng.int(-2, 2)];
  if (level === "básico") {
    return {
      f: sumText([
        [nz(rng, -3, 3), rng.pick(["x^2 y", "x y^2", "x y"])],
        [rng.int(-3, 3), "x^2"],
        [rng.int(-3, 3), "y^2"],
        [rng.int(-5, 5), rng.pick(["x", "y"])],
      ]),
      point,
    };
  }
  if (level === "medio") {
    return {
      f: sumText([
        [nz(rng, -3, 3), rng.pick(["x^3 y", "x^2 y^2", "x y^3", "x^2 y"])],
        [nz(rng, -4, 4), rng.pick(["x y", "x^3", "y^3"])],
        [rng.int(-4, 4), rng.pick(["x", "y", "y^2"])],
      ]),
      point,
    };
  }
  const p = rng.int(-2, 2);
  return rng.pick<CalcGradientInstance>([
    { f: `x e^(x - y)`, point: [p, p] },
    { f: `y e^(x y) + x^2`, point: [0, rng.int(-2, 2)] },
    { f: `sen(x y) + ${nz(rng, -3, 3)}x`, point: [0, rng.int(-2, 2)] },
    { f: `ln(x^2 + y^2)`, point: rng.pick<[number, number]>([[1, 0], [0, 1], [1, 1], [2, 0], [1, -1]]) },
    { f: `x^2 e^y - ${nz(rng, 1, 3)}x y`, point: [rng.int(-2, 2), 0] },
    { f: `cos(x - y) + x y^2`, point: [p, p] },
  ]);
}

export const CALC_GRADIENT: ExerciseType<CalcGradientInstance> = {
  id: "calculo-gradiente",
  topic: "calculo",
  title: "Derivadas parciales y gradiente",
  description: "Calcula ∂f/∂x y ∂f/∂y (la otra variable queda como constante) y el gradiente ∇f en un punto.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-gradiente", seed),
      (r) => gradientTemplate(r, level),
      (inst) => {
        const e = calcExpr(inst.f, ["x", "y"]);
        const at = { x: inst.point[0], y: inst.point[1] };
        const g = [derivative(e, "x"), derivative(e, "y")].map((d) => evaluate(d, at));
        // Las dos parciales tienen que depender de algo (no ser 0) y valer números cómodos en el punto.
        return g.every((v) => niceValue(v)) && g.some((v) => v !== 0) && derivative(e, "x").k !== "num" && derivative(e, "y").k !== "num";
      },
    );
  },
};

// ---------------------------------------------------------------- Puntos críticos

function criticalTemplate(rng: Rng, level: ExerciseLevel): string {
  if (level === "básico") {
    // a(x − p)² + b(x − p)(y − q) + c(y − q)², desarrollado y sin la constante.
    const p = rng.int(-2, 2);
    const q = rng.int(-2, 2);
    const a = nz(rng, -2, 2);
    const b = rng.int(-2, 2);
    const c = nz(rng, -2, 2);
    return sumText([
      [a, "x^2"],
      [b, "x y"],
      [c, "y^2"],
      [-2 * a * p - b * q, "x"],
      [-2 * c * q - b * p, "y"],
    ]);
  }
  if (level === "medio") {
    // Separada: una cúbica x³ − 3r²x (críticos en ±r) más una parábola k(y − s)² (sin la constante),
    // o al revés.
    const r = rng.int(1, 2);
    const s = rng.int(-2, 2);
    const k = nz(rng, -2, 2);
    return rng.chance(0.5)
      ? sumText([[1, "x^3"], [-3 * r * r, "x"], [k, "y^2"], [-2 * k * s, "y"]])
      : sumText([[k, "x^2"], [-2 * k * s, "x"], [1, "y^3"], [-3 * r * r, "y"]]);
  }
  // x³ + c·x² + a·xy + b·y² + d·x + e·y con a = ±2, b = ±1 y e par: ∂f/∂y = 0 da y = −(a·x + e)/(2b),
  // y al sustituir queda 3(x − r₁)(x − r₂) = 0 eligiendo c y d. Dos puntos críticos enteros.
  const sA = rng.pick([1, -1]);
  const b = rng.pick([1, -1]);
  const e = 2 * rng.int(-2, 2);
  const r1 = rng.int(-3, 3);
  let r2 = r1 + 2 * rng.pick([-2, -1, 1, 2]);
  if (r2 > 3 || r2 < -3) r2 = r1 - (r2 - r1);
  const a = 2 * sA;
  const c = b - (3 * (r1 + r2)) / 2;
  const d = 3 * r1 * r2 + sA * e * b;
  return sumText([
    [1, "x^3"],
    [c, "x^2"],
    [a, "x y"],
    [b, "y^2"],
    [d, "x"],
    [e, "y"],
  ]);
}

export const CALC_CRITICAL: ExerciseType<CalcFnInstance> = {
  id: "calculo-criticos",
  topic: "calculo",
  title: "Puntos críticos y hessiana",
  description: "Resuelve ∇f = 0 y clasifica cada punto crítico con el determinante de la hessiana: mínimo, máximo o punto de silla.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const f = generateUntil(
      rngFor("calculo-criticos", seed),
      (r) => criticalTemplate(r, level),
      (text) => {
        const r = criticalPoints(calcExpr(text, ["x", "y"]));
        if (!r.ok || r.points.length === 0 || r.points.length > 4) return false;
        if (r.points.some((p) => p.kind === "no-concluyente" || p.x.d !== 1n || p.y.d !== 1n)) return false;
        if (r.points.some((p) => Math.abs(Number(p.x.n)) > 4 || Math.abs(Number(p.y.n)) > 4)) return false;
        // En avanzado, al menos dos puntos.
        return level !== "avanzado" || r.points.length >= 2;
      },
    );
    return { f };
  },
};

// ---------------------------------------------------------------- Descenso de gradiente

function descentTemplate(rng: Rng, level: ExerciseLevel): CalcDescentInstance {
  if (level === "básico") {
    return {
      f: sumText([[rng.pick([1, 2]), "x^2"], [rng.int(-8, 8), "x"], [rng.int(0, 5), ""]]),
      start: [rng.int(-3, 3)],
      alpha: rng.pick([0.1, 0.25]),
      steps: 2,
    };
  }
  if (level === "medio") {
    return {
      f: rng.pick([sumText([[1, "x^3"], [-3 * rng.int(1, 2), "x"]]), sumText([[1, "x^4"], [-rng.int(1, 4) * 2, "x^2"]]), sumText([[1, "x^3"], [rng.int(-3, 3), "x^2"]])]),
      start: [rng.pick([-2, -1, 1, 2])],
      alpha: rng.pick([0.1, 0.05]),
      steps: 2,
    };
  }
  return {
    f: sumText([
      [rng.pick([1, 2]), "x^2"],
      [rng.pick([1, 2, 3]), "y^2"],
      [rng.int(-1, 1), "x y"],
      [rng.int(-4, 4), "x"],
      [rng.int(-4, 4), "y"],
    ]),
    start: [rng.int(-2, 2), rng.int(-2, 2)],
    alpha: rng.pick([0.1, 0.25]),
    steps: 2,
  };
}

/** ¿Decimal con como mucho 4 cifras? (el denominador divide a 10⁴). */
const shortDecimal = (x: Frac) => 10000n % x.d === 0n;

export const CALC_DESCENT: ExerciseType<CalcDescentInstance> = {
  id: "calculo-descenso",
  topic: "calculo",
  title: "Paso de descenso de gradiente",
  description: "Haz a mano las primeras iteraciones xₖ₊₁ = xₖ − α·∇f(xₖ): calcula x₁ y x₂.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-descenso", seed),
      (r) => descentTemplate(r, level),
      (inst) => {
        const vars: VarName[] = inst.start.length === 2 ? ["x", "y"] : ["x"];
        const steps = exactDescentSteps(calcExpr(inst.f, vars), inst.start.map((s) => frac(BigInt(s))), alphaFrac(inst.alpha), inst.steps);
        if (!steps) return false;
        const flat = steps.slice(1).flat();
        // Que se mueva (∇f(x₀) ≠ 0), con decimales cortos y sin salir disparado.
        const moved = steps[1]!.some((v, i) => v.n * steps[0]![i]!.d !== steps[0]![i]!.n * v.d);
        return moved && flat.every((v) => shortDecimal(v) && Math.abs(Number(v.n) / Number(v.d)) <= 30);
      },
    );
  },
};


// ================================================================ Teoría (tipo examen)
//
// Preguntas como las del examen final: opción múltiple a)–d) con una correcta (a veces cinco con
// «Ninguna de las otras», o «selecciona la o las correctas») y respuestas numéricas exactas o
// redondeadas a dos decimales. La instancia guarda el enunciado (las funciones, el punto, las
// afirmaciones con sus números); qué opción es correcta lo decide el motor al montar la pregunta.

/** Número para enseñar: fracción si es cómoda (3/4), si no decimal con coma. */
export function niceText(v: number): string {
  if (v === Infinity) return "+∞";
  if (v === -Infinity) return "−∞";
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9) return (d === 1 ? String(n) : `${n}/${d}`).replace("-", "−");
  }
  return String(Number(v.toFixed(4))).replace(".", ",").replace("-", "−");
}

export function niceTex(v: number): string {
  if (v === Infinity) return "+\\infty";
  if (v === -Infinity) return "-\\infty";
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-9) return d === 1 ? String(n) : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
  }
  return String(Number(v.toFixed(4))).replace(".", "{,}");
}

/** Generador determinista a partir de la instancia (para elegir distractores al montar la pregunta). */
const rngOf = (inst: unknown) => createRng(seedFromKey(JSON.stringify(inst)));

const opt = (id: string, text: string, tex: string | undefined, correct: boolean, why?: string): ChoiceOption => ({ id, text, ...(tex ? { tex } : {}), correct, ...(why ? { why } : {}) });

// ---------------------------------------------------------------- Funciones a trozos

/** Una afirmación sobre f en x = a; las que llevan número dicen «vale v». */
export type PiecewiseClaim =
  | { k: "izq" | "der" | "valor" | "dizq" | "dder"; v: number }
  | { k: "existe" | "continua" | "derivable" | "no-continua" | "no-derivable" };

export type CalcPiecewiseInstance = {
  a: number;
  left: string;
  right: string;
  /** Qué trozo vale en a, o el valor de f(a) aparte. */
  at: "izquierda" | "derecha" | string;
  /** «falsa»: ¿cuál es falsa? (una); «verdadera»: ¿cuál es verdadera? (una); «varias»: la o las verdaderas. */
  ask: "falsa" | "verdadera" | "varias";
  claims: PiecewiseClaim[];
};

export function calcPiecewise(inst: Pick<CalcPiecewiseInstance, "a" | "left" | "right" | "at">): Piecewise {
  return {
    a: inst.a,
    left: calcExpr(inst.left),
    right: calcExpr(inst.right),
    atPoint: inst.at === "izquierda" || inst.at === "derecha" ? inst.at : calcExpr(inst.at),
  };
}

const limitIs = (l: LimitValue, v: number) => l.kind === "finito" && Math.abs(l.value - v) < 1e-7;

/** ¿Es verdadera la afirmación? (según el motor). */
export function piecewiseClaimTruth(an: PiecewiseAnalysis, c: PiecewiseClaim): boolean {
  switch (c.k) {
    case "izq":
      return limitIs(an.left, c.v);
    case "der":
      return limitIs(an.right, c.v);
    case "valor":
      return Number.isFinite(an.value) && Math.abs(an.value - c.v) < 1e-7;
    case "dizq":
      return an.continuous && limitIs(an.dLeft, c.v);
    case "dder":
      return an.continuous && limitIs(an.dRight, c.v);
    case "existe":
      return an.limit.kind === "finito";
    case "continua":
      return an.continuous;
    case "no-continua":
      return !an.continuous;
    case "derivable":
      return an.differentiable;
    case "no-derivable":
      return !an.differentiable;
  }
}

export function piecewiseClaimText(c: PiecewiseClaim, a: number): { text: string; tex: string } {
  const A = niceText(a);
  const At = niceTex(a);
  switch (c.k) {
    case "izq":
      return { text: `El límite de f cuando x tiende a ${A} por la izquierda vale ${niceText(c.v)}`, tex: `\\lim_{x\\to ${At}^-} f(x) = ${niceTex(c.v)}` };
    case "der":
      return { text: `El límite de f cuando x tiende a ${A} por la derecha vale ${niceText(c.v)}`, tex: `\\lim_{x\\to ${At}^+} f(x) = ${niceTex(c.v)}` };
    case "valor":
      return { text: `f(${A}) = ${niceText(c.v)}`, tex: `f(${At}) = ${niceTex(c.v)}` };
    case "dizq":
      return { text: `f es continua en ${A} y su derivada lateral por la izquierda vale ${niceText(c.v)}`, tex: `f'(${At}^-) = ${niceTex(c.v)}` };
    case "dder":
      return { text: `f es continua en ${A} y su derivada lateral por la derecha vale ${niceText(c.v)}`, tex: `f'(${At}^+) = ${niceTex(c.v)}` };
    case "existe":
      return { text: `Existe el límite de f cuando x tiende a ${A}`, tex: `\\text{Existe } \\lim_{x\\to ${At}} f(x)` };
    case "continua":
      return { text: `f es continua en x = ${A}`, tex: `f \\text{ es continua en } x = ${At}` };
    case "no-continua":
      return { text: `f no es continua en x = ${A}`, tex: `f \\text{ no es continua en } x = ${At}` };
    case "derivable":
      return { text: `f es derivable en x = ${A}`, tex: `f \\text{ es derivable en } x = ${At}` };
    case "no-derivable":
      return { text: `f no es derivable en x = ${A}`, tex: `f \\text{ no es derivable en } x = ${At}` };
  }
}

const PIECEWISE_WHY: Record<PiecewiseClaim["k"], string> = {
  izq: "Límite por la izquierda: usa la fórmula de x < a y sustituye (o resuelve la indeterminación).",
  der: "Límite por la derecha: usa la fórmula de x > a.",
  valor: "f(a) es el valor de la fórmula que incluye a x = a (o el valor dado aparte).",
  dizq: "Derivada lateral: deriva el trozo de la izquierda y toma su límite en a (si f es continua en a).",
  dder: "Derivada lateral: deriva el trozo de la derecha y toma su límite en a (si f es continua en a).",
  existe: "El límite existe si los dos laterales existen y coinciden.",
  continua: "Continua: existe el límite y coincide con f(a).",
  "no-continua": "Continua: existe el límite y coincide con f(a).",
  derivable: "Derivable: continua y con las dos derivadas laterales iguales (y finitas).",
  "no-derivable": "Derivable: continua y con las dos derivadas laterales iguales (y finitas).",
};

export const PIECEWISE_ASK: Record<CalcPiecewiseInstance["ask"], string> = {
  falsa: "¿Cuál de estas afirmaciones es FALSA?",
  verdadera: "¿Cuál de estas afirmaciones es VERDADERA?",
  varias: "Selecciona la o las afirmaciones verdaderas.",
};

export function piecewiseQuestion(inst: CalcPiecewiseInstance): ChoiceQuestion {
  const an = analyzePiecewise(calcPiecewise(inst));
  return {
    mode: inst.ask === "varias" ? "multi" : "single",
    options: inst.claims.map((c, i) => {
      const truth = piecewiseClaimTruth(an, c);
      const { text, tex } = piecewiseClaimText(c, inst.a);
      return opt(`c${i}`, text, tex, inst.ask === "falsa" ? !truth : truth, `${truth ? "Verdadera" : "Falsa"}. ${PIECEWISE_WHY[c.k]}`);
    }),
  };
}

/** Lo que tiene el enunciado de una función a trozos: «cociente» si algún trozo divide. */
export const piecewiseTokens = (inst: Pick<CalcPiecewiseInstance, "left" | "right">): string[] => (inst.left.includes("/") || inst.right.includes("/") ? ["cociente"] : []);

const PIECEWISE_HINTS: readonly TaggedHint[] = [
  { text: "Límite por la izquierda: usa la fórmula de los x < a; por la derecha, la de los x > a." },
  { needs: ["cociente"], text: "Si al sustituir en un cociente sale 0/0, simplifica o usa L'Hôpital." },
  { text: "El límite en a existe si los dos laterales existen y valen lo mismo. Continua: además, ese límite es f(a)." },
  { text: "Derivable en a: tiene que ser continua y las dos derivadas laterales (la derivada de cada trozo, en a) tienen que coincidir." },
];

export const piecewiseHints = (inst: CalcPiecewiseInstance): string[] => pickHints(PIECEWISE_HINTS, piecewiseTokens(inst));

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** x^2 → x²: exponentes enteros como superíndices, para leer la fórmula en una frase. */
const supPlain = (t: string) => t.replace(/\^(\d+)/g, (_, d: string) => [...d].map((c) => SUPS[Number(c)]).join(""));

/**
 * La solución con los números: los dos límites laterales, f(a), el límite, la continuidad y, si es
 * continua, las dos derivadas laterales.
 */
export function piecewiseSolution(inst: CalcPiecewiseInstance): string[] {
  const an = analyzePiecewise(calcPiecewise(inst));
  const A = niceText(inst.a);
  const lim = (l: LimitValue) => limitText(l, niceText);
  const L = supPlain(toPlain(calcExpr(inst.left)));
  const R = supPlain(toPlain(calcExpr(inst.right)));
  const source = inst.at === "izquierda" ? `con la fórmula de la izquierda, que incluye x = ${A}` : inst.at === "derecha" ? `con la fórmula de la derecha, que incluye x = ${A}` : "es el valor que se da aparte";
  const out = [
    `Por la izquierda (f(x) = ${L}): lím x→${A}⁻ f(x) = ${lim(an.left)}.`,
    `Por la derecha (f(x) = ${R}): lím x→${A}⁺ f(x) = ${lim(an.right)}.`,
    `f(${A}) = ${Number.isFinite(an.value) ? niceText(an.value) : "no está definida"} (${source}).`,
    an.limit.kind === "finito" ? `Los dos laterales valen ${lim(an.limit)}: el límite en x = ${A} existe y vale ${lim(an.limit)}.` : `Los laterales no coinciden: el límite en x = ${A} no existe.`,
    an.continuous
      ? `El límite coincide con f(${A}): f es continua en x = ${A}.`
      : an.limit.kind === "finito"
        ? `El límite no coincide con f(${A}): f no es continua en x = ${A}.`
        : `Sin límite, f no es continua en x = ${A}.`,
  ];
  out.push(
    an.continuous
      ? `Derivadas laterales: f′(${A}⁻) = ${lim(an.dLeft)} y f′(${A}⁺) = ${lim(an.dRight)}; ${an.differentiable ? `coinciden, así que f es derivable en x = ${A}.` : `no coinciden (o no son finitas), así que f no es derivable en x = ${A}.`}`
      : `Como no es continua en x = ${A}, tampoco es derivable.`,
  );
  return out;
}

/** Plantillas: [izquierda, derecha, a, qué vale en a]. */
function piecewiseTemplate(rng: Rng, level: ExerciseLevel): Pick<CalcPiecewiseInstance, "a" | "left" | "right" | "at"> {
  const side = rng.pick(["izquierda", "derecha"] as const);
  if (level === "básico") {
    const a = rng.int(-1, 2);
    const p = nz(rng, -2, 2);
    const q = rng.int(-3, 3);
    const left = rng.chance(0.5) ? sumText([[1, "x^2"], [q, ""]]) : sumText([[p, "x"], [q, ""]]);
    const lv = evaluate(calcExpr(left), { x: a });
    const m = nz(rng, -3, 3);
    const k = (rng.chance(0.65) ? lv : lv + nz(rng, -2, 2)) - m * a;
    return { a, left, right: sumText([[m, "x"], [k, ""]]), at: side };
  }
  if (level === "medio") {
    const k = rng.int(1, 3);
    const c = rng.pick([0, 0, 1]);
    const pool: Array<[string, string, number]> = [
      [`${k === 1 ? "" : k}x^2`, `${k === 1 ? "" : k}sqrt(x^2)`, 0],
      ["ln(x + 1) + e^x", `sqrt(x^2 + ${1 + c})`, 0],
      [`e^(${k}x)`, sumText([[rng.int(1, 3), "x"], [1 + c, ""]]), 0],
      ["cos(x)", sumText([[nz(rng, -2, 2), "x^2"], [1 + c, ""]]), 0],
      [`sen(${k}x)`, sumText([[rng.int(1, 3), "x"], [c, ""]]), 0],
      ["ln(x)", sumText([[rng.int(1, 2), "x"], [-rng.int(1, 2) + c, ""]]), 1],
      [`e^(-x^2) - 1`, `${k === 1 ? "" : k}x^2`, 0],
    ];
    const [left, right, a] = rng.pick(pool);
    return rng.chance(0.25) ? { a, left: right.replace(/sqrt\(x\^2\)/, "|x|"), right: left, at: side } : { a, left, right, at: side };
  }
  const v = rng.int(0, 2);
  const k = rng.int(1, 3);
  const b = rng.int(1, 3);
  const pool: Array<Pick<CalcPiecewiseInstance, "a" | "left" | "right" | "at">> = [
    { a: 1, left: "ln(x)", right: "x^2 - 1", at: String(v) },
    { a: b, left: `(x^2 - ${b * b})/(x - ${b})`, right: sumText([[k, "x"], [2 * b - k * b + (rng.chance(0.3) ? 1 : 0), ""]]), at: rng.pick(["derecha", String(2 * b)]) },
    { a: 0, left: `sen(${k}x)/x`, right: sumText([[rng.int(1, 2), "x"], [k, ""]]), at: rng.pick(["derecha", String(k), String(v)]) },
    { a: 0, left: "(e^x - 1)/x", right: "cos(x)", at: rng.pick(["derecha", String(v)]) },
    { a: 2, left: "x e^(x - 2)", right: "x e^(x - 2)", at: String(rng.pick([1, 2, 2])) },
    { a: 0, left: "e^(-x^2) - 1", right: `${k === 1 ? "" : k}x^2`, at: rng.pick(["izquierda", String(v)]) },
  ];
  return rng.pick(pool);
}

/** Afirmaciones posibles: las de valor, a veces con el número bueno y a veces con otro. */
function piecewiseClaims(rng: Rng, an: PiecewiseAnalysis): PiecewiseClaim[] {
  const wrongOf = (v: number) => {
    const others = [an.left, an.right].flatMap((l) => (l.kind === "finito" && Math.abs(l.value - v) > 1e-7 ? [snapNice(l.value)] : []));
    if (Number.isFinite(an.value) && Math.abs(an.value - v) > 1e-7) others.push(an.value);
    others.push(v + rng.pick([-1, 1]), -v === v ? v + 2 : -v);
    return rng.pick(others.filter((x) => Math.abs(x - v) > 1e-7));
  };
  const out: PiecewiseClaim[] = [];
  const valued = (k: "izq" | "der" | "valor" | "dizq" | "dder", l: LimitValue) => {
    if (l.kind !== "finito") return;
    const v = snapNice(l.value);
    out.push({ k, v: rng.chance(0.5) ? v : wrongOf(v) });
  };
  valued("izq", an.left);
  valued("der", an.right);
  if (Number.isFinite(an.value)) valued("valor", { kind: "finito", value: an.value });
  if (an.continuous) {
    valued(rng.pick(["dizq", "dder"] as const), rng.chance(0.5) ? an.dLeft : an.dRight);
  }
  out.push({ k: "existe" }, { k: rng.pick(["continua", "no-continua"] as const) }, { k: rng.pick(["derivable", "no-derivable"] as const) });
  return rng.shuffle(out);
}

export const CALC_PIECEWISE: ExerciseType<CalcPiecewiseInstance> = {
  id: "calculo-trozos",
  topic: "calculo",
  title: "Función a trozos: límites, continuidad y derivabilidad",
  description: "Estudia una función definida a trozos en el punto donde cambia de fórmula: límites laterales, límite, continuidad y derivabilidad (tipo test).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const ask: CalcPiecewiseInstance["ask"] = level === "básico" ? "falsa" : level === "medio" ? "verdadera" : "varias";
    return generateUntil(
      rngFor("calculo-trozos", seed),
      (r) => {
        const base = piecewiseTemplate(r, level);
        const an = analyzePiecewise(calcPiecewise(base));
        if (an.left.kind !== "finito" || an.right.kind !== "finito") return null;
        const pool = piecewiseClaims(r, an);
        const n = ask === "varias" ? r.int(4, 5) : 4;
        const truth = (c: PiecewiseClaim) => piecewiseClaimTruth(an, c);
        // Opción única: exactamente una correcta (la falsa entre verdaderas o al revés).
        let claims: PiecewiseClaim[];
        if (ask === "varias") claims = pool.slice(0, n);
        else {
          const target = ask === "falsa" ? false : true;
          const hit = pool.filter((c) => truth(c) === target);
          const rest = pool.filter((c) => truth(c) !== target);
          if (hit.length === 0 || rest.length < n - 1) return null;
          claims = r.shuffle([hit[0]!, ...rest.slice(0, n - 1)]);
        }
        return { ...base, ask, claims };
      },
      (inst) => {
        const q = piecewiseQuestion(inst);
        const right = q.options.filter((o) => o.correct).length;
        const texts = new Set(q.options.map((o) => o.text));
        return texts.size === q.options.length && (q.mode === "single" ? right === 1 : right >= 1 && right < q.options.length);
      },
    );
  },
};

// ---------------------------------------------------------------- L'Hôpital

export type CalcLhopitalInstance = { num: string; den: string; at: number | "+inf" };

function lhopitalTemplate(rng: Rng, level: ExerciseLevel): CalcLhopitalInstance {
  const k = rng.int(2, 5);
  const b = nz(rng, -3, 3);
  if (level === "básico") {
    return rng.pick<CalcLhopitalInstance>([
      { num: `x^2 - ${b * b}`, den: `x ${signed(-b)}`, at: b },
      { num: `x^3 ${signed(-b * b * b)}`, den: `x^2 - ${b * b}`, at: b },
      { num: `sen(${k}x)`, den: `${rng.pick(["", "2", "3"])}x`, at: 0 },
      { num: `e^(${k}x) - 1`, den: "x", at: 0 },
      { num: `ln(1 + ${k}x)`, den: "x", at: 0 },
    ]);
  }
  if (level === "medio") {
    return rng.pick<CalcLhopitalInstance>([
      { num: `1 - cos(${k}x)`, den: "x^2", at: 0 },
      { num: "e^x - 1 - x", den: `${rng.pick(["", "2", "3"])}x^2`, at: 0 },
      { num: "ln(x)", den: `x^${rng.int(1, 3)} - 1`, at: 1 },
      { num: `e^(${k}x) - e^x`, den: "x", at: 0 },
      { num: `sen(${k}x)`, den: `sen(${rng.int(2, 5)}x)`, at: 0 },
      { num: `x - sen(x)`, den: `x^3`, at: 0 },
    ]);
  }
  const a = rng.int(1, 5);
  const c = rng.int(1, 4);
  return rng.pick<CalcLhopitalInstance>([
    { num: `${a}x^2 + ${rng.int(1, 5)}x`, den: `${c}x^2 ${signed(nz(rng, -5, 5))}`, at: "+inf" },
    { num: `ln(x)`, den: `x^${rng.int(1, 2)}`, at: "+inf" },
    { num: `x^${rng.int(2, 3)}`, den: `e^(${rng.pick(["", "2"])}x)`, at: "+inf" },
    { num: `ln(${a}x + 1)`, den: `ln(x)`, at: "+inf" },
    { num: `${a}e^x + x`, den: `${c}e^x - 1`, at: "+inf" },
    { num: `e^x - 1 - x - x^2/2`, den: "x^3", at: 0 },
  ]);
}

export const lhopitalOf = (inst: CalcLhopitalInstance) => lhopitalSteps(calcExpr(inst.num), calcExpr(inst.den), inst.at);

/** Pistas de L'Hôpital: la primera, según el punto sea finito o +∞. */
export function lhopitalHints(inst: CalcLhopitalInstance): string[] {
  return [
    inst.at === "+inf"
      ? "Mira hacia dónde van el numerador y el denominador cuando x → +∞. Si los dos van a ∞, es una indeterminación."
      : "Sustituye x por el punto en el numerador y en el denominador. Si los dos dan 0, es una indeterminación.",
    "L'Hôpital: lím f/g = lím f′/g′. Deriva numerador y denominador por separado (no es la derivada del cociente).",
    "Si al derivar sigue siendo indeterminado, vuelve a aplicarla.",
  ];
}

export const CALC_LHOPITAL: ExerciseType<CalcLhopitalInstance> = {
  id: "calculo-lhopital",
  topic: "calculo",
  title: "Límites con L'Hôpital",
  description: "Identifica la indeterminación (0/0 o ∞/∞), aplica la regla de L'Hôpital las veces que haga falta y da el límite.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-lhopital", seed),
      (r) => lhopitalTemplate(r, level),
      (inst) => {
        const r = lhopitalOf(inst);
        return r !== null && r.steps.length >= 2 && r.result.kind === "finito" && niceValue(r.result.value, 12, 60);
      },
    );
  },
};

// ---------------------------------------------------------------- Dominio

export type CalcDomainInstance = { f: string; none: boolean };

function domainTemplate(rng: Rng, level: ExerciseLevel): string {
  const a = nz(rng, -4, 4);
  const k = rng.int(1, 4);
  if (level === "básico") return rng.pick([`sqrt(x ${signed(-a)})`, `sqrt(${a} - x)`, `ln(x ${signed(-a)})`, `ln(${a} - x)`, `1/(x ${signed(-a)})`, `${k}/(x^2 - ${k * k})`]);
  if (level === "medio") return rng.pick([`sqrt(${k * k} - x^2)`, `ln(${k * k} - x^2)`, `sqrt(x^2 - ${k * k})`, `ln(x^2 - ${k * k})`, `1/sqrt(x ${signed(-a)})`, `x/(x^2 ${signed(-a)}x)`]);
  const b = a + rng.int(1, 4);
  return rng.pick([
    `sqrt(x ${signed(-a)})/(x ${signed(-b)})`,
    `ln(x ${signed(-a)})/(x ${signed(-b)})`,
    `sqrt((x ${signed(-a)})(x ${signed(-b)}))`,
    `ln(x ${signed(-a)}) + sqrt(${b} - x)`,
    `sqrt(x ${signed(-a)})/ln(x ${signed(-a)})`,
    `1/ln(x ${signed(-a)})`,
  ]);
}

/** Opciones: el dominio y conjuntos parecidos (extremos cambiados, complementario, reflejado, ℝ…). */
export function domainQuestion(inst: CalcDomainInstance): ChoiceQuestion {
  const D = domainOf(calcExpr(inst.f));
  const rng = rngOf(inst);
  const cuts = [...new Set(D.flatMap((i) => [i.lo, i.hi]).filter(Number.isFinite))];
  const cands: IntervalSet[] = [toggleEndpoints(D), complementSet(D), mirrorSet(D), withEndpoints(D, true), withEndpoints(D, false), REALS];
  for (const c of cuts) {
    cands.push(setFromCuts([c], (x) => x > c), setFromCuts([c], (x) => x >= c), setFromCuts([c], (x) => x !== c));
  }
  const seen: IntervalSet[] = [D];
  const distractors: IntervalSet[] = [];
  for (const s of rng.shuffle(cands)) {
    if (s.length === 0 || seen.some((t) => intervalSetEquals(t, s))) continue;
    seen.push(s);
    distractors.push(s);
  }
  const fmt = (s: IntervalSet) => ({ text: intervalSetText(s, niceText), tex: intervalSetTex(s, niceTex) });
  const wrong = distractors.slice(0, inst.none ? 4 : 3).map((s, i) => opt(`d${i}`, fmt(s).text, fmt(s).tex, false));
  // Con «Ninguna de las otras», a veces el dominio no está entre las opciones.
  const options = inst.none && rng.chance(0.3) ? wrong : [opt("dom", fmt(D).text, fmt(D).tex, true), ...wrong.slice(0, 3)];
  return { mode: "single", options, ...(inst.none ? { noneOfOthers: true } : {}) };
}

/** Argumentos de cada sqrt(…) o ln(…) del texto de la función. */
function fnArgs(text: string, name: "sqrt" | "ln"): string[] {
  const out: string[] = [];
  let i = text.indexOf(`${name}(`);
  while (i >= 0) {
    let depth = 0;
    let j = i + name.length;
    for (; j < text.length; j++) {
      if (text[j] === "(") depth++;
      else if (text[j] === ")" && --depth === 0) break;
    }
    out.push(text.slice(i + name.length + 1, j));
    i = text.indexOf(`${name}(`, j);
  }
  return out;
}

/**
 * Lo que tiene la función: «raíz», «ln», «cociente», «parábola» (un polinomio de grado 2 dentro de √ o
 * de ln) y «denominador-cuadrático».
 */
export function domainTokens(inst: Pick<CalcDomainInstance, "f">): string[] {
  const f = inst.f;
  const quadratic = (u: string) => /x\^2|\)\s*\(/.test(u);
  const out: string[] = [];
  if (f.includes("sqrt(")) out.push("raíz");
  if (f.includes("ln(")) out.push("ln");
  if (f.includes("/")) out.push("cociente");
  if ([...fnArgs(f, "sqrt"), ...fnArgs(f, "ln")].some(quadratic)) out.push("parábola");
  if (/\/\(x\^2/.test(f)) out.push("denominador-cuadrático");
  return out;
}

/** Las condiciones de las funciones que tiene f: «√u pide u ≥ 0; un cociente pide denominador ≠ 0». */
export function domainConditions(inst: Pick<CalcDomainInstance, "f">): string[] {
  const t = new Set(domainTokens(inst));
  return [t.has("raíz") ? "√u pide u ≥ 0" : null, t.has("ln") ? "ln u pide u > 0" : null, t.has("cociente") ? "un cociente pide denominador ≠ 0" : null].filter((x): x is string => x !== null);
}

/** Las condiciones en una frase («ln u» se queda en minúscula: es el nombre de la función). */
const sentence = (parts: readonly string[]) => {
  const t = parts.join("; ");
  return `${t.startsWith("ln") ? t : `${t.charAt(0).toUpperCase()}${t.slice(1)}`}.`;
};

/** Pistas del dominio: las condiciones de las funciones que tiene f, nunca las de las que no tiene. */
export function domainHints(inst: Pick<CalcDomainInstance, "f">): string[] {
  const t = new Set(domainTokens(inst));
  const conds = domainConditions(inst);
  const hints: TaggedHint[] = [
    { text: `${sentence(conds)} ${conds.length > 1 ? "Escribe todas las condiciones y júntalas (todas a la vez)." : "Escribe esa condición y resuélvela."}` },
    { needs: ["parábola"], text: `Si dentro ${t.has("raíz") ? "de la raíz" : "del logaritmo"} hay un polinomio de grado 2, mira el signo de la parábola: entre sus raíces tiene un signo y fuera de ellas, el contrario.` },
    { needs: ["denominador-cuadrático"], text: "Factoriza el denominador: f no está definida en ninguna de sus raíces." },
  ];
  const excluded = [t.has("ln") ? "ln 0" : null, t.has("cociente") ? "dividir entre 0" : null].filter((x): x is string => x !== null);
  const included = t.has("raíz") ? ` (√0 = 0 vale${t.has("cociente") ? ", salvo en un denominador" : ""})` : "";
  hints.push({ text: `Corchete [ si el extremo está incluido${included}; paréntesis ( si no${excluded.length > 0 ? ` (${excluded.join(" o ")} no ${excluded.length > 1 ? "valen" : "vale"})` : ""}.` });
  return pickHints(hints, t);
}

export const CALC_DOMAIN: ExerciseType<CalcDomainInstance> = {
  id: "calculo-dominio",
  topic: "calculo",
  title: "Dominio de definición",
  description: "Elige el dominio de una función con raíces, logaritmos y cocientes: lo de dentro de √ no negativo, lo de dentro de ln positivo y el denominador distinto de 0.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-dominio", seed),
      (r) => ({ f: domainTemplate(r, level), none: level === "avanzado" }),
      (inst) => {
        const D = domainOf(calcExpr(inst.f));
        if (D.length === 0 || intervalSetEquals(D, REALS)) return false;
        const q = domainQuestion(inst);
        return q.options.length >= (inst.none ? 4 : 4) && new Set(q.options.map((o) => o.text)).size === q.options.length;
      },
    );
  },
};

// ---------------------------------------------------------------- Bisección

export type CalcBisectionInstance = { f: string; a: number; b: number; ask: "longitud" | "intervalo" | "iteraciones"; k: number; eps: number };

function bisectionTemplate(rng: Rng, level: ExerciseLevel): CalcBisectionInstance {
  const c = rng.int(2, 9);
  const fs: Array<[string, number, number]> = [
    [`x^2 - ${c}`, Math.floor(Math.sqrt(c)), Math.floor(Math.sqrt(c)) + 1],
    [`x^3 - x - ${rng.int(1, 3)}`, 1, 2],
    [`x^3 + ${rng.int(1, 3)}x - ${rng.int(2, 8)}`, 0, 2],
    [`e^x - ${c}`, 0, 3],
    ["cos(x) - x", 0, 1],
    [`ln(x) + x - ${rng.int(2, 3)}`, 1, 3],
  ];
  const [f, a0, b0] = rng.pick(level === "avanzado" ? fs : fs.slice(0, 3));
  const widen = level === "básico" ? rng.pick([0, 1, 2]) : 0;
  const a = a0 - (widen === 2 ? 1 : 0);
  const b = b0 + (widen >= 1 ? 1 : 0);
  if (level === "básico") return { f, a, b, ask: "longitud", k: rng.int(2, 6), eps: 0 };
  if (level === "medio") return { f, a, b, ask: "intervalo", k: rng.int(2, 3), eps: 0 };
  return rng.chance(0.5) ? { f, a, b, ask: "iteraciones", k: 0, eps: rng.pick([0.1, 0.05, 0.01, 0.001]) } : { f, a, b, ask: "intervalo", k: 3, eps: 0 };
}

export const bisectionOf = (inst: CalcBisectionInstance, k = inst.k) => bisection(compile(calcExpr(inst.f)), inst.a, inst.b, k);

export const CALC_BISECTION: ExerciseType<CalcBisectionInstance> = {
  id: "calculo-biseccion",
  topic: "calculo",
  title: "Método de bisección",
  description: "Aplica el método de bisección: longitud del intervalo tras k iteraciones, intervalo donde queda la raíz o iteraciones necesarias para una tolerancia.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-biseccion", seed),
      (r) => bisectionTemplate(r, level),
      (inst) => {
        const steps = bisectionOf(inst, Math.max(inst.k, 3));
        // Signos claros en cada punto medio (nada de f(m) casi 0) y la raíz nunca en un punto medio.
        return steps !== null && steps.every((s) => Math.abs(s.fm) > 0.02 && Math.abs(s.fa) > 0.02 && Math.abs(s.fb) > 0.02);
      },
    );
  },
};

// ---------------------------------------------------------------- Regla de la cadena

/**
 * «curva»: c: ℝ → ℝ² y h: ℝ² → ℝ; se pide [h∘c]′(t₀). Los datos van en números (c(t₀), c′(t₀) y el
 * gradiente de h en c(t₀) y en otro punto, para despistar) o con fórmulas.
 * «jacobiana»: m: ℝ² → ℝ² con fórmulas y ∇h en m(p); se pide ∂[h∘m]/∂x + ∂[h∘m]/∂y en p.
 * `outer` es el nombre de h (f o g): la composición que se pide es la que tiene sentido.
 */
export type CalcChainInstance =
  | {
      kind: "curva";
      outer: "f" | "g";
      t0: number;
      h: string | null;
      curve: [string, string] | null;
      point: [number, number];
      velocity: [number, number];
      grad: [number, number] | null;
      decoy: { at: [number, number]; grad: [number, number] } | null;
    }
  | { kind: "jacobiana"; outer: "f" | "g"; p: [number, number]; map: [string, string]; grad: [number, number] };

/** Una componente de la curva escrita en t: se lee con x en su lugar. */
export const curveExpr = (text: string): Expr => calcExpr(text.replace(/(?<![a-z])t(?![a-z])/g, "x"));
/** Su TeX con t (toTex solo escribe «x» para la variable). */
export const curveTex = (text: string): string => toTex(curveExpr(text)).replace(/x/g, "t");

export function chainAnswer(inst: CalcChainInstance): number {
  if (inst.kind === "jacobiana") {
    const map = [calcExpr(inst.map[0], ["x", "y"]), calcExpr(inst.map[1], ["x", "y"])] as const;
    const [dx, dy] = chainRuleJacobian(inst.grad, jacobianAt(map, inst.p));
    return dx + dy;
  }
  if (inst.curve) {
    const curve = [curveExpr(inst.curve[0]), curveExpr(inst.curve[1])] as const;
    if (inst.h) return chainRuleAt(calcExpr(inst.h, ["x", "y"]), curve, inst.t0).value;
  }
  const grad = inst.grad ?? (() => {
    const h = calcExpr(inst.h!, ["x", "y"]);
    const at = { x: inst.point[0], y: inst.point[1] };
    return [evaluate(derivative(h, "x"), at), evaluate(derivative(h, "y"), at)] as [number, number];
  })();
  return chainRule(grad, inst.velocity);
}

const vecPlain = (v: readonly number[]) => `(${v.map(niceText).join(", ")})`;
/** Factor de un producto: entre paréntesis si es negativo. */
const factor = (x: number) => (x < 0 ? `(${niceText(x)})` : niceText(x));

/** El gradiente de h en el punto c(t₀): el del enunciado o, si h viene con fórmula, calculado. */
export function chainGradient(inst: Extract<CalcChainInstance, { kind: "curva" }>): [number, number] {
  if (inst.grad) return inst.grad;
  const h = calcExpr(inst.h!, ["x", "y"]);
  const at = { x: inst.point[0], y: inst.point[1] };
  return [snapNice(evaluate(derivative(h, "x"), at)), snapNice(evaluate(derivative(h, "y"), at))];
}

/** La solución con los valores intermedios: el punto, ∇h evaluado en él (o la jacobiana) y el producto. */
export function chainSolution(inst: CalcChainInstance): string[] {
  const h = inst.outer;
  const c = h === "f" ? "g" : "f";
  if (inst.kind === "jacobiana") {
    const map = [calcExpr(inst.map[0], ["x", "y"]), calcExpr(inst.map[1], ["x", "y"])] as const;
    const J = jacobianAt(map, inst.p).map((r) => r.map((x) => snapNice(x)));
    const [g0, g1] = inst.grad;
    const dx = g0 * J[0]![0]! + g1 * J[1]![0]!;
    const dy = g0 * J[0]![1]! + g1 * J[1]![1]!;
    return [
      `∇${h}(${c}(p)) = ${vecPlain(inst.grad)}, con p = ${vecPlain(inst.p)} (dato del enunciado).`,
      `J${c}(p) = (${J[0]!.map(niceText).join("  ")}; ${J[1]!.map(niceText).join("  ")}): en cada fila, las parciales de una componente de ${c} en p.`,
      `∇(${h}∘${c})(p) = ∇${h}(${c}(p))·J${c}(p) = (${factor(g0)}·${factor(J[0]![0]!)} + ${factor(g1)}·${factor(J[1]![0]!)}, ${factor(g0)}·${factor(J[0]![1]!)} + ${factor(g1)}·${factor(J[1]![1]!)}) = ${vecPlain([dx, dy])}.`,
      `∂(${h}∘${c})/∂x + ∂(${h}∘${c})/∂y = ${niceText(dx)} + ${factor(dy)} = ${niceText(dx + dy)}.`,
    ];
  }
  const t0 = niceText(inst.t0);
  const g = chainGradient(inst);
  const [v0, v1] = inst.velocity;
  return [
    `${c}(${t0}) = ${vecPlain(inst.point)} y ${c}′(${t0}) = ${vecPlain(inst.velocity)}.`,
    inst.h
      ? `∇${h} = (∂${h}/∂x, ∂${h}/∂y), evaluado en ${c}(${t0}) = ${vecPlain(inst.point)}: ∇${h}${vecPlain(inst.point)} = ${vecPlain(g)}.`
      : `El gradiente va en el punto ${c}(${t0}) = ${vecPlain(inst.point)}${inst.decoy ? " (no en el otro punto del enunciado)" : ""}: ∇${h}${vecPlain(inst.point)} = ${vecPlain(g)}.`,
    `[${h}∘${c}]′(${t0}) = ∇${h}(${c}(${t0}))·${c}′(${t0}) = ${factor(g[0])}·${factor(v0)} + ${factor(g[1])}·${factor(v1)} = ${niceText(g[0] * v0 + g[1] * v1)}.`,
  ];
}

const CURVE_PARTS: Record<0 | 1, Array<(r: Rng) => string>> = {
  0: [() => "e^t", () => "sen(t)", () => "cos(t)", (r) => `t^2 ${signed(r.int(-2, 3))}`, (r) => `${sumText([[nz(r, -3, 3), "t"]])} ${signed(r.int(-2, 3))}`, () => "ln(1 + t)", (r) => `t^3 - ${r.int(1, 3)}t`],
  1: [() => "t^2", () => "t^3", (r) => `${sumText([[nz(r, -3, 3), "t"]])} ${signed(r.int(-2, 2))}`, () => "ln(t)", () => "e^(t - 1)", (r) => `t^2 - ${r.int(1, 3)}t`],
};

function chainTemplate(rng: Rng, level: ExerciseLevel): CalcChainInstance {
  const outer = rng.pick(["f", "g"] as const);
  const v = (lo: number, hi: number): [number, number] => [rng.int(lo, hi), rng.int(lo, hi)];
  const hPoly = () =>
    sumText([
      [nz(rng, -3, 3), rng.pick(["x y", "x^2 y", "x y^2"])],
      [rng.int(-2, 2), rng.pick(["x^2", "y^2"])],
      [rng.int(-3, 3), rng.pick(["x", "y"])],
    ]);
  if (level === "básico") {
    const point = v(-2, 3);
    let at = v(-2, 3);
    if (at[0] === point[0] && at[1] === point[1]) at = [point[0] + 1, point[1]];
    return { kind: "curva", outer, t0: rng.int(0, 2), h: null, curve: null, point, velocity: v(-3, 3), grad: v(-4, 5), decoy: { at, grad: v(-4, 5) } };
  }
  if (level === "medio" && rng.chance(0.6)) {
    return { kind: "curva", outer, t0: rng.int(0, 1), h: hPoly(), curve: null, point: v(-2, 2), velocity: v(-3, 3), grad: null, decoy: null };
  }
  if (rng.chance(0.5)) {
    const map: [string, string] = [
      sumText([[nz(rng, -2, 2), rng.pick(["x^2", "x y", "y^2"])], [rng.int(-3, 3), "x"], [rng.int(-3, 3), "y"]]),
      sumText([[nz(rng, -2, 2), rng.pick(["x y", "x^2", "y^3"])], [rng.int(-3, 3), "y"], [rng.int(-2, 2), ""]]),
    ];
    return { kind: "jacobiana", outer, p: v(-2, 2), map, grad: v(-4, 4) };
  }
  const t0 = rng.pick([0, 1] as const);
  const curve: [string, string] = [rng.pick(CURVE_PARTS[t0])(rng), rng.pick(CURVE_PARTS[t0])(rng)];
  return { kind: "curva", outer, t0, h: hPoly(), curve, point: [0, 0], velocity: [0, 0], grad: null, decoy: null };
}

export const CALC_CHAIN: ExerciseType<CalcChainInstance> = {
  id: "calculo-cadena",
  topic: "calculo",
  title: "Regla de la cadena en varias variables",
  description: "Calcula la derivada de una composición: [g∘f]′(t) = ∇g(f(t))·f′(t), o con la matriz jacobiana, a partir de datos o de fórmulas.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-cadena", seed),
      (r) => {
        const inst = chainTemplate(r, level);
        if (inst.kind === "curva" && inst.curve) {
          // Con fórmulas, el punto y la velocidad que se guardan son los de la curva (solo para la solución).
          const c = [curveExpr(inst.curve[0]), curveExpr(inst.curve[1])] as const;
          const d = chainRuleAt(calcExpr(inst.h!, ["x", "y"]), c, inst.t0);
          return { ...inst, point: d.point.map((x) => snapNice(x)) as [number, number], velocity: d.velocity.map((x) => snapNice(x)) as [number, number] };
        }
        return inst;
      },
      (inst) => {
        const v = chainAnswer(inst);
        if (!Number.isInteger(Math.round(v * 1e9) / 1e9) || Math.abs(v) > 60) return false;
        if (inst.kind === "curva" && inst.curve) return inst.point.every(Number.isInteger) && inst.velocity.every(Number.isInteger) && inst.velocity.some((x) => x !== 0) && v !== 0;
        return v !== 0;
      },
    );
  },
};

// ---------------------------------------------------------------- Cuenca del descenso de gradiente

export type CalcBasinInstance = { f: string; ask: "destino" | "cuenca"; x0: number; target: number };

function basinFunction(rng: Rng): string | null {
  if (rng.chance(0.25)) {
    // Cúbica: f′ = 3(x − p)(x − q), con p + q par.
    const p = rng.int(-3, 1);
    const q = p + 2 * rng.int(1, 2);
    return sumText([[1, "x^3"], [(-3 * (p + q)) / 2, "x^2"], [3 * p * q, "x"]]);
  }
  // Cuártica: f′ = ±4(x − p)(x − q)(x − r), con p + q + r múltiplo de 3.
  const p = rng.int(-3, 0);
  const q = p + rng.int(1, 3);
  const r = q + rng.int(1, 3);
  if ((p + q + r) % 3 !== 0) return null;
  const s1 = p + q + r;
  const s2 = p * q + p * r + q * r;
  const s3 = p * q * r;
  const sg = rng.chance(0.2) ? -1 : 1;
  return sumText([[sg, "x^4"], [(sg * -4 * s1) / 3, "x^3"], [sg * 2 * s2, "x^2"], [sg * -4 * s3, "x"]]);
}

export function basinQuestion(inst: CalcBasinInstance): ChoiceQuestion {
  const f = calcExpr(inst.f);
  const crit = criticalPoints1D(f)!;
  const rng = rngOf(inst);
  if (inst.ask === "destino") {
    const lim = descentLimit1D(f, frac(BigInt(inst.x0)))!;
    const options: ChoiceOption[] = crit.map((c, i) => {
      const x = toNumber(c.x);
      return opt(`c${i}`, `Converge a x = ${niceText(x)}`, `\\text{Converge a } x = ${niceTex(x)}`, lim.kind === "punto" && toNumber(lim.x) === x, `x = ${niceText(x)}: ${CRITICAL_1D_LABEL[c.kind]}.`);
    });
    const div = [
      opt("menos", "Diverge: x → −∞", "\\text{Diverge: } x \\to -\\infty", lim.kind === "diverge" && lim.dir < 0),
      opt("mas", "Diverge: x → +∞", "\\text{Diverge: } x \\to +\\infty", lim.kind === "diverge" && lim.dir > 0),
    ];
    const correct = [...options, ...div].find((o) => o.correct)!;
    const others = rng.shuffle([...options, ...div].filter((o) => !o.correct));
    return { mode: "single", options: [correct, ...others.slice(0, 3)] };
  }
  const target = frac(BigInt(inst.target));
  const B = basinOf(f, target)!;
  const xs = crit.map((c) => toNumber(c.x));
  const right: IntervalSet = [B];
  const cands: IntervalSet[] = [
    withEndpoints(right, true),
    [{ lo: -Infinity, hi: inst.target, loClosed: false, hiClosed: false }],
    [{ lo: inst.target, hi: Infinity, loClosed: false, hiClosed: false }],
    ...xs.filter((x) => x !== inst.target).map((x): IntervalSet => (x < inst.target ? [{ lo: x, hi: Infinity, loClosed: true, hiClosed: false }] : [{ lo: -Infinity, hi: x, loClosed: false, hiClosed: true }])),
    ...xs.map((x, i): IntervalSet => [{ lo: i === 0 ? -Infinity : xs[i - 1]!, hi: x, loClosed: false, hiClosed: false }]),
    REALS,
  ];
  const seen: IntervalSet[] = [right];
  const wrong: IntervalSet[] = [];
  for (const s of rng.shuffle(cands)) {
    const n = normalizeSet(s);
    if (n.length === 0 || seen.some((t) => intervalSetEquals(t, n))) continue;
    seen.push(n);
    wrong.push(n);
  }
  const fmt = (s: IntervalSet, correct: boolean, id: string) => opt(id, `x₀ ∈ ${intervalSetText(s, niceText)}`, `x_0 \\in ${intervalSetTex(s, niceTex)}`, correct);
  return { mode: "single", options: [fmt(right, true, "cuenca"), ...wrong.slice(0, 3).map((s, i) => fmt(s, false, `w${i}`))] };
}

export const CALC_BASIN: ExerciseType<CalcBasinInstance> = {
  id: "calculo-cuenca",
  topic: "calculo",
  title: "¿Adónde converge el descenso de gradiente?",
  description: "Con una tasa de aprendizaje pequeña, ¿a qué punto llega el descenso de gradiente desde x₀? ¿Qué x₀ llevan a un mínimo dado? Con la gráfica de f.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-cuenca", seed),
      (r) => {
        const f = basinFunction(r);
        if (!f) return null;
        const crit = criticalPoints1D(calcExpr(f));
        if (!crit) return null;
        const mins = crit.filter((c) => c.kind === "minimo").map((c) => Number(c.x.n));
        if (level === "avanzado") return mins.length === 0 ? null : { f, ask: "cuenca" as const, x0: 0, target: r.pick(mins) };
        return { f, ask: "destino" as const, x0: r.int(-4, 5), target: 0 };
      },
      (inst) => {
        const f = calcExpr(inst.f);
        const crit = criticalPoints1D(f);
        if (!crit || crit.some((c) => c.x.d !== 1n) || exprSize(f) > 30) return false;
        // Coeficientes no muy grandes.
        if (/\d{3}/.test(inst.f)) return false;
        if (inst.ask === "destino") {
          if (crit.some((c) => Number(c.x.n) === inst.x0)) return false;
          // x₀ cerca de los puntos críticos, para que se vea bien en la gráfica.
          const xs = crit.map((c) => Number(c.x.n));
          if (inst.x0 < Math.min(...xs) - 2 || inst.x0 > Math.max(...xs) + 2) return false;
          const lim = descentLimit1D(f, frac(BigInt(inst.x0)))!;
          // En básico, que converja a un mínimo; en medio, vale también que diverja.
          return level === "básico" ? lim.kind === "punto" && crit.length >= 2 : crit.length >= 2;
        }
        return basinQuestion(inst).options.length === 4;
      },
    );
  },
};

// ---------------------------------------------------------------- Puntos críticos (tipo test)

export type CalcCriticalChoiceInstance = { f: string; ask: "maximo" | "minimo" | "silla"; candidates: Array<[number, number]>; none: boolean };

const KIND_ASK: Record<CalcCriticalChoiceInstance["ask"], string> = { maximo: "un máximo local", minimo: "un mínimo local", silla: "un punto de silla" };
export const criticalAskText = (inst: CalcCriticalChoiceInstance) => `¿Cuál de estos puntos es un punto crítico de f y, además, ${KIND_ASK[inst.ask]}?`;

export function criticalChoiceQuestion(inst: CalcCriticalChoiceInstance): ChoiceQuestion {
  const f = calcExpr(inst.f, ["x", "y"]);
  const options = inst.candidates.map(([x, y], i) => {
    const kind = classifyPoint(f, [x, y]);
    const label = kind === "no-critico" ? "no es un punto crítico (∇f ≠ 0)" : `punto crítico: ${CRITICAL_LABEL[kind].toLowerCase()}`;
    return opt(`p${i}`, `(${niceText(x)}, ${niceText(y)})`, `(${niceTex(x)},\\ ${niceTex(y)})`, kind === inst.ask, `(${niceText(x)}, ${niceText(y)}): ${label}.`);
  });
  // En texto normal (no en modo matemático): es una frase, no una fórmula.
  if (inst.none) options.push(opt("sin", "f no tiene puntos críticos", undefined, hasNoCriticalPoints(f), "Mira si alguna parcial puede anularse."));
  return { mode: "single", options };
}

export function criticalChoiceHints(inst: CalcCriticalChoiceInstance): string[] {
  return [
    "Punto crítico: ∂f/∂x = 0 y ∂f/∂y = 0 a la vez. Sustituye cada punto en las dos parciales.",
    "Hessiana: |H| = f_xx·f_yy − f_xy². |H| > 0 y f_xx > 0: mínimo; |H| > 0 y f_xx < 0: máximo; |H| < 0: silla.",
    `Si una parcial no puede valer 0 nunca${inst.f.includes("e^") ? " (por ejemplo, k·eˣ)" : ""}, no hay puntos críticos.`,
  ];
}

export const CALC_CRITICAL_CHOICE: ExerciseType<CalcCriticalChoiceInstance> = {
  id: "calculo-criticos-test",
  topic: "calculo",
  title: "Puntos críticos (tipo test)",
  description: "Entre cuatro puntos, elige el que es punto crítico y del tipo pedido (máximo, mínimo o silla), o di que f no tiene puntos críticos.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-criticos-test", seed),
      (r) => {
        if (level !== "básico" && r.chance(0.3)) {
          // Sin puntos críticos: una parcial que no se anula nunca (k·eˣ, o x con la otra lineal…).
          const f = sumText([[nz(r, 1, 3), "e^x"], [r.pick([1, 2]), r.pick(["y^4", "y^2"])], [r.int(-3, 3), "y"], [r.int(0, 3), ""]]);
          const cands: Array<[number, number]> = r.shuffle([[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]] as Array<[number, number]>).slice(0, 3);
          return { f, ask: r.pick(["maximo", "minimo", "silla"] as const), candidates: cands, none: true };
        }
        const a = nz(r, -2, 2);
        const b = r.int(-2, 2);
        const c = r.pick([1, 2]);
        const d = r.int(-2, 2);
        // a·x²·(y − b) − c·(y + d)²: críticos en (0, −d) y, si a·c·(b + d) > 0, (±√(2c(b+d)/a), b).
        const f = level === "básico" ? criticalTemplate(r, "básico") : `${a === 1 ? "" : a === -1 ? "−" : a}x^2 (y ${signed(-b)}) − ${c === 1 ? "" : c}(y ${signed(d)})^2`;
        const crit = criticalPoints(calcExpr(f, ["x", "y"]));
        if (!crit.ok || crit.points.length === 0 || crit.points.some((p) => p.x.d !== 1n || p.y.d !== 1n)) return null;
        const pts = crit.points.map((p) => [Number(p.x.n), Number(p.y.n)] as [number, number]);
        const kinds = crit.points.map((p) => p.kind);
        const asks = kinds.filter((k): k is "maximo" | "minimo" | "silla" => k !== "no-concluyente");
        if (asks.length === 0) return null;
        const ask = r.pick(asks);
        const decoys: Array<[number, number]> = [];
        for (const [x, y] of pts) decoys.push([y, x], [x + 1, y], [-x, y + 1], [x, -y]);
        const all = [...pts, ...decoys].filter((p, i, arr) => arr.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
        const right = pts.filter((_, i) => kinds[i] === ask);
        if (right.length !== 1) return null;
        const others = r.shuffle(all.filter((p) => p !== right[0]));
        return { f, ask, candidates: r.shuffle([right[0]!, ...others.slice(0, 3)]), none: false };
      },
      (inst) => {
        const q = criticalChoiceQuestion(inst);
        return q.options.length === 4 && q.options.filter((o) => o.correct).length === 1 && new Set(q.options.map((o) => o.text)).size === 4;
      },
    );
  },
};

// ---------------------------------------------------------------- Integración por partes

export type CalcPartsInstance = { fam: PartsFamily; k: number; a: number; lo: Bound; hi: Bound; answer: "opciones" | "numero" };

export const partsIntegral = (inst: CalcPartsInstance): ClosedForm => partsDefinite(inst.fam, inst.k, inst.a, inst.lo, inst.hi)!;

/** Cuatro opciones de forma cerrada: la buena y errores típicos (signo, límites al revés, e² por e…). */
export function partsQuestion(inst: CalcPartsInstance): ChoiceQuestion {
  const cf = partsIntegral(inst);
  const value = closedValue(cf);
  const rng = rngOf(inst);
  const cands: ClosedForm[] = [closedScale(cf, frac(-1n)), closedScale(cf, frac(2n)), closedScale(cf, frac(1n, 2n))];
  for (const key of cf.keys()) {
    const [m, p] = key.split(",").map(Number) as [number, number];
    if (m !== 0) cands.push(closedRekey(cf, key, `${m - Math.sign(m)},${p}`), closedRekey(cf, key, `${m + Math.sign(m)},${p}`));
    // Un signo cambiado en un término.
    const flip: ClosedForm = new Map(cf);
    flip.set(key, { n: -cf.get(key)!.n, d: cf.get(key)!.d });
    cands.push(flip);
  }
  // Sumando o quitando 1 (el valor de la primitiva en el otro límite olvidado).
  const plusOne: ClosedForm = new Map(cf);
  const c0 = cf.get("0,0") ?? frac(0n);
  plusOne.set("0,0", { n: c0.n + c0.d, d: c0.d });
  cands.push(plusOne);
  const values = [value];
  const wrong: ClosedForm[] = [];
  for (const c of rng.shuffle(cands)) {
    const v = closedValue(c);
    if (c.size === 0 || values.some((w) => Math.abs(w - v) < 1e-6)) continue;
    values.push(v);
    wrong.push(c);
  }
  return {
    mode: "single",
    options: [opt("ok", closedText(cf), closedTex(cf), true), ...wrong.slice(0, 3).map((c, i) => opt(`w${i}`, closedText(c), closedTex(c), false))],
  };
}

const BOUNDS: Record<PartsFamily, Array<[Bound, Bound]>> = {
  "x-ln": [[{ k: "e", m: 0 }, { k: "e", m: 1 }]],
  "x2-ln": [[{ k: "e", m: 0 }, { k: "e", m: 1 }]],
  "x-exp": [
    [{ k: "num", v: 0 }, { k: "num", v: 1 }],
    [{ k: "num", v: -1 }, { k: "num", v: 0 }],
    [{ k: "num", v: 0 }, { k: "num", v: 2 }],
  ],
  "x-sin": [
    [{ k: "pi", n: 0, d: 1 }, { k: "pi", n: 1, d: 1 }],
    [{ k: "pi", n: 0, d: 1 }, { k: "pi", n: 1, d: 2 }],
  ],
  "x-cos": [
    [{ k: "pi", n: 0, d: 1 }, { k: "pi", n: 1, d: 1 }],
    [{ k: "pi", n: 0, d: 1 }, { k: "pi", n: 1, d: 2 }],
  ],
};

export const CALC_PARTS: ExerciseType<CalcPartsInstance> = {
  id: "calculo-partes",
  topic: "calculo",
  title: "Integración por partes",
  description: "Calcula una integral definida por partes (∫u dv = u·v − ∫v du) con x·ln x, x·eˣ, x·sen x o x·cos x; los límites pueden venir al revés.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-partes", seed),
      (r) => {
        const fam = r.pick(level === "básico" ? (["x-exp", "x-sin", "x-cos"] as const) : PARTS_FAMILIES);
        const k = level === "básico" ? r.pick([1, 2, 3, -1, -2]) : nz(r, -4, 4);
        const a = level === "avanzado" && fam !== "x-ln" && fam !== "x2-ln" ? r.pick([1, 2]) : 1;
        const [lo, hi] = r.pick(BOUNDS[fam]);
        const reversed = level !== "básico" && r.chance(0.35);
        return { fam, k, a, lo: reversed ? hi : lo, hi: reversed ? lo : hi, answer: level === "avanzado" ? ("numero" as const) : ("opciones" as const) };
      },
      (inst) => {
        const cf = partsDefinite(inst.fam, inst.k, inst.a, inst.lo, inst.hi);
        if (!cf || cf.size === 0) return false;
        const v = closedValue(cf);
        return Math.abs(v) > 1e-6 && Math.abs(v) < 200 && (inst.answer === "numero" || partsQuestion(inst).options.length === 4);
      },
    );
  },
};

export const CALC_THEORY_EXERCISES = [CALC_PIECEWISE, CALC_LHOPITAL, CALC_DOMAIN, CALC_BISECTION, CALC_CHAIN, CALC_BASIN, CALC_CRITICAL_CHOICE, CALC_PARTS] as const;

export const CALC_EXERCISES = [CALC_DERIVATIVE, CALC_TANGENT, CALC_ANTIDERIVATIVE, CALC_DEFINITE, CALC_GRADIENT, CALC_CRITICAL, CALC_DESCENT, ...CALC_THEORY_EXERCISES] as const;
