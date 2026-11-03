// Registro del banco de ejercicios: todos los tipos, en el orden en que se muestran (por tema, en el
// orden de las pestañas). Para añadir un tipo: créalo en el módulo de su tema (logic.ts, sets.ts…),
// añádelo a su lista y, en la página, dale una vista (src/features/labs/exercises/views.tsx).
// Los tipos de un módulo opcional (module: "python") solo existen si se pide ese módulo: sin él no
// aparecen en la lista, en «Mezclar» ni por su id en la URL.
import { BOOLE_EXERCISES } from "./boole.ts";
import { CALC_EXERCISES } from "./calculus.ts";
import { LINALG_EXERCISES } from "./linalg.ts";
import { LOGIC_EXERCISES } from "./logic.ts";
import { PREDICATE_EXERCISES } from "./predicates.ts";
import { PYTHON_EXERCISES } from "./python.ts";
import { createRng, randomSeed } from "./random.ts";
import { SET_EXERCISES } from "./sets.ts";
import { EXERCISE_TOPICS, type ExerciseLevel, type ExerciseModules, type ExerciseTopic, type ExerciseType } from "./types.ts";

export type AnyExerciseType = ExerciseType<unknown>;

// La app independiente construida sin Python (vite.config.ts define __LABS_PYTHON__ = false) deja
// fuera los ejercicios de Python y su código; en una app anfitriona no está definido y van siempre
// (solo se muestran con <LabsRoutes python />).
declare const __LABS_PYTHON__: boolean | undefined;
const WITH_PYTHON = typeof __LABS_PYTHON__ === "boolean" ? __LABS_PYTHON__ : true;

export const EXERCISE_TYPES: readonly AnyExerciseType[] = [
  ...LOGIC_EXERCISES,
  ...PREDICATE_EXERCISES,
  ...SET_EXERCISES,
  ...BOOLE_EXERCISES,
  ...LINALG_EXERCISES,
  ...CALC_EXERCISES,
  ...(WITH_PYTHON ? PYTHON_EXERCISES : []),
];

const BY_ID = new Map(EXERCISE_TYPES.map((t) => [t.id, t]));

/** ¿Está disponible el tipo con estos módulos encendidos? */
export const typeAvailable = (t: AnyExerciseType, modules: ExerciseModules = {}) => !t.module || modules[t.module] === true;

export const exerciseType = (id: string | null, modules: ExerciseModules = {}): AnyExerciseType | null => {
  const t = id === null ? undefined : BY_ID.get(id);
  return t && typeAvailable(t, modules) ? t : null;
};

export const exercisesOfTopic = (topic: ExerciseTopic, modules: ExerciseModules = {}): AnyExerciseType[] =>
  EXERCISE_TYPES.filter((t) => t.topic === topic && typeAvailable(t, modules));

/** Temas que tienen algún ejercicio, en orden. */
export const exerciseTopics = (modules: ExerciseModules = {}) =>
  EXERCISE_TOPICS.filter((t) => EXERCISE_TYPES.some((x) => x.topic === t.id && typeAvailable(x, modules)));

/** «Mezclar»: un tipo del tema al azar (determinista con la semilla) que tenga ese nivel. */
export function mixedType(topic: ExerciseTopic, level: ExerciseLevel, seed: number = randomSeed(), modules: ExerciseModules = {}): AnyExerciseType {
  const list = exercisesOfTopic(topic, modules).filter((t) => t.levels.includes(level));
  return createRng(seed).pick(list);
}
