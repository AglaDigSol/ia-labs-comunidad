// Flashcards: deck, card and SM-2 state schemas. Content (card/) and schedule (srs/, susp/)
// live in separate keys of the local store.
import { z } from "zod";

/** Client-generated ids: 10–12 chars of [a-z0-9], never in the seed namespaces. */
export const USER_ID_SRC = "(?!nn-|gd-|sym)[a-z0-9]{10,12}";
export const USER_ID_RE = new RegExp(`^${USER_ID_SRC}$`);
/** Seed decks built from the symbol dictionary. Read-only: never written to KV. */
export const SEED_DECK_SRC = "sym-[a-z0-9-]{1,24}";
export const SEED_DECK_RE = new RegExp(`^${SEED_DECK_SRC}$`);
/** Seed card ids ("sym-…" symbol ↔ lectura, "symp-…" variants). */
export const SEED_CARD_SRC = "symp?-[A-Za-z0-9_.-]{1,60}";
export const SEED_CARD_RE = new RegExp(`^${SEED_CARD_SRC}$`);

const CIVIL_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const civilDate = z.string().regex(CIVIL_DATE_RE);

export const DeckSchema = z.strictObject({
  name: z.string().min(1).max(80),
  course: z.string().regex(/^[A-Za-z0-9]{2,16}$/),
  session: z.number().int().min(1).max(40).nullable(),
});
export type Deck = z.infer<typeof DeckSchema>;

export const CardSchema = z.strictObject({
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(2000),
});
export type Card = z.infer<typeof CardSchema>;

const twoDecimals = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;

export const SrsSchema = z.strictObject({
  // SM-2 has no upper clamp; 10 covers any realistic run of «Fácil». Stored with 2 decimals.
  ef: z.number().min(1.3).max(10).refine(twoDecimals),
  n: z.number().int().min(0),
  interval: z.number().int().min(0).max(36500),
  due: civilDate,
  last: civilDate.nullable(),
  introduced: civilDate,
  lapses: z.number().int().min(0),
});
export type Srs = z.infer<typeof SrsSchema>;
