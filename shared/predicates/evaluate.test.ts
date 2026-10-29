import { describe, expect, it } from "vitest";
import { predToPlain, type PredFormula } from "./ast.ts";
import { findPredDifference } from "./equivalence.ts";
import {
  evaluatePred,
  evaluationSteps,
  parseDomain,
  sentenceIssues,
  witnesses,
  type PredInterpretation,
} from "./evaluate.ts";
import { parsePredicate } from "./parser.ts";
import { PREDICADOS_PACK } from "../../content/predicados/practica.ts";

const parse = (s: string): PredFormula => {
  const r = parsePredicate(s);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.formula;
};

const lt: string[][] = [];
for (let x = 1; x <= 4; x++) for (let y = x + 1; y <= 4; y++) lt.push([String(x), String(y)]);

// D = {1, 2, 3, 4}, P = pares, Q = mayores que 2, M = «menor que».
const NUM: PredInterpretation = {
  domain: ["1", "2", "3", "4"],
  predicates: { P: [["2"], ["4"]], Q: [["3"], ["4"]], M: lt },
};
const val = (s: string, i = NUM) => evaluatePred(parse(s), i);

describe("evaluatePred", () => {
  it("cuantificadores sobre un dominio finito", () => {
    expect(val("∀x (P(x) → Q(x))")).toBe(false);
    expect(val("∃x (P(x) ∧ Q(x))")).toBe(true);
    expect(val("∀x ∃y M(x, y)")).toBe(false);
    expect(val("∃x ∀y ¬M(y, x)")).toBe(true);
    expect(val("∀x (Q(x) → ∃y M(y, x))")).toBe(true);
    expect(val("∃x P(x) → ∀x Q(x)")).toBe(false);
  });

  it("el orden de los cuantificadores importa", () => {
    expect(val("∀x ∃y ¬M(x, y)")).toBe(true);
    expect(val("∃y ∀x ¬M(x, y)")).toBe(true);
    expect(val("∃x ∀y M(x, y)")).toBe(false);
    expect(val("∀y ∃x M(x, y)")).toBe(false);
  });

  it("constantes y variables libres con asignación", () => {
    expect(val("M(1, 3) ∧ ¬M(3, 1)")).toBe(true);
    expect(evaluatePred(parse("P(x)"), NUM, { x: "2" })).toBe(true);
    expect(evaluatePred(parse("Q(a)"), { ...NUM, constants: { a: "3" } })).toBe(true);
    expect(() => evaluatePred(parse("P(x)"), NUM)).toThrow();
  });

  it("predicados sin extensión son falsos en todo", () => {
    expect(val("∃x Z(x)")).toBe(false);
  });

  it("casos de libro con dominio de un elemento", () => {
    const one: PredInterpretation = { domain: ["1"], predicates: { P: [["1"]] } };
    expect(val("∀x P(x) ↔ ∃x P(x)", one)).toBe(true);
  });
});

describe("sentenceIssues", () => {
  it("detecta variables libres, aridades distintas y constantes desconocidas", () => {
    expect(sentenceIssues(parse("∀x P(x)"), NUM)).toEqual([]);
    expect(sentenceIssues(parse("P(y) ∧ P(z, 1) ∧ Q(7)"), NUM)).toEqual([
      { kind: "arity-conflict", name: "P", arities: [1, 2] },
      { kind: "free-variables", variables: ["y", "z"] },
      { kind: "unknown-constant", name: "7" },
    ]);
  });
});

describe("parseDomain", () => {
  it("lee listas y llaves", () => {
    expect(parseDomain("{1, 2, 3}")).toEqual({ ok: true, domain: ["1", "2", "3"] });
    expect(parseDomain("a b c")).toEqual({ ok: true, domain: ["a", "b", "c"] });
  });
  it("rechaza vacíos, repetidos, variables y dominios grandes", () => {
    expect(parseDomain("").ok).toBe(false);
    expect(parseDomain("1, 1").ok).toBe(false);
    expect(parseDomain("x, y").ok).toBe(false);
    expect(parseDomain("1,2,3,4,5,6", 5).ok).toBe(false);
  });
});

describe("evaluationSteps", () => {
  it("una fórmula cuantificada: sus instancias", () => {
    const r = evaluationSteps(parse("∀x (P(x) → Q(x))"), NUM);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.instances.map((i) => [i.plain, i.value])).toEqual([
      ["P(1) → Q(1)", true],
      ["P(2) → Q(2)", false],
      ["P(3) → Q(3)", true],
      ["P(4) → Q(4)", true],
    ]);
    expect(r.value).toBe(false);
  });

  it("cuantificadores anidados: primero las de dentro, y las instancias apuntan a su paso", () => {
    const r = evaluationSteps(parse("∀x ∃y M(x, y)"), NUM);
    if (!r.ok) throw new Error();
    expect(r.steps.map((s) => s.plain)).toEqual(["∃y M(1, y)", "∃y M(2, y)", "∃y M(3, y)", "∃y M(4, y)", "∀x ∃y M(x, y)"]);
    expect(r.steps[4]!.instances.map((i) => i.step)).toEqual([0, 1, 2, 3]);
    expect(r.steps.map((s) => s.value)).toEqual([true, true, true, false, false]);
  });

  it("no repite pasos y se para si hay demasiados", () => {
    const r = evaluationSteps(parse("∃x P(x) ∧ ¬∃x P(x)"), NUM);
    if (!r.ok) throw new Error();
    expect(r.steps).toHaveLength(1);
    expect(evaluationSteps(parse("∀x ∀y ∀z (M(x, y) → M(x, z))"), NUM)).toEqual({ ok: false, reason: "too-many-steps", limit: 12 });
  });

  it("sin cuantificadores no hay pasos", () => {
    const r = evaluationSteps(parse("P(2) ∧ Q(3)"), NUM);
    expect(r).toEqual({ ok: true, steps: [], value: true });
  });
});

describe("witnesses", () => {
  it("contraejemplos de ∀ falsa y testigos de ∃ verdadera", () => {
    expect(witnesses(parse("∀x (P(x) → Q(x))"), NUM)).toEqual({ kind: "contraejemplo", elements: ["2"] });
    expect(witnesses(parse("∃x (P(x) ∧ Q(x))"), NUM)).toEqual({ kind: "testigo", elements: ["4"] });
    expect(witnesses(parse("∀x (Q(x) → ∃y M(y, x))"), NUM)).toBeNull();
    expect(witnesses(parse("P(2)"), NUM)).toBeNull();
  });
});

describe("findPredDifference", () => {
  const d3 = ["1", "2", "3"];
  it("equivalencias de libro: ninguna diferencia", () => {
    const pairs = [
      ["¬∀x P(x)", "∃x ¬P(x)"],
      ["¬∃x (P(x) ∧ Q(x))", "∀x (P(x) → ¬Q(x))"],
      ["∀x (P(x) ∧ Q(x))", "∀x P(x) ∧ ∀y Q(y)"],
      ["¬∀x ∃y M(x, y)", "∃x ∀y ¬M(x, y)"],
    ];
    for (const [a, b] of pairs) expect(findPredDifference(parse(a!), parse(b!), [d3]), `${a} ≡ ${b}`).toBeNull();
  });

  it("no equivalentes: da una interpretación donde difieren", () => {
    const d = findPredDifference(parse("∀x (P(x) ∨ Q(x))"), parse("∀x P(x) ∨ ∀x Q(x)"), [d3]);
    expect(d).not.toBeNull();
    expect(d!.left).toBe(true);
    expect(d!.right).toBe(false);
    expect(findPredDifference(parse("∀x ∃y M(x, y)"), parse("∃y ∀x M(x, y)"), [["1", "2"]])).not.toBeNull();
  });

  it("con variables libres compara todas las asignaciones", () => {
    expect(findPredDifference(parse("P(x) → Q(x)"), parse("¬P(x) ∨ Q(x)"), [d3])).toBeNull();
    expect(findPredDifference(parse("P(x)"), parse("P(y)"), [d3])).not.toBeNull();
  });

  it("prueba primero la interpretación del estudiante", () => {
    const d = findPredDifference(parse("∃x P(x)"), parse("∃x Q(x)"), [], { extra: [NUM] });
    expect(d).toBeNull();
    const e = findPredDifference(parse("∃x P(x)"), parse("∀x P(x)"), [], { extra: [NUM] });
    expect(e?.interpretation).toBe(NUM);
  });
});

describe("contenido de content/predicados", () => {
  it("cada dominio de ejemplo tiene fórmulas verdaderas y falsas", () => {
    for (const d of PREDICADOS_PACK.domains) {
      const interp: PredInterpretation = {
        domain: d.domain,
        predicates: Object.fromEntries(d.predicates.map((p) => [p.name, p.extension])),
      };
      const values = d.formulas.map((f) => evaluatePred(parse(f), interp));
      expect(values, d.id).toContain(true);
      expect(values, d.id).toContain(false);
    }
  });

  it("las traducciones de referencia se escriben igual que en el contenido", () => {
    for (const t of PREDICADOS_PACK.translation) expect(predToPlain(parse(t.answer))).toBe(t.answer);
  });
});
