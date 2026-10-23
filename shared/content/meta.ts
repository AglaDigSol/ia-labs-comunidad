// Metadatos genéricos de cualquier paquete de contenido (content/). No dependen de ninguna
// universidad: la materia, el tema o la fuente son valores, no parte del esquema.
import { z } from "zod";

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const ContentMetaSchema = z.strictObject({
  /** Materia o asignatura a la que se refiere el contenido (texto libre o código). */
  subject: z.string().trim().min(1).max(120),
  /** Tema dentro de la materia. */
  topic: z.string().trim().min(1).max(120),
  /** Nivel educativo: grado, máster, doctorado, divulgación… */
  level: z.enum(["grado", "máster", "doctorado", "divulgación"]),
  /** Idioma del contenido (BCP 47: "es", "en", "pt-BR"…). */
  language: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
  /** Autoría: personas o colectivo que lo han escrito (alias si se prefiere). */
  author: z.string().trim().min(1).max(120),
  /** Licencia del contenido (identificador SPDX). */
  license: z.literal("CC-BY-SA-4.0"),
  /** De dónde sale: «Elaboración propia» o la referencia citada (solo como cita, nunca texto copiado). */
  source: z.string().trim().min(1).max(200),
  /** Última revisión (aaaa-mm-dd). */
  updated: z.string().regex(ISO_DATE),
});

export type ContentMeta = z.infer<typeof ContentMetaSchema>;

/** Fuente de un dato concreto (por ejemplo, el peso de una actividad en la nota). */
export const SourceRefSchema = z.strictObject({
  /** Documento citado, sin copiar su texto: «Guía docente de 02MIAR». */
  citation: z.string().trim().min(1).max(160),
  /** Curso académico al que se refiere: «2026-2027». */
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  /** Fecha en la que alguien lo comprobó (aaaa-mm-dd). */
  checkedOn: z.string().regex(ISO_DATE),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
