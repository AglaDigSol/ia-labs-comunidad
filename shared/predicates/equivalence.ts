// Equivalencia de dos fórmulas de predicados en dominios finitos: se buscan una interpretación de los
// predicados y una asignación de las variables libres en las que difieran. Si los predicados caben en
// pocos bits se prueban todas las interpretaciones; si no, una muestra con semilla fija (el resultado
// es reproducible). Coincidir en dominios finitos no es una demostración de equivalencia lógica.
import { analyzeVariables, freeVariables, predicateSignature, type PredFormula } from "./ast.ts";
import { predEvaluator, type PredInterpretation } from "./evaluate.ts";

/** Con este número de bits o menos (casillas de todas las extensiones) se prueban todas las interpretaciones. */
export const EXHAUSTIVE_BITS = 12;
export const DEFAULT_SAMPLES = 200;

export type PredDifference = {
  interpretation: PredInterpretation;
  assignment: Record<string, string>;
  left: boolean;
  right: boolean;
};

export type EquivalenceOptions = {
  /** Interpretaciones que se prueban primero (por ejemplo, la que ha definido el estudiante). */
  extra?: PredInterpretation[];
  samples?: number;
  seed?: number;
};

// PRNG mulberry32: pequeño y determinista.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tuples(domain: readonly string[], arity: number): string[][] {
  let out: string[][] = [[]];
  for (let i = 0; i < arity; i++) out = out.flatMap((t) => domain.map((d) => [...t, d]));
  return out;
}

function assignments(domain: readonly string[], vars: string[]): Array<Record<string, string>> {
  let out: Array<Record<string, string>> = [{}];
  for (const v of vars) out = out.flatMap((a) => domain.map((d) => ({ ...a, [v]: d })));
  return out;
}

/** Interpretaciones de los predicados sobre el dominio: todas o una muestra. */
function* interpretations(
  domain: readonly string[],
  preds: Array<{ name: string; arity: number }>,
  samples: number,
  seed: number,
): Generator<PredInterpretation> {
  const cells = preds.flatMap((p) => tuples(domain, p.arity).map((t) => ({ name: p.name, tuple: t })));
  const build = (bit: (i: number) => boolean): PredInterpretation => {
    const predicates: Record<string, string[][]> = Object.fromEntries(preds.map((p) => [p.name, []]));
    cells.forEach((c, i) => {
      if (bit(i)) predicates[c.name]!.push(c.tuple);
    });
    return { domain, predicates };
  };
  if (cells.length <= EXHAUSTIVE_BITS) {
    for (let m = 0; m < 1 << cells.length; m++) yield build((i) => ((m >> i) & 1) === 1);
    return;
  }
  yield build(() => false);
  yield build(() => true);
  const r = rng(seed);
  for (let k = 0; k < samples; k++) {
    // Densidades variadas: extensiones casi vacías, mitad y casi llenas.
    const p = [0.2, 0.5, 0.8][k % 3]!;
    const bits = cells.map(() => r() < p);
    yield build((i) => bits[i]!);
  }
}

/**
 * Busca dónde difieren a y b en los dominios dados (y en `extra`). null si no se encuentra ninguna
 * diferencia. Se saltan los dominios que no contienen alguna constante de las fórmulas. Lanza un error
 * si un predicado aparece con dos aridades: compruébalo antes con predicateSignature.
 */
export function findPredDifference(
  a: PredFormula,
  b: PredFormula,
  domains: ReadonlyArray<readonly string[]>,
  options: EquivalenceOptions = {},
): PredDifference | null {
  const sig = predicateSignature(a, b);
  if (!sig.ok) throw new Error(`El predicado ${sig.name} aparece con aridades distintas.`);
  const free = [...new Set([...freeVariables(a), ...freeVariables(b)])];
  const constants = [...new Set([...analyzeVariables(a).constants, ...analyzeVariables(b).constants])];
  const test = (interp: PredInterpretation): PredDifference | null => {
    const ev = predEvaluator(interp);
    for (const assignment of assignments(interp.domain, free)) {
      const left = ev(a, assignment);
      const right = ev(b, assignment);
      if (left !== right) return { interpretation: interp, assignment, left, right };
    }
    return null;
  };
  const knows = (interp: PredInterpretation) =>
    interp.domain.length > 0 && constants.every((c) => interp.domain.includes(c) || interp.constants?.[c] !== undefined);
  for (const interp of options.extra ?? []) {
    if (!knows(interp)) continue;
    const d = test(interp);
    if (d) return d;
  }
  for (const domain of domains) {
    if (!knows({ domain, predicates: {} })) continue;
    for (const interp of interpretations(domain, sig.predicates, options.samples ?? DEFAULT_SAMPLES, options.seed ?? 1)) {
      const d = test(interp);
      if (d) return d;
    }
  }
  return null;
}
