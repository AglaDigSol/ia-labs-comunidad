// Ejercicios de álgebra de Boole: funciones dadas por una expresión (Σm y ΠM), mapas de Karnaugh
// (con indiferencias en el nivel avanzado) y expresiones que se pueden simplificar con las leyes. Se
// generan con semilla; lo que se corrige (índices, agrupación mínima, número mínimo de literales) lo
// calculan shared/boole/canonical.ts, karnaugh.ts y minimize.ts al resolver.
import { booleVector } from "../boole/canonical.ts";
import { bnot, booleKey, booleToPlain, booleVars, bvar, literalCount, normalizeBoole, type BExpr } from "../boole/expr.ts";
import { implicantCells, kmapSolution } from "../boole/karnaugh.ts";
import { minimizeBoole } from "../boole/minimize.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const VARS: Record<number, string[]> = { 2: ["x", "y"], 3: ["x", "y", "z"], 4: ["w", "x", "y", "z"] };

const or = (...args: BExpr[]): BExpr => ({ k: "or", args });
const and = (...args: BExpr[]): BExpr => ({ k: "and", args });

/** Expresión al azar con `ops` operaciones binarias (⊕ o ⊙) sobre `vars`. */
export function randomBoole(rng: Rng, vars: readonly string[], ops: number): BExpr {
  const build = (k: number): BExpr => {
    if (k === 0) {
      const leaf = bvar(rng.pick(vars));
      return rng.chance(0.35) ? bnot(leaf) : leaf;
    }
    const left = rng.int(0, k - 1);
    const node = rng.chance(0.5) ? or(build(left), build(k - 1 - left)) : and(build(left), build(k - 1 - left));
    return rng.chance(0.15) ? bnot(node) : node;
  };
  return normalizeBoole(build(ops));
}

/** ¿Hay un argumento repetido (x ⊕ x), un literal junto a su complemento (z ⊕ z′) o un doble complemento? */
export function booleRedundant(e: BExpr): boolean {
  if (e.k === "var" || e.k === "const") return false;
  if (e.k === "not") return e.a.k === "not" || booleRedundant(e.a);
  const keys = e.args.map(booleKey);
  if (new Set(keys).size < keys.length) return true;
  if (e.args.some((a) => a.k === "not" && keys.includes(booleKey(a.a)))) return true;
  return e.args.some(booleRedundant);
}

const isConstantVector = (vec: string) => !vec.includes("1") || !vec.includes("0");

// ---------------------------------------------------------------- Σm y ΠM

/** Una función dada por su expresión, con las variables en el orden de los índices. */
export type BooleFunctionInstance = { vars: string[]; expr: string };

const CANONICAL_LIMITS: Record<ExerciseLevel, { n: number; ops: [number, number] }> = {
  básico: { n: 2, ops: [2, 3] },
  medio: { n: 3, ops: [3, 4] },
  avanzado: { n: 4, ops: [4, 5] },
};

export const BOOLE_CANONICAL: ExerciseType<BooleFunctionInstance> = {
  id: "boole-canonicas",
  topic: "boole",
  title: "Σm y ΠM",
  description: "Escribe los mintérminos y maxtérminos de una función dada por una expresión, y sus formas canónicas.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const { n, ops } = CANONICAL_LIMITS[level];
    const vars = VARS[n]!;
    const e = generateUntil(
      rngFor("boole-canonicas", seed),
      (r) => randomBoole(r, vars, r.int(ops[0], ops[1])),
      (x) => booleVars(x).length === n && !booleRedundant(x) && !isConstantVector(booleVector(x, vars)),
    );
    return { vars, expr: booleToPlain(e) };
  },
};

// ---------------------------------------------------------------- Karnaugh

/** Una función dada por su vector (0, 1 o X por fila). */
export type BooleVectorInstance = { vars: string[]; vector: string };

const KMAP_LIMITS: Record<ExerciseLevel, { n: number; dontCares: [number, number] }> = {
  básico: { n: 3, dontCares: [0, 0] },
  medio: { n: 4, dontCares: [0, 0] },
  avanzado: { n: 4, dontCares: [1, 3] },
};

/** ¿Merece la pena agrupar? Al menos dos grupos y alguno de más de una celda, en los 1 y en los 0. */
export function interestingKmap(vector: string): boolean {
  const n = Math.log2(vector.length);
  const ones = [...vector].filter((c) => c === "1").length;
  const zeros = [...vector].filter((c) => c === "0").length;
  if (ones < 2 || zeros < 2) return false;
  return (["sop", "pos"] as const).every((mode) => {
    const sol = kmapSolution(vector, mode);
    return sol.length >= 2 && sol.some((g) => implicantCells(n, g).length >= 2);
  });
}

export const BOOLE_KARNAUGH: ExerciseType<BooleVectorInstance> = {
  id: "boole-karnaugh",
  topic: "boole",
  title: "Mapa de Karnaugh",
  description: "Agrupa los 1 (o los 0) en el mapa para obtener la expresión mínima.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const { n, dontCares } = KMAP_LIMITS[level];
    const vector = generateUntil(
      rngFor("boole-karnaugh", seed),
      (r) => {
        const cells: string[] = Array.from({ length: 1 << n }, () => (r.chance(0.45) ? "1" : "0"));
        const k = r.int(dontCares[0], dontCares[1]);
        for (const m of r.shuffle(Array.from({ length: 1 << n }, (_, i) => i)).slice(0, k)) cells[m] = "X";
        return cells.join("");
      },
      interestingKmap,
    );
    return { vars: VARS[n]!, vector };
  },
};

// ---------------------------------------------------------------- Simplificar con leyes

export type BooleExprInstance = { expr: string };

const SIMPLIFY_LIMITS: Record<ExerciseLevel, { n: number; terms: [number, number]; maxLiterals: number; saving: number }> = {
  básico: { n: 2, terms: [2, 3], maxLiterals: 6, saving: 2 },
  medio: { n: 3, terms: [3, 3], maxLiterals: 9, saving: 3 },
  avanzado: { n: 3, terms: [3, 4], maxLiterals: 12, saving: 4 },
};

/**
 * Suma de productos con términos redundantes; en los niveles medio y avanzado, un término puede ir
 * complementado dos veces con De Morgan ((x′ ⊕ y)′) o sacado factor común (x ⊙ (y ⊕ z′)).
 */
function redundantSum(rng: Rng, level: ExerciseLevel): BExpr {
  const { n, terms } = SIMPLIFY_LIMITS[level];
  const vars = VARS[n]!;
  const term = (): BExpr[] => {
    const k = rng.int(1, n);
    return rng.shuffle(vars).slice(0, k).map((v) => (rng.chance(0.4) ? bnot(bvar(v)) : bvar(v)));
  };
  const list: BExpr[] = Array.from({ length: rng.int(terms[0], terms[1]) }, () => {
    const lits = term();
    if (level !== "básico" && lits.length >= 2 && rng.chance(0.3)) {
      // x ⊙ y′ = (x′ ⊕ y)′
      return bnot(or(...lits.map((l) => (l.k === "not" ? l.a : bnot(l)))));
    }
    return lits.length === 1 ? lits[0]! : and(...lits);
  });
  if (level === "avanzado" && list.length >= 3 && rng.chance(0.5)) {
    // Factor común en dos términos: x ⊙ a ⊕ x ⊙ b = x ⊙ (a ⊕ b).
    const x = bvar(rng.pick(vars));
    const [a, b, ...rest] = list;
    return normalizeBoole(or(and(x, or(a!, b!)), ...rest));
  }
  return normalizeBoole(or(...list));
}

export const BOOLE_SIMPLIFY: ExerciseType<BooleExprInstance> = {
  id: "boole-simplificar",
  topic: "boole",
  title: "Simplificar con leyes",
  description: "Simplifica la expresión paso a paso, eligiendo la ley de cada paso, hasta la forma mínima.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const { n, maxLiterals, saving } = SIMPLIFY_LIMITS[level];
    const e = generateUntil(
      rngFor("boole-simplificar", seed),
      (r) => redundantSum(r, level),
      (x) => {
        const lits = literalCount(x);
        if (booleVars(x).length !== n || lits > maxLiterals || booleRedundant(x)) return false;
        const m = minimizeBoole(x);
        // Que haya algo que simplificar y que no se quede en una constante.
        return m.ok && m.minLiterals >= 1 && lits - m.minLiterals >= saving;
      },
    );
    return { expr: booleToPlain(e) };
  },
};

export const BOOLE_EXERCISES = [BOOLE_CANONICAL, BOOLE_KARNAUGH, BOOLE_SIMPLIFY] as const;
