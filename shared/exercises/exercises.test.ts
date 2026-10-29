import { describe, expect, it } from "vitest";
import { booleVector, canonicalProduct, canonicalShape, canonicalSum, vectorOnes, vectorZeros } from "../boole/canonical.ts";
import { booleVars, literalCount, normalizeBoole, parseBoole, fromLogicNode, toLogicNode } from "../boole/expr.ts";
import { checkKMapGroups, KMAP_MAX_VARS, kmapSolution } from "../boole/karnaugh.ts";
import { minimizeBoole } from "../boole/minimize.ts";
import { trivialStep } from "../boole/rewrite.ts";
import { collectVars, toPlain } from "../logic/ast.ts";
import { formatFNC, formatFND } from "../logic/canonical.ts";
import { compareFormulas } from "../logic/compare.ts";
import { parseFormula } from "../logic/parser.ts";
import { buildTable, classify } from "../logic/truth-table.ts";
import { isNegationNormalForm, predToPlain, type PredFormula } from "../predicates/ast.ts";
import { evaluationSteps, predEvaluator } from "../predicates/evaluate.ts";
import { checkNegationStep, pushNegation } from "../predicates/negation.ts";
import { parsePredicate } from "../predicates/parser.ts";
import { countOf, solveRegions } from "../sets/cardinal.ts";
import { compareSetExprs, parseSetExpr, setRegions, setToPlain, setVars, type SetExpr, type SetName } from "../sets/expr.ts";
import { cartesianProduct, checkPowerSet, checkProduct, MAX_POWER_SET_BASE, MAX_PRODUCT_SIDE, powerSetOf } from "../sets/finite.ts";
import { SetsCardinalSchema } from "../sets/schema.ts";
import { BOOLE_CANONICAL, BOOLE_KARNAUGH, BOOLE_SIMPLIFY } from "./boole.ts";
import { binaryCount, hasRedundancy, LOGIC_CLASSIFY, LOGIC_EQUIVALENCE, LOGIC_LIMITS, LOGIC_NORMAL_FORMS, LOGIC_TRUTH_TABLE } from "./logic.ts";
import { EXERCISE_MAX_EVAL_STEPS, NEGATION_STEPS, PRED_EVALUATE, PRED_NEGATE, toPredInterpretation, wellFormedSentence } from "./predicates.ts";
import { createRng, generateUntil, randomSeed, seedFromText, seedToText } from "./random.ts";
import { EXERCISE_TYPES, exerciseType, exerciseTopics, mixedType } from "./registry.ts";
import { SETS_CARDINAL, SETS_EQUAL, SETS_PARTS, SETS_PROOF, SETS_VENN, setRedundant } from "./sets.ts";
import { EXERCISE_LEVELS, levelFromSlug, LEVEL_SLUGS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void, seeds = SEEDS) => {
  for (const level of EXERCISE_LEVELS) for (const s of seeds) fn(s, level);
};

const logic = (s: string) => {
  const r = parseFormula(s);
  if (!r.ok) throw new Error(`no se lee: ${s}`);
  expect(toPlain(r.ast)).toBe(s);
  return r.ast;
};
const pred = (s: string): PredFormula => {
  const r = parsePredicate(s);
  if (!r.ok) throw new Error(`no se lee: ${s}`);
  expect(predToPlain(r.formula)).toBe(s);
  return r.formula;
};
const set = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(`no se lee: ${s}`);
  expect(setToPlain(r.expr)).toBe(s);
  return r.expr;
};

describe("generador con semilla", () => {
  it("la misma semilla da la misma secuencia y otra semilla, otra", () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs);
    expect(createRng(43).next()).not.toBe(xs[0]);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("int, pick y shuffle respetan sus límites", () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const k = r.int(2, 5);
      expect(k >= 2 && k <= 5 && Number.isInteger(k)).toBe(true);
    }
    expect(["a", "b"]).toContain(r.pick(["a", "b"]));
    expect([...r.shuffle([1, 2, 3, 4])].sort()).toEqual([1, 2, 3, 4]);
    expect(() => r.pick([])).toThrow();
  });

  it("la semilla va y vuelve de la URL; lo que no es una semilla se rechaza", () => {
    for (const s of [0, 1, 35, 36, 123456789, 0xffffffff, randomSeed()]) expect(seedFromText(seedToText(s))).toBe(s);
    for (const bad of [null, "", "ABC", "-1", "zzzzzzzz", "1.5", "a b"]) expect(seedFromText(bad)).toBeNull();
    expect(seedFromText("zzzzzzz")).toBeNull(); // 78 364 164 095 > 2³² − 1
  });

  it("generateUntil falla en vez de colgarse si no hay candidato", () => {
    expect(() => generateUntil(createRng(1), () => 1, () => false, 10)).toThrow();
  });

  it("los niveles van y vuelven de la URL", () => {
    for (const l of EXERCISE_LEVELS) expect(levelFromSlug(LEVEL_SLUGS[l])).toBe(l);
    expect(levelFromSlug("básico")).toBeNull();
    expect(levelFromSlug(null)).toBeNull();
  });
});

describe("registro", () => {
  it("ids únicos, con su tema, sus tres niveles y título y descripción", () => {
    const ids = EXERCISE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of EXERCISE_TYPES) {
      expect(t.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(t.levels).toEqual(EXERCISE_LEVELS);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.description.length).toBeGreaterThan(10);
      expect(exerciseType(t.id)).toBe(t);
    }
    expect(exerciseType("no-existe")).toBeNull();
    expect(exerciseTopics().map((t) => t.id)).toEqual(["logica", "predicados", "conjuntos", "boole"]);
  });

  it("cada tipo es determinista: misma semilla y nivel, misma instancia", () => {
    for (const t of EXERCISE_TYPES) {
      for (const level of EXERCISE_LEVELS) {
        for (const s of SEEDS.slice(0, 15)) expect(t.generate(s, level)).toEqual(t.generate(s, level));
      }
    }
  });

  it("semillas distintas dan ejercicios variados", () => {
    for (const t of EXERCISE_TYPES) {
      for (const level of EXERCISE_LEVELS) {
        const seen = new Set(SEEDS.slice(0, 40).map((s) => JSON.stringify(t.generate(s, level))));
        expect(seen.size, `${t.id} ${level}`).toBeGreaterThan(8);
      }
    }
  });

  it("«Mezclar» elige un tipo del tema, siempre el mismo con la misma semilla", () => {
    expect(mixedType("logica", "medio", 5).id).toBe(mixedType("logica", "medio", 5).id);
    const ids = new Set(SEEDS.slice(0, 60).map((s) => mixedType("conjuntos", "básico", s).id));
    expect(ids.size).toBe(5);
    for (const id of ids) expect(exerciseType(id)!.topic).toBe("conjuntos");
  });
});

describe("lógica", () => {
  it("tabla de verdad: se lee, usa todas las variables del nivel, contingencia, con pasos y sin redundancias", () => {
    each((s, level) => {
      const f = logic(LOGIC_TRUTH_TABLE.generate(s, level).formula);
      const { vars, ops } = LOGIC_LIMITS[level];
      expect(collectVars(f)).toEqual(vars);
      const k = binaryCount(f);
      expect(k >= ops[0] && k <= ops[1]).toBe(true);
      expect(hasRedundancy(f)).toBe(false);
      const t = buildTable(f);
      if (!t.ok) throw new Error("tabla");
      expect(t.subformulas.length).toBeGreaterThanOrEqual(2);
      expect(classify(t.rows).kind).toBe("contingencia");
    });
  });

  it("clasificar: las tres clases aparecen (aproximadamente a partes iguales)", () => {
    for (const level of EXERCISE_LEVELS) {
      const kinds = SEEDS.map((s) => {
        const f = logic(LOGIC_CLASSIFY.generate(s, level).formula);
        expect(hasRedundancy(f)).toBe(false);
        expect(collectVars(f).length).toBeLessThanOrEqual(3);
        const t = buildTable(f);
        if (!t.ok) throw new Error("tabla");
        return classify(t.rows).kind;
      });
      for (const k of ["tautologia", "contradiccion", "contingencia"]) {
        const n = kinds.filter((x) => x === k).length;
        expect(n, `${level} ${k}`).toBeGreaterThan(40);
      }
    }
  });

  it("equivalencias: la mitad (más o menos) son equivalentes; las dos fórmulas se leen y son distintas", () => {
    for (const level of EXERCISE_LEVELS) {
      let yes = 0;
      for (const s of SEEDS) {
        const { a, b } = LOGIC_EQUIVALENCE.generate(s, level);
        expect(a).not.toBe(b);
        const c = compareFormulas(logic(a), logic(b));
        if (!c.ok) throw new Error("comparar");
        if (c.equivalent) yes++;
        else expect(c.differing).toBeGreaterThan(0);
      }
      expect(yes).toBeGreaterThan(60);
      expect(yes).toBeLessThan(140);
    }
  });

  it("formas normales: la FND y la FNC del motor, escritas con ¬ ∧ ∨, tienen forma canónica y son las de la fórmula", () => {
    each((s, level) => {
      const f = logic(LOGIC_NORMAL_FORMS.generate(s, level).formula);
      const t = buildTable(f, { order: "false-first" });
      if (!t.ok) throw new Error("tabla");
      expect(t.vars.length).toBeLessThanOrEqual(3);
      const ones = t.rows.filter((r) => r.result).map((r) => r.minterm);
      const zeros = t.rows.filter((r) => !r.result).map((r) => r.minterm);
      expect(ones.length > 0 && zeros.length > 0).toBe(true);
      for (const [text, kind, want] of [
        [formatFND(t.vars, ones, "logica").plain, "sop", ones],
        [formatFNC(t.vars, zeros, "logica").plain, "pos", zeros],
      ] as const) {
        const p = parseFormula(text);
        if (!p.ok) throw new Error(text);
        const e = fromLogicNode(p.ast);
        expect(e).not.toBeNull();
        const shape = canonicalShape(normalizeBoole(e!), t.vars, kind);
        expect(shape).toEqual({ ok: true, indices: want });
      }
    }, SEEDS.slice(0, 60));
  });
});

describe("álgebra de Boole", () => {
  it("Σm y ΠM: expresión legible, con todas las variables, no constante; las formas canónicas del motor se aceptan", () => {
    each((s, level) => {
      const { vars, expr } = BOOLE_CANONICAL.generate(s, level);
      const r = parseBoole(expr);
      if (!r.ok) throw new Error(expr);
      expect(booleVars(r.expr)).toEqual(vars);
      const v = booleVector(r.expr, vars);
      expect(v).toMatch(/1/);
      expect(v).toMatch(/0/);
      expect(canonicalShape(canonicalSum(vars, vectorOnes(v)), vars, "sop")).toEqual({ ok: true, indices: vectorOnes(v) });
      expect(canonicalShape(canonicalProduct(vars, vectorZeros(v)), vars, "pos")).toEqual({ ok: true, indices: vectorZeros(v) });
    });
  });

  it("Karnaugh: tamaño por nivel, X solo en el avanzado y la agrupación mínima del motor se acepta en los dos modos", () => {
    each((s, level) => {
      const { vars, vector } = BOOLE_KARNAUGH.generate(s, level);
      expect(vars.length).toBe(level === "básico" ? 3 : 4);
      expect(vars.length).toBeLessThanOrEqual(KMAP_MAX_VARS);
      expect(vector.length).toBe(1 << vars.length);
      const xs = [...vector].filter((c) => c === "X").length;
      if (level === "avanzado") expect(xs >= 1 && xs <= 3).toBe(true);
      else expect(xs).toBe(0);
      for (const mode of ["sop", "pos"] as const) {
        const sol = kmapSolution(vector, mode);
        expect(sol.length).toBeGreaterThanOrEqual(2);
        expect(checkKMapGroups(vector, sol, mode).status).toBe("minimal");
      }
    });
  });

  it("simplificar: hay literales que quitar, no acaba en constante y la forma mínima del motor cierra el ejercicio", () => {
    each((s, level) => {
      const { expr } = BOOLE_SIMPLIFY.generate(s, level);
      const r = parseBoole(expr);
      if (!r.ok) throw new Error(expr);
      const m = minimizeBoole(r.expr);
      if (!m.ok) throw new Error("minimizar");
      expect(m.minLiterals).toBeGreaterThanOrEqual(1);
      expect(literalCount(r.expr) - m.minLiterals).toBeGreaterThanOrEqual(level === "básico" ? 2 : level === "medio" ? 3 : 4);
      const best = m.sop.literals <= m.pos.literals ? m.sop.expr : m.pos.expr;
      // Equivalente a la de partida (lo que exige cada paso) y sin nada trivial pendiente («He terminado»).
      const cmp = compareFormulas(toLogicNode(r.expr), toLogicNode(best));
      expect(cmp.ok && cmp.equivalent).toBe(true);
      expect(trivialStep(best)).toBeNull();
    }, SEEDS.slice(0, 80));
  });
});

describe("predicados", () => {
  it("evaluar: enunciado bien formado, interpretación no trivial, pasos que caben y valores equilibrados", () => {
    for (const level of EXERCISE_LEVELS) {
      let trues = 0;
      for (const s of SEEDS) {
        const inst = PRED_EVALUATE.generate(s, level);
        const f = pred(inst.formula);
        expect(wellFormedSentence(f)).toBe(true);
        expect(inst.domain.length).toBe(level === "básico" ? 3 : 4);
        for (const p of inst.predicates) {
          const total = inst.domain.length ** p.arity;
          expect(p.extension.length > 0 && p.extension.length < total).toBe(true);
          expect(p.extension.every((t) => t.length === p.arity && t.every((x) => inst.domain.includes(x)))).toBe(true);
        }
        const interp = toPredInterpretation(inst);
        const steps = evaluationSteps(f, interp, EXERCISE_MAX_EVAL_STEPS);
        expect(steps.ok).toBe(true);
        if (predEvaluator(interp)(f)) trues++;
      }
      expect(trues).toBeGreaterThan(60);
      expect(trues).toBeLessThan(140);
    }
  });

  it("negar: los pasos de la negación de referencia están en los límites del nivel y el corrector acepta cada uno", () => {
    each((s, level) => {
      const f = pred(PRED_NEGATE.generate(s, level).formula);
      expect(wellFormedSentence(f)).toBe(true);
      let prev: PredFormula = { kind: "not", arg: f };
      const steps = pushNegation(prev);
      const [min, max] = NEGATION_STEPS[level];
      expect(steps.length >= min && steps.length <= max).toBe(true);
      for (const st of steps) {
        const c = checkNegationStep(prev, st.formula, st.law, ["1", "2", "3"]);
        expect(c.ok).toBe(true);
        prev = st.formula;
      }
      expect(isNegationNormalForm(prev)).toBe(true);
    }, SEEDS.slice(0, 25));
  });
});

describe("conjuntos", () => {
  it("Venn: se lee, usa los conjuntos del nivel y no es ni vacía ni el universo", () => {
    each((s, level) => {
      const e = set(SETS_VENN.generate(s, level).expr);
      const vars: SetName[] = level === "básico" ? ["A", "B"] : ["A", "B", "C"];
      expect(setVars(e)).toEqual(vars);
      expect(setRedundant(e)).toBe(false);
      const regions = setRegions(e, vars);
      expect(regions.some(Boolean) && !regions.every(Boolean)).toBe(true);
    });
  });

  it("¿Son iguales?: la mitad (más o menos) lo son; si no, hay una región que difiere", () => {
    for (const level of EXERCISE_LEVELS) {
      let yes = 0;
      for (const s of SEEDS) {
        const { left, right } = SETS_EQUAL.generate(s, level);
        expect(left).not.toBe(right);
        const c = compareSetExprs(set(left), set(right));
        if (c.equal) yes++;
        else expect(c.differ.length).toBeGreaterThan(0);
      }
      expect(yes).toBeGreaterThan(60);
      expect(yes).toBeLessThan(140);
    }
  });

  it("demostrar: siempre una igualdad verdadera con dos lados distintos", () => {
    each((s, level) => {
      const { left, right } = SETS_PROOF.generate(s, level);
      expect(left).not.toBe(right);
      expect(compareSetExprs(set(left), set(right)).equal).toBe(true);
    });
  });

  it("inclusión–exclusión: cumple el esquema del contenido, solución única y natural, y las preguntas no son datos", () => {
    each((s, level) => {
      const p = SETS_CARDINAL.generate(s, level);
      expect(SetsCardinalSchema.safeParse(p).success).toBe(true);
      const vars: SetName[] = p.sets.C === undefined ? ["A", "B"] : ["A", "B", "C"];
      expect(vars.length).toBe(level === "básico" ? 2 : 3);
      const sol = solveRegions(vars, p.data.map((d) => ({ expr: set(d.expr), value: d.value })));
      if (!sol.ok) throw new Error(sol.reason);
      expect(sol.counts.every((c) => c >= 1)).toBe(true);
      expect(p.questions.length).toBeGreaterThanOrEqual(2);
      for (const q of p.questions) {
        expect(p.data.some((d) => compareSetExprs(set(d.expr), set(q.expr), vars).equal)).toBe(false);
        expect(countOf(set(q.expr), vars, sol.counts)).toBeGreaterThanOrEqual(0);
      }
    }, SEEDS.slice(0, 80));
  });

  it("partes y producto: tamaños dentro de los límites, elementos distintos y la lista del motor se acepta", () => {
    let modes = new Set<string>();
    each((s, level) => {
      const inst = SETS_PARTS.generate(s, level);
      modes = modes.add(inst.mode);
      expect(new Set(inst.a).size).toBe(inst.a.length);
      if (inst.mode === "partes") {
        expect(inst.a.length).toBeLessThanOrEqual(MAX_POWER_SET_BASE);
        expect(checkPowerSet(powerSetOf(inst.a), inst.a).correct).toBe(true);
      } else {
        expect(inst.a.length).toBeLessThanOrEqual(MAX_PRODUCT_SIDE);
        expect(inst.b.length).toBeLessThanOrEqual(MAX_PRODUCT_SIDE);
        expect(new Set(inst.b).size).toBe(inst.b.length);
        expect(checkProduct(cartesianProduct(inst.a, inst.b), inst.a, inst.b).correct).toBe(true);
      }
    });
    expect([...modes].sort()).toEqual(["partes", "producto"]);
  });
});
