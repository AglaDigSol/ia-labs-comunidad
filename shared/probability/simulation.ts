// Simulación con semilla: repite N veces un experimento de un espacio finito y apunta cómo se mueve la
// frecuencia relativa de un suceso, que se acerca a su probabilidad (ley de los grandes números). El
// generador es el de los ejercicios (mulberry32): misma semilla, misma simulación.
import { createRng } from "../exercises/random.ts";
import { toNumber } from "../rational.ts";
import type { ProbEvent, SampleSpace } from "./events.ts";

export const MAX_TRIALS = 100_000;

export interface SimulationPoint {
  /** Repeticiones hechas. */
  n: number;
  /** Veces que ha ocurrido el suceso. */
  hits: number;
  /** Frecuencia relativa hits/n. */
  freq: number;
}

/** Puntos en los que se apunta la frecuencia: 1, 2, …, 10, y luego unos 40 por década. */
export function checkpoints(n: number): number[] {
  const out = new Set<number>();
  for (let i = 1; i <= Math.min(10, n); i++) out.add(i);
  for (let e = 1; 10 ** e < n; e++) {
    for (let j = 1; j <= 40; j++) out.add(Math.min(n, Math.round(10 ** (e + j / 40))));
  }
  out.add(n);
  return [...out].filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
}

export function simulateFrequency<T>(space: SampleSpace<T>, event: ProbEvent, n: number, seed: number): SimulationPoint[] {
  if (!Number.isInteger(n) || n < 1 || n > MAX_TRIALS) throw new RangeError(`entre 1 y ${MAX_TRIALS} repeticiones`);
  const rng = createRng(seed);
  const cumulative: number[] = [];
  let acc = 0;
  for (const w of space.weights) cumulative.push((acc += toNumber(w)));
  const marks = checkpoints(n);
  const out: SimulationPoint[] = [];
  let hits = 0;
  let m = 0;
  for (let i = 1; i <= n; i++) {
    const u = rng.next() * acc;
    let idx = cumulative.findIndex((c) => u < c);
    if (idx < 0) idx = cumulative.length - 1;
    if (event[idx]) hits++;
    if (i === marks[m]) {
      out.push({ n: i, hits, freq: hits / i });
      m++;
    }
  }
  return out;
}
