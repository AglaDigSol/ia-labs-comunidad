// Vistas del banco de ejercicios para el tema «Combinatoria y complejidad»: el enunciado de cada
// instancia y la práctica del laboratorio (src/features/labs/combinatorics). Van en su propio fichero
// y views.tsx solo las añade a EXERCISE_VIEWS.
import type { ComponentType } from "react";
import {
  COMB_COMPLEXITY,
  COMB_FUNCTIONS,
  COMB_MODEL,
  COMB_PNP,
  COMB_PROBLEM,
  type CombComplexityInstance,
  type CombFunctionsInstance,
  type CombModelInstance,
  type CombPnpInstance,
  type CombProblemInstance,
} from "../../../../shared/exercises/discrete.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { Statement } from "../combinatorics/common.tsx";
import { ComplexityPractice, PnpPractice } from "../combinatorics/ComplexityPractice.tsx";
import { CountingPractice } from "../combinatorics/CountingPractice.tsx";
import { FunctionsPractice } from "../combinatorics/FunctionsPractice.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

const Story = ({ children }: { children: string }) => (
  <Statement>
    <p className="text-[16px]">{children}</p>
  </Statement>
);

function ProblemExercise({ instance, onSolved }: ExerciseViewProps<CombProblemInstance>) {
  return (
    <>
      <Story>{instance.text}</Story>
      <CountingPractice key={instance.text} problem={instance} ask="number" onSolved={onSolved} />
    </>
  );
}

function ModelExercise({ instance, onSolved }: ExerciseViewProps<CombModelInstance>) {
  const problem = { text: instance.text, terms: [{ sign: 1 as const, model: instance.model }] };
  return (
    <>
      <Story>{instance.text}</Story>
      <CountingPractice key={instance.text} problem={problem} ask="model" options={instance.options} onSolved={onSolved} />
    </>
  );
}

function FunctionsExercise({ instance, onSolved }: ExerciseViewProps<CombFunctionsInstance>) {
  return <FunctionsPractice key={JSON.stringify(instance)} setting={instance} statements={instance.statements} multi={instance.multi} onSolved={onSolved} />;
}

function ComplexityExercise({ instance, onSolved }: ExerciseViewProps<CombComplexityInstance>) {
  return <ComplexityPractice key={JSON.stringify(instance)} problem={instance} options={instance.options} onSolved={onSolved} />;
}

function PnpExercise({ instance, onSolved }: ExerciseViewProps<CombPnpInstance>) {
  return <PnpPractice key={instance.ids.join("|")} ids={instance.ids} onSolved={onSolved} />;
}

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const DISCRETE_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(COMB_PROBLEM, ProblemExercise),
  entry(COMB_MODEL, ModelExercise),
  entry(COMB_FUNCTIONS, FunctionsExercise),
  entry(COMB_COMPLEXITY, ComplexityExercise),
  entry(COMB_PNP, PnpExercise),
];
