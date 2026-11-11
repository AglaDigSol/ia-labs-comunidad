// «Mis grupos»: filtro por materia, migración desde la preferencia global, validación del almacén y
// .ics filtrados del build (nombres, número, contenido y clave).
import { describe, expect, it } from "vitest";
import { CALENDARIO } from "../content/calendario/index.ts";
import { buildCalendarFiles } from "../scripts/build-ics.ts";
import {
  applyGroupPrefs,
  combinedCount,
  effectiveGroupPrefs,
  feedEvents,
  filteredFeedName,
  filteredFeeds,
  MAX_COMBINED_FEEDS,
  normalizeChoice,
  pickFeed,
  subjectGroups,
  type FilteredFeed,
  type GroupPrefs,
} from "../shared/calendar/groups.ts";
import { keys, validateValue } from "../shared/keys.ts";

const EVENTS = CALENDARIO.eventos;
const OPTIONS = subjectGroups(EVENTS);
const GATEWAY = /^calendario[A-Za-z0-9-]*\.ics$/;

describe("subjectGroups y normalizeChoice", () => {
  it("deriva de los eventos qué grupos y franjas tiene cada materia", () => {
    expect(OPTIONS).toEqual([
      { materia: "01MIAR", grupos: ["G1", "G2", "G3"], franjas: ["F1", "F2"] },
      { materia: "02MIAR", grupos: ["G1", "G2", "G3"], franjas: ["F1", "F2"] },
    ]);
    expect(subjectGroups([{ materia: "X1", grupo: "G2" }, { materia: "Y1" }])).toEqual([{ materia: "X1", grupos: ["G2"], franjas: [] }]);
  });

  it("lo desconocido o lo que no existe en la materia pasa a «todos» / «todas»", () => {
    expect(normalizeChoice({ grupo: "G9", franja: "F3" })).toEqual({ grupo: "todos", franja: "todas" });
    expect(normalizeChoice("G1")).toEqual({ grupo: "todos", franja: "todas" });
    expect(normalizeChoice({ grupo: "G3", franja: "F1" }, { materia: "X1", grupos: ["G1"], franjas: ["F1"] })).toEqual({
      grupo: "todos",
      franja: "F1",
    });
  });
});

describe("migración desde pref/calGroup y pref/calSlot", () => {
  it("sin la clave nueva, cada materia toma la elección global antigua", () => {
    expect(effectiveGroupPrefs(undefined, { grupo: "G2", franja: "F1" }, OPTIONS)).toEqual({
      "01MIAR": { grupo: "G2", franja: "F1" },
      "02MIAR": { grupo: "G2", franja: "F1" },
    });
  });

  it("con la clave nueva, la antigua no cuenta (y una materia que falta no se filtra)", () => {
    const stored = { "02MIAR": { grupo: "G3", franja: "F2" } };
    expect(effectiveGroupPrefs(stored, { grupo: "G1", franja: "F1" }, OPTIONS)).toEqual({
      "01MIAR": { grupo: "todos", franja: "todas" },
      "02MIAR": { grupo: "G3", franja: "F2" },
    });
  });

  it("sin nada guardado, todo se ve", () => {
    expect(effectiveGroupPrefs(undefined, {}, OPTIONS)).toEqual({
      "01MIAR": { grupo: "todos", franja: "todas" },
      "02MIAR": { grupo: "todos", franja: "todas" },
    });
  });
});

describe("validación de pref/calGroups (lectura y copia importada)", () => {
  it("acepta el mapa por materia, también con valores desconocidos (se leen como «todos»)", () => {
    expect(validateValue(keys.pref.calGroups, { "01MIAR": { grupo: "G1", franja: "F2" } })).toEqual({ ok: true });
    expect(validateValue(keys.pref.calGroups, { "01MIAR": { grupo: "G7" } })).toEqual({ ok: true });
    expect(validateValue(keys.pref.calGroups, {})).toEqual({ ok: true });
  });

  it("rechaza otras formas", () => {
    expect(validateValue(keys.pref.calGroups, "G1").ok).toBe(false);
    expect(validateValue(keys.pref.calGroups, { "../x": { grupo: "G1" } }).ok).toBe(false);
    expect(validateValue(keys.pref.calGroups, { "01MIAR": { grupo: "G1", otro: 1 } }).ok).toBe(false);
    expect(validateValue(keys.pref.calGroups, { "01MIAR": { grupo: "x".repeat(40) } }).ok).toBe(false);
  });

  it("las claves antiguas siguen siendo válidas (copias exportadas antes)", () => {
    expect(validateValue(keys.pref.calGroup, "G2")).toEqual({ ok: true });
    expect(validateValue(keys.pref.calSlot, "F1")).toEqual({ ok: true });
  });
});

describe("applyGroupPrefs", () => {
  const prefs: GroupPrefs = { "01MIAR": { grupo: "G1", franja: "todas" }, "02MIAR": { grupo: "G2", franja: "F2" } };
  const mine = applyGroupPrefs(EVENTS, prefs);

  it("cada materia con su grupo y su franja; los eventos comunes se quedan", () => {
    expect(mine.filter((e) => e.materia === "01MIAR" && e.grupo).every((e) => e.grupo === "G1")).toBe(true);
    expect(mine.filter((e) => e.materia === "01MIAR" && e.franja).map((e) => e.franja).sort()).toEqual(["F1", "F1", "F2", "F2"]);
    expect(mine.filter((e) => e.materia === "02MIAR" && e.grupo).every((e) => e.grupo === "G2")).toBe(true);
    expect(mine.filter((e) => e.materia === "02MIAR" && e.franja).every((e) => e.franja === "F2")).toBe(true);
    const common = EVENTS.filter((e) => !e.grupo && !e.franja);
    expect(common.length).toBeGreaterThan(0);
    for (const e of common) expect(mine).toContain(e);
  });

  it("una materia sin elección no se filtra", () => {
    expect(applyGroupPrefs(EVENTS, {})).toEqual(EVENTS);
  });
});

describe(".ics filtrados", () => {
  const feeds = filteredFeeds(OPTIONS, "calendario");

  it("nombres limpios que entran en la regla del servidor", () => {
    expect(filteredFeedName("calendario", "01MIAR", { "01MIAR": { grupo: "G2", franja: "F1" } })).toBe("calendario-01MIAR-G2-F1.ics");
    expect(
      filteredFeedName("calendario", "todas", { "02MIAR": { grupo: "todos", franja: "todas" }, "01MIAR": { grupo: "G2", franja: "F1" } }),
    ).toBe("calendario-todas-01MIAR-G2-F1-02MIAR-todos-todas.ics");
    for (const f of feeds) expect(f.file).toMatch(GATEWAY);
    expect(new Set(feeds.map((f) => f.file)).size).toBe(feeds.length);
  });

  it("11 por materia y 143 combinados («todos/todas» es el .ics de siempre)", () => {
    expect(combinedCount(OPTIONS)).toBe(144);
    expect(feeds.filter((f) => f.materia === "01MIAR")).toHaveLength(11);
    expect(feeds.filter((f) => f.materia === "02MIAR")).toHaveLength(11);
    expect(feeds.filter((f) => f.materia === "todas")).toHaveLength(143);
  });

  it(`por encima de ${MAX_COMBINED_FEEDS} combinaciones solo hay .ics por materia`, () => {
    const many = ["A1", "B1", "C1"].map((materia) => ({ materia, grupos: ["G1", "G2", "G3"] as const, franjas: ["F1", "F2"] as const }));
    const opts = many.map((s) => ({ ...s, grupos: [...s.grupos], franjas: [...s.franjas] }));
    expect(combinedCount(opts)).toBe(1728);
    const fs = filteredFeeds(opts, "calendario");
    expect(fs.some((f) => f.materia === "todas")).toBe(false);
    expect(fs).toHaveLength(33);
    expect(pickFeed(fs, "todas", { A1: { grupo: "G1", franja: "todas" } })).toEqual({ kind: "missing" });
  });

  it("pickFeed elige el fichero de la elección, o el de siempre si no hay nada que filtrar", () => {
    const prefs: GroupPrefs = { "01MIAR": { grupo: "G2", franja: "F1" }, "02MIAR": { grupo: "todos", franja: "todas" } };
    expect(pickFeed(feeds, "01MIAR", prefs)).toEqual({ kind: "feed", file: "calendario-01MIAR-G2-F1.ics" });
    expect(pickFeed(feeds, "02MIAR", prefs)).toEqual({ kind: "unfiltered" });
    expect(pickFeed(feeds, "todas", prefs)).toEqual({ kind: "feed", file: "calendario-todas-01MIAR-G2-F1-02MIAR-todos-todas.ics" });
    expect(pickFeed(feeds, "todas", { "01MIAR": { grupo: "todos", franja: "todas" } })).toEqual({ kind: "unfiltered" });
  });

  it("el .ics de 02MIAR G2 no tiene prácticas de G1 ni G3, pero sí los eventos comunes", () => {
    const f: FilteredFeed = feeds.find((x) => x.file === "calendario-02MIAR-G2-todas.ics")!;
    const evs = feedEvents(EVENTS, f);
    expect(evs.every((e) => e.materia === "02MIAR")).toBe(true);
    expect(evs.some((e) => e.grupo === "G1" || e.grupo === "G3")).toBe(false);
    expect(evs.some((e) => e.grupo === "G2")).toBe(true);
    expect(evs.some((e) => e.franja === "F1") && evs.some((e) => e.franja === "F2")).toBe(true);
    expect(evs.some((e) => !e.grupo && !e.franja)).toBe(true);
  });
});

describe("build: .ics filtrados", () => {
  const KEY = "c".repeat(20) + "-" + "d2".repeat(10);

  it("genera los ficheros, el mismo UID y SEQUENCE en todos y la lista en calendario.json", async () => {
    const { files } = await buildCalendarFiles({ today: "2026-10-24", log: () => {} });
    const names = Object.keys(files);
    expect(names.filter((n) => n.endsWith(".ics"))).toHaveLength(3 + 165);
    for (const n of names.filter((x) => x.endsWith(".ics"))) expect(n).toMatch(GATEWAY);
    // Los de siempre siguen ahí.
    for (const n of ["calendario.ics", "calendario-01MIAR.ics", "calendario-02MIAR.ics"]) expect(names).toContain(n);

    const g2 = files["calendario-02MIAR-G2-todas.ics"]!;
    expect(g2).toContain("UID:02MIAR-P01-G2@ia-labs-comunidad");
    expect(g2).toContain("UID:02MIAR-S01@ia-labs-comunidad");
    expect(g2).not.toContain("UID:02MIAR-P01-G1@");
    expect(g2).not.toContain("UID:02MIAR-P01-G3@");
    expect(g2).not.toContain("UID:01MIAR-");
    expect(g2).toContain("X-WR-CALNAME:IA Labs · 02MIAR G2");

    const vevent = (ics: string, uid: string) => {
      const i = ics.indexOf(`UID:${uid}@`);
      return ics.slice(i, ics.indexOf("END:VEVENT", i));
    };
    const combined = files["calendario-todas-01MIAR-G1-F2-02MIAR-G2-todas.ics"]!;
    for (const uid of ["02MIAR-P01-G2", "02MIAR-S01"]) {
      expect(vevent(g2, uid)).toBe(vevent(files["calendario.ics"]!, uid));
      expect(vevent(combined, uid)).toBe(vevent(files["calendario.ics"]!, uid));
    }
    expect(combined).toContain("UID:01MIAR-P01-G1@");
    expect(combined).not.toContain("UID:01MIAR-P01-G2@");

    const json = JSON.parse(files["calendario.json"]!) as { suscripciones: unknown[]; filtrados: FilteredFeed[] };
    expect(json.suscripciones).toHaveLength(3);
    expect(json.filtrados).toHaveLength(165);
    expect(new Set(json.filtrados.map((f) => f.file))).toEqual(new Set(names.filter((n) => /-(?:todos|G\d)-(?:todas|F\d)\.ics$/.test(n))));
  });

  it("con clave: todos los nombres la llevan, solo calendario.json los lista y ningún .ics la contiene", async () => {
    const { files } = await buildCalendarFiles({ icsKey: KEY, today: "2026-10-24", log: () => {} });
    const ics = Object.keys(files).filter((n) => n.endsWith(".ics"));
    expect(ics).toHaveLength(168);
    for (const n of ics) {
      expect(n.startsWith(`calendario-${KEY}`)).toBe(true);
      expect(n).toMatch(GATEWAY);
      expect(files[n]).not.toContain(KEY);
    }
    expect(ics).toContain(`calendario-${KEY}-02MIAR-G2-F1.ics`);
    expect(ics).toContain(`calendario-${KEY}-todas-01MIAR-todos-F1-02MIAR-G3-todas.ics`);
    const json = JSON.parse(files["calendario.json"]!) as { filtrados: FilteredFeed[] };
    expect(json.filtrados.every((f) => f.file.startsWith(`calendario-${KEY}-`))).toBe(true);
  });
});
