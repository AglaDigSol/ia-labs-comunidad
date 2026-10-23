// Casos de libro de cadenas de Markov, con aritmética racional exacta.
import { describe, expect, it } from "vitest";
import { equals, formatFrac, frac, parseNumber, type Frac } from "../rational.ts";
import { evolve } from "./evolution.ts";
import type { Mat, Vec } from "./matrix.ts";
import { stationary } from "./systems.ts";
import { validateStochastic } from "./validate.ts";

const f = (s: string): Frac => {
  const r = parseNumber(s);
  if (!r.ok) throw new Error(s);
  return r.value;
};
const M = (rows: string[][]): Mat => rows.map((r) => r.map(f));

describe("cadena de dos estados", () => {
  // P = [[1−a, a], [b, 1−b]] tiene π = (b/(a+b), a/(a+b)) para a + b > 0.
  it.each([
    ["1/4", "1/2"],
    ["0,1", "0,3"],
    ["2/5", "3/5"],
    ["1", "1"],
  ])("a = %s, b = %s: π coincide con la fórmula analítica", (as, bs) => {
    const a = f(as);
    const b = f(bs);
    const one = frac(1n);
    const P: Mat = [
      [frac(one.n * a.d - a.n, a.d), a],
      [b, frac(one.n * b.d - b.n, b.d)],
    ];
    expect(validateStochastic(P).ok).toBe(true);
    const r = stationary(P);
    expect(r.kind).toBe("unique");
    if (r.kind !== "unique") return;
    const s = frac(a.n * b.d + b.n * a.d, a.d * b.d); // a + b
    const piA = frac(b.n * s.d, b.d * s.n); // b / (a + b)
    const piB = frac(a.n * s.d, a.d * s.n); // a / (a + b)
    expect(equals(r.pi[0]!, piA)).toBe(true);
    expect(equals(r.pi[1]!, piB)).toBe(true);
    expect(r.check).toBe(true);
  });

  it("con a = b = 0 (dos estados absorbentes) π no es única", () => {
    expect(stationary(M([["1", "0"], ["0", "1"]])).kind).toBe("not-unique");
  });

  it("la evolución converge hacia π (a = 1/4, b = 1/2 → π = (2/3, 1/3))", () => {
    const P = M([["3/4", "1/4"], ["1/2", "1/2"]]);
    const { vectors } = evolve(P, [f("1"), f("0")] as Vec, 10);
    const last = vectors[10]!;
    expect(Math.abs(Number(last[0]!.n) / Number(last[0]!.d) - 2 / 3)).toBeLessThan(1e-5);
  });
});

describe("matrices doblemente estocásticas", () => {
  it.each([
    [[["0,5", "0,3", "0,2"], ["0,2", "0,5", "0,3"], ["0,3", "0,2", "0,5"]]],
    [[["0", "1", "0"], ["0", "0", "1"], ["1", "0", "0"]]],
    [[["1/4", "1/4", "1/4", "1/4"], ["1/2", "0", "1/2", "0"], ["0", "1/2", "0", "1/2"], ["1/4", "1/4", "1/4", "1/4"]]],
  ])("π es la distribución uniforme", (rows) => {
    const P = M(rows);
    const n = P.length;
    // Doblemente estocástica: también las columnas suman 1.
    const cols: Mat = P[0]!.map((_, j) => P.map((row) => row[j]!));
    expect(validateStochastic(P).ok && validateStochastic(cols).ok).toBe(true);
    const r = stationary(P);
    expect(r.kind).toBe("unique");
    if (r.kind === "unique") expect(r.pi.map(formatFrac)).toEqual(Array(n).fill(`1/${n}`));
  });
});
