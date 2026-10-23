// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkovLabPage } from "./MarkovLabPage.tsx";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/laboratorios/markov"]}>
      <MarkovLabPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const cell = (i: number, j: number) => screen.getByLabelText(`P(${i},${j})`) as HTMLInputElement;
const vCell = (j: number) => screen.getByLabelText(`v(${j})`) as HTMLInputElement;
const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
const loadExample = () => fireEvent.click(screen.getByRole("button", { name: "Cargar ejemplo ilustrativo" }));
const fill = (rows: string[][]) => rows.forEach((r, i) => r.forEach((x, j) => type(cell(i + 1, j + 1), x)));
const stat = () => within(screen.getByRole("region", { name: "Distribución estacionaria π" }));
const inv = () => within(screen.getByRole("region", { name: "Problema inverso u₀" }));

describe("Markov: distribución estacionaria y problema inverso", () => {
  it("ejemplo: sistema, chips de π y comprobación exacta", () => {
    renderPage();
    loadExample();
    const s = stat();
    expect(s.getByRole("group", { name: "Sistema que define π" })).toBeTruthy();
    expect(s.getByLabelText("Definición de la distribución estacionaria")).toBeTruthy();
    expect(s.getByText("Leer 0,2381")).toBeTruthy();
    expect(s.getByText("Programar 0,4286")).toBeTruthy();
    expect(s.getByText("Descansar 0,3333")).toBeTruthy();
    expect(s.getByText("Comprobación: π·P = π ✓ (exacta)")).toBeTruthy();
  });

  it("problema inverso: u0 con componente negativa, y alternancia de método", () => {
    renderPage();
    loadExample();
    expect(vCell(1).value).toBe("0,5");
    expect(vCell(2).value).toBe("0,5");
    expect(vCell(3).value).toBe("0");
    const b = inv();
    expect(b.getByText("Leer 0,8333")).toBeTruthy();
    expect(b.getByText("Programar 0,6667")).toBeTruthy();
    expect(b.getByText("Descansar −0,5000")).toBeTruthy();
    expect(b.getByText("No es una distribución")).toBeTruthy();
    expect(b.getByText("La componente Descansar de u₀ es negativa (−1/2).")).toBeTruthy();
    expect(b.getByLabelText("Matriz inversa de P")).toBeTruthy();
    fireEvent.click(b.getByRole("radio", { name: "Con el sistema" }));
    expect(b.getByLabelText("Sistema de u₀P = v")).toBeTruthy();
    fireEvent.click(b.getByRole("radio", { name: "Con la inversa" }));
    expect(b.getByLabelText("Matriz inversa de P")).toBeTruthy();
  });

  it("matriz doblemente estocástica: distribución válida", () => {
    renderPage();
    loadExample();
    fill([
      ["0,5", "0,3", "0,2"],
      ["0,2", "0,5", "0,3"],
      ["0,3", "0,2", "0,5"],
    ]);
    type(vCell(1), "0,31");
    type(vCell(2), "0,31");
    type(vCell(3), "0,38");
    expect(inv().getByText("Distribución válida")).toBeTruthy();
  });

  it("P = I: sin π única; P singular: no invertible", () => {
    renderPage();
    loadExample();
    fill([
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ]);
    expect(
      stat().getByText(
        "No se pudo hallar una distribución estacionaria única. La matriz puede no ser irreducible.",
      ),
    ).toBeTruthy();
    fill([
      ["0,5", "0,5", "0"],
      ["0,5", "0,5", "0"],
      ["0", "0,5", "0,5"],
    ]);
    expect(inv().getByText("P no es invertible")).toBeTruthy();
    expect(
      inv().getByText("P no es invertible, así que no hay un único u₀ con u₀P = v₀."),
    ).toBeTruthy();
  });

  it("matriz no estocástica: ambos bloques deshabilitados con el chip informativo", () => {
    renderPage();
    loadExample();
    type(cell(1, 3), "0,5");
    expect(stat().getByText("Corrige la matriz para ver la evolución.")).toBeTruthy();
    expect(inv().getByText("Corrige la matriz para ver la evolución.")).toBeTruthy();
    expect(stat().queryByText(/Leer 0,/)).toBeNull();
  });

  it("v persiste en el borrador local", () => {
    vi.useFakeTimers();
    renderPage();
    loadExample();
    type(vCell(1), "0,4");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const saved = JSON.parse(localStorage.getItem("ia-labs.markov.v1")!);
    expect(saved.vInv[0]).toBe("0,4");
    cleanup();
    renderPage();
    expect(vCell(1).value).toBe("0,4");
  });

  it("solo verificación: sin narrativa ni botón de copiar", () => {
    renderPage();
    loadExample();
    for (const b of [stat(), inv()]) {
      expect(b.queryByText(/Respuesta|Por lo tanto|largo plazo/)).toBeNull();
      expect(b.queryByRole("button", { name: /copiar/i })).toBeNull();
    }
  });
});
