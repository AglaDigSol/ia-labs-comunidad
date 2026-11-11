// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import {
  correctNegation,
  isNegation,
  negationMistakeText,
  numText,
  PRED_CONCRETE,
  truthIn,
  validWitnesses,
  type PredConcreteInstance,
} from "../../../../shared/exercises/predicates-concrete.ts";
import { seedToText } from "../../../../shared/exercises/random.ts";
import type { ExerciseLevel } from "../../../../shared/exercises/types.ts";
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
/** Los avisos del ejercicio (sin el contador de la sesión). */
const status = () =>
  screen
    .getAllByRole("status")
    .map((s) => s.textContent ?? "")
    .filter((t) => !t.startsWith("En esta sesión"))
    .join(" ");
const check = () => {
  const buttons = screen.getAllByRole("button", { name: "Comprobar" });
  fireEvent.click(buttons[buttons.length - 1]!);
};

/** La primera semilla cuyo ejercicio cumple `ok`. */
function find(level: ExerciseLevel, ok: (x: PredConcreteInstance) => boolean): { seed: number; inst: PredConcreteInstance } {
  for (let seed = 1; seed < 5000; seed++) {
    const inst = PRED_CONCRETE.generate(seed, level);
    if (ok(inst)) return { seed, inst };
  }
  throw new Error("sin semilla");
}
const url = (seed: number, level = "basico") => `/laboratorios/ejercicios?t=predicados-conjunto-concreto&n=${level}&s=${seedToText(seed)}`;

describe("Cuantificadores en un conjunto concreto", () => {
  it("∃ verdadero: Verdadero y un testigo; un elemento que no sirve se explica con ese elemento", async () => {
    const { seed, inst } = find("básico", (x) => x.mode === "evaluar" && x.statement.kind === "simple" && x.statement.q === "exists" && truthIn(x.statement, x.set) && validWitnesses(x.statement, x.set).length < x.set.length);
    if (inst.mode !== "evaluar" || inst.statement.kind !== "simple") throw new Error("tipo");
    renderAt(url(seed));
    const group = await screen.findByRole("group", { name: "El enunciado es:" }, { timeout: 5000 });
    expect(screen.getByText(/¿Es verdadero este enunciado en A\?/)).toBeTruthy();
    // Sin elegir nada, no hay campo de testigo (no delata la respuesta).
    expect(screen.queryByLabelText(/Un testigo/)).toBeNull();
    // Falso: incorrecto, sin decir cuál es el testigo.
    fireEvent.click(within(group).getByRole("radio", { name: "Falso" }));
    check();
    const good = validWitnesses(inst.statement, inst.set);
    expect(status()).toMatch(/^No es eso\./);
    for (const w of good) expect(status()).not.toMatch(new RegExp(`(^|\\D)${numText(w)}(\\D|$)`));
    // Verdadero con un elemento que no sirve.
    fireEvent.click(within(group).getByRole("radio", { name: "Verdadero" }));
    const field = screen.getByLabelText(/Un testigo/) as HTMLInputElement;
    const bad = inst.set.find((x) => !good.includes(x))!;
    fireEvent.change(field, { target: { value: String(bad) } });
    check();
    expect(status()).toContain("El valor es correcto, pero falta un testigo válido.");
    expect(status()).toContain(`${numText(bad)} `);
    expect(status()).toContain("No sirve de testigo.");
    // Uno que no está en A.
    fireEvent.change(field, { target: { value: "99" } });
    check();
    expect(status()).toMatch(/99 no está en A/);
    // Un testigo válido (cualquiera).
    fireEvent.change(field, { target: { value: String(good[good.length - 1]) } });
    check();
    expect(status()).toMatch(/¡Correcto!/);
    expect(status()).toContain(`${numText(good[good.length - 1]!)} `);
    // La solución, detrás de la puerta: una fila por elemento.
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    const table = within(screen.getByTestId("solution")).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(inst.set.length + 1);
  });

  it("∀ verdadero: basta Verdadero, sin testigo", async () => {
    const { seed, inst } = find("medio", (x) => x.mode === "evaluar" && x.statement.kind === "simple" && x.statement.q === "forall" && truthIn(x.statement, x.set));
    renderAt(url(seed, "medio"));
    const group = await screen.findByRole("group", { name: "El enunciado es:" }, { timeout: 5000 });
    fireEvent.click(within(group).getByRole("radio", { name: "Falso" }));
    // Con Falso en un ∀ se pide un contraejemplo; cualquiera falla.
    fireEvent.change(screen.getByLabelText(/Un contraejemplo/), { target: { value: String(inst.set[0]) } });
    check();
    expect(status()).toMatch(/No es eso\./);
    expect(status()).toMatch(/No sirve de contraejemplo/);
    fireEvent.click(within(group).getByRole("radio", { name: "Verdadero" }));
    expect(screen.queryByLabelText(/Un contraejemplo/)).toBeNull();
    check();
    expect(status()).toMatch(/¡Correcto! Verdadero: todos los elementos de A cumplen/);
  });

  it("negar: un error típico se explica; la buena abre el segundo paso", async () => {
    const { seed, inst } = find("medio", (x) => x.mode === "negar" && truthIn(correctNegation(x.statement), x.set) === false);
    if (inst.mode !== "negar") throw new Error("tipo");
    renderAt(url(seed, "medio"));
    const group = await screen.findByRole("group", { name: "Es equivalente a:" }, { timeout: 5000 });
    expect(screen.getByRole("list", { name: "Nomenclatura" })).toBeTruthy();
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const right = inst.options.findIndex((o) => isNegation(inst.statement, o, inst.set));
    const wrong = (right + 1) % 4;
    fireEvent.click(radios[wrong]!);
    check();
    expect(status()).toContain(`Esa no es la negación. ${negationMistakeText(inst.statement, inst.options[wrong]!)}`);
    expect(screen.queryByRole("group", { name: "La negación es:" })).toBeNull();
    fireEvent.click(radios[right]!);
    check();
    expect(status()).toMatch(/¡Correcto! Es la negación/);
    // Segundo paso: la negación es falsa en A, con un contraejemplo (∀) o sin nada (∃).
    const step = screen.getByRole("group", { name: "La negación es:" });
    fireEvent.click(within(step).getByRole("radio", { name: "Falso" }));
    const neg = correctNegation(inst.statement);
    if (neg.q === "forall") fireEvent.change(screen.getByLabelText(/Un contraejemplo/), { target: { value: String(validWitnesses(neg, inst.set)[0]) } });
    check();
    expect(status()).toMatch(/¡Correcto![^¡]*¡Correcto!/);
  });
});
