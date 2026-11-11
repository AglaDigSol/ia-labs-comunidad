// Ejercicios de cadenas de Markov: distribución tras n pasos (vₙ = v₀·Pⁿ), distribución estacionaria
// (π·P = π), clasificación de estados (absorbente, recurrente, transitorio) y probabilidad de absorción
// con la matriz fundamental N = (I − Q)⁻¹. Las cadenas se generan al azar con la semilla (nunca son
// las de ninguna actividad del curso) y con fracciones sencillas, para que todo salga exacto. Las
// instancias guardan solo los datos (fracciones como pares de enteros); lo que se corrige lo calculan
// los motores de shared/markov al resolver.
import { equals, frac, isZero, ONE, sign, type Frac } from "../rational.ts";
import { absorptionAnalysis, type AbsorptionAnalysis } from "../markov/absorption.ts";
import { classifyStates, type StateClassification } from "../markov/classify.ts";
import { evolve } from "../markov/evolution.ts";
import type { Mat, Vec } from "../markov/matrix.ts";
import { stationary } from "../markov/systems.ts";
import { fracQ, qFrac, type Q } from "./probability.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

/** Matriz de fracciones (pares de enteros) para guardar en la instancia. */
export type QMat = readonly (readonly Q[])[];

export const qMat = (M: QMat): Mat => M.map((r) => r.map(qFrac));
export const qVec = (v: readonly Q[]): Vec => v.map(qFrac);

/** Fila estocástica al azar: `m` partes de `denom` (enteros ≥ 0 que suman denom), con al menos `positive` no nulas. */
function stochasticRow(rng: Rng, m: number, denom: number, positive: number): Q[] {
  for (;;) {
    const cuts = Array.from({ length: m - 1 }, () => rng.int(0, denom)).sort((a, b) => a - b);
    const parts = [...cuts, denom].map((c, i) => c - (i === 0 ? 0 : cuts[i - 1]!));
    if (parts.filter((x) => x > 0).length >= positive) return rng.shuffle(parts).map((k) => fracQ(frac(BigInt(k), BigInt(denom))));
  }
}

/** Mayor denominador de una lista de fracciones. */
const maxDen = (xs: readonly Frac[]) => xs.reduce((m, x) => (x.d > m ? x.d : m), 1n);

/** Historias de las cadenas (nombres de los estados). Inventadas: no salen de ningún material del curso. */
export const MARKOV_STORIES = [
  { context: "Cada semana, una persona elige qué tipo de música escucha más en una aplicación.", states: ["Pop", "Rock", "Jazz"] },
  { context: "Un robot de limpieza pasa cada minuto de una habitación a otra.", states: ["Cocina", "Salón", "Pasillo"] },
  { context: "Cada día, un servidor está en uno de estos modos.", states: ["Libre", "Ocupado", "Mantenimiento"] },
  { context: "Cada mes, un cliente compra sobre todo una de estas marcas.", states: ["Marca A", "Marca B", "Marca C"] },
  { context: "Un lector de una web de noticias pasa de una sección a otra en cada clic.", states: ["Portada", "Deportes", "Ciencia"] },
] as const;

/** Nombres de los estados de una historia (los m primeros; con m = 4, uno más genérico). */
export const storyStates = (story: number, m: number): string[] => {
  const s = [...MARKOV_STORIES[story]!.states];
  return m <= s.length ? s.slice(0, m) : [...s, ...Array.from({ length: m - s.length }, (_, i) => `Estado ${s.length + i + 1}`)];
};

// ---------------------------------------------------------------- Distribución tras n pasos

export type MarkovEvolutionInstance = { story: number; P: QMat; v0: Q[]; n: number };

function makeEvolution(rng: Rng, level: ExerciseLevel): MarkovEvolutionInstance {
  const m = level === "básico" ? 2 : 3;
  const denom = level === "básico" ? rng.pick([2, 4, 5, 10]) : level === "medio" ? rng.pick([4, 5, 10]) : 10;
  const P = Array.from({ length: m }, () => stochasticRow(rng, m, denom, 2));
  const n = level === "avanzado" ? 3 : 2;
  let v0: Q[];
  if (level === "avanzado") v0 = stochasticRow(rng, m, 10, 2);
  else if (level === "medio" && rng.chance(0.5)) v0 = rng.shuffle([fracQ(frac(1n, 2n)), fracQ(frac(1n, 2n)), [0, 1] as Q]);
  else {
    const start = rng.int(0, m - 1);
    v0 = Array.from({ length: m }, (_, i) => (i === start ? ([1, 1] as Q) : ([0, 1] as Q)));
  }
  return { story: rng.int(0, MARKOV_STORIES.length - 1), P, v0, n };
}

/** v₀, v₁, …, vₙ exactos. */
export const evolutionVectors = (i: MarkovEvolutionInstance): Vec[] => evolve(qMat(i.P), qVec(i.v0), i.n).vectors;

export const MARKOV_EVOLUTION: ExerciseType<MarkovEvolutionInstance> = {
  id: "markov-evolucion",
  topic: "markov",
  title: "Distribución tras n pasos",
  description: "Con la matriz de transición P y la distribución inicial v₀, calcula paso a paso v₁ = v₀·P, v₂ = v₁·P… hasta vₙ = v₀·Pⁿ, con fracciones exactas.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("markov-evolucion", seed),
      (r) => makeEvolution(r, level),
      (i) => {
        const vs = evolutionVectors(i);
        const last = vs[vs.length - 1]!;
        // Que algo cambie, sin denominadores enormes y sin llegar ya a un vector fijo.
        return !last.every((x, j) => equals(x, vs[vs.length - 2]![j]!)) && maxDen(last) <= (level === "avanzado" ? 1000n : 200n);
      },
    );
  },
};

// ---------------------------------------------------------------- Distribución estacionaria

export type MarkovStationaryInstance = { story: number; P: QMat };

function makeStationary(rng: Rng, level: ExerciseLevel): MarkovStationaryInstance {
  const m = level === "básico" ? 2 : level === "medio" ? 3 : 4;
  const denom = level === "básico" ? rng.pick([2, 3, 4, 5, 10]) : level === "medio" ? rng.pick([2, 4, 5, 10]) : rng.pick([2, 4]);
  const P = Array.from({ length: m }, () => stochasticRow(rng, m, denom, level === "avanzado" ? 1 : 2));
  return { story: rng.int(0, MARKOV_STORIES.length - 1), P };
}

/** π exacta (las instancias siempre la tienen única). */
export function stationaryOf(i: MarkovStationaryInstance): Vec {
  const r = stationary(qMat(i.P));
  if (r.kind !== "unique") throw new Error("estacionaria no única");
  return r.pi;
}

export const MARKOV_STATIONARY: ExerciseType<MarkovStationaryInstance> = {
  id: "markov-estacionaria",
  topic: "markov",
  title: "Distribución estacionaria",
  description: "Plantea π·P = π con π₁ + π₂ + … = 1, resuelve el sistema y comprueba que tu π no cambia al dar un paso.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("markov-estacionaria", seed),
      (r) => makeStationary(r, level),
      (i) => {
        const P = qMat(i.P);
        const r = stationary(P);
        if (r.kind !== "unique") return false;
        // Sin estados fuera de juego (π con ceros) ni filas que ya son la respuesta.
        if (r.pi.some(isZero) || P.some((row) => row.some((x) => equals(x, ONE)))) return false;
        return maxDen(r.pi) <= (level === "avanzado" ? 200n : 60n);
      },
    );
  },
};

// ---------------------------------------------------------------- Clasificación de estados

export type MarkovClassifyInstance = { P: QMat };

function makeClassify(rng: Rng, level: ExerciseLevel): MarkovClassifyInstance {
  const m = level === "básico" ? 3 : level === "medio" ? 4 : 5;
  const P: Q[][] = [];
  for (let i = 0; i < m; i++) {
    // Cada fila va a 1, 2 o 3 estados; una fila que solo va a sí misma es un absorbente.
    const k = rng.pick(level === "básico" ? [1, 2, 2] : [1, 2, 2, 3]);
    const targets = rng.shuffle(Array.from({ length: m }, (_, j) => j)).slice(0, k);
    const denom = rng.pick(k === 1 ? [1] : k === 2 ? [2, 3, 4] : [3, 4, 5]);
    const weights = stochasticRow(rng, k, denom, k);
    const row: Q[] = Array.from({ length: m }, () => [0, 1] as Q);
    targets.forEach((j, t) => (row[j] = weights[t]!));
    P.push(row);
  }
  return { P };
}

export const classifyOf = (i: MarkovClassifyInstance): StateClassification => classifyStates(qMat(i.P));

export const MARKOV_CLASSIFY: ExerciseType<MarkovClassifyInstance> = {
  id: "markov-clasificacion",
  topic: "markov",
  title: "Clasificación de estados",
  description: "Con la matriz de transición, busca qué estados se alcanzan desde cada uno, agrúpalos en clases y di si cada estado es absorbente, recurrente o transitorio.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("markov-clasificacion", seed),
      (r) => makeClassify(r, level),
      (i) => {
        const c = classifyOf(i);
        const count = (k: string) => c.kind.filter((x) => x === k).length;
        if (count("transitorio") === 0 || count("transitorio") === c.kind.length) return false;
        if (level === "básico") return count("absorbente") >= 1;
        if (level === "medio") return count("recurrente") >= 2 && count("transitorio") >= 1;
        return count("absorbente") >= 1 && count("recurrente") >= 2 && count("transitorio") >= 2;
      },
    );
  },
};

// ---------------------------------------------------------------- Probabilidad de absorción

/** Historias de las cadenas absorbentes: transitorios primero y absorbentes después. */
export const ABSORPTION_STORIES = [
  { context: "Un pedido de una tienda en línea pasa por varias fases hasta que se entrega o se cancela.", transient: ["Pendiente", "Preparado", "En reparto"], absorbing: ["Entregado", "Cancelado"] },
  { context: "Un usuario recorre las pantallas de registro de una aplicación hasta que se da de alta o lo deja.", transient: ["Inicio", "Datos", "Pago"], absorbing: ["Alta", "Abandono"] },
  { context: "Una incidencia de soporte pasa de un nivel a otro hasta que se resuelve o se descarta.", transient: ["Nivel 1", "Nivel 2", "Nivel 3"], absorbing: ["Resuelta", "Descartada"] },
  { context: "Una pieza pasa por varios controles de calidad hasta que se acepta o se rechaza.", transient: ["Control 1", "Control 2", "Control 3"], absorbing: ["Aceptada", "Rechazada"] },
] as const;

export type MarkovAbsorptionInstance = {
  story: number;
  /** P en forma canónica: los t transitorios primero y los 2 absorbentes al final. */
  P: QMat;
  transient: number;
  /** Transitorio de partida y absorbente por el que se pregunta (índices dentro de su grupo). */
  start: number;
  target: number;
  /** En avanzado, también los pasos esperados t = N·1. */
  askSteps: boolean;
};

function makeAbsorption(rng: Rng, level: ExerciseLevel): MarkovAbsorptionInstance {
  const t = level === "básico" ? 1 : level === "medio" ? 2 : 3;
  const m = t + 2;
  const denom = level === "básico" ? rng.pick([2, 4, 5, 10]) : level === "medio" ? rng.pick([2, 4, 5, 10]) : rng.pick([2, 4, 5]);
  const P: Q[][] = [];
  for (let i = 0; i < t; i++) P.push(stochasticRow(rng, m, denom, 2));
  for (let k = 0; k < 2; k++) P.push(Array.from({ length: m }, (_, j) => (j === t + k ? ([1, 1] as Q) : ([0, 1] as Q))));
  return { story: rng.int(0, ABSORPTION_STORIES.length - 1), P, transient: t, start: rng.int(0, t - 1), target: rng.int(0, 1), askSteps: level === "avanzado" };
}

export const absorptionOf = (i: MarkovAbsorptionInstance): AbsorptionAnalysis => {
  const a = absorptionAnalysis(qMat(i.P));
  if (!a) throw new Error("cadena no absorbente");
  return a;
};

export const absorptionStates = (i: MarkovAbsorptionInstance) => {
  const s = ABSORPTION_STORIES[i.story]!;
  return { transient: s.transient.slice(0, i.transient), absorbing: [...s.absorbing] };
};

export const MARKOV_ABSORPTION: ExerciseType<MarkovAbsorptionInstance> = {
  id: "markov-absorcion",
  topic: "markov",
  title: "Probabilidad de absorción",
  description: "En una cadena absorbente en forma canónica, separa Q y R, calcula I − Q, la matriz fundamental N = (I − Q)⁻¹ y B = N·R: la probabilidad de acabar en cada absorbente (y, en avanzado, los pasos esperados t = N·1).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("markov-absorcion", seed),
      (r) => makeAbsorption(r, level),
      (i) => {
        const a = absorptionAnalysis(qMat(i.P));
        if (!a || a.transient.length !== i.transient || a.absorbing.length !== 2) return false;
        // Que Q no sea nula (si no, N = I y no hay nada que invertir).
        if (a.Q.flat().filter((x) => !isZero(x)).length < (level === "básico" ? 1 : 2)) return false;
        // Que se pueda acabar en los dos absorbentes (nada de 0 o 1) y con fracciones manejables.
        const asked = a.B[i.start]![i.target]!;
        if (isZero(asked) || equals(asked, ONE) || a.B.some((row) => row.some((x) => sign(x) <= 0))) return false;
        return maxDen([...a.N.flat(), ...a.B.flat()]) <= (level === "avanzado" ? 400n : 100n);
      },
    );
  },
};

export const MARKOV_EXERCISES = [MARKOV_EVOLUTION, MARKOV_STATIONARY, MARKOV_CLASSIFY, MARKOV_ABSORPTION] as const;
