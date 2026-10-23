// Asignaturas de la calculadora de notas. Los datos viven en content/courses/ y se validan con
// CourseSchema (tests/content.test.ts). Solo pesos y etiquetas: nada de enlaces ni datos personales.
import { z } from "zod";
import { ContentMetaSchema, SourceRefSchema } from "../content/meta.ts";

export const COURSE_ID_RE = /^[A-Za-z0-9]{2,16}$/;
const COMPONENT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const GradeComponentSchema = z.strictObject({
  id: z.string().regex(COMPONENT_ID_RE).max(32),
  label: z.string().trim().min(1).max(80),
  weightPct: z.number().int().min(1).max(100),
  isExam: z.boolean(),
  /** De dónde sale este peso y cuándo se comprobó. */
  source: SourceRefSchema,
});

export const CourseSchema = z
  .strictObject({
    meta: ContentMetaSchema,
    id: z.string().regex(COURSE_ID_RE),
    name: z.string().trim().min(1).max(120),
    examWeightPct: z.number().int().min(1).max(100),
    components: z.array(GradeComponentSchema).min(2),
  })
  .superRefine((c, ctx) => {
    const total = c.components.reduce((s, x) => s + x.weightPct, 0);
    if (total !== 100) ctx.addIssue({ code: "custom", message: `Los pesos de ${c.id} suman ${total} %, no 100 %.` });
    const exams = c.components.filter((x) => x.isExam);
    if (exams.length !== 1) ctx.addIssue({ code: "custom", message: `${c.id} debe tener exactamente un examen.` });
    else if (exams[0]!.weightPct !== c.examWeightPct) {
      ctx.addIssue({ code: "custom", message: `examWeightPct de ${c.id} no coincide con el peso del examen.` });
    }
    const ids = c.components.map((x) => x.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `${c.id} repite ids de componentes.` });
  });

export type GradeComponent = z.infer<typeof GradeComponentSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type CourseId = string;
