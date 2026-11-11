// Pistas ajustadas al enunciado: se barren semillas en los tres niveles y, para cada tipo, cada
// operador o función que nombra una pista (√, ln, un cociente, ↔, ∀…∃, 2ᵏ, A⁻¹, ‖u‖∞…) tiene que
// estar en el enunciado. Los requisitos se definen aquí, mirando el texto de la pista y el enunciado
// (no las etiquetas que usa el código), para que el test no se limite a repetir la implementación.
import { describe, expect, it } from "vitest";
import { algorithmCost, algorithmHints, costHas, costHints } from "../discrete/algorithms.ts";
import { costOf, type Cost } from "../discrete/bigo.ts";
import { parseFormula } from "../logic/parser.ts";
import { CALC_CRITICAL_CHOICE, CALC_DOMAIN, CALC_LHOPITAL, CALC_PIECEWISE, criticalChoiceHints, domainHints, lhopitalHints, piecewiseHints } from "./calculus.ts";
import { COMB_COMPLEXITY } from "./discrete.ts";
import { connectiveRulesHint } from "./hints.ts";
import { detRulesHints, LINALG_DET_RULES, LINALG_NORMS, normsHints } from "./linalg.ts";
import { numberFamily, numbersHints, PRED_NUMBERS } from "./logic-extra.ts";
import { LOGIC_CLASSIFY, LOGIC_TRUTH_TABLE } from "./logic.ts";
import { EXERCISE_LEVELS, type ExerciseLevel, type ExerciseType } from "./types.ts";

const SEEDS = Array.from({ length: 150 }, (_, i) => (i * 2654435761 + 11) >>> 0);

/** Si la pista casa con `hint`, el enunciado tiene que cumplir `needs`. */
type Rule<I> = { name: string; hint: RegExp; needs: (inst: I) => boolean };

function sweep<I>(type: ExerciseType<I>, hintsOf: (inst: I) => readonly string[], rules: readonly Rule<I>[]) {
  let checked = 0;
  for (const level of EXERCISE_LEVELS.filter((l: ExerciseLevel) => type.levels.includes(l))) {
    for (const s of SEEDS) {
      const inst = type.generate(s, level);
      const hints = hintsOf(inst);
      expect(hints.length, `${type.id} ${level} ${s}`).toBeGreaterThan(0);
      for (const h of hints) {
        for (const r of rules) {
          if (r.hint.test(h)) expect(r.needs(inst), `${type.id} ${level}: la pista «${h}» habla de ${r.name} y el enunciado no lo tiene: ${JSON.stringify(inst)}`).toBe(true);
        }
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(SEEDS.length);
}

describe("pistas ajustadas al enunciado", () => {
  it("dominio: √, ln y cocientes solo si f los tiene", () => {
    sweep(CALC_DOMAIN, domainHints, [
      { name: "√", hint: /√/, needs: (i) => i.f.includes("sqrt(") },
      { name: "ln", hint: /\bln\b|logaritmo/, needs: (i) => i.f.includes("ln(") },
      { name: "un cociente", hint: /cociente|denominador|dividir/, needs: (i) => i.f.includes("/") },
      { name: "una parábola", hint: /parábola|grado 2/, needs: (i) => /x\^2|\)\(/.test(i.f) },
    ]);
    // El caso del informe: x/(x² + 3x) no habla de √ ni de ln.
    const hints = domainHints({ f: "x/(x^2 + 3x)" }).join(" ");
    expect(hints).not.toMatch(/√|\bln\b/);
    expect(hints).toMatch(/denominador/);
  });

  it("función a trozos: 0/0 y L'Hôpital solo si algún trozo es un cociente", () => {
    sweep(CALC_PIECEWISE, piecewiseHints, [{ name: "un cociente", hint: /0\/0|L'Hôpital/, needs: (i) => i.left.includes("/") || i.right.includes("/") }]);
  });

  it("L'Hôpital: ∞ solo si x → +∞", () => {
    sweep(CALC_LHOPITAL, lhopitalHints, [{ name: "∞", hint: /∞/, needs: (i) => i.at === "+inf" }]);
  });

  it("puntos críticos tipo test: eˣ solo si f lo tiene", () => {
    sweep(CALC_CRITICAL_CHOICE, criticalChoiceHints, [{ name: "eˣ", hint: /eˣ/, needs: (i) => i.f.includes("e^") }]);
  });

  it("predicados numéricos: el orden de ∀ y ∃, las raíces y los conjuntos según el enunciado", () => {
    const tex = (i: ReturnType<typeof PRED_NUMBERS.generate>) => (i.kind === "conjuntos" ? numberFamily(i.family).tex(i.c) : "\\exists k \\in \\mathbb{Z} : y = k\\cdot x");
    const order = (t: string) => {
      const a = t.indexOf("\\forall");
      const e = t.indexOf("\\exists");
      return a >= 0 && e >= 0 ? (a < e ? "∀∃" : "∃∀") : a >= 0 ? "∀" : e >= 0 ? "∃" : "";
    };
    sweep(PRED_NUMBERS, numbersHints, [
      { name: "∀…∃", hint: /∀…∃|para cada valor/, needs: (i) => order(tex(i)) === "∀∃" },
      { name: "∃…∀", hint: /∃…∀/, needs: (i) => order(tex(i)) === "∃∀" },
      { name: "∃ solo", hint: /^∃:/, needs: (i) => order(tex(i)) === "∃" && i.kind === "conjuntos" },
      { name: "∀", hint: /∀/, needs: (i) => tex(i).includes("\\forall") },
      { name: "∃", hint: /∃/, needs: (i) => tex(i).includes("\\exists") },
      { name: "una raíz cuadrada", hint: /raíz cuadrada|√/, needs: (i) => /x\^2 =/.test(tex(i)) },
      { name: "una raíz cúbica", hint: /raíz cúbica|∛/, needs: (i) => /\^3/.test(tex(i)) },
      { name: "un cociente 1/k", hint: /1\/k|1\/2/, needs: (i) => /\d+x|\\,y/.test(tex(i)) },
      { name: "una suma", hint: /negativos/, needs: (i) => /\+ \d/.test(tex(i)) },
      { name: "un orden (<, ≤)", hint: /mínimo|por debajo|en medio|Entre dos/, needs: (i) => /<|\\le/.test(tex(i)) },
      { name: "una igualdad", hint: /despeja|igualdad/, needs: (i) => tex(i).includes("=") && i.kind === "conjuntos" },
      { name: "un 0 en los pares", hint: /Cuidado con el 0/, needs: (i) => i.kind === "divide" && i.pairs.some(([a, b]) => a === 0 || b === 0) },
    ]);
    // El caso del informe: ∃x ∈ A: x² = 3 no habla de ∀…∃.
    expect(numbersHints({ kind: "conjuntos", family: "raiz-dos", c: 3, options: [] }).join(" ")).not.toMatch(/∀/);
  });

  it("complejidad: 2ᵏ y los logaritmos solo si el coste los tiene", () => {
    const costOfInst = (i: ReturnType<typeof COMB_COMPLEXITY.generate>): Cost => (i.kind === "algo" ? algorithmCost(i.algo) : costOf(i.cost, ["n", "m"]));
    const hintsOf = (i: ReturnType<typeof COMB_COMPLEXITY.generate>) => (i.kind === "algo" ? algorithmHints(i.algo) : costHints(costOf(i.cost, ["n", "m"])));
    sweep(COMB_COMPLEXITY, hintsOf, [
      { name: "una exponencial", hint: /2ᵏ|2ⁿ|exponencial/, needs: (i) => costHas(costOfInst(i), "exp") },
      { name: "un logaritmo", hint: /log|logaritmo/, needs: (i) => costHas(costOfInst(i), "log") },
      { name: "un recorrido de A", hint: /\|A\|/, needs: (i) => i.kind === "algo" && JSON.stringify(i.algo.body).includes('"set":"A"') },
    ]);
    // El caso del informe: c(k) = k³ + 4k + 4 no tiene exponenciales.
    const hints = algorithmHints({ sub: "k^3 + 4k + 4", body: [{ k: "for", v: "i", to: "n", body: [{ k: "call", arg: "n" }] }] }).join(" ");
    expect(hints).not.toMatch(/2ᵏ/);
  });

  it("tablas de verdad: la regla de cada conectiva solo si la fórmula la tiene", () => {
    const rules: Rule<{ formula: string }>[] = [
      { name: "→", hint: /→/, needs: (i) => i.formula.includes("→") },
      { name: "↔", hint: /↔/, needs: (i) => i.formula.includes("↔") },
      { name: "⊻", hint: /⊻/, needs: (i) => i.formula.includes("⊻") },
      { name: "∧", hint: /∧/, needs: (i) => i.formula.includes("∧") },
      { name: "∨", hint: /∨/, needs: (i) => i.formula.includes("∨") },
    ];
    const hintsOf = (i: { formula: string }) => {
      const r = parseFormula(i.formula);
      if (!r.ok) throw new Error(i.formula);
      const h = connectiveRulesHint(r.ast);
      return h ? [h] : [];
    };
    sweep(LOGIC_CLASSIFY, hintsOf, rules);
    sweep(LOGIC_TRUTH_TABLE, hintsOf, rules);
    // El caso del informe: una tautología sin ↔ no explica ↔.
    const r = parseFormula("p → (q → p)");
    expect(r.ok && connectiveRulesHint(r.ast)).toBe("Recuerda: p → q solo es falsa cuando p es verdadera y q es falsa.");
  });

  it("propiedades del determinante: cada regla solo si la expresión tiene esa operación", () => {
    sweep(LINALG_DET_RULES, detRulesHints, [
      { name: "un escalar k", hint: /kⁿ|det\(kA\)/, needs: (i) => i.expr.k !== 1 },
      { name: "un producto", hint: /det\(AB\)/, needs: (i) => i.expr.factors.length > 1 },
      { name: "una inversa", hint: /⁻¹/, needs: (i) => i.expr.factors.some((f) => f.pow < 0) },
      { name: "una traspuesta", hint: /ᵀ/, needs: (i) => i.expr.factors.some((f) => f.T) },
      { name: "un cuadrado", hint: /A²/, needs: (i) => i.expr.factors.some((f) => Math.abs(f.pow) >= 2) },
      { name: "autovalores", hint: /autovalores/, needs: (i) => i.given.kind === "autovalores" },
      { name: "una matriz dada", hint: /permutación/, needs: (i) => i.given.kind === "matriz" },
    ]);
  });

  it("normas: cada norma o el producto escalar solo si las condiciones lo tienen", () => {
    type Count = Extract<ReturnType<typeof LINALG_NORMS.generate>, { kind: "contar" }>;
    const has = (i: Count, k: string) => i.conds.some((c) => c.lhs.k === k || c.rhs.k === k);
    const rules: Rule<Count>[] = [
      { name: "u·v", hint: /u·v/, needs: (i) => has(i, "dot") },
      { name: "‖u‖₁", hint: /‖u‖₁/, needs: (i) => has(i, "norm1") },
      { name: "‖u‖₂²", hint: /‖u‖₂²/, needs: (i) => has(i, "norm2sq") },
      { name: "‖u‖∞", hint: /‖u‖∞/, needs: (i) => has(i, "normInf") },
      { name: "|α|", hint: /\|α\|/, needs: (i) => has(i, "norm1") || has(i, "normInf") },
      { name: "una desigualdad", hint: /desigualdad/, needs: (i) => i.conds.some((c) => c.op !== "=") },
    ];
    const type: ExerciseType<Count> = {
      ...LINALG_NORMS,
      levels: ["medio", "avanzado"],
      generate: (s, l) => {
        const i = LINALG_NORMS.generate(s, l);
        if (i.kind !== "contar") throw new Error("sin α");
        return i;
      },
    };
    sweep(type, normsHints, rules);
  });
});
