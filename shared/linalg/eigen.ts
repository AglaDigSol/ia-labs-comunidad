// Autovalores y autovectores con racionales exactos: polinomio característico p(λ) = det(λI − A)
// (Faddeev–LeVerrier, sin fórmulas por tamaño), raíces racionales (teorema de las raíces racionales y
// división sintética), autoespacios como núcleo de A − λI y la comprobación A·v = λ·v. También lee el
// polinomio que escribe el estudiante, desarrollado o factorizado.
import { add, div, equals, frac, isZero, mul, neg, ONE, ZERO, type Frac } from "../rational.ts";
import { fracTex, fracText, identityMatrix, isSquareMatrix, isZeroVector, matrixAdd, matrixProduct, matrixScale, matrixSub, matrixVector, parseEntry, trace, vectorScale, type Matrix, type Vector } from "./matrix.ts";
import { nullSpace } from "./spaces.ts";

/** Coeficientes en orden creciente de grado: p[k] es el coeficiente de λᵏ. Sin ceros finales. */
export type Poly = Frac[];

export function polyTrim(p: readonly Frac[]): Poly {
  const out = [...p];
  while (out.length > 0 && isZero(out[out.length - 1]!)) out.pop();
  return out;
}

export const polyDegree = (p: Poly): number => polyTrim(p).length - 1;

export function polyAdd(p: Poly, q: Poly): Poly {
  return polyTrim(Array.from({ length: Math.max(p.length, q.length) }, (_, k) => add(p[k] ?? ZERO, q[k] ?? ZERO)));
}

export function polyMul(p: Poly, q: Poly): Poly {
  if (p.length === 0 || q.length === 0) return [];
  const out: Frac[] = Array.from({ length: p.length + q.length - 1 }, () => ZERO);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] = add(out[i + j]!, mul(a, b)))));
  return polyTrim(out);
}

export const polyScale = (k: Frac, p: Poly): Poly => polyTrim(p.map((x) => mul(k, x)));

export function polyEval(p: Poly, x: Frac): Frac {
  let acc = ZERO;
  for (let k = p.length - 1; k >= 0; k--) acc = add(mul(acc, x), p[k]!);
  return acc;
}

export const polyEquals = (p: Poly, q: Poly): boolean => {
  const a = polyTrim(p);
  const b = polyTrim(q);
  return a.length === b.length && a.every((x, k) => equals(x, b[k]!));
};

/** p(λ) = det(λI − A), mónico de grado n (Faddeev–LeVerrier, exacto). */
export function charPolynomial(A: Matrix): Poly {
  if (!isSquareMatrix(A)) throw new RangeError("La matriz no es cuadrada");
  const n = A.length;
  const I = identityMatrix(n);
  const c: Frac[] = Array.from({ length: n + 1 }, () => ZERO);
  c[n] = ONE;
  let M: Matrix = A.map((r) => r.map(() => ZERO));
  for (let k = 1; k <= n; k++) {
    M = matrixAdd(matrixProduct(A, M), matrixScale(c[n - k + 1]!, I));
    c[n - k] = neg(div(trace(matrixProduct(A, M)), frac(BigInt(k))));
  }
  return c;
}

/** «λ³ − 4λ² + λ + 6». */
export function polyText(p: Poly, v = "λ"): string {
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const pow = (k: number) => (k === 0 ? "" : k === 1 ? v : `${v}${[...String(k)].map((d) => SUP[Number(d)]).join("")}`);
  return polyFormat(p, pow, fracText, "−");
}

export function polyTex(p: Poly, v = "\\lambda"): string {
  const pow = (k: number) => (k === 0 ? "" : k === 1 ? v : `${v}^{${k}}`);
  return polyFormat(p, pow, fracTex, "-");
}

function polyFormat(p: Poly, pow: (k: number) => string, fmt: (x: Frac) => string, minus: string): string {
  const t = polyTrim(p);
  const parts: string[] = [];
  for (let k = t.length - 1; k >= 0; k--) {
    const c = t[k]!;
    if (isZero(c)) continue;
    const negative = c.n < 0n;
    const abs = negative ? neg(c) : c;
    const body = k === 0 ? fmt(abs) : equals(abs, ONE) ? pow(k) : `${fmt(abs)}${pow(k)}`;
    parts.push(parts.length === 0 ? (negative ? `${minus}${body}` : body) : `${negative ? minus : "+"} ${body}`);
  }
  return parts.length === 0 ? "0" : parts.join(" ");
}

// ---------------------------------------------------------------- Raíces racionales

function divisors(n: bigint): bigint[] {
  const a = n < 0n ? -n : n;
  const out: bigint[] = [];
  for (let d = 1n; d * d <= a; d++) {
    if (a % d === 0n) {
      out.push(d);
      if (d * d !== a) out.push(a / d);
    }
  }
  return out;
}

/** División sintética entre (λ − r): cociente (asume que r es raíz). */
function deflate(p: Poly, r: Frac): Poly {
  const n = p.length - 1;
  const q: Frac[] = Array.from({ length: n }, () => ZERO);
  let carry = ZERO;
  for (let k = n; k >= 1; k--) {
    carry = add(p[k]!, mul(carry, r));
    q[k - 1] = carry;
  }
  return q;
}

/** Límite del término independiente para buscar divisores (los ejercicios quedan muy por debajo). */
const MAX_ROOT_SEARCH = 10n ** 9n;

export interface RationalRoots {
  /** Raíces racionales distintas, de menor a mayor, con su multiplicidad algebraica. */
  roots: Array<{ value: Frac; mult: number }>;
  /** ¿Se descompone del todo en factores lineales racionales? */
  complete: boolean;
}

/** Raíces racionales de un polinomio (teorema de las raíces racionales). */
export function rationalRoots(poly: Poly): RationalRoots {
  let p = polyTrim(poly);
  const found = new Map<string, { value: Frac; mult: number }>();
  const push = (r: Frac) => {
    const key = `${r.n}/${r.d}`;
    const e = found.get(key);
    if (e) e.mult++;
    else found.set(key, { value: r, mult: 1 });
  };
  // λ = 0 tantas veces como ceros iniciales.
  while (p.length > 1 && isZero(p[0]!)) {
    push(ZERO);
    p = p.slice(1);
  }
  let progress = true;
  while (p.length > 1 && progress) {
    progress = false;
    // Coeficientes enteros: se multiplica por el mcm de los denominadores.
    const l = p.reduce((acc, c) => (acc * c.d) / gcd(acc, c.d), 1n);
    const ints = p.map((c) => (c.n * l) / c.d);
    const a0 = ints[0]!;
    const an = ints[ints.length - 1]!;
    if ((a0 < 0n ? -a0 : a0) > MAX_ROOT_SEARCH || (an < 0n ? -an : an) > MAX_ROOT_SEARCH) break;
    for (const q of divisors(an)) {
      for (const pp of divisors(a0)) {
        for (const s of [1n, -1n]) {
          const r = frac(s * pp, q);
          if (isZero(polyEval(p, r))) {
            push(r);
            p = deflate(p, r);
            progress = true;
            break;
          }
        }
        if (progress) break;
      }
      if (progress) break;
    }
  }
  const roots = [...found.values()].sort((a, b) => (a.value.n * b.value.d < b.value.n * a.value.d ? -1 : 1));
  return { roots, complete: p.length <= 1 };
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Autovalores racionales de A con su multiplicidad algebraica. */
export const eigenvalues = (A: Matrix): RationalRoots => rationalRoots(charPolynomial(A));

/** A − λI. */
export const shiftMatrix = (A: Matrix, lambda: Frac): Matrix => matrixSub(A, matrixScale(lambda, identityMatrix(A.length)));

/**
 * El múltiplo de v con enteros sin factor común: (−1/2, 1/2, 1) → (−1, 1, 2). Es el mismo autovector
 * (cualquier múltiplo no nulo lo es) y se lee mejor. El vector nulo se queda como está.
 */
export function integerVector(v: Vector): Vector {
  if (v.every(isZero)) return [...v];
  const abs = (x: bigint) => (x < 0n ? -x : x);
  const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? abs(a) : gcd(b, a % b));
  const lcm = v.reduce((l, x) => (l / gcd(l, x.d)) * x.d, 1n);
  const ints = v.map((x) => (x.n * lcm) / x.d);
  const g = ints.reduce((acc, x) => gcd(acc, x), 0n);
  return ints.map((x) => frac(x / g));
}

/** Base del autoespacio de λ: núcleo de A − λI (vacía si λ no es autovalor), con vectores enteros. */
export const eigenspace = (A: Matrix, lambda: Frac): Vector[] => nullSpace(shiftMatrix(A, lambda)).map(integerVector);

/** ¿v ≠ 0 y A·v = λ·v? */
export function isEigenpair(A: Matrix, v: Vector, lambda: Frac): boolean {
  if (isZeroVector(v)) return false;
  const Av = matrixVector(A, v);
  const lv = vectorScale(lambda, v);
  return Av.every((x, i) => equals(x, lv[i]!));
}

/** Si v ≠ 0 es autovector de A, su autovalor; si no, null. */
export function eigenvalueOf(A: Matrix, v: Vector): Frac | null {
  if (isZeroVector(v)) return null;
  const k = v.findIndex((x) => !isZero(x));
  const lambda = div(matrixVector(A, v)[k]!, v[k]!);
  return isEigenpair(A, v, lambda) ? lambda : null;
}

/** ¿Es el polinomio escrito el característico? Vale det(λI − A) o det(A − λI) = (−1)ⁿ·det(λI − A). */
export function isCharPolynomial(A: Matrix, p: Poly): boolean {
  const c = charPolynomial(A);
  return polyEquals(p, c) || polyEquals(p, polyScale(neg(ONE), c));
}

// ---------------------------------------------------------------- Lectura de polinomios

export type PolyParse = { ok: true; value: Poly; variable: string | null } | { ok: false; error: string };

export const POLY_ERROR = "Escribe un polinomio en λ, por ejemplo λ² − 5λ + 6 o (λ − 2)(λ − 3).";
const MAX_POLY_TEXT = 120;
const MAX_POLY_DEGREE = 8;
const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

type Tok = { k: "num"; v: Frac } | { k: "var"; v: string } | { k: "op"; v: string } | { k: "pow"; v: number };

function tokenizePoly(text: string): Tok[] | null {
  const toks: Tok[] = [];
  const s = text.replace(/−/g, "-").replace(/[·×]/g, "*");
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.,]/.test(ch)) {
      const m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
      if (!m) return null;
      const r = parseEntry(m[0]);
      if (!r.ok) return null;
      toks.push({ k: "num", v: r.value });
      i += m[0].length;
    } else if (/[λxt]/.test(ch)) {
      toks.push({ k: "var", v: ch });
      i++;
    } else if ("+-*/()^".includes(ch)) {
      toks.push({ k: "op", v: ch });
      i++;
    } else if (ch in SUPERSCRIPTS) {
      let d = "";
      while (i < s.length && s[i]! in SUPERSCRIPTS) d += SUPERSCRIPTS[s[i++]!];
      toks.push({ k: "pow", v: Number(d) });
    } else return null;
  }
  return toks;
}

/**
 * Lee un polinomio en una variable (λ, x o t): sumas, productos (también implícitos, «2λ» o
 * «(λ − 1)(λ + 2)»), potencias con ^ o superíndices y divisiones entre números.
 */
export function parsePolynomial(text: string): PolyParse {
  if (text.length > MAX_POLY_TEXT) return { ok: false, error: POLY_ERROR };
  const toks = tokenizePoly(text);
  if (!toks || toks.length === 0) return { ok: false, error: POLY_ERROR };
  let pos = 0;
  let variable: string | null = null;
  const peek = () => toks[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t !== undefined && t.k === "op" && t.v === v;
  };
  const fail = (): never => {
    throw new SyntaxError(POLY_ERROR);
  };
  const powOf = (base: Poly, e: number): Poly => {
    if (!Number.isInteger(e) || e < 0 || e * Math.max(0, base.length - 1) > MAX_POLY_DEGREE) fail();
    let out: Poly = [ONE];
    for (let k = 0; k < e; k++) out = polyMul(out, base);
    return out;
  };
  const expr = (): Poly => {
    let acc = term();
    while (isOp("+") || isOp("-")) {
      const minus = isOp("-");
      pos++;
      const t = term();
      acc = polyAdd(acc, minus ? polyScale(neg(ONE), t) : t);
    }
    return acc;
  };
  const startsFactor = () => {
    const t = peek();
    return t !== undefined && (t.k === "num" || t.k === "var" || (t.k === "op" && t.v === "("));
  };
  const term = (): Poly => {
    let acc = unary();
    for (;;) {
      if (isOp("*")) {
        pos++;
        acc = polyMul(acc, unary());
      } else if (isOp("/")) {
        pos++;
        const d = unary();
        if (d.length !== 1) fail();
        acc = polyScale(div(ONE, d[0]!), acc);
      } else if (startsFactor()) {
        acc = polyMul(acc, power());
      } else return acc;
    }
  };
  const unary = (): Poly => {
    if (isOp("-")) {
      pos++;
      return polyScale(neg(ONE), unary());
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  };
  const power = (): Poly => {
    const base = primary();
    const t = peek();
    if (t?.k === "pow") {
      pos++;
      return powOf(base, t.v);
    }
    if (isOp("^")) {
      pos++;
      const e = peek();
      if (e?.k !== "num" || e.v.d !== 1n) fail();
      pos++;
      return powOf(base, Number((e as { v: Frac }).v.n));
    }
    return base;
  };
  const primary = (): Poly => {
    const t = peek();
    if (!t) return fail();
    if (t.k === "num") {
      pos++;
      return polyTrim([t.v]);
    }
    if (t.k === "var") {
      if (variable !== null && variable !== t.v) fail();
      variable = t.v;
      pos++;
      return [ZERO, ONE];
    }
    if (t.k === "op" && t.v === "(") {
      pos++;
      const e = expr();
      if (!isOp(")")) fail();
      pos++;
      return e;
    }
    return fail();
  };
  try {
    const value = expr();
    if (pos !== toks.length || polyDegree(value) > MAX_POLY_DEGREE) return { ok: false, error: POLY_ERROR };
    return { ok: true, value, variable };
  } catch {
    return { ok: false, error: POLY_ERROR };
  }
}

/** p(λ) = λ − r, para construir polinomios factorizados en los tests y generadores. */
export const linearFactor = (r: Frac): Poly => [neg(r), ONE];

/** Producto de (λ − rᵢ). */
export const polyFromRoots = (roots: readonly Frac[]): Poly => roots.reduce<Poly>((acc, r) => polyMul(acc, linearFactor(r)), [ONE]);
