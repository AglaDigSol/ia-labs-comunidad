// Funciones entre conjuntos finitos según sus cardinales. Con |A| = a y |B| = b (los dos ≥ 1), una
// f: A → B
// - puede ser inyectiva si y solo si a ≤ b (palomar), y lo es necesariamente si a = 1;
// - puede ser sobreyectiva si y solo si a ≥ b, y lo es necesariamente si b = 1;
// - puede ser biyectiva (y tener inversa) si y solo si a = b, y lo es necesariamente si a = b = 1.
// Si además se sabe |f(A)| = c (1 ≤ c ≤ min(a, b)), ya no hay «puede»: f es inyectiva si y solo si
// c = a, sobreyectiva si y solo si c = b; y g: A → f(A), g(x) = f(x), es siempre sobreyectiva.
// También se cuentan funciones: bᵃ en total (VR_{b,a}), V_{b,a} inyectivas y a! biyecciones si a = b.
import { factorial, variations, variationsRep } from "./count.ts";

export const FN_PROPS = ["inyectiva", "sobreyectiva", "biyectiva", "inversa"] as const;
export type FnProp = (typeof FN_PROPS)[number];

/** «puede», «necesariamente», «no puede» y «no necesariamente». */
export const FN_MODES = ["puede", "necesariamente", "no-puede", "no-necesariamente"] as const;
export type FnMode = (typeof FN_MODES)[number];

export type FnStatement =
  /** «f puede ser inyectiva», «f es necesariamente sobreyectiva», «f no puede ser biyectiva». */
  | { k: "modal"; mode: FnMode; prop: FnProp }
  /** Con |f(A)| conocido: «f es inyectiva». */
  | { k: "fixed"; prop: FnProp }
  /** Con |f(A)| conocido: «g: A → f(A) es sobreyectiva». */
  | { k: "onto-image"; prop: FnProp }
  /** «Hay exactamente N funciones (inyectivas, biyectivas) de A en B». */
  | { k: "count"; what: "todas" | "inyectivas" | "biyectivas"; value: number };

export interface FnSetting {
  a: number;
  b: number;
  /** |f(A)|, si se conoce. */
  image?: number;
  /** A ⊊ B (subconjunto propio): solo cambia cómo se dice; implica |A| < |B|. */
  subset?: boolean;
}

export const MAX_FN_CARD = 12;

/** ¿El planteamiento es posible? */
export function settingProblem(s: FnSetting): string | null {
  const ok = (x: number) => Number.isSafeInteger(x) && x >= 1 && x <= MAX_FN_CARD;
  if (!ok(s.a) || !ok(s.b)) return `|A| y |B| tienen que ser naturales entre 1 y ${MAX_FN_CARD}.`;
  if (s.subset && s.a >= s.b) return "Si A ⊊ B, |A| tiene que ser menor que |B|.";
  if (s.image !== undefined && (!ok(s.image) || s.image > Math.min(s.a, s.b))) return "|f(A)| no puede ser mayor que |A| ni que |B|.";
  return null;
}

export type Modal = { possible: boolean; necessary: boolean };

/** Qué puede ser y qué es necesariamente una f: A → B con esos cardinales. */
export function functionFacts(a: number, b: number): Record<FnProp, Modal> {
  const bij = { possible: a === b, necessary: a === 1 && b === 1 };
  return {
    inyectiva: { possible: a <= b, necessary: a === 1 },
    sobreyectiva: { possible: a >= b, necessary: b === 1 },
    biyectiva: bij,
    inversa: bij,
  };
}

/** Con |f(A)| = c: qué es f, y qué es g: A → f(A). */
export function imageFacts(a: number, b: number, c: number): { f: Record<FnProp, boolean>; g: Record<FnProp, boolean> } {
  const fi = c === a;
  const fs = c === b;
  return {
    f: { inyectiva: fi, sobreyectiva: fs, biyectiva: fi && fs, inversa: fi && fs },
    g: { inyectiva: fi, sobreyectiva: true, biyectiva: fi, inversa: fi },
  };
}

/** Cuántas funciones hay de A en B (todas, inyectivas o biyectivas). */
export function countFunctions(a: number, b: number, what: "todas" | "inyectivas" | "biyectivas"): bigint {
  if (what === "todas") return variationsRep(b, a);
  if (what === "inyectivas") return variations(b, a);
  return a === b ? factorial(a) : 0n;
}

/** ¿Es verdadera la afirmación? */
export function statementTrue(st: FnStatement, s: FnSetting): boolean {
  switch (st.k) {
    case "modal": {
      const f = functionFacts(s.a, s.b)[st.prop];
      return st.mode === "puede" ? f.possible : st.mode === "necesariamente" ? f.necessary : st.mode === "no-necesariamente" ? !f.necessary : !f.possible;
    }
    case "fixed":
    case "onto-image": {
      if (s.image === undefined) throw new Error("afirmación sobre f(A) sin |f(A)|");
      const facts = imageFacts(s.a, s.b, s.image);
      return (st.k === "fixed" ? facts.f : facts.g)[st.prop];
    }
    case "count":
      return countFunctions(s.a, s.b, st.what) === BigInt(st.value);
  }
}

const PROP_TEXT: Record<FnProp, { ser: string; adj: string }> = {
  inyectiva: { ser: "ser inyectiva", adj: "es inyectiva" },
  sobreyectiva: { ser: "ser sobreyectiva", adj: "es sobreyectiva" },
  biyectiva: { ser: "ser biyectiva", adj: "es biyectiva" },
  inversa: { ser: "tener inversa", adj: "tiene inversa" },
};

/** La afirmación como frase. */
export function statementText(st: FnStatement): string {
  switch (st.k) {
    case "modal":
      if (st.mode === "puede") return `f puede ${PROP_TEXT[st.prop].ser}.`;
      if (st.mode === "no-puede") return `f no puede ${PROP_TEXT[st.prop].ser}.`;
      if (st.mode === "no-necesariamente") return st.prop === "inversa" ? "No necesariamente f tiene inversa." : `f no es necesariamente ${st.prop}.`;
      return st.prop === "inversa" ? "Necesariamente f tiene inversa." : `f ${PROP_TEXT[st.prop].adj} necesariamente.`;
    case "fixed":
      return `f ${PROP_TEXT[st.prop].adj}.`;
    case "onto-image":
      return `g: A → f(A), g(x) = f(x), ${PROP_TEXT[st.prop].adj}.`;
    case "count": {
      const one = st.value === 1;
      const noun = one ? "función" : "funciones";
      const adj = st.what === "todas" ? "" : st.what === "inyectivas" ? (one ? " inyectiva" : " inyectivas") : one ? " biyectiva" : " biyectivas";
      return `Hay exactamente ${st.value} ${noun}${adj} de A en B.`;
    }
  }
}

/** Por qué es verdadera o falsa (para después de contestar o para la solución). */
export function statementReason(st: FnStatement, s: FnSetting): string {
  const { a, b } = s;
  switch (st.k) {
    case "modal": {
      const p = st.prop;
      if (p === "inyectiva") {
        if (st.mode === "necesariamente" || st.mode === "no-necesariamente") return a === 1 ? "Con un solo elemento en A no hay dos imágenes que puedan coincidir." : `Con |A| = ${a} ≥ 2 basta mandar dos elementos al mismo: no es necesariamente inyectiva.`;
        return a <= b ? `|A| = ${a} ≤ |B| = ${b}: hay sitio para mandar cada elemento a uno distinto.` : `|A| = ${a} > |B| = ${b}: por el principio del palomar, dos elementos de A comparten imagen.`;
      }
      if (p === "sobreyectiva") {
        if (st.mode === "necesariamente" || st.mode === "no-necesariamente") return b === 1 ? "B tiene un solo elemento y todo va a él: siempre es sobreyectiva." : `Con |B| = ${b} ≥ 2 puede que todo vaya a un mismo elemento: no es necesariamente sobreyectiva.`;
        return a >= b ? `|A| = ${a} ≥ |B| = ${b}: hay elementos de sobra para cubrir todo B.` : `|A| = ${a} < |B| = ${b}: la imagen tiene como mucho ${a} elementos y no cubre B.`;
      }
      if (st.mode === "necesariamente" || st.mode === "no-necesariamente") return a === 1 && b === 1 ? "Con un solo elemento en A y en B, la única función es biyectiva." : "Hay funciones que no son biyectivas (por ejemplo, una constante, si hay más de un elemento).";
      return a === b ? `|A| = |B| = ${a}: una biyección existe (y solo entonces hay inversa).` : `|A| = ${a} ≠ |B| = ${b}: ninguna función es biyectiva, así que ninguna tiene inversa.`;
    }
    case "fixed": {
      const c = s.image!;
      const inj = c === a ? `|f(A)| = |A| = ${a}: elementos distintos van a imágenes distintas` : `|f(A)| = ${c} < |A| = ${a}: dos elementos comparten imagen`;
      const sob = c === b ? `|f(A)| = |B| = ${b}: la imagen es todo B` : `|f(A)| = ${c} < |B| = ${b}: la imagen no es todo B`;
      if (st.prop === "inyectiva") return `${inj}.`;
      if (st.prop === "sobreyectiva") return `${sob}.`;
      return `Hace falta inyectiva y sobreyectiva: ${inj}; ${sob}.`;
    }
    case "onto-image": {
      const c = s.image!;
      if (st.prop === "sobreyectiva") return "Su codominio es f(A), la propia imagen: todo elemento de f(A) es imagen de alguno de A.";
      return c === a ? `g es sobreyectiva y, como |f(A)| = |A| = ${a}, también inyectiva: es biyectiva.` : `|f(A)| = ${c} < |A| = ${a}: g no es inyectiva, así que no es biyectiva.`;
    }
    case "count": {
      const real = countFunctions(a, b, st.what);
      if (st.what === "todas") return `Cada uno de los ${a} elementos de A elige imagen entre ${b}: VR(${b}, ${a}) = ${b}^${a} = ${real}.`;
      if (st.what === "inyectivas") return a <= b ? `Imágenes distintas y en orden: V(${b}, ${a}) = ${real}.` : `Con |A| > |B| no hay ninguna inyectiva: 0.`;
      return a === b ? `Las biyecciones son las ordenaciones de B: ${a}! = ${real}.` : "Con |A| ≠ |B| no hay ninguna biyección: 0.";
    }
  }
}

/** Pistas generales (las reglas, sin decir qué afirmaciones son verdaderas). */
export function functionHints(s: FnSetting): string[] {
  const out = [
    "Inyectiva: elementos distintos de A van a elementos distintos de B. Solo es posible si |A| ≤ |B| (principio del palomar).",
    "Sobreyectiva: todo elemento de B es imagen de alguno de A. Solo es posible si |A| ≥ |B|.",
    "Biyectiva = inyectiva y sobreyectiva; solo entonces hay inversa. Hace falta |A| = |B|.",
    "«Puede» pide que exista al menos una función así; «necesariamente», que lo sean todas (piensa en una función constante como contraejemplo).",
  ];
  if (s.subset) out.push("A ⊊ B quiere decir que A está dentro de B y le falta algún elemento: |A| < |B|.");
  if (s.image !== undefined) out.push("Con |f(A)| conocido: f es inyectiva si |f(A)| = |A| y sobreyectiva si |f(A)| = |B|. Y A → f(A) siempre es sobreyectiva.");
  out.push("Para contar funciones: cada elemento de A elige su imagen en B (variaciones con repetición); si son inyectivas, sin repetir imagen (variaciones).");
  return out;
}
