import type { Course } from "../../shared/courses/types.ts";
import type { SourceRef } from "../../shared/content/meta.ts";

// Pesos de la evaluación. Se citan de la guía docente (sin copiar su texto). Si en tu edición cambian,
// corrígelos con un PR y actualiza `source`.
const GUIA: SourceRef = { citation: "Guía docente de 01MIAR", academicYear: "2026-2027", checkedOn: "2026-10-22" };

export const MIAR01: Course = {
  meta: {
    subject: "01MIAR · Python para la Inteligencia Artificial",
    topic: "Evaluación",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-SA-4.0",
    source: "Guía docente de 01MIAR (2026-2027), citada",
    updated: "2026-10-23",
  },
  id: "01MIAR",
  name: "Python para la Inteligencia Artificial",
  examWeightPct: 40,
  components: [
    { id: "ev1", label: "Evidencia 1", weightPct: 10, isExam: false, source: GUIA },
    { id: "ev2", label: "Evidencia 2", weightPct: 10, isExam: false, source: GUIA },
    { id: "ev3", label: "Evidencia 3", weightPct: 10, isExam: false, source: GUIA },
    { id: "ev4", label: "Evidencia 4", weightPct: 30, isExam: false, source: GUIA },
    { id: "exam", label: "Examen final", weightPct: 40, isExam: true, source: GUIA },
  ],
};
