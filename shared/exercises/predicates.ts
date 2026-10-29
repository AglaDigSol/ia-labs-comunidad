// Ejercicios de lógica de predicados: enunciados con cuantificadores sobre P, Q (propiedades) y R
// (relación), con formas que crecen con el nivel, y una interpretación al azar en un dominio pequeño.
// El valor de verdad, los pasos de la evaluación y la negación de referencia los calculan
// shared/predicates/evaluate.ts y negation.ts al resolver.
import { analyzeVariables, predicateSignature, predToPlain, type PredFormula } from "../predicates/ast.ts";
import { evaluationSteps, type PredInterpretation } from "../predicates/evaluate.ts";
import { pushNegation } from "../predicates/negation.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Bin = "and" | "or" | "imp" | "iff";
type Quant = "forall" | "exists";

/** Pasos de evaluación que caben en la práctica «Paso a paso» (MAX_EVAL_STEPS de la página). */
export const EXERCISE_MAX_EVAL_STEPS = 10;

const atom = (name: string, ...args: string[]): PredFormula => ({ kind: "pred", name, args: args.map((a) => ({ name: a })) });
const not = (arg: PredFormula): PredFormula => ({ kind: "not", arg });
const bin = (kind: Bin, left: PredFormula, right: PredFormula): PredFormula => ({ kind, left, right });
const quant = (kind: Quant, variable: string, body: PredFormula): PredFormula => ({ kind, variable, body });

/** Fórmulas por nivel: P, Q con una variable y, desde el nivel medio, la relación R. */
function shape(rng: Rng, level: ExerciseLevel, ops: readonly Bin[]): PredFormula {
  const q = (): Quant => (rng.chance(0.5) ? "forall" : "exists");
  const op = () => rng.pick(ops);
  const [p1, p2] = rng.shuffle(["P", "Q"]);
  const lit = (name: string, x: string) => (rng.chance(0.3) ? not(atom(name, x)) : atom(name, x));
  const rel = (x: string, y: string) => {
    const a = rng.chance(0.75) ? atom("R", x, y) : atom("R", y, x);
    return rng.chance(0.25) ? not(a) : a;
  };
  const shapes: Record<ExerciseLevel, Array<() => PredFormula>> = {
    básico: [
      () => quant(q(), "x", bin(op(), lit(p1!, "x"), lit(p2!, "x"))),
      () => bin(op(), quant(q(), "x", lit(p1!, "x")), quant(q(), "y", lit(p2!, "y"))),
    ],
    medio: [
      () => quant(q(), "x", quant(q(), "y", rel("x", "y"))),
      () => quant(q(), "x", bin(op(), lit(p1!, "x"), quant(q(), "y", rel("x", "y")))),
      () => quant(q(), "x", bin(op(), lit(p1!, "x"), lit(p2!, "x"))),
    ],
    avanzado: [
      () => quant(q(), "x", bin(op(), lit(p1!, "x"), quant(q(), "y", bin(op(), rel("x", "y"), lit(p2!, "y"))))),
      () => bin(op(), quant(q(), "x", quant(q(), "y", rel("x", "y"))), quant(q(), "z", lit(p1!, "z"))),
      () => quant(q(), "x", bin(op(), quant(q(), "y", rel("x", "y")), lit(p1!, "x"))),
    ],
  };
  return rng.pick(shapes[level])();
}

/** Enunciado bien formado: cerrado, sin cuantificadores que no ligan nada y con aridades coherentes. */
export function wellFormedSentence(f: PredFormula): boolean {
  const a = analyzeVariables(f);
  return a.free.length === 0 && a.vacuous.length === 0 && a.constants.length === 0 && predicateSignature(f).ok;
}

// ---------------------------------------------------------------- Evaluar en un dominio

export type PredicateTable = { name: string; arity: 1 | 2; extension: string[][] };
export type PredEvalInstance = { domain: string[]; predicates: PredicateTable[]; formula: string };

const DOMAIN_SIZE: Record<ExerciseLevel, number> = { básico: 3, medio: 4, avanzado: 4 };

/** Extensión al azar que no es ni vacía ni todo: así los dos valores de un átomo aparecen. */
function randomExtension(rng: Rng, domain: string[], arity: 1 | 2): string[][] {
  const tuples = arity === 1 ? domain.map((d) => [d]) : domain.flatMap((a) => domain.map((b) => [a, b]));
  for (;;) {
    const ext = tuples.filter(() => rng.chance(arity === 1 ? 0.5 : 0.4));
    if (ext.length > 0 && ext.length < tuples.length) return ext;
  }
}

export const toPredInterpretation = (i: Pick<PredEvalInstance, "domain" | "predicates">): PredInterpretation => ({
  domain: i.domain,
  predicates: Object.fromEntries(i.predicates.map((p) => [p.name, p.extension])),
});

export const PRED_EVALUATE: ExerciseType<PredEvalInstance> = {
  id: "predicados-evaluar",
  topic: "predicados",
  title: "Evaluar en un dominio",
  description: "Decide si un enunciado con cuantificadores es verdadero en un dominio finito, instancia a instancia.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("predicados-evaluar", seed);
    const domain = Array.from({ length: DOMAIN_SIZE[level] }, (_, i) => String(i + 1));
    // Verdadero o falso por igual.
    const want = rng.chance(0.5);
    const ops: Bin[] = level === "avanzado" ? ["and", "or", "imp", "iff"] : ["and", "or", "imp"];
    const found = generateUntil(
      rng,
      (r) => {
        const formula = shape(r, level, ops);
        const sig = predicateSignature(formula);
        if (!sig.ok) return null;
        const predicates = sig.predicates
          .map((p) => ({ name: p.name, arity: p.arity as 1 | 2, extension: randomExtension(r, domain, p.arity as 1 | 2) }))
          .sort((a, b) => (a.name < b.name ? -1 : 1));
        return { domain, predicates, formula };
      },
      ({ predicates, formula }) => {
        if (!wellFormedSentence(formula)) return false;
        const steps = evaluationSteps(formula, toPredInterpretation({ domain, predicates }), EXERCISE_MAX_EVAL_STEPS);
        return steps.ok && steps.steps.length > 0 && steps.value === want;
      },
    );
    return { domain, predicates: found.predicates, formula: predToPlain(found.formula) };
  },
};

// ---------------------------------------------------------------- Negar paso a paso

export type PredNegateInstance = { formula: string };

/** Pasos de la negación de referencia (pushNegation) que se piden en cada nivel. */
export const NEGATION_STEPS: Record<ExerciseLevel, [number, number]> = { básico: [2, 3], medio: [3, 4], avanzado: [4, 7] };

export const PRED_NEGATE: ExerciseType<PredNegateInstance> = {
  id: "predicados-negar",
  topic: "predicados",
  title: "Negar paso a paso",
  description: "Lleva la negación hacia dentro, una ley cada vez, hasta que solo afecte a fórmulas atómicas.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const [min, max] = NEGATION_STEPS[level];
    const ops: Bin[] = level === "avanzado" ? ["and", "or", "imp", "iff"] : ["and", "or", "imp"];
    const f = generateUntil(
      rngFor("predicados-negar", seed),
      (r) => shape(r, level, ops),
      (g) => {
        if (!wellFormedSentence(g)) return false;
        const n = pushNegation(not(g)).length;
        return n >= min && n <= max;
      },
    );
    return { formula: predToPlain(f) };
  },
};

export const PREDICATE_EXERCISES = [PRED_EVALUATE, PRED_NEGATE] as const;
