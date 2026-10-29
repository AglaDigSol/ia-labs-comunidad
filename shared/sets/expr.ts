// Expresiones de conjuntos sobre A, B y C: ∪ (unión), ∩ (intersección), ∖ o − (diferencia), Δ
// (diferencia simétrica), complemento posfijo (Aᶜ, A′, Ā), ∅ y el universal U, con paréntesis.
// Notación de content/symbols/predicados-conjuntos.ts: Aᶜ es la forma principal del complementario.
// Entre operaciones binarias distintas (o con ∖ repetida) hacen falta paréntesis: A ∪ B ∩ C no se
// acepta, porque cada libro lo agrupa de una manera. Internamente, ∪ y ∩ son n-arias, aplanadas y con
// los argumentos ordenados, y Δ ordena sus dos lados: dos expresiones que solo difieren por
// conmutatividad o asociatividad tienen la misma clave.
import type { ParseError } from "../logic/parser.ts";

/** Nombres de conjunto que se pueden usar, en este orden. */
export const SET_NAMES = ["A", "B", "C"] as const;
export type SetName = (typeof SET_NAMES)[number];
export const isSetName = (x: unknown): x is SetName => typeof x === "string" && (SET_NAMES as readonly string[]).includes(x);

export type SetExpr =
  | { k: "set"; name: SetName }
  | { k: "empty" }
  | { k: "universe" }
  | { k: "comp"; a: SetExpr }
  | { k: "union" | "inter"; args: SetExpr[] }
  | { k: "diff" | "sym"; a: SetExpr; b: SetExpr };

export const MAX_SET_EXPR_LENGTH = 200;

export const sset = (name: SetName): SetExpr => ({ k: "set", name });
export const sempty: SetExpr = { k: "empty" };
export const suniverse: SetExpr = { k: "universe" };
export const scomp = (a: SetExpr): SetExpr => ({ k: "comp", a });
export const sunion = (...args: SetExpr[]): SetExpr => normalizeSet({ k: "union", args });
export const sinter = (...args: SetExpr[]): SetExpr => normalizeSet({ k: "inter", args });
export const sdiff = (a: SetExpr, b: SetExpr): SetExpr => ({ k: "diff", a, b });
export const ssym = (a: SetExpr, b: SetExpr): SetExpr => ({ k: "sym", a, b });

// ---------------------------------------------------------------- Clave y forma normal

/** Clave canónica: iguales módulo conmutatividad y asociatividad ⇔ misma clave (tras normalizar). */
export function setKey(e: SetExpr): string {
  switch (e.k) {
    case "set":
      return e.name;
    case "empty":
      return "0";
    case "universe":
      return "U";
    case "comp":
      return `!${setKey(e.a)}`;
    case "union":
    case "inter":
      return `${e.k === "union" ? "+" : "*"}(${e.args.map(setKey).join(",")})`;
    case "diff":
    case "sym":
      return `${e.k === "diff" ? "-" : "^"}(${setKey(e.a)},${setKey(e.b)})`;
  }
}

// Orden de los argumentos: conjuntos primero (A, Aᶜ, B, Bᶜ…), luego ∅ y U y después lo demás.
function sortKey(e: SetExpr): string {
  if (e.k === "set") return `0${e.name}0`;
  if (e.k === "comp" && e.a.k === "set") return `0${e.a.name}1`;
  if (e.k === "empty" || e.k === "universe") return `1${setKey(e)}`;
  return `2${setKey(e)}`;
}

/**
 * Aplana uniones dentro de uniones e intersecciones dentro de intersecciones, ordena los argumentos,
 * ordena los dos lados de Δ y colapsa los nodos de un solo argumento. No simplifica nada más.
 */
export function normalizeSet(e: SetExpr): SetExpr {
  switch (e.k) {
    case "set":
    case "empty":
    case "universe":
      return e;
    case "comp":
      return { k: "comp", a: normalizeSet(e.a) };
    case "diff":
      return { k: "diff", a: normalizeSet(e.a), b: normalizeSet(e.b) };
    case "sym": {
      const a = normalizeSet(e.a);
      const b = normalizeSet(e.b);
      return sortKey(a) <= sortKey(b) ? { k: "sym", a, b } : { k: "sym", a: b, b: a };
    }
    default: {
      const flat: SetExpr[] = [];
      for (const raw of e.args) {
        const c = normalizeSet(raw);
        if (c.k === e.k) flat.push(...c.args);
        else flat.push(c);
      }
      if (flat.length === 0) return e.k === "union" ? sempty : suniverse;
      if (flat.length === 1) return flat[0]!;
      const keyed = flat.map((c) => [sortKey(c), c] as const);
      keyed.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
      return { k: e.k, args: keyed.map(([, c]) => c) };
    }
  }
}

export const sameSetExpr = (a: SetExpr, b: SetExpr): boolean => setKey(normalizeSet(a)) === setKey(normalizeSet(b));

/** Conjuntos que aparecen en la expresión, en el orden A, B, C. */
export function setVars(...es: SetExpr[]): SetName[] {
  const seen = new Set<SetName>();
  const walk = (x: SetExpr) => {
    if (x.k === "set") seen.add(x.name);
    else if (x.k === "comp") walk(x.a);
    else if (x.k === "union" || x.k === "inter") x.args.forEach(walk);
    else if (x.k === "diff" || x.k === "sym") {
      walk(x.a);
      walk(x.b);
    }
  };
  es.forEach(walk);
  return SET_NAMES.filter((n) => seen.has(n));
}

// ---------------------------------------------------------------- Lectura

type TokType = "set" | "empty" | "universe" | "comp" | "union" | "inter" | "diff" | "sym" | "open" | "close";
type Tok = { t: TokType; start: number; end: number; name?: SetName };

const OP_SYMBOL: Record<"union" | "inter" | "diff" | "sym", string> = { union: "∪", inter: "∩", diff: "∖", sym: "Δ" };
const NAMES_HELP = "Usa A, B y C para los conjuntos, U para el universal y ∅ para el vacío.";

const err = (code: ParseError["code"], start: number, end: number, message: string): ParseError => ({
  code,
  start,
  end,
  message,
});

function tokenize(s: string): { ok: true; toks: Tok[] } | { ok: false; error: ParseError } {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const push = (t: TokType, len = 1, name?: SetName) => {
      toks.push({ t, start: i, end: i + len, name });
      i += len;
    };
    if (ch === "A" || ch === "B" || ch === "C") push("set", 1, ch);
    else if (ch === "\u0100") {
      // Ā precompuesta: A seguida de su complemento.
      toks.push({ t: "set", start: i, end: i + 1, name: "A" }, { t: "comp", start: i, end: i + 1 });
      i++;
    }
    else if (ch === "U" || ch === "Ω") push("universe");
    else if (ch === "∅" || ch === "Ø" || ch === "ø" || ch === "⌀") push("empty");
    else if (ch === "{" && s[i + 1] === "}") push("empty", 2);
    else if (ch === "ᶜ" || ch === "′" || ch === "'" || ch === "̄" || ch === "̅") push("comp");
    else if (ch === "^" && s[i + 1] === "c") push("comp", 2);
    else if (ch === "^" && s[i + 1] === "{" && s[i + 2] === "c" && s[i + 3] === "}") push("comp", 4);
    else if (ch === "∪" || ch === "|" || ch === "+") push("union");
    else if (ch === "∩" || ch === "&") push("inter");
    else if (ch === "∖" || ch === "\\" || ch === "−" || ch === "-") push("diff");
    else if (ch === "Δ" || ch === "△" || ch === "∆" || ch === "^") push("sym");
    else if (ch === "(") push("open");
    else if (ch === ")") push("close");
    else if (/[A-Za-z]/.test(ch)) return { ok: false, error: err("unexpected-char", i, i + 1, `«${ch}» no es un conjunto de este laboratorio. ${NAMES_HELP}`) };
    else return { ok: false, error: err("unexpected-char", i, i + 1, `No reconozco «${ch}». Operaciones: ∪, ∩, ∖ (o −), Δ y el complemento ᶜ.`) };
  }
  return { ok: true, toks };
}

class Fail {
  readonly error: ParseError;
  constructor(error: ParseError) {
    this.error = error;
  }
}

export type SetParseResult = { ok: true; expr: SetExpr } | { ok: false; error: ParseError };

/**
 * Lee una expresión de conjuntos. Unión: ∪ o |. Intersección: ∩ o &. Diferencia: ∖, \, − o -.
 * Diferencia simétrica: Δ, △ o ^. Complemento (detrás): ᶜ, ′, ', ^c o la barra combinada (Ā).
 * Vacío: ∅ o {}. Universal: U.
 */
export function parseSetExpr(input: string): SetParseResult {
  if (input.trim() === "") return { ok: false, error: err("empty", 0, 0, "Escribe una expresión.") };
  if (input.length > MAX_SET_EXPR_LENGTH) {
    return { ok: false, error: err("too-long", MAX_SET_EXPR_LENGTH, input.length, `Como mucho ${MAX_SET_EXPR_LENGTH} caracteres.`) };
  }
  const tk = tokenize(input);
  if (!tk.ok) return tk;
  const toks = tk.toks;
  let pos = 0;
  const peek = () => toks[pos];
  const endAt = input.length;

  const primary = (): SetExpr => {
    const t = peek();
    if (!t) throw new Fail(err("missing-operand", endAt, endAt, "Falta un conjunto al final."));
    pos++;
    if (t.t === "set") return sset(t.name!);
    if (t.t === "empty") return sempty;
    if (t.t === "universe") return suniverse;
    if (t.t === "open") {
      const inner = expression();
      const c = peek();
      if (!c || c.t !== "close") throw new Fail(err("unclosed-paren", t.start, t.end, "Falta cerrar este paréntesis."));
      pos++;
      return inner;
    }
    if (t.t === "close") throw new Fail(err("unmatched-close", t.start, t.end, "Sobra este paréntesis o falta un conjunto antes."));
    if (t.t === "comp") throw new Fail(err("missing-operand", t.start, t.end, "El complemento va detrás del conjunto: Aᶜ o (A ∪ B)ᶜ."));
    throw new Fail(err("missing-operand", t.start, t.end, "Falta un conjunto antes de esta operación."));
  };

  const operand = (): SetExpr => {
    let e = primary();
    while (peek()?.t === "comp") {
      pos++;
      e = scomp(e);
    }
    return e;
  };

  const expression = (): SetExpr => {
    const first = operand();
    let op: "union" | "inter" | "diff" | "sym" | null = null;
    let opTok: Tok | null = null;
    const items: SetExpr[] = [first];
    for (;;) {
      const t = peek();
      if (!t || t.t === "close") break;
      if (t.t !== "union" && t.t !== "inter" && t.t !== "diff" && t.t !== "sym") {
        throw new Fail(err("missing-operator", t.start, t.end, "Falta una operación (∪, ∩, ∖ o Δ) entre dos conjuntos."));
      }
      if (op !== null && t.t !== op) {
        const a = OP_SYMBOL[op];
        const b = OP_SYMBOL[t.t];
        throw new Fail(
          err(
            "unexpected-token",
            t.start,
            t.end,
            `Entre ${a} y ${b} hacen falta paréntesis: escribe, por ejemplo, (A ${a} B) ${b} C o A ${a} (B ${b} C).`,
          ),
        );
      }
      if (op === "diff") {
        throw new Fail(err("unexpected-token", t.start, t.end, "Con dos diferencias seguidas hacen falta paréntesis: (A ∖ B) ∖ C o A ∖ (B ∖ C)."));
      }
      op = t.t;
      opTok = t;
      pos++;
      items.push(operand());
    }
    if (op === null || opTok === null) return first;
    if (op === "union" || op === "inter") return { k: op, args: items };
    // ∖ (una sola) y Δ (asociativa): de izquierda a derecha.
    return items.slice(1).reduce<SetExpr>((acc, x) => ({ k: op, a: acc, b: x }), items[0]!);
  };

  try {
    const e = expression();
    const rest = peek();
    if (rest) throw new Fail(err("unmatched-close", rest.start, rest.end, "Sobra este paréntesis."));
    return { ok: true, expr: normalizeSet(e) };
  } catch (x) {
    if (x instanceof Fail) return { ok: false, error: x.error };
    throw x;
  }
}

// ---------------------------------------------------------------- Escritura

const isBinary = (e: SetExpr) => e.k === "union" || e.k === "inter" || e.k === "diff" || e.k === "sym";

function render(e: SetExpr, tex: boolean): string {
  // Paréntesis de libro: un hijo binario de una operación binaria siempre va entre paréntesis.
  const wrap = (c: SetExpr) => {
    const s = render(c, tex);
    if (!isBinary(c)) return s;
    return tex ? `\\left(${s}\\right)` : `(${s})`;
  };
  switch (e.k) {
    case "set":
      return e.name;
    case "empty":
      return tex ? "\\varnothing" : "∅";
    case "universe":
      return "U";
    case "comp": {
      // Aᶜ, ∅ᶜ, (A ∪ B)ᶜ y (Aᶜ)ᶜ: el doble complemento lleva paréntesis (en TeX no cabe A^c^c).
      const inner = e.a.k === "comp" || isBinary(e.a) ? (tex ? `\\left(${render(e.a, tex)}\\right)` : `(${render(e.a, tex)})`) : render(e.a, tex);
      return tex ? `${inner}^{c}` : `${inner}ᶜ`;
    }
    case "union":
      return e.args.map(wrap).join(tex ? " \\cup " : " ∪ ");
    case "inter":
      return e.args.map(wrap).join(tex ? " \\cap " : " ∩ ");
    case "diff":
      return `${wrap(e.a)}${tex ? " \\setminus " : " ∖ "}${wrap(e.b)}`;
    case "sym":
      return `${wrap(e.a)}${tex ? " \\mathbin{\\Delta} " : " Δ "}${wrap(e.b)}`;
  }
}

/** Texto plano con la notación de clase (∪, ∩, ∖, Δ, ᶜ, ∅, U), que parseSetExpr vuelve a leer igual. */
export const setToPlain = (e: SetExpr): string => render(e, false);
/** TeX con la notación de clase. Solo salen A, B, C, U y órdenes fijas: es seguro para KaTeX. */
export const setToTex = (e: SetExpr): string => render(e, true);

// ---------------------------------------------------------------- Regiones del diagrama de Venn

/**
 * Una región (celda) del diagrama de Venn de `vars` es una máscara de bits: el bit i dice si la región
 * está dentro del conjunto vars[i]. Con n conjuntos hay 2ⁿ regiones, de 0 (fuera de todos) a 2ⁿ − 1
 * (dentro de todos).
 */
export type Region = number;

export const regionCount = (n: number): number => 1 << n;

/** ¿Está la región dentro del conjunto que denota la expresión? */
export function inRegion(e: SetExpr, vars: readonly SetName[], region: Region): boolean {
  switch (e.k) {
    case "set": {
      const i = vars.indexOf(e.name);
      if (i < 0) throw new Error(`El conjunto ${e.name} no está en el diagrama.`);
      return ((region >> i) & 1) === 1;
    }
    case "empty":
      return false;
    case "universe":
      return true;
    case "comp":
      return !inRegion(e.a, vars, region);
    case "union":
      return e.args.some((a) => inRegion(a, vars, region));
    case "inter":
      return e.args.every((a) => inRegion(a, vars, region));
    case "diff":
      return inRegion(e.a, vars, region) && !inRegion(e.b, vars, region);
    case "sym":
      return inRegion(e.a, vars, region) !== inRegion(e.b, vars, region);
  }
}

/** Regiones que forman la expresión (índice = región). */
export function setRegions(e: SetExpr, vars: readonly SetName[]): boolean[] {
  return Array.from({ length: regionCount(vars.length) }, (_, r) => inRegion(e, vars, r));
}

/** Nombre de la región como intersección: «A ∩ Bᶜ ∩ C». */
export function regionLabel(vars: readonly SetName[], region: Region): string {
  return vars.map((v, i) => (((region >> i) & 1) === 1 ? v : `${v}ᶜ`)).join(" ∩ ");
}

/** La región como expresión (A ∩ Bᶜ ∩ C), por ejemplo para dibujarla o escribirla en TeX. */
export function regionExpr(vars: readonly SetName[], region: Region): SetExpr {
  return normalizeSet({
    k: "inter",
    args: vars.map((v, i) => (((region >> i) & 1) === 1 ? sset(v) : scomp(sset(v)))),
  });
}

/** Conjuntos del diagrama para estas expresiones: A y B, o A, B y C si alguna usa C. */
export function vennVars(...es: SetExpr[]): SetName[] {
  return setVars(...es).includes("C") ? ["A", "B", "C"] : ["A", "B"];
}

export type SetComparison = {
  vars: SetName[];
  equal: boolean;
  /** Regiones donde una expresión contiene la región y la otra no. */
  differ: Region[];
  left: boolean[];
  right: boolean[];
};

/** Igualdad de dos expresiones por regiones: son iguales si ocupan exactamente las mismas celdas. */
export function compareSetExprs(a: SetExpr, b: SetExpr, vars: readonly SetName[] = vennVars(a, b)): SetComparison {
  const left = setRegions(a, vars);
  const right = setRegions(b, vars);
  const differ = left.flatMap((x, r) => (x !== right[r] ? [r] : []));
  return { vars: [...vars], equal: differ.length === 0, differ, left, right };
}

// ---------------------------------------------------------------- Evaluación con elementos

export type FiniteSets = { universe: string[]; sets: Partial<Record<SetName, string[]>> };

/**
 * Evalúa la expresión con conjuntos finitos dados por sus elementos. El resultado sale en el orden del
 * universo. Los conjuntos que no se dan se toman vacíos.
 */
export function evalSetFinite(e: SetExpr, data: FiniteSets): string[] {
  const members = Object.fromEntries(SET_NAMES.map((n) => [n, new Set(data.sets[n] ?? [])])) as Record<SetName, Set<string>>;
  const has = (x: SetExpr, el: string): boolean => {
    switch (x.k) {
      case "set":
        return members[x.name].has(el);
      case "empty":
        return false;
      case "universe":
        return true;
      case "comp":
        return !has(x.a, el);
      case "union":
        return x.args.some((a) => has(a, el));
      case "inter":
        return x.args.every((a) => has(a, el));
      case "diff":
        return has(x.a, el) && !has(x.b, el);
      case "sym":
        return has(x.a, el) !== has(x.b, el);
    }
  };
  return data.universe.filter((el) => has(e, el));
}

/** Región del diagrama en la que cae cada elemento del universo. */
export function elementRegion(el: string, vars: readonly SetName[], data: FiniteSets): Region {
  return vars.reduce((r, v, i) => (data.sets[v]?.includes(el) ? r | (1 << i) : r), 0);
}
