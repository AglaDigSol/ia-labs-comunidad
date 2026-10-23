import { describe, expect, it } from "vitest";
import { formatFrac, parseNumber, toNumber, type Frac } from "../rational.ts";
import { evolve, MAX_STEPS } from "./evolution.ts";
import type { Mat, Vec } from "./matrix.ts";
import { describeIssue, validateDistribution, validateStochastic } from "./validate.ts";

const p = (s: string): Frac => {
  const r = parseNumber(s);
  if (!r.ok) throw new Error(s);
  return r.value;
};
const mat = (rows: string[][]): Mat => rows.map((r) => r.map(p));
const vec = (xs: string[]): Vec => xs.map(p);
const names = ["Leer", "Programar", "Descansar"];

const P = mat([
  ["0.6", "0.2", "0.2"],
  ["0.1", "0.7", "0.2"],
  ["0.3", "0.2", "0.5"],
]);
const v0 = vec(["0.4", "0.4", "0.2"]);

describe("evolve (golden NumPy)", () => {
  const { vectors, steps } = evolve(P, v0, 3);
  it("v1..v3 exactos", () => {
    expect(vectors[1]!.map(formatFrac)).toEqual(["17/50", "2/5", "13/50"]);
    expect(vectors[2]!.map(formatFrac)).toEqual(["161/500", "2/5", "139/500"]);
    expect(vectors[3]!.map(formatFrac)).toEqual(["1583/5000", "2/5", "1417/5000"]);
  });
  it("v3 coincide con NumPy", () => {
    const np = [0.3166, 0.4, 0.2834];
    vectors[3]!.forEach((x, i) => expect(Math.abs(toNumber(x) - np[i]!)).toBeLessThan(1e-12));
  });
  it("pasos con TeX", () => {
    expect(steps).toHaveLength(3);
    expect(steps[0]!.title).toBe("Paso 1: v₁ = v₀ · P");
    expect(steps[0]!.tex).toHaveLength(4);
    expect(steps[0]!.tex[1]).toContain("0{,}6");
    expect(steps[0]!.tex[1]).toContain("0{,}1");
    expect(steps[0]!.tex[1]!.endsWith("0{,}34")).toBe(true);
  });
  it("límites", () => {
    expect(() => evolve(P, v0, MAX_STEPS + 1)).toThrow();
    expect(evolve(P, v0, 0).vectors).toHaveLength(1);
  });
});

describe("validateStochastic", () => {
  it("matriz válida", () => {
    const r = validateStochastic(P);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });
  it("entrada negativa", () => {
    const r = validateStochastic(mat([["0.8", "0.4", "-0.2"], ["0.2", "0.6", "0.2"], ["0.1", "0.3", "0.6"]]));
    expect(r.ok).toBe(false);
    const neg = r.issues.find((i) => i.kind === "negative")!;
    expect(neg).toMatchObject({ row: 0, col: 2 });
    expect(describeIssue(neg, names)).toBe(
      "La entrada P(1,3) = −0,2 es negativa. Una probabilidad no puede ser menor que 0.",
    );
  });
  it("fila que suma 1,1", () => {
    const r = validateStochastic(mat([["0.5", "0.3", "0.2"], ["0.5", "0.4", "0.2"], ["0.1", "0.3", "0.6"]]));
    const issue = r.issues.find((i) => i.kind === "row-sum")!;
    expect(issue).toMatchObject({ row: 1 });
    expect(formatFrac((issue as { sum: Frac }).sum)).toBe("11/10");
    expect(formatFrac((issue as { diff: Frac }).diff)).toBe("1/10");
    expect(describeIssue(issue, names)).toBe("La fila Programar suma 1,1, no 1. Sobran 0,1.");
  });
  it("fila que suma 0,9", () => {
    const r = validateStochastic(mat([["0.3", "0.3", "0.3"], ["0.2", "0.6", "0.2"], ["0.1", "0.3", "0.6"]]));
    expect(describeIssue(r.issues[0]!, names)).toBe(
      "La fila Leer suma 0,9, no 1. Faltan 0,1 para llegar a 1.",
    );
  });
  it("informa de todos los problemas", () => {
    const r = validateStochastic(mat([["0.8", "0.4", "-0.2"], ["0.5", "0.4", "0.2"], ["0.1", "0.3", "0.6"]]));
    expect(r.issues.filter((i) => i.kind === "negative")).toHaveLength(1);
    expect(r.issues.filter((i) => i.kind === "row-sum")).toHaveLength(1);
  });
  it("entrada mayor que 1", () => {
    const r = validateStochastic(mat([["1.5", "-0.5", "0"], ["0.2", "0.6", "0.2"], ["0.1", "0.3", "0.6"]]));
    expect(r.issues.some((i) => i.kind === "above-one")).toBe(true);
    expect(r.issues.some((i) => i.kind === "negative")).toBe(true);
  });
  it("decimales periódicos fallan exactamente", () => {
    const r = validateStochastic(mat([["0.333", "0.333", "0.333"], ["0.2", "0.6", "0.2"], ["0.1", "0.3", "0.6"]]));
    const issue = r.issues[0] as { kind: string; diff: Frac };
    expect(issue.kind).toBe("row-sum");
    expect(formatFrac(issue.diff)).toBe("-1/1000");
  });
  it("no cuadrada", () => {
    const r = validateStochastic(mat([["0.5", "0.3", "0.2"], ["0.5", "0.3", "0.2"]]));
    expect(r.issues.some((i) => i.kind === "not-square")).toBe(true);
  });
});

describe("validateDistribution", () => {
  it("casos", () => {
    expect(validateDistribution(v0).ok).toBe(true);
    const a = validateDistribution(vec(["0.5", "0.6", "0"]));
    expect(a.ok).toBe(false);
    expect(formatFrac(a.sum)).toBe("11/10");
    const b = validateDistribution(vec(["1.2", "-0.2", "0"]));
    expect(b.ok).toBe(false);
    expect(b.negatives).toEqual([1]);
  });
});
