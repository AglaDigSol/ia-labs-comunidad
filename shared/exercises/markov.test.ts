// Ejercicios de cadenas de Markov: con muchas semillas, cada tipo y nivel da una cadena válida y
// resoluble con fracciones exactas, distinta según la semilla (nunca una cadena fija), y la misma con la
// misma semilla.
import { describe, expect, it } from "vitest";
import { classifyStates } from "../markov/classify.ts";
import { identity, matMul, vecMul } from "../markov/matrix.ts";
import { validateDistribution, validateStochastic } from "../markov/validate.ts";
import { equals, isZero, ONE, sum, ZERO } from "../rational.ts";
import {
  absorptionOf,
  absorptionStates,
  classifyOf,
  evolutionVectors,
  MARKOV_ABSORPTION,
  MARKOV_CLASSIFY,
  MARKOV_EVOLUTION,
  MARKOV_EXERCISES,
  MARKOV_STATIONARY,
  qMat,
  qVec,
  stationaryOf,
  storyStates,
} from "./markov.ts";
import { exercisesOfTopic } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 150 }, (_, i) => (i * 2654435761 + 7) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void) => {
  for (const level of EXERCISE_LEVELS) for (const s of SEEDS) fn(s, level);
};

describe("registro", () => {
  it("el tema «markov» tiene los cuatro tipos, con los tres niveles, deterministas", () => {
    expect(exercisesOfTopic("markov").map((t) => t.id)).toEqual(["markov-evolucion", "markov-estacionaria", "markov-clasificacion", "markov-absorcion"]);
    for (const t of MARKOV_EXERCISES) {
      expect(t.levels).toEqual(EXERCISE_LEVELS);
      for (const level of EXERCISE_LEVELS) expect(JSON.stringify(t.generate(12345, level))).toBe(JSON.stringify(t.generate(12345, level)));
    }
  });

  it.each(MARKOV_EXERCISES.map((t) => [t.id, t] as const))("%s: cada semilla, su cadena (ninguna cadena fija)", (_id, t) => {
    for (const level of EXERCISE_LEVELS) {
      const seen = new Set(SEEDS.slice(0, 60).map((s) => JSON.stringify((t.generate(s, level) as { P: unknown }).P)));
      expect(seen.size, level).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("distribución tras n pasos", () => {
  it("P estocástica, v₀ distribución, vₙ exacto que suma 1", () => {
    each((seed, level) => {
      const i = MARKOV_EVOLUTION.generate(seed, level);
      const P = qMat(i.P);
      expect(validateStochastic(P).ok).toBe(true);
      expect(validateDistribution(qVec(i.v0)).ok).toBe(true);
      expect(P.length).toBe(level === "básico" ? 2 : 3);
      expect(i.n).toBe(level === "avanzado" ? 3 : 2);
      const vs = evolutionVectors(i);
      expect(vs).toHaveLength(i.n + 1);
      for (let k = 1; k <= i.n; k++) expect(vs[k]).toEqual(vecMul(vs[k - 1]!, P));
      expect(equals(sum(vs[i.n]!), ONE)).toBe(true);
      expect(storyStates(i.story, P.length)).toHaveLength(P.length);
    });
  });
});

describe("distribución estacionaria", () => {
  it("única, positiva, π·P = π y suma 1", () => {
    each((seed, level) => {
      const i = MARKOV_STATIONARY.generate(seed, level);
      const P = qMat(i.P);
      expect(validateStochastic(P).ok).toBe(true);
      expect(P.length).toBe(level === "básico" ? 2 : level === "medio" ? 3 : 4);
      const pi = stationaryOf(i);
      expect(vecMul(pi, P)).toEqual(pi);
      expect(equals(sum(pi), ONE)).toBe(true);
      expect(pi.every((x) => !isZero(x) && x.n > 0n)).toBe(true);
    });
  });
});

describe("clasificación de estados", () => {
  it("hay transitorios y recurrentes, como pide cada nivel", () => {
    each((seed, level) => {
      const i = MARKOV_CLASSIFY.generate(seed, level);
      const P = qMat(i.P);
      expect(validateStochastic(P).ok).toBe(true);
      const kinds = classifyOf(i).kind;
      expect(kinds).toEqual(classifyStates(P).kind);
      const n = (k: string) => kinds.filter((x) => x === k).length;
      expect(n("transitorio")).toBeGreaterThan(0);
      expect(n("transitorio")).toBeLessThan(kinds.length);
      if (level === "básico") expect(n("absorbente")).toBeGreaterThan(0);
      if (level === "medio") expect(n("recurrente")).toBeGreaterThanOrEqual(2);
      if (level === "avanzado") expect(n("absorbente") > 0 && n("recurrente") >= 2 && n("transitorio") >= 2).toBe(true);
      // Absorbente ⇔ pᵢᵢ = 1.
      kinds.forEach((k, s) => expect(k === "absorbente").toBe(equals(P[s]![s]!, ONE)));
    });
  });
});

describe("probabilidad de absorción", () => {
  it("forma canónica, (I − Q)·N = I, B = N·R con filas que suman 1 y t = N·1", () => {
    each((seed, level) => {
      const i = MARKOV_ABSORPTION.generate(seed, level);
      const P = qMat(i.P);
      expect(validateStochastic(P).ok).toBe(true);
      const t = level === "básico" ? 1 : level === "medio" ? 2 : 3;
      const a = absorptionOf(i);
      expect(a.transient).toEqual(Array.from({ length: t }, (_, k) => k));
      expect(a.absorbing).toEqual([t, t + 1]);
      expect(matMul(a.IminusQ, a.N)).toEqual(identity(t));
      expect(matMul(a.N, a.R)).toEqual(a.B);
      for (const row of a.B) expect(equals(sum(row), ONE)).toBe(true);
      const asked = a.B[i.start]![i.target]!;
      expect(!isZero(asked) && !equals(asked, ONE)).toBe(true);
      expect(a.t).toEqual(a.N.map((r) => sum(r)));
      expect(a.t.every((x) => x.n > 0n && !equals(x, ZERO))).toBe(true);
      expect(i.askSteps).toBe(level === "avanzado");
      expect(absorptionStates(i).transient).toHaveLength(t);
    });
  });
});
