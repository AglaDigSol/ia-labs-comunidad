// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NumericField } from "./NumericField.tsx";

afterEach(cleanup);

describe("NumericField", () => {
  it("usa un teclado de texto: el decimal no tiene signo menos ni «/»", () => {
    render(<NumericField label="Resultado" value="" onChange={() => {}} note="Usa coma decimal." />);
    const input = screen.getByLabelText("Resultado");
    expect(input.getAttribute("inputmode")).toBe("text");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
    const note = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(note?.textContent).toBe("Usa coma decimal.");
  });
});
