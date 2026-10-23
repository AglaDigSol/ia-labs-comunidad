import { add, mul, sub, ZERO, ONE, type Frac } from "../rational.ts";

export type Vec = Frac[];
export type Mat = Frac[][];

export function vecMul(v: Vec, P: Mat): Vec {
  const cols = P[0]?.length ?? 0;
  const out: Vec = [];
  for (let j = 0; j < cols; j++) {
    let acc = ZERO;
    for (let i = 0; i < v.length; i++) acc = add(acc, mul(v[i]!, P[i]![j]!));
    out.push(acc);
  }
  return out;
}

export function matMul(A: Mat, B: Mat): Mat {
  return A.map((row) => vecMul(row, B));
}

export function transpose(A: Mat): Mat {
  const cols = A[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, j) => A.map((row) => row[j]!));
}

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));
}

export function matSub(A: Mat, B: Mat): Mat {
  return A.map((row, i) => row.map((x, j) => sub(x, B[i]![j]!)));
}

export function isSquare(A: Mat): boolean {
  return A.length > 0 && A.every((r) => r.length === A.length);
}
