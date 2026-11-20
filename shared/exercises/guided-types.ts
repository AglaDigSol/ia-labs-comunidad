// Tipos del banco que se practican con los pasos guiados (shared/exercises/guided.ts): para cada id, la
// función que monta el enunciado, los pasos y la solución de una instancia. La vista es una sola
// (src/features/labs/exercises/guided-views.tsx).
import { CALC_ABS_EXTREMES, extremesGuided } from "./calculus-extremes.ts";
import { choleskyGuided, LINALG_CHOLESKY, LINALG_LINEAR_MAP, LINALG_LU, LINALG_QR, LINALG_SVD, linearMapGuided, luGuided, qrGuided, svdGuided } from "./factorizations.ts";
import type { GuidedExercise } from "./guided.ts";
import { axesGuided, dataShapeGuided, overflowGuided, PY_DATA_SHAPE, PY_NUMPY_AXES, PY_OVERFLOW } from "./numpy-shapes.ts";
import { changeBasisGuided, coordsGuided, einsteinGuided, LINALG_CHANGE_BASIS, LINALG_COORDS, LINALG_EINSTEIN, LINALG_OUTER, outerGuided } from "./tensors.ts";
import type { ExerciseType } from "./types.ts";

export type GuidedType<I> = { type: ExerciseType<I>; guided: (inst: I) => GuidedExercise };
const g = <I,>(type: ExerciseType<I>, guided: (inst: I) => GuidedExercise): GuidedType<unknown> => ({ type, guided } as GuidedType<unknown>);

export const GUIDED_TYPES: readonly GuidedType<unknown>[] = [
  g(LINALG_EINSTEIN, einsteinGuided),
  g(LINALG_OUTER, outerGuided),
  g(LINALG_COORDS, coordsGuided),
  g(LINALG_CHANGE_BASIS, changeBasisGuided),
  g(LINALG_LU, luGuided),
  g(LINALG_CHOLESKY, choleskyGuided),
  g(LINALG_QR, qrGuided),
  g(LINALG_SVD, svdGuided),
  g(LINALG_LINEAR_MAP, linearMapGuided),
  g(CALC_ABS_EXTREMES, extremesGuided),
  g(PY_DATA_SHAPE, dataShapeGuided),
  g(PY_NUMPY_AXES, axesGuided),
  g(PY_OVERFLOW, overflowGuided),
];

const BY_ID = new Map(GUIDED_TYPES.map((t) => [t.type.id, t.guided]));

/** El ejercicio guiado de una instancia de un tipo guiado (null si el tipo no lo es). */
export const guidedExercise = (id: string, inst: unknown): GuidedExercise | null => BY_ID.get(id)?.(inst) ?? null;
