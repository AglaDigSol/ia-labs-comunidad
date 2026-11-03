// Adónde lleva el descenso de gradiente en una variable con una tasa de aprendizaje pequeña: sigue el
// flujo x′ = −f′(x), así que desde x₀ baja hasta el primer punto crítico que encuentra cuesta abajo (el
// mínimo local de su «cuenca») o, si no hay ninguno, se va a ±∞. La cuenca de un mínimo es el intervalo
// abierto entre los puntos críticos vecinos (los máximos que la rodean). Para polinomios con puntos
// críticos racionales: los calcula exactos.
import { rationalRoots } from "../linalg/eigen.ts";
import { add, cmp, div, frac, ONE, sign, sub, toNumber, type Frac } from "../rational.ts";
import type { Expr } from "./expr.ts";
import { exprToPoly, polyDerivative, polyEval2, polyUnivariate } from "./poly.ts";
import type { Interval } from "./domain.ts";

export type Critical1DKind = "minimo" | "maximo" | "inflexion";
export interface Critical1D {
  x: Frac;
  kind: Critical1DKind;
}

export const CRITICAL_1D_LABEL: Record<Critical1DKind, string> = { minimo: "mínimo local", maximo: "máximo local", inflexion: "punto crítico sin extremo" };

/** Puntos críticos de un polinomio en x (todos racionales), o null si no lo es o alguno no es racional. */
export function criticalPoints1D(f: Expr): Critical1D[] | null {
  const p = exprToPoly(f);
  if (!p) return null;
  const dp = polyDerivative(p, "x");
  const coefs = polyUnivariate(dp, "x");
  if (!coefs || coefs.every((c) => c.n === 0n)) return null;
  const r = rationalRoots(coefs);
  if (!r.complete) return null;
  const sdf = (x: Frac) => sign(polyEval2(dp, x));
  const xs = r.roots.map((x) => x.value);
  const TWO = frac(2n);
  return xs.map((x, i) => {
    // Signo de f′ a cada lado, en un punto entre este crítico y el vecino (exacto).
    const left = i === 0 ? sub(x, ONE) : div(add(xs[i - 1]!, x), TWO);
    const right = i === xs.length - 1 ? add(x, ONE) : div(add(xs[i + 1]!, x), TWO);
    const sl = sdf(left);
    const sr = sdf(right);
    return { x, kind: sl < 0 && sr > 0 ? "minimo" : sl > 0 && sr < 0 ? "maximo" : "inflexion" };
  });
}

export type FlowLimit = { kind: "punto"; x: Frac } | { kind: "diverge"; dir: 1 | -1 };

/** Adónde va el descenso de gradiente (α pequeño) desde x₀; null si f no es un polinomio manejable. */
export function descentLimit1D(f: Expr, x0: Frac): FlowLimit | null {
  const crit = criticalPoints1D(f);
  const p = exprToPoly(f);
  if (!crit || !p) return null;
  const s = sign(polyEval2(polyDerivative(p, "x"), x0));
  if (s === 0) return { kind: "punto", x: x0 };
  // f′ > 0: baja hacia la izquierda, hasta el crítico más cercano por debajo de x₀.
  if (s > 0) {
    const below = crit.filter((c) => cmp(c.x, x0) < 0);
    return below.length ? { kind: "punto", x: below[below.length - 1]!.x } : { kind: "diverge", dir: -1 };
  }
  const above = crit.filter((c) => cmp(c.x, x0) > 0);
  return above.length ? { kind: "punto", x: above[0]!.x } : { kind: "diverge", dir: 1 };
}

/** Cuenca de atracción de un mínimo local: el intervalo abierto entre sus puntos críticos vecinos. */
export function basinOf(f: Expr, min: Frac): Interval | null {
  const crit = criticalPoints1D(f);
  if (!crit) return null;
  const i = crit.findIndex((c) => cmp(c.x, min) === 0);
  if (i < 0 || crit[i]!.kind !== "minimo") return null;
  return {
    lo: i === 0 ? -Infinity : toNumber(crit[i - 1]!.x),
    hi: i === crit.length - 1 ? Infinity : toNumber(crit[i + 1]!.x),
    loClosed: false,
    hiClosed: false,
  };
}
