// Motor de probabilidad: fórmulas contra enumeración por fuerza bruta en espacios pequeños (dados,
// monedas, baraja), distribuciones (la función de probabilidad suma 1, media y varianza contra las
// sumas directas), árbol de Bayes, independencia, lectura de respuestas y simulación.
import { describe, expect, it } from "vitest";
import { add, equals, frac, mul, ONE, sub, sum, toNumber, ZERO, type Frac } from "../rational.ts";
import { answerFeedback, answerMatches, answerState, checkProbAnswer, NOTE_DOT, NOTE_MORE_DIGITS, NOTE_ROUNDING, parseProbAnswer } from "./answer.ts";
import { contingencyDetermined, contingencyFrom, pairFacts, pairProblem, solveContingency, solveTree, treeProblem } from "./conditional.ts";
import { erf, normalCdf, normalProb, standardize, uniformProb } from "./continuous.ts";
import {
  binom,
  cdf,
  distMean,
  distProblem,
  distSupport,
  distVariance,
  pmf,
  pmfExact,
  pmfNumber,
  probAtLeast,
  type DistSpec,
} from "./distributions.ts";
import {
  condProbOf,
  coinSpace,
  dieEvent,
  dieEventText,
  dieSpace,
  eventComplement,
  eventInter,
  eventsIndependent,
  eventUnion,
  eventWhere,
  isFigure,
  loadedDieWeights,
  probOf,
  productSpace,
  repeatSpace,
  spanishDeck,
  weightedSpace,
} from "./events.ts";
import { probTex, probWithDecimal, decimalComma } from "./format.ts";
import { checkpoints, simulateFrequency } from "./simulation.ts";
import {
  coinGameRows,
  dieGameRows,
  dieRuleText,
  gameVar,
  guessExpectation,
  penaltyForTarget,
  randomVarProblem,
  rvAffine,
  rvFromDist,
  rvMean,
  rvProductIndependent,
  rvSumIndependent,
  rvVariance,
} from "./variable.ts";

const f = (n: number, d = 1) => frac(BigInt(n), BigInt(d));
const eq = (a: Frac | null | number, b: Frac) => {
  expect(a).not.toBeNull();
  expect(typeof a).not.toBe("number");
  expect(`${(a as Frac).n}/${(a as Frac).d}`).toBe(`${b.n}/${b.d}`);
};

describe("respuestas", () => {
  const ok = (s: string) => {
    const r = parseProbAnswer(s);
    if (!r.ok) throw new Error(s);
    return r;
  };
  it("lee fracciones, decimales con coma o punto, porcentajes y signo", () => {
    eq(ok("3/8").value, f(3, 8));
    eq(ok("0,375").value, f(3, 8));
    eq(ok("0.375").value, f(3, 8));
    eq(ok("37,5 %").value, f(3, 8));
    eq(ok("25%").value, f(1, 4));
    eq(ok("−1,25").value, f(-5, 4));
    eq(ok("≈ 0,5").value, f(1, 2));
    expect(ok("3/8").decimals).toBeNull();
    expect(ok("0,375").decimals).toBe(3);
    expect(ok("37,5 %").decimals).toBe(3);
    expect(ok("25 %").decimals).toBeNull();
    for (const bad of ["", "abc", "1/0", "0,3,3", "3 / 8 / 2"]) expect(parseProbAnswer(bad).ok).toBe(false);
  });

  it("exacto para fracciones; decimales bien redondeados a dos cifras (como en el examen)", () => {
    expect(checkProbAnswer("6/16", f(3, 8))).toBe(true);
    expect(checkProbAnswer("0,375", f(3, 8))).toBe(true);
    expect(checkProbAnswer("0,38", f(3, 8))).toBe(true);
    expect(checkProbAnswer("0,37", f(3, 8))).toBe(false);
    expect(checkProbAnswer("0,4", f(3, 8))).toBe(false);
    expect(checkProbAnswer("1/3", f(1, 3))).toBe(true);
    expect(checkProbAnswer("0,33", f(1, 3))).toBe(true);
    expect(checkProbAnswer("0,3333", f(1, 3))).toBe(true);
    expect(checkProbAnswer("0,3", f(1, 3))).toBe(false);
    expect(checkProbAnswer("0,34", f(1, 3))).toBe(false);
    expect(checkProbAnswer("0,3334", f(1, 3))).toBe(false);
    expect(checkProbAnswer("0,67", f(2, 3))).toBe(true);
    expect(checkProbAnswer("0,66", f(2, 3))).toBe(false);
    expect(checkProbAnswer("0,6666", f(2, 3))).toBe(true);
    expect(checkProbAnswer("33,33 %", f(1, 3))).toBe(true);
    expect(checkProbAnswer("−0,17", f(-1, 6))).toBe(true);
    expect(checkProbAnswer("1/4", f(1, 3))).toBe(false);
    expect(checkProbAnswer("1,5", f(3, 2))).toBe(true);
    expect(checkProbAnswer("2", f(2))).toBe(true);
    // Con cuatro cifras pedidas.
    expect(checkProbAnswer("0,33", f(1, 3), 4)).toBe(false);
    expect(checkProbAnswer("0,3333", f(1, 3), 4)).toBe(true);
  });

  it("avisos: más cifras de las pedidas, punto en vez de coma y redondeo", () => {
    expect(answerFeedback("0,3333", f(1, 3))).toEqual({ state: "bien", notes: [NOTE_MORE_DIGITS(2)] });
    expect(answerFeedback("0.33", f(1, 3))).toEqual({ state: "bien", notes: [NOTE_DOT] });
    expect(answerFeedback("0,66", f(2, 3))).toEqual({ state: "mal", notes: [NOTE_ROUNDING] });
    expect(answerFeedback("0,33", f(1, 3))).toEqual({ state: "bien", notes: [] });
    expect(answerFeedback("1/3", f(1, 3))).toEqual({ state: "bien", notes: [] });
    expect(answerFeedback("0,9", f(1, 3))).toEqual({ state: "mal", notes: [] });
  });

  it("valores no racionales: con las mismas reglas", () => {
    const v = Math.exp(-1); // 0,36787944…
    expect(checkProbAnswer("0,37", v)).toBe(true);
    expect(checkProbAnswer("0,36", v)).toBe(false);
    expect(checkProbAnswer("0,3679", v)).toBe(true);
    expect(checkProbAnswer("0,3678", v)).toBe(true);
    expect(checkProbAnswer("0,3677", v)).toBe(false);
    expect(checkProbAnswer("0,3679", v, 4)).toBe(true);
    expect(checkProbAnswer("0,368", v, 4)).toBe(false);
    expect(checkProbAnswer("0,36788", v, 4)).toBe(true);
    const a = parseProbAnswer("0,368");
    expect(a.ok && answerMatches(a, v, 3)).toBe(true);
    expect(answerState("", v)).toBe("vacío");
    expect(answerState("x", v)).toBe("ilegible");
    expect(answerState("0,1", v)).toBe("mal");
  });
});

describe("sucesos por fuerza bruta", () => {
  const two = productSpace(dieSpace(), dieSpace());
  it("dos dados: suma 7, dobles; unión, complementario e independencia", () => {
    expect(equals(sum(two.weights), ONE)).toBe(true);
    const seven = eventWhere(two, ([a, b]) => a + b === 7);
    const doubles = eventWhere(two, ([a, b]) => a === b);
    const firstSix = eventWhere(two, ([a]) => a === 6);
    eq(probOf(two, seven), f(1, 6));
    eq(probOf(two, doubles), f(1, 6));
    eq(probOf(two, eventUnion(seven, doubles)), f(1, 3));
    eq(probOf(two, eventComplement(seven)), f(5, 6));
    // Suma 7 y «el primero es 6» son independientes; dobles y suma 7 son incompatibles.
    expect(eventsIndependent(two, seven, firstSix)).toBe(true);
    expect(eventsIndependent(two, seven, doubles)).toBe(false);
    eq(condProbOf(two, firstSix, seven), f(1, 6));
  });

  it("baraja española: figuras y oros", () => {
    const deck = spanishDeck();
    expect(deck.outcomes).toHaveLength(40);
    const fig = eventWhere(deck, isFigure);
    const oros = eventWhere(deck, (c) => c.suit === "oros");
    eq(probOf(deck, fig), f(3, 10));
    eq(probOf(deck, eventInter(fig, oros)), f(3, 40));
    expect(eventsIndependent(deck, fig, oros)).toBe(true);
    eq(condProbOf(deck, oros, fig), f(1, 4));
  });

  it("dado trucado: impares el doble de probables que los pares", () => {
    const w = loadedDieWeights(2, 1);
    eq(w[0]!, f(2, 9));
    eq(w[1]!, f(1, 9));
    const die = dieSpace([2, 1, 2, 1, 2, 1]);
    eq(probOf(die, eventWhere(die, (x) => x % 2 === 1)), f(2, 3));
    expect(() => weightedSpace([1, 2], [f(1, 2), f(1, 3)])).toThrow();
  });

  it("tres monedas: al menos una cara", () => {
    const s = repeatSpace(coinSpace(), 3);
    expect(s.outcomes).toHaveLength(8);
    eq(probOf(s, eventWhere(s, (xs) => xs.includes("C"))), f(7, 8));
  });
});

describe("árbol y Bayes", () => {
  it("probabilidad total y Bayes con dos y tres ramas", () => {
    const t = solveTree({ priors: [f(3, 5), f(2, 5)], likelihoods: [f(1, 2), f(1, 4)] });
    eq(t.total, f(2, 5));
    eq(t.posteriors[0]!, f(3, 4));
    eq(t.complements[1]!, f(3, 4));
    eq(sum(t.joints.concat(t.jointsNot)), ONE);
    const t3 = solveTree({ priors: [f(1, 2), f(3, 10), f(1, 5)], likelihoods: [f(1, 50), f(3, 100), f(1, 20)] });
    eq(t3.total, f(29, 1000));
    eq(sum(t3.posteriors as Frac[]), ONE);
    eq(sum(t3.posteriorsNot as Frac[]), ONE);
  });

  it("coincide con la enumeración de un espacio producto", () => {
    // Un espacio con los resultados (Aᵢ, C o Cᶜ) y sus pesos P(Aᵢ)·P(C | Aᵢ).
    const priors = [f(1, 6), f(1, 3), f(1, 2)];
    const likes = [f(1, 4), f(2, 3), f(1, 5)];
    const outcomes: Array<[number, boolean]> = [];
    const weights: Frac[] = [];
    priors.forEach((p, i) => {
      outcomes.push([i, true], [i, false]);
      weights.push(mul(p, likes[i]!), mul(p, sub(ONE, likes[i]!)));
    });
    const s = weightedSpace(outcomes, weights);
    const C = eventWhere(s, ([, c]) => c);
    const t = solveTree({ priors, likelihoods: likes });
    eq(t.total, probOf(s, C));
    priors.forEach((_, i) => eq(t.posteriors[i]!, condProbOf(s, eventWhere(s, ([j]) => j === i), C)!));
  });

  it("rechaza árboles que no son una partición", () => {
    expect(treeProblem({ priors: [f(1, 2), f(1, 3)], likelihoods: [f(1, 2), f(1, 2)] })).toMatch(/sumar 1/);
    expect(treeProblem({ priors: [ONE], likelihoods: [ONE] })).toMatch(/2 a 4/);
    expect(() => solveTree({ priors: [f(3, 2), f(-1, 2)], likelihoods: [ZERO, ZERO] })).toThrow();
  });
});

describe("contingencia e independencia", () => {
  it("tabla 2×2 y datos del par", () => {
    const c = solveContingency(contingencyFrom(f(1, 2), f(2, 5), f(1, 5)));
    expect(c.independent).toBe(true);
    eq(c.union, f(7, 10));
    eq(c.aGivenB!, f(1, 2));
    const p = pairFacts(f(3, 5), f(1, 2), f(1, 5));
    expect(p.independent).toBe(false);
    eq(p.union, f(9, 10));
    eq(p.aGivenB!, f(2, 5));
    eq(p.bGivenA!, f(1, 3));
    eq(p.neither, f(1, 10));
    expect(pairFacts(f(1, 4), f(1, 2), ZERO).exclusive).toBe(true);
    expect(pairProblem(f(1, 2), f(1, 2), f(3, 5))).toMatch(/mayor/);
    expect(pairProblem(f(4, 5), f(4, 5), f(1, 2))).toMatch(/pasaría de 1/);
    expect(contingencyDetermined(["ab", "pA", "pB"])).toBe(true);
    expect(contingencyDetermined(["pA", "pNotB", "notANotB"])).toBe(true);
    expect(contingencyDetermined(["ab", "pA", "pNotA"])).toBe(false);
  });

  it("todas las parejas de sucesos de un dado: las fórmulas coinciden con la enumeración", () => {
    const die = dieSpace([3, 1, 2, 1, 2, 1]);
    const masks = Array.from({ length: 64 }, (_, m) => [0, 1, 2, 3, 4, 5].map((i) => ((m >> i) & 1) === 1));
    for (const A of masks.filter((_, i) => i % 3 === 0)) {
      for (const B of masks.filter((_, i) => i % 5 === 0)) {
        const facts = pairFacts(probOf(die, A), probOf(die, B), probOf(die, eventInter(A, B)));
        eq(facts.union, probOf(die, eventUnion(A, B)));
        expect(facts.independent).toBe(eventsIndependent(die, A, B));
        const c = condProbOf(die, A, B);
        if (c) eq(facts.aGivenB!, c);
        else expect(facts.aGivenB).toBeNull();
      }
    }
  });
});

describe("distribuciones", () => {
  const specs: DistSpec[] = [
    { kind: "bernoulli", p: f(3, 10) },
    { kind: "binomial", n: 7, p: f(2, 5) },
    { kind: "binomial", n: 12, p: f(1, 6) },
    { kind: "uniforme", a: -2, b: 5 },
    { kind: "geometrica", p: f(1, 3) },
    { kind: "poisson", lambda: f(5, 2) },
  ];

  it("la función de probabilidad suma 1 y media y varianza coinciden con las sumas", () => {
    for (const d of specs) {
      expect(distProblem(d)).toBeNull();
      if (d.kind === "geometrica" || d.kind === "poisson") {
        // Suma hasta 200: la cola es despreciable.
        let s = 0;
        let m = 0;
        let m2 = 0;
        for (let k = 0; k <= 200; k++) {
          const p = pmfNumber(d, k);
          s += p;
          m += k * p;
          m2 += k * k * p;
        }
        expect(s).toBeCloseTo(1, 12);
        expect(m).toBeCloseTo(toNumber(distMean(d)), 10);
        expect(m2 - m * m).toBeCloseTo(toNumber(distVariance(d)), 9);
      } else {
        const X = rvFromDist(d);
        eq(sum(X.probs), ONE);
        eq(rvMean(X), distMean(d));
        eq(rvVariance(X), distVariance(d));
      }
    }
  });

  it("binomial contra enumeración de n intentos", () => {
    // n = 4 tiradas de un dado; éxito = sacar 5 o 6 (p = 1/3).
    const s = repeatSpace(dieSpace(), 4);
    const d: DistSpec = { kind: "binomial", n: 4, p: f(1, 3) };
    for (let k = 0; k <= 4; k++) {
      eq(pmfExact(d, k), probOf(s, eventWhere(s, (xs) => xs.filter((x) => x >= 5).length === k)));
      eq(probAtLeast(d, k) as Frac, probOf(s, eventWhere(s, (xs) => xs.filter((x) => x >= 5).length >= k)));
    }
    expect(binom(10, 3)).toBe(120n);
    expect(binom(5, 7)).toBe(0n);
  });

  it("geométrica: primera vez en el k-ésimo intento y «al menos k intentos»", () => {
    const d: DistSpec = { kind: "geometrica", p: f(1, 4) };
    eq(pmf(d, 3) as Frac, f(9, 64));
    eq(probAtLeast(d, 3) as Frac, f(9, 16));
    eq(cdf(d, 2) as Frac, f(7, 16));
    // Contra enumeración: tres tiradas de un «dado» de 4 caras equivalentes con una de éxito.
    const s = repeatSpace(dieSpace([1, 3, 0, 0, 0, 0]), 3);
    eq(probOf(s, eventWhere(s, (xs) => xs[0] === 2 && xs[1] === 2 && xs[2] === 1)), f(9, 64));
    expect(distSupport(d).length).toBeGreaterThan(6);
  });

  it("Poisson y parámetros no válidos", () => {
    const d: DistSpec = { kind: "poisson", lambda: f(2) };
    expect(pmf(d, 0)).toBeCloseTo(Math.exp(-2), 14);
    expect(probAtLeast(d, 1) as number).toBeCloseTo(1 - Math.exp(-2), 14);
    expect(distProblem({ kind: "binomial", n: 0, p: f(1, 2) })).not.toBeNull();
    expect(distProblem({ kind: "geometrica", p: ZERO })).not.toBeNull();
    expect(distProblem({ kind: "uniforme", a: 3, b: 1 })).not.toBeNull();
  });
});

describe("variables y juegos", () => {
  it("linealidad, suma y producto de independientes", () => {
    const X = rvFromDist({ kind: "binomial", n: 3, p: f(1, 2) });
    const Y = rvFromDist({ kind: "binomial", n: 4, p: f(1, 3) });
    eq(rvMean(rvProductIndependent(X, Y)), mul(rvMean(X), rvMean(Y)));
    eq(rvMean(rvSumIndependent(X, Y)), add(rvMean(X), rvMean(Y)));
    eq(rvVariance(rvSumIndependent(X, Y)), add(rvVariance(X), rvVariance(Y)));
    const Z = rvAffine(X, f(2), f(-3));
    eq(rvMean(Z), sub(mul(f(2), rvMean(X)), f(3)));
    eq(rvVariance(Z), mul(f(4), rvVariance(X)));
    expect(randomVarProblem({ values: [ONE], probs: [f(1, 2)] })).toMatch(/sumar 1/);
  });

  it("juego con dado trucado y penalización de un test", () => {
    const rows = dieGameRows({ kind: "paridad", odd: 3, even: -4 }, loadedDieWeights(2, 1));
    eq(rvMean(gameVar(rows)), f(2, 3));
    // Coincide con la enumeración: E = Σ ganancia · P(cara).
    const die = dieSpace([2, 1, 2, 1, 2, 1]);
    eq(sum(die.outcomes.map((x, i) => mul(f(x % 2 ? 3 : -4), die.weights[i]!))), f(2, 3));
    eq(penaltyForTarget(4, ONE, ZERO), f(1, 3));
    eq(guessExpectation(4, ONE, f(1, 3)), ZERO);
    eq(penaltyForTarget(5, ONE, f(1, 10)), f(1, 8));
    eq(guessExpectation(5, ONE, f(1, 8)), f(1, 10));
    const coins = coinGameRows(3, [-3, -1, 1, 3]);
    eq(coins[1]!.prob, f(3, 8));
    eq(rvMean(gameVar(coins)), ZERO);
  });
});

describe("normal y uniforme continua", () => {
  it("erf y Φ con doce decimales", () => {
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 12);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 12);
    expect(erf(3.5)).toBeCloseTo(0.9999992569016276, 13);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 12);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 12);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024997895148220435, 12);
    expect(normalCdf(-5)).toBeCloseTo(2.866515718791939e-7, 15);
    expect(normalCdf(0)).toBe(0.5);
    expect(standardize(130, 100, 15)).toBe(2);
    expect(normalProb(85, 115, 100, 15)).toBeCloseTo(0.6826894921370859, 12);
    expect(uniformProb(1, 3, 0, 4)).toBe(0.5);
  });
});

describe("formato y simulación", () => {
  it("formato", () => {
    expect(probTex(f(3, 8))).toBe("\\frac{3}{8}");
    expect(probWithDecimal(f(1, 3))).toBe("1/3 ≈ 0,33");
    expect(probWithDecimal(f(1, 3), 4)).toBe("1/3 ≈ 0,3333");
    expect(probWithDecimal(f(3, 8))).toBe("3/8 = 0,375 ≈ 0,38");
    expect(probWithDecimal(f(3, 8), 4)).toBe("3/8 = 0,375");
    expect(decimalComma(-0.25)).toBe("−0,25");
  });

  it("misma semilla, misma simulación; la frecuencia se acerca a la probabilidad", () => {
    const two = productSpace(dieSpace(), dieSpace());
    const seven = eventWhere(two, ([a, b]) => a + b === 7);
    const a = simulateFrequency(two, seven, 20000, 42);
    expect(a).toEqual(simulateFrequency(two, seven, 20000, 42));
    expect(Math.abs(a.at(-1)!.freq - 1 / 6)).toBeLessThan(0.02);
    expect(a.at(-1)!.n).toBe(20000);
    expect(checkpoints(5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("juegos y sucesos con nombre", () => {
  it("la regla en palabras y los sucesos de un dado", () => {
    expect(dieRuleText({ kind: "paridad", odd: 3, even: -4 })).toBe("Si sale impar, ganas 3 €; si sale par, pierdes 4 €.");
    expect(dieRuleText({ kind: "caras", payoffs: [-2, -2, 1, 1, 1, 6] })).toBe("Si sale un 1 o un 2, pierdes 2 €; si sale un 3, un 4 o un 5, ganas 1 €; si sale un 6, ganas 6 €.");
    expect(dieRuleText({ kind: "umbral", t: 5, win: 5, lose: -2 })).toBe("Si sale 5 o más, ganas 5 €; si no, pierdes 2 €.");
    const die = dieSpace();
    eq(condProbOf(die, dieEvent(die, { kind: "menor", k: 4 }), dieEvent(die, { kind: "par" }))!, f(1, 3));
    expect(dieEventText({ kind: "multiplo3" })).toBe("es múltiplo de 3");
  });
});
