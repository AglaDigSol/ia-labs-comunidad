// Teoría de matrices y vectores para preguntas tipo examen:
// - Propiedades del determinante: det(kA) = kⁿ·det A, det(AB) = det A·det B, det(A⁻¹) = 1/det A,
//   det(Aᵀ) = det A, y det A = producto de los autovalores (A diagonalizable). detOfExpr aplica las
//   reglas; evalMatrixExpr calcula la matriz para comprobarlas en los tests.
// - Determinante de una matriz con una sola entrada no nula por fila y columna (como la antidiagonal
//   de unos): signo de la permutación por el producto de las entradas.
// - Autovalores numéricos (n ≤ 3) para decidir si una matriz es diagonalizable en ℝ, definida positiva…
// - Normas ‖·‖₁, ‖·‖₂, ‖·‖∞, producto escalar y cuántos α cumplen unas condiciones con normas.
// - Vocabulario de tensores del curso: rango = número de índices (ndim), dimensión = tamaño de cada uno.
import { add, cmp, div, equals, frac, isZero, mul, neg, ONE, sign, toNumber, ZERO, type Frac } from "../rational.ts";
import { detElimination, matrixDeterminant } from "./det.ts";
import { charPolynomial, eigenspace, rationalRoots } from "./eigen.ts";
import { dot, identityMatrix, isSquareMatrix, matrixProduct, matrixScale, matrixTranspose, type Matrix, type Vector } from "./matrix.ts";
import { matrixInverse, matrixRank } from "./rref.ts";

// ---------------------------------------------------------------- Propiedades del determinante

export type DetName = "A" | "B";
/** Un factor de un producto de matrices: A, A⁻¹, A², Aᵀ… */
export interface DetFactor {
  m: DetName;
  /** Exponente: 1, 2, 3 o −1. */
  pow: number;
  T?: boolean;
}
/** k·M₁·M₂·…: el número delante y los factores. */
export interface DetExpr {
  k: number;
  factors: DetFactor[];
}

const fpow = (x: Frac, p: number): Frac | null => {
  if (p < 0) {
    if (isZero(x)) return null;
    return fpow(div(ONE, x), -p);
  }
  let r = ONE;
  for (let i = 0; i < p; i++) r = mul(r, x);
  return r;
};

/**
 * det(k·M₁·…) con las reglas: kⁿ por el producto de det(Mᵢ)^potencia (la traspuesta no cambia nada).
 * null si hace falta la inversa de una matriz singular.
 */
export function detOfExpr(e: DetExpr, n: number, dets: Readonly<Record<DetName, Frac>>): Frac | null {
  let r = fpow(frac(BigInt(e.k)), n)!;
  for (const f of e.factors) {
    const p = fpow(dets[f.m], f.pow);
    if (!p) return null;
    r = mul(r, p);
  }
  return r;
}

/** La matriz k·M₁·M₂·… calculada (para comprobar las reglas). null si alguna inversa no existe. */
export function evalMatrixExpr(e: DetExpr, mats: Readonly<Record<DetName, Matrix>>): Matrix | null {
  const n = mats.A.length;
  let M = identityMatrix(n);
  for (const f of e.factors) {
    let X = mats[f.m];
    if (f.T) X = matrixTranspose(X);
    if (f.pow < 0) {
      const inv = matrixInverse(X);
      if (!inv) return null;
      X = inv.inverse;
    }
    for (let i = 0; i < Math.abs(f.pow); i++) M = matrixProduct(M, X);
  }
  return matrixScale(frac(BigInt(e.k)), M);
}

/** «−2AB⁻¹», «3Aᵀ», «A²B», «(Bᵀ)⁻¹» (la traspuesta con otro exponente, entre paréntesis). */
export function detExprText(e: DetExpr): string {
  const sup: Record<string, string> = { "-1": "⁻¹", "2": "²", "3": "³" };
  const k = e.k === 1 ? "" : e.k === -1 ? "−" : String(e.k).replace("-", "−");
  return k + e.factors.map((f) => (f.pow === 1 ? `${f.m}${f.T ? "ᵀ" : ""}` : `${f.T ? `(${f.m}ᵀ)` : f.m}${sup[String(f.pow)]}`)).join("");
}

export function detExprTex(e: DetExpr): string {
  const k = e.k === 1 ? "" : e.k === -1 ? "-" : String(e.k);
  return (
    k +
    e.factors
      .map((f) => {
        // (B^{T})^{-1}, nunca B^{T-1}: la traspuesta y la potencia son dos exponentes distintos.
        const base = f.T ? `${f.m}^{T}` : f.m;
        if (f.pow === 1) return base;
        return `${f.T ? `(${base})` : base}^{${f.pow}}`;
      })
      .join("")
  );
}

// ---------------------------------------------------------------- Matrices de permutación generalizadas

/** Signo de una permutación (−1)^(inversiones). */
export function permutationSign(perm: readonly number[]): 1 | -1 {
  let inv = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i]! > perm[j]!) inv++;
  return inv % 2 === 0 ? 1 : -1;
}

/**
 * Si M tiene exactamente una entrada no nula en cada fila y columna, su determinante es el signo de
 * la permutación (fila i → columna σ(i)) por el producto de esas entradas. Si no es así, null.
 */
export function permutationDeterminant(M: Matrix): { det: Frac; perm: number[]; sign: 1 | -1 } | null {
  if (!isSquareMatrix(M)) return null;
  const perm: number[] = [];
  let prod = ONE;
  for (const row of M) {
    const nz = row.map((x, j) => (isZero(x) ? -1 : j)).filter((j) => j >= 0);
    if (nz.length !== 1) return null;
    perm.push(nz[0]!);
    prod = mul(prod, row[nz[0]!]!);
  }
  if (new Set(perm).size !== perm.length) return null;
  const s = permutationSign(perm);
  return { det: s === 1 ? prod : neg(prod), perm, sign: s };
}

// ---------------------------------------------------------------- Autovalores (n ≤ 3)

export type Complex = { re: number; im: number };

/** Raíces del polinomio característico (coeficientes de menor a mayor grado), con complejas. */
export function polyRootsNumeric(p: readonly Frac[]): Complex[] {
  const c = p.map(toNumber);
  while (c.length > 1 && c[c.length - 1] === 0) c.pop();
  const deg = c.length - 1;
  if (deg === 1) return [{ re: -c[0]! / c[1]!, im: 0 }];
  if (deg === 2) {
    const [C, B, A] = c as [number, number, number];
    const D = B * B - 4 * A * C;
    if (D >= 0) return [{ re: (-B - Math.sqrt(D)) / (2 * A), im: 0 }, { re: (-B + Math.sqrt(D)) / (2 * A), im: 0 }];
    return [{ re: -B / (2 * A), im: -Math.sqrt(-D) / (2 * A) }, { re: -B / (2 * A), im: Math.sqrt(-D) / (2 * A) }];
  }
  if (deg === 3) {
    // Una raíz real por bisección y las otras dos de la cuadrática que queda.
    const [d0, d1, d2, d3] = c as [number, number, number, number];
    const f = (x: number) => ((d3 * x + d2) * x + d1) * x + d0;
    const R = 1 + Math.max(Math.abs(d0), Math.abs(d1), Math.abs(d2)) / Math.abs(d3);
    let lo = -R;
    let hi = R;
    const slo = Math.sign(f(lo));
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2;
      if (Math.sign(f(m)) === slo) lo = m;
      else hi = m;
    }
    const r = (lo + hi) / 2;
    // Ruffini: d3x² + (d2 + d3 r)x + (d1 + (d2 + d3 r) r).
    const q1 = d2 + d3 * r;
    const q0 = d1 + q1 * r;
    const rest = polyRootsNumeric([q0, q1, d3].map((x) => frac(BigInt(Math.round(x * 1e9)), 1000000000n)));
    return [{ re: r, im: 0 }, ...rest];
  }
  return [];
}

/** Autovalores de A (n ≤ 3): exactos si son racionales; si no, numéricos. */
export function eigenvaluesNumeric(A: Matrix): Complex[] {
  const p = charPolynomial(A);
  const r = rationalRoots(p);
  if (r.complete) return r.roots.flatMap((x) => Array.from({ length: x.mult }, () => ({ re: toNumber(x.value), im: 0 })));
  return polyRootsNumeric(p);
}

const TOL = 1e-7;

/** ¿Diagonalizable en ℝ? Autovalores reales y, si alguno se repite, su autoespacio con la dimensión de su multiplicidad. */
export function isRealDiagonalizable(A: Matrix): boolean {
  const p = charPolynomial(A);
  const r = rationalRoots(p);
  if (r.complete) return r.roots.every((x) => eigenspace(A, x.value).length === x.mult);
  const roots = polyRootsNumeric(p);
  if (roots.some((z) => Math.abs(z.im) > TOL)) return false;
  // Las raíces irracionales son simples (el factor que queda es irreducible sobre ℚ, así que no tiene
  // raíces repetidas); las racionales se miran exactas.
  return r.roots.every((x) => eigenspace(A, x.value).length === x.mult);
}

export const allEigenReal = (A: Matrix) => eigenvaluesNumeric(A).every((z) => Math.abs(z.im) <= TOL);
export const allEigenPositive = (A: Matrix) => eigenvaluesNumeric(A).every((z) => Math.abs(z.im) <= TOL && z.re > TOL);

export const isSymmetric = (A: Matrix) => A.every((row, i) => row.every((x, j) => equals(x, A[j]![i]!)));

/** Definida positiva (simétrica y menores principales > 0, criterio de Sylvester). */
export function isPositiveDefinite(A: Matrix): boolean {
  if (!isSymmetric(A)) return false;
  for (let k = 1; k <= A.length; k++) {
    const M = A.slice(0, k).map((r) => r.slice(0, k));
    if (sign(detElimination(M)) <= 0) return false;
  }
  return true;
}

export const isRegular = (A: Matrix) => !isZero(matrixDeterminant(A));
export const traceOf = (A: Matrix): Frac => A.reduce((s, r, i) => add(s, r[i]!), ZERO);
export const matrixRankOf = (A: Matrix) => matrixRank(A);

// ---------------------------------------------------------------- Normas

export const norm1 = (v: Vector): Frac => v.reduce((s, x) => add(s, x.n < 0n ? neg(x) : x), ZERO);
export const normInf = (v: Vector): Frac => v.reduce((m, x) => (cmp(x.n < 0n ? neg(x) : x, m) > 0 ? (x.n < 0n ? neg(x) : x) : m), ZERO);
/** ‖v‖₂² (exacto); ‖v‖₂ es su raíz. */
export const norm2Squared = (v: Vector): Frac => dot(v, v);
export const norm2 = (v: Vector): number => Math.sqrt(toNumber(norm2Squared(v)));

/** Una componente c + a·α. */
export type AlphaEntry = [number, number];
export type AlphaQty =
  | { k: "dot"; u: AlphaEntry[]; v: AlphaEntry[] }
  | { k: "norm1"; v: AlphaEntry[] }
  | { k: "norm2sq"; v: AlphaEntry[] }
  | { k: "normInf"; v: AlphaEntry[] }
  | { k: "num"; value: number };
export type AlphaCondition = { lhs: AlphaQty; op: "=" | ">" | "<"; rhs: AlphaQty };

const vecAt = (v: readonly AlphaEntry[], a: Frac): Vector => v.map(([c, k]) => add(frac(BigInt(c)), mul(frac(BigInt(k)), a)));

export function alphaQty(q: AlphaQty, a: Frac): Frac {
  switch (q.k) {
    case "dot":
      return dot(vecAt(q.u, a), vecAt(q.v, a));
    case "norm1":
      return norm1(vecAt(q.v, a));
    case "norm2sq":
      return norm2Squared(vecAt(q.v, a));
    case "normInf":
      return normInf(vecAt(q.v, a));
    case "num":
      return frac(BigInt(q.value));
  }
}

/** Lo mismo con números: con α diádico (k/32) y enteros pequeños, la cuenta en coma flotante es exacta. */
function qtyNum(q: AlphaQty, a: number): number {
  const at = (v: readonly AlphaEntry[]) => v.map(([c, k]) => c + k * a);
  switch (q.k) {
    case "dot": {
      const u = at(q.u);
      const v = at(q.v);
      return u.reduce((s, x, i) => s + x * v[i]!, 0);
    }
    case "norm1":
      return at(q.v).reduce((s, x) => s + Math.abs(x), 0);
    case "norm2sq":
      return at(q.v).reduce((s, x) => s + x * x, 0);
    case "normInf":
      return Math.max(0, ...at(q.v).map(Math.abs));
    case "num":
      return q.value;
  }
}

const gap = (c: AlphaCondition, a: number) => qtyNum(c.lhs, a) - qtyNum(c.rhs, a);
const holds = (c: AlphaCondition, a: number) => {
  const g = gap(c, a);
  return c.op === "=" ? g === 0 : c.op === ">" ? g > 0 : g < 0;
};

export type AlphaCount = { kind: "finito"; count: number; values: number[] } | { kind: "infinitos" };

/**
 * ¿Cuántos α (≥ 0 o en todo ℝ) cumplen todas las condiciones? Las igualdades se buscan en una malla
 * de paso 1/32 en [−R, R] (exacta: enteros, medios, cuartos…), y entre sus puntos por cambio de signo
 * (raíces irracionales, afinadas por bisección); si se cumplen en un tramo entero, son infinitos. Las
 * desigualdades filtran.
 */
export function countAlpha(conds: readonly AlphaCondition[], domain: "nonneg" | "real", R = 20): AlphaCount {
  const all = (a: number) => conds.every((c) => holds(c, a));
  const lo = domain === "nonneg" ? 0 : -R * 32;
  const grid: number[] = [];
  for (let i = lo; i <= R * 32; i++) grid.push(i / 32);
  const ok = grid.map(all);
  // Tramo entero: dos puntos seguidos de la malla y su punto medio.
  for (let i = 0; i + 1 < grid.length; i++) if (ok[i] && ok[i + 1] && all((grid[i]! + grid[i + 1]!) / 2)) return { kind: "infinitos" };
  const values: number[] = grid.filter((_, i) => ok[i]);
  // Ceros de la primera igualdad entre puntos de la malla (irracionales), si cumplen el resto.
  const main = conds.find((c) => c.op === "=");
  if (main) {
    for (let i = 0; i + 1 < grid.length; i++) {
      let a = grid[i]!;
      let b = grid[i + 1]!;
      const ga = gap(main, a);
      const gb = gap(main, b);
      if (ga === 0 || gb === 0 || Math.sign(ga) === Math.sign(gb)) continue;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if (Math.sign(gap(main, m)) === Math.sign(ga)) a = m;
        else b = m;
      }
      const r = (a + b) / 2;
      const restOk = conds.every((c) => c === main || (c.op === "=" ? Math.abs(gap(c, r)) < 1e-6 : c.op === ">" ? gap(c, r) > 0 : gap(c, r) < 0));
      if (restOk && !values.some((v) => Math.abs(v - r) < 1e-9)) values.push(r);
    }
  }
  values.sort((x, y) => x - y);
  return { kind: "finito", count: values.length, values };
}

// ---------------------------------------------------------------- Tensores: vocabulario del curso

/**
 * En el curso, A ∈ ℝ^{n×n×…×n} (k índices) es un «tensor de rango k y dimensión n»: el rango es el
 * número de índices (el ndim de NumPy) y la dimensión, lo que mide cada índice (cada número del shape).
 * No es el rango de una matriz (rg). Tiene nᵏ componentes.
 */
export function tensorVocabulary(shape: readonly number[]): { rango: number; dimension: number | null; componentes: number } {
  const dimension = shape.length > 0 && shape.every((d) => d === shape[0]) ? shape[0]! : null;
  return { rango: shape.length, dimension, componentes: shape.reduce((a, b) => a * b, 1) };
}
