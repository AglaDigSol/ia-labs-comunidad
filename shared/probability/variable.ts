// Variables aleatorias discretas finitas dadas por su tabla (valores y probabilidades), con
// esperanza, varianza, transformaciones lineales, suma y producto de variables independientes;
// juegos con dados y monedas, y la penalización por fallo en un test de opción múltiple.
import { add, cmp, div, equals, frac, mul, ONE, sub, sum, ZERO, type Frac } from "../rational.ts";
import { distSupport, pmfExact, type DistSpec } from "./distributions.ts";

export interface RandomVar {
  values: readonly Frac[];
  probs: readonly Frac[];
}

export function randomVarProblem(x: RandomVar): string | null {
  if (x.values.length === 0 || x.values.length !== x.probs.length) return "Cada valor necesita su probabilidad.";
  if (x.probs.some((p) => cmp(p, ZERO) < 0 || cmp(p, ONE) > 0)) return "Las probabilidades van entre 0 y 1.";
  if (!equals(sum(x.probs), ONE)) return "Las probabilidades tienen que sumar 1.";
  return null;
}

/** E[X] = Σ x·P(X = x). */
export const rvMean = (x: RandomVar): Frac => sum(x.values.map((v, i) => mul(v, x.probs[i]!)));
/** E[g(X)] = Σ g(x)·P(X = x). */
export const rvExpect = (x: RandomVar, g: (v: Frac) => Frac): Frac => sum(x.values.map((v, i) => mul(g(v), x.probs[i]!)));
/** E[X²]. */
export const rvSecondMoment = (x: RandomVar): Frac => rvExpect(x, (v) => mul(v, v));
/** Var(X) = E[X²] − E[X]². */
export const rvVariance = (x: RandomVar): Frac => {
  const m = rvMean(x);
  return sub(rvSecondMoment(x), mul(m, m));
};

/** Junta los valores repetidos (sumando sus probabilidades) y los ordena. */
export function rvMerge(x: RandomVar): RandomVar {
  const map = new Map<string, { v: Frac; p: Frac }>();
  x.values.forEach((v, i) => {
    const key = `${v.n}/${v.d}`;
    const prev = map.get(key);
    map.set(key, { v, p: prev ? add(prev.p, x.probs[i]!) : x.probs[i]! });
  });
  const rows = [...map.values()].sort((a, b) => cmp(a.v, b.v));
  return { values: rows.map((r) => r.v), probs: rows.map((r) => r.p) };
}

/** aX + b. */
export const rvAffine = (x: RandomVar, a: Frac, b: Frac): RandomVar => rvMerge({ values: x.values.map((v) => add(mul(a, v), b)), probs: x.probs });

/** Distribución de f(X, Y) con X e Y independientes (P(X = x, Y = y) = P(X = x)·P(Y = y)). */
export function rvCombineIndependent(x: RandomVar, y: RandomVar, f: (a: Frac, b: Frac) => Frac): RandomVar {
  const values: Frac[] = [];
  const probs: Frac[] = [];
  x.values.forEach((a, i) =>
    y.values.forEach((b, j) => {
      values.push(f(a, b));
      probs.push(mul(x.probs[i]!, y.probs[j]!));
    }),
  );
  return rvMerge({ values, probs });
}
export const rvSumIndependent = (x: RandomVar, y: RandomVar) => rvCombineIndependent(x, y, add);
export const rvProductIndependent = (x: RandomVar, y: RandomVar) => rvCombineIndependent(x, y, mul);

/** La tabla de una distribución finita (todas menos geométrica y Poisson). */
export function rvFromDist(d: DistSpec): RandomVar {
  if (d.kind === "geometrica" || d.kind === "poisson") throw new RangeError("distribución con infinitos valores");
  const ks = distSupport(d);
  return { values: ks.map((k) => frac(BigInt(k))), probs: ks.map((k) => pmfExact(d, k)!) };
}

// ---------------------------------------------------------------- Juegos

/** Una fila de la tabla de un juego: el resultado, lo que se gana (negativo si se pierde) y su probabilidad. */
export interface GameRow {
  label: string;
  value: Frac;
  prob: Frac;
}

export const gameVar = (rows: readonly GameRow[]): RandomVar => ({ values: rows.map((r) => r.value), probs: rows.map((r) => r.prob) });

/**
 * Regla de un juego con un dado: ganancia neta según la cara.
 * - «cara»: cobras `mult`·(número de la cara) y pagas `cost` por jugar.
 * - «paridad»: si sale impar ganas `odd`; si sale par, `even` (negativo: pierdes).
 * - «umbral»: si sale `t` o más ganas `win`; si no, `lose` (negativo).
 */
export type DieRule =
  | { kind: "cara"; mult: number; cost: number }
  | { kind: "paridad"; odd: number; even: number }
  | { kind: "umbral"; t: number; win: number; lose: number };

export function dieRulePayoff(rule: DieRule, face: number): number {
  switch (rule.kind) {
    case "cara":
      return rule.mult * face - rule.cost;
    case "paridad":
      return face % 2 === 1 ? rule.odd : rule.even;
    case "umbral":
      return face >= rule.t ? rule.win : rule.lose;
  }
}

/** Las seis filas del juego (una por cara) con los pesos del dado. */
export function dieGameRows(rule: DieRule, weights: readonly Frac[]): GameRow[] {
  return [1, 2, 3, 4, 5, 6].map((face, i) => ({ label: String(face), value: frac(BigInt(dieRulePayoff(rule, face))), prob: weights[i]! }));
}

// ---------------------------------------------------------------- Penalización en un test

/**
 * Puntuación esperada de una pregunta de k opciones (una correcta) respondida al azar: acierto `reward`,
 * fallo −`penalty`. E = reward/k − penalty·(k − 1)/k.
 */
export function guessExpectation(k: number, reward: Frac, penalty: Frac): Frac {
  const K = frac(BigInt(k));
  return sub(div(reward, K), div(mul(penalty, frac(BigInt(k - 1))), K));
}

/**
 * Cuánto tiene que restar un fallo para que responder al azar valga `target` de media:
 * penalty = (reward − k·target)/(k − 1). Con target = 0, reward/(k − 1).
 */
export function penaltyForTarget(k: number, reward: Frac, target: Frac): Frac {
  if (!Number.isInteger(k) || k < 2) throw new RangeError("al menos dos opciones");
  return div(sub(reward, mul(frac(BigInt(k)), target)), frac(BigInt(k - 1)));
}

