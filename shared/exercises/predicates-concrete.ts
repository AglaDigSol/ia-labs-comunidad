// «Cuantificadores en un conjunto concreto» (Lógica de predicados): enunciados con ∀ o ∃ sobre un
// conjunto pequeño de enteros escrito con llaves, A = {2, 3, 4, 5}, y propiedades de todos los días
// (primo, par, impar, múltiplo de k, divisor de n, cuadrado perfecto, positivo, mayor o menor que k).
// Dos modos:
// - «evaluar»: ¿es verdadero el enunciado en A? Si es un ∃ verdadero o un ∀ falso (sin anidar), se
//   pide además un testigo o un contraejemplo; vale cualquiera que funcione. En avanzado hay también
//   enunciados anidados sobre el mismo conjunto (∀x ∃y : y > x, ∃x ∀y : x ≤ y…).
// - «negar»: ¬[Q x ∈ A, cuerpo] y cuatro enunciados; uno es equivalente (cuantificador dual y cuerpo
//   negado con De Morgan o con ¬(p → q) ≡ p ∧ ¬q) y los otros son los errores típicos. Después, ¿es
//   verdadera la negación en A?
// La instancia solo lleva el enunciado: el valor de verdad, los testigos y qué opción es la negación
// se calculan aquí por fuerza bruta sobre los elementos (y, para la equivalencia, sobre muchos
// conjuntos).
import { pickHints, type TaggedHint } from "./hints.ts";
import { createRng, generateUntil, rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

export type Quant = "forall" | "exists";
export type PropKind = "primo" | "par" | "impar" | "multiplo" | "divisor" | "cuadrado" | "positivo" | "mayor" | "menor";
/** Una propiedad de un entero; `k` es el parámetro de múltiplo, divisor, mayor y menor. */
export type Prop = { kind: PropKind; k?: number };
export type Body = { kind: "atom"; prop: Prop } | { kind: "not"; arg: Body } | { kind: "and" | "or" | "imp"; left: Body; right: Body };
export type SimpleStatement = { kind: "simple"; q: Quant; body: Body };
/** Relaciones entre x e y de los enunciados anidados. */
export type RelKind = "gt" | "lt" | "le" | "ge" | "ne" | "opp";
export type NestedStatement = { kind: "nested"; outer: Quant; inner: Quant; rel: RelKind };
export type ConcreteStatement = SimpleStatement | NestedStatement;

export type PredConcreteInstance =
  | { mode: "evaluar"; set: number[]; statement: ConcreteStatement }
  | { mode: "negar"; set: number[]; statement: SimpleStatement; options: SimpleStatement[] };

// ---------------------------------------------------------------- Propiedades

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
const mod = (a: number, b: number) => ((a % b) + b) % b;

export function propHolds(p: Prop, n: number): boolean {
  const k = p.k ?? 0;
  switch (p.kind) {
    case "primo":
      return isPrime(n);
    case "par":
      return mod(n, 2) === 0;
    case "impar":
      return mod(n, 2) === 1;
    case "multiplo":
      return mod(n, k) === 0;
    case "divisor":
      return n !== 0 && mod(k, n) === 0;
    case "cuadrado":
      return isSquare(n);
    case "positivo":
      return n > 0;
    case "mayor":
      return n > k;
    case "menor":
      return n < k;
  }
}

export function bodyHolds(b: Body, n: number): boolean {
  switch (b.kind) {
    case "atom":
      return propHolds(b.prop, n);
    case "not":
      return !bodyHolds(b.arg, n);
    case "and":
      return bodyHolds(b.left, n) && bodyHolds(b.right, n);
    case "or":
      return bodyHolds(b.left, n) || bodyHolds(b.right, n);
    case "imp":
      return !bodyHolds(b.left, n) || bodyHolds(b.right, n);
  }
}

export function relHolds(r: RelKind, x: number, y: number): boolean {
  switch (r) {
    case "gt":
      return y > x;
    case "lt":
      return y < x;
    case "le":
      return x <= y;
    case "ge":
      return x >= y;
    case "ne":
      return x !== y;
    case "opp":
      return x + y === 0;
  }
}

const quantify = (q: Quant, set: readonly number[], f: (n: number) => boolean) => (q === "forall" ? set.every(f) : set.some(f));

/** Valor de verdad del enunciado en el conjunto (recorriendo todos los elementos). */
export function truthIn(s: ConcreteStatement, set: readonly number[]): boolean {
  if (s.kind === "simple") return quantify(s.q, set, (x) => bodyHolds(s.body, x));
  return quantify(s.outer, set, (x) => quantify(s.inner, set, (y) => relHolds(s.rel, x, y)));
}

/** El enunciado del que se pregunta si es verdadero: el del ejercicio o, al negar, su negación correcta. */
export const askedStatement = (inst: PredConcreteInstance): ConcreteStatement => (inst.mode === "evaluar" ? inst.statement : correctNegation(inst.statement));

/** ¿Hace falta un testigo (∃ verdadero) o un contraejemplo (∀ falso)? Solo sin anidar. */
export const needsWitness = (s: ConcreteStatement, value: boolean): s is SimpleStatement => s.kind === "simple" && (s.q === "exists" ? value : !value);

/** Elementos que sirven: los que cumplen el cuerpo (∃) o los que no lo cumplen (∀). */
export function validWitnesses(s: SimpleStatement, set: readonly number[]): number[] {
  return set.filter((x) => bodyHolds(s.body, x) === (s.q === "exists"));
}

// ---------------------------------------------------------------- Escritura

/** Un entero con el signo menos tipográfico. */
export const numText = (n: number) => (n < 0 ? `−${-n}` : String(n));
export const setText = (set: readonly number[]) => `{${set.map(numText).join(", ")}}`;
export const setTex = (set: readonly number[]) => `\\{${set.join(", ")}\\}`;

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (n: number) => [...String(n)].map((d) => SUB[Number(d)]).join("");

const NAMES: Record<Exclude<PropKind, "mayor" | "menor">, string> = {
  primo: "primo",
  par: "par",
  impar: "impar",
  multiplo: "múltiplo",
  divisor: "divisor",
  cuadrado: "cuadrado",
  positivo: "positivo",
};

const isComparison = (p: Prop) => p.kind === "mayor" || p.kind === "menor";

function propText(p: Prop, v: string): string {
  if (p.kind === "mayor") return `${v} > ${numText(p.k!)}`;
  if (p.kind === "menor") return `${v} < ${numText(p.k!)}`;
  const k = p.kind === "multiplo" || p.kind === "divisor" ? subscript(p.k!) : "";
  return `${NAMES[p.kind]}${k}(${v})`;
}
function propTex(p: Prop, v: string): string {
  if (p.kind === "mayor") return `${v} > ${p.k}`;
  if (p.kind === "menor") return `${v} < ${p.k}`;
  const k = p.kind === "multiplo" || p.kind === "divisor" ? `_{${p.k}}` : "";
  return `\\text{${NAMES[p.kind]}}${k}(${v})`;
}

const OP_TEXT = { and: "∧", or: "∨", imp: "→" } as const;
const OP_TEX = { and: "\\land", or: "\\lor", imp: "\\to" } as const;

export function bodyText(b: Body, v = "x"): string {
  switch (b.kind) {
    case "atom":
      return propText(b.prop, v);
    case "not":
      return b.arg.kind === "atom" && !isComparison(b.arg.prop) ? `¬${bodyText(b.arg, v)}` : `¬(${bodyText(b.arg, v)})`;
    default: {
      const side = (x: Body) => (x.kind === "and" || x.kind === "or" || x.kind === "imp" ? `(${bodyText(x, v)})` : bodyText(x, v));
      return `${side(b.left)} ${OP_TEXT[b.kind]} ${side(b.right)}`;
    }
  }
}
export function bodyTex(b: Body, v = "x"): string {
  switch (b.kind) {
    case "atom":
      return propTex(b.prop, v);
    case "not":
      return b.arg.kind === "atom" && !isComparison(b.arg.prop) ? `\\lnot ${bodyTex(b.arg, v)}` : `\\lnot(${bodyTex(b.arg, v)})`;
    default: {
      const side = (x: Body) => (x.kind === "and" || x.kind === "or" || x.kind === "imp" ? `(${bodyTex(x, v)})` : bodyTex(x, v));
      return `${side(b.left)} ${OP_TEX[b.kind]} ${side(b.right)}`;
    }
  }
}

const isBinary = (b: Body) => b.kind === "and" || b.kind === "or" || b.kind === "imp";
const prefixText = (q: Quant, v: string) => (q === "forall" ? `∀${v} ∈ A, ` : `∃${v} ∈ A : `);
const prefixTex = (q: Quant, v: string) => (q === "forall" ? `\\forall ${v} \\in A,\\ ` : `\\exists ${v} \\in A : `);

const REL_TEXT: Record<RelKind, string> = { gt: "y > x", lt: "y < x", le: "x ≤ y", ge: "x ≥ y", ne: "x ≠ y", opp: "x + y = 0" };
const REL_TEX: Record<RelKind, string> = { gt: "y > x", lt: "y < x", le: "x \\le y", ge: "x \\ge y", ne: "x \\neq y", opp: "x + y = 0" };

/** «∃x ∈ A : primo(x) ∧ par(x)», «∀x ∈ A, ∃y ∈ A : y > x». */
export function statementText(s: ConcreteStatement): string {
  if (s.kind === "nested") return `${prefixText(s.outer, "x")}${prefixText(s.inner, "y")}${REL_TEXT[s.rel]}`;
  const b = bodyText(s.body);
  return `${prefixText(s.q, "x")}${isBinary(s.body) ? `(${b})` : b}`;
}
export function statementTex(s: ConcreteStatement): string {
  if (s.kind === "nested") return `${prefixTex(s.outer, "x")}${prefixTex(s.inner, "y")}${REL_TEX[s.rel]}`;
  const b = bodyTex(s.body);
  return `${prefixTex(s.q, "x")}${isBinary(s.body) ? `(${b})` : b}`;
}
export const negatedText = (s: ConcreteStatement) => `¬[${statementText(s)}]`;
export const negatedTex = (s: ConcreteStatement) => `\\lnot\\left[${statementTex(s)}\\right]`;

/** Lectura de una fórmula para lectores de pantalla (los símbolos, en palabras). */
export function spoken(text: string): string {
  return text
    .replace(/¬\[/g, "no es cierto que [")
    .replace(/∀(\w) ∈ A,/g, "para todo $1 de A,")
    .replace(/∃(\w) ∈ A :/g, "existe $1 de A tal que")
    .replace(/¬/g, "no ")
    .replace(/∧/g, "y")
    .replace(/∨/g, "o")
    .replace(/→/g, "implica")
    .replace(/≤/g, "menor o igual que")
    .replace(/≥/g, "mayor o igual que")
    .replace(/≠/g, "distinto de")
    .replace(/</g, "menor que")
    .replace(/>/g, "mayor que")
    .replace(/[₀-₉]+/g, (m) => ` ${[...m].map((c) => SUB.indexOf(c)).join("")}`);
}

/** Propiedades con nombre de un cuerpo, en orden y sin repetir. */
export function propsOf(b: Body, out: Prop[] = []): Prop[] {
  if (b.kind === "atom") {
    if (!out.some((p) => p.kind === b.prop.kind && p.k === b.prop.k)) out.push(b.prop);
  } else if (b.kind === "not") propsOf(b.arg, out);
  else {
    propsOf(b.left, out);
    propsOf(b.right, out);
  }
  return out;
}

function propMeaning(p: Prop): string {
  switch (p.kind) {
    case "primo":
      return "x es primo";
    case "par":
      return "x es par";
    case "impar":
      return "x es impar";
    case "multiplo":
      return `x es múltiplo de ${numText(p.k!)}`;
    case "divisor":
      return `x es divisor de ${numText(p.k!)}`;
    case "cuadrado":
      return "x es un cuadrado perfecto";
    case "positivo":
      return "x > 0";
    default:
      return "";
  }
}

/** Nomenclatura: «primo(x): x es primo», una línea por propiedad con nombre. */
export function nomenclature(s: ConcreteStatement): string[] {
  if (s.kind === "nested") return [];
  return propsOf(s.body)
    .filter((p) => !isComparison(p))
    .map((p) => `${propText(p, "x")}: ${propMeaning(p)}`);
}

/** «es primo» / «no es primo». */
function fact(p: Prop, n: number): string {
  const yes = propHolds(p, n);
  const k = p.k === undefined ? "" : numText(p.k);
  const what: Record<PropKind, string> = {
    primo: "primo",
    par: "par",
    impar: "impar",
    multiplo: `múltiplo de ${k}`,
    divisor: `divisor de ${k}`,
    cuadrado: "un cuadrado perfecto",
    positivo: "positivo",
    mayor: `mayor que ${k}`,
    menor: `menor que ${k}`,
  };
  return `${yes ? "es" : "no es"} ${what[p.kind]}`;
}

/** Por qué un elemento cumple o no el cuerpo: «3 es primo pero no es par, así que no cumple …». */
export function explainElement(b: Body, n: number): string {
  const props = propsOf(b);
  const facts = props.map((p) => fact(p, n));
  const joined = facts.length === 1 ? facts[0]! : `${facts[0]}${propHolds(props[0]!, n) === propHolds(props[1]!, n) ? " y " : " pero "}${facts[1]}`;
  const ok = bodyHolds(b, n);
  const vacuous = b.kind === "imp" && !bodyHolds(b.left, n) ? " (el antecedente no se cumple)" : "";
  return `${numText(n)} ${joined}, así que ${ok ? "cumple" : "no cumple"} ${bodyText(b)}${vacuous}.`;
}

/** Conclusión razonada del valor de verdad en A, con elementos concretos. */
export function conclusion(s: ConcreteStatement, set: readonly number[]): string {
  const value = truthIn(s, set);
  if (s.kind === "simple") {
    const w = validWitnesses(s, set);
    const body = bodyText(s.body);
    if (s.q === "exists") return value ? `Verdadero: por ejemplo, x = ${numText(w[0]!)} cumple ${body}.` : `Falso: ningún elemento de A cumple ${body}.`;
    return value ? `Verdadero: todos los elementos de A cumplen ${body}.` : `Falso: x = ${numText(w[0]!)} es un contraejemplo, no cumple ${body}.`;
  }
  const rel = REL_TEXT[s.rel];
  const rows = nestedRows(s, set);
  if (s.outer === "forall") {
    const bad = rows.find((r) => !r.ok);
    if (bad) return `Falso: con x = ${numText(bad.x)} ${s.inner === "exists" ? `ningún y de A cumple ${rel}` : `falla y = ${numText(bad.y!)}`}.`;
    return `Verdadero: para cada x de A ${s.inner === "exists" ? `hay un y de A con ${rel}` : `todos los y de A cumplen ${rel}`}.`;
  }
  const good = rows.find((r) => r.ok);
  if (good) return `Verdadero: x = ${numText(good.x)} sirve${s.inner === "exists" ? `, con y = ${numText(good.y!)}` : `, porque todos los y de A cumplen ${rel}`}.`;
  return `Falso: ningún x de A ${s.inner === "exists" ? `tiene un y de A con ${rel}` : `cumple ${rel} para todos los y de A`}.`;
}

/**
 * Para cada x de un enunciado anidado: si cumple lo de dentro (∃y o ∀y) y el y que lo muestra (un y
 * que cumple la relación con ∃y, o uno que falla con ∀y; null si no hay).
 */
export function nestedRows(s: NestedStatement, set: readonly number[]): Array<{ x: number; ok: boolean; y: number | null; ys: number[] }> {
  return set.map((x) => {
    const ys = set.filter((y) => relHolds(s.rel, x, y));
    if (s.inner === "exists") return { x, ok: ys.length > 0, y: ys[0] ?? null, ys };
    const bad = set.find((y) => !relHolds(s.rel, x, y));
    return { x, ok: bad === undefined, y: bad ?? null, ys };
  });
}

/** La relación de un enunciado anidado, en texto. */
export const relText = (r: RelKind) => REL_TEXT[r];

// ---------------------------------------------------------------- Testigos

export const MAX_WITNESS_TEXT = 12;

/** Lee un entero escrito a mano: «3», «-3», «−3». */
export function parseWitness(text: string): number | null {
  const t = text.trim().replace(/^[−-]/, "-");
  return /^-?\d{1,4}$/.test(t) ? Number(t) : null;
}

export type WitnessCheck = { ok: boolean; message: string };

/** ¿Sirve el elemento como testigo (∃) o contraejemplo (∀)? Con el porqué, con ese elemento. */
export function checkWitness(s: SimpleStatement, set: readonly number[], text: string): WitnessCheck {
  const role = s.q === "exists" ? "testigo" : "contraejemplo";
  const n = parseWitness(text);
  if (text.trim() === "") return { ok: false, message: `Escribe un elemento de A como ${role}.` };
  if (n === null) return { ok: false, message: "Escribe un número entero, como 3 o −2." };
  if (!set.includes(n)) return { ok: false, message: `${numText(n)} no está en A = ${setText(set)}: el ${role} tiene que ser un elemento de A.` };
  const ok = bodyHolds(s.body, n) === (s.q === "exists");
  return { ok, message: ok ? explainElement(s.body, n) : `${explainElement(s.body, n)} No sirve de ${role}.` };
}

// ---------------------------------------------------------------- Negación

const dual = (q: Quant): Quant => (q === "forall" ? "exists" : "forall");
const notB = (b: Body): Body => (b.kind === "not" ? b.arg : { kind: "not", arg: b });

/** ¬cuerpo con la negación llevada hasta las propiedades (De Morgan, ¬(p → q) ≡ p ∧ ¬q, ¬¬p ≡ p). */
export function negateBody(b: Body): Body {
  switch (b.kind) {
    case "atom":
      return notB(b);
    case "not":
      return b.arg;
    case "and":
      return { kind: "or", left: negateBody(b.left), right: negateBody(b.right) };
    case "or":
      return { kind: "and", left: negateBody(b.left), right: negateBody(b.right) };
    case "imp":
      return { kind: "and", left: b.left, right: negateBody(b.right) };
  }
}

export const correctNegation = (s: SimpleStatement): SimpleStatement => ({ kind: "simple", q: dual(s.q), body: negateBody(s.body) });

export type NegationMistake = "cuantificador" | "de-morgan" | "solo-cuantificador";

/** Los errores típicos al negar (el de De Morgan solo si el cuerpo tiene una conectiva). */
export function negationDistractors(s: SimpleStatement): Array<{ mistake: NegationMistake; statement: SimpleStatement }> {
  const out: Array<{ mistake: NegationMistake; statement: SimpleStatement }> = [{ mistake: "cuantificador", statement: { kind: "simple", q: s.q, body: negateBody(s.body) } }];
  const b = s.body;
  if (b.kind === "and" || b.kind === "or" || b.kind === "imp") out.push({ mistake: "de-morgan", statement: { kind: "simple", q: dual(s.q), body: { kind: b.kind, left: negateBody(b.left), right: negateBody(b.right) } } });
  out.push({ mistake: "solo-cuantificador", statement: { kind: "simple", q: dual(s.q), body: s.body } });
  return out;
}

const sameStatement = (a: ConcreteStatement, b: ConcreteStatement) => JSON.stringify(a) === JSON.stringify(b);

/** Qué error típico es la opción (null si no es ninguno de ellos). */
export function negationMistakeOf(original: SimpleStatement, option: SimpleStatement): NegationMistake | null {
  return negationDistractors(original).find((d) => sameStatement(d.statement, option))?.mistake ?? null;
}

/** Por qué una opción equivocada no es la negación (sin decir cuál es la buena). */
export function negationMistakeText(original: SimpleStatement, option: SimpleStatement): string {
  const m = negationMistakeOf(original, option);
  if (m === "cuantificador") return "El cuantificador sigue igual. Al negar, ∀ pasa a ∃ y ∃ pasa a ∀: ¬∀x P(x) ≡ ∃x ¬P(x) y ¬∃x P(x) ≡ ∀x ¬P(x).";
  if (m === "solo-cuantificador") return "Solo cambia el cuantificador: lo de dentro también hay que negarlo. ¬∀x P(x) es ∃x ¬P(x), no ∃x P(x).";
  if (m === "de-morgan") {
    const k = original.body.kind;
    if (k === "imp") return "Negar una implicación no es negar sus dos lados: ¬(p → q) ≡ p ∧ ¬q (solo falla cuando p se cumple y q no), y ¬p → ¬q es otra cosa.";
    return k === "and"
      ? "El cuantificador cambia bien, pero falta De Morgan: al negar una conjunción, ∧ pasa a ∨: ¬(p ∧ q) ≡ ¬p ∨ ¬q."
      : "El cuantificador cambia bien, pero falta De Morgan: al negar una disyunción, ∨ pasa a ∧: ¬(p ∨ q) ≡ ¬p ∧ ¬q.";
  }
  return "No vale siempre lo contrario que el enunciado: hay conjuntos en los que los dos son verdaderos (o los dos falsos) a la vez.";
}

/** Subconjuntos no vacíos del conjunto (hasta 2⁸ − 1). */
export function subsetsOf(set: readonly number[]): number[][] {
  const out: number[][] = [];
  for (let m = 1; m < 1 << set.length; m++) out.push(set.filter((_, i) => m & (1 << i)));
  return out;
}

/** Conjuntos al azar (fijos) de enteros entre −12 y 30, para comprobar equivalencias en general. */
export const RANDOM_SETS: readonly number[][] = (() => {
  const r = createRng(20261111);
  return Array.from({ length: 300 }, () => {
    const size = r.int(1, 8);
    const s = new Set<number>();
    while (s.size < size) s.add(r.int(-12, 30));
    return [...s].sort((a, b) => a - b);
  });
})();

/** ¿Vale la opción lo mismo que ¬original en todos esos conjuntos? */
export const isNegationOn = (original: ConcreteStatement, option: ConcreteStatement, sets: readonly (readonly number[])[]) => sets.every((A) => truthIn(option, A) === !truthIn(original, A));

/** Conjuntos con los que se decide qué opción es la negación: los subconjuntos de A y RANDOM_SETS. */
export const negationSets = (set: readonly number[]) => [...subsetsOf(set), ...RANDOM_SETS];

/** ¿Es la opción equivalente a la negación? (Fuerza bruta en los subconjuntos de A y en muchos otros.) */
export const isNegation = (original: SimpleStatement, option: SimpleStatement, set: readonly number[]) => isNegationOn(original, option, negationSets(set));

/** Cómo se llega a la negación, paso a paso. */
export function negationSteps(s: SimpleStatement): Array<{ text: string; tex: string; law: string }> {
  const neg = correctNegation(s);
  const mid = `${prefixText(neg.q, "x")}¬(${bodyText(s.body)})`;
  const midTex = `${prefixTex(neg.q, "x")}\\lnot(${bodyTex(s.body)})`;
  const k = s.body.kind;
  const law =
    k === "and"
      ? "De Morgan: ¬(p ∧ q) ≡ ¬p ∨ ¬q"
      : k === "or"
        ? "De Morgan: ¬(p ∨ q) ≡ ¬p ∧ ¬q"
        : k === "imp"
          ? "¬(p → q) ≡ p ∧ ¬q"
          : k === "not"
            ? "¬¬p ≡ p"
            : "La negación queda sobre la propiedad";
  const b = s.body;
  const hasDouble = (b.kind === "and" || b.kind === "or" || b.kind === "imp") && (b.right.kind === "not" || (b.kind !== "imp" && b.left.kind === "not"));
  return [
    { text: negatedText(s), tex: negatedTex(s), law: "Enunciado" },
    { text: mid, tex: midTex, law: `${s.q === "forall" ? "¬∀x P(x) ≡ ∃x ¬P(x)" : "¬∃x P(x) ≡ ∀x ¬P(x)"}: cambia el cuantificador y la negación entra` },
    { text: statementText(neg), tex: statementTex(neg), law: hasDouble ? `${law}, y ¬¬p ≡ p` : law },
  ];
}

// ---------------------------------------------------------------- Pistas

export type HintStep = "negar" | "evaluar";

/**
 * Lo que hay en el enunciado, para elegir las pistas (nunca depende del valor de verdad). Al negar, el
 * primer paso solo mira el enunciado original (las leyes de la negación) y el segundo, la negación
 * (cómo se evalúa): así las pistas del primero no dicen qué conectiva queda en la negación.
 */
export function concreteTokens(inst: PredConcreteInstance, step: HintStep = inst.mode === "negar" ? "negar" : "evaluar"): string[] {
  const out = new Set<string>();
  const walk = (b: Body, props: boolean) => {
    if (b.kind === "atom") {
      if (props) out.add(b.prop.kind);
    } else if (b.kind === "not") {
      out.add("¬");
      walk(b.arg, props);
    } else {
      if (props) out.add(OP_TEXT[b.kind]);
      walk(b.left, props);
      walk(b.right, props);
    }
  };
  if (inst.mode === "negar" && step === "negar") {
    out.add("negar");
    const k = inst.statement.body.kind;
    if (k === "and" || k === "or" || k === "imp") out.add(`neg-${OP_TEXT[k]}`);
    walk(inst.statement.body, false);
    return [...out];
  }
  const asked = askedStatement(inst);
  if (asked.kind === "nested") out.add(`${asked.outer === "forall" ? "∀" : "∃"}${asked.inner === "forall" ? "∀" : "∃"}`);
  else {
    out.add(asked.q === "forall" ? "∀" : "∃");
    walk(asked.body, true);
    out.delete("¬");
  }
  if (inst.set.some((n) => n <= 0)) out.add("no-positivos");
  return [...out];
}

const HINTS: readonly TaggedHint[] = [
  { needs: ["negar"], text: "Al negar, el cuantificador cambia y la negación entra: ¬∀x P(x) ≡ ∃x ¬P(x) y ¬∃x P(x) ≡ ∀x ¬P(x)." },
  { needs: ["neg-∧"], text: "De Morgan generalizado: al negar, ∧ pasa a ∨ y cada parte queda negada, ¬∀x (P(x) ∧ Q(x)) ≡ ∃x (¬P(x) ∨ ¬Q(x)), y lo mismo con ∃." },
  { needs: ["neg-∨"], text: "De Morgan generalizado: al negar, ∨ pasa a ∧ y cada parte queda negada, ¬∃x (P(x) ∨ Q(x)) ≡ ∀x (¬P(x) ∧ ¬Q(x)), y lo mismo con ∀." },
  { needs: ["neg-→"], text: "¬(p → q) ≡ p ∧ ¬q: una implicación solo falla cuando p se cumple y q no." },
  { needs: ["negar", "¬"], text: "Una doble negación se cancela: ¬¬p ≡ p." },
  { needs: ["∃"], text: "Para un ∃ basta un ejemplo: un solo elemento de A que cumpla la condición." },
  { needs: ["∃"], text: "Un ∃ solo falla si ningún elemento de A cumple la condición: hay que mirarlos todos." },
  { needs: ["∀"], text: "Para tumbar un ∀ basta un contraejemplo: un solo elemento de A que no cumpla la condición." },
  { needs: ["∀"], text: "Un ∀ solo se cumple si todos los elementos de A cumplen la condición: hay que mirarlos todos." },
  { needs: ["∀∃"], text: "∀x ∃y: para cada x de A hace falta un y de A que cumpla la relación, y puede ser distinto para cada x." },
  { needs: ["∃∀"], text: "∃x ∀y: hace falta un mismo x de A que cumpla la relación con todos los y de A a la vez, incluido y = x." },
  { needs: ["∀∀"], text: "∀x ∀y: la relación tiene que cumplirse en todos los pares de A, también cuando x e y son el mismo elemento." },
  { needs: ["∃∃"], text: "∃x ∃y: basta un par de elementos de A que cumpla la relación; x e y pueden ser el mismo." },
  { needs: ["∧"], text: "p ∧ q solo se cumple cuando se cumplen las dos." },
  { needs: ["∨"], text: "p ∨ q solo falla cuando fallan las dos." },
  { needs: ["→"], text: "p → q solo falla cuando p se cumple y q no; si p no se cumple, la implicación se cumple." },
  { needs: ["primo"], text: "Un primo es un entero mayor que uno con solo dos divisores positivos, uno y él mismo: ni el uno, ni el cero, ni los negativos son primos." },
  { needs: ["cuadrado"], text: "Un cuadrado perfecto es el cuadrado de un entero: el cero y el uno lo son, y ningún negativo." },
  { needs: ["par", "no-positivos"], text: "Un entero es par si es el doble de otro entero: el cero y los negativos también pueden ser pares." },
  { needs: ["impar", "no-positivos"], text: "Un entero es impar si no es par: los negativos también pueden ser impares, y el cero no lo es." },
  { needs: ["multiplo", "no-positivos"], text: "n es múltiplo de k si n = k·m con m entero: el cero es múltiplo de cualquier k, y los negativos también pueden serlo." },
  { needs: ["divisor"], text: "n es divisor de m si m = n·k con k entero: también los negativos pueden ser divisores, y el cero no divide a ningún número distinto de cero." },
  { needs: ["positivo"], text: "Positivo es mayor que cero: el cero no es positivo." },
];

/** Pistas del ejercicio: solo las reglas que salen en el enunciado. */
export const concreteHints = (inst: PredConcreteInstance, step?: HintStep): string[] => pickHints(HINTS, concreteTokens(inst, step));

// ---------------------------------------------------------------- Generador

const SIZE: Record<ExerciseLevel, [number, number]> = { básico: [4, 4], medio: [5, 6], avanzado: [7, 8] };
const RANGE: Record<ExerciseLevel, [number, number]> = { básico: [1, 12], medio: [-4, 15], avanzado: [-8, 16] };

function randomSet(r: Rng, level: ExerciseLevel): number[] {
  const [lo, hi] = RANGE[level];
  const [a, b] = SIZE[level];
  const size = r.int(a, b);
  const s = new Set<number>();
  while (s.size < size) s.add(r.int(lo, hi));
  return [...s].sort((x, y) => x - y);
}

function randomProp(r: Rng, level: ExerciseLevel, set: readonly number[]): Prop {
  const kinds: PropKind[] = ["primo", "par", "impar", "multiplo", "divisor", "cuadrado", "mayor", "menor", ...(level === "básico" ? [] : (["positivo"] as const))];
  const kind = r.pick(kinds);
  const lo = set[0]!;
  const hi = set[set.length - 1]!;
  if (kind === "multiplo") return { kind, k: r.pick([3, 4, 5]) };
  if (kind === "divisor") return { kind, k: r.pick([12, 18, 20, 24, 30]) };
  if (kind === "mayor") return { kind, k: r.int(lo, hi - 1) };
  if (kind === "menor") return { kind, k: r.int(lo + 1, hi) };
  return { kind };
}

const atomB = (prop: Prop): Body => ({ kind: "atom", prop });

/** Dos propiedades que no tienen sentido juntas: la misma, o par con impar. */
function clash(a: Prop, b: Prop): boolean {
  if (a.kind === b.kind) return true;
  const pair = new Set([a.kind, b.kind]);
  return (pair.has("par") && pair.has("impar")) || (pair.has("mayor") && pair.has("menor")) || (pair.has("primo") && pair.has("cuadrado"));
}

function randomBody(r: Rng, level: ExerciseLevel, set: readonly number[], two: boolean): Body | null {
  const a = randomProp(r, level, set);
  if (!two) return level !== "básico" && r.chance(0.3) ? notB(atomB(a)) : atomB(a);
  const b = randomProp(r, level, set);
  if (clash(a, b)) return null;
  const op = r.pick(["and", "or", "imp"] as const);
  let left = atomB(a);
  let right = atomB(b);
  if (level !== "básico" && r.chance(0.5)) {
    if (r.chance(0.5)) left = notB(left);
    else right = notB(right);
  }
  return { kind: op, left, right };
}

/** Las propiedades de un cuerpo con dos toman los dos valores en A (si no, una sobra). */
const propsVary = (b: Body, set: readonly number[]) => {
  const props = propsOf(b);
  return props.length === 1 || props.every((p) => set.some((x) => propHolds(p, x)) && set.some((x) => !propHolds(p, x)));
};

function randomNested(r: Rng): NestedStatement {
  const combos: Array<[Quant, Quant]> = [
    ["forall", "exists"],
    ["forall", "exists"],
    ["exists", "forall"],
    ["exists", "forall"],
    ["forall", "forall"],
    ["exists", "exists"],
  ];
  const [outer, inner] = r.pick(combos);
  return { kind: "nested", outer, inner, rel: r.pick(["gt", "lt", "le", "ge", "ne", "opp"] as const) };
}

/** Probabilidad del modo «negar». */
export const NEGATE_SHARE = 0.4;

function makeInstance(r: Rng, level: ExerciseLevel, want: boolean, negate: boolean): PredConcreteInstance | null {
  const set = randomSet(r, level);
  if (negate) {
    const body = randomBody(r, level, set, true);
    if (!body || !propsVary(body, set)) return null;
    const statement: SimpleStatement = { kind: "simple", q: r.chance(0.5) ? "forall" : "exists", body };
    // La negación, verdadera o falsa por igual.
    if (truthIn(correctNegation(statement), set) !== want) return null;
    const right = correctNegation(statement);
    const wrong = negationDistractors(statement).map((d) => d.statement);
    const options = [right, ...wrong];
    if (new Set(options.map(statementText)).size !== options.length) return null;
    // Cada error se distingue de la negación ya en algún subconjunto de A.
    const subs = subsetsOf(set);
    if (wrong.some((w) => isNegationOn(statement, w, subs))) return null;
    return { mode: "negar", set, statement, options: r.shuffle(options) };
  }
  let statement: ConcreteStatement;
  if (level === "avanzado" && r.chance(0.35)) statement = randomNested(r);
  else {
    const body = randomBody(r, level, set, level === "básico" ? r.chance(0.6) : r.chance(0.8));
    if (!body || !propsVary(body, set)) return null;
    statement = { kind: "simple", q: r.chance(0.5) ? "forall" : "exists", body };
  }
  if (truthIn(statement, set) !== want) return null;
  return { mode: "evaluar", set, statement };
}

export const PRED_CONCRETE: ExerciseType<PredConcreteInstance> = {
  id: "predicados-conjunto-concreto",
  topic: "predicados",
  title: "Cuantificadores en un conjunto concreto",
  description: "Decide si un enunciado con ∀ o ∃ es verdadero en un conjunto pequeño de enteros (primo, par, múltiplo, divisor…), con su testigo o contraejemplo, o elige su negación con De Morgan generalizado.",
  levels: ["básico", "medio", "avanzado"],
  generate(seed, level) {
    const r = rngFor("predicados-conjunto-concreto", seed);
    const negate = r.chance(NEGATE_SHARE);
    // Verdadero o falso por igual (al negar, el valor de la negación).
    const want = r.chance(0.5);
    return generateUntil(r, (x) => makeInstance(x, level, want, negate), () => true);
  },
};

export const PRED_CONCRETE_EXERCISES = [PRED_CONCRETE] as const;
