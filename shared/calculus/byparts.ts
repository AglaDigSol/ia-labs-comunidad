// Integración por partes, ∫ u dv = u·v − ∫ v du, para las familias de clase: k·x·ln x, k·x²·ln x,
// k·x·e^(ax), k·x·sen(ax) y k·x·cos(ax). Da la elección de u y dv, una primitiva y el valor exacto de
// la integral definida entre límites cómodos (1 y e para los logaritmos; enteros para la exponencial;
// 0, π/2 y π para seno y coseno) como combinación de 1, potencias de e y π: (e² + 1)/4, π/2 − 1,
// 1 − 2/e… Los tests comparan la primitiva derivándola y el valor exacto con la integral numérica.
import { add, frac, mul, toNumber, type Frac } from "../rational.ts";
import type { Expr } from "./expr.ts";
import { parseExpr } from "./parser.ts";
import { tidy } from "./simplify.ts";

export const PARTS_FAMILIES = ["x-ln", "x2-ln", "x-exp", "x-sin", "x-cos"] as const;
export type PartsFamily = (typeof PARTS_FAMILIES)[number];

/** Un límite de integración: un racional, eᵐ (para los logaritmos) o q·π. */
export type Bound = { k: "num"; v: number } | { k: "e"; m: number } | { k: "pi"; n: number; d: number };

export const boundValue = (b: Bound): number => (b.k === "num" ? b.v : b.k === "e" ? Math.exp(b.m) : (b.n / b.d) * Math.PI);

export function boundText(b: Bound): string {
  if (b.k === "num") return String(b.v).replace("-", "−");
  if (b.k === "e") return b.m === 0 ? "1" : b.m === 1 ? "e" : `e^${b.m}`;
  const { n, d } = b;
  if (n === 0) return "0";
  return `${n === 1 ? "" : n === -1 ? "−" : String(n)}π${d === 1 ? "" : `/${d}`}`;
}

export function boundTex(b: Bound): string {
  if (b.k === "num") return String(b.v);
  if (b.k === "e") return b.m === 0 ? "1" : b.m === 1 ? "e" : `e^{${b.m}}`;
  const { n, d } = b;
  if (n === 0) return "0";
  const top = `${n === 1 ? "" : n === -1 ? "-" : String(n)}\\pi`;
  return d === 1 ? top : `\\frac{${top}}{${d}}`;
}

/** El integrando como texto que lee el analizador. */
export function partsIntegrand(fam: PartsFamily, k: number, a = 1): string {
  const c = k === 1 ? "" : k === -1 ? "−" : `${k}`;
  const ax = a === 1 ? "x" : `${a}x`;
  switch (fam) {
    case "x-ln":
      return `${c}x ln(x)`;
    case "x2-ln":
      return `${c}x^2 ln(x)`;
    case "x-exp":
      return `${c}x e^(${ax})`;
    case "x-sin":
      return `${c}x sen(${ax})`;
    case "x-cos":
      return `${c}x cos(${ax})`;
  }
}

/** Qué se toma como u y como dv (lo que se deriva y lo que se integra). */
export function partsChoice(fam: PartsFamily, a = 1): { u: string; dv: string; du: string; v: string } {
  const ax = a === 1 ? "x" : `${a}x`;
  const inv = a === 1 ? "" : `(1/${a})`;
  switch (fam) {
    case "x-ln":
      return { u: "ln x", dv: "x dx", du: "(1/x) dx", v: "x²/2" };
    case "x2-ln":
      return { u: "ln x", dv: "x² dx", du: "(1/x) dx", v: "x³/3" };
    case "x-exp":
      return { u: "x", dv: `e^(${ax}) dx`, du: "dx", v: `${inv}e^(${ax})` };
    case "x-sin":
      return { u: "x", dv: `sen(${ax}) dx`, du: "dx", v: `−${inv}cos(${ax})` };
    case "x-cos":
      return { u: "x", dv: `cos(${ax}) dx`, du: "dx", v: `${inv}sen(${ax})` };
  }
}

/** Términos de la primitiva: c·tᵖ·L(a·t), con L = 1, ln, exp, cos o sen. */
type Term = { c: Frac; p: number; L: "1" | "ln" | "exp" | "cos" | "sin" };

function terms(fam: PartsFamily, k: number, a: number): Term[] {
  const K = frac(BigInt(k));
  const f = (n: number, d: number) => mul(K, frac(BigInt(n), BigInt(d)));
  switch (fam) {
    case "x-ln":
      return [
        { c: f(1, 2), p: 2, L: "ln" },
        { c: f(-1, 4), p: 2, L: "1" },
      ];
    case "x2-ln":
      return [
        { c: f(1, 3), p: 3, L: "ln" },
        { c: f(-1, 9), p: 3, L: "1" },
      ];
    case "x-exp":
      return [
        { c: f(1, a), p: 1, L: "exp" },
        { c: f(-1, a * a), p: 0, L: "exp" },
      ];
    case "x-sin":
      return [
        { c: f(-1, a), p: 1, L: "cos" },
        { c: f(1, a * a), p: 0, L: "sin" },
      ];
    case "x-cos":
      return [
        { c: f(1, a), p: 1, L: "sin" },
        { c: f(1, a * a), p: 0, L: "cos" },
      ];
  }
}

const termText = (t: Term, a: number): string => {
  const ax = a === 1 ? "x" : `${a}x`;
  const pw = t.p === 0 ? "" : t.p === 1 ? "x" : `x^${t.p}`;
  const L = t.L === "1" ? "" : t.L === "ln" ? "ln(x)" : t.L === "exp" ? `e^(${ax})` : t.L === "cos" ? `cos(${ax})` : `sen(${ax})`;
  return `(${t.c.n}/${t.c.d})·${[pw, L].filter(Boolean).join("·") || "1"}`;
};

/** Una primitiva (sin la constante). */
export function partsAntiderivative(fam: PartsFamily, k: number, a = 1): Expr {
  const text = terms(fam, k, a)
    .map((t) => termText(t, a))
    .join(" + ");
  const r = parseExpr(text);
  if (!r.ok) throw new Error(`primitiva ilegible: ${text}`);
  return tidy(r.expr);
}

// ---------------------------------------------------------------- Valores exactos

/** Combinación lineal racional de eᵐ·πᵖ: clave «m,p». */
export type ClosedForm = Map<string, Frac>;

function addTo(cf: ClosedForm, m: number, p: number, c: Frac) {
  if (c.n === 0n) return;
  const key = `${m},${p}`;
  const prev = cf.get(key);
  const next = prev ? add(prev, c) : c;
  if (next.n === 0n) cf.delete(key);
  else cf.set(key, next);
}

const fracPow = (q: Frac, p: number): Frac => {
  let r = frac(1n);
  for (let i = 0; i < p; i++) r = mul(r, q);
  return r;
};

/** cos y sen de (n/2)·π, exactos. */
function trigHalfPi(halves: number, fn: "cos" | "sin"): number {
  const r = ((halves % 4) + 4) % 4;
  return fn === "cos" ? [1, 0, -1, 0][r]! : [0, 1, 0, -1][r]!;
}

/** F(b) exacto, o null si el límite no es de los cómodos para la familia. */
function evalAt(fam: PartsFamily, k: number, a: number, b: Bound): ClosedForm | null {
  const cf: ClosedForm = new Map();
  for (const t of terms(fam, k, a)) {
    if (fam === "x-ln" || fam === "x2-ln") {
      if (b.k !== "e") return null;
      // tᵖ = e^(m·p) y ln t = m.
      const L = t.L === "ln" ? frac(BigInt(b.m)) : frac(1n);
      addTo(cf, b.m * t.p, 0, mul(t.c, L));
    } else if (fam === "x-exp") {
      if (b.k !== "num" || !Number.isInteger(b.v)) return null;
      addTo(cf, a * b.v, 0, mul(t.c, fracPow(frac(BigInt(b.v)), t.p)));
    } else {
      if (b.k !== "pi" || (b.d !== 1 && b.d !== 2)) return null;
      // t = q·π; a·t = (2·a·q)·(π/2).
      const q = frac(BigInt(b.n), BigInt(b.d));
      const halves = (2 * a * b.n) / b.d;
      const L = t.L === "cos" || t.L === "sin" ? trigHalfPi(halves, t.L) : 1;
      addTo(cf, 0, t.p, mul(mul(t.c, frac(BigInt(L))), fracPow(q, t.p)));
    }
  }
  return cf;
}

/** ∫ de lo a hi (pueden ir al revés: entonces cambia el signo, como debe). */
export function partsDefinite(fam: PartsFamily, k: number, a: number, lo: Bound, hi: Bound): ClosedForm | null {
  const F1 = evalAt(fam, k, a, hi);
  const F0 = evalAt(fam, k, a, lo);
  if (!F1 || !F0) return null;
  const out: ClosedForm = new Map(F1);
  for (const [key, c] of F0) {
    const [m, p] = key.split(",").map(Number) as [number, number];
    addTo(out, m, p, { n: -c.n, d: c.d });
  }
  return out;
}

export function closedValue(cf: ClosedForm): number {
  let s = 0;
  for (const [key, c] of cf) {
    const [m, p] = key.split(",").map(Number) as [number, number];
    s += toNumber(c) * Math.exp(m) * Math.PI ** p;
  }
  return s;
}

/** Escalar una forma cerrada por un racional. */
export function closedScale(cf: ClosedForm, k: Frac): ClosedForm {
  const out: ClosedForm = new Map();
  for (const [key, c] of cf) {
    const [m, p] = key.split(",").map(Number) as [number, number];
    addTo(out, m, p, mul(c, k));
  }
  return out;
}

/** Cambia una clave (por ejemplo, e² por e): para construir distractores. */
export function closedRekey(cf: ClosedForm, from: string, to: string): ClosedForm {
  const out: ClosedForm = new Map();
  for (const [key, c] of cf) {
    const [m, p] = (key === from ? to : key).split(",").map(Number) as [number, number];
    addTo(out, m, p, c);
  }
  return out;
}

const gcdB = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcdB(b, a % b));

/** Numeradores enteros con denominador común: (e² + 1)/4 → [[«2,0», 1], [«0,0», 1]], 4. */
function commonDen(cf: ClosedForm): { parts: Array<[number, number, bigint]>; den: bigint } {
  let den = 1n;
  for (const c of cf.values()) den = (den * c.d) / gcdB(den, c.d);
  const parts = [...cf].map(([key, c]) => {
    const [m, p] = key.split(",").map(Number) as [number, number];
    return [m, p, (c.n * den) / c.d] as [number, number, bigint];
  });
  // Primero las potencias de e más altas, luego π, al final la constante.
  const rank = ([m, p]: [number, number, bigint]) => (m === 0 && p === 0 ? -1000 : m * 10 + p);
  parts.sort((x, y) => rank(y) - rank(x));
  return { parts, den };
}

function writeClosed(cf: ClosedForm, tex: boolean): string {
  if (cf.size === 0) return "0";
  const { parts: raw, den } = commonDen(cf);
  // Factor común de los numeradores: 3(e² + 1)/4 en vez de (3e² + 3)/4.
  const g = raw.length > 1 ? raw.reduce((acc, [, , n]) => gcdB(acc, n), 0n) : 1n;
  const parts = raw.map(([m, p, n]) => [m, p, n / g] as [number, number, bigint]);
  const factor = g > 1n ? String(g) : "";
  // Si todos son negativos, el signo va fuera.
  const allNeg = parts.every(([, , n]) => n < 0n);
  const basis = (m: number, p: number) => {
    const e = m === 0 ? "" : m === 1 ? "e" : tex ? `e^{${m}}` : m === 2 ? "e²" : m === 3 ? "e³" : m === -1 ? "e⁻¹" : `e^${m}`;
    const pi = p === 0 ? "" : tex ? "\\pi" : "π";
    return `${e}${pi}`;
  };
  let body = "";
  parts.forEach(([m, p, n0], i) => {
    const n = allNeg ? -n0 : n0;
    const abs = n < 0n ? -n : n;
    const b = basis(m, p);
    // e⁻¹ se escribe como 1/e (o dividido entre e).
    const coef = b === "" ? String(abs) : abs === 1n ? "" : String(abs);
    const term = m === -1 && p === 0 ? (tex ? `\\frac{${abs}}{e}` : `${abs}/e`) : `${coef}${b}`;
    body += i === 0 ? (n < 0n ? `-${term}` : term) : n < 0n ? ` - ${term}` : ` + ${term}`;
  });
  if (!tex) body = body.replace(/-/g, "−");
  const sign = allNeg ? (tex ? "-" : "−") : "";
  const grouped = factor ? (tex ? `${factor}\\left(${body}\\right)` : `${factor}(${body})`) : body;
  if (den === 1n) return parts.length > 1 && allNeg && !factor ? `${sign}(${body})` : `${sign}${grouped}`;
  if (tex) return `${sign}\\frac{${grouped}}{${den}}`;
  return parts.length > 1 && !factor ? `${sign}(${body})/${den}` : `${sign}${grouped}/${den}`;
}

/** «(e² + 1)/4», «π/2 − 1», «1 − 2/e». */
export const closedText = (cf: ClosedForm) => writeClosed(cf, false);
export const closedTex = (cf: ClosedForm) => writeClosed(cf, true);
