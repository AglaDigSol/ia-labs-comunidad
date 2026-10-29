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

/** Abre la sección, elige un ejercicio (o una opción de «La tuya») y pulsa «Usar esta función». */
async function choose(id: string, view: "canonicas" | "mapa" = "canonicas") {
  renderAt(`/laboratorios/boole?s=karnaugh${view === "mapa" ? "&v=mapa" : ""}`);
  const select = await screen.findByLabelText("Elige un ejercicio o escribe tu función", {}, { timeout: 5000 });
  fireEvent.change(select, { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Usar esta función" }));
}

const saved = () => parseBooleDraft(localStorage.getItem(DEFAULT_LABS_KEYS.boole)!)!;
const cell = (where: string) => screen.getByRole("button", { name: new RegExp(`^Celda ${where}:`) });
const status = () => screen.getAllByRole("status").map((s) => s.textContent).join(" | ");

describe("Σm y ΠM", () => {
  it("corrige las listas de índices sin decir qué falta y la solución queda detrás del aviso", async () => {
    // (x ⊕ y) ⊙ (x′ ⊕ z) vale 1 en 2, 3, 5, 7.
    await choose("tres-producto");
    expect(saved().kmap).toEqual({ choice: "tres-producto", vars: ["x", "y", "z"], vector: "00110101", expr: null });
    fireEvent.change(screen.getByLabelText("Mintérminos: Σm(…)"), { target: { value: "Σm(2, 3, 4)" } });
    fireEvent.change(screen.getByLabelText("Maxtérminos: ΠM(…)"), { target: { value: "ΠM(0, 1, 4, 6)" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Sobra: 4. Te faltan 2 índices.")).toBeTruthy();
    expect(screen.getByText("ΠM correcto.")).toBeTruthy();
    expect(screen.getByText("1 de 2 respuestas correctas.")).toBeTruthy();
    // Ni el texto ni la solución dicen cuáles faltan.
    expect(screen.queryByText(/Σm\(2, 3, 5, 7\)/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Mintérminos: Σm(…)"), { target: { value: "2 3 5 7" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Σm correcto.")).toBeTruthy();
    expect(screen.getByText("¡Correcto! Tus 2 respuestas están bien.")).toBeTruthy();

    // Formas canónicas: no canónica, de otra función y correcta.
    const sop = screen.getByLabelText("Suma de mintérminos: f =");
    fireEvent.change(sop, { target: { value: "x′y + xz" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Cada producto debe llevar las 3 variables (x, y, z) una sola vez, con o sin ′.")).toBeTruthy();
    fireEvent.change(sop, { target: { value: "x′yz′ + x′yz + xy′z + xy′z′" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Tiene forma canónica, pero no es la de f. Sobra m₄. Te falta 1 mintérmino.")).toBeTruthy();
    fireEvent.change(sop, { target: { value: "x′yz′ + x′yz + xy′z + xyz" } });
    fireEvent.change(screen.getByLabelText("Producto de maxtérminos: f ="), { target: { value: "(x+y+z)(x+y+z′)(x′+y+z)(x′+y′+z)" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Forma canónica disyuntiva correcta.")).toBeTruthy();
    expect(screen.getByText("Forma canónica conjuntiva correcta.")).toBeTruthy();
    expect(screen.getByText("¡Correcto! Las dos listas y las dos formas canónicas.")).toBeTruthy();

    // Pistas progresivas, sin valores de f.
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText(/con x como bit más alto \(por ejemplo, 101 es la fila 5\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(screen.getByText(/m₅ = x ⊙ y′ ⊙ z y M₅ = x′ ⊕ y ⊕ z′/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Otra pista" }) as HTMLButtonElement).disabled).toBe(true);

    expect(screen.queryByTestId("solution")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByText("f = Σm(2, 3, 5, 7)")).toBeTruthy();
    expect(sol.getByText("f = ΠM(0, 1, 4, 6)")).toBeTruthy();
    expect(sol.getByText("m₅ = x ⊙ y′ ⊙ z")).toBeTruthy();
  });

  it("índices fuera de rango, repetidos e indiferencias", async () => {
    // Σm(0, 4, 6) + d(2).
    await choose("tres-con-x");
    const sigma = screen.getByLabelText("Mintérminos: Σm(…)");
    fireEvent.change(sigma, { target: { value: "0, 9" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("El 9 no existe: con 3 variables, los índices van de 0 a 7.")).toBeTruthy();
    fireEvent.change(sigma, { target: { value: "0, 2, 4, 6" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("El 2 es una indiferencia (X): no van ni en Σm ni en ΠM.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("f = Σm(0, 4, 6) + d(2)")).toBeTruthy();
  });

  it("sin respuestas, lo pide", async () => {
    await choose("dos-columna");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Escribe al menos una de las respuestas.")).toBeTruthy();
  });

  it("función propia: una expresión o un vector de verdad, con sus errores", async () => {
    await choose("expresion");
    fireEvent.change(screen.getByLabelText("Tu expresión (de 2 a 4 variables)"), { target: { value: "a ⊕ a′" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta función" }));
    expect(screen.getByText("Usa entre 2 y 4 variables (esta tiene 1).")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tu expresión (de 2 a 4 variables)"), { target: { value: "a ⊙ b′" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta función" }));
    expect(saved().kmap).toEqual({ choice: "expresion", vars: ["a", "b"], vector: "0010", expr: "a ⊙ b′" });

    fireEvent.change(screen.getByLabelText("Elige un ejercicio o escribe tu función"), { target: { value: "vector" } });
    const field = screen.getByLabelText("Vector de verdad (0, 1 o X; 4, 8 o 16 valores)");
    fireEvent.change(field, { target: { value: "011" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta función" }));
    expect(screen.getByRole("alert").textContent).toBe("El vector tiene 3 valores: tienen que ser 4, 8 o 16 (2, 3 o 4 variables).");
    fireEvent.change(field, { target: { value: "0110 1x0-" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta función" }));
    expect(saved().kmap).toEqual({ choice: "vector", vars: ["x", "y", "z"], vector: "01101X0X", expr: null });
    expect(screen.getByText("f(x, y, z): 01101X0X")).toBeTruthy();
  });
});

describe("Mapa de Karnaugh", () => {
  it("agrupa los 1: valida cada grupo, corrige sin enseñar la solución y da pistas", async () => {
    // Σm(1, 2, 3, 5, 7) = z ⊕ x′ ⊙ y.
    await choose("tres-cinco-unos", "mapa");
    expect(screen.getByRole("grid", { name: /Mapa de Karnaugh de f\(x, y, z\) con tus grupos/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "y = 1, z = 1" }).textContent).toBe("11");
    expect(screen.getByRole("rowheader", { name: "x = 1" }).textContent).toBe("1");

    // Las celdas con z = 1 (m1, m3, m5, m7): las columnas yz = 01 y 11.
    for (const w of ["x=0, y=0, z=1", "x=0, y=1, z=1", "x=1, y=0, z=1", "x=1, y=1, z=1"]) fireEvent.click(cell(w));
    expect(cell("x=0, y=0, z=1").getAttribute("aria-label")).toBe("Celda x=0, y=0, z=1: 1, seleccionada");
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Grupo 1 creado: z (4 celdas).")).toBeTruthy();
    expect(cell("x=1, y=1, z=1").getAttribute("aria-label")).toBe("Celda x=1, y=1, z=1: 1, en el grupo 1");

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Te falta por cubrir un 1.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText(/^Busca grupos lo más grandes posible/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(screen.getByText("Aún no cubres el 1 de la fila x = 0, columna yz = 10.")).toBeTruthy();

    // Grupos no válidos: con un 0, de 3 celdas y en diagonal.
    fireEvent.click(cell("x=0, y=1, z=0"));
    fireEvent.click(cell("x=0, y=0, z=0"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("El grupo incluye un 0 (fila x = 0, columna yz = 00): solo puede tener 1 y X.")).toBeTruthy();
    fireEvent.click(cell("x=0, y=1, z=1"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("La selección tiene 3 celdas: un grupo tiene 1, 2, 4, 8 o 16.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar la selección" }));
    fireEvent.click(cell("x=0, y=1, z=0"));
    fireEvent.click(cell("x=1, y=0, z=1"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText(/^Esas celdas no forman un rectángulo/)).toBeTruthy();

    // Un grupo de una celda: cubre todo, pero no es mínima; la pista lo señala sin decir cómo.
    fireEvent.click(cell("x=1, y=0, z=1"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Grupo 2 creado: x′ ⊙ y ⊙ z′ (1 celda).")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("Cubres todos los 1, pero hay una agrupación más simple.")).toBeTruthy();
    expect(screen.getByText("Tu agrupación tiene 4 literales; la mínima tiene 3.")).toBeTruthy();
    expect(screen.getByText("El grupo 2 cabe dentro de un grupo mayor: prueba a agrandarlo.")).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();

    // Se quita y se hace bien.
    fireEvent.click(screen.getByRole("button", { name: "Quitar el grupo 2" }));
    fireEvent.click(cell("x=0, y=1, z=0"));
    fireEvent.click(cell("x=0, y=1, z=1"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(cell("x=0, y=1, z=1").getAttribute("aria-label")).toBe("Celda x=0, y=1, z=1: 1, en los grupos 1 y 2");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! Agrupación mínima: 2 grupos y 3 literales.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Tus grupos" }).textContent).toContain("Grupo 2:");

    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getAllByRole("listitem")).toHaveLength(2);
    expect(sol.getByText("Celda x=0, y=1, z=0: 1, en el grupo 2")).toBeTruthy();
  });

  it("se mueve por el mapa con las flechas, con un solo punto de tabulación", async () => {
    await choose("cuatro-seis-unos", "mapa");
    const grid = screen.getByRole("grid");
    const focusable = within(grid)
      .getAllByRole("button")
      .filter((b) => b.tabIndex === 0);
    expect(focusable).toHaveLength(1);
    focusable[0]!.focus();
    fireEvent.keyDown(focusable[0]!, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Celda w=0, x=0, y=0, z=1:/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    // Fila wx = 01, última columna yz = 10.
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Celda w=0, x=1, y=1, z=0:/);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Celda w=0, x=1, y=1, z=0:/);
    // Las cuatro esquinas forman un grupo válido.
    for (const w of ["w=0, x=0, y=0, z=0", "w=0, x=0, y=1, z=0", "w=1, x=0, y=0, z=0", "w=1, x=0, y=1, z=0"]) fireEvent.click(cell(w));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Grupo 1 creado: x′ ⊙ z′ (4 celdas).")).toBeTruthy();
  });

  it("producto de sumas: agrupa los 0", async () => {
    // Σm(0, 2, 4, 6): los 0 están en z = 1.
    await choose("tres-pares", "mapa");
    fireEvent.click(screen.getByRole("radio", { name: "Los 0 (producto de sumas)" }));
    fireEvent.click(cell("x=0, y=0, z=0"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("El grupo incluye un 1 (fila x = 0, columna yz = 00): solo puede tener 0 y X.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar la selección" }));
    for (const w of ["x=0, y=0, z=1", "x=0, y=1, z=1", "x=1, y=0, z=1", "x=1, y=1, z=1"]) fireEvent.click(cell(w));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Grupo 1 creado: z′ (4 celdas).")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! Agrupación mínima: 1 grupo y 1 literal.")).toBeTruthy();
  });

  it("indiferencias: un grupo solo de X no vale y la pista lo explica", async () => {
    // Σm(1, 3, 7, 11, 15) + d(0, 2, 5).
    await choose("cuatro-indiferencias", "mapa");
    expect(cell("w=0, x=0, y=0, z=0").getAttribute("aria-label")).toBe("Celda w=0, x=0, y=0, z=0: X (indiferencia)");
    fireEvent.click(cell("w=0, x=0, y=0, z=0"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Ese grupo solo tiene X: tiene que cubrir al menos un 1.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(screen.getByText("Las X puedes meterlas en un grupo si lo agrandan, pero no hace falta cubrirlas.")).toBeTruthy();
  });

  it("mapa en blanco: se rellena a mano y se guarda", async () => {
    await choose("blanco-2", "mapa");
    expect(screen.getByRole("radio", { name: "Cambiar su valor" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(cell("x=1, y=1"));
    expect(cell("x=1, y=1").getAttribute("aria-label")).toBe("Celda x=1, y=1: 1");
    fireEvent.click(cell("x=0, y=1"));
    fireEvent.click(cell("x=0, y=1"));
    expect(saved().kmap).toEqual({ choice: "mapa", vars: ["x", "y"], vector: "0X01", expr: null });
    expect(status()).not.toContain("Grupo");
    fireEvent.click(screen.getByRole("radio", { name: "Agrupar" }));
    fireEvent.click(cell("x=0, y=1"));
    fireEvent.click(cell("x=1, y=1"));
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect(screen.getByText("Grupo 1 creado: y (2 celdas).")).toBeTruthy();
    // Al volver, la función sigue ahí.
    cleanup();
    renderAt("/laboratorios/boole?s=karnaugh&v=mapa");
    expect((await screen.findByRole("grid", {}, { timeout: 5000 })).textContent).toContain("X");
    expect(screen.getByText("f(x, y): 0X01")).toBeTruthy();
  });
});
