// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isNegation, negationMistake } from "../../../../shared/exercises/logic-extra-negation.ts";
import { formalizeMatches, formalizeSentence, LOGIC_FORMALIZE, numberFamily, PRED_NEGATE_NL, PRED_NUMBERS, readFormalizeInput, truthSets } from "../../../../shared/exercises/logic-extra.ts";
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
    // «v» suelta como «o»: (T) v (T) equivale a T.
    fireEvent.change(field, { target: { value: `(${x.options[right]!}) v (${x.options[right]!})` } });
    check();
    expect(status()).toMatch(/¡Correcto!/);
    // Pegada a otras letras es un nombre: se sugiere ∨ o |.
    fireEvent.change(field, { target: { value: "pvq" } });
    check();
    expect(status()).toMatch(/Para «o», escribe ∨ o \|/);
  });

  it("readFormalizeInput lee la v suelta como ∨ y deja los nombres", () => {
    expect(readFormalizeInput("p v q")).toBe("p ∨ q");
    expect(readFormalizeInput("(p)v(¬q)")).toBe("(p)∨(¬q)");
    expect(readFormalizeInput("p V q → r")).toBe("p ∨ q → r");
    expect(readFormalizeInput("pvq")).toBe("pvq");
    expect(readFormalizeInput("v1 ∧ vel")).toBe("v1 ∧ vel");
  });
});

describe("Negar en lenguaje natural", () => {
  it("una de cuatro frases es la negación", async () => {
    renderAt("/laboratorios/ejercicios?t=predicados-negar-frase&n=avanzado&s=n2");
    const x = PRED_NEGATE_NL.generate(seedFromText("n2")!, "avanzado");
    expect(await screen.findByText(`«${x.sentence}»`, undefined, { timeout: 5000 })).toBeTruthy();
    const right = x.options.findIndex((o) => isNegation(x.formula, o.formula));
    const wrong = x.options.findIndex((_, i) => i !== right);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${x.options[wrong]!.text.replace(/[.()]/g, "\\$&")}$`) }));
    check();
    // Explica el fallo de la opción elegida, sin decir cuál es la buena.
    expect(status()).toContain(`Esa no es la negación. ${negationMistake(x.formula, x.options[wrong]!.formula)}`);
    expect(status()).not.toContain(x.options[right]!.text);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${x.options[right]!.text.replace(/[.()]/g, "\\$&")}$`) }));
    check();
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("cada error típico tiene su explicación", () => {
    expect(negationMistake("¬∃x G(x)", "∀x ¬G(x)")).toMatch(/dice lo mismo/);
    expect(negationMistake("∀x ∃y R(x, y)", "∀x ∃y ¬R(x, y)")).toMatch(/Deja los cuantificadores/);
    expect(negationMistake("∀x ∃y R(x, y)", "∃x ∀y R(x, y)")).toMatch(/sí cambian como deben/);
    expect(negationMistake("∃x G(x)", "∃x ¬G(x)")).toMatch(/Deja los cuantificadores/);
    expect(negationMistake("∀x ∃y R(x, y)", "∀x ∀y ¬R(x, y)")).toMatch(/vale siempre lo contrario/);
    // Sobre todas las opciones equivocadas de muchas semillas: siempre hay explicación.
    for (const level of PRED_NEGATE_NL.levels) {
      for (let s = 0; s < 40; s++) {
        const y = PRED_NEGATE_NL.generate(s, level);
        for (const o of y.options) if (!isNegation(y.formula, o.formula)) expect(negationMistake(y.formula, o.formula).length).toBeGreaterThan(30);
      }
    }
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
