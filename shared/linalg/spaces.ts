// Espacios vectoriales con racionales exactos: núcleo (espacio nulo), independencia lineal, base y
// dimensión del subespacio generado, y la corrección de una base propuesta por el estudiante (vale
// cualquier base, no solo la que sale de Gauss).
import { isZero, neg, ONE, ZERO } from "../rational.ts";
import { matrixCols, matrixTranspose, type Matrix, type Vector } from "./matrix.ts";
import { matrixRank, rref } from "./rref.ts";

/**
 * Base del núcleo {x : M·x = 0}, una por variable libre: la libre vale 1, las demás libres 0 y las
 * pivote se despejan de la forma reducida. Vacía si el núcleo es {0}.
 */
export function nullSpace(M: Matrix): Vector[] {
  const n = matrixCols(M);
  const R = rref(M);
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => !R.pivots.includes(j));
  return free.map((f) => {
    const v: Vector = Array.from({ length: n }, () => ZERO);
    v[f] = ONE;
    R.pivots.forEach((c, r) => {
      v[c] = neg(R.matrix[r]![f]!);
    });
    return v;
  });
}

/** Columnas libres (sin pivote) de M, desde 0. */
export function freeColumns(M: Matrix): number[] {
  const R = rref(M);
  return Array.from({ length: matrixCols(M) }, (_, j) => j).filter((j) => !R.pivots.includes(j));
}

/** Rango de una lista de vectores (los pone como filas). */
export const vectorsRank = (vs: readonly Vector[]): number => (vs.length === 0 ? 0 : matrixRank(vs.map((v) => [...v])));

/** ¿Son linealmente independientes? (El vector nulo nunca lo es.) */
export const isIndependent = (vs: readonly Vector[]): boolean => vectorsRank(vs) === vs.length;

/** ¿Está v en el subespacio generado por vs? */
export function inSpan(v: Vector, vs: readonly Vector[]): boolean {
  if (v.every(isZero)) return true;
  return vectorsRank([...vs, v]) === vectorsRank(vs);
}

/**
 * Base de ⟨v₁, …, vₖ⟩ formada por vectores de la lista: los de las columnas pivote al ponerlos como
 * columnas. Devuelve sus índices (desde 0).
 */
export function spanBasisIndices(vs: readonly Vector[]): number[] {
  if (vs.length === 0) return [];
  const M = matrixTranspose(vs.map((v) => [...v]));
  return rref(M).pivots;
}

/** Una relación de dependencia c₁v₁ + … + cₖvₖ = 0 no trivial, o null si son independientes. */
export function dependenceRelation(vs: readonly Vector[]): Vector | null {
  if (vs.length === 0) return null;
  const ker = nullSpace(matrixTranspose(vs.map((v) => [...v])));
  return ker[0] ?? null;
}

export interface BasisCheck {
  /** Por cada vector propuesto: ¿está en el subespacio? */
  inSpan: boolean[];
  /** ¿Son independientes los propuestos? */
  independent: boolean;
  /** dim del subespacio. */
  dimension: number;
  ok: boolean;
}

/** ¿Es `basis` una base de ⟨vs⟩? Cada vector en el subespacio, independientes y tantos como la dimensión. */
export function checkBasis(basis: readonly Vector[], vs: readonly Vector[]): BasisCheck {
  const dimension = vectorsRank(vs);
  const each = basis.map((b) => inSpan(b, vs));
  const independent = isIndependent(basis);
  return { inSpan: each, independent, dimension, ok: each.every(Boolean) && independent && basis.length === dimension };
}
