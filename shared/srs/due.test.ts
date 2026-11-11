import { describe, expect, it } from "vitest";
import { buildQueue, deckDays, dueSummary, sessionStep, type CardView } from "./due.ts";
import type { Srs } from "./types.ts";

const TODAY = "2026-10-30";
const TOMORROW = "2026-10-31";

const srs = (due: string, extra: Partial<Srs> = {}): Srs => ({
  ef: 2.5,
  n: 1,
  interval: 1,
  due,
  last: "2026-10-20",
  introduced: "2026-10-20",
  lapses: 0,
  ...extra,
});

function card(id: string, over: Partial<CardView> = {}): CardView {
  return {
    id,
    deckId: "sym-02-s1",
    course: "02MIAR",
    front: "f",
    back: "b",
    seed: true,
    srs: null,
    suspended: false,
    ...over,
  };
}

const newCards = (n: number, over: Partial<CardView> = {}) =>
  Array.from({ length: n }, (_, i) => card(`sym-n${String(i).padStart(2, "0")}`, over));

describe("dueSummary", () => {
  it("caps new cards at newCap per day", () => {
    const s = dueSummary(newCards(30), TODAY, 20);
    expect(s).toMatchObject({ total: 20, newAvailable: 20, dueReviews: 0, hasCards: true });
  });

  it("subtracts the cards introduced today from the cap", () => {
    const introduced = Array.from({ length: 5 }, (_, i) =>
      card(`sym-i${i}`, { srs: srs(TOMORROW, { introduced: TODAY, last: TODAY }) }),
    );
    const s = dueSummary([...introduced, ...newCards(30)], TODAY, 20);
    expect(s.newAvailable).toBe(15);
    expect(s.total).toBe(15);
  });

  it("counts due reviews and ignores suspended cards", () => {
    const cards = [
      card("sym-a", { srs: srs(TODAY) }),
      card("sym-b", { srs: srs("2026-10-28") }),
      card("sym-c", { srs: srs(TODAY) }),
      card("sym-d", { srs: srs(TOMORROW) }),
      card("sym-e", { srs: srs(TOMORROW) }),
      card("sym-f", { srs: srs(TODAY), suspended: true }),
      card("sym-g", { suspended: true }),
    ];
    const s = dueSummary(cards, TODAY, 20);
    expect(s.dueReviews).toBe(3);
    expect(s.newAvailable).toBe(0);
    expect(s.total).toBe(3);
    expect(s.next).toEqual({ date: TOMORROW, count: 2 });
  });

  it("points at the next review day once today's reviews are done", () => {
    const cards = [
      card("sym-a", { srs: srs(TOMORROW, { last: TODAY }) }),
      card("sym-d", { srs: srs(TOMORROW) }),
      card("sym-e", { srs: srs(TOMORROW) }),
      card("sym-x", { srs: srs("2026-11-12") }),
      card("sym-f", { srs: srs(TODAY), suspended: true }),
    ];
    const s = dueSummary(cards, TODAY, 20);
    expect(s.total).toBe(0);
    expect(s.next).toEqual({ date: TOMORROW, count: 3 });
  });

  it("counts new cards held back by the cap as tomorrow's", () => {
    const introduced = Array.from({ length: 20 }, (_, i) =>
      card(`sym-i${String(i).padStart(2, "0")}`, { srs: srs("2026-11-05", { introduced: TODAY, last: TODAY }) }),
    );
    const s = dueSummary([...introduced, ...newCards(7)], TODAY, 20);
    expect(s.total).toBe(0);
    expect(s.next).toEqual({ date: TOMORROW, count: 7 });
  });

  it("splits the total by course", () => {
    const cards = [
      card("sym-a", { srs: srs(TODAY) }),
      card("symp-a", { deckId: "sym-01-py", course: "01MIAR", srs: srs(TODAY) }),
      ...newCards(3),
      ...newCards(2, { deckId: "sym-01-py", course: "01MIAR" }).map((c) => ({ ...c, id: c.id.replace("sym-", "symp-") })),
    ];
    const s = dueSummary(cards, TODAY, 20);
    expect(s.total).toBe(7);
    expect(s.byCourse).toEqual({ "01MIAR": 3, "02MIAR": 4 });
  });

  it("ignores schedules of cards that are not in the list and reports no cards for an empty list", () => {
    // The srs/ entry of a card deleted elsewhere never reaches the list: only listed cards count.
    const s = dueSummary([], TODAY, 20);
    expect(s).toEqual({
      total: 0,
      byCourse: {},
      dueReviews: 0,
      newAvailable: 0,
      next: null,
      hasCards: false,
    });
    expect(dueSummary([card("sym-a", { srs: srs(TOMORROW) })], TODAY, 20).hasCards).toBe(true);
  });
});

describe("per-deck new-card cap", () => {
  // 02MIAR Sesión 1 comes first in the new-card order; 01MIAR has 126 new cards.
  const s1 = newCards(30);
  const py = Array.from({ length: 126 }, (_, i) => card(`symp-n${i}`, { deckId: "sym-01-py", course: "01MIAR" }));

  it("gives each deck its own cap, so a big deck does not use up the others", () => {
    const s = dueSummary([...s1, ...py], TODAY, 20);
    expect(s.total).toBe(40);
    expect(s.byCourse).toEqual({ "01MIAR": 20, "02MIAR": 20 });
    const q = buildQueue([...s1, ...py], TODAY, 20);
    expect(q.filter((c) => c.deckId === "sym-01-py")).toHaveLength(20);
    expect(q.filter((c) => c.deckId === "sym-02-s1")).toHaveLength(20);
    // Tomorrow each deck brings up to 20 more: the 10 left in Sesión 1 and 20 of 01MIAR.
    expect(s.next).toEqual({ date: TOMORROW, count: 30 });
  });

  it("counts the cards introduced today against their own deck only", () => {
    const seen = Array.from({ length: 20 }, (_, i) =>
      card(`sym-i${String(i).padStart(2, "0")}`, { srs: srs("2026-11-05", { introduced: TODAY, last: TODAY }) }),
    );
    const days = deckDays([...seen, ...s1, ...py], TODAY, 20);
    expect(days.get("sym-02-s1")).toMatchObject({ today: 0, newToday: 0, introducedToday: 20, heldBack: 30, cap: 20 });
    expect(days.get("sym-01-py")).toMatchObject({ today: 20, newToday: 20, introducedToday: 0, heldBack: 106, fresh: 126, total: 126 });
  });

  it("adds today's extra new cards («Repasar 5 más») to that deck's cap", () => {
    const seen = Array.from({ length: 20 }, (_, i) =>
      card(`symp-i${String(i).padStart(2, "0")}`, {
        deckId: "sym-01-py",
        course: "01MIAR",
        srs: srs("2026-11-05", { introduced: TODAY, last: TODAY }),
      }),
    );
    const cards = [...seen, ...s1, ...py];
    expect(deckDays(cards, TODAY, 20).get("sym-01-py")).toMatchObject({ today: 0, heldBack: 126 });
    const more = deckDays(cards, TODAY, 20, { "sym-01-py": 5 });
    expect(more.get("sym-01-py")).toMatchObject({ today: 5, newToday: 5, cap: 25 });
    expect(more.get("sym-02-s1")).toMatchObject({ today: 20, cap: 20 });
    expect(buildQueue(cards, TODAY, 20, { "sym-01-py": 5 }).filter((c) => c.deckId === "sym-01-py")).toHaveLength(5);
    // Extras are for today only: tomorrow's count uses the plain cap.
    expect(dueSummary(cards, TODAY, 20, { "sym-01-py": 5 }).next).toEqual({ date: TOMORROW, count: 30 });
  });
});

describe("buildQueue", () => {
  it("puts due reviews first by due date then id, then new cards in input order up to the cap", () => {
    const cards = [
      card("sym-n2"),
      card("sym-c", { srs: srs(TODAY) }),
      card("sym-b", { srs: srs(TODAY) }),
      card("sym-a", { srs: srs("2026-10-25") }),
      card("sym-n1"),
      card("sym-z", { srs: srs(TOMORROW) }),
      card("sym-s", { srs: srs(TODAY), suspended: true }),
      card("sym-n3"),
    ];
    expect(buildQueue(cards, TODAY, 2).map((c) => c.id)).toEqual(["sym-a", "sym-b", "sym-c", "sym-n2", "sym-n1"]);
  });
});

describe("sessionStep", () => {
  it("sends Otra vez and Difícil to the end and removes Bien and Fácil", () => {
    expect(sessionStep(["a", "b", "c"], "a", 1)).toEqual(["b", "c", "a"]);
    expect(sessionStep(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
    expect(sessionStep(["a", "b", "c"], "a", 4)).toEqual(["b", "c"]);
    expect(sessionStep(["a", "b", "c"], "b", 5)).toEqual(["a", "c"]);
    expect(sessionStep(["a", "b"], "x", 4)).toEqual(["a", "b"]);
  });
});
