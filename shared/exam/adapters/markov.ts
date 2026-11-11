// Adaptadores de cadenas de Markov y las soluciones paso a paso, que usan también las vistas del banco
// de ejercicios (detrás de «Ver la solución completa»). Todo con fracciones exactas; los decimales,
// con coma. El TeX lo escriben siempre estas funciones a partir de los números del motor.
import { createRng } from "../../exercises/random.ts";
import { seedFromKey, type ChoiceOption } from "../../exercises/choice.ts";
import {
  ABSORPTION_STORIES,
  absorptionOf,
  absorptionStates,
  classifyOf,
  evolutionVectors,
  MARKOV_ABSORPTION,
  MARKOV_CLASSIFY,
  MARKOV_EVOLUTION,
  MARKOV_STATIONARY,
  MARKOV_STORIES,
  qMat,
  qVec,
  stationaryOf,
  storyStates,
  type MarkovAbsorptionInstance,
  type MarkovClassifyInstance,
  type MarkovEvolutionInstance,
  type MarkovStationaryInstance,
} from "../../exercises/markov.ts";
import { fracTex, fracText, matrixLabel, matrixTex } from "../../linalg/matrix.ts";
import { matrixInverse, rowOpTex, rowOpText, rref } from "../../linalg/rref.ts";
import type { StateKind } from "../../markov/classify.ts";
import type { Mat, Vec } from "../../markov/matrix.ts";
import { transpose, vecMul } from "../../markov/matrix.ts";
import { formatDecimal, isZero, ONE, sub, ZERO, type Frac } from "../../rational.ts";
import { examAdapter, type ExamAdapter } from "../adapter.ts";
import { examList, examMath, examP, examTex } from "../blocks.ts";
import type { ExamBlock, ExamNumericFormat } from "../types.ts";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const subText = (k: number) => [...String(k)].map((d) => SUB[Number(d)]).join("");

/** Exacto si es un decimal finito corto (0,35); si no, dos decimales. */
const formatOf = (x: Frac): ExamNumericFormat => (x.d === 1n || 10n ** 4n % x.d === 0n ? "exacto" : "dos-decimales");

/** «3/8 = 0,375» o «1/3 ≈ 0,3333». */
export function fracWithDecimal(x: Frac): string {
  if (x.d === 1n) return fracText(x);
  const d = formatDecimal(x, 4);
  return `${fracText(x)} ${d.exact ? "=" : "≈"} ${d.text}`;
}

const rowTex = (v: Vec) => matrixTex([v]);
const rowText = (v: Vec) => `(${v.map(fracText).join("; ")})`;
/** Factor entre paréntesis si es negativo. */
const factorTex = (x: Frac) => (x.n < 0n ? `\\left(${fracTex(x)}\\right)` : fracTex(x));

/** P con su lectura y los nombres de los estados. */
export function transitionBlocks(P: Mat, names: readonly string[]): ExamBlock[] {
  return [
    examMath(`P = ${matrixTex(P)}`, `Matriz de transición P: ${matrixLabel(P)}`),
    examP(`Filas y columnas, en este orden: ${names.map((n, i) => `${i + 1} = ${n}`).join(", ")}. La fila i dice a dónde se va desde el estado i (cada fila suma 1).`),
  ];
}

// ---------------------------------------------------------------- Evolución

export function evolutionStem(inst: MarkovEvolutionInstance): ExamBlock[] {
  const names = storyStates(inst.story, inst.P.length);
  const v0 = qVec(inst.v0);
  return [
    examP(MARKOV_STORIES[inst.story]!.context),
    ...transitionBlocks(qMat(inst.P), names),
    examP("La distribución inicial es ", examTex(`v_0 = ${rowTex(v0)}`, `v sub 0 igual a ${rowText(v0)}`), "."),
  ];
}

export function evolutionSolution(inst: MarkovEvolutionInstance): ExamBlock[] {
  const P = qMat(inst.P);
  const vs = evolutionVectors(inst);
  const out: ExamBlock[] = [examP("Cada paso multiplica el vector fila por P: vₖ = vₖ₋₁·P. La componente j de vₖ es la suma, para cada estado i, de vₖ₋₁(i)·pᵢⱼ: lo que llega a j desde cada estado.")];
  for (let k = 1; k <= inst.n; k++) {
    const prev = vs[k - 1]!;
    out.push(examP(`Paso ${k}: v${subText(k)} = v${subText(k - 1)}·P`));
    out.push(
      examList(
        vs[k]!.map((x, j) => [
          examTex(
            `v_{${k}}(${j + 1}) = ${prev.map((a, i) => `${factorTex(a)}\\cdot ${factorTex(P[i]![j]!)}`).join(" + ")} = ${fracTex(x)}`,
            `componente ${j + 1} de v sub ${k}: ${prev.map((a, i) => `${fracText(a)} por ${fracText(P[i]![j]!)}`).join(" más ")}, igual a ${fracText(x)}`,
          ),
        ]),
      ),
    );
    out.push(examMath(`v_{${k}} = ${rowTex(vs[k]!)}`, `v sub ${k} igual a ${rowText(vs[k]!)}`));
  }
  const last = vs[inst.n]!;
  out.push(examP(`Comprobación: v${subText(inst.n)} suma 1. En decimales, v${subText(inst.n)} ≈ (${last.map((x) => formatDecimal(x, 4).text).join("; ")}).`));
  return out;
}

const evolutionAdapter = examAdapter({
  type: MARKOV_EVOLUTION,
  ask: "Probabilidad de estar en un estado tras n pasos, vₙ = v₀·Pⁿ (numérica).",
  build(inst) {
    const names = storyStates(inst.story, inst.P.length);
    const last = evolutionVectors(inst)[inst.n]!;
    const j = seedFromKey(JSON.stringify(inst)) % names.length;
    const value = last[j]!;
    return {
      kind: "numeric",
      stem: evolutionStem(inst),
      prompt: `¿Qué probabilidad hay de estar en «${names[j]}» tras ${inst.n} pasos?`,
      expected: value,
      format: formatOf(value),
      label: `v${subText(inst.n)}(${j + 1})`,
      solution: evolutionSolution(inst),
    };
  },
});

// ---------------------------------------------------------------- Estacionaria

/** Sistema de la estacionaria: πⱼ = Σᵢ pᵢⱼ πᵢ y la normalización. */
export function stationaryEquations(P: Mat): ExamBlock {
  const m = P.length;
  const pi = (i: number) => `\\pi_{${i + 1}}`;
  const rows = P[0]!.map((_, j) => {
    const terms = P.flatMap((row, i) => (isZero(row[j]!) ? [] : [`${fracTex(row[j]!)}\\,${pi(i)}`]));
    return `${pi(j)} &= ${terms.join(" + ")}`;
  });
  rows.push(`${Array.from({ length: m }, (_, i) => pi(i)).join(" + ")} &= 1`);
  const label = [
    ...P[0]!.map((_, j) => `pi ${j + 1} igual a ${P.flatMap((row, i) => (isZero(row[j]!) ? [] : [`${fracText(row[j]!)} por pi ${i + 1}`])).join(" más ")}`),
    `la suma de las pi es 1`,
  ].join("; ");
  return examMath(`\\left\\{\\begin{aligned} ${rows.join(" \\\\ ")} \\end{aligned}\\right.`, `Sistema: ${label}`);
}

export function stationaryStem(inst: MarkovStationaryInstance): ExamBlock[] {
  return [examP(MARKOV_STORIES[inst.story]!.context), ...transitionBlocks(qMat(inst.P), storyStates(inst.story, inst.P.length))];
}

/** Solución: el sistema, la matriz ampliada y (con `full`) cada paso de Gauss-Jordan; π y la comprobación. */
export function stationarySolution(inst: MarkovStationaryInstance, full = true): ExamBlock[] {
  const P = qMat(inst.P);
  const m = P.length;
  const pi = stationaryOf(inst);
  // (Pᵀ − I) πᵀ = 0 con la última ecuación cambiada por π₁ + … + πₘ = 1.
  const A = transpose(P).map((row, i) => row.map((x, j) => (i === j ? sub(x, ONE) : x)));
  const aug = A.map((row, i) => (i === m - 1 ? [...row.map(() => ONE), ONE] : [...row, ZERO]));
  const out: ExamBlock[] = [
    examP("π es un vector fila que no cambia al dar un paso, π·P = π, y es una distribución: sus componentes suman 1. Componente a componente:"),
    stationaryEquations(P),
    examP("Las ecuaciones de π·P = π son dependientes (una sobra). Pasando todo a la izquierda y cambiando la última por la normalización queda el sistema de esta matriz ampliada (columnas π₁, π₂…):"),
    examMath(matrixTex(aug, { bar: m }), `Matriz ampliada: ${matrixLabel(aug)}`),
  ];
  if (full) {
    const r = rref(aug, m);
    out.push(examP("Gauss-Jordan, una operación en cada paso:"));
    r.ops.forEach((op, k) => out.push(examMath(`${rowOpTex(op)}:\\quad ${matrixTex(r.steps[k]!, { bar: m })}`, `${rowOpText(op)}: ${matrixLabel(r.steps[k]!)}`)));
  }
  out.push(examMath(`\\pi = ${rowTex(pi)}`, `pi igual a ${rowText(pi)}`));
  out.push(examP(`Comprobación: π·P = ${rowText(vecMul(pi, P))} = π y la suma es 1. En decimales, π ≈ (${pi.map((x) => formatDecimal(x, 4).text).join("; ")}).`));
  return out;
}

const stationaryAdapter = examAdapter({
  type: MARKOV_STATIONARY,
  ask: "Una componente de la distribución estacionaria π (numérica).",
  build(inst) {
    const names = storyStates(inst.story, inst.P.length);
    const pi = stationaryOf(inst);
    const j = seedFromKey(JSON.stringify(inst)) % names.length;
    return {
      kind: "numeric",
      stem: stationaryStem(inst),
      prompt: `A largo plazo, ¿qué proporción del tiempo pasa la cadena en «${names[j]}»? (La componente π${subText(j + 1)} de la distribución estacionaria.)`,
      expected: pi[j]!,
      format: formatOf(pi[j]!),
      label: `π${subText(j + 1)}`,
      solution: stationarySolution(inst, false),
    };
  },
});

// ---------------------------------------------------------------- Clasificación

const setText = (xs: readonly number[]) => `{${xs.map((x) => x + 1).join(", ")}}`;

/** Estados fuera de la clase a los que se va directamente desde ella. */
const exits = (P: Mat, cl: readonly number[]): number[] => [...new Set(cl.flatMap((i) => P[i]!.flatMap((x, j) => (!isZero(x) && !cl.includes(j) ? [j] : []))))].sort((a, b) => a - b);

export const KIND_WHY: Record<StateKind, string> = {
  absorbente: "es absorbente: pᵢᵢ = 1, una vez dentro no se sale",
  recurrente: "es recurrente: su clase es cerrada, así que siempre se vuelve a él",
  transitorio: "es transitorio: desde su clase se puede salir y ya no volver",
};

export function classifyStem(inst: MarkovClassifyInstance): ExamBlock[] {
  const P = qMat(inst.P);
  return [examP(`Una cadena de Markov tiene ${P.length} estados, numerados del 1 al ${P.length}, y esta matriz de transición (la fila i dice a dónde se va desde el estado i):`), examMath(`P = ${matrixTex(P)}`, `Matriz de transición P: ${matrixLabel(P)}`)];
}

export function classifySolution(inst: MarkovClassifyInstance): ExamBlock[] {
  const P = qMat(inst.P);
  const c = classifyOf(inst);
  const reachable = (i: number) => c.reach[i]!.flatMap((r, j) => (r ? [j] : []));
  return [
    examP("Primero, a qué estados se llega desde cada uno (siguiendo las entradas positivas de P, en uno o más pasos, y contando el propio estado):"),
    examList(P.map((_, i) => [`Desde ${i + 1}: ${setText(reachable(i))}.`])),
    examP("Dos estados están en la misma clase si se llega de uno a otro y del otro al uno. Una clase es cerrada si desde ella no se puede salir."),
    examList(c.classes.map((cl, k) => [`${setText(cl)}: ${c.closed[k] ? "cerrada, sus estados son recurrentes" : `abierta (se sale hacia ${setText(exits(P, cl))}), sus estados son transitorios`}.`])),
    examList(c.kind.map((k, i) => [`El estado ${i + 1} ${KIND_WHY[k]}.`])),
  ];
}

/** Afirmaciones sobre un estado: ¿es absorbente, recurrente (incluye absorbente) o transitorio? */
function classifyOptions(inst: MarkovClassifyInstance): ChoiceOption[] | null {
  const c = classifyOf(inst);
  const truth = (k: StateKind, label: StateKind) => (label === "absorbente" ? k === "absorbente" : label === "recurrente" ? k !== "transitorio" : k === "transitorio");
  const all: ChoiceOption[] = c.kind.flatMap((k, i) =>
    (["absorbente", "recurrente", "transitorio"] as const).map((label) => ({
      id: `${i}-${label}`,
      text: `El estado ${i + 1} es ${label}.`,
      correct: truth(k, label),
      why: `El estado ${i + 1} ${KIND_WHY[k]}.`,
    })),
  );
  const rng = createRng(seedFromKey(JSON.stringify(inst)));
  const right = all.filter((o) => o.correct);
  const wrong = rng.shuffle(all.filter((o) => !o.correct));
  if (wrong.length < 3) return null;
  return [rng.pick(right), ...wrong.slice(0, 3)];
}

const classifyAdapter = examAdapter({
  type: MARKOV_CLASSIFY,
  ask: "Clasificar los estados de una cadena: absorbente, recurrente o transitorio (opción múltiple).",
  build(inst) {
    const options = classifyOptions(inst);
    if (!options) return null;
    return {
      kind: "choice",
      stem: classifyStem(inst),
      prompt: "¿Cuál de estas afirmaciones es verdadera? (Un estado absorbente también es recurrente.)",
      question: { mode: "single", options },
      solution: classifySolution(inst),
    };
  },
});

// ---------------------------------------------------------------- Absorción

export function absorptionStem(inst: MarkovAbsorptionInstance): ExamBlock[] {
  const s = absorptionStates(inst);
  const names = [...s.transient, ...s.absorbing];
  const P = qMat(inst.P);
  return [
    examP(`${ABSORPTION_STORIES[inst.story]!.context} ${s.absorbing.join(" y ")} son absorbentes; ${s.transient.length === 1 ? `${s.transient[0]} es transitorio` : `${s.transient.join(", ").replace(/, ([^,]*)$/, " y $1")} son transitorios`}.`),
    ...transitionBlocks(P, names),
  ];
}

export function absorptionSolution(inst: MarkovAbsorptionInstance, full = true): ExamBlock[] {
  const a = absorptionOf(inst);
  const s = absorptionStates(inst);
  const t = a.transient.length;
  const out: ExamBlock[] = [
    examP("P ya está en forma canónica (primero los transitorios y después los absorbentes): Q son las transiciones entre transitorios y R, de los transitorios a los absorbentes."),
    examMath(`P = \\begin{pmatrix} Q & R \\\\ 0 & I \\end{pmatrix},\\quad Q = ${matrixTex(a.Q)},\\quad R = ${matrixTex(a.R)}`, `Q: ${matrixLabel(a.Q)}; R: ${matrixLabel(a.R)}`),
    examMath(`I - Q = ${matrixTex(a.IminusQ)}`, `I menos Q: ${matrixLabel(a.IminusQ)}`),
  ];
  if (t === 1) {
    out.push(examMath(`N = (I - Q)^{-1} = \\frac{1}{${fracTex(a.IminusQ[0]![0]!)}} = ${fracTex(a.N[0]![0]!)}`, `N igual a 1 entre ${fracText(a.IminusQ[0]![0]!)}, igual a ${fracText(a.N[0]![0]!)}`));
  } else {
    if (full) {
      const inv = matrixInverse(a.IminusQ)!;
      out.push(examP("N = (I − Q)⁻¹ por Gauss-Jordan sobre (I − Q | I), una operación en cada paso:"));
      inv.ops.forEach((op, k) => out.push(examMath(`${rowOpTex(op)}:\\quad ${matrixTex(inv.steps[k]!, { bar: t })}`, `${rowOpText(op)}: ${matrixLabel(inv.steps[k]!)}`)));
    }
    out.push(examMath(`N = (I - Q)^{-1} = ${matrixTex(a.N)}`, `N: ${matrixLabel(a.N)}`));
  }
  out.push(examP("B = N·R: la fila i dice con qué probabilidad se acaba en cada absorbente empezando en el transitorio i (cada fila suma 1)."));
  out.push(examMath(`B = N R = ${matrixTex(a.B)}`, `B: ${matrixLabel(a.B)}`));
  const b = a.B[inst.start]![inst.target]!;
  out.push(examP(`Empezando en «${s.transient[inst.start]}», la probabilidad de acabar en «${s.absorbing[inst.target]}» es b${subText(inst.start + 1)}${subText(inst.target + 1)} = ${fracWithDecimal(b)}.`));
  if (inst.askSteps) {
    out.push(examMath(`t = N\\,\\mathbf{1} = ${matrixTex(a.t.map((x) => [x]))}`, `t: ${a.t.map(fracText).join("; ")}`));
    out.push(examP(`Desde «${s.transient[inst.start]}» se tarda de media t${subText(inst.start + 1)} = ${fracWithDecimal(a.t[inst.start]!)} pasos en llegar a un absorbente.`));
  }
  return out;
}

const absorptionAdapter = examAdapter({
  type: MARKOV_ABSORPTION,
  ask: "Probabilidad de acabar en un estado absorbente con N = (I − Q)⁻¹ y B = N·R (numérica).",
  build(inst) {
    const s = absorptionStates(inst);
    const b = absorptionOf(inst).B[inst.start]![inst.target]!;
    return {
      kind: "numeric",
      stem: absorptionStem(inst),
      prompt: `Empezando en «${s.transient[inst.start]}», ¿qué probabilidad hay de acabar en «${s.absorbing[inst.target]}»?`,
      expected: b,
      format: formatOf(b),
      label: `b${subText(inst.start + 1)}${subText(inst.target + 1)}`,
      solution: absorptionSolution(inst, false),
    };
  },
});

export const MARKOV_EXAM_ADAPTERS: readonly ExamAdapter[] = [evolutionAdapter, stationaryAdapter, classifyAdapter, absorptionAdapter];
