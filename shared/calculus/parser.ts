// Analizador de expresiones de funciones reales: + − · / ^, paréntesis, menos unario, producto
// implícito (2x, 3(x + 1), x y, 2 sen x), las constantes e y π y las funciones sen/sin, cos, tan, exp,
// ln/log (neperiano, como math.log de Python), sqrt/raiz y abs (también |x|). Las derivadas sin hacer
// de los pasos se escriben con prima: (x^2)′ o (x^2)'. Lee también lo que escribe toPlain. Los
// errores dicen qué falla y dónde (posición en el texto), en español.
import { frac, type Frac } from "../rational.ts";
import type { Expr, FnName, VarName } from "./expr.ts";

export const MAX_EXPR_TEXT = 200;
const MAX_DEPTH = 40;

export type CalcParseError = { message: string; start: number; end: number };
export type CalcParse = { ok: true; expr: Expr } | { ok: false; error: CalcParseError };

export const HOW_TO_WRITE_FUNCTION =
  "Potencia: x^2 (o x², o x**2 como en Python). Producto: 2x, 3·x o 3*x. Funciones: sen(x) o sin(x), cos, tan, exp(x) o e^x, ln(x) (log es el mismo), sqrt(x) y |x|. Constantes: e y π (o pi).";

type Tok =
  | { t: "num"; v: Frac; s: number; e: number }
  | { t: "id"; name: string; s: number; e: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" | "^"; s: number; e: number }
  | { t: "open" | "close" | "bar" | "prime"; s: number; e: number };

const FN_ALIASES: Record<string, FnName> = {
  sin: "sin",
  sen: "sin",
  cos: "cos",
  tan: "tan",
  tg: "tan",
  exp: "exp",
  ln: "ln",
  log: "ln",
  sqrt: "sqrt",
  raiz: "sqrt",
  "raíz": "sqrt",
  abs: "abs",
};
// Las más largas primero, para partir «sinx» o «xsen» en piezas conocidas.
const WORDS = [...Object.keys(FN_ALIASES), "pi"].sort((a, b) => b.length - a.length);

const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };

const err = (message: string, start: number, end: number): { ok: false; error: CalcParseError } => ({ ok: false, error: { message, start, end } });

function tokenize(src: string, vars: readonly VarName[]): { ok: true; toks: Tok[] } | { ok: false; error: CalcParseError } {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const start = i;
      while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      // Decimal con punto o con coma (0,5): la coma solo cuenta pegada a cifras por los dos lados.
      if ((src[i] === "." || src[i] === ",") && /[0-9]/.test(src[i + 1] ?? "")) {
        i++;
        while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      }
      const text = src.slice(start, i).replace(",", ".");
      if (text.replace(".", "").length > 12) return err("Número demasiado largo (como mucho 12 cifras).", start, i);
      const [int, dec = ""] = text.split(".");
      const v = frac(BigInt((int || "0") + dec), 10n ** BigInt(dec.length));
      toks.push({ t: "num", v, s: start, e: i });
      continue;
    }
    if (SUPERSCRIPTS[c] !== undefined) {
      const start = i;
      let text = "";
      while (i < src.length && SUPERSCRIPTS[src[i]!] !== undefined) text += SUPERSCRIPTS[src[i++]!]!;
      if (!/^-?[0-9]+$/.test(text)) return err("Exponente en superíndice mal escrito: usa ^ (x^-2).", start, i);
      toks.push({ t: "op", op: "^", s: start, e: start });
      if (text.startsWith("-")) toks.push({ t: "op", op: "-", s: start, e: start + 1 });
      toks.push({ t: "num", v: frac(BigInt(text.replace("-", ""))), s: start, e: i });
      continue;
    }
    if (/[A-Za-zÁÉÍÓÚáéíóúπ]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-zÁÉÍÓÚáéíóúπ]/.test(src[i]!)) i++;
      // Una palabra se parte en funciones, constantes y variables: «xsen» = x · sen, «2xy» = 2·x·y.
      const word = src.slice(start, i);
      let j = 0;
      while (j < word.length) {
        const lower = word.slice(j).toLowerCase();
        const w = WORDS.find((k) => lower.startsWith(k));
        if (w) {
          toks.push({ t: "id", name: w === "pi" ? "pi" : FN_ALIASES[w]!, s: start + j, e: start + j + w.length });
          j += w.length;
          continue;
        }
        const ch = word[j]!;
        if (ch === "π") toks.push({ t: "id", name: "pi", s: start + j, e: start + j + 1 });
        else if (ch === "e") toks.push({ t: "id", name: "e", s: start + j, e: start + j + 1 });
        else if ((vars as readonly string[]).includes(ch)) toks.push({ t: "id", name: ch, s: start + j, e: start + j + 1 });
        else {
          const known = vars.length === 1 ? `la única variable es ${vars[0]}` : `las variables son ${vars.join(" e ")}`;
          return err(`«${ch}» no es una variable ni una función conocida: ${known}.`, start + j, start + j + 1);
        }
        j++;
      }
      continue;
    }
    const single: Record<string, Tok["t"] | "+" | "-" | "*" | "/" | "^"> = {
      "+": "+",
      "-": "-",
      "−": "-",
      "–": "-",
      "*": "*",
      "·": "*",
      "×": "*",
      "⋅": "*",
      "/": "/",
      "÷": "/",
      "^": "^",
      "(": "open",
      "[": "open",
      ")": "close",
      "]": "close",
      "|": "bar",
      "'": "prime",
      "′": "prime",
    };
    // x**2, como en Python, es una potencia.
    if (c === "*" && src[i + 1] === "*") {
      toks.push({ t: "op", op: "^", s: i, e: i + 2 });
      i += 2;
      continue;
    }
    const kind = single[c];
    if (kind === undefined) return err(`El carácter «${c}» no se entiende aquí.`, i, i + 1);
    if (kind === "+" || kind === "-" || kind === "*" || kind === "/" || kind === "^") toks.push({ t: "op", op: kind, s: i, e: i + 1 });
    else toks.push({ t: kind as "open" | "close" | "bar" | "prime", s: i, e: i + 1 });
    i++;
  }
  return { ok: true, toks };
}

class Fail {
  readonly error: CalcParseError;
  constructor(error: CalcParseError) {
    this.error = error;
  }
}

/**
 * Lee una expresión. `vars` son las variables admitidas (por defecto, solo x); `allowPrime` deja
 * escribir derivadas sin hacer, (u)′, para los pasos de una derivación.
 */
export function parseExpr(text: string, opts: { vars?: readonly VarName[]; allowPrime?: boolean } = {}): CalcParse {
  const vars = opts.vars ?? ["x"];
  const src = text;
  if (src.trim() === "") return err("Escribe una expresión.", 0, 0);
  if (src.length > MAX_EXPR_TEXT) return err(`Como mucho ${MAX_EXPR_TEXT} caracteres.`, MAX_EXPR_TEXT, src.length);
  const tk = tokenize(src, vars);
  if (!tk.ok) return tk;
  const toks = tk.toks;
  let p = 0;
  let depth = 0;
  // Dentro de |…| una barra cierra; fuera, abre.
  let barDepth = 0;

  const peek = () => toks[p];
  const fail = (message: string, s: number, e: number): never => {
    throw new Fail({ message, start: s, end: e });
  };
  const endPos = src.length;

  // expr := term (('+'|'-') term)*
  const parseSum = (): Expr => {
    const terms: Expr[] = [parseProduct()];
    for (;;) {
      const t = peek();
      if (t?.t === "op" && (t.op === "+" || t.op === "-")) {
        p++;
        if (!peek() || peek()!.t === "close" || (peek()!.t === "bar" && barDepth > 0)) fail(`Falta un término después de «${t.op === "+" ? "+" : "−"}».`, t.s, t.e);
        const rhs = parseProduct();
        terms.push(t.op === "+" ? rhs : { k: "neg", a: rhs });
      } else break;
    }
    return terms.length === 1 ? terms[0]! : { k: "add", args: terms };
  };

  /** ¿Empieza aquí un factor (para el producto implícito)? */
  const startsFactor = (t: Tok | undefined) =>
    t !== undefined && (t.t === "num" || t.t === "id" || t.t === "open" || (t.t === "bar" && barDepth === 0));

  // term := unary (('*'|'/'| implícito) unary)*
  const parseProduct = (stopAtFn = false): Expr => {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t?.t === "op" && (t.op === "*" || t.op === "/")) {
        // Sin paréntesis, el argumento de una función es solo el producto implícito: sen x · cos x.
        if (stopAtFn) break;
        p++;
        const n = peek();
        if (!startsFactor(n) && !(n?.t === "op" && n.op === "-")) {
          fail(`Falta un factor después de «${t.op === "*" ? "·" : "/"}».`, t.s, t.e);
        }
        const rhs = parseUnary();
        left = t.op === "*" ? mulOf(left, rhs) : { k: "div", a: left, b: rhs };
      } else if (startsFactor(t)) {
        // Sin paréntesis, el argumento de una función acaba en la siguiente función: sen x cos x.
        if (stopAtFn && t!.t === "id" && isFnName(t!.name)) break;
        const rhs = parsePower();
        left = mulOf(left, rhs);
      } else break;
    }
    return left;
  };

  const mulOf = (a: Expr, b: Expr): Expr => (a.k === "mul" ? { k: "mul", args: [...a.args, b] } : { k: "mul", args: [a, b] });

  // unary := '-' unary | '+' unary | power
  const parseUnary = (): Expr => {
    const t = peek();
    if (t?.t === "op" && (t.op === "-" || t.op === "+")) {
      p++;
      if (!peek()) fail(`Falta algo después de «${t.op === "-" ? "−" : "+"}».`, t.s, t.e);
      const a = parseUnary();
      if (t.op === "+") return a;
      // −3 es el número −3 (así −3x se lee y se escribe igual); −x y −2² siguen siendo «menos algo».
      return a.k === "num" ? { k: "num", v: { n: -a.v.n, d: a.v.d } } : { k: "neg", a };
    }
    return parsePower();
  };

  // power := postfix ('^' unary)?   (a la derecha: 2^3^2 = 2^(3^2))
  const parsePower = (): Expr => {
    const base = parsePostfix();
    const t = peek();
    if (t?.t === "op" && t.op === "^") {
      p++;
      if (!peek()) fail("Falta el exponente después de «^».", t.s, t.e);
      const expo = parseUnaryPower();
      return { k: "pow", a: base, b: expo };
    }
    return base;
  };

  // El exponente admite signo: x^-2.
  const parseUnaryPower = (): Expr => {
    const t = peek();
    if (t?.t === "op" && t.op === "-") {
      p++;
      return { k: "neg", a: parseUnaryPower() };
    }
    return parsePower();
  };

  const parsePostfix = (): Expr => {
    let e = parseAtom();
    while (peek()?.t === "prime") {
      const t = peek()!;
      if (!opts.allowPrime) fail("La prima (′) solo se usa en los pasos de una derivada: aquí escribe la función.", t.s, t.e);
      p++;
      e = { k: "d", a: e, v: "x" };
    }
    return e;
  };

  const isFnName = (name: string) => (Object.values(FN_ALIASES) as string[]).includes(name);

  const parseAtom = (): Expr => {
    const t = peek();
    if (!t) return fail("La expresión está incompleta.", endPos, endPos);
    if (++depth > MAX_DEPTH) fail("La expresión anida demasiados niveles.", t.s, t.e);
    try {
      if (t.t === "num") {
        p++;
        return { k: "num", v: t.v };
      }
      if (t.t === "open") {
        p++;
        if (peek()?.t === "close") fail("Paréntesis vacíos.", t.s, peek()!.e);
        const inner = parseSum();
        const c = peek();
        if (c?.t !== "close") fail("Falta cerrar este paréntesis.", t.s, t.e);
        p++;
        return inner;
      }
      if (t.t === "bar") {
        if (barDepth > 0) fail("Barra de valor absoluto sin contenido.", t.s, t.e);
        p++;
        barDepth++;
        const inner = parseSum();
        barDepth--;
        const c = peek();
        if (c?.t !== "bar") fail("Falta la barra que cierra el valor absoluto.", t.s, t.e);
        p++;
        return { k: "fn", name: "abs", a: inner };
      }
      if (t.t === "id") {
        p++;
        if (t.name === "e") return { k: "const", name: "e" };
        if (t.name === "pi") return { k: "const", name: "pi" };
        if (t.name === "x" || t.name === "y") return { k: "var", name: t.name };
        const name = t.name as FnName;
        // Como lo ha escrito la persona (sen o sin), para los mensajes.
        const word = src.slice(t.s, t.e);
        // sen^2(x) = (sen x)^2
        let power: Expr | null = null;
        const caret = peek();
        if (caret?.t === "op" && caret.op === "^") {
          p++;
          const n = peek();
          if (n?.t !== "num") fail(`Detrás de ${word}^ va un número: ${word}^2(x).`, caret.s, caret.e);
          p++;
          power = { k: "num", v: (n as { v: Frac }).v };
        }
        const next = peek();
        let arg: Expr;
        if (next?.t === "open") {
          p++;
          if (peek()?.t === "close") fail(`Falta el argumento de ${word}.`, next.s, peek()!.e);
          arg = parseSum();
          if (peek()?.t !== "close") fail("Falta cerrar este paréntesis.", next.s, next.e);
          p++;
        } else if (startsFactor(next) || (next?.t === "op" && next.op === "-")) {
          // sen x, sen 2x, ln x^2: hasta el siguiente +, −, · o /, o la siguiente función.
          arg = parseProduct(true);
        } else {
          return fail(`Falta el argumento de ${word}: escribe ${word}(x).`, t.s, t.e);
        }
        const call: Expr = { k: "fn", name, a: arg };
        return power ? { k: "pow", a: call, b: power } : call;
      }
      if (t.t === "close") return fail("Sobra este paréntesis de cierre (o falta algo antes).", t.s, t.e);
      if (t.t === "prime") return fail("La prima va detrás de algo: (x^2)′.", t.s, t.e);
      if (t.t === "op") return fail(`Falta algo antes de «${t.op === "*" ? "·" : t.op}».`, t.s, t.e);
      return fail("Barra de valor absoluto inesperada.", t.s, t.e);
    } finally {
      depth--;
    }
  };

  try {
    const expr = parseSum();
    const rest = peek();
    if (rest) {
      if (rest.t === "close") return err("Sobra este paréntesis de cierre.", rest.s, rest.e);
      return err("No se entiende a partir de aquí.", rest.s, src.length);
    }
    return { ok: true, expr };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error };
    throw e;
  }
}
