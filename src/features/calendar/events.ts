// Eventos del calendario: los del build (dist/calendario.json, que puede incluir el feed externo) o, si
// no hay, los de content/. Los usan la página del calendario y «Próximo» del inicio.
import { useEffect, useState } from "react";
import { CALENDARIO } from "../../../content/calendario/index.ts";
import { CalendarEventSchema, type CalendarEvent } from "../../../shared/calendar/types.ts";

export type Subscription = { label: string; file: string };
const SUB_FILE_RE = /^calendario[A-Za-z0-9-]*\.ics$/;

/** Eventos del build (dist/calendario.json, que puede incluir el feed externo) o, si no hay, los de content/. */
export function useEvents(): { events: CalendarEvent[]; subs: Subscription[] | null } {
  const [events, setEvents] = useState<CalendarEvent[]>(CALENDARIO.eventos);
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}calendario.json`, { cache: "no-cache" });
        if (!res.ok) return;
        const body = (await res.json()) as { version?: unknown; eventos?: unknown; suscripciones?: unknown };
        if (body.version !== 1 || !Array.isArray(body.eventos)) return;
        const parsed = body.eventos.map((e) => CalendarEventSchema.safeParse(e));
        if (alive && parsed.length > 0 && parsed.every((p) => p.success)) setEvents(parsed.map((p) => p.data!));
        // Nombres de los .ics del build (pueden llevar la clave de CALENDAR_ICS_KEY).
        const list = Array.isArray(body.suscripciones) ? body.suscripciones : [];
        const ok = list.filter(
          (x): x is Subscription =>
            !!x && typeof x === "object" && typeof (x as Subscription).label === "string" &&
            typeof (x as Subscription).file === "string" && SUB_FILE_RE.test((x as Subscription).file),
        );
        if (alive && ok.length > 0 && ok.length === list.length) setSubs(ok);
      } catch {
        // sin red o sin fichero (desarrollo): se usan los eventos de content/
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { events, subs };
}
