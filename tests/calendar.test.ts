// Calendario: contenido, motor de zonas horarias, .ics y feed externo.
import { describe, expect, it } from "vitest";
import { CALENDARIO } from "../content/calendario/index.ts";
import { buildCalendarFiles } from "../scripts/build-ics.ts";
import { buildIcs, foldLine, mergeFeed, parseFeed } from "../shared/calendar/ics.ts";
import { applyFilters, byWeek, dstNotice, mondayOf, nextClass, nextDeadline, withTimes } from "../shared/calendar/model.ts";
import { civilDate, dayShift, diffFromMadrid, fmtTime, offsetChanges, wallToMs } from "../shared/calendar/time.ts";
import { CalendarEventSchema, CalendarPackSchema } from "../shared/calendar/types.ts";

describe("content/calendario", () => {
  it("cumple CalendarPackSchema", () => {
    const r = CalendarPackSchema.safeParse(CALENDARIO);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  it("no hay ids duplicados y fin es posterior a inicio", () => {
    const ids = CALENDARIO.eventos.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of CALENDARIO.eventos) if (e.fin) expect(e.fin > e.inicio, e.id).toBe(true);
  });

  it("no contiene nombres de personas, tratamientos ni URL", () => {
    const text = JSON.stringify(CALENDARIO);
    expect(text).not.toMatch(/\b(Dr|Dra|MSc|Prof|Profa|Lic|Ing)\.\s/);
    expect(text).not.toMatch(/docente"\s*:/);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
  });

  it("el esquema rechaza un fin anterior al inicio", () => {
    const e = { ...CALENDARIO.eventos[0]!, fin: "2000-01-01T00:00" };
    expect(CalendarEventSchema.safeParse(e).success).toBe(false);
  });
});

describe("zonas horarias", () => {
  it("cambio de hora europeo (25/10/2026): Madrid pasa de +2 a +1 a las 01:00 UTC", () => {
    expect(wallToMs("2026-10-24T20:00")).toBe(Date.UTC(2026, 9, 24, 18, 0));
    expect(wallToMs("2026-10-26T20:00")).toBe(Date.UTC(2026, 9, 26, 19, 0));
    const [c] = offsetChanges("America/Bogota", Date.UTC(2026, 9, 22), 7);
    expect(c).toEqual({ atMs: Date.UTC(2026, 9, 25, 1, 0), beforeMin: 7 * 60, afterMin: 6 * 60 });
  });

  it("Bogotá no cambia de hora: 20:00 España es 13:00 en octubre y 14:00 tras el 25/10", () => {
    expect(fmtTime("America/Bogota", wallToMs("2026-10-22T20:00"))).toBe("13:00");
    expect(fmtTime("America/Bogota", wallToMs("2026-10-27T20:00"))).toBe("14:00");
    expect(offsetChanges("America/Bogota", Date.UTC(2026, 10, 1), 7)).toEqual([]);
  });

  it("cambio de hora de EE. UU. (01/11/2026): Madrid–Chicago pasa de 6 h a 7 h", () => {
    expect(diffFromMadrid("America/Chicago", Date.UTC(2026, 9, 28))).toBe(6 * 60);
    const [c] = offsetChanges("America/Chicago", Date.UTC(2026, 9, 29), 7);
    expect(c).toEqual({ atMs: Date.UTC(2026, 10, 1, 7, 0), beforeMin: 6 * 60, afterMin: 7 * 60 });
    expect(fmtTime("America/Chicago", wallToMs("2026-11-02T20:00"))).toBe("13:00");
  });

  it("medianoche: 20:00 en España es el día siguiente en Tokio y 01:00 en España es el día anterior en Bogotá", () => {
    const a = wallToMs("2026-11-03T20:00");
    expect(civilDate("Asia/Tokyo", a)).toBe("2026-11-04");
    expect(dayShift("Asia/Tokyo", a)).toBe(1);
    const b = wallToMs("2026-11-04T01:00");
    expect(civilDate("America/Bogota", b)).toBe("2026-11-03");
    expect(fmtTime("America/Bogota", b)).toBe("19:00");
    expect(dayShift("America/Bogota", b)).toBe(-1);
  });

  it("la hora repetida del 25/10 elige la primera aparición", () => {
    expect(wallToMs("2026-10-25T02:30")).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });
});

describe("modelo", () => {
  const events = withTimes(CALENDARIO.eventos);

  it("filtra por grupo y franja sin ocultar los eventos comunes", () => {
    const g1 = applyFilters(events, { materia: "todas", tipo: "practica", grupo: "G1", franja: "todas" });
    expect(g1.every((e) => e.grupo === "G1")).toBe(true);
    const all = applyFilters(events, { materia: "02MIAR", tipo: "todos", grupo: "G1", franja: "F2" });
    expect(all.some((e) => !e.grupo && !e.franja)).toBe(true);
    expect(all.some((e) => e.grupo === "G2" || e.franja === "F1")).toBe(false);
  });

  it("lo próximo: siguiente clase y siguiente entrega", () => {
    const now = wallToMs("2026-11-14T12:00");
    expect((nextClass(events, now)?.inicio ?? "") >= "2026-11-14").toBe(true);
    const d = nextDeadline(events, now)!;
    expect(d.tipo).toBe("test"); // la ventana del test sigue abierta hasta el 15/11
  });

  it("agrupa por semanas que empiezan en lunes", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    const w = byWeek(events);
    expect(w[0]!.monday <= w[1]!.monday).toBe(true);
  });

  it("aviso de cambio de hora con los eventos afectados", () => {
    const n = dstNotice(events, "America/Bogota", Date.UTC(2026, 9, 22, 12));
    expect(n?.change.atMs).toBe(Date.UTC(2026, 9, 25, 1));
    expect(n!.affected.some((e) => e.id === "02MIAR-S02")).toBe(true);
    expect(dstNotice(events, "Europe/Madrid", Date.UTC(2026, 9, 22))).toBeNull();
  });
});

describe(".ics", () => {
  const ics = buildIcs(CALENDARIO.eventos, "Prueba");

  it("es RFC 5545: CRLF, VTIMEZONE, TZID, UID estables, DTSTAMP y SEQUENCE", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid");
    expect(ics).toContain("UID:02MIAR-S01@ia-labs-comunidad");
    expect(ics).toContain("DTSTART;TZID=Europe/Madrid:20261022T200000");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain("SEQUENCE:0");
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(CALENDARIO.eventos.length);
    expect(ics).not.toMatch(/^(URL|ATTENDEE|ORGANIZER|DESCRIPTION|LOCATION)[;:]/m);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("escapa comas, puntos y coma, barras y saltos de línea", async () => {
    const { escapeText } = await import("../shared/calendar/ics.ts");
    expect(escapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });

  it("pliega las líneas largas sin partir caracteres", () => {
    const folded = foldLine(`SUMMARY:${"á".repeat(60)}`);
    expect(folded.split("\r\n ").join("")).toBe(`SUMMARY:${"á".repeat(60)}`);
  });
});

const FEED = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:abc-1",
  "SUMMARY:02MIAR Sesión 3 (sala virtual)",
  "DESCRIPTION:Enlace privado https://campus.example.invalid/room?t=SECRETO",
  "LOCATION:https://collab.example.invalid/sala",
  "URL:https://campus.example.invalid/x",
  "ATTENDEE;CN=Alguien:mailto:alguien@example.invalid",
  "ORGANIZER:mailto:docente@example.invalid",
  "DTSTART:20261029T191000Z",
  "DTEND:20261029T211000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:abc-2",
  "SUMMARY:Reunión sin materia",
  "DTSTART:20261030T180000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:abc-3",
  "SUMMARY:01MIAR Tutoría extra",
  "DTSTART;TZID=Europe/Madrid:20261031T180000",
  "DTEND;TZID=Europe/Madrid:20261031T190000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("feed externo (CALENDAR_ICS_URL)", () => {
  it("filtra por materia y descarta los campos sensibles", () => {
    const feed = parseFeed(FEED, ["01MIAR", "02MIAR"]);
    expect(feed.map((f) => f.materia)).toEqual(["02MIAR", "01MIAR"]);
    expect(JSON.stringify(feed)).not.toMatch(/SECRETO|collab|mailto|example\.invalid/);
  });

  it("fusiona: ±15 min gana la hora del feed; lo demás se añade", () => {
    const merged = mergeFeed(CALENDARIO.eventos, parseFeed(FEED, ["01MIAR", "02MIAR"]), "2026-10-24");
    const s3 = merged.find((e) => e.id === "02MIAR-S03")!;
    expect(s3.inicio).toBe("2026-10-29T20:10"); // 19:10 UTC = 20:10 Madrid (CET)
    expect(s3.revision).toBe(1);
    const extra = merged.find((e) => e.materia === "01MIAR" && e.inicio === "2026-10-31T18:00");
    expect(extra?.tipo).toBe("tutoria");
    expect(extra?.id).toMatch(/^feed-[0-9a-f]{8}$/);
  });

  it("la URL del feed nunca llega a los ficheros generados ni a la consola", async () => {
    const url = "https://feeds.example.invalid/personal.ics?t=SUPERSECRETO";
    const logs: string[] = [];
    const fetchImpl = (async () => new Response(FEED, { status: 200 })) as unknown as typeof fetch;
    const r = await buildCalendarFiles({ feedUrl: url, fetchImpl, today: "2026-10-24", log: (m) => logs.push(m) });
    expect(r.feedUsed).toBe(true);
    const all = Object.values(r.files).join("\n") + logs.join("\n");
    expect(all).not.toContain("feeds.example.invalid");
    expect(all).not.toContain("SUPERSECRETO");
    expect(all).not.toContain("campus.example.invalid");
    expect(Object.keys(r.files).sort()).toEqual(["calendario-01MIAR.ics", "calendario-02MIAR.ics", "calendario.ics", "calendario.json"]);
  });

  it("si el feed falla, continúa solo con content/ sin mostrar la URL", async () => {
    const logs: string[] = [];
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed https://feeds.example.invalid/x");
    }) as unknown as typeof fetch;
    const r = await buildCalendarFiles({ feedUrl: "https://feeds.example.invalid/x", fetchImpl, log: (m) => logs.push(m) });
    expect(r.feedUsed).toBe(false);
    expect(logs.join("\n")).not.toContain("example.invalid");
    expect(r.files["calendario.ics"]).toContain("UID:02MIAR-S01@ia-labs-comunidad");
  });
});
