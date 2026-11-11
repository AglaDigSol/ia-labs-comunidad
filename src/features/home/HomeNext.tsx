// «Próximo en el calendario» del inicio (módulo calendario): la próxima clase y la próxima entrega, con
// la hora de España y la de la zona elegida en el calendario, y la cuenta atrás. Respeta el grupo y la
// franja guardados. Chunk aparte: el calendario solo se carga si el módulo está encendido.
import { CalendarClock } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { subjectLabel } from "../../../shared/courses/subjects.ts";
import { applyFilters, nextClass, nextDeadline, withTimes, type Filters, type TimedEvent } from "../../../shared/calendar/model.ts";
import { ES, fmtDay, fmtTime, formatCountdown, isValidZone } from "../../../shared/calendar/time.ts";
import { keys } from "../../../shared/keys.ts";
import { buttonVariants } from "../../components/ui/button.tsx";
import { t } from "../../i18n/index.ts";
import { useKv } from "../../lib/kv-store.ts";
import { useNow } from "../../lib/use-now.ts";
import { useEvents } from "../calendar/events.ts";
import { detectZone, zoneLabel } from "../calendar/zones.ts";
import { HomeCard } from "./HomeCard.tsx";

function When({ e, tz }: { e: TimedEvent; tz: string }) {
  const spain = `${fmtDay(ES, e.startMs)} ${fmtTime(ES, e.startMs)} España`;
  return (
    <span className="mono text-[14px]">
      {spain}
      {tz === ES ? null : (
        <>
          {" · "}
          <strong className="font-semibold">{`${fmtDay(tz, e.startMs)} ${fmtTime(tz, e.startMs)} ${zoneLabel(tz)}`}</strong>
        </>
      )}
    </span>
  );
}

function NextLine({ title, e, tz, now }: { title: string; e: TimedEvent | null; tz: string; now: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-[14px] font-semibold text-muted">{title}</h3>
      {e ? (
        <>
          <p className="font-semibold">{`${subjectLabel(e.materia, "tag")} · ${e.titulo}${e.grupo ? ` (${e.grupo})` : e.franja ? ` (${e.franja})` : ""}`}</p>
          <When e={e} tz={tz} />
          <p className="text-[14px] text-muted">{e.startMs > now ? `Empieza en ${formatCountdown(e.startMs - now)}` : "En curso"}</p>
        </>
      ) : (
        <p className="text-[14px] text-muted">Nada pendiente.</p>
      )}
    </div>
  );
}

export function HomeNext() {
  const { events: raw } = useEvents();
  const events = useMemo(() => withTimes(raw), [raw]);
  const now = useNow(30_000);
  const storedTz = useKv<string | null>(keys.pref.timeZone, null);
  const tz = storedTz && isValidZone(storedTz) ? storedTz : detectZone();
  const grupo = useKv<Filters["grupo"]>(keys.pref.calGroup, "todos");
  const franja = useKv<Filters["franja"]>(keys.pref.calSlot, "todas");
  const mine = useMemo(() => applyFilters(events, { materia: "todas", tipo: "todos", grupo, franja }), [events, grupo, franja]);
  return (
    <HomeCard title={t.home.nextTitle} icon={CalendarClock}>
      <NextLine title="Próxima clase" e={nextClass(mine, now)} tz={tz} now={now} />
      <NextLine title="Próxima entrega" e={nextDeadline(mine, now)} tz={tz} now={now} />
      <div className="mt-auto">
        <Link to="/calendario" className={buttonVariants({ variant: "secondary" })}>
          Ver el calendario
        </Link>
      </div>
    </HomeCard>
  );
}
