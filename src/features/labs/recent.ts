// Lo último que se hizo en los laboratorios: la última pestaña abierta y el último ejercicio del banco
// (tipo, nivel y semilla; nunca las respuestas). Lo leen «Continuar» del inicio y «Continúa donde lo
// dejaste» del banco de ejercicios. Se guarda como JSON en la clave «recent» de labs-storage.ts
// (localStorage por defecto, o el almacén que inyecte la app anfitriona) y se valida al leer.
import { LEVEL_SLUGS, isExerciseLevel, type ExerciseLevel } from "../../../shared/exercises/types.ts";
import { MAX_SEED, seedToText } from "../../../shared/exercises/random.ts";
import { readLabItem, writeLabItem } from "./labs-storage.ts";

const MAX_BYTES = 2 * 1024;
const PATH_RE = /^[A-Za-z0-9_-]{1,40}(?:\/[A-Za-z0-9_-]{1,40}){0,3}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const TYPE_RE = /^[a-z]+(?:-[a-z]+){0,4}$/;

/** Pestaña de los laboratorios: `path` es relativa al área («markov»). */
export type RecentTab = { id: string; label: string; path: string; at: number };
/** Ejercicio del banco: `mix` es el tema si venía de «Mezclar». */
export type RecentExercise = { type: string; title: string; level: ExerciseLevel; seed: number; mix: string | null; at: number };
export type LabsRecent = { tab: RecentTab | null; exercise: RecentExercise | null };

const EMPTY: LabsRecent = { tab: null, exercise: null };

const text = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const time = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;

function parseTab(x: unknown): RecentTab | null {
  if (typeof x !== "object" || x === null) return null;
  const { id, label, path, at } = x as Record<string, unknown>;
  if (!text(id, 40) || !ID_RE.test(id) || !text(label, 60) || !text(path, 170) || !PATH_RE.test(path) || !time(at)) return null;
  return { id, label, path, at };
}

function parseExercise(x: unknown): RecentExercise | null {
  if (typeof x !== "object" || x === null) return null;
  const { type, title, level, seed, mix, at } = x as Record<string, unknown>;
  if (!text(type, 60) || !TYPE_RE.test(type) || !text(title, 120) || !isExerciseLevel(level)) return null;
  if (!Number.isSafeInteger(seed) || (seed as number) < 0 || (seed as number) > MAX_SEED || !time(at)) return null;
  if (mix !== null && !(text(mix, 40) && ID_RE.test(mix))) return null;
  return { type, title, level, seed: seed as number, mix: mix as string | null, at };
}

/** Lo guardado, validado: lo que no encaja se descarta (cada parte por separado). */
export function parseRecent(raw: string): LabsRecent {
  if (raw.length > MAX_BYTES) return EMPTY;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof data !== "object" || data === null || (data as { v?: unknown }).v !== 1) return EMPTY;
  const d = data as Record<string, unknown>;
  return { tab: parseTab(d.tab), exercise: parseExercise(d.exercise) };
}

export function loadRecent(): LabsRecent {
  const raw = readLabItem("recent");
  return raw === null ? EMPTY : parseRecent(raw);
}

function save(r: LabsRecent): void {
  writeLabItem("recent", JSON.stringify({ v: 1, ...r }));
}

/** Anota la pestaña abierta. */
export function recordLabTab(tab: Omit<RecentTab, "at">, now: number = Date.now()): void {
  const next = parseTab({ ...tab, at: now });
  if (next) save({ ...loadRecent(), tab: next });
}

/** Anota el ejercicio abierto (tipo, nivel y semilla). */
export function recordExercise(e: Omit<RecentExercise, "at">, now: number = Date.now()): void {
  const next = parseExercise({ ...e, at: now });
  if (next) save({ ...loadRecent(), exercise: next });
}

/** Parámetros de la URL del banco de ejercicios para abrir ese ejercicio (?t=&n=&s=, y &m=). */
export function exerciseSearch(e: Pick<RecentExercise, "type" | "level" | "seed" | "mix">): string {
  const p = new URLSearchParams({ t: e.type, n: LEVEL_SLUGS[e.level], s: seedToText(e.seed) });
  if (e.mix) p.set("m", e.mix);
  return p.toString();
}

/**
 * Lo último que se hizo, para «Continuar»: el ejercicio si es lo más reciente o si la última pestaña fue
 * la del banco («ejercicios»), y si no, la pestaña. `href` es relativo a la ruta del área de laboratorios.
 */
export function latestActivity(r: LabsRecent): { kind: "tab"; label: string; href: string } | { kind: "exercise"; label: string; level: ExerciseLevel; href: string } | null {
  const { tab, exercise } = r;
  if (exercise && (!tab || tab.id === "ejercicios" || exercise.at >= tab.at)) {
    return { kind: "exercise", label: exercise.title, level: exercise.level, href: `ejercicios?${exerciseSearch(exercise)}` };
  }
  return tab ? { kind: "tab", label: tab.label, href: tab.path } : null;
}
