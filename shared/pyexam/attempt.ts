// Intentos del simulacro de 01MIAR: la semilla, la hora de inicio, el código de cada celda de solución
// y, al entregar, la nota. Como en el simulacro de 02MIAR, el examen no se guarda (se vuelve a generar
// con la semilla) y el reloj no se para: el final es la hora de inicio más dos horas, así que sobrevive
// a recargar la página.
//
// El código se guarda compacto: null en las celdas que siguen como al principio. Todo cabe en
// «Exportar mis datos» (16 KiB por clave): el código de un intento tiene un límite y el historial
// conserva el código solo de los últimos intentos. Se valida al leer (parsePyExamStore): lo que no
// encaja se descarta entero, sin romper la página.
import { MAX_SEED, seedToText } from "../exercises/random.ts";
import { PYEXAM_MINUTES } from "./types.ts";

export interface PyExamResult {
  /** Nota sobre 10, con dos decimales. */
  score: number;
  /** Puntos de cada parte (los cortos y los pasos del proyecto). */
  points: number[];
  /** Comprobaciones ocultas que fallaron, por parte (índices de pyExamUnitLabels). */
  failed: number[][];
}

export interface PyExamAttempt {
  id: string;
  seed: number;
  startedAt: number;
  /** Hora de entrega, o null si está en curso. */
  finishedAt: number | null;
  /** Código de cada celda de solución (null: el inicial). Null en los intentos antiguos del historial. */
  code: Array<string | null> | null;
  /** ¿Se entregó solo al acabarse el tiempo? */
  auto: boolean;
  /** La corrección; null si está en curso o aún no se ha podido corregir (hace falta Python). */
  result: PyExamResult | null;
}

export interface PyExamStore {
  active: PyExamAttempt | null;
  /** Intentos entregados, del más reciente al más antiguo. */
  history: PyExamAttempt[];
}

export const EMPTY_PYEXAM_STORE: PyExamStore = { active: null, history: [] };
export const MAX_PYEXAM_HISTORY = 20;
/** Intentos del historial que conservan su código (para ver los resultados o volver a corregir). */
export const PYEXAM_HISTORY_WITH_CODE = 3;
/** Tamaño máximo del JSON guardado (cabe en «Exportar mis datos», que admite 16 KiB por clave). */
export const MAX_PYEXAM_STORE_BYTES = 15 * 1024;
/** Límite del código de un intento (todas sus celdas, ya como JSON). */
export const MAX_PYEXAM_CODE = 10_000;
/** Partes que puede tener un examen (cortos y pasos): de sobra para los que se generan. */
export const MAX_PYEXAM_PARTS = 16;

export const pyExamDeadline = (a: PyExamAttempt): number => a.startedAt + PYEXAM_MINUTES * 60_000;
export const pyExamRemaining = (a: PyExamAttempt, now: number): number => Math.max(0, pyExamDeadline(a) - now);

/** Lo que ocupa el código de un intento (como JSON). */
export const pyExamCodeSize = (code: ReadonlyArray<string | null> | null): number => (code ? JSON.stringify(code).length : 0);

export function startPyExamAttempt(seed: number, slots: number, now: number): PyExamAttempt {
  return { id: `${seedToText(seed)}-${now.toString(36)}`, seed: seed >>> 0, startedAt: now, finishedAt: null, code: Array.from({ length: slots }, () => null), auto: false, result: null };
}

/**
 * El intento con el código de una celda cambiado (null si es el inicial). Devuelve null si con ese
 * cambio el código pasa del límite: entonces no se acepta.
 */
export function setPyExamCode(a: PyExamAttempt, starters: readonly string[], slot: number, text: string): PyExamAttempt | null {
  const code = Array.from({ length: starters.length }, (_, i) => a.code?.[i] ?? null);
  code[slot] = text === starters[slot] ? null : text;
  if (pyExamCodeSize(code) > MAX_PYEXAM_CODE) return null;
  return { ...a, code };
}

/** Entrega: si se ha acabado el tiempo, la hora de entrega es la del final y cuenta como automática. */
export function finishPyExamAttempt(a: PyExamAttempt, now: number, auto = false): PyExamAttempt {
  const deadline = pyExamDeadline(a);
  const late = now >= deadline;
  return { ...a, finishedAt: late ? deadline : Math.max(a.startedAt, now), auto: auto || late, result: null };
}

/** Añade un intento entregado al historial (y quita el activo si era ese). */
export function recordPyExamAttempt(store: PyExamStore, done: PyExamAttempt): PyExamStore {
  const history = [done, ...store.history.filter((h) => h.id !== done.id)]
    .slice(0, MAX_PYEXAM_HISTORY)
    .map((h, i) => (i < PYEXAM_HISTORY_WITH_CODE ? h : { ...h, code: null }));
  return { active: store.active?.id === done.id ? null : store.active, history };
}

/** Guarda la corrección de un intento del historial. */
export function setPyExamResult(store: PyExamStore, id: string, result: PyExamResult): PyExamStore {
  return { ...store, history: store.history.map((h) => (h.id === id ? { ...h, result } : h)) };
}

// ---------------------------------------------------------------- Validación y guardado

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isTime = (x: unknown): x is number => isInt(x, 0, 8.64e15);
const isPoints = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 10;

function parseResult(x: unknown): PyExamResult | null {
  if (!isObj(x) || !isPoints(x.score)) return null;
  if (!Array.isArray(x.points) || x.points.length === 0 || x.points.length > MAX_PYEXAM_PARTS || !x.points.every(isPoints)) return null;
  if (!Array.isArray(x.failed) || x.failed.length !== x.points.length) return null;
  const failed: number[][] = [];
  for (const f of x.failed) {
    if (!Array.isArray(f) || f.length > 64 || !f.every((i) => isInt(i, 0, 63))) return null;
    failed.push([...new Set(f as number[])]);
  }
  return { score: x.score, points: [...(x.points as number[])], failed };
}

function parseAttempt(x: unknown, finished: boolean): PyExamAttempt | null {
  if (!isObj(x)) return null;
  if (typeof x.id !== "string" || !/^[0-9a-z-]{1,40}$/.test(x.id)) return null;
  if (!isInt(x.seed, 0, MAX_SEED) || !isTime(x.startedAt) || typeof x.auto !== "boolean") return null;
  if (finished ? !isTime(x.finishedAt) || (x.finishedAt as number) < x.startedAt : x.finishedAt !== null) return null;
  let code: Array<string | null> | null = null;
  if (x.code !== null) {
    if (!Array.isArray(x.code) || x.code.length === 0 || x.code.length > MAX_PYEXAM_PARTS) return null;
    if (!x.code.every((c) => c === null || (typeof c === "string" && c.length <= MAX_PYEXAM_CODE))) return null;
    code = x.code as Array<string | null>;
    if (pyExamCodeSize(code) > MAX_PYEXAM_CODE) return null;
  } else if (!finished) return null;
  const result = x.result === null ? null : parseResult(x.result);
  if (x.result !== null && result === null) return null;
  if (!finished && result !== null) return null;
  return { id: x.id, seed: x.seed, startedAt: x.startedAt, finishedAt: finished ? (x.finishedAt as number) : null, code, auto: x.auto, result };
}

/** Lee lo guardado; null si no encaja (y entonces se empieza de cero). */
export function parsePyExamStore(raw: string): PyExamStore | null {
  if (raw.length > MAX_PYEXAM_STORE_BYTES * 2) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || data.v !== 1 || !Array.isArray(data.history) || data.history.length > MAX_PYEXAM_HISTORY) return null;
  const active = data.active === null ? null : parseAttempt(data.active, false);
  if (data.active !== null && !active) return null;
  const history: PyExamAttempt[] = [];
  for (const h of data.history) {
    const a = parseAttempt(h, true);
    if (!a) return null;
    history.push(a);
  }
  return { active, history };
}

/**
 * El JSON que se guarda. Si pasa del tamaño máximo, primero se quita el código de los intentos
 * antiguos y después los intentos más antiguos. El activo nunca pasa del límite de código.
 */
export function serializePyExamStore(store: PyExamStore): string {
  let history = store.history.slice(0, MAX_PYEXAM_HISTORY);
  const text = () => JSON.stringify({ v: 1, active: store.active, history });
  let out = text();
  for (let i = history.length - 1; out.length > MAX_PYEXAM_STORE_BYTES && i >= 0; i--) {
    if (history[i]!.code !== null) history = history.map((h, k) => (k === i ? { ...h, code: null } : h));
    out = text();
  }
  while (out.length > MAX_PYEXAM_STORE_BYTES && history.length > 0) {
    history = history.slice(0, -1);
    out = text();
  }
  return out;
}
