// Cadenas absorbentes: con los estados transitorios primero y los absorbentes después, P tiene la forma
// canónica (Q R; 0 I). La matriz fundamental N = (I − Q)⁻¹ da el número medio de visitas a cada
// transitorio; B = N·R, la probabilidad de acabar en cada absorbente, y t = N·1, los pasos esperados
// hasta la absorción. Todo con fracciones exactas.
import { sum } from "../rational.ts";
import { classifyStates } from "./classify.ts";
import { identity, matMul, matSub, type Mat, type Vec } from "./matrix.ts";
import { inverse } from "./systems.ts";

export interface AbsorptionAnalysis {
  /** Estados transitorios y absorbentes (índices de P). */
  transient: number[];
  absorbing: number[];
  Q: Mat;
  R: Mat;
  IminusQ: Mat;
  N: Mat;
  /** B[i][k]: probabilidad de acabar en absorbing[k] empezando en transient[i]. */
  B: Mat;
  /** t[i]: número esperado de pasos hasta la absorción desde transient[i]. */
  t: Vec;
}

/**
 * Análisis de una cadena absorbente: todos los estados son absorbentes o transitorios, hay al menos
 * uno de cada y desde cada transitorio se llega a algún absorbente. Si no lo es, null.
 */
export function absorptionAnalysis(P: Mat): AbsorptionAnalysis | null {
  const c = classifyStates(P);
  if (c.kind.includes("recurrente")) return null;
  const transient = c.kind.flatMap((k, i) => (k === "transitorio" ? [i] : []));
  const absorbing = c.kind.flatMap((k, i) => (k === "absorbente" ? [i] : []));
  if (transient.length === 0 || absorbing.length === 0) return null;
  const Q = transient.map((i) => transient.map((j) => P[i]![j]!));
  const R = transient.map((i) => absorbing.map((j) => P[i]![j]!));
  const IminusQ = matSub(identity(transient.length), Q);
  const N = inverse(IminusQ);
  if (!N) return null;
  const B = matMul(N, R);
  const t = N.map((row) => sum(row));
  return { transient, absorbing, Q, R, IminusQ, N, B, t };
}

