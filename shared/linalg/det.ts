// Determinantes exactos: por cofactores (desarrollo por la primera fila, como en clase, para n ≤ 3)
// y por eliminación gaussiana (cualquier n). matrixDeterminant elige el método; los tests comprueban
// que los dos coinciden.
import { add, div, isZero, mul, neg, ONE, sub, ZERO, type Frac } from "../rational.ts";
import { isSquareMatrix, type Matrix } from "./matrix.ts";

/** Menor complementario: quita la fila i y la columna j. */
export function minor(M: Matrix, i: number, j: number): Matrix {
  return M.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
}

/** Adjunto (cofactor) Aᵢⱼ = (−1)^(i+j) · |Mᵢⱼ|. */
export function cofactor(M: Matrix, i: number, j: number): Frac {
  const m = detCofactor(minor(M, i, j));
  return (i + j) % 2 === 0 ? m : neg(m);
}

/** Desarrollo por la primera fila (Laplace). Exponencial: solo para matrices pequeñas. */
export function detCofactor(M: Matrix): Frac {
  if (!isSquareMatrix(M) && M.length !== 0) throw new RangeError("La matriz no es cuadrada");
  const n = M.length;
  if (n === 0) return ONE;
  if (n === 1) return M[0]![0]!;
  if (n === 2) return sub(mul(M[0]![0]!, M[1]![1]!), mul(M[0]![1]!, M[1]![0]!));
  let acc = ZERO;
  for (let j = 0; j < n; j++) {
    if (isZero(M[0]![j]!)) continue;
    acc = add(acc, mul(M[0]![j]!, cofactor(M, 0, j)));
  }
  return acc;
}

/** Eliminación gaussiana: cada intercambio cambia el signo; el determinante es el producto de pivotes. */
export function detElimination(A: Matrix): Frac {
  if (!isSquareMatrix(A) && A.length !== 0) throw new RangeError("La matriz no es cuadrada");
  const n = A.length;
  const M = A.map((r) => [...r]);
  let det = ONE;
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && isZero(M[p]![c]!)) p++;
    if (p === n) return ZERO;
    if (p !== c) {
      [M[c], M[p]] = [M[p]!, M[c]!];
      det = neg(det);
    }
    const pv = M[c]![c]!;
    det = mul(det, pv);
    for (let r = c + 1; r < n; r++) {
      const f = div(M[r]![c]!, pv);
      if (isZero(f)) continue;
      M[r] = M[r]!.map((x, k) => sub(x, mul(f, M[c]![k]!)));
    }
  }
  return det;
}

/** |A|: cofactores hasta 3×3 y eliminación a partir de 4×4. */
export const matrixDeterminant = (M: Matrix): Frac => (M.length <= 3 ? detCofactor(M) : detElimination(M));

/** Regla de Sarrus (3×3): los seis productos, con su signo, para explicar la solución. */
export function sarrusTerms(M: Matrix): Array<{ factors: [Frac, Frac, Frac]; sign: 1 | -1 }> {
  if (M.length !== 3 || !isSquareMatrix(M)) throw new RangeError("Sarrus solo vale para 3×3");
  const e = (i: number, j: number) => M[i]![j]!;
  return [
    { factors: [e(0, 0), e(1, 1), e(2, 2)], sign: 1 },
    { factors: [e(0, 1), e(1, 2), e(2, 0)], sign: 1 },
    { factors: [e(0, 2), e(1, 0), e(2, 1)], sign: 1 },
    { factors: [e(0, 2), e(1, 1), e(2, 0)], sign: -1 },
    { factors: [e(0, 0), e(1, 2), e(2, 1)], sign: -1 },
    { factors: [e(0, 1), e(1, 0), e(2, 2)], sign: -1 },
  ];
}
