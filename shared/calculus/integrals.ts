// Integrales: comprobar una primitiva derivándola (vale cualquier constante, + C), la integral
// definida numérica con Simpson adaptativo (para comprobar un resultado escrito como número o como
// expresión exacta: π/4, ln 2, e − 1) y las sumas de Riemann (izquierda, derecha y punto medio) para
// el dibujo de los rectángulos.
import { compile, evaluate, exprVars, type Expr } from "./expr.ts";
import { derivativeRaw } from "./derive.ts";
import { close, equivalent } from "./equivalence.ts";
import { parseExpr, type CalcParseError } from "./parser.ts";

/** Quita un «+ C» final (o + K, + c): la constante de integración. */
export function stripConstant(text: string): { text: string; hadConstant: boolean } {
  const m = /\s*\+\s*[CcK]\s*$/.exec(text);
  return m ? { text: text.slice(0, m.index), hadConstant: true } : { text, hadConstant: false };
}

export type AntiderivativeCheck =
  | { ok: true; hadConstant: boolean }
  | { ok: false; reason: "parse"; error: CalcParseError }
  | { ok: false; reason: "wrong" | "unknown" };

/** ¿Es F una primitiva de f? Se deriva F y se compara con f. */
export function checkAntiderivative(answer: string, f: Expr): AntiderivativeCheck {
  const { text, hadConstant } = stripConstant(answer);
  const r = parseExpr(text);
  if (!r.ok) return { ok: false, reason: "parse", error: r.error };
  const eq = equivalent(derivativeRaw(r.expr, "x"), f);
  if (eq.kind === "equal") return { ok: true, hadConstant };
  return { ok: false, reason: eq.kind === "unknown" ? "unknown" : "wrong" };
}

/** Simpson adaptativo en [a, b]. Devuelve NaN si la función no es finita en algún punto que usa. */
export function simpson(f: (x: number) => number, a: number, b: number, tol = 1e-10, maxDepth = 40): number {
  const fa = f(a);
  const fb = f(b);
  const m = (a + b) / 2;
  const fm = f(m);
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb);
  let evals = 0;
  const rec = (a: number, b: number, fa: number, fm: number, fb: number, whole: number, tol: number, depth: number): number => {
    if (++evals > 200000) return NaN;
    const m = (a + b) / 2;
    const lm = (a + m) / 2;
    const rm = (m + b) / 2;
    const flm = f(lm);
    const frm = f(rm);
    const left = ((m - a) / 6) * (fa + 4 * flm + fm);
    const right = ((b - m) / 6) * (fm + 4 * frm + fb);
    const diff = left + right - whole;
    if (!Number.isFinite(diff)) return NaN;
    if (depth <= 0 || Math.abs(diff) <= 15 * tol) return left + right + diff / 15;
    return rec(a, m, fa, flm, fm, left, tol / 2, depth - 1) + rec(m, b, fm, frm, fb, right, tol / 2, depth - 1);
  };
  if (![fa, fb, fm].every(Number.isFinite)) return NaN;
  return rec(a, b, fa, fm, fb, whole, tol, maxDepth);
}

/** ∫ₐᵇ f(x) dx numérica. */
export const definiteIntegral = (f: Expr, a: number, b: number): number => simpson(compile(f), a, b);

export type NumberAnswer = { ok: true; value: number; exact: boolean } | { ok: false; error: CalcParseError };

/**
 * Lee una respuesta numérica: un número (3,25 o 13/4) o una expresión sin x (π/4, ln 2, e − 1,
 * 2·sqrt(3)). `exact` dice si se ha escrito como expresión o fracción (se compara con más precisión).
 */
export function parseNumberAnswer(text: string): NumberAnswer {
  const r = parseExpr(text.replace(/^\s*[≈=]\s*/, ""));
  if (!r.ok) return r;
  if (exprVars(r.expr).length > 0) return { ok: false, error: { message: "El resultado es un número: no puede llevar x.", start: 0, end: text.length } };
  const value = evaluate(r.expr, {});
  if (!Number.isFinite(value)) return { ok: false, error: { message: "Esa expresión no da un número real.", start: 0, end: text.length } };
  const decimal = /^\s*[≈=]?\s*[−-]?\s*\d+([.,]\d+)?\s*$/.test(text);
  return { ok: true, value, exact: !decimal };
}

/**
 * ¿Vale lo esperado? Un decimal escrito se acepta con tres cifras decimales correctas (redondeado o
 * truncado); una fracción o expresión, con casi toda la precisión.
 */
export function numberMatches(answer: { value: number; exact: boolean }, expected: number): boolean {
  if (answer.exact) return close(answer.value, expected, 1e-9);
  return Math.abs(answer.value - expected) <= Math.max(1.0001e-3, 1e-5 * Math.abs(expected));
}

/** Indicación del examen para las respuestas numéricas redondeadas. */
export const ROUNDING_NOTE = "Exacta (fracción o expresión con e, π, ln…) o redondeando a dos decimales con coma (por ejemplo, 3,14).";

/**
 * Como en el examen: «redondeando a dos decimales con coma». Un decimal escrito vale si, redondeado a
 * `decimals` cifras, da lo mismo que el valor esperado redondeado (o si está aún más cerca); una
 * fracción o expresión, con casi toda la precisión.
 */
export function numberMatchesRounded(answer: { value: number; exact: boolean }, expected: number, decimals = 2): boolean {
  if (answer.exact) return close(answer.value, expected, 1e-9);
  const p = 10 ** decimals;
  const r = (v: number) => Math.round(v * p + (v >= 0 ? 1e-9 : -1e-9));
  return r(answer.value) === r(expected) || Math.abs(answer.value - expected) <= 0.1 / p;
}

export type RiemannRule = "izquierda" | "derecha" | "medio";
export const RIEMANN_LABEL: Record<RiemannRule, string> = { izquierda: "Extremo izquierdo", derecha: "Extremo derecho", medio: "Punto medio" };

export type Riemann = { rects: Array<{ x0: number; x1: number; h: number }>; sum: number };

/** Suma de Riemann con n rectángulos iguales en [a, b]. */
export function riemannSum(f: (x: number) => number, a: number, b: number, n: number, rule: RiemannRule): Riemann {
  const dx = (b - a) / n;
  const rects: Riemann["rects"] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * dx;
    const x1 = x0 + dx;
    const at = rule === "izquierda" ? x0 : rule === "derecha" ? x1 : (x0 + x1) / 2;
    const h = f(at);
    rects.push({ x0, x1, h });
    sum += h * dx;
  }
  return { rects, sum };
}
