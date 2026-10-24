// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKvStoreForTests, readKvPrefix } from "../../lib/kv-store.ts";
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

  it("el grupo elegido oculta las prácticas de otros grupos y se guarda en local", () => {
    render(<CalendarPage />);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "practica" } });
    expect(screen.getAllByText("Grupo G3").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Mi grupo de prácticas"), { target: { value: "G1" } });
    expect(screen.queryByText("Grupo G3")).toBeNull();
    expect(readKvPrefix("pref/calGroup")).toEqual([{ key: "pref/calGroup", value: "G1" }]);
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
