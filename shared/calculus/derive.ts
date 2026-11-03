// Derivación simbólica por reglas (suma, factor constante, producto, cociente, potencia, cadena y
// derivadas elementales), derivadas parciales, gradiente y hessiana. Además, para los pasos: qué regla
// toca a cada derivada sin hacer (u)′ y cómo queda al aplicarla una sola vez, dejando sin hacer las
// derivadas de dentro (expandD). Así se construye la solución paso a paso y se reconoce la regla que
// la persona dice usar.
import { frac, ONE, type Frac } from "../rational.ts";
import { dependsOn, hasD, type Expr, type FnName, type VarName } from "./expr.ts";
import { simplify, tidy } from "./simplify.ts";

const numE = (v: Frac): Expr => ({ k: "num", v });
const N = (n: number, den = 1): Expr => numE(frac(BigInt(n), BigInt(den)));
const D = (a: Expr, v: VarName): Expr => ({ k: "d", a, v });
const mulOf = (...xs: Expr[]): Expr => (xs.length === 1 ? xs[0]! : { k: "mul", args: xs });

export const RULES = [
  { id: "suma", name: "Regla de la suma", formula: "(u ± v)′ = u′ ± v′", tex: "(u \\pm v)' = u' \\pm v'" },
  { id: "constante", name: "Factor constante", formula: "(k·u)′ = k·u′", tex: "(k\\,u)' = k\\,u'" },
  { id: "producto", name: "Regla del producto", formula: "(u·v)′ = u′·v + u·v′", tex: "(u\\,v)' = u'\\,v + u\\,v'" },
  { id: "cociente", name: "Regla del cociente", formula: "(u/v)′ = (u′·v − u·v′)/v²", tex: "\\left(\\frac{u}{v}\\right)' = \\frac{u'\\,v - u\\,v'}{v^2}" },
  { id: "potencia", name: "Regla de la potencia", formula: "(xⁿ)′ = n·xⁿ⁻¹", tex: "(x^n)' = n\\,x^{n-1}" },
  { id: "cadena", name: "Regla de la cadena", formula: "(f(u))′ = f′(u)·u′", tex: "\\big(f(u)\\big)' = f'(u)\\,u'" },
  {
    id: "elementales",
    name: "Derivadas elementales",
    formula: "k′ = 0, x′ = 1, (sen x)′ = cos x, (cos x)′ = −sen x, (eˣ)′ = eˣ, (ln x)′ = 1/x…",
    tex: "k' = 0,\\ x' = 1,\\ (\\operatorname{sen} x)' = \\cos x,\\ (\\cos x)' = -\\operatorname{sen} x,\\ (e^x)' = e^x,\\ (\\ln x)' = \\frac{1}{x}",
  },
] as const;
export type RuleId = (typeof RULES)[number]["id"];
export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, (typeof RULES)[number]>;
export const isRuleId = (x: unknown): x is RuleId => typeof x === "string" && RULES.some((r) => r.id === x);

const isConst = (e: Expr, v: VarName) => !dependsOn(e, v);
const isTheVar = (e: Expr, v: VarName) => e.k === "var" && e.name === v;

/**
 * Reglas que encajan con (u)′, la primera la principal. Por ejemplo, (sen 2x)′ es la cadena; (3x²)′
 * es el factor constante; (x³)′ es la potencia; (√x)′ es una elemental o la potencia.
 */
export function rulesFor(u: Expr, v: VarName = "x"): RuleId[] {
  if (isConst(u, v)) return ["elementales", "constante"];
  switch (u.k) {
    case "var":
      return ["elementales", "potencia"];
    case "add":
      return ["suma"];
    case "neg":
      return ["constante", "suma"];
    case "mul": {
      const nonConst = u.args.filter((a) => !isConst(a, v)).length;
      return nonConst <= 1 ? ["constante"] : ["producto"];
    }
    case "div":
      if (isConst(u.b, v)) return ["constante", "cociente"];
      if (isConst(u.a, v)) return ["cociente", "potencia", "cadena"];
      return ["cociente"];
    case "pow":
      if (isConst(u.b, v)) return isTheVar(u.a, v) ? ["potencia"] : ["cadena", "potencia"];
      if (isConst(u.a, v)) return isTheVar(u.b, v) ? ["elementales"] : ["cadena", "elementales"];
      return ["cadena"];
    case "fn":
      if (isTheVar(u.a, v)) return u.name === "sqrt" ? ["elementales", "potencia"] : ["elementales"];
      return u.name === "sqrt" ? ["cadena", "potencia"] : ["cadena"];
    case "d":
      return ["elementales"];
    default:
      return ["elementales"];
  }
}

/** f′(u) para cada función elemental, con u ya puesto. */
function outer(name: FnName, u: Expr): Expr {
  switch (name) {
    case "sin":
      return { k: "fn", name: "cos", a: u };
    case "cos":
      return { k: "neg", a: { k: "fn", name: "sin", a: u } };
    case "tan":
      return { k: "div", a: N(1), b: { k: "pow", a: { k: "fn", name: "cos", a: u }, b: N(2) } };
    case "exp":
      return { k: "fn", name: "exp", a: u };
    case "ln":
      return { k: "div", a: N(1), b: u };
    case "sqrt":
      return { k: "div", a: N(1), b: { k: "mul", args: [N(2), { k: "fn", name: "sqrt", a: u }] } };
    case "abs":
      return { k: "div", a: u, b: { k: "fn", name: "abs", a: u } };
  }
}

/** Multiplica por u′ salvo que u sea la variable (u′ = 1): así (sen x)′ queda cos x, no cos x · (x)′. */
const chain = (f: Expr, u: Expr, v: VarName): Expr => (isTheVar(u, v) ? f : mulOf(f, D(u, v)));

/**
 * Aplica una vez la regla que toca a (u)′ y deja sin hacer las derivadas de dentro. Las constantes y
 * la variable se derivan del todo (k′ = 0, x′ = 1).
 */
export function expandD(u: Expr, v: VarName = "x"): Expr {
  if (isConst(u, v)) return N(0);
  switch (u.k) {
    case "var":
      return N(1);
    case "add":
      return { k: "add", args: u.args.map((a) => D(a, v)) };
    case "neg":
      return { k: "neg", a: D(u.a, v) };
    case "mul": {
      const consts = u.args.filter((a) => isConst(a, v));
      const rest = u.args.filter((a) => !isConst(a, v));
      if (rest.length === 1) return mulOf(...consts, D(rest[0]!, v));
      // Producto de dos (o más) factores: u′·v + u·v′; el factor constante se queda delante.
      const terms = rest.map((_, i) => mulOf(...rest.map((f, j) => (i === j ? D(f, v) : f))));
      const sumE: Expr = { k: "add", args: terms };
      return consts.length > 0 ? mulOf(...consts, sumE) : sumE;
    }
    case "div":
      if (isConst(u.b, v)) return { k: "div", a: D(u.a, v), b: u.b };
      return {
        k: "div",
        a: { k: "add", args: [mulOf(D(u.a, v), u.b), { k: "neg", a: mulOf(u.a, D(u.b, v)) }] },
        b: { k: "pow", a: u.b, b: N(2) },
      };
    case "pow": {
      if (isConst(u.b, v)) {
        const n = u.b;
        const lower: Expr = n.k === "num" ? numE({ n: n.v.n - n.v.d, d: n.v.d }) : { k: "add", args: [n, N(-1)] };
        return chain(mulOf(n, { k: "pow", a: u.a, b: lower }), u.a, v);
      }
      if (isConst(u.a, v)) {
        // aᵘ = aᵘ·ln a·u′ (con a = e, ln e = 1).
        const ln: Expr[] = u.a.k === "const" && u.a.name === "e" ? [] : [{ k: "fn", name: "ln", a: u.a }];
        return chain(mulOf(u, ...ln), u.b, v);
      }
      // u^w = e^(w·ln u): (u^w)′ = u^w·(w′·ln u + w·u′/u).
      return mulOf(u, { k: "add", args: [mulOf(D(u.b, v), { k: "fn", name: "ln", a: u.a }), mulOf(u.b, { k: "div", a: D(u.a, v), b: u.a })] });
    }
    case "fn":
      return chain(outer(u.name, u.a), u.a, v);
    case "d":
      // Derivada de una derivada: primero se hace la de dentro.
      return D(derivativeRaw(u.a, u.v), v);
    default:
      return N(0);
  }
}

/** Sustituye la primera derivada sin hacer (en profundidad, de izquierda a derecha) por f(arg). */
export function mapD(e: Expr, f: (arg: Expr, v: VarName) => Expr): Expr {
  switch (e.k) {
    case "d":
      return f(hasD(e.a) ? mapD(e.a, f) : e.a, e.v);
    case "add":
    case "mul":
      return { k: e.k, args: e.args.map((a) => mapD(a, f)) };
    case "div":
    case "pow":
      return { k: e.k, a: mapD(e.a, f), b: mapD(e.b, f) };
    case "neg":
    case "fn":
      return { ...e, a: mapD(e.a, f) };
    default:
      return e;
  }
}

/** Derivada completa sin simplificar. */
export function derivativeRaw(e: Expr, v: VarName = "x"): Expr {
  let cur = expandD(e, v);
  // Cada expansión baja un nivel: como mucho tantas vueltas como profundidad.
  for (let i = 0; i < 200 && hasD(cur); i++) cur = mapD(cur, (a, w) => expandD(a, w));
  return cur;
}

/** Derivada respecto de v, simplificada (forma interna). */
export const derivative = (e: Expr, v: VarName = "x"): Expr => simplify(derivativeRaw(e, v));

/** Derivada escrita como en un libro. */
export const derivativeTidy = (e: Expr, v: VarName = "x"): Expr => tidy(derivativeRaw(e, v));

/** Resuelve todas las derivadas sin hacer de una línea de una derivación. */
export const resolveD = (e: Expr): Expr => (hasD(e) ? mapD(e, (a, v) => derivativeRaw(a, v)) : e);

/** Gradiente (∂f/∂x, ∂f/∂y), simplificado. */
export const gradient = (f: Expr): [Expr, Expr] => [derivative(f, "x"), derivative(f, "y")];

/** Hessiana 2×2 simbólica: [[fxx, fxy], [fyx, fyy]]. */
export function hessian(f: Expr): [[Expr, Expr], [Expr, Expr]] {
  const [fx, fy] = gradient(f);
  const fxy = derivative(fx, "y");
  return [
    [derivative(fx, "x"), fxy],
    [fxy, derivative(fy, "y")],
  ];
}

/** ¿Es la derivada de una constante (0)? */
export const isZeroExpr = (e: Expr) => e.k === "num" && e.v.n === 0n;
export const isOneExpr = (e: Expr) => e.k === "num" && e.v.n === ONE.n && e.v.d === ONE.d;
