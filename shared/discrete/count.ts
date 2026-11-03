// Combinatoria con enteros exactos (BigInt): factorial, permutaciones Pₙ, permutaciones con repetición
// PRₙ^{n₁,…,n_r}, variaciones V_{n,k}, variaciones con repetición VR_{n,k}, combinaciones C_{n,k} y
// combinaciones con repetición CR_{n,k}, con la notación de clase. Un «modelo» describe un problema de
// recuento con datos estructurados (n, k, ¿importa el orden?, ¿se repiten?, grupos de elementos
// iguales) y el clasificador devuelve la fórmula que le corresponde.

export const FORMULA_IDS = ["P", "PR", "V", "VR", "C", "CR"] as const;
export type FormulaId = (typeof FORMULA_IDS)[number];
export const isFormulaId = (x: unknown): x is FormulaId => typeof x === "string" && (FORMULA_IDS as readonly string[]).includes(x);

/** Límite de n (y de k) en la calculadora y en el contenido: 200! ya tiene 375 cifras. */
export const MAX_COUNT_N = 200;

export interface FormulaInfo {
  id: FormulaId;
  /** Nombre como en clase. */
  name: string;
  /** Símbolo y fórmula en TeX. */
  tex: string;
  /** Lectura para lectores de pantalla. */
  spoken: string;
  /** Cuándo se usa, en una frase. */
  when: string;
}

export const FORMULAS: Readonly<Record<FormulaId, FormulaInfo>> = {
  P: {
    id: "P",
    name: "Permutaciones",
    tex: "P_n = n!",
    spoken: "P sub n igual a n factorial",
    when: "Se ordenan todos los n elementos, distintos, sin repetir: cuenta el orden y se usan todos.",
  },
  PR: {
    id: "PR",
    name: "Permutaciones con repetición",
    tex: "PR_n^{n_1,\\ldots,n_r} = \\dfrac{n!}{n_1!\\,n_2!\\cdots n_r!}",
    spoken: "P R sub n super n 1 hasta n r igual a n factorial entre n 1 factorial por n 2 factorial hasta n r factorial",
    when: "Se ordenan todos los n elementos, pero hay grupos de elementos iguales (n₁ iguales entre sí, n₂…): intercambiar dos iguales no da una ordenación nueva.",
  },
  V: {
    id: "V",
    name: "Variaciones",
    tex: "V_{n,k} = \\dfrac{n!}{(n-k)!}",
    spoken: "V sub n k igual a n factorial entre n menos k factorial",
    when: "Se eligen k de n elementos distintos, sin repetir, y el orden importa (puestos, cargos, posiciones).",
  },
  VR: {
    id: "VR",
    name: "Variaciones con repetición",
    tex: "VR_{n,k} = n^k",
    spoken: "V R sub n k igual a n elevado a k",
    when: "Se rellenan k posiciones ordenadas y en cada una vale cualquiera de los n elementos, que se pueden repetir.",
  },
  C: {
    id: "C",
    name: "Combinaciones",
    tex: "C_{n,k} = \\dbinom{n}{k} = \\dfrac{n!}{k!\\,(n-k)!}",
    spoken: "C sub n k igual a n sobre k igual a n factorial entre k factorial por n menos k factorial",
    when: "Se eligen k de n elementos distintos, sin repetir, y el orden no importa (un grupo, un subconjunto).",
  },
  CR: {
    id: "CR",
    name: "Combinaciones con repetición",
    tex: "CR_{n,k} = \\dbinom{n+k-1}{k} = \\dfrac{(n+k-1)!}{k!\\,(n-1)!}",
    spoken: "C R sub n k igual a n más k menos 1 sobre k",
    when: "Se eligen k elementos de n tipos, se puede repetir el tipo y el orden no importa (bolas de helado, monedas, repartos de objetos iguales).",
  },
};

// ---------------------------------------------------------------- Fórmulas

function nat(x: number, what: string): bigint {
  if (!Number.isSafeInteger(x) || x < 0) throw new RangeError(`${what} tiene que ser un número natural`);
  return BigInt(x);
}

const FACT: bigint[] = [1n];

/** n! exacto. */
export function factorial(n: number): bigint {
  nat(n, "n");
  for (let i = FACT.length; i <= n; i++) FACT.push(FACT[i - 1]! * BigInt(i));
  return FACT[n]!;
}

/** Pₙ = n!. */
export const permutations = (n: number): bigint => factorial(n);

/** V_{n,k} = n·(n−1)···(n−k+1); vale 0 si k > n. */
export function variations(n: number, k: number): bigint {
  const N = nat(n, "n");
  const K = nat(k, "k");
  if (K > N) return 0n;
  let out = 1n;
  for (let i = 0n; i < K; i++) out *= N - i;
  return out;
}

/** VR_{n,k} = nᵏ. */
export function variationsRep(n: number, k: number): bigint {
  return nat(n, "n") ** nat(k, "k");
}

/** C_{n,k} = n! / (k!(n−k)!); vale 0 si k > n. */
export function combinations(n: number, k: number): bigint {
  const N = nat(n, "n");
  let K = nat(k, "k");
  if (K > N) return 0n;
  if (K > N - K) K = N - K;
  let out = 1n;
  for (let i = 1n; i <= K; i++) out = (out * (N - K + i)) / i;
  return out;
}

/** CR_{n,k} = C_{n+k−1,k} (con n = 0 solo hay una forma de no elegir nada). */
export function combinationsRep(n: number, k: number): bigint {
  nat(n, "n");
  nat(k, "k");
  if (n === 0) return k === 0 ? 1n : 0n;
  return combinations(n + k - 1, k);
}

/** PRₙ^{n₁,…,n_r} = n! / (n₁!···n_r!), con n = n₁ + ··· + n_r. */
export function permutationsRep(groups: readonly number[]): bigint {
  let n = 0;
  let den = 1n;
  for (const g of groups) {
    nat(g, "cada grupo");
    n += g;
    den *= factorial(g);
  }
  return factorial(n) / den;
}

// ---------------------------------------------------------------- Modelos

/**
 * Descripción estructurada de un problema de recuento.
 * - n: elementos (o tipos) entre los que se elige; con grupos, n = suma de los grupos.
 * - k: cuántos se colocan o se eligen.
 * - order: ¿dos resultados con los mismos elementos en otro orden son distintos?
 * - repetition: ¿se puede usar un elemento más de una vez? (Con grupos, siempre: hay elementos iguales.)
 * - groups: tamaños de los grupos de elementos iguales, si se colocan todos (permutaciones con repetición).
 */
export interface CountingModel {
  n: number;
  k: number;
  order: boolean;
  repetition: boolean;
  groups?: number[];
}

/** La fórmula que corresponde a un modelo. */
export function countingFormula(m: CountingModel): FormulaId {
  if (m.groups && m.groups.length > 0) return "PR";
  if (m.order) {
    if (m.repetition) return "VR";
    return m.k === m.n ? "P" : "V";
  }
  return m.repetition ? "CR" : "C";
}

/** ¿El modelo tiene sentido? Devuelve el problema o null. */
export function modelProblem(m: CountingModel): string | null {
  if (!Number.isSafeInteger(m.n) || m.n < 1 || m.n > MAX_COUNT_N) return `n tiene que ser un número natural entre 1 y ${MAX_COUNT_N}.`;
  if (!Number.isSafeInteger(m.k) || m.k < 0 || m.k > MAX_COUNT_N) return `k tiene que ser un número natural entre 0 y ${MAX_COUNT_N}.`;
  if (m.groups && m.groups.length > 0) {
    if (m.groups.some((g) => !Number.isSafeInteger(g) || g < 1)) return "Cada grupo tiene que tener al menos un elemento.";
    if (m.groups.reduce((a, b) => a + b, 0) !== m.n) return "Los grupos tienen que sumar n.";
    if (m.k !== m.n) return "Con grupos de elementos iguales se colocan todos: k = n.";
    if (!m.order) return "Con grupos de elementos iguales el orden importa (si no, solo hay una forma).";
    return null;
  }
  if (!m.repetition && m.k > m.n) return "Sin repetición no se pueden elegir más elementos (k) de los que hay (n).";
  return null;
}

/** Valor exacto del modelo. */
export function countModel(m: CountingModel): bigint {
  switch (countingFormula(m)) {
    case "P":
      return permutations(m.n);
    case "PR":
      return permutationsRep(m.groups!);
    case "V":
      return variations(m.n, m.k);
    case "VR":
      return variationsRep(m.n, m.k);
    case "C":
      return combinations(m.n, m.k);
    case "CR":
      return combinationsRep(m.n, m.k);
  }
}

/**
 * Fórmulas que dan el mismo recuento con una lectura correcta del problema: Pₙ es V_{n,n}, y unas
 * permutaciones con dos grupos (k iguales de un tipo y n − k del otro) son elegir las posiciones del
 * primer tipo, C_{n,k}. La primera es la de clase.
 */
export function acceptedFormulas(m: CountingModel): FormulaId[] {
  const id = countingFormula(m);
  if (id === "P") return ["P", "V"];
  if (id === "PR" && m.groups!.length === 2) return ["PR", "C"];
  return [id];
}

/** La fórmula con los datos del modelo sustituidos, en TeX: «V_{8,3} = \frac{8!}{5!}». */
export function substitutedTex(m: CountingModel): string {
  const { n, k } = m;
  switch (countingFormula(m)) {
    case "P":
      return `P_{${n}} = ${n}!`;
    case "PR": {
      const g = m.groups!;
      return `PR_{${n}}^{${g.join(",")}} = \\dfrac{${n}!}{${g.map((x) => `${x}!`).join("\\,")}}`;
    }
    case "V":
      return `V_{${n},${k}} = \\dfrac{${n}!}{${n - k}!}`;
    case "VR":
      return `VR_{${n},${k}} = ${n}^{${k}}`;
    case "C":
      return `C_{${n},${k}} = \\dbinom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}`;
    case "CR":
      return `CR_{${n},${k}} = \\dbinom{${n + k - 1}}{${k}} = \\dfrac{${n + k - 1}!}{${k}!\\,${n - 1}!}`;
  }
}

/** Lo mismo en texto, para lectores de pantalla y listas: «V(8, 3) = 8!/5!». */
export function substitutedText(m: CountingModel): string {
  const { n, k } = m;
  switch (countingFormula(m)) {
    case "P":
      return `P(${n}) = ${n}!`;
    case "PR":
      return `PR(${n}; ${m.groups!.join(", ")}) = ${n}!/(${m.groups!.map((x) => `${x}!`).join("·")})`;
    case "V":
      return `V(${n}, ${k}) = ${n}!/${n - k}!`;
    case "VR":
      return `VR(${n}, ${k}) = ${n}^${k}`;
    case "C":
      return `C(${n}, ${k}) = ${n}!/(${k}!·${n - k}!)`;
    case "CR":
      return `CR(${n}, ${k}) = C(${n + k - 1}, ${k})`;
  }
}

// ---------------------------------------------------------------- Guía para decidir

/** Preguntas de la guía: la tercera depende de las dos primeras. */
export type GuideQuestion = "order" | "repetition" | "all" | "fixed";
export type GuideAnswers = { order: boolean | null; repetition: boolean | null; third: boolean | null };

export const GUIDE_TEXT: Readonly<Record<GuideQuestion, string>> = {
  order: "¿Importa el orden? (¿Dos resultados con los mismos elementos en otro orden son distintos?)",
  repetition: "¿Se pueden repetir elementos (o hay elementos iguales)?",
  all: "¿Se colocan todos los elementos (k = n)?",
  fixed: "¿Está fijado cuántas veces aparece cada elemento, y se colocan todos?",
};

/** Tercera pregunta de la guía, si la hay: solo cuando el orden importa. */
export function thirdQuestion(order: boolean | null, repetition: boolean | null): GuideQuestion | null {
  if (order !== true || repetition === null) return null;
  return repetition ? "fixed" : "all";
}

/** A qué fórmula llevan las respuestas de la guía (null si faltan respuestas). */
export function guideFormula(a: GuideAnswers): FormulaId | null {
  if (a.order === null || a.repetition === null) return null;
  if (!a.order) return a.repetition ? "CR" : "C";
  if (a.third === null) return null;
  if (a.repetition) return a.third ? "PR" : "VR";
  return a.third ? "P" : "V";
}

/** Las respuestas correctas de la guía para un modelo. */
export function guideFor(m: CountingModel): { order: boolean; repetition: boolean; third: boolean | null } {
  const id = countingFormula(m);
  switch (id) {
    case "P":
      return { order: true, repetition: false, third: true };
    case "V":
      return { order: true, repetition: false, third: false };
    case "PR":
      return { order: true, repetition: true, third: true };
    case "VR":
      return { order: true, repetition: true, third: false };
    case "C":
      return { order: false, repetition: false, third: null };
    case "CR":
      return { order: false, repetition: true, third: null };
  }
}

/** Pistas para un modelo: primero las preguntas, después qué fórmula encaja y por qué. Nunca el número. */
export function modelHints(m: CountingModel): string[] {
  const id = countingFormula(m);
  const g = guideFor(m);
  const out = [
    "Imagina dos resultados con los mismos elementos en distinto orden: si el enunciado los cuenta como distintos, el orden importa.",
    g.order
      ? "Aquí el orden importa: el mismo grupo colocado de otra forma es otro resultado. Quedan permutaciones o variaciones."
      : "Aquí el orden no importa: solo cuenta qué se elige, no en qué orden. Quedan combinaciones.",
    g.repetition
      ? id === "PR"
        ? "Hay elementos iguales entre sí: cambiar de sitio dos iguales no da un resultado nuevo, así que hay que dividir por las ordenaciones de cada grupo."
        : "Un mismo elemento puede aparecer varias veces."
      : "Cada elemento se usa como mucho una vez.",
    `${FORMULAS[id].name}: ${FORMULAS[id].when}`,
  ];
  if (id === "C" || id === "CR" || id === "V") out.push("Identifica bien n (entre cuántos eliges) y k (cuántos eliges) antes de sustituir.");
  if (id === "PR") out.push("n es el total de posiciones, y cada nᵢ, cuántos elementos iguales hay de cada tipo (suman n).");
  return out;
}
