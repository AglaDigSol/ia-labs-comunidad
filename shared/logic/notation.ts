// Convenciones de notación de una asignatura (valores de verdad, ⊕, espacio F₁). Los datos viven en
// content/notation/ y se validan con NotationSchema (tests/content.test.ts).
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";

const bit = z.union([z.literal(0), z.literal(1)]);

export const NotationSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    /** Formato por defecto de las tablas de verdad: "10" (1/0) o "VF" (V/F). */
    truthValues: z.enum(["10", "VF"]),
    /** El analizador siempre lee ⊕ como disyunción exclusiva (⊻). Estos textos explican el matiz. */
    oplus: z.strictObject({
      note: z.string().min(1).max(300),
      actionLabel: z.string().min(1).max(60),
      /** Operador por el que se sustituye ⊕ al pulsar la acción («interpretar como suma»). */
      replaceWith: z.enum(["∨", "+"]),
    }),
    /** F₁: las cuatro funciones booleanas de una variable, con su nombre y sus valores (x(0), x(1)). */
    f1: z
      .array(z.strictObject({ name: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,3}$/), values: z.tuple([bit, bit]) }))
      .length(4),
  })
  .superRefine((n, ctx) => {
    const names = new Set(n.f1.map((e) => e.name));
    const pairs = new Set(n.f1.map((e) => e.values.join("")));
    if (names.size !== 4) ctx.addIssue({ code: "custom", message: "F₁: los nombres deben ser distintos." });
    if (pairs.size !== 4) ctx.addIssue({ code: "custom", message: "F₁: deben aparecer los cuatro pares (0,0), (0,1), (1,0), (1,1)." });
  });

export type Notation = z.infer<typeof NotationSchema>;
