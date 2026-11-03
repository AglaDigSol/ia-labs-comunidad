// Afirmaciones de teoría sobre matrices y vectores, para preguntas de verdadero/falso y de «selecciona
// la o las correctas». Cada clase dice de qué se habla («Sea A ∈ ℝⁿˣⁿ simétrica…»), cómo se fabrican
// ejemplos de esa clase y cómo se reconoce uno. Cada afirmación lleva su verdad y una comprobación
// `holds` sobre un ejemplo: los tests verifican que las verdaderas se cumplen en cientos de ejemplos
// al azar y que cada falsa tiene un contraejemplo de la clase en el que no se cumple (y ese
// contraejemplo se enseña en la solución). Así ninguna respuesta depende solo de lo que se escribió
// a mano.
import type { Rng } from "../exercises/random.ts";
import { add, cmp, equals, frac, isZero, mul, neg, sign, toNumber, ZERO, type Frac } from "../rational.ts";
import { matrixDeterminant } from "./det.ts";
import { dot, identityMatrix, intMatrix, intVector, isZeroVector, matrixAdd, matrixEquals, matrixProduct, matrixScale, matrixSub, matrixTranspose, vectorAdd, vectorScale, type Matrix, type Vector } from "./matrix.ts";
import { matrixInverse, matrixRank } from "./rref.ts";
import { nullSpace } from "./spaces.ts";
import { allEigenPositive, allEigenReal, eigenvaluesNumeric, isPositiveDefinite, isRealDiagonalizable, isRegular, isSymmetric, norm1, norm2Squared, normInf, traceOf } from "./theory.ts";

export interface Sample {
  A: Matrix;
  B: Matrix;
  u: Vector;
  v: Vector;
}

/** Ejemplo con enteros (para escribir contraejemplos a mano). */
export interface IntSample {
  A?: number[][];
  B?: number[][];
  u?: number[];
  v?: number[];
}

export const toSample = (s: IntSample): Sample => ({
  A: intMatrix(s.A ?? [[0]]),
  B: intMatrix(s.B ?? s.A ?? [[0]]),
  u: intVector(s.u ?? [0]),
  v: intVector(s.v ?? [0]),
});

export interface Claim {
  id: string;
  text: string;
  tex?: string;
  truth: boolean;
  /** La regla que lo decide (para la solución). */
  why: string;
  holds: (s: Sample) => boolean;
  /** Para las falsas: un ejemplo de la clase en el que no se cumple. */
  counterexample?: IntSample;
}

export interface ClaimClass {
  id: string;
  /** Enunciado: «Sea A ∈ ℝⁿˣⁿ una matriz simétrica.» */
  subject: string;
  /** Nivel a partir del que aparece. */
  level: "básico" | "medio" | "avanzado";
  /** ¿Es el ejemplo de esta clase? */
  member: (s: Sample) => boolean;
  /** Un ejemplo al azar de la clase (n = 2 o 3 si la clase es n×n). */
  sample: (rng: Rng) => Sample;
  claims: Claim[];
}

// ---------------------------------------------------------------- Ejemplos al azar

const ints = (rng: Rng, n: number, m: number, r: number) => Array.from({ length: n }, () => Array.from({ length: m }, () => rng.int(-r, r)));
const sym = (rng: Rng, n: number, r: number) => {
  const M = ints(rng, n, n, r);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) M[i]![j] = M[j]![i]!;
  return M;
};
const vec = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.int(-4, 4));
const nOf = (rng: Rng) => rng.pick([2, 3]);
const until = (rng: Rng, make: () => number[][], ok: (M: Matrix) => boolean): Matrix => {
  for (let i = 0; i < 500; i++) {
    const M = intMatrix(make());
    if (ok(M)) return M;
  }
  throw new Error("muestra: no sale");
};
const pair = (A: Matrix, B?: Matrix): Sample => ({ A, B: B ?? A, u: [ZERO], v: [ZERO] });

/** Unimodular (det ±1): la identidad con operaciones de fila al azar. */
function unimodularInts(rng: Rng, n: number): number[][] {
  const M: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let t = 0; t < 3; t++) {
    const i = rng.int(0, n - 1);
    let j = rng.int(0, n - 2);
    if (j >= i) j++;
    const k = rng.pick([-1, 1, 2]);
    M[i] = M[i]!.map((x, c) => x + k * M[j]![c]!);
  }
  return M;
}

/** P·D·P⁻¹ con D = diag(λ…): diagonalizable con esos autovalores. */
function diagonalizable(rng: Rng, lambdas: number[]): Matrix {
  const P = intMatrix(unimodularInts(rng, lambdas.length));
  const D = intMatrix(lambdas.map((l, i) => lambdas.map((_, j) => (i === j ? l : 0))));
  return matrixProduct(matrixProduct(P, D), matrixInverse(P)!.inverse);
}

const det = matrixDeterminant;
const dim = (A: Matrix) => A.length;
const rank = matrixRank;
const abs = (x: Frac) => (x.n < 0n ? neg(x) : x);
const sameSigns = (A: Matrix) => {
  const ev = eigenvaluesNumeric(A);
  return ev.every((z) => Math.abs(z.im) < 1e-7) && (ev.every((z) => z.re > 1e-9) || ev.every((z) => z.re < -1e-9));
};
const oppositeSigns2 = (A: Matrix) => {
  const ev = eigenvaluesNumeric(A);
  return ev.length === 2 && ev.every((z) => Math.abs(z.im) < 1e-7) && ev[0]!.re * ev[1]!.re < 0;
};

// ---------------------------------------------------------------- Clases y afirmaciones

export const CLAIM_CLASSES: ClaimClass[] = [
  {
    id: "regular",
    subject: "Sea A ∈ ℝⁿˣⁿ una matriz regular (invertible).",
    level: "básico",
    member: (s) => isRegular(s.A),
    sample: (r) => {
      const n = nOf(r);
      return pair(until(r, () => ints(r, n, n, 3), isRegular));
    },
    claims: [
      { id: "diag", text: "A es diagonalizable.", truth: false, why: "Ser regular no asegura ser diagonalizable: (1 1; 0 1) es regular y solo tiene un autovector independiente.", holds: (s) => isRealDiagonalizable(s.A), counterexample: { A: [[1, 1], [0, 1]] } },
      { id: "positivos", text: "Todos los autovalores de A son positivos.", truth: false, why: "Regular solo dice que ningún autovalor es 0; su signo puede ser cualquiera.", holds: (s) => allEigenPositive(s.A), counterexample: { A: [[-1, 0], [0, 1]] } },
      { id: "cero", text: "λ = 0 no es autovalor de A.", truth: true, why: "det(A − 0·I) = det A ≠ 0.", holds: (s) => !isZero(det(s.A)) },
      { id: "unica", text: "El sistema A·x = b tiene solución única para cada b.", truth: true, why: "rg A = n = número de incógnitas: compatible determinado (Rouché–Frobenius).", holds: (s) => rank(s.A) === dim(s.A) },
      { id: "cuadrado", text: "A² es regular.", truth: true, why: "det(A²) = det(A)² ≠ 0.", holds: (s) => isRegular(matrixProduct(s.A, s.A)) },
      { id: "simetrica", text: "A es simétrica.", truth: false, why: "Nada obliga a que A = Aᵀ.", holds: (s) => isSymmetric(s.A), counterexample: { A: [[1, 2], [0, 1]] } },
      { id: "inversa", text: "det(A⁻¹) = 1/det(A).", tex: "\\det(A^{-1}) = \\frac{1}{\\det A}", truth: true, why: "det(A)·det(A⁻¹) = det(I) = 1.", holds: (s) => equals(mul(det(s.A), det(matrixInverse(s.A)!.inverse)), frac(1n)) },
    ],
  },
  {
    id: "singular",
    subject: "Sea A ∈ ℝⁿˣⁿ una matriz no regular (singular).",
    level: "básico",
    member: (s) => !isRegular(s.A),
    sample: (r) => {
      const n = nOf(r);
      return pair(
        until(
          r,
          () => {
            const M = ints(r, n, n, 3);
            const k = r.int(-2, 2);
            M[n - 1] = M[0]!.map((x, j) => k * x + (n === 3 ? r.int(0, 1) * M[1]![j]! : 0));
            return M;
          },
          (M) => !isRegular(M),
        ),
      );
    },
    claims: [
      { id: "det", text: "det(A) = 0.", tex: "\\det A = 0", truth: true, why: "No regular significa justamente det A = 0.", holds: (s) => isZero(det(s.A)) },
      { id: "rango", text: "rg(A) < n.", tex: "\\operatorname{rg}(A) < n", truth: true, why: "det A = 0 ⇔ las filas son dependientes ⇔ rg A < n.", holds: (s) => rank(s.A) < dim(s.A) },
      { id: "cuadrado", text: "A² tampoco es regular.", truth: true, why: "det(A²) = det(A)² = 0.", holds: (s) => !isRegular(matrixProduct(s.A, s.A)) },
      { id: "nula", text: "A es la matriz nula.", truth: false, why: "Basta con que una fila dependa de las otras: (1 0; 0 0) no es nula.", holds: (s) => s.A.every((r) => r.every(isZero)), counterexample: { A: [[1, 0], [0, 0]] } },
      { id: "autovalor", text: "λ = 0 es autovalor de A.", truth: true, why: "det(A − 0·I) = 0.", holds: (s) => nullSpace(s.A).length > 0 },
      { id: "nodiag", text: "A no es diagonalizable.", truth: false, why: "diag(1, 0) es singular y diagonal.", holds: (s) => !isRealDiagonalizable(s.A), counterexample: { A: [[1, 0], [0, 0]] } },
      { id: "infinitas", text: "A·x = 0 tiene infinitas soluciones.", truth: true, why: "rg A < n: compatible indeterminado (hay vectores no nulos en el núcleo).", holds: (s) => nullSpace(s.A).length > 0 },
    ],
  },
  {
    id: "general",
    subject: "Sean A, B ∈ ℝⁿˣⁿ dos matrices cualesquiera.",
    level: "básico",
    member: () => true,
    sample: (r) => {
      const n = nOf(r);
      return pair(intMatrix(ints(r, n, n, 3)), intMatrix(ints(r, n, n, 3)));
    },
    claims: [
      { id: "suma", text: "det(A + B) = det(A) + det(B).", tex: "\\det(A + B) = \\det A + \\det B", truth: false, why: "El determinante no es lineal en la suma: con A = B = I (2×2), det(2I) = 4 ≠ 2.", holds: (s) => equals(det(matrixAdd(s.A, s.B)), add(det(s.A), det(s.B))), counterexample: { A: [[1, 0], [0, 1]], B: [[1, 0], [0, 1]] } },
      { id: "conmuta-det", text: "det(AB) = det(BA).", tex: "\\det(AB) = \\det(BA)", truth: true, why: "Los dos valen det A·det B.", holds: (s) => equals(det(matrixProduct(s.A, s.B)), det(matrixProduct(s.B, s.A))) },
      { id: "escalar", text: "det(2A) = 2·det(A).", tex: "\\det(2A) = 2\\det A", truth: false, why: "det(kA) = kⁿ·det A: el 2 sale una vez por cada fila.", holds: (s) => equals(det(matrixScale(frac(2n), s.A)), mul(frac(2n), det(s.A))), counterexample: { A: [[1, 0], [0, 1]] } },
      { id: "traspuesta", text: "det(Aᵀ) = det(A).", tex: "\\det(A^{T}) = \\det A", truth: true, why: "Trasponer no cambia el determinante.", holds: (s) => equals(det(matrixTranspose(s.A)), det(s.A)) },
      { id: "conmutan", text: "AB = BA.", truth: false, why: "El producto de matrices no es conmutativo.", holds: (s) => matrixEquals(matrixProduct(s.A, s.B), matrixProduct(s.B, s.A)), counterexample: { A: [[1, 1], [0, 1]], B: [[1, 0], [1, 1]] } },
      { id: "producto", text: "det(AB) = det(A)·det(B).", tex: "\\det(AB) = \\det A \\cdot \\det B", truth: true, why: "Propiedad multiplicativa del determinante.", holds: (s) => equals(det(matrixProduct(s.A, s.B)), mul(det(s.A), det(s.B))) },
      { id: "menos", text: "det(−A) = −det(A).", tex: "\\det(-A) = -\\det A", truth: false, why: "det(−A) = (−1)ⁿ·det A: con n par no cambia el signo.", holds: (s) => equals(det(matrixScale(frac(-1n), s.A)), neg(det(s.A))), counterexample: { A: [[1, 0], [0, 1]] } },
    ],
  },
  {
    id: "simetrica",
    subject: "Sea A ∈ ℝⁿˣⁿ una matriz simétrica.",
    level: "medio",
    member: (s) => isSymmetric(s.A),
    sample: (r) => pair(intMatrix(sym(r, nOf(r), 4))),
    claims: [
      { id: "diag", text: "A es diagonalizable en ℝ.", truth: true, why: "Teorema espectral: toda matriz simétrica real es diagonalizable (en una base ortonormal).", holds: (s) => isRealDiagonalizable(s.A) },
      { id: "reales", text: "Todos los autovalores de A son reales.", truth: true, why: "Teorema espectral.", holds: (s) => allEigenReal(s.A) },
      { id: "regular", text: "A es regular.", truth: false, why: "(1 1; 1 1) es simétrica y tiene det = 0.", holds: (s) => isRegular(s.A), counterexample: { A: [[1, 1], [1, 1]] } },
      { id: "definida", text: "A es definida positiva.", truth: false, why: "−I es simétrica y sus autovalores son negativos.", holds: (s) => isPositiveDefinite(s.A), counterexample: { A: [[-1, 0], [0, -1]] } },
      { id: "det", text: "det(A) ≥ 0.", tex: "\\det A \\ge 0", truth: false, why: "(0 1; 1 0) es simétrica con det = −1.", holds: (s) => sign(det(s.A)) >= 0, counterexample: { A: [[0, 1], [1, 0]] } },
      { id: "traspuesta", text: "Aᵀ·A = A².", tex: "A^{T}A = A^{2}", truth: true, why: "Aᵀ = A.", holds: (s) => matrixEquals(matrixProduct(matrixTranspose(s.A), s.A), matrixProduct(s.A, s.A)) },
    ],
  },
  {
    id: "simetrica-no-nulos",
    subject: "Sea A ∈ ℝⁿˣⁿ simétrica con todos sus autovalores distintos de cero.",
    level: "medio",
    member: (s) => isSymmetric(s.A) && isRegular(s.A),
    sample: (r) => {
      const n = nOf(r);
      return pair(until(r, () => sym(r, n, 4), isRegular));
    },
    claims: [
      { id: "diag", text: "A es diagonalizable.", truth: true, why: "Es simétrica (teorema espectral); que los autovalores no sean 0 no hace falta para esto.", holds: (s) => isRealDiagonalizable(s.A) },
      { id: "nodiag", text: "A no es diagonalizable.", truth: false, why: "Toda simétrica real es diagonalizable.", holds: (s) => !isRealDiagonalizable(s.A), counterexample: { A: [[2, 0], [0, 1]] } },
      { id: "regular", text: "A es regular.", truth: true, why: "det A = producto de los autovalores ≠ 0.", holds: (s) => isRegular(s.A) },
      { id: "definida", text: "A es definida positiva.", truth: false, why: "Puede tener autovalores negativos: diag(−1, 1).", holds: (s) => isPositiveDefinite(s.A), counterexample: { A: [[-1, 0], [0, 1]] } },
      { id: "det-neg", text: "det(A) < 0.", tex: "\\det A < 0", truth: false, why: "El signo del determinante depende de cuántos autovalores son negativos: con I es 1.", holds: (s) => sign(det(s.A)) < 0, counterexample: { A: [[1, 0], [0, 1]] } },
      { id: "det-pos", text: "det(A) > 0.", tex: "\\det A > 0", truth: false, why: "diag(−1, 1) tiene det = −1.", holds: (s) => sign(det(s.A)) > 0, counterexample: { A: [[-1, 0], [0, 1]] } },
    ],
  },
  {
    id: "definida-positiva",
    subject: "Sea A ∈ ℝⁿˣⁿ simétrica y definida positiva.",
    level: "medio",
    member: (s) => isPositiveDefinite(s.A),
    sample: (r) => {
      const n = nOf(r);
      const B = intMatrix(ints(r, n, n, 2));
      return pair(matrixAdd(matrixProduct(matrixTranspose(B), B), identityMatrix(n)));
    },
    claims: [
      { id: "det", text: "det(A) > 0.", tex: "\\det A > 0", truth: true, why: "det A es el producto de los autovalores, todos positivos.", holds: (s) => sign(det(s.A)) > 0 },
      { id: "regular", text: "A es regular.", truth: true, why: "det A > 0.", holds: (s) => isRegular(s.A) },
      { id: "menos-dos", text: "Existe v ≠ 0 con A·v = −2·v.", tex: "\\exists v \\ne 0:\\ Av = -2v", truth: false, why: "Eso diría que −2 es autovalor, y todos son positivos.", holds: (s) => nullSpace(matrixAdd(s.A, matrixScale(frac(2n), identityMatrix(dim(s.A))))).length > 0, counterexample: { A: [[1, 0], [0, 1]] } },
      { id: "elementos", text: "Todos los elementos de A son positivos.", truth: false, why: "(2 −1; −1 2) es definida positiva y tiene elementos negativos.", holds: (s) => s.A.every((r) => r.every((x) => sign(x) > 0)), counterexample: { A: [[2, -1], [-1, 2]] } },
      { id: "traza", text: "traza(A) > 0.", truth: true, why: "La traza es la suma de los autovalores, todos positivos.", holds: (s) => sign(traceOf(s.A)) > 0 },
      { id: "autovalores", text: "Todos los autovalores de A son positivos.", truth: true, why: "Es la definición (para simétricas).", holds: (s) => allEigenPositive(s.A) },
    ],
  },
  {
    id: "simetrica-2-det-neg",
    subject: "Sea A ∈ ℝ²ˣ² simétrica con det(A) < 0.",
    level: "avanzado",
    member: (s) => dim(s.A) === 2 && isSymmetric(s.A) && sign(det(s.A)) < 0,
    sample: (r) => pair(until(r, () => sym(r, 2, 4), (M) => sign(det(M)) < 0)),
    claims: [
      { id: "signos", text: "A es diagonalizable en ℝ y sus autovalores tienen distinto signo.", truth: true, why: "Simétrica ⇒ diagonalizable con autovalores reales; λ₁·λ₂ = det A < 0.", holds: (s) => isRealDiagonalizable(s.A) && oppositeSigns2(s.A) },
      { id: "definida", text: "A es definida positiva.", truth: false, why: "Tiene un autovalor negativo.", holds: (s) => isPositiveDefinite(s.A), counterexample: { A: [[0, 1], [1, 0]] } },
      { id: "doble", text: "A tiene un autovalor doble.", truth: false, why: "Los dos autovalores tienen signos distintos: no pueden ser iguales.", holds: (s) => {
        const ev = eigenvaluesNumeric(s.A);
        return Math.abs(ev[0]!.re - ev[1]!.re) < 1e-9;
      }, counterexample: { A: [[0, 1], [1, 0]] } },
      { id: "regular", text: "A es regular.", truth: true, why: "det A ≠ 0.", holds: (s) => isRegular(s.A) },
      { id: "traza", text: "traza(A) < 0.", truth: false, why: "(1 2; 2 1) tiene det = −3 y traza 2.", holds: (s) => sign(traceOf(s.A)) < 0, counterexample: { A: [[1, 2], [2, 1]] } },
    ],
  },
  {
    id: "simetrica-2-det-menos-uno",
    subject: "Sea A ∈ ℝ²ˣ² simétrica con det(A) = −1.",
    level: "avanzado",
    member: (s) => dim(s.A) === 2 && isSymmetric(s.A) && equals(det(s.A), frac(-1n)),
    sample: (r) => {
      // a·c − b² = −1: b al azar y a·c = b² − 1 repartido entre a y c.
      const b = r.int(1, 4) * r.pick([1, -1]);
      const t = b * b - 1;
      const divs = Array.from({ length: 2 * t + 1 }, (_, i) => i - t).filter((d) => d !== 0 && t % d === 0);
      const a = t === 0 ? 0 : r.pick(divs);
      const c = t === 0 ? r.int(-3, 3) : t / a;
      return pair(intMatrix(r.chance(0.5) ? [[a, b], [b, c]] : [[c, b], [b, a]]));
    },
    claims: [
      { id: "inversos", text: "Sus autovalores son λ y −1/λ para algún λ ≠ 0.", truth: true, why: "Son reales (simétrica) y λ₁·λ₂ = det A = −1.", holds: (s) => {
        const ev = eigenvaluesNumeric(s.A);
        return ev.every((z) => Math.abs(z.im) < 1e-9) && Math.abs(ev[0]!.re * ev[1]!.re + 1) < 1e-9;
      } },
      { id: "menos-uno", text: "Uno de sus autovalores es −1.", truth: false, why: "(1 1; 1 0) tiene det −1 y autovalores (1 ± √5)/2.", holds: (s) => nullSpace(matrixAdd(s.A, identityMatrix(2))).length > 0, counterexample: { A: [[1, 1], [1, 0]] } },
      { id: "regular", text: "A es regular.", truth: true, why: "det A = −1 ≠ 0.", holds: (s) => isRegular(s.A) },
      { id: "involutiva", text: "A⁻¹ = A.", tex: "A^{-1} = A", truth: false, why: "(1 1; 1 0)·(1 1; 1 0) = (2 1; 1 1) ≠ I.", holds: (s) => matrixEquals(matrixProduct(s.A, s.A), identityMatrix(2)), counterexample: { A: [[1, 1], [1, 0]] } },
      { id: "definida", text: "A es definida positiva.", truth: false, why: "det A < 0: un autovalor es negativo.", holds: (s) => isPositiveDefinite(s.A), counterexample: { A: [[0, 1], [1, 0]] } },
    ],
  },
  {
    id: "diagonalizable-2-det-pos",
    subject: "Sea A ∈ ℝ²ˣ² diagonalizable con det(A) > 0.",
    level: "avanzado",
    member: (s) => dim(s.A) === 2 && isRealDiagonalizable(s.A) && sign(det(s.A)) > 0,
    sample: (r) => {
      const s = r.pick([1, -1]);
      return pair(diagonalizable(r, [s * r.int(1, 4), s * r.int(1, 4)]));
    },
    claims: [
      { id: "signo", text: "Sus dos autovalores tienen el mismo signo.", truth: true, why: "Son reales y λ₁·λ₂ = det A > 0.", holds: (s) => sameSigns(s.A) },
      { id: "regular", text: "A es regular.", truth: true, why: "det A ≠ 0.", holds: (s) => isRegular(s.A) },
      { id: "definida", text: "A es definida positiva.", truth: false, why: "−I es diagonalizable con det = 1 y no es definida positiva (ni hace falta que sea simétrica).", holds: (s) => isPositiveDefinite(s.A), counterexample: { A: [[-1, 0], [0, -1]] } },
      { id: "simetrica", text: "A es simétrica.", truth: false, why: "(2 1; 0 3) es diagonalizable (autovalores distintos) y no es simétrica.", holds: (s) => isSymmetric(s.A), counterexample: { A: [[2, 1], [0, 3]] } },
      { id: "positivos", text: "Sus autovalores son positivos.", truth: false, why: "Con −I los dos son −1.", holds: (s) => allEigenPositive(s.A), counterexample: { A: [[-1, 0], [0, -1]] } },
      { id: "discriminante", text: "traza(A)² ≥ 4·det(A).", tex: "\\operatorname{tr}(A)^2 \\ge 4\\det A", truth: true, why: "Los autovalores son reales: el discriminante de λ² − tr(A)λ + det A no es negativo.", holds: (s) => cmp(mul(traceOf(s.A), traceOf(s.A)), mul(frac(4n), det(s.A))) >= 0 },
    ],
  },
  {
    id: "opuestos",
    subject: "Sean A, B ∈ ℝⁿˣⁿ con A regular y det(B) = −det(A).",
    level: "avanzado",
    member: (s) => isRegular(s.A) && equals(det(s.B), neg(det(s.A))),
    sample: (r) => {
      const n = nOf(r);
      const B = until(r, () => ints(r, n, n, 3), isRegular);
      // A: B con una fila cambiada de signo (det A = −det B), por una unimodular de det 1 o −1 dos veces.
      const neg1 = B.map((row, i) => (i === 0 ? row.map(neg) : row));
      const U = intMatrix(unimodularInts(r, n));
      const A = sign(det(U)) > 0 ? matrixProduct(neg1, U) : matrixProduct(matrixProduct(neg1, U), U);
      return pair(A, B);
    },
    claims: [
      { id: "suma", text: "det(A + B) = 0.", tex: "\\det(A + B) = 0", truth: false, why: "El determinante de la suma no es la suma de determinantes: A = I, B = (3 1; 4 1) da det(A + B) = 4.", holds: (s) => isZero(det(matrixAdd(s.A, s.B))), counterexample: { A: [[1, 0], [0, 1]], B: [[3, 1], [4, 1]] } },
      { id: "producto", text: "det(AB) < 0.", tex: "\\det(AB) < 0", truth: true, why: "det(AB) = det A·det B = −det(A)² < 0.", holds: (s) => sign(det(matrixProduct(s.A, s.B))) < 0 },
      { id: "sumadet", text: "det(A) + det(B) = 0.", tex: "\\det A + \\det B = 0", truth: true, why: "Es lo que dice el enunciado.", holds: (s) => isZero(add(det(s.A), det(s.B))) },
      { id: "breg", text: "B es regular.", truth: true, why: "det B = −det A ≠ 0.", holds: (s) => isRegular(s.B) },
      { id: "resta", text: "det(A − B) = 2·det(A).", tex: "\\det(A - B) = 2\\det A", truth: false, why: "Tampoco hay regla para la resta: A = I, B = diag(−1, 1) da det(A − B) = 0.", holds: (s) => equals(det(matrixSub(s.A, s.B)), mul(frac(2n), det(s.A))), counterexample: { A: [[1, 0], [0, 1]], B: [[-1, 0], [0, 1]] } },
    ],
  },
  {
    id: "vectores",
    subject: "Sean u, v ∈ ℝ³ (‖·‖₁, ‖·‖₂, ‖·‖∞ son las normas 1, euclídea e infinito).",
    level: "medio",
    member: () => true,
    sample: (r) => ({ A: [[ZERO]], B: [[ZERO]], u: intVector(vec(r, 3)), v: intVector(vec(r, 3)) }),
    claims: [
      { id: "vv", text: "Si v·v = 0, entonces v = 0.", tex: "v\\cdot v = 0 \\Rightarrow v = 0", truth: true, why: "v·v = ‖v‖₂² es suma de cuadrados: solo es 0 si todas las componentes lo son.", holds: (s) => !isZero(dot(s.v, s.v)) || isZeroVector(s.v) },
      { id: "uv", text: "Si u·v = 0, entonces u = 0 o v = 0.", tex: "u\\cdot v = 0 \\Rightarrow u = 0 \\text{ o } v = 0", truth: false, why: "u·v = 0 solo dice que son ortogonales: (1, 0, 0) y (0, 1, 0).", holds: (s) => !isZero(dot(s.u, s.v)) || isZeroVector(s.u) || isZeroVector(s.v), counterexample: { u: [1, 0, 0], v: [0, 1, 0] } },
      { id: "cadena", text: "‖v‖∞ ≤ ‖v‖₂ ≤ ‖v‖₁.", tex: "\\|v\\|_\\infty \\le \\|v\\|_2 \\le \\|v\\|_1", truth: true, why: "El máximo no supera la raíz de la suma de cuadrados, y esta no supera la suma de valores absolutos.", holds: (s) => cmp(mul(normInf(s.v), normInf(s.v)), norm2Squared(s.v)) <= 0 && cmp(norm2Squared(s.v), mul(norm1(s.v), norm1(s.v))) <= 0 },
      { id: "suma1", text: "‖u + v‖₁ = ‖u‖₁ + ‖v‖₁.", tex: "\\|u + v\\|_1 = \\|u\\|_1 + \\|v\\|_1", truth: false, why: "Solo vale la desigualdad triangular ≤: con u = (1, 0, 0) y v = −u queda 0 frente a 2.", holds: (s) => equals(norm1(vectorAdd(s.u, s.v)), add(norm1(s.u), norm1(s.v))), counterexample: { u: [1, 0, 0], v: [-1, 0, 0] } },
      { id: "cauchy", text: "|u·v| ≤ ‖u‖₂·‖v‖₂.", tex: "|u\\cdot v| \\le \\|u\\|_2\\,\\|v\\|_2", truth: true, why: "Desigualdad de Cauchy–Schwarz.", holds: (s) => cmp(mul(abs(dot(s.u, s.v)), abs(dot(s.u, s.v))), mul(norm2Squared(s.u), norm2Squared(s.v))) <= 0 },
      { id: "doble", text: "‖2v‖₂ = 4·‖v‖₂.", tex: "\\|2v\\|_2 = 4\\|v\\|_2", truth: false, why: "‖k·v‖ = |k|·‖v‖: sale 2, no 4.", holds: (s) => equals(norm2Squared(vectorScale(frac(2n), s.v)), mul(frac(16n), norm2Squared(s.v))), counterexample: { v: [1, 0, 0] } },
    ],
  },
];

export const claimClass = (id: string): ClaimClass => {
  const c = CLAIM_CLASSES.find((x) => x.id === id);
  if (!c) throw new Error(`clase desconocida: ${id}`);
  return c;
};

// ---------------------------------------------------------------- Una matriz diagonal concreta

/**
 * Afirmaciones sobre una matriz diagonal dada (diag(a, b, c)): su verdad la calcula el motor con esa
 * matriz. `v` es el número que dice la afirmación (para traza y determinante).
 */
export type DiagonalClaim = { k: "diagonalizable" | "regular" | "definida" | "no-diagonalizable" } | { k: "suma" | "producto"; v: number };

export function diagonalClaimTruth(d: readonly number[], c: DiagonalClaim): boolean {
  const A = intMatrix(d.map((x, i) => d.map((_, j) => (i === j ? x : 0))));
  switch (c.k) {
    case "diagonalizable":
      return isRealDiagonalizable(A);
    case "no-diagonalizable":
      return !isRealDiagonalizable(A);
    case "regular":
      return isRegular(A);
    case "definida":
      return isPositiveDefinite(A);
    case "suma": {
      const ev = eigenvaluesNumeric(A).reduce((s, z) => s + z.re, 0);
      return Math.abs(ev - c.v) < 1e-9 && Math.abs(toNumber(traceOf(A)) - c.v) < 1e-9;
    }
    case "producto":
      return Math.abs(toNumber(det(A)) - c.v) < 1e-9;
  }
}

export function diagonalClaimText(c: DiagonalClaim): { text: string; tex?: string } {
  const n = (v: number) => String(v).replace("-", "−");
  switch (c.k) {
    case "diagonalizable":
      return { text: "A es diagonalizable." };
    case "no-diagonalizable":
      return { text: "A no es diagonalizable." };
    case "regular":
      return { text: "A es regular." };
    case "definida":
      return { text: "A es definida positiva." };
    case "suma":
      return { text: `La suma de sus autovalores es ${n(c.v)}.`, tex: `\\lambda_1 + \\lambda_2 + \\lambda_3 = ${c.v}` };
    case "producto":
      return { text: `det(A) = ${n(c.v)}.`, tex: `\\det A = ${c.v}` };
  }
}

export const DIAGONAL_WHY: Record<DiagonalClaim["k"], string> = {
  diagonalizable: "Una matriz diagonal ya está diagonalizada (P = I).",
  "no-diagonalizable": "Una matriz diagonal ya está diagonalizada (P = I).",
  regular: "Regular si ningún elemento de la diagonal es 0 (su producto es el determinante).",
  definida: "Definida positiva si todos los elementos de la diagonal (sus autovalores) son positivos.",
  suma: "Los autovalores de una diagonal son sus elementos; su suma es la traza.",
  producto: "El determinante de una diagonal es el producto de la diagonal (= producto de autovalores).",
};

