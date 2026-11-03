// Sistemas de ecuaciones lineales A·x = b: clasificación por el teorema de Rouché–Frobenius
// (rg A frente a rg (A|b) y número de incógnitas), solución única o paramétrica, y la corrección de la
// solución que escribe el estudiante. Una solución paramétrica vale si describe el mismo conjunto de
// soluciones, aunque los parámetros sean otros.
import { add, equals, frac, isZero, mul, neg, ONE, ZERO, type Frac } from "../rational.ts";
import { augment, isZeroVector, matrixCols, matrixVector, parseEntry, vectorEquals, type Matrix, type Vector } from "./matrix.ts";
import { matrixRank, rref } from "./rref.ts";
import { isIndependent, nullSpace } from "./spaces.ts";

export type SystemKind = "determinado" | "indeterminado" | "incompatible";

export const SYSTEM_KIND_LABELS: Record<SystemKind, string> = {
  determinado: "Compatible determinado",
  indeterminado: "Compatible indeterminado",
  incompatible: "Incompatible",
};

export type SystemAnalysis =
  | { kind: "determinado"; rankA: number; rankAb: number; n: number; x: Vector }
  | { kind: "indeterminado"; rankA: number; rankAb: number; n: number; particular: Vector; directions: Vector[]; free: number[] }
  | { kind: "incompatible"; rankA: number; rankAb: number; n: number };

/** Rouché–Frobenius: rg A ≠ rg (A|b) ⇒ incompatible; iguales a n ⇒ determinado; menores ⇒ indeterminado. */
export function analyzeSystem(A: Matrix, b: Vector): SystemAnalysis {
  const n = matrixCols(A);
  const rankA = matrixRank(A);
  const R = rref(augment(A, b));
  const rankAb = R.pivots.length;
  if (rankAb !== rankA) return { kind: "incompatible", rankA, rankAb, n };
  // Solución particular: variables libres a 0, las pivote se leen de la última columna.
  const particular: Vector = Array.from({ length: n }, () => ZERO);
  R.pivots.forEach((c, r) => {
    particular[c] = R.matrix[r]![n]!;
  });
  if (rankA === n) return { kind: "determinado", rankA, rankAb, n, x: particular };
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => !R.pivots.includes(j));
  return { kind: "indeterminado", rankA, rankAb, n, particular, directions: nullSpace(A), free };
}

/** Separa la matriz ampliada (A | b): la última columna son los términos independientes. */
export function splitAugmented(M: Matrix): { A: Matrix; b: Vector } {
  const n = matrixCols(M) - 1;
  return { A: M.map((r) => r.slice(0, n)), b: M.map((r) => r[n]!) };
}

/** ¿Es x solución de A·x = b? */
export const isSolution = (A: Matrix, b: Vector, x: Vector): boolean => vectorEquals(matrixVector(A, x), b);

// ---------------------------------------------------------------- Expresiones afines (soluciones paramétricas)

/** c + Σ coefs[p]·p, con parámetros de una letra (t, s, λ, μ…). */
export interface Affine {
  constant: Frac;
  coefs: Map<string, Frac>;
}

export type AffineParse = { ok: true; value: Affine } | { ok: false; error: string };

export const AFFINE_ERROR = "Escribe un número o una expresión con parámetros, como 2 − t o 1/2 + 3s.";
const MAX_AFFINE = 80;
/** Letras que pueden ser parámetros. x, y, z no: son las incógnitas. */
const PARAM_RE = /^[a-wα-ω]$/u;

/**
 * Lee una expresión afin en parámetros: términos con signo, cada uno un número, un parámetro o un
 * número por un parámetro («2t», «2·t», «1/2 s», «t/2», «−λ»).
 */
export function parseAffine(text: string): AffineParse {
  if (text.length > MAX_AFFINE) return { ok: false, error: AFFINE_ERROR };
  const s = text.replace(/−/g, "-").replace(/\s+/g, "");
  if (s.length === 0) return { ok: false, error: AFFINE_ERROR };
  let constant = ZERO;
  const coefs = new Map<string, Frac>();
  let i = 0;
  let first = true;
  const num = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)/;
  while (i < s.length) {
    let sgn = ONE;
    if (s[i] === "+" || s[i] === "-") {
      if (s[i] === "-") sgn = neg(ONE);
      i++;
    } else if (!first) return { ok: false, error: AFFINE_ERROR };
    first = false;
    let coef: Frac | null = null;
    const m = num.exec(s.slice(i));
    if (m) {
      const r = parseEntry(m[1]!);
      if (!r.ok) return { ok: false, error: AFFINE_ERROR };
      coef = r.value;
      i += m[1]!.length;
      if (s[i] === "*" || s[i] === "·" || s[i] === "×") i++;
    }
    const ch = [...s.slice(i)][0];
    let param: string | null = null;
    if (ch !== undefined && PARAM_RE.test(ch)) {
      param = ch;
      i += ch.length;
      const d = /^\/(\d+)/.exec(s.slice(i));
      if (d) {
        const den = BigInt(d[1]!);
        if (den === 0n) return { ok: false, error: AFFINE_ERROR };
        coef = mul(coef ?? ONE, frac(1n, den));
        i += d[0].length;
      }
    }
    if (coef === null && param === null) return { ok: false, error: AFFINE_ERROR };
    const value = mul(sgn, coef ?? ONE);
    if (param === null) constant = add(constant, value);
    else coefs.set(param, add(coefs.get(param) ?? ZERO, value));
  }
  for (const [k, v] of coefs) if (isZero(v)) coefs.delete(k);
  return { ok: true, value: { constant, coefs } };
}

export interface ParametricCheck {
  ok: boolean;
  /** Parámetros que usa la respuesta, en orden alfabético. */
  params: string[];
  /** Con todos los parámetros a 0, ¿es solución? */
  particularOk: boolean;
  /** Cada dirección (coeficientes de un parámetro): ¿es solución del homogéneo A·d = 0? */
  directionsOk: boolean[];
  /** ¿Hacen falta más (o menos) parámetros? n − rg A. */
  expectedParams: number;
  /** ¿Son independientes las direcciones? (si no, sobra un parámetro). */
  independent: boolean;
}

/** Comprueba x = p + Σ tₖ·dₖ (una expresión afin por incógnita) frente a A·x = b. */
export function checkParametric(A: Matrix, b: Vector, xs: readonly Affine[]): ParametricCheck {
  const params = [...new Set(xs.flatMap((x) => [...x.coefs.keys()]))].sort();
  const p = xs.map((x) => x.constant);
  const dirs = params.map((t) => xs.map((x) => x.coefs.get(t) ?? ZERO));
  const particularOk = isSolution(A, b, p);
  const directionsOk = dirs.map((d) => isZeroVector(matrixVector(A, d)));
  const expectedParams = matrixCols(A) - matrixRank(A);
  const independent = dirs.length === 0 || isIndependent(dirs);
  const ok = particularOk && directionsOk.every(Boolean) && independent && params.length === expectedParams;
  return { ok, params, particularOk, directionsOk, expectedParams, independent };
}

/** Texto de una expresión afin: «2 − t + 1/2·s». */
export function affineText(a: Affine, fmt: (x: Frac) => string): string {
  const parts: string[] = [];
  if (!isZero(a.constant)) parts.push(fmt(a.constant));
  for (const [p, c] of [...a.coefs].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const neg_ = c.n < 0n;
    const abs = neg_ ? neg(c) : c;
    const body = equals(abs, ONE) ? p : abs.d === 1n ? `${fmt(abs)}${p}` : `(${fmt(abs)})${p}`;
    parts.push(parts.length === 0 ? (neg_ ? `−${body}` : body) : `${neg_ ? "−" : "+"} ${body}`);
  }
  return parts.length === 0 ? "0" : parts.join(" ");
}
