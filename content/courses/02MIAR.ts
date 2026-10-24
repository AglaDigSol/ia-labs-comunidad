import type { Course } from "../../shared/courses/types.ts";
import type { SourceRef } from "../../shared/content/meta.ts";

// Pesos de la evaluación. Se citan de la guía docente (sin copiar su texto). Si en tu edición cambian,
// corrígelos con un PR y actualiza `source`.
const GUIA: SourceRef = { citation: "Guía docente de 02MIAR", academicYear: "2026-2027", checkedOn: "2026-10-22" };

export const MIAR02: Course = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Evaluación",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Guía docente de 02MIAR (2026-2027), citada",
    updated: "2026-10-23",
  },
  id: "02MIAR",
  name: "Matemáticas para la Inteligencia Artificial",
  examWeightPct: 50,
  components: [
    { id: "test-rn", label: "Test de redes neuronales", weightPct: 8, isExam: false, source: GUIA },
    { id: "test-papers", label: "Test de papers", weightPct: 12, isExam: false, source: GUIA },
    { id: "practicas", label: "Prácticas grupales", weightPct: 20, isExam: false, source: GUIA },
    { id: "foro", label: "Foro", weightPct: 10, isExam: false, source: GUIA },
    { id: "exam", label: "Examen final", weightPct: 50, isExam: true, source: GUIA },
  ],
};
