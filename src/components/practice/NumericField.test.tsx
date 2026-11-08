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

describe("campos que admiten negativos o fracciones", () => {
  it("ninguno usa inputMode decimal (salvo las notas, que van de 0 a 10)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
      });
    const offenders = walk("src").filter((p) => !p.includes("grades") && readFileSync(p, "utf8").includes('inputMode="decimal"'));
    expect(offenders).toEqual([]);
  });
});
