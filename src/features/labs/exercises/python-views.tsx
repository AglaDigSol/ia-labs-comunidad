// Vistas de los ejercicios de Python para EXERCISE_VIEWS. Son perezosas: su código (y el del worker
// de Pyodide) va en un chunk aparte que solo se descarga al abrir uno de estos ejercicios, y que ni
// siquiera se genera si el sitio se construye sin Python (__LABS_PYTHON__ = false, como en labs.tsx).
import { lazy, Suspense, type ComponentType } from "react";
import { PYTHON_EXERCISES, type PyInstance } from "../../../../shared/exercises/python.ts";
import type { ExerciseViewProps } from "./views.tsx";

declare const __LABS_PYTHON__: boolean | undefined;
const PythonExercise = (typeof __LABS_PYTHON__ === "boolean" ? __LABS_PYTHON__ : true)
  ? lazy(() => import("./python/PythonExercise.tsx").then((m) => ({ default: m.PythonExercise })))
  : null;

function PythonExerciseView(props: ExerciseViewProps<PyInstance>) {
  if (!PythonExercise) return null;
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[240px] animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />}>
      <PythonExercise {...props} />
    </Suspense>
  );
}

type View = ComponentType<ExerciseViewProps<unknown>>;

export const PYTHON_EXERCISE_VIEWS: Readonly<Record<string, View>> = PythonExercise
  ? Object.fromEntries(PYTHON_EXERCISES.map((t) => [t.id, PythonExerciseView as View]))
  : {};
