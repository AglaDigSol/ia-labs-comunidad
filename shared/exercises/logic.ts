// Ejercicios de lógica proposicional: fórmulas generadas al azar (con semilla) dentro de los límites
// de cada nivel. Lo que se comprueba (tabla de verdad, clasificación, equivalencia, formas normales)
// lo calculan los motores de shared/logic/ al resolver: aquí solo se eligen enunciados que tengan
// sentido (que usen todas las variables, que no sean triviales…).
import { collectVars, toPlain, type Node } from "../logic/ast.ts";
import { compareFormulas } from "../logic/compare.ts";
import { buildTable, classify } from "../logic/truth-table.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Bin = "and" | "or" | "xor" | "imp" | "iff";

/** Límites de cada nivel: variables, número de conectivas binarias y conectivas que se usan. */
export const LOGIC_LIMITS: Record<ExerciseLevel, { vars: string[]; ops: [number, number]; connectives: Bin[] }> = {
  básico: { vars: ["p", "q"], ops: [2, 2], connectives: ["and", "or", "imp"] },
  medio: { vars: ["p", "q", "r"], ops: [3, 3], connectives: ["and", "or", "imp", "iff"] },
  avanzado: { vars: ["p", "q", "r", "s"], ops: [3, 4], connectives: ["and", "or", "imp", "iff", "xor"] },
};

const v = (name: string): Node => ({ kind: "var", name });
/** ¬, sin acumular dobles negaciones (¬¬p se escribe p). */
export const neg = (n: Node): Node => (n.kind === "not" ? n.arg : { kind: "not", arg: n });
const bin = (kind: Bin, left: Node, right: Node): Node => ({ kind, left, right });

/** Número de conectivas binarias. */
export function binaryCount(n: Node): number {
  if (n.kind === "var" || n.kind === "const") return 0;
  if (n.kind === "not") return binaryCount(n.arg);
  return 1 + binaryCount(n.left) + binaryCount(n.right);
}

// Operandos de una cadena del mismo operador conmutativo: (p ∨ q) ∨ r da p, q, r.
const COMMUTATIVE = new Set<Node["kind"]>(["and", "or", "xor", "iff"]);
function chain(n: Node, kind: Node["kind"]): Node[] {
  return n.kind === kind && n.kind !== "not" && n.kind !== "var" && n.kind !== "const"
    ? [...chain(n.left, kind), ...chain(n.right, kind)]
    : [n];
}

/**
 * ¿Hay algo que hace pobre el enunciado? Un operando repetido en una cadena (p ∨ q ∨ p, p → p), un
 * literal junto a su negación (p ∧ ¬p ∧ q) o una doble negación.
 */
export function hasRedundancy(n: Node): boolean {
  if (n.kind === "var" || n.kind === "const") return false;
  if (n.kind === "not") return n.arg.kind === "not" || hasRedundancy(n.arg);
  const ops = COMMUTATIVE.has(n.kind) ? chain(n, n.kind) : [n.left, n.right];
  const plain = ops.map(toPlain);
  if (new Set(plain).size < plain.length) return true;
  if (ops.some((o) => o.kind === "not" && plain.includes(toPlain(o.arg)))) return true;
  return ops.some((o) => o !== n && hasRedundancy(o));
}

/** Fórmula al azar con exactamente `ops` conectivas binarias sobre `vars`. */
export function randomFormula(rng: Rng, vars: readonly string[], ops: number, connectives: readonly Bin[]): Node {
  const build = (k: number): Node => {
    if (k === 0) {
      const leaf = v(rng.pick(vars));
      return rng.chance(0.3) ? neg(leaf) : leaf;
    }
    const left = rng.int(0, k - 1);
    const node = bin(rng.pick(connectives), build(left), build(k - 1 - left));
    return rng.chance(0.15) ? neg(node) : node;
  };
  return build(ops);
}

const usesAll = (n: Node, vars: readonly string[]) => collectVars(n).length === vars.length;

function kindOf(n: Node) {
  const t = buildTable(n);
  if (!t.ok) throw new Error("demasiadas variables");
  return classify(t.rows).kind;
}

/** Fórmula del nivel: usa todas sus variables, sin redundancias, y cumple `accept`. */
function levelFormula(rng: Rng, level: ExerciseLevel, accept: (n: Node) => boolean, attempts = 4000): Node {
  const { vars, ops, connectives } = LOGIC_LIMITS[level];
  return generateUntil(
    rng,
    (r) => randomFormula(r, vars, r.int(ops[0], ops[1]), connectives),
    (n) => usesAll(n, vars) && !hasRedundancy(n) && accept(n),
    attempts,
  );
}

// ---------------------------------------------------------------- Tipos

/** Una fórmula en texto (la escritura de libro, que el analizador vuelve a leer igual). */
export type FormulaInstance = { formula: string };

export const LOGIC_TRUTH_TABLE: ExerciseType<FormulaInstance> = {
  id: "logica-tabla",
  topic: "logica",
  title: "Tabla de verdad paso a paso",
  description: "Rellena la tabla de una fórmula columna a columna, de dentro hacia fuera, y clasifícala.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const f = levelFormula(rngFor("logica-tabla", seed), level, (n) => kindOf(n) === "contingencia");
    return { formula: toPlain(f) };
  },
};

export const LOGIC_CLASSIFY: ExerciseType<FormulaInstance> = {
  id: "logica-clasificar",
  topic: "logica",
  title: "Tautología, contradicción o contingencia",
  description: "Decide qué es la fórmula a partir de la columna de su resultado.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("logica-clasificar", seed);
    // Las tres clases por igual: si no, casi todo saldría contingencia.
    const target = rng.pick(["tautologia", "contradiccion", "contingencia"] as const);
    // Tautologías y contradicciones son raras al azar: con tres variables como mucho y más intentos.
    const limited: ExerciseLevel = level === "avanzado" ? "medio" : level;
    const { vars, ops, connectives } = LOGIC_LIMITS[limited];
    const f = generateUntil(
      rng,
      (r) => randomFormula(r, vars, r.int(ops[0], ops[1] + (level === "avanzado" ? 1 : 0)), level === "avanzado" ? LOGIC_LIMITS.avanzado.connectives : connectives),
      (n) => usesAll(n, vars) && !hasRedundancy(n) && kindOf(n) === target,
      20000,
    );
    return { formula: toPlain(f) };
  },
};

export const LOGIC_NORMAL_FORMS: ExerciseType<FormulaInstance> = {
  id: "logica-formas-normales",
  topic: "logica",
  title: "Formas normales FND y FNC",
  description: "Escribe los mintérminos, los maxtérminos y las formas normales disyuntiva y conjuntiva.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    // Con cuatro variables la FND tendría hasta 16 términos: el avanzado sube conectivas, no variables.
    const limits = level === "avanzado" ? { ...LOGIC_LIMITS.medio, connectives: LOGIC_LIMITS.avanzado.connectives } : LOGIC_LIMITS[level];
    const rng = rngFor("logica-formas-normales", seed);
    const f = generateUntil(
      rng,
      (r) => randomFormula(r, limits.vars, r.int(limits.ops[0], limits.ops[1] + (level === "avanzado" ? 1 : 0)), limits.connectives),
      (n) => usesAll(n, limits.vars) && !hasRedundancy(n) && kindOf(n) === "contingencia",
    );
    return { formula: toPlain(f) };
  },
};

// ---------------------------------------------------------------- Equivalencias

/** Dos fórmulas que se comparan. */
export type PairInstance = { a: string; b: string };

type Template = (x: Node, y: Node, z: Node) => [Node, Node];

/** Leyes conocidas: los dos lados son equivalentes (lo confirma compareFormulas al generar). */
const EQUIVALENT: Template[] = [
  (x, y) => [neg(bin("and", x, y)), bin("or", neg(x), neg(y))],
  (x, y) => [neg(bin("or", x, y)), bin("and", neg(x), neg(y))],
  (x, y) => [bin("imp", x, y), bin("imp", neg(y), neg(x))],
  (x, y) => [bin("imp", x, y), bin("or", neg(x), y)],
  (x, y) => [neg(bin("imp", x, y)), bin("and", x, neg(y))],
  (x, y) => [bin("iff", x, y), bin("and", bin("imp", x, y), bin("imp", y, x))],
  (x, y, z) => [bin("and", x, bin("or", y, z)), bin("or", bin("and", x, y), bin("and", x, z))],
  (x, y, z) => [bin("or", x, bin("and", y, z)), bin("and", bin("or", x, y), bin("or", x, z))],
  (x, y, z) => [bin("imp", bin("and", x, y), z), bin("imp", x, bin("imp", y, z))],
  (x, y, z) => [bin("imp", bin("or", x, y), z), bin("and", bin("imp", x, z), bin("imp", y, z))],
  (x, y) => [neg(bin("iff", x, y)), bin("iff", x, neg(y))],
];

/** Errores habituales: parecen leyes, pero en general no son equivalencias. */
const NOT_EQUIVALENT: Template[] = [
  (x, y) => [bin("imp", x, y), bin("imp", y, x)],
  (x, y) => [bin("imp", x, y), bin("imp", neg(x), neg(y))],
  (x, y) => [neg(bin("and", x, y)), bin("and", neg(x), neg(y))],
  (x, y) => [neg(bin("or", x, y)), bin("or", neg(x), neg(y))],
  (x, y, z) => [bin("and", x, bin("or", y, z)), bin("or", bin("and", x, y), z)],
  (x, y) => [neg(bin("imp", x, y)), bin("imp", neg(x), neg(y))],
  (x, y, z) => [bin("imp", bin("and", x, y), z), bin("imp", bin("imp", x, y), z)],
  (x, y) => [bin("iff", x, y), bin("imp", x, y)],
  (x, y, z) => [bin("imp", bin("or", x, y), z), bin("or", bin("imp", x, z), bin("imp", y, z))],
];

/** Piezas X, Y, Z de las plantillas: literales distintos o, según el nivel, binarios pequeños. */
function pieces(rng: Rng, level: ExerciseLevel): [Node, Node, Node] {
  const vars = rng.shuffle(["p", "q", "r"]);
  const lit = (name: string) => (rng.chance(0.25) ? neg(v(name)) : v(name));
  const small = (name: string) => bin(rng.pick(["and", "or", "imp"] as const), lit(name), lit(rng.pick(["p", "q", "r"].filter((n) => n !== name))));
  const compound = level === "básico" ? 0 : level === "medio" ? 1 : 2;
  const which = rng.shuffle([0, 1, 2]).slice(0, compound);
  return [0, 1, 2].map((i) => (which.includes(i) ? small(vars[i]!) : lit(vars[i]!))) as [Node, Node, Node];
}

export const LOGIC_EQUIVALENCE: ExerciseType<PairInstance> = {
  id: "logica-equivalentes",
  topic: "logica",
  title: "¿Son equivalentes?",
  description: "Decide si dos fórmulas son equivalentes y en cuántas filas difieren.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("logica-equivalentes", seed);
    const want = rng.chance(0.5);
    const pair = generateUntil(
      rng,
      (r) => {
        const [x, y, z] = pieces(r, level);
        const [a, b] = r.pick(want ? EQUIVALENT : NOT_EQUIVALENT)(x, y, z);
        return r.chance(0.5) ? { a, b } : { a: b, b: a };
      },
      ({ a, b }) => {
        if (toPlain(a) === toPlain(b) || hasRedundancy(a) || hasRedundancy(b)) return false;
        const c = compareFormulas(a, b);
        return c.ok && c.equivalent === want;
      },
    );
    return { a: toPlain(pair.a), b: toPlain(pair.b) };
  },
};

export const LOGIC_EXERCISES = [LOGIC_TRUTH_TABLE, LOGIC_CLASSIFY, LOGIC_EQUIVALENCE, LOGIC_NORMAL_FORMS] as const;
