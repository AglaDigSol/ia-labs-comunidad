// Forma mínima de una función booleana con Quine–McCluskey (implicantes primos) y una cobertura
// exacta de coste mínimo (literales y, a igualdad, términos). Pensado para pocas variables (≤ 6).
// Admite indiferencias (las X de un mapa de Karnaugh): entran en los implicantes primos para
// agrandarlos, pero no hace falta cubrirlas.
import { buildTable, MAX_VARIABLES } from "../logic/truth-table.ts";
import { band, bconst, bnot, bor, booleVars, bvar, toLogicNode, type BExpr } from "./expr.ts";

/** Implicante: `care` marca las variables que aparecen; `value`, su valor (1 = x, 0 = x′). */
export type Implicant = { care: number; value: number };

const popcount = (x: number) => {
  let c = 0;
  for (let v = x; v; v &= v - 1) c++;
  return c;
};

const covers = (imp: Implicant, m: number) => (m & imp.care) === imp.value;

/** Implicantes primos de la lista de mintérminos (índices con la primera variable como bit alto). */
export function primeImplicants(n: number, minterms: number[]): Implicant[] {
  const full = (1 << n) - 1;
  let current = new Map<string, Implicant>();
  for (const m of new Set(minterms)) current.set(`${full}:${m}`, { care: full, value: m });
  const primes = new Map<string, Implicant>();
  while (current.size > 0) {
    const list = [...current.values()];
    const used = new Set<string>();
    const next = new Map<string, Implicant>();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.care !== b.care) continue;
        const diff = a.value ^ b.value;
        if (popcount(diff) !== 1) continue;
        const c = { care: a.care & ~diff, value: a.value & ~diff };
        next.set(`${c.care}:${c.value}`, c);
        used.add(`${a.care}:${a.value}`);
        used.add(`${b.care}:${b.value}`);
      }
    }
    for (const [k, imp] of current) if (!used.has(k)) primes.set(k, imp);
    current = next;
  }
  return [...primes.values()];
}

/** Cobertura de coste mínimo (literales, luego términos) por ramificación y poda. */
export function minimumCover(minterms: number[], primes: Implicant[]): Implicant[] {
  const cost = (imp: Implicant) => popcount(imp.care);
  const todo = [...new Set(minterms)];
  let best: Implicant[] | null = null;
  let bestCost = [Infinity, Infinity] as [number, number];
  const better = (c: [number, number]) => c[0] < bestCost[0] || (c[0] === bestCost[0] && c[1] < bestCost[1]);
  const search = (chosen: Implicant[], left: number[], lits: number) => {
    if (!better([lits, chosen.length])) return;
    if (left.length === 0) {
      best = chosen;
      bestCost = [lits, chosen.length];
      return;
    }
    // Rama sobre el mintérmino con menos implicantes que lo cubren.
    let pick = left[0]!;
    let options = primes.filter((p) => covers(p, pick));
    for (const m of left) {
      const o = primes.filter((p) => covers(p, m));
      if (o.length < options.length) {
        pick = m;
        options = o;
      }
    }
    options.sort((a, b) => cost(a) - cost(b));
    for (const p of options) {
      search([...chosen, p], left.filter((m) => !covers(p, m)), lits + cost(p));
    }
  };
  search([], todo, 0);
  return best ?? [];
}

/** Producto de un implicante: care = 101, value = 100 en x, y, z da x ⊙ z′. */
export function implicantProduct(vars: string[], imp: Implicant): BExpr {
  const n = vars.length;
  const lits: BExpr[] = [];
  vars.forEach((v, i) => {
    const bit = 1 << (n - 1 - i);
    if (imp.care & bit) lits.push(imp.value & bit ? bvar(v) : bnot(bvar(v)));
  });
  return lits.length === 0 ? bconst(1) : band(...lits);
}

function sumExpr(vars: string[], imps: Implicant[]): BExpr {
  if (imps.length === 0) return bconst(0);
  return bor(...imps.map((i) => implicantProduct(vars, i)));
}

/** Suma de complementos de un término: (x ⊙ y′)′ = x′ ⊕ y (el factor de un grupo de ceros). */
export function implicantSum(vars: string[], imp: Implicant): BExpr {
  const n = vars.length;
  const lits: BExpr[] = [];
  vars.forEach((v, i) => {
    const bit = 1 << (n - 1 - i);
    if (imp.care & bit) lits.push(imp.value & bit ? bnot(bvar(v)) : bvar(v));
  });
  return lits.length === 0 ? bconst(0) : bor(...lits);
}

export type MinimalForm = { expr: BExpr; literals: number; terms: number };

export type Minimized =
  | { ok: true; vars: string[]; sop: MinimalForm; pos: MinimalForm; minLiterals: number }
  | { ok: false; code: "too-many-variables"; count: number };

/**
 * Suma de productos mínima a partir de los mintérminos y, si las hay, de las indiferencias
 * (`dontCares`), que se pueden usar o no.
 */
export function minimalSOP(vars: string[], minterms: number[], dontCares: number[] = []): MinimalForm {
  const n = vars.length;
  const ones = [...new Set(minterms)];
  const dc = [...new Set(dontCares)].filter((m) => !ones.includes(m));
  if (ones.length === 0) return { expr: bconst(0), literals: 0, terms: 0 };
  if (ones.length + dc.length === 1 << n) return { expr: bconst(1), literals: 0, terms: 0 };
  const cover = minimumCover(ones, primeImplicants(n, [...ones, ...dc]));
  return {
    expr: sumExpr(vars, cover),
    literals: cover.reduce((s, i) => s + popcount(i.care), 0),
    terms: cover.length,
  };
}

/** Producto de sumas mínimo: el dual de la suma mínima del complemento (con las mismas indiferencias). */
export function minimalPOS(vars: string[], minterms: number[], dontCares: number[] = []): MinimalForm {
  const n = vars.length;
  const set = new Set(minterms);
  const dc = [...new Set(dontCares)].filter((m) => !set.has(m));
  const zeros = Array.from({ length: 1 << n }, (_, i) => i).filter((i) => !set.has(i) && !dc.includes(i));
  if (zeros.length === 0) return { expr: bconst(1), literals: 0, terms: 0 };
  if (zeros.length + dc.length === 1 << n) return { expr: bconst(0), literals: 0, terms: 0 };
  const cover = minimumCover(zeros, primeImplicants(n, [...zeros, ...dc]));
  return {
    expr: band(...cover.map((i) => implicantSum(vars, i))),
    literals: cover.reduce((s, i) => s + popcount(i.care), 0),
    terms: cover.length,
  };
}

/** Formas mínimas (suma de productos y producto de sumas) de una expresión de Boole. */
export function minimizeBoole(e: BExpr): Minimized {
  const node = toLogicNode(e);
  const vars = booleVars(e);
  if (vars.length > MAX_VARIABLES) return { ok: false, code: "too-many-variables", count: vars.length };
  const table = buildTable(node, { vars, order: "false-first" });
  if (!table.ok) return { ok: false, code: "too-many-variables", count: table.count };
  const minterms = table.rows.filter((r) => r.result).map((r) => r.minterm);
  const sop = minimalSOP(vars, minterms);
  const pos = minimalPOS(vars, minterms);
  return { ok: true, vars, sop, pos, minLiterals: Math.min(sop.literals, pos.literals) };
}
