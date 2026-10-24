// Daily count and review queue.
// Pure: the caller passes the local civil `today` and the new-card cap (pref/newCardsPerDay).
import type { Course } from "./decks.ts";
import { addDays, type Quality } from "./sm2.ts";
import type { Srs } from "./types.ts";

export type DeckView = { id: string; name: string; course: Course; session: number | null; seed: boolean };

export type CardView = {
  id: string;
  deckId: string;
  /** Course of the card's deck (cards-store always fills it). Only courses with cards due appear in byCourse. */
  course?: Course;
  front: string;
  back: string;
  mono?: boolean;
  seed: boolean;
  srs: Srs | null;
  suspended: boolean;
};

export type DueSummary = {
  total: number;
  byCourse: Record<Course, number>;
  dueReviews: number;
  newAvailable: number;
  next: { date: string; count: number } | null;
  hasCards: boolean;
};

export const DEFAULT_NEW_CARDS_PER_DAY = 20;

const courseOf = (c: CardView): Course => c.course ?? (c.deckId.startsWith("sym-01") ? "01MIAR" : "02MIAR");

function split(cards: readonly CardView[], today: string, newCap: number) {
  const reviews: CardView[] = [];
  const fresh: CardView[] = [];
  let introducedToday = 0;
  for (const c of cards) {
    if (c.srs && c.srs.introduced === today) introducedToday++;
    if (c.suspended) continue;
    if (!c.srs) fresh.push(c);
    else if (c.srs.due <= today) reviews.push(c);
  }
  reviews.sort((a, b) => (a.srs!.due < b.srs!.due ? -1 : a.srs!.due > b.srs!.due ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const room = Math.max(0, newCap - introducedToday);
  return { reviews, fresh, newToday: fresh.slice(0, room) };
}

/** Due reviews (oldest first, then id), then new cards in input order up to the remaining cap. */
export function buildQueue(cards: readonly CardView[], today: string, newCap: number): CardView[] {
  const { reviews, newToday } = split(cards, today, newCap);
  return [...reviews, ...newToday];
}

/**
 * «N tarjetas para hoy» = #{not suspended, srs.due ≤ today} + min(cap − introducedToday, #new).
 * Only listed cards count: an srs/ entry whose card was deleted never reaches this list.
 * `next` is the earliest later day with work: scheduled reviews plus new cards held back by the cap.
 */
export function dueSummary(cards: readonly CardView[], today: string, newCap: number): DueSummary {
  const { reviews, fresh, newToday } = split(cards, today, newCap);
  const byCourse: Record<Course, number> = {};
  for (const c of [...reviews, ...newToday]) byCourse[courseOf(c)] = (byCourse[courseOf(c)] ?? 0) + 1;

  const later = new Map<string, number>();
  for (const c of cards) {
    if (c.suspended || !c.srs || c.srs.due <= today) continue;
    later.set(c.srs.due, (later.get(c.srs.due) ?? 0) + 1);
  }
  const heldBack = fresh.length - newToday.length;
  if (heldBack > 0) {
    const tomorrow = addDays(today, 1);
    later.set(tomorrow, (later.get(tomorrow) ?? 0) + Math.min(newCap, heldBack));
  }
  let next: DueSummary["next"] = null;
  for (const [date, count] of later) if (!next || date < next.date) next = { date, count };

  return {
    total: reviews.length + newToday.length,
    byCourse,
    dueReviews: reviews.length,
    newAvailable: newToday.length,
    next,
    hasCards: cards.length > 0,
  };
}

/** SM-2 step 7 within a session: Otra vez / Difícil go to the end, Bien / Fácil leave the queue. */
export function sessionStep(queue: readonly string[], cardId: string, q: Quality): string[] {
  const i = queue.indexOf(cardId);
  if (i < 0) return [...queue];
  const rest = [...queue.slice(0, i), ...queue.slice(i + 1)];
  return q <= 3 ? [...rest, cardId] : rest;
}
