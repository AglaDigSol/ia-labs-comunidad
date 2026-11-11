// Clasificación de estados y cadenas absorbentes con fracciones exactas (casos hechos a mano).
import { describe, expect, it } from "vitest";
import { equals, formatFrac, ONE, parseNumber, sum, type Frac } from "../rational.ts";
import { absorptionAnalysis } from "./absorption.ts";
import { classifyStates } from "./classify.ts";
import type { Mat } from "./matrix.ts";

const f = (s: string): Frac => {
  const r = parseNumber(s);
  if (!r.ok) throw new Error(s);
  return r.value;
};
const M = (rows: string[][]): Mat => rows.map((r) => r.map(f));
const fmt = (A: Mat) => A.map((r) => r.map(formatFrac));

describe("classifyStates", () => {
  it("absorbente, clase cerrada de dos estados y transitorio", () => {
    const P = M([
      ["1", "0", "0", "0"],
      ["0", "1/2", "1/2", "0"],
      ["0", "1", "0", "0"],
      ["1/4", "1/4", "0", "1/2"],
    ]);
    const c = classifyStates(P);
    expect(c.kind).toEqual(["absorbente", "recurrente", "recurrente", "transitorio"]);
    expect(c.classes).toEqual([[0], [1, 2], [3]]);
    expect(c.closed).toEqual([true, true, false]);
    expect(c.reach[3]).toEqual([true, true, true, true]);
    expect(c.reach[1]).toEqual([false, true, true, false]);
  });

  it("cadena irreducible: todos recurrentes", () => {
    expect(classifyStates(M([["0", "1"], ["1/2", "1/2"]])).kind).toEqual(["recurrente", "recurrente"]);
  });

  it("un estado que solo va a otro transitorio también es transitorio", () => {
    const c = classifyStates(M([["0", "1", "0"], ["0", "1/2", "1/2"], ["0", "0", "1"]]));
    expect(c.kind).toEqual(["transitorio", "transitorio", "absorbente"]);
  });
});

describe("absorptionAnalysis", () => {
  it("paseo con dos absorbentes en los extremos: N, B = N·R y t = N·1", () => {
    const P = M([
      ["1", "0", "0", "0"],
      ["1/2", "0", "1/2", "0"],
      ["0", "1/2", "0", "1/2"],
      ["0", "0", "0", "1"],
    ]);
    const a = absorptionAnalysis(P)!;
    expect(a.transient).toEqual([1, 2]);
    expect(a.absorbing).toEqual([0, 3]);
    expect(fmt(a.IminusQ)).toEqual([["1", "-1/2"], ["-1/2", "1"]]);
    expect(fmt(a.N)).toEqual([["4/3", "2/3"], ["2/3", "4/3"]]);
    expect(fmt(a.B)).toEqual([["2/3", "1/3"], ["1/3", "2/3"]]);
    expect(a.t.map(formatFrac)).toEqual(["2", "2"]);
  });

  it("cada fila de B suma 1", () => {
    const P = M([
      ["1/5", "3/10", "1/2", "0"],
      ["1/10", "2/5", "1/5", "3/10"],
      ["0", "0", "1", "0"],
      ["0", "0", "0", "1"],
    ]);
    const a = absorptionAnalysis(P)!;
    for (const row of a.B) expect(equals(sum(row), ONE)).toBe(true);
  });

  it("sin absorbentes, con recurrentes no absorbentes o sin transitorios: null", () => {
    expect(absorptionAnalysis(M([["1/2", "1/2"], ["1/2", "1/2"]]))).toBeNull();
    expect(absorptionAnalysis(M([["1", "0"], ["0", "1"]]))).toBeNull();
    expect(absorptionAnalysis(M([["1", "0", "0"], ["0", "0", "1"], ["0", "1", "0"]]))).toBeNull();
  });
});
