// @vitest-environment jsdom
// La pestaña Python en Laboratorios: apagada por defecto (sin pestaña, sin ruta y sin chunk), tras
// «Ejercicios» cuando se enciende, y con su id reservado solo entonces.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, MODULES, PYTHON_TAB } from "../../../config.ts";
import { LABS, LabsRoutes, PYTHON_LAB, type LabsExtraTab } from "../labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function Loc() {
  return <span data-testid="loc">{useLocation().pathname}</span>;
}

function renderLabs(url: string, props: { python?: boolean; extraTabs?: LabsExtraTab[] } = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes {...props} />} />
      </Routes>
      <Loc />
    </MemoryRouter>,
  );
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);
const BASE_TABS = ["Simbología", "Lógica", "Predicados", "Conjuntos", "Álgebra de Boole", "Álgebra lineal", "Cálculo", "Probabilidad", "Markov", "Ejercicios"];

describe("pestaña Python: interruptor", () => {
  it("config.modules.python viene apagado y, sin build, PYTHON_TAB lo sigue", () => {
    expect(config.modules.python).toBe(false);
    expect(PYTHON_TAB).toBe(false);
    // No es un módulo de la navegación: es una pestaña de Laboratorios.
    expect(MODULES.map((m) => m.id)).not.toContain("python");
  });

  it("apagada: ni pestaña ni ruta (redirige a Simbología) ni descarga de su código", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    renderLabs("/laboratorios/python");
    expect(tabNames()).toEqual(BASE_TABS);
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/laboratorios/simbolos"));
    expect(LABS.map((l) => l.id)).not.toContain("python");
    expect(worker).not.toHaveBeenCalled();
  });

  it("una pestaña desconocida redirige a Simbología una sola vez (sin alargar la URL)", async () => {
    renderLabs("/laboratorios/zzz");
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/laboratorios/simbolos"));
  });

  it("encendida: «Python» va tras «Ejercicios» y su ruta abre la pestaña (sin cargar Pyodide)", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    renderLabs("/laboratorios/python", { python: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Python" }, { timeout: 5000 })).toBeTruthy();
    expect(tabNames()).toEqual([...BASE_TABS, "Python"]);
    expect(screen.getByRole("tab", { name: "Python" }).getAttribute("aria-selected")).toBe("true");
    expect(PYTHON_LAB).toEqual({ id: "python", path: "python", label: "Python" });
    expect(screen.getByRole("button", { name: "Cargar Python" })).toBeTruthy();
  });

  it("encendida, el id y la ruta «python» quedan reservados; las demás pestañas extra van detrás", async () => {
    const extras: LabsExtraTab[] = [
      { id: "python", label: "Python del anfitrión", path: "py", element: <p>no</p> },
      { id: "otra", label: "Otra", path: "python", element: <p>no</p> },
      { id: "notas", label: "Notas", path: "notas", element: <p>Notas</p> },
    ];
    renderLabs("/laboratorios/simbolos", { python: true, extraTabs: extras });
    expect(tabNames()).toEqual([...BASE_TABS, "Python", "Notas"]);
  });

  it("apagada, una pestaña extra «python» del anfitrión sigue funcionando (como en 0.7)", async () => {
    renderLabs("/laboratorios/python", { extraTabs: [{ id: "python", label: "Python", path: "python", element: <p>Del anfitrión</p> }] });
    expect(await screen.findByText("Del anfitrión")).toBeTruthy();
    expect(tabNames()).toEqual([...BASE_TABS, "Python"]);
  });
});
