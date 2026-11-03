// Ejercicios de probabilidad: probabilidad total y Bayes con un árbol (también contado con
// porcentajes), condicionada con un dado (cuatro opciones, a–d), condicionada e independencia (una
// correcta entre a–d o, en avanzado, la o las correctas), binomial, geométrica, esperanza de un juego con un dado trucado,
// penalización por fallo en un test y E[XY] con variables independientes. Las instancias guardan solo
// los datos (fracciones como pares de enteros, para que se puedan escribir en JSON); lo que se corrige
// lo calcula el motor de shared/probability al resolver, con fracciones exactas.
import { add, cmp, div, equals, frac, isZero, mul, ONE, sub, ZERO, type Frac } from "../rational.ts";
import { interFromCond, interFromUnion, pairFacts, solveTree, type PairFacts } from "../probability/conditional.ts";
import { probAtLeast, pmfExact, type DistSpec } from "../probability/distributions.ts";
import type { DistQuestion } from "../probability/schema.ts";
import { condProbOf, dieEvent, dieSpace, eventInter, loadedDieWeights, probOf, type DieEventSpec } from "../probability/events.ts";
import { dieGameRows, penaltyForTarget, type DieRule } from "../probability/variable.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

/** Fracción como par de enteros [numerador, denominador]. */
export type Q = readonly [number, number];
export const qFrac = (q: Q): Frac => frac(BigInt(q[0]), BigInt(q[1]));
export const fracQ = (x: Frac): Q => [Number(x.n), Number(x.d)];
const q = (n: number, d: number): Q => fracQ(frac(BigInt(n), BigInt(d)));

/** Décimas (1/10 … 9/10). */
const tenths = (lo = 1, hi = 9): Q[] => Array.from({ length: hi - lo + 1 }, (_, i) => q(lo + i, 10));
const SIMPLE: Q[] = [q(1, 2), q(1, 3), q(2, 3), q(1, 4), q(3, 4), q(1, 5), q(2, 5), q(3, 5), q(4, 5), q(1, 6), q(5, 6)];

// ---------------------------------------------------------------- Probabilidad total y Bayes

/** Contextos de los árboles: nombres de las ramas de la partición y el suceso C. */
export const TREE_STORIES = [
  { context: "Una fábrica monta sus piezas en varias líneas de producción.", branch: "L", event: "la pieza es defectuosa" },
  { context: "Una aplicación recibe usuarios desde varias campañas de publicidad.", branch: "K", event: "el usuario se suscribe" },
  { context: "Un clasificador procesa fotos tomadas con varias cámaras.", branch: "M", event: "la foto se clasifica mal" },
  { context: "Una empresa de reparto trabaja con varias rutas.", branch: "R", event: "el paquete llega tarde" },
  { context: "Un laboratorio analiza muestras de varios hospitales.", branch: "H", event: "la muestra hay que repetirla" },
] as const;

/**
 * Historias de Bayes contadas con porcentajes, como en el examen: un x % tiene la característica
 * (rama A₁); de ellos, un y % NO presenta la señal (así que P(C | A₁) = 1 − y); de los demás (A₂), un
 * z % SÍ la presenta (P(C | A₂) = z).
 */
export const PERCENT_STORIES = [
  {
    text: "Un {x} % de los portátiles de un lote tiene la batería defectuosa. De éstos, un {y} % no muestra ningún aviso; de los que la tienen bien, un {z} % muestra un aviso igualmente.",
    branches: ["Defectuosa", "Bien"],
    event: "el portátil muestra un aviso",
    question: "Si un portátil muestra un aviso, ¿qué probabilidad hay de que su batería sea defectuosa?",
  },
  {
    text: "Un {x} % de las operaciones de una tienda en línea son fraudulentas. De éstas, un {y} % no activa la alerta del sistema; de las legítimas, un {z} % sí la activa.",
    branches: ["Fraude", "Legítima"],
    event: "se activa la alerta",
    question: "Si se activa la alerta, ¿qué probabilidad hay de que la operación sea fraudulenta?",
  },
  {
    text: "Un {x} % de las plantas de un invernadero tiene una plaga. De las que la tienen, un {y} % no presenta manchas en las hojas; de las sanas, un {z} % sí las presenta.",
    branches: ["Plaga", "Sana"],
    event: "la planta presenta manchas",
    question: "Si una planta presenta manchas, ¿qué probabilidad hay de que tenga la plaga?",
  },
  {
    text: "Un {x} % de los correos de una empresa son de phishing. De ellos, un {y} % no tiene ningún enlace sospechoso; de los legítimos, un {z} % sí tiene alguno.",
    branches: ["Phishing", "Legítimo"],
    event: "el correo tiene un enlace sospechoso",
    question: "Si un correo tiene un enlace sospechoso, ¿qué probabilidad hay de que sea de phishing?",
  },
] as const;

const SUB = ["₁", "₂", "₃"];
/** Nombre de la rama i de un contexto: «L₁». */
export const branchName = (story: number, i: number) => `${TREE_STORIES[story]!.branch}${SUB[i]}`;

export type ProbTreeInstance = {
  story: number;
  priors: Q[];
  likelihoods: Q[];
  /** Rama cuya P(Aᵢ) no se da (se deduce porque la partición suma 1). */
  hiddenPrior: number;
  /** Rama por la que se pregunta P(Aᵢ | C), o null si solo se pide P(C). */
  ask: number | null;
  /** Historia con porcentajes (PERCENT_STORIES), o null si los datos se dan en notación. */
  percent: number | null;
};

const PARTITIONS_3: Q[][] = [
  [q(1, 2), q(3, 10), q(1, 5)],
  [q(2, 5), q(7, 20), q(1, 4)],
  [q(3, 5), q(1, 4), q(3, 20)],
  [q(9, 20), q(7, 20), q(1, 5)],
  [q(1, 4), q(1, 4), q(1, 2)],
  [q(1, 5), q(3, 10), q(1, 2)],
  [q(1, 3), q(1, 3), q(1, 3)],
  [q(1, 6), q(1, 3), q(1, 2)],
];

function makeTree(rng: Rng, level: ExerciseLevel): ProbTreeInstance {
  const story = rng.int(0, TREE_STORIES.length - 1);
  if (level === "avanzado") {
    const priors = rng.shuffle(rng.pick(PARTITIONS_3));
    const likelihoods = priors.map(() => q(rng.int(1, 20), 100));
    return { story, priors, likelihoods, hiddenPrior: rng.int(0, 2), ask: rng.int(0, 2), percent: null };
  }
  if (level !== "básico" && rng.chance(0.5)) {
    // Historia con porcentajes: x % de A₁, y % de A₁ sin la señal y z % de A₂ con ella.
    const x = rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30]);
    const y = rng.pick([5, 8, 10, 12, 15, 20, 25, 30]);
    const z = rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15]);
    return { story, priors: [q(x, 100), q(100 - x, 100)], likelihoods: [q(100 - y, 100), q(z, 100)], hiddenPrior: 1, ask: 0, percent: rng.int(0, PERCENT_STORIES.length - 1) };
  }
  const p = level === "básico" ? rng.pick(tenths(2, 8)) : rng.pick([...tenths(1, 9), q(1, 4), q(3, 4), q(1, 3), q(2, 3)]);
  const priors = [p, fracQ(sub(ONE, qFrac(p)))];
  const likes = level === "básico" ? [...tenths(), q(1, 4), q(3, 4), q(1, 2)] : [...SIMPLE, ...Array.from({ length: 10 }, (_, i) => q(5 * (i + 1), 100))];
  const likelihoods = [rng.pick(likes), rng.pick(likes)];
  return { story, priors, likelihoods, hiddenPrior: 1, ask: level === "básico" ? null : rng.int(0, 1), percent: null };
}

export const toProbTree = (t: ProbTreeInstance) => ({ priors: t.priors.map(qFrac), likelihoods: t.likelihoods.map(qFrac) });

export const PROB_TOTAL: ExerciseType<ProbTreeInstance> = {
  id: "probabilidad-total",
  topic: "probabilidad",
  title: "Probabilidad total y Bayes",
  description: "Completa el árbol de una partición: ramas que faltan, productos, P(C) por la probabilidad total y P(Aᵢ | C) por Bayes.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-total", seed),
      (r) => makeTree(r, level),
      (t) => {
        const s = solveTree(toProbTree(t));
        if (isZero(s.total) || equals(s.total, ONE)) return false;
        // Las ramas distintas entre sí (si no, Bayes no dice nada).
        if (equals(qFrac(t.likelihoods[0]!), qFrac(t.likelihoods[1]!))) return false;
        return s.total.d <= 10000n;
      },
    );
  },
};

// ---------------------------------------------------------------- Condicionada e independencia

export const PAIR_STORIES = [
  { context: "Se elige al azar un usuario de una plataforma de vídeo.", a: "ha visto un documental esta semana", b: "usa la aplicación del móvil" },
  { context: "Se elige al azar un día del año en una ciudad.", a: "llueve", b: "hay atasco en la entrada" },
  { context: "Se elige al azar un mensaje de un foro.", a: "lleva código", b: "tiene alguna respuesta" },
  { context: "Se elige al azar una imagen de un conjunto de datos.", a: "es de interior", b: "contiene una persona" },
  { context: "Se elige al azar un pedido de una tienda en línea.", a: "se paga con tarjeta", b: "se devuelve" },
] as const;

/** Afirmaciones del «selecciona la o las correctas». */
export type PairStatement =
  | { kind: "independientes" }
  | { kind: "incompatibles" }
  | { kind: "a-dado-b"; value: Q }
  | { kind: "b-dado-a"; value: Q }
  | { kind: "union"; value: Q }
  | { kind: "ninguno"; value: Q }
  | { kind: "condicionada-igual" };

export type ProbPairInstance = {
  story: number;
  pA: Q;
  pB: Q;
  /** El tercer dato: P(A ∩ B), P(A ∪ B) o P(A | B). */
  given: "inter" | "union" | "cond";
  value: Q;
  /** Cuatro afirmaciones, a) a d). */
  statements: PairStatement[];
  /** «Selecciona la o las correctas» (puede haber varias); si no, exactamente una es correcta. */
  multi: boolean;
};

export const pairInstanceFacts = (p: ProbPairInstance): PairFacts => {
  const pA = qFrac(p.pA);
  const pB = qFrac(p.pB);
  const v = qFrac(p.value);
  return pairFacts(pA, pB, p.given === "inter" ? v : p.given === "union" ? interFromUnion(pA, pB, v) : interFromCond(v, pB));
};

/** ¿Es verdadera la afirmación? */
export function pairStatementTrue(s: PairStatement, f: PairFacts): boolean {
  switch (s.kind) {
    case "independientes":
      return f.independent;
    case "incompatibles":
      return f.exclusive;
    case "condicionada-igual":
      return f.aGivenB !== null && equals(f.aGivenB, f.pA);
    case "a-dado-b":
      return f.aGivenB !== null && equals(f.aGivenB, qFrac(s.value));
    case "b-dado-a":
      return f.bGivenA !== null && equals(f.bGivenA, qFrac(s.value));
    case "union":
      return equals(f.union, qFrac(s.value));
    case "ninguno":
      return equals(f.neither, qFrac(s.value));
  }
}

function makePair(rng: Rng, level: ExerciseLevel): ProbPairInstance | null {
  const grid = level === "avanzado" ? [...SIMPLE, q(3, 8), q(5, 8)] : tenths(1, 9);
  const pA = rng.pick(grid);
  const pB = rng.pick(grid);
  const A = qFrac(pA);
  const B = qFrac(pB);
  const indep = rng.chance(0.5);
  let inter: Frac;
  if (indep) inter = mul(A, B);
  else {
    const options = (level === "básico" ? Array.from({ length: 10 }, (_, i) => q(i, 10)) : level === "medio" ? Array.from({ length: 21 }, (_, i) => q(i * 5, 100)) : [...SIMPLE, q(0, 1), q(1, 8), q(1, 10), q(3, 10), q(1, 12), q(1, 20)]).map(qFrac);
    // Solo valores posibles: max(0, P(A) + P(B) − 1) ≤ P(A ∩ B) ≤ min(P(A), P(B)).
    const lo = sub(add(A, B), ONE);
    const valid = options.filter((x) => cmp(x, A) <= 0 && cmp(x, B) <= 0 && cmp(x, lo) >= 0 && !equals(x, mul(A, B)));
    if (valid.length === 0) return null;
    inter = rng.pick(valid);
  }
  let facts: PairFacts;
  try {
    facts = pairFacts(A, B, inter);
  } catch {
    return null;
  }
  if (!indep && facts.independent) return null;
  const given: ProbPairInstance["given"] = level === "básico" ? "inter" : level === "medio" ? rng.pick(["inter", "union"] as const) : rng.pick(["union", "cond"] as const);
  if (given === "cond" && facts.aGivenB === null) return null;
  const value = fracQ(given === "inter" ? inter : given === "union" ? facts.union : facts.aGivenB!);
  // Afirmaciones: la independencia siempre; las demás, con su valor verdadero o con un error típico.
  const wrongCond = facts.bGivenA ?? A;
  const pool: PairStatement[] = [
    { kind: "independientes" },
    { kind: rng.chance(0.5) ? "incompatibles" : "condicionada-igual" },
    { kind: "a-dado-b", value: fracQ(rng.chance(0.5) || facts.aGivenB === null ? wrongCond : facts.aGivenB) },
    { kind: "union", value: fracQ(rng.chance(0.5) ? facts.union : naiveUnion(A, B)) },
    { kind: "ninguno", value: fracQ(rng.chance(0.5) ? facts.neither : sub(ONE, facts.inter)) },
    { kind: "b-dado-a", value: fracQ(rng.chance(0.5) || facts.bGivenA === null ? (facts.aGivenB ?? B) : facts.bGivenA) },
  ];
  const statements = [pool[0]!, ...rng.shuffle(pool.slice(1)).slice(0, 3)];
  return { story: rng.int(0, PAIR_STORIES.length - 1), pA, pB, given, value, statements: rng.shuffle(statements), multi: level === "avanzado" };
}

/** El error típico «P(A ∪ B) = P(A) + P(B)», sin pasar de 1. */
const naiveUnion = (a: Frac, b: Frac) => {
  const s = add(a, b);
  return cmp(s, ONE) > 0 ? ONE : s;
};

export const PROB_INDEPENDENCE: ExerciseType<ProbPairInstance> = {
  id: "probabilidad-independencia",
  topic: "probabilidad",
  title: "Condicionada e independencia",
  description: "Con P(A), P(B) y un dato más, calcula P(A ∪ B) o P(A ∩ B) y P(A | B), y elige la afirmación correcta entre a) y d) (en el nivel avanzado, la o las correctas).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-independencia", seed),
      (r) => makePair(r, level),
      (p) => {
        const f = pairInstanceFacts(p);
        const truth = p.statements.map((s) => pairStatementTrue(s, f));
        // Una sola correcta (opción múltiple) o, con «la o las correctas», al menos una y alguna falsa.
        const right = truth.filter(Boolean).length;
        if (p.multi ? right === 0 || right === truth.length : right !== 1) return false;
        // Ningún dato trivial (0 o 1).
        if ([f.pA, f.pB].some((x) => isZero(x) || equals(x, ONE))) return false;
        // Afirmaciones distintas entre sí.
        return new Set(p.statements.map((s) => JSON.stringify(s))).size === p.statements.length;
      },
    );
  },
};

// ---------------------------------------------------------------- Binomial y geométrica

export const BINOMIAL_STORIES = [
  "Un modelo acierta cada predicción con probabilidad {p}, independientemente de las demás. Se le pasan {n} ejemplos y X es el número de aciertos.",
  "Cada vez que se lanza un experimento en la nube, termina sin errores con probabilidad {p}. Se lanzan {n} experimentos independientes y X es el número de los que terminan sin errores.",
  "Un jugador de baloncesto encesta cada tiro libre con probabilidad {p}. Lanza {n} tiros libres, independientes, y X es el número de canastas.",
  "Cada pieza de un lote pasa el control con probabilidad {p}, independientemente de las demás. Se revisan {n} piezas y X es el número de las que lo pasan.",
  "Un sensor detecta cada paso de un vehículo con probabilidad {p}. Pasan {n} vehículos, de forma independiente, y X es el número de detecciones.",
] as const;

export const GEOMETRIC_STORIES = [
  "Un servidor acepta cada intento de conexión con probabilidad {p}, independientemente de los anteriores, y se reintenta hasta conectar. X es el número del intento en que conecta por primera vez.",
  "Se lanza un dado de juego hasta que sale la cara premiada, que tiene probabilidad {p} en cada tirada. X es el número de la tirada en que sale por primera vez.",
  "Un algoritmo aleatorizado encuentra una solución válida en cada ejecución con probabilidad {p}. Se ejecuta hasta encontrarla y X es el número de ejecuciones.",
  "Una persona intenta aprobar un examen práctico, que supera en cada intento con probabilidad {p}, independientemente de los anteriores. X es el número del intento en que lo aprueba por primera vez.",
] as const;

export type ProbDistInstance = {
  story: number;
  /** Binomial: n; geométrica: no se usa (0). */
  n: number;
  p: Q;
  k: number;
  ask: DistQuestion[];
};

export const binomialSpec = (i: ProbDistInstance): DistSpec => ({ kind: "binomial", n: i.n, p: qFrac(i.p) });
export const geometricSpec = (i: ProbDistInstance): DistSpec => ({ kind: "geometrica", p: qFrac(i.p) });

function makeBinomial(rng: Rng, level: ExerciseLevel): ProbDistInstance {
  const story = rng.int(0, BINOMIAL_STORIES.length - 1);
  if (level === "básico") {
    const n = rng.int(3, 5);
    return { story, n, p: rng.pick([q(1, 2), q(1, 3), q(2, 3), q(1, 4), q(3, 4), q(1, 5), q(4, 5)]), k: rng.int(1, n), ask: ["igual", "media"] };
  }
  if (level === "medio") {
    const n = rng.int(4, 7);
    return { story, n, p: rng.pick([...tenths(1, 9), q(1, 3), q(2, 3), q(1, 4), q(3, 4)]), k: rng.int(2, n - 1), ask: ["igual", "al-menos", "media"] };
  }
  const n = rng.int(6, 10);
  return { story, n, p: rng.pick([...tenths(1, 9), q(1, 6), q(5, 6)]), k: rng.int(2, n - 2), ask: rng.shuffle(["al-menos", "como-mucho"] as DistQuestion[]).slice(0, 1).concat(["media", "varianza"]) };
}

function makeGeometric(rng: Rng, level: ExerciseLevel): ProbDistInstance {
  const story = rng.int(0, GEOMETRIC_STORIES.length - 1);
  if (level === "básico") return { story, n: 0, p: rng.pick([q(1, 2), q(1, 3), q(1, 4), q(1, 5), q(1, 6), q(2, 3), q(3, 4)]), k: rng.int(2, 4), ask: ["igual", "media"] };
  if (level === "medio") return { story, n: 0, p: rng.pick([...tenths(1, 9), q(1, 6), q(2, 3)]), k: rng.int(2, 6), ask: ["igual", "al-menos", "media"] };
  return { story, n: 0, p: rng.pick([...tenths(1, 9), q(1, 6), q(1, 3), q(3, 4), q(2, 5)]), k: rng.int(3, 8), ask: ["al-menos", "como-mucho", "media", "varianza"] };
}

const distOk = (d: DistSpec, i: ProbDistInstance) => {
  // Ni 0 ni 1 en las probabilidades que se piden.
  const values = [pmfExact(d, i.k)!, probAtLeast(d, i.k) as Frac];
  return values.every((v) => !isZero(v) && !equals(v, ONE));
};

export const PROB_BINOMIAL: ExerciseType<ProbDistInstance> = {
  id: "probabilidad-binomial",
  topic: "probabilidad",
  title: "Binomial: k éxitos en n intentos",
  description: "Calcula P(X = k), «k o más veces» o «como mucho k veces» en n intentos independientes, y la media y la varianza.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(rngFor("probabilidad-binomial", seed), (r) => makeBinomial(r, level), (i) => distOk(binomialSpec(i), i));
  },
};

export const PROB_GEOMETRIC: ExerciseType<ProbDistInstance> = {
  id: "probabilidad-geometrica",
  topic: "probabilidad",
  title: "Geométrica: el primer éxito",
  description: "Probabilidad de que el primer éxito llegue en el k-ésimo intento, de necesitar al menos k intentos o como mucho k, y número medio de intentos.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(rngFor("probabilidad-geometrica", seed), (r) => makeGeometric(r, level), (i) => distOk(geometricSpec(i), i));
  },
};

// ---------------------------------------------------------------- Esperanza de un juego

export type ProbGameInstance = { odd: number; even: number; rule: DieRule; ask: Array<"media" | "varianza"> };

function makeGame(rng: Rng, level: ExerciseLevel): ProbGameInstance {
  const [odd, even] = level === "básico" ? [1, 1] : level === "medio" ? rng.pick([[2, 1], [1, 2]] as const) : rng.pick([[3, 1], [1, 3], [3, 2], [2, 3], [2, 1], [1, 2]] as const);
  const kind = rng.pick(["cara", "paridad", "umbral", "caras"] as const);
  const rule: DieRule =
    kind === "cara"
      ? { kind, mult: rng.int(1, 3), cost: rng.int(2, 9) }
      : kind === "paridad"
        ? { kind, odd: rng.pick([-1, 1]) * rng.int(1, 6), even: rng.pick([-1, 1]) * rng.int(1, 6) }
        : kind === "umbral"
          ? { kind, t: rng.int(3, 6), win: rng.int(2, 10), lose: -rng.int(1, 5) }
          : { kind, payoffs: cutsPayoffs(rng) };
  return { odd, even, rule, ask: level === "avanzado" ? ["media", "varianza"] : ["media"] };
}

/** Ganancias por cara en dos o tres tramos (1–2 pierdes, 3–5 ganas poco, 6 ganas mucho…). */
function cutsPayoffs(rng: Rng): number[] {
  const c1 = rng.int(1, 4);
  const c2 = rng.int(c1 + 1, 6);
  const v = [-rng.int(1, 6), rng.pick([-1, 0, 1, 2]), rng.int(3, 12)];
  return [1, 2, 3, 4, 5, 6].map((f) => (f <= c1 ? v[0]! : f <= c2 ? v[1]! : v[2]!));
}

export const gameInstanceRows = (g: ProbGameInstance) => dieGameRows(g.rule, loadedDieWeights(g.odd, g.even));

export const PROB_GAME: ExerciseType<ProbGameInstance> = {
  id: "probabilidad-juego",
  topic: "probabilidad",
  title: "Esperanza de un juego con un dado",
  description: "Rellena la tabla del juego (ganancia, probabilidad de cada cara y su producto) con un dado equilibrado o trucado, y calcula la ganancia esperada.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-juego", seed),
      (r) => makeGame(r, level),
      (g) => {
        const rows = gameInstanceRows(g);
        const values = new Set(rows.map((x) => `${x.value.n}`));
        // Que se gane con unas caras y se pierda con otras.
        return values.size >= 2 && rows.some((x) => x.value.n < 0n) && rows.some((x) => x.value.n > 0n);
      },
    );
  },
};

// ---------------------------------------------------------------- Penalización en un test

export type ProbPenaltyInstance = { options: number; reward: Q; target: Q };

function makePenalty(rng: Rng, level: ExerciseLevel): ProbPenaltyInstance {
  const options = rng.int(level === "básico" ? 2 : 3, 6);
  if (level === "básico") return { options, reward: rng.pick([q(1, 1), q(1, 1), q(2, 1), q(1, 2), q(1, 4), q(3, 4), q(3, 1), q(1, 5)]), target: q(0, 1) };
  const reward = level === "medio" ? q(1, 1) : rng.pick([q(1, 2), q(1, 4), q(2, 1), q(1, 1), q(3, 2)]);
  const target = level === "medio" ? rng.pick([q(1, 20), q(1, 10), q(1, 25), q(1, 8), q(1, 50)]) : rng.pick([q(1, 20), q(1, 40), q(1, 10), q(-1, 10), q(-1, 20), q(1, 100)]);
  return { options, reward, target };
}

export const penaltyAnswer = (p: ProbPenaltyInstance): Frac => penaltyForTarget(p.options, qFrac(p.reward), qFrac(p.target));

export const PROB_PENALTY: ExerciseType<ProbPenaltyInstance> = {
  id: "probabilidad-penalizacion",
  topic: "probabilidad",
  title: "Penalización por fallo en un test",
  description: "Cuánto tiene que restar una respuesta incorrecta para que responder al azar a una pregunta de k opciones valga, de media, lo que se pide.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-penalizacion", seed),
      (r) => makePenalty(r, level),
      (p) => {
        const x = penaltyAnswer(p);
        return cmp(x, ZERO) > 0 && x.d <= 200n;
      },
    );
  },
};

// ---------------------------------------------------------------- E[XY] con independientes

export type ProbProductInstance = {
  x: { n: number; p: Q };
  y: { n: number; p: Q };
  /** Coeficientes de E[aX + bY + c]. */
  lin: [number, number, number];
  ask: Array<"exy" | "lineal" | "var-suma">;
};

function makeProduct(rng: Rng, level: ExerciseLevel): ProbProductInstance {
  const ps = level === "básico" ? [q(1, 2), q(1, 3), q(1, 4), q(1, 5), q(2, 3), q(3, 4)] : [...tenths(1, 9), ...SIMPLE];
  const x = { n: rng.int(2, level === "básico" ? 6 : 12), p: rng.pick(ps) };
  const y = { n: rng.int(2, level === "básico" ? 6 : 12), p: rng.pick(ps) };
  const lin: [number, number, number] = [rng.pick([-3, -2, 2, 3, 4]), rng.pick([-3, -2, -1, 1, 2, 5]), rng.int(-5, 5)];
  const ask: ProbProductInstance["ask"] = level === "básico" ? ["exy"] : level === "medio" ? ["exy", "lineal"] : ["exy", "var-suma"];
  return { x, y, lin, ask };
}

export const PROB_PRODUCT: ExerciseType<ProbProductInstance> = {
  id: "probabilidad-producto",
  topic: "probabilidad",
  title: "E[XY] con variables independientes",
  description: "Con dos binomiales independientes, calcula E[XY] = E[X]·E[Y] y, según el nivel, una combinación lineal o Var(X + Y).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-producto", seed),
      (r) => makeProduct(r, level),
      (i) => mul(mul(frac(BigInt(i.x.n)), qFrac(i.x.p)), mul(frac(BigInt(i.y.n)), qFrac(i.y.p))).d <= 100n,
    );
  },
};

// ---------------------------------------------------------------- Condicionada con un dado (a–d)

export type ProbDieCondInstance = { odd: number; even: number; a: DieEventSpec; b: DieEventSpec; options: Q[] };

const DIE_EVENTS = (rng: Rng): DieEventSpec =>
  rng.pick<DieEventSpec>([
    { kind: "par" },
    { kind: "impar" },
    { kind: "primo" },
    { kind: "multiplo3" },
    { kind: "menor", k: rng.int(2, 6) },
    { kind: "mayor", k: rng.int(1, 5) },
    { kind: "distinto", k: rng.int(1, 6) },
  ]);

export function dieCondFacts(i: Pick<ProbDieCondInstance, "odd" | "even" | "a" | "b">) {
  const die = dieSpace([1, 2, 3, 4, 5, 6].map((f) => (f % 2 ? i.odd : i.even)));
  const A = dieEvent(die, i.a);
  const B = dieEvent(die, i.b);
  return { die, A, B, pA: probOf(die, A), pB: probOf(die, B), pAB: probOf(die, eventInter(A, B)), answer: condProbOf(die, A, B) };
}

function makeDieCond(rng: Rng, level: ExerciseLevel): ProbDieCondInstance | null {
  const [odd, even] = level === "avanzado" ? rng.pick([[2, 1], [1, 2], [3, 1], [1, 3]] as const) : [1, 1];
  const a = DIE_EVENTS(rng);
  const b = level === "básico" ? rng.pick<DieEventSpec>([{ kind: "par" }, { kind: "impar" }]) : DIE_EVENTS(rng);
  const f = dieCondFacts({ odd, even, a, b });
  if (f.answer === null || isZero(f.answer) || equals(f.answer, ONE)) return null;
  // Distractores: los errores típicos (no condicionar, condicionar al revés, P(A)) y, si hacen falta,
  // fracciones cercanas.
  const condBA = isZero(f.pA) ? null : div(f.pAB, f.pA);
  const raw = [f.pAB, condBA, f.pA, mul(f.pA, f.pB), add(f.answer, frac(1n, 6n)), sub(f.answer, frac(1n, 6n)), frac(1n, 2n), frac(1n, 3n)];
  const seen = new Set([`${f.answer.n}/${f.answer.d}`]);
  const wrong: Frac[] = [];
  for (const x of raw) {
    if (!x || cmp(x, ZERO) <= 0 || cmp(x, ONE) >= 0) continue;
    const key = `${x.n}/${x.d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wrong.push(x);
  }
  if (wrong.length < 3) return null;
  return { odd, even, a, b, options: rng.shuffle([f.answer, ...wrong.slice(0, 3)]).map(fracQ) };
}

export const PROB_DIE_COND: ExerciseType<ProbDieCondInstance> = {
  id: "probabilidad-dado",
  topic: "probabilidad",
  title: "Condicionada con un dado",
  description: "Al tirar un dado (equilibrado o, en el nivel avanzado, trucado), probabilidad de un suceso sabiendo que ha ocurrido otro, con cuatro opciones de a) a d).",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("probabilidad-dado", seed),
      (r) => makeDieCond(r, level),
      (i) => JSON.stringify(i.a) !== JSON.stringify(i.b),
    );
  },
};

export const PROB_EXERCISES = [PROB_TOTAL, PROB_DIE_COND, PROB_INDEPENDENCE, PROB_BINOMIAL, PROB_GEOMETRIC, PROB_GAME, PROB_PENALTY, PROB_PRODUCT] as const;

/** Afirmaciones para un par de sucesos del contenido (sin semilla): independencia, incompatibilidad, P(A | B) y el error de sumar. */
export function pairStatementsFor(f: PairFacts): PairStatement[] {
  return [
    { kind: "independientes" },
    { kind: "incompatibles" },
    { kind: "a-dado-b", value: fracQ(f.aGivenB ?? f.pA) },
    { kind: "union", value: fracQ(naiveUnion(f.pA, f.pB)) },
  ];
}
