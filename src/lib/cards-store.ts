// Flashcards over the local KV store. Content (card/), schedule (srs/) and suspension (susp/) are
// separate keys. Seed decks come from shared/srs/decks.ts and are never written to the store.
// Every value read from KV is re-validated; entries that fail to parse are ignored.
import { useEffect, useMemo } from "react";
import { keys } from "../../shared/keys.ts";
import { SEED_DECKS, seedCards, type Course } from "../../shared/srs/decks.ts";
import { DEFAULT_NEW_CARDS_PER_DAY, dueSummary, type CardView, type DeckView, type DueSummary } from "../../shared/srs/due.ts";
import { review, type Quality } from "../../shared/srs/sm2.ts";
import { CardSchema, DeckSchema, SrsSchema, USER_ID_RE, type Card, type Deck, type Srs } from "../../shared/srs/types.ts";
import { localCivilDate } from "../../shared/date.ts";
import { COURSES as COURSE_DATA } from "../../content/courses/index.ts";
import { deleteKv, readKvPrefix, setKv, useKv, useKvPrefix } from "./kv-store.ts";
import { useNow } from "./use-now.ts";

export type { CardView, DeckView, DueSummary } from "../../shared/srs/due.ts";

export type CardSnapshot = { deckId: string; cardId: string; card: Card; srs: Srs | null; suspended: boolean };

type KvEntry = { key: string; value: unknown };
type Raw = { deck: KvEntry[]; card: KvEntry[]; srs: KvEntry[]; susp: KvEntry[] };
type Index = {
  decks: Map<string, Deck>;
  /** deckId -> cardId -> content */
  cards: Map<string, Map<string, Card>>;
  srs: Map<string, Srs>;
  susp: Set<string>;
};

const PREFIXES = { deck: "deck/", card: "card/", srs: "srs/", susp: "susp/" } as const;

// ---------------------------------------------------------------------------------------------
// Imperative reads. The hooks below mirror the latest KV view while any of them is mounted, so a
// second action before the re-render sees the first one; otherwise actions read sync-store's live cache.
let mirror: Raw | null = null;
let mounted = 0;

function fromStore(): Raw {
  return {
    deck: readKvPrefix(PREFIXES.deck),
    card: readKvPrefix(PREFIXES.card),
    srs: readKvPrefix(PREFIXES.srs),
    susp: readKvPrefix(PREFIXES.susp),
  } as Raw;
}

const currentRaw = (): Raw => (mounted > 0 && mirror ? mirror : fromStore());

/** Writes through sync-store and patches the mirror so a second action before the re-render sees it. */
function write(key: string, value: unknown | null): void {
  if (value === null) deleteKv(key);
  else setKv(key, value);
  if (!mirror) return;
  const p = (Object.keys(PREFIXES) as Array<keyof Raw>).find((k) => key.startsWith(PREFIXES[k]));
  if (!p) return;
  const list = mirror[p].filter((e) => e.key !== key);
  if (value !== null) list.push({ key, value });
  mirror = { ...mirror, [p]: list };
}

function index(raw: Raw): Index {
  const decks = new Map<string, Deck>();
  for (const { key, value } of raw.deck) {
    const id = key.slice(PREFIXES.deck.length);
    const p = DeckSchema.safeParse(value);
    if (USER_ID_RE.test(id) && p.success) decks.set(id, p.data);
  }
  const cards = new Map<string, Map<string, Card>>();
  for (const { key, value } of raw.card) {
    const [deckId, cardId, extra] = key.slice(PREFIXES.card.length).split("/");
    if (!deckId || !cardId || extra !== undefined) continue;
    const p = CardSchema.safeParse(value);
    if (!p.success) continue;
    let m = cards.get(deckId);
    if (!m) cards.set(deckId, (m = new Map()));
    m.set(cardId, p.data);
  }
  const srs = new Map<string, Srs>();
  for (const { key, value } of raw.srs) {
    const p = SrsSchema.safeParse(value);
    if (p.success) srs.set(key.slice(PREFIXES.srs.length), p.data);
  }
  const susp = new Set<string>();
  for (const { key, value } of raw.susp) if (value === true) susp.add(key.slice(PREFIXES.susp.length));
  return { decks, cards, srs, susp };
}

// ---------------------------------------------------------------------------------------------
// Views

const SEED_VIEWS: DeckView[] = SEED_DECKS.map(({ id, name, course, session }) => ({ id, name, course, session, seed: true }));
const COURSES: Course[] = COURSE_DATA.map((c) => c.id);
const bySession = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity);
const byName = (a: string, b: string) => a.localeCompare(b, "es");

function deckViews(ix: Index): DeckView[] {
  const user: DeckView[] = [...ix.decks].map(([id, d]) => ({ id, ...d, seed: false }));
  return [...SEED_VIEWS, ...user].sort(
    (a, b) =>
      COURSES.indexOf(a.course) - COURSES.indexOf(b.course) || bySession(a.session, b.session) || byName(a.name, b.name),
  );
}

function cardsOf(ix: Index, deck: DeckView): CardView[] {
  const meta = (id: string) => ({ srs: ix.srs.get(id) ?? null, suspended: ix.susp.has(id) });
  if (deck.seed) {
    return seedCards(deck.id).map((c) => ({ id: c.id, deckId: deck.id, course: deck.course, front: c.front, back: c.back, ...(c.mono ? { mono: true } : {}), seed: true, ...meta(c.id) }));
  }
  const m = ix.cards.get(deck.id);
  if (!m) return [];
  return [...m].map(([id, c]) => ({ id, deckId: deck.id, course: deck.course, front: c.front, back: c.back, seed: false, ...meta(id) }));
}

function useIndex(): Index {
  const deck = useKvPrefix<unknown>(PREFIXES.deck);
  const card = useKvPrefix<unknown>(PREFIXES.card);
  const srs = useKvPrefix<unknown>(PREFIXES.srs);
  const susp = useKvPrefix<unknown>(PREFIXES.susp);
  mirror = { deck, card, srs, susp };
  useEffect(() => {
    mounted++;
    return () => {
      mounted--;
    };
  }, []);
  return useMemo(() => index({ deck, card, srs, susp }), [deck, card, srs, susp]);
}

/** Seed decks plus deck/*, sorted by course, then session (General last), then name. */
export function useDecks(): DeckView[] {
  const ix = useIndex();
  return useMemo(() => deckViews(ix), [ix]);
}

/** Cards of one deck with their schedule and suspension. Unknown deck: []. */
export function useDeckCards(deckId: string): CardView[] {
  const ix = useIndex();
  return useMemo(() => {
    const deck = deckViews(ix).find((d) => d.id === deckId);
    return deck ? cardsOf(ix, deck) : [];
  }, [ix, deckId]);
}

/**
 * Every card of every existing deck. Order sets which new cards are introduced first: by session
 * (Sesión 1, Sesión 2, …, General last), then course, then name, so the dictionary's 02MIAR
 * sessions come before the 01MIAR Python deck. Cards of deleted decks and srs/ of deleted cards
 * never appear.
 */
function allCards(ix: Index): CardView[] {
  const decks = deckViews(ix).sort(
    (a, b) =>
      bySession(a.session, b.session) || COURSES.indexOf(b.course) - COURSES.indexOf(a.course) || byName(a.name, b.name),
  );
  return decks.flatMap((d) => cardsOf(ix, d));
}

export function useAllCards(): CardView[] {
  const ix = useIndex();
  return useMemo(() => allCards(ix), [ix]);
}

const capOf = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 200 ? v : DEFAULT_NEW_CARDS_PER_DAY;

/** «N tarjetas para hoy», recomputed when the local civil day changes (checked every minute). */
export function useDueSummary(): DueSummary {
  const cards = useAllCards();
  const today = localCivilDate(useNow(60_000));
  const cap = capOf(useKv<unknown>(keys.pref.newCardsPerDay, DEFAULT_NEW_CARDS_PER_DAY));
  return useMemo(() => dueSummary(cards, today, cap), [cards, today, cap]);
}

// ---------------------------------------------------------------------------------------------
// Actions

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 12 chars of [a-z0-9] from crypto.getRandomValues, never in a seed namespace (USER_ID_RE). */
export function newId(): string {
  for (;;) {
    let id = "";
    while (id.length < 12) {
      const buf = crypto.getRandomValues(new Uint8Array(16));
      for (const b of buf) {
        // 252 = 7 × 36: rejection sampling keeps the alphabet uniform.
        if (b < 252 && id.length < 12) id += ID_ALPHABET[b % 36];
      }
    }
    if (USER_ID_RE.test(id)) return id;
  }
}

const todayLocal = () => localCivilDate(Date.now());

function assertUserId(id: string, what: string) {
  if (!USER_ID_RE.test(id)) throw new Error(`${what} no editable: ${id}`);
}

/** Grades a card (first grade of the local day schedules; later ones keep the stored state). */
export function gradeCard(cardId: string, q: Quality): { prev: Srs | null; next: Srs } {
  const prev = index(currentRaw()).srs.get(cardId) ?? null;
  const next = review(prev, q, todayLocal());
  if (next !== prev) write(keys.srs(cardId), next);
  return { prev, next };
}

/** Undo of gradeCard: puts back the previous schedule, or removes it for a card that was new. */
export function restoreSrs(cardId: string, prev: Srs | null): void {
  if (prev) write(keys.srs(cardId), prev);
  else write(keys.srs(cardId), null);
}

export function saveDeck(id: string | null, value: Deck): string {
  const deck = DeckSchema.parse(value);
  const deckId = id ?? newId();
  assertUserId(deckId, "Mazo");
  write(keys.deck(deckId), deck);
  return deckId;
}

/** Tombstones the deck, every card in it and their schedule and suspension. */
export function deleteDeck(id: string): void {
  assertUserId(id, "Mazo");
  const ix = index(currentRaw());
  for (const cardId of ix.cards.get(id)?.keys() ?? []) {
    write(keys.card(id, cardId), null);
    if (ix.srs.has(cardId)) write(keys.srs(cardId), null);
    if (ix.susp.has(cardId)) write(keys.susp(cardId), null);
  }
  write(keys.deck(id), null);
}

export function saveCard(deckId: string, cardId: string | null, value: Card): string {
  assertUserId(deckId, "Mazo");
  const card = CardSchema.parse(value);
  const id = cardId ?? newId();
  assertUserId(id, "Tarjeta");
  write(keys.card(deckId, id), card);
  return id;
}

/** Deletes a user card with its schedule and suspension; the snapshot feeds «Deshacer». */
export function deleteCard(deckId: string, cardId: string): CardSnapshot {
  assertUserId(deckId, "Mazo");
  assertUserId(cardId, "Tarjeta");
  const ix = index(currentRaw());
  const card = ix.cards.get(deckId)?.get(cardId);
  if (!card) throw new Error(`Tarjeta inexistente: ${cardId}`);
  const snap: CardSnapshot = { deckId, cardId, card, srs: ix.srs.get(cardId) ?? null, suspended: ix.susp.has(cardId) };
  write(keys.card(deckId, cardId), null);
  if (snap.srs) write(keys.srs(cardId), null);
  if (snap.suspended) write(keys.susp(cardId), null);
  return snap;
}

export function restoreCard(s: CardSnapshot): void {
  write(keys.card(s.deckId, s.cardId), s.card);
  if (s.srs) write(keys.srs(s.cardId), s.srs);
  if (s.suspended) write(keys.susp(s.cardId), true);
}

/** Suspension works for seed and user cards alike (susp/<cardId>); reactivating tombstones it. */
export function setSuspended(cardId: string, on: boolean): void {
  if (on) write(keys.susp(cardId), true);
  else write(keys.susp(cardId), null);
}
