// Intentos del simulacro: la configuración (modo, semilla, temas, tiempo, orden y penalización), el
// intento en curso (hora de inicio, respuestas, marcadas para revisar) y el historial. Todo es JSON
// pequeño: las preguntas no se guardan, se vuelven a generar con la semilla. El reloj no se puede
// parar: el final es la hora de inicio más la duración, así que sobrevive a recargar la página.
//
// Se valida al leer (parseExamStore): lo que no encaja se descarta entero, sin romper la página.
import { MAX_SEED, seedFromText, seedToText } from "../exercises/random.ts";
import {
  blueprintSize,
  buildExam,
  EXAM_SECTION_IDS,
  FULL_BLUEPRINT,
  isExamSectionId,
  MAX_EXAM_MINUTES,
  MAX_EXAM_QUESTIONS,
  MIN_EXAM_MINUTES,
  MIN_EXAM_QUESTIONS,
  QUICK_BLUEPRINT,
  topicsBlueprint,
  type ExamBlueprint,
  type ExamOrder,
  type ExamQuestion,
  type ExamSectionId,
} from "./blueprint.ts";
import { scoreExam } from "./grading.ts";
import { MAX_NUMERIC_ANSWER } from "./numeric.ts";

export const EXAM_MODES = ["completo", "rapido", "temas"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];

export const EXAM_MODE_INFO: Record<ExamMode, { label: string; detail: string }> = {
  completo: { label: "Completo", detail: "20 preguntas · 2 h, como el examen final" },
  rapido: { label: "Rápido", detail: "10 preguntas · 1 h" },
  temas: { label: "Por temas", detail: "Tú eliges los temas, el número de preguntas y el tiempo" },
};

export interface ExamConfig {
  mode: ExamMode;
  seed: number;
  /** Bloques elegidos (solo «Por temas»). */
  sections: ExamSectionId[];
  /** Número de preguntas (solo «Por temas»). */
  count: number;
  /** Duración en minutos (solo «Por temas»; los otros modos tienen la suya). */
  minutes: number;
  order: ExamOrder;
  penalty: boolean;
}

export const DEFAULT_TOPICS_COUNT = 10;
export const DEFAULT_TOPICS_MINUTES = 60;

export function defaultExamConfig(seed: number, mode: ExamMode = "completo"): ExamConfig {
  return { mode, seed: seed >>> 0, sections: [...EXAM_SECTION_IDS], count: DEFAULT_TOPICS_COUNT, minutes: DEFAULT_TOPICS_MINUTES, order: "tema", penalty: false };
}

/** La plantilla de una configuración. */
export function configBlueprint(c: ExamConfig): ExamBlueprint {
  if (c.mode === "completo") return FULL_BLUEPRINT;
  if (c.mode === "rapido") return QUICK_BLUEPRINT;
  return topicsBlueprint(c.sections, c.count);
}

/** Duración en minutos. */
export const configMinutes = (c: ExamConfig): number => (c.mode === "completo" ? 120 : c.mode === "rapido" ? 60 : clampInt(c.minutes, MIN_EXAM_MINUTES, MAX_EXAM_MINUTES));

/** Número de preguntas. */
export const configQuestions = (c: ExamConfig): number => blueprintSize(configBlueprint(c));

/** Las preguntas de una configuración (deterministas). */
export const configExam = (c: ExamConfig): ExamQuestion[] => buildExam(c.seed, configBlueprint(c), { order: c.order });

const clampInt = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)));

// ---------------------------------------------------------------- En la URL

/** La configuración en la URL (?modo=&s=&temas=&n=&min=&orden=&pen=), para repetir o compartir un simulacro. */
export function configToSearch(c: ExamConfig): URLSearchParams {
  const p = new URLSearchParams({ modo: c.mode, s: seedToText(c.seed) });
  if (c.mode === "temas") {
    p.set("temas", c.sections.join(","));
    p.set("n", String(c.count));
    p.set("min", String(c.minutes));
  }
  if (c.order === "barajado") p.set("orden", "barajado");
  if (c.penalty) p.set("pen", "1");
  return p;
}

/** Lee la configuración de la URL; null si no hay modo o semilla válidos. */
export function configFromSearch(p: URLSearchParams): ExamConfig | null {
  const mode = p.get("modo");
  const seed = seedFromText(p.get("s"));
  if (!EXAM_MODES.includes(mode as ExamMode) || seed === null) return null;
  const c = defaultExamConfig(seed, mode as ExamMode);
  if (c.mode === "temas") {
    const sections = (p.get("temas") ?? "").split(",").filter(isExamSectionId);
    if (sections.length > 0) c.sections = EXAM_SECTION_IDS.filter((s) => sections.includes(s));
    const n = Number(p.get("n"));
    if (Number.isFinite(n) && n > 0) c.count = clampInt(n, MIN_EXAM_QUESTIONS, MAX_EXAM_QUESTIONS);
    const m = Number(p.get("min"));
    if (Number.isFinite(m) && m > 0) c.minutes = clampInt(m, MIN_EXAM_MINUTES, MAX_EXAM_MINUTES);
  }
  c.order = p.get("orden") === "barajado" ? "barajado" : "tema";
  c.penalty = p.get("pen") === "1";
  return c;
}

// ---------------------------------------------------------------- Intentos

export interface ExamResultSummary {
  /** Nota sobre 10, redondeada a centésimas. */
  score: number;
  correct: number;
  wrong: number;
  blank: number;
  /** ¿Se entregó solo al acabarse el tiempo? */
  auto: boolean;
  /** Por bloque: [bloque, bien, total]. */
  sections: Array<[ExamSectionId, number, number]>;
}

export interface ExamAttempt {
  id: string;
  config: ExamConfig;
  /** Hora de inicio (ms desde 1970). */
  startedAt: number;
  /** Hora de entrega, o null si está en curso. */
  finishedAt: number | null;
  /** Respuesta de cada pregunta (null: en blanco). Null en intentos antiguos del historial (solo el resumen). */
  answers: Array<string | null> | null;
  /** Preguntas marcadas para revisar (índices). */
  flagged: number[];
  /** Pregunta abierta. */
  current: number;
  result: ExamResultSummary | null;
}

export interface ExamStore {
  active: ExamAttempt | null;
  /** Intentos entregados, del más reciente al más antiguo. */
  history: ExamAttempt[];
}

export const EMPTY_EXAM_STORE: ExamStore = { active: null, history: [] };
/** Intentos del historial que se guardan. */
export const MAX_EXAM_HISTORY = 30;
/** Intentos del historial que conservan sus respuestas (para volver a ver los resultados). */
export const EXAM_HISTORY_WITH_ANSWERS = 5;
/** Tamaño máximo del JSON (cabe en «Exportar mis datos»). */
export const MAX_EXAM_STORE_BYTES = 15 * 1024;

/** Hora a la que se acaba el tiempo. */
export const attemptDeadline = (a: ExamAttempt): number => a.startedAt + configMinutes(a.config) * 60_000;
/** Milisegundos que quedan (0 si se ha acabado). */
export const attemptRemaining = (a: ExamAttempt, now: number): number => Math.max(0, attemptDeadline(a) - now);

/** Un intento nuevo, que empieza ahora. */
export function startAttempt(config: ExamConfig, questions: number, now: number): ExamAttempt {
  return { id: `${seedToText(config.seed)}-${now.toString(36)}`, config, startedAt: now, finishedAt: null, answers: Array.from({ length: questions }, () => null), flagged: [], current: 0, result: null };
}

/**
 * Entrega un intento: lo corrige con sus preguntas y guarda el resumen. Si se ha acabado el tiempo, la
 * hora de entrega es la del final (aunque se abra la página más tarde) y cuenta como automática.
 */
export function finishAttempt(a: ExamAttempt, questions: readonly ExamQuestion[], now: number, auto = false): ExamAttempt {
  const deadline = attemptDeadline(a);
  const late = now >= deadline;
  const s = scoreExam(questions, a.answers ?? [], a.config.penalty);
  return {
    ...a,
    finishedAt: late ? deadline : now,
    result: {
      score: Math.round(s.score * 100) / 100,
      correct: s.correct,
      wrong: s.wrong,
      blank: s.blank,
      auto: auto || late,
      sections: s.sections.map((x) => [x.section, x.correct, x.total]),
    },
  };
}

/** Añade un intento entregado al historial (y quita el activo si era ese). */
export function recordAttempt(store: ExamStore, done: ExamAttempt): ExamStore {
  const history = [done, ...store.history.filter((h) => h.id !== done.id)].slice(0, MAX_EXAM_HISTORY).map((h, i) => (i < EXAM_HISTORY_WITH_ANSWERS ? h : { ...h, answers: null }));
  return { active: store.active?.id === done.id ? null : store.active, history };
}

// ---------------------------------------------------------------- Validación y guardado

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isTime = (x: unknown): x is number => isInt(x, 0, 8.64e15);
const MAX_ANSWER_TEXT = Math.max(MAX_NUMERIC_ANSWER, 64);

function parseConfig(x: unknown): ExamConfig | null {
  if (!isObj(x)) return null;
  if (!EXAM_MODES.includes(x.mode as ExamMode)) return null;
  if (!isInt(x.seed, 0, MAX_SEED)) return null;
  if (!Array.isArray(x.sections) || x.sections.length > EXAM_SECTION_IDS.length || !x.sections.every(isExamSectionId)) return null;
  if (!isInt(x.count, MIN_EXAM_QUESTIONS, MAX_EXAM_QUESTIONS) || !isInt(x.minutes, MIN_EXAM_MINUTES, MAX_EXAM_MINUTES)) return null;
  if (x.order !== "tema" && x.order !== "barajado") return null;
  if (typeof x.penalty !== "boolean") return null;
  return { mode: x.mode as ExamMode, seed: x.seed, sections: [...new Set(x.sections as ExamSectionId[])], count: x.count, minutes: x.minutes, order: x.order, penalty: x.penalty };
}

function parseResult(x: unknown): ExamResultSummary | null {
  if (!isObj(x)) return null;
  if (typeof x.score !== "number" || !Number.isFinite(x.score) || x.score < 0 || x.score > 10) return null;
  if (!isInt(x.correct, 0, MAX_EXAM_QUESTIONS) || !isInt(x.wrong, 0, MAX_EXAM_QUESTIONS) || !isInt(x.blank, 0, MAX_EXAM_QUESTIONS)) return null;
  if (typeof x.auto !== "boolean" || !Array.isArray(x.sections) || x.sections.length > EXAM_SECTION_IDS.length) return null;
  const sections: Array<[ExamSectionId, number, number]> = [];
  for (const s of x.sections) {
    if (!Array.isArray(s) || s.length !== 3 || !isExamSectionId(s[0]) || !isInt(s[2], 1, MAX_EXAM_QUESTIONS) || !isInt(s[1], 0, s[2] as number)) return null;
    sections.push([s[0], s[1] as number, s[2] as number]);
  }
  return { score: x.score, correct: x.correct, wrong: x.wrong, blank: x.blank, auto: x.auto, sections };
}

function parseAttempt(x: unknown, finished: boolean): ExamAttempt | null {
  if (!isObj(x)) return null;
  if (typeof x.id !== "string" || !/^[0-9a-z-]{1,40}$/.test(x.id)) return null;
  const config = parseConfig(x.config);
  if (!config || !isTime(x.startedAt)) return null;
  if (finished ? !isTime(x.finishedAt) || (x.finishedAt as number) < x.startedAt : x.finishedAt !== null) return null;
  let answers: Array<string | null> | null = null;
  if (x.answers !== null) {
    if (!Array.isArray(x.answers) || x.answers.length > MAX_EXAM_QUESTIONS) return null;
    if (!x.answers.every((a) => a === null || (typeof a === "string" && a.length <= MAX_ANSWER_TEXT))) return null;
    answers = x.answers as Array<string | null>;
  } else if (!finished) return null;
  const n = answers?.length ?? MAX_EXAM_QUESTIONS;
  if (!Array.isArray(x.flagged) || x.flagged.length > n || !x.flagged.every((i) => isInt(i, 0, n - 1))) return null;
  if (!isInt(x.current, 0, Math.max(0, n - 1))) return null;
  const result = x.result === null ? null : parseResult(x.result);
  if (finished ? result === null : x.result !== null) return null;
  return { id: x.id, config, startedAt: x.startedAt, finishedAt: finished ? (x.finishedAt as number) : null, answers, flagged: [...new Set(x.flagged as number[])], current: x.current, result };
}

/** Lee lo guardado; null si no encaja (y entonces se empieza de cero). */
export function parseExamStore(raw: string): ExamStore | null {
  if (raw.length > MAX_EXAM_STORE_BYTES * 2) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || data.v !== 1 || !Array.isArray(data.history) || data.history.length > MAX_EXAM_HISTORY) return null;
  const active = data.active === null ? null : parseAttempt(data.active, false);
  if (data.active !== null && !active) return null;
  const history: ExamAttempt[] = [];
  for (const h of data.history) {
    const a = parseAttempt(h, true);
    if (!a) return null;
    history.push(a);
  }
  return { active, history };
}

/** El JSON que se guarda; si pasa del tamaño máximo, se quitan respuestas e intentos antiguos. */
export function serializeExamStore(store: ExamStore): string {
  let history = store.history.slice(0, MAX_EXAM_HISTORY);
  const text = () => JSON.stringify({ v: 1, active: store.active, history });
  let out = text();
  for (let i = history.length - 1; out.length > MAX_EXAM_STORE_BYTES && i >= 0; i--) {
    if (history[i]!.answers !== null) history = history.map((h, k) => (k === i ? { ...h, answers: null } : h));
    out = text();
  }
  while (out.length > MAX_EXAM_STORE_BYTES && history.length > 0) {
    history = history.slice(0, -1);
    out = text();
  }
  return out;
}

/** Bloques de una configuración «Por temas» que existen (para la pantalla de inicio). */
export const configSections = (c: ExamConfig): ExamSectionId[] => (c.mode === "temas" ? c.sections : (Object.keys(configBlueprint(c)) as ExamSectionId[]));
