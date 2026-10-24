// Genera dist/calendario.ics, dist/calendario-<materia>.ics y dist/calendario.json a partir de
// content/calendario. Se ejecuta en `npm run build`, después de `vite build`.
//
// CALENDAR_ICS_URL (opcional, solo en build): feed iCalendar externo que se fusiona con content/.
// La URL nunca se escribe en dist/, ni en la consola, ni en el bundle.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CALENDARIO } from "../content/calendario/index.ts";
import { buildIcs, mergeFeed, parseFeed } from "../shared/calendar/ics.ts";
import { CalendarPackSchema, type CalendarEvent } from "../shared/calendar/types.ts";

export type BuildResult = { files: Record<string, string>; feedUsed: boolean; feedEvents: number };

export async function buildCalendarFiles(opts: {
  feedUrl?: string | undefined;
  fetchImpl?: typeof fetch;
  today?: string;
  log?: (msg: string) => void;
}): Promise<BuildResult> {
  const log = opts.log ?? console.log;
  const pack = CalendarPackSchema.parse(CALENDARIO);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  let events: CalendarEvent[] = pack.eventos;
  let feedUsed = false;
  let feedEvents = 0;
  const url = opts.feedUrl?.trim();
  if (url) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 5 * 1024 * 1024) throw new Error("feed demasiado grande");
      const materias = [...new Set(pack.eventos.map((e) => e.materia))];
      const feed = parseFeed(text, materias);
      feedEvents = feed.length;
      events = mergeFeed(events, feed, today);
      feedUsed = true;
      log(`[calendario] Feed externo fusionado: ${feed.length} eventos de materias conocidas.`);
    } catch (e) {
      const reason = e instanceof Error ? e.name : "error";
      log(`[calendario] No se pudo usar el feed externo (${reason}); se usa solo content/.`);
    }
  }
  const files: Record<string, string> = {};
  files["calendario.ics"] = buildIcs(events, "IA Labs · Calendario");
  for (const m of [...new Set(events.map((e) => e.materia))].sort()) {
    files[`calendario-${m}.ics`] = buildIcs(
      events.filter((e) => e.materia === m),
      `IA Labs · ${m}`,
    );
  }
  files["calendario.json"] = JSON.stringify({ version: 1, generado: today, eventos: events });
  return { files, feedUsed, feedEvents };
}

async function main() {
  const out = process.argv[2] ?? "dist";
  const { files } = await buildCalendarFiles({ feedUrl: process.env.CALENDAR_ICS_URL });
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(out, name), body, "utf8");
  console.log(`[calendario] ${Object.keys(files).length} ficheros en ${out}/`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
