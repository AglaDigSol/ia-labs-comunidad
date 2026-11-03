// Vistas del banco de ejercicios para el tema «Cálculo»: el enunciado de cada instancia y la práctica
// del laboratorio (src/features/labs/calculus). Van en su propio fichero y views.tsx solo las añade a
// EXERCISE_VIEWS.
import { useMemo, type ComponentType } from "react";
import {
  CALC_ANTIDERIVATIVE,
  CALC_CRITICAL,
  CALC_DEFINITE,
  CALC_DERIVATIVE,
  CALC_DESCENT,
  CALC_GRADIENT,
  CALC_TANGENT,
  CALC_BASIN,
  CALC_BISECTION,
  CALC_CHAIN,
  CALC_CRITICAL_CHOICE,
  CALC_DOMAIN,
  CALC_LHOPITAL,
  CALC_PARTS,
  CALC_PIECEWISE,
  calcExpr,
  type CalcDescentInstance,
  type CalcFnInstance,
  type CalcGradientInstance,
  type CalcIntegralInstance,
  type CalcTangentInstance,
} from "../../../../shared/exercises/calculus.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { Statement } from "../calculus/common.tsx";
import { DerivativePractice } from "../calculus/DerivativePractice.tsx";
import { DescentStepPractice } from "../calculus/DescentSection.tsx";
import { AntiderivativePractice, DefiniteIntegralPractice } from "../calculus/IntegralPractice.tsx";
import { CriticalPractice, GradientPractice } from "../calculus/MultivarPractice.tsx";
import { TangentPractice } from "../calculus/TangentPractice.tsx";
import {
  BasinPractice,
  BisectionPractice,
  ChainPractice,
  CriticalChoicePractice,
  DomainPractice,
  LhopitalPractice,
  PartsPractice,
  PiecewisePractice,
} from "../calculus/TheoryPractice.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

const Lead = ({ children }: { children: string }) => (
  <Statement>
    <p className="text-[14px] text-muted">{children}</p>
  </Statement>
);

function DerivativeExercise({ instance, onSolved }: ExerciseViewProps<CalcFnInstance>) {
  const f = useMemo(() => calcExpr(instance.f), [instance.f]);
  return (
    <>
      <Lead>Deriva f paso a paso: en cada línea aplica una regla y elígela en la lista. Si prefieres, escribe solo el resultado.</Lead>
      <DerivativePractice f={f} onSolved={onSolved} />
    </>
  );
}

function TangentExercise({ instance, onSolved }: ExerciseViewProps<CalcTangentInstance>) {
  const f = useMemo(() => calcExpr(instance.f), [instance.f]);
  return (
    <>
      <Lead>Calcula f(x₀), la pendiente f′(x₀) y la ecuación de la recta tangente en x₀.</Lead>
      <TangentPractice f={f} x0={instance.x0} onSolved={onSolved} />
    </>
  );
}

function AntiderivativeExercise({ instance, onSolved }: ExerciseViewProps<CalcFnInstance>) {
  const f = useMemo(() => calcExpr(instance.f), [instance.f]);
  return (
    <>
      <Lead>Escribe una primitiva de f. Se comprueba derivándola: vale cualquier forma equivalente, con + C o sin ella.</Lead>
      <AntiderivativePractice f={f} onSolved={onSolved} />
    </>
  );
}

function DefiniteExercise({ instance, onSolved }: ExerciseViewProps<CalcIntegralInstance>) {
  const f = useMemo(() => calcExpr(instance.f), [instance.f]);
  return (
    <>
      <Lead>Calcula la integral definida con la regla de Barrow: busca una primitiva y réstala entre los dos límites.</Lead>
      <DefiniteIntegralPractice f={f} a={instance.a} b={instance.b} onSolved={onSolved} />
    </>
  );
}

function GradientExercise({ instance, onSolved }: ExerciseViewProps<CalcGradientInstance>) {
  const f = useMemo(() => calcExpr(instance.f, ["x", "y"]), [instance.f]);
  return (
    <>
      <Lead>Calcula las dos derivadas parciales y el gradiente en el punto P.</Lead>
      <GradientPractice f={f} point={instance.point} onSolved={onSolved} />
    </>
  );
}

function CriticalExercise({ instance, onSolved }: ExerciseViewProps<CalcFnInstance>) {
  const f = useMemo(() => calcExpr(instance.f, ["x", "y"]), [instance.f]);
  return (
    <>
      <Lead>Encuentra todos los puntos críticos (∇f = 0) y clasifica cada uno con la hessiana.</Lead>
      <CriticalPractice f={f} x={[-5, 5]} y={[-5, 5]} onSolved={onSolved} />
    </>
  );
}

function DescentExercise({ instance, onSolved }: ExerciseViewProps<CalcDescentInstance>) {
  return (
    <>
      <Lead>Haz a mano los dos primeros pasos del descenso de gradiente desde el punto de partida, con la α dada.</Lead>
      <DescentStepPractice instance={instance} onSolved={onSolved} />
    </>
  );
}

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const CALC_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(CALC_DERIVATIVE, DerivativeExercise),
  entry(CALC_TANGENT, TangentExercise),
  entry(CALC_ANTIDERIVATIVE, AntiderivativeExercise),
  entry(CALC_DEFINITE, DefiniteExercise),
  entry(CALC_GRADIENT, GradientExercise),
  entry(CALC_CRITICAL, CriticalExercise),
  entry(CALC_DESCENT, DescentExercise),
  // Teoría (tipo examen): la práctica ya trae el enunciado completo.
  entry(CALC_PIECEWISE, PiecewisePractice),
  entry(CALC_LHOPITAL, LhopitalPractice),
  entry(CALC_DOMAIN, DomainPractice),
  entry(CALC_BISECTION, BisectionPractice),
  entry(CALC_CHAIN, ChainPractice),
  entry(CALC_BASIN, BasinPractice),
  entry(CALC_CRITICAL_CHOICE, CriticalChoicePractice),
  entry(CALC_PARTS, PartsPractice),
];
