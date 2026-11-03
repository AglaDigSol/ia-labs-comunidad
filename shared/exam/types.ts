// Preguntas del simulacro de examen (02MIAR): un ExamItem es una pregunta lista para el examen, con su
// enunciado (texto y TeX), la forma de contestar (opción múltiple a)–d) o respuesta numérica), la
// corrección y la solución razonada, que solo se enseña al entregar. Se montan a partir de una
// instancia del banco de ejercicios (shared/exercises) con los adaptadores de shared/exam/adapters:
// las respuestas las siguen calculando los motores, nunca están escritas a mano.
//
// Las respuestas se guardan como texto: en opción múltiple, los ids de las opciones elegidas separados
// por «|» (encodeChoiceAnswer); en numérica, lo que se ha escrito.
import type { ArrangedOption, ChoiceMode } from "../exercises/choice.ts";
import type { ExerciseLevel, ExerciseTopic } from "../exercises/types.ts";

/** Un trozo de una línea: texto o una fórmula (TeX escrito por el código, con su lectura). */
export type ExamInline = string | { tex: string; label: string };

/** Un bloque del enunciado o de la solución. */
export type ExamBlock =
  /** Párrafo: texto y fórmulas en línea. */
  | { kind: "p"; parts: ExamInline[]; strong?: boolean; muted?: boolean }
  /** Fórmula destacada (en su propia línea). */
  | { kind: "math"; tex: string; label: string }
  /** Lista de puntos. */
  | { kind: "list"; items: ExamInline[][] }
  /** Pseudocódigo (líneas con su sangría). */
  | { kind: "code"; lines: string[]; label: string };

/**
 * Formato de una respuesta numérica, como en Blackboard:
 * - «entero»: un número entero exacto, sin separador de miles;
 * - «exacto»: el valor exacto (decimal finito con coma, o entero);
 * - «dos-decimales»: redondeado a dos decimales con coma (vale también el valor exacto).
 */
export type ExamNumericFormat = "entero" | "exacto" | "dos-decimales";

interface ExamItemBase {
  /** «tipo:nivel:semilla», único dentro de un simulacro. */
  id: string;
  /** Tipo del banco de ejercicios del que sale. */
  typeId: string;
  /** Tema del banco (pestaña de los laboratorios). */
  topic: ExerciseTopic;
  level: ExerciseLevel;
  /** Semilla con la que se ha generado (la de «Practicar este tipo»). */
  seed: number;
  /** Título del tipo de ejercicio. */
  title: string;
  /** Enunciado (sin la pregunta final). */
  stem: ExamBlock[];
  /** La pregunta (la leyenda de las opciones o la etiqueta del campo). */
  prompt: string;
  /** Solución razonada (solo tras entregar). */
  solution: ExamBlock[];
  /** Respuesta correcta, en texto: «b) …» o «0,35». */
  correctText: string;
  /** ¿Es correcta la respuesta guardada? (Vacía o ilegible: no.) */
  grade(answer: string | null): boolean;
  /** Parámetros del banco de ejercicios: «?t=…&n=…&s=…». */
  practiceLink: string;
}

export interface ExamChoiceItem extends ExamItemBase {
  kind: "choice";
  /** «single»: una correcta (lo normal); «multi»: «selecciona la o las correctas». */
  mode: ChoiceMode;
  /** Opciones ya barajadas, con su letra. */
  options: ArrangedOption[];
}

export interface ExamNumericItem extends ExamItemBase {
  kind: "numeric";
  format: ExamNumericFormat;
  /** Etiqueta del campo: «Resultado», «P(C)»… */
  label: string;
  /** Indicación de formato que va con el campo. */
  formatNote: string;
}

export type ExamItem = ExamChoiceItem | ExamNumericItem;

export const CHOICE_SEPARATOR = "|";

/** Respuesta de opción múltiple como texto. */
export const encodeChoiceAnswer = (ids: readonly string[]): string => ids.join(CHOICE_SEPARATOR);
/** Los ids de una respuesta de opción múltiple. */
export const decodeChoiceAnswer = (answer: string | null): string[] =>
  answer === null || answer === "" ? [] : answer.split(CHOICE_SEPARATOR).filter((x) => x !== "");

/** ¿Hay algo contestado? */
export function isAnswered(item: Pick<ExamItem, "kind">, answer: string | null | undefined): boolean {
  if (answer === null || answer === undefined) return false;
  return item.kind === "choice" ? decodeChoiceAnswer(answer).length > 0 : answer.trim() !== "";
}
