// Negar paso a paso: las leyes que llevan una negación hacia dentro hasta que solo afecta a fórmulas
// atómicas (forma normal negativa). Cada paso aplica UNA ley, en una o varias posiciones a la vez
// (hasta MAX_NEGATION_APPLICATIONS, como en el laboratorio de Boole), y se comprueba de dos formas: el paso es
// equivalente en el dominio (todas las interpretaciones o una muestra) y la ley lleva de una línea a la
// otra sobre el árbol, salvo renombrar variables ligadas.
import {
  isNegationNormalForm,
  isPredBinary,
  predicateSignature,
  predKey,
  type PredFormula,
} from "./ast.ts";
import { findPredDifference, type PredDifference } from "./equivalence.ts";
import type { PredInterpretation } from "./evaluate.ts";

export const NEGATION_LAWS = [
  { id: "neg-forall", name: "Negación del cuantificador universal", statement: "¬∀x φ ≡ ∃x ¬φ" },
  { id: "neg-exists", name: "Negación del cuantificador existencial", statement: "¬∃x φ ≡ ∀x ¬φ" },
  { id: "de-morgan-and", name: "De Morgan (negación de una conjunción)", statement: "¬(φ ∧ ψ) ≡ ¬φ ∨ ¬ψ" },
  { id: "de-morgan-or", name: "De Morgan (negación de una disyunción)", statement: "¬(φ ∨ ψ) ≡ ¬φ ∧ ¬ψ" },
  { id: "neg-imp", name: "Negación de la implicación", statement: "¬(φ → ψ) ≡ φ ∧ ¬ψ" },
  { id: "neg-iff", name: "Negación del bicondicional", statement: "¬(φ ↔ ψ) ≡ φ ↔ ¬ψ" },
  { id: "double-neg", name: "Doble negación", statement: "¬¬φ ≡ φ" },
] as const;

export type NegationLawId = (typeof NEGATION_LAWS)[number]["id"];
export type NegationLaw = (typeof NEGATION_LAWS)[number];

export const NEGATION_LAW_BY_ID = Object.fromEntries(NEGATION_LAWS.map((l) => [l.id, l])) as Record<NegationLawId, NegationLaw>;
export const isNegationLawId = (x: unknown): x is NegationLawId =>
  typeof x === "string" && NEGATION_LAWS.some((l) => l.id === x);

export const MAX_NEGATION_APPLICATIONS = 3;

const not = (arg: PredFormula): PredFormula => ({ kind: "not", arg });

/** Resultados de aplicar la ley en la raíz de f (vacío si no encaja). */
function atRoot(f: PredFormula, law: NegationLawId): PredFormula[] {
  if (f.kind !== "not") return [];
  const g = f.arg;
  switch (law) {
    case "neg-forall":
      return g.kind === "forall" ? [{ kind: "exists", variable: g.variable, body: not(g.body) }] : [];
    case "neg-exists":
      return g.kind === "exists" ? [{ kind: "forall", variable: g.variable, body: not(g.body) }] : [];
    case "de-morgan-and":
      return g.kind === "and" ? [{ kind: "or", left: not(g.left), right: not(g.right) }] : [];
    case "de-morgan-or":
      return g.kind === "or" ? [{ kind: "and", left: not(g.left), right: not(g.right) }] : [];
    case "neg-imp":
      return g.kind === "imp" ? [{ kind: "and", left: g.left, right: not(g.right) }] : [];
    case "neg-iff":
      // Las dos formas de libro: φ ↔ ¬ψ y ¬φ ↔ ψ.
      return g.kind === "iff"
        ? [
            { kind: "iff", left: g.left, right: not(g.right) },
            { kind: "iff", left: not(g.left), right: g.right },
          ]
        : [];
    case "double-neg":
      return g.kind === "not" ? [g.arg] : [];
  }
}

/** Todas las fórmulas que salen de aplicar UNA vez la ley en cualquier posición de f. */
export function negationRewritesOnce(f: PredFormula, law: NegationLawId): PredFormula[] {
  const out: PredFormula[] = [];
  const visit = (g: PredFormula, rebuild: (h: PredFormula) => PredFormula): void => {
    for (const r of atRoot(g, law)) out.push(rebuild(r));
    if (g.kind === "not") visit(g.arg, (h) => rebuild(not(h)));
    else if (g.kind === "forall" || g.kind === "exists") {
      const { kind, variable } = g;
      visit(g.body, (h) => rebuild({ kind, variable, body: h }));
    } else if (isPredBinary(g)) {
      const { kind, left, right } = g;
      visit(left, (h) => rebuild({ kind, left: h, right }));
      visit(right, (h) => rebuild({ kind, left, right: h }));
    }
  };
  visit(f, (h) => h);
  return out;
}

/** ¿Lleva la ley de `from` a `to` aplicándola entre 1 y MAX_NEGATION_APPLICATIONS veces? */
export function negationLawJustifies(from: PredFormula, to: PredFormula, law: NegationLawId): boolean {
  const target = predKey(to);
  const seen = new Set<string>();
  let frontier = [from];
  for (let d = 0; d < MAX_NEGATION_APPLICATIONS && frontier.length > 0; d++) {
    const next: PredFormula[] = [];
    for (const g of frontier) {
      for (const r of negationRewritesOnce(g, law)) {
        const k = predKey(r);
        if (k === target) return true;
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(r);
      }
    }
    frontier = next;
  }
  return false;
}

/** Leyes que justifican el paso, en el orden de NEGATION_LAWS. */
export const negationLawsJustifying = (from: PredFormula, to: PredFormula): NegationLawId[] =>
  NEGATION_LAWS.map((l) => l.id).filter((id) => negationLawJustifies(from, to, id));

/** Subfórmulas ¬… a las que se les puede aplicar una ley, de fuera hacia dentro. */
export function applicableNegationLaws(f: PredFormula): Array<{ law: NegationLawId; at: PredFormula }> {
  const out: Array<{ law: NegationLawId; at: PredFormula }> = [];
  const visit = (g: PredFormula): void => {
    for (const l of NEGATION_LAWS) if (atRoot(g, l.id).length > 0) out.push({ law: l.id, at: g });
    if (g.kind === "not") visit(g.arg);
    else if (g.kind === "forall" || g.kind === "exists") visit(g.body);
    else if (isPredBinary(g)) {
      visit(g.left);
      visit(g.right);
    }
  };
  visit(f);
  return out;
}

export type NegationStep = { formula: PredFormula; law: NegationLawId };

/**
 * Solución de referencia: aplica una ley cada vez, siempre a la negación más externa, hasta la forma
 * normal negativa. Devuelve los pasos (sin la línea de partida).
 */
export function pushNegation(f: PredFormula): NegationStep[] {
  const steps: NegationStep[] = [];
  let current = f;
  // Cada paso baja una negación o elimina dos: el número de pasos está acotado por el tamaño de f.
  while (!isNegationNormalForm(current)) {
    const first = applicableNegationLaws(current)[0]!;
    const rewritten = rewriteFirst(current, first.at, first.law);
    steps.push({ formula: rewritten, law: first.law });
    current = rewritten;
  }
  return steps;
}

// Reescribe la primera aparición (por identidad de objeto) de `at` con la primera forma de la ley.
function rewriteFirst(f: PredFormula, at: PredFormula, law: NegationLawId): PredFormula {
  if (f === at) return atRoot(f, law)[0]!;
  switch (f.kind) {
    case "pred":
      return f;
    case "not":
      return not(rewriteFirst(f.arg, at, law));
    case "forall":
    case "exists":
      return { kind: f.kind, variable: f.variable, body: rewriteFirst(f.body, at, law) };
    default:
      return { kind: f.kind, left: rewriteFirst(f.left, at, law), right: rewriteFirst(f.right, at, law) };
  }
}

export type NegationStepCheck =
  | { ok: false; reason: "arity-conflict"; name: string }
  | { ok: false; reason: "same" }
  | { ok: false; reason: "not-equivalent"; difference: PredDifference }
  | { ok: false; reason: "wrong-law"; suggestions: NegationLawId[] }
  | { ok: true; done: boolean };

/**
 * Comprueba un paso de la negación: (1) equivalente a la línea anterior en el dominio (la
 * interpretación `current` primero, luego todas o una muestra); (2) la ley elegida lleva de una a otra.
 * Si es equivalente pero la ley no encaja, `suggestions` dice qué leyes sí (vacío: varias leyes a la vez).
 */
export function checkNegationStep(
  prev: PredFormula,
  next: PredFormula,
  law: NegationLawId,
  domain: readonly string[],
  current?: PredInterpretation,
): NegationStepCheck {
  const sig = predicateSignature(prev, next);
  if (!sig.ok) return { ok: false, reason: "arity-conflict", name: sig.name };
  if (predKey(prev) === predKey(next)) return { ok: false, reason: "same" };
  const difference = findPredDifference(prev, next, [domain], { extra: current ? [current] : [] });
  if (difference) return { ok: false, reason: "not-equivalent", difference };
  if (!negationLawJustifies(prev, next, law)) {
    return { ok: false, reason: "wrong-law", suggestions: negationLawsJustifying(prev, next) };
  }
  return { ok: true, done: isNegationNormalForm(next) };
}
