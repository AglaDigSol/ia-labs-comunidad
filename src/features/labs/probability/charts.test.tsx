// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TREE_WIDTH, TreeDiagram } from "./charts.tsx";

afterEach(cleanup);

describe("TreeDiagram en el móvil", () => {
  it("las hojas (P(Aᵢ ∩ C)) se leen: dibujo estrecho y letra de 17 unidades, sin salirse", () => {
    const e = (text: string) => ({ text, state: "dato" as const });
    const { container } = render(
      <TreeDiagram
        branches={["S₁", "S₂"]}
        first={[e("0,7"), e("3/10")]}
        second={[
          [e("0,04"), e("0,96")],
          [e("0,1"), e("0,9")],
        ]}
        leaves={[e("0,028"), e("0,0300001")]}
        label="Árbol"
      />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${TREE_WIDTH} ${2 * 2 * 60 + 16}`);
    // A 320 px de ancho, 17 × 320 / 392 ≈ 14 px.
    expect(TREE_WIDTH).toBeLessThanOrEqual(400);
    const leaves = [...svg.querySelectorAll("text")].filter((t) => t.textContent?.startsWith("∩"));
    expect(leaves).toHaveLength(2);
    for (const t of leaves) {
      expect(Number(t.getAttribute("font-size"))).toBeGreaterThanOrEqual(17);
      // x + 10 caracteres monoespaciados (0,6 em) caben en el ancho.
      expect(Number(t.getAttribute("x")) + 10 * 0.6 * 17).toBeLessThanOrEqual(TREE_WIDTH);
    }
  });
});
