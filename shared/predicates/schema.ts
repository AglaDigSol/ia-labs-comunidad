// Esquema del contenido del laboratorio de predicados (content/predicados/). Se valida en
// tests/content.test.ts: cada fórmula se lee, es un enunciado (sin variables libres) y usa solo los
// predicados definidos, con su número de argumentos.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { analyzeVariables, predicateSignature } from "./ast.ts";
import { DOMAIN_ELEMENT_RE } from "./evaluate.ts";
import { parsePredicate } from "./parser.ts";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const level = z.enum(["básico", "medio", "avanzado"]);

export const PredicateDefSchema = z.strictObject({
  /** Una letra mayúscula: P, Q, M… */
  name: z.string().regex(/^[A-Z]$/),
  /** 1 (propiedad) o 2 (relación). */
  arity: z.union([z.literal(1), z.literal(2)]),
  /** Significado con las variables de la definición: «x es par», «x es menor que y». */
  meaning: z.string().trim().min(1).max(80),
});

export const DomainPresetSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(300),
  /** Entre 1 y 5 elementos (numerales o letras a–t). */
  domain: z.array(z.string().regex(DOMAIN_ELEMENT_RE)).min(1).max(5),
  predicates: z.array(PredicateDefSchema.extend({ extension: z.array(z.array(z.string())) })).min(1).max(4),
  /** Fórmulas de ejemplo para evaluar en este dominio. */
  formulas: z.array(z.string().trim().min(1).max(120)).min(2).max(10),
});

export const NegationExerciseSchema = z.strictObject({
  id,
  /** Fórmula que hay que negar (la práctica parte de ¬(fórmula)). */
  formula: z.string().trim().min(1).max(120),
  level,
});

export const TranslationExerciseSchema = z.strictObject({
  id,
  sentence: z.string().trim().min(1).max(160),
  glossary: z.array(PredicateDefSchema).min(1).max(4),
  /** Traducción de referencia (solo se enseña detrás de «Ver la solución completa»). */
  answer: z.string().trim().min(1).max(120),
  /** Pista sobre el patrón, nunca la fórmula. */
  hint: z.string().trim().min(1).max(200),
  level,
});

type Ctx = z.RefinementCtx;

/** La fórmula se lee, es cerrada y sus predicados (y aridades) están en `defs`. */
function checkFormula(text: string, defs: Array<{ name: string; arity: number }>, constants: readonly string[] | null, path: string, ctx: Ctx) {
  const r = parsePredicate(text);
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: `${path}: no se puede leer «${text}» (${r.error.message})` });
    return;
  }
  const a = analyzeVariables(r.formula);
  if (a.free.length > 0) ctx.addIssue({ code: "custom", message: `${path}: «${text}» tiene variables libres (${a.free.join(", ")}).` });
  if (constants !== null) {
    const bad = a.constants.filter((c) => !constants.includes(c));
    if (bad.length > 0) ctx.addIssue({ code: "custom", message: `${path}: constantes fuera del dominio (${bad.join(", ")}).` });
  }
  const sig = predicateSignature(r.formula);
  if (!sig.ok) {
    ctx.addIssue({ code: "custom", message: `${path}: ${sig.name} aparece con aridades distintas.` });
    return;
  }
  for (const p of sig.predicates) {
    const d = defs.find((x) => x.name === p.name);
    if (!d || d.arity !== p.arity) ctx.addIssue({ code: "custom", message: `${path}: ${p.name}/${p.arity} no está definido.` });
  }
}

export const PredicatesPackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    domains: z.array(DomainPresetSchema).min(2).max(10),
    negation: z.array(NegationExerciseSchema).min(5).max(30),
    translation: z.array(TranslationExerciseSchema).min(4).max(30),
  })
  .superRefine((pack, ctx) => {
    for (const list of [pack.domains, pack.negation, pack.translation] as Array<Array<{ id: string }>>) {
      if (new Set(list.map((e) => e.id)).size !== list.length) ctx.addIssue({ code: "custom", message: "Hay ids repetidos." });
    }
    pack.domains.forEach((d, i) => {
      if (new Set(d.domain).size !== d.domain.length) ctx.addIssue({ code: "custom", message: `domains.${i}: elementos repetidos.` });
      for (const p of d.predicates) {
        for (const t of p.extension) {
          if (t.length !== p.arity || t.some((e) => !d.domain.includes(e))) {
            ctx.addIssue({ code: "custom", message: `domains.${i}: la tupla (${t.join(", ")}) de ${p.name} no encaja con el dominio.` });
          }
        }
      }
      d.formulas.forEach((f, j) => checkFormula(f, d.predicates, d.domain, `domains.${i}.formulas.${j}`, ctx));
    });
    pack.negation.forEach((n, i) => {
      const r = parsePredicate(n.formula);
      if (!r.ok) ctx.addIssue({ code: "custom", message: `negation.${i}: no se puede leer «${n.formula}».` });
      else if (analyzeVariables(r.formula).free.length > 0) ctx.addIssue({ code: "custom", message: `negation.${i}: tiene variables libres.` });
    });
    pack.translation.forEach((t, i) => checkFormula(t.answer, t.glossary, [], `translation.${i}.answer`, ctx));
  });

export type PredicatesPack = z.infer<typeof PredicatesPackSchema>;
export type DomainPreset = z.infer<typeof DomainPresetSchema>;
export type NegationExercise = z.infer<typeof NegationExerciseSchema>;
export type TranslationExercise = z.infer<typeof TranslationExerciseSchema>;
