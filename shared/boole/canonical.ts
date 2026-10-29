// Formas canónicas en la notación del laboratorio de Boole: la lista de mintérminos Σm(…), la de
// maxtérminos ΠM(…) y las expresiones canónicas con ⊕, ⊙ y ′. También lee las listas de índices que
// escribe el estudiante y comprueba si una expresión tiene forma canónica (sin decir cuál es).
//
// Una función de n variables se guarda como su vector: una cadena de 2ⁿ caracteres 0, 1 o X
// (indiferencia), con las filas en orden 0…0, 0…1, …, 1…1 y la primera variable como bit alto. El
// carácter i es el valor en la fila i: el índice del mintérmino mᵢ y del maxtérmino Mᵢ.
import { bconst, bnot, bvar, evalBoole, type BExpr } from "./expr.ts";

/** Vector de una función: 0, 1 o X (indiferencia) en cada fila. */
export type BooleVector = string;

export const isBooleVector = (v: unknown, n: number): v is BooleVector =>
  typeof v === "string" && v.length === 1 << n && /^[01X]+$/.test(v);

/** Valores de las variables en la fila m (la primera variable es el bit alto). */
export const rowValues = (n: number, m: number): boolean[] =>
  Array.from({ length: n }, (_, i) => ((m >> (n - 1 - i)) & 1) === 1);

/** Bits de la fila m: «101» para m = 5 con tres variables. */
export const rowBits = (n: number, m: number): string => rowValues(n, m).map((b) => (b ? "1" : "0")).join("");

/** Vector de verdad de una expresión en las variables dadas (sin X). */
export function booleVector(e: BExpr, vars: string[]): BooleVector {
  const n = vars.length;
  return Array.from({ length: 1 << n }, (_, m) => {
    const vals = rowValues(n, m);
    return evalBoole(e, Object.fromEntries(vars.map((v, i) => [v, vals[i]!]))) ? "1" : "0";
  }).join("");
}

const indicesOf = (v: BooleVector, c: string) => [...v].flatMap((x, i) => (x === c ? [i] : []));
/** Índices de los 1: los de Σm. */
export const vectorOnes = (v: BooleVector) => indicesOf(v, "1");
/** Índices de los 0: los de ΠM. */
export const vectorZeros = (v: BooleVector) => indicesOf(v, "0");
/** Índices de las X: las indiferencias, d(…). */
export const vectorDontCares = (v: BooleVector) => indicesOf(v, "X");

/** Vector a partir de las listas de 1 y de X; el resto, 0. */
export function vectorFromLists(n: number, ones: number[], dontCares: number[] = []): BooleVector {
  return Array.from({ length: 1 << n }, (_, m) => (ones.includes(m) ? "1" : dontCares.includes(m) ? "X" : "0")).join("");
}

/** Mintérmino mᵢ: el producto de las n variables, con ′ en las que valen 0 en la fila i. */
export function mintermProduct(vars: string[], m: number): BExpr {
  const vals = rowValues(vars.length, m);
  return { k: "and", args: vars.map((v, i) => (vals[i] ? bvar(v) : bnot(bvar(v)))) };
}

/** Maxtérmino Mᵢ: la suma de las n variables, con ′ en las que valen 1 en la fila i. */
export function maxtermSum(vars: string[], m: number): BExpr {
  const vals = rowValues(vars.length, m);
  return { k: "or", args: vars.map((v, i) => (vals[i] ? bnot(bvar(v)) : bvar(v))) };
}

// Las formas canónicas no pasan por normalizeBoole: así conservan el orden de los índices.
const joinTerms = (k: "or" | "and", args: BExpr[], empty: 0 | 1): BExpr =>
  args.length === 0 ? bconst(empty) : args.length === 1 ? args[0]! : { k, args };

/** Suma de mintérminos (forma canónica disyuntiva), en orden de índice. Sin mintérminos es 0. */
export const canonicalSum = (vars: string[], minterms: number[]): BExpr =>
  joinTerms("or", [...minterms].sort((a, b) => a - b).map((m) => mintermProduct(vars, m)), 0);

/** Producto de maxtérminos (forma canónica conjuntiva), en orden de índice. Sin maxtérminos es 1. */
export const canonicalProduct = (vars: string[], maxterms: number[]): BExpr =>
  joinTerms("and", [...maxterms].sort((a, b) => a - b).map((m) => maxtermSum(vars, m)), 1);

/** «Σm(1, 3, 5)», «ΠM(0, 2)» y, si hay indiferencias, «Σm(1, 3) + d(5)» o «ΠM(0) · d(5)». */
export function indexListText(kind: "sop" | "pos", indices: number[], dontCares: number[] = []): string {
  const list = (xs: number[]) => [...xs].sort((a, b) => a - b).join(", ");
  const main = kind === "sop" ? `Σm(${list(indices)})` : `ΠM(${list(indices)})`;
  if (dontCares.length === 0) return main;
  return `${main} ${kind === "sop" ? "+" : "·"} d(${list(dontCares)})`;
}

export type IndexListRead = { ok: true; indices: number[] } | { ok: false; message: string };

/**
 * Lee una lista de índices tal y como la escribe el estudiante: «Σm(1, 3, 5)», «ΠM(0;2)», «1 3 5» o
 * «m1 + m3». Se ignoran Σ, Π, m, M y los paréntesis; los índices van de 0 a 2ⁿ − 1, sin repetirse.
 * Una lista vacía («Σm()») es válida: es la de f = 0 (o la ΠM de f = 1).
 */
export function readIndexList(input: string, n: number): IndexListRead {
  const max = (1 << n) - 1;
  const cleaned = input
    .replace(/^\s*(?:[Σ∑Π∏]|sum|prod)/i, "")
    .replace(/[mM]/g, " ")
    .replace(/[(){}[\]]/g, " ");
  const tokens = cleaned.split(/[\s,;+·.]+/).filter((t) => t !== "");
  const seen = new Set<number>();
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) {
      return { ok: false, message: `«${t.slice(0, 12)}» no es un índice: escribe números separados por comas, por ejemplo 1, 3, 5.` };
    }
    const k = Number(t);
    if (k > max) return { ok: false, message: `El ${k} no existe: con ${n} variables, los índices van de 0 a ${max}.` };
    if (seen.has(k)) return { ok: false, message: `El ${k} aparece dos veces.` };
    seen.add(k);
  }
  return { ok: true, indices: [...seen].sort((a, b) => a - b) };
}

export type IndexListCheck = {
  ok: boolean;
  /** Índices escritos que no van en la lista y no son indiferencias. */
  extra: number[];
  /** Índices escritos que son indiferencias (X): no van ni en Σm ni en ΠM. */
  dontCares: number[];
  /** Cuántos faltan (sin decir cuáles). */
  missing: number;
};

/** Compara la lista del estudiante con la correcta. */
export function compareIndexList(given: number[], expected: number[], dontCares: number[] = []): IndexListCheck {
  const want = new Set(expected);
  const dc = new Set(dontCares);
  const extra = given.filter((k) => !want.has(k) && !dc.has(k));
  const xs = given.filter((k) => dc.has(k) && !want.has(k));
  const missing = expected.filter((k) => !given.includes(k)).length;
  return { ok: extra.length === 0 && xs.length === 0 && missing === 0, extra, dontCares: xs, missing };
}

export type CanonicalShape =
  | { ok: true; indices: number[] }
  | { ok: false; reason: "not-two-level" | "incomplete-term" | "repeated-term" };

/**
 * ¿Tiene la expresión forma canónica? Para «sop», una suma de productos en los que aparece cada
 * variable exactamente una vez (mintérminos); para «pos», un producto de sumas así (maxtérminos).
 * Devuelve los índices de sus términos. 0 es la suma vacía y 1 el producto vacío.
 */
export function canonicalShape(e: BExpr, vars: string[], kind: "sop" | "pos"): CanonicalShape {
  const outer = kind === "sop" ? "or" : "and";
  const inner = kind === "sop" ? "and" : "or";
  if (e.k === "const" && e.v === (kind === "sop" ? 0 : 1)) return { ok: true, indices: [] };
  const terms = e.k === outer ? e.args : [e];
  const n = vars.length;
  const indices: number[] = [];
  for (const t of terms) {
    const lits = t.k === inner ? t.args : [t];
    let index = 0;
    const used = new Set<string>();
    for (const l of lits) {
      const v = l.k === "var" ? l : l.k === "not" && l.a.k === "var" ? l.a : null;
      if (!v) return { ok: false, reason: "not-two-level" };
      const i = vars.indexOf(v.name);
      if (i < 0 || used.has(v.name)) return { ok: false, reason: "incomplete-term" };
      used.add(v.name);
      // Mintérmino: bit 1 si la variable va sin ′. Maxtérmino: bit 1 si va con ′.
      const bit = (l.k === "var") === (kind === "sop");
      if (bit) index |= 1 << (n - 1 - i);
    }
    if (used.size !== n) return { ok: false, reason: "incomplete-term" };
    if (indices.includes(index)) return { ok: false, reason: "repeated-term" };
    indices.push(index);
  }
  return { ok: true, indices: indices.sort((a, b) => a - b) };
}
