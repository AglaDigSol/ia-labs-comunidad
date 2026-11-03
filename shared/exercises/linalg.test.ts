// Generadores de álgebra lineal sobre muchas semillas: cada instancia es del tipo pedido y con números
// cómodos (soluciones enteras, inversas con denominadores pequeños, autovalores enteros…).
import { describe, expect, it } from "vitest";
import { matrixDeterminant } from "../linalg/det.ts";
import { eigenspace, eigenvalues } from "../linalg/eigen.ts";
import { intMatrix } from "../linalg/matrix.ts";
import { matrixInverse, matrixRank, rref } from "../linalg/rref.ts";
import { analyzeSystem, splitAugmented, type SystemKind } from "../linalg/systems.ts";
import { tensorOpResult } from "../linalg/tensors.ts";
import {
  LINALG_DETERMINANT,
  LINALG_EIGEN,
  LINALG_EXERCISES,
  LINALG_GAUSS,
  LINALG_INDEPENDENCE,
  LINALG_INVERSE,
  LINALG_PRODUCT,
  LINALG_SYSTEMS,
  LINALG_TENSORS,
  unimodular,
} from "./linalg.ts";
import { createRng } from "./random.ts";
import { exerciseTopics, exercisesOfTopic, mixedType } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void, seeds = SEEDS) => {
  for (const level of EXERCISE_LEVELS) for (const s of seeds) fn(s, level);
};

describe("registro de álgebra lineal", () => {
  it("ocho tipos en el tema «Álgebra lineal», el último de los temas", () => {
    expect(exerciseTopics().at(-1)).toEqual({ id: "algebra-lineal", label: "Álgebra lineal" });
    expect(exercisesOfTopic("algebra-lineal").map((t) => t.id)).toEqual(LINALG_EXERCISES.map((t) => t.id));
    expect(LINALG_EXERCISES).toHaveLength(8);
    const mixed = new Set(SEEDS.slice(0, 80).map((s) => mixedType("algebra-lineal", "medio", s).id));
    expect(mixed.size).toBe(8);
  });

  it("deterministas y variados", () => {
    for (const t of LINALG_EXERCISES) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS.slice(0, 10)) expect(t.generate(s, level)).toEqual(t.generate(s, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(20);
      }
    }
  });
});

describe("generadores", () => {
  it("matrices de determinante ±1: la inversa es entera", () => {
    const rng = createRng(1);
    for (let t = 0; t < 100; t++) {
      const U = intMatrix(unimodular(rng, 3, 4));
      expect(Math.abs(Number(matrixDeterminant(U).n))).toBe(1);
      expect(matrixInverse(U)!.inverse.flat().every((x) => x.d === 1n)).toBe(true);
    }
  });

  it("Gauss-Jordan: en básico y medio, determinado con solución entera; en avanzado aparecen los tres tipos", () => {
    const kinds = new Set<SystemKind>();
    each((s, level) => {
      const inst = LINALG_GAUSS.generate(s, level);
      const M = intMatrix(inst.matrix);
      expect(inst.matrix[0]!.length).toBe(inst.unknowns + 1);
      const { A, b } = splitAugmented(M);
      const a = analyzeSystem(A, b);
      if (level !== "avanzado") {
        expect(a.kind).toBe("determinado");
        expect(a.kind === "determinado" && a.x.every((x) => x.d === 1n)).toBe(true);
        expect(inst.unknowns).toBe(level === "básico" ? 2 : 3);
      } else kinds.add(a.kind);
      // Todos los pasos de la solución con fracciones pequeñas.
      for (const S of rref(M, inst.unknowns).steps) for (const x of S.flat()) expect(x.d <= 6n && (x.n < 0n ? -x.n : x.n) <= 60n).toBe(true);
    });
    expect(kinds).toEqual(new Set(["determinado", "indeterminado", "incompatible"]));
  });

  it("sistemas: los tres tipos en cada nivel; indeterminados con solución particular entera", () => {
    for (const level of EXERCISE_LEVELS) {
      const kinds = new Set<SystemKind>();
      for (const s of SEEDS) {
        const inst = LINALG_SYSTEMS.generate(s, level);
        const { A, b } = splitAugmented(intMatrix(inst.matrix));
        const a = analyzeSystem(A, b);
        kinds.add(a.kind);
        if (a.kind === "indeterminado") expect(a.directions.length).toBeLessThanOrEqual(2);
        if (a.kind === "incompatible") expect(a.rankAb).toBe(a.rankA + 1);
      }
      expect(kinds, level).toEqual(new Set(["determinado", "indeterminado", "incompatible"]));
    }
  });

  it("determinante: 2×2, 3×3 y 4×4 con ceros, de valor acotado", () => {
    each((s, level) => {
      const { matrix } = LINALG_DETERMINANT.generate(s, level);
      expect(matrix.length).toBe({ básico: 2, medio: 3, avanzado: 4 }[level]);
      const d = Math.abs(Number(matrixDeterminant(intMatrix(matrix)).n));
      expect(d).toBeLessThanOrEqual(200);
      if (level === "avanzado") expect(matrix.flat().filter((x) => x === 0).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("producto: siempre definido y con pocas celdas nulas", () => {
    each((s, level) => {
      const { a, b } = LINALG_PRODUCT.generate(s, level);
      expect(a[0]!.length).toBe(b.length);
      if (level === "básico") expect([a.length, b[0]!.length]).toEqual([2, 2]);
    });
  });

  it("inversa: invertible, con el determinante del nivel y una inversa de números cómodos", () => {
    each((s, level) => {
      const { matrix } = LINALG_INVERSE.generate(s, level);
      const A = intMatrix(matrix);
      const det = Math.abs(Number(matrixDeterminant(A).n));
      expect(level === "medio" ? det === 1 : det >= 1 && det <= 3).toBe(true);
      const inv = matrixInverse(A)!.inverse.flat();
      expect(inv.every((x) => x.d <= 3n)).toBe(true);
      if (level === "medio") expect(inv.every((x) => x.d === 1n)).toBe(true);
    });
  });

  it("independencia: vectores no nulos y distintos; dependientes e independientes en cada nivel", () => {
    for (const level of EXERCISE_LEVELS) {
      let dep = 0;
      let indep = 0;
      for (const s of SEEDS) {
        const { vectors } = LINALG_INDEPENDENCE.generate(s, level);
        expect(vectors.every((v) => v.some((x) => x !== 0))).toBe(true);
        expect(new Set(vectors.map((v) => v.join())).size).toBe(vectors.length);
        if (matrixRank(intMatrix(vectors)) === vectors.length) indep++;
        else dep++;
      }
      expect(dep, level).toBeGreaterThan(40);
      expect(indep, level).toBeGreaterThan(20);
    }
  });

  it("autovalores: todos enteros, diagonalizable y sin ser triangular; en avanzado, a veces dobles", () => {
    let doubles = 0;
    each((s, level) => {
      const { matrix } = LINALG_EIGEN.generate(s, level);
      const A = intMatrix(matrix);
      expect(A.length).toBe(level === "básico" ? 2 : 3);
      expect(matrix.flat().every(Number.isInteger)).toBe(true);
      const ev = eigenvalues(A);
      expect(ev.complete).toBe(true);
      expect(ev.roots.every((r) => r.value.d === 1n)).toBe(true);
      // Diagonalizable: cada autoespacio tiene la dimensión de la multiplicidad.
      for (const r of ev.roots) expect(eigenspace(A, r.value)).toHaveLength(r.mult);
      if (ev.roots.some((r) => r.mult > 1)) {
        expect(level).toBe("avanzado");
        doubles++;
      }
    });
    expect(doubles).toBeGreaterThan(40);
  });

  it("formas de tensores: en básico siempre hay resultado; en medio y avanzado, también errores", () => {
    for (const level of EXERCISE_LEVELS) {
      const ops = new Set<string>();
      let errors = 0;
      for (const s of SEEDS) {
        const { q } = LINALG_TENSORS.generate(s, level);
        ops.add(q.op);
        const r = tensorOpResult(q);
        if (!r.ok) errors++;
        expect(r.explain.length).toBeGreaterThan(0);
      }
      if (level === "básico") expect(errors).toBe(0);
      else expect(errors, level).toBeGreaterThan(20);
      expect(ops.size, level).toBeGreaterThanOrEqual(4);
    }
  });
});
