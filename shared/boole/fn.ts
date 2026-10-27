// Espacios Fₙ: las funciones booleanas de n variables, {0, 1}ⁿ → {0, 1}, con las operaciones punto a
// punto (f ⊕ g)(v) = f(v) ⊕ g(v), (f ⊙ g)(v) = f(v) ⊙ g(v) y f′(v) = f(v)′. Cada función se guarda
// como su vector de verdad: una cadena de 2ⁿ bits con las filas en orden 0…0, 0…1, …, 1…1 (la primera
// variable es el bit alto). Para n = 1, «01» es la función con f(0) = 0 y f(1) = 1.
import { NOTATION } from "../../content/notation/index.ts";
import { compareFormulas } from "../logic/compare.ts";
import type { FiniteStructure } from "./algebra.ts";
import { booleToPlain, booleVars, evalBoole, toLogicNode, type BExpr } from "./expr.ts";
import { minimalSOP } from "./minimize.ts";

export type FnArity = 1 | 2;
export type TruthVector = string;

/** Variables de Fₙ: x para F₁; x, y para F₂. */
export const FN_VARS: Record<FnArity, string[]> = { 1: ["x"], 2: ["x", "y"] };

const rowsOf = (n: FnArity) => 1 << n;
/** Número de funciones de Fₙ: 2^(2ⁿ) (4 para n = 1, 16 para n = 2). */
export const fnCount = (n: FnArity) => 1 << rowsOf(n);

export const isTruthVector = (v: unknown, n: FnArity): v is TruthVector =>
  typeof v === "string" && v.length === rowsOf(n) && /^[01]+$/.test(v);

/** Todas las funciones de Fₙ, en orden binario creciente del vector de verdad. */
export function enumerateFn(n: FnArity): TruthVector[] {
  const r = rowsOf(n);
  return Array.from({ length: fnCount(n) }, (_, i) => i.toString(2).padStart(r, "0"));
}

const pointwise = (a: TruthVector, b: TruthVector, op: (x: boolean, y: boolean) => boolean): TruthVector => {
  if (a.length !== b.length) throw new Error("fn: vectores de distinta longitud");
  return [...a].map((c, i) => (op(c === "1", b[i] === "1") ? "1" : "0")).join("");
};

/** (f ⊕ g)(v) = f(v) ⊕ g(v). */
export const fnOr = (a: TruthVector, b: TruthVector) => pointwise(a, b, (x, y) => x || y);
/** (f ⊙ g)(v) = f(v) ⊙ g(v). */
export const fnAnd = (a: TruthVector, b: TruthVector) => pointwise(a, b, (x, y) => x && y);
/** f′(v) = f(v)′. */
export const fnComp = (a: TruthVector) => [...a].map((c) => (c === "1" ? "0" : "1")).join("");
export const fnZero = (n: FnArity) => "0".repeat(rowsOf(n));
export const fnOne = (n: FnArity) => "1".repeat(rowsOf(n));

/** Valores de las variables en cada fila (la primera variable es el bit alto). */
export function fnRows(n: FnArity): boolean[][] {
  const r = rowsOf(n);
  return Array.from({ length: r }, (_, m) => FN_VARS[n].map((_, i) => ((m >> (n - 1 - i)) & 1) === 1));
}

/** Vector de verdad de una expresión en las variables de Fₙ, o null si usa otras variables. */
export function fnFromExpr(e: BExpr, n: FnArity): TruthVector | null {
  const vars = FN_VARS[n];
  if (booleVars(e).some((v) => !vars.includes(v))) return null;
  return fnRows(n)
    .map((vals) => (evalBoole(e, Object.fromEntries(vars.map((v, i) => [v, vals[i]!]))) ? "1" : "0"))
    .join("");
}

/** Expresión canónica: la suma de productos mínima (Quine–McCluskey). */
export function fnExpression(v: TruthVector): BExpr {
  const n = (v.length === 2 ? 1 : 2) as FnArity;
  if (!isTruthVector(v, n)) throw new Error("fn: vector de verdad no válido");
  const minterms = [...v].flatMap((c, i) => (c === "1" ? [i] : []));
  return minimalSOP(FN_VARS[n], minterms).expr;
}

/** ¿Calcula la expresión la función v? Comparación por tabla de verdad. */
export function fnMatches(e: BExpr, v: TruthVector): boolean {
  const c = compareFormulas(toLogicNode(e), toLogicNode(fnExpression(v)));
  const n = (v.length === 2 ? 1 : 2) as FnArity;
  return c.ok && c.equivalent && booleVars(e).every((x) => FN_VARS[n].includes(x));
}

/** Nombres de F₁, tal y como los define content/notation (por ejemplo Id, f, g, h). */
export function f1Names(): Record<TruthVector, string> {
  return Object.fromEntries(NOTATION.f1.map((e) => [e.values.join(""), e.name]));
}

/** Nombres habituales de las 16 funciones de dos variables (filas xy = 00, 01, 10, 11). */
export const F2_NAMES: Record<TruthVector, string> = {
  "0000": "Constante 0",
  "0001": "AND (x ⊙ y)",
  "0010": "Negación de la implicación x → y",
  "0011": "Proyección x",
  "0100": "Negación de la implicación y → x",
  "0101": "Proyección y",
  "0110": "XOR (x ⊻ y)",
  "0111": "OR (x ⊕ y)",
  "1000": "NOR",
  "1001": "XNOR (equivalencia)",
  "1010": "Complemento de y (y′)",
  "1011": "Implicación y → x",
  "1100": "Complemento de x (x′)",
  "1101": "Implicación x → y",
  "1110": "NAND",
  "1111": "Constante 1",
};

/** Nombre de una función de F₁ o F₂. */
export function fnName(v: TruthVector): string | null {
  if (isTruthVector(v, 1)) return f1Names()[v] ?? null;
  if (isTruthVector(v, 2)) return F2_NAMES[v] ?? null;
  return null;
}

export type FnEntry = { vector: TruthVector; name: string | null; expr: BExpr; plain: string };

/** Las funciones de Fₙ con su nombre y su expresión canónica. */
export function listFn(n: FnArity): FnEntry[] {
  return enumerateFn(n).map((v) => {
    const expr = fnExpression(v);
    return { vector: v, name: fnName(v), expr, plain: booleToPlain(expr) };
  });
}

/**
 * (Fₙ, ⊕, ⊙, ′, 0, 1) como estructura finita para el verificador. En F₁ los elementos llevan los
 * nombres de content/notation; en F₂, su vector de verdad. Es isomorfa a {0, 1}^(2ⁿ).
 */
export function fnStructure(n: FnArity): FiniteStructure {
  const vectors = n === 1 ? NOTATION.f1.map((e) => e.values.join("")) : enumerateFn(2);
  const names = n === 1 ? f1Names() : null;
  const at = (v: TruthVector) => vectors.indexOf(v);
  return {
    name: n === 1 ? "F₁" : "F₂",
    elements: vectors.map((v) => (names ? names[v]! : v)),
    plus: vectors.map((a) => vectors.map((b) => at(fnOr(a, b)))),
    times: vectors.map((a) => vectors.map((b) => at(fnAnd(a, b)))),
    comp: vectors.map((a) => at(fnComp(a))),
    zero: at(fnZero(n)),
    one: at(fnOne(n)),
  };
}
