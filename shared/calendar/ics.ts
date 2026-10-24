// Calendario suscribible (RFC 5545) y lectura de un feed externo. Sin dependencias ni `node:`: lo
// usan scripts/build-ics.ts y los tests.
import { CalendarEventSchema, EVENT_TYPE_LABELS, type CalendarEvent, type EventType } from "./types.ts";
import { civilDate, ES, fmtTime, isValidZone, wallToMs } from "./time.ts";

export const UID_DOMAIN = "ia-labs-comunidad";
const CRLF = "\r\n";

/** VTIMEZONE de Europe/Madrid con las reglas vigentes de la UE (último domingo de marzo / octubre). */
const VTIMEZONE_MADRID = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "X-LIC-LOCATION:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escapa texto según RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas a 75 octetos (RFC 5545 §3.1) sin partir caracteres UTF-8. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74; // la línea de continuación empieza con un espacio
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

const wallToIcs = (wall: string) => wall.replace(/[-:]/g, "") + "00";

function stampOf(date: string): string {
  return `${date.replace(/-/g, "")}T000000Z`;
}

export function eventSummary(e: CalendarEvent): string {
  const extra = e.grupo ? ` (${e.grupo})` : e.franja ? ` (${e.franja})` : "";
  return `${e.materia} · ${e.titulo}${extra}`;
}

export function buildIcs(events: readonly CalendarEvent[], calName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IA Labs Comunidad//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    ...VTIMEZONE_MADRID,
  ];
  const sorted = [...events].sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.id < b.id ? -1 : 1));
  for (const e of sorted) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${UID_DOMAIN}`,
      `DTSTAMP:${stampOf(e.actualizado)}`,
      `SEQUENCE:${e.revision ?? 0}`,
      `DTSTART;TZID=Europe/Madrid:${wallToIcs(e.inicio)}`,
      ...(e.fin ? [`DTEND;TZID=Europe/Madrid:${wallToIcs(e.fin)}`] : []),
      `SUMMARY:${escapeText(eventSummary(e))}`,
      `CATEGORIES:${escapeText(EVENT_TYPE_LABELS[e.tipo])}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

// ---------------------------------------------------------------------------------------------
// Feed externo (CALENDAR_ICS_URL): solo se usan UID, SUMMARY, DTSTART y DTEND. DESCRIPTION, URL,
// LOCATION, ATTENDEE, ORGANIZER y cualquier otra propiedad se descartan al leer.

export type FeedEvent = { uid: string; summary: string; startMs: number; endMs: number | null; materia: string };

const KEPT = new Set(["UID", "SUMMARY", "DTSTART", "DTEND"]);

function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
}

/** Fecha-hora iCalendar → ms. Admite UTC (Z), TZID=<zona IANA>, flotante (como Madrid) y VALUE=DATE. */
export function parseIcsDate(params: string, value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", , z] = m;
  if (z) return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const tzid = /TZID=([^;:]+)/i.exec(params)?.[1]?.replace(/^"|"$/g, "");
  const zone = tzid && isValidZone(tzid) ? tzid : ES;
  return wallToMs(`${y}-${mo}-${d}T${h}:${mi}`, zone);
}

export function parseFeed(text: string, materias: readonly string[]): FeedEvent[] {
  const out: FeedEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.SUMMARY && cur.DTSTART) {
        const summary = unescapeText(cur.SUMMARY.value).trim().slice(0, 200);
        const materia = materias.find((c) => new RegExp(`(?:^|[^A-Za-z0-9])${c}(?:$|[^A-Za-z0-9])`, "i").test(summary));
        const startMs = parseIcsDate(cur.DTSTART.params, cur.DTSTART.value);
        if (materia && startMs !== null) {
          const endMs = cur.DTEND ? parseIcsDate(cur.DTEND.params, cur.DTEND.value) : null;
          out.push({ uid: cur.UID?.value ?? "", summary, startMs, endMs, materia });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const semi = head.indexOf(";");
    const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
    if (!KEPT.has(name)) continue;
    cur[name] = { params: semi < 0 ? "" : head.slice(semi + 1), value: line.slice(colon + 1) };
  }
  return out;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function inferType(summary: string): EventType {
  const s = norm(summary);
  if (s.includes("examen")) return "examen";
  if (s.includes("tutor")) return "tutoria";
  if (s.includes("practic")) return "practica";
  if (s.includes("foro")) return "foro";
  if (s.includes("test")) return "test";
  if (s.includes("entrega") || s.includes("evidencia")) return "entrega";
  return "sesion";
}

const MATCH_WINDOW = 15 * 60_000;
const msToWall = (ms: number) => `${civilDate(ES, ms)}T${fmtTime(ES, ms)}`;

function feedId(uid: string, summary: string, startMs: number): string {
  // Identificador estable sin exponer el UID original: hash FNV-1a de 32 bits.
  let h = 0x811c9dc5;
  for (const ch of `${uid}|${summary}|${uid ? "" : startMs}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `feed-${h.toString(16).padStart(8, "0")}`;
}

/**
 * Fusiona el feed con content/: si un evento del feed es de la misma materia y empieza a ±15 min de
 * uno de content/ el mismo día, gana la hora del feed. Los eventos del feed sin pareja se añaden.
 */
export function mergeFeed(events: readonly CalendarEvent[], feed: readonly FeedEvent[], today: string): CalendarEvent[] {
  const out = events.map((e) => ({ ...e }));
  const used = new Set<number>();
  for (const f of feed) {
    const idx = out.findIndex(
      (e, i) =>
        !used.has(i) &&
        e.materia === f.materia &&
        civilDate(ES, wallToMs(e.inicio)) === civilDate(ES, f.startMs) &&
        Math.abs(wallToMs(e.inicio) - f.startMs) <= MATCH_WINDOW,
    );
    if (idx >= 0) {
      used.add(idx);
      const e = out[idx]!;
      const inicio = msToWall(f.startMs);
      const fin = f.endMs && f.endMs > f.startMs ? msToWall(f.endMs) : e.fin;
      if (inicio !== e.inicio || fin !== e.fin) {
        out[idx] = { ...e, inicio, ...(fin ? { fin } : {}), revision: (e.revision ?? 0) + 1, actualizado: today };
      }
      continue;
    }
    const candidate = {
      id: feedId(f.uid, f.summary, f.startMs),
      materia: f.materia,
      tipo: inferType(f.summary),
      titulo: f.summary.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || f.materia,
      inicio: msToWall(f.startMs),
      ...(f.endMs && f.endMs > f.startMs ? { fin: msToWall(f.endMs) } : {}),
      fuente: "Calendario externo del despliegue",
      actualizado: today,
    };
    const parsed = CalendarEventSchema.safeParse(candidate);
    if (parsed.success && !out.some((e) => e.id === parsed.data.id)) out.push(parsed.data);
  }
  return out;
}
