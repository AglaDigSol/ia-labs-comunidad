// Analizador de fórmulas de la lógica de predicados. Acepta la notación de clase (∀x (P(x) → Q(x)),
// ∃y R(x, y), ¬, ∧, ∨, →, ↔) y alternativas ASCII como en el laboratorio de lógica: forall/exists,
// «A x» y «E x», ~, !, &, |, ->, <->, and/or/not, y también las órdenes de TeX (\forall, \exists,
// \neg, \land…). Los cuantificadores ligan como ¬: ∀x P(x) ∧ Q(x) es (∀x P(x)) ∧ Q(x).
import { isVariableName, type PredBinaryKind, type PredFormula, type PredTerm } from "./ast.ts";

export const MAX_PRED_LENGTH = 300;

export type PredParseErrorCode =
  | "empty"
  | "too-long"
  | "unexpected-char"
  | "unexpected-token"
  | "missing-operand"
  | "missing-operator"
  | "unclosed-paren"
  | "unmatched-close"
  | "mismatched-paren"
  | "missing-arguments"
  | "missing-variable"
  | "not-a-formula"
  | "unsupported";

export type PredParseError = { code: PredParseErrorCode; message: string; start: number; end: number };

type Token = {
  type: "pred" | "term" | "quant" | "not" | "bin" | "open" | "close" | "comma" | "sep";
  start: number;
  end: number;
  text: string;
  name?: string;
  quant?: "forall" | "exists";
  bin?: PredBinaryKind;
  bracket?: "(" | "[";
  closer?: ")" | "]";
};

const err = (code: PredParseErrorCode, start: number, end: number, desc: string): PredParseError => ({
  code,
  start,
  end,
  message: `Hay un error en la posición ${start + 1}: ${desc}.`,
});

const BIN_CHARS: Record<string, PredBinaryKind> = {
  "∧": "and", "&": "and", "·": "and",
  "∨": "or", "|": "or",
  "→": "imp", "⇒": "imp", "⟶": "imp", "⊃": "imp",
  "↔": "iff", "⇔": "iff", "⟷": "iff",
};
const BIN_MULTI: Array<[string, PredBinaryKind]> = [
  ["<->", "iff"], ["<=>", "iff"], ["&&", "and"], ["||", "or"], ["->", "imp"], ["=>", "imp"],
];
const NOT_CHARS = new Set(["¬", "∼", "~", "!"]);
const QUANT_CHARS: Record<string, "forall" | "exists"> = { "∀": "forall", "∃": "exists" };
const KEYWORDS: Record<string, "not" | "forall" | "exists" | PredBinaryKind> = {
  and: "and", or: "or", not: "not", implies: "imp", iff: "iff", forall: "forall", exists: "exists",
};
const TEX_COMMANDS: Record<string, "not" | "forall" | "exists" | PredBinaryKind> = {
  forall: "forall", exists: "exists", neg: "not", lnot: "not",
  land: "and", wedge: "and", lor: "or", vee: "or",
  to: "imp", rightarrow: "imp", implies: "imp", Rightarrow: "imp",
  leftrightarrow: "iff", iff: "iff", Leftrightarrow: "iff",
};

const isLetter = (c: string) => /^[A-Za-z]$/.test(c);
const isIdent = (c: string) => /^[A-Za-z0-9_]$/.test(c);
const nextNonSpace = (s: string, i: number) => {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return s[i];
};

function tokenize(input: string): { ok: true; tokens: Token[] } | { ok: false; error: PredParseError } {
  const tokens: Token[] = [];
  const push = (kind: "not" | "forall" | "exists" | PredBinaryKind, start: number, end: number, text: string) => {
    if (kind === "not") tokens.push({ type: "not", start, end, text });
    else if (kind === "forall" || kind === "exists") tokens.push({ type: "quant", quant: kind, start, end, text });
    else tokens.push({ type: "bin", bin: kind, start, end, text });
  };
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const multi = BIN_MULTI.find(([s]) => input.startsWith(s, i));
    if (multi) {
      push(multi[1], i, i + multi[0].length, multi[0]);
      i += multi[0].length;
      continue;
    }
    if (c === "\\") {
      let j = i + 1;
      while (j < input.length && isLetter(input[j]!)) j++;
      const cmd = TEX_COMMANDS[input.slice(i + 1, j)];
      if (!cmd) return { ok: false, error: err("unexpected-char", i, Math.max(j, i + 1), `orden no reconocida «${input.slice(i, j) || "\\"}»`) };
      push(cmd, i, j, input.slice(i, j));
      i = j;
      continue;
    }
    if (isLetter(c) || (c >= "0" && c <= "9")) {
      let j = i + 1;
      while (j < input.length && isIdent(input[j]!)) j++;
      const word = input.slice(i, j);
      if (/^\d/.test(word) && !/^\d+$/.test(word)) {
        return { ok: false, error: err("unexpected-char", i, j, `«${word}» no es un nombre válido`) };
      }
      // Palabras clave en minúsculas o en mayúsculas (and, AND); «Or(x)» sigue siendo un predicado.
      const kw = KEYWORDS[word] ?? (word.length > 1 && word === word.toUpperCase() ? KEYWORDS[word.toLowerCase()] : undefined);
      const after = nextNonSpace(input, j);
      if (kw) {
        push(kw, i, j, word);
      } else if ((word === "A" || word === "E") && after !== undefined && /[u-z]/.test(after)) {
        // «A x P(x)» y «E x P(x)»: cuantificadores en ASCII.
        push(word === "A" ? "forall" : "exists", i, j, word);
      } else if (/^[AE][u-z](?:_?\d+)?$/.test(word) && input[j] !== "(") {
        // «Ax P(x)»: el cuantificador pegado a su variable («Ax(y)» sigue siendo el predicado Ax).
        push(word[0] === "A" ? "forall" : "exists", i, i + 1, word[0]!);
        tokens.push({ type: "term", name: word.slice(1), start: i + 1, end: j, text: word.slice(1) });
      } else if (/^[A-Z]/.test(word)) {
        tokens.push({ type: "pred", name: word, start: i, end: j, text: word });
      } else {
        tokens.push({ type: "term", name: word, start: i, end: j, text: word });
      }
      i = j;
      continue;
    }
    const q = QUANT_CHARS[c];
    if (q) {
      if (q === "exists" && input[i + 1] === "!") {
        return {
          ok: false,
          error: err("unsupported", i, i + 2, "∃! («existe exactamente uno») no está admitido aquí; escríbelo con ∃ y ∀"),
        };
      }
      push(q, i, i + 1, c);
      i++;
      continue;
    }
    if (NOT_CHARS.has(c)) {
      push("not", i, i + 1, c);
      i++;
      continue;
    }
    const bin = BIN_CHARS[c];
    if (bin) {
      push(bin, i, i + 1, c);
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
    if (c === ",") {
      tokens.push({ type: "comma", start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    if (c === ":" || c === ".") {
      tokens.push({ type: "sep", start: i, end: i + 1, text: c });
      i++;
      continue;
    }
    const cp = String.fromCodePoint(input.codePointAt(i)!);
    const why = cp === "=" || cp === "≠" ? `la igualdad «${cp}» no está admitida en este laboratorio` : `símbolo no reconocido «${cp}»`;
    return { ok: false, error: err(cp === "=" || cp === "≠" ? "unsupported" : "unexpected-char", i, i + cp.length, why) };
  }
  return { ok: true, tokens };
}

// [poder de enlace izquierdo, derecho]: → y ↔ asocian por la derecha.
const BP: Record<PredBinaryKind, [number, number]> = {
  iff: [11, 10],
  imp: [21, 20],
  or: [40, 41],
  and: [50, 51],
};

class Fail extends Error {
  error: PredParseError;
  constructor(error: PredParseError) {
    super(error.message);
    this.error = error;
  }
}

export function parsePredicate(input: string): { ok: true; formula: PredFormula } | { ok: false; error: PredParseError } {
  if (input.trim() === "") {
    return { ok: false, error: { code: "empty", message: "Escribe una fórmula.", start: 0, end: 0 } };
  }
  if (input.length > MAX_PRED_LENGTH) {
    return {
      ok: false,
      error: err("too-long", MAX_PRED_LENGTH, input.length, `la fórmula supera los ${MAX_PRED_LENGTH} caracteres`),
    };
  }
  const lexed = tokenize(input);
  if (!lexed.ok) return lexed;
  const toks = lexed.tokens;
  let pos = 0;

  const operandStart = (t: Token | undefined) =>
    t !== undefined && (t.type === "pred" || t.type === "term" || t.type === "quant" || t.type === "not" || t.type === "open");

  function needOperand(): never {
    const found = toks[pos];
    const prev = toks[pos - 1];
    if (found && (found.type === "bin" || found.type === "comma" || found.type === "sep")) {
      throw new Fail(err("missing-operand", found.start, found.end, `falta una fórmula antes de «${found.text}»`));
    }
    if (prev) {
      throw new Fail(err("missing-operand", prev.start, prev.end, `se esperaba una fórmula después de «${prev.text}»`));
    }
    throw new Fail(err("missing-operand", 0, 0, "falta una fórmula"));
  }

  function parseAtom(t: Token): PredFormula {
    pos++;
    const open = toks[pos];
    if (!open || open.type !== "open" || open.bracket !== "(") {
      throw new Fail(err("missing-arguments", t.start, t.end, `falta la lista de argumentos de ${t.text}: escribe ${t.text}(x)`));
    }
    pos++;
    const args: PredTerm[] = [];
    for (;;) {
      const a = toks[pos];
      if (!a || a.type !== "term") {
        const at = a ?? toks[pos - 1]!;
        const what = a?.type === "pred" ? `«${a.text}» es un predicado; los argumentos son variables o constantes en minúscula` : `falta un argumento de ${t.text}`;
        throw new Fail(err("missing-arguments", at.start, at.end, what));
      }
      args.push({ name: a.name! });
      pos++;
      const sep = toks[pos];
      if (sep?.type === "comma") {
        pos++;
        continue;
      }
      if (sep?.type === "close" && sep.closer === ")") {
        pos++;
        return { kind: "pred", name: t.name!, args };
      }
      if (!sep) throw new Fail(err("unclosed-paren", open.start, open.end, `falta cerrar el paréntesis de ${t.text}(…)`));
      throw new Fail(err("unexpected-token", sep.start, sep.end, `se esperaba «,» o «)» y hay «${sep.text}»`));
    }
  }

  function parseUnary(): PredFormula {
    const t = toks[pos];
    if (!t || !operandStart(t)) return needOperand();
    if (t.type === "not") {
      pos++;
      return { kind: "not", arg: parseUnary() };
    }
    if (t.type === "quant") {
      pos++;
      const v = toks[pos];
      if (!v || v.type !== "term") {
        const at = v ?? t;
        throw new Fail(err("missing-variable", at.start, at.end, `falta la variable de «${t.text}» (por ejemplo, ${t.quant === "forall" ? "∀" : "∃"}x)`));
      }
      if (!isVariableName(v.name!)) {
        throw new Fail(err("missing-variable", v.start, v.end, `«${v.text}» no es una variable: las variables son u, v, w, x, y, z (con subíndice opcional)`));
      }
      pos++;
      // Separadores opcionales tras la variable: ∀x, P(x) · ∀x: P(x) · ∀x. P(x)
      if (toks[pos]?.type === "sep" || toks[pos]?.type === "comma") pos++;
      return { kind: t.quant!, variable: v.name!, body: parseUnary() };
    }
    if (t.type === "pred") return parseAtom(t);
    if (t.type === "term") {
      throw new Fail(
        err("not-a-formula", t.start, t.end, `«${t.text}» no es una fórmula: los predicados empiezan por mayúscula, como P(${t.text})`),
      );
    }
    // Paréntesis
    pos++;
    const node = parseExpr(0);
    const c = toks[pos];
    if (!c) throw new Fail(err("unclosed-paren", t.start, t.end, "falta cerrar un paréntesis"));
    if (c.type !== "close") throw new Fail(err("unexpected-token", c.start, c.end, `símbolo inesperado «${c.text}»`));
    const want = t.bracket === "(" ? ")" : "]";
    if (c.closer !== want) {
      throw new Fail(err("mismatched-paren", c.start, c.end, `el paréntesis «${t.text}» no se puede cerrar con «${c.text}»`));
    }
    pos++;
    return node;
  }

  function parseExpr(minBp: number): PredFormula {
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
      if (operandStart(t)) {
        const prev = toks[pos - 1]!;
        throw new Fail(err("missing-operator", t.start, t.end, `falta un operador entre «${prev.text}» y «${t.text}»`));
      }
      if (t.type === "comma" || t.type === "sep") {
        throw new Fail(err("unexpected-token", t.start, t.end, `símbolo inesperado «${t.text}»`));
      }
      break; // cierre de paréntesis
    }
    return left;
  }

  try {
    const formula = parseExpr(0);
    const rest = toks[pos];
    if (rest) throw new Fail(err("unmatched-close", rest.start, rest.end, "sobra un paréntesis de cierre"));
    return { ok: true, formula };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error };
    throw e;
  }
}
