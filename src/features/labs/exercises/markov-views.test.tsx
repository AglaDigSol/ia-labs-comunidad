// @vitest-environment jsdom
// Ejercicios de Markov en el banco: «Comprobar paso» desbloquea el siguiente paso solo con el anterior
// bien, los avisos hablan de lo escrito (no de la respuesta), las pistas no dan el resultado y la
// solución completa queda detrás de la puerta.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import {
  absorptionOf,
  classifyOf,
  evolutionVectors,
  MARKOV_ABSORPTION,
  MARKOV_CLASSIFY,
  MARKOV_EVOLUTION,
  MARKOV_STATIONARY,
  stationaryOf,
} from "../../../../shared/exercises/markov.ts";
import { seedFromText } from "../../../../shared/exercises/random.ts";
import { EXERCISE_LEVELS } from "../../../../shared/exercises/types.ts";
import { formatFrac, formatDecimal, type Frac } from "../../../../shared/rational.ts";
import { LabsRoutes } from "../labs.tsx";
import { ABSORPTION_HINTS, CLASSIFY_HINTS, EVOLUTION_HINTS, STATIONARY_HINTS } from "./markov-views.tsx";

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
const checkStep = () => fireEvent.click(screen.getAllByRole("button", { name: "Comprobar paso" }).at(-1)!);
const type = (name: string, i: number, j: number, value: string) => fireEvent.change(screen.getByLabelText(`${name}, fila ${i + 1}, columna ${j + 1}`), { target: { value } });
const fill = (name: string, M: readonly (readonly Frac[])[]) => M.forEach((row, i) => row.forEach((x, j) => type(name, i, j, formatFrac(x))));

describe("Markov en el banco de ejercicios", () => {
  it("distribución tras n pasos: cada paso se comprueba y desbloquea el siguiente", async () => {
    const seed = seedFromText("m1")!;
    const inst = MARKOV_EVOLUTION.generate(seed, "básico");
    const vs = evolutionVectors(inst);
    renderAt("/laboratorios/ejercicios?t=markov-evolucion&n=basico&s=m1");
    expect(await screen.findByRole("heading", { level: 2, name: /Distribución tras n pasos/ }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText(/Paso 2\./)).toBeNull();
    // Un vector que no suma 1: avisa de eso, sin decir el resultado.
    type("v₁", 0, 0, "1");
    type("v₁", 0, 1, "1");
    checkStep();
    expect(status()).toMatch(/no coincide|no coinciden/);
    expect(status()).toMatch(/suma 2, no 1/);
    expect(status()).not.toContain(formatFrac(vs[1]![0]!));
    fill("v₁", [vs[1]!]);
    checkStep();
    expect(screen.getByText(/Paso 2\./)).toBeTruthy();
    fill("v₂", [vs[2]!]);
    checkStep();
    expect(status()).toMatch(/¡Ejercicio resuelto!/);
    expect(screen.queryByTestId("solution")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(screen.getByTestId("solution").textContent).toMatch(/Paso 2: v₂ = v₁·P/);
  });

  it("estacionaria: si suma 1 pero no es estacionario, lo dice", async () => {
    const inst = MARKOV_STATIONARY.generate(seedFromText("m2")!, "medio");
    const pi = stationaryOf(inst);
    renderAt("/laboratorios/ejercicios?t=markov-estacionaria&n=medio&s=m2");
    await screen.findByRole("heading", { level: 2, name: /Distribución estacionaria/ }, { timeout: 5000 });
    type("π", 0, 0, "1");
    type("π", 0, 1, "0");
    type("π", 0, 2, "0");
    checkStep();
    expect(status()).toMatch(/suma 1, pero al multiplicarlo por P cambia/);
    fill("π", [pi]);
    checkStep();
    expect(status()).toMatch(/¡Ejercicio resuelto!/);
  });

  it("clasificación: marca los estados mal clasificados", async () => {
    const inst = MARKOV_CLASSIFY.generate(seedFromText("m3")!, "básico");
    const kinds = classifyOf(inst).kind;
    renderAt("/laboratorios/ejercicios?t=markov-clasificacion&n=basico&s=m3");
    await screen.findByRole("heading", { level: 2, name: /Clasificación de estados/ }, { timeout: 5000 });
    const select = (i: number, v: string) => fireEvent.change(screen.getByLabelText(`Estado ${i + 1}`), { target: { value: v } });
    kinds.forEach((_, i) => select(i, "recurrente"));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/Los marcados no coinciden/);
    kinds.forEach((k, i) => select(i, k));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/¡Correcto!/);
  });

  it("absorción: I − Q, N y B (y t en avanzado), paso a paso", async () => {
    const inst = MARKOV_ABSORPTION.generate(seedFromText("m4")!, "avanzado");
    const a = absorptionOf(inst);
    renderAt("/laboratorios/ejercicios?t=markov-absorcion&n=avanzado&s=m4");
    await screen.findByRole("heading", { level: 2, name: /Probabilidad de absorción/ }, { timeout: 5000 });
    fill("I − Q", a.IminusQ);
    checkStep();
    fill("N", a.N);
    checkStep();
    fill("B", a.B);
    checkStep();
    fill("t", a.t.map((x) => [x]));
    checkStep();
    expect(status()).toMatch(/¡Ejercicio resuelto!/);
  });

  it("las pistas no dan el resultado", () => {
    const hints = [...EVOLUTION_HINTS, ...STATIONARY_HINTS, ...CLASSIFY_HINTS, ...Object.values(ABSORPTION_HINTS).flat()].join(" ");
    for (const level of EXERCISE_LEVELS) {
      for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const answers: Frac[] = [
          ...evolutionVectors(MARKOV_EVOLUTION.generate(s, level)).slice(1).flat(),
          ...stationaryOf(MARKOV_STATIONARY.generate(s, level)),
          ...absorptionOf(MARKOV_ABSORPTION.generate(s, level)).B.flat(),
          ...absorptionOf(MARKOV_ABSORPTION.generate(s, level)).N.flat(),
        ];
        for (const x of answers.filter((y) => y.d > 1n)) {
          expect(hints).not.toContain(formatFrac(x));
          expect(hints).not.toContain(formatDecimal(x, 4).text);
        }
      }
    }
    for (const k of ["absorbente", "recurrente", "transitorio"]) expect(CLASSIFY_HINTS.join(" ")).not.toMatch(new RegExp(`estado \\d+ es ${k}`));
  });
});
