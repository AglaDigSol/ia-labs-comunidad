// Ejercicios de lógica con lenguaje natural y con conjuntos numéricos, como en los exámenes:
// - «Formalizar un enunciado» (Lógica proposicional): frases con «es suficiente», «es necesario»,
//   «solo si», «si y solo si», «a menos que», «ni… ni…», «no es cierto que…», «pero no». Se contesta
//   eligiendo entre cuatro fórmulas o escribiéndola; se corrige por equivalencia lógica con el motor.
// - «Negar en lenguaje natural» (Lógica de predicados): una frase con cuantificadores y cuatro
//   negaciones posibles; los distractores son los errores típicos (negar solo el predicado, dejar el
//   cuantificador, De Morgan al revés). Cada opción lleva su fórmula, y la buena se reconoce porque es
//   equivalente a la negación de la frase (motor de predicados, en dominios finitos).
// - «Predicados sobre conjuntos numéricos»: familias razonadas a mano (cubos, raíces, inversos,
//   divisibilidad, densidad, mínimo…) con su valor en ℕ, ℤ, ℚ y ℝ, comprobado en los tests con
//   testigos y contraejemplos numéricos. No hay demostrador general.
import { toPlain } from "../logic/ast.ts";
import { compareFormulas } from "../logic/compare.ts";
import { parseFormula } from "../logic/parser.ts";
import { negationOf, type NegationOption } from "./logic-extra-negation.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

const ALL_LEVELS = ["básico", "medio", "avanzado"] as const;

// ---------------------------------------------------------------- Formalizar

/** Una proposición en sus formas: infinitivo, presente, presente negado y subjuntivo. */
export interface Atom {
  id: string;
  inf: string;
  fin: string;
  sub: string;
}

export const ATOMS: readonly Atom[] = [
  { id: "practica", inf: "entregar la práctica", fin: "entregas la práctica", sub: "entregues la práctica" },
  { id: "examen", inf: "aprobar el examen", fin: "apruebas el examen", sub: "apruebes el examen" },
  { id: "asignatura", inf: "superar la asignatura", fin: "superas la asignatura", sub: "superes la asignatura" },
  { id: "clase", inf: "asistir a clase", fin: "asistes a clase", sub: "asistas a clase" },
  { id: "apuntes", inf: "repasar los apuntes", fin: "repasas los apuntes", sub: "repases los apuntes" },
  { id: "ejercicios", inf: "hacer los ejercicios", fin: "haces los ejercicios", sub: "hagas los ejercicios" },
  { id: "dormir", inf: "dormir ocho horas", fin: "duermes ocho horas", sub: "duermas ocho horas" },
  { id: "datos", inf: "tener datos suficientes", fin: "tienes datos suficientes", sub: "tengas datos suficientes" },
  { id: "entrenar", inf: "entrenar el modelo", fin: "entrenas el modelo", sub: "entrenes el modelo" },
  { id: "validar", inf: "validar el modelo", fin: "validas el modelo", sub: "valides el modelo" },
  { id: "publicar", inf: "publicar los resultados", fin: "publicas los resultados", sub: "publiques los resultados" },
  { id: "tiempo", inf: "llegar a tiempo", fin: "llegas a tiempo", sub: "llegues a tiempo" },
];

const ATOM_BY_ID = new Map(ATOMS.map((a) => [a.id, a]));
const atom = (id: string): Atom => ATOM_BY_ID.get(id) ?? fail(`proposición desconocida: ${id}`);
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
function fail(msg: string): never {
  throw new Error(msg);
}

/**
 * Patrones de frase: cuántas proposiciones usan, cómo se escriben, la fórmula que les corresponde y los
 * errores típicos (que se filtran si resultan equivalentes a la buena).
 */
interface Pattern {
  id: string;
  levels: readonly ExerciseLevel[];
  atoms: 2 | 3;
  sentence: (p: Atom, q: Atom, r: Atom) => string;
  formula: string;
  wrong: readonly string[];
  /** La regla, para las pistas. */
  rule: string;
}

export const FORMALIZE_PATTERNS: readonly Pattern[] = [
  {
    id: "suficiente",
    levels: ["básico", "medio"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.inf)} es suficiente para ${q.inf}.`,
    formula: "p → q",
    wrong: ["q → p", "p ↔ q", "p ∧ q", "¬p → ¬q"],
    rule: "«A es suficiente para B»: si se da A, se da B. A va a la izquierda de la flecha: A → B.",
  },
  {
    id: "suficiente-conjuncion",
    levels: ["medio", "avanzado"],
    atoms: 3,
    sentence: (p, q, r) => `${cap(p.inf)} y ${q.inf} es suficiente para ${r.inf}.`,
    formula: "(p ∧ q) → r",
    wrong: ["r → (p ∧ q)", "p ∧ (q → r)", "(p ∨ q) → r", "(p ∧ q) ∧ r"],
    rule: "«A y B es suficiente para C»: las dos cosas juntas garantizan C: (A ∧ B) → C.",
  },
  {
    id: "necesario",
    levels: ["básico", "medio"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.inf)} es necesario para ${q.inf}.`,
    formula: "q → p",
    wrong: ["p → q", "p ↔ q", "p ∧ q", "¬q → ¬p"],
    rule: "«A es necesario para B»: sin A no hay B; es decir, si se da B, se ha dado A: B → A.",
  },
  {
    id: "necesario-conjuncion",
    levels: ["avanzado"],
    atoms: 3,
    sentence: (p, q, r) => `${cap(p.inf)} y ${q.inf} es necesario para ${r.inf}.`,
    formula: "r → (p ∧ q)",
    wrong: ["(p ∧ q) → r", "(r → p) ∨ q", "r → (p ∨ q)", "(p ∧ q) ↔ r"],
    rule: "«A y B es necesario para C»: si se da C, se han dado A y B: C → (A ∧ B).",
  },
  {
    id: "solo-si",
    levels: ["básico", "medio", "avanzado"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.fin)} solo si ${q.fin}.`,
    formula: "p → q",
    wrong: ["q → p", "p ↔ q", "¬p → ¬q", "p ∧ q"],
    rule: "«A solo si B»: A no se da sin B; si se da A, se da B: A → B (no al revés).",
  },
  {
    id: "si-y-solo-si",
    levels: ["básico", "medio"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.fin)} si y solo si ${q.fin}.`,
    formula: "p ↔ q",
    wrong: ["p → q", "q → p", "p ∧ q", "p ↔ ¬q"],
    rule: "«A si y solo si B»: A → B y B → A a la vez: A ↔ B.",
  },
  {
    id: "a-menos-que",
    levels: ["medio", "avanzado"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.fin)} a menos que ${q.sub}.`,
    formula: "¬q → p",
    wrong: ["q → p", "p ∧ ¬q", "p → ¬q", "¬p → ¬q"],
    rule: "«A a menos que B»: si no se da B, se da A: ¬B → A (que equivale a A ∨ B).",
  },
  {
    id: "no-a-menos-que",
    levels: ["avanzado"],
    atoms: 2,
    sentence: (p, q) => `No ${p.fin} a menos que ${q.sub}.`,
    formula: "¬q → ¬p",
    wrong: ["q → p", "¬p → q", "¬p ∧ q", "¬p ∨ ¬q"],
    rule: "«No A a menos que B»: si no se da B, no se da A: ¬B → ¬A (que equivale a A → B).",
  },
  {
    id: "ni-ni",
    levels: ["básico", "medio"],
    atoms: 2,
    sentence: (p, q) => `Ni ${p.fin} ni ${q.fin}.`,
    formula: "¬p ∧ ¬q",
    wrong: ["¬(p ∧ q)", "¬p ∨ ¬q", "¬p → q", "¬(p ↔ q)"],
    rule: "«Ni A ni B»: no A y no B: ¬A ∧ ¬B (que es ¬(A ∨ B), no ¬(A ∧ B)).",
  },
  {
    id: "no-es-cierto",
    levels: ["medio", "avanzado"],
    atoms: 2,
    sentence: (p, q) => `No es cierto que ${p.sub} y ${q.sub}.`,
    formula: "¬(p ∧ q)",
    wrong: ["¬p ∧ ¬q", "¬p ∧ q", "¬(p ∨ q)", "p → q"],
    rule: "«No es cierto que A y B» niega la conjunción entera: ¬(A ∧ B), que por De Morgan es ¬A ∨ ¬B.",
  },
  {
    id: "pero-no",
    levels: ["básico", "medio"],
    atoms: 2,
    sentence: (p, q) => `${cap(p.fin)}, pero no ${q.fin}.`,
    formula: "p ∧ ¬q",
    wrong: ["¬(p ∧ q)", "p → ¬q", "¬p ∧ q", "p ∨ ¬q"],
    rule: "«A, pero B» es una conjunción (el «pero» solo añade contraste): A ∧ ¬B.",
  },
  {
    id: "si-entonces-o",
    levels: ["medio", "avanzado"],
    atoms: 3,
    sentence: (p, q, r) => `Si ${p.fin}, entonces ${q.fin} o ${r.fin}.`,
    formula: "p → (q ∨ r)",
    wrong: ["(p → q) ∧ r", "(q ∨ r) → p", "p → (q ∧ r)", "(p ∧ q) ∨ r"],
    rule: "«Si A, entonces B o C»: el consecuente es la disyunción entera: A → (B ∨ C).",
  },
  {
    id: "ni-ni-salvo",
    levels: ["avanzado"],
    atoms: 3,
    sentence: (p, q, r) => `Si no ${r.fin}, ni ${p.fin} ni ${q.fin}.`,
    formula: "¬r → (¬p ∧ ¬q)",
    wrong: ["¬r → ¬(p ∧ q)", "(¬p ∧ ¬q) → ¬r", "r → (p ∨ q)", "¬r ∧ ¬p ∧ ¬q"],
    rule: "«Si no C, ni A ni B»: el antecedente es ¬C y el consecuente, «ni A ni B» = ¬A ∧ ¬B.",
  },
];

const PATTERN_BY_ID = new Map(FORMALIZE_PATTERNS.map((p) => [p.id, p]));
export const formalizePattern = (id: string): Pattern => PATTERN_BY_ID.get(id) ?? fail(`patrón desconocido: ${id}`);

export type LogicFormalizeInstance = { pattern: string; atoms: string[]; options: string[] };

/** La frase del ejercicio. */
export function formalizeSentence(x: LogicFormalizeInstance): string {
  const [p, q, r] = x.atoms.map(atom);
  return formalizePattern(x.pattern).sentence(p!, q!, r ?? p!);
}

/** La fórmula buena (con p, q, r). */
export const formalizeTarget = (x: LogicFormalizeInstance): string => formalizePattern(x.pattern).formula;

/** ¿La fórmula escrita es equivalente a la buena? (null si no se lee o usa otras letras.) */
/**
 * En «Formalizar» las letras son p, q y r: una «v» suelta (p v q, (p)v(q)) solo puede ser el «o» que
 * se escribe a mano, y se lee como ∨. Una v pegada a otras letras (pvq) no se toca: es un nombre, y el
 * aviso de las letras sugiere ∨ o |.
 */
export function readFormalizeInput(text: string): string {
  return text.replace(/(?<![A-Za-z0-9_])[vV](?![A-Za-z0-9_])/g, "∨");
}

export function formalizeMatches(text: string, x: LogicFormalizeInstance): boolean | null {
  const r = parseFormula(text);
  if (!r.ok) return null;
  const target = parseFormula(formalizeTarget(x));
  if (!target.ok) fail("fórmula del patrón ilegible");
  const c = compareFormulas(r.ast, target.ast);
  if (!c.ok) return false;
  if (c.onlyA.length > 0) return null;
  return c.equivalent;
}

export function formalizeOptionsFor(r: Rng, pattern: Pattern): string[] {
  const t = parseFormula(pattern.formula);
  if (!t.ok) fail(`patrón ilegible: ${pattern.id}`);
  const wrong = pattern.wrong.filter((w) => {
    const a = parseFormula(w);
    if (!a.ok) fail(`distractor ilegible: ${w}`);
    const c = compareFormulas(a.ast, t.ast);
    return c.ok && !c.equivalent;
  });
  return r.shuffle([toPlain(t.ast), ...r.shuffle(wrong).slice(0, 3).map((w) => toPlain(astOf(w)))]);
}
const astOf = (s: string) => {
  const r = parseFormula(s);
  if (!r.ok) fail(`ilegible: ${s}`);
  return r.ast;
};

export const LOGIC_FORMALIZE: ExerciseType<LogicFormalizeInstance> = {
  id: "logica-formalizar",
  topic: "logica",
  title: "Formalizar un enunciado",
  description: "Traduce una frase con «es suficiente», «es necesario», «solo si», «si y solo si», «a menos que», «ni… ni…» o «no es cierto que» a una fórmula con p, q y r: elígela entre cuatro o escríbela.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    const r = rngFor("logica-formalizar", seed);
    const pattern = r.pick(FORMALIZE_PATTERNS.filter((p) => p.levels.includes(level)));
    const atoms = r.shuffle(ATOMS).slice(0, pattern.atoms).map((a) => a.id);
    return { pattern: pattern.id, atoms, options: formalizeOptionsFor(r, pattern) };
  },
};

// ---------------------------------------------------------------- Negar en lenguaje natural

export type PredNegateNLInstance = { sentence: string; formula: string; legend: string; options: NegationOption[] };

export const PRED_NEGATE_NL: ExerciseType<PredNegateNLInstance> = {
  id: "predicados-negar-frase",
  topic: "predicados",
  title: "Negar en lenguaje natural",
  description: "Elige, entre cuatro, la negación correcta de una frase con «todos», «alguno», «nadie» o «hay alguien que…»: cuidado con negar solo el predicado o dejar el cuantificador.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("predicados-negar-frase", seed),
      (r) => negationOf(r, level),
      () => true,
    );
  },
};

// ---------------------------------------------------------------- Conjuntos numéricos

export const NUMBER_SETS = ["N", "Z", "Q", "R"] as const;
export type NumberSet = (typeof NUMBER_SETS)[number];
export const SET_TEX: Record<NumberSet, string> = { N: "\\mathbb{N}", Z: "\\mathbb{Z}", Q: "\\mathbb{Q}", R: "\\mathbb{R}" };
export const SET_TEXT: Record<NumberSet, string> = { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ" };

/**
 * Una familia de enunciados sobre un conjunto A: su TeX (con A), su lectura y su valor en ℕ = {1, 2, 3,
 * …}, ℤ, ℚ y ℝ, con el porqué. Los parámetros (c, k) son enteros ≥ 2 elegidos por el generador.
 */
export interface NumberFamily {
  id: string;
  levels: readonly ExerciseLevel[];
  tex: (c: number) => string;
  text: (c: number) => string;
  truth: Record<NumberSet, boolean>;
  why: (c: number) => Record<NumberSet, string>;
}

export const NUMBER_FAMILIES: readonly NumberFamily[] = [
  {
    id: "cubo",
    levels: ["medio", "avanzado"],
    tex: () => "\\forall y \\in A\\ \\exists x \\in A : y = x^3",
    text: () => "para todo y de A existe x de A con y = x³",
    truth: { N: false, Z: false, Q: false, R: true },
    why: () => ({
      N: "y = 2 no es el cubo de ningún natural (1³ = 1, 2³ = 8).",
      Z: "y = 2 no es el cubo de ningún entero.",
      Q: "∛2 es irracional: y = 2 no es el cubo de ningún racional.",
      R: "Todo real tiene raíz cúbica real: x = ∛y.",
    }),
  },
  {
    id: "suma",
    levels: ["básico", "medio"],
    tex: (c) => `\\forall y \\in A\\ \\exists x \\in A : y = x + ${c}`,
    text: (c) => `para todo y de A existe x de A con y = x + ${c}`,
    truth: { N: false, Z: true, Q: true, R: true },
    why: (c) => ({
      N: `Con y = 1 haría falta x = ${1 - c}, que no es natural.`,
      Z: `x = y − ${c} es entero.`,
      Q: `x = y − ${c} es racional.`,
      R: `x = y − ${c} es real.`,
    }),
  },
  {
    id: "producto",
    levels: ["básico", "medio", "avanzado"],
    tex: (c) => `\\forall y \\in A\\ \\exists x \\in A : y = ${c}x`,
    text: (c) => `para todo y de A existe x de A con y = ${c}x`,
    truth: { N: false, Z: false, Q: true, R: true },
    why: (c) => ({
      N: `Con y = 1 haría falta x = 1/${c}, que no es natural.`,
      Z: `Con y = 1 haría falta x = 1/${c}, que no es entero.`,
      Q: `x = y/${c} es racional.`,
      R: `x = y/${c} es real.`,
    }),
  },
  {
    id: "inverso-cubo",
    levels: ["avanzado"],
    tex: () => "\\forall x \\in A\\ \\exists y \\in A : (x^2 + 1)\\,y^3 = 1",
    text: () => "para todo x de A existe y de A con (x² + 1)·y³ = 1",
    truth: { N: false, Z: false, Q: false, R: true },
    why: () => ({
      N: "Con x = 1 haría falta y³ = 1/2: ningún natural.",
      Z: "Con x = 1 haría falta y³ = 1/2: ningún entero.",
      Q: "Con x = 1 haría falta y³ = 1/2, e y = 1/∛2 es irracional.",
      R: "y = 1/∛(x² + 1) es real (x² + 1 > 0).",
    }),
  },
  {
    id: "inverso",
    levels: ["medio", "avanzado"],
    tex: () => "\\forall x \\in A\\ \\exists y \\in A : (x^2 + 1)\\,y = 1",
    text: () => "para todo x de A existe y de A con (x² + 1)·y = 1",
    truth: { N: false, Z: false, Q: true, R: true },
    why: () => ({
      N: "Con x = 1 haría falta y = 1/2: no es natural.",
      Z: "Con x = 1 haría falta y = 1/2: no es entero.",
      Q: "y = 1/(x² + 1) es racional si x lo es.",
      R: "y = 1/(x² + 1) es real (x² + 1 > 0).",
    }),
  },
  {
    id: "menor",
    levels: ["básico", "medio"],
    tex: () => "\\forall x \\in A\\ \\exists y \\in A : y < x",
    text: () => "para todo x de A existe y de A con y < x",
    truth: { N: false, Z: true, Q: true, R: true },
    why: () => ({
      N: "x = 1 es el menor natural: no hay ninguno por debajo.",
      Z: "y = x − 1 es entero y menor.",
      Q: "y = x − 1 es racional y menor.",
      R: "y = x − 1 es real y menor.",
    }),
  },
  {
    id: "minimo",
    levels: ["medio", "avanzado"],
    tex: () => "\\exists x \\in A\\ \\forall y \\in A : x \\le y",
    text: () => "existe x de A con x ≤ y para todo y de A",
    truth: { N: true, Z: false, Q: false, R: false },
    why: () => ({
      N: "x = 1 es menor o igual que cualquier natural.",
      Z: "Para cualquier x, x − 1 es un entero menor: no hay mínimo.",
      Q: "Para cualquier x, x − 1 es un racional menor: no hay mínimo.",
      R: "Para cualquier x, x − 1 es un real menor: no hay mínimo.",
    }),
  },
  {
    id: "densidad",
    levels: ["avanzado"],
    tex: () => "\\forall x, y \\in A\\ \\big(x < y \\rightarrow \\exists z \\in A : x < z < y\\big)",
    text: () => "entre dos elementos distintos de A siempre hay otro de A",
    truth: { N: false, Z: false, Q: true, R: true },
    why: () => ({
      N: "Entre 1 y 2 no hay ningún natural.",
      Z: "Entre 1 y 2 no hay ningún entero.",
      Q: "z = (x + y)/2 es racional y está entre los dos.",
      R: "z = (x + y)/2 es real y está entre los dos.",
    }),
  },
  {
    id: "raiz-dos",
    levels: ["básico", "medio"],
    tex: (c) => `\\exists x \\in A : x^2 = ${c}`,
    text: (c) => `existe x de A con x² = ${c}`,
    truth: { N: false, Z: false, Q: false, R: true },
    why: (c) => ({
      N: `√${c} no es natural.`,
      Z: `√${c} no es entero.`,
      Q: `√${c} es irracional (${c} no es un cuadrado perfecto).`,
      R: `x = √${c} es real.`,
    }),
  },
  {
    id: "opuesto",
    levels: ["básico"],
    tex: (c) => `\\exists x \\in A : x + ${c} = 0`,
    text: (c) => `existe x de A con x + ${c} = 0`,
    truth: { N: false, Z: true, Q: true, R: true },
    why: (c) => ({ N: `x = −${c} no es natural.`, Z: `x = −${c} es entero.`, Q: `x = −${c} es racional.`, R: `x = −${c} es real.` }),
  },
  {
    id: "fraccion",
    levels: ["básico", "medio"],
    tex: (c) => `\\exists x \\in A : ${c}x = 1`,
    text: (c) => `existe x de A con ${c}x = 1`,
    truth: { N: false, Z: false, Q: true, R: true },
    why: (c) => ({ N: `x = 1/${c} no es natural.`, Z: `x = 1/${c} no es entero.`, Q: `x = 1/${c} es racional.`, R: `x = 1/${c} es real.` }),
  },
];

const FAMILY_BY_ID = new Map(NUMBER_FAMILIES.map((f) => [f.id, f]));
export const numberFamily = (id: string): NumberFamily => FAMILY_BY_ID.get(id) ?? fail(`familia desconocida: ${id}`);

/** Un subconjunto de {ℕ, ℤ, ℚ, ℝ} como opción: «Solo en ℝ», «En ℚ y en ℝ», «En ninguno». */
export function setsText(sets: readonly NumberSet[]): string {
  const names = NUMBER_SETS.filter((s) => sets.includes(s)).map((s) => SET_TEXT[s]);
  if (names.length === 0) return "En ninguno de los cuatro";
  if (names.length === 4) return "En los cuatro";
  if (names.length === 1) return `Solo en ${names[0]}`;
  return `En ${names.slice(0, -1).join(", ")} y ${names.at(-1)}, y en ningún otro`;
}

export type PredNumbersInstance =
  /** ¿En qué conjuntos es verdadero? Cuatro opciones, cada una un subconjunto. */
  | { kind: "conjuntos"; family: string; c: number; options: NumberSet[][] }
  /** Divisibilidad en ℤ: p(x, y) ≡ ∃k ∈ ℤ : y = k·x. ¿Cuál de estas instancias es verdadera? */
  | { kind: "divide"; pairs: Array<[number, number]> };

/** p(x, y) ≡ ∃k ∈ ℤ : y = k·x (x divide a y; con x = 0, solo si y = 0). */
export const divides = (x: number, y: number): boolean => (x === 0 ? y === 0 : y % x === 0);

export const truthSets = (f: NumberFamily): NumberSet[] => NUMBER_SETS.filter((s) => f.truth[s]);

const sameSets = (a: readonly NumberSet[], b: readonly NumberSet[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Subconjuntos verosímiles de {ℕ, ℤ, ℚ, ℝ} (los «de abajo arriba» y algunos sueltos). */
const SET_CHOICES: NumberSet[][] = [["R"], ["Q", "R"], ["Z", "Q", "R"], ["N", "Z", "Q", "R"], [], ["N"], ["N", "Z"], ["Q"]];

function numbersTemplate(r: Rng, level: ExerciseLevel): PredNumbersInstance {
  if (level !== "básico" && r.chance(0.3)) {
    const pool: Array<[number, number]> = [];
    while (pool.length < 4) {
      const x = r.pick([0, 1, -1, 2, 3, 4, 5, 6, -3, 7]);
      const y = r.pick([0, 6, 12, -12, 7, 9, 10, 15, 5, 1]);
      if (!pool.some(([a, b]) => a === x && b === y)) pool.push([x, y]);
    }
    return { kind: "divide", pairs: pool };
  }
  const family = r.pick(NUMBER_FAMILIES.filter((f) => f.levels.includes(level)));
  const c = family.id === "raiz-dos" ? r.pick([2, 3, 5, 6, 7]) : r.int(2, 9);
  const truth = truthSets(family);
  const wrong = r.shuffle(SET_CHOICES.filter((s) => !sameSets(s, truth))).slice(0, 3);
  return { kind: "conjuntos", family: family.id, c, options: r.shuffle([truth, ...wrong]) };
}

export const PRED_NUMBERS: ExerciseType<PredNumbersInstance> = {
  id: "predicados-conjuntos-numericos",
  topic: "predicados",
  title: "Predicados sobre conjuntos numéricos",
  description: "Decide en cuáles de ℕ, ℤ, ℚ y ℝ es verdadero un enunciado con ∀ y ∃ (cubos, raíces, inversos, densidad, mínimo…), o qué instancia de «x divide a y» es verdadera.",
  levels: ALL_LEVELS,
  generate(seed, level) {
    return generateUntil(
      rngFor("predicados-conjuntos-numericos", seed),
      (r) => numbersTemplate(r, level),
      (x) => x.kind === "conjuntos" || x.pairs.filter(([a, b]) => divides(a, b)).length === 1,
    );
  },
};

export const LOGIC_EXTRA_EXERCISES = [LOGIC_FORMALIZE] as const;
export const PRED_EXTRA_EXERCISES = [PRED_NEGATE_NL, PRED_NUMBERS] as const;
