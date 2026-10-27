import type { Node } from "./ast.ts";

export const MAX_FORMULA_LENGTH = 500;

export type ParseErrorCode =
  | "empty"
  | "too-long"
  | "unexpected-char"
  | "unexpected-token"
  | "missing-operand"
  | "missing-operator"
  | "unclosed-paren"
  | "unmatched-close"
  | "mismatched-paren";

/**
 * Opciones del analizador. Por defecto (sin opciones) se comporta como siempre: ⊕ es la disyunción
 * exclusiva y no hay producto por yuxtaposición. El laboratorio de álgebra de Boole usa
 * `{ oplus: "or", juxtaposition: true }`: ⊕ es la suma booleana (∨) y «xy» es x ⊙ y.
 */
export type ParseOptions = {
  /** Cómo se lee ⊕: "xor" (por defecto, lógica) o "or" (suma booleana de las álgebras de Boole). */
  oplus?: "xor" | "or";
  /**
   * Producto por yuxtaposición: «xy», «x′y» o «x(y + z)» se leen como productos. Las variables pasan
   * a ser de una letra, con subíndice numérico opcional (x1, x_2).
   */
  juxtaposition?: boolean;
};

export type ParseError = {
  code: ParseErrorCode;
  message: string;
  start: number;
  end: number;
};

type BinKind = "and" | "or" | "xor" | "imp" | "iff";
type Token = {
  type: "var" | "const" | "not" | "prime" | "bin" | "open" | "close";
  start: number;
  end: number;
  text: string;
  name?: string;
  value?: boolean;
  bin?: BinKind;
  bracket?: "(" | "[";
  closer?: ")" | "]";
  oplus?: boolean;
};

const err = (code: ParseErrorCode, start: number, end: number, desc: string): ParseError => ({
  code,
  start,
  end,
  message: `Hay un error en la posición ${start + 1}: ${desc}.`,
});

const BIN_CHARS: Record<string, BinKind> = {
  "∧": "and", "·": "and", "⋅": "and", "∙": "and", "*": "and", "&": "and", "⊙": "and",
  "∨": "or", "+": "or", "|": "or",
  "⊻": "xor", "⊕": "xor", "^": "xor",
  "→": "imp", "⇒": "imp", "⟶": "imp", "⊃": "imp",
  "↔": "iff", "⇔": "iff", "⟷": "iff", "≡": "iff",
};
const BIN_MULTI: Array<[string, BinKind]> = [
  ["<->", "iff"], ["<=>", "iff"], ["&&", "and"], ["||", "or"], ["->", "imp"], ["=>", "imp"],
];
const NOT_CHARS = new Set(["¬", "∼", "~", "!"]);
const PRIME_CHARS = new Set(["′", "’", "'", "‘", "ʹ", "/"]);
const KEYWORDS: Record<string, "not" | BinKind> = {
  and: "and", or: "or", xor: "xor", not: "not",
};
const isLetter = (c: string) => /^[A-Za-z]$/.test(c);
const isIdent = (c: string) => /^[A-Za-z0-9_]$/.test(c);

const SINGLE_VAR = /[A-Za-z](?:_?\d+)?/y;

export function tokenize(
  input: string,
  options: ParseOptions = {},
): { ok: true; tokens: Token[] } | { ok: false; error: ParseError } {
  const oplusKind: BinKind = options.oplus === "or" ? "or" : "xor";
  const juxt = options.juxtaposition === true;
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const multi = BIN_MULTI.find(([s]) => input.startsWith(s, i));
    if (multi) {
      tokens.push({ type: "bin", bin: multi[1], start: i, end: i + multi[0].length, text: multi[0] });
      i += multi[0].length;
      continue;
    }
    if (isLetter(c)) {
      let j = i + 1;
      while (j < input.length && isIdent(input[j]!)) j++;
      const word = input.slice(i, j);
      const kw = KEYWORDS[word.toLowerCase()];
      if (!kw && juxt) {
        SINGLE_VAR.lastIndex = i;
        const m = SINGLE_VAR.exec(input)!;
        tokens.push({ type: "var", name: m[0], start: i, end: i + m[0].length, text: m[0] });
        i += m[0].length;
        continue;
      }
      if (kw === "not") tokens.push({ type: "not", start: i, end: j, text: word });
      else if (kw) tokens.push({ type: "bin", bin: kw, start: i, end: j, text: word });
      else tokens.push({ type: "var", name: word, start: i, end: j, text: word });
      i = j;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let j = i + 1;
      while (j < input.length && input[j]! >= "0" && input[j]! <= "9") j++;
      const run = input.slice(i, j);
      if (run !== "0" && run !== "1") {
        return { ok: false, error: err("unexpected-char", i, j, `símbolo no reconocido «${run}»`) };
      }
      tokens.push({ type: "const", value: run === "1", start: i, end: j, text: run });
      i = j;
      continue;
    }
    if (c === "⊤" || c === "⊥") {
      tokens.push({ type: "const", value: c === "⊤", start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    if (NOT_CHARS.has(c)) {
      tokens.push({ type: "not", start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    if (PRIME_CHARS.has(c)) {
      tokens.push({ type: "prime", start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    const bin = c === "⊕" ? oplusKind : BIN_CHARS[c];
    if (bin) {
      tokens.push({ type: "bin", bin, start: i, end: i + 1, text: c, oplus: c === "⊕" });
      i++;
      continue;
    }
    if (c === "(" || c === "[") {
      tokens.push({ type: "open", bracket: c, start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    if (c === ")" || c === "]") {
      tokens.push({ type: "close", closer: c, start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    const cp = String.fromCodePoint(input.codePointAt(i)!);
    return { ok: false, error: err("unexpected-char", i, i + cp.length, `símbolo no reconocido «${cp}»`) };
  }
  return { ok: true, tokens };
}

// [left binding power, right binding power]
const BP: Record<BinKind, [number, number]> = {
  iff: [11, 10],
  imp: [21, 20],
  xor: [30, 31],
  or: [40, 41],
  and: [50, 51],
};

class Fail extends Error {
  error: ParseError;
  constructor(error: ParseError) {
    super(error.message);
    this.error = error;
  }
}

export function parseFormula(
  input: string,
  options: ParseOptions = {},
): { ok: true; ast: Node; usedOplus: boolean } | { ok: false; error: ParseError } {
  if (input.trim() === "") {
    return { ok: false, error: { code: "empty", message: "Escribe una fórmula.", start: 0, end: 0 } };
  }
  if (input.length > MAX_FORMULA_LENGTH) {
    return {
      ok: false,
      error: err(
        "too-long",
        MAX_FORMULA_LENGTH,
        input.length,
        `la fórmula supera los ${MAX_FORMULA_LENGTH} caracteres`,
      ),
    };
  }
  const lexed = tokenize(input, options);
  const juxt = options.juxtaposition === true;
  if (!lexed.ok) return lexed;
  const toks = lexed.tokens;
  let pos = 0;
  const usedOplus = toks.some((t) => t.oplus);

  const operandStart = (t: Token | undefined) =>
    t !== undefined && (t.type === "var" || t.type === "const" || t.type === "not" || t.type === "open");

  function needOperand(): never {
    const found = toks[pos];
    const prev = toks[pos - 1];
    if (found && found.type === "bin") {
      throw new Fail(err("missing-operand", found.start, found.end, `falta un operando antes de «${found.text}»`));
    }
    if (found && found.type === "prime") {
      throw new Fail(err("missing-operand", found.start, found.end, `falta un operando antes de «${found.text}»`));
    }
    if (prev) {
      throw new Fail(
        err("missing-operand", prev.start, prev.end, `se esperaba una variable o una negación después de «${prev.text}»`),
      );
    }
    throw new Fail(err("missing-operand", 0, 0, "falta un operando"));
  }

  function parseUnary(): Node {
    const t = toks[pos];
    if (!t || !operandStart(t)) return needOperand();
    if (t.type === "not") {
      pos++;
      return { kind: "not", arg: parseUnary() };
    }
    let node: Node;
    if (t.type === "var") {
      pos++;
      node = { kind: "var", name: t.name! };
    } else if (t.type === "const") {
      pos++;
      node = { kind: "const", value: t.value! };
    } else {
      pos++;
      node = parseExpr(0);
      const c = toks[pos];
      if (!c) {
        throw new Fail(err("unclosed-paren", t.start, t.end, "falta cerrar un paréntesis"));
      }
      if (c.type !== "close") {
        // Unreachable: parseExpr only stops on a closer or end of input.
        throw new Fail(err("unexpected-token", c.start, c.end, `símbolo inesperado «${c.text}»`));
      }
      const want = t.bracket === "(" ? ")" : "]";
      if (c.closer !== want) {
        throw new Fail(
          err("mismatched-paren", c.start, c.end, `el paréntesis «${t.text}» no se puede cerrar con «${c.text}»`),
        );
      }
      pos++;
    }
    while (toks[pos]?.type === "prime") {
      node = { kind: "not", arg: node };
      pos++;
    }
    return node;
  }

  function parseExpr(minBp: number): Node {
    let left = parseUnary();
    for (;;) {
      const t = toks[pos];
      if (!t) break;
      if (t.type === "bin") {
        const [lbp, rbp] = BP[t.bin!];
        if (lbp < minBp) break;
        pos++;
        const right = parseExpr(rbp);
        left = { kind: t.bin!, left, right };
        continue;
      }
      if (operandStart(t) && juxt) {
        // Producto implícito: «xy» = x ⊙ y, con la misma precedencia que ⊙.
        const [lbp, rbp] = BP.and;
        if (lbp < minBp) break;
        const right = parseExpr(rbp);
        left = { kind: "and", left, right };
        continue;
      }
      if (operandStart(t)) {
        const prev = toks[pos - 1]!;
        throw new Fail(
          err("missing-operator", t.start, t.end, `falta un operador entre «${prev.text}» y «${t.text}»`),
        );
      }
      break; // closer
    }
    return left;
  }

  try {
    const ast = parseExpr(0);
    const rest = toks[pos];
    if (rest) {
      throw new Fail(err("unmatched-close", rest.start, rest.end, "sobra un paréntesis de cierre"));
    }
    return { ok: true, ast, usedOplus };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error };
    throw e;
  }
}
