// Ejercicios de formalizar, negar en lenguaje natural y predicados sobre conjuntos numéricos: cada
// patrón tiene una sola opción equivalente a la buena (con el motor de lógica o de predicados), y el
// valor de cada familia numérica en ℕ, ℤ, ℚ y ℝ se comprueba con testigos y contraejemplos.
import { describe, expect, it } from "vitest";
import { parseFormula } from "../logic/parser.ts";
import { compareFormulas } from "../logic/compare.ts";
import {
  divides,
  FORMALIZE_PATTERNS,
  formalizeMatches,
  formalizeSentence,
  formalizeTarget,
  LOGIC_FORMALIZE,
  NUMBER_FAMILIES,
  NUMBER_SETS,
  numberFamily,
  PRED_NEGATE_NL,
  PRED_NUMBERS,
  truthSets,
  type NumberSet,
} from "./logic-extra.ts";
import { isNegation } from "./logic-extra-negation.ts";
import { exercisesOfTopic } from "./registry.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "./types.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761) >>> 0);
const each = (fn: (seed: number, level: ExerciseLevel) => void) => {
  for (const level of EXERCISE_LEVELS) for (const s of SEEDS) fn(s, level);
};
const equivalent = (a: string, b: string) => {
  const x = parseFormula(a);
  const y = parseFormula(b);
  if (!x.ok || !y.ok) throw new Error(`ilegible: ${a} | ${b}`);
  const c = compareFormulas(x.ast, y.ast);
  return c.ok && c.equivalent;
};

describe("registro", () => {
  it("los nuevos tipos van en sus temas, tras los que ya había", () => {
    expect(exercisesOfTopic("logica").map((t) => t.id).at(-1)).toBe("logica-formalizar");
    expect(exercisesOfTopic("predicados").map((t) => t.id).slice(-2)).toEqual(["predicados-negar-frase", "predicados-conjuntos-numericos"]);
  });
});

describe("formalizar", () => {
  it("cada patrón cubre su conectiva y tiene al menos tres errores típicos no equivalentes", () => {
    const keys = FORMALIZE_PATTERNS.map((p) => p.id).join(" ");
    for (const k of ["suficiente", "necesario", "solo-si", "si-y-solo-si", "a-menos-que", "ni-ni", "no-es-cierto"]) expect(keys).toContain(k);
    for (const p of FORMALIZE_PATTERNS) {
      expect(p.wrong.filter((w) => !equivalent(w, p.formula)).length, p.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("cuatro opciones distintas, una sola equivalente a la buena; la frase acaba en punto", () => {
    each((s, level) => {
      const x = LOGIC_FORMALIZE.generate(s, level);
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options).size).toBe(4);
      expect(x.options.filter((o) => equivalent(o, formalizeTarget(x)))).toHaveLength(1);
      expect(formalizeSentence(x)).toMatch(/^[A-ZÁÉÍÓÚ].*\.$/);
      expect(new Set(x.atoms).size).toBe(x.atoms.length);
    });
  });

  it("escrita a mano: vale cualquier forma equivalente; otras letras no se aceptan", () => {
    const x = { pattern: "a-menos-que", atoms: ["practica", "examen"], options: [] };
    expect(formalizeSentence(x)).toBe("Entregas la práctica a menos que apruebes el examen.");
    expect(formalizeMatches("p ∨ q", x)).toBe(true);
    expect(formalizeMatches("¬q → p", x)).toBe(true);
    expect(formalizeMatches("q → p", x)).toBe(false);
    expect(formalizeMatches("p ∨ s", x)).toBeNull();
    expect(formalizeMatches("p ∨", x)).toBeNull();
    const y = { pattern: "suficiente-conjuncion", atoms: ["practica", "examen", "asignatura"], options: [] };
    expect(formalizeSentence(y)).toBe("Entregar la práctica y aprobar el examen es suficiente para superar la asignatura.");
    expect(formalizeMatches("p → (q → r)", y)).toBe(true);
  });
});

describe("negar en lenguaje natural", () => {
  it("una sola opción es la negación (comprobado con el motor de predicados)", () => {
    each((s, level) => {
      const x = PRED_NEGATE_NL.generate(s, level);
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options.map((o) => o.text)).size).toBe(4);
      expect(x.options.filter((o) => isNegation(x.formula, o.formula)), x.sentence).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------- conjuntos numéricos

/** Fracción n/d con d > 0, en números pequeños (exactos en coma flotante). */
type F = [number, number];
const eq = (a: F, b: F) => a[0] * b[1] === b[0] * a[1];
const lt = (a: F, b: F) => a[0] * b[1] < b[0] * a[1];
const mul = (a: F, b: F): F => [a[0] * b[0], a[1] * b[1]];
const add = (a: F, b: F): F => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
const int = (n: number): F => [n, 1];

function elements(set: NumberSet, wide: boolean): F[] {
  const lim = wide ? 60 : 10;
  if (set === "N") return Array.from({ length: lim }, (_, i) => int(i + 1));
  if (set === "Z") return Array.from({ length: 2 * lim + 1 }, (_, i) => int(i - lim));
  // ℚ: muestra con denominadores 1 y 2; testigos con denominadores hasta 60.
  const out: F[] = [];
  const [dMax, nMax] = wide ? [60, 150] : [2, 6];
  for (let d = 1; d <= dMax; d++) for (let n = -nMax; n <= nMax; n++) out.push([n, d]);
  return out;
}

/** Valor de la familia en un conjunto (sin ℝ): búsqueda acotada de testigos. */
function search(id: string, c: number, set: NumberSet): boolean {
  const sample = elements(set, false);
  const cand = elements(set, true);
  const forallExists = (ok: (y: F, x: F) => boolean) => sample.every((y) => cand.some((x) => ok(y, x)));
  switch (id) {
    case "cubo":
      return forallExists((y, x) => eq(y, mul(x, mul(x, x))));
    case "suma":
      return forallExists((y, x) => eq(y, add(x, int(c))));
    case "producto":
      return forallExists((y, x) => eq(y, mul(int(c), x)));
    case "inverso-cubo":
      return forallExists((x, y) => eq(mul(add(mul(x, x), int(1)), mul(y, mul(y, y))), int(1)));
    case "inverso":
      return forallExists((x, y) => eq(mul(add(mul(x, x), int(1)), y), int(1)));
    case "menor":
      return forallExists((x, y) => lt(y, x));
    case "minimo":
      // Hay mínimo si algún elemento es ≤ que todos los de la búsqueda amplia.
      return cand.some((x) => cand.every((y) => !lt(y, x)) && sample.some((s) => eq(s, x)));
    case "densidad":
      return sample.every((x) => sample.every((y) => !lt(x, y) || cand.some((z) => lt(x, z) && lt(z, y))));
    case "raiz-dos":
      return cand.some((x) => eq(mul(x, x), int(c)));
    case "opuesto":
      return cand.some((x) => eq(add(x, int(c)), int(0)));
    case "fraccion":
      return cand.some((x) => eq(mul(int(c), x), int(1)));
  }
  throw new Error(id);
}

/** En ℝ: el testigo de la explicación, en coma flotante. */
function realWitness(id: string, c: number): boolean {
  const ys = [-7.5, -2, -1, 0, 0.3, 1, 2, 9.25];
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  switch (id) {
    case "cubo":
      return ys.every((y) => close(Math.cbrt(y) ** 3, y));
    case "suma":
      return ys.every((y) => close(y - c + c, y));
    case "producto":
      return ys.every((y) => close(c * (y / c), y));
    case "inverso-cubo":
      return ys.every((x) => close((x * x + 1) * (1 / Math.cbrt(x * x + 1)) ** 3, 1));
    case "inverso":
      return ys.every((x) => close((x * x + 1) * (1 / (x * x + 1)), 1));
    case "menor":
      return ys.every((x) => x - 1 < x);
    case "minimo":
      return false; // x − 1 < x para todo x real: no hay mínimo.
    case "densidad":
      return ys.every((x) => ys.every((y) => !(x < y) || (x < (x + y) / 2 && (x + y) / 2 < y)));
    case "raiz-dos":
      return close(Math.sqrt(c) ** 2, c);
    case "opuesto":
      return close(-c + c, 0);
    case "fraccion":
      return close(c * (1 / c), 1);
  }
  throw new Error(id);
}

describe("predicados sobre conjuntos numéricos", () => {
  it("el valor de cada familia en ℕ, ℤ y ℚ sale de la búsqueda acotada, y en ℝ del testigo", () => {
    for (const f of NUMBER_FAMILIES) {
      for (const c of f.id === "raiz-dos" ? [2, 3, 5, 6, 7] : [2, 3, 9]) {
        for (const set of ["N", "Z", "Q"] as const) expect(search(f.id, c, set), `${f.id} c=${c} en ${set}`).toBe(f.truth[set]);
        expect(realWitness(f.id, c), `${f.id} en ℝ`).toBe(f.truth.R);
        for (const set of NUMBER_SETS) expect(f.why(c)[set].length).toBeGreaterThan(10);
      }
    }
  });

  it("divisibilidad: p(x, y) ≡ ∃k ∈ ℤ: y = k·x, también con 0 y negativos", () => {
    for (let x = -7; x <= 7; x++) {
      for (let y = -15; y <= 15; y++) {
        const brute = Array.from({ length: 41 }, (_, i) => i - 20).some((k) => y === k * x);
        expect(divides(x, y), `${x} | ${y}`).toBe(brute);
      }
    }
  });

  it("generador: una sola opción buena", () => {
    each((s, level) => {
      const x = PRED_NUMBERS.generate(s, level);
      if (x.kind === "divide") {
        expect(x.pairs).toHaveLength(4);
        expect(x.pairs.filter(([a, b]) => divides(a, b))).toHaveLength(1);
      } else {
        const truth = truthSets(numberFamily(x.family));
        expect(x.options).toHaveLength(4);
        const keys = x.options.map((o) => [...o].sort().join(""));
        expect(new Set(keys).size).toBe(4);
        expect(keys.filter((k) => k === [...truth].sort().join(""))).toHaveLength(1);
      }
    });
  });
});
