// Generador pseudoaleatorio con semilla para los ejercicios: la misma semilla da siempre el mismo
// ejercicio, así que una semilla en la URL (?s=) basta para compartirlo o volver a él. Es mulberry32
// (32 bits, rápido y suficiente para elegir fórmulas; no sirve para nada criptográfico).

/** Semillas: enteros de 0 a 2³² − 1. En la URL se escriben en base 36 (como mucho 7 caracteres). */
export const MAX_SEED = 0xffffffff;

export interface Rng {
  /** Número en [0, 1). */
  next(): number;
  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number;
  /** Un elemento de la lista (no vacía). */
  pick<T>(items: readonly T[]): T;
  /** Verdadero con probabilidad p. */
  chance(p: number): boolean;
  /** Copia barajada (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error("pick: lista vacía");
      return items[int(0, items.length - 1)]!;
    },
    chance: (p) => next() < p,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/** Generador de la semilla para un tipo: así dos tipos con la misma semilla no repiten fórmula. */
export function rngFor(id: string, seed: number): Rng {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return createRng((seed ^ h) >>> 0);
}

/** Semilla nueva al azar (para «Siguiente ejercicio»). */
export function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0]!;
  } catch {
    return Math.floor(Math.random() * MAX_SEED);
  }
}

/** Semilla en base 36, para la URL. */
export const seedToText = (seed: number): string => (seed >>> 0).toString(36);

/** Lee una semilla de la URL, o null si no es válida. */
export function seedFromText(text: string | null): number | null {
  if (text === null || !/^[0-9a-z]{1,7}$/.test(text)) return null;
  const n = parseInt(text, 36);
  return Number.isSafeInteger(n) && n <= MAX_SEED ? n : null;
}

/**
 * Busca, con intentos deterministas, un valor que cumpla `accept`. Cada intento usa el mismo
 * generador (que avanza), así que el resultado depende solo de la semilla. Si no aparece ninguno en
 * `attempts` intentos, lanza un error: los tests de validez garantizan que no pasa con los límites
 * de cada nivel.
 */
export function generateUntil<T>(rng: Rng, make: (rng: Rng) => T | null, accept: (x: T) => boolean, attempts = 2000): T {
  for (let i = 0; i < attempts; i++) {
    const x = make(rng);
    if (x !== null && accept(x)) return x;
  }
  throw new Error("generateUntil: no se ha encontrado un ejercicio válido");
}
