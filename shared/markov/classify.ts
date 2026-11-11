// Clasificación de los estados de una cadena de Markov finita: qué estados se alcanzan desde cada uno
// (por entradas positivas de P), las clases comunicantes, cuáles son cerradas (no se sale de ellas) y
// el tipo de cada estado. En una cadena finita, un estado es recurrente si su clase es cerrada y
// transitorio si no; es absorbente si además pᵢᵢ = 1 (su clase es él solo).
import { equals, ONE, sign } from "../rational.ts";
import type { Mat } from "./matrix.ts";

export type StateKind = "absorbente" | "recurrente" | "transitorio";

export const STATE_KIND_LABELS: Record<StateKind, string> = {
  absorbente: "Absorbente",
  recurrente: "Recurrente (no absorbente)",
  transitorio: "Transitorio",
};

export interface StateClassification {
  /** reach[i][j]: se puede ir de i a j en cero o más pasos. */
  reach: boolean[][];
  /** Clases comunicantes (índices desde 0, en orden de su primer estado). */
  classes: number[][];
  /** ¿Es cerrada cada clase? */
  closed: boolean[];
  /** Clase de cada estado (índice en `classes`). */
  classOf: number[];
  /** Tipo de cada estado. */
  kind: StateKind[];
}

/** Clasifica los estados de una matriz estocástica cuadrada. */
export function classifyStates(P: Mat): StateClassification {
  const n = P.length;
  const reach = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j));
  for (let i = 0; i < n; i++) {
    const stack = [i];
    while (stack.length > 0) {
      const u = stack.pop()!;
      for (let v = 0; v < n; v++) {
        if (sign(P[u]![v]!) > 0 && !reach[i]![v]) {
          reach[i]![v] = true;
          stack.push(v);
        }
      }
    }
  }
  const classOf = Array.from({ length: n }, () => -1);
  const classes: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (classOf[i]! >= 0) continue;
    const c = Array.from({ length: n }, (_, j) => j).filter((j) => reach[i]![j] && reach[j]![i]);
    for (const j of c) classOf[j] = classes.length;
    classes.push(c);
  }
  const closed = classes.map((c) => c.every((i) => P[i]!.every((x, j) => sign(x) === 0 || c.includes(j))));
  const kind = Array.from({ length: n }, (_, i): StateKind => {
    if (!closed[classOf[i]!]) return "transitorio";
    return equals(P[i]![i]!, ONE) ? "absorbente" : "recurrente";
  });
  return { reach, classes, closed, classOf, kind };
}
