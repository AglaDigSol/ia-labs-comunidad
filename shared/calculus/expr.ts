// Expresiones de funciones reales de x (y de x, y en varias variables): el árbol, su lectura en
// texto (toPlain, que el analizador vuelve a leer igual), su escritura de libro en KaTeX (toTex) y su
// evaluación numérica segura (sin eval ni Function). Los números son racionales exactos, así que 1/2
// o 3/4 no pierden nada al simplificar. El nodo «d» es una derivada sin hacer, (u)′, la que se escribe
// en los pasos intermedios de una derivación.
import { formatFrac, frac, toNumber, type Frac } from "../rational.ts";

export const FUNCTIONS = ["sin", "cos", "tan", "exp", "ln", "sqrt", "abs"] as const;
export type FnName = (typeof FUNCTIONS)[number];
export type VarName = "x" | "y";

export type Expr =
  | { k: "num"; v: Frac }
  | { k: "const"; name: "e" | "pi" }
  | { k: "var"; name: VarName }
  | { k: "add"; args: Expr[] }
  | { k: "mul"; args: Expr[] }
  | { k: "div"; a: Expr; b: Expr }
  | { k: "pow"; a: Expr; b: Expr }
  | { k: "neg"; a: Expr }
  | { k: "fn"; name: FnName; a: Expr }
  /** Derivada sin hacer de `a` respecto de `v`: (a)′ o ∂a/∂v. */
  | { k: "d"; a: Expr; v: VarName };

// ---------------------------------------------------------------- Constructores

export const num = (n: number | bigint, d: number | bigint = 1): Expr => ({ k: "num", v: frac(BigInt(n), BigInt(d)) });
export const numF = (v: Frac): Expr => ({ k: "num", v });
export const X: Expr = { k: "var", name: "x" };
export const Y: Expr = { k: "var", name: "y" };
export const E: Expr = { k: "const", name: "e" };
export const PI: Expr = { k: "const", name: "pi" };
export const add = (...args: Expr[]): Expr => (args.length === 1 ? args[0]! : { k: "add", args });
export const mul = (...args: Expr[]): Expr => (args.length === 1 ? args[0]! : { k: "mul", args });
export const div = (a: Expr, b: Expr): Expr => ({ k: "div", a, b });
export const pow = (a: Expr, b: Expr): Expr => ({ k: "pow", a, b });
export const neg = (a: Expr): Expr => ({ k: "neg", a });
export const sub = (a: Expr, b: Expr): Expr => add(a, neg(b));
export const fn = (name: FnName, a: Expr): Expr => ({ k: "fn", name, a });
export const d = (a: Expr, v: VarName = "x"): Expr => ({ k: "d", a, v });

export const isNum = (e: Expr): e is { k: "num"; v: Frac } => e.k === "num";
export const isNumValue = (e: Expr, n: number) => e.k === "num" && e.v.d === 1n && e.v.n === BigInt(n);

/** Variables que aparecen (x antes que y). */
export function exprVars(e: Expr): VarName[] {
  const found = new Set<VarName>();
  const walk = (x: Expr) => {
    switch (x.k) {
      case "var":
        found.add(x.name);
        return;
      case "add":
      case "mul":
        x.args.forEach(walk);
        return;
      case "div":
      case "pow":
        walk(x.a);
        walk(x.b);
        return;
      case "neg":
      case "fn":
        walk(x.a);
        return;
      case "d":
        walk(x.a);
        return;
      default:
        return;
    }
  };
  walk(e);
  return (["x", "y"] as const).filter((v) => found.has(v));
}

/** ¿Depende de la variable v? */
export const dependsOn = (e: Expr, v: VarName) => exprVars(e).includes(v);

/** ¿Tiene derivadas sin hacer? */
export function hasD(e: Expr): boolean {
  switch (e.k) {
    case "d":
      return true;
    case "add":
    case "mul":
      return e.args.some(hasD);
    case "div":
    case "pow":
      return hasD(e.a) || hasD(e.b);
    case "neg":
    case "fn":
      return hasD(e.a);
    default:
      return false;
  }
}

/** Número de nodos (para limitar tamaños). */
export function exprSize(e: Expr): number {
  switch (e.k) {
    case "add":
    case "mul":
      return 1 + e.args.reduce((s, a) => s + exprSize(a), 0);
    case "div":
    case "pow":
      return 1 + exprSize(e.a) + exprSize(e.b);
    case "neg":
    case "fn":
    case "d":
      return 1 + exprSize(e.a);
    default:
      return 1;
  }
}

/** Igualdad estructural exacta. */
export function exprEquals(a: Expr, b: Expr): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case "num":
      return b.k === "num" && a.v.n === b.v.n && a.v.d === b.v.d;
    case "const":
    case "var":
      return (b as typeof a).name === a.name;
    case "add":
    case "mul": {
      const bb = b as typeof a;
      return a.args.length === bb.args.length && a.args.every((x, i) => exprEquals(x, bb.args[i]!));
    }
    case "div":
    case "pow": {
      const bb = b as typeof a;
      return exprEquals(a.a, bb.a) && exprEquals(a.b, bb.b);
    }
    case "neg":
      return exprEquals(a.a, (b as typeof a).a);
    case "fn": {
      const bb = b as typeof a;
      return a.name === bb.name && exprEquals(a.a, bb.a);
    }
    case "d": {
      const bb = b as typeof a;
      return a.v === bb.v && exprEquals(a.a, bb.a);
    }
  }
}

// ---------------------------------------------------------------- Evaluación

export type Env = { x?: number; y?: number };

/**
 * Valor numérico. Las derivadas sin hacer no se pueden evaluar aquí (NaN): antes se resuelven con
 * resolveD (derive.ts). Fuera del dominio sale NaN o ±∞, como en JavaScript.
 */
export function evaluate(e: Expr, env: Env): number {
  switch (e.k) {
    case "num":
      return toNumber(e.v);
    case "const":
      return e.name === "e" ? Math.E : Math.PI;
    case "var":
      return env[e.name] ?? NaN;
    case "add": {
      let s = 0;
      for (const a of e.args) s += evaluate(a, env);
      return s;
    }
    case "mul": {
      let p = 1;
      for (const a of e.args) p *= evaluate(a, env);
      return p;
    }
    case "div":
      return evaluate(e.a, env) / evaluate(e.b, env);
    case "pow":
      return powReal(evaluate(e.a, env), e.b);
    case "neg":
      return -evaluate(e.a, env);
    case "fn": {
      const a = evaluate(e.a, env);
      switch (e.name) {
        case "sin":
          return Math.sin(a);
        case "cos":
          return Math.cos(a);
        case "tan":
          return Math.tan(a);
        case "exp":
          return Math.exp(a);
        case "ln":
          return a > 0 ? Math.log(a) : NaN;
        case "sqrt":
          return a >= 0 ? Math.sqrt(a) : NaN;
        case "abs":
          return Math.abs(a);
      }
      return NaN;
    }
    case "d":
      return NaN;
  }

  // Potencia real: con exponente racional de denominador impar, la base negativa vale (∛−8 = −2).
  function powReal(base: number, expo: Expr): number {
    const q = constFrac(expo);
    if (q) {
      const { n, d: den } = q;
      if (base < 0 && den !== 1n) {
        if (den % 2n === 0n) return NaN;
        const r = Math.pow(-base, Number(n) / Number(den));
        return n % 2n === 0n ? r : -r;
      }
      return Math.pow(base, Number(n) / Number(den));
    }
    const p = evaluate(expo, env);
    if (base < 0 && !Number.isInteger(p)) return NaN;
    return Math.pow(base, p);
  }
}

/** Exponente racional escrito como número, −número o fracción (1/3, −1/2); si no, null. */
function constFrac(e: Expr): Frac | null {
  if (e.k === "num") return e.v;
  if (e.k === "neg") {
    const a = constFrac(e.a);
    return a && { n: -a.n, d: a.d };
  }
  if (e.k === "div" && e.a.k === "num" && e.b.k === "num" && e.b.v.n !== 0n) {
    return frac(e.a.v.n * e.b.v.d, e.a.v.d * e.b.v.n);
  }
  return null;
}

/** Compila a una función de x (y y) que se puede llamar muchas veces (gráficas, descenso). */
export const compile =
  (e: Expr) =>
  (x: number, y = 0): number =>
    evaluate(e, { x, y });

// ---------------------------------------------------------------- Texto

const FN_PLAIN: Record<FnName, string> = { sin: "sen", cos: "cos", tan: "tan", exp: "exp", ln: "ln", sqrt: "sqrt", abs: "abs" };

const fracPlain = (v: Frac) => formatFrac(v);

/** Precedencias para decidir paréntesis: suma < producto < signo < potencia < átomo. */
const PREC = { add: 1, mul: 2, div: 2, neg: 3, pow: 4, atom: 5 } as const;

function precOf(e: Expr): number {
  switch (e.k) {
    case "add":
      return PREC.add;
    case "mul":
    case "div":
      return PREC.mul;
    case "neg":
      return PREC.neg;
    case "pow":
      return PREC.pow;
    case "fn":
      // exp(u) se escribe e^u: como base de una potencia necesita paréntesis.
      return e.name === "exp" ? PREC.pow : PREC.atom;
    case "num":
      return e.v.n < 0n ? PREC.neg : e.v.d !== 1n ? PREC.mul : PREC.atom;
    default:
      return PREC.atom;
  }
}

/** ¿Empieza con signo menos al escribirlo? (para escribir «a − b» en vez de «a + −b»). */
function negativeTerm(e: Expr): Expr | null {
  if (e.k === "neg") return e.a;
  if (e.k === "num" && e.v.n < 0n) return { k: "num", v: { n: -e.v.n, d: e.v.d } };
  if (e.k === "mul" && e.args[0]?.k === "num" && e.args[0].v.n < 0n) {
    const c = e.args[0].v;
    const rest = e.args.slice(1);
    if (c.n === -1n && c.d === 1n) return rest.length === 1 ? rest[0]! : { k: "mul", args: rest };
    return { k: "mul", args: [{ k: "num", v: { n: -c.n, d: c.d } }, ...rest] };
  }
  if (e.k === "mul" && e.args[0]?.k === "neg") {
    const rest = e.args.slice(1);
    return { k: "mul", args: [e.args[0].a, ...rest] };
  }
  if (e.k === "div") {
    const a = negativeTerm(e.a);
    if (a) return { k: "div", a, b: e.b };
  }
  return null;
}

/**
 * Texto lineal que el analizador lee igual: «3x^2 − 2·sen(x) + 1». Los productos se escriben con
 * «·» salvo número delante de letra (2x) o letras juntas (xy); las funciones, siempre con paréntesis.
 */
export function toPlain(e: Expr): string {
  return plain(e);

  function wrap(x: Expr, min: number): string {
    const s = plain(x);
    return precOf(x) < min ? `(${s})` : s;
  }

  function plain(x: Expr): string {
    switch (x.k) {
      case "num":
        return fracPlain(x.v).replace(/^-/, "−");
      case "const":
        return x.name === "e" ? "e" : "π";
      case "var":
        return x.name;
      case "add":
        return x.args
          .map((t, i) => {
            const m = negativeTerm(t);
            if (i === 0) return m ? `−${wrap(m, PREC.mul)}` : wrap(t, PREC.add + 1);
            return m ? ` − ${wrap(m, PREC.mul)}` : ` + ${wrap(t, PREC.add + 1)}`;
          })
          .join("");
      case "mul": {
        let out = "";
        x.args.forEach((f, i) => {
          const s = f.k === "num" && f.v.d !== 1n ? `(${plain(f)})` : wrap(f, PREC.pow);
          if (i === 0) {
            // Coeficiente negativo delante: −6x (se lee igual: (−6)·x).
            out = f.k === "num" && f.v.n < 0n ? (f.v.d === 1n ? plain(f) : `(${plain(f)})`) : f.k === "neg" ? plain(f) : s;
            return;
          }
          const prev = x.args[i - 1]!;
          const tight = (prev.k === "num" && prev.v.d === 1n && startsWithLetter(f)) || (isLetterAtom(prev) && isLetterAtom(f));
          out += tight ? s : `·${s}`;
        });
        return out;
      }
      case "div":
        return `${wrap(x.a, PREC.mul)}/${wrap(x.b, PREC.pow)}`;
      case "pow": {
        const base = x.a.k === "num" && (x.a.v.n < 0n || x.a.v.d !== 1n) ? `(${plain(x.a)})` : wrap(x.a, PREC.atom);
        const ex = x.b.k === "num" && x.b.v.d === 1n && x.b.v.n >= 0n ? plain(x.b) : x.b.k === "var" || x.b.k === "const" ? plain(x.b) : `(${plain(x.b)})`;
        return `${base}^${ex}`;
      }
      case "neg":
        return `−${wrap(x.a, PREC.mul)}`;
      case "fn":
        if (x.name === "exp") {
          const bare = x.a.k === "var" || x.a.k === "const" || (x.a.k === "num" && x.a.v.d === 1n && x.a.v.n >= 0n);
          return bare ? `e^${plain(x.a)}` : `e^(${plain(x.a)})`;
        }
        return `${FN_PLAIN[x.name]}(${plain(x.a)})`;
      case "d":
        return x.v === "x" ? `(${plain(x.a)})′` : `∂${x.v}(${plain(x.a)})`;
    }
  }
}

const isLetterAtom = (e: Expr) => e.k === "var" || (e.k === "pow" && e.a.k === "var");
/** El texto empieza por una letra que no se puede pegar a un número de forma ambigua. */
function startsWithLetter(e: Expr): boolean {
  if (e.k === "var") return true;
  if (e.k === "pow") return e.a.k === "var";
  return false;
}

// ---------------------------------------------------------------- KaTeX

const FN_TEX: Record<Exclude<FnName, "sqrt" | "abs" | "exp">, string> = {
  sin: "\\operatorname{sen}",
  cos: "\\cos",
  tan: "\\tan",
  ln: "\\ln",
};

function fracTexOf(v: Frac): string {
  const n = v.n < 0n ? -v.n : v.n;
  const s = v.n < 0n ? "-" : "";
  return v.d === 1n ? `${s}${n}` : `${s}\\frac{${n}}{${v.d}}`;
}

/** ¿El argumento de una función se puede escribir sin paréntesis? (sen x, ln 2x no: ln(2x)). */
const bareArg = (a: Expr) => a.k === "var" || a.k === "const" || (a.k === "num" && a.v.n >= 0n && a.v.d === 1n);

/** Escritura de libro en KaTeX: 3x^{2} - 2\operatorname{sen} x + \frac{1}{x}. */
export function toTex(e: Expr): string {
  return tex(e);

  function wrap(x: Expr, min: number): string {
    const s = tex(x);
    return precOf(x) < min ? `\\left(${s}\\right)` : s;
  }

  function tex(x: Expr): string {
    switch (x.k) {
      case "num":
        return fracTexOf(x.v);
      case "const":
        return x.name === "e" ? "e" : "\\pi";
      case "var":
        return x.name;
      case "add":
        return x.args
          .map((t, i) => {
            const m = negativeTerm(t);
            if (i === 0) return m ? `-${wrap(m, PREC.mul)}` : wrap(t, PREC.add + 1);
            return m ? ` - ${wrap(m, PREC.mul)}` : ` + ${wrap(t, PREC.add + 1)}`;
          })
          .join("");
      case "mul": {
        let out = "";
        x.args.forEach((f, i) => {
          let s = wrap(f, PREC.pow);
          if ((f.k === "num" && f.v.n < 0n) || f.k === "neg") s = i > 0 ? `\\left(${tex(f)}\\right)` : tex(f);
          if (i === 0) {
            out = s;
            return;
          }
          const prev = x.args[i - 1]!;
          // Juntos: número delante de letra, función o paréntesis (2x, 3\sen x); letras seguidas (xy).
          // Con punto: dos números, o detrás de una función sin paréntesis (sen x · cos x).
          const prevBareFn = (prev.k === "fn" && prev.name !== "sqrt" && prev.name !== "abs" && bareArg(prev.a)) || (prev.k === "pow" && prev.a.k === "fn");
          const needDot = f.k === "num" || prevBareFn || (prev.k === "num" && f.k === "div") || f.k === "div";
          out += needDot ? ` \\cdot ${s}` : f.k === "fn" || prev.k === "fn" ? `\\,${s}` : s;
        });
        return out;
      }
      case "div":
        return `\\frac{${tex(x.a)}}{${tex(x.b)}}`;
      case "pow": {
        if (x.a.k === "fn" && x.a.name !== "sqrt" && x.a.name !== "abs" && x.a.name !== "exp" && x.b.k === "num" && x.b.v.d === 1n && x.b.v.n > 0n) {
          // sen² x
          const arg = bareArg(x.a.a) ? ` ${tex(x.a.a)}` : `\\left(${tex(x.a.a)}\\right)`;
          return `${FN_TEX[x.a.name]}^{${tex(x.b)}}${arg}`;
        }
        const base = x.a.k === "num" && (x.a.v.n < 0n || x.a.v.d !== 1n) ? `\\left(${tex(x.a)}\\right)` : x.a.k === "fn" && x.a.name !== "sqrt" && x.a.name !== "abs" ? `\\left(${tex(x.a)}\\right)` : wrap(x.a, PREC.atom);
        return `${base}^{${tex(x.b)}}`;
      }
      case "neg":
        return `-${wrap(x.a, PREC.mul)}`;
      case "fn": {
        if (x.name === "sqrt") return `\\sqrt{${tex(x.a)}}`;
        if (x.name === "abs") return `\\left|${tex(x.a)}\\right|`;
        if (x.name === "exp") return `e^{${tex(x.a)}}`;
        return bareArg(x.a) ? `${FN_TEX[x.name]} ${tex(x.a)}` : `${FN_TEX[x.name]}\\left(${tex(x.a)}\\right)`;
      }
      case "d":
        return x.v === "x" ? `\\left(${tex(x.a)}\\right)'` : `\\frac{\\partial}{\\partial ${x.v}}\\left(${tex(x.a)}\\right)`;
    }
  }
}

/** Lectura en voz (para lectores de pantalla): el texto lineal con palabras para lo ambiguo. */
export const toSpoken = (e: Expr): string =>
  toPlain(e)
    .replace(/\^/g, " elevado a ")
    .replace(/·/g, " por ")
    .replace(/\//g, " entre ")
    .replace(/′/g, " derivada")
    .replace(/\s+/g, " ")
    .trim();

/** Número decimal con coma, para mostrar (sin ceros de más). */
export function decimalText(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? "indefinido" : x > 0 ? "∞" : "−∞";
  const r = Number(x.toFixed(digits));
  const s = (Object.is(r, -0) ? 0 : r).toString();
  return (s.includes("e") ? x.toPrecision(digits) : s).replace(".", ",").replace("-", "−");
}
