// Lista blanca de claves del almacén local, constructores de claves y validación de valores por
// prefijo. La usa src/lib/kv-store.ts al leer localStorage y al importar una copia JSON.
import { z } from "zod";
import { COURSES } from "../content/courses/index.ts";
import { CardSchema, DeckSchema, SEED_CARD_SRC, SrsSchema, USER_ID_SRC } from "./srs/types.ts";

export type ThemePref = "light" | "system" | "dark";

export const keys = {
  grade: (courseId: string, componentId: string) => `grade/${courseId}/${componentId}`,
  deck: (deckId: string) => `deck/${deckId}`,
  card: (deckId: string, cardId: string) => `card/${deckId}/${cardId}`,
  srs: (cardId: string) => `srs/${cardId}`,
  susp: (cardId: string) => `susp/${cardId}`,
  pref: {
    newCardsPerDay: "pref/newCardsPerDay",
    theme: "pref/theme",
    mhThreshold: "pref/mhThreshold",
    timeZone: "pref/timeZone",
    calGroup: "pref/calGroup",
    calSlot: "pref/calSlot",
  },
} as const;

const gradeSchema = z.number().int().min(0).max(1000);
const themeSchema = z.enum(["light", "system", "dark"]);
const boolSchema = z.literal(true);
const mhSchema = z.number().int().min(900).max(1000);
const newCardsPerDaySchema = z.number().int().min(1).max(200);
const timeZoneSchema = z.string().regex(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/).max(64);
const calGroupSchema = z.enum(["G1", "G2", "G3", "todos"]);
const calSlotSchema = z.enum(["F1", "F2", "todas"]);

// Las barajas semilla (sym-*) viven en el repositorio: deck/ y card/ solo aceptan ids de usuario;
// srs/ y susp/ aceptan también ids de tarjetas semilla (su calendario).
const U = USER_ID_SRC;
const DECK_KEY_RE = new RegExp(`^deck/${U}$`);
const CARD_KEY_RE = new RegExp(`^card/${U}/${U}$`);
const SRS_KEY_RE = new RegExp(`^srs/(?:${U}|${SEED_CARD_SRC})$`);
const SUSP_KEY_RE = new RegExp(`^susp/(?:${U}|${SEED_CARD_SRC})$`);

function isGradeKey(key: string): boolean {
  const [, courseId, componentId, extra] = key.split("/");
  if (extra !== undefined) return false;
  const course = COURSES.find((c) => c.id === courseId);
  return course !== undefined && course.components.some((c) => c.id === componentId);
}

function schemaFor(key: string): z.ZodType | null {
  if (key.startsWith("deck/")) return DECK_KEY_RE.test(key) ? DeckSchema : null;
  if (key.startsWith("card/")) return CARD_KEY_RE.test(key) ? CardSchema : null;
  if (key.startsWith("srs/")) return SRS_KEY_RE.test(key) ? SrsSchema : null;
  if (key.startsWith("susp/")) return SUSP_KEY_RE.test(key) ? boolSchema : null;
  if (key.startsWith("grade/")) return isGradeKey(key) ? gradeSchema : null;
  if (key === keys.pref.theme) return themeSchema;
  if (key === keys.pref.mhThreshold) return mhSchema;
  if (key === keys.pref.newCardsPerDay) return newCardsPerDaySchema;
  if (key === keys.pref.timeZone) return timeZoneSchema;
  if (key === keys.pref.calGroup) return calGroupSchema;
  if (key === keys.pref.calSlot) return calSlotSchema;
  return null;
}

export function validateValue(key: string, value: unknown): { ok: true } | { ok: false; error: string } {
  const schema = schemaFor(key);
  if (!schema) return { ok: false, error: "unknown_key" };
  return schema.safeParse(value).success ? { ok: true } : { ok: false, error: "invalid_value" };
}
