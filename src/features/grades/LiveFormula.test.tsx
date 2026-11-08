// @vitest-environment jsdom
// La fórmula de Notas sin avisos de KaTeX («\\ does nothing in display mode»), con las dos líneas
// separadas (la fracción larga de N no toca la de e_min).
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COURSES } from "../../../content/courses/index.ts";
import { LiveFormula } from "./LiveFormula.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LiveFormula", () => {
  it("dos líneas sin avisos de KaTeX", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const course = COURSES[0]!;
    const values = Object.fromEntries(course.components.map((c) => [c.id, 7.25]));
    const { container } = render(<LiveFormula course={course} values={values} accum={500} />);
    expect(warn).not.toHaveBeenCalled();
    expect(container.querySelector(".katex-error")).toBeNull();
    // Dos filas: N y e_min.
    expect(container.textContent).toMatch(/N=/);
    expect(container.textContent).toMatch(/emin/);
  });
});
