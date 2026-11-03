// Valida el contenido del laboratorio de probabilidad (content/probabilidad/) con su esquema zod y
// comprueba que cada ejemplo sirve para lo que dice: árboles con P(C) > 0, tablas que coinciden con
// sus datos, distribuciones válidas y juegos y penalizaciones con respuesta exacta.
import { describe, expect, it } from "vitest";
import { PROB_PACK } from "../content/probabilidad/practica.ts";
import { solveTree } from "../shared/probability/conditional.ts";
import { distProblem } from "../shared/probability/distributions.ts";
import { distFromContent, ProbPackSchema, readProb } from "../shared/probability/schema.ts";
import { penaltyForTarget } from "../shared/probability/variable.ts";
import { isZero, cmp, ZERO } from "../shared/rational.ts";

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

describe("content/probabilidad", () => {
  it("cumple ProbPackSchema", () => {
    expect(issues(ProbPackSchema.safeParse(PROB_PACK))).toEqual([]);
  });

  it("el esquema rechaza una partición que no suma 1, una tabla incompleta y un par imposible", () => {
    const t = PROB_PACK.trees[0]!;
    const bad = { ...PROB_PACK, trees: [...PROB_PACK.trees, { ...t, id: "mal", priors: ["1/2", "1/3"] }] };
    expect(issues(ProbPackSchema.safeParse(bad)).join(" ")).toMatch(/sumar 1/);
    const c = PROB_PACK.contingency[0]!;
    const incomplete = { ...PROB_PACK, contingency: [...PROB_PACK.contingency, { ...c, id: "mal", given: ["ab", "pA", "pNotA"] }] };
    expect(issues(ProbPackSchema.safeParse(incomplete)).join(" ")).toMatch(/no se puede completar/);
    const p = PROB_PACK.pairs[0]!;
    const impossible = { ...PROB_PACK, pairs: [...PROB_PACK.pairs, { ...p, id: "mal", value: "0,9" }] };
    expect(issues(ProbPackSchema.safeParse(impossible)).join(" ")).toMatch(/mayor/);
    const prob = { ...PROB_PACK, trees: [...PROB_PACK.trees, { ...t, id: "mal", likelihoods: ["3/2", "1/2"] }] };
    expect(issues(ProbPackSchema.safeParse(prob)).join(" ")).toMatch(/no es una probabilidad/);
  });

  it("ids únicos en cada lista", () => {
    for (const list of [PROB_PACK.trees, PROB_PACK.contingency, PROB_PACK.pairs, PROB_PACK.stories, PROB_PACK.games, PROB_PACK.penalties, PROB_PACK.products]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("árboles con P(C) > 0 y P(Cᶜ) > 0 (Bayes definido en las dos ramas)", () => {
    for (const t of PROB_PACK.trees) {
      const s = solveTree({ priors: t.priors.map(readProb), likelihoods: t.likelihoods.map(readProb) });
      expect(isZero(s.total), t.id).toBe(false);
      expect(isZero(s.totalNot), t.id).toBe(false);
    }
  });

  it("distribuciones válidas y penalizaciones positivas", () => {
    for (const s of PROB_PACK.stories) expect(distProblem(distFromContent(s.dist)), s.id).toBeNull();
    for (const p of PROB_PACK.penalties) expect(cmp(penaltyForTarget(p.options, readProb(p.reward), readProb(p.target)), ZERO), p.id).toBe(1);
  });
});
