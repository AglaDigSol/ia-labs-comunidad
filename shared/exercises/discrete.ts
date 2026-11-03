// Ejercicios de combinatoria y complejidad: problemas de recuento con número (también por el
// complementario, «al menos uno»), elegir el modelo (Pₙ, PR, V, VR, C o CR), funciones por cardinal
// con varias afirmaciones verdaderas (como en el examen), el orden O grande de un fragmento de
// pseudocódigo o de un coste (opciones A–E con «Ninguna de las otras») y verdadero o falso sobre P y
// NP. Los enunciados salen de plantillas con números al azar; las respuestas las calcula el motor de
// shared/discrete al corregir, nunca están escritas en la instancia.
import { algorithmGrowth, type Algorithm, type AlgoStmt } from "../discrete/algorithms.ts";
import { costOf, distractors, growthOf, type BigOOption, type Growth } from "../discrete/bigo.ts";
import { acceptedFormulas, countModel, FORMULA_IDS, modelProblem, type CountingModel, type FormulaId } from "../discrete/count.ts";
import { countFunctions, FN_MODES, statementTrue, type FnProp, type FnSetting, type FnStatement } from "../discrete/functions.ts";
import { pnpPool } from "../discrete/pnp.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

/** Un problema de recuento: el enunciado y los modelos cuya suma (con signo) es la respuesta. */
export type CombProblemInstance = { text: string; terms: Array<{ sign: 1 | -1; model: CountingModel }> };
/** Un problema con un solo modelo y cuatro fórmulas para elegir (una sola encaja). */
export type CombModelInstance = { text: string; model: CountingModel; options: FormulaId[] };
/** `multi`: marcar todas las verdaderas; si no, hay exactamente una verdadera (a–d). */
export type CombFunctionsInstance = FnSetting & { multi: boolean; statements: FnStatement[] };
export type CombComplexityInstance = ({ kind: "algo"; algo: Algorithm } | { kind: "cost"; cost: string }) & { options: BigOOption[] };
export type CombPnpInstance = { ids: string[] };

/** La respuesta exacta de un problema. */
export const problemAnswer = (p: CombProblemInstance): bigint => p.terms.reduce((acc, t) => acc + BigInt(t.sign) * countModel(t.model), 0n);

/** El orden correcto de un ejercicio de complejidad. */
export const complexityGrowth = (x: { kind: "algo"; algo: Algorithm } | { kind: "cost"; cost: string }): Growth =>
  x.kind === "algo" ? algorithmGrowth(x.algo) : growthOf(costOf(x.cost, ["n", "m"]));

/**
 * Cuatro opciones tipo examen, a) a d), con una sola buena. Si `trapCoef` se da, una de las falsas es
 * el orden correcto con una constante dentro (O(10n⁸)), la trampa típica, y otra el orden equivocado
 * con la misma constante. Con probabilidad `pNone` la d) es «Ninguna de las otras» (y, la mitad de
 * esas veces, es la buena porque el orden correcto no está).
 */
export function bigOOptions(rng: Rng, correct: Growth, pNone: number, trapCoef?: number): BigOOption[] {
  const ds = rng.shuffle(distractors(correct));
  const wrong: BigOOption[] = trapCoef
    ? [{ growth: correct, coef: trapCoef }, { growth: ds[0]!, coef: trapCoef }, { growth: ds[0]! }, { growth: ds[1]! }]
    : ds.slice(0, 4).map((growth) => ({ growth }));
  if (rng.chance(pNone)) {
    const noneRight = rng.chance(0.5);
    const three = noneRight ? rng.shuffle(wrong).slice(0, 3) : rng.shuffle([{ growth: correct }, ...rng.shuffle(wrong).slice(0, 2)]);
    return [...three, { none: true }];
  }
  return rng.shuffle([{ growth: correct }, ...(trapCoef ? [wrong[0]!, ...rng.shuffle(wrong.slice(1)).slice(0, 2)] : wrong.slice(0, 3))]);
}

/** Letra de una opción: a), b), c), d). */
export const optionLetter = (i: number) => `${"abcdefgh"[i]})`;

// ---------------------------------------------------------------- Plantillas de recuento

type Single = { text: string; model: CountingModel };
type Template = { levels: readonly ExerciseLevel[]; make: (r: Rng, level: ExerciseLevel) => Single | CombProblemInstance | null };

const pr = (groups: number[]): CountingModel => {
  const n = groups.reduce((a, b) => a + b, 0);
  return { n, k: n, order: true, repetition: true, groups };
};
const big = (l: ExerciseLevel) => l === "avanzado";

/** Palabras con todas sus letras distintas y con letras repetidas (para reordenar). */
const DISTINCT_WORDS = ["NUBE", "CIELO", "CLAVE", "MUSICA", "PARQUE", "ESCALON", "TRAMPOLIN"];
const REPEATED_WORDS = ["PATATA", "TOMATE", "CARRERA", "AMAPOLA", "SEMESTRE", "COCOTERO", "ALBAHACA", "CASCADA"];
const letterGroups = (w: string) => {
  const counts = new Map<string, number>();
  for (const ch of w) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
};

const CARGOS: Record<number, string> = {
  2: "presidente y secretario",
  3: "presidente, secretario y tesorero",
  4: "presidente, vicepresidente, secretario y tesorero",
};

const TEMPLATES: Template[] = [
  // Pₙ
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const n = r.int(4, 9);
      return { text: `¿De cuántas formas distintas se pueden colocar en fila ${n} libros distintos en una estantería?`, model: { n, k: n, order: true, repetition: false } };
    },
  },
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const n = r.int(4, 8);
      return { text: `En un seminario intervienen ${n} ponentes, uno detrás de otro. ¿Cuántos órdenes de intervención distintos hay?`, model: { n, k: n, order: true, repetition: false } };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r, l) => {
      const w = r.pick(big(l) ? DISTINCT_WORDS.slice(4) : DISTINCT_WORDS.slice(0, 5));
      return { text: `¿Cuántas palabras distintas, con o sin sentido, se pueden formar reordenando todas las letras de ${w}?`, model: { n: w.length, k: w.length, order: true, repetition: false } };
    },
  },
  // V
  {
    levels: ["básico", "medio"],
    make: (r, l) => {
      const n = l === "básico" ? r.int(5, 10) : r.int(10, 25);
      return { text: `En una carrera participan ${n} corredores. ¿De cuántas formas distintas puede quedar el podio (oro, plata y bronce), si no hay empates?`, model: { n, k: 3, order: true, repetition: false } };
    },
  },
  {
    levels: ["básico", "medio", "avanzado"],
    make: (r, l) => {
      const k = l === "básico" ? r.int(2, 3) : r.int(3, 4);
      const n = l === "básico" ? r.int(6, 10) : r.int(9, 20);
      return { text: `Una asociación de ${n} socios elige ${CARGOS[k]}. Los cargos son distintos y nadie puede ocupar dos. ¿De cuántas formas puede quedar la junta?`, model: { n, k, order: true, repetition: false } };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const k = r.pick([3, 5, 6]);
      return { text: `Una aplicación pide un código de ${k} cifras (del 0 al 9) en el que no se repite ninguna cifra. ¿Cuántos códigos distintos hay?`, model: { n: 10, k, order: true, repetition: false } };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const n = r.int(7, 14);
      const k = r.int(3, 5);
      return { text: `Un clúster tiene ${n} servidores. Se lanzan ${k} trabajos distintos, cada uno en un servidor diferente. ¿De cuántas formas se pueden repartir?`, model: { n, k, order: true, repetition: false } };
    },
  },
  // VR
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const k = r.pick([3, 5, 6]);
      return { text: `Un candado tiene ${k} ruedas, cada una con las cifras del 0 al 9. ¿Cuántas combinaciones distintas puede tener?`, model: { n: 10, k, order: true, repetition: true } };
    },
  },
  {
    levels: ["básico", "medio", "avanzado"],
    make: (r, l) => {
      const k = l === "básico" ? r.int(5, 10) : r.int(11, 24);
      return { text: `¿Cuántas cadenas distintas de ${k} bits hay?`, model: { n: 2, k, order: true, repetition: true } };
    },
  },
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const k = r.int(2, 6);
      return { text: `Se lanza un dado de seis caras ${k} veces y se anota la secuencia de resultados. ¿Cuántas secuencias distintas puede haber?`, model: { n: 6, k, order: true, repetition: true } };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const digits = r.chance(0.5);
      const k = r.int(4, 6);
      const n = digits ? 36 : 26;
      return {
        text: `¿Cuántas contraseñas de ${k} caracteres se pueden formar con las 26 letras minúsculas del alfabeto inglés${digits ? " y las 10 cifras" : ""}, si se pueden repetir?`,
        model: { n, k, order: true, repetition: true },
      };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const a = r.int(2, 5);
      const b = r.int(2, 6);
      return { text: `Sea |A| = ${a} y |B| = ${b}. ¿Cuántas funciones distintas f: A → B hay?`, model: { n: b, k: a, order: true, repetition: true } };
    },
  },
  // C
  {
    levels: ["básico", "medio", "avanzado"],
    make: (r, l) => {
      const n = l === "básico" ? r.int(6, 12) : r.int(12, 30);
      const k = l === "básico" ? r.int(2, 4) : r.int(3, 6);
      return { text: `De un grupo de ${n} estudiantes se elige una comisión de ${k} personas, sin cargos. ¿Cuántas comisiones distintas se pueden formar?`, model: { n, k, order: false, repetition: false } };
    },
  },
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const n = r.int(5, 20);
      return { text: `En una reunión hay ${n} personas y cada una saluda una vez a cada una de las demás con un apretón de manos. ¿Cuántos apretones de manos hay?`, model: { n, k: 2, order: false, repetition: false } };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const n = r.int(8, 20);
      const k = r.int(2, 5);
      return { text: `Hay ${n} variables candidatas para un modelo y se quiere probar cada subconjunto de ${k} variables. ¿Cuántos subconjuntos distintos hay que probar?`, model: { n, k, order: false, repetition: false } };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const k = r.int(3, 6);
      return { text: `¿Cuántas manos distintas de ${k} cartas se pueden repartir con una baraja española de 40 cartas?`, model: { n: 40, k, order: false, repetition: false } };
    },
  },
  // CR
  {
    levels: ["medio", "avanzado"],
    make: (r, l) => {
      const n = l === "medio" ? r.int(3, 6) : r.int(5, 10);
      const k = l === "medio" ? r.int(2, 3) : r.int(3, 5);
      return { text: `Una heladería ofrece ${n} sabores. ¿Cuántas tarrinas distintas de ${k} bolas se pueden pedir, si se puede repetir sabor y el orden de las bolas no importa?`, model: { n, k, order: false, repetition: true } };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const n = r.int(3, 5);
      const k = r.int(4, 10);
      return { text: `Se reparten ${k} caramelos iguales entre ${n} niños; puede haber niños que no reciban ninguno. ¿De cuántas formas se pueden repartir?`, model: { n, k, order: false, repetition: true } };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const n = r.int(3, 6);
      const k = r.int(5, 12);
      const vars = Array.from({ length: n }, (_, i) => `x${"₁₂₃₄₅₆"[i]}`).join(" + ");
      return { text: `¿Cuántas soluciones en números naturales (incluido el 0) tiene la ecuación ${vars} = ${k}?`, model: { n, k, order: false, repetition: true } };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const n = r.int(3, 7);
      const k = r.int(3, 8);
      return {
        text: `Hay pelotas de ${n} colores, muchas de cada color. Se meten ${k} pelotas en una caja, sin importar el orden y admitiendo que se repita el color. ¿Cuántos contenidos distintos puede tener la caja?`,
        model: { n, k, order: false, repetition: true },
      };
    },
  },
  // Examen con preguntas de un banco: con orden y sin orden, dicho explícitamente.
  {
    levels: ["básico", "medio", "avanzado"],
    make: (r, l) => {
      const n = l === "básico" ? r.int(6, 12) : r.int(12, 30);
      const k = r.int(3, l === "básico" ? 4 : 6);
      const ordered = r.chance(0.5);
      return ordered
        ? {
            text: `Un examen tiene ${k} preguntas, distintas, elegidas de un banco de ${n}. El orden importa: dos exámenes con las mismas preguntas en otro orden son modelos distintos. ¿Cuántos modelos de examen hay?`,
            model: { n, k, order: true, repetition: false },
          }
        : {
            text: `Un examen tiene ${k} preguntas, distintas, elegidas de un banco de ${n}, sin importar el orden: dos exámenes con las mismas preguntas son el mismo modelo. ¿Cuántos modelos de examen hay?`,
            model: { n, k, order: false, repetition: false },
          };
    },
  },
  // PR
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const n = r.int(6, 10);
      const a = r.int(2, n - 2);
      return { text: `Una baliza emite mensajes de ${n} destellos, cada uno largo o corto. ¿Cuántos mensajes distintos tienen exactamente ${a} destellos largos?`, model: pr([a, n - a]) };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r, l) => {
      const n = r.pick(l === "medio" ? [6, 8, 10] : [12, 14, 18, 20]);
      return { text: `¿Cuántas cadenas de ${n} bits tienen tantos ceros como unos?`, model: pr([n / 2, n / 2]) };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r, l) => {
      const w = r.pick(l === "medio" ? REPEATED_WORDS.slice(0, 4) : REPEATED_WORDS.slice(3));
      return { text: `¿Cuántas palabras distintas, con o sin sentido, se pueden formar reordenando todas las letras de ${w}?`, model: pr(letterGroups(w)) };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const n = r.int(8, 14);
      const a = r.int(2, n - 4);
      const b = r.int(1, n - a - 1);
      const c = n - a - b;
      if (n === 12 && a === 6 && b === 4) return null;
      return {
        text: `Cada una de las ${n} neuronas de una capa da como salida 0, 0,5 o 1. ¿Cuántos vectores de salida distintos tienen ${a} valores 0, ${b} valores 0,5 y ${c} valores 1?`,
        model: pr([a, b, c]),
      };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const a = r.int(2, 4);
      const b = r.int(1, 3);
      const c = r.int(1, 3);
      return { text: `Se cuelgan en fila ${a} banderas rojas, ${b} azules y ${c} verdes; las de un mismo color son iguales. ¿Cuántas filas distintas se pueden formar?`, model: pr([a, b, c]) };
    },
  },
  // Por el complementario (solo con número)
  {
    levels: ["avanzado"],
    make: (r) => {
      const k = r.pick([3, 5, 6]);
      return {
        text: `¿Cuántos códigos de ${k} cifras (del 0 al 9) tienen al menos una cifra repetida?`,
        terms: [
          { sign: 1, model: { n: 10, k, order: true, repetition: true } },
          { sign: -1, model: { n: 10, k, order: true, repetition: false } },
        ],
      };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const w = r.int(3, 7);
      const h = r.int(4, 8);
      const k = r.int(3, Math.min(4, h));
      return {
        text: `En un grupo hay ${w} mujeres y ${h} hombres. ¿Cuántas comisiones de ${k} personas, sin cargos, tienen al menos una mujer?`,
        terms: [
          { sign: 1, model: { n: w + h, k, order: false, repetition: false } },
          { sign: -1, model: { n: h, k, order: false, repetition: false } },
        ],
      };
    },
  },
];

const isSingle = (x: Single | CombProblemInstance): x is Single => "model" in x;

const validTerms = (terms: CombProblemInstance["terms"]) => terms.every((t) => modelProblem(t.model) === null);

export const COMB_PROBLEM: ExerciseType<CombProblemInstance> = {
  id: "combinatoria-problema",
  topic: "combinatoria",
  title: "Problema de combinatoria",
  description: "Lee el enunciado, decide qué fórmula aplica (permutaciones, variaciones o combinaciones, con o sin repetición) y escribe el número exacto, como en el examen: sin separador de miles.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const pool = TEMPLATES.filter((t) => t.levels.includes(level));
    return generateUntil(
      rngFor("combinatoria-problema", seed),
      (r) => {
        const x = r.pick(pool).make(r, level);
        if (!x) return null;
        return isSingle(x) ? { text: x.text, terms: [{ sign: 1 as const, model: x.model }] } : x;
      },
      (p) => validTerms(p.terms) && problemAnswer(p) > 1n && problemAnswer(p) < 10n ** 15n,
    );
  },
};

export const COMB_MODEL: ExerciseType<CombModelInstance> = {
  id: "combinatoria-modelo",
  topic: "combinatoria",
  title: "¿Qué modelo es?",
  description: "Elige la fórmula que cuenta lo que pide el enunciado: Pₙ, PR, V, VR, C o CR. No hace falta calcular: se trata de reconocer si importa el orden y si se repite.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const pool = TEMPLATES.filter((t) => t.levels.includes(level));
    return generateUntil(
      rngFor("combinatoria-modelo", seed),
      (r) => {
        const x = r.pick(pool).make(r, level);
        if (!x || !isSingle(x) || modelProblem(x.model) !== null) return null;
        const accepted = acceptedFormulas(x.model);
        const others = r.shuffle(FORMULA_IDS.filter((f) => !accepted.includes(f))).slice(0, 3);
        return { ...x, options: r.shuffle([accepted[0]!, ...others]) };
      },
      () => true,
    );
  },
};

// ---------------------------------------------------------------- Funciones por cardinal

const PROPS: FnProp[] = ["inyectiva", "sobreyectiva", "biyectiva", "inversa"];

function countStatement(r: Rng, s: FnSetting): FnStatement {
  const what = r.pick(["todas", "inyectivas", ...(s.a === s.b ? (["biyectivas"] as const) : [])] as const);
  const real = Number(countFunctions(s.a, s.b, what));
  // La cifra correcta o un error típico: aᵇ en vez de bᵃ, o combinaciones en vez de variaciones.
  const wrong = what === "todas" ? s.a ** s.b : what === "inyectivas" ? Number(countFunctions(s.b, s.a, "todas")) : s.a ** s.a;
  return { k: "count", what, value: r.chance(0.5) ? real : wrong };
}

/** Afirmaciones con modalidad; sin dos que digan lo mismo y su contrario. */
function modalPool(level: ExerciseLevel): FnStatement[] {
  const modes = level === "básico" ? (["puede", "no-puede"] as const) : FN_MODES;
  return PROPS.flatMap((prop) => modes.map((mode) => ({ k: "modal" as const, mode, prop })));
}
const opposite = (x: FnStatement, y: FnStatement) =>
  x.k === "modal" && y.k === "modal" && x.prop === y.prop && ((x.mode === "puede") === (y.mode === "no-puede")) && x.mode !== y.mode && [x.mode, y.mode].every((m) => m === "puede" || m === "no-puede");
const sameMeaning = (x: FnStatement, y: FnStatement) =>
  x.k === "modal" && y.k === "modal" && x.mode === y.mode && ((x.prop === "biyectiva" && y.prop === "inversa") || (x.prop === "inversa" && y.prop === "biyectiva"));

function pickStatements(r: Rng, pool: FnStatement[], count: number): FnStatement[] {
  const out: FnStatement[] = [];
  for (const st of r.shuffle(pool)) {
    if (out.length === count) break;
    if (out.some((o) => opposite(o, st) || sameMeaning(o, st) || JSON.stringify(o) === JSON.stringify(st))) continue;
    out.push(st);
  }
  return out;
}

function settingFor(r: Rng, level: ExerciseLevel): FnSetting {
  const max = level === "básico" ? 6 : 8;
  // Como en el examen: A ⊊ B dicho con palabras, o |A| = |B|.
  if (r.chance(0.25)) {
    const b = r.int(3, max);
    return { a: r.int(2, b - 1), b, subset: true };
  }
  if (r.chance(0.25)) {
    const a = r.int(2, max);
    return { a, b: a };
  }
  return { a: r.int(1, max), b: r.int(1, max) };
}

function functionsTemplate(r: Rng, level: ExerciseLevel): CombFunctionsInstance {
  // Avanzado: varias verdaderas (marcar todas). Básico y medio: una sola buena entre a) y d).
  const multi = level === "avanzado";
  if (level === "avanzado" && r.chance(0.5)) {
    const max = 8;
    const a = r.int(2, max);
    const b = r.int(2, max);
    const image = r.int(1, Math.min(a, b));
    const pool: FnStatement[] = [
      ...PROPS.map((prop) => ({ k: "fixed" as const, prop })),
      ...PROPS.map((prop) => ({ k: "onto-image" as const, prop })),
      { k: "modal", mode: r.pick(FN_MODES), prop: r.pick(PROPS) },
    ];
    return { a, b, image, multi, statements: r.shuffle(pool).slice(0, 5) };
  }
  const s = settingFor(r, level);
  const pool = modalPool(level);
  if (!multi) {
    // Una verdadera y tres falsas.
    const truths = pool.filter((x) => statementTrue(x, s));
    const lies = pool.filter((x) => !statementTrue(x, s));
    if (truths.length === 0 || lies.length < 3) return { ...s, multi, statements: [] };
    const good = level === "medio" && r.chance(0.3) ? countStatement(r, s) : r.pick(truths);
    if (!statementTrue(good, s)) return { ...s, multi, statements: [] };
    const bad = pickStatements(r, lies.filter((x) => !opposite(x, good) && !sameMeaning(x, good)), 3);
    return { ...s, multi, statements: r.shuffle([good, ...bad]) };
  }
  const statements = pickStatements(r, pool, 4);
  statements.push(countStatement(r, s));
  return { ...s, multi, statements };
}

export const COMB_FUNCTIONS: ExerciseType<CombFunctionsInstance> = {
  id: "combinatoria-funciones",
  topic: "combinatoria",
  title: "Funciones por cardinal",
  description: "Con |A| y |B| (o A ⊊ B, y a veces |f(A)|), elige la afirmación verdadera sobre f: A → B entre a) y d), o, en avanzado, marca todas las verdaderas: inyectiva, sobreyectiva, biyectiva, inversa, «puede» o «necesariamente», y cuántas funciones hay.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("combinatoria-funciones", seed),
      (r) => functionsTemplate(r, level),
      (x) => {
        if (x.statements.length < (x.multi ? 4 : 4)) return false;
        const v = x.statements.map((st) => statementTrue(st, x));
        return x.multi ? v.some(Boolean) && v.some((t) => !t) : v.filter(Boolean).length === 1;
      },
    );
  },
};

// ---------------------------------------------------------------- Complejidad

const OP = (text: string): AlgoStmt => ({ k: "op", text });

/** Un fragmento, o un coste escrito (con la constante de la trampa «O(10n⁸)», si la hay). */
type ComplexityDraft = Algorithm | { cost: string; trap?: number };

function algoTemplate(r: Rng, level: ExerciseLevel): ComplexityDraft {
  if (level === "básico") {
    switch (r.int(0, 5)) {
      case 0:
        return { body: [OP("s ← 0"), { k: "for", v: "i", to: "n", body: [OP("s ← s + i")] }] };
      case 1:
        return { body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "n", body: [OP("s ← s + i·j")] }] }] };
      case 2:
        return { sets: { A: "m", B: "n" }, body: [{ k: "forEach", v: "a", set: "A", body: [{ k: "forEach", v: "b", set: "B", body: [OP(r.pick(["s ← s + a·b", "si a = b: c ← c + 1"]))] }] }] };
      case 3:
        return {
          sets: { A: "m", B: "n" },
          body: [
            { k: "forEach", v: "a", set: "A", body: [OP("s ← s + a")] },
            { k: "forEach", v: "b", set: "B", body: [OP("t ← t + b")] },
          ],
        };
      case 4: {
        const c = r.int(2, 9);
        return { cost: `${c}n^${r.int(2, 4)} + ${r.int(2, 9)}n + ${r.int(1, 99)}`, trap: c };
      }
      default:
        return { cost: r.pick([`n^${r.int(3, 9)} + 2^n`, `${r.int(2, 9)}n log n + ${r.int(2, 9)}n`, `n^${r.int(2, 5)} + ${r.int(2, 9)}n^${r.int(6, 8)}`]) };
    }
  }
  if (level === "medio") {
    switch (r.int(0, 6)) {
      case 0:
        return { body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "i", body: [OP("c ← c + 1")] }] }] };
      case 1:
        return { body: [{ k: "halve", v: "i", from: "n", body: [OP("c ← c + 1")] }] };
      case 2:
        return { body: [{ k: "for", v: "i", to: "n", body: [{ k: "halve", v: "j", from: r.pick(["n", "i"] as const), body: [OP("c ← c + 1")] }] }] };
      case 3:
        return {
          body: [
            { k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "n", body: [OP("s ← s + 1")] }] },
            { k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "n", body: [{ k: "for", v: "l", to: "n", body: [OP("t ← t + 1")] }] }] },
          ],
        };
      case 4: {
        // (c·nᵃ + b·n)ᵉ: la trampa es O(c^e·n^{a·e}) o con la constante del doble producto.
        const c = r.int(2, 7);
        const e = r.int(2, 3);
        return { cost: `(${c}n^${r.int(3, 6)} + ${r.int(2, 9)}n)^${e}`, trap: e === 2 ? r.pick([2 * c, c * c]) : c ** e };
      }
      case 5:
        // Un bucle hasta n que llama a un algoritmo polinómico con entrada n.
        return { sub: `k^${r.int(2, 3)} + ${r.int(2, 5)}k + ${r.int(1, 9)}`, body: [{ k: "for", v: "i", to: "n", body: [{ k: "call", arg: "n" }] }] };
      default:
        return { cost: `(n^${r.int(2, 4)} + ${r.int(1, 9)})(n^${r.int(1, 3)} + log n)` };
    }
  }
  switch (r.int(0, 5)) {
    case 0:
      return { sub: `2^k + k^${r.int(4, 9)} + ${r.int(1, 9)}`, body: [{ k: "for", v: "i", to: "n", body: [{ k: "call", arg: "n" }] }] };
    case 1:
      return { sub: `${r.int(2, 5)}k^${r.int(2, 3)} + k + ${r.int(1, 9)}`, body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "m", body: [{ k: "call", arg: "m" }] }] }] };
    case 2:
      return { sub: "k log k", sets: { A: "m" }, body: [{ k: "forEach", v: "a", set: "A", body: [{ k: "call", arg: "n" }] }] };
    case 3:
      return { cost: `(${r.pick([2, 3])}^n + n^${r.int(3, 6)})^2` };
    case 4:
      return { cost: `m n^${r.int(2, 3)} + ${r.int(2, 9)}m^${r.int(2, 4)} + n` };
    default: {
      const c = r.int(2, 6);
      const e = r.int(2, 3);
      return { cost: `(${c}n^${r.int(4, 6)} - ${r.int(2, 9)}n^2 + ${r.int(1, 9)})^${e}`, trap: c ** e };
    }
  }
}

export const COMB_COMPLEXITY: ExerciseType<CombComplexityInstance> = {
  id: "combinatoria-complejidad",
  topic: "combinatoria",
  title: "Complejidad de un algoritmo",
  description: "Elige el orden O grande de un fragmento de pseudocódigo (bucles anidados, mitades, llamadas a otro algoritmo) o de un coste T(n), entre cuatro opciones como en el examen (ojo: dentro de la O no van constantes).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const r = rngFor("combinatoria-complejidad", seed);
    const pNone = level === "básico" ? 0.1 : level === "medio" ? 0.15 : 0.2;
    const t = algoTemplate(r, level);
    const base = "cost" in t ? ({ kind: "cost", cost: t.cost } as const) : ({ kind: "algo", algo: t } as const);
    const trap = "cost" in t ? t.trap : undefined;
    return { ...base, options: bigOOptions(r, complexityGrowth(base), trap ? 0 : pNone, trap) };
  },
};

// ---------------------------------------------------------------- P y NP

export const COMB_PNP: ExerciseType<CombPnpInstance> = {
  id: "combinatoria-p-np",
  topic: "combinatoria",
  title: "P y NP",
  description: "Verdadero o falso sobre las clases P y NP, los problemas NP-completos y la notación O grande; con la explicación de cada afirmación al terminar.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const pool = pnpPool(level);
    const count = level === "básico" ? 4 : level === "medio" ? 5 : 6;
    return generateUntil(
      rngFor("combinatoria-p-np", seed),
      (r) => ({ ids: r.shuffle(pool).slice(0, count).map((s) => s.id) }),
      (x) => {
        const values = x.ids.map((id) => pool.find((s) => s.id === id)!.value);
        return values.some(Boolean) && values.some((v) => !v);
      },
    );
  },
};

export const DISCRETE_EXERCISES = [COMB_PROBLEM, COMB_MODEL, COMB_FUNCTIONS, COMB_COMPLEXITY, COMB_PNP] as const;
