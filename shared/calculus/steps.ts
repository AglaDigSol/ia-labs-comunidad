// Derivadas paso a paso. Cada línea de una derivación es una expresión que puede llevar derivadas sin
// hacer, (u)′; un paso aplica una regla a una (o varias) de esas derivadas. La comprobación mira dos
// cosas: que la línea nueva sigue valiendo f′ (equivalencia numérica, resolviendo las primas) y qué
// derivadas sin hacer de la línea anterior han desaparecido, para decir si la regla elegida es la que
// encaja con ellas. La solución completa aplica una regla cada vez, de izquierda a derecha.
import { hasD, toPlain, type Expr, type VarName } from "./expr.ts";
import { derivativeRaw, expandD, RULE_BY_ID, rulesFor, type RuleId } from "./derive.ts";
import { equivalent } from "./equivalence.ts";
import { simplifiedKey, tidy } from "./simplify.ts";

/** Lo que se elige en cada paso: una regla de derivación o solo operar. */
export type StepRule = RuleId | "simplificar";
export const SIMPLIFY_LABEL = "Operar y simplificar";
export const stepRuleName = (r: StepRule) => (r === "simplificar" ? SIMPLIFY_LABEL : RULE_BY_ID[r].name);

/** Las derivadas sin hacer de una línea, de izquierda a derecha (las de fuera antes). */
export function pendingDerivatives(e: Expr): Array<{ arg: Expr; v: VarName }> {
  const out: Array<{ arg: Expr; v: VarName }> = [];
  const walk = (x: Expr) => {
    switch (x.k) {
      case "d":
        out.push({ arg: x.a, v: x.v });
        return;
      case "add":
      case "mul":
        x.args.forEach(walk);
        return;
      case "div":
      case "pow":
        walk(x.a);
        walk(x.b);
        return;
      case "neg":
      case "fn":
        walk(x.a);
        return;
      default:
        return;
    }
  };
  walk(e);
  return out;
}

/** Quita de `from` los elementos de `remove` (como multiconjuntos, por clave). */
function minus<T>(from: T[], remove: T[], key: (t: T) => string): T[] {
  const counts = new Map<string, number>();
  for (const r of remove) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return from.filter((t) => {
    const k = key(t);
    const c = counts.get(k) ?? 0;
    if (c > 0) {
      counts.set(k, c - 1);
      return false;
    }
    return true;
  });
}

const argKey = (p: { arg: Expr; v: VarName }) => `${p.v}:${simplifiedKey(p.arg)}`;

export type StepCheck =
  | { ok: false; reason: "not-equivalent" | "unknown" }
  | {
      ok: true;
      /** La línea ya no tiene derivadas sin hacer. */
      done: boolean;
      /** La regla elegida encaja con lo que ha cambiado. */
      ruleFits: boolean;
      /** Reglas que sí encajan con las derivadas que has hecho en este paso. */
      suggestions: RuleId[];
      /** Otras reglas que también has aplicado en el mismo paso. */
      alsoApplied: RuleId[];
      /** Derivadas que has hecho (las de la línea anterior que ya no están). */
      applied: Expr[];
    };

/**
 * Comprueba un paso de la derivada de f: de `prev` (la línea anterior) a `next`, diciendo que se
 * aplica `rule`. Todas las líneas tienen que valer f′.
 */
export function checkDerivStep(f: Expr, prev: Expr, next: Expr, rule: StepRule, v: VarName = "x"): StepCheck {
  const target = derivativeRaw(f, v);
  const eq = equivalent(next, target, v === "y" ? ["x", "y"] : ["x"]);
  if (eq.kind === "different") return { ok: false, reason: "not-equivalent" };
  if (eq.kind === "unknown") return { ok: false, reason: "unknown" };
  const before = pendingDerivatives(prev);
  const after = pendingDerivatives(next);
  const consumed = minus(before, after, argKey);
  const done = !hasD(next);
  if (consumed.length === 0) {
    // Nada derivado en este paso: solo se ha operado.
    return { ok: true, done, ruleFits: rule === "simplificar", suggestions: [], alsoApplied: [], applied: [] };
  }
  const fits = rule !== "simplificar" && consumed.some((c) => rulesFor(c.arg, c.v).includes(rule));
  // Lo que quedaría al aplicar una sola vez la regla a cada derivada hecha: si en tu línea no están
  // esas derivadas de dentro, también las has hecho (otra regla en el mismo paso).
  const expected = consumed.flatMap((c) => pendingDerivatives(expandD(c.arg, c.v)));
  const extra = minus(expected, after, argKey);
  const others = new Set<RuleId>();
  for (const c of consumed) {
    const rs = rulesFor(c.arg, c.v);
    if (rule === "simplificar" || !rs.includes(rule)) others.add(rs[0]!);
  }
  for (const x of extra) {
    const rs = rulesFor(x.arg, x.v);
    if (rule === "simplificar" || !rs.includes(rule)) others.add(rs[0]!);
  }
  const suggestions = [...new Set(consumed.map((c) => rulesFor(c.arg, c.v)[0]!))];
  return {
    ok: true,
    done,
    ruleFits: fits,
    suggestions,
    alsoApplied: fits ? [...others] : [],
    applied: consumed.map((c) => c.arg),
  };
}

/** Qué regla toca a cada derivada pendiente (pista: dice la regla, nunca el resultado). */
export function nextRuleHints(line: Expr): Array<{ arg: Expr; rule: RuleId }> {
  return pendingDerivatives(line).map((p) => ({ arg: p.arg, rule: rulesFor(p.arg, p.v)[0]! }));
}

/** Aplica la regla a la primera derivada pendiente (en profundidad, de izquierda a derecha). */
function expandFirst(e: Expr): { line: Expr; arg: Expr; v: VarName } | null {
  let done: { arg: Expr; v: VarName } | null = null;
  const rec = (x: Expr): Expr => {
    if (done) return x;
    switch (x.k) {
      case "d":
        done = { arg: x.a, v: x.v };
        return expandD(x.a, x.v);
      case "add":
      case "mul":
        return { k: x.k, args: x.args.map(rec) };
      case "div":
      case "pow": {
        const a = rec(x.a);
        return { k: x.k, a, b: rec(x.b) };
      }
      case "neg":
      case "fn":
        return { ...x, a: rec(x.a) };
      default:
        return x;
    }
  };
  const line = rec(e);
  const found = done as { arg: Expr; v: VarName } | null;
  return found ? { line, arg: found.arg, v: found.v } : null;
}

export type SolutionStep = { line: Expr; rule: StepRule; on: Expr | null };

/**
 * La derivación completa: (f)′, una regla cada vez, y al final «operar y simplificar» si hace falta.
 * Cada línea va escrita como en un libro.
 */
export function derivationSteps(f: Expr, v: VarName = "x", maxSteps = 30): SolutionStep[] {
  const steps: SolutionStep[] = [];
  let cur: Expr = { k: "d", a: f, v };
  for (let i = 0; i < maxSteps && hasD(cur); i++) {
    const r = expandFirst(cur);
    if (!r) break;
    cur = tidy(r.line);
    steps.push({ line: cur, rule: rulesFor(r.arg, r.v)[0]!, on: r.arg });
  }
  const final = tidy(derivativeRaw(f, v));
  if (steps.length === 0 || toPlain(steps[steps.length - 1]!.line) !== toPlain(final)) steps.push({ line: final, rule: "simplificar", on: null });
  return steps;
}
