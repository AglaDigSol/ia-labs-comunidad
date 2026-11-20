// Extremos absolutos en un intervalo cerrado (02MIAR, tema 3: optimización): los candidatos son los
// puntos críticos de dentro del intervalo y los dos extremos; se evalúa f en todos y se elige el mayor
// y el menor. Las funciones son polinomios con coeficientes enteros y críticos enteros (f′ se construye
// factorizada), así que todo sale exacto.
import { toTex } from "../calculus/expr.ts";
import { frac, type Frac } from "../rational.ts";
import { calcExpr } from "./calculus.ts";
import { cleanMistakes, sameList, sameMatrix, type GuidedExercise, type GuidedStep, type Mistake } from "./guided.ts";
import type { Matrix } from "../linalg/matrix.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;
const int = (x: number): Frac => frac(BigInt(x));
const minus = (x: number) => String(x).replace("-", "−");

/** f(x) = Σ coefs[k]·xᵏ en [a, b]. */
export type ExtremesInstance = { coefs: number[]; a: number; b: number };

export const polyValue = (c: readonly number[], x: number) => c.reduce((acc, k, i) => acc + k * x ** i, 0);
export const polyDerivative = (c: readonly number[]) => c.slice(1).map((k, i) => k * (i + 1));

/** «x^3 − 3x^2 + 4», como lo lee el analizador de cálculo. */
export function polyText(c: readonly number[]): string {
  let out = "";
  for (let k = c.length - 1; k >= 0; k--) {
    const v = c[k]!;
    if (v === 0) continue;
    const body = k === 0 ? "" : k === 1 ? "x" : `x^${k}`;
    const t = body === "" ? String(Math.abs(v)) : Math.abs(v) === 1 ? body : `${Math.abs(v)}${body}`;
    out += out === "" ? (v < 0 ? `−${t}` : t) : v < 0 ? ` − ${t}` : ` + ${t}`;
  }
  return out === "" ? "0" : out;
}

/** Raíces enteras de f′ (todas las de f′ son enteras por construcción). */
export function criticalPoints(c: readonly number[]): number[] {
  const d = polyDerivative(c);
  const out: number[] = [];
  for (let x = -20; x <= 20; x++) if (polyValue(d, x) === 0) out.push(x);
  return out;
}

export function extremesOf(inst: ExtremesInstance) {
  const all = criticalPoints(inst.coefs);
  const inside = all.filter((x) => x > inst.a && x < inst.b);
  const cands = [inst.a, ...inside, inst.b];
  const vals = cands.map((x) => ({ x, y: polyValue(inst.coefs, x) }));
  const max = vals.reduce((m, v) => (v.y > m.y ? v : m));
  const min = vals.reduce((m, v) => (v.y < m.y ? v : m));
  return { all, inside, vals, max, min };
}

/** Coeficientes de s·∫ k·Π(x − rᵢ) dx + c (null si no salen enteros). */
function fromRoots(roots: number[], lead: number, c: number): number[] | null {
  // f′ = lead·Π(x − r): coeficientes por potencias crecientes.
  let d = [lead];
  for (const r of roots) d = [...d.map((x) => -r * x), 0].map((x, i) => x + (i > 0 ? d[i - 1]! : 0));
  const f = [c, ...d.map((k, i) => k / (i + 1))];
  return f.every(Number.isInteger) ? f : null;
}

function makeExtremes(rng: Rng, level: ExerciseLevel): ExtremesInstance | null {
  const s = rng.pick([1, -1]);
  const c = rng.int(-6, 6);
  const nRoots = level === "básico" ? 1 : level === "medio" ? 2 : 3;
  const roots = rng.shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, nRoots);
  const coefs = fromRoots(roots, s * (nRoots + 1), c);
  if (!coefs) return null;
  const a = rng.int(-4, 1);
  const b = a + rng.int(3, level === "básico" ? 5 : 6);
  return { coefs, a, b };
}

export const CALC_ABS_EXTREMES: ExerciseType<ExtremesInstance> = {
  id: "calculo-extremos-absolutos",
  topic: "calculo",
  title: "Extremos absolutos en [a, b]",
  description: "Optimización en un intervalo cerrado: puntos críticos de dentro, f en ellos y en los extremos a y b, y el máximo y el mínimo absolutos.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("calculo-extremos-absolutos", seed),
      (r) => makeExtremes(r, level),
      (inst) => {
        const e = extremesOf(inst);
        if (e.all.some((x) => x === inst.a || x === inst.b)) return false;
        if (e.vals.some((v) => Math.abs(v.y) > 150)) return false;
        // Máximo y mínimo en un solo punto cada uno.
        if (e.vals.filter((v) => v.y === e.max.y).length > 1 || e.vals.filter((v) => v.y === e.min.y).length > 1) return false;
        if (level === "básico") return true;
        // Que haya algún crítico dentro y que algún extremo del intervalo cuente (si no, no se aprende a mirarlos)…
        if (e.inside.length === 0) return false;
        const endpointWins = [e.max.x, e.min.x].some((x) => x === inst.a || x === inst.b);
        // …y en avanzado, algún crítico fuera del intervalo.
        return endpointWins && (level === "medio" || e.inside.length < e.all.length);
      },
    );
  },
};

export function extremesGuided(inst: ExtremesInstance): GuidedExercise {
  const e = extremesOf(inst);
  const f = polyText(inst.coefs);
  const df = polyText(polyDerivative(inst.coefs));
  const crit = e.vals.filter((v) => e.inside.includes(v.x));
  const critMax = crit.length ? crit.reduce((m, v) => (v.y > m.y ? v : m)) : null;
  const critMin = crit.length ? crit.reduce((m, v) => (v.y < m.y ? v : m)) : null;
  const allVals = e.all.map((x) => ({ x, y: polyValue(inst.coefs, x) }));
  const pair = (v: { x: number; y: number }): Matrix => [[int(v.x), int(v.y)]];
  const absMaxAll = [...allVals, { x: inst.a, y: polyValue(inst.coefs, inst.a) }, { x: inst.b, y: polyValue(inst.coefs, inst.b) }].reduce((m, v) => (v.y > m.y ? v : m));
  const absMinAll = [...allVals, { x: inst.a, y: polyValue(inst.coefs, inst.a) }, { x: inst.b, y: polyValue(inst.coefs, inst.b) }].reduce((m, v) => (v.y < m.y ? v : m));
  const extremeMistakes = (which: "max" | "min"): Mistake<Matrix>[] => {
    const right = which === "max" ? e.max : e.min;
    const local = which === "max" ? critMax : critMin;
    const outside = which === "max" ? absMaxAll : absMinAll;
    const other = which === "max" ? e.min : e.max;
    return cleanMistakes(pair(right), [
      local ? { value: pair(local), text: "¿Has evaluado f en los extremos del intervalo, a y b? También son candidatos." } : null,
      { value: pair(outside), text: "Ese punto está fuera de [a, b]: solo cuentan los de dentro y los extremos." },
      { value: pair(other), text: which === "max" ? "Ese es el valor más pequeño: el máximo es el mayor." : "Ese es el valor más grande: el mínimo es el menor." },
      { value: [[int(right.y), int(right.x)]], text: "Primero x y después f(x)." },
    ], sameMatrix);
  };
  const steps: GuidedStep[] = [
    {
      kind: "list",
      title: `Puntos críticos de f dentro de (${minus(inst.a)}, ${minus(inst.b)})`,
      label: "Críticos dentro del intervalo",
      expected: e.inside.map(int),
      mistakes: cleanMistakes(
        e.inside.map(int),
        [e.all.length !== e.inside.length ? { value: e.all.map(int), text: "Alguno de esos está fuera del intervalo: solo cuentan los de dentro." } : null, { value: [inst.a, ...e.inside, inst.b].map(int), text: "a y b son candidatos, pero no son puntos críticos (no hace falta que f′ valga 0 ahí): escríbelos solo después." }],
        sameList,
      ) as Mistake<readonly Frac[]>[],
      hints: ["Deriva y resuelve f′(x) = 0 (busca raíces enteras y factoriza).", "Quédate solo con los que caen dentro del intervalo; si no hay ninguno, escribe «ninguno»."],
      okText: e.inside.length === 0 ? "Bien: no hay críticos dentro." : "Bien: esos son los críticos de dentro.",
    },
    {
      kind: "numbers",
      title: "Máximo absoluto: (x, f(x))",
      name: "máximo (x, f(x))",
      expected: pair(e.max),
      mistakes: extremeMistakes("max"),
      hints: ["Candidatos: los críticos de dentro y los dos extremos a y b. Evalúa f en todos.", "El máximo absoluto es el mayor de esos valores."],
      okText: `Bien: el máximo absoluto es f(${minus(e.max.x)}) = ${minus(e.max.y)}.`,
    },
    {
      kind: "numbers",
      title: "Mínimo absoluto: (x, f(x))",
      name: "mínimo (x, f(x))",
      expected: pair(e.min),
      mistakes: extremeMistakes("min"),
      hints: ["Con los mismos candidatos, el menor de los valores."],
      okText: `Bien: el mínimo absoluto es f(${minus(e.min.x)}) = ${minus(e.min.y)}.`,
    },
  ];
  return {
    statement: {
      blocks: [{ kind: "tex", tex: `f(x) = ${toTex(calcExpr(f))},\\quad x \\in [${inst.a}, ${inst.b}]`, label: `f(x) = ${f}, con x en [${minus(inst.a)}, ${minus(inst.b)}]` }],
      ask: "Encuentra el máximo y el mínimo absolutos de f en el intervalo.",
    },
    steps,
    solution: [
      `f′(x) = ${df}; f′(x) = 0 en x = ${e.all.map(minus).join(", ")}.`,
      e.inside.length === 0 ? "Ninguno cae dentro del intervalo." : `Dentro de (${minus(inst.a)}, ${minus(inst.b)}): ${e.inside.map(minus).join(", ")}.`,
      `Valores: ${e.vals.map((v) => `f(${minus(v.x)}) = ${minus(v.y)}`).join(", ")}.`,
      `Máximo absoluto: f(${minus(e.max.x)}) = ${minus(e.max.y)}. Mínimo absoluto: f(${minus(e.min.x)}) = ${minus(e.min.y)}.`,
    ],
  };
}
