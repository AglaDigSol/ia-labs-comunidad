// Daily count and review queue.
// Pure: the caller passes the local civil `today`, the per-deck new-card cap (pref/newCardsPerDay)
// and today's extra new cards per deck (newx/<deckId>, «Repasar 5 más»).
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

/** Default of pref/newCardsPerDay: new cards a deck may introduce per civil day. */
export const DEFAULT_NEW_CARDS_PER_DAY = 20;
/** New cards added to a deck's cap for today by «Repasar 5 más». */
export const EXTRA_NEW_STEP = 5;

/** Extra new cards allowed today, by deck id (see «Repasar 5 más»). Missing deck: 0. */
export type NewExtra = Readonly<Record<string, number>>;

/** Today's numbers of one deck. */
export type DeckDay = {
  /** Cards in today's queue (due reviews + new cards within the deck's cap). */
  today: number;
  dueReviews: number;
  newToday: number;
  /** New (never graded), not suspended. */
  fresh: number;
  total: number;
  /** Cards of the deck first graded today (they count against the cap). */
  introducedToday: number;
  /** Today's cap of the deck: newCap + extra. */
  cap: number;
  /** New cards left out today by the cap. */
  heldBack: number;
};

const courseOf = (c: CardView): Course => c.course ?? (c.deckId.startsWith("sym-01") ? "01MIAR" : "02MIAR");

/**
 * The cap is per deck: each deck introduces up to newCap + extra[deckId] new cards per civil day,
 * minus the ones it already introduced today. A big deck no longer uses up the other decks' cap.
 */
function split(cards: readonly CardView[], today: string, newCap: number, extra: NewExtra = {}) {
  const reviews: CardView[] = [];
  const fresh: CardView[] = [];
  const introduced = new Map<string, number>();
  for (const c of cards) {
    if (c.srs && c.srs.introduced === today) introduced.set(c.deckId, (introduced.get(c.deckId) ?? 0) + 1);
    if (c.suspended) continue;
    if (!c.srs) fresh.push(c);
    else if (c.srs.due <= today) reviews.push(c);
  }
  reviews.sort((a, b) => (a.srs!.due < b.srs!.due ? -1 : a.srs!.due > b.srs!.due ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const capOf = (deckId: string) => newCap + Math.max(0, extra[deckId] ?? 0);
  const room = new Map<string, number>();
  const newToday: CardView[] = [];
  for (const c of fresh) {
    const left = room.get(c.deckId) ?? Math.max(0, capOf(c.deckId) - (introduced.get(c.deckId) ?? 0));
    room.set(c.deckId, left > 0 ? left - 1 : 0);
    if (left > 0) newToday.push(c);
  }
  return { reviews, fresh, newToday, introduced, capOf };
}

/** Due reviews (oldest first, then id), then new cards in input order up to each deck's remaining cap. */
export function buildQueue(cards: readonly CardView[], today: string, newCap: number, extra: NewExtra = {}): CardView[] {
  const { reviews, newToday } = split(cards, today, newCap, extra);
  return [...reviews, ...newToday];
}

/** Today's numbers per deck id. Only decks with at least one card appear. */
export function deckDays(cards: readonly CardView[], today: string, newCap: number, extra: NewExtra = {}): Map<string, DeckDay> {
  const { reviews, fresh, newToday, introduced, capOf } = split(cards, today, newCap, extra);
  const out = new Map<string, DeckDay>();
  const get = (id: string) => {
    let d = out.get(id);
    if (!d) {
      d = { today: 0, dueReviews: 0, newToday: 0, fresh: 0, total: 0, introducedToday: introduced.get(id) ?? 0, cap: capOf(id), heldBack: 0 };
      out.set(id, d);
    }
    return d;
  };
  for (const c of cards) get(c.deckId).total++;
  for (const c of fresh) get(c.deckId).fresh++;
  for (const c of reviews) get(c.deckId).dueReviews++;
  for (const c of newToday) get(c.deckId).newToday++;
  for (const d of out.values()) {
    d.today = d.dueReviews + d.newToday;
    d.heldBack = d.fresh - d.newToday;
  }
  return out;
}

/**
 * «N tarjetas para hoy» = #{not suspended, srs.due ≤ today} + Σ per deck min(cap − introducedToday, #new).
 * Only listed cards count: an srs/ entry whose card was deleted never reaches this list.
 * `next` is the earliest later day with work: scheduled reviews plus new cards held back by the
 * cap (up to newCap per deck tomorrow; extras are for today only).
 */
export function dueSummary(cards: readonly CardView[], today: string, newCap: number, extra: NewExtra = {}): DueSummary {
  const { reviews, fresh, newToday } = split(cards, today, newCap, extra);
  const byCourse: Record<Course, number> = {};
  for (const c of [...reviews, ...newToday]) byCourse[courseOf(c)] = (byCourse[courseOf(c)] ?? 0) + 1;

  const later = new Map<string, number>();
  for (const c of cards) {
    if (c.suspended || !c.srs || c.srs.due <= today) continue;
    later.set(c.srs.due, (later.get(c.srs.due) ?? 0) + 1);
  }
  const held = new Map<string, number>();
  for (const c of fresh) held.set(c.deckId, (held.get(c.deckId) ?? 0) + 1);
  for (const c of newToday) held.set(c.deckId, (held.get(c.deckId) ?? 0) - 1);
  let tomorrowNew = 0;
  for (const n of held.values()) if (n > 0) tomorrowNew += Math.min(newCap, n);
  if (tomorrowNew > 0) {
    const tomorrow = addDays(today, 1);
    later.set(tomorrow, (later.get(tomorrow) ?? 0) + tomorrowNew);
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
