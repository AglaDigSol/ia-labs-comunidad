// Expresiones de un álgebra de Boole: ⊕ (suma), ⊙ (producto), ′ (complemento), 0 y 1.
// Se leen con el analizador de lógica (shared/logic/parser.ts) en modo Boole: ⊕ es la suma (∨), no la
// disyunción exclusiva, y «xy» es un producto. Internamente se trabaja con sumas y productos n-arios
// aplanados y con los argumentos ordenados, de modo que dos expresiones que solo difieren por
// conmutatividad o asociatividad (B1, B2) tienen la misma clave.
import type { Node } from "../logic/ast.ts";
import { parseFormula, type ParseError, type ParseOptions } from "../logic/parser.ts";

export type BExpr =
  | { k: "var"; name: string }
  | { k: "const"; v: 0 | 1 }
  | { k: "not"; a: BExpr }
  | { k: "or" | "and"; args: BExpr[] };

/** Cómo lee el laboratorio de Boole las fórmulas: ⊕ = suma (∨) y producto por yuxtaposición. */
export const BOOLE_PARSE_OPTIONS: ParseOptions = { oplus: "or", juxtaposition: true };

export const bvar = (name: string): BExpr => ({ k: "var", name });
export const bconst = (v: 0 | 1): BExpr => ({ k: "const", v });
export const bnot = (a: BExpr): BExpr => ({ k: "not", a });
export const bor = (...args: BExpr[]): BExpr => normalizeBoole({ k: "or", args });
export const band = (...args: BExpr[]): BExpr => normalizeBoole({ k: "and", args });

const chunks = (s: string) => s.match(/\d+|\D+/g) ?? [];
function natural(a: string, b: string): number {
  const ca = chunks(a);
  const cb = chunks(b);
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
    const x = ca[i]!;
    const y = cb[i]!;
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    }
    return x < y ? -1 : 1;
  }
  return ca.length - cb.length;
}

/** Clave canónica: iguales módulo conmutatividad y asociatividad ⇔ misma clave. */
export function booleKey(e: BExpr): string {
  switch (e.k) {
    case "var":
      return e.name;
    case "const":
      return String(e.v);
    case "not":
      return `!${booleKey(e.a)}`;
    default:
      return `${e.k === "or" ? "+" : "*"}(${e.args.map(booleKey).join(",")})`;
  }
}

// Orden de los argumentos: literales primero (por variable y luego el complemento), después lo demás.
function sortKey(e: BExpr): string {
  if (e.k === "var") return `0${e.name}\u0000`;
  if (e.k === "not" && e.a.k === "var") return `0${e.a.name}\u0001`;
  if (e.k === "const") return `1${e.v}`;
  return `2${booleKey(e)}`;
}

/**
 * Aplana sumas dentro de sumas y productos dentro de productos, ordena los argumentos y colapsa los
 * nodos de un solo argumento. No simplifica nada más: x ⊕ x, x ⊕ 0 o x″ se quedan como están.
 */
export function normalizeBoole(e: BExpr): BExpr {
  switch (e.k) {
    case "var":
    case "const":
      return e;
    case "not":
      return { k: "not", a: normalizeBoole(e.a) };
    default: {
      const flat: BExpr[] = [];
      for (const raw of e.args) {
        const c = normalizeBoole(raw);
        if (c.k === e.k) flat.push(...c.args);
        else flat.push(c);
      }
      if (flat.length === 0) return bconst(e.k === "and" ? 1 : 0);
      if (flat.length === 1) return flat[0]!;
      const keyed = flat.map((c) => [sortKey(c), c] as const);
      keyed.sort((x, y) => natural(x[0], y[0]));
      return { k: e.k, args: keyed.map(([, c]) => c) };
    }
  }
}

export const sameBoole = (a: BExpr, b: BExpr): boolean => booleKey(normalizeBoole(a)) === booleKey(normalizeBoole(b));

export type BooleParseResult =
  | { ok: true; expr: BExpr; node: Node }
  | { ok: false; error: ParseError };

/** Opciones de lectura: con `xor`, a ⊻ b se acepta y se desarrolla como a ⊙ b′ ⊕ a′ ⊙ b. */
export type BooleReadOptions = { xor?: boolean };

/**
 * Convierte un AST de lógica en una expresión de Boole, o null si usa → o ↔ (o ⊻, salvo con
 * `{ xor: true }`, que lo desarrolla).
 */
export function fromLogicNode(node: Node, options: BooleReadOptions = {}): BExpr | null {
  switch (node.kind) {
    case "var":
      return bvar(node.name);
    case "const":
      return bconst(node.value ? 1 : 0);
    case "not": {
      const a = fromLogicNode(node.arg, options);
      return a ? bnot(a) : null;
    }
    case "and":
    case "or":
    case "xor": {
      if (node.kind === "xor" && !options.xor) return null;
      const l = fromLogicNode(node.left, options);
      const r = fromLogicNode(node.right, options);
      if (!l || !r) return null;
      if (node.kind === "xor") {
        return {
          k: "or",
          args: [
            { k: "and", args: [l, bnot(r)] },
            { k: "and", args: [bnot(l), r] },
          ],
        };
      }
      return { k: node.kind, args: [l, r] };
    }
    default:
      return null;
  }
}

/** Convierte una expresión de Boole en un AST de lógica (para la tabla de verdad y la comparación). */
export function toLogicNode(e: BExpr): Node {
  switch (e.k) {
    case "var":
      return { kind: "var", name: e.name };
    case "const":
      return { kind: "const", value: e.v === 1 };
    case "not":
      return { kind: "not", arg: toLogicNode(e.a) };
    default: {
      const nodes = e.args.map(toLogicNode);
      if (nodes.length === 0) return { kind: "const", value: e.k === "and" };
      return nodes.slice(1).reduce<Node>((acc, n) => ({ kind: e.k, left: acc, right: n }), nodes[0]!);
    }
  }
}

/**
 * Lee una expresión de Boole: ⊕/+/∨ suma, ⊙/·/∧/yuxtaposición producto, ′/'/¬/~ complemento. Con
 * `{ xor: true }` también acepta ⊻ (o ^), que se desarrolla con ⊕, ⊙ y ′.
 */
export function parseBoole(input: string, options: BooleReadOptions = {}): BooleParseResult {
  const r = parseFormula(input, BOOLE_PARSE_OPTIONS);
  if (!r.ok) return r;
  const expr = fromLogicNode(r.ast, options);
  if (!expr) {
    const at = Math.max(0, input.search(options.xor ? /[→⇒↔⇔≡⊃⟶⟷]|->|<->|=>|<=>/ : /[⊻^→⇒↔⇔≡⊃⟶⟷]|->|<->|=>|<=>|\bxor\b/i));
    return {
      ok: false,
      error: {
        code: "unexpected-token",
        start: at,
        end: at + 1,
        message: options.xor
          ? "Aquí se usan ⊕ (suma), ⊙ (producto), ′ (complemento), ⊻ (XOR), 0 y 1."
          : "En este laboratorio solo se usan ⊕ (suma), ⊙ (producto), ′ (complemento), 0 y 1.",
      },
    };
  }
  return { ok: true, expr: normalizeBoole(expr), node: r.ast };
}

export function booleVars(e: BExpr): string[] {
  const set = new Set<string>();
  const walk = (x: BExpr) => {
    if (x.k === "var") set.add(x.name);
    else if (x.k === "not") walk(x.a);
    else if (x.k !== "const") x.args.forEach(walk);
  };
  walk(e);
  return [...set].sort(natural);
}

/** Número de apariciones de variables (literales) en la expresión. */
export function literalCount(e: BExpr): number {
  switch (e.k) {
    case "var":
      return 1;
    case "const":
      return 0;
    case "not":
      return literalCount(e.a);
    default:
      return e.args.reduce((s, a) => s + literalCount(a), 0);
  }
}

export function evalBoole(e: BExpr, env: Record<string, boolean>): boolean {
  switch (e.k) {
    case "var":
      return env[e.name] ?? false;
    case "const":
      return e.v === 1;
    case "not":
      return !evalBoole(e.a, env);
    case "or":
      return e.args.some((a) => evalBoole(a, env));
    case "and":
      return e.args.every((a) => evalBoole(a, env));
  }
}

// Mismo filtro y regla de subíndices que toTex en shared/logic/ast.ts.
function varTex(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return "\\square";
  const sub = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  if (sub) return `${sub[1]!.length === 1 ? sub[1]! : `\\mathit{${sub[1]!}}`}_{${sub[2]!}}`;
  if (/^[A-Za-z]$/.test(name)) return name;
  return `\\mathit{${name.replace(/_/g, "\\_")}}`;
}

const PREC = { or: 1, and: 2, not: 3, var: 4, const: 4 } as const;

function render(e: BExpr, tex: boolean): string {
  const wrap = (c: BExpr, min: number) => {
    const s = render(c, tex);
    if (PREC[c.k] >= min) return s;
    return tex ? `\\left(${s}\\right)` : `(${s})`;
  };
  switch (e.k) {
    case "var":
      return tex ? varTex(e.name) : e.name;
    case "const":
      return String(e.v);
    case "not": {
      // Un complemento se escribe como postfijo: x′, (x ⊕ y)′, x″.
      const inner = e.a.k === "var" || e.a.k === "const" || e.a.k === "not" ? render(e.a, tex) : wrap(e.a, 4);
      return tex ? `${inner}'` : `${inner}′`;
    }
    case "or":
      return e.args.map((a) => wrap(a, 1)).join(tex ? " \\oplus " : " ⊕ ");
    case "and":
      return e.args.map((a) => wrap(a, 3)).join(tex ? " \\odot " : " ⊙ ");
  }
}

/** TeX con la notación de clase (⊕, ⊙, ′). Solo nombres de variable seguros llegan a TeX. */
export const booleToTex = (e: BExpr): string => render(e, true);
/** Texto plano con la notación de clase, que el analizador en modo Boole vuelve a leer igual. */
export const booleToPlain = (e: BExpr): string => render(e, false);
