// Ejercicios de tensores (02MIAR, sesión de tensores): el convenio de suma de Einstein (índices mudos y
// libres, sumandos y componentes), el producto tensorial y la contracción, las coordenadas de un vector
// en otra base (también escalada, y las componentes covariantes) y la matriz de un operador en una base
// nueva, D = C⁻¹·A·C, comprobada con la traza. Los datos salen al azar con la semilla (nunca son los de
// una actividad del curso); los pasos y su corrección se montan en shared/exercises/guided.ts.
import { intMatrix, matrixProduct, matrixTranspose, fracText, matrixTex, trace, type Matrix } from "../linalg/matrix.ts";
import { matrixInverse } from "../linalg/rref.ts";
import { matrixDeterminant } from "../linalg/det.ts";
import { add, equals, frac, mul, ZERO, type Frac } from "../rational.ts";
import { cleanMistakes, dimsText, sameDims, sameMatrix, type GuidedExercise, type GuidedStep, type Mistake } from "./guided.ts";
import { pickHints, type TaggedHint } from "./hints.ts";
import { unimodular } from "./linalg.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Ints = number[][];
const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const subDigits = (k: number | string) => [...String(k)].map((d) => SUB[Number(d)] ?? d).join("");
export const supDigits = (k: number | string) => [...String(k)].map((d) => SUP[Number(d)] ?? d).join("");
const minus = (s: string) => s.replace(/-/g, "−");
const num = (x: number) => minus(String(x));
const one = (x: Frac): Matrix => [[x]];
const int = (x: number | bigint): Frac => frac(BigInt(x));
const intsTex = (M: Ints) => matrixTex(intMatrix(M));
const vecText = (v: readonly number[]) => minus(`(${v.join(", ")})`);
const fracVecText = (v: readonly Frac[]) => `(${v.map(fracText).join(", ")})`;
const matText = (M: Matrix) => `(${M.map((r) => r.map(fracText).join(" ")).join("; ")})`;

// ================================================================ Convenio de suma de Einstein

export type EinsteinFactor = { name: string; lower: string[]; upper: string[] };
export type EinsteinInstance = { n: number; factors: EinsteinFactor[] };

/** Cada índice, en el orden en que aparece, con cuántas veces sale. */
export function einsteinIndices(inst: EinsteinInstance): Array<{ letter: string; count: number }> {
  const out: Array<{ letter: string; count: number }> = [];
  for (const f of inst.factors)
    for (const l of [...f.upper, ...f.lower]) {
      const x = out.find((o) => o.letter === l);
      if (x) x.count++;
      else out.push({ letter: l, count: 1 });
    }
  return out;
}

export const einsteinDummies = (inst: EinsteinInstance) => einsteinIndices(inst).filter((x) => x.count === 2).map((x) => x.letter);
export const einsteinFree = (inst: EinsteinInstance) => einsteinIndices(inst).filter((x) => x.count === 1).map((x) => x.letter);

const factorTex = (f: EinsteinFactor) => `${f.name}${f.upper.length ? `^{${f.upper.join("")}}` : ""}${f.lower.length ? `_{${f.lower.join("")}}` : ""}`;
const factorPlain = (f: EinsteinFactor) => `${f.name}${f.upper.length ? `^${f.upper.join("")}` : ""}${f.lower.length ? `_${f.lower.join("")}` : ""}`;
export const einsteinTex = (inst: EinsteinInstance) => inst.factors.map(factorTex).join("\\,");
export const einsteinPlain = (inst: EinsteinInstance) => inst.factors.map(factorPlain).join(" ");

const hasUpper = (inst: EinsteinInstance) => inst.factors.some((f) => f.upper.length > 0);
const hasTrace = (inst: EinsteinInstance) => inst.factors.some((f) => new Set([...f.upper, ...f.lower]).size < f.upper.length + f.lower.length);

/** Etiquetas del enunciado para las pistas: arriba (índices arriba y abajo), traza, sin-libres. */
export function einsteinTokens(inst: EinsteinInstance): string[] {
  const t: string[] = [];
  if (hasUpper(inst)) t.push("arriba");
  if (hasTrace(inst)) t.push("traza");
  if (einsteinFree(inst).length === 0) t.push("sin-libres");
  if (einsteinDummies(inst).length >= 2) t.push("varios-mudos");
  return t;
}

const EINSTEIN_LABEL_HINTS: readonly TaggedHint[] = [
  { text: "Un índice que aparece dos veces es mudo: se suma de 1 a n y no queda en el resultado." },
  { text: "Un índice que aparece una sola vez es libre: la expresión vale para cada uno de sus valores." },
  { needs: ["arriba"], text: "Con índices arriba y abajo, el mudo sale una vez arriba y otra abajo; arriba o abajo no cambia que se cuente dos veces." },
  { needs: ["traza"], text: "Si un índice se repite dentro del mismo factor, también se suma (es como una traza)." },
];
const EINSTEIN_TERMS_HINTS: readonly TaggedHint[] = [
  { text: "Cada índice mudo recorre sus n valores: por cada mudo, el número de sumandos se multiplica por n." },
  { needs: ["varios-mudos"], text: "Con varios mudos se suman todas las combinaciones de sus valores." },
];
const EINSTEIN_COMPONENTS_HINTS: readonly TaggedHint[] = [
  { text: "Las componentes las dan los índices libres: una por cada combinación de sus valores." },
  { needs: ["sin-libres"], text: "Sin índices libres, la expresión es un solo número." },
];

const EINSTEIN_NAMES = ["a", "b", "c", "x", "y", "u", "v", "w", "T", "S"] as const;
const LETTERS = ["i", "j", "k", "l", "m", "r", "s"] as const;

function makeEinstein(rng: Rng, level: ExerciseLevel): EinsteinInstance {
  const n = rng.int(2, 4);
  const [d, f, k] =
    level === "básico" ? [1, rng.int(0, 1), 2] : level === "medio" ? [rng.int(1, 2), rng.int(0, 2), rng.int(2, 3)] : [rng.int(2, 3), rng.int(1, 2), rng.int(2, 3)];
  const letters = rng.shuffle(LETTERS).slice(0, d + f);
  const dummies = letters.slice(0, d);
  const free = letters.slice(d);
  const strict = level === "avanzado";
  const allowTrace = level !== "básico" && rng.chance(0.25);
  // Huecos: cada mudo dos (arriba y abajo con la regla estricta), cada libre uno.
  type Slot = { letter: string; up: boolean; pair: number };
  const slots: Slot[] = [];
  dummies.forEach((l, p) => {
    const firstUp = rng.chance(0.5);
    slots.push({ letter: l, up: strict && firstUp, pair: p }, { letter: l, up: strict && !firstUp, pair: p });
  });
  for (const l of free) slots.push({ letter: l, up: strict && rng.chance(0.4), pair: -1 });
  const owner = slots.map(() => rng.int(0, k - 1));
  // Los dos huecos de un mudo en factores distintos (salvo una traza).
  dummies.forEach((_, p) => {
    const [a, b] = slots.flatMap((s, i) => (s.pair === p ? [i] : []));
    if (owner[a!] === owner[b!] && !(allowTrace && p === 0)) owner[b!] = (owner[a!]! + 1 + rng.int(0, k - 2)) % k;
  });
  const names = rng.shuffle(EINSTEIN_NAMES).slice(0, k);
  const factors = names.map((name, i) => {
    const mine = slots.filter((_, s) => owner[s] === i);
    const order = rng.shuffle(mine);
    return { name, upper: order.filter((s) => s.up).map((s) => s.letter), lower: order.filter((s) => !s.up).map((s) => s.letter) };
  });
  return { n, factors };
}

export const LINALG_EINSTEIN: ExerciseType<EinsteinInstance> = {
  id: "algebra-einstein",
  topic: "algebra-lineal",
  title: "Convenio de suma de Einstein",
  description: "Con n dado, clasifica cada índice en mudo (se suma) o libre, y cuenta los sumandos de cada componente y cuántas componentes representa la expresión.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-einstein", seed),
      (r) => makeEinstein(r, level),
      (inst) => {
        if (inst.factors.some((f) => f.lower.length + f.upper.length === 0 || f.lower.length + f.upper.length > 3)) return false;
        const d = einsteinDummies(inst).length;
        const f = einsteinFree(inst).length;
        return inst.n ** d <= 64 && inst.n ** f <= 64;
      },
    );
  },
};

/** El desarrollo de la primera componente (todos los libres a 1), si tiene pocos sumandos. */
export function einsteinExpansion(inst: EinsteinInstance): string | null {
  const dummies = einsteinDummies(inst);
  const free = einsteinFree(inst);
  const terms = inst.n ** dummies.length;
  if (terms > 9) return null;
  const values = (t: number) => Object.fromEntries(dummies.map((l, i) => [l, Math.floor(t / inst.n ** (dummies.length - 1 - i)) % inst.n + 1]));
  const pieces = Array.from({ length: terms }, (_, t) => {
    const v: Record<string, number> = { ...Object.fromEntries(free.map((l) => [l, 1])), ...values(t) };
    return inst.factors.map((f) => `${f.name}${f.upper.length ? supDigits(f.upper.map((l) => v[l]).join("")) : ""}${f.lower.length ? subDigits(f.lower.map((l) => v[l]).join("")) : ""}`).join("");
  });
  const head = free.length === 0 ? "La expresión es" : `Para ${free.map((l) => `${l} = 1`).join(", ")}:`;
  return `${head} ${pieces.join(" + ")}.`;
}

export function einsteinGuided(inst: EinsteinInstance): GuidedExercise {
  const n = inst.n;
  const d = einsteinDummies(inst);
  const f = einsteinFree(inst);
  const tokens = einsteinTokens(inst);
  const idx = einsteinIndices(inst);
  const terms = BigInt(n) ** BigInt(d.length);
  const comps = BigInt(n) ** BigInt(f.length);
  const intM = (value: bigint, text: string): Mistake<bigint> => ({ value, text });
  const steps: GuidedStep[] = [
    {
      kind: "labels",
      title: "¿Qué índices son mudos y cuáles libres?",
      items: idx.map((x) => `Índice ${x.letter}`),
      options: [
        { id: "mudo", text: "Mudo (se suma)" },
        { id: "libre", text: "Libre" },
      ],
      expected: idx.map((x) => (x.count === 2 ? "mudo" : "libre")),
      hints: pickHints(EINSTEIN_LABEL_HINTS, tokens),
      okText: "Bien: esos son los mudos y los libres.",
    },
    {
      kind: "integer",
      title: "¿Cuántos sumandos tiene cada componente?",
      label: "Sumandos de cada componente",
      expected: terms,
      mistakes: cleanMistakes(
        terms,
        [
          intM(BigInt(n * d.length), "Cada índice mudo multiplica los sumandos por n; no se suma n una vez por cada mudo."),
          intM(BigInt(n) ** BigInt(d.length + f.length), "Has contado también los índices libres: un libre no se suma, da componentes distintas."),
          intM(BigInt(d.length) ** BigInt(n), "Cuidado con el orden: es n (los valores de cada índice) elevado al número de mudos."),
          intM(BigInt(d.length), "Eso es el número de índices mudos; se piden los sumandos que salen al recorrer sus valores."),
          d.length >= 2 ? intM(BigInt(n), "Hay más de un índice mudo: se suman todas las combinaciones de sus valores.") : null,
        ],
        (a, b) => a === b,
      ),
      hints: pickHints(EINSTEIN_TERMS_HINTS, tokens),
      okText: `Bien: ${terms} sumandos.`,
    },
    {
      kind: "integer",
      title: "¿Cuántas componentes (expresiones distintas) representa?",
      label: "Componentes",
      expected: comps,
      mistakes: cleanMistakes(
        comps,
        [
          intM(terms, "Ese es el número de sumandos: las componentes las dan los índices libres, no los mudos."),
          intM(BigInt(n * f.length), "Cada índice libre multiplica las componentes por n (todas las combinaciones de valores)."),
          f.length > 0 ? intM(1n, "Con índices libres hay una componente por cada valor (o combinación de valores) de los libres.") : null,
          f.length === 0 ? intM(0n, "Sin índices libres la expresión no desaparece: es un solo número.") : null,
          intM(BigInt(n) ** BigInt(d.length + f.length), "Has contado también los mudos: esos se suman dentro de cada componente."),
        ],
        (a, b) => a === b,
      ),
      hints: pickHints(EINSTEIN_COMPONENTS_HINTS, tokens),
      okText: f.length === 0 ? "Bien: es un escalar, una sola componente." : `Bien: ${comps} componentes.`,
    },
  ];
  const expansion = einsteinExpansion(inst);
  const solution = [
    d.length === 1 ? `Mudo: ${d[0]} (aparece dos veces).` : `Mudos: ${d.join(", ")} (aparecen dos veces).`,
    f.length === 0 ? "Libres: ninguno." : f.length === 1 ? `Libre: ${f[0]} (aparece una vez).` : `Libres: ${f.join(", ")} (aparecen una vez).`,
    `Sumandos de cada componente: n^(mudos) = ${n}${supDigits(d.length)} = ${terms}.`,
    f.length === 0 ? `Componentes: sin libres, es un escalar (${n}⁰ = 1).` : `Componentes: n^(libres) = ${n}${supDigits(f.length)} = ${comps}.`,
    ...(expansion ? [expansion] : []),
  ];
  return {
    statement: {
      blocks: [
        { kind: "p", text: `Con el convenio de suma de Einstein y n = ${n}: cada índice toma los valores 1, …, ${n}.` },
        { kind: "tex", tex: einsteinTex(inst), label: `Expresión: ${einsteinPlain(inst)}` },
      ],
      ask: "Clasifica los índices, cuenta los sumandos de cada componente y cuántas componentes representa.",
    },
    steps,
    solution,
  };
}

// ================================================================ Producto tensorial y contracción

/** Un tensor pequeño: forma y datos por filas (row-major). */
export type SmallTensor = { shape: number[]; data: number[] };

export const tensorOf = (M: Ints, isVector: boolean): SmallTensor => (isVector ? { shape: [M[0]!.length], data: [...M[0]!] } : { shape: [M.length, M[0]!.length], data: M.flat() });

const strides = (shape: readonly number[]) => shape.map((_, i) => shape.slice(i + 1).reduce((a, b) => a * b, 1));
export const tensorAt = (t: SmallTensor, idx: readonly number[]) => t.data[idx.reduce((acc, x, i) => acc + x * strides(t.shape)[i]!, 0)]!;

export function outer(a: SmallTensor, b: SmallTensor): SmallTensor {
  return { shape: [...a.shape, ...b.shape], data: a.data.flatMap((x) => b.data.map((y) => x * y + 0)) };
}

/** Contrae los ejes p y q (desde 0, p < q, de la misma longitud): se igualan y se suman. */
export function contract(t: SmallTensor, p: number, q: number): SmallTensor {
  const shape = t.shape.filter((_, i) => i !== p && i !== q);
  const size = shape.reduce((a, b) => a * b, 1);
  const st = strides(shape);
  const data = Array.from({ length: size }, (_, flat) => {
    const rest = shape.map((_, i) => Math.floor(flat / st[i]!) % shape[i]!);
    let s = 0;
    for (let k = 0; k < t.shape[p]!; k++) {
      const full: number[] = [];
      let r = 0;
      for (let i = 0; i < t.shape.length; i++) full.push(i === p || i === q ? k : rest[r++]!);
      s += tensorAt(t, full);
    }
    return s;
  });
  return { shape, data };
}

/** El tensor de orden 0, 1 o 2 como matriz (escalar 1×1, vector fila 1×n). */
export const tensorMatrix = (t: SmallTensor): Matrix =>
  t.shape.length === 0 ? [[int(t.data[0]!)]] : t.shape.length === 1 ? [t.data.map(int)] : Array.from({ length: t.shape[0]! }, (_, i) => t.data.slice(i * t.shape[1]!, (i + 1) * t.shape[1]!).map(int));

export type OuterInstance = {
  a: Ints;
  aVec: boolean;
  b: Ints;
  bVec: boolean;
  /** Ejes que se contraen (desde 1), o null. */
  contract: [number, number] | null;
  /** Entradas que se piden (índices desde 1) si no se pide el resultado entero. */
  entries: number[][];
};

const outerOf = (inst: OuterInstance) => outer(tensorOf(inst.a, inst.aVec), tensorOf(inst.b, inst.bVec));
export const outerResult = (inst: OuterInstance) => {
  const t = outerOf(inst);
  return inst.contract ? contract(t, inst.contract[0] - 1, inst.contract[1] - 1) : t;
};

const IDX = ["i", "j", "k", "l"] as const;
const outerNames = (inst: OuterInstance) => [inst.aVec ? "u" : "A", inst.bVec ? "v" : "B"] as const;

function makeOuter(rng: Rng, level: ExerciseLevel): OuterInstance {
  const vec = (len: number) => [Array.from({ length: len }, () => rng.int(-3, 4))];
  const mat = (r: number, c: number) => Array.from({ length: r }, () => Array.from({ length: c }, () => rng.int(-3, 3)));
  if (level === "básico") return { a: vec(rng.int(2, 3)), aVec: true, b: vec(rng.int(2, 3)), bVec: true, contract: null, entries: [] };
  if (level === "medio") {
    if (rng.chance(0.4)) {
      const m = rng.int(2, 4);
      return { a: vec(m), aVec: true, b: vec(m), bVec: true, contract: [1, 2], entries: [] };
    }
    const p = rng.int(2, 3);
    const entries = Array.from({ length: 2 }, () => [rng.int(1, 2), rng.int(1, 2), rng.int(1, p)]);
    return { a: mat(2, 2), aVec: false, b: vec(p), bVec: true, contract: null, entries };
  }
  if (rng.chance(0.3)) return { a: mat(2, 2), aVec: false, b: vec(2), bVec: true, contract: rng.pick([[1, 3], [2, 3]] as Array<[number, number]>), entries: [] };
  return { a: mat(2, 2), aVec: false, b: mat(2, 2), bVec: false, contract: rng.pick([[2, 3], [1, 3], [2, 4], [1, 4]] as Array<[number, number]>), entries: [] };
}

export const LINALG_OUTER: ExerciseType<OuterInstance> = {
  id: "algebra-producto-tensorial",
  topic: "algebra-lineal",
  title: "Producto tensorial y contracción",
  description: "Calcula u ⊗ v (o A ⊗ v, A ⊗ B), su orden y su forma, alguna de sus entradas y el resultado de contraer dos índices.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-producto-tensorial", seed),
      (r) => makeOuter(r, level),
      (inst) => {
        const t = outerResult(inst);
        const zeros = [...inst.a.flat(), ...inst.b.flat()].filter((x) => x === 0).length;
        if (zeros > 1) return false;
        // Que la contracción no dé lo mismo que otra (así el error típico se distingue).
        if (inst.contract && !inst.aVec && !inst.bVec) {
          const others = outerMistakes(inst);
          if (others.length < 2) return false;
        }
        if (inst.entries.length === 2 && inst.entries[0]!.join() === inst.entries[1]!.join()) return false;
        return t.data.every((x) => Math.abs(x) <= 40) && (t.data.some((x) => x !== 0) || t.shape.length > 0);
      },
    );
  },
};

const indexTex = (letters: readonly string[]) => letters.join("");

/** Contracciones de los otros pares (y el producto casilla a casilla): resultados equivocados típicos. */
function outerMistakes(inst: OuterInstance): Mistake<Matrix>[] {
  if (!inst.contract) return [];
  const t = outerOf(inst);
  const right = tensorMatrix(outerResult(inst));
  const pairs: Array<[number, number]> = [];
  for (let p = 0; p < t.shape.length; p++) for (let q = p + 1; q < t.shape.length; q++) if (t.shape[p] === t.shape[q]) pairs.push([p, q]);
  const wrong: Array<Mistake<Matrix> | null> = pairs
    .filter(([p, q]) => !(p === inst.contract![0] - 1 && q === inst.contract![1] - 1))
    .map(([p, q]) => {
      const c = contract(t, p, q);
      return c.shape.length === t.shape.length - 2 ? { value: tensorMatrix(c), text: "Ese resultado sale al contraer otro par de índices: fíjate en qué dos posiciones se igualan y se suman." } : null;
    });
  if (!inst.aVec && !inst.bVec) wrong.push({ value: inst.a.map((r, i) => r.map((x, j) => int(x * inst.b[i]![j]!))), text: "Has multiplicado casilla a casilla: al contraer se suma sobre el índice repetido." });
  return cleanMistakes(right, wrong, sameMatrix).filter((m) => m.value.length === right.length && m.value[0]!.length === right[0]!.length);
}

export function outerGuided(inst: OuterInstance): GuidedExercise {
  const [an, bn] = outerNames(inst);
  const ta = tensorOf(inst.a, inst.aVec);
  const tb = tensorOf(inst.b, inst.bVec);
  const t = outerOf(inst);
  const order = t.shape.length;
  const idxA = IDX.slice(0, ta.shape.length);
  const idxB = IDX.slice(ta.shape.length, order);
  const prodName = `${an} ⊗ ${bn}`;
  const blocks: GuidedExercise["statement"]["blocks"] = [
    { kind: "tex", tex: `${an} = ${inst.aVec ? `(${inst.a[0]!.join(",\\ ")})` : intsTex(inst.a)}`, label: `${an} = ${inst.aVec ? vecText(inst.a[0]!) : matText(intMatrix(inst.a))}` },
    { kind: "tex", tex: `${bn} = ${inst.bVec ? `(${inst.b[0]!.join(",\\ ")})` : intsTex(inst.b)}`, label: `${bn} = ${inst.bVec ? vecText(inst.b[0]!) : matText(intMatrix(inst.b))}` },
    {
      kind: "tex",
      tex: `T = ${an}\\otimes ${bn},\\quad T_{${indexTex([...idxA, ...idxB])}} = ${an}_{${indexTex(idxA)}}\\,${bn}_{${indexTex(idxB)}}`,
      label: `T = ${prodName}, con T sub ${[...idxA, ...idxB].join(" ")} = ${an} sub ${idxA.join(" ")} por ${bn} sub ${idxB.join(" ")}`,
    },
  ];
  const steps: GuidedStep[] = [];
  const orderMistakes = cleanMistakes<bigint>(
    BigInt(order),
    [
      { value: BigInt(Math.max(ta.shape.length, tb.shape.length)), text: "El producto tensorial no se queda con el orden del mayor: junta los índices de los dos." },
      ta.shape.length * tb.shape.length !== order ? { value: BigInt(ta.shape.length * tb.shape.length), text: "Los órdenes se suman (se juntan los índices), no se multiplican." } : null,
      { value: BigInt(t.data.length), text: "Ese es el número de componentes; el orden es el número de índices." },
    ],
    (a, b) => a === b,
  );
  steps.push({
    kind: "integer",
    title: `Orden (rango) de T = ${prodName}`,
    label: "Orden de T",
    expected: BigInt(order),
    mistakes: orderMistakes,
    hints: ["El orden es el número de índices. El producto tensorial junta los índices de los dos factores."],
    okText: `Bien: T tiene orden ${order}.`,
  });
  steps.push({
    kind: "shape",
    title: "Forma de T (como en NumPy)",
    expected: t.shape,
    allowError: false,
    mistakes: cleanMistakes(t.shape, [
      { value: [...tb.shape, ...ta.shape], text: `Primero van los ejes de ${an} y después los de ${bn}.` },
      { value: [t.data.length], text: "Eso sería aplanarlo: el producto tensorial conserva todos los ejes de los dos factores." },
    ], sameDims) as Mistake<number[]>[],
    hints: [`Cada índice de T conserva la longitud que tenía en ${an} o en ${bn}, en ese orden.`],
    okText: `Bien: T tiene forma ${dimsText(t.shape)}.`,
  });
  if (!inst.contract && order === 2) {
    const M = tensorMatrix(t);
    steps.push({
      kind: "numbers",
      title: `${prodName} entero (fila i, columna j)`,
      name: prodName,
      expected: M,
      mistakes: cleanMistakes(M, [
        M.length === M[0]!.length ? { value: matrixTranspose(M), text: `Has puesto ${bn} en las filas: en (${prodName})ᵢⱼ, la fila la da ${an} y la columna ${bn}.` } : null,
        { value: inst.a[0]!.map((x) => inst.b[0]!.map((y) => int(x + y))), text: "El producto tensorial multiplica las componentes, no las suma." },
      ], sameMatrix),
      hints: [`(${prodName})ᵢⱼ = ${an}ᵢ·${bn}ⱼ: la fila i es ${an}ᵢ por todo ${bn}.`],
      okText: `Bien: ese es ${prodName}.`,
    });
  }
  for (const e of inst.entries) {
    const value = tensorAt(t, e.map((x) => x - 1));
    const name = `T${subDigits(e.join(""))}`;
    const swapped = [e[0]!, e[1]!].reverse();
    steps.push({
      kind: "numbers",
      title: `Entrada ${name}`,
      name,
      expected: one(int(value)),
      mistakes: cleanMistakes(one(int(value)), [
        { value: one(int(tensorAt(ta, swapped.map((x) => x - 1)) * tb.data[e[2]! - 1]!)), text: `Los dos primeros índices son los de ${an} en su orden: fila y columna.` },
        { value: one(int(tensorAt(ta, [e[0]! - 1, e[1]! - 1]) + tb.data[e[2]! - 1]!)), text: "Es un producto: multiplica la entrada de A por la de v." },
      ], sameMatrix),
      hints: [`Tᵢⱼₖ = ${an}ᵢⱼ·${bn}ₖ: busca la entrada de ${an} con los dos primeros índices y la de ${bn} con el tercero.`],
      okText: `Bien: ${name} = ${value}.`,
    });
  }
  if (inst.contract) {
    const [p, q] = inst.contract;
    const c = outerResult(inst);
    const letters = [...idxA, ...idxB];
    const rep = letters.map((l, i) => (i === q - 1 ? letters[p - 1]! : l));
    const kept = letters.filter((_, i) => i !== p - 1 && i !== q - 1);
    const contracted = `C${kept.length ? `_{${kept.join("")}}` : ""} = T_{${rep.join("")}}`;
    blocks.push({
      kind: "p",
      text: `Se contraen el índice ${p} y el ${q} de T: se igualan y se suman (convenio de Einstein).`,
    });
    blocks.push({ kind: "tex", tex: contracted, label: `C${kept.length ? ` sub ${kept.join(" ")}` : ""} = T sub ${rep.join(" ")}` });
    steps.push({
      kind: "integer",
      title: "Orden del resultado C de la contracción",
      label: "Orden de C",
      expected: BigInt(order - 2),
      mistakes: cleanMistakes<bigint>(BigInt(order - 2), [{ value: BigInt(order - 1), text: "Al contraer desaparecen los dos índices que se igualan, no solo uno." }, { value: BigInt(order), text: "Contraer quita índices: los dos que se igualan se suman y desaparecen." }], (a, b) => a === b),
      hints: ["Contraer iguala dos índices y suma sobre ellos: el orden baja en 2."],
      okText: `Bien: C tiene orden ${order - 2}.`,
    });
    const M = tensorMatrix(c);
    steps.push({
      kind: "numbers",
      title: c.shape.length === 0 ? "Valor de C (un número)" : c.shape.length === 1 ? "C (un vector)" : "C (una matriz)",
      name: "C",
      expected: M,
      mistakes: outerMistakes(inst),
      hints: [
        "Escribe la suma: el índice repetido recorre sus valores y los demás quedan fijos.",
        ta.shape.length === 1 && tb.shape.length === 1 ? "Con dos vectores, contraer u ⊗ v es el producto escalar." : "Compara la suma con un producto de matrices (o de matriz por vector): ¿qué índice se suma?",
      ],
      okText: "Bien: ese es el resultado de la contracción.",
    });
  }
  const resultText = (() => {
    if (!inst.contract) return null;
    const c = outerResult(inst);
    return `C = ${c.shape.length === 0 ? num(c.data[0]!) : c.shape.length === 1 ? vecText(c.data) : matText(tensorMatrix(c))}.`;
  })();
  const solution = [
    `T = ${prodName} tiene orden ${ta.shape.length} + ${tb.shape.length} = ${order} y forma ${dimsText(t.shape)} (${t.data.length} componentes).`,
    ...(order === 2 && !inst.contract ? [`${prodName} = ${matText(tensorMatrix(t))} (fila i: ${an}ᵢ·${bn}).`] : []),
    ...inst.entries.map((e) => `T${subDigits(e.join(""))} = ${an}${subDigits(`${e[0]}${e[1]}`)}·${bn}${subDigits(e[2]!)} = ${num(tensorAt(ta, [e[0]! - 1, e[1]! - 1]))}·${num(tb.data[e[2]! - 1]!)} = ${num(tensorAt(t, e.map((x) => x - 1)))}.`),
    ...(inst.contract ? [`Contraer los índices ${inst.contract[0]} y ${inst.contract[1]} baja el orden a ${order - 2}.`, resultText!] : []),
  ];
  return {
    statement: { blocks, ask: inst.contract ? "Calcula el orden y la forma de T, y el resultado de la contracción." : inst.entries.length ? "Calcula el orden y la forma de T y las entradas que se piden." : "Calcula el orden y la forma de u ⊗ v y escríbelo entero." },
    steps,
    solution,
  };
}

// ================================================================ Coordenadas en otra base

export type CoordsInstance =
  | { kind: "directa"; b1: number[]; b2: number[]; v: number[]; covariant: boolean }
  | { kind: "escalada"; b1: number[]; b2: number[]; c: number[]; s: [number, number] };

const basisMatrix = (b1: readonly number[], b2: readonly number[]): Matrix => intMatrix([[b1[0]!, b2[0]!], [b1[1]!, b2[1]!]]);
const solve2 = (C: Matrix, v: readonly Frac[]): Frac[] | null => {
  const inv = matrixInverse(C);
  return inv ? inv.inverse.map((r) => r.reduce((acc, x, j) => add(acc, mul(x, v[j]!)), ZERO)) : null;
};
const combo2 = (c: readonly Frac[], b1: readonly number[], b2: readonly number[]): Frac[] => [0, 1].map((i) => add(mul(c[0]!, int(b1[i]!)), mul(c[1]!, int(b2[i]!))));

/** Coordenadas (contravariantes) de v en la base del enunciado y, en «escalada», v en la canónica. */
export function coordsAnswer(inst: CoordsInstance): { v: Frac[]; coords: Frac[]; cov?: Frac[] } {
  if (inst.kind === "directa") {
    const v = inst.v.map(int);
    const coords = solve2(basisMatrix(inst.b1, inst.b2), v)!;
    const cov = [inst.b1, inst.b2].map((b) => int(b[0]! * inst.v[0]! + b[1]! * inst.v[1]!));
    return { v, coords, ...(inst.covariant ? { cov } : {}) };
  }
  const v = combo2(inst.c.map(int), inst.b1, inst.b2);
  return { v, coords: inst.c.map((x, i) => frac(BigInt(x), BigInt(inst.s[i]!))) };
}

function makeCoords(rng: Rng, level: ExerciseLevel): CoordsInstance {
  const v = [rng.int(-6, 7), rng.int(-6, 7)];
  if (level === "básico") {
    if (rng.chance(0.5)) {
      const k1 = rng.pick([2, 3, 4, 5, -2]);
      const k2 = rng.pick([2, 3, 4, -3, 1]);
      return { kind: "directa", b1: [k1, 0], b2: [0, k2], v, covariant: false };
    }
    const k = rng.pick([1, 2]);
    return { kind: "directa", b1: [k, k], b2: rng.chance(0.5) ? [k, -k] : [-k, k], v, covariant: false };
  }
  if (level === "medio") {
    const C = rng.chance(0.6) ? unimodular(rng, 2, rng.int(2, 3)) : [[rng.int(-3, 3), rng.int(-3, 3)], [rng.int(-3, 3), rng.int(-3, 3)]];
    return { kind: "directa", b1: [C[0]![0]!, C[1]![0]!], b2: [C[0]![1]!, C[1]![1]!], v, covariant: rng.chance(0.4) };
  }
  const C = unimodular(rng, 2, rng.int(2, 3));
  return { kind: "escalada", b1: [C[0]![0]!, C[1]![0]!], b2: [C[0]![1]!, C[1]![1]!], c: [rng.int(-5, 6), rng.int(-5, 6)], s: [rng.pick([2, 3, 4, -2]), rng.pick([2, 3, 5, -1, 1])] };
}

export const LINALG_COORDS: ExerciseType<CoordsInstance> = {
  id: "algebra-coordenadas-base",
  topic: "algebra-lineal",
  title: "Coordenadas en otra base",
  description: "Halla las coordenadas de un vector de ℝ² en otra base (también en una base escalada: si la base se estira, las coordenadas encogen) y, a veces, sus componentes covariantes v·bᵢ.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-coordenadas-base", seed),
      (r) => makeCoords(r, level),
      (inst) => {
        const det = inst.b1[0]! * inst.b2[1]! - inst.b1[1]! * inst.b2[0]!;
        if (det === 0 || Math.abs(det) > 6) return false;
        if (Math.max(...inst.b1.map(Math.abs), ...inst.b2.map(Math.abs)) > 5) return false;
        const a = coordsAnswer(inst);
        if (a.coords.some((x) => x.d > 6n || (x.n < 0n ? -x.n : x.n) > 40n) || a.v.some((x) => x.d !== 1n || Math.abs(Number(x.n)) > 20)) return false;
        if (a.v.every((x) => x.n === 0n)) return false;
        // Que no sean ya sus propios números (salvo la base escalada de la canónica, que es la idea).
        if (inst.kind === "directa" && equals(a.coords[0]!, a.v[0]!) && equals(a.coords[1]!, a.v[1]!)) return false;
        if (inst.kind === "escalada") return inst.c.every((x) => x !== 0) && !(inst.s[0] === 1 && inst.s[1] === 1) && det !== 0;
        return true;
      },
    );
  },
};

const fracCombo = (c: readonly Frac[], names: readonly string[]) =>
  c.map((x, i) => `${x.n < 0n || x.d !== 1n ? `(${fracText(x)})` : fracText(x)}·${names[i]}`).join(" + ");

export function coordsGuided(inst: CoordsInstance): GuidedExercise {
  const ans = coordsAnswer(inst);
  const steps: GuidedStep[] = [];
  const blocks: GuidedExercise["statement"]["blocks"] = [];
  if (inst.kind === "directa") {
    const C = basisMatrix(inst.b1, inst.b2);
    blocks.push({ kind: "tex", tex: `b_1 = (${inst.b1.join(",\\ ")}),\\quad b_2 = (${inst.b2.join(",\\ ")}),\\quad v = (${inst.v.join(",\\ ")})`, label: `b₁ = ${vecText(inst.b1)}, b₂ = ${vecText(inst.b2)}, v = ${vecText(inst.v)}` });
    blocks.push({ kind: "p", text: "B = {b₁, b₂} es una base de ℝ². Busca c₁ y c₂ con c₁·b₁ + c₂·b₂ = v." });
    const v = ans.v;
    const transposed = solve2(matrixTranspose(C), v);
    const swapped = [ans.coords[1]!, ans.coords[0]!];
    const naive = inst.b1[1] === 0 && inst.b2[0] === 0 ? null : [0, 1].map((i) => (i === 0 ? (inst.b1[0] !== 0 ? frac(BigInt(inst.v[0]!), BigInt(inst.b1[0]!)) : null) : inst.b2[1] !== 0 ? frac(BigInt(inst.v[1]!), BigInt(inst.b2[1]!)) : null));
    const times = inst.b1[1] === 0 && inst.b2[0] === 0 ? [int(inst.v[0]! * inst.b1[0]!), int(inst.v[1]! * inst.b2[1]!)] : null;
    if (inst.b1[1] !== 0 || inst.b2[0] !== 0) {
      steps.push({
        kind: "numbers",
        title: "Matriz de la base C (b₁ y b₂ en columnas)",
        name: "C",
        expected: C,
        mistakes: cleanMistakes(C, [{ value: matrixTranspose(C), text: "Los vectores de la base van en columnas, no en filas: así C·(c₁, c₂) = c₁·b₁ + c₂·b₂." }], sameMatrix),
        hints: ["La primera columna es b₁ y la segunda, b₂."],
        okText: "Bien: con esa C, el sistema es C·c = v.",
      });
    }
    steps.push({
      kind: "numbers",
      title: "Coordenadas (c₁, c₂) de v en la base B",
      name: "(c₁, c₂)",
      expected: [ans.coords],
      mistakes: cleanMistakes([ans.coords], [
        transposed ? { value: [transposed], text: "Has resuelto con los vectores de la base en filas: b₁ y b₂ son las columnas del sistema." } : null,
        { value: [swapped], text: "Están al revés: c₁ acompaña a b₁ y c₂ a b₂." },
        naive && naive.every((x) => x !== null) ? { value: [naive as Frac[]], text: "No basta con dividir componente a componente: b₁ y b₂ mezclan las dos componentes. Plantea el sistema." } : null,
        times ? { value: [times], text: "Si la base se estira, las coordenadas encogen: hay que dividir entre la longitud de cada vector, no multiplicar." } : null,
      ], sameMatrix),
      diagnose: (t) => {
        const back = combo2(t[0]!, inst.b1, inst.b2);
        return `Con tus números, c₁·b₁ + c₂·b₂ = ${fracVecText(back)}, que no es v.`;
      },
      hints: ["Escribe c₁·b₁ + c₂·b₂ = v componente a componente: son dos ecuaciones con dos incógnitas.", "Resuélvelo por reducción o con c = C⁻¹·v, y comprueba que c₁·b₁ + c₂·b₂ da v."],
      okText: "Bien: con esas coordenadas, c₁·b₁ + c₂·b₂ = v.",
    });
    if (ans.cov) {
      const cov = ans.cov;
      steps.push({
        kind: "numbers",
        title: "Componentes covariantes (v·b₁, v·b₂)",
        name: "(v·b₁, v·b₂)",
        expected: [cov],
        mistakes: cleanMistakes([cov], [{ value: [ans.coords], text: "Esas son las coordenadas (contravariantes); las covariantes son productos escalares con cada vector de la base." }], sameMatrix),
        hints: ["Las componentes covariantes se calculan proyectando: vᵢ = v·bᵢ (multiplica por parejas y suma)."],
        okText: "Bien: esas son las componentes covariantes.",
      });
    }
    return {
      statement: { blocks, ask: ans.cov ? "Calcula las coordenadas de v en B y sus componentes covariantes." : "Calcula las coordenadas de v en la base B." },
      steps,
      solution: [
        `Sistema: c₁·${vecText(inst.b1)} + c₂·${vecText(inst.b2)} = ${vecText(inst.v)}.`,
        `Solución: (c₁, c₂) = ${fracVecText(ans.coords)}.`,
        `Comprobación: ${fracCombo(ans.coords, ["b₁", "b₂"])} = ${fracVecText(combo2(ans.coords, inst.b1, inst.b2))} = v.`,
        ...(ans.cov ? [`Covariantes: v·b₁ = ${fracText(ans.cov[0]!)}, v·b₂ = ${fracText(ans.cov[1]!)}.`] : []),
      ],
    };
  }
  const [s1, s2] = inst.s;
  const scaledB1 = inst.b1.map((x) => x * s1);
  const scaledB2 = inst.b2.map((x) => x * s2);
  blocks.push({ kind: "tex", tex: `b_1 = (${inst.b1.join(",\\ ")}),\\quad b_2 = (${inst.b2.join(",\\ ")})`, label: `b₁ = ${vecText(inst.b1)}, b₂ = ${vecText(inst.b2)}` });
  blocks.push({ kind: "p", text: `En la base B = {b₁, b₂}, v tiene coordenadas ${vecText(inst.c)}. La base B′ = {b′₁, b′₂} es la misma, escalada: b′₁ = ${num(s1)}·b₁ = ${vecText(scaledB1)} y b′₂ = ${num(s2)}·b₂ = ${vecText(scaledB2)}.` });
  const times = inst.c.map((x, i) => int(x * inst.s[i]!));
  steps.push({
    kind: "numbers",
    title: "v en la base canónica",
    name: "v",
    expected: [ans.v],
    mistakes: cleanMistakes([ans.v], [{ value: [inst.c.map(int)], text: "Esas son las coordenadas en B: v es c₁·b₁ + c₂·b₂." }], sameMatrix),
    hints: ["v = c₁·b₁ + c₂·b₂, con las coordenadas que da el enunciado."],
    okText: "Bien: ese es v.",
  });
  steps.push({
    kind: "numbers",
    title: "Coordenadas de v en la base escalada B′",
    name: "(c′₁, c′₂)",
    expected: [ans.coords],
    mistakes: cleanMistakes([ans.coords], [
      { value: [times], text: "Si un vector de la base se hace s veces más largo, hacen falta s veces menos pasos: las coordenadas se dividen, no se multiplican." },
      { value: [inst.c.map(int)], text: "La base ha cambiado de longitud: las coordenadas también cambian." },
    ], sameMatrix),
    diagnose: (t) => `Con tus números, c′₁·b′₁ + c′₂·b′₂ = ${fracVecText(combo2(t[0]!, scaledB1, scaledB2))}, que no es v.`,
    hints: ["Las coordenadas son contravariantes: van al revés que la base.", "c′₁·b′₁ = c′₁·s₁·b₁ tiene que valer c₁·b₁."],
    okText: "Bien: si la base se estira, las coordenadas encogen.",
  });
  return {
    statement: { blocks, ask: "Calcula v en la base canónica y sus coordenadas en la base escalada B′." },
    steps,
    solution: [
      `v = ${num(inst.c[0]!)}·${vecText(inst.b1)} + ${num(inst.c[1]!)}·${vecText(inst.b2)} = ${fracVecText(ans.v)}.`,
      (() => {
        const raw = `(${num(inst.c[0]!)}/${num(s1)}, ${num(inst.c[1]!)}/${num(s2)})`;
        const nice = fracVecText(ans.coords);
        return `b′ᵢ = sᵢ·bᵢ, así que c′ᵢ = cᵢ/sᵢ: (c′₁, c′₂) = ${raw === nice ? nice : `${raw} = ${nice}`}.`;
      })(),
      `Comprobación: ${fracCombo(ans.coords, ["b′₁", "b′₂"])} = ${fracVecText(combo2(ans.coords, scaledB1, scaledB2))} = v.`,
    ],
  };
}

// ================================================================ Operador en una base nueva: D = C⁻¹·A·C

export type ChangeBasisInstance = { A: Ints; C: Ints };

export function changeBasisOf(inst: ChangeBasisInstance) {
  const A = intMatrix(inst.A);
  const C = intMatrix(inst.C);
  const Cinv = matrixInverse(C)!.inverse;
  const D = matrixProduct(matrixProduct(Cinv, A), C);
  return { A, C, Cinv, D, wrong: matrixProduct(matrixProduct(C, A), Cinv) };
}

function makeChangeBasis(rng: Rng, level: ExerciseLevel): ChangeBasisInstance | null {
  const n = level === "avanzado" ? 3 : 2;
  if (level === "medio" && rng.chance(0.5)) {
    // A = C·Λ·C⁻¹ con C de determinante ±1: en la base de autovectores, D es diagonal.
    const C = unimodular(rng, 2, rng.int(2, 3));
    const l = rng.shuffle([-3, -2, -1, 1, 2, 3, 4]).slice(0, 2);
    const Ci = matrixInverse(intMatrix(C))!.inverse;
    const A = matrixProduct(matrixProduct(intMatrix(C), intMatrix([[l[0]!, 0], [0, l[1]!]])), Ci);
    return A.every((r) => r.every((x) => x.d === 1n)) ? { A: A.map((r) => r.map((x) => Number(x.n))), C } : null;
  }
  const C = level === "medio" ? [[rng.int(-2, 3), rng.int(-2, 2)], [rng.int(-2, 2), rng.int(-2, 3)]] : unimodular(rng, n, rng.int(2, n === 3 ? 3 : 3));
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => rng.int(-3, 3)));
  return { A, C };
}

export const LINALG_CHANGE_BASIS: ExerciseType<ChangeBasisInstance> = {
  id: "algebra-cambio-base",
  topic: "algebra-lineal",
  title: "Operador en una base nueva",
  description: "Con la matriz A del operador en la base canónica y la base nueva en las columnas de C, calcula C⁻¹ y D = C⁻¹·A·C, y compruébalo con la traza (tr D = tr A).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("algebra-cambio-base", seed),
      (r) => makeChangeBasis(r, level),
      (inst) => {
        const C = intMatrix(inst.C);
        const det = matrixDeterminant(C);
        const dets = level === "medio" ? [1n, -1n, 2n, -2n] : [1n, -1n];
        if (det.d !== 1n || !dets.includes(det.n)) return false;
        if (Math.max(...inst.C.flat().map(Math.abs)) > 3 || Math.max(...inst.A.flat().map(Math.abs)) > 6) return false;
        if (inst.C.flat().filter((x) => x === 0).length > inst.C.length) return false;
        const offA = inst.A.flatMap((r, i) => r.filter((_, j) => j !== i));
        if (offA.every((x) => x === 0)) return false;
        const { D, wrong, A } = changeBasisOf(inst);
        if (sameMatrix(D, A) || sameMatrix(D, wrong)) return false;
        return D.every((r) => r.every((x) => x.d <= 2n && (x.n < 0n ? -x.n : x.n) <= 30n));
      },
    );
  },
};

export function changeBasisGuided(inst: ChangeBasisInstance): GuidedExercise {
  const { A, C, Cinv, D, wrong } = changeBasisOf(inst);
  const det = matrixDeterminant(C);
  const n = inst.A.length;
  const trA = trace(A);
  const adj = Cinv.map((r) => r.map((x) => mul(x, det)));
  const steps: GuidedStep[] = [
    {
      kind: "numbers",
      title: "Inversa de la matriz de cambio, C⁻¹",
      name: "C⁻¹",
      expected: Cinv,
      mistakes: cleanMistakes(Cinv, [
        { value: matrixTranspose(C), text: "Trasponer no es invertir (salvo en matrices ortogonales): comprueba que C·C⁻¹ = I." },
        !equals(det, int(1)) && !equals(det, int(-1)) ? { value: adj, text: `Falta dividir entre el determinante de C, que es ${fracText(det)}.` } : null,
        n === 2 ? { value: matrixTranspose(adj).map((r) => r.map((x) => mul(x, frac(1n, det.n)))), text: "Esa es la inversa de Cᵀ: en la inversa 2 × 2 se intercambian los dos de la diagonal y a los otros dos solo se les cambia el signo, sin moverlos de sitio." } : null,
      ], sameMatrix),
      diagnose: (t) => (sameMatrix(matrixProduct(C, t), intMatrix(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))))) ? null : "Tu matriz no cumple C·C⁻¹ = I."),
      hints: n === 2 ? ["En 2 × 2: intercambia los de la diagonal, cambia el signo de los otros dos y divide entre det C."] : ["Gauss-Jordan sobre (C | I), o la adjunta traspuesta dividida entre det C.", "Comprueba que C·C⁻¹ = I."],
      okText: "Bien: esa es C⁻¹.",
    },
    {
      kind: "numbers",
      title: "Matriz del operador en la base nueva, D = C⁻¹·A·C",
      name: "D",
      expected: D,
      mistakes: cleanMistakes(D, [
        { value: wrong, text: "Ese es C·A·C⁻¹: el orden es al revés. Lee D = C⁻¹·A·C de derecha a izquierda: C traduce de la base nueva a la vieja, A actúa y C⁻¹ vuelve." },
        { value: matrixProduct(A, C), text: "Falta multiplicar por C⁻¹ a la izquierda: A·C da las imágenes de la base nueva en coordenadas viejas." },
        { value: matrixProduct(Cinv, A), text: "Falta multiplicar por C a la derecha." },
        { value: matrixProduct(matrixProduct(matrixTranspose(C), A), C), text: "Es C⁻¹, no Cᵀ, salvo que C sea ortogonal." },
      ], sameMatrix),
      diagnose: (t) => (equals(trace(t), trA) ? "La traza coincide, pero alguna entrada no: repasa los productos fila por columna." : `La traza de tu D es ${fracText(trace(t))} y la de A es ${fracText(trA)}: tienen que coincidir, porque es el mismo operador en otra base.`),
      hints: ["Multiplica en dos pasos: primero A·C (las imágenes de los vectores nuevos) y después C⁻¹·(A·C).", "Antes de comprobar, mira la traza: tr D tiene que ser igual a tr A."],
      okText: "Bien: esa es D.",
    },
    {
      kind: "numbers",
      title: "Comprobación: traza de D",
      name: "tr D",
      expected: one(trace(D)),
      mistakes: cleanMistakes(one(trace(D)), [{ value: one(matrixDeterminant(D)), text: "Ese es el determinante; la traza es la suma de la diagonal." }], sameMatrix),
      hints: ["La traza es la suma de la diagonal; no cambia al cambiar de base."],
      okText: `Bien: tr D = tr A = ${fracText(trA)}.`,
    },
  ];
  const Cl = matText(C);
  return {
    statement: {
      blocks: [
        { kind: "p", text: "A es la matriz de un operador lineal f en la base canónica. Las columnas de C son los vectores de una base nueva B′." },
        { kind: "tex", tex: `A = ${matrixTex(A)},\\quad C = ${matrixTex(C)}`, label: `A = ${matText(A)}, C = ${Cl}` },
      ],
      ask: "Calcula C⁻¹ y la matriz D de f en la base B′, D = C⁻¹·A·C, y comprueba la traza.",
    },
    steps,
    solution: [
      `det C = ${fracText(det)}, C⁻¹ = ${matText(Cinv)}.`,
      `A·C = ${matText(matrixProduct(A, C))}.`,
      `D = C⁻¹·(A·C) = ${matText(D)}.`,
      `Comprobación: tr D = ${fracText(trace(D))} = tr A.`,
    ],
  };
}

export const TENSOR_EXERCISES = [LINALG_EINSTEIN, LINALG_OUTER, LINALG_COORDS, LINALG_CHANGE_BASIS] as const;
