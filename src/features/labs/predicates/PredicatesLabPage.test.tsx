// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

async function open(url = "/laboratorios/predicados") {
  renderAt(url);
  // Ruta perezosa: margen bajo la carga de toda la batería.
  await screen.findByRole("heading", { level: 1, name: "Lógica de predicados" }, { timeout: 5000 });
}

const formulaField = () => screen.getByLabelText("Fórmula") as HTMLInputElement;
const setFormula = (v: string) => fireEvent.change(formulaField(), { target: { value: v } });
/** Pulsa una casilla V/F n veces (1: V, 2: F). */
const press = (name: RegExp, times: number) => {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole("button", { name }));
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const instance = (plain: string) => new RegExp(`^Instancia ${esc(plain)}:`);
const whole = (plain: string) => new RegExp(`^Fórmula ${esc(plain)}:`);

describe("PredicatesLabPage: evaluar en un dominio", () => {
  it("parte del primer ejemplo, con su análisis y la práctica paso a paso", async () => {
    await open();
    expect(screen.getByRole("tab", { name: "Predicados" }).getAttribute("aria-selected")).toBe("true");
    expect(formulaField().value).toBe("∀x (P(x) → Q(x))");
    expect(screen.getByLabelText("Fórmula normalizada")).toBeTruthy();
    expect(screen.getByText("Variables ligadas").nextElementSibling?.textContent).toBe("x");
    expect(screen.getByText("Variables libres").nextElementSibling?.textContent).toBe("ninguna");
    expect(screen.getByRole("radio", { name: "Paso a paso" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Paso 1 de 1:")).toBeTruthy();
    expect((screen.getByLabelText("P(2)") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("P(3)") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId("solution")).toBeNull();
  });

  it("marca las casillas mal sin mostrar el valor correcto y luego pide un contraejemplo", async () => {
    await open();
    press(instance("P(1) → Q(1)"), 2); // F (mal)
    press(instance("P(2) → Q(2)"), 2); // F
    press(instance("P(3) → Q(3)"), 1); // V
    press(instance("P(4) → Q(4)"), 1); // V
    press(whole("∀x (P(x) → Q(x))"), 2); // F
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    const bad = screen.getByRole("button", { name: instance("P(1) → Q(1)") });
    expect(bad.getAttribute("aria-label")).toBe("Instancia P(1) → Q(1): falsa, incorrecta");
    expect(screen.getByText("Hay instancias mal: revisa las marcadas.")).toBeTruthy();
    expect(screen.getByRole("button", { name: instance("P(2) → Q(2)") }).getAttribute("aria-label")).not.toContain("incorrecta");

    press(instance("P(1) → Q(1)"), 2); // F → ? → V
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByText("¡Correcto! La fórmula es falsa en este dominio.")).toBeTruthy();

    const witness = screen.getByRole("group", { name: /Ahora elige un contraejemplo/ });
    fireEvent.click(within(witness).getByRole("radio", { name: "x = 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar el contraejemplo" }));
    expect(screen.getByText("x = 1 no es un contraejemplo: prueba con otro elemento.")).toBeTruthy();
    fireEvent.click(within(witness).getByRole("radio", { name: "x = 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar el contraejemplo" }));
    expect(screen.getByText("Correcto: con x = 2, P(2) → Q(2) es falsa.")).toBeTruthy();
  });

  it("las pistas nombran la regla, no los valores", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    const hints = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(hints.some((h) => h.includes("basta una instancia falsa"))).toBe(true);
    expect(hints.some((h) => /P\(2\) → Q\(2\)/.test(h))).toBe(false);
  });

  it("cuantificadores anidados: primero las fórmulas de dentro", async () => {
    await open();
    setFormula("∀x ∃y M(x, y)");
    await waitFor(() => expect(screen.getByText("Paso 1 de 5:")).toBeTruthy());
    expect(screen.getByText("∃y M(1, y)", { selector: "span" })).toBeTruthy();
    press(instance("M(1, 1)"), 2);
    press(instance("M(1, 2)"), 1);
    press(instance("M(1, 3)"), 1);
    press(instance("M(1, 4)"), 1);
    press(whole("∃y M(1, y)"), 1);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByText("Paso 1 correcto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso: ∃y M(2, y)" }));
    expect(screen.getByText("Paso 2 de 5:")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Instancia M(2, 1): sin responder");
  });

  it("solo el resultado, con la interpretación editada en la rejilla", async () => {
    await open();
    setFormula("∃x (P(x) ∧ Q(x))");
    fireEvent.click(await screen.findByRole("radio", { name: "Solo el resultado" }));
    fireEvent.click(screen.getByLabelText("P(4)")); // ya no hay pares mayores que 2
    fireEvent.click(screen.getByRole("radio", { name: "Verdadera" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("No es correcto: revisa las instancias o prueba el modo paso a paso.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Falsa" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByText("¡Correcto! La fórmula es falsa en este dominio.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: /testigo/ })).toBeNull();
  });

  it("avisa de variables libres y de constantes que no están en el dominio", async () => {
    await open();
    setFormula("P(x) ∧ Q(7)");
    expect(await screen.findByText(/Tiene la variable libre x/)).toBeTruthy();
    expect(screen.getByText(/7 no es un elemento del dominio/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Comprueba tu respuesta" })).toBeNull();
  });

  it("los errores de escritura se marcan con su posición", async () => {
    await open();
    setFormula("∀x (P(x) ∧ q)");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("los predicados empiezan por mayúscula");
  });

  it("cambiar el dominio de ejemplo cambia la rejilla y la fórmula", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Dominio de ejemplo"), { target: { value: "grafo" } });
    expect(formulaField().value).toBe("∃x ∀y ¬F(x, y)");
    expect((screen.getByLabelText("F(a, b)") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("F(b, a)") as HTMLInputElement).checked).toBe(false);
    fireEvent.change(screen.getByLabelText("Elementos del dominio D"), { target: { value: "a, b, x" } });
    expect(screen.getByRole("alert").textContent).toContain("las letras u–z son variables");
  });

  it("la solución completa queda detrás de «Ver la solución completa»", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByText("Falsa")).toBeTruthy();
    expect(sol.getByText("Contraejemplos para x: 2.")).toBeTruthy();
  });
});

describe("PredicatesLabPage: negar paso a paso", () => {
  it("comprueba equivalencia y ley en cada paso y avisa al terminar", async () => {
    await open("/laboratorios/predicados?s=negar");
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(screen.getByRole("img", { name: "¬∀x P(x)" })).toBeTruthy();

    const next = () => screen.getByLabelText("Fórmula equivalente");
    const law = () => screen.getByLabelText("Ley que aplicas");

    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText(/Puedes aplicar «Negación del cuantificador universal»/)).toBeTruthy();

    fireEvent.change(next(), { target: { value: "∃x P(x)" } });
    fireEvent.change(law(), { target: { value: "neg-forall" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByRole("status").textContent).toMatch(/^No es equivalente a la línea anterior: en D = \{1, 2, 3, 4\}/);

    fireEvent.change(next(), { target: { value: "∃y ¬P(y)" } });
    fireEvent.change(law(), { target: { value: "neg-exists" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByRole("status").textContent).toContain("¿Quizá es «Negación del cuantificador universal»?");

    fireEvent.change(law(), { target: { value: "neg-forall" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByRole("status").textContent).toContain("¡Terminado!");
    expect(screen.getByRole("img", { name: "∃y ¬P(y)" })).toBeTruthy();
    expect(screen.queryByLabelText("Fórmula equivalente")).toBeNull();
  });

  it("rechaza dos leyes a la vez y la solución da la derivación de referencia", async () => {
    await open("/laboratorios/predicados?s=negar");
    fireEvent.change(screen.getByLabelText("Elige una de práctica o escribe la tuya"), { target: { value: "basico-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.change(screen.getByLabelText("Fórmula equivalente"), { target: { value: "∃x (P(x) ∧ ¬Q(x))" } });
    fireEvent.change(screen.getByLabelText("Ley que aplicas"), { target: { value: "neg-forall" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar paso" }));
    expect(screen.getByRole("status").textContent).toContain("no sale de aplicar una sola ley");

    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const sol = within(screen.getByTestId("solution"));
    expect(sol.getByRole("img", { name: "∃x ¬(P(x) → Q(x))" })).toBeTruthy();
    expect(sol.getByRole("img", { name: "∃x (P(x) ∧ ¬Q(x))" })).toBeTruthy();
    expect(sol.getByText("(Negación de la implicación)")).toBeTruthy();
  });
});

describe("PredicatesLabPage: traducir", () => {
  it("compara con la traducción de referencia en dominios pequeños", async () => {
    await open("/laboratorios/predicados?s=traducir");
    expect(screen.getByText("Todos los números pares son mayores que 2.", { selector: "blockquote" })).toBeTruthy();
    const field = screen.getByLabelText("Tu traducción");
    fireEvent.change(field, { target: { value: "∀x (P(x) ∧ Q(x))" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByRole("status").textContent).toMatch(/^No dice lo mismo que la frase: en D = /);

    fireEvent.change(field, { target: { value: "¬∃y (P(y) ∧ ¬Q(y))" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByRole("status").textContent).toContain("¡Bien!");

    fireEvent.change(field, { target: { value: "P(x) → Q(x)" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByRole("status").textContent).toContain("la variable libre x");

    fireEvent.change(field, { target: { value: "∀x (P(x) → R(x))" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(screen.getByRole("status").textContent).toContain("Usa solo los predicados del glosario: P, Q.");
  });
});
