// Adaptadores: cómo convierte cada tipo del banco de ejercicios una instancia en una pregunta de
// examen. Un adaptador devuelve un borrador (enunciado, pregunta y, según el caso, la pregunta de
// opción múltiple del motor o el número esperado); examItem (items.ts) lo valida, baraja las opciones
// y le pone la corrección. Si una instancia no sirve (por ejemplo, «selecciona la o las correctas»
// cuando se pide una sola), el adaptador devuelve null y se prueba con otra semilla.
import type { ChoiceQuestion } from "../exercises/choice.ts";
import type { ExerciseLevel, ExerciseType } from "../exercises/types.ts";
import type { ExamExpected } from "./numeric.ts";
import type { ExamBlock, ExamNumericFormat } from "./types.ts";

export interface ExamChoiceDraft {
  kind: "choice";
  stem: ExamBlock[];
  prompt: string;
  question: ChoiceQuestion;
  /** Explicación general (además del porqué de cada opción). */
  solution?: ExamBlock[];
}

export interface ExamNumericDraft {
  kind: "numeric";
  stem: ExamBlock[];
  prompt: string;
  expected: ExamExpected;
  format: ExamNumericFormat;
  /** Etiqueta del campo (por defecto, «Respuesta»). */
  label?: string;
  solution?: ExamBlock[];
}

export type ExamDraft = ExamChoiceDraft | ExamNumericDraft;

export interface ExamAdapter<I = unknown> {
  type: ExerciseType<I>;
  /** Niveles que valen para el examen (por defecto, los del tipo). */
  levels?: readonly ExerciseLevel[];
  /** Qué se pregunta, en una línea (para la documentación y la lista de tipos). */
  ask: string;
  build(instance: I, level: ExerciseLevel): ExamDraft | null;
}

/** Ayuda de tipos: un adaptador de un tipo concreto como adaptador genérico. */
export const examAdapter = <I>(a: ExamAdapter<I>): ExamAdapter => a as unknown as ExamAdapter;
