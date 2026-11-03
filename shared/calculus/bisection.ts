// Método de bisección para f(x) = 0 en [a, b] con f continua y f(a)·f(b) < 0 (teorema de Bolzano):
// cada iteración parte el intervalo por el punto medio m y se queda con la mitad donde f cambia de
// signo. Tras k iteraciones el intervalo mide (b − a)/2ᵏ.

export interface BisectionStep {
  /** Intervalo al empezar la iteración. */
  a: number;
  b: number;
  m: number;
  fa: number;
  fb: number;
  fm: number;
  /** Mitad con la que se queda (o «raiz» si f(m) = 0). */
  keep: "izquierda" | "derecha" | "raiz";
}

/** ¿Se puede aplicar? f continua (se supone) con signos opuestos en los extremos. */
export const bisectionApplies = (f: (x: number) => number, a: number, b: number) => a < b && f(a) * f(b) < 0;

/** Las `iterations` primeras iteraciones (para antes si f(m) = 0); null si no se puede aplicar. */
export function bisection(f: (x: number) => number, a: number, b: number, iterations: number): BisectionStep[] | null {
  if (!bisectionApplies(f, a, b)) return null;
  const steps: BisectionStep[] = [];
  let lo = a;
  let hi = b;
  for (let k = 0; k < iterations; k++) {
    const m = (lo + hi) / 2;
    const fa = f(lo);
    const fb = f(hi);
    const fm = f(m);
    const keep = fm === 0 ? "raiz" : Math.sign(fm) === Math.sign(fa) ? "derecha" : "izquierda";
    steps.push({ a: lo, b: hi, m, fa, fb, fm, keep });
    if (keep === "raiz") break;
    if (keep === "derecha") lo = m;
    else hi = m;
  }
  return steps;
}

/** Intervalo tras las iteraciones: el de después del último paso. */
export function bisectionInterval(steps: readonly BisectionStep[]): [number, number] {
  const last = steps[steps.length - 1]!;
  if (last.keep === "raiz") return [last.m, last.m];
  return last.keep === "derecha" ? [last.m, last.b] : [last.a, last.m];
}

/** Longitud del intervalo tras k iteraciones: (b − a)/2ᵏ. */
export const bisectionLength = (a: number, b: number, k: number) => (b - a) / 2 ** k;

/** Mínimo k con (b − a)/2ᵏ < ε. */
export function bisectionIterations(a: number, b: number, eps: number): number {
  let k = 0;
  while (bisectionLength(a, b, k) >= eps) k++;
  return k;
}
