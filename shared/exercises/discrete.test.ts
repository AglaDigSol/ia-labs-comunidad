// Generadores de combinatoria y complejidad sobre muchas semillas: enunciados con un modelo posible y
// respuestas razonables, cuatro opciones con una sola buena (también la trampa de la constante dentro
// de la O), funciones con una sola verdadera (o varias, en avanzado) y P y NP con verdaderas y falsas.
import { describe, expect, it } from "vitest";
import { costOf, growthLE, growthOf, isConstantTrap, isLooseBound, optionIsCorrect } from "../discrete/bigo.ts";
import { acceptedFormulas, countingFormula, countModel, FORMULA_IDS, FORMULAS, modelQuestionHints, wrongModelHint } from "../discrete/count.ts";
import { statementText, statementTrue } from "../discrete/functions.ts";
import { pnpStatement } from "../discrete/pnp.ts";
import {
  COMB_COMPLEXITY,
  COMB_FUNCTIONS,
  COMB_MODEL,
  COMB_PNP,
  COMB_PROBLEM,
  complexityGrowth,
  DISCRETE_EXERCISES,
  isMultiStep,
  problemAnswer,
  problemMistake,
  termModels,
  termValue,
} from "./discrete.ts";
import { seedFromText } from "./random.ts";
import { exerciseTopics, exercisesOfTopic, mixedType } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 300 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void, seeds = SEEDS) => {
  for (const level of EXERCISE_LEVELS) for (const s of seeds) fn(s, level);
};

describe("registro de combinatoria", () => {
  it("cinco tipos en «Combinatoria y complejidad», tras «Conjuntos»", () => {
    const topics = exerciseTopics();
    const ids = topics.map((t) => t.id);
    expect(ids.indexOf("combinatoria")).toBe(ids.indexOf("conjuntos") + 1);
    expect(topics.find((t) => t.id === "combinatoria")!.label).toBe("Combinatoria y complejidad");
    expect(exercisesOfTopic("combinatoria").map((t) => t.id)).toEqual(DISCRETE_EXERCISES.map((t) => t.id));
    const mixed = new Set(SEEDS.slice(0, 80).map((s) => mixedType("combinatoria", "medio", s).id));
    expect(mixed.size).toBe(5);
  });

  it("deterministas, variados y serializables (sin BigInt en las instancias)", () => {
    for (const t of DISCRETE_EXERCISES) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS.slice(0, 10)) expect(t.generate(s, level)).toEqual(t.generate(s, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(12);
      }
    }
  });
});

describe("generadores", () => {
  it("problemas: modelos válidos y respuestas enteras positivas de tamaño de examen", () => {
    const formulas = new Map<ExerciseLevel, Set<string>>();
    let complements = 0;
    each((s, level) => {
      const p = COMB_PROBLEM.generate(s, level);
      const v = problemAnswer(p);
      expect(v > 1n && v < 10n ** 15n).toBe(true);
      expect(p.text.length).toBeGreaterThan(20);
      // Sin separadores de miles ni puntos decimales en los enunciados.
      expect(p.text).not.toMatch(/\d\.\d{3}/);
      if (p.terms.length > 1) {
        complements++;
        expect(level).toBe("avanzado");
        expect(countModel(p.terms[1]!.model) > 0n).toBe(true);
      }
      const set = formulas.get(level) ?? new Set();
      for (const t of p.terms) set.add(countingFormula(t.model));
      formulas.set(level, set);
    });
    expect([...formulas.get("medio")!].sort()).toEqual([...FORMULA_IDS].sort());
    expect([...formulas.get("avanzado")!].sort()).toEqual([...FORMULA_IDS].sort());
    expect(formulas.get("básico")!.size).toBeGreaterThanOrEqual(4);
    expect(complements).toBeGreaterThan(10);
  });

  it("avanzado: siempre varios pasos (complementario, producto, «al menos dos», bloques), nunca un C(9, 2) suelto", () => {
    const kinds = { complemento: 0, producto: 0, tres: 0 };
    for (const s of [...SEEDS, ...Array.from({ length: 200 }, (_, i) => i)]) {
      const p = COMB_PROBLEM.generate(s, "avanzado");
      expect(isMultiStep(p), p.text).toBe(true);
      if (p.terms.some((t) => t.sign < 0)) kinds.complemento++;
      if (p.terms.some((t) => t.times)) kinds.producto++;
      if (p.terms.length >= 3) kinds.tres++;
      // Cada paso vale algo y la respuesta es la suma con signo.
      for (const t of p.terms) expect(termValue(t) > 0n).toBe(true);
      expect(problemAnswer(p)).toBe(p.terms.reduce((a, t) => a + BigInt(t.sign) * termModels(t).reduce((x, m) => x * countModel(m), 1n), 0n));
    }
    expect(kinds.complemento).toBeGreaterThan(20);
    expect(kinds.producto).toBeGreaterThan(20);
    expect(kinds.tres).toBeGreaterThan(5);
  });

  it("errores típicos con varios pasos: una sola etapa, las etapas sumadas, quitar solo una parte", () => {
    const prod = { text: "", terms: [{ sign: 1 as const, model: { n: 7, k: 2, order: false, repetition: false }, times: [{ n: 5, k: 1, order: false, repetition: false }] }] };
    expect(problemAnswer(prod)).toBe(105n);
    expect(problemMistake(prod, 21n)).toMatch(/solo una de las etapas/);
    expect(problemMistake(prod, 26n)).toMatch(/Has sumado las etapas/);
    const two = {
      text: "",
      terms: [
        { sign: 1 as const, model: { n: 9, k: 3, order: false, repetition: false } },
        { sign: -1 as const, model: { n: 5, k: 3, order: false, repetition: false } },
        { sign: -1 as const, model: { n: 4, k: 1, order: false, repetition: false }, times: [{ n: 5, k: 2, order: false, repetition: false }] },
      ],
    };
    // 84 − 10 − 40 = 34; 84 − 10 = 74 quita solo una parte.
    expect(problemAnswer(two)).toBe(34n);
    expect(problemMistake(two, 74n)).toMatch(/solo una parte/);
    expect(problemMistake(two, 84n)).toMatch(/total de casos/);
    expect(problemMistake(two, 34n)).toBeNull();
  });

  it("no repite los números de las preguntas de examen (Morse 5 con 3, capa 6/4/2, 16 bits)", () => {
    each((s, level) => {
      const p = COMB_PROBLEM.generate(s, level);
      const m = p.terms[0]!.model;
      if (m.groups) {
        expect(m.groups.join(",")).not.toBe("6,4,2");
        expect(m.groups.join(",") === "8,8" && /bits/.test(p.text)).toBe(false);
        expect(m.n === 5 && /destellos/.test(p.text)).toBe(false);
      }
    });
  });

  it("modelo: cuatro fórmulas distintas y exactamente una que encaja", () => {
    each((s, level) => {
      const x = COMB_MODEL.generate(s, level);
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options).size).toBe(4);
      const accepted = acceptedFormulas(x.model);
      expect(x.options.filter((o) => accepted.includes(o))).toHaveLength(1);
    });
  });

  it("funciones: una sola verdadera entre cuatro (básico y medio) o varias, con verdaderas y falsas (avanzado)", () => {
    let subsets = 0;
    let equal = 0;
    each((s, level) => {
      const x = COMB_FUNCTIONS.generate(s, level);
      const v = x.statements.map((st) => statementTrue(st, x));
      if (level === "avanzado") {
        expect(x.multi).toBe(true);
        expect(v.some(Boolean) && v.some((t) => !t)).toBe(true);
      } else {
        expect(x.multi).toBe(false);
        expect(x.statements).toHaveLength(4);
        expect(v.filter(Boolean)).toHaveLength(1);
      }
      const texts = x.statements.map(statementText);
      expect(new Set(texts).size).toBe(texts.length);
      if (x.subset) {
        subsets++;
        expect(x.a).toBeLessThan(x.b);
      }
      if (x.a === x.b) equal++;
    });
    expect(subsets).toBeGreaterThan(30);
    expect(equal).toBeGreaterThan(30);
  });

  it("complejidad: cuatro opciones, una sola buena; a veces «Ninguna», a veces la trampa de la constante", () => {
    let none = 0;
    let traps = 0;
    let calls = 0;
    each((s, level) => {
      const x = COMB_COMPLEXITY.generate(s, level);
      const g = complexityGrowth(x);
      expect(x.options).toHaveLength(4);
      const right = x.options.map((_, i) => optionIsCorrect(x.options, i, g));
      expect(right.filter(Boolean), `${level} ${s}`).toHaveLength(1);
      if ("none" in x.options[right.indexOf(true)]!) none++;
      if (x.options.some((o) => isConstantTrap(o, g))) traps++;
      if (x.kind === "algo" && x.algo.sub) calls++;
    });
    expect(none).toBeGreaterThan(20);
    expect(traps).toBeGreaterThan(50);
    expect(calls).toBeGreaterThan(50);
  });

  it("complejidad: junto a «Ninguna» no hay un orden mayor (que sería una cota O verdadera)", () => {
    let none = 0;
    each((s, level) => {
      const x = COMB_COMPLEXITY.generate(s, level);
      const g = complexityGrowth(x);
      if (!x.options.some((o) => "none" in o)) return;
      none++;
      for (const o of x.options) expect(isLooseBound(o, g), `${level} ${s}`).toBe(false);
    });
    expect(none).toBeGreaterThan(20);
    // La semilla del revisor (básico, 4c): T(n) = n² + 3n⁸ con O(n⁹) junto a «Ninguna».
    const x = COMB_COMPLEXITY.generate(seedFromText("4c")!, "básico");
    const g = complexityGrowth(x);
    if (x.options.some((o) => "none" in o)) for (const o of x.options) expect(isLooseBound(o, g)).toBe(false);
  });

  it("cota ajustada: O(n⁹) acota a n⁸ pero no es el orden exacto; O(n⁷) no acota", () => {
    const g = growthOf(costOf("n^2 + 3n^8"));
    expect(growthLE(g, growthOf(costOf("n^9")))).toBe(true);
    expect(isLooseBound({ growth: growthOf(costOf("n^9")) }, g)).toBe(true);
    expect(isLooseBound({ growth: growthOf(costOf("n^7")) }, g)).toBe(false);
    expect(isLooseBound({ growth: g }, g)).toBe(false);
  });

  it("errores típicos de recuento: otro modelo, el total sin restar, lo que se resta, la suma", () => {
    const c92 = { n: 9, k: 2, order: false, repetition: false };
    expect(wrongModelHint(c92, 72n)).toBe("Ese número es el que dan las variaciones, V(9, 2). ¿Importa aquí el orden?");
    expect(wrongModelHint(c92, 45n)).toMatch(/combinaciones con repetición, CR\(9, 2\)\. ¿Se pueden repetir/);
    expect(wrongModelHint(c92, 36n)).toBeNull();
    expect(wrongModelHint(c92, 37n)).toBeNull();
    const p = { text: "", terms: [{ sign: 1 as const, model: { n: 10, k: 3, order: true, repetition: true } }, { sign: -1 as const, model: { n: 10, k: 3, order: true, repetition: false } }] };
    expect(problemMistake(p, 1000n)).toMatch(/total de casos posibles/);
    expect(problemMistake(p, 720n)).toMatch(/no cumplen la condición, los que hay que quitar/);
    expect(problemMistake(p, 1720n)).toMatch(/Has sumado/);
    expect(problemMistake(p, 280n)).toBeNull();
    // Nunca el número bueno.
    for (const v of [1000n, 720n, 1720n]) expect(problemMistake(p, v)).not.toContain("280");
  });

  it("«¿Qué modelo es?»: las pistas que solo preguntan no nombran ningún modelo", () => {
    each((s, level) => {
      const x = COMB_MODEL.generate(s, level);
      for (const h of modelQuestionHints(x.model)) for (const id of FORMULA_IDS) expect(h.toLowerCase()).not.toContain(FORMULAS[id].name.toLowerCase());
    });
  });

  it("P y NP: afirmaciones del banco, sin repetir, con verdaderas y falsas", () => {
    each((s, level) => {
      const x = COMB_PNP.generate(s, level);
      expect(x.ids).toHaveLength(level === "básico" ? 4 : level === "medio" ? 5 : 6);
      expect(new Set(x.ids).size).toBe(x.ids.length);
      const v = x.ids.map((id) => pnpStatement(id).value);
      expect(v.some(Boolean) && v.some((t) => !t)).toBe(true);
    });
  });
});
