// Probabilidad condicionada con fracciones exactas: el árbol de una partición A₁, …, Aₙ con un suceso
// C (teorema de la probabilidad total y de Bayes), la tabla de contingencia 2×2 de dos sucesos A y B
// y los datos de un par de sucesos (unión, condicionadas, independencia e incompatibilidad).
import { add, cmp, div, equals, isZero, mul, ONE, sub, sum, ZERO, type Frac } from "../rational.ts";

const inUnit = (p: Frac) => cmp(p, ZERO) >= 0 && cmp(p, ONE) <= 0;

// ---------------------------------------------------------------- Árbol: probabilidad total y Bayes

/**
 * Árbol de dos niveles: primero una partición A₁, …, Aₙ (P(Aᵢ), que suman 1) y después, en cada
 * rama, C o Cᶜ con P(C | Aᵢ).
 */
export interface ProbTree {
  priors: readonly Frac[];
  likelihoods: readonly Frac[];
}

export interface TreeSolution {
  priors: Frac[];
  /** P(C | Aᵢ). */
  likelihoods: Frac[];
  /** P(Cᶜ | Aᵢ) = 1 − P(C | Aᵢ). */
  complements: Frac[];
  /** P(Aᵢ ∩ C) = P(Aᵢ)·P(C | Aᵢ). */
  joints: Frac[];
  /** P(Aᵢ ∩ Cᶜ). */
  jointsNot: Frac[];
  /** P(C) = Σ P(Aᵢ)·P(C | Aᵢ) (probabilidad total). */
  total: Frac;
  /** P(Cᶜ) = 1 − P(C). */
  totalNot: Frac;
  /** P(Aᵢ | C) = P(Aᵢ ∩ C) / P(C) (Bayes); null si P(C) = 0. */
  posteriors: Array<Frac | null>;
  /** P(Aᵢ | Cᶜ); null si P(Cᶜ) = 0. */
  posteriorsNot: Array<Frac | null>;
}

/** ¿Es un árbol válido? Devuelve el motivo si no. */
export function treeProblem(t: ProbTree): string | null {
  if (t.priors.length < 2 || t.priors.length > 4) return "La partición tiene que tener de 2 a 4 ramas.";
  if (t.likelihoods.length !== t.priors.length) return "Cada rama necesita su P(C | Aᵢ).";
  if (!t.priors.every(inUnit) || !t.likelihoods.every(inUnit)) return "Las probabilidades van entre 0 y 1.";
  if (!equals(sum(t.priors), ONE)) return "Las probabilidades de la partición tienen que sumar 1.";
  return null;
}

export function solveTree(t: ProbTree): TreeSolution {
  const problem = treeProblem(t);
  if (problem) throw new RangeError(problem);
  const priors = [...t.priors];
  const likelihoods = [...t.likelihoods];
  const complements = likelihoods.map((l) => sub(ONE, l));
  const joints = priors.map((p, i) => mul(p, likelihoods[i]!));
  const jointsNot = priors.map((p, i) => mul(p, complements[i]!));
  const total = sum(joints);
  const totalNot = sub(ONE, total);
  return {
    priors,
    likelihoods,
    complements,
    joints,
    jointsNot,
    total,
    totalNot,
    posteriors: joints.map((j) => (isZero(total) ? null : div(j, total))),
    posteriorsNot: jointsNot.map((j) => (isZero(totalNot) ? null : div(j, totalNot))),
  };
}

// ---------------------------------------------------------------- Tabla de contingencia 2×2

/** Las cuatro probabilidades conjuntas: P(A ∩ B), P(A ∩ Bᶜ), P(Aᶜ ∩ B), P(Aᶜ ∩ Bᶜ). Suman 1. */
export interface Contingency {
  ab: Frac;
  aNotB: Frac;
  notAB: Frac;
  notANotB: Frac;
}

export interface ContingencySolution extends Contingency {
  pA: Frac;
  pNotA: Frac;
  pB: Frac;
  pNotB: Frac;
  /** P(A | B); null si P(B) = 0. */
  aGivenB: Frac | null;
  /** P(B | A); null si P(A) = 0. */
  bGivenA: Frac | null;
  union: Frac;
  independent: boolean;
}

export function contingencyProblem(c: Contingency): string | null {
  const cells = [c.ab, c.aNotB, c.notAB, c.notANotB];
  if (!cells.every(inUnit)) return "Las probabilidades van entre 0 y 1.";
  if (!equals(sum(cells), ONE)) return "Las cuatro casillas tienen que sumar 1.";
  return null;
}

export function solveContingency(c: Contingency): ContingencySolution {
  const problem = contingencyProblem(c);
  if (problem) throw new RangeError(problem);
  const pA = add(c.ab, c.aNotB);
  const pB = add(c.ab, c.notAB);
  return {
    ...c,
    pA,
    pNotA: sub(ONE, pA),
    pB,
    pNotB: sub(ONE, pB),
    aGivenB: isZero(pB) ? null : div(c.ab, pB),
    bGivenA: isZero(pA) ? null : div(c.ab, pA),
    union: sub(ONE, c.notANotB),
    independent: equals(c.ab, mul(pA, pB)),
  };
}

/** La tabla a partir de P(A), P(B) y P(A ∩ B). */
export function contingencyFrom(pA: Frac, pB: Frac, pAB: Frac): Contingency {
  return { ab: pAB, aNotB: sub(pA, pAB), notAB: sub(pB, pAB), notANotB: sub(ONE, sub(add(pA, pB), pAB)) };
}

// ---------------------------------------------------------------- Un par de sucesos

export interface PairFacts {
  pA: Frac;
  pB: Frac;
  /** P(A ∩ B). */
  inter: Frac;
  /** P(A ∪ B) = P(A) + P(B) − P(A ∩ B). */
  union: Frac;
  aGivenB: Frac | null;
  bGivenA: Frac | null;
  /** P(A ∩ Bᶜ) = P(A) − P(A ∩ B). */
  aNotB: Frac;
  /** P(Aᶜ ∩ Bᶜ) = 1 − P(A ∪ B). */
  neither: Frac;
  independent: boolean;
  /** Incompatibles (mutuamente excluyentes): P(A ∩ B) = 0. */
  exclusive: boolean;
}

/** ¿Hay sucesos con estas probabilidades? max(0, P(A) + P(B) − 1) ≤ P(A ∩ B) ≤ min(P(A), P(B)). */
export function pairProblem(pA: Frac, pB: Frac, inter: Frac): string | null {
  if (![pA, pB, inter].every(inUnit)) return "Las probabilidades van entre 0 y 1.";
  if (cmp(inter, pA) > 0 || cmp(inter, pB) > 0) return "P(A ∩ B) no puede ser mayor que P(A) ni que P(B).";
  if (cmp(add(pA, pB), add(ONE, inter)) > 0) return "Con esos datos, P(A ∪ B) pasaría de 1.";
  return null;
}

export function pairFacts(pA: Frac, pB: Frac, inter: Frac): PairFacts {
  const problem = pairProblem(pA, pB, inter);
  if (problem) throw new RangeError(problem);
  const union = sub(add(pA, pB), inter);
  return {
    pA,
    pB,
    inter,
    union,
    aGivenB: isZero(pB) ? null : div(inter, pB),
    bGivenA: isZero(pA) ? null : div(inter, pA),
    aNotB: sub(pA, inter),
    neither: sub(ONE, union),
    independent: equals(inter, mul(pA, pB)),
    exclusive: isZero(inter),
  };
}

/** P(A ∩ B) a partir de P(A ∪ B): P(A) + P(B) − P(A ∪ B). */
export const interFromUnion = (pA: Frac, pB: Frac, union: Frac): Frac => sub(add(pA, pB), union);
/** P(A ∩ B) a partir de P(A | B): P(A | B)·P(B). */
export const interFromCond = (aGivenB: Frac, pB: Frac): Frac => mul(aGivenB, pB);
