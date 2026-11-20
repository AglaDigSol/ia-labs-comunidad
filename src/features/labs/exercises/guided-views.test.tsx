// @vitest-environment jsdom
// Tipos guiados en el banco (tensores, factorizaciones, formas de NumPy, desbordamiento, extremos): cada
// uno se resuelve paso a paso desde la página, «Comprobar paso» solo desbloquea el siguiente con el
// anterior bien, un error típico se explica sin dar la respuesta y la solución queda tras la puerta.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { rightAnswer, stepMistakes, typedAnswer, type GuidedAnswer, type GuidedStep } from "../../../../shared/exercises/guided.ts";
import { GUIDED_TYPES } from "../../../../shared/exercises/guided-types.ts";
import { loadProgress } from "./progress.ts";
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
const checkStep = () => fireEvent.click(screen.getAllByRole("button", { name: "Comprobar paso" }).at(-1)!);

/** Escribe una respuesta en el paso, como lo haría una persona. */
function fill(step: GuidedStep, a: GuidedAnswer) {
  switch (a.kind) {
    case "numbers":
      if (step.kind !== "numbers") throw new Error("paso");
      a.cells.forEach((row, i) => row.forEach((value, j) => fireEvent.change(screen.getByLabelText(`${step.name}, fila ${i + 1}, columna ${j + 1}`), { target: { value } })));
      return;
    case "integer":
    case "list":
      if (step.kind !== "integer" && step.kind !== "list") throw new Error("paso");
      fireEvent.change(screen.getByLabelText(step.label), { target: { value: a.text } });
      return;
    case "shape":
      if (a.error) fireEvent.click(screen.getByLabelText("NumPy da un error"));
      else fireEvent.change(screen.getAllByLabelText("Forma del resultado").at(-1)!, { target: { value: a.text } });
      return;
    case "labels":
      if (step.kind !== "labels") throw new Error("paso");
      step.items.forEach((item, i) => fireEvent.change(screen.getByLabelText(item), { target: { value: a.picks[i] } }));
      return;
    case "choice":
      throw new Error("sin tipos de elegir");
  }
}

describe("tipos guiados en el banco de ejercicios", () => {
  for (const { type, guided } of GUIDED_TYPES) {
    it(`${type.id}: se resuelve paso a paso y cuenta en el progreso`, async () => {
      const inst = type.generate(seedFromText("g1")!, "medio");
      const g = guided(inst);
      renderAt(`/laboratorios/ejercicios?t=${type.id}&n=medio&s=g1`);
      expect(await screen.findByRole("heading", { level: 2, name: `Ejercicio 1: ${type.title}` }, { timeout: 5000 })).toBeTruthy();
      expect(screen.getByText(g.statement.ask)).toBeTruthy();
      g.steps.forEach((step, k) => {
        expect(screen.queryByText(new RegExp(`^Paso ${k + 2}\\.`))).toBeNull();
        // Un error típico (si lo hay): se explica, no se avanza y no se dice la respuesta.
        const m = stepMistakes(step)[0];
        if (m) {
          fill(step, typedAnswer(step, m.value));
          checkStep();
          expect(status()).toContain(m.text);
          expect(screen.queryByText(new RegExp(`^Paso ${k + 2}\\.`))).toBeNull();
        }
        fill(step, rightAnswer(step));
        checkStep();
        expect(status()).toContain(step.okText);
      });
      expect(status()).toMatch(/¡Ejercicio resuelto!/);
      expect(loadProgress()[type.id]?.medio?.solved).toBe(1);
      expect(screen.queryByTestId("solution")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
      expect(screen.getByTestId("solution").textContent).toContain(g.solution[0]!);
    });
  }
});
