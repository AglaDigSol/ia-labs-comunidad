// Estructuras (B, ⊕, ⊙, ′, 0, 1) sobre un conjunto FINITO y comprobación exhaustiva de los axiomas
// B1–B5. Los elementos son índices 0..n-1 con una etiqueta; las operaciones son tablas.

export const MAX_ELEMENTS = 16;
export const MAX_CUSTOM_ELEMENTS = 4;

export interface FiniteStructure {
  /** Nombre corto para mostrar, por ejemplo «D₃₀» o «P({a,b})». */
  name: string;
  /** Etiquetas de los elementos (distintas). */
  elements: string[];
  /** plus[a][b] = a ⊕ b (índices). */
  plus: number[][];
  /** times[a][b] = a ⊙ b. */
  times: number[][];
  /** comp[a] = a′. */
  comp: number[];
  /** Índice del elemento 0 (neutro de ⊕ en un álgebra de Boole). */
  zero: number;
  /** Índice del elemento 1 (neutro de ⊙). */
  one: number;
}

export type AxiomId = "B1" | "B2" | "B3" | "B4" | "B5";
export const AXIOM_IDS: AxiomId[] = ["B1", "B2", "B3", "B4", "B5"];

/** Cuántos elementos (a, b, c) hacen falta para dar un contraejemplo de cada axioma. */
export const AXIOM_ARITY: Record<AxiomId, 1 | 2 | 3> = { B1: 2, B2: 3, B3: 1, B4: 3, B5: 1 };

export const AXIOM_NAMES: Record<AxiomId, string> = {
  B1: "B1 · Conmutativas",
  B2: "B2 · Asociativas",
  B3: "B3 · Identidad",
  B4: "B4 · Distributivas",
  B5: "B5 · Complementación",
};

/** Cada identidad concreta que forma parte de un axioma. */
export type IdentityId =
  | "B1+"
  | "B1·"
  | "B2+"
  | "B2·"
  | "B3≠"
  | "B3+"
  | "B3·"
  | "B4·+"
  | "B4+·"
  | "B5+"
  | "B5·";

export const IDENTITIES: Record<IdentityId, { axiom: AxiomId; text: string; tex: string }> = {
  "B1+": { axiom: "B1", text: "a ⊕ b = b ⊕ a", tex: "a \\oplus b = b \\oplus a" },
  "B1·": { axiom: "B1", text: "a ⊙ b = b ⊙ a", tex: "a \\odot b = b \\odot a" },
  "B2+": { axiom: "B2", text: "a ⊕ (b ⊕ c) = (a ⊕ b) ⊕ c", tex: "a \\oplus (b \\oplus c) = (a \\oplus b) \\oplus c" },
  "B2·": { axiom: "B2", text: "a ⊙ (b ⊙ c) = (a ⊙ b) ⊙ c", tex: "a \\odot (b \\odot c) = (a \\odot b) \\odot c" },
  "B3≠": { axiom: "B3", text: "0 ≠ 1", tex: "0 \\neq 1" },
  "B3+": { axiom: "B3", text: "a ⊕ 0 = a", tex: "a \\oplus 0 = a" },
  "B3·": { axiom: "B3", text: "1 ⊙ a = a", tex: "1 \\odot a = a" },
  "B4·+": { axiom: "B4", text: "a ⊙ (b ⊕ c) = (a ⊙ b) ⊕ (a ⊙ c)", tex: "a \\odot (b \\oplus c) = (a \\odot b) \\oplus (a \\odot c)" },
  "B4+·": { axiom: "B4", text: "a ⊕ (b ⊙ c) = (a ⊕ b) ⊙ (a ⊕ c)", tex: "a \\oplus (b \\odot c) = (a \\oplus b) \\odot (a \\oplus c)" },
  "B5+": { axiom: "B5", text: "a ⊕ a′ = 1", tex: "a \\oplus a' = 1" },
  "B5·": { axiom: "B5", text: "a ⊙ a′ = 0", tex: "a \\odot a' = 0" },
};

export const AXIOM_IDENTITIES: Record<AxiomId, IdentityId[]> = {
  B1: ["B1+", "B1·"],
  B2: ["B2+", "B2·"],
  B3: ["B3≠", "B3+", "B3·"],
  B4: ["B4·+", "B4+·"],
  B5: ["B5+", "B5·"],
};

/** Un caso en el que una identidad falla: los elementos usados y los dos lados (índices). */
export type Violation = { identity: IdentityId; a: number; b: number; c: number; lhs: number; rhs: number };

export type AxiomResult = { axiom: AxiomId; holds: boolean; counterexample: Violation | null };

/** Evalúa una identidad en (a, b, c); devuelve los dos lados. */
export function evalIdentity(s: FiniteStructure, id: IdentityId, a: number, b = 0, c = 0): { lhs: number; rhs: number } {
  const P = s.plus;
  const T = s.times;
  switch (id) {
    case "B1+":
      return { lhs: P[a]![b]!, rhs: P[b]![a]! };
    case "B1·":
      return { lhs: T[a]![b]!, rhs: T[b]![a]! };
    case "B2+":
      return { lhs: P[a]![P[b]![c]!]!, rhs: P[P[a]![b]!]![c]! };
    case "B2·":
      return { lhs: T[a]![T[b]![c]!]!, rhs: T[T[a]![b]!]![c]! };
    case "B3≠":
      return { lhs: s.zero, rhs: s.one };
    case "B3+":
      return { lhs: P[a]![s.zero]!, rhs: a };
    case "B3·":
      return { lhs: T[s.one]![a]!, rhs: a };
    case "B4·+":
      return { lhs: T[a]![P[b]![c]!]!, rhs: P[T[a]![b]!]![T[a]![c]!]! };
    case "B4+·":
      return { lhs: P[a]![T[b]![c]!]!, rhs: T[P[a]![b]!]![P[a]![c]!]! };
    case "B5+":
      return { lhs: P[a]![s.comp[a]!]!, rhs: s.one };
    case "B5·":
      return { lhs: T[a]![s.comp[a]!]!, rhs: s.zero };
  }
}

/** ¿Falla la identidad en (a, b, c)? «0 ≠ 1» falla cuando 0 y 1 son el mismo elemento. */
export function identityFails(s: FiniteStructure, id: IdentityId, a: number, b = 0, c = 0): boolean {
  const { lhs, rhs } = evalIdentity(s, id, a, b, c);
  return id === "B3≠" ? lhs === rhs : lhs !== rhs;
}

/** Comprobación exhaustiva de un axioma; el contraejemplo es el primero en orden (a, b, c). */
export function checkAxiom(s: FiniteStructure, axiom: AxiomId): AxiomResult {
  const n = s.elements.length;
  const arity = AXIOM_ARITY[axiom];
  for (const id of AXIOM_IDENTITIES[axiom]) {
    if (id === "B3≠") {
      if (identityFails(s, id, 0)) {
        return { axiom, holds: false, counterexample: { identity: id, a: 0, b: 0, c: 0, lhs: s.zero, rhs: s.one } };
      }
      continue;
    }
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < (arity >= 2 ? n : 1); b++) {
        for (let c = 0; c < (arity >= 3 ? n : 1); c++) {
          const { lhs, rhs } = evalIdentity(s, id, a, b, c);
          if (lhs !== rhs) return { axiom, holds: false, counterexample: { identity: id, a, b, c, lhs, rhs } };
        }
      }
    }
  }
  return { axiom, holds: true, counterexample: null };
}

export function checkAllAxioms(s: FiniteStructure): AxiomResult[] {
  return AXIOM_IDS.map((id) => checkAxiom(s, id));
}

export const isBooleanAlgebra = (s: FiniteStructure): boolean => checkAllAxioms(s).every((r) => r.holds);

/**
 * ¿Es (a, b, c) un contraejemplo del axioma? Devuelve la identidad que falla, o null. Si 0 = 1, cualquier
 * elección rompe B3.
 */
export function counterexampleFor(s: FiniteStructure, axiom: AxiomId, a: number, b = 0, c = 0): Violation | null {
  for (const id of AXIOM_IDENTITIES[axiom]) {
    if (identityFails(s, id, a, b, c)) {
      const { lhs, rhs } = evalIdentity(s, id, a, b, c);
      return { identity: id, a, b, c, lhs, rhs };
    }
  }
  return null;
}

/** Comprueba que las tablas tienen el tamaño correcto y solo contienen elementos del conjunto. */
export function validateStructure(s: FiniteStructure): string | null {
  const n = s.elements.length;
  if (n < 1) return "El conjunto no puede estar vacío.";
  if (n > MAX_ELEMENTS) return `El conjunto tiene ${n} elementos; el máximo es ${MAX_ELEMENTS}.`;
  if (new Set(s.elements).size !== n) return "Los elementos deben tener nombres distintos.";
  const ok = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;
  const table = (t: number[][]) => t.length === n && t.every((row) => row.length === n && row.every(ok));
  if (!table(s.plus) || !table(s.times)) return "Las tablas de ⊕ y ⊙ deben ser cuadradas y usar solo elementos del conjunto.";
  if (s.comp.length !== n || !s.comp.every(ok)) return "La fila de ′ debe tener un elemento del conjunto para cada elemento.";
  if (!ok(s.zero) || !ok(s.one)) return "0 y 1 deben ser elementos del conjunto.";
  return null;
}

// ---------------------------------------------------------------- Orden y diagrama de Hasse

/** a ≤ b ⇔ a ⊕ b = b. */
export const leq = (s: FiniteStructure, a: number, b: number): boolean => s.plus[a]![b]! === b;

export type OrderCheck = { ok: true } | { ok: false; property: "reflexiva" | "antisimétrica" | "transitiva"; a: number; b: number; c: number };

/** ¿Es ≤ un orden parcial? (con tablas arbitrarias puede no serlo). */
export function checkPartialOrder(s: FiniteStructure): OrderCheck {
  const n = s.elements.length;
  for (let a = 0; a < n; a++) if (!leq(s, a, a)) return { ok: false, property: "reflexiva", a, b: a, c: a };
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a !== b && leq(s, a, b) && leq(s, b, a)) return { ok: false, property: "antisimétrica", a, b, c: b };
    }
  }
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (!leq(s, a, b)) continue;
      for (let c = 0; c < n; c++) {
        if (leq(s, b, c) && !leq(s, a, c)) return { ok: false, property: "transitiva", a, b, c };
      }
    }
  }
  return { ok: true };
}

export type Hasse = {
  /** Pares [a, b] con a ⋖ b (b cubre a): a < b sin nada en medio. */
  covers: Array<[number, number]>;
  /** Nivel de cada elemento: longitud de la cadena más larga desde un minimal. */
  rank: number[];
};

/** Relación de cobertura y niveles del orden a ≤ b ⇔ a ⊕ b = b, o null si no es un orden parcial. */
export function hasse(s: FiniteStructure): Hasse | null {
  if (!checkPartialOrder(s).ok) return null;
  const n = s.elements.length;
  const lt = (a: number, b: number) => a !== b && leq(s, a, b);
  const covers: Array<[number, number]> = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (!lt(a, b)) continue;
      let between = false;
      for (let c = 0; c < n && !between; c++) between = lt(a, c) && lt(c, b);
      if (!between) covers.push([a, b]);
    }
  }
  const rank = new Array<number>(n).fill(-1);
  const rankOf = (x: number): number => {
    if (rank[x]! >= 0) return rank[x]!;
    let r = 0;
    for (const [a, b] of covers) if (b === x) r = Math.max(r, rankOf(a) + 1);
    rank[x] = r;
    return r;
  };
  for (let x = 0; x < n; x++) rankOf(x);
  return { covers, rank };
}

// ---------------------------------------------------------------- Construcciones estándar

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const tableOf = (n: number, f: (a: number, b: number) => number) => range(n).map((a) => range(n).map((b) => f(a, b)));

/** {0, 1} con las tablas habituales. */
export function twoElement(): FiniteStructure {
  return {
    name: "{0, 1}",
    elements: ["0", "1"],
    plus: [
      [0, 1],
      [1, 1],
    ],
    times: [
      [0, 0],
      [0, 1],
    ],
    comp: [1, 0],
    zero: 0,
    one: 1,
  };
}

/** P(A): partes de A con ∪, ∩ y el complemento A ∖ X. Los subconjuntos se codifican como máscaras. */
export function powerSet(base: string[]): FiniteStructure {
  const k = base.length;
  if (k > 4) throw new Error("powerSet: como mucho 4 elementos en A");
  const n = 1 << k;
  const full = n - 1;
  const label = (m: number) => {
    const xs = base.filter((_, i) => m & (1 << i));
    return xs.length === 0 ? "∅" : `{${xs.join(",")}}`;
  };
  // Orden de presentación: por tamaño y, dentro, por máscara.
  const order = range(n).sort((x, y) => popcount(x) - popcount(y) || x - y);
  const idx = new Map(order.map((m, i) => [m, i]));
  const at = (m: number) => idx.get(m)!;
  return {
    name: `P({${base.join(",")}})`,
    elements: order.map(label),
    plus: order.map((x) => order.map((y) => at(x | y))),
    times: order.map((x) => order.map((y) => at(x & y))),
    comp: order.map((x) => at(full & ~x)),
    zero: at(0),
    one: at(full),
  };
}

function popcount(x: number): number {
  let c = 0;
  for (let v = x; v; v &= v - 1) c++;
  return c;
}

/** {0, 1}ⁿ con las operaciones componente a componente. */
export function cube(n: number): FiniteStructure {
  if (n < 1 || n > 4) throw new Error("cube: 1 ≤ n ≤ 4");
  const size = 1 << n;
  const label = (m: number) => range(n).map((i) => ((m >> (n - 1 - i)) & 1 ? "1" : "0")).join("");
  return {
    name: n === 1 ? "{0, 1}" : `{0, 1}${["", "", "²", "³", "⁴"][n]}`,
    elements: range(size).map(label),
    plus: tableOf(size, (a, b) => a | b),
    times: tableOf(size, (a, b) => a & b),
    comp: range(size).map((a) => (size - 1) & ~a),
    zero: 0,
    one: size - 1,
  };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => String(n).replace(/\d/g, (d) => SUBSCRIPT[Number(d)]!);

/** Divisores de n con ⊕ = mcm, ⊙ = mcd y x′ = n / x. Es de Boole si y solo si n no tiene cuadrados. */
export function divisors(n: number): FiniteStructure {
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error("divisors: 1 ≤ n ≤ 1000");
  const ds = range(n + 1).filter((d) => d >= 1 && n % d === 0);
  if (ds.length > MAX_ELEMENTS) throw new Error("divisors: demasiados divisores");
  const at = (d: number) => ds.indexOf(d);
  return {
    name: `D${sub(n)}`,
    elements: ds.map(String),
    plus: ds.map((a) => ds.map((b) => at(lcm(a, b)))),
    times: ds.map((a) => ds.map((b) => at(gcd(a, b)))),
    comp: ds.map((a) => at(n / a)),
    zero: at(1),
    one: at(n),
  };
}

/** Producto B₁ × B₂ con las operaciones componente a componente. */
export function product(s1: FiniteStructure, s2: FiniteStructure): FiniteStructure {
  const n1 = s1.elements.length;
  const n2 = s2.elements.length;
  if (n1 * n2 > MAX_ELEMENTS) throw new Error(`product: más de ${MAX_ELEMENTS} elementos`);
  const pair = (i: number, j: number) => i * n2 + j;
  const els = range(n1 * n2);
  const fst = (x: number) => Math.floor(x / n2);
  const snd = (x: number) => x % n2;
  return {
    name: `${s1.name} × ${s2.name}`,
    elements: els.map((x) => `(${s1.elements[fst(x)]},${s2.elements[snd(x)]})`),
    plus: els.map((x) => els.map((y) => pair(s1.plus[fst(x)]![fst(y)]!, s2.plus[snd(x)]![snd(y)]!))),
    times: els.map((x) => els.map((y) => pair(s1.times[fst(x)]![fst(y)]!, s2.times[snd(x)]![snd(y)]!))),
    comp: els.map((x) => pair(s1.comp[fst(x)]!, s2.comp[snd(x)]!)),
    zero: pair(s1.zero, s2.zero),
    one: pair(s1.one, s2.one),
  };
}

/** Etiquetas de una estructura personalizada de n elementos (2 ≤ n ≤ 4): 0 … 1. */
export function customLabels(n: number): string[] {
  return n === 2 ? ["0", "1"] : n === 3 ? ["0", "a", "1"] : ["0", "a", "b", "1"];
}

/** Estructura personalizada: el 0 es el primer elemento y el 1 el último. */
export function customStructure(t: { plus: number[][]; times: number[][]; comp: number[] }): FiniteStructure {
  const n = t.comp.length;
  if (n < 2 || n > MAX_CUSTOM_ELEMENTS) throw new Error("custom: entre 2 y 4 elementos");
  return { name: "Personalizada", elements: customLabels(n), plus: t.plus, times: t.times, comp: t.comp, zero: 0, one: n - 1 };
}

/** Tablas de partida para la estructura personalizada: el álgebra de Boole de n elementos si existe. */
export function defaultCustomTables(n: number): { plus: number[][]; times: number[][]; comp: number[] } {
  if (n === 4) {
    const c = cube(2); // 00, 01, 10, 11 → 0, a, b, 1
    return { plus: c.plus, times: c.times, comp: c.comp };
  }
  if (n === 3) {
    // Cadena 0 < a < 1 con máx./mín. y un complemento que no lo es para a (no es de Boole).
    return {
      plus: tableOf(3, (x, y) => Math.max(x, y)),
      times: tableOf(3, (x, y) => Math.min(x, y)),
      comp: [2, 1, 0],
    };
  }
  const t = twoElement();
  return { plus: t.plus, times: t.times, comp: t.comp };
}
