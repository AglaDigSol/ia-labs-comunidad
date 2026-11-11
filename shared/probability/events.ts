// Espacios muestrales finitos y sucesos, con probabilidades racionales exactas. Un espacio es una
// lista de resultados con su peso (los pesos suman 1); un suceso es la lista de resultados que lo
// cumplen, como máscara (true/false por resultado). Sirve para dados (equilibrados o trucados),
// monedas, la baraja española y sus combinaciones, y para comprobar por fuerza bruta las fórmulas de
// probabilidad condicionada, independencia y probabilidad total.
import { add, div, equals, frac, isZero, mul, ONE, sub, sum, ZERO, type Frac } from "../rational.ts";

export interface SampleSpace<T> {
  outcomes: readonly T[];
  /** Nombre de cada resultado («(3, 5)», «as de oros»…). */
  labels: readonly string[];
  /** Probabilidad de cada resultado; suman 1. */
  weights: readonly Frac[];
}

/** Suceso: true en los resultados que lo cumplen. */
export type ProbEvent = readonly boolean[];

/** Pesos proporcionales a unos enteros positivos (2 : 1 : 1 → 1/2, 1/4, 1/4). */
export function normalizeWeights(raw: readonly number[]): Frac[] {
  if (raw.length === 0 || raw.some((w) => !Number.isInteger(w) || w < 0)) throw new RangeError("pesos no válidos");
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 0) throw new RangeError("pesos no válidos");
  return raw.map((w) => frac(BigInt(w), BigInt(total)));
}

export function uniformSpace<T>(outcomes: readonly T[], label: (x: T) => string = String): SampleSpace<T> {
  const w = frac(1n, BigInt(outcomes.length));
  return { outcomes, labels: outcomes.map(label), weights: outcomes.map(() => w) };
}

export function weightedSpace<T>(outcomes: readonly T[], weights: readonly Frac[], label: (x: T) => string = String): SampleSpace<T> {
  if (outcomes.length !== weights.length) throw new RangeError("un peso por resultado");
  if (!equals(sum(weights), ONE) || weights.some((w) => w.n < 0n)) throw new RangeError("los pesos tienen que sumar 1");
  return { outcomes, labels: outcomes.map(label), weights };
}

/** Un dado de 6 caras; con `weights` (enteros, uno por cara), trucado. */
export function dieSpace(weights?: readonly number[]): SampleSpace<number> {
  const faces = [1, 2, 3, 4, 5, 6];
  return weights ? weightedSpace(faces, normalizeWeights(weights)) : uniformSpace(faces);
}

/**
 * Dado trucado en el que cada cara impar tiene peso `odd` y cada cara par peso `even`: con 2 : 1, «los
 * impares son el doble de probables que los pares».
 */
export const loadedDieWeights = (odd: number, even: number): Frac[] => normalizeWeights([1, 2, 3, 4, 5, 6].map((f) => (f % 2 === 1 ? odd : even)));

/** Una moneda: «C» (cara) y «X» (cruz). */
export const coinSpace = (): SampleSpace<"C" | "X"> => uniformSpace(["C", "X"] as const);

/** Producto de espacios independientes: los resultados son pares y los pesos se multiplican. */
export function productSpace<A, B>(a: SampleSpace<A>, b: SampleSpace<B>): SampleSpace<[A, B]> {
  const outcomes: Array<[A, B]> = [];
  const labels: string[] = [];
  const weights: Frac[] = [];
  a.outcomes.forEach((x, i) =>
    b.outcomes.forEach((y, j) => {
      outcomes.push([x, y]);
      labels.push(`(${a.labels[i]}, ${b.labels[j]})`);
      weights.push(mul(a.weights[i]!, b.weights[j]!));
    }),
  );
  return { outcomes, labels, weights };
}

/** k repeticiones independientes del mismo experimento (k ≥ 1): los resultados son listas. */
export function repeatSpace<T>(base: SampleSpace<T>, k: number): SampleSpace<T[]> {
  if (!Number.isInteger(k) || k < 1 || k > 6) throw new RangeError("entre 1 y 6 repeticiones");
  let space: SampleSpace<T[]> = { outcomes: base.outcomes.map((x) => [x]), labels: [...base.labels], weights: [...base.weights] };
  for (let i = 1; i < k; i++) {
    const p = productSpace(space, base);
    space = {
      outcomes: p.outcomes.map(([xs, y]) => [...xs, y]),
      labels: p.outcomes.map(([xs, y]) => `(${[...xs, y].join(", ")})`),
      weights: p.weights,
    };
  }
  return space;
}

export type Suit = "oros" | "copas" | "espadas" | "bastos";
export interface PlayingCard {
  /** 1–7, 10 (sota), 11 (caballo), 12 (rey). */
  rank: number;
  suit: Suit;
}
export const SUITS: readonly Suit[] = ["oros", "copas", "espadas", "bastos"];
const RANK_NAME: Record<number, string> = { 1: "as", 10: "sota", 11: "caballo", 12: "rey" };
export const cardLabel = (c: PlayingCard) => `${RANK_NAME[c.rank] ?? String(c.rank)} de ${c.suit}`;
/** ¿Figura? (sota, caballo o rey). */
export const isFigure = (c: PlayingCard) => c.rank >= 10;

/** Baraja española de 40 cartas, todas igual de probables. */
export function spanishDeck(): SampleSpace<PlayingCard> {
  const cards: PlayingCard[] = [];
  for (const suit of SUITS) for (const rank of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]) cards.push({ rank, suit });
  return uniformSpace(cards, cardLabel);
}

// ---------------------------------------------------------------- Sucesos

export const eventWhere = <T>(space: SampleSpace<T>, pred: (x: T) => boolean): ProbEvent => space.outcomes.map(pred);
export const eventUnion = (a: ProbEvent, b: ProbEvent): ProbEvent => a.map((x, i) => x || b[i]!);
export const eventInter = (a: ProbEvent, b: ProbEvent): ProbEvent => a.map((x, i) => x && b[i]!);
export const eventComplement = (a: ProbEvent): ProbEvent => a.map((x) => !x);
export const eventDiff = (a: ProbEvent, b: ProbEvent): ProbEvent => a.map((x, i) => x && !b[i]);
export const eventSize = (a: ProbEvent): number => a.filter(Boolean).length;

/** P(E): suma de los pesos de sus resultados. */
export function probOf<T>(space: SampleSpace<T>, e: ProbEvent): Frac {
  let p = ZERO;
  e.forEach((inE, i) => {
    if (inE) p = add(p, space.weights[i]!);
  });
  return p;
}

/** P(A | B) = P(A ∩ B) / P(B); null si P(B) = 0. */
export function condProbOf<T>(space: SampleSpace<T>, a: ProbEvent, b: ProbEvent): Frac | null {
  const pb = probOf(space, b);
  return isZero(pb) ? null : div(probOf(space, eventInter(a, b)), pb);
}

/** ¿A y B independientes? P(A ∩ B) = P(A)·P(B). */
export const eventsIndependent = <T>(space: SampleSpace<T>, a: ProbEvent, b: ProbEvent): boolean =>
  equals(probOf(space, eventInter(a, b)), mul(probOf(space, a), probOf(space, b)));

/** P(Aᶜ) = 1 − P(A). */
export const complementProb = (p: Frac): Frac => sub(ONE, p);

// ---------------------------------------------------------------- Sucesos de un dado, con nombre

/** Sucesos de una tirada de un dado que se pueden nombrar en un enunciado. */
export type DieEventSpec =
  | { kind: "par" }
  | { kind: "impar" }
  | { kind: "primo" }
  | { kind: "multiplo3" }
  | { kind: "menor"; k: number }
  | { kind: "mayor"; k: number }
  | { kind: "distinto"; k: number };

export function dieEventHolds(e: DieEventSpec, face: number): boolean {
  switch (e.kind) {
    case "par":
      return face % 2 === 0;
    case "impar":
      return face % 2 === 1;
    case "primo":
      return face === 2 || face === 3 || face === 5;
    case "multiplo3":
      return face % 3 === 0;
    case "menor":
      return face < e.k;
    case "mayor":
      return face > e.k;
    case "distinto":
      return face !== e.k;
  }
}

/**
 * «es par», «es menor que 4»… En subjuntivo («la probabilidad de que el resultado sea par»): «sea par»,
 * «no sea un 6».
 */
export function dieEventText(e: DieEventSpec, mood: "indicativo" | "subjuntivo" = "indicativo"): string {
  const text = dieEventIndicative(e);
  return mood === "subjuntivo" ? text.replace(/^(no )?es /, (_, no: string | undefined) => `${no ?? ""}sea `) : text;
}

function dieEventIndicative(e: DieEventSpec): string {
  switch (e.kind) {
    case "par":
      return "es par";
    case "impar":
      return "es impar";
    case "primo":
      return "es un número primo";
    case "multiplo3":
      return "es múltiplo de 3";
    case "menor":
      return `es menor que ${e.k}`;
    case "mayor":
      return `es mayor que ${e.k}`;
    case "distinto":
      return `no es un ${e.k}`;
  }
}

export const dieEvent = (space: SampleSpace<number>, e: DieEventSpec): ProbEvent => eventWhere(space, (x) => dieEventHolds(e, x));
