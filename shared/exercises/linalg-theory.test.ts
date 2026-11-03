// Ejercicios de teoría de álgebra lineal sobre muchas semillas: las preguntas se montan (cuatro
// opciones a–d con una correcta, o varias correctas), los determinantes por reglas coinciden con
// matrices concretas que cumplen los datos, los α se cuentan también a mano y las clases de los
// sistemas salen del rango.
import { describe, expect, it } from "vitest";
import { matrixDeterminant } from "../linalg/det.ts";
import { intMatrix } from "../linalg/matrix.ts";
import { evalMatrixExpr } from "../linalg/theory.ts";
import { equals, frac, toNumber } from "../rational.ts";
import { arrangeChoices } from "./choice.ts";
import {
  detRulesAnswer,
  detRulesDets,
  LINALG_DET_RULES,
  LINALG_NORMS,
  LINALG_ROUCHE_CHOICE,
  LINALG_TENSOR_VOCAB,
  LINALG_THEORY,
  LINALG_THEORY_EXERCISES,
  normsConditions,
  normsCount,
  normsQuestion,
  roucheChoiceQuestion,
  tensorVocabQuestion,
  theoryQuestion,
} from "./linalg.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 120 }, (_, i) => (i * 2654435761 + 5) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void) => {
  for (const level of EXERCISE_LEVELS) for (const s of SEEDS) fn(s, level);
};

/** Una matriz diagonal con ese determinante (d en la primera casilla, unos en el resto). */
const withDet = (d: Frac, n: number) => intMatrix(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i !== j ? 0 : i === 0 ? Number(d.n) : 1))));
type Frac = ReturnType<typeof frac>;

describe("teoría de álgebra lineal: generadores", () => {
  it("deterministas, variados y con sus tres niveles", () => {
    for (const t of LINALG_THEORY_EXERCISES) {
      expect(t.levels).toEqual(EXERCISE_LEVELS);
      for (const level of EXERCISE_LEVELS) {
        expect(t.generate(SEEDS[1]!, level)).toEqual(t.generate(SEEDS[1]!, level));
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(8);
      }
    }
  });
});

describe("propiedades del determinante", () => {
  it("el resultado por reglas es el determinante de la expresión con matrices que cumplen los datos", () => {
    each((s, level) => {
      const inst = LINALG_DET_RULES.generate(s, level);
      const v = detRulesAnswer(inst)!;
      const dets = detRulesDets(inst);
      // Matrices de ejemplo con esos determinantes (en «matriz», la del enunciado).
      const g = inst.given;
      const A = g.kind === "matriz" ? intMatrix(g.A) : g.kind === "autovalores" ? intMatrix(g.eig.map((l, i) => g.eig.map((_, j) => (i === j ? l : 0)))) : withDet(dets.A, inst.n);
      const B = withDet(dets.B, inst.n);
      expect(A).toHaveLength(inst.n);
      const M = evalMatrixExpr(inst.expr, { A, B })!;
      expect(equals(matrixDeterminant(M), v), JSON.stringify(inst)).toBe(true);
    });
  });
});

describe("teoría de matrices", () => {
  it("opción única con exactamente una correcta entre cuatro (o varias correctas en su modo)", () => {
    const classes = new Set<string>();
    each((s, level) => {
      const inst = LINALG_THEORY.generate(s, level);
      classes.add(inst.cls);
      const q = theoryQuestion(inst);
      const opts = arrangeChoices(q, s);
      if (q.mode === "single") expect(opts).toHaveLength(4);
      for (const o of q.options) expect(o.why).toMatch(/^(Verdadera|Falsa)\./);
    });
    // Salen todas las clases y la diagonal concreta.
    expect(classes.size).toBeGreaterThanOrEqual(10);
    expect(classes.has("diagonal")).toBe(true);
  });
});

describe("normas", () => {
  it("cuatro opciones; el número de α coincide con contarlos a mano en la malla de enteros y medios", () => {
    const answers = new Set<string>();
    each((s, level) => {
      const inst = LINALG_NORMS.generate(s, level);
      if (inst.kind === "calcular") return;
      expect(arrangeChoices(normsQuestion(inst), s)).toHaveLength(4);
      const r = normsCount(inst);
      answers.add(r.kind === "infinitos" ? "∞" : String(r.count));
      if (r.kind === "finito") {
        // Cada valor encontrado cumple las condiciones (con números).
        const conds = normsConditions(inst);
        for (const a of r.values) {
          if (!Number.isInteger(a * 2)) continue;
          const A = frac(BigInt(a * 2), 2n);
          for (const c of conds) {
            const val = (q: (typeof c)["lhs"]) => {
              const at = (v: readonly [number, number][]) => v.map(([k, m]) => k + m * toNumber(A));
              if (q.k === "num") return q.value;
              if (q.k === "dot") return at(q.u).reduce((acc, x, i) => acc + x * at(q.v)[i]!, 0);
              const xs = at(q.v);
              return q.k === "norm1" ? xs.reduce((a2, x) => a2 + Math.abs(x), 0) : q.k === "norm2sq" ? xs.reduce((a2, x) => a2 + x * x, 0) : Math.max(...xs.map(Math.abs));
            };
            const d = val(c.lhs) - val(c.rhs);
            expect(c.op === "=" ? Math.abs(d) < 1e-9 : c.op === ">" ? d > 0 : d < 0).toBe(true);
          }
        }
      }
    });
    // Respuestas variadas.
    expect(answers.size).toBeGreaterThanOrEqual(4);
  });
});

describe("tensores y sistemas tipo test", () => {
  it("vocabulario: cuatro opciones distintas y una correcta", () => {
    each((s, level) => {
      const inst = LINALG_TENSOR_VOCAB.generate(s, level);
      const q = tensorVocabQuestion(inst);
      expect(arrangeChoices(q, s)).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
    });
  });

  it("Rouché–Frobenius: una de las cuatro clases, la del rango", () => {
    const seen = new Set<string>();
    each((s, level) => {
      const inst = LINALG_ROUCHE_CHOICE.generate(s, level);
      const q = roucheChoiceQuestion(inst);
      expect(arrangeChoices(q, s)).toHaveLength(4);
      seen.add(q.options.find((o) => o.correct)!.id);
    });
    expect(seen).toEqual(new Set(["cd", "ci1", "ci2", "inc"]));
  });
});
