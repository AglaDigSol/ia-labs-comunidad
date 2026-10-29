// Esquema del contenido del laboratorio de conjuntos (content/conjuntos/). Se valida en
// tests/content.test.ts: además de la forma, cada expresión se tiene que poder leer, los conjuntos con
// elementos tienen que caber en su universo y cada problema de cardinales tiene que fijar una única
// solución con números naturales.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { solveRegions } from "./cardinal.ts";
import { parseSetExpr, SET_NAMES, setVars, type SetName } from "./expr.ts";
import { parseElementList } from "./finite.ts";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Level = z.enum(["básico", "medio", "avanzado"]);
/** Expresión con la notación de clase (∪, ∩, ∖, Δ, ᶜ, ∅, U) sobre A, B y C. */
const Expr = z.string().trim().min(1).max(120);

export const SetsVennItemSchema = z.strictObject({ id: Id, expr: Expr, level: Level });

export const SetsElementsItemSchema = z.strictObject({
  id: Id,
  title: z.string().trim().min(1).max(80),
  /** Elementos separados por comas. */
  universe: z.string().trim().min(1).max(120),
  sets: z.strictObject({ A: z.string().max(120), B: z.string().max(120), C: z.string().max(120).optional() }),
  /** Expresiones que se proponen con estos datos. */
  exprs: z.array(Expr).min(1).max(12),
});

export const SetsIdentitySchema = z.strictObject({ id: Id, left: Expr, right: Expr, level: Level });

export const SetsCardinalSchema = z.strictObject({
  id: Id,
  title: z.string().trim().min(1).max(80),
  /** Enunciado (de elaboración propia). */
  story: z.string().trim().min(1).max(600),
  /** Qué representa cada conjunto: «estudian inglés». Con C, el problema es de tres conjuntos. */
  sets: z.strictObject({
    A: z.string().trim().min(1).max(60),
    B: z.string().trim().min(1).max(60),
    C: z.string().trim().min(1).max(60).optional(),
  }),
  /** Datos: el cardinal de cada expresión (incluido el universal U). */
  data: z.array(z.strictObject({ expr: Expr, value: z.number().int().min(0).max(100000) })).min(3).max(10),
  /** Preguntas: se contestan con el cardinal de la expresión. */
  questions: z.array(z.strictObject({ id: Id, prompt: z.string().trim().min(1).max(160), expr: Expr })).min(1).max(6),
});

export const SetsPackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    venn: z.array(SetsVennItemSchema).min(6).max(40),
    elements: z.array(SetsElementsItemSchema).min(1).max(10),
    identities: z.array(SetsIdentitySchema).min(6).max(40),
    cardinal: z.array(SetsCardinalSchema).min(3).max(20),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const parse = (where: string, text: string) => {
      const r = parseSetExpr(text);
      if (!r.ok) issue(`${where}: «${text}» no se lee (${r.error.message}).`);
      return r.ok ? r.expr : null;
    };
    for (const list of [p.venn, p.elements, p.identities, p.cardinal]) {
      const ids = list.map((x) => x.id);
      if (new Set(ids).size !== ids.length) issue("Los ids de cada lista deben ser únicos.");
    }
    for (const v of p.venn) parse(`venn.${v.id}`, v.expr);
    for (const i of p.identities) {
      parse(`identities.${i.id}`, i.left);
      parse(`identities.${i.id}`, i.right);
    }
    for (const el of p.elements) {
      const u = parseElementList(el.universe);
      if (!u.ok || u.value.repeated.length > 0) {
        issue(`elements.${el.id}: el universo no es una lista de elementos distintos.`);
        continue;
      }
      for (const name of SET_NAMES) {
        const raw = el.sets[name];
        if (raw === undefined) continue;
        const s = parseElementList(raw);
        if (!s.ok || s.value.elements.some((x) => !u.value.elements.includes(x))) {
          issue(`elements.${el.id}: ${name} debe ser un subconjunto del universo.`);
        }
      }
      for (const e of el.exprs) {
        const x = parse(`elements.${el.id}`, e);
        if (x && el.sets.C === undefined && setVars(x).includes("C")) issue(`elements.${el.id}: «${e}» usa C, que no está definido.`);
      }
    }
    for (const c of p.cardinal) {
      const vars: SetName[] = c.sets.C === undefined ? ["A", "B"] : ["A", "B", "C"];
      const data = c.data.map((d) => ({ expr: parse(`cardinal.${c.id}`, d.expr), value: d.value }));
      const questions = c.questions.map((q) => parse(`cardinal.${c.id}.${q.id}`, q.expr));
      const all = [...data.map((d) => d.expr), ...questions];
      if (all.some((x) => x === null)) continue;
      if (all.some((x) => setVars(x!).some((n) => !vars.includes(n)))) {
        issue(`cardinal.${c.id}: usa un conjunto que no está en «sets».`);
        continue;
      }
      const sol = solveRegions(vars, data.map((d) => ({ expr: d.expr!, value: d.value })));
      if (!sol.ok) issue(`cardinal.${c.id}: los datos no fijan una única solución natural (${sol.reason}).`);
    }
  });

export type SetsPack = z.infer<typeof SetsPackSchema>;
export type SetsCardinalProblem = z.infer<typeof SetsCardinalSchema>;
export type SetsElementsItem = z.infer<typeof SetsElementsItemSchema>;
