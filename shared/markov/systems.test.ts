import { describe, expect, it } from "vitest";
import { equals, formatFrac, frac, parseNumber, toNumber, ZERO, type Frac } from "../rational.ts";
import { identity, matMul, type Mat, type Vec } from "./matrix.ts";
import { determinant, inverse, inverseProblem, solveLinear, stationary } from "./systems.ts";

const f = (s: string): Frac => {
  const r = parseNumber(s);
  if (!r.ok) throw new Error(s);
  return r.value;
};
const M = (rows: string[][]): Mat => rows.map((r) => r.map(f));
const V = (xs: string[]): Vec => xs.map(f);
const fmt = (v: Vec) => v.map(formatFrac);
function expectClose(got: Vec, want: number[]) {
  got.forEach((x, i) => expect(Math.abs(toNumber(x) - want[i]!)).toBeLessThan(1e-12));
}

const P = M([
  ["0,5", "0,3", "0,2"],
  ["0,2", "0,6", "0,2"],
  ["0,1", "0,3", "0,6"],
]);
const Q = M([
  ["0,5", "0,3", "0,2"],
  ["0,2", "0,5", "0,3"],
  ["0,3", "0,2", "0,5"],
]);
const S = M([
  ["0,5", "0,5", "0"],
  ["0,5", "0,5", "0"],
  ["0", "0,5", "0,5"],
]);
const C = M([
  ["0", "1", "0"],
  ["0", "0", "1"],
  ["1", "0", "0"],
]);

describe("solveLinear", () => {
  it("2x2 unique", () => {
    const r = solveLinear(M([["2", "1"], ["1", "3"]]), V(["5", "10"]));
    expect(r.kind).toBe("unique");
    if (r.kind === "unique") expect(fmt(r.x)).toEqual(["1", "3"]);
  });
  it("inconsistent -> none", () => {
    expect(solveLinear(M([["1", "1"], ["2", "2"]]), V(["1", "3"])).kind).toBe("none");
  });
  it("rank deficient consistent -> infinite with rank", () => {
    expect(solveLinear(M([["1", "1"], ["2", "2"]]), V(["1", "2"]))).toEqual({ kind: "infinite", rank: 1 });
  });
});

describe("determinant / inverse", () => {
  it("determinants", () => {
    expect(formatFrac(determinant(P))).toBe("3/25");
    expect(formatFrac(determinant(Q))).toBe("7/100");
    expect(equals(determinant(S), ZERO)).toBe(true);
  });
  it("P * inverse(P) = I exactly; singular -> null", () => {
    const inv = inverse(P)!;
    expect(matMul(P, inv).every((row, i) => row.every((x, j) => equals(x, identity(3)[i]![j]!)))).toBe(true);
    expect(inverse(S)).toBeNull();
  });
});

describe("stationary", () => {
  it("example P (original study-session chain)", () => {
    const r = stationary(P);
    expect(r.kind).toBe("unique");
    if (r.kind !== "unique") return;
    expect(fmt(r.pi)).toEqual(["5/21", "3/7", "1/3"]);
    expectClose(r.pi, [5 / 21, 3 / 7, 1 / 3]);
    expect(r.check).toBe(true);
    expect(r.equations).toHaveLength(4);
    expect(r.equations[0]).toContain("\\pi_{1}");
    expect(r.equations[0]).toContain("0{,}5");
    expect(r.equations[3]!.endsWith("= 1")).toBe(true);
  });
  it("Q and C -> uniform", () => {
    for (const m of [Q, C]) {
      const r = stationary(m);
      expect(r.kind).toBe("unique");
      if (r.kind === "unique") expect(fmt(r.pi)).toEqual(["1/3", "1/3", "1/3"]);
    }
  });
  it("identity -> not unique, dimension 3", () => {
    const r = stationary(identity(3));
    expect(r.kind).toBe("not-unique");
    if (r.kind === "not-unique") expect(r.dimension).toBe(3);
  });
});

describe("inverseProblem", () => {
  it("P with v = (0.5, 0.5, 0)", () => {
    const r = inverseProblem(P, V(["0,5", "0,5", "0"]));
    expect(r.kind).toBe("solved");
    if (r.kind !== "solved") return;
    expect(fmt(r.u0)).toEqual(["5/6", "2/3", "-1/2"]);
    expectClose(r.u0, [5 / 6, 2 / 3, -1 / 2]);
    expect(r.valid).toBe(false);
    expect(r.negatives).toEqual([2]);
    expect(equals(r.sum, frac(1n))).toBe(true);
    expect(r.systemTex).toHaveLength(3);
    expect(r.inverseTex).toContain("pmatrix");
  });
  it("Q with v = (0.31, 0.31, 0.38)", () => {
    const r = inverseProblem(Q, V(["0,31", "0,31", "0,38"]));
    expect(r.kind).toBe("solved");
    if (r.kind === "solved") {
      expect(fmt(r.u0)).toEqual(["1/5", "3/10", "1/2"]);
      expect(r.valid).toBe(true);
    }
  });
  it("S singular", () => {
    const r = inverseProblem(S, V(["0,3", "0,3", "0,4"]));
    expect(r.kind).toBe("singular");
    if (r.kind === "singular") expect(equals(r.det, ZERO)).toBe(true);
  });
});
