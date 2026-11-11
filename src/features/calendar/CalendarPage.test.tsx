// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKvStoreForTests, readKvPrefix, setKv } from "../../lib/kv-store.ts";
import { CalendarPage } from "./CalendarPage.tsx";

beforeEach(() => {
  __resetKvStoreForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 0)));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CalendarPage", () => {
  it("muestra el aviso, lo próximo y la hora de España y la tuya", () => {
    render(<CalendarPage />);
    expect(screen.getByText("Calendario orientativo, no oficial. Manda lo que publique OnCampus/Blackboard.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mi ciudad"), { target: { value: "America/Bogota" } });
    expect(readKvPrefix("pref/timeZone")).toEqual([{ key: "pref/timeZone", value: "America/Bogota" }]);
    const next = within(screen.getByRole("region", { name: "Lo próximo" }));
    expect(next.getByText("Próxima clase")).toBeTruthy();
    expect(next.getAllByText(/20:00–22:00 España/).length).toBeGreaterThan(0);
    expect(next.getAllByText(/13:00–15:00 Bogotá/).length).toBeGreaterThan(0);
    // 22/10 → 25/10: Bogotá ve el cambio de hora europeo.
    expect(screen.getByText(/Cambio de hora el .*: la diferencia con España pasa de 7 h a 6 h\./)).toBeTruthy();
  });

  it("«Mis grupos»: un grupo y una franja por materia, solo con los que existen, y se guardan en local", () => {
    render(<CalendarPage />);
    const mine = within(screen.getByRole("region", { name: "Mis grupos" }));
    expect(mine.getByText("Solo verás las prácticas de tu grupo y los exámenes de tu franja.", { exact: false })).toBeTruthy();
    const mates = within(mine.getByRole("group", { name: "02MIAR · Matemáticas para la IA" }));
    const grupo = mates.getByLabelText("Grupo de prácticas") as HTMLSelectElement;
    expect([...grupo.options].map((o) => o.value)).toEqual(["todos", "G1", "G2", "G3"]);
    const franja = mates.getByLabelText("Franja de examen") as HTMLSelectElement;
    expect([...franja.options].map((o) => o.value)).toEqual(["todas", "F1", "F2"]);

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "practica" } });
    fireEvent.change(screen.getByLabelText("Materia"), { target: { value: "02MIAR" } });
    expect(screen.getAllByText("Grupo G3").length).toBeGreaterThan(0);
    fireEvent.change(grupo, { target: { value: "G1" } });
    expect(screen.queryByText("Grupo G3")).toBeNull();
    expect(screen.getAllByText("Grupo G1").length).toBeGreaterThan(0);
    // 01MIAR no cambia.
    fireEvent.change(screen.getByLabelText("Materia"), { target: { value: "01MIAR" } });
    expect(screen.getAllByText("Grupo G3").length).toBeGreaterThan(0);
    expect(readKvPrefix("pref/calGroups")).toEqual([
      { key: "pref/calGroups", value: { "01MIAR": { grupo: "todos", franja: "todas" }, "02MIAR": { grupo: "G1", franja: "todas" } } },
    ]);
  });

  it("migra el grupo y la franja globales antiguos a todas las materias", () => {
    setKv("pref/calGroup", "G2");
    setKv("pref/calSlot", "F1");
    render(<CalendarPage />);
    for (const name of ["01MIAR · Python para la IA", "02MIAR · Matemáticas para la IA"]) {
      const g = within(screen.getByRole("group", { name }));
      expect((g.getByLabelText("Grupo de prácticas") as HTMLSelectElement).value).toBe("G2");
      expect((g.getByLabelText("Franja de examen") as HTMLSelectElement).value).toBe("F1");
    }
    fireEvent.change(within(screen.getByRole("group", { name: "01MIAR · Python para la IA" })).getByLabelText("Franja de examen"), {
      target: { value: "F2" },
    });
    expect(readKvPrefix("pref/calGroups")[0]!.value).toEqual({
      "01MIAR": { grupo: "G2", franja: "F2" },
      "02MIAR": { grupo: "G2", franja: "F1" },
    });
  });

  it("«Suscribirme» con mis grupos ofrece la URL de mi selección y avisa de que es fija", () => {
    render(<CalendarPage />);
    fireEvent.change(within(screen.getByRole("group", { name: "01MIAR · Python para la IA" })).getByLabelText("Grupo de prácticas"), {
      target: { value: "G3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
    const dialog = within(screen.getByRole("dialog"));
    const o = window.location.origin;
    expect(dialog.getByText("Todas las materias con mis grupos")).toBeTruthy();
    expect(dialog.getByText(`${o}/calendario-todas-01MIAR-G3-todas-02MIAR-todos-todas.ics`)).toBeTruthy();
    expect(dialog.getByText("01MIAR · Python para la IA (G3)")).toBeTruthy();
    expect(dialog.getByText(`${o}/calendario-01MIAR-G3-todas.ics`)).toBeTruthy();
    expect(dialog.getByText("02MIAR · Matemáticas para la IA (todos los grupos)")).toBeTruthy();
    expect(dialog.getAllByText(`${o}/calendario-02MIAR.ics`).length).toBeGreaterThan(0);
    expect(dialog.getByText(/vuelve aquí y suscríbete a la URL nueva/)).toBeTruthy();
  });

  it("«Suscribirme» usa los nombres de calendario.json (con clave)", async () => {
    const K = "k".repeat(32);
    const body = {
      version: 1,
      eventos: (await import("../../../content/calendario/index.ts")).CALENDARIO.eventos,
      suscripciones: [
        { label: "Todas las materias", file: `calendario-${K}.ics` },
        { label: "01MIAR", file: `calendario-${K}-01MIAR.ics` },
        { label: "02MIAR", file: `calendario-${K}-02MIAR.ics` },
      ],
      filtrados: [
        { file: `calendario-${K}-02MIAR-G2-F2.ics`, materia: "02MIAR", seleccion: { "02MIAR": { grupo: "G2", franja: "F2" } } },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    setKv("pref/calGroups", { "02MIAR": { grupo: "G2", franja: "F2" } });
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
    await vi.waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByText(`${window.location.origin}/calendario-${K}-02MIAR-G2-F2.ics`)).toBeTruthy();
    });
    const dialog = within(screen.getByRole("dialog"));
    // La combinación no está en la lista: se dice, sin inventar un nombre.
    expect(dialog.getByText("No hay un calendario con esta combinación. Suscríbete a cada materia.")).toBeTruthy();
    expect(dialog.getAllByText(`${window.location.origin}/calendario-${K}-01MIAR.ics`).length).toBeGreaterThan(0);
  });

  it("«Suscribirme» ofrece la URL absoluta y la descarga del .ics", () => {
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: "Suscribirme" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(`${window.location.origin}/calendario.ics`)).toBeTruthy();
    expect(dialog.getByText(`${window.location.origin}/calendario-02MIAR.ics`)).toBeTruthy();
    expect(dialog.getAllByRole("link", { name: "Descargar .ics" })[0]!.getAttribute("href")).toBe(
      `${window.location.origin}/calendario.ics`,
    );
  });
});

describe("DualTime: day of each side", () => {
  it("a Spain-midnight multi-day window shows Spain's own dates and both ends in Bogotá", async () => {
    const { withTimes } = await import("../../../shared/calendar/model.ts");
    const { DualTimeForTest } = await import("./CalendarPage.tsx");
    const [e] = withTimes([
      { id: "x-test", materia: "02MIAR", tipo: "test", titulo: "Test", inicio: "2026-11-14T00:00", fin: "2026-11-15T23:59" } as never,
    ]);
    const { container } = render(<DualTimeForTest e={e!} tz="America/Bogota" withDay />);
    const text = container.textContent ?? "";
    expect(text).toContain("sáb 14/11 00:00 – dom 15/11 23:59 España");
    expect(text).toContain("vie 13/11 18:00 – dom 15/11 17:59");
  });
});
