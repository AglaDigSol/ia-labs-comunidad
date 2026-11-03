// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isNegation } from "../../../../shared/exercises/logic-extra-negation.ts";
import { formalizeMatches, formalizeSentence, LOGIC_FORMALIZE, numberFamily, PRED_NEGATE_NL, PRED_NUMBERS, truthSets } from "../../../../shared/exercises/logic-extra.ts";
import { seedFromText } from "../../../../shared/exercises/random.ts";
import { LabsRoutes } from "../labs.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
const status = () => screen.getAllByRole("status").map((s) => s.textContent ?? "").join(" ");
const check = () => fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

describe("Formalizar un enunciado", () => {
  it("se elige entre cuatro o se escribe; vale cualquier fórmula equivalente", async () => {
    renderAt("/laboratorios/ejercicios?t=logica-formalizar&n=medio&s=f1");
    const x = LOGIC_FORMALIZE.generate(seedFromText("f1")!, "medio");
    expect(await screen.findByText(`«${formalizeSentence(x)}»`, undefined, { timeout: 5000 })).toBeTruthy();
    const group = screen.getByRole("group", { name: "¿Qué fórmula dice lo mismo que la frase?" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const right = x.options.findIndex((o) => formalizeMatches(o, x) === true);
    fireEvent.click(radios[(right + 1) % 4]!);
    check();
    expect(status()).toMatch(/Esa no es/);
    fireEvent.click(radios[right]!);
    check();
    expect(status()).toMatch(/¡Correcto!/);

    fireEvent.click(screen.getByRole("radio", { name: "Escribir la fórmula" }));
    const field = screen.getByLabelText("Fórmula") as HTMLInputElement;
    expect(field.placeholder).toBe("");
    fireEvent.change(field, { target: { value: "p ∧ s" } });
    check();
    expect(status()).toMatch(/Usa solo p, q/);
    fireEvent.change(field, { target: { value: x.options[right]! } });
    check();
    expect(status()).toMatch(/¡Correcto!/);
  });
});

describe("Negar en lenguaje natural", () => {
  it("una de cuatro frases es la negación", async () => {
    renderAt("/laboratorios/ejercicios?t=predicados-negar-frase&n=avanzado&s=n2");
    const x = PRED_NEGATE_NL.generate(seedFromText("n2")!, "avanzado");
    expect(await screen.findByText(`«${x.sentence}»`, undefined, { timeout: 5000 })).toBeTruthy();
    const right = x.options.findIndex((o) => isNegation(x.formula, o.formula));
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${x.options[right]!.text.replace(/[.()]/g, "\\$&")}$`) }));
    check();
    expect(status()).toMatch(/¡Correcto!/);
  });
});

describe("Predicados sobre conjuntos numéricos", () => {
  it("elige en qué conjuntos es verdadero, con la solución por conjuntos detrás de la puerta", async () => {
    let seed = "a";
    let x = PRED_NUMBERS.generate(seedFromText(seed)!, "medio");
    for (let i = 0; x.kind !== "conjuntos"; i++) x = PRED_NUMBERS.generate(seedFromText((seed = `b${i}`))!, "medio");
    renderAt(`/laboratorios/ejercicios?t=predicados-conjuntos-numericos&n=medio&s=${seed}`);
    const group = await screen.findByRole("group", { name: "Es verdadero:" }, { timeout: 5000 });
    const truth = truthSets(numberFamily(x.family)).sort().join("");
    const right = x.options.findIndex((o) => [...o].sort().join("") === truth);
    fireEvent.click(within(group).getAllByRole("radio")[right]!);
    check();
    expect(status()).toMatch(/¡Correcto!/);
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(screen.getByTestId("solution").textContent).toMatch(/verdadero|falso/);
  });
});
