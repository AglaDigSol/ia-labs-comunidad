import { NOTATION } from "../../content/notation/index.ts";

export type F1Name = string;
type Bit = 0 | 1;
type Pair = readonly [Bit, Bit];

// Valores (x(0), x(1)) de cada elemento de F₁, tomados de content/notation/.
export const F1: Record<F1Name, Pair> = Object.fromEntries(NOTATION.f1.map((e) => [e.name, e.values]));
export const F1_NAMES: F1Name[] = NOTATION.f1.map((e) => e.name);

export function f1Name(pair: Pair): F1Name {
  const found = F1_NAMES.find((n) => F1[n]![0] === pair[0] && F1[n]![1] === pair[1]);
  if (!found) throw new Error("pair not in F1");
  return found;
}

export function f1Table(op: "suma" | "producto"): Record<F1Name, Record<F1Name, F1Name>> {
  const combine = (x: Bit, y: Bit): Bit => (op === "suma" ? ((x | y) as Bit) : ((x & y) as Bit));
  const out: Record<F1Name, Record<F1Name, F1Name>> = {};
  for (const r of F1_NAMES) {
    const row: Record<F1Name, F1Name> = {};
    for (const c of F1_NAMES) {
      row[c] = f1Name([combine(F1[r]![0], F1[c]![0]), combine(F1[r]![1], F1[c]![1])]);
    }
    out[r] = row;
  }
  return out;
}
