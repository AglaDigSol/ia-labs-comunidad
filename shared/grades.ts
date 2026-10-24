// Integer grade engine. Units: grades are integer hundredths on a 0..1000 scale (6,5 = 650);
// weights are integer percent. No float arithmetic anywhere. Pure module (no imports from src/).
// Evaluation rule: overall >= 5,0 AND portfolio block >= 5,0 AND exam >= 5,0.
import type { GradeComponent } from "./courses/types.ts";

/** Default Matricula de Honor threshold (user override lives in pref/mhThreshold). */
export const MH_THRESHOLD = 9.5;
/** Minimum grade (hundredths) required in the portfolio block and in the exam block. */
export const BLOCK_MIN = 500;

export type Mention = "Suspenso" | "Aprobado" | "Notable" | "Sobresaliente" | "Matrícula de Honor";

export function targetsFor(mh100: number) {
  return [
    { id: "aprobar", label: "Aprobar · 5,0", target100: 500 },
    { id: "sobresaliente", label: "Sobresaliente · 9,0", target100: 900 },
    { id: "mh", label: `Matrícula de Honor · ${formatGrade(mh100)}`, target100: mh100 },
  ] as const;
}

const RANGE_ERROR = "La nota debe estar entre 0 y 10." as const;
export type ParseResult = { ok: true; value100: number | null } | { ok: false; error: typeof RANGE_ERROR };

const GRADE_RE = /^\s*(\d{1,2})(?:[.,](\d{1,2}))?\s*$/;

export function parseGrade(input: string): ParseResult {
  if (input.trim() === "") return { ok: true, value100: null };
  const m = GRADE_RE.exec(input);
  if (!m) return { ok: false, error: RANGE_ERROR };
  const frac = (m[2] ?? "").padEnd(2, "0");
  const value100 = Number(m[1]) * 100 + Number(frac);
  if (value100 > 1000) return { ok: false, error: RANGE_ERROR };
  return { ok: true, value100 };
}

export function formatGrade(value100: number, mode: "round" | "ceil" = "round"): string {
  const tenths = mode === "ceil" ? Math.floor((value100 + 9) / 10) : Math.floor((value100 + 5) / 10);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}

export type Accum = {
  accum: number;
  enteredWeightPct: number;
  portfolioWeightPct: number;
  allPortfolioEntered: boolean;
  exam100: number | null;
};

export function accumulate(
  components: readonly GradeComponent[],
  values: Readonly<Record<string, number | null | undefined>>,
): Accum {
  let accum = 0;
  let enteredWeightPct = 0;
  let portfolioWeightPct = 0;
  let allPortfolioEntered = true;
  let exam100: number | null = null;
  for (const c of components) {
    const v = values[c.id];
    if (c.isExam) {
      exam100 = typeof v === "number" ? v : null;
      continue;
    }
    portfolioWeightPct += c.weightPct;
    if (typeof v === "number") {
      accum += c.weightPct * v;
      enteredWeightPct += c.weightPct;
    } else {
      allPortfolioEntered = false;
    }
  }
  return { accum, enteredWeightPct, portfolioWeightPct, allPortfolioEntered, exam100 };
}

/** Portfolio grade in hundredths; pending components count as 0. */
export function portfolioGrade(acc: Accum): number {
  if (acc.portfolioWeightPct === 0) return 0;
  return Math.floor((2 * acc.accum + acc.portfolioWeightPct) / (2 * acc.portfolioWeightPct));
}

export type MinExam = { status: "ok" | "unreachable" | "blocked"; needed100: number; byBlockMin: boolean };

export function minExam(target100: number, acc: Accum, examWeightPct: number): MinExam {
  if (acc.allPortfolioEntered && portfolioGrade(acc) < BLOCK_MIN) {
    return { status: "blocked", needed100: 0, byBlockMin: false };
  }
  const raw = 100 * target100 - acc.accum;
  const rawNeeded = raw <= 0 ? 0 : Math.floor((raw + examWeightPct - 1) / examWeightPct);
  const needed100 = Math.max(BLOCK_MIN, rawNeeded);
  return {
    status: needed100 > 1000 ? "unreachable" : "ok",
    needed100,
    byBlockMin: rawNeeded < BLOCK_MIN,
  };
}

export type MinAverage = { status: "ok" | "unreachable"; needed100: number; byBlockMin: boolean };

/**
 * Partial portfolio: the minimum AVERAGE (hundredths) needed across every remaining component
 * (pending portfolio items + the exam if not entered, weighted) to reach target100, honouring the
 * block-minimum rule (exam >= 5,0 and portfolio >= 5,0). Unreachable only if even 10 everywhere is not enough.
 */
export function minAverage(target100: number, acc: Accum, examWeightPct: number): MinAverage {
  const pendingPortfolioPct = acc.portfolioWeightPct - acc.enteredWeightPct;
  const examPending = acc.exam100 === null;
  const remainingPct = pendingPortfolioPct + (examPending ? examWeightPct : 0);
  const base = acc.accum + (examPending ? 0 : examWeightPct * (acc.exam100 ?? 0));
  if (remainingPct <= 0) return { status: "unreachable", needed100: 0, byBlockMin: false };
  const ceilDiv = (n: number, d: number) => (n <= 0 ? 0 : Math.floor((n + d - 1) / d));
  const forTarget = ceilDiv(100 * target100 - base, remainingPct);
  // Portfolio block >= 5,0 requires the same average on the pending portfolio items.
  const forPortfolio =
    pendingPortfolioPct > 0 ? ceilDiv(BLOCK_MIN * acc.portfolioWeightPct - acc.accum, pendingPortfolioPct) : 0;
  const forExam = examPending ? BLOCK_MIN : 0;
  const needed100 = Math.max(forTarget, forPortfolio, forExam);
  return {
    status: needed100 > 1000 ? "unreachable" : "ok",
    needed100,
    byBlockMin: needed100 > forTarget,
  };
}

export type Outcome = {
  final100: number;
  passed: boolean | null;
  provisional: boolean;
  failedBlock: "portfolio" | "exam" | null;
};

export function finalOutcome(acc: Accum, examWeightPct: number): Outcome | null {
  if (acc.exam100 === null) return null;
  const final100 = Math.floor((2 * (acc.accum + examWeightPct * acc.exam100) + 100) / 200);
  const provisional = !acc.allPortfolioEntered;
  const portfolioFails = acc.allPortfolioEntered && portfolioGrade(acc) < BLOCK_MIN;
  const failedBlock = portfolioFails ? "portfolio" : acc.exam100 < BLOCK_MIN ? "exam" : null;
  const passed =
    acc.exam100 < BLOCK_MIN ? false : provisional ? null : final100 >= BLOCK_MIN && !portfolioFails;
  return { final100, passed, provisional, failedBlock };
}

export function mention(final100: number, passed: boolean | null, mh100: number): Mention {
  if (passed === false || final100 < BLOCK_MIN) return "Suspenso";
  if (final100 >= mh100) return "Matrícula de Honor";
  if (final100 >= 900) return "Sobresaliente";
  if (final100 >= 700) return "Notable";
  return "Aprobado";
}
