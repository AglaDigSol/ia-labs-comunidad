// Progreso del banco de ejercicios: cuántos ejercicios de cada tipo y nivel se han resuelto y cuándo
// fue el último. Se guarda como JSON en la clave «exercises» de labs-storage.ts (localStorage por
// defecto, o el almacén que inyecte la app anfitriona con configureLabs). Se valida al leer: lo que no
// encaja se descarta. Las respuestas no se guardan.
import { localCivilDate } from "../../../../shared/date.ts";
import { isExerciseLevel, type ExerciseLevel } from "../../../../shared/exercises/types.ts";
import { readLabItem, writeLabItem } from "../labs-storage.ts";

const MAX_BYTES = 8 * 1024;
const MAX_TYPES = 64;
const MAX_SOLVED = 1_000_000;

export type LevelProgress = { solved: number; last: string };
export type ExercisesProgress = Record<string, Partial<Record<ExerciseLevel, LevelProgress>>>;

const isDay = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

export function parseProgress(raw: string): ExercisesProgress | null {
  if (raw.length > MAX_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || typeof d.progress !== "object" || d.progress === null || Array.isArray(d.progress)) return null;
  const entries = Object.entries(d.progress as Record<string, unknown>);
  if (entries.length > MAX_TYPES) return null;
  const out: ExercisesProgress = {};
  for (const [id, levels] of entries) {
    // Ids de tipos que esta versión quizá no conoce: se conservan si tienen buena forma.
    if (!/^[a-z]+(?:-[a-z]+){0,4}$/.test(id) || typeof levels !== "object" || levels === null) return null;
    const lv: Partial<Record<ExerciseLevel, LevelProgress>> = {};
    for (const [level, p] of Object.entries(levels as Record<string, unknown>)) {
      if (!isExerciseLevel(level) || typeof p !== "object" || p === null) return null;
      const { solved, last } = p as Record<string, unknown>;
      if (!Number.isInteger(solved) || (solved as number) < 0 || (solved as number) > MAX_SOLVED || !isDay(last)) return null;
      lv[level] = { solved: solved as number, last };
    }
    out[id] = lv;
  }
  return out;
}

export function loadProgress(): ExercisesProgress {
  const raw = readLabItem("exercises");
  return (raw !== null && parseProgress(raw)) || {};
}

export function saveProgress(p: ExercisesProgress): void {
  writeLabItem("exercises", JSON.stringify({ v: 1, progress: p }));
}

/** Suma un ejercicio resuelto de ese tipo y nivel (con la fecha local de hoy), lo guarda y lo devuelve. */
export function recordSolved(typeId: string, level: ExerciseLevel, now: number = Date.now()): ExercisesProgress {
  const current = loadProgress();
  const prev = current[typeId]?.[level];
  const next: ExercisesProgress = {
    ...current,
    [typeId]: { ...current[typeId], [level]: { solved: Math.min(MAX_SOLVED, (prev?.solved ?? 0) + 1), last: localCivilDate(now) } },
  };
  saveProgress(next);
  return next;
}

/** Resueltos de un tipo en todos sus niveles. */
export const solvedOfType = (p: ExercisesProgress, typeId: string): number =>
  Object.values(p[typeId] ?? {}).reduce((s, x) => s + (x?.solved ?? 0), 0);
