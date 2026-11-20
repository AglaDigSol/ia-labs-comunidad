// Factorizaciones de matrices (02MIAR, tema 2) con números pequeños que salen exactos: LU sin cambiar
// filas (L con unos en la diagonal y los multiplicadores debajo), Cholesky con el criterio de los
// menores principales, QR por Gram-Schmidt (con una primera columna de norma entera, para que las
// raíces salgan exactas), valores singulares (σ = √λ de AᵀA, de mayor a menor) y la matriz de una
// aplicación lineal (las imágenes de la base en columnas). Los datos salen al azar con la semilla; los
// pasos y su corrección se montan con shared/exercises/guided.ts.
import { matrixDeterminant } from "../linalg/det.ts";
import { fracText, identityMatrix, intMatrix, matrixProduct, matrixTex, matrixTranspose, matrixVector, type Matrix } from "../linalg/matrix.ts";
import { matrixInverse } from "../linalg/rref.ts";
import { add, div, equals, frac, mul, neg, sub, ZERO, type Frac } from "../rational.ts";
import { cleanMistakes, sameMatrix, type GuidedExercise, type GuidedStep } from "./guided.ts";
import { unimodular } from "./linalg.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Ints = number[][];
const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;
const int = (x: number | bigint): Frac => frac(BigInt(x));
const one = (x: Frac): Matrix => [[x]];
const row = (v: readonly Frac[]): Matrix => [[...v]];
const matText = (M: Matrix) => `(${M.map((r) => r.map(fracText).join(" ")).join("; ")})`;
const vecText = (v: readonly Frac[]) => `(${v.map(fracText).join(", ")})`;
const isInt = (M: Matrix) => M.every((r) => r.every((x) => x.d === 1n));
const toInts = (M: Matrix): Ints => M.map((r) => r.map((x) => Number(x.n)));
const maxAbs = (M: Matrix) => Math.max(...M.flat().map((x) => Math.abs(Number(x.n) / Number(x.d))));
const small = (M: Matrix, maxDen: bigint, maxNum: number) => M.every((r) => r.every((x) => x.d <= maxDen && Math.abs(Number(x.n)) <= maxNum));
const dotF = (u: readonly Frac[], v: readonly Frac[]) => u.reduce((acc, x, i) => add(acc, mul(x, v[i]!)), ZERO);
const isqrt = (n: bigint): bigint | null => {
  if (n < 0n) return null;
  let r = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return r * r === n ? r : null;
};
/** Raíz exacta de una fracción no negativa, o null. */
export function fracSqrt(x: Frac): Frac | null {
  const a = isqrt(x.n);
  const b = isqrt(x.d);
  return a !== null && b !== null ? frac(a, b) : null;
}
const eye = (n: number) => identityMatrix(n);

// ================================================================ LU

export type LuInstance = { A: Ints; b: number[] | null };

/** Doolittle sin cambiar filas: L con unos en la diagonal, U triangular superior (null si un pivote es 0). */
export function luOf(Aints: Ints): { L: Matrix; U: Matrix } | null {
  const n = Aints.length;
  const U = intMatrix(Aints).map((r) => [...r]);
  const L = eye(n).map((r) => [...r]);
  for (let j = 0; j < n; j++) {
    if (equals(U[j]![j]!, ZERO)) return null;
    for (let i = j + 1; i < n; i++) {
      const m = div(U[i]![j]!, U[j]![j]!);
      L[i]![j] = m;
      U[i] = U[i]!.map((x, k) => sub(x, mul(m, U[j]![k]!)));
    }
  }
  return { L, U };
}

/** Sustitución hacia delante (L y = b) y hacia atrás (U x = y). */
export function forwardSub(L: Matrix, b: readonly Frac[]): Frac[] {
  const y: Frac[] = [];
  for (let i = 0; i < L.length; i++) y.push(div(sub(b[i]!, L[i]!.slice(0, i).reduce((acc, x, k) => add(acc, mul(x, y[k]!)), ZERO)), L[i]![i]!));
  return y;
}
export function backSub(U: Matrix, y: readonly Frac[]): Frac[] {
  const n = U.length;
  const x: Frac[] = Array.from({ length: n }, () => ZERO);
  for (let i = n - 1; i >= 0; i--) x[i] = div(sub(y[i]!, U[i]!.slice(i + 1).reduce((acc, u, k) => add(acc, mul(u, x[i + 1 + k]!)), ZERO)), U[i]![i]!);
  return x;
}

function makeLu(rng: Rng, level: ExerciseLevel): LuInstance | null {
  const n = level === "básico" ? 2 : 3;
  const mults = level === "avanzado" ? [frac(1n, 2n), frac(-1n, 2n), int(1), int(-1), int(2), int(-2), int(3)] : [int(1), int(-1), int(2), int(-2), int(3), int(-3)];
  const L = eye(n).map((r, i) => r.map((x, j) => (j < i ? rng.pick(mults) : x)));
  const U = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j < i ? ZERO : j === i ? int(rng.pick([1, 2, -1, 3, -2, 4])) : int(rng.int(-3, 4)))));
  const A = matrixProduct(L, U);
  if (!isInt(A)) return null;
  const x = Array.from({ length: n }, () => rng.int(-3, 3));
  const b = level === "avanzado" ? toInts(matrixProduct(A, intMatrix(x.map((v) => [v])))).map((r) => r[0]!) : null;
  return { A: toInts(A), b };
}

export const LINALG_LU: ExerciseType<LuInstance> = {
  id: "algebra-lu",
  topic: "algebra-lineal",
  title: "Factorización LU",
  description: "Haz Gauss sin cambiar filas y guarda los multiplicadores: A = L·U con L triangular inferior (unos en la diagonal) y U triangular superior; después det A o el sistema con Ly = b y Ux = y.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-lu", seed),
      (r) => makeLu(r, level),
      (inst) => {
        const A = intMatrix(inst.A);
        if (maxAbs(A) > 20 || inst.A.flat().filter((x) => x === 0).length > 2) return false;
        const lu = luOf(inst.A);
        if (!lu) return false;
        if (inst.b && Math.max(...inst.b.map(Math.abs)) > 40) return false;
        return small(lu.U, 2n, 30);
      },
    );
  },
};

export function luGuided(inst: LuInstance): GuidedExercise {
  const A = intMatrix(inst.A);
  const { L, U } = luOf(inst.A)!;
  const flipped = L.map((r, i) => r.map((x, j) => (j < i ? neg(x) : x)));
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: "L: unos en la diagonal y los multiplicadores debajo",
      name: "L",
      expected: L,
      mistakes: cleanMistakes(L, [
        { value: flipped, text: "Signo de los multiplicadores: si haces Fᵢ ← Fᵢ − m·Fⱼ, en L va m (con su signo), no −m." },
        { value: matrixTranspose(L), text: "L es triangular inferior: los multiplicadores van debajo de la diagonal." },
      ], sameMatrix),
      diagnose: (t) => (t.some((r, i) => !equals(r[i]!, int(1))) ? "En esta LU (la de Gauss), L lleva unos en la diagonal." : t.some((r, i) => r.some((x, j) => j > i && !equals(x, ZERO))) ? "L es triangular inferior: encima de la diagonal, ceros." : null),
      hints: ["El multiplicador que anula la entrada (i, j) es mᵢⱼ = aᵢⱼ / pivote, con la matriz ya transformada en las columnas anteriores.", "Apunta cada mᵢⱼ en la posición (i, j) de L; la diagonal de L son unos."],
      okText: "Bien: esa es L.",
    },
    {
      kind: "numbers",
      title: "U: lo que queda al terminar Gauss",
      name: "U",
      expected: U,
      mistakes: cleanMistakes(U, [{ value: matrixTranspose(U), text: "U es triangular superior: los ceros van debajo de la diagonal." }], sameMatrix),
      diagnose: (t) => (t.some((r, i) => r.some((x, j) => j < i && !equals(x, ZERO))) ? "U es triangular superior: debajo de la diagonal, todo ceros." : sameMatrix(matrixProduct(L, t), A) ? null : "Con tu U, L·U no da A: repasa las filas después de cada resta."),
      hints: ["Fᵢ ← Fᵢ − mᵢⱼ·Fⱼ en cada fila por debajo del pivote, columna a columna.", "Comprueba la última fila de L·U: tiene que dar la de A."],
      okText: "Bien: esa es U, y L·U = A.",
    },
  ];
  const detA = U.reduce((acc, r, i) => mul(acc, r[i]!), int(1));
  if (!inst.b) {
    steps.push({
      kind: "numbers",
      title: "det A con la LU",
      name: "det A",
      expected: one(detA),
      mistakes: cleanMistakes(one(detA), [{ value: one(U.reduce((acc, r, i) => add(acc, r[i]!), ZERO)), text: "Se multiplican los de la diagonal de U, no se suman." }, { value: one(neg(detA)), text: "Sin cambiar filas no cambia el signo: det A = det L · det U, y det L = 1." }], sameMatrix),
      hints: ["det A = det L · det U, det L = 1 (unos en la diagonal) y det U es el producto de su diagonal."],
      okText: `Bien: det A = ${fracText(detA)}.`,
    });
  } else {
    const b = inst.b.map(int);
    const y = forwardSub(L, b);
    const x = backSub(U, y);
    steps.push({
      kind: "numbers",
      title: "Sustitución hacia delante: L·y = b",
      name: "y",
      expected: row(y),
      mistakes: cleanMistakes(row(y), [{ value: row(b), text: "Ese es b: hay que resolver L·y = b de arriba abajo (y₁ = b₁, y luego cada y con los anteriores)." }, { value: row(backSub(U, b)), text: "Has resuelto U·x = b directamente: primero va L·y = b." }], sameMatrix),
      hints: ["L es triangular inferior con unos: y₁ = b₁, y₂ = b₂ − l₂₁y₁, y así hacia abajo."],
      okText: "Bien: ese es y.",
    });
    steps.push({
      kind: "numbers",
      title: "Sustitución hacia atrás: U·x = y",
      name: "x",
      expected: row(x),
      diagnose: (t) => (sameMatrix([matrixVector(A, t[0]!)], row(b)) ? null : "Con tu x, A·x no da b."),
      hints: ["Empieza por la última ecuación (una sola incógnita) y sube.", "Comprueba que A·x = b."],
      okText: "Bien: A·x = b.",
    });
  }
  return {
    statement: {
      blocks: [
        { kind: "p", text: "Factoriza A = L·U con el método de Gauss, sin intercambiar filas." },
        { kind: "tex", tex: `A = ${matrixTex(A)}${inst.b ? `,\\quad b = ${matrixTex(inst.b.map((v) => [int(v)]))}` : ""}`, label: `A = ${matText(A)}${inst.b ? `, b = ${vecText(inst.b.map(int))}` : ""}` },
      ],
      ask: inst.b ? "Calcula L y U y resuelve A·x = b con dos sistemas triangulares." : "Calcula L y U, y det A con la factorización.",
    },
    steps,
    solution: [
      ...L.flatMap((r, i) => r.flatMap((m, j) => (j < i ? [`m${"₀₁₂₃"[i + 1]}${"₀₁₂₃"[j + 1]} = ${fracText(m)}`] : []))).map((t) => `${t}.`),
      `L = ${matText(L)}, U = ${matText(U)}.`,
      `Comprobación: L·U = ${matText(matrixProduct(L, U))} = A.`,
      ...(inst.b ? [`L·y = b ⇒ y = ${vecText(forwardSub(L, inst.b.map(int)))}; U·x = y ⇒ x = ${vecText(backSub(U, forwardSub(L, inst.b.map(int))))}.`] : [`det A = ${U.map((r, i) => (r[i]!.n < 0n ? `(${fracText(r[i]!)})` : fracText(r[i]!))).join("·")} = ${fracText(detA)}.`]),
    ],
  };
}

// ================================================================ Cholesky

export type CholeskyInstance = { S: Ints };

/** L triangular inferior con diagonal positiva y L·Lᵀ = S, si existe y sale exacta. */
export function choleskyOf(Sints: Ints): Matrix | null {
  const S = intMatrix(Sints);
  const n = S.length;
  const L: Matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => ZERO));
  for (let j = 0; j < n; j++) {
    const d = sub(S[j]![j]!, L[j]!.slice(0, j).reduce((acc, x) => add(acc, mul(x, x)), ZERO));
    if (d.n <= 0n) return null;
    const r = fracSqrt(d);
    if (!r) return null;
    L[j]![j] = r;
    for (let i = j + 1; i < n; i++) L[i]![j] = div(sub(S[i]![j]!, L[i]!.slice(0, j).reduce((acc, x, k) => add(acc, mul(x, L[j]![k]!)), ZERO)), r);
  }
  return L;
}

/** Menores principales (de las esquinas) Δ₁, …, Δₙ. */
export const leadingMinors = (S: Matrix): Frac[] => S.map((_, k) => matrixDeterminant(S.slice(0, k + 1).map((r) => r.slice(0, k + 1))));

function makeCholesky(rng: Rng, level: ExerciseLevel): CholeskyInstance {
  const n = level === "básico" ? 2 : 3;
  // Avanzado: diagonales más grandes y todas las entradas de debajo distintas de 0.
  const diag = level === "avanzado" ? [2, 3, 3, 4] : [1, 2, 2, 3];
  const off = level === "avanzado" ? [-3, -2, -1, 1, 2, 3] : [-2, -1, 0, 1, 2, 3];
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j > i ? 0 : j === i ? rng.pick(diag) : rng.pick(off))));
  const S = matrixProduct(intMatrix(L), matrixTranspose(intMatrix(L)));
  return { S: toInts(S) };
}

export const LINALG_CHOLESKY: ExerciseType<CholeskyInstance> = {
  id: "algebra-cholesky",
  topic: "algebra-lineal",
  title: "Factorización de Cholesky",
  description: "Comprueba con los menores principales que S (simétrica) es definida positiva y calcula L, triangular inferior con diagonal positiva, con S = L·Lᵀ.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-cholesky", seed),
      (r) => makeCholesky(r, level),
      (inst) => {
        const L = choleskyOf(inst.S);
        if (!L) return false;
        const off = inst.S.flatMap((r, i) => r.filter((_, j) => j !== i));
        // Que no sea diagonal y con entradas cómodas.
        return off.some((x) => x !== 0) && Math.max(...inst.S.flat().map(Math.abs)) <= (level === "avanzado" ? 45 : 30) && (level === "básico" || off.filter((x) => x !== 0).length >= 4);
      },
    );
  },
};

export function choleskyGuided(inst: CholeskyInstance): GuidedExercise {
  const S = intMatrix(inst.S);
  const L = choleskyOf(inst.S)!;
  const n = S.length;
  const minors = leadingMinors(S);
  const negDiag = L.map((r, i) => r.map((x, j) => (j === i ? neg(x) : x)));
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: "Menores principales Δ₁, …, Δₙ (de la esquina superior izquierda)",
      name: "(Δ₁, …, Δₙ)",
      expected: row(minors),
      mistakes: cleanMistakes(row(minors), [{ value: row(S.map((r, i) => r[i]!)), text: "Esos son los elementos de la diagonal: los menores son determinantes de las submatrices de la esquina (1 × 1, 2 × 2, …)." }], sameMatrix),
      hints: ["Δₖ es el determinante de la submatriz k × k de la esquina superior izquierda.", "S es definida positiva si es simétrica y todos sus Δₖ son > 0 (criterio de Sylvester): entonces tiene Cholesky."],
      okText: "Bien: todos son positivos, así que S es definida positiva y tiene Cholesky.",
    },
    {
      kind: "numbers",
      title: "L (triangular inferior, diagonal positiva) con S = L·Lᵀ",
      name: "L",
      expected: L,
      mistakes: cleanMistakes(L, [
        { value: matrixTranspose(L), text: "Esa es Lᵀ (triangular superior): en S = L·Lᵀ, L es la de abajo." },
        { value: negDiag, text: "En la diagonal se toma la raíz positiva." },
      ], sameMatrix),
      diagnose: (t) => (t.some((r, i) => r.some((x, j) => j > i && !equals(x, ZERO))) ? "L es triangular inferior: encima de la diagonal, ceros." : sameMatrix(matrixProduct(t, matrixTranspose(t)), S) ? null : "Con tu L, L·Lᵀ no da S."),
      hints: [
        "Columna a columna: lⱼⱼ = √(sⱼⱼ − Σₖ lⱼₖ²) y, debajo, lᵢⱼ = (sᵢⱼ − Σₖ lᵢₖ·lⱼₖ) / lⱼⱼ (k < j).",
        "Empieza por l₁₁ = √s₁₁ y la primera columna: lᵢ₁ = sᵢ₁ / l₁₁.",
      ],
      okText: "Bien: L·Lᵀ = S.",
    },
    {
      kind: "numbers",
      title: "Comprobación: det S = (l₁₁·l₂₂·…)²",
      name: "det S",
      expected: one(minors[n - 1]!),
      mistakes: cleanMistakes(one(minors[n - 1]!), [{ value: one(L.reduce((acc, r, i) => mul(acc, r[i]!), int(1))), text: "Ese es det L: det S = det L · det Lᵀ = (det L)²." }], sameMatrix),
      hints: ["det S = det L · det Lᵀ, y det L es el producto de su diagonal."],
      okText: "Bien: coincide con el último menor principal.",
    },
  ];
  return {
    statement: {
      blocks: [
        { kind: "p", text: "S es simétrica. Comprueba que es definida positiva y factorízala como S = L·Lᵀ." },
        { kind: "tex", tex: `S = ${matrixTex(S)}`, label: `S = ${matText(S)}` },
      ],
      ask: "Calcula los menores principales, la L de Cholesky y comprueba det S.",
    },
    steps,
    solution: [
      `Menores principales: ${minors.map((m, k) => `Δ${"₁₂₃"[k]} = ${fracText(m)}`).join(", ")}: todos > 0, definida positiva.`,
      `L = ${matText(L)}.`,
      `Comprobación: L·Lᵀ = ${matText(matrixProduct(L, matrixTranspose(L)))} = S, y det S = (${L.map((r, i) => fracText(r[i]!)).join("·")})² = ${fracText(minors[n - 1]!)}.`,
    ],
  };
}

// ================================================================ QR por Gram-Schmidt

export type QrInstance = { a1: number[]; a2: number[] };

const PYTH2: Array<[number, number]> = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [12, 5],
];
const PYTH3: Array<[number, number, number]> = [
  [1, 2, 2],
  [2, 1, 2],
  [2, 2, 1],
  [2, 3, 6],
  [3, 2, 6],
  [6, 2, 3],
  [2, 6, 3],
  [4, 4, 2],
];

export function qrOf(inst: QrInstance) {
  const a1 = inst.a1.map(int);
  const a2 = inst.a2.map(int);
  const r11 = fracSqrt(dotF(a1, a1))!;
  const q1 = a1.map((x) => div(x, r11));
  const r12 = dotF(q1, a2);
  const u2 = a2.map((x, i) => sub(x, mul(r12, q1[i]!)));
  const r22 = fracSqrt(dotF(u2, u2));
  const q2 = r22 && r22.n !== 0n ? u2.map((x) => div(x, r22)) : null;
  return { a1, a2, r11, q1, r12, u2, r22, q2 };
}

function makeQr(rng: Rng, level: ExerciseLevel): QrInstance {
  const sgn = () => rng.pick([1, -1]);
  if (level === "avanzado") {
    const p = rng.pick(PYTH3);
    return { a1: p.map((x) => x * sgn()), a2: Array.from({ length: 3 }, () => rng.int(-4, 5)) };
  }
  const p = rng.pick(level === "básico" ? PYTH2.slice(0, 2) : PYTH2);
  return { a1: p.map((x) => x * sgn()), a2: [rng.int(-5, 6), rng.int(-5, 6)] };
}

export const LINALG_QR: ExerciseType<QrInstance> = {
  id: "algebra-qr",
  topic: "algebra-lineal",
  title: "Factorización QR (Gram-Schmidt)",
  description: "Con Gram-Schmidt sobre las columnas a₁ y a₂: r₁₁ = ‖a₁‖, q₁ = a₁/r₁₁, r₁₂ = q₁·a₂, u₂ = a₂ − r₁₂q₁, r₂₂ = ‖u₂‖ y q₂ = u₂/r₂₂. Comprueba Q·R = A.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-qr", seed),
      (r) => makeQr(r, level),
      (inst) => {
        const q = qrOf(inst);
        if (!q.r22 || q.r22.n === 0n || !q.q2) return false;
        if (q.r12.n === 0n) return false;
        return [...q.u2, q.r12, q.r22].every((x) => x.d <= 25n && Math.abs(Number(x.n)) <= 400);
      },
    );
  },
};

export function qrGuided(inst: QrInstance): GuidedExercise {
  const q = qrOf(inst);
  const m = inst.a1.length;
  const A: Matrix = q.a1.map((x, i) => [x, q.a2[i]!]);
  const unnorm = dotF(q.a1, q.a2);
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: "r₁₁ = ‖a₁‖",
      name: "r₁₁",
      expected: one(q.r11),
      mistakes: cleanMistakes(one(q.r11), [{ value: one(dotF(q.a1, q.a1)), text: "Eso es ‖a₁‖²: falta la raíz cuadrada." }], sameMatrix),
      hints: ["‖a₁‖ = √(suma de los cuadrados de sus componentes)."],
      okText: `Bien: r₁₁ = ${fracText(q.r11)}.`,
    },
    {
      kind: "numbers",
      title: "q₁ = a₁ / r₁₁",
      name: "q₁",
      expected: row(q.q1),
      mistakes: cleanMistakes(row(q.q1), [{ value: row(q.a1), text: "Hay que dividir a₁ entre su norma para que q₁ mida 1." }], sameMatrix),
      diagnose: (t) => (equals(dotF(t[0]!, t[0]!), int(1)) ? null : "Tu q₁ no mide 1: comprueba ‖q₁‖² = 1."),
      hints: ["Divide cada componente de a₁ entre r₁₁: q₁ tiene norma 1."],
      okText: "Bien: q₁ es unitario.",
    },
    {
      kind: "numbers",
      title: "r₁₂ = q₁·a₂",
      name: "r₁₂",
      expected: one(q.r12),
      mistakes: cleanMistakes(one(q.r12), [{ value: one(unnorm), text: "Eso es a₁·a₂: se proyecta sobre q₁ (el unitario), así que se divide entre ‖a₁‖." }], sameMatrix),
      hints: ["Producto escalar de q₁ con a₂: multiplica por parejas y suma."],
      okText: `Bien: r₁₂ = ${fracText(q.r12)}.`,
    },
    {
      kind: "numbers",
      title: "u₂ = a₂ − r₁₂·q₁",
      name: "u₂",
      expected: row(q.u2),
      mistakes: cleanMistakes(row(q.u2), [
        { value: row(q.a2.map((x, i) => add(x, mul(q.r12, q.q1[i]!)))), text: "Se resta la proyección sobre q₁, no se suma." },
        { value: row(q.a2.map((x, i) => sub(x, mul(unnorm, q.q1[i]!)))), text: "La proyección es r₁₂·q₁ con r₁₂ = q₁·a₂ (no a₁·a₂)." },
      ], sameMatrix),
      diagnose: (t) => (equals(dotF(t[0]!, q.q1), ZERO) ? null : "Tu u₂ no es perpendicular a q₁: comprueba u₂·q₁ = 0."),
      hints: ["A a₂ se le quita su parte en la dirección de q₁; lo que queda es perpendicular a q₁ (u₂·q₁ = 0)."],
      okText: "Bien: u₂ es perpendicular a q₁.",
    },
    {
      kind: "numbers",
      title: "r₂₂ = ‖u₂‖",
      name: "r₂₂",
      expected: one(q.r22!),
      mistakes: cleanMistakes(one(q.r22!), [{ value: one(dotF(q.u2, q.u2)), text: "Eso es ‖u₂‖²: falta la raíz." }, { value: one(neg(q.r22!)), text: "La norma es positiva: r₂₂ > 0." }], sameMatrix),
      hints: ["La norma de u₂: raíz de la suma de los cuadrados."],
      okText: `Bien: r₂₂ = ${fracText(q.r22!)}.`,
    },
    {
      kind: "numbers",
      title: "q₂ = u₂ / r₂₂",
      name: "q₂",
      expected: row(q.q2!),
      mistakes: cleanMistakes(row(q.q2!), [{ value: row(q.q2!.map(neg)), text: "Con r₂₂ > 0, q₂ tiene el mismo sentido que u₂." }], sameMatrix),
      diagnose: (t) => (equals(dotF(t[0]!, t[0]!), int(1)) ? null : "Tu q₂ no mide 1."),
      hints: ["Divide u₂ entre r₂₂. Q tiene q₁ y q₂ en columnas y R = (r₁₁ r₁₂; 0 r₂₂)."],
      okText: "Bien: Q·R = A.",
    },
  ];
  const Q: Matrix = q.q1.map((x, i) => [x, q.q2![i]!]);
  const R: Matrix = [
    [q.r11, q.r12],
    [ZERO, q.r22!],
  ];
  return {
    statement: {
      blocks: [
        { kind: "p", text: `Factoriza A = Q·R por Gram-Schmidt: Q con columnas ortonormales (${m} × 2) y R triangular superior con diagonal positiva.` },
        { kind: "tex", tex: `A = ${matrixTex(A)}`, label: `A = ${matText(A)}, con columnas a₁ = ${vecText(q.a1)} y a₂ = ${vecText(q.a2)}` },
      ],
      ask: "Calcula r₁₁, q₁, r₁₂, u₂, r₂₂ y q₂.",
    },
    steps,
    solution: [
      `r₁₁ = ‖a₁‖ = ${fracText(q.r11)}, q₁ = ${vecText(q.q1)}.`,
      `r₁₂ = q₁·a₂ = ${fracText(q.r12)}, u₂ = a₂ − r₁₂q₁ = ${vecText(q.u2)}.`,
      `r₂₂ = ‖u₂‖ = ${fracText(q.r22!)}, q₂ = ${vecText(q.q2!)}.`,
      `Q = ${matText(Q)}, R = ${matText(R)}; Q·R = ${matText(matrixProduct(Q, R))} = A.`,
      ...(m === 2 ? [`Comprobación: r₁₁·r₂₂ = ${fracText(mul(q.r11, q.r22!))} = |det A|.`] : []),
    ],
  };
}

// ================================================================ Valores singulares

export type SvdInstance = { A: Ints };

/** Autovalores (exactos, enteros) de la matriz 2 × 2 simétrica más pequeña de AᵀA y AAᵀ, de mayor a menor. */
export function svdOf(inst: SvdInstance) {
  const A = intMatrix(inst.A);
  const At = matrixTranspose(A);
  const useAAt = A.length < A[0]!.length;
  const G = useAAt ? matrixProduct(A, At) : matrixProduct(At, A);
  const t = add(G[0]![0]!, G[1]![1]!);
  const d = matrixDeterminant(G);
  const disc = sub(mul(t, t), mul(int(4), d));
  const r = fracSqrt(disc);
  if (!r) return null;
  const l1 = div(add(t, r), int(2));
  const l2 = div(sub(t, r), int(2));
  const s1 = fracSqrt(l1);
  const s2 = fracSqrt(l2);
  if (!s1 || !s2) return null;
  return { A, G, useAAt, lambdas: [l1, l2], sigmas: [s1, s2] };
}

function makeSvd(rng: Rng, level: ExerciseLevel): SvdInstance {
  if (level === "avanzado" && rng.chance(0.5)) {
    const tall = rng.chance(0.5);
    const M = Array.from({ length: 3 }, () => [rng.int(-4, 4), rng.int(-4, 4)]);
    return { A: tall ? M : matrixTranspose(intMatrix(M)).map((r) => r.map((x) => Number(x.n))) };
  }
  const R = level === "básico" ? 5 : 6;
  return { A: [[rng.int(-R, R), rng.int(-R, R)], [rng.int(-R, R), rng.int(-R, R)]] };
}

export const LINALG_SVD: ExerciseType<SvdInstance> = {
  id: "algebra-svd",
  topic: "algebra-lineal",
  title: "Valores singulares",
  description: "Calcula AᵀA (o AAᵀ si es más pequeña), sus autovalores λ y los valores singulares σ = √λ de mayor a menor; comprueba que σ₁² + σ₂² es la suma de los cuadrados de A.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-svd", seed),
      (r) => makeSvd(r, level),
      (inst) => {
        const s = svdOf(inst);
        if (!s) return false;
        const [s1, s2] = s.sigmas;
        if (s1!.d !== 1n || s2!.d !== 1n || s2!.n === 0n || equals(s1!, s2!)) return false;
        if (inst.A.flat().filter((x) => x === 0).length > (level === "avanzado" ? 2 : 1)) return false;
        // En medio y avanzado, que AᵀA no sea ya diagonal.
        return level === "básico" || s.G[0]![1]!.n !== 0n;
      },
    );
  },
};

export function svdGuided(inst: SvdInstance): GuidedExercise {
  const s = svdOf(inst)!;
  const { A, G, useAAt, lambdas, sigmas } = s;
  const gName = useAAt ? "A·Aᵀ" : "Aᵀ·A";
  const other = useAAt ? matrixProduct(matrixTranspose(A), A) : matrixProduct(A, matrixTranspose(A));
  const frob = A.flat().reduce((acc, x) => add(acc, mul(x, x)), ZERO);
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: `${gName} (la más pequeña de AᵀA y AAᵀ)`,
      name: gName,
      expected: G,
      mistakes: cleanMistakes(G, [
        other.length === G.length ? { value: other, text: useAAt ? "Ese es Aᵀ·A; aquí se pide A·Aᵀ." : "Ese es A·Aᵀ; aquí se pide Aᵀ·A (tienen los mismos autovalores no nulos, pero no son la misma matriz)." } : null,
        A.length === A[0]!.length ? { value: matrixProduct(A, A), text: "Es Aᵀ·A, con la traspuesta, no A·A." } : null,
      ], sameMatrix),
      hints: ["(AᵀA)ᵢⱼ es el producto escalar de la columna i de A con la columna j. Sale simétrica."],
      okText: `Bien: ${gName} = ${matText(G)}.`,
    },
    {
      kind: "numbers",
      title: `Autovalores de ${gName}, de mayor a menor`,
      name: "(λ₁, λ₂)",
      expected: row(lambdas),
      mistakes: cleanMistakes(row(lambdas), [{ value: row([lambdas[1]!, lambdas[0]!]), text: "De mayor a menor." }], sameMatrix),
      diagnose: (t) => (equals(add(t[0]![0]!, t[0]![1]!), add(G[0]![0]!, G[1]![1]!)) ? null : `Tus λ no suman la traza de ${gName}.`),
      hints: [`λ² − (traza)·λ + det = 0, con la traza y el determinante de ${gName}.`],
      okText: "Bien: esos son los autovalores.",
    },
    {
      kind: "numbers",
      title: "Valores singulares σ₁ ≥ σ₂",
      name: "(σ₁, σ₂)",
      expected: row(sigmas),
      mistakes: cleanMistakes(row(sigmas), [
        { value: row(lambdas), text: "Esos son los autovalores λ: los valores singulares son sus raíces, σ = √λ." },
        { value: row([sigmas[1]!, sigmas[0]!]), text: "Se escriben de mayor a menor: σ₁ ≥ σ₂." },
      ], sameMatrix),
      diagnose: (t) => (equals(add(mul(t[0]![0]!, t[0]![0]!), mul(t[0]![1]!, t[0]![1]!)), frob) ? null : "Tus σ no cumplen σ₁² + σ₂² = suma de los cuadrados de las entradas de A."),
      hints: ["σᵢ = √λᵢ, de mayor a menor.", "Comprueba: σ₁² + σ₂² es la suma de los cuadrados de todas las entradas de A."],
      okText: "Bien: esos son los valores singulares.",
    },
  ];
  const sq = A.length === A[0]!.length;
  return {
    statement: {
      blocks: [{ kind: "tex", tex: `A = ${matrixTex(A)}`, label: `A = ${matText(A)}` }],
      ask: `Calcula ${gName}, sus autovalores y los valores singulares de A.`,
    },
    steps,
    solution: [
      `${gName} = ${matText(G)}: traza ${fracText(add(G[0]![0]!, G[1]![1]!))}, determinante ${fracText(matrixDeterminant(G))}.`,
      `λ² − ${fracText(add(G[0]![0]!, G[1]![1]!))}λ + ${fracText(matrixDeterminant(G))} = 0 ⇒ λ₁ = ${fracText(lambdas[0]!)}, λ₂ = ${fracText(lambdas[1]!)}.`,
      `σ₁ = √${fracText(lambdas[0]!)} = ${fracText(sigmas[0]!)}, σ₂ = √${fracText(lambdas[1]!)} = ${fracText(sigmas[1]!)}.`,
      `Comprobación: σ₁² + σ₂² = ${fracText(frob)} (suma de los cuadrados de A)${sq ? ` y σ₁·σ₂ = ${fracText(mul(sigmas[0]!, sigmas[1]!))} = |det A|` : ""}.`,
    ],
  };
}

// ================================================================ Matriz de una aplicación lineal

export type LinearMapInstance =
  | { kind: "formula"; M: Ints; v: number[] }
  | { kind: "base"; b1: number[]; b2: number[]; t1: number[]; t2: number[]; v: number[] };

const VARS = ["x", "y", "z"] as const;

/** «2x − y + 3z» a partir de los coeficientes. */
export function linearText(coefs: readonly number[]): string {
  let out = "";
  coefs.forEach((c, j) => {
    if (c === 0) return;
    const body = `${Math.abs(c) === 1 ? "" : Math.abs(c)}${VARS[j]}`;
    out += out === "" ? (c < 0 ? `−${body}` : body) : c < 0 ? ` − ${body}` : ` + ${body}`;
  });
  return out === "" ? "0" : out;
}

export function linearMapMatrix(inst: LinearMapInstance): Matrix {
  if (inst.kind === "formula") return intMatrix(inst.M);
  const B = intMatrix([[inst.b1[0]!, inst.b2[0]!], [inst.b1[1]!, inst.b2[1]!]]);
  const TB = intMatrix(inst.t1.map((x, i) => [x, inst.t2[i]!]));
  return matrixProduct(TB, matrixInverse(B)!.inverse);
}

function makeLinearMap(rng: Rng, level: ExerciseLevel): LinearMapInstance {
  const coefs = (n: number) => Array.from({ length: n }, () => rng.int(-3, 3));
  if (level === "básico") return { kind: "formula", M: [coefs(2), coefs(2)], v: [rng.int(-3, 3), rng.int(-3, 3)] };
  if (level === "medio") {
    const [m, n] = rng.pick([[2, 3], [3, 3], [3, 2]] as Array<[number, number]>);
    return { kind: "formula", M: Array.from({ length: m }, () => coefs(n)), v: Array.from({ length: n }, () => rng.int(-3, 3)) };
  }
  const B = unimodular(rng, 2, rng.int(1, 3));
  const m = rng.pick([2, 3]);
  const M = Array.from({ length: m }, () => coefs(2));
  const t1 = M.map((r) => r[0]! * B[0]![0]! + r[1]! * B[1]![0]!);
  const t2 = M.map((r) => r[0]! * B[0]![1]! + r[1]! * B[1]![1]!);
  return { kind: "base", b1: [B[0]![0]!, B[1]![0]!], b2: [B[0]![1]!, B[1]![1]!], t1, t2, v: [rng.int(-3, 3), rng.int(-3, 3)] };
}

export const LINALG_LINEAR_MAP: ExerciseType<LinearMapInstance> = {
  id: "algebra-aplicacion-lineal",
  topic: "algebra-lineal",
  title: "Matriz de una aplicación lineal",
  description: "Escribe la matriz de T: sus columnas son T(e₁), T(e₂)… (en avanzado, a partir de las imágenes de otra base) y úsala para calcular T(v) = A·v.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-aplicacion-lineal", seed),
      (r) => makeLinearMap(r, level),
      (inst) => {
        const A = linearMapMatrix(inst);
        if (!isInt(A) || maxAbs(A) > 6) return false;
        if (A.some((r) => r.every((x) => x.n === 0n))) return false;
        if (A.flat().filter((x) => x.n === 0n).length > Math.floor(A.flat().length / 3)) return false;
        if (inst.v.every((x) => x === 0)) return false;
        if (inst.kind === "base") {
          // Que la base no sea la canónica.
          const canon = (inst.b1[0] === 1 && inst.b1[1] === 0 && inst.b2[0] === 0 && inst.b2[1] === 1) || (inst.b1[0] === 0 && inst.b1[1] === 1);
          return !canon && [...inst.t1, ...inst.t2].every((x) => Math.abs(x) <= 15);
        }
        return true;
      },
    );
  },
};

export function linearMapGuided(inst: LinearMapInstance): GuidedExercise {
  const A = linearMapMatrix(inst);
  const n = A[0]!.length;
  const v = inst.v.map(int);
  const Av = matrixVector(A, v);
  const blocks: GuidedExercise["statement"]["blocks"] = [];
  const steps: GuidedStep[] = [];
  const argsText = VARS.slice(0, n).join(", ");
  if (inst.kind === "formula") {
    const comps = inst.M.map(linearText);
    blocks.push({ kind: "p", text: `T: ℝ${"²³"[n - 2]} → ℝ${"²³"[inst.M.length - 2]} es la aplicación lineal T(${argsText}) = (${comps.join(", ")}).` });
    blocks.push({ kind: "p", text: `v = (${inst.v.join(", ")})`.replace(/-/g, "−") });
  } else {
    const t = (w: number[]) => `(${w.join(", ")})`.replace(/-/g, "−");
    blocks.push({ kind: "p", text: `T: ℝ² → ℝ${"²³"[inst.t1.length - 2]} es lineal y en la base B = {b₁, b₂}, con b₁ = ${t(inst.b1)} y b₂ = ${t(inst.b2)}, cumple T(b₁) = ${t(inst.t1)} y T(b₂) = ${t(inst.t2)}.` });
    blocks.push({ kind: "p", text: `v = ${t(inst.v)}` });
    const B = intMatrix([[inst.b1[0]!, inst.b2[0]!], [inst.b1[1]!, inst.b2[1]!]]);
    const Binv = matrixInverse(B)!.inverse;
    const TB = intMatrix(inst.t1.map((x, i) => [x, inst.t2[i]!]));
    steps.push({
      kind: "numbers",
      title: "B⁻¹ (b₁ y b₂ en columnas en B)",
      name: "B⁻¹",
      expected: Binv,
      mistakes: cleanMistakes(Binv, [{ value: matrixTranspose(B), text: "Trasponer no es invertir: comprueba B·B⁻¹ = I." }], sameMatrix),
      hints: ["B tiene b₁ y b₂ en columnas. En 2 × 2: intercambia la diagonal, cambia el signo de los otros dos y divide entre det B."],
      okText: "Bien: esa es B⁻¹.",
    });
    steps.push({
      kind: "numbers",
      title: "Matriz A de T en la base canónica",
      name: "A",
      expected: A,
      mistakes: cleanMistakes(A, [
        { value: TB, text: "Esa matriz tiene en columnas T(b₁) y T(b₂): transforma coordenadas en B, no en la canónica. Falta multiplicar por B⁻¹ a la derecha." },
        TB.length === 2 ? { value: matrixProduct(Binv, TB), text: "El orden importa: A = (T(b₁) T(b₂))·B⁻¹." } : null,
      ], sameMatrix),
      diagnose: (t) => (sameMatrix(matrixProduct(t, B), TB) ? null : "Con tu A, A·b₁ y A·b₂ no dan T(b₁) y T(b₂)."),
      hints: ["A·B = (T(b₁) T(b₂)): las columnas de A·B son las imágenes de la base. Despeja A = (T(b₁) T(b₂))·B⁻¹.", "Comprueba que A·b₁ = T(b₁)."],
      okText: "Bien: esa es la matriz de T en la canónica.",
    });
  }
  if (inst.kind === "formula") {
    steps.push({
      kind: "numbers",
      title: `Matriz A de T (${A.length} × ${n})`,
      name: "A",
      expected: A,
      mistakes: cleanMistakes(A, [A.length === n ? { value: matrixTranspose(A), text: "Las imágenes T(e₁), T(e₂)… van en columnas, no en filas." } : null], sameMatrix),
      hints: ["La columna j de A es T(eⱼ): sustituye la variable j por 1 y las demás por 0.", "Fila i de A: los coeficientes de la componente i de T."],
      okText: "Bien: esa es la matriz de T.",
    });
  }
  steps.push({
    kind: "numbers",
    title: "T(v) = A·v",
    name: "T(v)",
    expected: row(Av),
    mistakes: cleanMistakes(row(Av), [A.length === n ? { value: row(matrixVector(matrixTranspose(A), v)), text: "Has multiplicado por columnas en vez de por filas: (A·v)ᵢ es la fila i de A por v." } : null], sameMatrix),
    hints: ["(A·v)ᵢ es el producto de la fila i de A por v. Compruébalo con la fórmula de T."],
    okText: "Bien: ese es T(v).",
  });
  return {
    statement: { blocks, ask: "Escribe la matriz de T en la base canónica y calcula T(v)." },
    steps,
    solution: [
      ...(inst.kind === "base" ? [`B = (b₁ b₂), A = (T(b₁) T(b₂))·B⁻¹.`] : [`Columnas: ${VARS.slice(0, n).map((_, j) => `T(e${"₁₂₃"[j]}) = ${vecText(A.map((r) => r[j]!))}`).join(", ")}.`]),
      `A = ${matText(A)}.`,
      `T(v) = A·v = ${vecText(Av)}.`,
    ],
  };
}

export const FACTORIZATION_EXERCISES = [LINALG_LU, LINALG_CHOLESKY, LINALG_QR, LINALG_SVD, LINALG_LINEAR_MAP] as const;

/** Para los tests: el producto Q·R y L·U (comprobaciones). */
export const qrProduct = (inst: QrInstance) => {
  const q = qrOf(inst);
  const Q: Matrix = q.q1.map((x, i) => [x, q.q2![i]!]);
  return matrixProduct(Q, [
    [q.r11, q.r12],
    [ZERO, q.r22!],
  ]);
};
