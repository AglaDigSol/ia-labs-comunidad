// Classic SM-2 (Woźniak 1987, steps 1–7) over civil dates in the browser's time zone.
// Pure: `today` is always passed in (localCivilDate(now)); no clock reads, no millisecond day math.
import type { Srs } from "./types.ts";

export type { Srs } from "./types.ts";

/** Button → SM-2 quality. q = 0 and q = 2 are never produced. */
export type Quality = 1 | 3 | 4 | 5;
export const QUALITY = { otra: 1, dificil: 3, bien: 4, facil: 5 } as const satisfies Record<string, Quality>;
export const QUALITY_LABEL: Record<Quality, string> = { 1: "Otra vez", 3: "Difícil", 4: "Bien", 5: "Fácil" };

const EF_MIN = 1.3;
/** SrsSchema bound (100 years). Only reachable after long runs of «Fácil». */
const MAX_INTERVAL = 36500;

/** A card that has never been graded, introduced on `today`. */
export function NEW_STATE(today: string): Srs {
  return { ef: 2.5, n: 0, interval: 0, due: today, last: null, introduced: today, lapses: 0 };
}

/** Adds k calendar days to a YYYY-MM-DD civil date (UTC calendar arithmetic, DST-proof). */
export function addDays(date: string, k: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * One review. Interval uses the EF before this review's update (classic order).
 * A2 (locked): EF += 0.1 − (5 − q)(0.08 + (5 − q)·0.02) on EVERY review, also on a lapse
 * (Otra vez), so failures shorten future intervals. EF is stored with 2 decimals, floor 1.3.
 * Step 7: Otra vez / Difícil re-queue the card at the end of today's session (see due.ts
 * sessionStep), but only the first grade of the civil day schedules: if `last === today`
 * the stored state is returned unchanged.
 * Overdue cards: lateness is ignored (classic SM-2), due = today + interval.
 */
export function review(s: Srs | null, q: Quality, today: string): Srs {
  const cur = s ?? NEW_STATE(today);
  if (cur.last === today) return cur;
  let { n, interval, lapses } = cur;
  if (q >= 3) {
    interval = n === 0 ? 1 : n === 1 ? 6 : Math.round(interval * cur.ef);
    n += 1;
  } else {
    n = 0;
    interval = 1;
    lapses += 1;
  }
  interval = Math.min(interval, MAX_INTERVAL);
  const ef = Math.max(EF_MIN, round2(cur.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  return { ef, n, interval, due: addDays(today, interval), last: today, introduced: cur.introduced, lapses };
}

/** "Hoy" (0), "{n} d" (< 60), "{n} m" (< 365), "{n} a". */
export function fmtInterval(days: number): string {
  if (days <= 0) return "Hoy";
  if (days < 60) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} m`;
  return `${Math.round(days / 365)} a`;
}

/**
 * Label under each SM-2 button. Otra vez shows «Hoy»: the card comes back in this session.
 * A card already graded today keeps its stored schedule (idempotence), so it shows that interval.
 */
export function nextIntervals(s: Srs | null, today: string): Record<Quality, string> {
  const out = {} as Record<Quality, string>;
  for (const q of [1, 3, 4, 5] as const) out[q] = q === 1 ? "Hoy" : fmtInterval(review(s, q, today).interval);
  return out;
}
