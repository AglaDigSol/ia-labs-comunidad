// Preguntas de examen a partir del banco de ejercicios: el registro de adaptadores (qué tipos sirven
// para el examen y cómo se pregunta cada uno) y examItem, que genera la instancia, la convierte, la
// valida y le pone la corrección. Los tipos que no tienen adaptador (tablas paso a paso, demostraciones,
// Python…) no salen en el simulacro.
import { arrangeChoices, correctLetters, DEFAULT_OPTION_COUNT, gradeChoice } from "../exercises/choice.ts";
import { exerciseType } from "../exercises/registry.ts";
import { seedToText } from "../exercises/random.ts";
import { LEVEL_SLUGS, type ExerciseLevel, type ExerciseTopic } from "../exercises/types.ts";
import type { ExamAdapter, ExamDraft } from "./adapter.ts";
import { CALC_EXAM_ADAPTERS } from "./adapters/calculus.ts";
import { COMB_EXAM_ADAPTERS, SETS_EXAM_ADAPTERS } from "./adapters/discrete.ts";
import { LINALG_EXAM_ADAPTERS } from "./adapters/linalg.ts";
import { LOGIC_EXAM_ADAPTERS, PRED_EXAM_ADAPTERS } from "./adapters/logic.ts";
import { MARKOV_EXAM_ADAPTERS } from "./adapters/markov.ts";
import { PRED_CONCRETE_EXAM_ADAPTERS } from "./adapters/predicates-concrete.ts";
import { PROB_EXAM_ADAPTERS } from "./adapters/probability.ts";
import { expectedFrac, numericCorrectText, numericFormatNote, numericMatches } from "./numeric.ts";
import { decodeChoiceAnswer, type ExamItem } from "./types.ts";

/** Todos los adaptadores, por tema. */
export const EXAM_ADAPTERS: readonly ExamAdapter[] = [
  ...LOGIC_EXAM_ADAPTERS,
  ...PRED_EXAM_ADAPTERS,
  ...PRED_CONCRETE_EXAM_ADAPTERS,
  ...SETS_EXAM_ADAPTERS,
  ...COMB_EXAM_ADAPTERS,
  ...LINALG_EXAM_ADAPTERS,
  ...CALC_EXAM_ADAPTERS,
  ...PROB_EXAM_ADAPTERS,
  ...MARKOV_EXAM_ADAPTERS,
];

const BY_TYPE = new Map(EXAM_ADAPTERS.map((a) => [a.type.id, a]));

/** Ids de los tipos que pueden salir en el simulacro. */
export const EXAM_TYPE_IDS: readonly string[] = EXAM_ADAPTERS.map((a) => a.type.id);

export const examAdapterOf = (typeId: string): ExamAdapter | null => BY_TYPE.get(typeId) ?? null;

/** Niveles con los que un tipo puede salir en el simulacro. */
export function examLevels(typeId: string): readonly ExerciseLevel[] {
  const a = BY_TYPE.get(typeId);
  if (!a) return [];
  return a.levels ? a.levels.filter((l) => a.type.levels.includes(l)) : a.type.levels;
}

/** El mapa tipo → pregunta de examen, para documentarlo (README, tests). */
export const examTypeSummary = (): Array<{ typeId: string; topic: ExerciseTopic; title: string; ask: string; levels: readonly ExerciseLevel[] }> =>
  EXAM_ADAPTERS.map((a) => ({ typeId: a.type.id, topic: a.type.topic, title: a.type.title, ask: a.ask, levels: examLevels(a.type.id) }));

/** Parámetros de «Practicar este tipo» en el banco de ejercicios. */
export const practiceSearch = (typeId: string, level: ExerciseLevel, seed: number): string =>
  `?${new URLSearchParams({ t: typeId, n: LEVEL_SLUGS[level], s: seedToText(seed) }).toString()}`;

/** Intentos con otras semillas cuando una instancia no sirve para el examen. */
const RETRIES = 40;
const nextSeed = (seed: number, k: number) => (k === 0 ? seed >>> 0 : (seed + Math.imul(k, 0x9e3779b9)) >>> 0);

export interface ExamItemOptions {
  /** Admite «selecciona la o las correctas» (por defecto, no: una sola correcta, como en 2025-26). */
  allowMulti?: boolean;
}

/** Comprueba un borrador y lo convierte en pregunta; null si no cumple las reglas del examen. */
type ItemBase = Pick<ExamItem, "id" | "typeId" | "topic" | "level" | "seed" | "title" | "practiceLink">;

function finish(draft: ExamDraft, base: ItemBase, opts: ExamItemOptions): ExamItem | null {
  const common = { ...base, stem: draft.stem, prompt: draft.prompt, solution: draft.solution ?? [] };
  if (draft.kind === "choice") {
    const q = draft.question;
    if (q.mode === "multi" && !opts.allowMulti) return null;
    let options;
    try {
      options = arrangeChoices(q, `${base.typeId}:${base.seed}`);
    } catch {
      return null;
    }
    if (q.mode === "single" && options.length !== DEFAULT_OPTION_COUNT) return null;
    if (new Set(options.map((o) => o.text)).size !== options.length) return null;
    const right = options.filter((o) => o.correct);
    const correctText = right.map((o) => `${o.letter}) ${o.text}`).join("; ");
    return {
      ...common,
      kind: "choice",
      mode: q.mode,
      options,
      correctText: correctText || correctLetters(options),
      grade: (answer) => {
        const ids = decodeChoiceAnswer(answer);
        return ids.length > 0 && gradeChoice(options, ids).correct;
      },
    };
  }
  const { expected, format } = draft;
  if (typeof expected === "number" && !Number.isFinite(expected)) return null;
  const exact = expectedFrac(expected);
  if ((format === "entero" || format === "exacto") && !exact) return null;
  if (format === "entero" && exact!.d !== 1n) return null;
  if (format === "exacto" && 10n ** 8n % exact!.d !== 0n) return null;
  return {
    ...common,
    kind: "numeric",
    format,
    label: draft.label ?? "Respuesta",
    formatNote: numericFormatNote(format, expected),
    correctText: numericCorrectText(expected, format),
    grade: (answer) => numericMatches(answer, expected, format),
  };
}

/**
 * La pregunta de examen de un tipo, nivel y semilla. Si la instancia de esa semilla no sirve (opción
 * múltiple con varias correctas, generador que falla…), se prueba con otras semillas deterministas:
 * `seed` de la pregunta dice cuál se ha usado. Null si el tipo no tiene adaptador.
 */
export function examItem(typeId: string, seed: number, level: ExerciseLevel, opts: ExamItemOptions = {}): ExamItem | null {
  const adapter = BY_TYPE.get(typeId);
  const type = exerciseType(typeId);
  if (!adapter || !type) return null;
  const levels = examLevels(typeId);
  const lv = levels.includes(level) ? level : (levels.includes("medio") ? "medio" : levels[0]);
  if (!lv) return null;
  for (let k = 0; k < RETRIES; k++) {
    const s = nextSeed(seed, k);
    let draft: ExamDraft | null;
    try {
      draft = adapter.build(type.generate(s, lv), lv);
    } catch {
      draft = null;
    }
    if (!draft) continue;
    const item = finish(
      draft,
      { id: `${typeId}:${LEVEL_SLUGS[lv]}:${seedToText(s)}`, typeId, topic: type.topic, level: lv, seed: s, title: type.title, practiceLink: practiceSearch(typeId, lv, s) },
      opts,
    );
    if (item) return item;
  }
  return null;
}
