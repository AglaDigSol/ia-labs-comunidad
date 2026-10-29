// Leyes del álgebra de conjuntos y comprobación de un paso de una derivación, como en el laboratorio
// de Boole: (a) la expresión nueva es igual a la anterior (mismas regiones del diagrama de Venn) y
// (b) la ley elegida lleva de una a otra, en un sentido o en el otro, con hasta SET_MAX_APPLICATIONS
// usos en un paso.
//
// (P(U), ∪, ∩, ᶜ, ∅, U) es un álgebra de Boole, así que las leyes de ∪, ∩ y ᶜ se aplican con las
// reglas de shared/boole/laws.ts: el subtérmino se traduce a una expresión de Boole (∪ → ⊕, ∩ → ⊙,
// ᶜ → ′, ∅ → 0, U → 1) donde cada diferencia o diferencia simétrica es una variable opaca, se reescribe
// y se traduce de vuelta. Dentro de ∖ y Δ se llega visitando sus dos lados. La diferencia y la
// diferencia simétrica tienen sus propias leyes (A ∖ B = A ∩ Bᶜ y A Δ B = (A ∖ B) ∪ (B ∖ A)).
import { bconst, bnot, bvar, normalizeBoole, type BExpr } from "../boole/expr.ts";
import { LAW_RULES, type LawId } from "../boole/laws.ts";
import {
  compareSetExprs,
  normalizeSet,
  regionLabel,
  scomp,
  sempty,
  setKey,
  sset,
  suniverse,
  vennVars,
  type Region,
  type SetExpr,
  type SetName,
} from "./expr.ts";

export type SetLawId =
  | "conmutativa"
  | "asociativa"
  | "identidad"
  | "complemento"
  | "idempotencia"
  | "dominacion"
  | "absorcion"
  | "involucion"
  | "distributiva"
  | "demorgan"
  | "diferencia"
  | "simetrica";

export type SetLawInfo = { id: SetLawId; name: string; tex: string };

/** Leyes en el orden en que se ofrecen en el selector. */
export const SET_LAWS: SetLawInfo[] = [
  { id: "conmutativa", name: "Conmutativas", tex: "A \\cup B = B \\cup A,\\ A \\cap B = B \\cap A" },
  { id: "asociativa", name: "Asociativas", tex: "A \\cup (B \\cup C) = (A \\cup B) \\cup C" },
  { id: "identidad", name: "Identidad", tex: "A \\cup \\varnothing = A,\\ A \\cap U = A" },
  { id: "complemento", name: "Complementario", tex: "A \\cup A^{c} = U,\\ A \\cap A^{c} = \\varnothing,\\ \\varnothing^{c} = U" },
  { id: "idempotencia", name: "Idempotencia", tex: "A \\cup A = A,\\ A \\cap A = A" },
  { id: "dominacion", name: "Dominación (acotación)", tex: "A \\cup U = U,\\ A \\cap \\varnothing = \\varnothing" },
  { id: "absorcion", name: "Absorción", tex: "A \\cup (A \\cap B) = A,\\ A \\cap (A \\cup B) = A" },
  { id: "involucion", name: "Doble complemento (involución)", tex: "\\left(A^{c}\\right)^{c} = A" },
  { id: "distributiva", name: "Distributivas", tex: "A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)" },
  { id: "demorgan", name: "De Morgan", tex: "(A \\cup B)^{c} = A^{c} \\cap B^{c},\\ (A \\cap B)^{c} = A^{c} \\cup B^{c}" },
  { id: "diferencia", name: "Diferencia", tex: "A \\setminus B = A \\cap B^{c}" },
  {
    id: "simetrica",
    name: "Diferencia simétrica",
    tex: "A \\mathbin{\\Delta} B = (A \\setminus B) \\cup (B \\setminus A)",
  },
];

export const SET_LAW_BY_ID: Record<SetLawId, SetLawInfo> = Object.fromEntries(SET_LAWS.map((l) => [l.id, l])) as Record<
  SetLawId,
  SetLawInfo
>;

export const isSetLawId = (x: unknown): x is SetLawId => typeof x === "string" && x in SET_LAW_BY_ID;

/** Ley de Boole que hace el mismo trabajo (null para las propias de ∖ y Δ). */
const BOOLE_LAW: Record<SetLawId, LawId | null> = {
  conmutativa: "B1",
  asociativa: "B2",
  identidad: "B3",
  complemento: "B5",
  idempotencia: "idempotencia",
  dominacion: "dominacion",
  absorcion: "absorcion",
  involucion: "involucion",
  distributiva: "B4",
  demorgan: "demorgan",
  diferencia: null,
  simetrica: null,
};

export const SET_MAX_APPLICATIONS = 3;
const MAX_FRONTIER = 400;

// ---------------------------------------------------------------- Traducción a Boole

type Atoms = Map<string, SetExpr>;
const ATOM = "#";

function toBoole(e: SetExpr, atoms: Atoms): BExpr {
  switch (e.k) {
    case "set":
      return bvar(e.name);
    case "empty":
      return bconst(0);
    case "universe":
      return bconst(1);
    case "comp":
      return bnot(toBoole(e.a, atoms));
    case "union":
    case "inter":
      return { k: e.k === "union" ? "or" : "and", args: e.args.map((a) => toBoole(a, atoms)) };
    default: {
      // La misma diferencia (misma clave) es la misma variable: así A ∖ B ∪ A ∖ B es idempotente.
      const key = setKey(normalizeSet(e));
      for (const [name, x] of atoms) if (setKey(normalizeSet(x)) === key) return bvar(name);
      const name = `${ATOM}${atoms.size}`;
      atoms.set(name, e);
      return bvar(name);
    }
  }
}

function fromBoole(e: BExpr, atoms: Atoms): SetExpr {
  switch (e.k) {
    case "var":
      return atoms.get(e.name) ?? sset(e.name as SetName);
    case "const":
      return e.v === 1 ? suniverse : sempty;
    case "not":
      return scomp(fromBoole(e.a, atoms));
    default:
      return { k: e.k === "or" ? "union" : "inter", args: e.args.map((a) => fromBoole(a, atoms)) };
  }
}

// ---------------------------------------------------------------- Reglas en la raíz

type AtRoot = (e: SetExpr) => SetExpr[];

// Diferencia: A ∖ B → A ∩ Bᶜ (y A ∖ Bᶜ → A ∩ B) y, al revés, una intersección con un complementario.
const difference: AtRoot = (e) => {
  const out: SetExpr[] = [];
  if (e.k === "diff") {
    out.push({ k: "inter", args: [e.a, scomp(e.b)] });
    if (e.b.k === "comp") out.push({ k: "inter", args: [e.a, e.b.a] });
  }
  if (e.k === "inter") {
    e.args.forEach((x, i) => {
      if (x.k !== "comp") return;
      const rest = e.args.filter((_, j) => j !== i);
      const a: SetExpr = rest.length === 1 ? rest[0]! : { k: "inter", args: rest };
      out.push({ k: "diff", a, b: x.a });
    });
  }
  return out;
};

// Diferencia simétrica: A Δ B → (A ∖ B) ∪ (B ∖ A), y una unión con esos dos términos → A Δ B.
const symmetric: AtRoot = (e) => {
  const out: SetExpr[] = [];
  if (e.k === "sym") out.push({ k: "union", args: [{ k: "diff", a: e.a, b: e.b }, { k: "diff", a: e.b, b: e.a }] });
  if (e.k === "union") {
    for (let i = 0; i < e.args.length; i++) {
      for (let j = i + 1; j < e.args.length; j++) {
        const x = e.args[i]!;
        const y = e.args[j]!;
        if (x.k !== "diff" || y.k !== "diff") continue;
        if (setKey(x.a) !== setKey(y.b) || setKey(x.b) !== setKey(y.a)) continue;
        const rest = e.args.filter((_, k) => k !== i && k !== j);
        const s: SetExpr = { k: "sym", a: x.a, b: x.b };
        out.push(rest.length === 0 ? s : { k: "union", args: [...rest, s] });
      }
    }
  }
  return out;
};

function viaBoole(law: LawId): AtRoot {
  const rule = LAW_RULES[law];
  return (e) => {
    if (e.k === "diff" || e.k === "sym") return [];
    const atoms: Atoms = new Map();
    const b = normalizeBoole(toBoole(e, atoms));
    return rule(b).map((r) => fromBoole(r, atoms));
  };
}

const RULES: Record<SetLawId, AtRoot> = Object.fromEntries(
  (Object.keys(BOOLE_LAW) as SetLawId[]).map((id) => {
    const b = BOOLE_LAW[id];
    return [id, id === "diferencia" ? difference : id === "simetrica" ? symmetric : viaBoole(b!)];
  }),
) as Record<SetLawId, AtRoot>;

// ---------------------------------------------------------------- Reescritura

/** Todas las expresiones que salen de aplicar UNA vez la ley en cualquier posición de e (normalizadas). */
export function setRewritesOnce(e: SetExpr, law: SetLawId): SetExpr[] {
  const rule = RULES[law];
  const out: SetExpr[] = [];
  const visit = (x: SetExpr, rebuild: (y: SetExpr) => SetExpr) => {
    for (const r of rule(x)) out.push(normalizeSet(rebuild(r)));
    switch (x.k) {
      case "comp":
        visit(x.a, (y) => rebuild({ k: "comp", a: y }));
        break;
      case "union":
      case "inter": {
        const { k, args } = x;
        args.forEach((child, i) => visit(child, (y) => rebuild({ k, args: args.map((c, j) => (j === i ? y : c)) })));
        break;
      }
      case "diff":
      case "sym": {
        const { k, a, b } = x;
        visit(a, (y) => rebuild({ k, a: y, b }));
        visit(b, (y) => rebuild({ k, a, b: y }));
        break;
      }
      default:
        break;
    }
  };
  visit(normalizeSet(e), (y) => y);
  return out;
}

function reachable(e: SetExpr, law: SetLawId, depth = SET_MAX_APPLICATIONS): Set<string> {
  const seen = new Set<string>();
  let frontier = [normalizeSet(e)];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: SetExpr[] = [];
    for (const x of frontier) {
      for (const r of setRewritesOnce(x, law)) {
        const k = setKey(r);
        if (seen.has(k)) continue;
        seen.add(k);
        if (next.length < MAX_FRONTIER) next.push(r);
      }
    }
    frontier = next;
  }
  return seen;
}

/** ¿Lleva la ley `law` de `from` a `to` (en un sentido o en el otro)? */
export function setLawJustifies(from: SetExpr, to: SetExpr, law: SetLawId): boolean {
  const a = setKey(normalizeSet(from));
  const b = setKey(normalizeSet(to));
  // Conmutatividad y asociatividad se cumplen al normalizar (también la de Δ).
  if (law === "conmutativa" || law === "asociativa") return a === b;
  if (a === b) return false;
  return reachable(from, law).has(b) || reachable(to, law).has(a);
}

/** Leyes que justifican el paso (en el orden de SET_LAWS). */
export function setLawsJustifying(from: SetExpr, to: SetExpr): SetLawId[] {
  return SET_LAWS.map((l) => l.id).filter((id) => setLawJustifies(from, to, id));
}

export type SetStepCheck =
  | {
      ok: false;
      reason: "not-equal";
      /** Una región donde difieren y si cada expresión la contiene. */
      region: { vars: SetName[]; region: Region; label: string; before: boolean; after: boolean };
    }
  | { ok: true; lawMatches: boolean; suggestions: SetLawId[] };

/** Comprueba un paso: igualdad por regiones y, si son iguales, si la ley elegida encaja. */
export function checkSetStep(prev: SetExpr, next: SetExpr, law: SetLawId): SetStepCheck {
  const cmp = compareSetExprs(prev, next, vennVars(prev, next));
  if (!cmp.equal) {
    const r = cmp.differ[0]!;
    return {
      ok: false,
      reason: "not-equal",
      region: { vars: cmp.vars, region: r, label: regionLabel(cmp.vars, r), before: cmp.left[r]!, after: cmp.right[r]! },
    };
  }
  if (setLawJustifies(prev, next, law)) return { ok: true, lawMatches: true, suggestions: [] };
  return { ok: true, lawMatches: false, suggestions: setLawsJustifying(prev, next) };
}

/**
 * Leyes con alguna instancia aplicable a la expresión (para «Pista»), sin aplicarlas. Conmutativas y
 * asociativas se omiten porque siempre se pueden usar.
 */
export function setApplicableLaws(e: SetExpr): SetLawId[] {
  const k = setKey(normalizeSet(e));
  return SET_LAWS.map((l) => l.id).filter(
    (id) => id !== "conmutativa" && id !== "asociativa" && setRewritesOnce(e, id).some((r) => setKey(r) !== k),
  );
}
