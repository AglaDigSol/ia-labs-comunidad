// Leyes del álgebra de Boole como reglas de reescritura sobre expresiones n-arias normalizadas
// (shared/boole/expr.ts). Cada ley sabe aplicarse en la RAÍZ de un subtérmino y devuelve todas las
// expresiones que se obtienen con una instancia de la ley. shared/boole/rewrite.ts recorre las
// posiciones, prueba los dos sentidos y compara módulo conmutatividad y asociatividad.
import { bconst, bnot, booleKey, normalizeBoole, type BExpr } from "./expr.ts";

export type LawId =
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "idempotencia"
  | "dominacion"
  | "absorcion"
  | "involucion"
  | "demorgan"
  | "consenso";

export type LawInfo = { id: LawId; name: string; short: string; tex: string; advanced?: boolean };

/** Leyes en el orden en que se ofrecen en el selector. */
export const LAWS: LawInfo[] = [
  { id: "B1", name: "B1 · Conmutativas", short: "B1", tex: "a \\oplus b = b \\oplus a" },
  { id: "B2", name: "B2 · Asociativas", short: "B2", tex: "a \\oplus (b \\oplus c) = (a \\oplus b) \\oplus c" },
  { id: "B3", name: "B3 · Identidad", short: "B3", tex: "a \\oplus 0 = a,\\ 1 \\odot a = a" },
  { id: "B4", name: "B4 · Distributivas", short: "B4", tex: "a \\odot (b \\oplus c) = (a \\odot b) \\oplus (a \\odot c)" },
  { id: "B5", name: "B5 · Complementación", short: "B5", tex: "a \\oplus a' = 1,\\ a \\odot a' = 0" },
  { id: "idempotencia", name: "Idempotencia", short: "Idempotencia", tex: "a \\oplus a = a,\\ a \\odot a = a" },
  { id: "dominacion", name: "Dominación (acotación)", short: "Dominación", tex: "a \\oplus 1 = 1,\\ a \\odot 0 = 0" },
  { id: "absorcion", name: "Absorción", short: "Absorción", tex: "a \\oplus (a \\odot b) = a,\\ a \\odot (a \\oplus b) = a" },
  { id: "involucion", name: "Doble complemento (involución)", short: "Doble complemento", tex: "(a')' = a" },
  { id: "demorgan", name: "De Morgan", short: "De Morgan", tex: "(a \\oplus b)' = a' \\odot b',\\ (a \\odot b)' = a' \\oplus b'" },
  {
    id: "consenso",
    name: "Consenso (avanzada)",
    short: "Consenso",
    tex: "(a \\odot b) \\oplus (a' \\odot c) \\oplus (b \\odot c) = (a \\odot b) \\oplus (a' \\odot c)",
    advanced: true,
  },
];

export const LAW_BY_ID: Record<LawId, LawInfo> = Object.fromEntries(LAWS.map((l) => [l.id, l])) as Record<
  LawId,
  LawInfo
>;

export const isLawId = (x: unknown): x is LawId => typeof x === "string" && x in LAW_BY_ID;

type Op = "or" | "and";
const dual = (op: Op): Op => (op === "or" ? "and" : "or");
/** Neutro de la operación: 0 para ⊕, 1 para ⊙. */
const neutral = (op: Op): 0 | 1 => (op === "or" ? 0 : 1);
/** Elemento absorbente («dominante»): 1 para ⊕, 0 para ⊙. */
const dominant = (op: Op): 0 | 1 => (op === "or" ? 1 : 0);

const key = booleKey;
const node = (op: Op, args: BExpr[]): BExpr => normalizeBoole({ k: op, args });
/** Factores de x respecto a op: los argumentos si x es de esa operación, o [x]. */
const parts = (x: BExpr, op: Op): BExpr[] => (x.k === op ? x.args : [x]);
const without = (args: BExpr[], ...idx: number[]) => args.filter((_, i) => !idx.includes(i));

/** ¿Es `small` un submulticonjunto propio de `big` (por claves)? */
function properSub(small: BExpr[], big: BExpr[]): boolean {
  if (small.length >= big.length) return false;
  const pool = new Map<string, number>();
  for (const b of big) pool.set(key(b), (pool.get(key(b)) ?? 0) + 1);
  for (const s of small) {
    const n = pool.get(key(s)) ?? 0;
    if (n === 0) return false;
    pool.set(key(s), n - 1);
  }
  return true;
}

function multisetEq(a: BExpr[], b: BExpr[]): boolean {
  return a.length === b.length && [...a.map(key)].sort().join("|") === [...b.map(key)].sort().join("|");
}

/** Complemento sintáctico «inmediato»: x ↔ x′. */
const isComplementPair = (a: BExpr, b: BExpr) =>
  (b.k === "not" && key(b.a) === key(a)) || (a.k === "not" && key(a.a) === key(b));

/** Subconjuntos no vacíos de índices (hasta `max` elementos de la lista). */
function subsets(n: number, max = 6): number[][] {
  const m = Math.min(n, max);
  const out: number[][] = [];
  for (let mask = 1; mask < 1 << m; mask++) {
    const s: number[] = [];
    for (let i = 0; i < m; i++) if (mask & (1 << i)) s.push(i);
    out.push(s);
  }
  return out;
}

type AtRoot = (e: BExpr) => BExpr[];

// B3 · identidad: quita un 0 de una suma o un 1 de un producto.
const identity: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const out: BExpr[] = [];
  e.args.forEach((a, i) => {
    if (a.k === "const" && a.v === neutral(e.k)) out.push(node(e.k, without(e.args, i)));
  });
  return out;
};

// B4 · distributivas: a ⊙ (b ⊕ c) → a⊙b ⊕ a⊙c (y la dual), y sacar factor común (el sentido inverso).
const distributive: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const op = e.k;
  const inner = dual(op);
  const out: BExpr[] = [];
  // Expandir: un argumento X = (b1 ⋆ b2 …) de la operación dual y un grupo S de los demás argumentos.
  e.args.forEach((x, i) => {
    if (x.k !== inner) return;
    const others = without(e.args, i);
    for (const s of subsets(others.length)) {
      const factor = s.map((j) => others[j]!);
      const rest = others.filter((_, j) => !s.includes(j));
      const expanded = node(
        inner,
        x.args.map((b) => node(op, [...factor, b])),
      );
      out.push(node(op, [...rest, expanded]));
    }
  });
  // Sacar factor común: en e = t1 ⋆' t2 ⋆' … (op = suma o producto), un factor f presente en ≥ 2 términos.
  const terms = e.args.map((t) => parts(t, inner));
  const candidates = new Map<string, BExpr>();
  for (const t of terms) for (const f of t) candidates.set(key(f), f);
  for (const [fk, f] of candidates) {
    const holders = terms.map((t, i) => (t.length > 1 && t.some((g) => key(g) === fk) ? i : -1)).filter((i) => i >= 0);
    if (holders.length < 2) continue;
    for (const s of subsets(holders.length)) {
      if (s.length < 2) continue;
      const chosen = s.map((j) => holders[j]!);
      const reduced = chosen.map((i) => {
        const t = terms[i]!;
        const at = t.findIndex((g) => key(g) === fk);
        return node(inner, without(t, at));
      });
      const factored = node(inner, [f, node(op, reduced)]);
      out.push(node(op, [...without(e.args, ...chosen), factored]));
    }
  }
  return out;
};

// B5 · complementación: a ⊕ a′ → 1, a ⊙ a′ → 0; y 0′ → 1, 1′ → 0.
const complementation: AtRoot = (e) => {
  if (e.k === "not" && e.a.k === "const") return [bconst(e.a.v === 1 ? 0 : 1)];
  if (e.k !== "or" && e.k !== "and") return [];
  const out: BExpr[] = [];
  for (let i = 0; i < e.args.length; i++) {
    for (let j = i + 1; j < e.args.length; j++) {
      if (isComplementPair(e.args[i]!, e.args[j]!)) {
        out.push(node(e.k, [...without(e.args, i, j), bconst(dominant(e.k))]));
      }
    }
  }
  return out;
};

// Idempotencia: a ⊕ a → a, a ⊙ a → a.
const idempotence: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const out: BExpr[] = [];
  for (let i = 0; i < e.args.length; i++) {
    for (let j = i + 1; j < e.args.length; j++) {
      if (key(e.args[i]!) === key(e.args[j]!)) out.push(node(e.k, without(e.args, j)));
    }
  }
  return out;
};

// Dominación (acotación): a ⊕ 1 → 1, a ⊙ 0 → 0.
const domination: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const d = dominant(e.k);
  const out: BExpr[] = [];
  e.args.forEach((a, i) => {
    if (a.k === "const" && a.v === d) {
      // Todo el nodo pasa a ser la constante, o solo una parte (a ⊕ b ⊕ 1 → a ⊕ 1 también vale).
      out.push(bconst(d));
      for (let j = 0; j < e.args.length; j++) if (j !== i) out.push(node(e.k, without(e.args, j)));
    }
  });
  return out;
};

// Absorción: a ⊕ (a ⊙ b) → a y a ⊙ (a ⊕ b) → a; también a ⊕ (a′ ⊙ b) → a ⊕ b y su dual.
const absorption: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const op = e.k;
  const inner = dual(op);
  const out: BExpr[] = [];
  e.args.forEach((x, i) => {
    e.args.forEach((y, j) => {
      if (i === j || y.k !== inner) return;
      if (properSub(parts(x, inner), y.args)) out.push(node(op, without(e.args, j)));
      // a ⊕ a′b = a ⊕ b
      const at = y.args.findIndex((g) => isComplementPair(g, x));
      if (at >= 0) {
        const args = e.args.slice();
        args[j] = node(inner, without(y.args, at));
        out.push(node(op, args));
      }
    });
  });
  return out;
};

// Doble complemento: (a′)′ → a.
const involution: AtRoot = (e) => (e.k === "not" && e.a.k === "not" ? [e.a.a] : []);

/** Quita los dobles complementos que acaba de crear De Morgan: (x′)′ → x. */
const negate = (x: BExpr, cancel: boolean): BExpr => (cancel && x.k === "not" ? x.a : bnot(x));

// De Morgan: (a ⊕ b)′ → a′ ⊙ b′ y (a ⊙ b)′ → a′ ⊕ b′, con n argumentos o agrupando en dos bloques.
// También admite el resultado con los complementos dobles ya cancelados ((x′ ⊕ y)′ → x ⊙ y′).
const deMorgan: AtRoot = (e) => {
  if (e.k !== "not" || (e.a.k !== "or" && e.a.k !== "and")) return [];
  const op = e.a.k;
  const args = e.a.args;
  const out: BExpr[] = [];
  for (const cancel of [false, true]) {
    out.push(node(dual(op), args.map((a) => negate(a, cancel))));
    // Leído como binario: (A ⋆ B)′ con A y B dos bloques de argumentos.
    for (const s of subsets(args.length)) {
      if (s.length === args.length || !s.includes(0)) continue;
      const a = node(op, s.map((i) => args[i]!));
      const b = node(op, args.filter((_, i) => !s.includes(i)));
      out.push(node(dual(op), [negate(a, cancel), negate(b, cancel)]));
    }
  }
  return out;
};

// Consenso: a⊙b ⊕ a′⊙c ⊕ b⊙c → a⊙b ⊕ a′⊙c (y su dual).
const consensus: AtRoot = (e) => {
  if (e.k !== "or" && e.k !== "and") return [];
  const op = e.k;
  const inner = dual(op);
  const out: BExpr[] = [];
  const n = e.args.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const pi = parts(e.args[i]!, inner);
      const pj = parts(e.args[j]!, inner);
      pi.forEach((x, xi) => {
        const xj = pj.findIndex((g) => isComplementPair(g, x) && x.k !== "not");
        if (xj < 0) return;
        const want = [...without(pi, xi), ...without(pj, xj)];
        for (let k = 0; k < n; k++) {
          if (k === i || k === j) continue;
          if (want.length > 0 && multisetEq(parts(e.args[k]!, inner), want)) out.push(node(op, without(e.args, k)));
        }
      });
    }
  }
  return out;
};

/** Reglas «en la raíz» de cada ley. B1 y B2 no tienen: se cumplen al normalizar. */
export const LAW_RULES: Record<LawId, AtRoot> = {
  B1: () => [],
  B2: () => [],
  B3: identity,
  B4: distributive,
  B5: complementation,
  idempotencia: idempotence,
  dominacion: domination,
  absorcion: absorption,
  involucion: involution,
  demorgan: deMorgan,
  consenso: consensus,
};
