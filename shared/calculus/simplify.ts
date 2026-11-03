// Simplificación algebraica para que las derivadas se lean bien: aplana sumas y productos, opera los
// números (racionales exactos), quita ceros y unos, junta términos semejantes (3x + 2x = 5x) y
// potencias de la misma base (x·x² = x³), y desarrolla un polinomio cuando así queda más corto. Por
// dentro, a − b es a + (−1)·b, a/b es a·b⁻¹ y √u es u^(1/2); al final (pretty) se vuelve a escribir
// como en un libro: fracciones, raíces y restas. No pretende ser un sistema de álgebra completo: la
// equivalencia de verdad se comprueba numéricamente (equivalence.ts).
import { add as fadd, equals, frac, isZero, mul as fmul, ONE, ZERO, type Frac } from "../rational.ts";
import { exprSize, toPlain, type Expr } from "./expr.ts";
import { exprToPoly, polyToExpr } from "./poly.ts";

const numE = (v: Frac): Expr => ({ k: "num", v });
const N = (n: number, den = 1): Expr => numE(frac(BigInt(n), BigInt(den)));
const isInt = (v: Frac) => v.d === 1n;
const abs = (n: bigint) => (n < 0n ? -n : n);

/** Clave canónica: iguales salvo el orden de sumandos y factores ⇒ misma clave. */
export function canonKey(e: Expr): string {
  switch (e.k) {
    case "num":
      return `${e.v.n}/${e.v.d}`;
    case "const":
    case "var":
      return e.name;
    case "add":
    case "mul":
      return `${e.k}(${e.args.map(canonKey).sort().join(",")})`;
    case "div":
    case "pow":
      return `${e.k}(${canonKey(e.a)},${canonKey(e.b)})`;
    case "neg":
      return `neg(${canonKey(e.a)})`;
    case "fn":
      return `${e.name}(${canonKey(e.a)})`;
    case "d":
      return `d${e.v}(${canonKey(e.a)})`;
  }
}

/** Potencia racional exacta de un racional, si la hay (4^(1/2) = 2, 8^(−2/3) = 1/4). */
function exactPow(base: Frac, ex: Frac): Frac | null {
  if (abs(ex.n) > 12n || ex.d > 3n) return null;
  const root = (n: bigint, k: bigint): bigint | null => {
    if (n < 0n) {
      if (k % 2n === 0n) return null;
      const r = root(-n, k);
      return r === null ? null : -r;
    }
    const r = BigInt(Math.round(Math.pow(Number(n), 1 / Number(k))));
    for (const c of [r - 1n, r, r + 1n]) if (c >= 0n && c ** k === n) return c;
    return null;
  };
  const rn = root(base.n, ex.d);
  const rd = root(base.d, ex.d);
  if (rn === null || rd === null) return null;
  const p = abs(ex.n);
  if (p > 0n && (abs(rn) > 10n ** 6n || rd > 10n ** 6n) && p > 1n) return null;
  let n = rn ** p;
  let d = rd ** p;
  if (abs(n) > 10n ** 12n || d > 10n ** 12n) return null;
  if (ex.n < 0n) {
    if (n === 0n) return null;
    [n, d] = [d, n];
  }
  return frac(n, d);
}

/** Separa el coeficiente numérico de un término: 3x² → [3, x²]. */
function splitCoef(e: Expr): [Frac, Expr | null] {
  if (e.k === "num") return [e.v, null];
  if (e.k === "mul" && e.args[0]?.k === "num") {
    const rest = e.args.slice(1);
    return [e.args[0].v, rest.length === 1 ? rest[0]! : { k: "mul", args: rest }];
  }
  return [ONE, e];
}

/** Separa base y exponente: x³ → [x, 3]; x → [x, 1]. */
function splitPow(e: Expr): [Expr, Expr] {
  return e.k === "pow" ? [e.a, e.b] : [e, N(1)];
}

/** Orden de los factores: números, constantes, potencias de x, de y, y el resto como venían. */
function factorRank(e: Expr): number {
  const [b] = splitPow(e);
  if (e.k === "num") return 0;
  if (b.k === "const") return 1;
  if (b.k === "var") return b.name === "x" ? 2 : 3;
  return 4;
}

function mkMul(coef: Frac, factors: Expr[]): Expr {
  if (isZero(coef)) return N(0);
  const fs = equals(coef, ONE) ? factors : [numE(coef), ...factors];
  if (fs.length === 0) return N(1);
  return fs.length === 1 ? fs[0]! : { k: "mul", args: fs };
}

/** Un paso de simplificación de abajo arriba. */
function step(e: Expr): Expr {
  switch (e.k) {
    case "num":
    case "const":
    case "var":
      return e;
    case "d":
      return { k: "d", a: simplify(e.a), v: e.v };
    case "neg":
      return step({ k: "mul", args: [N(-1), e.a] });
    case "div":
      return step({ k: "mul", args: [e.a, { k: "pow", a: e.b, b: N(-1) }] });
    case "fn": {
      const a = step(e.a);
      if (e.name === "sqrt") return step({ k: "pow", a, b: N(1, 2) });
      if (a.k === "num") {
        if (isZero(a.v) && (e.name === "sin" || e.name === "tan" || e.name === "abs")) return N(0);
        if (isZero(a.v) && (e.name === "cos" || e.name === "exp")) return N(1);
        if (equals(a.v, ONE) && e.name === "ln") return N(0);
        if (e.name === "abs") return numE({ n: abs(a.v.n), d: a.v.d });
      }
      if (e.name === "ln" && a.k === "const" && a.name === "e") return N(1);
      if (e.name === "ln" && a.k === "fn" && a.name === "exp") return a.a;
      if (e.name === "ln" && a.k === "pow" && a.a.k === "const" && a.a.name === "e") return a.b;
      if (e.name === "abs" && a.k === "fn" && a.name === "abs") return a;
      if (e.name === "exp" && a.k === "fn" && a.name === "ln") return { k: "fn", name: "exp", a };
      return { k: "fn", name: e.name, a };
    }
    case "pow": {
      const a = step(e.a);
      const b = step(e.b);
      if (b.k === "num" && isZero(b.v)) return N(1);
      if (b.k === "num" && equals(b.v, ONE)) return a;
      if (a.k === "num" && isZero(a.v) && b.k === "num" && b.v.n > 0n) return N(0);
      if (a.k === "num" && equals(a.v, ONE)) return N(1);
      if (a.k === "num" && b.k === "num") {
        const r = exactPow(a.v, b.v);
        if (r) return numE(r);
      }
      // e^u = exp(u)
      if (a.k === "const" && a.name === "e") return { k: "fn", name: "exp", a: b };
      // (u^p)^q = u^(p·q) con q entero (o p·q entero con p impar en el denominador: sin perder signos).
      if (a.k === "pow" && a.b.k === "num" && b.k === "num" && isInt(b.v)) {
        return step({ k: "pow", a: a.a, b: numE(fmul(a.b.v, b.v)) });
      }
      // exp(u)^n = exp(n·u)
      if (a.k === "fn" && a.name === "exp" && b.k === "num") return step({ k: "fn", name: "exp", a: { k: "mul", args: [b, a.a] } });
      // (a·b)^n = aⁿ·bⁿ con n entero
      if (a.k === "mul" && b.k === "num" && isInt(b.v)) return step({ k: "mul", args: a.args.map((f) => ({ k: "pow", a: f, b })) });
      return { k: "pow", a, b };
    }
    case "mul": {
      // Aplanar y simplificar los factores.
      const flat: Expr[] = [];
      for (const f of e.args.map(step)) {
        if (f.k === "mul") flat.push(...f.args);
        else flat.push(f);
      }
      let coef = ONE;
      // Agrupar por base: exponentes que se suman.
      const groups = new Map<string, { base: Expr; exps: Expr[]; order: number }>();
      let order = 0;
      const exps: Array<{ base: Expr; exps: Expr[]; order: number }> = [];
      for (const f of flat) {
        if (f.k === "num") {
          coef = fmul(coef, f.v);
          continue;
        }
        // exp(a)·exp(b) = exp(a + b)
        const [base, ex] = f.k === "fn" && f.name === "exp" ? [{ k: "const", name: "e" } as Expr, f.a] : splitPow(f);
        const k = canonKey(base);
        const g = groups.get(k);
        if (g) g.exps.push(ex);
        else {
          const ng = { base, exps: [ex], order: order++ };
          groups.set(k, ng);
          exps.push(ng);
        }
      }
      if (isZero(coef)) return N(0);
      const factors: Expr[] = [];
      for (const g of exps) {
        const ex = g.exps.length === 1 ? g.exps[0]! : step({ k: "add", args: g.exps });
        if (g.base.k === "const" && g.base.name === "e" && !(ex.k === "num" && equals(ex.v, ONE))) {
          if (ex.k === "num" && isZero(ex.v)) continue;
          factors.push({ k: "fn", name: "exp", a: ex });
          continue;
        }
        const p = g.exps.length === 1 ? (ex.k === "num" && equals(ex.v, ONE) ? g.base : { k: "pow" as const, a: g.base, b: ex }) : step({ k: "pow", a: g.base, b: ex });
        if (p.k === "num") coef = fmul(coef, p.v);
        else if (p.k === "mul") {
          for (const q of p.args) {
            if (q.k === "num") coef = fmul(coef, q.v);
            else factors.push(q);
          }
        } else factors.push(p);
      }
      if (isZero(coef)) return N(0);
      const sorted = factors.map((f, i) => ({ f, i })).sort((a, b) => factorRank(a.f) - factorRank(b.f) || a.i - b.i).map((x) => x.f);
      return mkMul(coef, sorted);
    }
    case "add": {
      const flat: Expr[] = [];
      for (const t of e.args.map(step)) {
        if (t.k === "add") flat.push(...t.args);
        else flat.push(t);
      }
      let constant = ZERO;
      const terms = new Map<string, { rest: Expr; coef: Frac; order: number }>();
      let order = 0;
      for (const t of flat) {
        const [c, rest] = splitCoef(t);
        if (rest === null) {
          constant = fadd(constant, c);
          continue;
        }
        const k = canonKey(rest);
        const prev = terms.get(k);
        if (prev) prev.coef = fadd(prev.coef, c);
        else terms.set(k, { rest, coef: c, order: order++ });
      }
      const out: Expr[] = [];
      for (const t of [...terms.values()].sort((a, b) => a.order - b.order)) {
        if (isZero(t.coef)) continue;
        const restFactors = t.rest.k === "mul" ? t.rest.args : [t.rest];
        out.push(mkMul(t.coef, restFactors));
      }
      if (!isZero(constant)) out.push(numE(constant));
      if (out.length === 0) return N(0);
      return out.length === 1 ? out[0]! : { k: "add", args: out };
    }
  }
}

/** Desarrolla las sumas y productos polinómicos cuando el desarrollo no es más largo. */
function expandPolys(e: Expr): Expr {
  const rec = (x: Expr): Expr => {
    switch (x.k) {
      case "add":
      case "mul": {
        const y: Expr = { k: x.k, args: x.args.map(rec) };
        const p = exprToPoly(y);
        if (p) {
          const ex = polyToExpr(p);
          if (exprSize(ex) <= exprSize(y)) return ex;
        }
        return y;
      }
      case "div":
      case "pow":
        return { k: x.k, a: rec(x.a), b: rec(x.b) };
      case "neg":
      case "fn":
        return { ...x, a: rec(x.a) };
      case "d":
        return { k: "d", a: rec(x.a), v: x.v };
      default:
        return x;
    }
  };
  return rec(e);
}

/**
 * En una suma, reparte los productos por una suma (a·(b + c) = a·b + a·c) si así, después de juntar
 * términos, queda más corta: eˣ(eˣ + 1) − e²ˣ = eˣ.
 */
function distributeIfShorter(e: Expr): Expr {
  const rec = (x: Expr): Expr => {
    switch (x.k) {
      case "add": {
        const y: Expr = { k: "add", args: x.args.map(rec) };
        const spread: Expr[] = [];
        let changed = false;
        for (const t of y.args) {
          const fs = t.k === "mul" ? t.args : [t];
          const idx = fs.findIndex((f) => f.k === "add");
          if (t.k !== "mul" || idx < 0) {
            spread.push(t);
            continue;
          }
          changed = true;
          const others = fs.filter((_, i) => i !== idx);
          for (const part of (fs[idx] as { args: Expr[] }).args) spread.push({ k: "mul", args: [...others, part] });
        }
        if (!changed) return y;
        const z = step({ k: "add", args: spread });
        return exprSize(z) < exprSize(y) ? z : y;
      }
      case "mul":
        return { k: "mul", args: x.args.map(rec) };
      case "div":
      case "pow":
        return { k: x.k, a: rec(x.a), b: rec(x.b) };
      case "neg":
      case "fn":
        return { ...x, a: rec(x.a) };
      case "d":
        return { k: "d", a: rec(x.a), v: x.v };
      default:
        return x;
    }
  };
  return rec(e);
}

/** Forma simplificada interna (sin restas ni cocientes: a + (−1)·b, a·b⁻¹). */
export function simplify(e: Expr): Expr {
  let cur = step(e);
  for (let i = 0; i < 6; i++) {
    const next = step(distributeIfShorter(expandPolys(cur)));
    if (canonKey(next) === canonKey(cur)) return next;
    cur = next;
  }
  return cur;
}

// ---------------------------------------------------------------- Escritura de libro

/** Vuelve a escribir la forma interna como en un libro: fracciones, raíces y restas. */
export function pretty(e: Expr): Expr {
  switch (e.k) {
    case "num":
    case "const":
    case "var":
      return e;
    case "d":
      return { k: "d", a: pretty(e.a), v: e.v };
    case "fn":
      return { k: "fn", name: e.name, a: pretty(e.a) };
    case "add":
      return { k: "add", args: e.args.map(pretty) };
    case "neg":
      return { k: "neg", a: pretty(e.a) };
    case "div":
      return { k: "div", a: pretty(e.a), b: pretty(e.b) };
    case "pow":
    case "mul": {
      const factors = e.k === "mul" ? e.args : [e];
      let coef = ONE;
      const top: Expr[] = [];
      const bottom: Expr[] = [];
      for (const f of factors) {
        if (f.k === "num") {
          coef = fmul(coef, f.v);
          continue;
        }
        if (f.k === "pow" && f.b.k === "num") {
          const ex = f.b.v;
          const base = pretty(f.a);
          const target = ex.n < 0n ? bottom : top;
          const m = { n: abs(ex.n), d: ex.d };
          if (m.d === 2n && m.n === 1n) target.push({ k: "fn", name: "sqrt", a: base });
          else if (equals(m, ONE)) target.push(base);
          else target.push({ k: "pow", a: base, b: numE(m) });
          continue;
        }
        top.push(f.k === "pow" ? { k: "pow", a: pretty(f.a), b: pretty(f.b) } : pretty(f));
      }
      const negative = coef.n < 0n;
      const cn = abs(coef.n);
      const numer: Expr[] = cn !== 1n || top.length === 0 ? [numE(frac(cn)), ...top] : top;
      if (coef.d !== 1n) bottom.unshift(numE(frac(coef.d)));
      const mulOf = (xs: Expr[]): Expr => (xs.length === 1 ? xs[0]! : { k: "mul", args: xs });
      let out: Expr = bottom.length > 0 ? { k: "div", a: mulOf(numer), b: mulOf(bottom) } : mulOf(numer);
      // Un coeficiente fraccionario delante queda mejor como fracción: (1/2)·x → x/2.
      if (negative) out = out.k === "mul" && out.args[0]?.k === "num" ? { k: "mul", args: [numE(frac(-cn)), ...out.args.slice(1)] } : { k: "neg", a: out };
      return out;
    }
  }
}

/** Simplificada y escrita como en un libro. */
export const tidy = (e: Expr): Expr => pretty(simplify(e));

/** Texto canónico de una expresión simplificada (para comparar sin importar el orden). */
export const simplifiedKey = (e: Expr): string => canonKey(simplify(e));

/** Texto lineal de la forma simplificada. */
export const tidyPlain = (e: Expr): string => toPlain(tidy(e));
