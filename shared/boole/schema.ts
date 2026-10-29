// Esquema del contenido del laboratorio de álgebra de Boole (content/boole/). Se valida en
// tests/content.test.ts.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { MAX_GATE_INPUTS, validateNetlist } from "./circuit.ts";
import { PRESET_IDS } from "./presets.ts";

export const BoolePracticeSchema = z.strictObject({
  /** Identificador estable, en minúsculas con guiones. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Expresión con la notación de clase (⊕, ⊙, ′, 0, 1). Hasta 4 variables. */
  expr: z.string().trim().min(1).max(120),
  level: z.enum(["básico", "medio", "avanzado"]),
});

export const BoolePresetTextSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(400),
});

export const BoolePackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    practice: z.array(BoolePracticeSchema).min(8).max(40),
    presets: z.strictObject(Object.fromEntries(PRESET_IDS.map((id) => [id, BoolePresetTextSchema])) as Record<
      (typeof PRESET_IDS)[number],
      typeof BoolePresetTextSchema
    >),
    product: z.string().trim().min(1).max(400),
    custom: z.string().trim().min(1).max(400),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.practice.map((e) => e.id));
    if (ids.size !== p.practice.length) ctx.addIssue({ code: "custom", message: "Los ids de las expresiones deben ser únicos." });
  });

export type BoolePack = z.infer<typeof BoolePackSchema>;
export type BoolePractice = z.infer<typeof BoolePracticeSchema>;

// ---------------------------------------------------------------- Circuitos (content/boole/circuitos.ts)

export const CircuitGateSchema = z.strictObject({
  /** g1, g2… */
  id: z.string().regex(/^g[1-9]\d?$/),
  type: z.enum(["or", "and", "xor", "not", "nor", "nand", "xnor"]),
  /** Entradas del circuito (x, y…), otras puertas (g1…) o las constantes 0 y 1. */
  inputs: z.array(z.string().min(1).max(8)).min(1).max(MAX_GATE_INPUTS),
});

export const CircuitSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(60),
    level: z.enum(["básico", "medio", "avanzado"]),
    /** Variables de entrada, de una letra minúscula. */
    inputs: z.array(z.string().regex(/^[a-z]$/)).min(2).max(4),
    gates: z.array(CircuitGateSchema).min(2).max(6),
    /** Puerta cuya salida es f. */
    output: z.string().regex(/^g[1-9]\d?$/),
    /** Columna f de la tabla de verdad (filas 0…0 a 1…1, la primera entrada como bit alto). */
    table: z.string().regex(/^[01]+$/),
  })
  .superRefine((c, ctx) => {
    const issue = validateNetlist(c);
    if (issue) ctx.addIssue({ code: "custom", message: issue.message });
    if (c.table.length !== 1 << c.inputs.length) {
      ctx.addIssue({ code: "custom", path: ["table"], message: `La tabla debe tener ${1 << c.inputs.length} filas.` });
    }
    const unused = c.inputs.filter((x) => !c.gates.some((g) => g.inputs.includes(x)));
    if (unused.length > 0) ctx.addIssue({ code: "custom", path: ["inputs"], message: `Entradas sin usar: ${unused.join(", ")}.` });
  });

export const CircuitPackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    circuits: z.array(CircuitSchema).min(6).max(24),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.circuits.map((c) => c.id));
    if (ids.size !== p.circuits.length) ctx.addIssue({ code: "custom", message: "Los ids de los circuitos deben ser únicos." });
  });

export type CircuitPack = z.infer<typeof CircuitPackSchema>;
export type CircuitContent = z.infer<typeof CircuitSchema>;

// ---------------------------------------------------------------- Karnaugh (content/boole/karnaugh.ts)

const KarnaughIndexSchema = z.number().int().min(0).max(15);
const KarnaughId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const KarnaughLevel = z.enum(["básico", "medio", "avanzado"]);

/** Ejercicio dado por una expresión (de 2 a 4 variables) o por sus listas Σm(…) y d(…). */
export const KarnaughExerciseSchema = z.union([
  z.strictObject({
    id: KarnaughId,
    level: KarnaughLevel,
    /** Expresión con la notación de clase (⊕, ⊙, ′, 0, 1). */
    expr: z.string().trim().min(1).max(120),
  }),
  z
    .strictObject({
      id: KarnaughId,
      level: KarnaughLevel,
      /** Variables, de una letra minúscula; la primera es el bit alto de los índices. */
      vars: z.array(z.string().regex(/^[a-z]$/)).min(2).max(4),
      /** Índices de los 1 (Σm) y de las indiferencias (d). */
      ones: z.array(KarnaughIndexSchema).min(1).max(15),
      dontCares: z.array(KarnaughIndexSchema).max(8),
    })
    .superRefine((e, ctx) => {
      const size = 1 << e.vars.length;
      if (new Set(e.vars).size !== e.vars.length) ctx.addIssue({ code: "custom", path: ["vars"], message: "Variables repetidas." });
      const all = [...e.ones, ...e.dontCares];
      if (all.some((m) => m >= size)) ctx.addIssue({ code: "custom", message: `Los índices van de 0 a ${size - 1}.` });
      if (new Set(all).size !== all.length) ctx.addIssue({ code: "custom", message: "Un índice aparece dos veces (o en Σm y en d a la vez)." });
      if (all.length === size) ctx.addIssue({ code: "custom", message: "La función no tiene ningún 0." });
    }),
]);

export const KarnaughPackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    exercises: z.array(KarnaughExerciseSchema).min(8).max(40),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.exercises.map((e) => e.id));
    if (ids.size !== p.exercises.length) ctx.addIssue({ code: "custom", message: "Los ids de los ejercicios deben ser únicos." });
  });

export type KarnaughPack = z.infer<typeof KarnaughPackSchema>;
export type KarnaughExercise = z.infer<typeof KarnaughExerciseSchema>;
