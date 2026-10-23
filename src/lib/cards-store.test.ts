// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { review } from "../../shared/srs/sm2.ts";
import { SEED_DECKS, seedCards } from "../../shared/srs/decks.ts";
import { USER_ID_RE } from "../../shared/srs/types.ts";
import {
  deleteCard,
  deleteDeck,
  gradeCard,
  newId,
  restoreCard,
  restoreSrs,
  saveCard,
  saveDeck,
  setSuspended,
  useAllCards,
  useDeckCards,
  useDecks,
  useDueSummary,
} from "./cards-store.ts";
import { __resetKvStoreForTests, setKv, useKv, useKvPrefix } from "./kv-store.ts";

beforeEach(() => {
  __resetKvStoreForTests();
  vi.useFakeTimers();
  // 12:00 local time on 30/10/2026.
  vi.setSystemTime(new Date(2026, 9, 30, 12, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TODAY = "2026-10-30";
const DECK = { name: "Mis fórmulas", course: "02MIAR" as const, session: 2 };

describe("ids", () => {
  it("newId makes 12-char user ids outside the seed namespaces", () => {
    for (let i = 0; i < 200; i++) {
      const id = newId();
      expect(id).toHaveLength(12);
      expect(id).toMatch(USER_ID_RE);
    }
  });
});

describe("grading", () => {
  it("gradeCard writes review(null, q, today) and returns prev and next", () => {
    const r = gradeCard("sym-x", 4);
    expect(r).toEqual({ prev: null, next: review(null, 4, TODAY) });
    const { result } = renderHook(() => useKv("srs/sym-x", null));
    expect(result.current).toEqual(review(null, 4, TODAY));
  });

  it("gradeCard starts from the stored schedule and restoreSrs undoes it", () => {
    const prev = review(null, 4, "2026-10-29");
    act(() => setKv("srs/sym-x", prev));
    const { result } = renderHook(() => useKv<unknown>("srs/sym-x", null));
    let out!: ReturnType<typeof gradeCard>;
    act(() => {
      out = gradeCard("sym-x", 4);
    });
    expect(out.prev).toEqual(prev);
    expect(out.next).toEqual(review(prev, 4, TODAY));
    expect(result.current).toEqual(out.next);
    act(() => restoreSrs("sym-x", prev));
    expect(result.current).toEqual(prev);
    act(() => restoreSrs("sym-x", null));
    expect(result.current).toBeNull();
  });

  it("a second grade on the same day does not reschedule", () => {
    const first = gradeCard("sym-x", 1).next;
    const second = gradeCard("sym-x", 5);
    expect(second.prev).toEqual(first);
    expect(second.next).toEqual(first);
  });

  it("ignores a stored schedule that fails validation", () => {
    act(() => setKv("srs/sym-x", { ef: 0.5 }));
    expect(gradeCard("sym-x", 4).prev).toBeNull();
  });
});

describe("decks and cards", () => {
  it("useDecks lists seed decks and user decks by course, session and name", () => {
    let id = "";
    act(() => {
      id = saveDeck(null, DECK);
    });
    expect(id).toMatch(USER_ID_RE);
    const { result } = renderHook(() => useDecks());
    expect(result.current.map((d) => d.id)).toEqual(["sym-01-py", "sym-02-s1", id, "sym-02-s2", "sym-02-gen"]);
    expect(result.current.find((d) => d.id === id)).toEqual({ id, ...DECK, seed: false });
    expect(result.current.find((d) => d.id === "sym-02-s1")!.seed).toBe(true);
  });

  it("saveCard writes card/<deck>/<id> with a 12-char id", () => {
    let deck = "";
    let card = "";
    act(() => {
      deck = saveDeck(null, DECK);
      card = saveCard(deck, null, { front: "$\\alpha$", back: "alfa" });
    });
    expect(card).toMatch(/^[a-z0-9]{12}$/);
    const { result } = renderHook(() => useKv(`card/${deck}/${card}`, null));
    expect(result.current).toEqual({ front: "$\\alpha$", back: "alfa" });
    const cards = renderHook(() => useDeckCards(deck)).result.current;
    expect(cards).toEqual([
      { id: card, deckId: deck, course: "02MIAR", front: "$\\alpha$", back: "alfa", seed: false, srs: null, suspended: false },
    ]);
    act(() => {
      saveCard(deck, card, { front: "$\\beta$", back: "beta" });
    });
    expect(renderHook(() => useDeckCards(deck)).result.current[0]!.back).toBe("beta");
  });

  it("refuses to write into seed decks or with invalid content", () => {
    expect(() => saveCard("sym-02-s1", null, { front: "a", back: "b" })).toThrow();
    expect(() => saveDeck("sym-02-s1", DECK)).toThrow();
    expect(() => saveDeck(null, { ...DECK, name: "" })).toThrow();
  });

  it("seed deck cards carry their schedule and suspension", () => {
    const first = seedCards("sym-02-s1")[0]!;
    act(() => {
      gradeCard(first.id, 4);
      setSuspended(first.id, true);
    });
    const { result } = renderHook(() => useDeckCards("sym-02-s1"));
    expect(result.current).toHaveLength(seedCards("sym-02-s1").length);
    expect(result.current[0]).toMatchObject({ id: first.id, seed: true, suspended: true, course: "02MIAR" });
    expect(result.current[0]!.srs).toEqual(review(null, 4, TODAY));
    act(() => setSuspended(first.id, false));
    expect(result.current[0]!.suspended).toBe(false);
    const susp = renderHook(() => useKvPrefix("susp/")).result.current;
    expect(susp).toEqual([]);
  });

  it("deleteCard returns a snapshot that restoreCard re-writes", () => {
    let deck = "";
    let card = "";
    act(() => {
      deck = saveDeck(null, DECK);
      card = saveCard(deck, null, { front: "f", back: "b" });
    });
    act(() => {
      gradeCard(card, 3);
      setSuspended(card, true);
    });
    const { result } = renderHook(() => useDeckCards(deck));
    const before = result.current[0]!;
    let snap!: ReturnType<typeof deleteCard>;
    act(() => {
      snap = deleteCard(deck, card);
    });
    expect(result.current).toEqual([]);
    expect(snap).toEqual({ deckId: deck, cardId: card, card: { front: "f", back: "b" }, srs: before.srs, suspended: true });
    expect(renderHook(() => useKvPrefix("srs/")).result.current).toEqual([]);
    act(() => restoreCard(snap));
    expect(result.current).toEqual([before]);
  });

  it("deleteDeck tombstones the deck, its cards and their schedule", () => {
    let deck = "";
    let other = "";
    act(() => {
      deck = saveDeck(null, DECK);
      other = saveDeck(null, { ...DECK, name: "Otro" });
      const a = saveCard(deck, null, { front: "a", back: "a" });
      const b = saveCard(deck, null, { front: "b", back: "b" });
      saveCard(other, null, { front: "c", back: "c" });
      gradeCard(a, 4);
      setSuspended(b, true);
    });
    act(() => deleteDeck(deck));
    expect(renderHook(() => useKvPrefix("deck/")).result.current.map((e) => e.key)).toEqual([`deck/${other}`]);
    expect(renderHook(() => useKvPrefix(`card/${deck}/`)).result.current).toEqual([]);
    expect(renderHook(() => useKvPrefix(`card/${other}/`)).result.current).toHaveLength(1);
    expect(renderHook(() => useKvPrefix("srs/")).result.current).toEqual([]);
    expect(renderHook(() => useKvPrefix("susp/")).result.current).toEqual([]);
    expect(() => deleteDeck("sym-02-s1")).toThrow();
  });

  it("useAllCards ignores orphan cards and schedules of deleted cards", () => {
    act(() => {
      setKv("card/abcdefghij12/zyxwvutsrq98", { front: "huérfana", back: "x" });
      setKv("srs/qwertyuiop12", review(null, 4, "2026-10-01"));
    });
    const { result } = renderHook(() => useAllCards());
    const seedTotal = SEED_DECKS.reduce((n, d) => n + seedCards(d.id).length, 0);
    expect(result.current).toHaveLength(seedTotal);
    // New cards are introduced session by session: 02MIAR Sesión 1 comes first.
    expect(result.current[0]!.deckId).toBe("sym-02-s1");
  });
});

describe("useDueSummary", () => {
  it("counts the seed decks with the new-card cap", () => {
    const { result } = renderHook(() => useDueSummary());
    expect(result.current).toMatchObject({ total: 20, newAvailable: 20, hasCards: true });
    expect(result.current.byCourse).toEqual({ "02MIAR": 20 });
    act(() => setKv("pref/newCardsPerDay", 5));
    expect(result.current.total).toBe(5);
  });

  it("re-computes when the local civil day changes", () => {
    // 23:59 local time on 30/10.
    vi.setSystemTime(new Date(2026, 9, 30, 23, 59));
    act(() => {
      setKv("pref/newCardsPerDay", 1);
      setKv("srs/sym-x", review(null, 4, "2026-10-29"));
    });
    const first = seedCards("sym-02-s1")[0]!;
    act(() => setKv(`srs/${first.id}`, review(null, 4, "2026-10-30")));
    const { result } = renderHook(() => useDueSummary());
    // Introduced today (30/10) uses the cap of 1: nothing left today.
    expect(result.current.total).toBe(0);
    expect(result.current.next?.date).toBe("2026-10-31");
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    // 00:00 local time on 31/10: the reviewed card is due and one new card is available.
    expect(result.current.total).toBe(2);
    expect(result.current.dueReviews).toBe(1);
  });
});
