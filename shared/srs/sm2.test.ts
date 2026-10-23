import { describe, expect, it } from "vitest";
import { localCivilDate } from "../date.ts";
import { addDays, fmtInterval, nextIntervals, NEW_STATE, QUALITY, QUALITY_LABEL, review } from "./sm2.ts";
import { SrsSchema, type Srs } from "./types.ts";

describe("addDays (civil calendar arithmetic)", () => {
  it("crosses month, DST and year boundaries without drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 6)).toBe("2026-11-07");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-11-10", 0)).toBe("2026-11-10");
  });

  it("a card graded late on 31/10 (local time) is due on 01/11", () => {
    const ms = new Date(2026, 9, 31, 23, 30).getTime();
    const today = localCivilDate(ms);
    expect(today).toBe("2026-10-31");
    expect(review(null, QUALITY.bien, today).due).toBe("2026-11-01");
  });
});

describe("review (classic SM-2, A2)", () => {
  it("schedules 1, 6, then round(interval × EF)", () => {
    const a = review(null, 4, "2026-10-30");
    expect(a).toEqual({
      ef: 2.5,
      n: 1,
      interval: 1,
      due: "2026-10-31",
      last: "2026-10-30",
      introduced: "2026-10-30",
      lapses: 0,
    });
    const b = review(a, 4, "2026-10-31");
    expect(b).toMatchObject({ n: 2, interval: 6, due: "2026-11-06", introduced: "2026-10-30" });
    const c = review(b, 4, "2026-11-06");
    expect(c).toMatchObject({ n: 3, interval: 15, due: "2026-11-21" });
  });

  it("updates EF on every review, including Otra vez", () => {
    expect(review(null, 5, "2026-10-30").ef).toBe(2.6);
    expect(review(null, 3, "2026-10-30").ef).toBe(2.36);
    const lapse = review({ ...NEW_STATE("2026-10-01"), n: 3, interval: 15, last: "2026-10-15" }, 1, "2026-10-30");
    expect(lapse).toMatchObject({ ef: 1.96, n: 0, interval: 1, lapses: 1, due: "2026-10-31" });
  });

  it("never lets EF drop below 1.3", () => {
    let s: Srs | null = null;
    let day = "2026-10-01";
    for (let i = 0; i < 8; i++) {
      s = review(s, 1, day);
      expect(s.ef).toBeGreaterThanOrEqual(1.3);
      day = s.due;
    }
    expect(s!.ef).toBe(1.3);
    expect(s!.lapses).toBe(8);
  });

  it("is idempotent for re-grades on the same civil day", () => {
    const a = review(null, 4, "2026-10-30");
    for (const q of [1, 3, 4, 5] as const) expect(review(a, q, "2026-10-30")).toEqual(a);
  });

  it("ignores lateness on overdue cards", () => {
    const s: Srs = { ef: 2.5, n: 2, interval: 6, due: "2026-11-01", last: "2026-10-26", introduced: "2026-10-25", lapses: 0 };
    const r = review(s, 4, "2026-11-10");
    expect(r.interval).toBe(15);
    expect(r.due).toBe("2026-11-25");
  });

  it("stores EF with two decimals and every state parses", () => {
    let s: Srs | null = null;
    let day = "2026-10-01";
    const qs = [3, 3, 4, 1, 3, 5, 3, 1, 4, 3] as const;
    for (const q of qs) {
      s = review(s, q, day);
      expect(Math.round(s.ef * 100) / 100).toBe(s.ef);
      expect(SrsSchema.safeParse(s).success).toBe(true);
      day = s.due;
    }
  });

  it("ten Fácil in a row reach EF 3.5 with no clamp", () => {
    let s: Srs | null = null;
    let day = "2026-10-01";
    for (let i = 0; i < 10; i++) {
      s = review(s, 5, day);
      expect(SrsSchema.safeParse(s).success).toBe(true);
      day = s.due;
    }
    expect(s!.ef).toBe(3.5);
    // The 10th interval (round(12863 × 3.4)) exceeds the schema bound and is capped at 100 years.
    expect(s!.interval).toBe(36500);
  });

  it("does not mutate its input", () => {
    const a = review(null, 4, "2026-10-30");
    const copy = { ...a };
    review(a, 1, "2026-10-31");
    expect(a).toEqual(copy);
  });
});

describe("labels", () => {
  it("formats intervals", () => {
    expect(fmtInterval(0)).toBe("Hoy");
    expect(fmtInterval(1)).toBe("1 d");
    expect(fmtInterval(59)).toBe("59 d");
    expect(fmtInterval(60)).toBe("2 m");
    expect(fmtInterval(364)).toBe("12 m");
    expect(fmtInterval(400)).toBe("1 a");
  });

  it("shows the next interval under each button", () => {
    expect(nextIntervals(null, "2026-10-30")).toEqual({ 1: "Hoy", 3: "1 d", 4: "1 d", 5: "1 d" });
    const b = review(review(null, 4, "2026-10-30"), 4, "2026-10-31");
    expect(nextIntervals(b, "2026-11-06")).toEqual({ 1: "Hoy", 3: "15 d", 4: "15 d", 5: "15 d" });
    // Already graded today: the stored schedule stands.
    expect(nextIntervals(b, "2026-10-31")).toEqual({ 1: "Hoy", 3: "6 d", 4: "6 d", 5: "6 d" });
  });

  it("maps the four buttons to qualities 1, 3, 4, 5", () => {
    expect(QUALITY).toEqual({ otra: 1, dificil: 3, bien: 4, facil: 5 });
    expect(QUALITY_LABEL).toEqual({ 1: "Otra vez", 3: "Difícil", 4: "Bien", 5: "Fácil" });
    expect(NEW_STATE("2026-10-30")).toEqual({
      ef: 2.5,
      n: 0,
      interval: 0,
      due: "2026-10-30",
      last: null,
      introduced: "2026-10-30",
      lapses: 0,
    });
  });
});
