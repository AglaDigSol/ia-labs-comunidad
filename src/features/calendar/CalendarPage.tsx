import { CalendarClock, Copy, Download, Info, Rss, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CALENDARIO } from "../../../content/calendario/index.ts";
import { applyFilters, byWeek, dstNotice, nextClass, nextDeadline, withTimes, type Filters, type TimedEvent } from "../../../shared/calendar/model.ts";
import { dayShift, diffFromMadrid, ES, fmtDay, fmtDiff, fmtTime, formatCountdown, isValidZone } from "../../../shared/calendar/time.ts";
import { CalendarEventSchema, EVENT_TYPE_LABELS, EVENT_TYPES, type CalendarEvent, type EventType } from "../../../shared/calendar/types.ts";
import { keys } from "../../../shared/keys.ts";
import { Button } from "../../components/ui/button.tsx";
import { Chip } from "../../components/ui/chip.tsx";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../../components/ui/dialog.tsx";
import { t } from "../../i18n/index.ts";
import { setKv, useKv } from "../../lib/kv-store.ts";
import { useNow } from "../../lib/use-now.ts";
import { allZones, CITIES, detectZone, zoneLabel } from "./zones.ts";

const selectClass = "min-h-11 rounded-md border border-border bg-raised px-3 text-fg";

/** Eventos del build (dist/calendario.json, que puede incluir el feed externo) o, si no hay, los de content/. */
function useEvents(): CalendarEvent[] {
  const [events, setEvents] = useState<CalendarEvent[]>(CALENDARIO.eventos);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}calendario.json`, { cache: "no-cache" });
        if (!res.ok) return;
        const body = (await res.json()) as { version?: unknown; eventos?: unknown };
        if (body.version !== 1 || !Array.isArray(body.eventos)) return;
        const parsed = body.eventos.map((e) => CalendarEventSchema.safeParse(e));
        if (alive && parsed.length > 0 && parsed.every((p) => p.success)) setEvents(parsed.map((p) => p.data!));
      } catch {
        // sin red o sin fichero (desarrollo): se usan los eventos de content/
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return events;
}

function DualTime({ e, tz }: { e: TimedEvent; tz: string }) {
  const same = tz === ES;
  const shift = dayShift(tz, e.startMs);
  const range = (zone: string) =>
    `${fmtTime(zone, e.startMs)}${e.endMs ? `–${fmtTime(zone, e.endMs)}` : ""}`;
  return (
    <span className="mono text-[14px]">
      {`${range(ES)} España`}
      {same ? null : (
        <>
          {" · "}
          <strong className="font-semibold">{`${range(tz)} ${zoneLabel(tz)}`}</strong>
          {shift !== 0 ? ` (${fmtDay(tz, e.startMs)})` : ""}
        </>
      )}
    </span>
  );
}

function EventRow({ e, tz }: { e: TimedEvent; tz: string }) {
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="mono w-24 shrink-0 text-[14px] text-muted">{fmtDay(ES, e.startMs)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone="info">{e.materia}</Chip>
          <Chip tone={e.tipo === "examen" || e.tipo === "entrega" || e.tipo === "foro" || e.tipo === "test" ? "warn" : "outline"}>
            {EVENT_TYPE_LABELS[e.tipo]}
          </Chip>
          <span className="font-semibold">{e.titulo}</span>
          {e.grupo ? <span className="text-[14px] text-muted">{`Grupo ${e.grupo}`}</span> : null}
          {e.franja ? <span className="text-[14px] text-muted">{`Franja ${e.franja}`}</span> : null}
        </span>
        <DualTime e={e} tz={tz} />
        {e.finEstimado ? <span className="text-[14px] text-muted">Duración estimada.</span> : null}
      </span>
    </li>
  );
}

function NextCard({ title, e, tz, now }: { title: string; e: TimedEvent | null; tz: string; now: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      <h3 className="text-[16px]">{title}</h3>
      {e ? (
        <>
          <p className="font-semibold">{`${e.materia} · ${e.titulo}${e.grupo ? ` (${e.grupo})` : e.franja ? ` (${e.franja})` : ""}`}</p>
          <p className="text-[14px]">
            {`${fmtDay(tz, e.startMs)} · `}
            <DualTime e={e} tz={tz} />
          </p>
          <p className="text-[14px] text-muted">
            {e.startMs > now ? `Empieza en ${formatCountdown(e.startMs - now)}` : "En curso"}
          </p>
        </>
      ) : (
        <p className="text-muted">No hay nada más en el calendario.</p>
      )}
    </div>
  );
}

function ZonePicker({ tz, onChange }: { tz: string; onChange: (tz: string) => void }) {
  const inList = CITIES.some((c) => c.tz === tz);
  const [other, setOther] = useState(!inList);
  const zones = useMemo(() => (other ? allZones() : []), [other]);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        Mi ciudad
        <select
          className={selectClass}
          value={other ? "otra" : tz}
          onChange={(e) => {
            if (e.target.value === "otra") setOther(true);
            else {
              setOther(false);
              onChange(e.target.value);
            }
          }}
        >
          {CITIES.map((c) => (
            <option key={c.tz} value={c.tz}>
              {c.label}
            </option>
          ))}
          <option value="otra">Otra zona…</option>
        </select>
      </label>
      {other ? (
        <label className="flex flex-col gap-1 text-[14px] font-semibold">
          Otra zona
          <select className={selectClass} value={tz} onChange={(e) => onChange(e.target.value)}>
            {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function SubscribeDialog({ materias }: { materias: string[] }) {
  const base = typeof window === "undefined" ? "" : new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  const url = (file: string) => `${base}${file}`;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (u: string) => {
    try {
      await navigator.clipboard.writeText(u);
      setCopied(u);
    } catch {
      setCopied(null);
    }
  };
  const Row = ({ label, file }: { label: string; file: string }) => (
    <li className="flex flex-col gap-1">
      <span className="text-[14px] font-semibold">{label}</span>
      <code className="mono break-all rounded-md bg-sunken p-2 text-[14px]">{url(file)}</code>
      <span className="flex flex-wrap gap-2">
        <Button onClick={() => void copy(url(file))}>
          <Copy size={16} aria-hidden="true" />
          {copied === url(file) ? "Copiada" : "Copiar URL"}
        </Button>
        <a className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-[14px] font-semibold hover:bg-sunken" href={url(file)} download>
          <Download size={16} aria-hidden="true" />
          Descargar .ics
        </a>
      </span>
    </li>
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Rss size={16} aria-hidden="true" />
          Suscribirme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Suscribirme al calendario</DialogTitle>
        <DialogDescription>
          Añade el calendario a tu aplicación con la URL de suscripción: se actualizará solo. Las horas se ven en la zona de tu
          dispositivo.
        </DialogDescription>
        <ul className="flex flex-col gap-3">
          <Row label="Todas las materias" file="calendario.ics" />
          {materias.map((m) => (
            <Row key={m} label={m} file={`calendario-${m}.ics`} />
          ))}
        </ul>
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo suscribirse</summary>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            <li>Google Calendar (web): «Otros calendarios» → «+» → «Desde URL» → pega la URL.</li>
            <li>Apple Calendario: Archivo → «Nueva suscripción a calendario…» (en iPhone: Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → Añadir calendario suscrito).</li>
            <li>Outlook: Calendario → «Agregar calendario» → «Suscribirse desde la web» → pega la URL.</li>
            <li>Si prefieres una copia puntual, usa «Descargar .ics» e impórtala: no se actualizará.</li>
          </ul>
        </details>
        <DialogClose asChild>
          <Button className="self-end">Cerrar</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[14px] font-semibold">
      {label}
      {children}
    </label>
  );
}

export function CalendarPage() {
  const raw = useEvents();
  const events = useMemo(() => withTimes(raw), [raw]);
  const now = useNow(30_000);
  const storedTz = useKv<string | null>(keys.pref.timeZone, null);
  const tz = storedTz && isValidZone(storedTz) ? storedTz : detectZone();
  const grupo = useKv<Filters["grupo"]>(keys.pref.calGroup, "todos");
  const franja = useKv<Filters["franja"]>(keys.pref.calSlot, "todas");
  const [materia, setMateria] = useState<string>("todas");
  const [tipo, setTipo] = useState<EventType | "todos">("todos");
  const [pasados, setPasados] = useState(false);

  const materias = useMemo(() => [...new Set(raw.map((e) => e.materia))].sort(), [raw]);
  const personal = useMemo(() => applyFilters(events, { materia: "todas", tipo: "todos", grupo, franja }), [events, grupo, franja]);
  const filtered = useMemo(() => applyFilters(events, { materia, tipo, grupo, franja }), [events, materia, tipo, grupo, franja]);
  const visible = pasados ? filtered : filtered.filter((e) => (e.endMs ?? e.startMs) > now);
  const weeks = byWeek(visible);
  const notice = dstNotice(personal, tz, now);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          {t.calendar.title}
        </h1>
        <p role="note" className="flex items-start gap-2 rounded-md border border-warn bg-warn-bg p-3 text-warn">
          <Info size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t.calendar.notice}</span>
        </p>
      </header>

      <section aria-labelledby="cal-zona" className="flex flex-col gap-3">
        <h2 id="cal-zona" className="sr-only">
          Zona horaria
        </h2>
        <ZonePicker tz={tz} onChange={(z) => setKv(keys.pref.timeZone, z)} />
        <p className="text-[14px] text-muted">
          {tz === ES
            ? "Estás en la hora de España."
            : `Ahora ${zoneLabel(tz)} va ${fmtDiff(Math.abs(diffFromMadrid(tz, now)))} ${diffFromMadrid(tz, now) >= 0 ? "por detrás de" : "por delante de"} España.`}
        </p>
        {notice ? (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-warn bg-warn-bg p-3 text-warn">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
              {`Cambio de hora el ${fmtDay(tz, notice.change.atMs)}: la diferencia con España pasa de ${fmtDiff(notice.change.beforeMin)} a ${fmtDiff(notice.change.afterMin)}.`}
            </p>
            {notice.affected.length > 0 ? (
              <ul className="list-disc pl-6 text-[14px]">
                {notice.affected.map((e) => (
                  <li key={e.id}>
                    {`${fmtDay(ES, e.startMs)} · ${e.materia} · ${e.titulo}: `}
                    <DualTime e={e} tz={tz} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="cal-next" className="flex flex-col gap-3">
        <h2 id="cal-next" className="flex items-center gap-2 text-[20px]">
          <CalendarClock size={20} strokeWidth={1.75} aria-hidden="true" />
          Lo próximo
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NextCard title="Próxima clase" e={nextClass(personal, now)} tz={tz} now={now} />
          <NextCard title="Próxima entrega o examen" e={nextDeadline(personal, now)} tz={tz} now={now} />
        </div>
      </section>

      <section aria-labelledby="cal-list" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cal-list" className="text-[20px]">
            Por semanas
          </h2>
          <SubscribeDialog materias={materias} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Labeled label="Materia">
            <select className={selectClass} value={materia} onChange={(e) => setMateria(e.target.value)}>
              <option value="todas">Todas</option>
              {materias.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Tipo">
            <select className={selectClass} value={tipo} onChange={(e) => setTipo(e.target.value as EventType | "todos")}>
              <option value="todos">Todos</option>
              {EVENT_TYPES.map((x) => (
                <option key={x} value={x}>
                  {EVENT_TYPE_LABELS[x]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Mi grupo de prácticas">
            <select className={selectClass} value={grupo} onChange={(e) => setKv(keys.pref.calGroup, e.target.value)}>
              <option value="todos">Todos</option>
              <option value="G1">G1</option>
              <option value="G2">G2</option>
              <option value="G3">G3</option>
            </select>
          </Labeled>
          <Labeled label="Mi franja de examen">
            <select className={selectClass} value={franja} onChange={(e) => setKv(keys.pref.calSlot, e.target.value)}>
              <option value="todas">Todas</option>
              <option value="F1">F1</option>
              <option value="F2">F2</option>
            </select>
          </Labeled>
          <label className="flex min-h-11 items-center gap-2 self-end text-[14px]">
            <input type="checkbox" checked={pasados} onChange={(e) => setPasados(e.target.checked)} />
            Mostrar eventos pasados
          </label>
        </div>
        {weeks.length === 0 ? <p className="text-muted">No hay eventos con estos filtros.</p> : null}
        {weeks.map((w) => (
          <section key={w.monday} aria-label={`Semana del ${w.monday.slice(8, 10)}/${w.monday.slice(5, 7)}`}>
            <h3 className="mono text-[14px] font-semibold text-muted">{`Semana del ${w.monday.slice(8, 10)}/${w.monday.slice(5, 7)}`}</h3>
            <ul>
              {w.events.map((e) => (
                <EventRow key={e.id} e={e} tz={tz} />
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
