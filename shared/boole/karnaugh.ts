// Mapas de Karnaugh de 2, 3 y 4 variables. Las filas llevan las primeras variables y las columnas el
// resto (x | y; x | yz; wx | yz), las dos en código Gray: 0, 1 con un bit y 00, 01, 11, 10 con dos,
// de modo que dos celdas vecinas (también la primera y la última de una fila o de una columna) solo
// difieren en una variable. La celda de la fila r y la columna c es el mintérmino cuyo índice tiene
// el código de la fila como bits altos y el de la columna como bits bajos.
//
// Un grupo válido es un rectángulo de 1, 2, 4, 8 o 16 celdas que puede dar la vuelta por los bordes.
// Con el código Gray eso equivale a que sus mintérminos formen un subcubo: 2ᵏ celdas que coinciden en
// todas las variables salvo k. El término del grupo lleva las variables que no cambian.
import { bconst, band, bor, type BExpr } from "./expr.ts";
import type { BooleVector } from "./canonical.ts";
import { implicantProduct, implicantSum, minimumCover, primeImplicants, type Implicant } from "./minimize.ts";

export const KMAP_MIN_VARS = 2;
export const KMAP_MAX_VARS = 4;

/** «sop»: se agrupan los 1 (suma de productos); «pos»: se agrupan los 0 (producto de sumas). */
export type KMapMode = "sop" | "pos";

/** Código Gray de `bits` bits: [0, 1] o [0, 1, 3, 2]. */
export const grayCode = (bits: number): number[] => Array.from({ length: 1 << bits }, (_, i) => i ^ (i >> 1));

export type KMapLayout = {
  vars: string[];
  /** Variables de las filas y de las columnas. */
  rowVars: string[];
  colVars: string[];
  /** Código de cada fila y de cada columna, en orden Gray. */
  rowCodes: number[];
  colCodes: number[];
};

export function kmapLayout(vars: string[]): KMapLayout {
  const n = vars.length;
  if (n < KMAP_MIN_VARS || n > KMAP_MAX_VARS) throw new Error("karnaugh: entre 2 y 4 variables");
  const rowBits = n >> 1;
  return {
    vars,
    rowVars: vars.slice(0, rowBits),
    colVars: vars.slice(rowBits),
    rowCodes: grayCode(rowBits),
    colCodes: grayCode(n - rowBits),
  };
}

/** Mintérmino de la celda (fila, columna). */
export const kmapMinterm = (l: KMapLayout, row: number, col: number): number =>
  (l.rowCodes[row]! << l.colVars.length) | l.colCodes[col]!;

/** Fila y columna del mintérmino m. */
export function kmapPosition(l: KMapLayout, m: number): { row: number; col: number } {
  const cb = l.colVars.length;
  return { row: l.rowCodes.indexOf(m >> cb), col: l.colCodes.indexOf(m & ((1 << cb) - 1)) };
}

const bits = (code: number, width: number) => code.toString(2).padStart(width, "0");
/** Rótulo de la fila o la columna: «01». */
export const kmapRowLabel = (l: KMapLayout, row: number) => bits(l.rowCodes[row]!, l.rowVars.length);
export const kmapColLabel = (l: KMapLayout, col: number) => bits(l.colCodes[col]!, l.colVars.length);

const popcount = (x: number) => {
  let c = 0;
  for (let v = x; v; v &= v - 1) c++;
  return c;
};

/** Celdas (mintérminos) de un implicante, en orden creciente. */
export function implicantCells(n: number, imp: Implicant): number[] {
  return Array.from({ length: 1 << n }, (_, m) => m).filter((m) => (m & imp.care) === imp.value);
}

/** Lo que se agrupa en cada modo: los 1 en «sop» y los 0 en «pos». */
export const kmapTarget = (mode: KMapMode): "1" | "0" => (mode === "sop" ? "1" : "0");

export type KMapGroupIssue =
  /** Ninguna celda. */
  | "empty"
  /** El número de celdas no es una potencia de 2. */
  | "size"
  /** Las celdas no forman un rectángulo (ni dando la vuelta por los bordes). */
  | "shape"
  /** Incluye un 0 (en «sop») o un 1 (en «pos»): `cell` es el primero. */
  | "wrong-cell"
  /** Solo tiene X: no cubre nada que haga falta. */
  | "no-target";

export type KMapGroupRead = { ok: true; implicant: Implicant } | { ok: false; issue: KMapGroupIssue; cell?: number };

/** Valida un grupo de celdas sobre el vector de la función (0, 1 o X por mintérmino). */
export function readKMapGroup(vector: BooleVector, cells: number[], mode: KMapMode): KMapGroupRead {
  const set = [...new Set(cells)].sort((a, b) => a - b);
  const n = Math.log2(vector.length);
  if (set.length === 0) return { ok: false, issue: "empty" };
  if ((set.length & (set.length - 1)) !== 0) return { ok: false, issue: "size" };
  const full = (1 << n) - 1;
  const all = set.reduce((a, m) => a & m, full);
  const any = set.reduce((a, m) => a | m, 0);
  // Variables que cambian dentro del grupo: tiene que haber exactamente 2ᵏ celdas para k variables.
  const free = any & ~all;
  if (1 << popcount(free) !== set.length) return { ok: false, issue: "shape" };
  const avoid = mode === "sop" ? "0" : "1";
  const wrong = set.find((m) => vector[m] === avoid);
  if (wrong !== undefined) return { ok: false, issue: "wrong-cell", cell: wrong };
  if (!set.some((m) => vector[m] === kmapTarget(mode))) return { ok: false, issue: "no-target" };
  const care = full & ~free;
  return { ok: true, implicant: { care, value: all & care } };
}

/** Término de un grupo: el producto (grupo de 1) o la suma (grupo de 0) de las variables que no cambian. */
export const kmapTerm = (vars: string[], imp: Implicant, mode: KMapMode): BExpr =>
  mode === "sop" ? implicantProduct(vars, imp) : implicantSum(vars, imp);

/** Expresión de una agrupación: suma de los productos o producto de las sumas. */
export function kmapExpression(vars: string[], groups: Implicant[], mode: KMapMode): BExpr {
  if (groups.length === 0) return bconst(mode === "sop" ? 0 : 1);
  const terms = groups.map((g) => kmapTerm(vars, g, mode));
  return mode === "sop" ? bor(...terms) : band(...terms);
}

/** Número de literales de un grupo: las variables que no cambian. */
export const groupLiterals = (imp: Implicant) => popcount(imp.care);

const targetsOf = (vector: BooleVector, mode: KMapMode) =>
  [...vector].flatMap((c, m) => (c === kmapTarget(mode) ? [m] : []));
const dontCaresOf = (vector: BooleVector) => [...vector].flatMap((c, m) => (c === "X" ? [m] : []));
const inside = (imp: Implicant, m: number) => (m & imp.care) === imp.value;
/** ¿Contiene el implicante a al b (y es distinto)? */
const contains = (a: Implicant, b: Implicant) =>
  (a.care & b.care) === a.care && (b.value & a.care) === a.value && a.care !== b.care;

/**
 * Agrupación mínima: implicantes primos (con las X) y la cobertura de menos literales y, a igualdad,
 * menos grupos, como minimalSOP y minimalPOS. Ordenada de mayor a menor y por su primera celda.
 */
export function kmapSolution(vector: BooleVector, mode: KMapMode): Implicant[] {
  const n = Math.log2(vector.length);
  const targets = targetsOf(vector, mode);
  if (targets.length === 0) return [];
  const cover = minimumCover(targets, primeImplicants(n, [...targets, ...dontCaresOf(vector)]));
  const first = (imp: Implicant) => implicantCells(n, imp)[0]!;
  return [...cover].sort((a, b) => popcount(a.care) - popcount(b.care) || first(a) - first(b));
}

export type KMapCheck = {
  /** «incomplete»: faltan celdas por cubrir; «not-minimal»: hay una agrupación más simple. */
  status: "incomplete" | "not-minimal" | "minimal";
  /** Celdas que hay que cubrir (1 o 0) y ningún grupo cubre. */
  uncovered: number[];
  /** Grupos (índices en la lista) cuyas celdas ya cubren los demás. */
  redundant: number[];
  /** Grupos que caben dentro de uno mayor (no son implicantes primos). */
  enlargeable: number[];
  literals: number;
  terms: number;
  /** Coste de la agrupación mínima. */
  minimal: { literals: number; terms: number };
};

/** Comprueba una agrupación (grupos ya validados con readKMapGroup) frente a la mínima. */
export function checkKMapGroups(vector: BooleVector, groups: Implicant[], mode: KMapMode): KMapCheck {
  const n = Math.log2(vector.length);
  const targets = targetsOf(vector, mode);
  const uncovered = targets.filter((m) => !groups.some((g) => inside(g, m)));
  const redundant = groups.flatMap((g, i) => {
    const mine = targets.filter((m) => inside(g, m));
    const others = groups.filter((_, j) => j !== i);
    return mine.every((m) => others.some((o) => inside(o, m))) ? [i] : [];
  });
  const primes = targets.length === 0 ? [] : primeImplicants(n, [...targets, ...dontCaresOf(vector)]);
  const enlargeable = groups.flatMap((g, i) => (primes.some((p) => contains(p, g)) ? [i] : []));
  const literals = groups.reduce((s, g) => s + groupLiterals(g), 0);
  const solution = kmapSolution(vector, mode);
  const minimal = { literals: solution.reduce((s, g) => s + groupLiterals(g), 0), terms: solution.length };
  const status =
    uncovered.length > 0
      ? "incomplete"
      : literals > minimal.literals || (literals === minimal.literals && groups.length > minimal.terms)
        ? "not-minimal"
        : "minimal";
  return { status, uncovered, redundant, enlargeable, literals, terms: groups.length, minimal };
}
