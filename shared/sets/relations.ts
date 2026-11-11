// Relaciones entre conjuntos: X ⊆ Y, X ⊊ Y (también ⊂), X ⊇ Y, X ⊋ Y (también ⊃), X = Y, X ≠ Y y
// X ⊈ Y (también ⊄), con X e Y expresiones de expr.ts. Una relación no es un conjunto: es verdadera o
// falsa. Se admiten cadenas como «∅ ≠ A ⊆ B» (∅ ≠ A y A ⊆ B) y, para los supuestos, varias separadas
// por comas o punto y coma. Alternativas ASCII: <=, <, >=, >, !=, == y las palabras de LaTeX (subseteq,
// subset, supseteq, supset, neq), con o sin barra.
//
// Cómo se decide: las relaciones entre expresiones de A, B y C solo dependen de qué regiones del
// diagrama de Venn tienen algún elemento. Un «mundo» es una máscara de bits sobre las regiones (bit r:
// la región r no está vacía); con tres conjuntos hay 8 regiones y 256 mundos, así que se recorren
// todos. El universo U no es vacío (como en clase): el mundo sin ningún elemento, ni siquiera fuera de
// los conjuntos, no cuenta; si contara, A = Aᶜ «dependería». Una relación es «siempre cierta» bajo unos supuestos si se cumple en todos los mundos que los
// cumplen, «nunca cierta» si no se cumple en ninguno y «depende» en otro caso; los contraejemplos son
// mundos concretos (con el menor número de regiones con elementos).
import type { ParseError } from "../logic/parser.ts";
import {
  MAX_SET_EXPR_LENGTH,
  parseSetExpr,
  regionCount,
  regionLabel,
  RELATION_GLYPH,
  relationTokenAt,
  setRegions,
  setToPlain,
  setToTex,
  vennVars,
  type Region,
  type SetExpr,
  type SetName,
  type SetRelationOp,
} from "./expr.ts";

export type { SetRelationOp } from "./expr.ts";

export type SetRelation = { op: SetRelationOp; left: SetExpr; right: SetExpr };

export type SetRelationParse = { ok: true; relations: SetRelation[] } | { ok: false; error: ParseError };

const err = (code: ParseError["code"], start: number, end: number, message: string): ParseError => ({ code, start, end, message });

/** Como mucho tantos supuestos (cada eslabón de una cadena cuenta). */
export const MAX_HYPOTHESES = 6;

/**
 * Lee una relación o una cadena de relaciones («∅ ≠ A ⊆ B» son dos: ∅ ≠ A y A ⊆ B). Si no hay ningún
 * símbolo de relación, explica que eso es un conjunto y no una relación.
 */
export function parseSetRelation(input: string, offset = 0): SetRelationParse {
  if (input.trim() === "") return { ok: false, error: err("empty", offset, offset, "Escribe una relación, como A ⊆ B.") };
  if (input.length > MAX_SET_EXPR_LENGTH) {
    return { ok: false, error: err("too-long", offset + MAX_SET_EXPR_LENGTH, offset + input.length, `Como mucho ${MAX_SET_EXPR_LENGTH} caracteres.`) };
  }
  // Trozos entre símbolos de relación (fuera de paréntesis).
  const cuts: Array<{ op: SetRelationOp; start: number; end: number }> = [];
  let depth = 0;
  for (let i = 0; i < input.length; ) {
    const ch = input[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    const rel = relationTokenAt(input, i);
    if (rel) {
      if (depth > 0) {
        return {
          ok: false,
          error: err("unexpected-token", offset + i, offset + i + rel.len, `«${RELATION_GLYPH[rel.op]}» compara dos conjuntos y no puede ir dentro de un paréntesis: cada lado es una expresión, como (A ∪ B) ⊆ C.`),
        };
      }
      cuts.push({ op: rel.op, start: i, end: i + rel.len });
      i += rel.len;
      continue;
    }
    i++;
  }
  if (cuts.length === 0) {
    const e = parseSetExpr(input);
    const what = e.ok ? `${setToPlain(e.expr)} es un conjunto, no una relación` : "Falta la relación";
    return {
      ok: false,
      error: err("missing-operator", offset, offset + input.length, `${what}: compara dos conjuntos con ⊆, ⊊, ⊇, ⊋, = o ≠, por ejemplo A ⊆ B o A ∩ B = ∅.`),
    };
  }
  const sides: SetExpr[] = [];
  for (let k = 0; k <= cuts.length; k++) {
    const from = k === 0 ? 0 : cuts[k - 1]!.end;
    const to = k === cuts.length ? input.length : cuts[k]!.start;
    const text = input.slice(from, to);
    if (text.trim() === "") {
      const c = cuts[k] ?? cuts[k - 1]!;
      const where = k === cuts.length ? "a la derecha" : "a la izquierda";
      return { ok: false, error: err("missing-operand", offset + c.start, offset + c.end, `Falta un conjunto ${where} de «${RELATION_GLYPH[c.op]}».`) };
    }
    const r = parseSetExpr(text);
    if (!r.ok) {
      const shift = offset + from;
      return { ok: false, error: { ...r.error, start: r.error.start + shift, end: r.error.end + shift } };
    }
    sides.push(r.expr);
  }
  return { ok: true, relations: cuts.map((c, k) => ({ op: c.op, left: sides[k]!, right: sides[k + 1]! })) };
}

/**
 * Lee una lista de supuestos separados por comas o punto y coma («A ⊆ B, A ∩ C = ∅»). Vacía: ninguno.
 */
export function parseSetHypotheses(input: string): SetRelationParse {
  if (input.trim() === "") return { ok: true, relations: [] };
  const out: SetRelation[] = [];
  let from = 0;
  const parts: Array<[number, number]> = [];
  for (let i = 0; i <= input.length; i++) {
    if (i === input.length || input[i] === "," || input[i] === ";") {
      parts.push([from, i]);
      from = i + 1;
    }
  }
  for (const [a, b] of parts) {
    const text = input.slice(a, b);
    if (text.trim() === "") {
      if (parts.length === 1) continue;
      return { ok: false, error: err("missing-operand", a, b, "Sobra una coma o falta un supuesto entre dos comas.") };
    }
    const r = parseSetRelation(text, a);
    if (!r.ok) return r;
    out.push(...r.relations);
  }
  if (out.length > MAX_HYPOTHESES) {
    return { ok: false, error: err("too-long", 0, input.length, `Como mucho ${MAX_HYPOTHESES} supuestos.`) };
  }
  return { ok: true, relations: out };
}

// ---------------------------------------------------------------- Escritura

const TEX_OP: Record<SetRelationOp, string> = {
  subseteq: "\\subseteq",
  subset: "\\subsetneq",
  supseteq: "\\supseteq",
  supset: "\\supsetneq",
  eq: "=",
  neq: "\\neq",
  nsubseteq: "\\nsubseteq",
};

/** «A ⊆ B», que parseSetRelation vuelve a leer igual. */
export const relationToPlain = (r: SetRelation): string => `${setToPlain(r.left)} ${RELATION_GLYPH[r.op]} ${setToPlain(r.right)}`;
/** TeX con la notación de clase (solo A, B, C, U y órdenes fijas: seguro para KaTeX). */
export const relationToTex = (r: SetRelation): string => `${setToTex(r.left)} ${TEX_OP[r.op]} ${setToTex(r.right)}`;

/** Lectura de la relación: «A está contenido en B». */
export function relationSpoken(r: SetRelation): string {
  const a = setToPlain(r.left);
  const b = setToPlain(r.right);
  switch (r.op) {
    case "subseteq":
      return `${a} está contenido en ${b}`;
    case "subset":
      return `${a} está contenido en ${b} y es distinto`;
    case "supseteq":
      return `${a} contiene a ${b}`;
    case "supset":
      return `${a} contiene a ${b} y es distinto`;
    case "eq":
      return `${a} es igual a ${b}`;
    case "neq":
      return `${a} es distinto de ${b}`;
    case "nsubseteq":
      return `${a} no está contenido en ${b}`;
  }
}

// ---------------------------------------------------------------- Mundos

/** Máscara de bits: bit r = la región r tiene algún elemento. */
export type VennWorld = number;

export const worldHas = (w: VennWorld, r: Region) => ((w >> r) & 1) === 1;
const popcount = (w: number) => {
  let c = 0;
  for (let x = w; x !== 0; x &= x - 1) c++;
  return c;
};

/** Conjuntos que hacen falta para dibujar estas relaciones (y expresiones): A y B, o A, B y C. */
export function relationVars(relations: readonly SetRelation[], ...exprs: SetExpr[]): SetName[] {
  return vennVars(...relations.flatMap((r) => [r.left, r.right]), ...exprs);
}

/** Regiones de X que no están en Y, y al revés. */
function gaps(r: SetRelation, vars: readonly SetName[]) {
  const l = setRegions(r.left, vars);
  const rr = setRegions(r.right, vars);
  const onlyLeft = l.flatMap((x, i) => (x && !rr[i] ? [i] : []));
  const onlyRight = rr.flatMap((x, i) => (x && !l[i] ? [i] : []));
  return { onlyLeft, onlyRight };
}

/** La relación como dos máscaras de regiones (las de X que no están en Y, y al revés): se evalúa rápido. */
type Compiled = { op: SetRelationOp; left: number; right: number };
const compile = (r: SetRelation, vars: readonly SetName[]): Compiled => {
  const { onlyLeft, onlyRight } = gaps(r, vars);
  const mask = (rs: number[]) => rs.reduce((m, x) => m | (1 << x), 0);
  return { op: r.op, left: mask(onlyLeft), right: mask(onlyRight) };
};

function holds(c: Compiled, w: VennWorld): boolean {
  const sub = (w & c.left) === 0;
  const sup = (w & c.right) === 0;
  switch (c.op) {
    case "subseteq":
      return sub;
    case "supseteq":
      return sup;
    case "eq":
      return sub && sup;
    case "neq":
      return !(sub && sup);
    case "subset":
      return sub && !sup;
    case "supset":
      return sup && !sub;
    case "nsubseteq":
      return !sub;
  }
}

/** ¿Se cumple la relación en este mundo? */
export const relationHolds = (r: SetRelation, vars: readonly SetName[], w: VennWorld): boolean => holds(compile(r, vars), w);

/** Mundos que cumplen todos los supuestos (con U ≠ ∅: el mundo 0, sin ningún elemento, no cuenta). */
export function validWorlds(hypotheses: readonly SetRelation[], vars: readonly SetName[]): VennWorld[] {
  const total = 1 << regionCount(vars.length);
  const hs = hypotheses.map((h) => compile(h, vars));
  const out: VennWorld[] = [];
  for (let w = 1; w < total; w++) if (hs.every((h) => holds(h, w))) out.push(w);
  return out;
}

export interface HypothesesAnalysis {
  vars: SetName[];
  /** ¿Hay algún diagrama que cumpla todos los supuestos? */
  consistent: boolean;
  /** Regiones vacías en todo diagrama que cumple los supuestos («vacías por hipótesis»). */
  empty: boolean[];
  /** Regiones con algún elemento en todo diagrama que cumple los supuestos. */
  occupied: boolean[];
}

/** Qué regiones obligan a estar vacías (o con elementos) los supuestos. */
export function analyzeHypotheses(hypotheses: readonly SetRelation[], vars: readonly SetName[] = relationVars(hypotheses)): HypothesesAnalysis {
  const worlds = validWorlds(hypotheses, vars);
  const n = regionCount(vars.length);
  const regions = Array.from({ length: n }, (_, r) => r);
  return {
    vars: [...vars],
    consistent: worlds.length > 0,
    empty: regions.map((r) => worlds.length > 0 && worlds.every((w) => !worldHas(w, r))),
    occupied: regions.map((r) => worlds.length > 0 && worlds.every((w) => worldHas(w, r))),
  };
}

export type RelationVerdict = "siempre" | "nunca" | "depende";

export const VERDICT_TEXT: Record<RelationVerdict, string> = {
  siempre: "Siempre cierta",
  nunca: "Nunca cierta",
  depende: "Depende",
};

export interface RelationCheck {
  vars: SetName[];
  /** null si los supuestos se contradicen (no hay ningún diagrama que los cumpla). */
  verdict: RelationVerdict | null;
  /** Un diagrama que cumple los supuestos y en el que la relación es falsa (si lo hay). */
  counterexample: VennWorld | null;
  /** Un diagrama que cumple los supuestos y en el que la relación es cierta (si lo hay). */
  example: VennWorld | null;
}

/** El mundo con menos regiones con elementos (y, a igualdad, el de menor máscara). */
const simplest = (ws: readonly VennWorld[]): VennWorld | null =>
  ws.length === 0 ? null : ws.reduce((a, b) => (popcount(b) < popcount(a) ? b : a));

/**
 * ¿Es cierta la relación (todas, si es una cadena) bajo los supuestos? Por regiones, recorriendo todos
 * los diagramas posibles.
 */
export function checkRelation(relations: readonly SetRelation[], hypotheses: readonly SetRelation[] = []): RelationCheck {
  const vars = relationVars([...relations, ...hypotheses]);
  const worlds = validWorlds(hypotheses, vars);
  const rs = relations.map((r) => compile(r, vars));
  const yes = worlds.filter((w) => rs.every((r) => holds(r, w)));
  const no = worlds.filter((w) => !rs.every((r) => holds(r, w)));
  const verdict: RelationVerdict | null = worlds.length === 0 ? null : no.length === 0 ? "siempre" : yes.length === 0 ? "nunca" : "depende";
  return { vars, verdict, counterexample: simplest(no), example: simplest(yes) };
}

/** Orden de lectura de las regiones (de dentro hacia fuera), como en el diagrama. */
export const READING_ORDER: Record<2 | 3, readonly Region[]> = { 2: [3, 1, 2, 0], 3: [7, 3, 5, 6, 1, 2, 4, 0] };

/** Regiones con elementos de un mundo, en texto: «A ∩ Bᶜ; Aᶜ ∩ B» (o «ninguna», el mundo 0, que no cuenta). */
export function worldText(vars: readonly SetName[], w: VennWorld, order: readonly Region[] = READING_ORDER[vars.length as 2 | 3]): string {
  const list = order.filter((r) => worldHas(w, r)).map((r) => regionLabel(vars, r));
  return list.length === 0 ? "ninguna" : list.join("; ");
}

/** «A y B», «A, B y C». */
const namesText = (vars: readonly SetName[]) => (vars.length <= 1 ? vars.join("") : `${vars.slice(0, -1).join(", ")} y ${vars[vars.length - 1]}`);

/**
 * Dónde están los elementos de un mundo, para «con elementos solo …»: «en A ∩ B; Aᶜ ∩ B» o, si solo
 * la región de fuera tiene elementos, «fuera de A, B y C» (todos los conjuntos vacíos).
 */
export function worldPlace(vars: readonly SetName[], w: VennWorld, order: readonly Region[] = READING_ORDER[vars.length as 2 | 3]): string {
  if (w === 1) return `fuera de ${namesText(vars)} (${vars.length === 2 ? "los dos" : "todos"} vacíos)`;
  const list = order.filter((r) => worldHas(w, r)).map((r) => regionLabel(vars, r));
  // Lista con comas y «y», no con «;»: va dentro de una frase que ya tiene sus propias pausas.
  return `en ${list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`}`;
}

/**
 * Por qué falla (o se cumple) la relación en un mundo, en una frase: «la región A ∩ Bᶜ tiene elementos
 * y está en A, pero no en B».
 */
export function relationReason(r: SetRelation, vars: readonly SetName[], w: VennWorld): string {
  const { onlyLeft, onlyRight } = gaps(r, vars);
  const a = setToPlain(r.left);
  const b = setToPlain(r.right);
  const badLeft = onlyLeft.find((x) => worldHas(w, x));
  const badRight = onlyRight.find((x) => worldHas(w, x));
  const inLeft = (x: Region) => `la región ${regionLabel(vars, x)} tiene elementos y está en ${a}, pero no en ${b}`;
  const inRight = (x: Region) => `la región ${regionLabel(vars, x)} tiene elementos y está en ${b}, pero no en ${a}`;
  const same = `${a} y ${b} tienen exactamente los mismos elementos`;
  const holds = relationHolds(r, vars, w);
  switch (r.op) {
    case "subseteq":
      return holds ? `todo elemento de ${a} está en ${b}` : inLeft(badLeft!);
    case "supseteq":
      return holds ? `todo elemento de ${b} está en ${a}` : inRight(badRight!);
    case "eq":
      return holds ? same : badLeft !== undefined ? inLeft(badLeft) : inRight(badRight!);
    case "neq":
      return holds ? (badLeft !== undefined ? inLeft(badLeft) : inRight(badRight!)) : same;
    case "subset":
      return holds ? `${a} ⊆ ${b} y ${inRight(badRight!)}` : badLeft !== undefined ? inLeft(badLeft) : same;
    case "supset":
      return holds ? `${b} ⊆ ${a} y ${inLeft(badLeft!)}` : badRight !== undefined ? inRight(badRight) : same;
    case "nsubseteq":
      return holds ? inLeft(badLeft!) : `todo elemento de ${a} está en ${b}`;
  }
}

// ---------------------------------------------------------------- Dibujo anidado (dos conjuntos)

/**
 * Cómo dibujar A y B según las regiones vacías: A dentro de B, B dentro de A, separados (disjuntos) o
 * un solo círculo (A = B). null si los supuestos no fijan ninguna de esas formas.
 */
export type NestedShape = "A-en-B" | "B-en-A" | "separados" | "iguales";

export function nestedShape(analysis: HypothesesAnalysis): NestedShape | null {
  if (analysis.vars.length !== 2 || !analysis.consistent) return null;
  // Región 1: A ∩ Bᶜ; 2: Aᶜ ∩ B; 3: A ∩ B (la 0, fuera de los dos, no cambia el dibujo).
  const e = [1, 2, 3].map((r) => analysis.empty[r]!);
  const key = e.map((x) => (x ? "1" : "0")).join("");
  const shapes: Record<string, NestedShape> = { "100": "A-en-B", "010": "B-en-A", "001": "separados", "110": "iguales" };
  return shapes[key] ?? null;
}

// ---------------------------------------------------------------- Producto cartesiano (fijo)

/**
 * A × B ⊆ A ∪ B no se lee como relación entre expresiones de A, B y C (A × B es un conjunto de
 * pares), pero sale en los exámenes: con A y B no vacíos es siempre falsa, porque los elementos de
 * A × B son pares (a, b) y los de A ∪ B son elementos del universo U.
 */
export const CARTESIAN_RELATION = {
  text: "A × B ⊆ A ∪ B",
  tex: "A \\times B \\subseteq A \\cup B",
  explanation:
    "Los elementos de A × B son pares (a, b) con a ∈ A y b ∈ B; los de A ∪ B son elementos del universo U, y un par no es un elemento de U. Si A y B no son vacíos, A × B tiene algún par, que no está en A ∪ B: la inclusión es siempre falsa. (Solo con A = ∅ o B = ∅ es A × B = ∅, que sí está contenido en cualquier conjunto.)",
} as const;

/** ¿Obligan los supuestos a que A y B tengan elementos? Entonces A × B ⊆ A ∪ B es siempre falsa. */
export function forcesNonEmptyAB(hypotheses: readonly SetRelation[]): boolean {
  const vars = relationVars(hypotheses);
  const worlds = validWorlds(hypotheses, vars);
  const nonEmpty = (name: SetName, w: VennWorld) => {
    const i = vars.indexOf(name);
    return Array.from({ length: regionCount(vars.length) }, (_, r) => r).some((r) => ((r >> i) & 1) === 1 && worldHas(w, r));
  };
  return worlds.length > 0 && worlds.every((w) => nonEmpty("A", w) && nonEmpty("B", w));
}
