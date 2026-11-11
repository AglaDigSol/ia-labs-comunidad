// Soluciones con el paso clave: los límites laterales y f(a) en las funciones a trozos, ∇h evaluado
// en la regla de la cadena, por qué no hay α en las normas y los determinantes sin factores 1. Y las
// correcciones que explican el rechazo: una forma normal equivalente pero no canónica.
import { describe, expect, it } from "vitest";
import { canonicalFormVerdict, NOT_CANONICAL_TEXT, booleVector } from "../boole/canonical.ts";
import { fromLogicNode, normalizeBoole } from "../boole/expr.ts";
import { derivative } from "../calculus/derive.ts";
import { evaluate } from "../calculus/expr.ts";
import { analyzePiecewise } from "../calculus/limits.ts";
import { parseFormula } from "../logic/parser.ts";
import { CALC_CHAIN, CALC_PIECEWISE, calcExpr, calcPiecewise, chainAnswer, chainSolution, niceText, piecewiseSolution, type CalcChainInstance } from "./calculus.ts";
import { detRulesAnswer, detRulesDets, detRulesSolution, LINALG_DET_RULES, LINALG_NORMS, normsCount, normsExplanation, type NormsInstance } from "./linalg.ts";
import { EXERCISE_LEVELS } from "./types.ts";

const SEEDS = Array.from({ length: 120 }, (_, i) => (i * 2654435761 + 23) >>> 0);
const levels = EXERCISE_LEVELS;

describe("función a trozos: los dos límites laterales y f(a), con sus valores", () => {
  it("en todas las semillas", () => {
    for (const level of levels)
      for (const s of SEEDS) {
        const inst = CALC_PIECEWISE.generate(s, level);
        const an = analyzePiecewise(calcPiecewise(inst));
        const text = piecewiseSolution(inst).join("\n");
        const A = niceText(inst.a);
        if (an.left.kind === "finito") expect(text, JSON.stringify(inst)).toContain(`lím x→${A}⁻ f(x) = ${niceText(an.left.value)}`);
        if (an.right.kind === "finito") expect(text).toContain(`lím x→${A}⁺ f(x) = ${niceText(an.right.value)}`);
        expect(text).toContain(`f(${A}) = ${Number.isFinite(an.value) ? niceText(an.value) : "no está definida"}`);
        expect(text).toMatch(an.continuous ? /es continua/ : /no es continua/);
        if (an.continuous) expect(text).toMatch(/f′\(.+⁻\) = .+ y f′\(.+⁺\) = /);
        expect(text).not.toMatch(/—|\d\.\d/);
      }
  });

  it("un ejemplo: x² − 3 y −x + 3 en x = 2", () => {
    const text = piecewiseSolution({ a: 2, left: "x^2 - 3", right: "-x + 3", at: "derecha", ask: "verdadera", claims: [] }).join(" ");
    expect(text).toContain("lím x→2⁻ f(x) = 1");
    expect(text).toContain("lím x→2⁺ f(x) = 1");
    expect(text).toContain("f(2) = 1");
    expect(text).toContain("f′(2⁻) = 4 y f′(2⁺) = −1");
  });
});

describe("regla de la cadena: ∇h evaluado antes de multiplicar", () => {
  it("el gradiente en el punto, el producto y el resultado", () => {
    for (const level of levels)
      for (const s of SEEDS) {
        const inst = CALC_CHAIN.generate(s, level);
        const lines = chainSolution(inst);
        const text = lines.join("\n");
        expect(lines.at(-1)!.endsWith(`= ${niceText(chainAnswer(inst))}.`), `${text}\n${chainAnswer(inst)}`).toBe(true);
        if (inst.kind === "curva") {
          const g = inst.grad ?? gradAt(inst);
          expect(text).toContain(`∇${inst.outer}(${inst.point.map(niceText).join(", ")}) = (${g.map(niceText).join(", ")})`);
        } else {
          expect(text).toMatch(/J[fg]\(p\) = \(/);
          expect(text).toContain(`∇${inst.outer}(${inst.outer === "f" ? "g" : "f"}(p)) = (${inst.grad.map(niceText).join(", ")})`);
        }
      }
  });

  it("el ejemplo del informe: ∇f(g(1)) = (−4, −2) antes de multiplicar por g′(1)", () => {
    const inst: CalcChainInstance = { kind: "curva", outer: "f", t0: 1, h: null, curve: null, point: [-2, -1], velocity: [1, 2], grad: [-4, -2], decoy: { at: [0, 0], grad: [1, 1] } };
    const lines = chainSolution(inst);
    expect(lines[1]).toContain("∇f(−2, −1) = (−4, −2)");
    expect(lines[2]).toBe("[f∘g]′(1) = ∇f(g(1))·g′(1) = (−4)·1 + (−2)·2 = −8.");
  });
});

function gradAt(inst: Extract<CalcChainInstance, { kind: "curva" }>): number[] {
  const h = calcExpr(inst.h!, ["x", "y"]);
  const at = { x: inst.point[0], y: inst.point[1] };
  return [evaluate(derivative(h, "x"), at), evaluate(derivative(h, "y"), at)];
}

describe("normas: la explicación dice por qué no hay solución", () => {
  it("|α| + 5 = 2 no tiene solución porque |α| ≥ 0", () => {
    const inst: Extract<NormsInstance, { kind: "contar" }> = {
      kind: "contar",
      u: [
        [0, 1],
        [2, 0],
        [-3, 0],
      ],
      v: null,
      conds: [{ lhs: { k: "norm1", of: "u" }, op: "=", rhs: { k: "num", value: 2 } }],
      domain: "real",
    };
    const text = normsExplanation(inst).join(" ");
    expect(text).toContain("|α| + 5 = 2");
    expect(text).toContain("|α| = −3: imposible, porque |α| ≥ 0");
    expect(text).toMatch(/la respuesta es 0/);
  });

  it("en todas las semillas: la conclusión coincide con el recuento y los ceros se explican", () => {
    for (const level of ["medio", "avanzado"] as const)
      for (const s of SEEDS) {
        const inst = LINALG_NORMS.generate(s, level);
        if (inst.kind !== "contar") continue;
        const lines = normsExplanation(inst);
        expect(lines).toHaveLength(inst.conds.length + 1);
        const n = normsCount(inst);
        const last = lines.at(-1)!;
        if (n.kind === "infinitos") expect(last).toMatch(/infinitos/);
        else if (n.count === 0) expect(last).toMatch(/la respuesta es 0/);
        else expect(last).toMatch(new RegExp(`${n.count === 1 ? "un valor" : `${n.count} valores`}\\.$`));
        // Una sola igualdad que da un cuadrado o un valor absoluto negativo: se dice por qué es imposible.
        const only = inst.conds.length === 1 && n.kind === "finito" && n.count === 0 && inst.conds[0]!.lhs.k !== "normInf";
        if (only && /^(‖u‖₁|‖u‖₂²|u·v) = -?\d+ es/.test(lines[0]!) && !/\|α\|.*α²|α².*\|α\|/.test(lines[0]!)) expect(lines[0], lines[0]).toMatch(/imposible, porque (\|α\||α²) ≥ 0/);
        expect(lines.join(" ")).not.toMatch(/—|\d\.\d/);
      }
  });
});

describe("propiedades del determinante: sin factores que valen 1", () => {
  it("ni 1ⁿ ni ·1·, y con el resultado", () => {
    for (const level of levels)
      for (const s of SEEDS) {
        const inst = LINALG_DET_RULES.generate(s, level);
        const text = detRulesSolution(inst);
        const v = detRulesAnswer(inst)!;
        // La cuenta de det(…) (los autovalores de los datos se listan todos, también los 1).
        const calc = text.slice(text.indexOf("det("));
        expect(calc, text).not.toMatch(/(?<![\d(−/])1[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/);
        expect(calc, text).not.toMatch(/(^|[ =·])1·|·1([ .=]|$)/);
        expect(text).toContain(`= ${String(v.n).replace("-", "−")}${v.d === 1n ? "" : `/${v.d}`}`);
        expect(text).toContain(`det A = `);
        if (inst.given.B !== null) expect(text).toContain(`det B = ${String(detRulesDets(inst).B.n).replace("-", "−")}`);
      }
  });

  it("un ejemplo: det(A⁻¹B) con k = 1 no escribe 1³", () => {
    const text = detRulesSolution({ n: 3, expr: { k: 1, factors: [{ m: "A", pow: -1 }, { m: "B", pow: 1 }] }, given: { kind: "det", A: 2, B: 3 } });
    expect(text).toBe("det A = 2, det B = 3. det(A⁻¹B) = (det A)⁻¹·det B = (1/2)·3 = 3/2.");
  });
});

describe("formas normales: equivalente pero no canónica", () => {
  const vars = ["p", "q", "r"];
  const read = (t: string) => {
    const r = parseFormula(t);
    if (!r.ok) throw new Error(t);
    return normalizeBoole(fromLogicNode(r.ast)!);
  };
  const vector = booleVector(read("p ∧ r"), vars);

  it("p ∧ r en vez de la FND: lo dice en lugar de solo marcarla mal", () => {
    const v = canonicalFormVerdict(read("p ∧ r"), vars, "sop", vector, "logica");
    expect(v).toEqual({ ok: false, text: "Equivalente, pero se pide la forma canónica (un término por mintérmino).", equivalent: true });
    expect(canonicalFormVerdict(read("p ∧ r"), vars, "pos", vector, "logica").text).toBe(NOT_CANONICAL_TEXT.pos);
  });

  it("la canónica pasa y una no equivalente sigue con su mensaje", () => {
    expect(canonicalFormVerdict(read("(p ∧ q ∧ r) ∨ (p ∧ ¬q ∧ r)"), vars, "sop", vector, "logica")).toEqual({ ok: true, text: "Forma normal disyuntiva correcta." });
    const bad = canonicalFormVerdict(read("p ∧ q"), vars, "sop", vector, "logica");
    expect(bad.ok).toBe(false);
    expect(bad.equivalent).toBeUndefined();
    expect(bad.text).toMatch(/debe llevar las 3 variables/);
  });
});
