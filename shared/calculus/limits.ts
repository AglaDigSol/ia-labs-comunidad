// Límites de funciones de una variable: laterales (por la izquierda y por la derecha), en un punto y en
// ±∞, la regla de L'Hôpital paso a paso para cocientes 0/0 e ∞/∞ y el estudio de una función a trozos
// en el punto donde cambia de fórmula (límites laterales, límite, continuidad y derivabilidad).
//
// Cómo se calcula un límite (sin eval ni Function, solo con evaluate):
// 1. Sustitución directa: si f(a) es finito y los valores muy cerca de a por ese lado se le acercan, el
//    límite es f(a) (la función es continua ahí). Así salen exactos los casos de clase.
// 2. Cociente 0/0 o ∞/∞: la regla de L'Hôpital con las derivadas simbólicas (derive.ts).
// 3. Aproximación numérica: f en a ± 2⁻ᵏ (o en ±2ᵏ para ±∞); si los saltos se encogen, se acelera con
//    Aitken y se redondea a una fracción cómoda; si crecen o no se encogen, es infinito; si cambian de
//    signo sin encogerse o no está definida, no existe.
import { derivativeTidy } from "./derive.ts";
import { div, evaluate, type Expr } from "./expr.ts";

export type Side = "izquierda" | "derecha";
/** Hacia dónde tiende x: un número o ±∞. */
export type Approach = number | "+inf" | "-inf";

export type LimitValue = { kind: "finito"; value: number } | { kind: "infinito"; sign: 1 | -1 } | { kind: "no-existe" };

export const NO_EXISTE: LimitValue = { kind: "no-existe" };
const finite = (value: number): LimitValue => ({ kind: "finito", value: Object.is(value, -0) ? 0 : value });

/** Redondea a una fracción de denominador ≤ 12 si está a menos de `tol`. */
export function snapNice(v: number, tol = 1e-9): number {
  if (!Number.isFinite(v)) return v;
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) <= tol * Math.max(1, Math.abs(v))) return n / d;
  }
  return v;
}

/** ¿Dos límites son el mismo? (los finitos, con tolerancia). */
export function sameLimit(a: LimitValue, b: LimitValue, tol = 1e-7): boolean {
  if (a.kind === "finito" && b.kind === "finito") return Math.abs(a.value - b.value) <= tol * Math.max(1, Math.abs(a.value));
  if (a.kind === "infinito" && b.kind === "infinito") return a.sign === b.sign;
  return a.kind === "no-existe" && b.kind === "no-existe";
}

export const isZeroLimit = (l: LimitValue) => l.kind === "finito" && Math.abs(l.value) < 1e-12;

/** Texto del límite: «3/2», «+∞», «no existe». */
export function limitText(l: LimitValue, fmt: (v: number) => string): string {
  return l.kind === "finito" ? fmt(l.value) : l.kind === "infinito" ? (l.sign > 0 ? "+∞" : "−∞") : "no existe";
}

// ---------------------------------------------------------------- Aproximación numérica

/**
 * Analiza una sucesión de valores que se acercan al límite (cada término, un paso más cerca). Si los
 * saltos se encogen (razón media < 0,9), converge y se acelera con Aitken; si no se encogen y van en
 * un sentido, diverge; si no, no existe.
 */
function analyzeSequence(vals: readonly number[]): LimitValue {
  if (vals.some((v) => Number.isNaN(v))) return NO_EXISTE;
  const tail = vals.slice(-8);
  if (tail.every((v) => v === Infinity)) return { kind: "infinito", sign: 1 };
  if (tail.every((v) => v === -Infinity)) return { kind: "infinito", sign: -1 };
  if (tail.some((v) => !Number.isFinite(v))) return NO_EXISTE;
  const d = tail.slice(1).map((v, i) => v - tail[i]!);
  const scale = Math.max(1, ...tail.map(Math.abs));
  if (d.every((x) => Math.abs(x) <= 1e-13 * scale)) return finite(snapNice(tail[tail.length - 1]!, 1e-9));
  const ratios: number[] = [];
  for (let i = 1; i < d.length; i++) if (Math.abs(d[i - 1]!) > 1e-15 * scale) ratios.push(Math.abs(d[i]! / d[i - 1]!));
  const ratio = ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const monotone = d.every((x) => x >= 0) || d.every((x) => x <= 0);
  const last = tail[tail.length - 1]!;
  if (ratio < 0.9) {
    // Aitken Δ²: x − Δ²/(Δ₂ − Δ₁), con los tres últimos términos.
    const [x0, x1, x2] = tail.slice(-3) as [number, number, number];
    const den = x2 - 2 * x1 + x0;
    const acc = Math.abs(den) > 1e-300 ? x2 - ((x2 - x1) * (x2 - x1)) / den : x2;
    const best = Number.isFinite(acc) && Math.abs(acc - x2) <= Math.abs(x2 - x1) * 10 + 1e-12 ? acc : x2;
    return finite(snapNice(best, 1e-6));
  }
  if (monotone && Math.abs(last) > 3) return { kind: "infinito", sign: last > 0 ? 1 : -1 };
  return NO_EXISTE;
}

const H_EXPONENTS = Array.from({ length: 17 }, (_, i) => i + 4); // h = 2⁻⁴ … 2⁻²⁰
const X_EXPONENTS = Array.from({ length: 27 }, (_, i) => i + 3); // x = 2³ … 2²⁹

function numericLimit(f: Expr, at: Approach, side: Side): LimitValue {
  if (at === "+inf" || at === "-inf") {
    const s = at === "+inf" ? 1 : -1;
    return analyzeSequence(X_EXPONENTS.map((k) => evaluate(f, { x: s * 2 ** k })));
  }
  const s = side === "derecha" ? 1 : -1;
  return analyzeSequence(H_EXPONENTS.map((k) => evaluate(f, { x: at + s * 2 ** -k })));
}

// ---------------------------------------------------------------- Límites

/** ¿Es f continua en a por ese lado? (f(a) finito y los valores cercanos se le acercan). */
function continuousFrom(f: Expr, a: number, side: Side): number | null {
  const v = evaluate(f, { x: a });
  if (!Number.isFinite(v)) return null;
  const s = side === "derecha" ? 1 : -1;
  const near = [2 ** -14, 2 ** -18].map((h) => evaluate(f, { x: a + s * h }));
  if (!near.every(Number.isFinite)) return null;
  const tol = (h: number) => 1e-2 * Math.max(1, Math.abs(v)) * Math.sqrt(h / 2 ** -14);
  return Math.abs(near[0]! - v) <= tol(2 ** -14) && Math.abs(near[1]! - v) <= tol(2 ** -18) ? v : null;
}

/** Límite lateral (o en ±∞, donde el lado no cuenta). */
export function oneSidedLimit(f: Expr, at: Approach, side: Side, depth = 0): LimitValue {
  if (typeof at === "number") {
    const direct = continuousFrom(f, at, side);
    if (direct !== null) return finite(snapNice(direct));
  }
  if (f.k === "div" && depth < 2) {
    const r = lhopitalSteps(f.a, f.b, at, side, 4, depth + 1);
    if (r && r.steps.length > 1) return r.result;
  }
  return numericLimit(f, at, side);
}

/** Límite en a (los dos laterales tienen que coincidir) o en ±∞. */
export function limitAt(f: Expr, at: Approach, depth = 0): LimitValue {
  if (at === "+inf" || at === "-inf") return oneSidedLimit(f, at, "derecha", depth);
  const l = oneSidedLimit(f, at, "izquierda", depth);
  const r = oneSidedLimit(f, at, "derecha", depth);
  return sameLimit(l, r) ? l : NO_EXISTE;
}

// ---------------------------------------------------------------- L'Hôpital

export type IndeterminateForm = "0/0" | "∞/∞";

export interface LhopitalStep {
  num: Expr;
  den: Expr;
  numLimit: LimitValue;
  denLimit: LimitValue;
  /** Forma indeterminada de este cociente, o null si ya se puede calcular. */
  form: IndeterminateForm | null;
}

/** Límite de un cociente cuyos límites ya no dan forma indeterminada. */
function quotientLimit(n: LimitValue, d: LimitValue, num: Expr, den: Expr, at: Approach, side: Side | undefined): LimitValue {
  if (n.kind === "no-existe" || d.kind === "no-existe") return NO_EXISTE;
  if (d.kind === "infinito") return n.kind === "finito" ? finite(0) : NO_EXISTE;
  if (!isZeroLimit(d)) {
    const dv = (d as { value: number }).value;
    return n.kind === "finito" ? finite(snapNice(n.value / dv)) : { kind: "infinito", sign: (n.sign * Math.sign(dv)) as 1 | -1 };
  }
  // k/0 con k ≠ 0: infinito con el signo del cociente (o no existe si cambia de un lado a otro).
  const q = div(num, den);
  return side || typeof at !== "number" ? numericLimit(q, at, side ?? "derecha") : sameOr(numericLimit(q, at, "izquierda"), numericLimit(q, at, "derecha"));
}

const sameOr = (a: LimitValue, b: LimitValue) => (sameLimit(a, b) ? a : NO_EXISTE);

function partLimit(e: Expr, at: Approach, side: Side | undefined, depth: number): LimitValue {
  return side || typeof at !== "number" ? oneSidedLimit(e, at, side ?? "derecha", depth) : limitAt(e, at, depth);
}

/**
 * Regla de L'Hôpital paso a paso: mientras el cociente dé 0/0 o ∞/∞, se derivan numerador y
 * denominador por separado. El último paso ya no es indeterminado y da el límite. null si sigue siendo
 * indeterminado tras `maxSteps` derivaciones. `depth` cuenta los L'Hôpital anidados (el límite de un
 * numerador que a su vez es un cociente): a partir del segundo se usa solo la aproximación numérica.
 */
export function lhopitalSteps(
  num: Expr,
  den: Expr,
  at: Approach,
  side?: Side,
  maxSteps = 4,
  depth = 0,
): { steps: LhopitalStep[]; result: LimitValue } | null {
  const steps: LhopitalStep[] = [];
  let n = num;
  let d = den;
  for (let k = 0; k <= maxSteps; k++) {
    const numLimit = partLimit(n, at, side, depth);
    const denLimit = partLimit(d, at, side, depth);
    const form: IndeterminateForm | null =
      isZeroLimit(numLimit) && isZeroLimit(denLimit) ? "0/0" : numLimit.kind === "infinito" && denLimit.kind === "infinito" ? "∞/∞" : null;
    steps.push({ num: n, den: d, numLimit, denLimit, form });
    if (form === null) return { steps, result: quotientLimit(numLimit, denLimit, n, d, at, side) };
    n = derivativeTidy(n);
    d = derivativeTidy(d);
  }
  return null;
}

// ---------------------------------------------------------------- Funciones a trozos

/**
 * f(x) = izquierda si x < a (o ≤ a), derecha si x > a (o ≥ a). `atPoint` dice qué fórmula vale en a, o
 * da el valor de f(a) aparte (las dos fórmulas son entonces estrictas).
 */
export interface Piecewise {
  a: number;
  left: Expr;
  right: Expr;
  atPoint: Side | Expr;
}

export function piecewiseValue(pw: Piecewise, x: number): number {
  if (x < pw.a) return evaluate(pw.left, { x });
  if (x > pw.a) return evaluate(pw.right, { x });
  if (pw.atPoint === "izquierda") return evaluate(pw.left, { x });
  if (pw.atPoint === "derecha") return evaluate(pw.right, { x });
  return evaluate(pw.atPoint, {});
}

export interface PiecewiseAnalysis {
  /** f(a) (NaN si no está definida). */
  value: number;
  left: LimitValue;
  right: LimitValue;
  limit: LimitValue;
  continuous: boolean;
  /** Derivadas laterales: el límite de la derivada de cada trozo, si f es continua por ese lado. */
  dLeft: LimitValue;
  dRight: LimitValue;
  differentiable: boolean;
}

export function analyzePiecewise(pw: Piecewise): PiecewiseAnalysis {
  const value = snapNice(piecewiseValue(pw, pw.a));
  const left = oneSidedLimit(pw.left, pw.a, "izquierda");
  const right = oneSidedLimit(pw.right, pw.a, "derecha");
  const limit = sameLimit(left, right) ? left : NO_EXISTE;
  const matches = (l: LimitValue) => Number.isFinite(value) && l.kind === "finito" && Math.abs(l.value - value) <= 1e-7 * Math.max(1, Math.abs(value));
  const continuous = matches(limit);
  // Si un lado no llega a f(a), el cociente incremental de ese lado no tiene límite finito.
  const dLeft = matches(left) ? oneSidedLimit(derivativeTidy(pw.left), pw.a, "izquierda") : NO_EXISTE;
  const dRight = matches(right) ? oneSidedLimit(derivativeTidy(pw.right), pw.a, "derecha") : NO_EXISTE;
  const differentiable = continuous && dLeft.kind === "finito" && dRight.kind === "finito" && sameLimit(dLeft, dRight);
  return { value, left, right, limit, continuous, dLeft, dRight, differentiable };
}
