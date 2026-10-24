// Lógica pura del módulo Calendario: filtros, «lo próximo», semanas y aviso de cambio de hora.
import { CLASS_TYPES, DEADLINE_TYPES, type CalendarEvent, type EventType } from "./types.ts";
import { civilDate, ES, offsetChanges, wallToMs, type OffsetChange } from "./time.ts";

export type Filters = {
  materia: string | "todas";
  tipo: EventType | "todos";
  grupo: "G1" | "G2" | "G3" | "todos";
  franja: "F1" | "F2" | "todas";
};

export type TimedEvent = CalendarEvent & { startMs: number; endMs: number | null };

export function withTimes(events: readonly CalendarEvent[]): TimedEvent[] {
  return events
    .map((e) => ({ ...e, startMs: wallToMs(e.inicio), endMs: e.fin ? wallToMs(e.fin) : null }))
    .sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1));
}

export function applyFilters(events: readonly TimedEvent[], f: Filters): TimedEvent[] {
  return events.filter(
    (e) =>
      (f.materia === "todas" || e.materia === f.materia) &&
      (f.tipo === "todos" || e.tipo === f.tipo) &&
      (!e.grupo || f.grupo === "todos" || e.grupo === f.grupo) &&
      (!e.franja || f.franja === "todas" || e.franja === f.franja),
  );
}

/** Termina en `endMs` o, si es un instante (entrega), en su hora límite. */
const endOf = (e: TimedEvent) => e.endMs ?? e.startMs;

export function nextOf(events: readonly TimedEvent[], now: number, types: readonly EventType[]): TimedEvent | null {
  return events.find((e) => types.includes(e.tipo) && endOf(e) > now) ?? null;
}

export const nextClass = (events: readonly TimedEvent[], now: number) => nextOf(events, now, CLASS_TYPES);
export const nextDeadline = (events: readonly TimedEvent[], now: number) => nextOf(events, now, DEADLINE_TYPES);

/** Lunes (aaaa-mm-dd) de la semana de una fecha civil. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
}

/** Agrupa por semana (de lunes a domingo, según la fecha de España). */
export function byWeek(events: readonly TimedEvent[]): Array<{ monday: string; events: TimedEvent[] }> {
  const map = new Map<string, TimedEvent[]>();
  for (const e of events) {
    const k = mondayOf(civilDate(ES, e.startMs));
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    list.push(e);
  }
  return [...map].sort(([a], [b]) => (a < b ? -1 : 1)).map(([monday, evs]) => ({ monday, events: evs }));
}

export type DstNotice = { change: OffsetChange; affected: TimedEvent[] };

/**
 * Si la diferencia Madrid ↔ `tz` cambia en los próximos 7 días, devuelve el cambio y los eventos de
 * los 14 días siguientes a él (los que verás a una hora distinta de la habitual).
 */
export function dstNotice(events: readonly TimedEvent[], tz: string, now: number): DstNotice | null {
  const [change] = offsetChanges(tz, now, 7);
  if (!change) return null;
  const until = change.atMs + 14 * 86_400_000;
  return { change, affected: events.filter((e) => e.startMs >= change.atMs && e.startMs < until) };
}
