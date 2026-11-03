// Esquema del contenido del laboratorio de cálculo (content/calculo/). Se valida en
// tests/content-calculo.test.ts: además de la forma, cada función se tiene que poder leer con el
// analizador (con x, o con x e y donde toca), los intervalos tienen que estar bien ordenados y los
// polinomios de puntos críticos tienen que tener sus puntos críticos racionales.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { criticalPoints } from "./critical.ts";
import type { VarName } from "./expr.ts";
import { parseExpr } from "./parser.ts";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Level = z.enum(["básico", "medio", "avanzado"]);
const Title = z.string().trim().min(1).max(80);
const Num = z.number().finite().min(-50).max(50);

/** Una función como se escribe en el laboratorio («x^2 sen x»), que el analizador lee. */
const fnText = (vars: readonly VarName[]) =>
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .superRefine((s, ctx) => {
      const r = parseExpr(s, { vars });
      if (!r.ok) ctx.addIssue({ code: "custom", message: `no se lee: ${r.error.message}` });
    });
const Fx = fnText(["x"]);
const Fxy = fnText(["x", "y"]);
const Range = z.tuple([Num, Num]).refine(([a, b]) => a < b, { message: "el intervalo tiene que ir de menor a mayor" });

export const CalcDerivativeSchema = z.strictObject({ id: Id, level: Level, f: Fx });
export const CalcTangentSchema = z.strictObject({ id: Id, level: Level, f: Fx, x0: Num, range: Range });
export const CalcIntegralSchema = z.strictObject({ id: Id, level: Level, f: Fx, a: Num, b: Num }).refine((x) => x.a < x.b, { message: "a tiene que ser menor que b" });
export const CalcMultiSchema = z.strictObject({ id: Id, level: Level, f: Fxy, point: z.tuple([Num, Num]), x: Range, y: Range });
export const CalcCriticalSchema = z
  .strictObject({ id: Id, level: Level, f: Fxy, x: Range, y: Range })
  .superRefine((c, ctx) => {
    const r = parseExpr(c.f, { vars: ["x", "y"] });
    if (r.ok && !criticalPoints(r.expr).ok) ctx.addIssue({ code: "custom", message: "sus puntos críticos no son todos racionales (o no es un polinomio)" });
  });
export const CalcDescent1Schema = z.strictObject({ id: Id, title: Title, f: Fx, range: Range, start: Num, alpha: z.number().positive().max(10), iterations: z.number().int().min(1).max(500) });
export const CalcDescent2Schema = z.strictObject({
  id: Id,
  title: Title,
  f: Fxy,
  x: Range,
  y: Range,
  start: z.tuple([Num, Num]),
  alpha: z.number().positive().max(10),
  iterations: z.number().int().min(1).max(500),
});

export const CalcPackSchema = z.strictObject({
  meta: ContentMetaSchema,
  derivatives: z.array(CalcDerivativeSchema).min(3),
  tangents: z.array(CalcTangentSchema).min(2),
  antiderivatives: z.array(CalcDerivativeSchema).min(3),
  definite: z.array(CalcIntegralSchema).min(2),
  multivariable: z.array(CalcMultiSchema).min(2),
  critical: z.array(CalcCriticalSchema).min(2),
  descent1: z.array(CalcDescent1Schema).min(2),
  descent2: z.array(CalcDescent2Schema).min(3),
});

export type CalcPack = z.infer<typeof CalcPackSchema>;
export type CalcDescent1 = z.infer<typeof CalcDescent1Schema>;
export type CalcDescent2 = z.infer<typeof CalcDescent2Schema>;
