// Matrices y vectores con racionales exactos (shared/rational.ts): tipos, lectura de lo que escribe el
// estudiante, operaciones básicas y formato (texto y TeX). Nada de coma flotante salvo para dibujar.
// Los nombres llevan «matrix»/«vector» para no chocar con los de Markov (Mat, matMul, transpose…), que
// también se exportan desde la entrada del paquete.
import { add, equals, formatFrac, frac, isZero, mul, neg, ONE, parseNumber, sub, ZERO, type Frac } from "../rational.ts";

export type Vector = Frac[];
/** Por filas: M[i][j] es la fila i, columna j (desde 0). Todas las filas tienen la misma longitud. */
export type Matrix = Frac[][];

/** Límites de lo que se puede escribir a mano (para practicar, no para calcular a lo grande). */
export const MAX_MATRIX_ROWS = 6;
export const MAX_MATRIX_COLS = 7;
export const MAX_MATRIX_TEXT = 600;
export const MAX_ENTRY_TEXT = 24;

export const ENTRY_ERROR = "Escribe un número: entero, fracción (3/4) o decimal (0,5 o 0.5).";

export type EntryResult = { ok: true; value: Frac } | { ok: false; error: string };

/** Un número escrito a mano: entero, fracción, decimal con coma o punto, con signo. Sin porcentajes. */
export function parseEntry(text: string): EntryResult {
  const t = text.trim();
  if (t.length === 0 || t.length > MAX_ENTRY_TEXT || t.includes("%")) return { ok: false, error: ENTRY_ERROR };
  // «+3» también vale.
  const r = parseNumber(t.startsWith("+") ? t.slice(1) : t);
  return r.ok ? r : { ok: false, error: ENTRY_ERROR };
}

export type MatrixParse =
  | { ok: true; value: Matrix }
  | { ok: false; error: string; row?: number; col?: number };

/** Separa una fila en números: espacios o tabuladores; «, » (coma y espacio) también separa. */
function splitRow(line: string): string[] {
  return line
    .replace(/[,;]\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((x) => x.length > 0);
}

/**
 * Lee una matriz: filas separadas por saltos de línea o por «;», números separados por espacios (la
 * coma pegada a cifras es la decimal: «0,5»). Admite corchetes o paréntesis alrededor, como en
 * «[[1, 2], [3, 4]]» o «(1 2; 3 4)».
 */
export function parseMatrix(text: string): MatrixParse {
  if (text.length > MAX_MATRIX_TEXT) return { ok: false, error: "La matriz es demasiado larga." };
  // Fuera corchetes y paréntesis: «[[1, 2], [3, 4]]» queda como dos filas.
  const cleaned = text.replace(/\]\s*,\s*\[/g, ";").replace(/[[\]()]/g, " ");
  const lines = cleaned
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { ok: false, error: "Escribe la matriz: una fila por línea (o separadas por ;)." };
  if (lines.length > MAX_MATRIX_ROWS) return { ok: false, error: `Como mucho ${MAX_MATRIX_ROWS} filas.` };
  const rows: Matrix = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitRow(lines[i]!);
    if (cells.length > MAX_MATRIX_COLS) return { ok: false, error: `Como mucho ${MAX_MATRIX_COLS} columnas.`, row: i };
    const row: Vector = [];
    for (let j = 0; j < cells.length; j++) {
      const r = parseEntry(cells[j]!);
      if (!r.ok) {
        const hint = /\d,\d.*,\d/.test(cells[j]!) ? " Separa los números con espacios: la coma es la de los decimales." : "";
        return { ok: false, error: `Fila ${i + 1}, columna ${j + 1}: «${cells[j]}» no es un número.${hint}`, row: i, col: j };
      }
      row.push(r.value);
    }
    if (i > 0 && row.length !== rows[0]!.length) {
      return { ok: false, error: `La fila ${i + 1} tiene ${row.length} números y la primera, ${rows[0]!.length}.`, row: i };
    }
    rows.push(row);
  }
  return { ok: true, value: rows };
}

/** Lee una celda de cada posición de una cuadrícula de texto (las vacías o mal escritas, null). */
export function parseGrid(cells: readonly (readonly string[])[]): (Frac | null)[][] {
  return cells.map((row) =>
    row.map((t) => {
      const r = parseEntry(t);
      return r.ok ? r.value : null;
    }),
  );
}

/** La cuadrícula completa, o null si falta algún número. */
export function gridMatrix(cells: readonly (readonly string[])[]): Matrix | null {
  const g = parseGrid(cells);
  return g.every((row) => row.every((x) => x !== null)) ? (g as Matrix) : null;
}

/** Desde enteros (para generadores, contenido y tests). */
export const intMatrix = (rows: readonly (readonly number[])[]): Matrix => rows.map((r) => r.map((x) => frac(BigInt(x))));
export const intVector = (xs: readonly number[]): Vector => xs.map((x) => frac(BigInt(x)));

export const matrixRows = (M: Matrix) => M.length;
export const matrixCols = (M: Matrix) => M[0]?.length ?? 0;
export const isSquareMatrix = (M: Matrix) => M.length > 0 && M.every((r) => r.length === M.length);
export const sameShape = (A: Matrix, B: Matrix) => A.length === B.length && A.every((r, i) => r.length === B[i]!.length);

export function zeroMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ZERO));
}

export function identityMatrix(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));
}

export const matrixEquals = (A: Matrix, B: Matrix) => sameShape(A, B) && A.every((r, i) => r.every((x, j) => equals(x, B[i]![j]!)));
export const vectorEquals = (u: Vector, v: Vector) => u.length === v.length && u.every((x, i) => equals(x, v[i]!));
export const isZeroVector = (v: Vector) => v.every(isZero);
export const isZeroMatrix = (M: Matrix) => M.every(isZeroVector);

export function matrixAdd(A: Matrix, B: Matrix): Matrix {
  if (!sameShape(A, B)) throw new RangeError("Las matrices no tienen la misma dimensión");
  return A.map((r, i) => r.map((x, j) => add(x, B[i]![j]!)));
}

export function matrixSub(A: Matrix, B: Matrix): Matrix {
  if (!sameShape(A, B)) throw new RangeError("Las matrices no tienen la misma dimensión");
  return A.map((r, i) => r.map((x, j) => sub(x, B[i]![j]!)));
}

export const matrixScale = (k: Frac, A: Matrix): Matrix => A.map((r) => r.map((x) => mul(k, x)));
export const vectorScale = (k: Frac, v: Vector): Vector => v.map((x) => mul(k, x));
export const vectorAdd = (u: Vector, v: Vector): Vector => u.map((x, i) => add(x, v[i]!));
export const vectorNeg = (v: Vector): Vector => v.map(neg);

export function dot(u: Vector, v: Vector): Frac {
  let acc = ZERO;
  for (let i = 0; i < u.length; i++) acc = add(acc, mul(u[i]!, v[i]!));
  return acc;
}

/** ¿Se pueden multiplicar? A (m×k) · B (k×n). */
export const canMultiply = (A: Matrix, B: Matrix) => matrixCols(A) === B.length;

export function matrixProduct(A: Matrix, B: Matrix): Matrix {
  if (!canMultiply(A, B)) throw new RangeError("Dimensiones incompatibles para el producto");
  const n = matrixCols(B);
  return A.map((row) => Array.from({ length: n }, (_, j) => row.reduce((acc, x, k) => add(acc, mul(x, B[k]![j]!)), ZERO)));
}

/** A · v con v como vector columna. */
export const matrixVector = (A: Matrix, v: Vector): Vector => A.map((row) => dot(row, v));

export function matrixTranspose(A: Matrix): Matrix {
  return Array.from({ length: matrixCols(A) }, (_, j) => A.map((row) => row[j]!));
}

export const column = (A: Matrix, j: number): Vector => A.map((r) => r[j]!);
/** Matriz cuyas columnas son los vectores dados. */
export const fromColumns = (vs: readonly Vector[]): Matrix => matrixTranspose(vs.map((v) => [...v]));

/** Matriz ampliada (A | b). */
export const augment = (A: Matrix, b: Vector): Matrix => A.map((r, i) => [...r, b[i]!]);

export const trace = (A: Matrix): Frac => A.reduce((acc, r, i) => add(acc, r[i]!), ZERO);

// ---------------------------------------------------------------- Formato

/** «−3/4», «5»: con el signo menos tipográfico. */
export const fracText = (x: Frac): string => formatFrac(x).replace(/^-/, "−");

/** Para escribir de vuelta en una celda (con «-» de teclado). */
export const fracInput = (x: Frac): string => formatFrac(x);

/** «-\frac{3}{4}», «5». Solo enteros: seguro para KaTeX. */
export function fracTex(x: Frac): string {
  if (x.d === 1n) return x.n.toString();
  const s = x.n < 0n ? "-" : "";
  const n = x.n < 0n ? -x.n : x.n;
  return `${s}\\frac{${n}}{${x.d}}`;
}

/**
 * Matriz en TeX, entre paréntesis como en clase. `bar` pone la raya de la matriz ampliada antes de
 * esa columna (por ejemplo, el número de incógnitas).
 */
export function matrixTex(M: Matrix, opts: { bar?: number; delim?: "paren" | "det" } = {}): string {
  const cols = matrixCols(M);
  const spec = Array.from({ length: cols }, (_, j) => (opts.bar !== undefined && j === opts.bar ? "|c" : "c")).join("");
  const body = M.map((r) => r.map(fracTex).join(" & ")).join(" \\\\ ");
  const [l, r] = opts.delim === "det" ? ["\\left|", "\\right|"] : ["\\left(", "\\right)"];
  return `${l}\\begin{array}{${spec}} ${body} \\end{array}${r}`;
}

/** Vector columna en TeX. */
export const vectorTex = (v: Vector): string => matrixTex(v.map((x) => [x]));

/** Texto para lectores de pantalla: «fila 1: 1, 2; fila 2: 3, 4». */
export const matrixLabel = (M: Matrix): string => M.map((r, i) => `fila ${i + 1}: ${r.map(fracText).join(", ")}`).join("; ");

/** «(1, −2, 3)». */
export const vectorText = (v: Vector): string => `(${v.map(fracText).join(", ")})`;

/** Texto editable de una matriz: una fila por línea, números separados por espacios. */
export const matrixInputText = (M: Matrix): string => M.map((r) => r.map(fracInput).join(" ")).join("\n");
