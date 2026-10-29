// Tipos del banco de ejercicios: un tipo de ejercicio sabe generar, a partir de una semilla y un
// nivel, una instancia resoluble. Las instancias solo llevan el enunciado (la fórmula, la función,
// el dominio…); la corrección la hacen los motores de shared/ al resolver, nunca respuestas escritas
// a mano.

export const EXERCISE_LEVELS = ["básico", "medio", "avanzado"] as const;
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number];

/** Nivel en la URL (?n=), sin tildes. */
export const LEVEL_SLUGS: Record<ExerciseLevel, string> = { básico: "basico", medio: "medio", avanzado: "avanzado" };

export function levelFromSlug(slug: string | null): ExerciseLevel | null {
  return EXERCISE_LEVELS.find((l) => LEVEL_SLUGS[l] === slug) ?? null;
}

export const isExerciseLevel = (x: unknown): x is ExerciseLevel =>
  typeof x === "string" && (EXERCISE_LEVELS as readonly string[]).includes(x);

/** Temas, en el orden de las pestañas de los laboratorios. */
export const EXERCISE_TOPICS = [
  { id: "logica", label: "Lógica proposicional" },
  { id: "predicados", label: "Lógica de predicados" },
  { id: "conjuntos", label: "Conjuntos" },
  { id: "boole", label: "Álgebra de Boole" },
] as const;
export type ExerciseTopic = (typeof EXERCISE_TOPICS)[number]["id"];

export interface ExerciseType<I> {
  /** Identificador estable (va en la URL y en el progreso guardado): «logica-tabla». */
  id: string;
  topic: ExerciseTopic;
  title: string;
  description: string;
  levels: readonly ExerciseLevel[];
  /** Misma semilla y nivel ⇒ misma instancia. */
  generate(seed: number, level: ExerciseLevel): I;
}
