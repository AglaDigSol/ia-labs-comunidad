// Operaciones elementales por filas y Gauss-Jordan: forma escalonada reducida (con la lista de
// operaciones que llevan a ella), rango, inversa y la corrección de los pasos que hace el estudiante
// (una operación elegida o la matriz siguiente escrita a mano). Las pistas dicen qué regla toca y en
// qué columna, nunca el resultado.
import { add, div, equals, isZero, mul, neg, ONE, type Frac } from "../rational.ts";
import {
  fracTex,
  fracText,
  identityMatrix,
  matrixCols,
  matrixEquals,
  sameShape,
  vectorEquals,
  type Matrix,
} from "./matrix.ts";

/** Fᵢ ↔ Fⱼ, Fᵢ ← k·Fᵢ y Fᵢ ← Fᵢ + k·Fⱼ. Filas desde 0. */
export type RowOp =
  | { k: "swap"; i: number; j: number }
  | { k: "scale"; i: number; c: Frac }
  | { k: "add"; i: number; j: number; c: Frac };

export type RowOpResult = { ok: true; value: Matrix } | { ok: false; error: string };

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (n: number) => [...String(n)].map((d) => SUB[Number(d)]).join("");
export const rowName = (i: number) => `F${subscript(i + 1)}`;

/** ¿Es una operación elemental válida en una matriz con `rows` filas? null si lo es; si no, por qué. */
export function rowOpError(op: RowOp, rows: number): string | null {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < rows;
  if (!inRange(op.i) || (op.k !== "scale" && !inRange(op.j))) return "Elige filas de la matriz.";
  if (op.k === "swap" && op.i === op.j) return "Para intercambiar, elige dos filas distintas.";
  if (op.k === "scale" && isZero(op.c)) return "k no puede ser 0: multiplicar una fila por 0 borra una ecuación y no es una operación elemental.";
  if (op.k === "add" && op.i === op.j) return "En Fᵢ ← Fᵢ + k·Fⱼ las dos filas tienen que ser distintas.";
  if (op.k === "add" && isZero(op.c)) return "Con k = 0 la matriz no cambia: elige otro k.";
  return null;
}

export function applyRowOp(M: Matrix, op: RowOp): RowOpResult {
  const error = rowOpError(op, M.length);
  if (error) return { ok: false, error };
  const out = M.map((r) => [...r]);
  if (op.k === "swap") [out[op.i], out[op.j]] = [out[op.j]!, out[op.i]!];
  else if (op.k === "scale") out[op.i] = out[op.i]!.map((x) => mul(op.c, x));
  else out[op.i] = out[op.i]!.map((x, c) => add(x, mul(op.c, M[op.j]![c]!)));
  return { ok: true, value: out };
}

/** Coeficiente delante de una fila: «2·», «(1/2)·», «(−3)·». */
const coefText = (c: Frac, parenNeg: boolean) => {
  const t = fracText(c);
  return c.d !== 1n || (parenNeg && c.n < 0n) ? `(${t})·` : `${t}·`;
};

/** «F₁ ↔ F₂», «F₂ ← (1/2)·F₂», «F₃ ← F₃ − 2·F₁». */
export function rowOpText(op: RowOp): string {
  if (op.k === "swap") return `${rowName(op.i)} ↔ ${rowName(op.j)}`;
  if (op.k === "scale") return `${rowName(op.i)} ← ${coefText(op.c, true)}${rowName(op.i)}`;
  const abs = op.c.n < 0n ? neg(op.c) : op.c;
  const k = equals(abs, ONE) ? "" : coefText(abs, false);
  return `${rowName(op.i)} ← ${rowName(op.i)} ${op.c.n < 0n ? "−" : "+"} ${k}${rowName(op.j)}`;
}

/** La misma operación en TeX: «F_{3} \leftarrow F_{3} - 2\,F_{1}». */
export function rowOpTex(op: RowOp): string {
  const F = (i: number) => `F_{${i + 1}}`;
  if (op.k === "swap") return `${F(op.i)} \\leftrightarrow ${F(op.j)}`;
  // Coeficiente delante de una fila: nada si es 1; entre paréntesis si es negativo (salvo −1).
  const coef = (c: Frac) => (equals(c, ONE) ? "" : equals(c, neg(ONE)) ? "-" : c.n < 0n ? `\\left(${fracTex(c)}\\right)` : `${fracTex(c)}\\,`);
  if (op.k === "scale") return `${F(op.i)} \\leftarrow ${coef(op.c)}${F(op.i)}`;
  const abs = op.c.n < 0n ? neg(op.c) : op.c;
  return `${F(op.i)} \\leftarrow ${F(op.i)} ${op.c.n < 0n ? "-" : "+"} ${coef(abs)}${F(op.j)}`;
}

/** Columna del primer elemento no nulo de una fila, o -1 si es toda ceros. */
export function leadingColumn(row: readonly Frac[], limit = row.length): number {
  for (let j = 0; j < limit; j++) if (!isZero(row[j]!)) return j;
  return -1;
}

/** Escalonada: cada fila empieza más a la derecha que la anterior y las filas nulas van al final. */
export function isRowEchelon(M: Matrix): boolean {
  let last = -1;
  let zeroSeen = false;
  for (const row of M) {
    const lead = leadingColumn(row);
    if (lead < 0) {
      zeroSeen = true;
      continue;
    }
    if (zeroSeen || lead <= last) return false;
    last = lead;
  }
  return true;
}

/** Escalonada reducida: además, cada pivote vale 1 y es el único no nulo de su columna. */
export function isRref(M: Matrix): boolean {
  if (!isRowEchelon(M)) return false;
  return M.every((row, i) => {
    const lead = leadingColumn(row);
    if (lead < 0) return true;
    return equals(row[lead]!, ONE) && M.every((other, k) => k === i || isZero(other[lead]!));
  });
}

export interface RrefResult {
  /** Forma escalonada reducida. */
  matrix: Matrix;
  /** Operaciones, en orden, que llevan de la matriz dada a la reducida. */
  ops: RowOp[];
  /** Matriz después de cada operación (misma longitud que ops). */
  steps: Matrix[];
  /** Columna de cada pivote, por filas. */
  pivots: number[];
}

/**
 * Gauss-Jordan, columna a columna. Como pivote elige, entre las filas que quedan, una con 1 o −1 si la
 * hay (menos fracciones al escribir los pasos) y si no la primera no nula. `cols` limita las columnas
 * en las que se buscan pivotes (por defecto, todas).
 */
export function rref(A: Matrix, cols = matrixCols(A)): RrefResult {
  let M = A.map((r) => [...r]);
  const ops: RowOp[] = [];
  const steps: Matrix[] = [];
  const pivots: number[] = [];
  const apply = (op: RowOp) => {
    const r = applyRowOp(M, op);
    if (!r.ok) throw new Error(r.error);
    M = r.value;
    ops.push(op);
    steps.push(M);
  };
  let r = 0;
  for (let c = 0; c < cols && r < M.length; c++) {
    let p = -1;
    for (let k = r; k < M.length; k++) {
      const x = M[k]![c]!;
      if (isZero(x)) continue;
      if (p < 0) p = k;
      if (x.d === 1n && (x.n === 1n || x.n === -1n)) {
        p = k;
        break;
      }
    }
    if (p < 0) continue;
    if (p !== r) apply({ k: "swap", i: r, j: p });
    const pv = M[r]![c]!;
    if (!equals(pv, ONE)) apply({ k: "scale", i: r, c: div(ONE, pv) });
    for (let k = 0; k < M.length; k++) {
      if (k === r || isZero(M[k]![c]!)) continue;
      apply({ k: "add", i: k, j: r, c: neg(M[k]![c]!) });
    }
    pivots.push(c);
    r++;
  }
  return { matrix: M, ops, steps, pivots };
}

export const matrixRank = (M: Matrix): number => (M.length === 0 ? 0 : rref(M).pivots.length);

/** Inversa por Gauss-Jordan sobre (A | I), o null si A no es invertible. */
export function matrixInverse(A: Matrix): { inverse: Matrix; ops: RowOp[]; steps: Matrix[] } | null {
  const n = A.length;
  if (n === 0 || A.some((r) => r.length !== n)) return null;
  const I = identityMatrix(n);
  const R = rref(
    A.map((r, i) => [...r, ...I[i]!]),
    n,
  );
  if (R.pivots.length < n) return null;
  return { inverse: R.matrix.map((r) => r.slice(n)), ops: R.ops, steps: R.steps };
}

// ---------------------------------------------------------------- Pistas y progreso

export type GaussHint =
  | { kind: "done" }
  | { kind: "swap"; row: number; col: number }
  | { kind: "scale"; row: number; col: number }
  | { kind: "eliminate"; row: number; col: number; targets: number[] };

/**
 * Qué toca ahora en Gauss-Jordan (sin decir con qué número): recorre las columnas como el algoritmo y
 * se para en la primera que no está terminada. `cols`: columnas en las que buscar pivotes.
 */
export function nextGaussHint(M: Matrix, cols = matrixCols(M)): GaussHint {
  let r = 0;
  for (let c = 0; c < cols && r < M.length; c++) {
    if (isZero(M[r]![c]!)) {
      const below = M.findIndex((row, k) => k > r && !isZero(row[c]!));
      if (below < 0) continue;
      return { kind: "swap", row: r, col: c };
    }
    if (!equals(M[r]![c]!, ONE)) return { kind: "scale", row: r, col: c };
    const targets = M.flatMap((row, k) => (k !== r && !isZero(row[c]!) ? [k] : []));
    if (targets.length > 0) return { kind: "eliminate", row: r, col: c, targets };
    r++;
  }
  return { kind: "done" };
}

/** La pista en palabras. Filas y columnas desde 1, como en clase. */
export function gaussHintText(h: GaussHint): string {
  const list = (xs: number[]) => xs.map(rowName).join(", ");
  switch (h.kind) {
    case "done":
      return "La matriz ya está en forma escalonada reducida.";
    case "swap":
      return `Busca un pivote en la columna ${h.col + 1}: ${rowName(h.row)} tiene un 0 ahí. Intercámbiala con una fila de debajo que no tenga 0 en esa columna.`;
    case "scale":
      return `Busca un pivote en la columna ${h.col + 1}: está en ${rowName(h.row)}. Haz que valga 1 multiplicando la fila por el inverso del pivote.`;
    case "eliminate":
      return `El pivote de la columna ${h.col + 1} ya vale 1 (en ${rowName(h.row)}). Haz ceros en el resto de la columna (${list(h.targets)}) con Fᵢ ← Fᵢ + k·${rowName(h.row)}, eligiendo k para anular cada elemento.`;
  }
}

/** Cuántas columnas pivote de la reducida ya están terminadas (columna unitaria en su fila). */
export function rrefProgress(M: Matrix, cols = matrixCols(M)): { done: number; total: number } {
  const target = rref(M, cols).pivots;
  let done = 0;
  target.forEach((c, r) => {
    if (M.every((row, k) => (k === r ? equals(row[c]!, ONE) : isZero(row[c]!)))) done++;
  });
  return { done, total: target.length };
}

// ---------------------------------------------------------------- Corrección de pasos

/** ¿Está la fila v en el espacio generado por las filas de M? */
export function inRowSpace(M: Matrix, v: readonly Frac[]): boolean {
  return matrixRank([...M, [...v]]) === matrixRank(M);
}

/** ¿Son equivalentes por filas (mismo tamaño y mismo espacio de filas)? */
export function rowEquivalent(A: Matrix, B: Matrix): boolean {
  if (!sameShape(A, B)) return false;
  const r = matrixRank(A);
  return matrixRank(B) === r && matrixRank([...A, ...B]) === r;
}

/** Si B sale de A con una sola operación elemental, cuál (la más sencilla); si no, null. */
export function detectRowOp(A: Matrix, B: Matrix): RowOp | null {
  if (!sameShape(A, B) || matrixEquals(A, B)) return null;
  const changed = A.flatMap((row, i) => (vectorEquals(row, B[i]!) ? [] : [i]));
  if (changed.length === 2) {
    const [i, j] = changed as [number, number];
    if (vectorEquals(A[i]!, B[j]!) && vectorEquals(A[j]!, B[i]!)) return { k: "swap", i, j };
    return null;
  }
  if (changed.length !== 1) return null;
  const i = changed[0]!;
  const a = A[i]!;
  const b = B[i]!;
  // ¿Múltiplo de la propia fila?
  const lead = leadingColumn(a);
  if (lead >= 0 && !isZero(b[lead]!)) {
    const c = div(b[lead]!, a[lead]!);
    if (a.every((x, k) => equals(mul(c, x), b[k]!))) return { k: "scale", i, c };
  }
  // ¿Fᵢ + k·Fⱼ?
  const diff = b.map((x, k) => add(x, neg(a[k]!)));
  for (let j = 0; j < A.length; j++) {
    if (j === i) continue;
    const row = A[j]!;
    const l = leadingColumn(row);
    if (l < 0) continue;
    const c = div(diff[l]!, row[l]!);
    if (isZero(c)) continue;
    if (row.every((x, k) => equals(mul(c, x), diff[k]!))) return { k: "add", i, j, c };
  }
  return null;
}

export type TypedStepCheck =
  | { kind: "same" }
  | { kind: "ok"; op: RowOp | null }
  | { kind: "bad"; badRows: number[]; lostRank: boolean };

/**
 * La matriz siguiente escrita a mano: vale si es equivalente por filas a la anterior (una operación o
 * varias a la vez). Si no, dice qué filas nuevas no son combinación de las anteriores, o si se ha
 * perdido rango (una fila multiplicada por 0, restada de sí misma…). Nunca dice el número correcto.
 */
export function checkTypedStep(prev: Matrix, next: Matrix): TypedStepCheck {
  if (matrixEquals(prev, next)) return { kind: "same" };
  if (rowEquivalent(prev, next)) return { kind: "ok", op: detectRowOp(prev, next) };
  const badRows = next.flatMap((row, i) => (vectorEquals(row, prev[i]!) || inRowSpace(prev, row) ? [] : [i]));
  return { kind: "bad", badRows, lostRank: badRows.length === 0 };
}

/** Celdas (i, j) de `typed` que no coinciden con el resultado de aplicar la operación. */
export function wrongCells(expected: Matrix, typed: (Frac | null)[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  expected.forEach((row, i) =>
    row.forEach((x, j) => {
      const t = typed[i]?.[j];
      if (t === null || t === undefined || !equals(t, x)) out.push([i, j]);
    }),
  );
  return out;
}
