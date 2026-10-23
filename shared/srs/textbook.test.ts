// SM-2 clásico (Woźniak, 1987) con casos calculados a mano:
//   EF' = EF + (0,1 − (5 − q)(0,08 + (5 − q)·0,02)), EF ≥ 1,3; I(1) = 1, I(2) = 6, I(n) = round(I(n−1)·EF).
import { describe, expect, it } from "vitest";
import { addDays, review, type Quality, type Srs } from "./sm2.ts";

function run(qs: Quality[], start = "2026-01-01"): Srs[] {
  const out: Srs[] = [];
  let s: Srs | null = null;
  let day = start;
  for (const q of qs) {
    s = review(s, q, day);
    out.push(s);
    day = s.due;
  }
  return out;
}

describe("SM-2 de libro", () => {
  it("siempre «Fácil» (q = 5): intervalos 1, 6, 16, 45 y EF 2,6 → 2,9", () => {
    const r = run([5, 5, 5, 5]);
    expect(r.map((s) => s.interval)).toEqual([1, 6, 16, 45]);
    expect(r.map((s) => s.ef)).toEqual([2.6, 2.7, 2.8, 2.9]);
  });

  it("siempre «Bien» (q = 4): el EF se queda en 2,5 e I(3) = 15", () => {
    const r = run([4, 4, 4, 4]);
    expect(r.map((s) => s.ef)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(r.map((s) => s.interval)).toEqual([1, 6, 15, 38]);
  });

  it("siempre «Difícil» (q = 3): el EF baja 0,14 cada vez", () => {
    const r = run([3, 3, 3]);
    expect(r.map((s) => s.ef)).toEqual([2.36, 2.22, 2.08]);
    expect(r.map((s) => s.interval)).toEqual([1, 6, 13]);
  });

  it("«Otra vez» (q = 1) reinicia la serie, cuenta un fallo y baja el EF 0,54", () => {
    const r = run([5, 5, 1]);
    expect(r[2]).toMatchObject({ n: 0, interval: 1, lapses: 1, ef: 2.16 });
    expect(r[2]!.due).toBe(addDays(r[1]!.due, 1));
  });

  it("el EF nunca baja de 1,3", () => {
    const r = run([1, 1, 1, 1, 1, 1]);
    expect(r.at(-1)!.ef).toBe(1.3);
  });

  it("repasar dos veces el mismo día no reprograma", () => {
    const a = review(null, 4, "2026-03-01");
    expect(review(a, 1, "2026-03-01")).toBe(a);
  });
});
