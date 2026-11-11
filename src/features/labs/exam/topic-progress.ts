// Progreso por temas a lo largo de los simulacros entregados: suma, bloque a bloque, los aciertos que
// ya guarda cada intento (result.sections), así que no hace falta guardar nada más. Para cada bloque,
// un enlace al banco de ejercicios con un tipo de ese bloque («Practicar este tema»).
import type { ExamAttempt } from "../../../../shared/exam/attempt.ts";
import { EXAM_SECTION_IDS, EXAM_SECTIONS, type ExamSectionId } from "../../../../shared/exam/blueprint.ts";
import { practiceSearch } from "../../../../shared/exam/items.ts";
import { createRng } from "../../../../shared/exercises/random.ts";
import { exerciseType } from "../../../../shared/exercises/registry.ts";

export interface SectionProgress {
  section: ExamSectionId;
  /** Simulacros entregados con preguntas de este bloque. */
  attempts: number;
  correct: number;
  total: number;
  /** El más reciente: [bien, preguntas]. */
  last: readonly [number, number];
}

/** Progreso por bloques, en el orden del examen (solo los bloques que han salido). */
export function sectionProgress(history: readonly ExamAttempt[]): SectionProgress[] {
  const acc = new Map<ExamSectionId, SectionProgress>();
  // El historial va del más reciente al más antiguo: el primero que se ve es el último intento.
  for (const h of history) {
    for (const [section, ok, total] of h.result?.sections ?? []) {
      if (total <= 0) continue;
      const p = acc.get(section);
      if (p) acc.set(section, { ...p, attempts: p.attempts + 1, correct: p.correct + ok, total: p.total + total });
      else acc.set(section, { section, attempts: 1, correct: ok, total, last: [ok, total] });
    }
  }
  return EXAM_SECTION_IDS.flatMap((s) => acc.get(s) ?? []);
}

/** Búsqueda del banco de ejercicios (?t=&n=&s=) con un tipo de ejercicio del bloque. */
export function sectionPracticeSearch(section: ExamSectionId, seed: number): string | null {
  const types = Object.keys(EXAM_SECTIONS.find((s) => s.id === section)?.types ?? {})
    .map((id) => exerciseType(id))
    .filter((t) => t !== null);
  if (types.length === 0) return null;
  const rng = createRng(seed);
  const type = rng.pick(types);
  const level = type.levels.includes("medio") ? "medio" : type.levels[0]!;
  return practiceSearch(type.id, level, rng.int(0, 0x7fffffff));
}
