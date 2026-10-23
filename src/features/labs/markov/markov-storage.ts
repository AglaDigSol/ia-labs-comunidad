// Local-only persistence of the Markov editor (UI-SPEC default). Strings only: never Frac/BigInt.

export const MARKOV_KEY = "ia-labs.markov.v1";
export const SIZES = [3, 4, 5] as const;
export type Size = (typeof SIZES)[number];

export const MAX_CELL = 32;
export const MAX_NAME = 16;
export const MIN_STEPS = 1;
export const MAX_UI_STEPS = 10;
const MAX_BYTES = 8 * 1024;

export interface MarkovDraft {
  v: 1;
  size: Size;
  names: string[];
  P: string[][];
  v0: string[];
  /** Reserved for the inverse-problem vector of plan 02-05. */
  vInv?: string[];
  n: number;
}

export const DEFAULT_NAMES = ["Leer", "Programar", "Descansar", "Estado 4", "Estado 5"];

const isStrings = (x: unknown, len: number, max: number): x is string[] =>
  Array.isArray(x) && x.length === len && x.every((s) => typeof s === "string" && s.length <= max);

export function isSize(x: unknown): x is Size {
  return x === 3 || x === 4 || x === 5;
}

export function parseDraft(raw: string): MarkovDraft | null {
  if (raw.length > MAX_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || !isSize(d.size)) return null;
  const size = d.size;
  if (!isStrings(d.names, size, MAX_NAME)) return null;
  if (!Array.isArray(d.P) || d.P.length !== size) return null;
  if (!d.P.every((row) => isStrings(row, size, MAX_CELL))) return null;
  if (!isStrings(d.v0, size, MAX_CELL)) return null;
  if (typeof d.n !== "number" || !Number.isInteger(d.n) || d.n < MIN_STEPS || d.n > MAX_UI_STEPS) return null;
  const out: MarkovDraft = {
    v: 1,
    size,
    names: d.names,
    P: d.P as string[][],
    v0: d.v0,
    n: d.n,
  };
  if (d.vInv !== undefined) {
    if (!isStrings(d.vInv, size, MAX_CELL)) return null;
    out.vInv = d.vInv;
  }
  return out;
}

export function loadMarkovDraft(): MarkovDraft | null {
  try {
    const raw = localStorage.getItem(MARKOV_KEY);
    return raw === null ? null : parseDraft(raw);
  } catch {
    return null;
  }
}

export function saveMarkovDraft(draft: MarkovDraft): void {
  try {
    localStorage.setItem(MARKOV_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable or full: the editor keeps working in memory
  }
}
