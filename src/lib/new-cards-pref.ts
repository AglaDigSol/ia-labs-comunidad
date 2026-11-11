// pref/newCardsPerDay: new cards each deck introduces per civil day (Ajustes · «Nuevas por día»).
// Separate from cards-store so Ajustes does not pull in the seed decks.
import { keys } from "../../shared/keys.ts";
import { DEFAULT_NEW_CARDS_PER_DAY } from "../../shared/srs/due.ts";
import { setKv, useKv } from "./kv-store.ts";

/** Bounds of pref/newCardsPerDay (same as its schema in shared/keys.ts). */
export const NEW_CAP_MIN = 1;
export const NEW_CAP_MAX = 200;

/** pref/newCardsPerDay if valid (integer 1–200), else the default 20. */
export const capOf = (v: unknown): number =>
  typeof v === "number" && Number.isInteger(v) && v >= NEW_CAP_MIN && v <= NEW_CAP_MAX ? v : DEFAULT_NEW_CARDS_PER_DAY;

/** New cards per deck and day. */
export function useNewCap(): number {
  return capOf(useKv<unknown>(keys.pref.newCardsPerDay, DEFAULT_NEW_CARDS_PER_DAY));
}

/** Sets pref/newCardsPerDay (rounded and clamped to 1–200). */
export function setNewCardsPerDay(n: number): void {
  setKv(keys.pref.newCardsPerDay, Math.min(NEW_CAP_MAX, Math.max(NEW_CAP_MIN, Math.round(n))));
}
