// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { COMB_PACK } from "../../../../content/combinatoria/practica.ts";
import { algorithmGrowth } from "../../../../shared/discrete/algorithms.ts";
import { isConstantTrap, optionIsCorrect } from "../../../../shared/discrete/bigo.ts";
import { acceptedFormulas, countingFormula, countModel, FORMULA_IDS, FORMULAS, GUIDE_TEXT } from "../../../../shared/discrete/count.ts";
import { pnpStatement } from "../../../../shared/discrete/pnp.ts";
import { bigOOptions, COMB_COMPLEXITY, COMB_MODEL, COMB_PNP, COMB_PROBLEM, complexityGrowth, problemAnswer } from "../../../../shared/exercises/discrete.ts";
import { rngFor, seedFromText, seedToText } from "../../../../shared/exercises/random.ts";
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

const heading = () => screen.findByRole("heading", { level: 1, name: "Combinatoria" }, { timeout: 5000 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const status = () => screen.getAllByRole("status").map((s) => s.textContent ?? "").join(" ");
const answer = (group: string, option: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("radio", { name: option }));

describe("¿Qué fórmula es?", () => {
  it("comprueba la guía, el modelo y el número sin decir la respuesta", async () => {
    renderAt("/laboratorios/combinatoria");
    await heading();
    expect(screen.getByRole("tab", { name: "Combinatoria" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Tienes 7 libros distintos/)).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();

    // Guía con un error y número equivocado: se marcan, sin la respuesta (7! = 5040).
    answer(GUIDE_TEXT.order, "No");
    answer(GUIDE_TEXT.repetition, "No");
    fireEvent.click(screen.getByRole("radio", { name: /^Permutaciones P sub n/ }));
    const result = screen.getByLabelText("Resultado");
    fireEvent.change(result, { target: { value: "5000" } });
    click("Comprobar");
    expect(status()).toMatch(/1 de 2 bien/);
    expect(status()).toMatch(/Alguna respuesta de la guía no encaja/);
    expect(result.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("group", { name: GUIDE_TEXT.order }).getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).not.toMatch(/5040/);

    // Separador de miles: se explica con las cifras de la persona.
    fireEvent.change(result, { target: { value: "5.040" } });
    click("Comprobar");
    expect(screen.getByText(/Sin separador de miles, como en el examen: escribe 5040\./)).toBeTruthy();

    answer(GUIDE_TEXT.order, "Sí");
    answer(GUIDE_TEXT.all, "Sí");
    expect(screen.getByText(/la guía lleva a/).textContent).toMatch(/^Con tus respuestas, la guía lleva a: Permutaciones/);
    fireEvent.change(result, { target: { value: "5040" } });
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto! Modelo y resultado bien\./);

    click("Ver la solución completa");
    expect(screen.getByTestId("solution").textContent).toMatch(/5040/);
  });

  it("acepta C en lugar de PR con dos grupos (los destellos de la baliza)", async () => {
    renderAt("/laboratorios/combinatoria");
    await heading();
    fireEvent.change(screen.getByLabelText("Problema"), { target: { value: "baliza" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Combinaciones C sub n k/ }));
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "35" } });
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("las pistas dicen qué fórmula y por qué, nunca el número", async () => {
    renderAt("/laboratorios/combinatoria");
    await heading();
    fireEvent.change(screen.getByLabelText("Problema"), { target: { value: "mano-cartas" } });
    for (let i = 0; i < 6; i++) {
      const b = screen.getByRole("button", { name: i === 0 ? "Dame una pista" : "Otra pista" });
      if ((b as HTMLButtonElement).disabled) break;
      fireEvent.click(b);
    }
    expect(document.body.textContent).toMatch(/Combinaciones: Se eligen k de n/);
    expect(document.body.textContent).not.toMatch(/658008/);
  });
});

describe("Calculadora guiada", () => {
  it("calcula con BigInt y escribe el número sin separador de miles", async () => {
    renderAt("/laboratorios/combinatoria?s=calculadora");
    await heading();
    fireEvent.click(screen.getByRole("radio", { name: /^Combinaciones C sub n k/ }));
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("k"), { target: { value: "5" } });
    expect(screen.getByText("= 658008")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /^Permutaciones P sub n/ }));
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "30" } });
    expect(screen.getByText("= 265252859812191058636308480000000")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /^Variaciones V sub/ }));
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("k"), { target: { value: "5" } });
    expect(screen.getByText(/Sin repetición no se pueden elegir más elementos/)).toBeTruthy();
  });
});

describe("Funciones y cardinales", () => {
  it("cuenta las bien marcadas sin decir cuáles y, con todo bien, explica cada una", async () => {
    renderAt("/laboratorios/combinatoria?s=funciones");
    await heading();
    // |A| = 4, |B| = 6: verdaderas a), c) y e).
    const box = screen.getByRole("group", { name: /¿Qué afirmaciones son verdaderas\?/ });
    const boxes = within(box).getAllByRole("checkbox");
    fireEvent.click(boxes[0]!);
    click("Comprobar");
    expect(status()).toMatch(/3 de 5 bien/);
    fireEvent.click(boxes[2]!);
    fireEvent.click(boxes[4]!);
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
    expect(document.body.textContent).toMatch(/por el principio del palomar|hay sitio para mandar/);
  });
});

describe("Complejidad", () => {
  it("elige el orden entre a) y d); un fallo no dice cuál es la buena", async () => {
    renderAt("/laboratorios/combinatoria?s=complejidad");
    await heading();
    expect(screen.getByLabelText("Pseudocódigo").textContent).toMatch(/para cada a en A:/);
    const algo = COMB_PACK.algorithms[0]!;
    const g = algorithmGrowth(algo.algo);
    const options = bigOOptions(rngFor(`a-${algo.id}`, 0), g, 0.2);
    const right = options.findIndex((_, i) => optionIsCorrect(options, i, g));
    const wrong = options.findIndex((o, i) => !optionIsCorrect(options, i, g) && !isConstantTrap(o, g));
    const radios = within(screen.getByRole("group", { name: "Elige una opción" })).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const check = () => fireEvent.click(screen.getAllByRole("button", { name: "Comprobar" })[0]!);
    fireEvent.click(radios[wrong]!);
    check();
    expect(status()).toMatch(/Esa no es/);
    fireEvent.click(radios[right]!);
    check();
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("P y NP: verdadero o falso, con las explicaciones al acertarlas todas", async () => {
    renderAt("/laboratorios/combinatoria?s=complejidad");
    await heading();
    const ids = COMB_PNP.generate(1, "básico").ids;
    ids.forEach((id, i) => answer(`${"abcdef"[i]}) ${pnpStatement(id).text}`, pnpStatement(id).value ? "Verdadera" : "Falsa"));
    fireEvent.click(screen.getAllByRole("button", { name: "Comprobar" }).at(-1)!);
    expect(status()).toMatch(/¡Todas bien!/);
    expect(document.body.textContent).toContain(pnpStatement(ids[0]!).why);
  });
});

describe("en «Ejercicios»", () => {
  it("¿Qué modelo es?: las pistas solo preguntan (sin el nombre del modelo) y un fallo explica la opción elegida", async () => {
    renderAt("/laboratorios/ejercicios?t=combinatoria-modelo&n=medio&s=5");
    const x = COMB_MODEL.generate(seedFromText("5")!, "medio");
    await screen.findByText(x.text, undefined, { timeout: 5000 });
    for (let i = 0; i < 6; i++) {
      const b = screen.queryByRole("button", { name: i === 0 ? "Dame una pista" : "Otra pista" });
      if (!b || (b as HTMLButtonElement).disabled) break;
      fireEvent.click(b);
    }
    const hints = screen.getAllByRole("listitem").map((li) => li.textContent ?? "").join(" ");
    expect(hints).toMatch(/orden/);
    for (const id of FORMULA_IDS) expect(hints).not.toContain(`${FORMULAS[id].name}:`);
    expect(hints).not.toMatch(/Quedan (permutaciones|combinaciones)/);
    const accepted = acceptedFormulas(x.model);
    const wrong = x.options.find((id) => !accepted.includes(id))!;
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${FORMULAS[wrong].name} ${FORMULAS[wrong].spoken.slice(0, 10)}`) }));
    click("Comprobar");
    expect(status()).toMatch(/Ese no es el modelo\./);
    expect(status()).toContain(`Las ${FORMULAS[wrong].name.toLowerCase()} se usan cuando`);
    // Sin decir cuál es el bueno.
    for (const id of accepted) expect(status()).not.toContain(`Las ${FORMULAS[id].name.toLowerCase()} se usan`);
  });

  it("avanzado con varias etapas: una etapa sola lo dice y la solución enseña cada paso", async () => {
    const seed = Array.from({ length: 300 }, (_, i) => i).find((s) => COMB_PROBLEM.generate(s, "avanzado").terms.some((t) => t.times))!;
    const p = COMB_PROBLEM.generate(seed, "avanzado");
    const t = p.terms.find((x) => x.times)!;
    renderAt(`/laboratorios/ejercicios?t=combinatoria-problema&n=avanzado&s=${seedToText(seed)}`);
    await screen.findByText(p.text, undefined, { timeout: 5000 });
    if (p.terms.length === 1) {
      fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: countModel(t.model).toString() } });
      click("Comprobar");
      expect(status()).toMatch(/solo una de las etapas|el que dan las/);
    }
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: problemAnswer(p).toString() } });
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
    click("Ver la solución completa");
    expect(screen.getByTestId("solution").textContent).toContain(` · `);
    expect(screen.getByTestId("solution").textContent).toContain(`Respuesta: ${problemAnswer(p).toString()}`);
  });

  it("un número que es el de otro modelo lo dice (72 = V₉,₂ en vez de C₉,₂), sin dar el bueno", async () => {
    // Una semilla con combinaciones sin repetición y V distinto de C.
    const level = "básico" as const;
    const seed = Array.from({ length: 400 }, (_, i) => i).find((s) => {
      const p = COMB_PROBLEM.generate(s, level);
      return p.terms.length === 1 && countingFormula(p.terms[0]!.model) === "C" && p.terms[0]!.model.k >= 2;
    })!;
    const p = COMB_PROBLEM.generate(seed, level);
    const m = p.terms[0]!.model;
    const v = countModel({ n: m.n, k: m.k, order: true, repetition: false });
    renderAt(`/laboratorios/ejercicios?t=combinatoria-problema&n=basico&s=${seedToText(seed)}`);
    await screen.findByText(p.text, undefined, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: v.toString() } });
    click("Comprobar");
    expect(status()).toMatch(/Ese no es el resultado\./);
    expect(status()).toMatch(/Ese número es el que dan las variaciones, V\(\d+, \d+\)\. ¿Importa aquí el orden\?/);
    expect(status()).not.toContain(problemAnswer(p).toString());
  });

  it("el problema pide el número y acepta la respuesta exacta", async () => {
    renderAt("/laboratorios/ejercicios?t=combinatoria-problema&n=medio&s=abc");
    const p = COMB_PROBLEM.generate(seedFromText("abc")!, "medio");
    expect(await screen.findByText(p.text, undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Modelo" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: problemAnswer(p).toString() } });
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("la complejidad tiene cuatro opciones", async () => {
    renderAt("/laboratorios/ejercicios?t=combinatoria-complejidad&n=avanzado&s=k2");
    const x = COMB_COMPLEXITY.generate(seedFromText("k2")!, "avanzado");
    const radios = within(await screen.findByRole("group", { name: "Elige una opción" }, { timeout: 5000 })).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const right = x.options.findIndex((_, i) => optionIsCorrect(x.options, i, complexityGrowth(x)));
    fireEvent.click(radios[right]!);
    click("Comprobar");
    expect(status()).toMatch(/¡Correcto!/);
  });
});
