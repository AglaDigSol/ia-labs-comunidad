import { describe, expect, it } from "vitest";
import { COURSES } from "../content/courses/index.ts";
import {
  BLOCK_MIN,
  MH_THRESHOLD,
  accumulate,
  finalOutcome,
  formatGrade,
  mention,
  minAverage,
  minExam,
  parseGrade,
  portfolioGrade,
  targetsFor,
} from "./grades.ts";

const c1 = COURSES[0]!;
const c2 = COURSES[1]!;
const all10 = { ev1: 1000, ev2: 1000, ev3: 1000, ev4: 1000 };

describe("parseGrade", () => {
  it("parses comma and dot decimals into hundredths", () => {
    expect(parseGrade("6,5")).toEqual({ ok: true, value100: 650 });
    expect(parseGrade("6.5")).toEqual({ ok: true, value100: 650 });
    expect(parseGrade("7,25")).toEqual({ ok: true, value100: 725 });
    expect(parseGrade("10")).toEqual({ ok: true, value100: 1000 });
    expect(parseGrade("0")).toEqual({ ok: true, value100: 0 });
    expect(parseGrade(" 8 ")).toEqual({ ok: true, value100: 800 });
    expect(parseGrade("")).toEqual({ ok: true, value100: null });
    expect(parseGrade("  ")).toEqual({ ok: true, value100: null });
  });
  it("rejects out-of-range and malformed input", () => {
    for (const bad of ["10,1", "-1", "abc", "6,555", "1e1", "100", "11"]) {
      expect(parseGrade(bad)).toEqual({ ok: false, error: "La nota debe estar entre 0 y 10." });
    }
  });
});

describe("formatGrade", () => {
  it("formats with a decimal comma", () => {
    expect(formatGrade(650)).toBe("6,5");
    expect(formatGrade(725)).toBe("7,3");
    expect(formatGrade(875, "ceil")).toBe("8,8");
    expect(formatGrade(750, "ceil")).toBe("7,5");
    expect(formatGrade(1000)).toBe("10,0");
    expect(formatGrade(0)).toBe("0,0");
  });
});

describe("minExam", () => {
  it("01MIAR all 10", () => {
    const acc = accumulate(c1.components, all10);
    expect(acc.accum).toBe(60000);
    expect(portfolioGrade(acc)).toBe(1000);
    expect(acc.allPortfolioEntered).toBe(true);
    expect(minExam(900, acc, 40)).toEqual({ status: "ok", needed100: 750, byBlockMin: false });
    const mh = minExam(950, acc, 40);
    expect(mh.needed100).toBe(875);
    expect(formatGrade(mh.needed100, "ceil")).toBe("8,8");
    expect(minExam(500, acc, 40)).toEqual({ status: "ok", needed100: 500, byBlockMin: true });
  });
  it("float-noise case", () => {
    const acc = accumulate(c1.components, { ev1: 630, ev2: 710, ev3: 890, ev4: 670 });
    expect(acc.accum).toBe(42400);
    expect(minExam(500, acc, 40)).toEqual({ status: "ok", needed100: 500, byBlockMin: true });
    expect(minExam(900, acc, 40).status).toBe("unreachable");
  });
  it("02MIAR nothing entered", () => {
    const acc = accumulate(c2.components, {});
    expect(acc.allPortfolioEntered).toBe(false);
    expect(minExam(900, acc, 50).status).toBe("unreachable");
    expect(minExam(500, acc, 50)).toEqual({ status: "ok", needed100: 1000, byBlockMin: false });
  });
  it("blocked when the complete portfolio is under 5,0", () => {
    const vals = { "test-rn": 400, "test-papers": 400, practicas: 400, foro: 400 };
    const acc = accumulate(c2.components, vals);
    expect(portfolioGrade(acc)).toBe(400);
    expect(acc.allPortfolioEntered).toBe(true);
    for (const t of [500, 900, 950]) expect(minExam(t, acc, 50).status).toBe("blocked");
    const out = finalOutcome(accumulate(c2.components, { ...vals, exam: 1000 }), 50);
    expect(out).toMatchObject({ final100: 700, passed: false, failedBlock: "portfolio" });
    expect(mention(700, out!.passed, 950)).toBe("Suspenso");
  });
  it("partial portfolio is never blocked", () => {
    const acc = accumulate(c2.components, { "test-rn": 400 });
    expect(acc.allPortfolioEntered).toBe(false);
    for (const t of [500, 900, 950]) expect(minExam(t, acc, 50).status).not.toBe("blocked");
    const out = finalOutcome(accumulate(c2.components, { "test-rn": 400, exam: 1000 }), 50);
    expect(out).toMatchObject({ provisional: true, passed: null, failedBlock: null });
  });
  it("needing more than 10 is unreachable", () => {
    const acc = accumulate(c1.components, {});
    expect(minExam(900, { ...acc, accum: 90000 - 40 * 1001 }, 40).status).toBe("unreachable");
    expect(minExam(900, { ...acc, accum: 90000 - 40 * 1000 }, 40).status).toBe("ok");
  });
});

describe("finalOutcome", () => {
  it("returns null without exam", () => {
    expect(finalOutcome(accumulate(c1.components, all10), 40)).toBeNull();
  });
  it("exam block rule", () => {
    const f4 = finalOutcome(accumulate(c1.components, { ...all10, exam: 400 }), 40);
    expect(f4).toMatchObject({ final100: 760, passed: false, failedBlock: "exam", provisional: false });
    const f5 = finalOutcome(accumulate(c1.components, { ...all10, exam: 500 }), 40);
    expect(f5).toMatchObject({ final100: 800, passed: true, failedBlock: null });
    expect(mention(f5!.final100, f5!.passed, 950)).toBe("Notable");
  });
});

describe("mention", () => {
  it("thresholds", () => {
    expect(mention(500, true, 950)).toBe("Aprobado");
    expect(mention(699, true, 950)).toBe("Aprobado");
    expect(mention(700, true, 950)).toBe("Notable");
    expect(mention(899, true, 950)).toBe("Notable");
    expect(mention(900, true, 950)).toBe("Sobresaliente");
    expect(mention(949, true, 950)).toBe("Sobresaliente");
    expect(mention(950, true, 950)).toBe("Matrícula de Honor");
    expect(mention(940, true, 930)).toBe("Matrícula de Honor");
    expect(mention(499, true, 950)).toBe("Suspenso");
    expect(mention(1000, false, 950)).toBe("Suspenso");
    expect(mention(600, null, 950)).toBe("Aprobado");
  });
});

describe("constants and targets", () => {
  it("defaults", () => {
    expect(MH_THRESHOLD).toBe(9.5);
    expect(BLOCK_MIN).toBe(500);
    expect(targetsFor(930).map((t) => t.target100)).toEqual([500, 900, 930]);
    expect(targetsFor(930)[2]!.label).toBe("Matrícula de Honor · 9,3");
    expect(targetsFor(930)[0]!.label).toBe("Aprobar · 5,0");
  });
});

describe("minAverage", () => {
  it("empty: every remaining component is pending, so the average covers everything", () => {
    const acc = accumulate(c2.components, {});
    expect(minAverage(500, acc, 50)).toEqual({ status: "ok", needed100: 500, byBlockMin: false });
    expect(minAverage(900, acc, 50)).toEqual({ status: "ok", needed100: 900, byBlockMin: false });
    expect(minAverage(1001, acc, 50).status).toBe("unreachable");
  });
  it("02MIAR with only Test 1 = 8,0", () => {
    const acc = accumulate(c2.components, { "test-rn": 800 });
    // accum 6400 over 92 remaining points
    expect(minAverage(500, acc, 50)).toEqual({ status: "ok", needed100: 500, byBlockMin: true });
    expect(minAverage(900, acc, 50)).toEqual({ status: "ok", needed100: 909, byBlockMin: false });
    expect(minAverage(950, acc, 50)).toEqual({ status: "ok", needed100: 964, byBlockMin: false });
    expect(formatGrade(964, "ceil")).toBe("9,7");
  });
  it("unreachable only when 10 everywhere is not enough", () => {
    const acc = accumulate(c2.components, { "test-rn": 0, "test-papers": 0 });
    expect(minAverage(900, acc, 50).status).toBe("unreachable");
    expect(minAverage(500, acc, 50)).toEqual({ status: "ok", needed100: 834, byBlockMin: true });
  });
  it("portfolio block can dominate the target", () => {
    const acc = accumulate(c2.components, { "test-rn": 0, "test-papers": 0, practicas: 0 });
    // pending portfolio = foro (10%): 500*50 / 10 = 2500 > 1000 -> unreachable despite a low target
    expect(minAverage(500, acc, 50).status).toBe("unreachable");
  });
  it("full portfolio: minExam keeps governing", () => {
    const acc = accumulate(c1.components, all10);
    expect(minExam(900, acc, 40).needed100).toBe(750);
  });
});

// Casos límite: suspensos, mínimos por bloque y redondeos.
describe("edge cases", () => {
  const m01 = COURSES.find((c) => c.id === "01MIAR")!;
  const m02 = COURSES.find((c) => c.id === "02MIAR")!;
  const all = (course: typeof m01, portfolio: number, exam: number | null) =>
    accumulate(
      course.components,
      Object.fromEntries(course.components.map((c) => [c.id, c.isExam ? exam : portfolio])),
    );

  it("exam exactly 5,0 and portfolio exactly 5,0 pass with 5,0 (Aprobado)", () => {
    const o = finalOutcome(all(m01, 500, 500), m01.examWeightPct)!;
    expect(o).toEqual({ final100: 500, passed: true, provisional: false, failedBlock: null });
    expect(mention(o.final100, o.passed, 950)).toBe("Aprobado");
  });

  it("exam 4,99 fails even with a 10 portfolio (Suspenso por bloque de examen)", () => {
    const o = finalOutcome(all(m01, 1000, 499), m01.examWeightPct)!;
    expect(o.final100).toBe(800);
    expect(o.passed).toBe(false);
    expect(o.failedBlock).toBe("exam");
    expect(mention(o.final100, o.passed, 950)).toBe("Suspenso");
  });

  it("portfolio 4,99 fails even with a 10 exam (Suspenso por bloque de portafolio)", () => {
    const o = finalOutcome(all(m02, 499, 1000), m02.examWeightPct)!;
    expect(o.final100).toBe(750);
    expect(o.passed).toBe(false);
    expect(o.failedBlock).toBe("portfolio");
  });

  it("both blocks at 0 is Suspenso with 0,0", () => {
    const o = finalOutcome(all(m02, 0, 0), m02.examWeightPct)!;
    expect(o.final100).toBe(0);
    expect(formatGrade(o.final100)).toBe("0,0");
    expect(mention(o.final100, o.passed, 950)).toBe("Suspenso");
  });

  it("rounds half up to one decimal: 6,45 → 6,5 and 6,44 → 6,4; ceil mode never rounds a minimum down", () => {
    expect(formatGrade(645)).toBe("6,5");
    expect(formatGrade(644)).toBe("6,4");
    expect(formatGrade(641, "ceil")).toBe("6,5");
    expect(formatGrade(640, "ceil")).toBe("6,4");
  });

  it("final grade rounds to the nearest hundredth without floats (0,5 hundredths go up)", () => {
    // 01MIAR: 60 % portfolio at 7,25 and 40 % exam at 6,13 → (60·725 + 40·613) / 100 = 680,2 → 680.
    expect(finalOutcome(all(m01, 725, 613), m01.examWeightPct)!.final100).toBe(680);
    // 02MIAR: 50 % at 6,01 and 50 % at 6,02 → 601,5 → 602.
    expect(finalOutcome(all(m02, 601, 602), m02.examWeightPct)!.final100).toBe(602);
  });

  it("mention thresholds are inclusive: 7,0 Notable, 9,0 Sobresaliente, MH at the threshold", () => {
    expect(mention(699, true, 950)).toBe("Aprobado");
    expect(mention(700, true, 950)).toBe("Notable");
    expect(mention(899, true, 950)).toBe("Notable");
    expect(mention(900, true, 950)).toBe("Sobresaliente");
    expect(mention(949, true, 950)).toBe("Sobresaliente");
    expect(mention(950, true, 950)).toBe("Matrícula de Honor");
  });

  it("minimum exam never drops below the 5,0 block minimum, even with a perfect portfolio", () => {
    const r = minExam(500, all(m01, 1000, null), m01.examWeightPct);
    expect(r).toEqual({ status: "ok", needed100: 500, byBlockMin: true });
  });

  it("a minimum exam of exactly 10,0 is reachable; 10,01 is not", () => {
    // 02MIAR, portfolio 8,0 → accum 50·800; target 9,0 needs (90000 − 40000)/50 = 1000.
    expect(minExam(900, all(m02, 800, null), m02.examWeightPct)).toEqual({ status: "ok", needed100: 1000, byBlockMin: false });
    expect(minExam(901, all(m02, 800, null), m02.examWeightPct).status).toBe("unreachable");
  });
});
