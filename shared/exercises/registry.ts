// Registro del banco de ejercicios: todos los tipos, en el orden en que se muestran (por tema, en el
// orden de las pestañas). Para añadir un tipo: créalo en el módulo de su tema (logic.ts, sets.ts…),
// añádelo a su lista y, en la página, dale una vista (src/features/labs/exercises/views.tsx).
import { BOOLE_EXERCISES } from "./boole.ts";
import { LOGIC_EXERCISES } from "./logic.ts";
import { PREDICATE_EXERCISES } from "./predicates.ts";
import { createRng, randomSeed } from "./random.ts";
import { SET_EXERCISES } from "./sets.ts";
import { EXERCISE_TOPICS, type ExerciseLevel, type ExerciseTopic, type ExerciseType } from "./types.ts";

export type AnyExerciseType = ExerciseType<unknown>;

export const EXERCISE_TYPES: readonly AnyExerciseType[] = [
  ...LOGIC_EXERCISES,
  ...PREDICATE_EXERCISES,
  ...SET_EXERCISES,
  ...BOOLE_EXERCISES,
];

const BY_ID = new Map(EXERCISE_TYPES.map((t) => [t.id, t]));

export const exerciseType = (id: string | null): AnyExerciseType | null => (id === null ? null : (BY_ID.get(id) ?? null));

export const exercisesOfTopic = (topic: ExerciseTopic): AnyExerciseType[] => EXERCISE_TYPES.filter((t) => t.topic === topic);

/** Temas que tienen algún ejercicio, en orden. */
export const exerciseTopics = () => EXERCISE_TOPICS.filter((t) => EXERCISE_TYPES.some((x) => x.topic === t.id));

/** «Mezclar»: un tipo del tema al azar (determinista con la semilla) que tenga ese nivel. */
export function mixedType(topic: ExerciseTopic, level: ExerciseLevel, seed: number = randomSeed()): AnyExerciseType {
  const list = exercisesOfTopic(topic).filter((t) => t.levels.includes(level));
  return createRng(seed).pick(list);
}
