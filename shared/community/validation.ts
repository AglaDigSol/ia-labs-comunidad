/**
 * Validación y esquemas Zod para Comunidad.
 * Conforme a COM-01, COM-03, COM-04, COM-07 y directrices de seguridad.
 */

import { z } from "zod";

/** Expresión regular estricta para URLs seguras: solo http o https, sin credenciales de usuario */
export const SAFE_URL_REGEX = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s"']*)?$/i;

/** Valida una URL para descartar esquemas peligrosos como javascript:, data:, file: y credenciales */
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Rechaza credenciales incrustadas (user:password@host)
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

/** Obtiene el dominio legible de una URL segura para mostrar al usuario */
export function extractSafeDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "enlace externo";
  }
}

/** Escapa caracteres HTML para garantizar salida en texto plano seguro */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Esquema de URL segura */
export const SafeUrlSchema = z
  .string()
  .trim()
  .max(2048, "La URL no puede exceder 2048 caracteres")
  .refine(isSafeUrl, {
    message: "La URL debe ser válida y comenzar con http:// o https:// (sin credenciales)",
  });

/** Esquema para nombre visible del usuario (COM-01) */
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre visible debe tener al menos 2 caracteres")
  .max(80, "El nombre visible no puede exceder 80 caracteres")
  .regex(/^[^<>]+$/, "El nombre no puede contener caracteres HTML");

/** Esquema de Asignatura opcional */
export const CourseIdSchema = z
  .string()
  .trim()
  .regex(/^(0[1-9]MIAR|10MIAR)$/i, "Código de asignatura no reconocido (ej. 01MIAR a 10MIAR)")
  .optional();

/** Esquema para Crear Publicación (COM-03) */
export const CreatePostSchema = z.object({
  category: z.enum(["novedad", "recurso", "pregunta"], {
    error: "Selecciona una categoría válida (Novedad, Recurso o Pregunta)",
  }),
  courseId: CourseIdSchema,
  title: z
    .string()
    .trim()
    .min(5, "El título debe tener al menos 5 caracteres")
    .max(160, "El título no puede superar 160 caracteres"),
  body: z
    .string()
    .trim()
    .min(1, "El contenido de la publicación no puede estar vacío")
    .max(10000, "El contenido no puede superar 10000 caracteres"),
  links: z
    .array(SafeUrlSchema)
    .max(5, "No se pueden incluir más de 5 enlaces")
    .default([]),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

/** Esquema para Editar Publicación (COM-05) */
export const EditPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "El título debe tener al menos 5 caracteres")
    .max(160, "El título no puede superar 160 caracteres")
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, "El contenido no puede estar vacío")
    .max(10000, "El contenido no puede superar 10000 caracteres")
    .optional(),
  links: z
    .array(SafeUrlSchema)
    .max(5, "No se pueden incluir más de 5 enlaces")
    .optional(),
});

export type EditPostInput = z.infer<typeof EditPostSchema>;

/** Esquema para Crear Respuesta (COM-04) */
export const CreateReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "La respuesta no puede estar vacía")
    .max(5000, "La respuesta no puede superar 5000 caracteres"),
  links: z
    .array(SafeUrlSchema)
    .max(5, "No se pueden incluir más de 5 enlaces")
    .default([]),
});

export type CreateReplyInput = z.infer<typeof CreateReplySchema>;

/** Esquema para Reportar Contenido (COM-06) */
export const CreateReportSchema = z.object({
  targetType: z.enum(["post", "reply"]),
  targetId: z.string().trim().min(1, "Identificador de contenido requerido"),
  reason: z.enum(["spam", "academic_integrity", "harassment", "inappropriate", "other"]),
  details: z
    .string()
    .trim()
    .max(1000, "Los detalles del reporte no pueden superar 1000 caracteres")
    .optional(),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

/** Esquema de Acción de Moderación (COM-06) */
export const ModerationActionSchema = z.object({
  action: z.enum(["pin", "unpin", "hide", "restore", "close", "reopen", "suspend_user", "unsuspend_user"]),
  targetType: z.enum(["post", "reply", "user"]),
  targetId: z.string().trim().min(1, "Identificador de objetivo requerido"),
  reason: z.string().trim().min(3, "Indica el motivo de la acción de moderación").max(500),
});

export type ModerationActionInput = z.infer<typeof ModerationActionSchema>;
