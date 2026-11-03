// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LabsRoutes } from "../labs.tsx";

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

const heading = () => screen.findByRole("heading", { level: 1, name: "Álgebra lineal" }, { timeout: 5000 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const cell = (name: string, i: number, j: number) => screen.getByLabelText(`${name}, fila ${i}, columna ${j}`);
const setCell = (name: string, i: number, j: number, value: string) => fireEvent.change(cell(name, i, j), { target: { value } });
const invalid = (el: HTMLElement) => el.getAttribute("aria-invalid") === "true";

describe("Gauss-Jordan paso a paso", () => {
  it("una operación elegida con su matriz, una mal escrita marcada sin el valor, y k = 0 rechazado", async () => {
    renderAt("/laboratorios/algebra-lineal");
    await heading();
    expect(screen.getByRole("tab", { name: "Álgebra lineal" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("group", { name: /Matriz de partida: fila 1: 1, 1, 5; fila 2: 2, −1, 1/ })).toBeTruthy();
    expect(screen.getByText("Columnas pivote terminadas: 0 de 2.")).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();

    // La pista dice la regla y la columna, no el número.
    click("Dame una pista");
    expect(screen.getByText(/El pivote de la columna 1 ya vale 1 \(en F₁\)\. Haz ceros en el resto de la columna \(F₂\)/)).toBeTruthy();

    // k = 0 en Fᵢ ← k·Fᵢ no es elemental.
    fireEvent.change(screen.getByLabelText("Operación elemental"), { target: { value: "scale" } });
    type("k", "0");
    click("Comprobar paso");
    expect(screen.getByText(/k no puede ser 0/)).toBeTruthy();

    // F₂ ← F₂ − 2·F₁ con una celda mal: se marca esa celda y no se dice el valor.
    fireEvent.change(screen.getByLabelText("Operación elemental"), { target: { value: "add" } });
    fireEvent.change(screen.getByLabelText("Fila i"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Fila j"), { target: { value: "0" } });
    type("k", "-2");
    setCell("Matriz siguiente", 2, 1, "0");
    setCell("Matriz siguiente", 2, 2, "-3");
    setCell("Matriz siguiente", 2, 3, "-8");
    click("Comprobar paso");
    expect(screen.getByText(/La operación F₂ ← F₂ − 2·F₁ es válida, pero 1 celda no coincide/)).toBeTruthy();
    expect(invalid(cell("Matriz siguiente", 2, 3))).toBe(true);
    expect(invalid(cell("Matriz siguiente", 2, 2))).toBe(false);
    expect(screen.queryByText(/−9/)).toBeNull();

    setCell("Matriz siguiente", 2, 3, "-9");
    click("Comprobar paso");
    expect(screen.getByText("¡Bien! F₂ ← F₂ − 2·F₁ da esa matriz.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "F₂ ← F₂ − 2·F₁" })).toBeTruthy();
    expect(screen.getByText("Columnas pivote terminadas: 1 de 2.")).toBeTruthy();

    // Deshacer vuelve a la matriz de partida.
    click("Deshacer el último paso");
    expect(screen.getByRole("group", { name: /^Matriz de partida/ })).toBeTruthy();
  });

  it("escribiendo la matriz: una fila que no sale se marca; varias operaciones a la vez valen; luego se clasifica y se resuelve", async () => {
    renderAt("/laboratorios/algebra-lineal");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Escribir la matriz" }));
    setCell("Matriz siguiente", 2, 1, "0");
    setCell("Matriz siguiente", 2, 2, "-3");
    setCell("Matriz siguiente", 2, 3, "-8");
    click("Comprobar paso");
    expect(screen.getByText(/F₂: no es combinación de las filas de la matriz anterior/)).toBeTruthy();
    expect([1, 2, 3].every((j) => invalid(cell("Matriz siguiente", 2, j)))).toBe(true);
    expect(invalid(cell("Matriz siguiente", 1, 1))).toBe(false);

    // Directamente la reducida: varias operaciones a la vez.
    const rref = [
      ["1", "0", "2"],
      ["0", "1", "3"],
    ];
    rref.forEach((row, i) => row.forEach((v, j) => setCell("Matriz siguiente", i + 1, j + 1, v)));
    click("Comprobar paso");
    expect(screen.getByText(/Has hecho varias operaciones a la vez/)).toBeTruthy();
    expect(screen.getByText("Forma escalonada reducida")).toBeTruthy();

    // Clasificación y solución.
    click("Comprobar la solución");
    expect(screen.getByText("Elige cómo es el sistema.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Compatible indeterminado" }));
    click("Comprobar la solución");
    expect(screen.getByText(/La clasificación no es correcta/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Compatible determinado" }));
    type("x₁ =", "2");
    type("x₂ =", "4");
    click("Comprobar la solución");
    expect(screen.getByText("1 de 2 incógnitas bien.")).toBeTruthy();
    type("x₂ =", "3");
    click("Comprobar la solución");
    expect(screen.getByText("¡Correcto! La clasificación y la solución están bien.")).toBeTruthy();

    click("Ver la solución completa");
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByText(/Gauss-Jordan completo/)).toBeTruthy();
    expect(sol.getByText("x₁ = 2, x₂ = 3")).toBeTruthy();
  });

  it("un sistema indeterminado acepta cualquier parametrización", async () => {
    renderAt("/laboratorios/algebra-lineal");
    await heading();
    fireEvent.change(screen.getByLabelText("Sistema (matriz ampliada A | b)"), { target: { value: "propia" } });
    type("Tu matriz", "1 1 2\n2 2 4");
    click("Usar esta matriz");
    fireEvent.click(screen.getByRole("radio", { name: "Escribir la matriz" }));
    setCell("Matriz siguiente", 2, 1, "0");
    setCell("Matriz siguiente", 2, 2, "0");
    setCell("Matriz siguiente", 2, 3, "0");
    click("Comprobar paso");
    expect(screen.getByText("¡Bien! Es F₂ ← F₂ − 2·F₁.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Compatible indeterminado" }));
    type("x₁ =", "t");
    type("x₂ =", "2 − t");
    click("Comprobar la solución");
    expect(screen.getByText("¡Correcto! La clasificación y la solución están bien.")).toBeTruthy();
    type("x₂ =", "3 − t");
    click("Comprobar la solución");
    expect(screen.getByText(/Con todos los parámetros a 0 no sale una solución/)).toBeTruthy();
  });
});

describe("Operaciones con matrices", () => {
  it("producto: marca las celdas mal; determinante: avisa del signo cambiado; inversa de una singular", async () => {
    renderAt("/laboratorios/algebra-lineal?s=operaciones");
    await heading();
    // A = (1 2; 3 −1), B = (0 1; 2 4): A·B = (4 9; −2 −1).
    [
      ["4", "9"],
      ["-2", "1"],
    ].forEach((row, i) => row.forEach((v, j) => setCell("A·B", i + 1, j + 1, v)));
    click("Comprobar");
    expect(screen.getByText(/3 celdas bien de 4/)).toBeTruthy();
    expect(invalid(cell("A·B", 2, 2))).toBe(true);
    setCell("A·B", 2, 2, "-1");
    click("Comprobar");
    expect(screen.getByText("¡Correcto! Ese es el producto A·B.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Determinante" }));
    type("|A| =", "-1");
    click("Comprobar");
    expect(screen.getByText(/Te ha salido el signo cambiado/)).toBeTruthy();
    type("|A| =", "1");
    click("Comprobar");
    expect(screen.getByText("¡Correcto! |A| = 1.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Inversa" }));
    fireEvent.change(screen.getByLabelText("Matriz A"), { target: { value: "dos-singular" } });
    fireEvent.click(screen.getByRole("radio", { name: "Sí" }));
    click("Comprobar");
    expect(screen.getByText("Revisa si A es invertible: calcula su determinante.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    click("Comprobar");
    expect(screen.getByText("¡Correcto! |A| = 0, así que A no tiene inversa.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Rango" }));
    fireEvent.change(screen.getByLabelText("Matriz A"), { target: { value: "tres-rango-dos" } });
    type("rg A =", "2");
    click("Comprobar");
    expect(screen.getByText("¡Correcto! rg A = 2.")).toBeTruthy();
  });
});

describe("Independencia, autovalores, transformaciones y tensores", () => {
  it("independencia: vale cualquier base y se dice qué vector de la tuya no está en el subespacio", async () => {
    renderAt("/laboratorios/algebra-lineal?s=independencia");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Sí, son independientes" }));
    type("dim ⟨v₁, v₂⟩ =", "2");
    type("Una base de ⟨v₁, v₂⟩", "1 0 0\n0 1 3");
    click("Comprobar");
    expect(screen.getByText("No están en ⟨v₁, v₂⟩: el vector 1 de tu base.")).toBeTruthy();
    // (1, 3, 3) = v₁ + v₂ y (0, 1, 3) = v₂: otra base del mismo plano.
    type("Una base de ⟨v₁, v₂⟩", "1 3 3\n0 1 3");
    click("Comprobar");
    expect(screen.getByText("¡Todo correcto!")).toBeTruthy();
  });

  it("autovalores: polinomio factorizado, un autovalor que no lo es y autovectores con Av = λv", async () => {
    renderAt("/laboratorios/algebra-lineal?s=autovalores");
    await heading();
    type("Polinomio característico p(λ) = det(A − λI) (opcional)", "(λ − 2)(λ − 5)");
    click("Comprobar el polinomio");
    expect(screen.getByText("¡Correcto! Ese es el polinomio característico.")).toBeTruthy();
    type("Autovalores", "2; 4");
    click("Comprobar");
    expect(screen.getByText("λ = 4 no es autovalor: det(A − 4·I) ≠ 0.")).toBeTruthy();
    expect(screen.getByText("Te falta 1 autovalor.")).toBeTruthy();
    type("Autovalores", "2; 5");
    fireEvent.change(screen.getByLabelText("λ = 2: v ="), { target: { value: "1 1" } });
    fireEvent.change(screen.getByLabelText("λ = 5: v ="), { target: { value: "-3 -3" } });
    click("Comprobar");
    expect(screen.getByText("El vector para λ = 2 no cumple A·v = λ·v.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("λ = 2: v ="), { target: { value: "(1, -2)" } });
    click("Comprobar");
    expect(screen.getByText("¡Correcto! Todos los autovalores, cada uno con un autovector.")).toBeTruthy();
  });

  it("transformaciones: el dibujo sigue a los deslizadores y la práctica corrige la matriz de un giro", async () => {
    renderAt("/laboratorios/algebra-lineal?s=transformaciones");
    await heading();
    expect(screen.getByRole("img", { name: /e₁ va a \(1, 0\) y e₂ a \(1, 1\)/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("a₂₂"), { target: { value: "-1" } });
    expect(screen.getByText(/\|A\| = −1: el cuadrado unidad pasa a tener área 1 y se da la vuelta/)).toBeTruthy();
    expect(screen.getByText("Giro de 90° en sentido antihorario alrededor del origen.")).toBeTruthy();
    [
      ["0", "-1"],
      ["1", "1"],
    ].forEach((row, i) => row.forEach((v, j) => setCell("Matriz de la transformación", i + 1, j + 1, v)));
    click("Comprobar");
    expect(screen.getByText("3 de 4 celdas bien. Revisa las marcadas.")).toBeTruthy();
    setCell("Matriz de la transformación", 2, 2, "0");
    click("Comprobar");
    expect(screen.getByText("¡Correcto! Esa es la matriz de la transformación.")).toBeTruthy();
    click("Verla en el dibujo");
    expect(screen.getByRole("img", { name: /e₁ va a \(0, 1\) y e₂ a \(−1, 0\)/ })).toBeTruthy();
  });

  it("tensores: la forma de a + b con emisión, con la explicación después de acertar", async () => {
    renderAt("/laboratorios/algebra-lineal?s=tensores");
    await heading();
    expect(screen.getByText(/a\.shape == \(4, 3\)/)).toBeTruthy();
    const practice = within(screen.getByRole("region", { name: "¿Qué forma tiene el resultado?" }));
    fireEvent.click(screen.getByRole("radio", { name: "NumPy da un error" }));
    click("Comprobar");
    expect(screen.getByText("Esta operación sí da un resultado: vuelve a aplicar la regla.")).toBeTruthy();
    expect(practice.queryByText(/se repite a lo largo de este eje/)).toBeNull();
    type("Forma del resultado", "(4, 3)");
    click("Comprobar");
    expect(screen.getByText("¡Correcto! La forma es (4, 3).")).toBeTruthy();
    expect(practice.getByText(/b no tiene este eje: se le añade un 1 por la izquierda/)).toBeTruthy();

    // Comprobador de emisión con formas propias.
    type("a.shape", "(3,)");
    type("b.shape", "(4,)");
    expect(screen.getByText("No se pueden emitir: NumPy da un error.")).toBeTruthy();
  });
});
