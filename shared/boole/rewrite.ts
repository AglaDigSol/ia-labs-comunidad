// Comprobación de un paso de una simplificación: (a) la expresión nueva es equivalente a la anterior
// (tabla de verdad, con compareFormulas de lógica) y (b) la ley elegida lleva de una a otra: existe un
// subtérmino y una instancia de la ley cuya reescritura da la expresión nueva, módulo conmutatividad y
// asociatividad. Se aceptan las dos direcciones de cada ley y hasta MAX_APPLICATIONS usos de la misma
// ley en un paso (por ejemplo, De Morgan en dos sitios a la vez).
import { compareFormulas } from "../logic/compare.ts";
import { booleKey, normalizeBoole, toLogicNode, type BExpr } from "./expr.ts";
import { LAW_RULES, LAWS, type LawId } from "./laws.ts";

export const MAX_APPLICATIONS = 3;
const MAX_FRONTIER = 400;

/** Todas las expresiones que salen de aplicar UNA vez la ley en cualquier posición de e (normalizadas). */
export function rewritesOnce(e: BExpr, law: LawId): BExpr[] {
  const rule = LAW_RULES[law];
  const out: BExpr[] = [];
  const visit = (x: BExpr, rebuild: (y: BExpr) => BExpr) => {
    for (const r of rule(x)) out.push(normalizeBoole(rebuild(r)));
    if (x.k === "not") visit(x.a, (y) => rebuild({ k: "not", a: y }));
    else if (x.k === "or" || x.k === "and") {
      const { k, args } = x;
      args.forEach((child, i) =>
        visit(child, (y) => rebuild({ k, args: args.map((c, j) => (j === i ? y : c)) })),
      );
    }
  };
  visit(normalizeBoole(e), (y) => y);
  return out;
}

/** Claves alcanzables desde e con 1..depth usos de la ley. */
function reachable(e: BExpr, law: LawId, depth = MAX_APPLICATIONS): Set<string> {
  const seen = new Set<string>();
  let frontier = [normalizeBoole(e)];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: BExpr[] = [];
    for (const x of frontier) {
      for (const r of rewritesOnce(x, law)) {
        const k = booleKey(r);
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
export function lawJustifies(from: BExpr, to: BExpr, law: LawId): boolean {
  const a = booleKey(normalizeBoole(from));
  const b = booleKey(normalizeBoole(to));
  if (law === "B1" || law === "B2") return a === b;
  if (a === b) return false;
  return reachable(from, law).has(b) || reachable(to, law).has(a);
}

/** Leyes que justifican el paso (en el orden de LAWS). */
export function lawsJustifying(from: BExpr, to: BExpr): LawId[] {
  return LAWS.map((l) => l.id).filter((id) => lawJustifies(from, to, id));
}

export type StepCheck =
  | { ok: false; reason: "too-many-variables"; count: number }
  | {
      ok: false;
      reason: "not-equivalent";
      /** Una fila donde difieren: valores de las variables y de cada expresión. */
      row: { vars: string[]; values: boolean[]; before: boolean; after: boolean };
    }
  | { ok: true; lawMatches: boolean; suggestions: LawId[] };

/** Comprueba un paso: equivalencia por tabla de verdad y, si lo es, si la ley elegida encaja. */
export function checkStep(prev: BExpr, next: BExpr, law: LawId): StepCheck {
  const cmp = compareFormulas(toLogicNode(prev), toLogicNode(next));
  if (!cmp.ok) return { ok: false, reason: "too-many-variables", count: cmp.count };
  if (!cmp.equivalent) {
    // La fila con menos unos: suele ser la más fácil de comprobar a mano.
    const ones = (v: boolean[]) => v.filter(Boolean).length;
    const diff = cmp.rows.filter((r) => !r.equal).sort((x, y) => ones(x.values) - ones(y.values) || x.minterm - y.minterm)[0]!;
    return {
      ok: false,
      reason: "not-equivalent",
      row: { vars: cmp.vars, values: diff.values, before: diff.a, after: diff.b },
    };
  }
  if (lawJustifies(prev, next, law)) return { ok: true, lawMatches: true, suggestions: [] };
  return { ok: true, lawMatches: false, suggestions: lawsJustifying(prev, next) };
}

/**
 * Leyes con alguna instancia aplicable a la expresión (para «Pista»), sin aplicarlas. B1 y B2 se
 * omiten porque siempre se pueden usar.
 */
export function applicableLaws(e: BExpr): LawId[] {
  const k = booleKey(normalizeBoole(e));
  return LAWS.map((l) => l.id).filter(
    (id) => id !== "B1" && id !== "B2" && rewritesOnce(e, id).some((r) => booleKey(r) !== k),
  );
}
