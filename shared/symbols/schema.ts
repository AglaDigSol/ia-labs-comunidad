// Esquema zod del diccionario de símbolos: lo usa tests/content.test.ts para validar el contenido.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { SYMBOL_CATEGORIES } from "./types.ts";

const nonEmpty = z.string().trim().min(1);

export const NotationVariantSchema = z
  .strictObject({
    tex: nonEmpty.optional(),
    text: nonEmpty.optional(),
    convention: nonEmpty.max(60),
  })
  .refine((v) => v.tex !== undefined || v.text !== undefined, "Una variante necesita tex o text.");

export const CodeEquivalentSchema = z.strictObject({
  lib: z.enum(["python", "numpy", "pytorch"]),
  code: nonEmpty.max(2000),
  note: nonEmpty.max(300).optional(),
});

/** La lectura en voz alta usa palabras, nunca símbolos matemáticos ni LaTeX. */
const spokenText = nonEmpty
  .max(400)
  .refine((s) => !/[\\$^_{}∀∃∈∉⊂⊆∪∩¬∧∨→↔⊕⊻]/.test(s), "«spoken» debe estar escrito con palabras, sin símbolos.");

export const SymbolEntrySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id en minúsculas-con-guiones"),
  category: z.enum(SYMBOL_CATEGORIES as [string, ...string[]]),
  session: z.union([z.literal(1), z.literal(2), z.literal("posterior")]),
  name: nonEmpty.max(80),
  aliases: z.array(nonEmpty.max(60)),
  tex: nonEmpty.max(300),
  variants: z.array(NotationVariantSchema),
  reading: nonEmpty.max(300),
  altReadings: z.array(nonEmpty.max(300)).optional(),
  spoken: spokenText,
  example: z
    .strictObject({ tex: nonEmpty.max(300), reading: nonEmpty.max(400), spoken: spokenText })
    .optional(),
  code: z.array(CodeEquivalentSchema),
  codeNote: nonEmpty.max(300).optional(),
  related: z.array(z.string()).optional(),
});

export const SymbolPackSchema = z.strictObject({
  file: z.string().regex(/^[a-z0-9-]+\.ts$/),
  meta: ContentMetaSchema,
  entries: z.array(SymbolEntrySchema).min(1),
});
