// Polinomios en x e y con coeficientes racionales exactos: de una expresión a polinomio (si lo es),
// de vuelta a expresión ordenada por grados, derivadas parciales y evaluación exacta. Sirven para
// desarrollar numeradores al simplificar, para los puntos críticos y para los ejercicios con números
// exactos (integrales definidas y pasos de descenso de gradiente).
import { add as fadd, equals, frac, isZero, mul as fmul, ONE, ZERO, type Frac } from "../rational.ts";
import type { Expr, VarName } from "./expr.ts";

/** Coeficientes por monomio: clave «i,j» = xⁱ·yʲ. Sin ceros guardados. */
export type Poly2 = Map<string, Frac>;

export const MAX_POLY_DEGREE = 12;

const key = (i: number, j: number) => `${i},${j}`;
const unkey = (k: string): [number, number] => k.split(",").map(Number) as [number, number];

export function polyConst(c: Frac): Poly2 {
  return isZero(c) ? new Map() : new Map([[key(0, 0), c]]);
}

function addTo(p: Poly2, k: string, c: Frac) {
  const v = fadd(p.get(k) ?? ZERO, c);
  if (isZero(v)) p.delete(k);
  else p.set(k, v);
}

export function polyAdd2(a: Poly2, b: Poly2): Poly2 {
  const out = new Map(a);
  for (const [k, c] of b) addTo(out, k, c);
  return out;
}

export const polyScale2 = (p: Poly2, c: Frac): Poly2 => {
  const out: Poly2 = new Map();
  if (isZero(c)) return out;
  for (const [k, v] of p) out.set(k, fmul(v, c));
  return out;
};

export function polyMul2(a: Poly2, b: Poly2): Poly2 {
  const out: Poly2 = new Map();
  for (const [ka, ca] of a) {
    const [i1, j1] = unkey(ka);
    for (const [kb, cb] of b) {
      const [i2, j2] = unkey(kb);
      addTo(out, key(i1 + i2, j1 + j2), fmul(ca, cb));
    }
  }
  return out;
}

export const polyDegree2 = (p: Poly2): number => Math.max(-1, ...[...p.keys()].map((k) => unkey(k)[0] + unkey(k)[1]));
/** Grado en una variable. */
export const polyDegreeIn = (p: Poly2, v: VarName): number => Math.max(-1, ...[...p.keys()].map((k) => unkey(k)[v === "x" ? 0 : 1]));

export const polyEquals2 = (a: Poly2, b: Poly2): boolean => a.size === b.size && [...a].every(([k, c]) => b.has(k) && equals(b.get(k)!, c));

/** La expresión como polinomio, o null si no lo es (funciones, potencias no enteras, división por x…). */
export function exprToPoly(e: Expr): Poly2 | null {
  switch (e.k) {
    case "num":
      return polyConst(e.v);
    case "var":
      return new Map([[e.name === "x" ? key(1, 0) : key(0, 1), ONE]]);
    case "const":
    case "fn":
    case "d":
      return null;
    case "neg": {
      const a = exprToPoly(e.a);
      return a && polyScale2(a, frac(-1n));
    }
    case "add": {
      let acc: Poly2 = new Map();
      for (const t of e.args) {
        const p = exprToPoly(t);
        if (!p) return null;
        acc = polyAdd2(acc, p);
      }
      return acc;
    }
    case "mul": {
      let acc: Poly2 = polyConst(ONE);
      for (const t of e.args) {
        const p = exprToPoly(t);
        if (!p) return null;
        acc = polyMul2(acc, p);
        if (polyDegree2(acc) > MAX_POLY_DEGREE) return null;
      }
      return acc;
    }
    case "div": {
      const a = exprToPoly(e.a);
      const b = exprToPoly(e.b);
      if (!a || !b || b.size !== 1 || !b.has(key(0, 0))) return null;
      const c = b.get(key(0, 0))!;
      return polyScale2(a, { n: c.n < 0n ? -c.d : c.d, d: c.n < 0n ? -c.n : c.n });
    }
    case "pow": {
      if (e.b.k !== "num" || e.b.v.d !== 1n || e.b.v.n < 0n || e.b.v.n > BigInt(MAX_POLY_DEGREE)) return null;
      const base = exprToPoly(e.a);
      if (!base) return null;
      let acc = polyConst(ONE);
      for (let i = 0n; i < e.b.v.n; i++) {
        acc = polyMul2(acc, base);
        if (polyDegree2(acc) > MAX_POLY_DEGREE) return null;
      }
      return acc;
    }
  }
}

const numE = (v: Frac): Expr => ({ k: "num", v });
const varPow = (name: VarName, n: number): Expr | null =>
  n === 0 ? null : n === 1 ? { k: "var", name } : { k: "pow", a: { k: "var", name }, b: numE(frac(BigInt(n))) };

/** Monomios ordenados: más grado total primero y, a igual grado, más grado en x. */
export function polyTerms(p: Poly2): Array<{ i: number; j: number; c: Frac }> {
  return [...p]
    .map(([k, c]) => {
      const [i, j] = unkey(k);
      return { i, j, c };
    })
    .sort((a, b) => b.i + b.j - (a.i + a.j) || b.i - a.i);
}

/** El polinomio como expresión: 3x^2 − 2xy + 1. */
export function polyToExpr(p: Poly2): Expr {
  const terms = polyTerms(p).map(({ i, j, c }): Expr => {
    const factors = [varPow("x", i), varPow("y", j)].filter((f): f is Expr => f !== null);
    if (factors.length === 0) return numE(c);
    if (equals(c, ONE)) return factors.length === 1 ? factors[0]! : { k: "mul", args: factors };
    return { k: "mul", args: [numE(c), ...factors] };
  });
  if (terms.length === 0) return numE(ZERO);
  return terms.length === 1 ? terms[0]! : { k: "add", args: terms };
}

/** Derivada parcial de un polinomio. */
export function polyDerivative(p: Poly2, v: VarName): Poly2 {
  const out: Poly2 = new Map();
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    const e = v === "x" ? i : j;
    if (e === 0) continue;
    addTo(out, v === "x" ? key(i - 1, j) : key(i, j - 1), fmul(c, frac(BigInt(e))));
  }
  return out;
}

const fpow = (x: Frac, n: number): Frac => {
  let r = ONE;
  for (let i = 0; i < n; i++) r = fmul(r, x);
  return r;
};

/** Valor exacto en (x, y). */
export function polyEval2(p: Poly2, x: Frac, y: Frac = ZERO): Frac {
  let s = ZERO;
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    s = fadd(s, fmul(c, fmul(fpow(x, i), fpow(y, j))));
  }
  return s;
}

/** Coeficientes en una variable cuando el polinomio solo depende de ella (para rationalRoots). */
export function polyUnivariate(p: Poly2, v: VarName): Frac[] | null {
  const out: Frac[] = [];
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    if ((v === "x" ? j : i) !== 0) return null;
    const e = v === "x" ? i : j;
    while (out.length <= e) out.push(ZERO);
    out[e] = c;
  }
  return out.length === 0 ? [ZERO] : out;
}

/** Sustituye y por un polinomio en x: p(x, q(x)). */
export function polySubstituteY(p: Poly2, q: Poly2): Poly2 {
  let out: Poly2 = new Map();
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    let term: Poly2 = new Map([[key(i, 0), c]]);
    for (let t = 0; t < j; t++) term = polyMul2(term, q);
    out = polyAdd2(out, term);
  }
  return out;
}

/** Intercambia x e y. */
export function polySwap(p: Poly2): Poly2 {
  const out: Poly2 = new Map();
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    out.set(key(j, i), c);
  }
  return out;
}

/** El polinomio como a(x)·y + b(x) si es de grado ≤ 1 en y: [a, b]. */
export function polySplitLinearY(p: Poly2): [Poly2, Poly2] | null {
  const a: Poly2 = new Map();
  const b: Poly2 = new Map();
  for (const [k, c] of p) {
    const [i, j] = unkey(k);
    if (j > 1) return null;
    (j === 1 ? a : b).set(key(i, 0), c);
  }
  return [a, b];
}
