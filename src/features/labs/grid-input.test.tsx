// @vitest-environment jsdom
// Entrada con el teclado en las rejillas de valores: tablas de verdad («Paso a paso» y «Solo el
// resultado») e instancias de predicados.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { toPlain } from "../../../shared/logic/ast.ts";
import { parseFormula } from "../../../shared/logic/parser.ts";
import { buildTable } from "../../../shared/logic/truth-table.ts";
import { parsePredicate } from "../../../shared/predicates/parser.ts";
import { cellKeyValue } from "./grid-input.tsx";
import { DEFAULT_LABS_KEYS } from "./labs-storage.ts";
import type { TruthFormat } from "./logic/TruthTable.tsx";
import { TruthPractice, type TruthPracticeMode } from "./logic/TruthPractice.tsx";
import { EvalPractice } from "./predicates/EvalPractice.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function practice(src: string, format: TruthFormat = "VF", mode?: TruthPracticeMode) {
  const r = parseFormula(src);
  if (!r.ok) throw new Error(r.error.message);
  const table = buildTable(r.ast);
  if (!table.ok) throw new Error(table.code);
  return <TruthPractice table={table} format={format} formula={toPlain(r.ast)} fixedMode={mode} />;
}

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Casillas de «Solo el resultado» (etiqueta «Fila i (…): valor»). */
const resultCells = () => screen.getAllByRole("button", { name: /^Fila \d+ \([^)]*\): / });
const stepCells = (column: string) => screen.queryAllByRole("button", { name: new RegExp(`, columna ${reEscape(column)}: `) });
const texts = (cells: HTMLElement[]) => cells.map((c) => c.textContent).join("");
const active = () => document.activeElement;

describe("cellKeyValue", () => {
  const k = (key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
    cellKeyValue({ key, ctrlKey: false, metaKey: false, altKey: false, ...extra });
  it("V, T y 1 son verdadero; F y 0, falso; Retroceso y Supr vacían", () => {
    for (const key of ["v", "V", "t", "T", "1"]) expect(k(key)).toEqual({ value: true });
    for (const key of ["f", "F", "0"]) expect(k(key)).toEqual({ value: false });
    for (const key of ["Backspace", "Delete"]) expect(k(key)).toEqual({ value: null });
  });
  it("la X solo donde se admite, y nada con Ctrl, Alt o Cmd", () => {
    expect(k("x")).toBeNull();
    expect(k("-")).toBeNull();
    expect(cellKeyValue({ key: "X", ctrlKey: false, metaKey: false, altKey: false }, true)).toEqual({ value: "X" });
    expect(cellKeyValue({ key: "-", ctrlKey: false, metaKey: false, altKey: false }, true)).toEqual({ value: "X" });
    expect(k("v", { ctrlKey: true })).toBeNull();
    expect(k("1", { metaKey: true })).toBeNull();
    expect(k("f", { altKey: true })).toBeNull();
    expect(k("a")).toBeNull();
    expect(k(" ")).toBeNull();
  });
});

describe("tabla de verdad con el teclado: «Solo el resultado»", () => {
  it("escribir rellena y baja a la fila siguiente; en la última se queda", async () => {
    const user = userEvent.setup();
    render(practice("p → q", "VF"));
    const cells = resultCells();
    expect(cells).toHaveLength(4);
    // Una sola parada de tabulación: la primera casilla.
    expect(cells.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(screen.getByRole("grid")).toBeTruthy();
    expect(screen.getByText("Atajos: V/F (o 1/0) para responder, flechas para moverte, Supr para borrar.")).toBeTruthy();
    expect(cells[0]!.getAttribute("aria-describedby")).toBe(screen.getByText(/^Atajos: /).id);

    cells[0]!.focus();
    await user.keyboard("v");
    expect(cells[0]!.textContent).toBe("V");
    expect(active()).toBe(cells[1]);
    expect(cells.map((c) => c.tabIndex)).toEqual([-1, 0, -1, -1]);
    await user.keyboard("f1t");
    expect(texts(cells)).toBe("VFVV");
    // Última fila: el foco se queda y se puede corregir.
    expect(active()).toBe(cells[3]);
    await user.keyboard("0");
    expect(texts(cells)).toBe("VFVF");
    expect(active()).toBe(cells[3]);
    // Borrar no avanza.
    await user.keyboard("{Backspace}");
    expect(cells[3]!.textContent).toBe("?");
    expect(active()).toBe(cells[3]);
    await user.keyboard("{ArrowUp}{Delete}");
    expect(texts(cells)).toBe("VF??");
    expect(active()).toBe(cells[2]);
    // Escribir no corrige nada: ni marcas ni «incorrecta» hasta «Comprobar».
    expect(screen.queryByLabelText("Incorrecta")).toBeNull();
    expect(screen.queryByLabelText("Correcta")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Espacio e Intro siguen ciclando como un clic, sin moverse", async () => {
    const user = userEvent.setup();
    render(practice("p ∧ q", "VF"));
    const cells = resultCells();
    cells[1]!.focus();
    await user.keyboard(" ");
    expect(cells[1]!.textContent).toBe("V");
    await user.keyboard("{Enter}");
    expect(cells[1]!.textContent).toBe("F");
    await user.keyboard(" ");
    expect(cells[1]!.textContent).toBe("?");
    expect(active()).toBe(cells[1]);
    // El ratón, igual que siempre.
    fireEvent.click(cells[2]!);
    expect(cells[2]!.textContent).toBe("V");
  });

  it("flechas, Inicio, Fin, Re Pág y Av Pág en una tabla de 16 filas", async () => {
    const user = userEvent.setup();
    render(practice("(p ∧ q) ∨ (r ∧ s)", "VF", "resultado"));
    const cells = resultCells();
    expect(cells).toHaveLength(16);
    cells[0]!.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toBe(cells[2]);
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe(cells[1]);
    await user.keyboard("{PageDown}");
    expect(active()).toBe(cells[9]);
    await user.keyboard("{PageDown}");
    expect(active()).toBe(cells[15]);
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(cells[15]);
    await user.keyboard("{PageUp}");
    expect(active()).toBe(cells[7]);
    await user.keyboard("{Home}");
    expect(active()).toBe(cells[0]);
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe(cells[0]);
    await user.keyboard("{End}");
    expect(active()).toBe(cells[15]);
    // ← → sin otra columna editable: no se va a ninguna parte.
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(active()).toBe(cells[15]);
    // El tabulador sale de la tabla (una sola parada).
    await user.tab();
    expect(cells.includes(active() as HTMLElement)).toBe(false);
    await user.tab({ shift: true });
    expect(active()).toBe(cells[15]);
  });

  it("formato 1/0: 1 y 0 son las teclas principales, y V/F también valen; la X no hace nada", async () => {
    const user = userEvent.setup();
    render(practice("p ∨ q", "10"));
    expect(screen.getByText("Atajos: 1/0 (o V/F) para responder, flechas para moverte, Supr para borrar.")).toBeTruthy();
    const cells = resultCells();
    cells[0]!.focus();
    await user.keyboard("1v");
    expect(texts(cells)).toBe("11??");
    await user.keyboard("x-");
    expect(texts(cells)).toBe("11??");
    expect(active()).toBe(cells[2]);
    await user.keyboard("1f");
    expect(texts(cells)).toBe("1110");
  });

  it("la corrección no cambia: la tabla escrita con el teclado se comprueba igual", async () => {
    const user = userEvent.setup();
    render(practice("p → q", "VF"));
    const cells = resultCells();
    cells[0]!.focus();
    await user.keyboard("vffv");
    fireEvent.click(screen.getByRole("radio", { name: "Contingencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByRole("status")).getByText("3 de 4 filas correctas")).toBeTruthy();
    expect(screen.getAllByLabelText("Incorrecta")).toHaveLength(1);
    // Corregir con el teclado quita la corrección anterior.
    cells[1]!.focus();
    await user.keyboard("f");
    expect(screen.queryByRole("status")).toBeNull();
    cells[2]!.focus();
    await user.keyboard("v");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(screen.getByRole("status")).getByText("¡Correcto! Tabla y clasificación bien.")).toBeTruthy();
  });

  it("«Avanzar al escribir» se puede apagar y se recuerda en el dispositivo", async () => {
    const user = userEvent.setup();
    const { unmount } = render(practice("p → q", "VF"));
    expect(screen.queryByRole("checkbox", { name: "Avanzar al escribir" })).toBeNull();
    // Solo de teclado: en un dispositivo solo táctil se oculta (variante touch de tokens.css).
    expect(screen.getByText("Atajos de teclado").closest("[data-keyboard-only]")?.className).toMatch(/\btouch:hidden\b/);
    await user.click(screen.getByText("Atajos de teclado"));
    const box = screen.getByRole("checkbox", { name: "Avanzar al escribir" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText("Retroceso o Supr: deja la casilla vacía.")).toBeTruthy();
    await user.click(box);
    expect(box.checked).toBe(false);
    expect(localStorage.getItem(DEFAULT_LABS_KEYS.gridAdvance)).toBe("0");
    const cells = resultCells();
    cells[0]!.focus();
    await user.keyboard("v");
    expect(cells[0]!.textContent).toBe("V");
    expect(active()).toBe(cells[0]);
    unmount();

    // Otra tabla en el mismo dispositivo: sigue apagado.
    render(practice("p ∧ q", "VF"));
    const again = resultCells();
    again[0]!.focus();
    await user.keyboard("f");
    expect(active()).toBe(again[0]);
  });
});

describe("tabla de verdad con el teclado: «Paso a paso»", () => {
  it("rellena cada columna, comprueba sin perder el foco y salta a la primera casilla de la siguiente", async () => {
    const user = userEvent.setup();
    render(practice("(p → q) ↔ (q → p)", "VF"));
    const first = stepCells("p → q");
    expect(first.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    first[0]!.focus();
    await user.keyboard("vfvv");
    expect(texts(first)).toBe("VFVV");
    // Al botón con el tabulador (una sola parada en la tabla) y «Comprobar paso» con Intro.
    await user.tab();
    const button = active() as HTMLElement;
    expect(button.textContent).toBe("Comprobar paso");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Paso 1 correcto")).toBeTruthy();
    // El foco sigue en el mismo botón, que ahora es «Siguiente paso».
    expect(active()).toBe(button);
    expect(button.textContent).toBe("Siguiente paso: q → p");
    // Bloqueada: sin casillas editables ni aviso de atajos mientras no hay columna nueva.
    expect(stepCells("p → q")).toHaveLength(0);
    expect(screen.queryByText(/^Atajos: /)).toBeNull();
    await user.keyboard("{Enter}");
    const second = stepCells("q → p");
    expect(active()).toBe(second[0]);
    expect(second.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    await user.keyboard("vvfv");
    expect(texts(second)).toBe("VVFV");
    expect(active()).toBe(second[3]);
  });

  it("una columna mal: «Comprobar paso» marca las filas y el foco se queda en el botón", async () => {
    const user = userEvent.setup();
    render(practice("¬p ∧ q", "10"));
    const cells = stepCells("¬p");
    cells[0]!.focus();
    await user.keyboard("1010");
    expect(texts(cells)).toBe("1010");
    const button = screen.getByRole("button", { name: "Comprobar paso" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(active()).toBe(button);
    expect(screen.getByText("2 de 4 filas correctas")).toBeTruthy();
    expect(stepCells("¬p").filter((c) => c.getAttribute("aria-label")!.endsWith(", incorrecta"))).toHaveLength(2);
  });
});

describe("predicados con el teclado", () => {
  it("las instancias y, debajo, la fórmula cuantificada, en una sola columna", async () => {
    const user = userEvent.setup();
    const r = parsePredicate("∀x P(x)");
    if (!r.ok) throw new Error(r.error.message);
    let solved = 0;
    render(
      <EvalPractice
        formula={r.formula}
        interp={{ domain: ["1", "2", "3"], predicates: { P: [["1"], ["3"]] } }}
        mode="pasos"
        onMode={() => {}}
        onSolved={() => solved++}
      />,
    );
    const cells = () => screen.getAllByRole("button", { name: /^(Instancia|Fórmula) / });
    expect(cells()).toHaveLength(4);
    expect(cells().map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    cells()[0]!.focus();
    await user.keyboard("vfv");
    // Tras la última instancia, el foco baja a la fórmula ∀x P(x).
    expect(active()?.getAttribute("aria-label")).toBe("Fórmula ∀x P(x): sin responder");
    await user.keyboard("0");
    expect(texts(cells())).toBe("VFVF");
    await user.keyboard("{Home}");
    expect(active()).toBe(cells()[0]);
    await user.keyboard("{End}");
    expect(active()).toBe(cells()[3]);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(solved).toBe(1);
  });
});
