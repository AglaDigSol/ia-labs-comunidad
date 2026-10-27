// Esquema del contenido del laboratorio de álgebra de Boole (content/boole/). Se valida en
// tests/content.test.ts.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
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
