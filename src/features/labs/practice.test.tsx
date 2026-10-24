// @vitest-environment jsdom
// Modo «Comprueba tu respuesta»: la solución queda oculta hasta pedirla y la app corrige lo que escribes.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { closeEnough } from "./markov/MarkovPractice.tsx";
import { MarkovLabPage } from "./markov/MarkovLabPage.tsx";
import { LabsRoutes } from "./labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("tabla de verdad: comprueba tu respuesta", () => {
  it("oculta la solución, corrige las filas y la clasificación", async () => {
    render(
      <MemoryRouter initialEntries={["/laboratorios/logica?f=p%20%E2%86%92%20q"]}>
        <Routes>
          <Route path="/laboratorios/*" element={<LabsRoutes />} />
        </Routes>
      </MemoryRouter>,
    );
    const practice = within(await screen.findByRole("region", { name: "Comprueba tu respuesta" }, { timeout: 5000 }));
    expect(screen.queryByTestId("solution")).toBeNull();
    expect(screen.queryByText(/Verdadera en/)).toBeNull();
    // p → q: rows (1,1)=1, (1,0)=0, (0,1)=1, (0,0)=1. Answer row 2 wrong (1 instead of 0).
    const cells = practice.getAllByRole("button", { name: /^Fila / });
    expect(cells).toHaveLength(4);
    for (const c of cells) fireEvent.click(c); // all «1»
    fireEvent.click(practice.getByRole("radio", { name: "Tautología" }));
    fireEvent.click(practice.getByRole("button", { name: "Comprobar" }));
    expect(practice.getByText("3 de 4 filas correctas")).toBeTruthy();
    expect(practice.getByText(/La clasificación no es correcta/)).toBeTruthy();
    fireEvent.click(cells[1]!); // 1 → 0
    fireEvent.click(practice.getByRole("radio", { name: "Contingencia" }));
    fireEvent.click(practice.getByRole("button", { name: "Comprobar" }));
    expect(practice.getByText("¡Correcto! Tabla y clasificación bien.")).toBeTruthy();
    fireEvent.click(practice.getByRole("button", { name: "Dame una pista" }));
    expect(practice.getByText(/Calcula las subfórmulas|La fórmula es una sola/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("Verdadera en 3 de 4 filas")).toBeTruthy();
  });
});

describe("Markov: comprueba tu respuesta", () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <MarkovLabPage />
      </MemoryRouter>,
    );
  }

  it("acepta fracciones y decimales redondeados", () => {
    expect(closeEnough("1/3", 1 / 3)).toBe(true);
    expect(closeEnough("0,3333", 1 / 3)).toBe(true);
    expect(closeEnough("0,33", 1 / 3)).toBe(false);
    expect(closeEnough("abc", 1 / 3)).toBeNull();
  });

  it("corrige π sin enseñarlo y la solución queda tras «Ver la solución completa»", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Cargar ejemplo ilustrativo" }));
    expect(screen.queryByTestId("solution")).toBeNull();
    const practice = within(screen.getByRole("region", { name: "Comprueba tu respuesta" }));
    fireEvent.click(practice.getByRole("radio", { name: "Estacionaria π" }));
    const inputs = practice.getAllByRole("textbox");
    // Example chain: π = (5/21, 3/7, 1/3).
    fireEvent.change(inputs[0]!, { target: { value: "5/21" } });
    fireEvent.change(inputs[1]!, { target: { value: "0,4286" } });
    fireEvent.change(inputs[2]!, { target: { value: "0,5" } });
    fireEvent.click(practice.getByRole("button", { name: "Comprobar" }));
    expect(practice.getByText("2 de 3 componentes correctas")).toBeTruthy();
    fireEvent.change(inputs[2]!, { target: { value: "1/3" } });
    fireEvent.click(practice.getByRole("button", { name: "Comprobar" }));
    expect(practice.getByText("¡Correcto! Tu π coincide con el resultado exacto.")).toBeTruthy();
  });

  it("corrige v₃ de la evolución", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Cargar ejemplo ilustrativo" }));
    const practice = within(screen.getByRole("region", { name: "Comprueba tu respuesta" }));
    const inputs = practice.getAllByRole("textbox");
    ["103/400", "0,4305", "0,312"].forEach((v, i) => fireEvent.change(inputs[i]!, { target: { value: v } }));
    fireEvent.click(practice.getByRole("button", { name: "Comprobar" }));
    expect(practice.getByText("¡Correcto! Tu v₃ coincide con el resultado exacto.")).toBeTruthy();
  });
});
