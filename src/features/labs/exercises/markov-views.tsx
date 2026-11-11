// Vistas del banco de ejercicios para el tema «Cadenas de Markov»: el enunciado (los mismos bloques que
// el simulacro), la práctica con «Comprobar paso» (cada paso se desbloquea cuando el anterior está
// bien) y la solución paso a paso detrás de «Ver la solución completa». Las pistas dicen la regla,
// nunca el resultado; la corrección compara con las fracciones exactas del motor (shared/markov).
import { Check } from "lucide-react";
import { useId, useMemo, useState, type ComponentType } from "react";
import {
  absorptionSolution,
  absorptionStem,
  classifySolution,
  classifyStem,
  evolutionSolution,
  evolutionStem,
  stationarySolution,
  stationaryStem,
} from "../../../../shared/exam/adapters/markov.ts";
import type { ExamBlock } from "../../../../shared/exam/types.ts";
import {
  absorptionOf,
  absorptionStates,
  classifyOf,
  evolutionVectors,
  MARKOV_ABSORPTION,
  MARKOV_CLASSIFY,
  MARKOV_EVOLUTION,
  MARKOV_STATIONARY,
  qMat,
  stationaryOf,
  storyStates,
  type MarkovAbsorptionInstance,
  type MarkovClassifyInstance,
  type MarkovEvolutionInstance,
  type MarkovStationaryInstance,
} from "../../../../shared/exercises/markov.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { parseGrid, type Matrix } from "../../../../shared/linalg/matrix.ts";
import { wrongCells } from "../../../../shared/linalg/rref.ts";
import { STATE_KIND_LABELS, type StateKind } from "../../../../shared/markov/classify.ts";
import { vecMul } from "../../../../shared/markov/matrix.ts";
import { equals, formatDecimal, ONE, sum, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { ExamBlocks } from "../exam/ExamBlocks.tsx";
import { blankGrid, cellKey, HOW_TO_WRITE_NUMBERS, Hints, MatrixGrid, plural, PracticeBox, Status, Verdict } from "../linalg/common.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k: number) => [...String(k)].map((d) => SUB[Number(d)]).join("");

function Statement({ blocks, ask }: { blocks: readonly ExamBlock[]; ask: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      <ExamBlocks blocks={blocks} />
      <p className="font-semibold">{ask}</p>
    </div>
  );
}

function Solution({ blocks, resetKey }: { blocks: readonly ExamBlock[]; resetKey: string }) {
  return (
    <SolutionGate resetKey={resetKey}>
      <div className="rounded-lg border border-border bg-raised p-3">
        <ExamBlocks blocks={blocks} />
      </div>
    </SolutionGate>
  );
}

// ---------------------------------------------------------------- «Comprobar paso»

/** Un paso: una matriz (o un vector fila, 1 × m) que se escribe y se comprueba. */
export interface MatrixStep {
  title: string;
  /** Nombre para las celdas: «v₁», «N = (I − Q)⁻¹». */
  name: string;
  expected: Matrix;
  /** Qué es cada columna (nombres de estados), si ayuda. */
  columns?: readonly string[];
  hints: readonly string[];
  /** Aviso sobre lo escrito (sin decir la respuesta): «tu vector no suma 1». */
  diagnose?: (typed: Matrix) => string | null;
  okText: string;
}

/** Lo escrito, si todas las celdas se leen. */
const typedMatrix = (grid: string[][]): Matrix | null => {
  const g = parseGrid(grid);
  return g.every((r) => r.every((x) => x !== null)) ? (g as Matrix) : null;
};

/** Los pasos uno detrás de otro: el siguiente aparece cuando el anterior está bien. Otro ejercicio, otra instancia (key). */
export function StepsPractice({ steps, onSolved }: { steps: readonly MatrixStep[]; onSolved: () => void }) {
  const [current, setState] = useState(() => ({ done: 0, grids: steps.map((s) => blankGrid(s.expected.length, s.expected[0]!.length)), checked: steps.map(() => false) }));
  const { done, grids, checked } = current;
  const visible = steps.slice(0, Math.min(done + 1, steps.length));
  return (
    <PracticeBox title="Comprueba tu respuesta">
      <p className="text-[14px] text-muted">{`Escribe cada resultado y pulsa «Comprobar paso». ${HOW_TO_WRITE_NUMBERS}`}</p>
      <ol className="flex flex-col gap-4">
        {visible.map((s, k) => {
          const wrong = new Set(wrongCells(s.expected, parseGrid(grids[k]!)).map(([i, j]) => cellKey(i, j)));
          const right = wrong.size === 0;
          const typed = typedMatrix(grids[k]!);
          const note = checked[k] && !right && typed && s.diagnose ? s.diagnose(typed) : null;
          return (
            <li key={k} className="flex flex-col gap-2">
              <h3 className="font-semibold">{`Paso ${k + 1}. ${s.title}`}</h3>
              {s.columns ? <p className="text-[14px] text-muted">{`Columnas: ${s.columns.map((c, j) => `${j + 1} = ${c}`).join(", ")}.`}</p> : null}
              <MatrixGrid
                name={s.name}
                values={grids[k]!}
                disabled={k < done}
                flagged={checked[k] ? wrong : undefined}
                onChange={(g) =>
                  setState({ ...current, grids: grids.map((x, i) => (i === k ? g : x)), checked: checked.map((c, i) => (i === k ? false : c)) })
                }
              />
              {k < done ? (
                <Status>
                  <Verdict tone="ok">
                    <Check size={16} aria-hidden="true" />
                    {s.okText}
                  </Verdict>
                </Status>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setState({ ...current, checked: checked.map((c, i) => (i === k ? true : c)), done: right ? k + 1 : done });
                        if (right && k === steps.length - 1) onSolved();
                      }}
                    >
                      <Check size={16} aria-hidden="true" />
                      Comprobar paso
                    </Button>
                    <Hints hints={s.hints} />
                  </div>
                  {checked[k] && !right ? (
                    <Status>
                      <Verdict tone="warn">{`${plural(wrong.size, "celda no coincide", "celdas no coinciden")}: están marcadas (las vacías también cuentan).`}</Verdict>
                      {note ? <span>{note}</span> : null}
                    </Status>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ol>
      {done >= steps.length ? (
        <Status>
          <Verdict tone="ok">
            <Check size={16} aria-hidden="true" />
            ¡Ejercicio resuelto! Todos los pasos son correctos.
          </Verdict>
        </Status>
      ) : null}
    </PracticeBox>
  );
}

/** «Tu vector suma 9/10, no 1» o «suma 1, pero π·P ≠ π en …»: solo sobre lo escrito. */
const sumNote = (v: readonly Frac[]): string | null => {
  const s = sum(v);
  return equals(s, ONE) ? null : `Tu vector suma ${formatDecimal(s, 4).text}, no 1: una distribución siempre suma 1.`;
};

// ---------------------------------------------------------------- Evolución

export const EVOLUTION_HINTS = [
  "Cada paso es un producto de vector fila por matriz: vₖ = vₖ₋₁ · P.",
  "La componente j de vₖ es la suma, para cada estado i, de vₖ₋₁(i) · pᵢⱼ: recorre la columna j de P.",
  "Comprueba que el vector suma 1 antes de pasar al siguiente paso.",
] as const;

function EvolutionExercise({ instance, onSolved }: ExerciseViewProps<MarkovEvolutionInstance>) {
  const names = useMemo(() => storyStates(instance.story, instance.P.length), [instance]);
  const vs = useMemo(() => evolutionVectors(instance), [instance]);
  const steps = useMemo(
    (): MatrixStep[] =>
      vs.slice(1).map((v, i) => ({
        title: `v${sub(i + 1)} = v${sub(i)} · P`,
        name: `v${sub(i + 1)}`,
        expected: [v],
        columns: names,
        hints: EVOLUTION_HINTS,
        diagnose: (t) => sumNote(t[0]!),
        okText: `Bien: ese es v${sub(i + 1)}.`,
      })),
    [vs, names],
  );
  const key = JSON.stringify(instance);
  return (
    <>
      <Statement blocks={evolutionStem(instance)} ask={`Calcula paso a paso v₁, …, v${sub(instance.n)} = v₀ · P${instance.n === 2 ? "²" : "³"}.`} />
      <StepsPractice steps={steps} onSolved={onSolved} />
      <Solution blocks={evolutionSolution(instance)} resetKey={key} />
    </>
  );
}

// ---------------------------------------------------------------- Estacionaria

export const STATIONARY_HINTS = [
  "π es un vector fila que no cambia al dar un paso: π · P = π.",
  "Escribe una ecuación por estado, πⱼ = Σᵢ πᵢ · pᵢⱼ (la columna j de P), y cambia una de ellas por π₁ + π₂ + … = 1.",
  "Resuélvelo por sustitución o por Gauss. Al final, todas las componentes deben ser ≥ 0 y sumar 1.",
] as const;

function StationaryExercise({ instance, onSolved }: ExerciseViewProps<MarkovStationaryInstance>) {
  const names = useMemo(() => storyStates(instance.story, instance.P.length), [instance]);
  const P = useMemo(() => qMat(instance.P), [instance]);
  const pi = useMemo(() => stationaryOf(instance), [instance]);
  const steps = useMemo(
    (): MatrixStep[] => [
      {
        title: "Distribución estacionaria π",
        name: "π",
        expected: [pi],
        columns: names,
        hints: STATIONARY_HINTS,
        diagnose: (t) => {
          const v = t[0]!;
          const s = sumNote(v);
          if (s) return s;
          const back = vecMul(v, P);
          const moved = back.flatMap((x, j) => (equals(x, v[j]!) ? [] : [names[j]!]));
          return moved.length > 0 ? `Tu vector suma 1, pero al multiplicarlo por P cambia en ${moved.join(", ")}: no es estacionario.` : null;
        },
        okText: "Bien: π · P = π y suma 1.",
      },
    ],
    [pi, names, P],
  );
  const key = JSON.stringify(instance);
  return (
    <>
      <Statement blocks={stationaryStem(instance)} ask="Calcula la distribución estacionaria π (π · P = π, con π₁ + π₂ + … = 1)." />
      <StepsPractice steps={steps} onSolved={onSolved} />
      <Solution blocks={stationarySolution(instance)} resetKey={key} />
    </>
  );
}

// ---------------------------------------------------------------- Clasificación

export const CLASSIFY_HINTS = [
  "Sigue las entradas positivas de P: desde el estado i se puede ir a j si pᵢⱼ > 0 (y, encadenando, en varios pasos).",
  "Agrupa en clases los estados que se alcanzan mutuamente. Una clase es cerrada si desde ella no se sale.",
  "Estados de una clase cerrada: recurrentes; si la clase es un solo estado con pᵢᵢ = 1, absorbente. Los demás, transitorios.",
] as const;

const KINDS: readonly StateKind[] = ["absorbente", "recurrente", "transitorio"];

function ClassifyExercise({ instance, onSolved }: ExerciseViewProps<MarkovClassifyInstance>) {
  const id = useId();
  const truth = useMemo(() => classifyOf(instance).kind, [instance]);
  const key = JSON.stringify(instance);
  const [current, setState] = useState<{ picks: Array<StateKind | "">; checked: boolean }>({ picks: truth.map(() => ""), checked: false });
  const wrong = current.picks.flatMap((p, i) => (p !== truth[i] ? [i] : []));
  return (
    <>
      <Statement blocks={classifyStem(instance)} ask="Clasifica cada estado: absorbente, recurrente (no absorbente) o transitorio." />
      <PracticeBox title="Comprueba tu respuesta">
        <div className="flex flex-col gap-2">
          {truth.map((_, i) => {
            const bad = current.checked && wrong.includes(i);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`${id}-${i}`} className="w-24 text-[14px] font-semibold">{`Estado ${i + 1}`}</label>
                <select
                  id={`${id}-${i}`}
                  className={cn(selectClass, "font-body", bad && "border-2 border-crit")}
                  aria-invalid={bad ? true : undefined}
                  value={current.picks[i]}
                  onChange={(e) => setState({ ...current, checked: false, picks: current.picks.map((p, k) => (k === i ? (e.target.value as StateKind | "") : p)) })}
                >
                  <option value="">Elige…</option>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {STATE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setState({ ...current, checked: true });
              if (wrong.length === 0) onSolved();
            }}
          >
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Hints hints={CLASSIFY_HINTS} />
        </div>
        {current.checked ? (
          <Status>
            {wrong.length === 0 ? (
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                ¡Correcto! Todos los estados están bien clasificados.
              </Verdict>
            ) : (
              <Verdict tone="warn">{`${plural(truth.length - wrong.length, "estado bien", "estados bien")} de ${truth.length}. Los marcados no coinciden (los que no has elegido también cuentan).`}</Verdict>
            )}
          </Status>
        ) : null}
      </PracticeBox>
      <Solution blocks={classifySolution(instance)} resetKey={key} />
    </>
  );
}

// ---------------------------------------------------------------- Absorción

export const ABSORPTION_HINTS = {
  iq: ["Q es el bloque de P de transitorio a transitorio (arriba a la izquierda).", "I − Q: resta a la identidad cada entrada de Q (en la diagonal, 1 − qᵢᵢ; fuera, −qᵢⱼ)."],
  n: ["N = (I − Q)⁻¹. En 1×1 es 1 entre el número; en 2×2, la adjunta traspuesta entre el determinante; si no, Gauss-Jordan sobre (I − Q | I).", "Comprueba que (I − Q) · N = I."],
  b: ["R es el bloque de P de transitorio a absorbente (arriba a la derecha).", "B = N · R: fila de N por columna de R. Cada fila de B suma 1."],
  t: ["t = N · 1: suma cada fila de N.", "Es el número medio de pasos hasta caer en un absorbente."],
} as const;

function AbsorptionExercise({ instance, onSolved }: ExerciseViewProps<MarkovAbsorptionInstance>) {
  const a = useMemo(() => absorptionOf(instance), [instance]);
  const s = useMemo(() => absorptionStates(instance), [instance]);
  const steps = useMemo((): MatrixStep[] => {
    const out: MatrixStep[] = [
      { title: "I − Q", name: "I − Q", expected: a.IminusQ, columns: s.transient, hints: ABSORPTION_HINTS.iq, okText: "Bien: esa es I − Q." },
      { title: "Matriz fundamental N = (I − Q)⁻¹", name: "N", expected: a.N, columns: s.transient, hints: ABSORPTION_HINTS.n, okText: "Bien: esa es N." },
      {
        title: "Probabilidades de absorción B = N · R",
        name: "B",
        expected: a.B,
        columns: s.absorbing,
        hints: ABSORPTION_HINTS.b,
        diagnose: (t) => (t.some((row) => !equals(sum(row), ONE)) ? "Alguna fila de tu B no suma 1: desde cada transitorio se acaba seguro en algún absorbente." : null),
        okText: "Bien: esa es B.",
      },
    ];
    if (instance.askSteps) out.push({ title: "Pasos esperados t = N · 1", name: "t", expected: a.t.map((x) => [x]), hints: ABSORPTION_HINTS.t, okText: "Bien: ese es t." });
    return out;
  }, [a, s, instance.askSteps]);
  const key = JSON.stringify(instance);
  const ask = `Calcula I − Q, N = (I − Q)⁻¹ y B = N · R${instance.askSteps ? ", y t = N · 1" : ""}. ¿Qué probabilidad hay de acabar en «${s.absorbing[instance.target]}» empezando en «${s.transient[instance.start]}»?`;
  return (
    <>
      <Statement blocks={absorptionStem(instance)} ask={ask} />
      <StepsPractice steps={steps} onSolved={onSolved} />
      <Solution blocks={absorptionSolution(instance)} resetKey={key} />
    </>
  );
}

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

/** Con key: otra instancia vuelve a empezar la práctica desde cero. */
const keyed =
  <I,>(View: ComponentType<ExerciseViewProps<I>>) =>
  (p: ExerciseViewProps<I>) => <View key={JSON.stringify(p.instance)} {...p} />;

export const MARKOV_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(MARKOV_EVOLUTION, keyed(EvolutionExercise)),
  entry(MARKOV_STATIONARY, keyed(StationaryExercise)),
  entry(MARKOV_CLASSIFY, keyed(ClassifyExercise)),
  entry(MARKOV_ABSORPTION, keyed(AbsorptionExercise)),
];
