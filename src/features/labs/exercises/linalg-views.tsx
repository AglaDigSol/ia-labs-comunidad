// Vistas del banco de ejercicios para el tema «Álgebra lineal»: el enunciado de cada instancia y la
// práctica del laboratorio (src/features/labs/linalg). Van en su propio fichero y views.tsx solo las
// añade a EXERCISE_VIEWS.
import { useMemo, type ComponentType, type ReactNode } from "react";
import {
  LINALG_DETERMINANT,
  LINALG_EIGEN,
  LINALG_GAUSS,
  LINALG_INDEPENDENCE,
  LINALG_INVERSE,
  LINALG_PRODUCT,
  LINALG_SYSTEMS,
  LINALG_TENSORS,
  LINALG_DET_RULES,
  LINALG_NORMS,
  LINALG_ROUCHE_CHOICE,
  LINALG_TENSOR_VOCAB,
  LINALG_THEORY,
  type LinSystemInstance,
  type MatrixInstance,
  type ProductInstance,
  type TensorShapeInstance,
  type VectorsInstance,
} from "../../../../shared/exercises/linalg.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { intMatrix } from "../../../../shared/linalg/matrix.ts";
import { analyzeSystem, splitAugmented } from "../../../../shared/linalg/systems.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { MatrixView } from "../linalg/common.tsx";
import { EigenPractice } from "../linalg/EigenPractice.tsx";
import { GaussPractice } from "../linalg/GaussPractice.tsx";
import { IndependencePractice } from "../linalg/IndependencePractice.tsx";
import { DeterminantPractice, InversePractice, ProductPractice } from "../linalg/OperationsPractice.tsx";
import { equationsLabel, equationsTex, SystemAnswer, SystemSolution } from "../linalg/SystemAnswer.tsx";
import { ShapePractice } from "../linalg/TensorPractice.tsx";
import { DetRulesPractice, MatrixTheoryPractice, NormsPractice, RoucheChoicePractice, TensorVocabPractice } from "../linalg/TheoryPractice.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

function Statement({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">{children}</div>;
}

function useSystem(instance: LinSystemInstance) {
  return useMemo(() => {
    const M = intMatrix(instance.matrix);
    return { M, ...splitAugmented(M) };
  }, [instance.matrix]);
}

function GaussExercise({ instance, onSolved }: ExerciseViewProps<LinSystemInstance>) {
  const { M, A, b } = useSystem(instance);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          Resuelve el sistema por Gauss-Jordan: lleva su matriz ampliada a la forma escalonada reducida, una operación elemental en cada paso;
          después clasifícalo y escribe su solución.
        </p>
        <Tex display tex={equationsTex(A, b)} label={`Sistema: ${equationsLabel(A, b)}`} className="text-[18px]" />
      </Statement>
      <GaussPractice start={M} unknowns={instance.unknowns} onSolved={onSolved} />
    </>
  );
}

function SystemsExercise({ instance, onSolved }: ExerciseViewProps<LinSystemInstance>) {
  const { M, A, b } = useSystem(instance);
  const analysis = useMemo(() => analyzeSystem(A, b), [A, b]);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">
          Calcula rg A y rg (A|b), clasifica el sistema con el teorema de Rouché–Frobenius y, si es compatible, escribe su solución.
        </p>
        <Tex display tex={equationsTex(A, b)} label={`Sistema: ${equationsLabel(A, b)}`} className="text-[18px]" />
        <MatrixView M={M} bar={instance.unknowns} label="Matriz ampliada (A | b)" />
      </Statement>
      <SystemAnswer A={A} b={b} askRanks onSolved={onSolved} />
      <SolutionGate resetKey={JSON.stringify(instance.matrix)}>
        <div className="rounded-lg border border-border bg-raised p-3">
          <SystemSolution analysis={analysis} />
        </div>
      </SolutionGate>
    </>
  );
}

const DeterminantExercise = ({ instance, onSolved }: ExerciseViewProps<MatrixInstance>) => {
  const a = useMemo(() => intMatrix(instance.matrix), [instance.matrix]);
  return <DeterminantPractice a={a} onSolved={onSolved} />;
};

const ProductExercise = ({ instance, onSolved }: ExerciseViewProps<ProductInstance>) => {
  const [a, b] = useMemo(() => [intMatrix(instance.a), intMatrix(instance.b)], [instance.a, instance.b]);
  return <ProductPractice a={a} b={b} onSolved={onSolved} />;
};

const InverseExercise = ({ instance, onSolved }: ExerciseViewProps<MatrixInstance>) => {
  const a = useMemo(() => intMatrix(instance.matrix), [instance.matrix]);
  return <InversePractice a={a} onSolved={onSolved} />;
};

const IndependenceExercise = ({ instance, onSolved }: ExerciseViewProps<VectorsInstance>) => {
  const vectors = useMemo(() => intMatrix(instance.vectors), [instance.vectors]);
  return <IndependencePractice vectors={vectors} onSolved={onSolved} />;
};

const EigenExercise = ({ instance, onSolved }: ExerciseViewProps<MatrixInstance>) => {
  const a = useMemo(() => intMatrix(instance.matrix), [instance.matrix]);
  return <EigenPractice a={a} onSolved={onSolved} />;
};

const TensorExercise = ({ instance, onSolved }: ExerciseViewProps<TensorShapeInstance>) => <ShapePractice q={instance.q} onSolved={onSolved} />;

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const LINALG_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(LINALG_GAUSS, GaussExercise),
  entry(LINALG_DETERMINANT, DeterminantExercise),
  entry(LINALG_PRODUCT, ProductExercise),
  entry(LINALG_INVERSE, InverseExercise),
  entry(LINALG_SYSTEMS, SystemsExercise),
  entry(LINALG_INDEPENDENCE, IndependenceExercise),
  entry(LINALG_EIGEN, EigenExercise),
  entry(LINALG_TENSORS, TensorExercise),
  // Teoría (tipo examen): la práctica ya trae el enunciado completo.
  entry(LINALG_DET_RULES, DetRulesPractice),
  entry(LINALG_THEORY, MatrixTheoryPractice),
  entry(LINALG_NORMS, NormsPractice),
  entry(LINALG_TENSOR_VOCAB, TensorVocabPractice),
  entry(LINALG_ROUCHE_CHOICE, RoucheChoicePractice),
];
