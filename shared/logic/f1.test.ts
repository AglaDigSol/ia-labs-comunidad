import { describe, expect, it } from "vitest";
import { F1_NAMES, f1Name, f1Table } from "./f1.ts";

describe("F1", () => {
  it("suma", () => {
    expect(f1Table("suma")).toEqual({
      Id: { Id: "Id", f: "Id", g: "g", h: "g" },
      f: { Id: "Id", f: "f", g: "g", h: "h" },
      g: { Id: "g", f: "g", g: "g", h: "g" },
      h: { Id: "g", f: "h", g: "g", h: "h" },
    });
  });
  it("producto", () => {
    expect(f1Table("producto")).toEqual({
      Id: { Id: "Id", f: "f", g: "Id", h: "f" },
      f: { Id: "f", f: "f", g: "f", h: "f" },
      g: { Id: "Id", f: "f", g: "g", h: "h" },
      h: { Id: "f", f: "f", g: "h", h: "h" },
    });
  });
  it("commutative with neutrals", () => {
    for (const op of ["suma", "producto"] as const) {
      const t = f1Table(op);
      const n = op === "suma" ? "f" : "g";
      for (const a of F1_NAMES) {
        expect(t[a][n]).toBe(a);
        for (const b of F1_NAMES) expect(t[a][b]).toBe(t[b][a]);
      }
    }
  });
  it("names", () => expect(f1Name([1, 0])).toBe("h"));
});
