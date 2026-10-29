// Evaluación de fórmulas de predicados sobre un dominio finito con una interpretación: cada predicado
// es su extensión (el conjunto de tuplas de elementos que lo cumplen). Las constantes son los propios
// elementos del dominio (2 en {1, 2, 3, 4}) o las que fije `constants`.
import {
  analyzeVariables,
  isPredBinary,
  predicateSignature,
  predToPlain,
  substitute,
  type PredFormula,
} from "./ast.ts";

/** Límite del motor; la página usa como mucho 5 elementos para que las rejillas quepan. */
export const MAX_DOMAIN_SIZE = 6;
/** Elementos del dominio: numerales (0–999) o nombres en minúscula que no son variables (a, b, c…). */
export const DOMAIN_ELEMENT_RE = /^(?:\d{1,3}|[a-t][a-z0-9]{0,7})$/;

/** Extensión de un predicado: las tuplas que lo cumplen (["2"] para P(2), ["1", "3"] para R(1, 3)). */
export type PredExtension = ReadonlyArray<ReadonlyArray<string>>;

export type PredInterpretation = {
  domain: readonly string[];
  /** Predicados que no aparecen aquí tienen extensión vacía. */
  predicates: Readonly<Record<string, PredExtension>>;
  /** Constantes con nombre propio (a ↦ 3). Los elementos del dominio se denotan a sí mismos. */
  constants?: Readonly<Record<string, string>>;
};

export const tupleKey = (tuple: ReadonlyArray<string>) => tuple.join(",");

export type DomainParse = { ok: true; domain: string[] } | { ok: false; message: string };

/** Lee un dominio escrito como «1, 2, 3, 4» o «{a, b, c}». */
export function parseDomain(text: string, max = MAX_DOMAIN_SIZE): DomainParse {
  const inner = text.trim().replace(/^\{/, "").replace(/\}$/, "");
  const parts = inner.split(/[,;\s]+/).filter((p) => p !== "");
  if (parts.length === 0) return { ok: false, message: "El dominio no puede estar vacío: escribe al menos un elemento." };
  const bad = parts.find((p) => !DOMAIN_ELEMENT_RE.test(p));
  if (bad !== undefined) {
    return {
      ok: false,
      message: `«${bad}» no vale como elemento: usa números (1, 2, 3) o letras de la a a la t (las letras u–z son variables).`,
    };
  }
  const domain = [...new Set(parts)];
  if (domain.length !== parts.length) return { ok: false, message: "Hay elementos repetidos en el dominio." };
  if (domain.length > max) return { ok: false, message: `Usa como mucho ${max} elementos.` };
  return { ok: true, domain };
}

export type SentenceIssue =
  | { kind: "empty-domain" }
  | { kind: "free-variables"; variables: string[] }
  | { kind: "arity-conflict"; name: string; arities: number[] }
  | { kind: "unknown-constant"; name: string };

/** Lo que impide evaluar la fórmula en esta interpretación (lista vacía: se puede evaluar). */
export function sentenceIssues(f: PredFormula, interp: PredInterpretation): SentenceIssue[] {
  const out: SentenceIssue[] = [];
  if (interp.domain.length === 0) out.push({ kind: "empty-domain" });
  const sig = predicateSignature(f);
  if (!sig.ok) out.push({ kind: "arity-conflict", name: sig.name, arities: sig.arities });
  const a = analyzeVariables(f);
  if (a.free.length > 0) out.push({ kind: "free-variables", variables: a.free });
  for (const c of a.constants) {
    if (!interp.domain.includes(c) && interp.constants?.[c] === undefined) out.push({ kind: "unknown-constant", name: c });
  }
  return out;
}

type Compiled = { sets: Map<string, Set<string>>; interp: PredInterpretation };

function compile(interp: PredInterpretation): Compiled {
  const sets = new Map<string, Set<string>>();
  for (const [name, ext] of Object.entries(interp.predicates)) sets.set(name, new Set(ext.map(tupleKey)));
  return { sets, interp };
}

function evalCompiled(f: PredFormula, c: Compiled, env: Record<string, string>): boolean {
  switch (f.kind) {
    case "pred": {
      const args = f.args.map((t) => {
        const v = env[t.name] ?? (c.interp.domain.includes(t.name) ? t.name : c.interp.constants?.[t.name]);
        if (v === undefined) throw new Error(`Término sin valor: ${t.name}`);
        return v;
      });
      return c.sets.get(f.name)?.has(tupleKey(args)) ?? false;
    }
    case "not":
      return !evalCompiled(f.arg, c, env);
    case "and":
      return evalCompiled(f.left, c, env) && evalCompiled(f.right, c, env);
    case "or":
      return evalCompiled(f.left, c, env) || evalCompiled(f.right, c, env);
    case "imp":
      return !evalCompiled(f.left, c, env) || evalCompiled(f.right, c, env);
    case "iff":
      return evalCompiled(f.left, c, env) === evalCompiled(f.right, c, env);
    case "forall":
      return c.interp.domain.every((d) => evalCompiled(f.body, c, { ...env, [f.variable]: d }));
    case "exists":
      return c.interp.domain.some((d) => evalCompiled(f.body, c, { ...env, [f.variable]: d }));
  }
}

/**
 * Valor de verdad de f en la interpretación, con `assignment` para las variables libres. Lanza un
 * error si un término no tiene valor: compruébalo antes con sentenceIssues.
 */
export function evaluatePred(f: PredFormula, interp: PredInterpretation, assignment: Record<string, string> = {}): boolean {
  return evalCompiled(f, compile(interp), assignment);
}

/** Evaluador reutilizable para muchas fórmulas sobre la misma interpretación. */
export function predEvaluator(interp: PredInterpretation): (f: PredFormula, assignment?: Record<string, string>) => boolean {
  const c = compile(interp);
  return (f, assignment = {}) => evalCompiled(f, c, assignment);
}

// ---------------------------------------------------------------- Evaluación paso a paso

/** Una instancia φ(d) de una fórmula cuantificada ∀x φ(x) o ∃x φ(x). */
export type EvalInstance = {
  element: string;
  formula: PredFormula;
  plain: string;
  value: boolean;
  /** Si la instancia es a su vez una fórmula cuantificada, el paso (anterior) que la evalúa. */
  step: number | null;
};

/** Un paso: una fórmula cuantificada cerrada, sus instancias y su valor. */
export type EvalStep = {
  formula: PredFormula;
  plain: string;
  quantifier: "forall" | "exists";
  variable: string;
  instances: EvalInstance[];
  value: boolean;
};

export type EvalSteps =
  | { ok: true; steps: EvalStep[]; value: boolean }
  | { ok: false; reason: "too-many-steps"; limit: number };

/**
 * Pasos para evaluar un enunciado de dentro hacia fuera: cada fórmula cuantificada que aparece al
 * sustituir sus variables por elementos del dominio, después de las que contiene. Las fórmulas
 * repetidas son un solo paso. Si salen más de `limit` pasos, no se generan.
 */
export function evaluationSteps(f: PredFormula, interp: PredInterpretation, limit = 12): EvalSteps {
  const ev = predEvaluator(interp);
  const steps: EvalStep[] = [];
  const index = new Map<string, number>();
  const visit = (g: PredFormula): void => {
    if (g.kind === "pred") return;
    if (g.kind === "not") return visit(g.arg);
    if (isPredBinary(g)) {
      visit(g.left);
      visit(g.right);
      return;
    }
    const plain = predToPlain(g);
    if (index.has(plain)) return;
    const instances: EvalInstance[] = interp.domain.map((d) => {
      const inst = substitute(g.body, g.variable, d);
      visit(inst);
      const ip = predToPlain(inst);
      return { element: d, formula: inst, plain: ip, value: ev(inst), step: index.get(ip) ?? null };
    });
    if (steps.length >= limit) throw new TooMany();
    index.set(plain, steps.length);
    steps.push({ formula: g, plain, quantifier: g.kind, variable: g.variable, instances, value: ev(g) });
  };
  try {
    visit(f);
  } catch (e) {
    if (e instanceof TooMany) return { ok: false, reason: "too-many-steps", limit };
    throw e;
  }
  return { ok: true, steps, value: ev(f) };
}

class TooMany extends Error {}

/**
 * Para ∀x φ falsa, los contraejemplos (los d con φ(d) falsa); para ∃x φ verdadera, los testigos (los d
 * con φ(d) verdadera). null si f no es un cuantificador o no hay nada que buscar.
 */
export function witnesses(f: PredFormula, interp: PredInterpretation): { kind: "contraejemplo" | "testigo"; elements: string[] } | null {
  if (f.kind !== "forall" && f.kind !== "exists") return null;
  const ev = predEvaluator(interp);
  const want = f.kind === "exists";
  if (ev(f) !== want) return null;
  const elements = interp.domain.filter((d) => ev(substitute(f.body, f.variable, d)) === want);
  return { kind: want ? "testigo" : "contraejemplo", elements };
}
