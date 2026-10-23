// Valida todo el contenido de content/ con sus esquemas zod. Si añades un símbolo, una asignatura o
// una notación y este test falla, el mensaje dice qué campo hay que corregir.
import { describe, expect, it } from "vitest";
import { COURSES } from "../content/courses/index.ts";
import { NOTATION } from "../content/notation/index.ts";
import { SYMBOL_PACKS } from "../content/symbols/index.ts";
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
