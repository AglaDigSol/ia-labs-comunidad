// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LABS_KEYS } from "../labs-storage.ts";
import { LabsRoutes } from "../labs.tsx";
import { parseBooleDraft } from "./boole-storage.ts";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

const structureSelect = () => screen.findByLabelText("Estructura (B, ⊕, ⊙, ′, 0, 1)", {}, { timeout: 5000 });
const axiom = (name: RegExp) => within(screen.getByRole("group", { name }));

describe("¿Es un álgebra de Boole?", () => {
  it("D₁₂: corrige, da pistas progresivas tras fallar y la solución queda detrás del aviso", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "div-12" } });
    expect(screen.getByRole("heading", { level: 2, name: "D₁₂ · 6 elementos" })).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
    for (const n of [/^B1/, /^B2/, /^B3/, /^B4/, /^B5/]) fireEvent.click(axiom(n).getByRole("radio", { name: "Se cumple" }));
    // Sin intento fallido no hay pistas.
    expect(screen.queryByRole("button", { name: "Pista para B5" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("4 de 5 axiomas bien")).toBeTruthy();
    expect(within(screen.getByTestId("verdict-B5")).getByText("No es correcto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pista para B5" }));
    expect(screen.getByText("Revisa B5: fíjate en la identidad a ⊕ a′ = 1.")).toBeTruthy();
    expect(screen.queryByText("Revisa B5 con a = 2.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista para B5" }));
    expect(screen.getByText("Revisa B5 con a = 2.")).toBeTruthy();

    // Contraejemplo equivocado (a = 4) y después el bueno (a = 2).
    fireEvent.click(axiom(/^B5/).getByRole("radio", { name: "No se cumple" }));
    const pickA = axiom(/^B5/).getByLabelText("B5: elemento a");
    fireEvent.change(pickA, { target: { value: "3" } }); // índice 3 = «4»
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B5")).getByText(/Con a = 4 se cumple/)).toBeTruthy();
    fireEvent.change(pickA, { target: { value: "1" } }); // «2»
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B5")).getByText("Con a = 2: 2 ⊕ 2′ = 2 ⊕ 6 = 6, pero debería dar 12 (a ⊕ a′ = 1).")).toBeTruthy();
    expect(screen.getByText("¡Correcto! Falla al menos un axioma: no es un álgebra de Boole.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByText(/Primer contraejemplo, con a = 2/)).toBeTruthy();
    expect(sol.getByText("D₁₂ no es un álgebra de Boole.")).toBeTruthy();
  });

  it("un «no se cumple» en un axioma que sí se cumple se corrige", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "div-30" } });
    fireEvent.click(axiom(/^B1/).getByRole("radio", { name: "No se cumple" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByTestId("verdict-B1")).getByText(/Este axioma se cumple/)).toBeTruthy();
    expect(screen.getByText("Marca una respuesta en cada axioma.")).toBeTruthy();
  });

  it("diagrama de Hasse accesible de P({a,b})", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "partes-2" } });
    const svg = screen.getByRole("img", { name: /Diagrama de Hasse/ });
    const label = svg.getAttribute("aria-label")!;
    for (const c of ["{a} cubre a ∅", "{b} cubre a ∅", "{a,b} cubre a {a}", "{a,b} cubre a {b}"]) expect(label).toContain(c);
    expect(svg.querySelectorAll("line")).toHaveLength(4);
  });

  it("personalizada: cambiar una celda rompe B1 y se guarda", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "personalizada" } });
    fireEvent.change(screen.getByLabelText("a ⊕ b"), { target: { value: "1" } }); // a ⊕ b = a
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText(/a ⊕ b = a, pero b ⊕ a = 1/)).toBeTruthy();
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.kind).toBe("personalizada");
    expect(saved.custom?.plus[1]![2]).toBe(1);
  });

  it("producto demasiado grande: avisa del límite", async () => {
    renderAt("/laboratorios/boole");
    fireEvent.change(await structureSelect(), { target: { value: "producto" } });
    fireEvent.change(screen.getByLabelText("B₁"), { target: { value: "cubo-3" } });
    fireEvent.change(screen.getByLabelText("B₂"), { target: { value: "partes-2" } });
    expect(screen.getByRole("alert").textContent).toMatch(/32 elementos; el máximo es 16/);
    fireEvent.change(screen.getByLabelText("B₂"), { target: { value: "dos" } });
    expect(screen.getByRole("heading", { level: 2, name: /× \{0, 1\} · 16 elementos/ })).toBeTruthy();
  });
});

describe("Simplificar paso a paso", () => {
  async function startWith(expr: string) {
    renderAt("/laboratorios/boole?s=simplificar");
    fireEvent.change(await screen.findByLabelText("Elige una de práctica o escribe la tuya", {}, { timeout: 5000 }), {
      target: { value: "propia" },
    });
    fireEvent.change(screen.getByLabelText("Tu expresión"), { target: { value: expr } });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
  }
  const step = (expr: string, law: string) => {
    fireEvent.change(screen.getByLabelText("Nueva expresión"), { target: { value: expr } });
    fireEvent.change(screen.getByLabelText("Ley que aplicas"), { target: { value: law } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
  };

  it("comprueba cada paso, avisa de la ley y compara con la forma mínima al terminar", async () => {
    await startWith("x ⊙ (x′ ⊕ y)");
    // Paso no equivalente: se rechaza y da una fila.
    step("x", "absorcion");
    expect(screen.getByText(/No es equivalente a la expresión anterior: con x = 1, y = 0/)).toBeTruthy();
    // Paso 1: distributiva.
    step("x x′ + x y", "B4");
    expect(screen.getByText("Paso correcto: B4 · Distributivas.")).toBeTruthy();
    // Paso 2: equivalente pero con la ley equivocada: se acepta con aviso.
    step("0 + xy", "demorgan");
    expect(screen.getAllByText("Equivalente, pero no parece ser la ley De Morgan; ¿quizá B5 · Complementación?").length).toBeGreaterThan(0);
    // Pista: leyes aplicables a 0 ⊕ x ⊙ y.
    fireEvent.click(screen.getByRole("button", { name: "Pista" }));
    expect(screen.getByText(/Leyes con alguna instancia aplicable ahora: B3 · Identidad/)).toBeTruthy();
    // Terminar antes de tiempo: 2 literales es ya el mínimo, así que sale bien.
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText(/¡Bien! Tu expresión tiene 2 literales/)).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Pasos de la derivación" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    // La solución está oculta hasta pedirla.
    expect(screen.queryByText("Formas mínimas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("Formas mínimas")).toBeTruthy();
  });

  it("«He terminado» con literales de más no enseña la forma mínima", async () => {
    await startWith("x ⊕ x ⊙ y ⊕ z");
    fireEvent.click(screen.getByRole("button", { name: "He terminado" }));
    expect(screen.getByText(/tiene 4 literales y existe una forma con 2/)).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
  });

  it("la derivación se guarda y se recupera", async () => {
    await startWith("(x′)′ ⊕ x ⊙ z");
    step("x + xz", "involucion");
    const saved = parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
    expect(saved.start).toBe("(x′)′ ⊕ x ⊙ z");
    expect(saved.steps).toEqual([{ expr: "x + xz", law: "involucion" }]);
    cleanup();
    renderAt("/laboratorios/boole?s=simplificar");
    const list = await screen.findByRole("list", { name: "Pasos de la derivación" }, { timeout: 5000 });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer último paso" }));
    expect(within(screen.getByRole("list", { name: "Pasos de la derivación" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("un borrador dañado se descarta", () => {
    expect(parseBooleDraft("{")).toBeNull();
    expect(parseBooleDraft(JSON.stringify({ v: 1, kind: "nada", p1: "dos", p2: "dos", custom: null, start: null, steps: [] }))).toBeNull();
    expect(
      parseBooleDraft(JSON.stringify({ v: 1, kind: "dos", p1: "dos", p2: "dos", custom: { plus: [[9]], times: [[0]], comp: [0] }, start: null, steps: [] })),
    ).toBeNull();
  });
});
