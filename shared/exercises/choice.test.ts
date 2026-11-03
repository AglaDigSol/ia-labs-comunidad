// Preguntas de opción múltiple: barajado determinista por semilla, «Ninguna de las otras» al final y
// correcta solo cuando no lo es ninguna otra, corrección exacta y selección exclusiva de «Ninguna».
import { describe, expect, it } from "vitest";
import { arrangeChoices, correctLetters, gradeChoice, NONE_ID, NONE_TEXT, seedFromKey, toggleChoice, type ChoiceQuestion } from "./choice.ts";

const q = (correct: boolean[], extra: Partial<ChoiceQuestion> = {}): ChoiceQuestion => ({
  mode: "single",
  options: correct.map((c, i) => ({ id: `o${i}`, text: `Opción ${i}`, correct: c })),
  ...extra,
});

describe("arrangeChoices", () => {
  it("baraja con la semilla: misma semilla, mismo orden; letras A, B, C…", () => {
    const question = q([true, false, false, false]);
    const a = arrangeChoices(question, 7);
    expect(arrangeChoices(question, 7)).toEqual(a);
    expect(a.map((o) => o.letter)).toEqual(["a", "b", "c", "d"]);
    const orders = new Set(Array.from({ length: 40 }, (_, s) => arrangeChoices(question, s).map((o) => o.id).join()));
    expect(orders.size).toBeGreaterThan(10);
    // Un texto también sirve de semilla.
    expect(arrangeChoices(question, "instancia")).toEqual(arrangeChoices(question, seedFromKey("instancia")));
  });

  it("«Ninguna de las otras» va la última y es correcta solo si no lo es ninguna otra", () => {
    for (let s = 0; s < 30; s++) {
      const withAnswer = arrangeChoices(q([false, true, false, false], { noneOfOthers: true }), s);
      expect(withAnswer).toHaveLength(5);
      expect(withAnswer[4]).toMatchObject({ id: NONE_ID, text: NONE_TEXT, letter: "e", correct: false });
      const without = arrangeChoices(q([false, false, false, false], { noneOfOthers: true }), s);
      expect(without[4]).toMatchObject({ id: NONE_ID, correct: true });
      expect(correctLetters(without)).toBe("e");
    }
  });

  it("rechaza preguntas mal hechas", () => {
    expect(() => arrangeChoices(q([true, true, false]), 1)).toThrow();
    expect(() => arrangeChoices(q([false, false]), 1)).toThrow();
    expect(() => arrangeChoices(q([false, false], { mode: "multi" }), 1)).toThrow();
    expect(() => arrangeChoices({ mode: "single", options: [{ id: "a", text: "", correct: true }, { id: "a", text: "", correct: false }] }, 1)).toThrow();
    expect(() => arrangeChoices({ mode: "single", options: [{ id: NONE_ID, text: "", correct: true }, { id: "b", text: "", correct: false }] }, 1)).toThrow();
    expect(() => arrangeChoices(q(Array.from({ length: 9 }, (_, i) => i === 0)), 1)).toThrow();
  });
});

describe("gradeChoice y toggleChoice", () => {
  const options = arrangeChoices(q([true, false, true, false], { mode: "multi" }), 3);
  it("cuenta aciertos, fallos y omisiones", () => {
    expect(gradeChoice(options, ["o0", "o2"])).toEqual({ correct: true, hits: 2, wrong: 0, missed: 0 });
    expect(gradeChoice(options, ["o0"])).toEqual({ correct: false, hits: 1, wrong: 0, missed: 1 });
    expect(gradeChoice(options, ["o0", "o1", "o2"])).toEqual({ correct: false, hits: 2, wrong: 1, missed: 0 });
    expect(gradeChoice(options, ["nada"]).correct).toBe(false);
  });
  it("opción única sustituye; varias alterna y «Ninguna» excluye a las demás", () => {
    expect(toggleChoice("single", ["a"], "b")).toEqual(["b"]);
    expect(toggleChoice("multi", ["a"], "b")).toEqual(["a", "b"]);
    expect(toggleChoice("multi", ["a", "b"], "a")).toEqual(["b"]);
    expect(toggleChoice("multi", ["a", "b"], NONE_ID)).toEqual([NONE_ID]);
    expect(toggleChoice("multi", [NONE_ID], "a")).toEqual(["a"]);
  });
});
