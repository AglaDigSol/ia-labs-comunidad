// Valida el contenido del laboratorio de combinatoria (content/combinatoria/) con su esquema zod y
// comprueba que cada ejemplo sirve para lo que dice: problemas con un único modelo y una respuesta
// razonable, planteamientos de funciones con afirmaciones verdaderas y falsas, y fragmentos y costes
// cuyo orden sale.
import { describe, expect, it } from "vitest";
import { COMB_PACK } from "../content/combinatoria/practica.ts";
import { algorithmGrowth, algorithmLines } from "../shared/discrete/algorithms.ts";
import { costOf, growthOf, growthText } from "../shared/discrete/bigo.ts";
import { classify, countModel, FORMULA_IDS } from "../shared/discrete/count.ts";
import { statementTrue } from "../shared/discrete/functions.ts";
import { CombPackSchema } from "../shared/discrete/schema.ts";

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

describe("content/combinatoria", () => {
  it("cumple CombPackSchema", () => {
    expect(issues(CombPackSchema.safeParse(COMB_PACK))).toEqual([]);
  });

  it("el esquema rechaza modelos imposibles, afirmaciones sin |f(A)| y variables fuera de su bucle", () => {
    const badModel = { ...COMB_PACK, problems: [...COMB_PACK.problems, { ...COMB_PACK.problems[0]!, id: "mal", model: { n: 3, k: 5, order: false, repetition: false } }] };
    expect(issues(CombPackSchema.safeParse(badModel)).join(" ")).toMatch(/Sin repetición/);
    const badFn = { ...COMB_PACK, functions: [...COMB_PACK.functions, { id: "mal", level: "básico", a: 3, b: 4, statements: [{ k: "fixed", prop: "inyectiva" }, { k: "fixed", prop: "inyectiva" }, { k: "fixed", prop: "inyectiva" }] }] };
    expect(issues(CombPackSchema.safeParse(badFn)).join(" ")).toMatch(/necesita \|f\(A\)\|/);
    const badAlgo = { ...COMB_PACK, algorithms: [...COMB_PACK.algorithms, { id: "mal", level: "básico", title: "Mal", algo: { body: [{ k: "for", v: "j", to: "i", body: [{ k: "op", text: "x" }] }] } }] };
    expect(issues(CombPackSchema.safeParse(badAlgo)).join(" ")).toMatch(/no es de ningún bucle/);
    const badCost = { ...COMB_PACK, costs: [...COMB_PACK.costs, { id: "mal", level: "básico", cost: "n +" }] };
    expect(issues(CombPackSchema.safeParse(badCost)).join(" ")).toMatch(/no se lee/);
  });

  it("los problemas cubren las seis fórmulas, con respuestas de examen (entre 10 y 10¹⁰)", () => {
    expect(new Set(COMB_PACK.problems.map((p) => classify(p.model)))).toEqual(new Set(FORMULA_IDS));
    for (const p of COMB_PACK.problems) {
      const v = countModel(p.model);
      expect(v > 10n && v < 10n ** 10n, p.id).toBe(true);
    }
    const ids = COMB_PACK.problems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada planteamiento de funciones tiene afirmaciones verdaderas y falsas", () => {
    for (const f of COMB_PACK.functions) {
      const values = f.statements.map((s) => statementTrue(s, f));
      expect(values.some(Boolean) && values.some((v) => !v), f.id).toBe(true);
    }
  });

  it("los fragmentos y los costes tienen orden y se escriben", () => {
    for (const a of COMB_PACK.algorithms) {
      expect(growthText(algorithmGrowth(a.algo)).length, a.id).toBeGreaterThan(0);
      expect(algorithmLines(a.algo).length).toBeGreaterThan(0);
    }
    expect(COMB_PACK.algorithms.map((a) => growthText(algorithmGrowth(a.algo)))).toEqual(["m·n", "n²", "n²", "m·log n", "n·2ⁿ", "m³·n"]);
    expect(COMB_PACK.costs.map((c) => growthText(growthOf(costOf(c.cost))))).toEqual(["n¹²", "n³", "2ⁿ", "n·log n", "9ⁿ", "m·n² + m³"]);
  });
});
