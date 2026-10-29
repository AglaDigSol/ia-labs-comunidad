// Ejercicios de conjuntos: expresiones para sombrear en el diagrama de Venn, igualdades (verdaderas por
// leyes conocidas o falsas por errores habituales), problemas de inclusión–exclusión con datos
// coherentes y conjuntos de partes o productos cartesianos. Se generan con semilla; las regiones, la
// igualdad, la solución de los recuentos (solveRegions) y las listas los calculan los motores de
// shared/sets/ al resolver.
import { solveRegions } from "../sets/cardinal.ts";
import {
  compareSetExprs,
  normalizeSet,
  parseSetExpr,
  regionCount,
  scomp,
  sdiff,
  sempty,
  setKey,
  setRegions,
  setToPlain,
  setVars,
  sinter,
  sset,
  ssym,
  sunion,
  type SetExpr,
  type SetName,
} from "../sets/expr.ts";
import type { SetsCardinalProblem } from "../sets/schema.ts";
import { generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

type Op = "union" | "inter" | "diff" | "sym";

/** ¿Algo que hace pobre el enunciado? Operandos repetidos, X junto a Xᶜ, X ∖ X, X Δ X o Xᶜᶜ. */
export function setRedundant(e: SetExpr): boolean {
  switch (e.k) {
    case "set":
    case "empty":
    case "universe":
      return false;
    case "comp":
      return e.a.k === "comp" || setRedundant(e.a);
    case "diff":
    case "sym":
      return setKey(e.a) === setKey(e.b) || setRedundant(e.a) || setRedundant(e.b);
    default: {
      const keys = e.args.map(setKey);
      if (new Set(keys).size < keys.length) return true;
      if (e.args.some((a) => a.k === "comp" && keys.includes(setKey(a.a)))) return true;
      return e.args.some(setRedundant);
    }
  }
}

/** Expresión al azar con `ops` operaciones binarias sobre `vars`. */
export function randomSetExpr(rng: Rng, vars: readonly SetName[], ops: number, allowed: readonly Op[], compoundComp: boolean): SetExpr {
  const build = (k: number): SetExpr => {
    if (k === 0) {
      const leaf = sset(rng.pick(vars));
      return rng.chance(0.2) ? scomp(leaf) : leaf;
    }
    const left = rng.int(0, k - 1);
    const a = build(left);
    const b = build(k - 1 - left);
    const op = rng.pick(allowed);
    const node: SetExpr = op === "union" || op === "inter" ? { k: op, args: [a, b] } : { k: op, a, b };
    return compoundComp && rng.chance(0.15) ? scomp(node) : node;
  };
  return normalizeSet(build(ops));
}

// ---------------------------------------------------------------- Sombrear

export type SetExprInstance = { expr: string };

const VENN_LIMITS: Record<ExerciseLevel, { vars: SetName[]; ops: [number, number]; allowed: Op[]; compoundComp: boolean }> = {
  básico: { vars: ["A", "B"], ops: [1, 2], allowed: ["union", "inter", "diff"], compoundComp: false },
  medio: { vars: ["A", "B", "C"], ops: [2, 2], allowed: ["union", "inter", "diff", "sym"], compoundComp: false },
  avanzado: { vars: ["A", "B", "C"], ops: [3, 3], allowed: ["union", "inter", "diff", "sym"], compoundComp: true },
};

export const SETS_VENN: ExerciseType<SetExprInstance> = {
  id: "conjuntos-venn",
  topic: "conjuntos",
  title: "Sombrear en el diagrama de Venn",
  description: "Marca en el diagrama las regiones que forman una expresión de conjuntos.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const { vars, ops, allowed, compoundComp } = VENN_LIMITS[level];
    const e = generateUntil(
      rngFor("conjuntos-venn", seed),
      (r) => randomSetExpr(r, vars, r.int(ops[0], ops[1]), allowed, compoundComp),
      (x) => {
        if (setVars(x).length !== vars.length || setRedundant(x)) return false;
        // Ni vacía ni todo el universo.
        const regions = setRegions(x, vars);
        return regions.some(Boolean) && !regions.every(Boolean);
      },
    );
    return { expr: setToPlain(normalizeSet(e)) };
  },
};

// ---------------------------------------------------------------- Igualdades

export type SetPairInstance = { left: string; right: string };

type Template = (x: SetExpr, y: SetExpr, z: SetExpr) => [SetExpr, SetExpr];
const U = (...a: SetExpr[]) => sunion(...a);
const I = (...a: SetExpr[]) => sinter(...a);
const C = (a: SetExpr): SetExpr => (a.k === "comp" ? a.a : scomp(a));

/** Igualdades que salen de las leyes (De Morgan, diferencia, distributivas, absorción…), por nivel. */
const EQUAL: Record<ExerciseLevel, Template[]> = {
  básico: [
    (x, y) => [C(U(x, y)), I(C(x), C(y))],
    (x, y) => [C(I(x, y)), U(C(x), C(y))],
    (x, y) => [sdiff(x, y), I(x, C(y))],
    (x, y) => [I(x, U(x, y)), x],
    (x, y) => [U(x, I(x, y)), x],
  ],
  medio: [
    (x, y, z) => [I(x, U(y, z)), U(I(x, y), I(x, z))],
    (x, y, z) => [U(x, I(y, z)), I(U(x, y), U(x, z))],
    (x, y, z) => [sdiff(x, U(y, z)), I(sdiff(x, y), sdiff(x, z))],
    (x, y, z) => [sdiff(x, I(y, z)), U(sdiff(x, y), sdiff(x, z))],
    (x, y) => [U(x, I(C(x), y)), U(x, y)],
    (x, y) => [C(sdiff(x, y)), U(C(x), y)],
  ],
  avanzado: [
    (x, y) => [ssym(x, y), sdiff(U(x, y), I(x, y))],
    (x, y) => [U(sdiff(x, y), I(x, y)), x],
    (x, y, z) => [I(sdiff(x, y), z), sdiff(I(x, z), y)],
    (x, y) => [I(x, sdiff(y, x)), sempty],
    (x, y, z) => [sdiff(U(x, y), z), U(sdiff(x, z), sdiff(y, z))],
    (x, y) => [C(U(C(x), y)), sdiff(x, y)],
  ],
};

/** Errores habituales: parecen leyes y en general no son igualdades. */
const NOT_EQUAL: Template[] = [
  (x, y) => [sdiff(x, y), sdiff(y, x)],
  (x, y) => [C(U(x, y)), U(C(x), C(y))],
  (x, y) => [C(I(x, y)), I(C(x), C(y))],
  (x, y, z) => [sdiff(x, U(y, z)), U(sdiff(x, y), z)],
  (x, y, z) => [I(x, U(y, z)), U(I(x, y), z)],
  (x, y, z) => [U(x, sdiff(y, z)), sdiff(U(x, y), z)],
  (x, y) => [ssym(x, y), U(x, y)],
  (x, y, z) => [sdiff(x, sdiff(y, z)), sdiff(sdiff(x, y), z)],
  (x, y) => [sdiff(x, y), I(C(x), y)],
];

/** X, Y, Z: conjuntos distintos; desde el nivel medio, alguno complementado. */
function setPieces(rng: Rng, level: ExerciseLevel): [SetExpr, SetExpr, SetExpr] {
  const names = rng.shuffle(["A", "B", "C"] as SetName[]);
  const p = level === "básico" ? 0 : level === "medio" ? 0.2 : 0.3;
  return names.map((n) => (rng.chance(p) ? scomp(sset(n)) : sset(n))) as [SetExpr, SetExpr, SetExpr];
}

const pairOk = (a: SetExpr, b: SetExpr, want: boolean) =>
  setKey(normalizeSet(a)) !== setKey(normalizeSet(b)) && !setRedundant(normalizeSet(b)) && compareSetExprs(a, b).equal === want;

export const SETS_EQUAL: ExerciseType<SetPairInstance> = {
  id: "conjuntos-iguales",
  topic: "conjuntos",
  title: "¿Son iguales?",
  description: "Decide si dos expresiones de conjuntos son iguales; si no lo son, mira la región donde difieren.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("conjuntos-iguales", seed);
    const want = rng.chance(0.5);
    const pair = generateUntil(
      rng,
      (r) => {
        const [x, y, z] = setPieces(r, level);
        const [a, b] = r.pick(want ? EQUAL[level] : NOT_EQUAL)(x, y, z);
        return r.chance(0.5) ? { a, b } : { a: b, b: a };
      },
      ({ a, b }) => pairOk(a, b, want) && !setRedundant(normalizeSet(a)),
    );
    return { left: setToPlain(normalizeSet(pair.a)), right: setToPlain(normalizeSet(pair.b)) };
  },
};

export const SETS_PROOF: ExerciseType<SetPairInstance> = {
  id: "conjuntos-demostrar",
  topic: "conjuntos",
  title: "Demostrar una igualdad paso a paso",
  description: "Parte del lado izquierdo y aplica una ley en cada paso hasta llegar al derecho.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const pair = generateUntil(
      rngFor("conjuntos-demostrar", seed),
      (r) => {
        const [x, y, z] = setPieces(r, level);
        // Se parte del lado más largo: el que hay que transformar.
        const [a, b] = r.pick(EQUAL[level])(x, y, z);
        return setToPlain(a).length >= setToPlain(b).length ? { a, b } : { a: b, b: a };
      },
      ({ a, b }) => pairOk(a, b, true) && !setRedundant(normalizeSet(a)),
    );
    return { left: setToPlain(normalizeSet(pair.a)), right: setToPlain(normalizeSet(pair.b)) };
  },
};

// ---------------------------------------------------------------- Inclusión–exclusión

/** Contextos de los problemas (de elaboración propia). Cada uno nombra lo que es cada conjunto. */
const THEMES: Array<{ title: string; story: (u: number) => string; who: string; ask: string; sets: [string, string, string] }> = [
  {
    title: "Lenguajes de un grupo",
    story: (u) => `En un grupo de ${u} estudiantes del máster se pregunta qué lenguajes usan en sus proyectos.`,
    who: "estudiantes",
    ask: "¿Cuántos estudiantes",
    sets: ["usan Python", "usan R", "usan Julia"],
  },
  {
    title: "Encuesta de medios",
    story: (u) => `En una encuesta a ${u} personas se pregunta cómo se informan.`,
    who: "personas",
    ask: "¿Cuántas personas",
    sets: ["leen prensa digital", "escuchan pódcast", "ven informativos"],
  },
  {
    title: "Fondo de una biblioteca",
    story: (u) => `Una biblioteca de departamento tiene ${u} libros.`,
    who: "libros",
    ask: "¿Cuántos libros",
    sets: ["están en inglés", "son de matemáticas", "tienen versión digital"],
  },
  {
    title: "Conjuntos de datos",
    story: (u) => `Un equipo revisa ${u} conjuntos de datos antes de entrenar sus modelos.`,
    who: "conjuntos de datos",
    ask: "¿Cuántos conjuntos de datos",
    sets: ["tienen valores perdidos", "tienen variables categóricas", "están desbalanceados"],
  },
  {
    title: "Material de clase",
    story: (u) => `En una clase de ${u} personas se pregunta qué dispositivos traen.`,
    who: "personas",
    ask: "¿Cuántas personas",
    sets: ["traen portátil", "traen tableta", "traen calculadora"],
  },
];

const parse = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(`expresión ilegible: ${s}`);
  return r.expr;
};

const BASE_DATA: Record<2 | 3, string[]> = {
  2: ["U", "A", "B"],
  3: ["U", "A", "B", "C", "A ∩ B", "A ∩ C", "B ∩ C"],
};
/** El dato que cierra el sistema (uno al azar). */
const CLOSING: Record<2 | 3, string[]> = {
  2: ["A ∩ B", "A ∪ B", "(A ∪ B)ᶜ"],
  3: ["A ∩ B ∩ C", "(A ∪ B ∪ C)ᶜ", "A ∪ B ∪ C"],
};
/** En el nivel avanzado, algunos datos se sustituyen por estos (si la solución sigue siendo única). */
const ALTERNATIVE: Record<2 | 3, string[]> = {
  2: ["A ∖ B", "B ∖ A", "A Δ B"],
  3: ["A ∪ B", "A ∪ C", "B ∪ C", "A ∖ (B ∪ C)", "B ∖ (A ∪ C)", "C ∖ (A ∪ B)", "(A ∩ B) ∖ C"],
};
const QUESTIONS: Record<2 | 3, Array<{ id: string; prompt: string; expr: string }>> = {
  2: [
    { id: "los-dos", prompt: "¿Cuántos están en A y en B?", expr: "A ∩ B" },
    { id: "solo-a", prompt: "¿Cuántos están en A pero no en B?", expr: "A ∖ B" },
    { id: "solo-b", prompt: "¿Cuántos están en B pero no en A?", expr: "B ∖ A" },
    { id: "exactamente-uno", prompt: "¿Cuántos están en exactamente uno de los dos?", expr: "A Δ B" },
    { id: "alguno", prompt: "¿Cuántos están en al menos uno?", expr: "A ∪ B" },
    { id: "ninguno", prompt: "¿Cuántos no están en ninguno?", expr: "(A ∪ B)ᶜ" },
  ],
  3: [
    { id: "los-tres", prompt: "¿Cuántos están en los tres?", expr: "A ∩ B ∩ C" },
    { id: "solo-a", prompt: "¿Cuántos están solo en A?", expr: "A ∖ (B ∪ C)" },
    { id: "solo-c", prompt: "¿Cuántos están solo en C?", expr: "C ∖ (A ∪ B)" },
    { id: "alguno", prompt: "¿Cuántos están en al menos uno?", expr: "A ∪ B ∪ C" },
    { id: "ninguno", prompt: "¿Cuántos no están en ninguno?", expr: "(A ∪ B ∪ C)ᶜ" },
    { id: "exactamente-dos", prompt: "¿Cuántos están en exactamente dos?", expr: "((A ∩ B) ∪ (A ∩ C) ∪ (B ∩ C)) ∖ (A ∩ B ∩ C)" },
    {
      id: "exactamente-uno",
      prompt: "¿Cuántos están en exactamente uno?",
      expr: "(A ∖ (B ∪ C)) ∪ (B ∖ (A ∪ C)) ∪ (C ∖ (A ∪ B))",
    },
  ],
};

export type SetsCardinalInstance = SetsCardinalProblem;

export const SETS_CARDINAL: ExerciseType<SetsCardinalInstance> = {
  id: "conjuntos-cardinal",
  topic: "conjuntos",
  title: "Inclusión–exclusión",
  description: "Rellena el diagrama de Venn de dentro hacia fuera a partir de los datos y contesta las preguntas.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("conjuntos-cardinal", seed);
    const n: 2 | 3 = level === "básico" ? 2 : 3;
    const vars = (["A", "B", "C"] as SetName[]).slice(0, n);
    const theme = rng.pick(THEMES);
    return generateUntil(rng, (r) => {
      // Cada región con al menos un elemento: así ninguna pregunta da 0 por la forma de los datos.
      const counts = Array.from({ length: regionCount(n) }, (_, reg) => (reg === 0 ? r.int(1, 12) : r.int(1, 15)));
      const value = (s: string) => counts.reduce((acc, c, reg) => (setRegions(parse(s), vars)[reg] ? acc + c : acc), 0);
      const exprs = [...BASE_DATA[n], r.pick(CLOSING[n])];
      if (level === "avanzado") {
        // Uno o dos datos (sin contar U) cambian por otros menos directos.
        for (let k = r.int(1, 2); k > 0; k--) exprs[r.int(1, exprs.length - 1)] = r.pick(ALTERNATIVE[n]);
      }
      if (new Set(exprs).size !== exprs.length) return null;
      const data = exprs.map((expr) => ({ expr, value: value(expr) }));
      const sol = solveRegions(vars, data.map((d) => ({ expr: parse(d.expr), value: d.value })));
      if (!sol.ok || sol.counts.some((c, i) => c !== counts[i])) return null;
      // Preguntas cuya respuesta no es un dato.
      const given = data.map((d) => setRegions(parse(d.expr), vars).join());
      const questions = r
        .shuffle(QUESTIONS[n].filter((q) => !given.includes(setRegions(parse(q.expr), vars).join())))
        .slice(0, 3);
      if (questions.length < 2) return null;
      const problem: SetsCardinalProblem = {
        id: `generado-${n}`,
        title: theme.title,
        story: `${theme.story(value("U"))} Los datos son el número de ${theme.who} de cada conjunto o combinación.`,
        sets: n === 2 ? { A: theme.sets[0], B: theme.sets[1] } : { A: theme.sets[0], B: theme.sets[1], C: theme.sets[2] },
        data,
        questions: questions.map((q) => ({ ...q, prompt: q.prompt.replace("¿Cuántos", theme.ask) })),
      };
      return problem;
    }, () => true);
  },
};

// ---------------------------------------------------------------- Partes y producto

export type SetsPartsInstance = { mode: "partes" | "producto"; a: string[]; b: string[] };

const PARTS_SIZES: Record<ExerciseLevel, { partes: number; producto: [number, number] }> = {
  básico: { partes: 2, producto: [2, 2] },
  medio: { partes: 3, producto: [2, 3] },
  avanzado: { partes: 4, producto: [3, 3] },
};

export const SETS_PARTS: ExerciseType<SetsPartsInstance> = {
  id: "conjuntos-partes",
  topic: "conjuntos",
  title: "Conjunto de partes y producto cartesiano",
  description: "Escribe 𝒫(A) o A × B por extensión y cuántos elementos tiene.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const rng = rngFor("conjuntos-partes", seed);
    const sizes = PARTS_SIZES[level];
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const take = (pool: string[], k: number) =>
      rng
        .shuffle(pool)
        .slice(0, k)
        .sort((x, y) => pool.indexOf(x) - pool.indexOf(y));
    if (rng.chance(0.5)) return { mode: "partes", a: take(rng.chance(0.5) ? letters : digits, sizes.partes), b: [] };
    const [p, q] = sizes.producto;
    // En el avanzado A y B comparten elementos: así se nota si un par está al revés.
    if (level === "avanzado") {
      const pool = take(digits, 4);
      return { mode: "producto", a: pool.slice(0, p), b: pool.slice(4 - q) };
    }
    return { mode: "producto", a: take(letters, p), b: take(digits, q) };
  },
};

export const SET_EXERCISES = [SETS_VENN, SETS_EQUAL, SETS_PROOF, SETS_CARDINAL, SETS_PARTS] as const;
