// Preguntas de opción múltiple como las del examen: «opción única» (A–E, a menudo con «Ninguna de las
// otras») y «selecciona la o las correctas». Aquí solo hay datos y corrección, sin React: la vista
// (src/components/practice/ChoiceQuestion.tsx) y el futuro simulador de examen usan lo mismo.
//
// Las opciones se escriben en un orden fijo (el del generador) y se barajan con una semilla: la misma
// semilla da siempre el mismo orden y las mismas letras. «Ninguna de las otras» va siempre la última
// y es correcta exactamente cuando no lo es ninguna de las demás.
import { createRng } from "./random.ts";

/** Opción única (radio) o varias correctas (casillas). */
export type ChoiceMode = "single" | "multi";

export interface ChoiceOption {
  /** Identificador estable dentro de la pregunta (no se enseña). */
  id: string;
  /** Texto de la opción; también es su lectura para lectores de pantalla si lleva `tex`. */
  text: string;
  /** Escritura en KaTeX (escrita por el código, nunca por la persona). */
  tex?: string;
  /** ¿Es una respuesta correcta? */
  correct: boolean;
  /** Por qué es (o no es) correcta: se enseña en la solución. */
  why?: string;
}

export interface ChoiceQuestion {
  mode: ChoiceMode;
  options: ChoiceOption[];
  /** Añade «Ninguna de las otras» al final (correcta si no lo es ninguna de las demás). */
  noneOfOthers?: boolean;
}

export const NONE_ID = "ninguna";
export const NONE_TEXT = "Ninguna de las otras";
export const LETTERS = "ABCDEFGH";

export interface ArrangedOption extends ChoiceOption {
  /** «A», «B»… según el orden barajado. */
  letter: string;
}

/** Semilla a partir de un texto (FNV-1a de 32 bits), para barajar según la instancia. */
export function seedFromKey(key: string | number): number {
  if (typeof key === "number") return key >>> 0;
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Las opciones barajadas con la semilla, con su letra, y «Ninguna de las otras» al final si se pide.
 * Lanza un error si la pregunta está mal hecha (ids repetidos, demasiadas opciones o, en opción
 * única, un número de correctas distinto de uno): los generadores se validan con tests.
 */
export function arrangeChoices(q: ChoiceQuestion, key: string | number): ArrangedOption[] {
  const ids = new Set(q.options.map((o) => o.id));
  if (ids.size !== q.options.length || ids.has(NONE_ID)) throw new Error("arrangeChoices: ids repetidos o reservados");
  const shuffled = createRng(seedFromKey(key)).shuffle(q.options);
  const anyCorrect = q.options.some((o) => o.correct);
  const all: ChoiceOption[] = q.noneOfOthers ? [...shuffled, { id: NONE_ID, text: NONE_TEXT, correct: !anyCorrect }] : shuffled;
  if (all.length < 2 || all.length > LETTERS.length) throw new Error("arrangeChoices: entre 2 y 8 opciones");
  if (q.mode === "single" && all.filter((o) => o.correct).length !== 1) throw new Error("arrangeChoices: la opción única necesita exactamente una correcta");
  if (q.mode === "multi" && !all.some((o) => o.correct)) throw new Error("arrangeChoices: hace falta al menos una correcta");
  return all.map((o, i) => ({ ...o, letter: LETTERS[i]! }));
}

export interface ChoiceGrade {
  /** ¿Exactamente las correctas? */
  correct: boolean;
  /** Correctas marcadas. */
  hits: number;
  /** Incorrectas marcadas. */
  wrong: number;
  /** Correctas sin marcar. */
  missed: number;
}

/** Corrige una selección (ids). Lo que no es una opción se ignora. */
export function gradeChoice(options: readonly ChoiceOption[], selected: readonly string[]): ChoiceGrade {
  const chosen = new Set(selected);
  let hits = 0;
  let wrong = 0;
  let missed = 0;
  for (const o of options) {
    const on = chosen.has(o.id);
    if (on && o.correct) hits++;
    else if (on) wrong++;
    else if (o.correct) missed++;
  }
  return { correct: wrong === 0 && missed === 0, hits, wrong, missed };
}

/**
 * Cambia la selección al pulsar una opción: en opción única la sustituye; en varias correctas la
 * alterna, y «Ninguna de las otras» excluye a las demás (y al revés).
 */
export function toggleChoice(mode: ChoiceMode, selected: readonly string[], id: string): string[] {
  if (mode === "single") return [id];
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (id === NONE_ID) return [NONE_ID];
  return [...selected.filter((x) => x !== NONE_ID), id];
}

/** Letras de las opciones correctas, en orden: «B, D». */
export const correctLetters = (options: readonly ArrangedOption[]) =>
  options
    .filter((o) => o.correct)
    .map((o) => o.letter)
    .join(", ");
