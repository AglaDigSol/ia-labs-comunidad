// Esquema del contenido del laboratorio de combinatoria (content/combinatoria/). Se valida en
// tests/content-combinatoria.test.ts: además de la forma, cada modelo de recuento tiene que tener
// sentido (grupos que suman n, k ≤ n sin repetición…), cada planteamiento de funciones tiene que ser
// posible y sus afirmaciones, de su tipo; los fragmentos de pseudocódigo solo pueden usar variables de
// bucles que los contienen y cada coste se tiene que poder leer.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import type { AlgoStmt } from "./algorithms.ts";
import { parseCost } from "./bigo.ts";
import { MAX_COUNT_N, modelProblem } from "./count.ts";
import { FN_MODES, FN_PROPS, MAX_FN_CARD, settingProblem } from "./functions.ts";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Level = z.enum(["básico", "medio", "avanzado"]);
const Title = z.string().trim().min(1).max(80);
const Nat = (max: number) => z.number().int().min(0).max(max);

export const CountingModelSchema = z
  .strictObject({
    n: Nat(MAX_COUNT_N),
    k: Nat(MAX_COUNT_N),
    order: z.boolean(),
    repetition: z.boolean(),
    groups: z.array(Nat(MAX_COUNT_N)).min(2).max(10).optional(),
  })
  .superRefine((m, ctx) => {
    const p = modelProblem(m);
    if (p) ctx.addIssue({ code: "custom", message: p });
  });

export const CombProblemSchema = z.strictObject({
  id: Id,
  level: Level,
  title: Title,
  story: z.string().trim().min(20).max(400),
  model: CountingModelSchema,
});

const FnProp = z.enum(FN_PROPS);
export const FnStatementSchema = z.discriminatedUnion("k", [
  z.strictObject({ k: z.literal("modal"), mode: z.enum(FN_MODES), prop: FnProp }),
  z.strictObject({ k: z.literal("fixed"), prop: FnProp }),
  z.strictObject({ k: z.literal("onto-image"), prop: FnProp }),
  z.strictObject({ k: z.literal("count"), what: z.enum(["todas", "inyectivas", "biyectivas"]), value: z.number().int().min(0).max(1e12) }),
]);

export const FnPresetSchema = z
  .strictObject({
    id: Id,
    level: Level,
    a: Nat(MAX_FN_CARD),
    b: Nat(MAX_FN_CARD),
    image: Nat(MAX_FN_CARD).optional(),
    subset: z.boolean().optional(),
    statements: z.array(FnStatementSchema).min(3).max(8),
  })
  .superRefine((p, ctx) => {
    const problem = settingProblem(p);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
    for (const s of p.statements) {
      if ((s.k === "fixed" || s.k === "onto-image") && p.image === undefined) ctx.addIssue({ code: "custom", message: "una afirmación sobre f(A) necesita |f(A)|" });
    }
  });

const SizeVar = z.enum(["n", "m"]);
const LoopVar = z.enum(["i", "j", "l", "p"]);
const Bound = z.union([SizeVar, LoopVar]);

export const AlgoStmtSchema: z.ZodType<AlgoStmt> = z.lazy(() =>
  z.discriminatedUnion("k", [
    z.strictObject({ k: z.literal("for"), v: LoopVar, to: Bound, body: z.array(AlgoStmtSchema).min(1).max(4) }),
    z.strictObject({ k: z.literal("forEach"), v: z.enum(["a", "b"]), set: z.enum(["A", "B"]), body: z.array(AlgoStmtSchema).min(1).max(4) }),
    z.strictObject({ k: z.literal("halve"), v: LoopVar, from: Bound, body: z.array(AlgoStmtSchema).min(1).max(4) }),
    z.strictObject({ k: z.literal("call"), arg: Bound }),
    z.strictObject({ k: z.literal("op"), text: z.string().trim().min(1).max(40) }),
  ]),
);

/** Variables usadas fuera del bucle que las define (o conjuntos sin tamaño). */
function scopeProblems(stmts: AlgoStmt[], scope: Set<string>, sets: Set<string>, hasSub: boolean): string[] {
  const out: string[] = [];
  const bound = (x: string) => x === "n" || x === "m" || scope.has(x);
  for (const s of stmts) {
    if (s.k === "for" || s.k === "halve") {
      const b = s.k === "for" ? s.to : s.from;
      if (!bound(b)) out.push(`la variable ${b} no es de ningún bucle de fuera`);
      if (scope.has(s.v)) out.push(`la variable ${s.v} ya es de un bucle de fuera`);
      out.push(...scopeProblems(s.body, new Set([...scope, s.v]), sets, hasSub));
    } else if (s.k === "forEach") {
      if (!sets.has(s.set)) out.push(`falta el tamaño de ${s.set}`);
      out.push(...scopeProblems(s.body, new Set([...scope, s.v]), sets, hasSub));
    } else if (s.k === "call") {
      if (!hasSub) out.push("hay una llamada a Alg sin su coste");
      if (!bound(s.arg)) out.push(`la variable ${s.arg} no es de ningún bucle de fuera`);
    }
  }
  return out;
}

export const AlgorithmSchema = z
  .strictObject({
    sets: z.strictObject({ A: SizeVar.optional(), B: SizeVar.optional() }).optional(),
    sub: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine((s) => parseCost(s, ["k"]).ok, { message: "el coste de Alg no se lee (se escribe en k)" })
      .optional(),
    body: z.array(AlgoStmtSchema).min(1).max(4),
  })
  .superRefine((a, ctx) => {
    for (const p of scopeProblems(a.body, new Set(), new Set(Object.keys(a.sets ?? {})), a.sub !== undefined)) ctx.addIssue({ code: "custom", message: p });
  });

export const CombAlgorithmSchema = z.strictObject({ id: Id, level: Level, title: Title, algo: AlgorithmSchema });
export const CombCostSchema = z.strictObject({
  id: Id,
  level: Level,
  cost: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((s) => parseCost(s, ["n", "m"]).ok, { message: "el coste no se lee" }),
});

export const CombPackSchema = z.strictObject({
  meta: ContentMetaSchema,
  problems: z.array(CombProblemSchema).min(6),
  functions: z.array(FnPresetSchema).min(3),
  algorithms: z.array(CombAlgorithmSchema).min(4),
  costs: z.array(CombCostSchema).min(3),
});

export type CombPack = z.infer<typeof CombPackSchema>;
export type CombProblem = z.infer<typeof CombProblemSchema>;
export type FnPreset = z.infer<typeof FnPresetSchema>;
export type CombAlgorithm = z.infer<typeof CombAlgorithmSchema>;
