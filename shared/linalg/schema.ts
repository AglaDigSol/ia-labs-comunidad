// Esquema del contenido del laboratorio de álgebra lineal (content/algebra-lineal/). Se valida en
// tests/content-algebra-lineal.test.ts: además de la forma, cada matriz se tiene que poder leer, los
// productos tienen que estar definidos, las matrices de autovalores tienen que tener autovalores
// racionales y las preguntas de tensores tienen que usar formas válidas.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";
import { eigenvalues } from "./eigen.ts";
import { canMultiply, isSquareMatrix, matrixCols, parseMatrix, type Matrix } from "./matrix.ts";
import { MAX_DIM, MAX_NDIM } from "./tensors.ts";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Level = z.enum(["básico", "medio", "avanzado"]);
/** Una matriz como se escribe en el laboratorio: una fila por línea, números separados por espacios. */
const MatrixText = z.string().trim().min(1).max(300);
const Title = z.string().trim().min(1).max(80);

export const LinalgSystemSchema = z.strictObject({ id: Id, title: Title, level: Level, matrix: MatrixText });
export const LinalgProductSchema = z.strictObject({ id: Id, level: Level, a: MatrixText, b: MatrixText });
export const LinalgSquareSchema = z.strictObject({ id: Id, level: Level, matrix: MatrixText });
export const LinalgVectorsSchema = z.strictObject({ id: Id, level: Level, vectors: MatrixText });

const ShapeSchema = z.array(z.number().int().min(0).max(MAX_DIM)).max(MAX_NDIM);
export const TensorOpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("suma"), a: ShapeSchema, b: ShapeSchema }),
  z.strictObject({ op: z.literal("matmul"), a: ShapeSchema, b: ShapeSchema }),
  z.strictObject({ op: z.literal("sum"), a: ShapeSchema, axis: z.number().int().min(-MAX_NDIM).max(MAX_NDIM).nullable(), keepdims: z.boolean().optional() }),
  z.strictObject({ op: z.literal("reshape"), a: ShapeSchema, target: z.array(z.number().int().min(-1).max(MAX_DIM)).min(1).max(MAX_NDIM) }),
  z.strictObject({ op: z.literal("T"), a: ShapeSchema }),
]);
export const LinalgTensorSchema = z.strictObject({ id: Id, level: Level, q: TensorOpSchema });

export const TransformSpecSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("rotacion"), degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]) }),
  z.strictObject({ kind: z.literal("reflexion"), axis: z.enum(["x", "y", "y=x", "y=-x"]) }),
  z.strictObject({ kind: z.literal("cizalla"), direction: z.enum(["horizontal", "vertical"]), k: z.number().int().min(-4).max(4) }),
  z.strictObject({ kind: z.literal("escala"), a: z.number().int().min(-4).max(4), b: z.number().int().min(-4).max(4) }),
  z.strictObject({ kind: z.literal("proyeccion"), axis: z.enum(["x", "y"]) }),
]);
export const LinalgTransformSchema = z.strictObject({ id: Id, spec: TransformSpecSchema });

export const LinalgPackSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    systems: z.array(LinalgSystemSchema).min(4).max(30),
    products: z.array(LinalgProductSchema).min(3).max(20),
    square: z.array(LinalgSquareSchema).min(4).max(30),
    vectors: z.array(LinalgVectorsSchema).min(3).max(20),
    eigen: z.array(LinalgSquareSchema).min(3).max(20),
    transforms: z.array(LinalgTransformSchema).min(5).max(20),
    tensors: z.array(LinalgTensorSchema).min(6).max(40),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const read = (where: string, text: string): Matrix | null => {
      const r = parseMatrix(text);
      if (!r.ok) issue(`${where}: ${r.error}`);
      return r.ok ? r.value : null;
    };
    const ids = (list: Array<{ id: string }>, where: string) => {
      const seen = new Set<string>();
      for (const { id } of list) {
        if (seen.has(id)) issue(`${where}: id repetido «${id}».`);
        seen.add(id);
      }
    };
    ids(p.systems, "systems");
    ids(p.products, "products");
    ids(p.square, "square");
    ids(p.vectors, "vectors");
    ids(p.eigen, "eigen");
    ids(p.transforms, "transforms");
    ids(p.tensors, "tensors");
    for (const s of p.systems) {
      const M = read(`systems.${s.id}`, s.matrix);
      if (M && matrixCols(M) < 2) issue(`systems.${s.id}: una matriz ampliada necesita al menos una incógnita y la columna b.`);
    }
    for (const x of p.products) {
      const A = read(`products.${x.id}.a`, x.a);
      const B = read(`products.${x.id}.b`, x.b);
      if (A && B && !canMultiply(A, B)) issue(`products.${x.id}: A·B no está definido (columnas de A ≠ filas de B).`);
    }
    for (const x of p.square) {
      const M = read(`square.${x.id}`, x.matrix);
      if (M && (!isSquareMatrix(M) || M.length > 4)) issue(`square.${x.id}: tiene que ser cuadrada, de 2×2 a 4×4.`);
    }
    for (const x of p.vectors) read(`vectors.${x.id}`, x.vectors);
    for (const x of p.eigen) {
      const M = read(`eigen.${x.id}`, x.matrix);
      if (!M) continue;
      if (!isSquareMatrix(M) || M.length > 3) issue(`eigen.${x.id}: tiene que ser cuadrada, de 2×2 o 3×3.`);
      else if (!eigenvalues(M).complete) issue(`eigen.${x.id}: sus autovalores no son todos racionales.`);
    }
  });

export type LinalgPack = z.infer<typeof LinalgPackSchema>;
