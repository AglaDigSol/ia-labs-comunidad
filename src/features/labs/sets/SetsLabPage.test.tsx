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

const heading = () => screen.findByRole("heading", { level: 1, name: "Conjuntos" }, { timeout: 5000 });
const region = (name: string | RegExp) => screen.getByRole("checkbox", { name });

describe("Diagrama de Venn", () => {
  it("sombrear A ∩ Bᶜ: marca las regiones mal sin decir cuáles van y la solución queda detrás del aviso", async () => {
    renderAt("/laboratorios/conjuntos");
    await heading();
    expect(screen.getByRole("tab", { name: "Conjuntos" }).getAttribute("aria-selected")).toBe("true");
    const venn = within(screen.getByRole("group", { name: "Tu diagrama de Venn para A ∩ Bᶜ" }));
    expect(venn.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.queryByTestId("solution")).toBeNull();

    fireEvent.click(region("A ∩ B"));
    expect(region("A ∩ B").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Marcadas: A ∩ B.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("2 de 4 regiones bien")).toBeTruthy();
    // Las dos regiones mal (una de más y una de menos) llevan «incorrecta»; las demás no.
    expect(region("A ∩ B, incorrecta")).toBeTruthy();
    expect(region("A ∩ Bᶜ, incorrecta")).toBeTruthy();
    expect(region("Aᶜ ∩ B")).toBeTruthy();

    // Con el teclado: Espacio desmarca y Enter marca.
    fireEvent.keyDown(region("A ∩ B, incorrecta"), { key: " " });
    expect(region("A ∩ B").getAttribute("aria-checked")).toBe("false");
    fireEvent.keyDown(region("A ∩ Bᶜ"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! Esas son las regiones de A ∩ Bᶜ.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("Trabaja por partes, de dentro hacia fuera: Bᶜ, luego A ∩ Bᶜ.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByRole("img", { name: /Solución: diagrama de Venn de A ∩ Bᶜ\. Regiones sombreadas: A ∩ Bᶜ\./ })).toBeTruthy();
  });

  it("una expresión propia con C dibuja tres conjuntos; una mal escrita avisa", async () => {
    renderAt("/laboratorios/conjuntos");
    await heading();
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "propia" } });
    fireEvent.change(screen.getByLabelText("Tu expresión"), { target: { value: "A ∪ B ∩ C" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta expresión" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Entre ∪ y ∩ hacen falta paréntesis/);
    fireEvent.change(screen.getByLabelText("Tu expresión"), { target: { value: "(A ∪ B) ∩ C" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar esta expresión" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    expect(region("A ∩ Bᶜ ∩ C")).toBeTruthy();
  });

  it("con elementos: señala lo que sobra, cuenta lo que falta y no dice cuál", async () => {
    renderAt("/laboratorios/conjuntos");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Con elementos" }));
    // Números del 1 al 10, A = {1,…,5}, B = pares: A ∩ B = {2, 4}.
    expect(screen.getByLabelText("Expresión")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tu resultado"), { target: { value: "{2, 7}" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("No pertenecen al resultado: 7.")).toBeTruthy();
    expect(screen.getByText("Te falta 1 elemento.")).toBeTruthy();
    expect(screen.queryByText(/4/, { selector: "[role=status] span" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Tu resultado"), { target: { value: "4, 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! Ese es el conjunto.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("A ∩ B = {2, 4}")).toBeTruthy();
  });

  it("con elementos: un conjunto que se sale del universo es un error", async () => {
    renderAt("/laboratorios/conjuntos");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Con elementos" }));
    fireEvent.change(screen.getByLabelText("A"), { target: { value: "1, 2, 99" } });
    expect(screen.getByRole("alert").textContent).toBe("A tiene elementos que no están en U: 99.");
    expect((screen.getByRole("button", { name: "Comprobar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Comprobar una igualdad", () => {
  const step = (expr: string, law: string) => {
    fireEvent.change(screen.getByLabelText("Nueva expresión"), { target: { value: expr } });
    fireEvent.change(screen.getByLabelText("Ley que aplicas"), { target: { value: law } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
  };

  it("paso a paso: rechaza un paso que no es igual, avisa de la ley y detecta el final", async () => {
    renderAt("/laboratorios/conjuntos?s=igualdades");
    await heading();
    expect((screen.getByLabelText("Elige una de práctica o escribe la tuya") as HTMLSelectElement).value).toBe("particion");
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    step("A ∩ B", "diferencia");
    expect(screen.getByText("No es igual a la expresión anterior: la región A ∩ Bᶜ está en la anterior y no en la nueva.")).toBeTruthy();
    step("(A ∩ Bᶜ) ∪ (A ∩ B)", "demorgan");
    expect(screen.getAllByText("Es igual, pero no parece ser la ley De Morgan; ¿quizá Diferencia?").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer último paso" }));
    step("(A ∩ Bᶜ) ∪ (A ∩ B)", "diferencia");
    expect(screen.getByText("Paso correcto: Diferencia.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pista" }));
    expect(screen.getByText(/Leyes con alguna instancia aplicable ahora: .*Distributivas/)).toBeTruthy();
    step("A ∩ (Bᶜ ∪ B)", "distributiva");
    step("A ∩ U", "complemento");
    expect(screen.queryByText(/Igualdad demostrada/)).toBeNull();
    step("A", "identidad");
    expect(screen.getByText("¡Igualdad demostrada! Has llegado a A.")).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Pasos de la demostración" })).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
  });

  it("¿Son iguales?: el contraejemplo solo aparece después de responder", async () => {
    renderAt("/laboratorios/conjuntos?s=igualdades");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "¿Son iguales?" }));
    fireEvent.change(screen.getByLabelText("Igualdad"), { target: { value: "falsa-morgan" } });
    expect(screen.queryByText(/Contraejemplo/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Son iguales" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("No es correcto: no son iguales.")).toBeTruthy();
    expect(screen.getByText("Contraejemplo: la región A ∩ Bᶜ está en la primera expresión y no en la segunda.")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Contraejemplo: región A ∩ Bᶜ/ })).toBeTruthy();
  });

  it("¿Son iguales?: si lo son, lleva a demostrarlo paso a paso", async () => {
    renderAt("/laboratorios/conjuntos?s=igualdades");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "¿Son iguales?" }));
    fireEvent.change(screen.getByLabelText("Igualdad"), { target: { value: "morgan-union" } });
    fireEvent.click(screen.getByRole("radio", { name: "Son iguales" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! Son iguales.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Demostrarlo paso a paso" }));
    step("Aᶜ ∩ Bᶜ", "demorgan");
    expect(screen.getByText("¡Igualdad demostrada! Has llegado a Aᶜ ∩ Bᶜ.")).toBeTruthy();
  });
});

describe("Cardinales e inclusión–exclusión", () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it("rellena el diagrama de dentro hacia fuera, sin revelar los valores, y corrige las preguntas", async () => {
    renderAt("/laboratorios/conjuntos?s=cardinales");
    await heading();
    // Idiomas: |U| = 60, |A| = 35, |B| = 28, |A ∩ B| = 10.
    expect(screen.getByText("Paso 1 de 3")).toBeTruthy();
    fill("|A ∩ B|", "12");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByText("0 de 1 regiones bien")).toBeTruthy();
    expect(screen.getByText("incorrecta")).toBeTruthy();
    expect(screen.queryByText("10", { selector: "text" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText("Empieza por el centro: |A ∩ B|.")).toBeTruthy();
    fill("|A ∩ B|", "10");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByText("Paso 1 correcto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(document.activeElement).toBe(screen.getByLabelText("|Aᶜ ∩ B|"));
    fill("|Aᶜ ∩ B|", "18");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    // La casilla vacía cuenta como pendiente, no como incorrecta.
    expect(screen.getByText("Te falta 1 región por rellenar.")).toBeTruthy();
    expect(screen.queryByText("incorrecta")).toBeNull();
    fill("|A ∩ Bᶜ|", "25");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    fill("|Aᶜ ∩ Bᶜ|", "7");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByText("Diagrama completo: ahora contesta las preguntas.")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Diagrama de Venn de «Idiomas en una academia»/ }).textContent).toContain("25");

    fill("¿Cuántos estudian al menos uno de los dos idiomas?", "53");
    fill("¿Cuántos estudian solo inglés?", "25");
    fill("¿Cuántos no estudian ninguno?", "8");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar respuestas" }));
    expect(screen.getByText("2 de 3 respuestas correctas")).toBeTruthy();
    fill("¿Cuántos no estudian ninguno?", "7");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar respuestas" }));
    expect(screen.getByText("¡Correcto! Todas las respuestas están bien.")).toBeTruthy();
  });

  it("tres conjuntos: cuatro pasos y la solución completa tras el aviso", async () => {
    renderAt("/laboratorios/conjuntos?s=cardinales");
    await heading();
    fireEvent.change(screen.getByLabelText("Problema"), { target: { value: "optativas" } });
    expect(screen.getByText("Paso 1 de 4")).toBeTruthy();
    expect(screen.getByLabelText("|A ∩ B ∩ C|")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const label = within(screen.getByTestId("solution")).getByRole("img").getAttribute("aria-label")!;
    expect(label).toContain("|A ∩ Bᶜ ∩ Cᶜ| = 23");
    expect(label).toContain("|Aᶜ ∩ Bᶜ ∩ Cᶜ| = 4");
  });
});

describe("Partes y producto cartesiano", () => {
  it("𝒫(A): corrige el número y la lista sin importar el orden", async () => {
    renderAt("/laboratorios/conjuntos?s=partes");
    await heading();
    fireEvent.change(screen.getByLabelText("A"), { target: { value: "a, b" } });
    fireEvent.change(screen.getByLabelText("¿Cuántos elementos tiene 𝒫(A)?"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Los elementos de 𝒫(A)"), { target: { value: "∅, {a}, {c}" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("El número no es correcto: recuerda que |𝒫(A)| = 2^|A|.")).toBeTruthy();
    expect(screen.getByText("No son subconjuntos de A: {c}.")).toBeTruthy();
    expect(screen.getByText("Te faltan 2.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("¿Cuántos elementos tiene 𝒫(A)?"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Los elementos de 𝒫(A)"), { target: { value: "{{b, a}, {b}, ∅, {a}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("El número es correcto: |𝒫(A)| = 2^|A| = 2^2 = 4.")).toBeTruthy();
    expect(screen.getByText("¡Correcto! Tu lista es 𝒫(A).")).toBeTruthy();
  });

  it("A × B: detecta pares al revés", async () => {
    renderAt("/laboratorios/conjuntos?s=partes");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: "Producto cartesiano" }));
    fireEvent.change(screen.getByLabelText("A"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("B"), { target: { value: "1, 2" } });
    fireEvent.change(screen.getByLabelText("¿Cuántos elementos tiene A × B?"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Los elementos de A × B"), { target: { value: "(x, 1), (2, x)" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("No son pares de A × B: (2, x).")).toBeTruthy();
    expect(screen.getByText("Algún par está al revés: en A × B, la primera componente es de A.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText("A × B = {(x, 1), (x, 2)}")).toBeTruthy();
  });
});
