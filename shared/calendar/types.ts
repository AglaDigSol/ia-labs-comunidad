// Esquema genérico de un evento de calendario (content/calendario/). Las horas son hora de pared en
// la zona del paquete (por defecto Europe/Madrid): nunca offsets ni horas ya convertidas.
import { z } from "zod";
import { ContentMetaSchema } from "../content/meta.ts";

export const EVENT_TYPES = ["sesion", "tutoria", "practica", "entrega", "test", "foro", "examen"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  sesion: "Sesión",
  tutoria: "Tutoría",
  practica: "Práctica",
  entrega: "Entrega",
  test: "Test",
  foro: "Foro",
  examen: "Examen",
};

/** Clases (algo a lo que se asiste) frente a plazos (algo que se entrega o se hace). */
export const CLASS_TYPES: readonly EventType[] = ["sesion", "tutoria", "practica"];
export const DEADLINE_TYPES: readonly EventType[] = ["entrega", "test", "foro", "examen"];

export const WALL_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;
const wall = z.string().regex(WALL_RE, "Formato aaaa-mm-ddThh:mm (hora de pared)");

export const CalendarEventSchema = z
  .strictObject({
    /** Identificador estable: no lo cambies nunca (es el UID del .ics). */
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{1,47}$/),
    materia: z.string().regex(/^[A-Za-z0-9]{2,16}$/),
    tipo: z.enum(EVENT_TYPES),
    titulo: z.string().trim().min(1).max(120),
    inicio: wall,
    /** Opcional: una entrega es un instante (la hora límite). */
    fin: wall.optional(),
    /** La duración no figura en la fuente: es una estimación. */
    finEstimado: z.literal(true).optional(),
    grupo: z.enum(["G1", "G2", "G3"]).optional(),
    franja: z.enum(["F1", "F2"]).optional(),
    /** Cita de la fuente (sin URL). */
    fuente: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((s) => !/https?:|www\./i.test(s), "La fuente es una cita, sin URL."),
    actualizado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Revisión del evento para los calendarios suscritos (SEQUENCE). Súbela al cambiar la hora. */
    revision: z.number().int().min(0).max(999).optional(),
  })
  .refine((e) => e.fin === undefined || e.fin > e.inicio, { message: "fin debe ser posterior a inicio", path: ["fin"] })
  .refine((e) => !(e.grupo && e.franja), { message: "Un evento lleva grupo o franja, no ambos" })
  .refine((e) => (!e.grupo && !e.franja) || e.tipo === "practica" || e.tipo === "examen", {
    message: "grupo y franja solo para prácticas y exámenes",
  });

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarPackSchema = z.strictObject({
  meta: ContentMetaSchema,
  /** Zona de las horas de pared de los eventos. */
  zona: z.literal("Europe/Madrid"),
  eventos: z.array(CalendarEventSchema).min(1),
});

export type CalendarPack = z.infer<typeof CalendarPackSchema>;
