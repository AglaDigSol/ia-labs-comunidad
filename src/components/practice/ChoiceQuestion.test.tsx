// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arrangeChoices, type ChoiceQuestion } from "../../../shared/exercises/choice.ts";
import { ChoiceOptions, ChoicePractice } from "./ChoiceQuestion.tsx";

afterEach(cleanup);

const single: ChoiceQuestion = {
  mode: "single",
  noneOfOthers: true,
  options: [
    { id: "a", text: "Dos", correct: false, why: "Te has dejado uno al contar." },
    { id: "b", text: "Tres", correct: true },
    { id: "c", text: "Cuatro", correct: false },
    { id: "d", text: "Cinco", tex: "5", correct: false },
  ],
};

const status = () => screen.getByRole("status").textContent ?? "";

describe("ChoicePractice", () => {
  it("opción única: radios con letra, «Ninguna de las otras» la última, y el aviso no dice cuál es la buena", () => {
    const onSolved = vi.fn();
    render(<ChoicePractice legend="¿Cuánto vale?" question={single} seedKey={5} onSolved={onSolved} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /^e\) Ninguna de las otras/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/Elige una opción/);
    fireEvent.click(screen.getByRole("radio", { name: /Dos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/No es esa/);
    // El «por qué» de la opción elegida, sin decir cuál es la buena.
    expect(status()).toMatch(/Por qué no: Te has dejado uno al contar\./);
    expect(status()).not.toMatch(/Tres|[a-e]\)/);
    expect(onSolved).not.toHaveBeenCalled();
    expect(screen.queryByTestId("solution")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Tres/ }));
    // Al cambiar la selección, el aviso anterior desaparece.
    expect(status()).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/¡Correcto!/);
    expect(onSolved).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(screen.getByTestId("solution").textContent).toMatch(/Te has dejado uno al contar\./);
  });

  it("varias correctas: casillas; hace falta marcar exactamente las correctas", () => {
    const onSolved = vi.fn();
    const multi: ChoiceQuestion = { ...single, mode: "multi", noneOfOthers: false, options: single.options.map((o) => ({ ...o, correct: o.id !== "a" && o.id !== "c" })) };
    render(<ChoicePractice legend="Marca las impares" question={multi} seedKey="k" onSolved={onSolved} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: /Tres/ }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/sobra alguna marcada o falta alguna/);
    fireEvent.click(screen.getByRole("checkbox", { name: /Cinco/ }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(status()).toMatch(/¡Correcto!/);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });
});

describe("ChoiceOptions", () => {
  it("controlada, con marcas opcionales para corregir un examen", () => {
    const options = arrangeChoices(single, 2);
    const onChange = vi.fn();
    render(<ChoiceOptions legend="Pregunta 1" options={options} mode="single" value={["b"]} onChange={onChange} marks={{ b: "ok" }} />);
    expect((screen.getByRole("radio", { name: /Tres/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Bien")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Cuatro/ }));
    expect(onChange).toHaveBeenCalledWith(["c"]);
  });
});
