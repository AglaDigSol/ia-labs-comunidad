// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toPlain } from "../../../../shared/logic/ast.ts";
import { parseFormula } from "../../../../shared/logic/parser.ts";
import { buildTable } from "../../../../shared/logic/truth-table.ts";
import type { TruthFormat } from "./TruthTable.tsx";
import { TruthPractice } from "./TruthPractice.tsx";

afterEach(cleanup);

const BICOND = "(p → q) ↔ (q → p)";

function practice(src: string, format: TruthFormat = "VF") {
  const r = parseFormula(src);
  if (!r.ok) throw new Error(r.error.message);
  const table = buildTable(r.ast);
  if (!table.ok) throw new Error(table.code);
  return <TruthPractice table={table} format={format} formula={toPlain(r.ast)} />;
}

/** Casillas editables de una columna, en orden de filas. */
const reEscape = (s: string) => s.replace(/[()]/g, "\\$&");
const cellsOf = (column: string) =>
  screen.queryAllByRole("button", { name: new RegExp(`, columna ${reEscape(column)}: `) });

/** Pone cada casilla en V o F pulsando (? → V → F → ?). */
function fill(column: string, values: string) {
  const cells = cellsOf(column);
  expect(cells).toHaveLength(values.length);
  values.split("").forEach((v, i) => {
    const want = v === "?" ? "?" : v;
    for (let k = 0; k < 3 && cells[i]!.textContent !== want; k++) fireEvent.click(cells[i]!);
    expect(cells[i]!.textContent).toBe(want);
  });
}
const status = () => screen.getByRole("status");
const header = (name: RegExp) => screen.getByRole("columnheader", { name });
const usedHeaders = () =>
  screen
    .getAllByRole("columnheader")
    .filter((h) => h.textContent?.includes("(se usa en este paso)"))
    .map((h) => h.textContent!.replace(" (se usa en este paso)", ""));

describe("TruthPractice paso a paso", () => {
  it("(p → q) ↔ (q → p) en tres pasos, con clasificación al final", () => {
    render(practice(BICOND));
    expect(screen.getByRole("radio", { name: "Paso a paso" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Paso 1 de 3:")).toBeTruthy();
    // Solo la columna del paso actual es editable; aún no hay columnas de los pasos siguientes.
    expect(cellsOf("p → q")).toHaveLength(4);
    expect(cellsOf("q → p")).toHaveLength(0);
    expect(screen.queryByRole("columnheader", { name: /^q → p/ })).toBeNull();
    expect(usedHeaders()).toEqual(["p", "q"]);
    expect(cellsOf("p → q")[1]!.getAttribute("aria-label")).toBe(
      "Fila 2 (p = V, q = F), columna p → q: sin responder",
    );
    // Sin clasificación hasta terminar la tabla.
    expect(screen.queryByRole("group", { name: "Clasificación" })).toBeNull();

    fill("p → q", "VFVV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(within(status()).getByText("Paso 1 correcto")).toBeTruthy();
    // Bloqueada: ya no hay casillas editables en esa columna.
    expect(cellsOf("p → q")).toHaveLength(0);
    expect(header(/^p → q$/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso: q → p" }));
    expect(screen.getByText("Paso 2 de 3:")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(cellsOf("q → p")[0]);
    expect(usedHeaders()).toEqual(["p", "q"]);
    fill("q → p", "VVFV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(within(status()).getByText("Paso 2 correcto")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: `Siguiente paso: ${BICOND}` }));
    expect(screen.getByText("Paso 3 de 3:")).toBeTruthy();
    expect(document.activeElement).toBe(cellsOf(BICOND)[0]);
    expect(usedHeaders()).toEqual(["p → q", "q → p"]);
    fill(BICOND, "VFFV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(within(status()).getByText("Paso 3 correcto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Siguiente paso/ })).toBeNull();

    const group = screen.getByRole("group", { name: "Clasificación" });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(status()).getByText("Elige una clasificación.")).toBeTruthy();
    fireEvent.click(within(group).getByRole("radio", { name: "Tautología" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(
      within(status()).getByText("La clasificación no es correcta: revisa cuántas filas dan verdadero."),
    ).toBeTruthy();
    fireEvent.click(within(group).getByRole("radio", { name: "Contingencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(within(status()).getByText("¡Correcto! Tabla y clasificación bien.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    expect(screen.getByText("Paso 1 de 3:")).toBeTruthy();
    expect(cellsOf("p → q").map((c) => c.textContent)).toEqual(["?", "?", "?", "?"]);
    expect(screen.queryByRole("columnheader", { name: /^q → p/ })).toBeNull();
    expect(screen.queryByRole("group", { name: "Clasificación" })).toBeNull();
  });

  it("marca las casillas mal sin revelar el valor correcto", () => {
    render(practice(BICOND));
    fill("p → q", "VVV?");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(within(status()).getByText("2 de 4 filas correctas")).toBeTruthy();
    expect(within(status()).getByText("Te faltan 1 filas por rellenar.")).toBeTruthy();
    const cells = cellsOf("p → q");
    // Se queda lo que escribió el estudiante; la fila mal solo lleva la marca.
    expect(cells.map((c) => c.textContent)).toEqual(["V", "V", "V", "?"]);
    expect(cells[1]!.getAttribute("aria-label")).toBe("Fila 2 (p = V, q = F), columna p → q: V, incorrecta");
    expect(cells[0]!.getAttribute("aria-label")).toBe("Fila 1 (p = V, q = V), columna p → q: V");
    expect(cells[3]!.getAttribute("aria-label")).toBe("Fila 4 (p = F, q = F), columna p → q: sin responder");
    expect(cells[1]!.className).toContain("border-crit");
    expect(screen.queryByRole("button", { name: /^Siguiente paso/ })).toBeNull();
    // Cambiar una casilla quita la corrección.
    fireEvent.click(cells[1]!);
    expect(screen.queryByRole("status")).toBeNull();
    expect(cellsOf("p → q")[1]!.getAttribute("aria-label")).toBe("Fila 2 (p = V, q = F), columna p → q: F");
  });

  it("pistas por paso: operador y operandos, luego la regla; nunca los valores", () => {
    render(practice(BICOND));
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("Esta columna aplica → a p y q: mira esas dos columnas.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(screen.getByText("Recuerda: p → q solo es falsa cuando p es verdadera y q es falsa.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Otra pista" }) as HTMLButtonElement).disabled).toBe(true);

    fill("p → q", "VFVV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso: q → p" }));
    // Las pistas vuelven a empezar en cada paso.
    expect(screen.queryByText(/Esta columna aplica/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("Esta columna aplica → a q y p: mira esas dos columnas.")).toBeTruthy();
    fill("q → p", "VVFV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    fireEvent.click(screen.getByRole("button", { name: `Siguiente paso: ${BICOND}` }));
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Esta columna aplica ↔ a (p → q) y (q → p): mira esas dos columnas.",
      "Recuerda: (p → q) ↔ (q → p) es verdadera cuando (p → q) y (q → p) coinciden.",
    ]);
    fill(BICOND, "VFFV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    // En la clasificación, la pista es la de siempre.
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText(/^Clasifica al final/)).toBeTruthy();
  });

  it("¬ resalta una sola columna y respeta el formato 1/0", () => {
    render(practice("¬p ∨ q", "10"));
    expect(screen.getByText("Paso 1 de 2:")).toBeTruthy();
    expect(usedHeaders()).toEqual(["p"]);
    expect(cellsOf("¬p")[0]!.getAttribute("aria-label")).toBe("Fila 1 (p = 1, q = 1), columna ¬p: sin responder");
    fireEvent.click(cellsOf("¬p")[0]!);
    expect(cellsOf("¬p")[0]!.textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("Esta columna aplica ¬ a p: mira esa columna.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(
      screen.getByText("Recuerda: ¬ cambia el valor: ¬p es verdadera cuando p es falsa, y falsa cuando p es verdadera."),
    ).toBeTruthy();
  });

  it("«Solo el resultado» mantiene el ejercicio de siempre", () => {
    render(practice(BICOND));
    fireEvent.click(screen.getByRole("radio", { name: "Solo el resultado" }));
    expect(screen.queryByText(/^Paso 1 de/)).toBeNull();
    expect(screen.getByText(/Rellena la columna de/)).toBeTruthy();
    const cells = screen.getAllByRole("button", { name: /^Fila \d \(p = ., q = .\): / });
    expect(cells).toHaveLength(4);
    expect(cells[0]!.getAttribute("aria-label")).toBe("Fila 1 (p = V, q = V): sin responder");
    expect(screen.getByRole("group", { name: "Clasificación" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Paso a paso" }));
    expect(screen.getByText("Paso 1 de 3:")).toBeTruthy();
  });

  it("cambiar de fórmula reinicia el ejercicio", () => {
    const { rerender } = render(practice(BICOND));
    fill("p → q", "VFVV");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso: q → p" }));
    expect(screen.getByText("Paso 2 de 3:")).toBeTruthy();
    rerender(practice("(p ∧ q) ∨ r"));
    expect(screen.getByText("Paso 1 de 2:")).toBeTruthy();
    expect(cellsOf("p ∧ q").map((c) => c.textContent)).toEqual(Array(8).fill("?"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(usedHeaders()).toEqual(["p", "q"]);
  });

  it("sin pasos intermedios no hay selector y se usa la columna única", () => {
    render(practice("p"));
    expect(screen.queryByRole("group", { name: "Modo de práctica" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Paso a paso" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Fila \d \(p = .\): / })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("La fórmula es una sola variable o constante: copia su valor en cada fila.")).toBeTruthy();
    cleanup();
    render(practice("p ∧ q"));
    expect(screen.queryByRole("radio", { name: "Paso a paso" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Fila \d \(p = ., q = .\): / })).toHaveLength(4);
  });
});
