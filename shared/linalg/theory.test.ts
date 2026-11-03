// Teoría de álgebra lineal: las reglas del determinante frente al cálculo directo en matrices al azar,
// el determinante por permutaciones frente a la eliminación, autovalores y diagonalizabilidad, normas,
// el contador de α y el banco de afirmaciones (cada verdadera se cumple en cientos de ejemplos; cada
// falsa tiene un contraejemplo de su clase).
import { describe, expect, it } from "vitest";
import { createRng } from "../exercises/random.ts";
import { equals, toNumber } from "../rational.ts";
import { CLAIM_CLASSES, diagonalClaimTruth, toSample } from "./claims.ts";
import { detElimination, matrixDeterminant } from "./det.ts";
import { intMatrix, intVector } from "./matrix.ts";
import {
  countAlpha,
  detExprTex,
  detExprText,
  detOfExpr,
  eigenvaluesNumeric,
  evalMatrixExpr,
  isPositiveDefinite,
  isRealDiagonalizable,
  norm1,
  norm2,
  norm2Squared,
  normInf,
  permutationDeterminant,
  permutationSign,
  tensorVocabulary,
  type AlphaEntry,
  type DetExpr,
} from "./theory.ts";

const rng = createRng(2026);
const randInts = (n: number) => Array.from({ length: n }, () => Array.from({ length: n }, () => rng.int(-3, 3)));

describe("propiedades del determinante", () => {
  it("las reglas dan lo mismo que calcular la matriz y su determinante", () => {
    const exprs: DetExpr[] = [
      { k: -2, factors: [{ m: "A", pow: 1 }, { m: "B", pow: 1 }] },
      { k: 2, factors: [{ m: "A", pow: -1 }, { m: "B", pow: 1 }] },
      { k: 3, factors: [{ m: "A", pow: 1, T: true }] },
      { k: 1, factors: [{ m: "A", pow: 2 }, { m: "B", pow: -1 }] },
      { k: -1, factors: [{ m: "B", pow: 1, T: true }, { m: "A", pow: 3 }] },
    ];
    for (let t = 0; t < 120; t++) {
      const n = rng.pick([2, 3]);
      const A = intMatrix(randInts(n));
      const B = intMatrix(randInts(n));
      const dets = { A: matrixDeterminant(A), B: matrixDeterminant(B) };
      for (const e of exprs) {
        const rule = detOfExpr(e, n, dets);
        const M = evalMatrixExpr(e, { A, B });
        if (M === null) expect(rule).toBeNull();
        else expect(equals(rule!, matrixDeterminant(M)), `${detExprText(e)} con n = ${n}`).toBe(true);
      }
    }
    expect(detExprText({ k: -2, factors: [{ m: "A", pow: -1 }, { m: "B", pow: 1, T: true }] })).toBe("−2A⁻¹Bᵀ");
    expect(detExprTex({ k: 3, factors: [{ m: "A", pow: 2, T: true }] })).toBe("3A^{T2}");
  });

  it("matrices con una entrada no nula por fila y columna: signo de la permutación por el producto", () => {
    expect(permutationSign([2, 1, 0])).toBe(-1);
    expect(permutationSign([3, 2, 1, 0])).toBe(1);
    for (let t = 0; t < 80; t++) {
      const n = rng.int(2, 5);
      const perm = rng.shuffle(Array.from({ length: n }, (_, i) => i));
      const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (perm[i] === j ? rng.pick([1, -1, 2, 3]) : 0)));
      const r = permutationDeterminant(intMatrix(M))!;
      expect(equals(r.det, detElimination(intMatrix(M)))).toBe(true);
    }
    // La antidiagonal de unos: (−1)^(n(n−1)/2).
    for (let n = 2; n <= 6; n++) {
      const J = intMatrix(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i + j === n - 1 ? 1 : 0))));
      expect(toNumber(permutationDeterminant(J)!.det)).toBe((-1) ** ((n * (n - 1)) / 2));
    }
    expect(permutationDeterminant(intMatrix([[1, 1], [0, 1]]))).toBeNull();
  });
});

describe("autovalores y tipos de matriz", () => {
  it("autovalores numéricos: suma = traza y producto = determinante", () => {
    for (let t = 0; t < 100; t++) {
      const n = rng.pick([2, 3]);
      const A = intMatrix(randInts(n));
      const ev = eigenvaluesNumeric(A);
      expect(ev).toHaveLength(n);
      const sum = ev.reduce((s, z) => s + z.re, 0);
      expect(sum).toBeCloseTo(A.reduce((s, r, i) => s + toNumber(r[i]!), 0), 6);
      // Producto (con complejos conjugados).
      let re = 1;
      let im = 0;
      for (const z of ev) [re, im] = [re * z.re - im * z.im, re * z.im + im * z.re];
      expect(re).toBeCloseTo(toNumber(matrixDeterminant(A)), 5);
    }
  });

  it("diagonalizable y definida positiva", () => {
    expect(isRealDiagonalizable(intMatrix([[1, 1], [0, 1]]))).toBe(false);
    expect(isRealDiagonalizable(intMatrix([[0, -1], [1, 0]]))).toBe(false);
    expect(isRealDiagonalizable(intMatrix([[1, 1], [1, 0]]))).toBe(true);
    expect(isRealDiagonalizable(intMatrix([[2, 0, 0], [0, 2, 0], [0, 0, 3]]))).toBe(true);
    expect(isRealDiagonalizable(intMatrix([[2, 1, 0], [0, 2, 0], [0, 0, 3]]))).toBe(false);
    expect(isPositiveDefinite(intMatrix([[2, -1], [-1, 2]]))).toBe(true);
    expect(isPositiveDefinite(intMatrix([[1, 2], [2, 1]]))).toBe(false);
  });
});

describe("normas y α", () => {
  it("‖v‖₁, ‖v‖₂ y ‖v‖∞", () => {
    const v = intVector([3, -4, 0, 1]);
    expect(toNumber(norm1(v))).toBe(8);
    expect(toNumber(norm2Squared(v))).toBe(26);
    expect(norm2(v)).toBeCloseTo(Math.sqrt(26), 12);
    expect(toNumber(normInf(v))).toBe(4);
  });

  it("cuenta los α: finitos, ninguno o infinitos, con α ≥ 0 o en ℝ", () => {
    const V = (...xs: AlphaEntry[]) => xs;
    // ‖(α, −1)‖₂² = ‖(α, −1)‖₁ ⇔ α² = |α|: α ∈ {−1, 0, 1}.
    const sq = { lhs: { k: "norm2sq" as const, v: V([0, 1], [-1, 0]) }, op: "=" as const, rhs: { k: "norm1" as const, v: V([0, 1], [-1, 0]) } };
    expect(countAlpha([sq], "real")).toEqual({ kind: "finito", count: 3, values: [-1, 0, 1] });
    expect(countAlpha([sq], "nonneg")).toEqual({ kind: "finito", count: 2, values: [0, 1] });
    // u = (α, 1, 2), v = (α, −3, 1): u·v = α² − 1 = 0.
    const orto = { lhs: { k: "dot" as const, u: V([0, 1], [1, 0], [2, 0]), v: V([0, 1], [-3, 0], [1, 0]) }, op: "=" as const, rhs: { k: "num" as const, value: 0 } };
    expect(countAlpha([orto], "nonneg")).toMatchObject({ count: 1 });
    expect(countAlpha([orto], "real")).toMatchObject({ count: 2 });
    // ‖(α, 3, 1)‖∞ = 3: todo α ∈ [−3, 3] → infinitos.
    const inf = { lhs: { k: "normInf" as const, v: V([0, 1], [3, 0], [1, 0]) }, op: "=" as const, rhs: { k: "num" as const, value: 3 } };
    expect(countAlpha([inf], "nonneg")).toEqual({ kind: "infinitos" });
    // ‖(α, 1, 1)‖∞ = 3 con u·v > 0 para v = (1, 0, 0): solo α = 3.
    const inf2 = { lhs: { k: "normInf" as const, v: V([0, 1], [1, 0], [1, 0]) }, op: "=" as const, rhs: { k: "num" as const, value: 3 } };
    const pos = { lhs: { k: "dot" as const, u: V([0, 1], [1, 0], [1, 0]), v: V([1, 0], [0, 0], [0, 0]) }, op: ">" as const, rhs: { k: "num" as const, value: 0 } };
    expect(countAlpha([inf2, pos], "real")).toMatchObject({ count: 1, values: [3] });
    // Raíces irracionales: α² = 2 en ℝ.
    const irr = { lhs: { k: "norm2sq" as const, v: V([0, 1]) }, op: "=" as const, rhs: { k: "num" as const, value: 2 } };
    const r = countAlpha([irr], "real");
    expect(r).toMatchObject({ count: 2 });
    expect((r as { values: number[] }).values[1]).toBeCloseTo(Math.SQRT2, 9);
    // Sin solución.
    expect(countAlpha([{ lhs: { k: "norm1", v: V([0, 1], [5, 0]) }, op: "=", rhs: { k: "num", value: 2 } }], "real")).toMatchObject({ count: 0 });
  });

  it("el contador coincide con contar a mano en una malla fina", () => {
    for (let t = 0; t < 40; t++) {
      const a = rng.int(-3, 3);
      const b = rng.int(-3, 3);
      const c = rng.int(1, 6);
      const cond = { lhs: { k: "norm1" as const, v: [[0, 1], [a, 0], [b, 0]] as AlphaEntry[] }, op: "=" as const, rhs: { k: "num" as const, value: c } };
      const want = c - Math.abs(a) - Math.abs(b);
      const got = countAlpha([cond], "real");
      expect(got).toMatchObject({ count: want > 0 ? 2 : want === 0 ? 1 : 0 });
    }
  });
});

describe("vocabulario de tensores", () => {
  it("rango = número de índices (ndim), dimensión = tamaño de cada uno", () => {
    expect(tensorVocabulary([5, 5, 5, 5])).toEqual({ rango: 4, dimension: 5, componentes: 625 });
    expect(tensorVocabulary([3, 4])).toEqual({ rango: 2, dimension: null, componentes: 12 });
  });
});

describe("banco de afirmaciones", () => {
  it("cada clase genera ejemplos suyos; las verdaderas se cumplen en todos y las falsas tienen contraejemplo", () => {
    for (const cls of CLAIM_CLASSES) {
      expect(cls.claims.length, cls.id).toBeGreaterThanOrEqual(5);
      expect(cls.claims.some((c) => c.truth) && cls.claims.some((c) => !c.truth), cls.id).toBe(true);
      const r = createRng(cls.id.length * 97);
      const samples = Array.from({ length: 200 }, () => cls.sample(r));
      for (const s of samples) expect(cls.member(s), cls.id).toBe(true);
      for (const c of cls.claims) {
        if (c.truth) for (const s of samples) expect(c.holds(s), `${cls.id}/${c.id}`).toBe(true);
        else {
          expect(c.counterexample, `${cls.id}/${c.id} sin contraejemplo`).toBeDefined();
          const s = toSample(c.counterexample!);
          expect(cls.member(s), `${cls.id}/${c.id}: el contraejemplo no es de la clase`).toBe(true);
          expect(c.holds(s), `${cls.id}/${c.id}: el contraejemplo cumple la afirmación`).toBe(false);
        }
      }
    }
  });

  it("matriz diagonal concreta: diagonalizable, suma de autovalores = traza, det = producto", () => {
    expect(diagonalClaimTruth([2, -1, 3], { k: "diagonalizable" })).toBe(true);
    expect(diagonalClaimTruth([2, -1, 3], { k: "suma", v: 4 })).toBe(true);
    expect(diagonalClaimTruth([2, -1, 3], { k: "suma", v: 5 })).toBe(false);
    expect(diagonalClaimTruth([2, -1, 3], { k: "producto", v: -6 })).toBe(true);
    expect(diagonalClaimTruth([2, -1, 3], { k: "definida" })).toBe(false);
    expect(diagonalClaimTruth([2, 1, 3], { k: "definida" })).toBe(true);
    expect(diagonalClaimTruth([2, 0, 3], { k: "regular" })).toBe(false);
  });
});
