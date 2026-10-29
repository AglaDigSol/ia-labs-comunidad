// Valida todo el contenido de content/ con sus esquemas zod. Si añades un símbolo, una asignatura o
// una notación y este test falla, el mensaje dice qué campo hay que corregir.
import { describe, expect, it } from "vitest";
import { COURSES } from "../content/courses/index.ts";
import { NOTATION } from "../content/notation/index.ts";
import { SYMBOL_PACKS } from "../content/symbols/index.ts";
import { BOOLE_PACK } from "../content/boole/practica.ts";
import { CIRCUIT_PACK } from "../content/boole/circuitos.ts";
import { KARNAUGH_PACK } from "../content/boole/karnaugh.ts";
import { PREDICADOS_PACK } from "../content/predicados/practica.ts";
import { BoolePackSchema, CircuitPackSchema, KarnaughPackSchema } from "../shared/boole/schema.ts";
import { booleVector, vectorFromLists } from "../shared/boole/canonical.ts";
import { circuitTruthTable, circuitToExpression, evaluateCircuit } from "../shared/boole/circuit.ts";
import { evalBoole } from "../shared/boole/expr.ts";
import { booleVars, literalCount, parseBoole } from "../shared/boole/expr.ts";
import { minimizeBoole } from "../shared/boole/minimize.ts";
import { CourseSchema } from "../shared/courses/types.ts";
import { NotationSchema } from "../shared/logic/notation.ts";
import { SymbolPackSchema } from "../shared/symbols/schema.ts";
import { PredicatesPackSchema } from "../shared/predicates/schema.ts";

const issues = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`);

describe("content/symbols", () => {
  for (const pack of SYMBOL_PACKS) {
    it(`${pack.file} cumple SymbolPackSchema`, () => {
      expect(issues(SymbolPackSchema.safeParse(pack))).toEqual([]);
    });
  }

  const all = SYMBOL_PACKS.flatMap((p) => p.entries);

  it("los ids son únicos en todo el diccionario", () => {
    const seen = new Set<string>();
    const dup = all.filter((s) => (seen.has(s.id) ? true : (seen.add(s.id), false))).map((s) => s.id);
    expect(dup).toEqual([]);
  });

  it("cada «related» apunta a un símbolo que existe", () => {
    const ids = new Set(all.map((s) => s.id));
    const broken = all.flatMap((s) => (s.related ?? []).filter((r) => !ids.has(r)).map((r) => `${s.id} → ${r}`));
    expect(broken).toEqual([]);
  });
});

describe("content/courses", () => {
  for (const course of COURSES) {
    it(`${course.id} cumple CourseSchema (pesos que suman 100 %, un examen, fuente por peso)`, () => {
      expect(issues(CourseSchema.safeParse(course))).toEqual([]);
    });
  }

  it("los ids de asignatura son únicos", () => {
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });

  it("el esquema rechaza pesos que no suman 100 %", () => {
    const bad = { ...COURSES[0]!, components: COURSES[0]!.components.map((c, i) => (i === 0 ? { ...c, weightPct: c.weightPct + 1 } : c)) };
    expect(CourseSchema.safeParse(bad).success).toBe(false);
  });

  it("el esquema exige la fuente de cada peso", () => {
    const { source: _drop, ...noSource } = COURSES[0]!.components[0]!;
    const bad = { ...COURSES[0]!, components: [noSource, ...COURSES[0]!.components.slice(1)] };
    expect(CourseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("content/notation", () => {
  it("la notación activa cumple NotationSchema", () => {
    expect(issues(NotationSchema.safeParse(NOTATION))).toEqual([]);
  });

  it("F₁ debe tener los cuatro pares distintos", () => {
    const bad = { ...NOTATION, f1: NOTATION.f1.map((e) => ({ ...e, values: [0, 0] as const })) };
    expect(NotationSchema.safeParse(bad).success).toBe(false);
  });
});

describe("content/boole", () => {
  it("practica.ts cumple BoolePackSchema", () => {
    expect(issues(BoolePackSchema.safeParse(BOOLE_PACK))).toEqual([]);
  });

  it("es de elaboración propia y con licencia CC BY 4.0", () => {
    expect(BOOLE_PACK.meta.source).toBe("Elaboración propia");
    expect(BOOLE_PACK.meta.license).toBe("CC-BY-4.0");
  });

  it("cada expresión se lee en modo Boole, tiene como mucho 4 variables y se puede simplificar", () => {
    for (const p of BOOLE_PACK.practice) {
      const r = parseBoole(p.expr);
      expect(r.ok, p.id).toBe(true);
      if (!r.ok) continue;
      expect(booleVars(r.expr).length, p.id).toBeLessThanOrEqual(4);
      const m = minimizeBoole(r.expr);
      expect(m.ok && literalCount(r.expr) > m.minLiterals, p.id).toBe(true);
    }
  });

  it("el esquema rechaza una estructura sin descripción", () => {
    const bad = { ...BOOLE_PACK, presets: { ...BOOLE_PACK.presets, dos: { name: "{0, 1}", description: "" } } };
    expect(BoolePackSchema.safeParse(bad).success).toBe(false);
  });
});

describe("content/boole/circuitos", () => {
  it("circuitos.ts cumple CircuitPackSchema (sin ciclos, todo definido, una salida, entre 2 y 6 puertas)", () => {
    expect(issues(CircuitPackSchema.safeParse(CIRCUIT_PACK))).toEqual([]);
    expect(CIRCUIT_PACK.circuits.length).toBeGreaterThanOrEqual(8);
  });

  it("es de elaboración propia y con licencia CC BY 4.0", () => {
    expect(CIRCUIT_PACK.meta.source).toBe("Elaboración propia");
    expect(CIRCUIT_PACK.meta.license).toBe("CC-BY-4.0");
  });

  for (const c of CIRCUIT_PACK.circuits) {
    it(`${c.id}: «table» coincide con la evaluación del circuito y con su expresión`, () => {
      const n = c.inputs.length;
      const fromCircuit = circuitTruthTable(c).map((b) => (b ? "1" : "0")).join("");
      const e = circuitToExpression(c);
      const fromExpr = Array.from({ length: 1 << n }, (_, m) => {
        const env = Object.fromEntries(c.inputs.map((x, i) => [x, ((m >> (n - 1 - i)) & 1) === 1]));
        expect(evaluateCircuit(c, env).output).toBe(evalBoole(e, env));
        return evalBoole(e, env) ? "1" : "0";
      }).join("");
      expect(fromCircuit).toBe(c.table);
      expect(fromExpr).toBe(c.table);
    });
  }

  it("el esquema rechaza un circuito con un ciclo, una entrada sin definir o una tabla mal medida", () => {
    const base = CIRCUIT_PACK.circuits[0]!;
    const cyclic = { ...base, gates: base.gates.map((g, i) => (i === 0 ? { ...g, inputs: [base.output] } : g)) };
    expect(CircuitPackSchema.safeParse({ ...CIRCUIT_PACK, circuits: [cyclic, ...CIRCUIT_PACK.circuits.slice(1)] }).success).toBe(false);
    const undef = { ...base, gates: base.gates.map((g, i) => (i === 0 ? { ...g, inputs: ["q"] } : g)) };
    expect(CircuitPackSchema.safeParse({ ...CIRCUIT_PACK, circuits: [undef, ...CIRCUIT_PACK.circuits.slice(1)] }).success).toBe(false);
    const short = { ...base, table: "01" };
    expect(CircuitPackSchema.safeParse({ ...CIRCUIT_PACK, circuits: [short, ...CIRCUIT_PACK.circuits.slice(1)] }).success).toBe(false);
  });
});

describe("content/boole/karnaugh", () => {
  it("karnaugh.ts cumple KarnaughPackSchema", () => {
    expect(issues(KarnaughPackSchema.safeParse(KARNAUGH_PACK))).toEqual([]);
  });

  it("es de elaboración propia y con licencia CC BY 4.0", () => {
    expect(KARNAUGH_PACK.meta.source).toBe("Elaboración propia");
    expect(KARNAUGH_PACK.meta.license).toBe("CC-BY-4.0");
  });

  it("cada ejercicio tiene de 2 a 4 variables y no es constante; hay de 2, 3 y 4 variables y alguno con X", () => {
    const sizes = new Set<number>();
    for (const e of KARNAUGH_PACK.exercises) {
      let vector: string;
      if ("expr" in e) {
        const r = parseBoole(e.expr);
        expect(r.ok, e.id).toBe(true);
        if (!r.ok) continue;
        const vars = booleVars(r.expr);
        expect(vars.length, e.id).toBeGreaterThanOrEqual(2);
        expect(vars.length, e.id).toBeLessThanOrEqual(4);
        vector = booleVector(r.expr, vars);
        sizes.add(vars.length);
      } else {
        vector = vectorFromLists(e.vars.length, e.ones, e.dontCares);
        sizes.add(e.vars.length);
      }
      expect(vector, e.id).toContain("1");
      expect(vector, e.id).toContain("0");
    }
    expect([...sizes].sort()).toEqual([2, 3, 4]);
    expect(KARNAUGH_PACK.exercises.some((e) => "dontCares" in e && e.dontCares.length > 0)).toBe(true);
  });

  it("el esquema rechaza índices fuera de rango o repetidos entre Σm y d", () => {
    const base = { id: "malo", level: "básico" as const, vars: ["x", "y"], ones: [1], dontCares: [] as number[] };
    const bad = (e: object) => KarnaughPackSchema.safeParse({ ...KARNAUGH_PACK, exercises: [e, ...KARNAUGH_PACK.exercises] }).success;
    expect(bad(base)).toBe(true);
    expect(bad({ ...base, ones: [4] })).toBe(false);
    expect(bad({ ...base, dontCares: [1] })).toBe(false);
    expect(bad({ ...base, ones: [0, 1, 2, 3] })).toBe(false);
  });
});

describe("content/predicados", () => {
  it("practica.ts cumple PredicatesPackSchema (fórmulas cerradas, predicados definidos, tuplas del dominio)", () => {
    expect(issues(PredicatesPackSchema.safeParse(PREDICADOS_PACK))).toEqual([]);
  });

  it("es de elaboración propia y con licencia CC BY 4.0", () => {
    expect(PREDICADOS_PACK.meta.source).toBe("Elaboración propia");
    expect(PREDICADOS_PACK.meta.license).toBe("CC-BY-4.0");
  });

  it("el esquema rechaza una fórmula con variables libres o un predicado sin definir", () => {
    const d = PREDICADOS_PACK.domains[0]!;
    const free = { ...d, formulas: [...d.formulas, "P(x)"] };
    expect(PredicatesPackSchema.safeParse({ ...PREDICADOS_PACK, domains: [free, ...PREDICADOS_PACK.domains.slice(1)] }).success).toBe(false);
    const undef = { ...d, formulas: [...d.formulas, "∀x Z(x)"] };
    expect(PredicatesPackSchema.safeParse({ ...PREDICADOS_PACK, domains: [undef, ...PREDICADOS_PACK.domains.slice(1)] }).success).toBe(false);
    const t = PREDICADOS_PACK.translation[0]!;
    const badAnswer = { ...t, answer: "∀x (P(x) → M(x, x))" };
    expect(PredicatesPackSchema.safeParse({ ...PREDICADOS_PACK, translation: [badAnswer, ...PREDICADOS_PACK.translation.slice(1)] }).success).toBe(false);
  });

  it("el esquema rechaza una tupla con elementos fuera del dominio", () => {
    const d = PREDICADOS_PACK.domains[0]!;
    const bad = { ...d, predicates: d.predicates.map((p, i) => (i === 0 ? { ...p, extension: [["9"]] } : p)) };
    expect(PredicatesPackSchema.safeParse({ ...PREDICADOS_PACK, domains: [bad, ...PREDICADOS_PACK.domains.slice(1)] }).success).toBe(false);
  });
});
