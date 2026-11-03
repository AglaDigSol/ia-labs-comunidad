// Distribuciones discretas: Bernoulli, binomial, geométrica (número del intento en que llega el primer
// éxito, X ∈ {1, 2, …}), Poisson y uniforme discreta. Todo es exacto con fracciones salvo la función
// de probabilidad de Poisson, que lleva e^(−λ) y se da en coma flotante (su media y su varianza, λ,
// sí son exactas).
import { add, cmp, div, frac, mul, ONE, sub, toNumber, ZERO, type Frac } from "../rational.ts";

export type DistKind = "bernoulli" | "binomial" | "geometrica" | "poisson" | "uniforme";

export type DistSpec =
  | { kind: "bernoulli"; p: Frac }
  | { kind: "binomial"; n: number; p: Frac }
  | { kind: "geometrica"; p: Frac }
  | { kind: "poisson"; lambda: Frac }
  | { kind: "uniforme"; a: number; b: number };

export const DIST_LABEL: Record<DistKind, string> = {
  bernoulli: "Bernoulli",
  binomial: "Binomial",
  geometrica: "Geométrica",
  poisson: "Poisson",
  uniforme: "Uniforme discreta",
};

/** Qué cuenta cada distribución (para explicar qué modelo encaja con una historia). */
export const DIST_STORY: Record<DistKind, string> = {
  bernoulli: "Un solo intento con dos resultados: X = 1 si sale éxito (probabilidad p) y X = 0 si no.",
  binomial: "El número de éxitos en n intentos independientes, todos con la misma probabilidad de éxito p.",
  geometrica: "El número del intento en el que llega el primer éxito, repitiendo intentos independientes con probabilidad p.",
  poisson: "El número de sucesos raros en un intervalo (de tiempo, de espacio…) cuando llegan a un ritmo medio λ.",
  uniforme: "Un valor entero entre a y b, todos con la misma probabilidad.",
};

export const MAX_BINOMIAL_N = 40;
export const MAX_UNIFORM_SPAN = 40;

const isProb = (p: Frac) => cmp(p, ZERO) >= 0 && cmp(p, ONE) <= 0;

/** Motivo por el que unos parámetros no valen, o null. */
export function distProblem(d: DistSpec): string | null {
  switch (d.kind) {
    case "bernoulli":
      return isProb(d.p) ? null : "p va entre 0 y 1.";
    case "binomial":
      if (!Number.isInteger(d.n) || d.n < 1 || d.n > MAX_BINOMIAL_N) return `n tiene que ser un entero entre 1 y ${MAX_BINOMIAL_N}.`;
      return isProb(d.p) ? null : "p va entre 0 y 1.";
    case "geometrica":
      return cmp(d.p, ZERO) > 0 && cmp(d.p, ONE) <= 0 ? null : "p tiene que ser mayor que 0 y como mucho 1.";
    case "poisson":
      return cmp(d.lambda, ZERO) > 0 && cmp(d.lambda, frac(30n)) <= 0 ? null : "λ tiene que ser positiva (como mucho 30).";
    case "uniforme":
      if (!Number.isInteger(d.a) || !Number.isInteger(d.b) || d.a > d.b) return "a y b son enteros con a ≤ b.";
      return d.b - d.a + 1 <= MAX_UNIFORM_SPAN ? null : `Como mucho ${MAX_UNIFORM_SPAN} valores.`;
  }
}

/** ¿Tiene función de probabilidad exacta (racional)? Todas menos Poisson. */
export const distExact = (d: DistSpec): boolean => d.kind !== "poisson";

const powF = (x: Frac, k: number): Frac => {
  let r = ONE;
  for (let i = 0; i < k; i++) r = mul(r, x);
  return r;
};

/** Número combinatorio C(n, k). */
export function binom(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return 0n;
  let r = 1n;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i++) r = (r * BigInt(n - kk + i)) / BigInt(i);
  return r;
}

/** Valores posibles: todos si son finitos; si no, los primeros (hasta que la cola sea despreciable o `max`). */
export function distSupport(d: DistSpec, max = 60): number[] {
  switch (d.kind) {
    case "bernoulli":
      return [0, 1];
    case "binomial":
      return Array.from({ length: d.n + 1 }, (_, k) => k);
    case "uniforme":
      return Array.from({ length: d.b - d.a + 1 }, (_, i) => d.a + i);
    case "geometrica":
    case "poisson": {
      const out: number[] = [];
      let acc = 0;
      for (let k = d.kind === "geometrica" ? 1 : 0; out.length < max; k++) {
        out.push(k);
        acc += pmfNumber(d, k);
        if (acc > 0.999 && out.length >= 6) break;
      }
      return out;
    }
  }
}

/** P(X = k) exacta; null para Poisson (no es racional). */
export function pmfExact(d: DistSpec, k: number): Frac | null {
  if (!Number.isInteger(k)) return ZERO;
  switch (d.kind) {
    case "bernoulli":
      return k === 1 ? d.p : k === 0 ? sub(ONE, d.p) : ZERO;
    case "binomial":
      if (k < 0 || k > d.n) return ZERO;
      return mul(frac(binom(d.n, k)), mul(powF(d.p, k), powF(sub(ONE, d.p), d.n - k)));
    case "geometrica":
      return k < 1 ? ZERO : mul(powF(sub(ONE, d.p), k - 1), d.p);
    case "uniforme":
      return k < d.a || k > d.b ? ZERO : frac(1n, BigInt(d.b - d.a + 1));
    case "poisson":
      return null;
  }
}

/** P(X = k) en coma flotante (para dibujar, y para Poisson). */
export function pmfNumber(d: DistSpec, k: number): number {
  if (d.kind !== "poisson") return toNumber(pmfExact(d, k)!);
  if (!Number.isInteger(k) || k < 0) return 0;
  const lambda = toNumber(d.lambda);
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/** P(X = k): exacta si se puede. */
export const pmf = (d: DistSpec, k: number): Frac | number => pmfExact(d, k) ?? pmfNumber(d, k);

/** P(X ≤ k). */
export function cdf(d: DistSpec, k: number): Frac | number {
  if (d.kind === "geometrica") {
    // P(X ≤ k) = 1 − (1 − p)^k.
    return k < 1 ? ZERO : sub(ONE, powF(sub(ONE, d.p), Math.floor(k)));
  }
  if (d.kind === "poisson") {
    let acc = 0;
    for (let i = 0; i <= Math.floor(k); i++) acc += pmfNumber(d, i);
    return Math.min(1, acc);
  }
  let acc = ZERO;
  for (const x of distSupport(d)) if (x <= k) acc = add(acc, pmfExact(d, x)!);
  return acc;
}

const oneMinus = (x: Frac | number): Frac | number => (typeof x === "number" ? 1 - x : sub(ONE, x));

/** P(X ≥ k) = 1 − P(X ≤ k − 1). Para la geométrica, (1 − p)^(k−1): los k − 1 primeros fallan. */
export const probAtLeast = (d: DistSpec, k: number): Frac | number => oneMinus(cdf(d, k - 1));
/** P(X > k) = 1 − P(X ≤ k). */
export const probGreater = (d: DistSpec, k: number): Frac | number => oneMinus(cdf(d, k));
/** P(X < k) = P(X ≤ k − 1). */
export const probLess = (d: DistSpec, k: number): Frac | number => cdf(d, k - 1);

/** E[X]. */
export function distMean(d: DistSpec): Frac {
  switch (d.kind) {
    case "bernoulli":
      return d.p;
    case "binomial":
      return mul(frac(BigInt(d.n)), d.p);
    case "geometrica":
      return div(ONE, d.p);
    case "poisson":
      return d.lambda;
    case "uniforme":
      return frac(BigInt(d.a + d.b), 2n);
  }
}

/** Var(X). */
export function distVariance(d: DistSpec): Frac {
  switch (d.kind) {
    case "bernoulli":
      return mul(d.p, sub(ONE, d.p));
    case "binomial":
      return mul(frac(BigInt(d.n)), mul(d.p, sub(ONE, d.p)));
    case "geometrica":
      return div(sub(ONE, d.p), mul(d.p, d.p));
    case "poisson":
      return d.lambda;
    case "uniforme": {
      const m = BigInt(d.b - d.a + 1);
      return frac(m * m - 1n, 12n);
    }
  }
}

/** Fórmula de la función de probabilidad, en TeX. */
export function pmfFormulaTex(kind: DistKind): string {
  switch (kind) {
    case "bernoulli":
      return "P(X = k) = p^k (1-p)^{1-k},\\ k \\in \\{0, 1\\}";
    case "binomial":
      return "P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}";
    case "geometrica":
      return "P(X = k) = (1-p)^{k-1}\\, p,\\ k = 1, 2, \\ldots";
    case "poisson":
      return "P(X = k) = e^{-\\lambda} \\dfrac{\\lambda^k}{k!}";
    case "uniforme":
      return "P(X = k) = \\dfrac{1}{b - a + 1},\\ k = a, \\ldots, b";
  }
}

/** Media y varianza, en TeX. */
export function momentsTex(kind: DistKind): string {
  switch (kind) {
    case "bernoulli":
      return "E[X] = p,\\quad \\operatorname{Var}(X) = p(1-p)";
    case "binomial":
      return "E[X] = np,\\quad \\operatorname{Var}(X) = np(1-p)";
    case "geometrica":
      return "E[X] = \\dfrac{1}{p},\\quad \\operatorname{Var}(X) = \\dfrac{1-p}{p^2}";
    case "poisson":
      return "E[X] = \\lambda,\\quad \\operatorname{Var}(X) = \\lambda";
    case "uniforme":
      return "E[X] = \\dfrac{a+b}{2},\\quad \\operatorname{Var}(X) = \\dfrac{(b-a+1)^2 - 1}{12}";
  }
}
