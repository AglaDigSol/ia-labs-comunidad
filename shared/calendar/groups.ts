// «Mis grupos»: el grupo de prácticas y la franja de examen de cada materia, cómo filtran los eventos,
// la migración desde la preferencia global antigua y los .ics filtrados que genera el build.
// Puro (sin DOM ni node:): lo usan la página del calendario, el inicio, scripts/build-ics.ts y los tests.
import { z } from "zod";
import type { CalendarEvent } from "./types.ts";

export const GRUPOS = ["G1", "G2", "G3"] as const;
export const FRANJAS = ["F1", "F2"] as const;
export type Grupo = (typeof GRUPOS)[number];
export type Franja = (typeof FRANJAS)[number];

/** Lo que una persona elige en una materia. «todos» / «todas»: no filtrar. */
export type GroupChoice = { grupo: Grupo | "todos"; franja: Franja | "todas" };
/** Elección por materia (código → elección). Una materia que no está no se filtra. */
export type GroupPrefs = Record<string, GroupChoice>;

export const ALL_CHOICE: GroupChoice = Object.freeze({ grupo: "todos", franja: "todas" });

/** Grupos y franjas que existen en una materia, según sus eventos. */
export type SubjectGroups = { materia: string; grupos: Grupo[]; franjas: Franja[] };

/** Materias con algún evento con grupo o franja (orden por código), con los grupos y franjas que tienen. */
export function subjectGroups(events: readonly Pick<CalendarEvent, "materia" | "grupo" | "franja">[]): SubjectGroups[] {
  const map = new Map<string, { g: Set<Grupo>; f: Set<Franja> }>();
  for (const e of events) {
    if (!e.grupo && !e.franja) continue;
    let s = map.get(e.materia);
    if (!s) map.set(e.materia, (s = { g: new Set(), f: new Set() }));
    if (e.grupo) s.g.add(e.grupo);
    if (e.franja) s.f.add(e.franja);
  }
  return [...map]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([materia, s]) => ({ materia, grupos: GRUPOS.filter((g) => s.g.has(g)), franjas: FRANJAS.filter((f) => s.f.has(f)) }));
}

const MATERIA_RE = /^[A-Za-z0-9]{2,16}$/;

/**
 * Valor guardado en `pref/calGroups` (lo comprueba el almacén al leer y al importar una copia). Es
 * permisivo con los valores: un grupo o una franja que no se conoce se lee como «todos» / «todas».
 */
export const GroupPrefsStoredSchema = z
  .record(
    z.string().regex(MATERIA_RE),
    z.strictObject({ grupo: z.string().max(8).optional(), franja: z.string().max(8).optional() }),
  )
  .refine((r) => Object.keys(r).length <= 32, "Demasiadas materias");

const isGrupo = (x: unknown): x is Grupo => (GRUPOS as readonly unknown[]).includes(x);
const isFranja = (x: unknown): x is Franja => (FRANJAS as readonly unknown[]).includes(x);

/** Elección limpia: lo que no se conoce (o no existe en la materia) pasa a «todos» / «todas». */
export function normalizeChoice(raw: unknown, opts?: SubjectGroups): GroupChoice {
  const o = raw && typeof raw === "object" ? (raw as { grupo?: unknown; franja?: unknown }) : {};
  return {
    grupo: isGrupo(o.grupo) && (!opts || opts.grupos.includes(o.grupo)) ? o.grupo : "todos",
    franja: isFranja(o.franja) && (!opts || opts.franjas.includes(o.franja)) ? o.franja : "todas",
  };
}

/**
 * Elección efectiva de cada materia con grupos. `stored` es el valor de `pref/calGroups`; si no hay
 * (migración), cada materia toma la preferencia global antigua (`pref/calGroup` y `pref/calSlot`).
 */
export function effectiveGroupPrefs(
  stored: unknown,
  legacy: { grupo?: unknown; franja?: unknown },
  options: readonly SubjectGroups[],
): GroupPrefs {
  const src = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : null;
  const out: GroupPrefs = {};
  for (const s of options) out[s.materia] = normalizeChoice(src ? src[s.materia] : legacy, s);
  return out;
}

export const isAllChoice = (c: GroupChoice | undefined) => !c || (c.grupo === "todos" && c.franja === "todas");
const sameChoice = (a: GroupChoice | undefined, b: GroupChoice | undefined) =>
  (a?.grupo ?? "todos") === (b?.grupo ?? "todos") && (a?.franja ?? "todas") === (b?.franja ?? "todas");

/** Quita las prácticas de otros grupos y los exámenes de otras franjas. Los eventos comunes se quedan. */
export function applyGroupPrefs<T extends Pick<CalendarEvent, "materia" | "grupo" | "franja">>(events: readonly T[], prefs: GroupPrefs): T[] {
  return events.filter((e) => {
    const c = prefs[e.materia];
    if (!c) return true;
    return (!e.grupo || c.grupo === "todos" || e.grupo === c.grupo) && (!e.franja || c.franja === "todas" || e.franja === c.franja);
  });
}

// ---------------------------------------------------------------- .ics filtrados (build)

/** Límite de .ics combinados («Todas las materias con mis grupos»); por encima, solo los de cada materia. */
export const MAX_COMBINED_FEEDS = 200;

/**
 * Un .ics filtrado. `materia` es un código (una sola materia) o "todas" (todas las materias, cada una
 * con su elección). `seleccion` lleva la elección de cada materia con grupos que incluye el fichero.
 */
export type FilteredFeed = { file: string; materia: string; seleccion: GroupPrefs };

const choiceSchema = z.strictObject({ grupo: z.enum([...GRUPOS, "todos"]), franja: z.enum([...FRANJAS, "todas"]) });
export const FilteredFeedSchema = z.strictObject({
  file: z.string().regex(/^calendario[A-Za-z0-9-]*\.ics$/).max(255),
  materia: z.union([z.literal("todas"), z.string().regex(MATERIA_RE)]),
  seleccion: z.record(z.string().regex(MATERIA_RE), choiceSchema),
});

function choicesOf(s: SubjectGroups): GroupChoice[] {
  const out: GroupChoice[] = [];
  for (const grupo of ["todos", ...s.grupos] as const) for (const franja of ["todas", ...s.franjas] as const) out.push({ grupo, franja });
  return out;
}

const segment = (materia: string, c: GroupChoice) => `${materia}-${c.grupo}-${c.franja}`;

/**
 * Nombre del .ics filtrado. `prefix` es «calendario» o «calendario-<clave>». Una materia:
 * «calendario-01MIAR-G2-F1.ics»; todas: «calendario-todas-01MIAR-G2-F1-02MIAR-todos-todas.ics», con las
 * materias en orden de código. Siempre entra en `calendario[A-Za-z0-9-]*\.ics`.
 */
export function filteredFeedName(prefix: string, materia: string, seleccion: GroupPrefs): string {
  const parts = Object.keys(seleccion)
    .sort()
    .map((m) => segment(m, seleccion[m]!));
  return `${prefix}${materia === "todas" ? "-todas" : ""}-${parts.join("-")}.ics`;
}

/** Número de .ics combinados que harían falta (todas las combinaciones, «todos/todas» incluido). */
export function combinedCount(options: readonly SubjectGroups[]): number {
  return options.reduce((n, s) => n * choicesOf(s).length, options.length > 0 ? 1 : 0);
}

/**
 * Todos los .ics filtrados: los de cada materia y, si caben en MAX_COMBINED_FEEDS, los combinados. La
 * elección «todos/todas» no genera fichero: es el .ics sin filtrar de siempre.
 */
export function filteredFeeds(options: readonly SubjectGroups[], prefix: string): FilteredFeed[] {
  const out: FilteredFeed[] = [];
  for (const s of options) {
    for (const c of choicesOf(s)) {
      if (isAllChoice(c)) continue;
      const seleccion = { [s.materia]: c };
      out.push({ file: filteredFeedName(prefix, s.materia, seleccion), materia: s.materia, seleccion });
    }
  }
  if (options.length > 0 && combinedCount(options) <= MAX_COMBINED_FEEDS) {
    let combos: GroupPrefs[] = [{}];
    for (const s of options) combos = combos.flatMap((p) => choicesOf(s).map((c) => ({ ...p, [s.materia]: c })));
    for (const seleccion of combos) {
      if (Object.values(seleccion).every(isAllChoice)) continue;
      out.push({ file: filteredFeedName(prefix, "todas", seleccion), materia: "todas", seleccion });
    }
  }
  return out;
}

/** Eventos de un .ics filtrado. */
export function feedEvents<T extends Pick<CalendarEvent, "materia" | "grupo" | "franja">>(events: readonly T[], feed: FilteredFeed): T[] {
  const scope = feed.materia === "todas" ? events : events.filter((e) => e.materia === feed.materia);
  return applyGroupPrefs(scope, feed.seleccion);
}

/** Nombre del calendario (X-WR-CALNAME) de un .ics filtrado. */
export function feedCalName(feed: FilteredFeed): string {
  const part = (m: string) => {
    const c = feed.seleccion[m]!;
    const bits = [c.grupo === "todos" ? null : c.grupo, c.franja === "todas" ? null : c.franja].filter(Boolean);
    return `${m} ${bits.length > 0 ? bits.join(" ") : "todos"}`;
  };
  const parts = Object.keys(feed.seleccion).sort().map(part);
  return feed.materia === "todas" ? `IA Labs · Mis grupos · ${parts.join(" · ")}` : `IA Labs · ${parts.join(" · ")}`;
}

/**
 * El .ics de una elección: «unfiltered» si no hay nada que filtrar (se usa el .ics de siempre), el
 * fichero filtrado si existe o «missing» si no se generó (por ejemplo, demasiadas combinaciones).
 */
export function pickFeed(
  feeds: readonly FilteredFeed[],
  materia: string,
  prefs: GroupPrefs,
): { kind: "unfiltered" } | { kind: "feed"; file: string } | { kind: "missing" } {
  if (materia === "todas") {
    if (Object.values(prefs).every(isAllChoice)) return { kind: "unfiltered" };
    const hit = feeds.find(
      (f) =>
        f.materia === "todas" &&
        Object.keys(prefs).every((m) => sameChoice(f.seleccion[m], prefs[m])) &&
        Object.keys(f.seleccion).every((m) => sameChoice(f.seleccion[m], prefs[m])),
    );
    return hit ? { kind: "feed", file: hit.file } : { kind: "missing" };
  }
  if (isAllChoice(prefs[materia])) return { kind: "unfiltered" };
  const hit = feeds.find((f) => f.materia === materia && sameChoice(f.seleccion[materia], prefs[materia]));
  return hit ? { kind: "feed", file: hit.file } : { kind: "missing" };
}
