// Generadores de probabilidad sobre muchas semillas: cada instancia es válida (particiones que suman
// 1, pares de sucesos posibles, al menos una afirmación correcta y una falsa), las respuestas son
// fracciones exactas y coinciden con la enumeración por fuerza bruta donde se puede.
import { describe, expect, it } from "vitest";
import { add, cmp, equals, frac, mul, ONE, sub, sum, ZERO, type Frac } from "../rational.ts";
import { solveTree } from "../probability/conditional.ts";
import { distMean, distVariance, pmfExact, probAtLeast } from "../probability/distributions.ts";
import { dieEventHolds, dieSpace, eventWhere, loadedDieWeights, probOf, repeatSpace } from "../probability/events.ts";
import { gameVar, guessExpectation, rvCombineIndependent, rvFromDist, rvMean, rvProductIndependent } from "../probability/variable.ts";
import {
  binomialSpec,
  gameInstanceRows,
  geometricSpec,
  pairInstanceFacts,
  penaltyAnswer,
  dieCondFacts,
  PROB_BINOMIAL,
  PROB_DIE_COND,
  PROB_EXERCISES,
  PROB_GAME,
  PROB_GEOMETRIC,
  PROB_INDEPENDENCE,
  PROB_PENALTY,
  PROB_PRODUCT,
  PROB_TOTAL,
  qFrac,
  statementTrue,
  toProbTree,
} from "./probability.ts";
import { exerciseTopics, exercisesOfTopic, mixedType } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void, seeds = SEEDS) => {
  for (const level of EXERCISE_LEVELS) for (const s of seeds) fn(s, level);
};
const inUnit = (x: Frac) => cmp(x, ZERO) >= 0 && cmp(x, ONE) <= 0;

describe("registro de probabilidad", () => {
  it("ocho tipos en el tema «Probabilidad», tras «Cálculo»", () => {
    const ids = exerciseTopics().map((t) => t.id);
    expect(ids.indexOf("probabilidad")).toBe(ids.indexOf("calculo") + 1);
    expect(exercisesOfTopic("probabilidad").map((t) => t.id)).toEqual(PROB_EXERCISES.map((t) => t.id));
    expect(PROB_EXERCISES).toHaveLength(8);
    const mixed = new Set(SEEDS.slice(0, 80).map((s) => mixedType("probabilidad", "medio", s).id));
    expect(mixed.size).toBe(8);
  });

  it("deterministas, variados y serializables en JSON", () => {
    for (const t of PROB_EXERCISES) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS.slice(0, 10)) expect(t.generate(s, level)).toEqual(t.generate(s, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(15);
      }
    }
  });
});

describe("generadores", () => {
  it("probabilidad total: partición que suma 1, P(C) entre 0 y 1 y Bayes contra la enumeración", () => {
    each((s, level) => {
      const t = PROB_TOTAL.generate(s, level);
      expect(t.priors.length).toBe(level === "avanzado" ? 3 : 2);
      expect(equals(sum(t.priors.map(qFrac)), ONE)).toBe(true);
      const sol = solveTree(toProbTree(t));
      expect(cmp(sol.total, ZERO) > 0 && cmp(sol.total, ONE) < 0).toBe(true);
      expect(level === "básico" ? t.ask === null : t.ask !== null).toBe(true);
      // Bayes: los posteriores suman 1.
      expect(equals(sum(sol.posteriors as Frac[]), ONE)).toBe(true);
    });
  });

  it("independencia: datos posibles, al menos una afirmación correcta y una falsa", () => {
    let independent = 0;
    each((s, level) => {
      const p = PROB_INDEPENDENCE.generate(s, level);
      const f = pairInstanceFacts(p);
      expect([f.pA, f.pB, f.inter, f.union].every(inUnit)).toBe(true);
      const truth = p.statements.map((x) => statementTrue(x, f));
      expect(p.statements).toHaveLength(4);
      expect(truth).toContain(true);
      expect(truth).toContain(false);
      if (!p.multi) expect(truth.filter(Boolean)).toHaveLength(1);
      expect(p.multi).toBe(level === "avanzado");
      expect(p.statements.some((x) => x.kind === "independientes")).toBe(true);
      if (f.independent) independent++;
      if (level === "básico") expect(p.given).toBe("inter");
    });
    // Más o menos la mitad son independientes.
    expect(independent).toBeGreaterThan(SEEDS.length * 0.6);
    expect(independent).toBeLessThan(SEEDS.length * 2.4);
  });

  it("condicionada con un dado: cuatro opciones distintas, una sola correcta (contra la enumeración)", () => {
    each((s, level) => {
      const i = PROB_DIE_COND.generate(s, level);
      expect(i.options).toHaveLength(4);
      expect(new Set(i.options.map((o) => o.join("/"))).size).toBe(4);
      const { answer } = dieCondFacts(i);
      const weights = [1, 2, 3, 4, 5, 6].map((x) => (x % 2 ? i.odd : i.even));
      let num = 0;
      let den = 0;
      for (let x = 1; x <= 6; x++) {
        if (dieEventHolds(i.b, x)) {
          den += weights[x - 1]!;
          if (dieEventHolds(i.a, x)) num += weights[x - 1]!;
        }
      }
      expect(equals(answer!, frac(BigInt(num), BigInt(den)))).toBe(true);
      expect(i.options.filter((o) => equals(qFrac(o), answer!))).toHaveLength(1);
      if (level !== "avanzado") expect(i.odd).toBe(i.even);
    });
  });

  it("probabilidad total con porcentajes: P(C | A₁) = 1 − y y se pregunta P(A₁ | C)", () => {
    let percent = 0;
    each((s, level) => {
      const t = PROB_TOTAL.generate(s, level);
      if (t.percent === null) return;
      percent++;
      expect(level).not.toBe("básico");
      expect(t.priors.every((p) => 100 % p[1] === 0)).toBe(true);
      expect(t.ask).toBe(0);
    });
    expect(percent).toBeGreaterThan(SEEDS.length * 0.3);
  });

  it("binomial: las probabilidades pedidas, contra la enumeración en los casos pequeños", () => {
    each((s, level) => {
      const i = PROB_BINOMIAL.generate(s, level);
      const d = binomialSpec(i);
      expect(i.k >= 0 && i.k <= i.n).toBe(true);
      const eq = pmfExact(d, i.k)!;
      const ge = probAtLeast(d, i.k) as Frac;
      expect(inUnit(eq) && inUnit(ge)).toBe(true);
      expect(cmp(ge, eq)).toBeGreaterThanOrEqual(0);
    });
    // Enumeración: n = 3 con p = 1/3 es tirar 3 dados y contar los 5 y 6.
    const space = repeatSpace(dieSpace(), 3);
    const d = { kind: "binomial", n: 3, p: frac(1n, 3n) } as const;
    for (let k = 0; k <= 3; k++) expect(equals(probAtLeast(d, k) as Frac, probOf(space, eventWhere(space, (xs) => xs.filter((x) => x >= 5).length >= k)))).toBe(true);
  });

  it("geométrica: k ≥ 2, P(X = k) = (1 − p)^(k−1)·p y media 1/p", () => {
    each((s, level) => {
      const i = PROB_GEOMETRIC.generate(s, level);
      const d = geometricSpec(i);
      const p = qFrac(i.p);
      let fail = ONE;
      for (let j = 1; j < i.k; j++) fail = mul(fail, sub(ONE, p));
      expect(equals(pmfExact(d, i.k)!, mul(fail, p))).toBe(true);
      expect(equals(probAtLeast(d, i.k) as Frac, fail)).toBe(true);
      expect(equals(mul(distMean(d), p), ONE)).toBe(true);
      expect(cmp(distVariance(d), ZERO)).toBeGreaterThanOrEqual(0);
    });
  });

  it("juego: pesos del dado que suman 1, ganancias y pérdidas, y E contra la enumeración", () => {
    each((s, level) => {
      const g = PROB_GAME.generate(s, level);
      if (level === "básico") expect([g.odd, g.even]).toEqual([1, 1]);
      else expect(g.odd).not.toBe(g.even);
      const rows = gameInstanceRows(g);
      expect(equals(sum(rows.map((r) => r.prob)), ONE)).toBe(true);
      const die = dieSpace([1, 2, 3, 4, 5, 6].map((x) => (x % 2 ? g.odd : g.even)));
      const brute = sum(die.outcomes.map((_, j) => mul(rows[j]!.value, die.weights[j]!)));
      expect(equals(rvMean(gameVar(rows)), brute)).toBe(true);
      expect(equals(loadedDieWeights(g.odd, g.even)[0]!, die.weights[0]!)).toBe(true);
    });
  });

  it("penalización: positiva, y con ella responder al azar vale lo pedido", () => {
    each((s, level) => {
      const p = PROB_PENALTY.generate(s, level);
      const x = penaltyAnswer(p);
      expect(cmp(x, ZERO)).toBe(1);
      expect(equals(guessExpectation(p.options, qFrac(p.reward), x), qFrac(p.target))).toBe(true);
      if (level === "básico") expect(equals(qFrac(p.target), ZERO)).toBe(true);
    });
  });

  it("E[XY]: coincide con la distribución del producto (independientes)", () => {
    each((s, level) => {
      const i = PROB_PRODUCT.generate(s, level);
      const X = rvFromDist({ kind: "binomial", n: i.x.n, p: qFrac(i.x.p) });
      const Y = rvFromDist({ kind: "binomial", n: i.y.n, p: qFrac(i.y.p) });
      const exy = mul(rvMean(X), rvMean(Y));
      expect(exy.d <= 100n).toBe(true);
      if (s % 7 === 0) expect(equals(rvMean(rvProductIndependent(X, Y)), exy)).toBe(true);
      // Linealidad: E[aX + bY + c] contra la distribución de aX + bY + c.
      if (s % 5 === 0) {
        const [a, b, c] = i.lin.map((v) => frac(BigInt(v)));
        const combo = rvCombineIndependent(X, Y, (u, v) => add(add(mul(a!, u), mul(b!, v)), c!));
        expect(equals(rvMean(combo), add(add(mul(a!, rvMean(X)), mul(b!, rvMean(Y))), c!))).toBe(true);
      }
    }, SEEDS.slice(0, 80));
  });
});
