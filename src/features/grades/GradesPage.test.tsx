// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKvStoreForTests, readKvPrefix, setKv } from "../../lib/kv-store.ts";
import { GradesPage } from "./GradesPage.tsx";


function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname + l.search}</span>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <GradesPage />
      <Loc />
    </MemoryRouter>,
  );
}

async function settle(ms = 700) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function type(label: RegExp | string, text: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
  await settle();
}

/** Stored value of a key in the local store (undefined when absent). */
function stored(key: string): unknown {
  return readKvPrefix(key).find((e) => e.key === key)?.value;
}

const card = (id: string) => screen.getByTestId(`target-${id}`);

beforeEach(() => {
  __resetKvStoreForTests();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GradesPage", () => {
  it("defaults to 01MIAR, toggles via URL and focuses the first input", async () => {
    renderAt("/notas");
    await settle(10);
    expect(
      screen.getByRole("heading", { level: 1, name: "Calculadora de notas" }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Evidencia 1/)).toBe(document.activeElement);
    expect(screen.getByText("Introduce tu primera nota")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "02MIAR" }));
    expect(screen.getByTestId("loc").textContent).toBe("/notas?a=02MIAR");
    expect(screen.getByLabelText(/Test de redes neuronales/)).toBeTruthy();
  });

  it("?a=02MIAR selects 02MIAR", () => {
    renderAt("/notas?a=02MIAR");
    expect(screen.getByLabelText(/Foro/)).toBeTruthy();
    expect(screen.getByText("Portafolio · 50 %")).toBeTruthy();
  });

  it("computes live summary and minimum exam grades for 01MIAR", async () => {
    renderAt("/notas");
    for (const l of [
      /Evidencia 1/,
      /Evidencia 2/,
      /Evidencia 3/,
      /Evidencia 4/,
    ])
      await type(l, "10");
    expect(
      screen.getByText("Llevas 6,0 sobre 6,0 puntos posibles"),
    ).toBeTruthy();
    expect(screen.getByText("Portafolio: 10,0")).toBeTruthy();
    const sob = card("sobresaliente");
    expect(within(sob).getByTestId("min-sobresaliente").textContent).toBe(
      "7,5",
    );
    expect(within(sob).getByText("Necesitas 7,5 en el examen")).toBeTruthy();
    expect(
      screen.getByTestId("chip-sobresaliente").getAttribute("data-tone"),
    ).toBe("warn");
    expect(within(card("mh")).getByTestId("min-mh").textContent).toBe("8,8");
    expect(
      within(card("aprobar")).getByText(
        "Necesitas 5,0 en el examen (mínimo por bloque)",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Se concede según el cupo del grupo; aquí se calcula la nota necesaria para optar \(9,5\)\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/conseguido con cualquier/)).toBeNull();
  });

  it("shows exam outcomes", async () => {
    renderAt("/notas");
    for (const l of [
      /Evidencia 1/,
      /Evidencia 2/,
      /Evidencia 3/,
      /Evidencia 4/,
    ])
      await type(l, "10");
    await type(/Examen final/, "5");
    expect(screen.getByText("Nota final: 8,0 · Notable")).toBeTruthy();
    await type(/Examen final/, "4");
    expect(screen.getByText("Nota final: 7,6 · Suspenso")).toBeTruthy();
    expect(screen.getByText("El examen está por debajo de 5,0")).toBeTruthy();
  });

  it("02MIAR with nothing entered: neutral state, no 'No alcanzable' and no 'Llevas' heading", () => {
    renderAt("/notas?a=02MIAR");
    for (const id of ["aprobar", "sobresaliente", "mh"]) {
      expect(
        within(card(id)).getByText(
          "Introduce tus notas para ver cuánto necesitas",
        ),
      ).toBeTruthy();
      expect(within(card(id)).queryByText(/No alcanzable/)).toBeNull();
    }
    expect(screen.queryByText(/Llevas/)).toBeNull();
  });

  it("02MIAR with only Test 1 = 8,0: shows the minimum average over what remains", async () => {
    renderAt("/notas?a=02MIAR");
    await type(/Test de redes/, "8");
    expect(
      within(card("aprobar")).getByText(
        /media de al menos 5,0 en lo que falta/,
      ),
    ).toBeTruthy();
    expect(
      within(card("sobresaliente")).getByText(
        "Necesitas una media de 9,1 en lo que falta (portafolio pendiente y examen)",
      ),
    ).toBeTruthy();
    expect(
      within(card("mh")).getByText(
        "Necesitas una media de 9,7 en lo que falta (portafolio pendiente y examen)",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/en el examen$/)).toBeNull();
  });

  it("02MIAR portfolio below 5,0 blocks every target", async () => {
    renderAt("/notas?a=02MIAR");
    for (const l of [
      /Test de redes/,
      /Test de papers/,
      /Prácticas grupales/,
      /Foro/,
    ])
      await type(l, "4");
    expect(
      screen.getByText(
        "Tu portafolio está en 4,0: necesitas al menos 5,0 en el bloque de portafolio para aprobar en esta convocatoria.",
      ),
    ).toBeTruthy();
    for (const id of ["aprobar", "sobresaliente", "mh"]) {
      expect(
        within(card(id)).getByText(
          "No alcanzable en esta convocatoria: el portafolio está por debajo de 5,0",
        ),
      ).toBeTruthy();
    }
  });

  it("partial portfolio shows only the informational line and provisional result", async () => {
    renderAt("/notas?a=02MIAR");
    await type(/Test de redes/, "4");
    expect(screen.queryByTestId("portfolio-warning")).toBeNull();
    expect(
      screen.getByText(
        "Con lo introducido hasta ahora, tu portafolio va en 0,6 (los pendientes cuentan como 0). Recuerda que necesitas al menos 5,0 en el bloque de portafolio.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/por debajo de 5,0$/)).toBeNull();
    await type(/Examen final/, "10");
    expect(
      screen.getByText(/^Nota final provisional: .* \(provisional\)$/),
    ).toBeTruthy();
    expect(screen.queryByText(/Suspenso por portafolio/)).toBeNull();
  });

  it("persists the MH threshold and relabels the card", async () => {
    renderAt("/notas");
    await type("Umbral de MH", "9,3");
    expect(stored("pref/mhThreshold")).toBe(930);
    expect(screen.getByText("Matrícula de Honor · 9,3")).toBeTruthy();
  });

  it("rejects out-of-range input without writing", async () => {
    renderAt("/notas");
    await type(/Evidencia 1/, "11");
    expect(screen.getByText("La nota debe estar entre 0 y 10.")).toBeTruthy();
    expect(readKvPrefix("grade/")).toHaveLength(0);
  });

  it("writes the grade once, 600 ms after typing", async () => {
    renderAt("/notas");
    fireEvent.change(screen.getByLabelText(/Evidencia 1/), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText(/Evidencia 1/), {
      target: { value: "6,5" },
    });
    await settle(500);
    expect(readKvPrefix("grade/")).toHaveLength(0);
    await settle(200);
    expect(readKvPrefix("grade/")).toEqual([{ key: "grade/01MIAR/ev1", value: 650 }]);
  });

  it("restablecer notas asks for confirmation and deletes every 01MIAR key", async () => {
    renderAt("/notas");
    await type(/Evidencia 1/, "7");
    setKv("grade/02MIAR/foro", 800);
    fireEvent.click(screen.getByRole("button", { name: "Restablecer notas" }));
    expect(
      screen.getByText(
        "Restablecer notas: se borrarán las notas de 01MIAR guardadas en este navegador. No se puede deshacer.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Conservar notas" }),
    ).toBeTruthy();
    const confirm = screen
      .getAllByRole("button", { name: "Restablecer notas" })
      .at(-1)!;
    fireEvent.click(confirm);
    await settle(10);
    expect(readKvPrefix("grade/01MIAR/")).toEqual([]);
    expect(stored("grade/02MIAR/foro")).toBe(800);
    expect(
      (screen.getByLabelText(/Evidencia 1/) as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows a stored grade with its exact decimals", async () => {
    setKv("grade/01MIAR/ev1", 725);
    renderAt("/notas");
    expect(
      (screen.getByLabelText(/Evidencia 1/) as HTMLInputElement).value,
    ).toBe("7,25");
  });
});
