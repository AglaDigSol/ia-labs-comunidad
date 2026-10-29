// @vitest-environment jsdom
// Prueba de consumidor: usa los laboratorios como los usaría una app anfitriona, importando solo
// desde la entrada de la biblioteca (src/embed/index.ts).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_SYMBOLS,
  BOOLE_PACK,
  buildTable,
  checkSetStep,
  compareSetExprs,
  parseSetExpr,
  SETS_PACK,
  configureLabs,
  createLocalStorageLabsAdapter,
  DEFAULT_LABS_KEYS,
  divisors,
  isBooleanAlgebra,
  minimizeBoole,
  parseBoole,
  checkKMapGroups,
  KARNAUGH_PACK,
  kmapSolution,
  readIndexList,
  vectorFromLists,
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
  it("muestra los seis laboratorios y la pestaña extra, con el elemento del anfitrión en su ruta", async () => {
    renderAt("/laboratorios/python");
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Predicados", "Conjuntos", "Álgebra de Boole", "Markov", "Python"]);
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
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Predicados", "Conjuntos", "Álgebra de Boole", "Markov"]);
  });

  it("una pestaña extra tampoco puede ocupar la ruta de Boole", () => {
    render(
      <MemoryRouter initialEntries={["/laboratorios/simbolos"]}>
        <Routes>
          <Route
            path="/laboratorios/*"
            element={<LabsRoutes extraTabs={[{ id: "x", label: "X", path: "boole", element: <p>X</p> }, python]} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Predicados", "Conjuntos", "Álgebra de Boole", "Markov", "Python"]);
  });

  it("una pestaña extra tampoco puede ocupar la ruta de Predicados", () => {
    render(
      <MemoryRouter initialEntries={["/laboratorios/simbolos"]}>
        <Routes>
          <Route
            path="/laboratorios/*"
            element={<LabsRoutes extraTabs={[{ id: "predicados", label: "Mía", path: "mia", element: <p>Mía</p> }, python]} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(tabNames()).toEqual(["Simbología", "Lógica", "Predicados", "Conjuntos", "Álgebra de Boole", "Markov", "Python"]);
  });

  it("abre el laboratorio de predicados sin guardar nada en localStorage", async () => {
    renderAt("/laboratorios/predicados");
    expect(await screen.findByRole("heading", { level: 1, name: "Lógica de predicados" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Predicados" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("header-action").textContent).toBe("Predicados");
    expect(localStorage.length).toBe(0);
  });

  it("abre el laboratorio de Boole y guarda su borrador en el almacén del anfitrión", async () => {
    renderAt("/laboratorios/boole");
    expect(await screen.findByRole("heading", { level: 1, name: "Álgebra de Boole" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Álgebra de Boole" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("header-action").textContent).toBe("Álgebra de Boole");
    fireEvent.change(screen.getByLabelText("Estructura (B, ⊕, ⊙, ′, 0, 1)"), { target: { value: "div-12" } });
    await waitFor(() => expect(JSON.parse(String(storage.load()?.boole)).kind).toBe("div-12"));
    expect(localStorage.length).toBe(0);
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
    expect(isBooleanAlgebra(divisors(30))).toBe(true);
    expect(isBooleanAlgebra(divisors(12))).toBe(false);
    const e = parseBoole("x ⊕ x ⊙ y");
    const m = e.ok ? minimizeBoole(e.expr) : null;
    expect(m?.ok && m.minLiterals).toBe(1);
    expect(BOOLE_PACK.practice.length).toBeGreaterThanOrEqual(12);
    const v = vectorFromLists(3, [1, 3, 5, 7]);
    expect(checkKMapGroups(v, kmapSolution(v, "sop"), "sop").status).toBe("minimal");
    expect(readIndexList("Σm(1, 3)", 3)).toEqual({ ok: true, indices: [1, 3] });
    expect(KARNAUGH_PACK.exercises.length).toBeGreaterThanOrEqual(8);
    const l = parseSetExpr("(A ∪ B)ᶜ");
    const r = parseSetExpr("Aᶜ ∩ Bᶜ");
    expect(l.ok && r.ok && compareSetExprs(l.expr, r.expr).equal).toBe(true);
    expect(l.ok && r.ok && checkSetStep(l.expr, r.expr, "demorgan")).toEqual({ ok: true, lawMatches: true, suggestions: [] });
    expect(SETS_PACK.cardinal.length).toBeGreaterThanOrEqual(3);
  });

  it("abre el laboratorio de conjuntos en su pestaña", async () => {
    renderAt("/laboratorios/conjuntos");
    expect(await screen.findByRole("heading", { level: 1, name: "Conjuntos" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Conjuntos" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("header-action").textContent).toBe("Conjuntos");
  });

  it("createLocalStorageLabsAdapter: la clave de Boole tiene un valor por defecto y se puede cambiar", () => {
    const def = createLocalStorageLabsAdapter({ markov: "host.markov" });
    def.save({ boole: "{}" });
    expect(localStorage.getItem(DEFAULT_LABS_KEYS.boole)).toBe("{}");
    expect(DEFAULT_LABS_KEYS.boole).toBe("ia-labs.boole.v1");
    const own = createLocalStorageLabsAdapter({ boole: "host.boole" });
    own.save({ boole: "[]" });
    expect(localStorage.getItem("host.boole")).toBe("[]");
    expect(own.load()?.boole).toBe("[]");
  });
});
