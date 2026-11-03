// Continuas básicas: la normal N(μ, σ) con su tipificación z = (x − μ)/σ y la función de distribución
// Φ, y la uniforme continua U(a, b). Son números en coma flotante (Φ no es racional).
//
// Precisión de erf: para |x| ≤ 3 se suma la serie de Taylor (alternada, hasta que el término es menor
// que 1e-17; la cancelación pierde como mucho tres cifras, así que el error absoluto queda por debajo
// de 1e-13); para |x| > 3 se usa la fracción continua de erfc evaluada de atrás hacia delante con 60
// términos (error relativo por debajo de 1e-14). En la práctica, Φ tiene al menos doce decimales
// correctos, de sobra para responder con cuatro.

const TWO_OVER_SQRT_PI = 2 / Math.sqrt(Math.PI);

/** Función error. */
export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -erf(-x);
  if (x > 3) return 1 - erfcLarge(x);
  // Serie: erf(x) = 2/√π Σ (−1)ⁿ x^(2n+1) / (n!·(2n+1)).
  let term = x;
  let total = x;
  const x2 = x * x;
  for (let n = 1; n < 200; n++) {
    term *= -x2 / n;
    const add = term / (2 * n + 1);
    total += add;
    if (Math.abs(add) < 1e-17) break;
  }
  return TWO_OVER_SQRT_PI * total;
}

/** erfc(x) para x > 3, con la fracción continua erfc(x) = e^(−x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …)))). */
function erfcLarge(x: number): number {
  let f = x;
  for (let n = 60; n >= 1; n--) f = x + n / 2 / f;
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

/** Φ(z) = P(Z ≤ z) con Z ~ N(0, 1). */
export function normalCdf(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  // Para z muy negativo, mejor la cola directa: Φ(z) = erfc(−z/√2)/2.
  const t = z / Math.SQRT2;
  if (t < -3) return erfcLarge(-t) / 2;
  return 0.5 * (1 + erf(t));
}

/** Densidad de N(μ, σ). */
export const normalPdf = (x: number, mu = 0, sigma = 1): number => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

/** Tipificación: z = (x − μ)/σ. */
export function standardize(x: number, mu: number, sigma: number): number {
  if (!(sigma > 0)) throw new RangeError("σ tiene que ser positiva");
  return (x - mu) / sigma;
}

/** P(a ≤ X ≤ b) con X ~ N(μ, σ); a o b pueden ser ±∞. */
export function normalProb(a: number, b: number, mu: number, sigma: number): number {
  if (a > b) return 0;
  return normalCdf(standardize(b, mu, sigma)) - normalCdf(standardize(a, mu, sigma));
}

/** P(c ≤ X ≤ d) con X ~ U(a, b). */
export function uniformProb(c: number, d: number, a: number, b: number): number {
  if (!(a < b)) throw new RangeError("a < b");
  const lo = Math.max(a, c);
  const hi = Math.min(b, d);
  return hi <= lo ? 0 : (hi - lo) / (b - a);
}
