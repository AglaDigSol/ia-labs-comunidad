import { div, equals, isZero, mul, neg, ONE, sign, sub, sum, toTexNumber, ZERO, type Frac } from "../rational.ts";
import { identity, transpose, vecMul, type Mat, type Vec } from "./matrix.ts";

// Exact linear algebra on rationals (BigInt). No float tolerance anywhere.
// TeX strings are built only from toTexNumber and integer indices.

export type Solve = { kind: "unique"; x: Vec } | { kind: "none" } | { kind: "infinite"; rank: number };

/** Gauss-Jordan on [A | b] with first non-zero pivot. */
export function solveLinear(A: Mat, b: Vec): Solve {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const M: Mat = A.map((r, i) => [...r, b[i]!]);
  let rank = 0;
  const pivotCols: number[] = [];
  for (let c = 0; c < cols && rank < rows; c++) {
    let p = -1;
    for (let r = rank; r < rows; r++) {
      if (!isZero(M[r]![c]!)) {
        p = r;
        break;
      }
    }
    if (p < 0) continue;
    [M[rank], M[p]] = [M[p]!, M[rank]!];
    const pv = M[rank]![c]!;
    M[rank] = M[rank]!.map((x) => div(x, pv));
    for (let r = 0; r < rows; r++) {
      if (r === rank) continue;
      const factor = M[r]![c]!;
      if (isZero(factor)) continue;
      M[r] = M[r]!.map((x, k) => sub(x, mul(factor, M[rank]![k]!)));
    }
    pivotCols.push(c);
    rank++;
  }
  for (let r = rank; r < rows; r++) {
    if (!isZero(M[r]![cols]!)) return { kind: "none" };
  }
  if (rank < cols) return { kind: "infinite", rank };
  const x: Vec = Array.from({ length: cols }, () => ZERO);
  pivotCols.forEach((c, r) => {
    x[c] = M[r]![cols]!;
  });
  return { kind: "unique", x };
}

export function determinant(A: Mat): Frac {
  const n = A.length;
  const M: Mat = A.map((r) => [...r]);
  let det = ONE;
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++) {
      if (!isZero(M[r]![c]!)) {
        p = r;
        break;
      }
    }
    if (p < 0) return ZERO;
    if (p !== c) {
      [M[c], M[p]] = [M[p]!, M[c]!];
      det = neg(det);
    }
    const pv = M[c]![c]!;
    det = mul(det, pv);
    for (let r = c + 1; r < n; r++) {
      const factor = div(M[r]![c]!, pv);
      if (isZero(factor)) continue;
      M[r] = M[r]!.map((x, k) => sub(x, mul(factor, M[c]![k]!)));
    }
  }
  return det;
}

export function inverse(A: Mat): Mat | null {
  const n = A.length;
  const I = identity(n);
  const M: Mat = A.map((r, i) => [...r, ...I[i]!]);
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++) {
      if (!isZero(M[r]![c]!)) {
        p = r;
        break;
      }
    }
    if (p < 0) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    const pv = M[c]![c]!;
    M[c] = M[c]!.map((x) => div(x, pv));
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const factor = M[r]![c]!;
      if (isZero(factor)) continue;
      M[r] = M[r]!.map((x, k) => sub(x, mul(factor, M[c]![k]!)));
    }
  }
  return M.map((r) => r.slice(n));
}

function pmatrix(rows: string[][]): string {
  return `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
}

export type Stationary =
  | { kind: "unique"; pi: Vec; equations: string[]; check: boolean }
  | { kind: "not-unique"; dimension: number; equations: string[] }
  | { kind: "invalid"; negatives: number[] };

export function stationary(P: Mat): Stationary {
  const n = P.length;
  const equations: string[] = [];
  for (let j = 0; j < n; j++) {
    const terms = P.map((row, i) => `${toTexNumber(row[j]!)}\\pi_{${i + 1}}`).join(" + ");
    equations.push(`\\pi_{${j + 1}} = ${terms}`);
  }
  equations.push(`${P.map((_, i) => `\\pi_{${i + 1}}`).join(" + ")} = 1`);

  const A = transpose(P).map((row, i) => row.map((x, j) => (i === j ? sub(x, ONE) : x)));
  const A2 = A.map((row, i) => (i === n - 1 ? row.map(() => ONE) : row));
  const b: Vec = Array.from({ length: n }, (_, i) => (i === n - 1 ? ONE : ZERO));
  const r = solveLinear(A2, b);
  if (r.kind !== "unique") {
    const h = solveLinear(A, Array.from({ length: n }, () => ZERO));
    const dimension = h.kind === "infinite" ? n - h.rank : 1;
    return { kind: "not-unique", dimension, equations };
  }
  const negatives: number[] = [];
  r.x.forEach((x, i) => {
    if (sign(x) < 0) negatives.push(i);
  });
  if (negatives.length > 0) return { kind: "invalid", negatives };
  const back = vecMul(r.x, P);
  return { kind: "unique", pi: r.x, equations, check: back.every((x, i) => equals(x, r.x[i]!)) };
}

export type InverseProblem =
  | { kind: "singular"; det: Frac; system: "none" | "infinite" }
  | {
      kind: "solved";
      u0: Vec;
      det: Frac;
      inverseTex: string;
      systemTex: string[];
      valid: boolean;
      negatives: number[];
      sum: Frac;
    };

// u0 P = v  <=>  Pᵀ u0ᵀ = vᵀ
export function inverseProblem(P: Mat, v: Vec): InverseProblem {
  const det = determinant(P);
  const r = solveLinear(transpose(P), v);
  const inv = isZero(det) ? null : inverse(P);
  if (r.kind !== "unique" || inv === null) {
    return { kind: "singular", det, system: r.kind === "none" ? "none" : "infinite" };
  }
  const u0 = r.x;
  const negatives: number[] = [];
  u0.forEach((x, i) => {
    if (sign(x) < 0) negatives.push(i);
  });
  const total = sum(u0);
  const n = P.length;
  const systemTex = Array.from({ length: n }, (_, j) => {
    const terms = P.map((row, i) => `${toTexNumber(row[j]!)}u_{${i + 1}}`).join(" + ");
    return `${terms} = ${toTexNumber(v[j]!)}`;
  });
  return {
    kind: "solved",
    u0,
    det,
    inverseTex: pmatrix(inv.map((row) => row.map((x) => (x.d !== 1n && x.d <= 100n ? `${x.n < 0n ? "-" : ""}\\tfrac{${x.n < 0n ? -x.n : x.n}}{${x.d}}` : toTexNumber(x, 4))))),
    systemTex,
    valid: negatives.length === 0 && equals(total, ONE),
    negatives,
    sum: total,
  };
}

