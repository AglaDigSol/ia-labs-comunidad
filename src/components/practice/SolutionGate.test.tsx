// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HIDE_LABEL, REVEAL_LABEL, SolutionGate } from "./SolutionGate.tsx";

afterEach(cleanup);

describe("SolutionGate", () => {
  it("al abrir y al cerrar, el foco pasa al botón que sustituye al pulsado", () => {
    render(
      <SolutionGate>
        <p>La solución</p>
      </SolutionGate>,
    );
    fireEvent.click(screen.getByRole("button", { name: REVEAL_LABEL }));
    expect(screen.getByText("La solución")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: HIDE_LABEL }));
    fireEvent.click(screen.getByRole("button", { name: HIDE_LABEL }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: REVEAL_LABEL }));
  });
});
