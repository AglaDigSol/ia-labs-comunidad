import { describe, expect, it } from "vitest";
import { buildQueue, dueSummary, sessionStep, type CardView } from "./due.ts";
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
