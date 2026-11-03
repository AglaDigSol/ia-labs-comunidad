// Nota del simulacro: cada pregunta vale 10/N. Sin penalización (lo que se ha visto en el examen de
// 02MIAR), un fallo vale 0, igual que una pregunta en blanco. Con «Penalización por fallo», un fallo
// resta un tercio del valor de la pregunta (lo justo para que, con cuatro opciones, contestar al azar
// valga 0 de media: 1/4·1 − 3/4·1/3 = 0); en blanco sigue valiendo 0. La nota nunca baja de 0.
import { EXAM_SECTIONS, examSectionLabel, type ExamQuestion, type ExamSectionId } from "./blueprint.ts";
import { isAnswered } from "./types.ts";

/** Fracción del valor de una pregunta que resta un fallo con penalización. */
export const WRONG_PENALTY = 1 / 3;

export type QuestionOutcome = "bien" | "mal" | "en-blanco";

export interface SectionScore {
  section: ExamSectionId;
  label: string;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Puntos obtenidos en el bloque (sobre `max`). */
  points: number;
  max: number;
}

export interface ExamScore {
  /** Nota sobre 10 (sin redondear). */
  score: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Valor de cada pregunta. */
  value: number;
  outcomes: QuestionOutcome[];
  sections: SectionScore[];
}

/** Corrige un intento: `answers[i]` es la respuesta de la pregunta i (o null). */
export function scoreExam(questions: readonly ExamQuestion[], answers: ReadonlyArray<string | null | undefined>, penalty: boolean): ExamScore {
  const n = questions.length;
  const value = n === 0 ? 0 : 10 / n;
  const outcomes: QuestionOutcome[] = questions.map((q, i) => {
    const a = answers[i] ?? null;
    if (!isAnswered(q, a)) return "en-blanco";
    return q.grade(a) ? "bien" : "mal";
  });
  const pointsOf = (o: QuestionOutcome) => (o === "bien" ? value : o === "mal" && penalty ? -value * WRONG_PENALTY : 0);
  const raw = outcomes.reduce((s, o) => s + pointsOf(o), 0);
  const sections: SectionScore[] = EXAM_SECTIONS.flatMap((s) => {
    const idx = questions.map((q, i) => (q.section === s.id ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return [];
    const os = idx.map((i) => outcomes[i]!);
    return [
      {
        section: s.id,
        label: examSectionLabel(s.id),
        total: idx.length,
        correct: os.filter((o) => o === "bien").length,
        wrong: os.filter((o) => o === "mal").length,
        blank: os.filter((o) => o === "en-blanco").length,
        points: os.reduce((acc, o) => acc + pointsOf(o), 0),
        max: idx.length * value,
      },
    ];
  });
  return {
    score: Math.max(0, Math.min(10, raw)),
    correct: outcomes.filter((o) => o === "bien").length,
    wrong: outcomes.filter((o) => o === "mal").length,
    blank: outcomes.filter((o) => o === "en-blanco").length,
    value,
    outcomes,
    sections,
  };
}

/** Una nota con dos decimales y coma: «7,50». */
export const scoreText = (x: number): string => (Math.round(x * 100) / 100).toFixed(2).replace(".", ",").replace("-", "−");
