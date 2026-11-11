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
import { claimClass, CLAIM_CLASSES, DIAGONAL_WHY, diagonalClaimText, diagonalClaimTruth, type DiagonalClaim } from "../linalg/claims.ts";
import { countAlpha, detExprText, detOfExpr, permutationDeterminant, type AlphaCondition, type AlphaEntry, type AlphaQty, type DetExpr } from "../linalg/theory.ts";
import { frac, type Frac } from "../rational.ts";
import { seedFromKey, type ChoiceOption, type ChoiceQuestion } from "./choice.ts";
import { pickHints, type TaggedHint } from "./hints.ts";
import { createRng, generateUntil, rngFor, type Rng } from "./random.ts";
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



// ================================================================ Teoría (tipo examen)
//
// Con el formato del examen final: opción múltiple a)–d) con una correcta (o «selecciona la o las
// correctas») y respuestas numéricas. La instancia guarda el enunciado; qué es correcto lo decide el
// motor (shared/linalg/theory.ts y claims.ts) al montar la pregunta.

const opt = (id: string, text: string, tex: string | undefined, correct: boolean, why?: string): ChoiceOption => ({ id, text, ...(tex ? { tex } : {}), correct, ...(why ? { why } : {}) });
const rngOf = (inst: unknown) => createRng(seedFromKey(JSON.stringify(inst)));
const fracNice = (x: Frac) => x.d <= 12n && (x.n < 0n ? -x.n : x.n) <= 2000n;

// ---------------------------------------------------------------- Propiedades del determinante

export type DetGiven =
  | { kind: "det"; A: number; B: number | null }
  | { kind: "autovalores"; eig: number[]; B: number | null }
  | { kind: "matriz"; A: Ints; B: number | null };

export type DetRulesInstance = { n: number; expr: DetExpr; given: DetGiven };

/** det(A) y det(B) a partir de lo que da el enunciado. */
export function detRulesDets(inst: DetRulesInstance): { A: Frac; B: Frac } {
  const g = inst.given;
  const A =
    g.kind === "det" ? frac(BigInt(g.A)) : g.kind === "autovalores" ? g.eig.reduce((acc, l) => frac(acc.n * BigInt(l), acc.d), frac(1n)) : permutationDeterminant(intMatrix(g.A))!.det;
  return { A, B: frac(BigInt(g.B ?? 1)) };
}

export const detRulesAnswer = (inst: DetRulesInstance): Frac | null => detOfExpr(inst.expr, inst.n, detRulesDets(inst));

/** Una matriz con una sola entrada no nula por fila y columna (la antidiagonal de unos, a veces otra). */
function permLike(rng: Rng, n: number): Ints {
  const anti = rng.chance(0.5);
  const perm = anti ? Array.from({ length: n }, (_, i) => n - 1 - i) : rng.shuffle(Array.from({ length: n }, (_, i) => i));
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (perm[i] === j ? (anti ? 1 : rng.pick([1, 1, -1, 2])) : 0)));
}

function detRulesTemplate(rng: Rng, level: ExerciseLevel): DetRulesInstance {
  const k = rng.pick([-3, -2, -1, 2, 3, 1]);
  const pow = () => rng.pick([1, 1, -1, 2]);
  if (level === "básico") {
    const n = rng.pick([2, 3]);
    return { n, expr: { k, factors: [{ m: "A", pow: pow(), ...(rng.chance(0.3) ? { T: true } : {}) }] }, given: { kind: "det", A: rng.pick([-3, -2, -1, 2, 3, 4, 5]), B: null } };
  }
  const factors = rng.shuffle([
    { m: "A" as const, pow: pow(), ...(rng.chance(0.25) ? { T: true } : {}) },
    { m: "B" as const, pow: pow(), ...(rng.chance(0.25) ? { T: true } : {}) },
  ]);
  if (level === "medio") {
    return { n: rng.pick([2, 3]), expr: { k, factors }, given: { kind: "det", A: rng.pick([-3, -2, -1, 2, 3, 4]), B: rng.pick([-2, -1, 2, 3, 5]) } };
  }
  if (rng.chance(0.5)) {
    const n = 3;
    const eig = Array.from({ length: n }, () => rng.pick([-2, -1, 1, 2, 3]));
    return { n, expr: { k, factors }, given: { kind: "autovalores", eig, B: rng.pick([-2, -1, 2, 3]) } };
  }
  const n = rng.int(3, 5);
  return { n, expr: { k: rng.pick([-1, 2, -2, 1]), factors: rng.chance(0.5) ? factors : [{ m: "A", pow: rng.pick([1, -1, 2]) }] }, given: { kind: "matriz", A: permLike(rng, n), B: rng.pick([-2, -1, 2, 3]) } };
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const supText = (p: number) => [...String(p)].map((c) => SUP[c] ?? c).join("");
const signText = (x: number | bigint) => String(x).replace("-", "−");
const fracPlain = (x: Frac) => `${signText(x.n)}${x.d === 1n ? "" : `/${x.d}`}`;
/** Factor de un producto: entre paréntesis si es negativo o una fracción. */
const fracFactor = (x: Frac) => (x.n < 0n || x.d !== 1n ? `(${fracPlain(x)})` : fracPlain(x));

/** Lo que hay en la expresión: «escalar», «producto» (dos matrices), «inversa», «traspuesta», «cuadrado». */
export function detRulesTokens(inst: DetRulesInstance): string[] {
  const e = inst.expr;
  const out = new Set<string>();
  if (e.k !== 1) out.add("escalar");
  if (e.factors.length > 1) out.add("producto");
  for (const f of e.factors) {
    if (f.pow < 0) out.add("inversa");
    if (f.T) out.add("traspuesta");
    if (Math.abs(f.pow) >= 2) out.add("cuadrado");
  }
  out.add(inst.given.kind);
  return [...out];
}

/** Pistas: la regla de cada operación que aparece en la expresión. */
export function detRulesHints(inst: DetRulesInstance): string[] {
  const hints: TaggedHint[] = [
    { needs: ["escalar"], text: `det(kA) = kⁿ·det A: el número sale elevado a n = ${inst.n} (una vez por fila).` },
    { needs: ["producto"], text: "det(AB) = det A·det B." },
    { needs: ["inversa"], text: "det(A⁻¹) = 1/det A." },
    { needs: ["traspuesta"], text: "det(Aᵀ) = det A: trasponer no cambia el determinante." },
    { needs: ["cuadrado"], text: "det(A²) = (det A)²." },
    { needs: ["autovalores"], text: "Si A es diagonalizable, det A es el producto de sus autovalores (con su multiplicidad)." },
    {
      needs: ["matriz"],
      text: "Con una sola entrada no nula en cada fila y columna, det A = ± el producto de esas entradas: el signo es el de la permutación (cuenta los intercambios de filas para llegar a la diagonal).",
    },
    { needs: ["det"], text: "Primero aplica las reglas con letras y al final sustituye los números." },
  ];
  return pickHints(hints, detRulesTokens(inst));
}

/**
 * La solución: det A (y det B), la expresión con las reglas y con los números, sin factores que valen
 * 1 (ni el 1ⁿ de k = 1 ni un (det B)² = 1).
 */
export function detRulesSolution(inst: DetRulesInstance): string {
  const dets = detRulesDets(inst);
  const { k, factors } = inst.expr;
  const n = inst.n;
  const value = detRulesAnswer(inst)!;
  const g = inst.given;
  const detA = g.kind === "autovalores" ? `det A = ${g.eig.map((l) => (l < 0 ? `(${signText(l)})` : String(l))).join("·")} = ${fracPlain(dets.A)} (producto de los autovalores)` : `det A = ${fracPlain(dets.A)}`;
  const givenText = `${detA}${g.B !== null ? `, det B = ${fracPlain(dets.B)}` : ""}.`;
  const symbolic = [
    ...(k === 1 ? [] : [`${k < 0 ? `(${signText(k)})` : k}${supText(n)}`]),
    ...factors.map((f) => (f.pow === 1 ? `det ${f.m}` : `(det ${f.m})${supText(f.pow)}`)),
  ];
  const values = [...(k === 1 ? [] : [detOfExpr({ k, factors: [] }, n, dets)!]), ...factors.map((f) => detOfExpr({ k: 1, factors: [f] }, n, dets)!)];
  const shown = values.filter((v) => !(v.n === 1n && v.d === 1n));
  const numeric = shown.length === 0 ? "1" : shown.map((v, i) => (i === 0 && shown.length === 1 ? fracPlain(v) : fracFactor(v))).join("·");
  const result = fracPlain(value);
  const steps = [`det(${detExprText(inst.expr)})`, symbolic.join("·"), ...(numeric === result ? [] : [numeric]), result];
  // Sin pasos repetidos (det(A²) = (det A)² se queda; «det A = det A» no).
  const unique = steps.filter((x, i) => i === 0 || x !== steps[i - 1]);
  const T = factors.some((f) => f.T) ? " (det(Aᵀ) = det A)" : "";
  return `${givenText} ${unique.join(" = ")}${T}.`;
}

export const LINALG_DET_RULES: ExerciseType<DetRulesInstance> = {
  id: "algebra-det-propiedades",
  topic: "algebra-lineal",
  title: "Propiedades del determinante",
  description: "Sin calcular matrices: det(kA) = kⁿ·det A, det(AB) = det A·det B, det(A⁻¹) = 1/det A, det(Aᵀ) = det A y det A = producto de autovalores.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-det-propiedades", seed),
      (r) => detRulesTemplate(r, level),
      (inst) => {
        const v = detRulesAnswer(inst);
        // Que haya algo que aplicar (no det(A) a secas) y un resultado cómodo.
        const trivial = inst.expr.k === 1 && inst.expr.factors.length === 1 && inst.expr.factors[0]!.pow === 1;
        return v !== null && !trivial && fracNice(v) && v.n !== 0n;
      },
    );
  },
};

// ---------------------------------------------------------------- Teoría de matrices

export type MatrixTheoryInstance =
  | { cls: string; claims: string[]; ask: "falsa" | "verdadera" | "varias" }
  | { cls: "diagonal"; d: number[]; dclaims: DiagonalClaim[]; ask: "falsa" | "verdadera" | "varias" };

export const THEORY_ASK: Record<MatrixTheoryInstance["ask"], string> = {
  falsa: "¿Cuál de estas afirmaciones es FALSA?",
  verdadera: "¿Cuál de estas afirmaciones es VERDADERA?",
  varias: "Selecciónese la o las afirmaciones correctas.",
};

const intsText = (M: readonly (readonly number[])[]) => `(${M.map((r) => r.join(" ")).join("; ")})`.replace(/-/g, "−");

export function theorySubject(inst: MatrixTheoryInstance): string {
  return inst.cls === "diagonal" ? "Sea A la matriz diagonal" : claimClass(inst.cls).subject;
}

export function theoryQuestion(inst: MatrixTheoryInstance): ChoiceQuestion {
  if (inst.cls === "diagonal") {
    const d = (inst as { d: number[] }).d;
    return {
      mode: inst.ask === "varias" ? "multi" : "single",
      options: (inst as { dclaims: DiagonalClaim[] }).dclaims.map((c, i) => {
        const truth = diagonalClaimTruth(d, c);
        const t = diagonalClaimText(c);
        return opt(`d${i}`, t.text, t.tex, inst.ask === "falsa" ? !truth : truth, `${truth ? "Verdadera" : "Falsa"}. ${DIAGONAL_WHY[c.k]}`);
      }),
    };
  }
  const cls = claimClass(inst.cls);
  return {
    mode: inst.ask === "varias" ? "multi" : "single",
    options: (inst as { claims: string[] }).claims.map((id) => {
      const c = cls.claims.find((x) => x.id === id)!;
      const ce = c.counterexample;
      const ceText = ce ? ` Contraejemplo: ${[ce.A ? `A = ${intsText(ce.A)}` : "", ce.B ? `B = ${intsText(ce.B)}` : "", ce.u ? `u = (${ce.u.join(", ")})` : "", ce.v ? `v = (${ce.v.join(", ")})` : ""].filter(Boolean).join(", ")}.` : "";
      return opt(c.id, c.text, c.tex, inst.ask === "falsa" ? !c.truth : c.truth, `${c.truth ? "Verdadera" : "Falsa"}. ${c.why}${c.truth ? "" : ceText}`);
    }),
  };
}

export const LINALG_THEORY: ExerciseType<MatrixTheoryInstance> = {
  id: "algebra-teoria",
  topic: "algebra-lineal",
  title: "Teoría de matrices y vectores",
  description: "Verdadero o falso sobre matrices regulares, singulares, simétricas, definidas positivas o diagonalizables, determinantes y normas: elige la correcta o todas las correctas.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-teoria", seed),
      (r): MatrixTheoryInstance | null => {
        const order = ["básico", "medio", "avanzado"];
        const pool = CLAIM_CLASSES.filter((c) => (level === "avanzado" ? true : order.indexOf(c.level) <= order.indexOf(level)) && (level === "básico" ? c.level === "básico" : level === "medio" ? c.level !== "avanzado" : c.level !== "básico"));
        const ask: MatrixTheoryInstance["ask"] = level === "básico" ? r.pick(["falsa", "verdadera"]) : level === "medio" ? r.pick(["falsa", "verdadera", "varias"]) : "varias";
        if (level !== "básico" && r.chance(0.2)) {
          // Una matriz diagonal concreta.
          const d = Array.from({ length: 3 }, () => r.pick([-3, -2, -1, 0, 1, 2, 3, 4]));
          const tr = d.reduce((a, b) => a + b, 0);
          const pr = d.reduce((a, b) => a * b, 1);
          const dclaims: DiagonalClaim[] = r.shuffle<DiagonalClaim>([
            { k: r.pick(["diagonalizable", "no-diagonalizable"] as const) },
            { k: "suma", v: r.chance(0.5) ? tr : tr + r.pick([-2, -1, 1, 2]) },
            { k: "producto", v: r.chance(0.5) ? pr : -pr === pr ? pr + 1 : -pr },
            { k: r.pick(["regular", "definida"] as const) },
          ]);
          return { cls: "diagonal", d, dclaims, ask };
        }
        const cls = r.pick(pool);
        const truth = (id: string) => cls.claims.find((c) => c.id === id)!.truth;
        const ids = r.shuffle(cls.claims.map((c) => c.id));
        if (ask === "varias") return { cls: cls.id, claims: ids.slice(0, r.int(4, 5)), ask };
        const target = ask === "verdadera";
        const hit = ids.filter((id) => truth(id) === target);
        const rest = ids.filter((id) => truth(id) !== target);
        if (hit.length === 0 || rest.length < 3) return null;
        return { cls: cls.id, claims: r.shuffle([hit[0]!, ...rest.slice(0, 3)]), ask };
      },
      (inst) => {
        const q = theoryQuestion(inst);
        const right = q.options.filter((o) => o.correct).length;
        const distinct = new Set(q.options.map((o) => o.text)).size === q.options.length;
        return distinct && (q.mode === "single" ? right === 1 && q.options.length === 4 : right >= 1 && right < q.options.length);
      },
    );
  },
};

// ---------------------------------------------------------------- Normas

/** Cantidades del enunciado con nombre: u·v, ‖u‖₁, ‖v‖₂², ‖u‖∞ o un número. */
export type NamedQty = { k: "dot" } | { k: "norm1" | "norm2sq" | "normInf"; of: "u" | "v" } | { k: "num"; value: number };
export type NamedCond = { lhs: NamedQty; op: "=" | ">" | "<"; rhs: NamedQty };

export type NormsInstance =
  | { kind: "calcular"; v: number[] }
  | { kind: "contar"; u: AlphaEntry[]; v: AlphaEntry[] | null; conds: NamedCond[]; domain: "nonneg" | "real" };

const toQty = (q: NamedQty, u: AlphaEntry[], v: AlphaEntry[] | null): AlphaQty =>
  q.k === "num" ? q : q.k === "dot" ? { k: "dot", u, v: v! } : { k: q.k, v: q.of === "u" ? u : v! };

export const normsConditions = (inst: Extract<NormsInstance, { kind: "contar" }>): AlphaCondition[] =>
  inst.conds.map((c) => ({ lhs: toQty(c.lhs, inst.u, inst.v), op: c.op, rhs: toQty(c.rhs, inst.u, inst.v) }));

export const normsCount = (inst: Extract<NormsInstance, { kind: "contar" }>) => countAlpha(normsConditions(inst), inst.domain);

const COUNT_OPTIONS = ["0", "1", "2", "3", "infinitos"] as const;

export function normsQuestion(inst: Extract<NormsInstance, { kind: "contar" }>): ChoiceQuestion {
  const r = normsCount(inst);
  const right = r.kind === "infinitos" ? "infinitos" : String(r.count);
  const rng = rngOf(inst);
  const others = rng.shuffle(COUNT_OPTIONS.filter((x) => x !== right)).slice(0, 3);
  const label = (x: string) => (x === "infinitos" ? "Infinitos" : x === "1" ? "Exactamente 1" : `Exactamente ${x}`);
  const why = normsExplanation(inst).join(" ");
  return {
    mode: "single",
    options: [...[right, ...others].sort((a, b) => COUNT_OPTIONS.indexOf(a as never) - COUNT_OPTIONS.indexOf(b as never))].map((x) => opt(`n${x}`, label(x), undefined, x === right, x === right ? `Correcta. ${why}` : undefined)),
  };
}

/** a·|α| + b·α² + c·α + d, la forma de las cantidades de los enunciados (null si no la tiene). */
type AlphaPoly = { abs: number; sq: number; lin: number; c: number };
const P0: AlphaPoly = { abs: 0, sq: 0, lin: 0, c: 0 };
const padd = (p: AlphaPoly, q: AlphaPoly, s = 1): AlphaPoly => ({ abs: p.abs + s * q.abs, sq: p.sq + s * q.sq, lin: p.lin + s * q.lin, c: p.c + s * q.c });

function qtyPoly(q: NamedQty, u: AlphaEntry[], v: AlphaEntry[] | null): AlphaPoly | null {
  if (q.k === "num") return { ...P0, c: q.value };
  if (q.k === "normInf") return null;
  if (q.k === "dot") {
    let p = P0;
    for (let i = 0; i < u.length; i++) {
      const [c1, a1] = u[i]!;
      const [c2, a2] = v![i]!;
      p = padd(p, { abs: 0, sq: a1 * a2, lin: c1 * a2 + c2 * a1, c: c1 * c2 });
    }
    return p;
  }
  const w = q.of === "u" ? u : v!;
  let p = P0;
  for (const [c, a] of w) {
    if (a !== 0 && c !== 0) return null;
    p = q.k === "norm1" ? padd(p, a === 0 ? { ...P0, c: Math.abs(c) } : { ...P0, abs: Math.abs(a) }) : padd(p, a === 0 ? { ...P0, c: c * c } : { ...P0, sq: a * a });
  }
  return p;
}

const coefTerm = (k: number, body: string, first: boolean) => {
  const sign = k < 0 ? (first ? "−" : " − ") : first ? "" : " + ";
  const m = Math.abs(k);
  return `${sign}${m === 1 ? "" : m}${body}`;
};
function polyText(p: AlphaPoly): string {
  const parts: string[] = [];
  for (const [k, body] of [
    [p.sq, "α²"],
    [p.abs, "|α|"],
    [p.lin, "α"],
  ] as const) {
    if (k !== 0) parts.push(coefTerm(k, body, parts.length === 0));
  }
  if (p.c !== 0 || parts.length === 0) parts.push(parts.length === 0 ? signText(p.c) : `${p.c < 0 ? " − " : " + "}${Math.abs(p.c)}`);
  return parts.join("");
}

const NQTY: Record<Exclude<NamedQty["k"], "num">, (of: string) => string> = { dot: () => "u·v", norm1: (o) => `‖${o}‖₁`, norm2sq: (o) => `‖${o}‖₂²`, normInf: (o) => `‖${o}‖∞` };
const nqText = (q: NamedQty) => (q.k === "num" ? signText(q.value) : NQTY[q.k](q.k === "dot" ? "" : q.of));
const alphaNum = (x: number) => String(Math.round(x * 1e4) / 1e4).replace(".", ",").replace("-", "−");

/** Una igualdad con una sola clase de término en α (|α|, α² o α), despejada; null si no es así. */
function isolate(p: AlphaPoly, domain: "nonneg" | "real"): string | null {
  const only = (["abs", "sq", "lin"] as const).filter((k) => p[k] !== 0);
  if (only.length === 2 && p.lin === 0) return `con t = |α| ≥ 0 (y α² = t²) es una ecuación de segundo grado en t: solo valen sus raíces t ≥ 0, y ${domain === "nonneg" ? "como α ≥ 0, cada una da α = t" : "cada t > 0 da dos α (t y −t)"}.`;
  if (only.length !== 1) return null;
  const k = only[0]!;
  const r = -p.c / p[k];
  const body = k === "abs" ? "|α|" : k === "sq" ? "α²" : "α";
  const head = `${body} = ${alphaNum(r)}`;
  if (k === "lin") return `${head}${domain === "nonneg" && r < 0 ? ": no vale, porque se pide α ≥ 0" : ""}.`;
  if (r < 0) return `${head}: imposible, porque ${body} ≥ 0 para todo α.`;
  if (r === 0) return `${head}: solo α = 0.`;
  const root = k === "abs" ? r : Math.sqrt(r);
  return `${head}: α = ${alphaNum(root)} o α = ${alphaNum(-root)}${domain === "nonneg" ? `; con α ≥ 0, solo α = ${alphaNum(root)}` : ""}.`;
}

/** Explicación del recuento: cada condición escrita en α, despejada si se puede, y la conclusión. */
export function normsExplanation(inst: Extract<NormsInstance, { kind: "contar" }>): string[] {
  const out: string[] = [];
  for (const c of inst.conds) {
    const l = qtyPoly(c.lhs, inst.u, inst.v);
    const r = qtyPoly(c.rhs, inst.u, inst.v);
    const name = `${nqText(c.lhs)} ${c.op} ${nqText(c.rhs)}`;
    if (c.lhs.k === "normInf") {
      const w = c.lhs.of === "u" ? inst.u : inst.v!;
      out.push(`${nqText(c.lhs)} = máx(${w.map(([k0, a]) => (a === 0 ? String(Math.abs(k0)) : `|${entryText([k0, a])}|`)).join(", ")}), así que ${name} pide que ese máximo valga ${nqText(c.rhs)}.`);
      continue;
    }
    if (!l || !r) {
      out.push(`${name}: escríbela como una ecuación en α.`);
      continue;
    }
    const diff = padd(l, r, -1);
    const eq = `${polyText(diff)} ${c.op} 0`;
    const expanded = `${polyText(l)} ${c.op} ${polyText(r)}`;
    const solved = c.op === "=" ? isolate(diff, inst.domain) : null;
    out.push(`${name} es ${expanded}${expanded === eq ? "" : `, es decir, ${eq}`}${solved ? `; ${solved}` : "."}`);
  }
  const n = normsCount(inst);
  out.push(
    n.kind === "infinitos"
      ? "Se cumple en todo un intervalo de α: hay infinitos valores."
      : n.count === 0
        ? "Ningún valor de α cumple todo lo que se pide: la respuesta es 0."
        : `Lo cumple${n.count === 1 ? "" : "n"} α = ${n.values.map(alphaNum).join(", ")}: ${n.count === 1 ? "un valor" : `${n.count} valores`}.`,
  );
  return out;
}

const NORMS_HINTS: readonly TaggedHint[] = [
  { needs: ["dot"], text: "u·v es la suma de los productos componente a componente: escríbelo como una expresión en α." },
  { needs: ["norm1"], text: "‖u‖₁ es la suma de los valores absolutos: |α| más los de las componentes fijas." },
  { needs: ["norm2sq"], text: "‖u‖₂² es la suma de los cuadrados (sin raíz)." },
  { needs: ["normInf"], text: "‖u‖∞ es el mayor valor absoluto de las componentes." },
  { needs: ["abs"], text: "Con |α| salen dos casos (α y −α); si solo valen α ≥ 0, quédate con los no negativos. |α| nunca es negativo." },
  { needs: ["normInf"], text: "‖u‖∞ = c se cumple para todo un intervalo de α si otra componente ya vale c en valor absoluto: entonces hay infinitos." },
  { needs: ["desigualdad"], text: "Una desigualdad no da valores sueltos: se queda con los α de la igualdad que la cumplen." },
];

/** Pistas de «¿para cuántos α?»: solo las de las cantidades que hay en las condiciones. */
export function normsHints(inst: Extract<NormsInstance, { kind: "contar" }>): string[] {
  const t = new Set<string>();
  for (const c of inst.conds) {
    for (const q of [c.lhs, c.rhs]) if (q.k !== "num") t.add(q.k);
    if (c.op !== "=") t.add("desigualdad");
  }
  if (t.has("norm1") || t.has("normInf")) t.add("abs");
  return pickHints(NORMS_HINTS, t);
}

const entryText = ([c, a]: AlphaEntry) => (a === 0 ? String(c) : `${c === 0 ? "" : `${c} + `}${a === 1 ? "" : a === -1 ? "−" : a}α`).replace(/-/g, "−");
export const alphaVecText = (v: readonly AlphaEntry[]) => `(${v.map(entryText).join(", ")})`;

function normsTemplate(rng: Rng, level: ExerciseLevel): NormsInstance {
  if (level === "básico") return { kind: "calcular", v: Array.from({ length: rng.int(3, 4) }, () => rng.int(-5, 5)) };
  const A: AlphaEntry = [0, 1];
  const c = () => [rng.int(-3, 3), 0] as AlphaEntry;
  const domain = rng.pick(["nonneg", "real"] as const);
  if (level === "medio") {
    switch (rng.int(0, 2)) {
      case 0: {
        const u = [A, c(), c()];
        const v = [A, c(), c()];
        return { kind: "contar", u, v, conds: [{ lhs: { k: "dot" }, op: "=", rhs: { k: "num", value: 0 } }], domain };
      }
      case 1:
        return { kind: "contar", u: [A, c(), c()], v: null, conds: [{ lhs: { k: "norm1", of: "u" }, op: "=", rhs: { k: "num", value: rng.int(1, 7) } }], domain };
      default:
        return { kind: "contar", u: [A, [rng.pick([-2, -1, 1, 2]), 0]], v: null, conds: [{ lhs: { k: "norm2sq", of: "u" }, op: "=", rhs: { k: "norm1", of: "u" } }], domain };
    }
  }
  const u = [A, c(), c()];
  const v = [[rng.int(-2, 2), 0], [rng.int(-2, 2), 0], [rng.int(-2, 2), 0]] as AlphaEntry[];
  return rng.chance(0.6)
    ? { kind: "contar", u, v, conds: [{ lhs: { k: "normInf", of: "u" }, op: "=", rhs: { k: "num", value: rng.int(2, 4) } }, { lhs: { k: "dot" }, op: rng.pick([">", "<"]), rhs: { k: "num", value: 0 } }], domain }
    : { kind: "contar", u, v, conds: [{ lhs: { k: "norm2sq", of: "u" }, op: "=", rhs: { k: "num", value: rng.pick([9, 16, 25, 10, 13]) } }, { lhs: { k: "dot" }, op: rng.pick([">", "<", "="]), rhs: { k: "num", value: 0 } }], domain };
}

export const LINALG_NORMS: ExerciseType<NormsInstance> = {
  id: "algebra-normas",
  topic: "algebra-lineal",
  title: "Normas y producto escalar",
  description: "Calcula ‖v‖₁, ‖v‖₂ y ‖v‖∞, y cuenta para cuántos valores de α se cumplen condiciones con normas, ortogonalidad (u·v = 0) o el signo de u·v.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-normas", seed),
      (r) => normsTemplate(r, level),
      (inst) => {
        if (inst.kind === "calcular") return inst.v.filter((x) => x !== 0).length >= 2 && new Set(inst.v.map(Math.abs)).size >= 2;
        const n = normsCount(inst);
        // Respuestas variadas: en avanzado no siempre 0.
        return level === "avanzado" ? n.kind === "infinitos" || n.count > 0 || r01(inst) : true;
      },
    );
  },
};
/** Deja pasar algunos «0» en avanzado (de forma determinista). */
const r01 = (inst: unknown) => seedFromKey(JSON.stringify(inst)) % 4 === 0;

// ---------------------------------------------------------------- Rango y dimensión de un tensor

export type TensorVocabInstance = { ask: "vocabulario" | "componentes" | "numpy" | "inverso" | "matriz"; k: number; n: number; rg: number };

export function tensorVocabQuestion(inst: TensorVocabInstance): ChoiceQuestion {
  const { k, n } = inst;
  const rd = (r: number | string, d: number | string) => `Rango ${r} y dimensión ${d}`;
  const rdTex = (r: string, d: string) => `\\text{Rango } ${r} \\text{ y dimensión } ${d}`;
  const pick4 = (right: ChoiceOption, wrong: ChoiceOption[]) => {
    const seen = new Set([right.text]);
    const w = wrong.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true)));
    return { mode: "single" as const, options: [right, ...w.slice(0, 3)] };
  };
  switch (inst.ask) {
    case "vocabulario":
    case "inverso":
      return pick4(opt("ok", rd(k, n), rdTex(String(k), String(n)), true, "Rango: cuántos índices tiene (ndim). Dimensión: cuánto mide cada índice."), [
        opt("w1", rd(n, k), rdTex(String(n), String(k)), false),
        opt("w2", rd(`${n}^${k}`, `${k}^${n}`), rdTex(`${n}^{${k}}`, `${k}^{${n}}`), false),
        opt("w3", rd(k, `${n}^${k}`), rdTex(String(k), `${n}^{${k}}`), false),
        opt("w4", rd(`${n}^${k}`, n), rdTex(`${n}^{${k}}`, String(n)), false),
      ]);
    case "matriz":
      return pick4(opt("ok", rd(2, n), rdTex("2", String(n)), true, "Toda matriz tiene dos índices: como tensor es de rango 2, tenga el rango matricial (rg) que tenga."), [
        opt("w1", rd(inst.rg, n), rdTex(String(inst.rg), String(n)), false, "Confunde el rango del tensor (número de índices) con el rango de la matriz (rg)."),
        opt("w2", rd(n, 2), rdTex(String(n), "2"), false),
        opt("w3", rd(inst.rg, 2), rdTex(String(inst.rg), "2"), false),
        opt("w4", rd(2, n * n), rdTex("2", String(n * n)), false),
      ]);
    case "componentes":
      return pick4(opt("ok", String(n ** k), `${n}^{${k}} = ${n ** k}`, true, "Cada uno de los k índices toma n valores: nᵏ componentes."), [
        opt("w1", String(k ** n), `${k}^{${n}} = ${k ** n}`, false),
        opt("w2", String(n * k), `${n}\\cdot ${k} = ${n * k}`, false),
        opt("w3", String(n + k), `${n} + ${k} = ${n + k}`, false),
        opt("w4", String(n ** (k - 1)), `${n}^{${k - 1}} = ${n ** (k - 1)}`, false),
      ]);
    case "numpy": {
      const shape = (d: number, times: number) => `(${Array.from({ length: times }, () => d).join(", ")}${times === 1 ? "," : ""})`;
      const o = (id: string, nd: number, sh: string, ok: boolean) => opt(id, `A.ndim == ${nd} y A.shape == ${sh}`, undefined, ok, ok ? "ndim es el rango (número de índices) y shape da lo que mide cada índice (la dimensión)." : undefined);
      return pick4(o("ok", k, shape(n, k), true), [o("w1", n, shape(k, n), false), o("w2", n ** k, shape(n ** k, 1), false), o("w3", k, shape(k, n), false), o("w4", n, shape(n, k), false)]);
    }
  }
}

export function tensorVocabStatement(inst: TensorVocabInstance): { text: string; tex?: string } {
  const { k, n } = inst;
  const space = `\\mathbb{R}^{${Array.from({ length: k }, () => n).join("\\times ")}}`;
  switch (inst.ask) {
    case "vocabulario":
      return { text: `Sea A ∈ ℝ^(${Array.from({ length: k }, () => n).join("×")}). Con la terminología del curso, A es un tensor de…`, tex: `A \\in ${space}` };
    case "inverso":
      return { text: `En NumPy, A.shape == (${Array.from({ length: k }, () => n).join(", ")}). Con la terminología del curso, A es un tensor de…` };
    case "matriz":
      return { text: `Sea M ∈ ℝ^(${n}×${n}) una matriz con rg(M) = ${inst.rg}. Vista como tensor, con la terminología del curso, M es un tensor de…`, tex: `M \\in \\mathbb{R}^{${n}\\times ${n}},\\ \\operatorname{rg}(M) = ${inst.rg}` };
    case "componentes":
      return { text: `¿Cuántas componentes (números) tiene un tensor de rango ${k} y dimensión ${n}?` };
    case "numpy":
      return { text: `Sea A un tensor de rango ${k} y dimensión ${n} guardado como un array de NumPy. ¿Qué dan A.ndim y A.shape?` };
  }
}

export const LINALG_TENSOR_VOCAB: ExerciseType<TensorVocabInstance> = {
  id: "algebra-tensor-rango",
  topic: "algebra-lineal",
  title: "Rango y dimensión de un tensor",
  description: "La terminología del curso: un tensor de ℝ^(5×5×5×5) es de rango 4 (índices, ndim) y dimensión 5 (lo que mide cada índice). No es el rango de una matriz.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-tensor-rango", seed),
      (r) => {
        const asks = level === "básico" ? (["vocabulario", "inverso"] as const) : level === "medio" ? (["vocabulario", "componentes", "numpy"] as const) : (["matriz", "componentes", "numpy", "vocabulario"] as const);
        const ask = r.pick(asks);
        const n = r.int(2, 6);
        const k = ask === "matriz" ? 2 : r.int(2, 5);
        return { ask, k, n, rg: ask === "matriz" ? r.pick(Array.from({ length: n + 1 }, (_, i) => i).filter((x) => x !== 2)) : 0 };
      },
      (inst) => inst.k !== inst.n && (inst.ask !== "componentes" || inst.n ** inst.k <= 4096) && tensorVocabQuestion(inst).options.length === 4,
    );
  },
};

// ---------------------------------------------------------------- Rouché–Frobenius (tipo test)

const ROUCHE_OPTIONS = [
  { id: "cd", text: "Compatible determinado" },
  { id: "ci1", text: "Compatible indeterminado con 1 parámetro" },
  { id: "ci2", text: "Compatible indeterminado con 2 parámetros" },
  { id: "inc", text: "Incompatible" },
] as const;

export function roucheChoiceQuestion(inst: LinSystemInstance): ChoiceQuestion {
  const { A, b } = splitAugmented(intMatrix(inst.matrix));
  const s = analyzeSystem(A, b);
  const right = s.kind === "determinado" ? "cd" : s.kind === "incompatible" ? "inc" : `ci${s.n - s.rankA}`;
  const why = `rg A = ${s.rankA}, rg (A|b) = ${s.rankAb}, n = ${s.n} incógnitas.`;
  return { mode: "single", options: ROUCHE_OPTIONS.map((o) => opt(o.id, o.text, undefined, o.id === right, o.id === right ? why : undefined)) };
}

export const LINALG_ROUCHE_CHOICE: ExerciseType<LinSystemInstance> = {
  id: "algebra-rouche-test",
  topic: "algebra-lineal",
  title: "Clasificar un sistema (tipo test)",
  description: "Como en el examen: ¿compatible determinado, indeterminado con 1 o 2 parámetros, o incompatible? Compara rg A, rg (A|b) y el número de incógnitas.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const gen = systemGenerator("algebra-rouche-test", SYSTEM_LIMITS);
    // Con el mismo generador que «Sistemas»: se descartan los de 3 o más parámetros.
    for (let i = 0; i < 50; i++) {
      const inst = gen((seed + i * 7919) >>> 0, level);
      if (roucheChoiceQuestion(inst).options.some((o) => o.correct)) return inst;
    }
    throw new Error("algebra-rouche-test: sin sistema");
  },
};

export const LINALG_THEORY_EXERCISES = [LINALG_DET_RULES, LINALG_THEORY, LINALG_NORMS, LINALG_TENSOR_VOCAB, LINALG_ROUCHE_CHOICE] as const;

export const LINALG_EXERCISES = [
  LINALG_GAUSS,
  LINALG_DETERMINANT,
  LINALG_PRODUCT,
  LINALG_INVERSE,
  LINALG_SYSTEMS,
  LINALG_INDEPENDENCE,
  LINALG_EIGEN,
  LINALG_TENSORS,
  ...LINALG_THEORY_EXERCISES,
] as const;
