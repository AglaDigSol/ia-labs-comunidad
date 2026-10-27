// @vitest-environment jsdom
// Prueba de consumidor: usa los laboratorios como los usaría una app anfitriona, importando solo
// desde la entrada de la biblioteca (src/embed/index.ts).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_SYMBOLS,
  buildTable,
  configureLabs,
  evolve,
  frac,
  LabsRoutes,
  MemoryAdapter,
  parseFormula,
  review,
  type LabsActiveTab,
  type LabsExtraTab,
} from "../src/embed/index.ts";

let storage: MemoryAdapter;

beforeEach(() => {
  storage = new MemoryAdapter();
  configureLabs({ storage });
});

afterEach(() => {
  cleanup();
  configureLabs();
  localStorage.clear();
});

const python: LabsExtraTab = { id: "python", label: "Python", path: "python", element: <p>Zona de Python del anfitrión</p> };

function Loc() {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname + l.search}</span>;
}

function renderAt(url: string, mount = "/laboratorios", onHeader?: (a: LabsActiveTab | null) => void) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path={`${mount}/*`}
          element={
            <LabsRoutes
              extraTabs={[python]}
              renderHeaderAction={(active) => {
                onHeader?.(active);
                return <span data-testid="header-action">{active?.label ?? "ninguna"}</span>;
              }}
            />
          }
        />
      </Routes>
      <Loc />
    </MemoryRouter>,
  );
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);

describe("LabsRoutes como dependencia", () => {
  it("muestra los tres laboratorios y la pestaña extra, con el elemento del anfitrión en su ruta", async () => {
    renderAt("/laboratorios/python");
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Markov", "Python"]);
    expect(await screen.findByText("Zona de Python del anfitrión")).toBeTruthy();
    const tab = screen.getByRole("tab", { name: "Python" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(tab.getAttribute("href")).toBe("/laboratorios/python");
    expect(screen.getByTestId("header-action").textContent).toBe("Python");
  });

  it("navega entre pestañas y resuelve los enlaces respecto a donde está montada", async () => {
    renderAt("/estudio/labs/simbolos", "/estudio/labs");
    expect(screen.getByRole("tab", { name: "Lógica" }).getAttribute("href")).toBe("/estudio/labs/logica");
    fireEvent.click(screen.getByRole("tab", { name: "Python" }));
    expect(screen.getByTestId("loc").textContent).toBe("/estudio/labs/python");
    expect(await screen.findByText("Zona de Python del anfitrión")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Simbología" }).getAttribute("aria-selected")).toBe("false");
  });

  it("una pestaña extra no puede ocupar la ruta de un laboratorio", () => {
    render(
      <MemoryRouter initialEntries={["/laboratorios/simbolos"]}>
        <Routes>
          <Route
            path="/laboratorios/*"
            element={<LabsRoutes extraTabs={[{ id: "otra", label: "Otra", path: "logica", element: <p>Otra</p> }]} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Markov"]);
  });

  it("guarda el estado en el almacén que inyecta el anfitrión, no en localStorage", async () => {
    renderAt("/laboratorios/logica?f=p%20%E2%86%92%20q");
    fireEvent.click(await screen.findByRole("radio", { name: "V / F" }, { timeout: 5000 }));
    await waitFor(() => expect(storage.load()?.logicFormat).toBe("VF"));
    expect(localStorage.length).toBe(0);
  });

  it("exporta los motores", () => {
    expect(ALL_SYMBOLS.length).toBeGreaterThan(50);
    const parsed = parseFormula("p → q");
    expect(parsed.ok).toBe(true);
    const table = parsed.ok ? buildTable(parsed.ast) : null;
    expect(table?.ok && table.rows).toHaveLength(4);
    expect(evolve([[frac(1n)]], [frac(1n)], 1).vectors).toHaveLength(2);
    expect(review(null, 5, "2026-10-27").n).toBe(1);
  });
});
