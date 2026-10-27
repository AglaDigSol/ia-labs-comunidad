// Valida todo el contenido de content/ con sus esquemas zod. Si añades un símbolo, una asignatura o
// una notación y este test falla, el mensaje dice qué campo hay que corregir.
import { describe, expect, it } from "vitest";
import { COURSES } from "../content/courses/index.ts";
import { NOTATION } from "../content/notation/index.ts";
import { SYMBOL_PACKS } from "../content/symbols/index.ts";
import { BOOLE_PACK } from "../content/boole/practica.ts";
import { CIRCUIT_PACK } from "../content/boole/circuitos.ts";
import { BoolePackSchema, CircuitPackSchema } from "../shared/boole/schema.ts";
import { circuitTruthTable, circuitToExpression, evaluateCircuit } from "../shared/boole/circuit.ts";
import { evalBoole } from "../shared/boole/expr.ts";
import { booleVars, literalCount, parseBoole } from "../shared/boole/expr.ts";
import { minimizeBoole } from "../shared/boole/minimize.ts";
import { CourseSchema } from "../shared/courses/types.ts";
import { NotationSchema } from "../shared/logic/notation.ts";
import { SymbolPackSchema } from "../shared/symbols/schema.ts";

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
