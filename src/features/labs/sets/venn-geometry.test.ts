import { describe, expect, it } from "vitest";
import { drawnRegions, regionOrder, vennLayout } from "./venn-geometry.ts";

const inside = (p: { x: number; y: number }, c: { cx: number; cy: number; r: number }) => Math.hypot(p.x - c.cx, p.y - c.cy) < c.r;
const inBox = (p: { x: number; y: number }, w: number, h: number) => p.x > 8 && p.x < w - 8 && p.y > 8 && p.y < h - 8;

describe("venn-geometry", () => {
  it("los diagramas de siempre tienen todas sus regiones", () => {
    expect(drawnRegions(2)).toEqual(regionOrder(2));
    expect(drawnRegions(3)).toEqual(regionOrder(3));
    expect(vennLayout(2, null)).toBe(vennLayout(2));
    // Con tres conjuntos no hay dibujo anidado: se ignora la forma.
    expect(vennLayout(3, "A-en-B")).toBe(vennLayout(3));
  });

  it("A dentro de B: sin la región A ∩ Bᶜ, con A entero dentro de B y las anclas en su sitio", () => {
    const l = vennLayout(2, "A-en-B");
    const [a, b] = l.circles as [(typeof l.circles)[0], (typeof l.circles)[0]];
    expect(drawnRegions(2, "A-en-B")).toEqual([3, 2, 0]);
    expect(l.paths[1]).toBe("");
    expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) + a.r).toBeLessThan(b.r);
    // Anclas: A ∩ B dentro de A; Aᶜ ∩ B en el anillo; fuera, fuera de los dos.
    expect(inside(l.anchors[3]!, a)).toBe(true);
    expect(inside(l.anchors[2]!, b) && !inside(l.anchors[2]!, a)).toBe(true);
    expect(inside(l.anchors[0]!, b)).toBe(false);
    // Los nombres: A dentro de B pero fuera de A; B fuera de B.
    expect(inside(l.names[0]!, b) && !inside(l.names[0]!, a)).toBe(true);
    expect(inside(l.names[1]!, b)).toBe(false);
    for (const p of [...l.names, ...l.anchors, l.universeName]) expect(inBox(p, l.width, l.height)).toBe(true);
  });

  it("B dentro de A: el simétrico, sin Aᶜ ∩ B", () => {
    const l = vennLayout(2, "B-en-A");
    const [a, b] = l.circles as [(typeof l.circles)[0], (typeof l.circles)[0]];
    expect(drawnRegions(2, "B-en-A")).toEqual([3, 1, 0]);
    expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) + b.r).toBeLessThan(a.r);
    expect(inside(l.anchors[3]!, b)).toBe(true);
    expect(inside(l.anchors[1]!, a) && !inside(l.anchors[1]!, b)).toBe(true);
    expect(inside(l.names[1]!, a) && !inside(l.names[1]!, b)).toBe(true);
    expect(inside(l.names[0]!, a)).toBe(false);
  });

  it("separados: dos círculos que no se tocan, sin A ∩ B", () => {
    const l = vennLayout(2, "separados");
    const [a, b] = l.circles as [(typeof l.circles)[0], (typeof l.circles)[0]];
    expect(drawnRegions(2, "separados")).toEqual([1, 2, 0]);
    expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThan(a.r + b.r);
    expect(inside(l.anchors[1]!, a)).toBe(true);
    expect(inside(l.anchors[2]!, b)).toBe(true);
    for (const c of l.circles) {
      expect(c.cx - c.r).toBeGreaterThan(8);
      expect(c.cx + c.r).toBeLessThan(l.width - 8);
    }
  });

  it("iguales: un solo círculo rotulado «A = B»", () => {
    const l = vennLayout(2, "iguales");
    expect(l.circles).toHaveLength(1);
    expect(drawnRegions(2, "iguales")).toEqual([3, 0]);
    expect(l.nameText).toEqual(["A = B", ""]);
    expect(inside(l.anchors[3]!, l.circles[0]!)).toBe(true);
  });
});
