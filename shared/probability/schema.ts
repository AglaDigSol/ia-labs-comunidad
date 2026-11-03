// Esquema del contenido del laboratorio de probabilidad (content/probabilidad/). Se valida en
// tests/content-probabilidad.test.ts: además de la forma, cada probabilidad se tiene que leer como
// fracción o decimal entre 0 y 1, la partición de cada árbol tiene que sumar 1, las casillas de cada
// tabla 2×2 tienen que bastar para completarla y los datos de cada par de sucesos tienen que ser
// posibles.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { cmp, ONE, parseNumber, ZERO, type Frac } from "../rational.ts";
import {
  CONTINGENCY_KEYS,
  contingencyDetermined,
  contingencyProblem,
  interFromCond,
  interFromUnion,
  pairProblem,
  treeProblem,
} from "./conditional.ts";
import { distProblem, type DistSpec } from "./distributions.ts";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Level = z.enum(["básico", "medio", "avanzado"]);
const Title = z.string().trim().min(1).max(80);
const Story = z.string().trim().min(10).max(600);
const Name = z.string().trim().min(1).max(60);

/** Una probabilidad escrita como en el laboratorio: «3/5», «0,25». */
export function readProb(text: string): Frac {
  const r = parseNumber(text);
  if (!r.ok) throw new RangeError(`no se lee: ${text}`);
  return r.value;
}

const Prob = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .superRefine((s, ctx) => {
    const r = parseNumber(s);
    if (!r.ok || cmp(r.value, ZERO) < 0 || cmp(r.value, ONE) > 0) ctx.addIssue({ code: "custom", message: `«${s}» no es una probabilidad (entre 0 y 1)` });
  });

const Weight = z.number().int().min(1).max(12);
const Money = z.number().int().min(-50).max(50);

export const ProbTreeSchema = z
  .strictObject({
    id: Id,
    level: Level,
    title: Title,
    story: Story,
    /** Nombre corto de cada rama de la partición (A₁, A₂…). */
    branches: z.array(Name).min(2).max(3),
    /** El suceso C («la pieza es defectuosa»). */
    event: Name,
    priors: z.array(Prob).min(2).max(3),
    likelihoods: z.array(Prob).min(2).max(3),
    /** Rama cuya P(Aᵢ) no se da (se deduce porque suman 1). */
    hiddenPrior: z.number().int().min(0).max(2).optional(),
    /** Rama por la que se pregunta P(Aᵢ | C). */
    ask: z.number().int().min(0).max(2),
  })
  .superRefine((t, ctx) => {
    if (t.branches.length !== t.priors.length || t.likelihoods.length !== t.priors.length) {
      ctx.addIssue({ code: "custom", message: "una P(Aᵢ) y una P(C | Aᵢ) por rama" });
      return;
    }
    if (t.ask >= t.branches.length || (t.hiddenPrior ?? 0) >= t.branches.length) ctx.addIssue({ code: "custom", message: "rama fuera de rango" });
    try {
      const problem = treeProblem({ priors: t.priors.map(readProb), likelihoods: t.likelihoods.map(readProb) });
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    } catch {
      // Prob ya marca lo ilegible.
    }
  });

export const ProbContingencySchema = z
  .strictObject({
    id: Id,
    level: Level,
    title: Title,
    story: Story,
    a: Name,
    b: Name,
    ab: Prob,
    aNotB: Prob,
    notAB: Prob,
    notANotB: Prob,
    /** Casillas que se dan; el resto las rellena la persona. */
    given: z.array(z.enum(CONTINGENCY_KEYS)).min(3).max(5),
  })
  .superRefine((c, ctx) => {
    try {
      const problem = contingencyProblem({ ab: readProb(c.ab), aNotB: readProb(c.aNotB), notAB: readProb(c.notAB), notANotB: readProb(c.notANotB) });
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    } catch {
      // Prob ya marca lo ilegible.
    }
    if (!contingencyDetermined(c.given)) ctx.addIssue({ code: "custom", message: "con esas casillas no se puede completar la tabla sumando filas y columnas" });
  });

export const ProbPairSchema = z
  .strictObject({
    id: Id,
    level: Level,
    story: Story,
    a: Name,
    b: Name,
    pA: Prob,
    pB: Prob,
    /** El tercer dato: P(A ∩ B), P(A ∪ B) o P(A | B). */
    given: z.enum(["inter", "union", "cond"]),
    value: Prob,
  })
  .superRefine((p, ctx) => {
    try {
      const pA = readProb(p.pA);
      const pB = readProb(p.pB);
      const v = readProb(p.value);
      const inter = p.given === "inter" ? v : p.given === "union" ? interFromUnion(pA, pB, v) : interFromCond(v, pB);
      const problem = pairProblem(pA, pB, inter);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    } catch {
      // Prob ya marca lo ilegible.
    }
  });

const DistSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("bernoulli"), p: Prob }),
  z.strictObject({ kind: z.literal("binomial"), n: z.number().int().min(1).max(30), p: Prob }),
  z.strictObject({ kind: z.literal("geometrica"), p: Prob }),
  z.strictObject({ kind: z.literal("poisson"), lambda: z.string().trim().min(1).max(10) }),
  z.strictObject({ kind: z.literal("uniforme"), a: z.number().int().min(-20).max(20), b: z.number().int().min(-20).max(20) }),
]);
export type DistContent = z.infer<typeof DistSchema>;

/** La distribución del contenido, con sus parámetros como fracciones. */
export function distFromContent(d: DistContent): DistSpec {
  switch (d.kind) {
    case "bernoulli":
    case "geometrica":
      return { kind: d.kind, p: readProb(d.p) };
    case "binomial":
      return { kind: "binomial", n: d.n, p: readProb(d.p) };
    case "poisson":
      return { kind: "poisson", lambda: readProb(d.lambda) };
    case "uniforme":
      return d;
  }
}

export const DIST_QUESTIONS = ["igual", "al-menos", "como-mucho", "media", "varianza"] as const;
export type DistQuestion = (typeof DIST_QUESTIONS)[number];

export const ProbStorySchema = z
  .strictObject({
    id: Id,
    level: Level,
    title: Title,
    story: Story,
    dist: DistSchema,
    /** El valor k de las preguntas P(X = k), P(X ≥ k), P(X ≤ k). */
    k: z.number().int().min(0).max(40),
    ask: z.array(z.enum(DIST_QUESTIONS)).min(1).max(5),
  })
  .superRefine((s, ctx) => {
    try {
      const problem = distProblem(distFromContent(s.dist));
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    } catch {
      ctx.addIssue({ code: "custom", message: "parámetros ilegibles" });
    }
  });

const DieRuleSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("cara"), mult: Money, cost: Money }),
  z.strictObject({ kind: z.literal("paridad"), odd: Money, even: Money }),
  z.strictObject({ kind: z.literal("umbral"), t: z.number().int().min(2).max(6), win: Money, lose: Money }),
]);

export const ProbGameSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("dado"),
    id: Id,
    level: Level,
    title: Title,
    story: Story,
    /** Pesos de cada cara impar y de cada cara par (1 y 1: dado equilibrado). */
    odd: Weight,
    even: Weight,
    rule: DieRuleSchema,
  }),
  z
    .strictObject({
      kind: z.literal("monedas"),
      id: Id,
      level: Level,
      title: Title,
      story: Story,
      coins: z.number().int().min(1).max(4),
      /** Ganancia con 0, 1, …, k caras. */
      payoffs: z.array(Money).min(2).max(5),
    })
    .refine((g) => g.payoffs.length === g.coins + 1, { message: "una ganancia por número de caras (de 0 a k)" }),
]);

export const ProbPenaltySchema = z.strictObject({
  id: Id,
  level: Level,
  /** Opciones por pregunta (una correcta). */
  options: z.number().int().min(2).max(6),
  /** Lo que suma un acierto. */
  reward: Prob.or(z.string().regex(/^\d{1,2}$/)),
  /** Lo que tiene que valer de media responder al azar. */
  target: Prob,
});

const BinomialParams = z.strictObject({ n: z.number().int().min(1).max(20), p: Prob });
export const ProbProductSchema = z.strictObject({ id: Id, level: Level, story: Story, x: BinomialParams, y: BinomialParams });

export const ProbPackSchema = z.strictObject({
  meta: ContentMetaSchema,
  trees: z.array(ProbTreeSchema).min(2),
  contingency: z.array(ProbContingencySchema).min(2),
  pairs: z.array(ProbPairSchema).min(2),
  stories: z.array(ProbStorySchema).min(4),
  games: z.array(ProbGameSchema).min(2),
  penalties: z.array(ProbPenaltySchema).min(2),
  products: z.array(ProbProductSchema).min(1),
});

export type ProbPack = z.infer<typeof ProbPackSchema>;
export type ProbTreeContent = z.infer<typeof ProbTreeSchema>;
export type ProbContingencyContent = z.infer<typeof ProbContingencySchema>;
export type ProbPairContent = z.infer<typeof ProbPairSchema>;
export type ProbStoryContent = z.infer<typeof ProbStorySchema>;
export type ProbGameContent = z.infer<typeof ProbGameSchema>;
export type ProbPenaltyContent = z.infer<typeof ProbPenaltySchema>;
export type ProbProductContent = z.infer<typeof ProbProductSchema>;
