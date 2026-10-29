// Conjuntos finitos escritos por extensión: lectura de listas de elementos ({1, 2, 3}), de familias
// de conjuntos (∅, {a}, {a, b}) y de pares ((1, a), (2, b)), el conjunto de partes 𝒫(A), el producto
// cartesiano A × B y la corrección de una respuesta como conjunto (sin importar el orden).

export const MAX_SET_ELEMENTS = 12;
export const MAX_SET_ELEMENT_LENGTH = 12;
/** 𝒫(A) solo se practica con |A| ≤ 4 (16 subconjuntos) y A × B con |A|, |B| ≤ 4. */
export const MAX_POWER_SET_BASE = 4;
export const MAX_PRODUCT_SIDE = 4;

export type ListParse<T> = { ok: true; value: T } | { ok: false; error: string };

const ELEMENT_RE = /^[\p{L}\p{N}_]+$/u;
const EMPTY_GLYPHS = new Set(["∅", "Ø", "ø", "⌀"]);

function checkElement(raw: string): string | null {
  if (raw === "") return "Hay un elemento vacío: revisa las comas.";
  if (raw.length > MAX_SET_ELEMENT_LENGTH) return `«${raw.slice(0, MAX_SET_ELEMENT_LENGTH)}…» es demasiado largo (como mucho ${MAX_SET_ELEMENT_LENGTH} caracteres).`;
  if (!ELEMENT_RE.test(raw)) return `«${raw}» no es un elemento válido: usa letras o números separados por comas.`;
  return null;
}

/**
 * Lee un conjunto por extensión: «1, 2, 3», «{1, 2, 3}», «∅» o «{}». Los repetidos se quitan (un
 * conjunto no tiene elementos repetidos) y se devuelven aparte.
 */
export function parseElementList(text: string): ListParse<{ elements: string[]; repeated: string[] }> {
  let s = text.trim();
  if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1).trim();
  if (s === "" || EMPTY_GLYPHS.has(s)) return { ok: true, value: { elements: [], repeated: [] } };
  if (/[{}()]/.test(s)) return { ok: false, error: "Escribe los elementos separados por comas, sin llaves ni paréntesis dentro." };
  const elements: string[] = [];
  const repeated: string[] = [];
  for (const part of s.split(",")) {
    const el = part.trim();
    const bad = checkElement(el);
    if (bad) return { ok: false, error: bad };
    if (elements.includes(el)) {
      if (!repeated.includes(el)) repeated.push(el);
    } else elements.push(el);
  }
  if (elements.length > MAX_SET_ELEMENTS) return { ok: false, error: `Como mucho ${MAX_SET_ELEMENTS} elementos.` };
  return { ok: true, value: { elements, repeated } };
}

type Tok = { t: "{" | "}" | "(" | ")" | "," | "empty" | "el"; v: string };

function lex(text: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "{" || ch === "}" || ch === "(" || ch === ")" || ch === ",") {
      out.push({ t: ch, v: ch });
      i++;
      continue;
    }
    if (EMPTY_GLYPHS.has(ch)) {
      out.push({ t: "empty", v: ch });
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && /[\p{L}\p{N}_]/u.test(text[j]!)) j++;
    if (j === i) return `No reconozco «${ch}».`;
    const el = text.slice(i, j);
    const bad = checkElement(el);
    if (bad) return bad;
    out.push({ t: "el", v: el });
    i = j;
  }
  return out;
}

/** Quita unas llaves exteriores si envuelven toda la lista: «{ ∅, {a} }» o «{ (1, a), (2, b) }». */
function unwrap(toks: Tok[], inner: Tok["t"][]): Tok[] {
  if (toks.length < 2 || toks[0]!.t !== "{" || toks[toks.length - 1]!.t !== "}") return toks;
  // Solo si lo de dentro empieza como un elemento de la familia (otra llave, ∅ o un paréntesis).
  if (toks.length === 2) return toks;
  if (!inner.includes(toks[1]!.t)) return toks;
  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i]!.t === "{") depth++;
    if (toks[i]!.t === "}") depth--;
    if (depth === 0 && i < toks.length - 1) return toks;
  }
  return toks.slice(1, -1);
}

/**
 * Lee una familia de conjuntos, como una respuesta de 𝒫(A): «∅, {a}, {b}, {a, b}», con o sin llaves
 * exteriores. Cada subconjunto se devuelve con sus elementos sin repetir, en el orden escrito.
 */
export function parseSetFamily(text: string): ListParse<string[][]> {
  const lexed = lex(text);
  if (typeof lexed === "string") return { ok: false, error: lexed };
  const toks = unwrap(lexed, ["{", "empty"]);
  const out: string[][] = [];
  let i = 0;
  if (toks.length === 0) return { ok: true, value: [] };
  for (;;) {
    const t = toks[i];
    if (!t) return { ok: false, error: "Falta un subconjunto al final." };
    if (t.t === "empty") {
      out.push([]);
      i++;
    } else if (t.t === "{") {
      i++;
      const els: string[] = [];
      if (toks[i]?.t === "}") i++;
      else {
        for (;;) {
          const e = toks[i];
          if (!e || e.t !== "el") return { ok: false, error: "Dentro de cada subconjunto van elementos separados por comas: {a, b}." };
          if (!els.includes(e.v)) els.push(e.v);
          i++;
          const sep = toks[i];
          if (sep?.t === ",") {
            i++;
            continue;
          }
          if (sep?.t === "}") {
            i++;
            break;
          }
          return { ok: false, error: "Falta cerrar una llave «}» o una coma entre elementos." };
        }
      }
      out.push(els);
    } else return { ok: false, error: "Cada subconjunto se escribe entre llaves, como {a, b}, o ∅ para el vacío." };
    if (i >= toks.length) break;
    if (toks[i]!.t !== ",") return { ok: false, error: "Separa los subconjuntos con comas." };
    i++;
  }
  if (out.length > 64) return { ok: false, error: "Demasiados subconjuntos." };
  return { ok: true, value: out };
}

/** Lee una lista de pares ordenados, como una respuesta de A × B: «(1, a), (1, b)», con o sin llaves. */
export function parsePairList(text: string): ListParse<Array<[string, string]>> {
  const lexed = lex(text);
  if (typeof lexed === "string") return { ok: false, error: lexed };
  const toks = unwrap(lexed, ["("]);
  const out: Array<[string, string]> = [];
  if (toks.length === 0) return { ok: true, value: [] };
  let i = 0;
  for (;;) {
    const [o, a, c, b, cl] = toks.slice(i, i + 5);
    if (o?.t !== "(" || a?.t !== "el" || c?.t !== "," || b?.t !== "el" || cl?.t !== ")") {
      return { ok: false, error: "Cada par se escribe entre paréntesis, con dos componentes: (1, a)." };
    }
    out.push([a.v, b.v]);
    i += 5;
    if (i >= toks.length) break;
    if (toks[i]!.t !== ",") return { ok: false, error: "Separa los pares con comas." };
    i++;
  }
  if (out.length > 64) return { ok: false, error: "Demasiados pares." };
  return { ok: true, value: out };
}

/** 𝒫(A): todos los subconjuntos, por tamaño y en el orden de A. */
export function powerSetOf<T>(a: readonly T[]): T[][] {
  const n = a.length;
  const all: T[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) all.push(a.filter((_, i) => (mask >> i) & 1));
  return all.sort((x, y) => x.length - y.length);
}

/** A × B: los pares (a, b), en el orden de A y luego de B. */
export function cartesianProduct<T, S>(a: readonly T[], b: readonly S[]): Array<[T, S]> {
  return a.flatMap((x) => b.map((y): [T, S] => [x, y]));
}

/** Clave de un subconjunto que no depende del orden en que se escriben sus elementos. */
const subsetKey = (s: readonly string[]) => [...new Set(s)].sort().join("\u0000");

/** Llaves para mostrar un subconjunto: {a, b} o ∅. */
export const subsetText = (s: readonly string[]): string => (s.length === 0 ? "∅" : `{${s.join(", ")}}`);

export type ListCheck = {
  /** Índices de lo que el estudiante escribió y no pertenece al conjunto pedido. */
  wrong: number[];
  /** Índices de los que repiten uno anterior. */
  repeated: number[];
  /** Cuántos elementos del conjunto pedido faltan (sin decir cuáles). */
  missing: number;
  /** Elementos distintos y correctos que ha escrito. */
  right: number;
  correct: boolean;
};

function checkByKeys(answerKeys: string[], valid: (i: number) => boolean, total: number): ListCheck {
  const seen = new Set<string>();
  const wrong: number[] = [];
  const repeated: number[] = [];
  answerKeys.forEach((k, i) => {
    if (!valid(i)) wrong.push(i);
    else if (seen.has(k)) repeated.push(i);
    else seen.add(k);
  });
  const right = seen.size;
  return { wrong, repeated, missing: total - right, right, correct: wrong.length === 0 && right === total };
}

/** Corrige una lista de subconjuntos como 𝒫(A): un elemento está mal si no es subconjunto de A. */
export function checkPowerSet(answer: readonly string[][], a: readonly string[]): ListCheck {
  const inA = new Set(a);
  return checkByKeys(
    answer.map(subsetKey),
    (i) => answer[i]!.every((x) => inA.has(x)),
    1 << new Set(a).size,
  );
}

/** Corrige una lista de pares como A × B: un par está mal si su primera componente no es de A o la segunda no es de B. */
export function checkProduct(answer: ReadonlyArray<readonly [string, string]>, a: readonly string[], b: readonly string[]): ListCheck & {
  /** ¿Hay algún par al revés, (b, a), que sí estaría en B × A? */
  reversed: boolean;
} {
  const inA = new Set(a);
  const inB = new Set(b);
  const r = checkByKeys(
    answer.map(([x, y]) => `${x}\u0000${y}`),
    (i) => inA.has(answer[i]![0]) && inB.has(answer[i]![1]),
    new Set(a).size * new Set(b).size,
  );
  const reversed = r.wrong.some((i) => inB.has(answer[i]![0]) && inA.has(answer[i]![1]));
  return { ...r, reversed };
}

/** Corrige un conjunto de elementos contra el resultado esperado (sin importar el orden). */
export function checkElements(answer: readonly string[], expected: readonly string[]): ListCheck {
  const want = new Set(expected);
  return checkByKeys([...answer], (i) => want.has(answer[i]!), want.size);
}
