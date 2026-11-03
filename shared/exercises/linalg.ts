// Ejercicios de álgebra lineal: Gauss-Jordan, determinante, producto, inversa, sistemas (Rouché–
// Frobenius), independencia lineal, autovalores y formas de tensores. Las matrices se construyen para
// que los números salgan bonitos (soluciones enteras, inversas con denominadores pequeños, autovalores
// enteros con A = P·D·P⁻¹ y P de determinante ±1) y se guardan como enteros; lo que se corrige lo
// calculan los motores de shared/linalg al resolver.
import { matrixDeterminant } from "../linalg/det.ts";
import { intMatrix, matrixProduct, type Matrix } from "../linalg/matrix.ts";
import { matrixInverse, matrixRank, rref } from "../linalg/rref.ts";
import { analyzeSystem, splitAugmented, type SystemKind } from "../linalg/systems.ts";
import { tensorOpResult, type Shape, type TensorOp } from "../linalg/tensors.ts";
import type { Frac } from "../rational.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Ints = number[][];

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

const randomInts = (rng: Rng, rows: number, cols: number, range: number): Ints =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.int(-range, range)));

const maxAbs = (M: Ints) => Math.max(...M.flat().map(Math.abs));
const toInts = (M: Matrix): Ints => M.map((r) => r.map((x) => Number(x.n)));
const isIntMatrix = (M: Matrix) => M.every((r) => r.every((x) => x.d === 1n));

/** ¿Números cómodos a mano? Denominadores y numeradores acotados. */
const nice = (xs: readonly Frac[], maxDen: bigint, maxNum: bigint) =>
  xs.every((x) => x.d <= maxDen && (x.n < 0n ? -x.n : x.n) <= maxNum);

/**
 * Matriz entera de determinante ±1 (su inversa también es entera): la identidad con operaciones
 * Fᵢ ← Fᵢ + k·Fⱼ al azar y algún intercambio.
 */
export function unimodular(rng: Rng, n: number, ops: number): Ints {
  const M: Ints = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let t = 0; t < ops; t++) {
    const i = rng.int(0, n - 1);
    let j = rng.int(0, n - 2);
    if (j >= i) j++;
    if (rng.chance(0.15)) [M[i], M[j]] = [M[j]!, M[i]!];
    else {
      const k = rng.pick([-2, -1, 1, 2]);
      M[i] = M[i]!.map((x, c) => x + k * M[j]![c]!);
    }
  }
  return M;
}

/** Fila combinación de otras: a·r₁ + b·r₂. */
const combo = (rows: Ints, coefs: number[]) => rows[0]!.map((_, j) => rows.reduce((acc, r, i) => acc + coefs[i]! * r[j]!, 0));

// ---------------------------------------------------------------- Sistemas (Gauss-Jordan y Rouché–Frobenius)

/** Matriz ampliada (A | b), por filas, con enteros. `unknowns` = columnas de A. */
export type LinSystemInstance = { matrix: Ints; unknowns: number };

/** Un sistema de `eqs` ecuaciones y `n` incógnitas del tipo pedido, con coeficientes en [−range, range]. */
function makeSystem(rng: Rng, eqs: number, n: number, kind: SystemKind, range: number): LinSystemInstance | null {
  // Rango de A: n si es determinado; menor que n si es indeterminado; menor que el número de
  // ecuaciones si es incompatible (hace falta una ecuación que dependa de las otras para romperla).
  const [lo, hi] =
    kind === "determinado" ? [n, n] : kind === "indeterminado" ? [Math.max(1, n - 2), Math.min(eqs, n - 1)] : [Math.max(1, Math.min(eqs - 1, n) - 1), Math.min(eqs - 1, n)];
  if (lo > hi || (kind === "determinado" && eqs < n)) return null;
  const rank = rng.int(lo, hi);
  const base = randomInts(rng, rank, n, range);
  const A: Ints = [...base];
  while (A.length < eqs) {
    const coefs = base.map(() => rng.int(-2, 2));
    A.push(combo(base, coefs));
  }
  const order = rng.shuffle(A.map((_, i) => i));
  const rows = order.map((i) => A[i]!);
  const x = Array.from({ length: n }, () => rng.int(-4, 4));
  const b = rows.map((r) => r.reduce((acc, a, j) => acc + a * x[j]!, 0));
  if (kind === "incompatible") {
    // Se rompe una ecuación que depende de las otras: rg(A|b) = rg A + 1.
    const i = rng.int(0, eqs - 1);
    b[i] = b[i]! + rng.pick([-3, -2, -1, 1, 2, 3]);
  }
  return { matrix: rows.map((r, i) => [...r, b[i]!]), unknowns: n };
}

function systemOk(inst: LinSystemInstance, kind: SystemKind, maxEntry: number, maxDen: bigint): boolean {
  const M = intMatrix(inst.matrix);
  if (maxAbs(inst.matrix) > maxEntry) return false;
  // Ninguna fila ni columna de A entera a cero, ni dos ecuaciones iguales: sería demasiado fácil.
  if (inst.matrix.some((r) => r.slice(0, inst.unknowns).every((x) => x === 0))) return false;
  for (let j = 0; j < inst.unknowns; j++) if (inst.matrix.every((r) => r[j] === 0)) return false;
  const keys = inst.matrix.map((r) => r.join(","));
  if (new Set(keys).size < keys.length) return false;
  const { A, b } = splitAugmented(M);
  if (analyzeSystem(A, b).kind !== kind) return false;
  // Los pasos de Gauss-Jordan con números manejables.
  const R = rref(M, inst.unknowns);
  return R.steps.every((S) => nice(S.flat(), maxDen, 60n));
}

const GAUSS_LIMITS: Record<ExerciseLevel, { eqs: [number, number]; n: [number, number]; kinds: SystemKind[]; range: number; maxEntry: number; maxDen: bigint }> = {
  básico: { eqs: [2, 2], n: [2, 2], kinds: ["determinado"], range: 3, maxEntry: 20, maxDen: 4n },
  medio: { eqs: [3, 3], n: [3, 3], kinds: ["determinado"], range: 3, maxEntry: 24, maxDen: 6n },
  avanzado: { eqs: [3, 3], n: [3, 4], kinds: ["determinado", "indeterminado", "indeterminado", "incompatible"], range: 3, maxEntry: 30, maxDen: 6n },
};

function systemGenerator(id: string, limits: typeof GAUSS_LIMITS) {
  return (seed: number, level: ExerciseLevel): LinSystemInstance => {
    const L = limits[level];
    const rng = rngFor(id, seed);
    const eqs = rng.int(L.eqs[0], L.eqs[1]);
    const n = rng.int(L.n[0], L.n[1]);
    // Con menos ecuaciones que incógnitas no puede ser determinado.
    const kind = rng.pick(eqs < n ? L.kinds.filter((k) => k !== "determinado") : L.kinds);
    return generateUntil(
      rng,
      (r) => makeSystem(r, eqs, n, kind, L.range),
      (inst) => systemOk(inst, kind, L.maxEntry, L.maxDen),
    );
  };
}

export const LINALG_GAUSS: ExerciseType<LinSystemInstance> = {
  id: "algebra-gauss",
  topic: "algebra-lineal",
  title: "Gauss-Jordan paso a paso",
  description: "Lleva la matriz ampliada a la forma escalonada reducida con operaciones elementales, clasifica el sistema y escribe su solución.",
  levels: ALL_LEVELS,
  generate: systemGenerator("algebra-gauss", GAUSS_LIMITS),
};

const SYSTEM_LIMITS: typeof GAUSS_LIMITS = {
  básico: { eqs: [2, 2], n: [2, 2], kinds: ["determinado", "determinado", "indeterminado", "incompatible"], range: 4, maxEntry: 24, maxDen: 6n },
  medio: { eqs: [3, 3], n: [3, 3], kinds: ["determinado", "indeterminado", "incompatible"], range: 3, maxEntry: 30, maxDen: 6n },
  avanzado: { eqs: [3, 4], n: [3, 4], kinds: ["determinado", "indeterminado", "incompatible"], range: 3, maxEntry: 30, maxDen: 8n },
};

export const LINALG_SYSTEMS: ExerciseType<LinSystemInstance> = {
  id: "algebra-sistemas",
  topic: "algebra-lineal",
  title: "Sistemas: Rouché–Frobenius",
  description: "Calcula el rango de A y el de (A|b), clasifica el sistema y da su solución (paramétrica si hace falta).",
  levels: ALL_LEVELS,
  generate: systemGenerator("algebra-sistemas", SYSTEM_LIMITS),
};

// ---------------------------------------------------------------- Determinante

export type MatrixInstance = { matrix: Ints };

const DET_LIMITS: Record<ExerciseLevel, { n: number; range: number; zeros: number }> = {
  básico: { n: 2, range: 6, zeros: 0 },
  medio: { n: 3, range: 4, zeros: 0 },
  avanzado: { n: 4, range: 3, zeros: 5 },
};

export const LINALG_DETERMINANT: ExerciseType<MatrixInstance> = {
  id: "algebra-determinante",
  topic: "algebra-lineal",
  title: "Determinante",
  description: "Calcula el determinante: regla de Sarrus, desarrollo por una fila o columna, o eliminación.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const { n, range, zeros } = DET_LIMITS[level];
    const matrix = generateUntil(
      rngFor("algebra-determinante", seed),
      (r) => {
        const M = randomInts(r, n, n, range);
        // En 4×4, ceros repartidos para que convenga desarrollar por una fila o columna.
        for (let z = 0; z < zeros; z++) M[r.int(0, n - 1)]![r.int(0, n - 1)] = 0;
        return M;
      },
      (M) => {
        const d = Math.abs(Number(matrixDeterminant(intMatrix(M)).n));
        return d <= (n === 2 ? 60 : n === 3 ? 150 : 200) && M.flat().filter((x) => x === 0).length <= n * n - n - 1;
      },
    );
    return { matrix };
  },
};

// ---------------------------------------------------------------- Producto

export type ProductInstance = { a: Ints; b: Ints };

const PRODUCT_SHAPES: Record<ExerciseLevel, Array<[number, number, number]>> = {
  básico: [[2, 2, 2]],
  medio: [
    [2, 3, 2],
    [3, 2, 3],
    [2, 3, 3],
  ],
  avanzado: [
    [3, 3, 3],
    [2, 3, 4],
    [4, 2, 3],
  ],
};

export const LINALG_PRODUCT: ExerciseType<ProductInstance> = {
  id: "algebra-producto",
  topic: "algebra-lineal",
  title: "Producto de matrices",
  description: "Multiplica A·B: cada elemento es una fila de A por una columna de B.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const rng = rngFor("algebra-producto", seed);
    const [m, k, n] = rng.pick(PRODUCT_SHAPES[level]);
    const range = level === "básico" ? 4 : 3;
    return generateUntil(
      rng,
      (r) => ({ a: randomInts(r, m, k, range), b: randomInts(r, k, n, range) }),
      ({ a, b }) => a.flat().filter((x) => x === 0).length <= 2 && b.flat().filter((x) => x === 0).length <= 2,
    );
  },
};

// ---------------------------------------------------------------- Inversa

const INVERSE_LIMITS: Record<ExerciseLevel, { n: number; dets: number[]; maxEntry: number; maxInv: bigint; maxDen: bigint }> = {
  básico: { n: 2, dets: [1, -1, 2, -2], maxEntry: 6, maxInv: 6n, maxDen: 2n },
  medio: { n: 3, dets: [1, -1], maxEntry: 5, maxInv: 9n, maxDen: 1n },
  avanzado: { n: 3, dets: [2, -2, 3, -3], maxEntry: 5, maxInv: 9n, maxDen: 3n },
};

export const LINALG_INVERSE: ExerciseType<MatrixInstance> = {
  id: "algebra-inversa",
  topic: "algebra-lineal",
  title: "Matriz inversa",
  description: "Calcula A⁻¹ por Gauss-Jordan sobre (A | I) o con la adjunta, y compruébala con A·A⁻¹ = I.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const L = INVERSE_LIMITS[level];
    const matrix = generateUntil(
      rngFor("algebra-inversa", seed),
      (r) => {
        if (L.dets.every((d) => Math.abs(d) === 1)) return unimodular(r, L.n, r.int(3, 5));
        // Determinante ±2 o ±3: una matriz de determinante ±1 por una diagonal con un d.
        const d = r.pick(L.dets);
        const U = intMatrix(unimodular(r, L.n, r.int(2, 4)));
        const D = intMatrix(Array.from({ length: L.n }, (_, i) => Array.from({ length: L.n }, (_, j) => (i !== j ? 0 : i === 0 ? d : 1))));
        const V = intMatrix(unimodular(r, L.n, r.int(1, 3)));
        return toInts(matrixProduct(matrixProduct(U, D), V));
      },
      (M) => {
        if (maxAbs(M) > L.maxEntry || M.flat().filter((x) => x === 0).length > L.n) return false;
        const A = intMatrix(M);
        const det = Number(matrixDeterminant(A).n);
        if (!L.dets.includes(det)) return false;
        const inv = matrixInverse(A);
        return inv !== null && nice(inv.inverse.flat(), L.maxDen, L.maxInv);
      },
    );
    return { matrix };
  },
};

// ---------------------------------------------------------------- Independencia lineal

/** Vectores de ℝⁿ, cada uno una lista de enteros. */
export type VectorsInstance = { vectors: Ints };

const INDEP_LIMITS: Record<ExerciseLevel, { dim: number; count: [number, number]; range: number }> = {
  básico: { dim: 3, count: [2, 3], range: 3 },
  medio: { dim: 3, count: [3, 4], range: 3 },
  avanzado: { dim: 4, count: [3, 4], range: 3 },
};

export const LINALG_INDEPENDENCE: ExerciseType<VectorsInstance> = {
  id: "algebra-independencia",
  topic: "algebra-lineal",
  title: "Independencia lineal y bases",
  description: "Decide si los vectores son linealmente independientes, da la dimensión del subespacio que generan y una base.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const { dim, count, range } = INDEP_LIMITS[level];
    const rng = rngFor("algebra-independencia", seed);
    const k = rng.int(count[0], count[1]);
    // Mitad independientes (cuando caben) y mitad con alguna combinación.
    const wantDependent = k > dim || rng.chance(0.5);
    return generateUntil(
      rng,
      (r) => {
        if (!wantDependent) return { vectors: randomInts(r, k, dim, range) };
        const free = r.int(1, Math.min(k - 1, dim));
        const base = randomInts(r, free, dim, range);
        const rest = Array.from({ length: k - free }, () => combo(base, base.map(() => r.int(-2, 2))));
        return { vectors: r.shuffle([...base, ...rest]) };
      },
      ({ vectors }) => {
        if (vectors.some((v) => v.every((x) => x === 0))) return false;
        if (maxAbs(vectors) > 9) return false;
        const keys = vectors.map((v) => v.join(","));
        if (new Set(keys).size < keys.length) return false;
        const rank = matrixRank(intMatrix(vectors));
        return wantDependent ? rank < k && rank >= 1 : rank === k;
      },
    );
  },
};

// ---------------------------------------------------------------- Autovalores

const EIGEN_LIMITS: Record<ExerciseLevel, { n: number; values: [number, number]; repeated: boolean; maxEntry: number; ops: [number, number] }> = {
  básico: { n: 2, values: [-3, 5], repeated: false, maxEntry: 9, ops: [1, 3] },
  medio: { n: 3, values: [-2, 4], repeated: false, maxEntry: 9, ops: [2, 3] },
  avanzado: { n: 3, values: [-3, 4], repeated: true, maxEntry: 12, ops: [2, 4] },
};

export const LINALG_EIGEN: ExerciseType<MatrixInstance> = {
  id: "algebra-autovalores",
  topic: "algebra-lineal",
  title: "Autovalores y autovectores",
  description: "Plantea det(A − λI) = 0, encuentra los autovalores y un autovector de cada uno, y compruébalo con A·v = λ·v.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const L = EIGEN_LIMITS[level];
    const matrix = generateUntil(
      rngFor("algebra-autovalores", seed),
      (r) => {
        const pool = Array.from({ length: L.values[1] - L.values[0] + 1 }, (_, i) => L.values[0] + i);
        let lambdas = r.shuffle(pool).slice(0, L.n);
        // Avanzado: a veces un autovalor doble (diagonalizable: su autoespacio tiene dimensión 2).
        if (L.repeated && r.chance(0.5)) lambdas = [lambdas[0]!, lambdas[0]!, lambdas[1]!];
        const P = intMatrix(unimodular(r, L.n, r.int(L.ops[0], L.ops[1])));
        const D = intMatrix(Array.from({ length: L.n }, (_, i) => Array.from({ length: L.n }, (_, j) => (i === j ? lambdas[i]! : 0))));
        const inv = matrixInverse(P);
        if (!inv) return null;
        const A = matrixProduct(matrixProduct(P, D), inv.inverse);
        return isIntMatrix(A) ? toInts(A) : null;
      },
      (M) => {
        if (maxAbs(M) > L.maxEntry) return false;
        // Que no sea ya diagonal ni triangular: hay que calcular el polinomio.
        const offDiag = M.flatMap((r, i) => r.filter((_, j) => j !== i));
        const lower = M.flatMap((r, i) => r.filter((_, j) => j < i));
        const upper = M.flatMap((r, i) => r.filter((_, j) => j > i));
        return offDiag.filter((x) => x !== 0).length >= M.length && lower.some((x) => x !== 0) && upper.some((x) => x !== 0);
      },
    );
    return { matrix };
  },
};

// ---------------------------------------------------------------- Formas de tensores

export type TensorShapeInstance = { q: TensorOp };

const dims = (rng: Rng, k: number) => Array.from({ length: k }, () => rng.pick([2, 3, 4, 5, 6]));

/** Una forma que se emite con s: cada eje igual, 1 o ausente por la izquierda. */
function broadcastPartner(rng: Rng, s: Shape, drop: boolean): Shape {
  const out = s.map((d) => (rng.chance(0.35) ? 1 : d));
  const cut = drop ? rng.int(0, s.length - 1) : 0;
  return out.slice(cut);
}

/** Estropea un eje para que no se pueda emitir o multiplicar. */
function breakShape(rng: Rng, s: Shape): Shape {
  if (s.length === 0) return [rng.int(2, 4)];
  const i = rng.int(0, s.length - 1);
  return s.map((d, k) => (k === i ? (d === 1 ? rng.int(2, 4) : d + rng.int(1, 2)) : d));
}

function tensorQuestion(rng: Rng, level: ExerciseLevel): TensorOp {
  const fail = level !== "básico" && rng.chance(0.25);
  const kinds = level === "básico" ? ["T", "sum", "suma", "matmul"] : level === "medio" ? ["suma", "matmul", "sum", "reshape"] : ["suma", "matmul", "sum", "reshape"];
  const kind = rng.pick(kinds);
  const nd = level === "básico" ? 2 : level === "medio" ? rng.int(2, 3) : rng.int(3, 4);
  const a = dims(rng, nd);
  switch (kind) {
    case "T":
      return { op: "T", a: dims(rng, rng.int(2, 3)) };
    case "sum": {
      const axis = level === "avanzado" && rng.chance(0.4) ? -rng.int(1, nd) : rng.int(0, nd - 1);
      const keepdims = level === "avanzado" && rng.chance(0.4);
      return { op: "sum", a, axis: fail ? nd + rng.int(0, 1) : axis, ...(keepdims ? { keepdims } : {}) };
    }
    case "suma": {
      const b = level === "básico" ? [a[a.length - 1]!] : broadcastPartner(rng, a, rng.chance(0.6));
      return rng.chance(0.5) ? { op: "suma", a, b: fail ? breakShape(rng, b) : b } : { op: "suma", a: fail ? breakShape(rng, b) : b, b: a };
    }
    case "matmul": {
      if (level === "básico") {
        const [m, k, n] = dims(rng, 3);
        return rng.chance(0.3) ? { op: "matmul", a: [m!, k!], b: [k!] } : { op: "matmul", a: [m!, k!], b: [k!, n!] };
      }
      const [m, k, n] = dims(rng, 3);
      const batch = level === "avanzado" ? dims(rng, rng.int(1, 2)) : rng.chance(0.5) ? [] : dims(rng, 1);
      const bBatch = level === "avanzado" && batch.length > 0 ? broadcastPartner(rng, batch, true) : [];
      const left = [...batch, m!, k!];
      const right = fail ? [...bBatch, k! + 1, n!] : rng.chance(0.2) ? [k!] : [...bBatch, k!, n!];
      return { op: "matmul", a: left, b: right };
    }
    default: {
      const size = a.reduce((x, y) => x * y, 1);
      const divisorsOf = [2, 3, 4, 5, 6, 8, 10, 12].filter((d) => size % d === 0 && d < size);
      const first = rng.pick(divisorsOf.length > 0 ? divisorsOf : [1]);
      if (fail) return { op: "reshape", a, target: [rng.pick([5, 7, 9].filter((d) => size % d !== 0)), -1] };
      return rng.chance(0.6) ? { op: "reshape", a, target: [first, -1] } : { op: "reshape", a, target: [-1, first] };
    }
  }
}

const ndimOk = (s: Shape) => s.length <= 5;

export const LINALG_TENSORS: ExerciseType<TensorShapeInstance> = {
  id: "algebra-tensores",
  topic: "algebra-lineal",
  title: "Formas de tensores",
  description: "Predice la forma (shape) del resultado en NumPy, o si da error: emisión en a + b, a @ b, sum(axis), reshape y .T.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const q = generateUntil(
      rngFor("algebra-tensores", seed),
      (r) => tensorQuestion(r, level),
      (x) => {
        if (!ndimOk(x.a) || ("b" in x && !ndimOk(x.b))) return false;
        // En básico, siempre con resultado.
        return level !== "básico" || tensorOpResult(x).ok;
      },
    );
    return { q };
  },
};

export const LINALG_EXERCISES = [
  LINALG_GAUSS,
  LINALG_DETERMINANT,
  LINALG_PRODUCT,
  LINALG_INVERSE,
  LINALG_SYSTEMS,
  LINALG_INDEPENDENCE,
  LINALG_EIGEN,
  LINALG_TENSORS,
] as const;
