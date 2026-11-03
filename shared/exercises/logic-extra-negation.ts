// Plantillas de «Negar en lenguaje natural»: una frase con cuantificadores, su fórmula, la negación
// buena y tres errores típicos (negar solo el predicado, dejar el cuantificador como estaba, aplicar
// De Morgan al revés o repetir la frase con otras palabras). Cada opción lleva su fórmula: la buena es
// la que equivale a ¬(fórmula de la frase), y eso lo comprueba el motor de predicados.
import { parsePredicate } from "../predicates/parser.ts";
import { findPredDifference } from "../predicates/equivalence.ts";
import type { Rng } from "./random.ts";
import type { ExerciseLevel } from "./types.ts";

export type NegationOption = { text: string; formula: string };
export type NegationDraft = { sentence: string; formula: string; legend: string; options: NegationOption[] };

const PAIRS: Array<[string, string]> = [
  ["puntual", "organizado"],
  ["curioso", "paciente"],
  ["rápido", "preciso"],
  ["creativo", "constante"],
  ["optimista", "prudente"],
];
const LIKES = ["la Estadística", "programar en Python", "el café solo", "la teoría de grafos", "madrugar"];
const VERBS: Array<[string, string]> = [
  ["entrega tarde", "entregar tarde"],
  ["suspende el examen", "suspender el examen"],
  ["usa la calculadora", "usar la calculadora"],
  ["falta a clase", "faltar a clase"],
];
const GROUPS = [
  { pl: "los modelos del concurso", sg: "modelo del concurso", adjPl: "precisos", adjSg: "preciso" },
  { pl: "los ejercicios del tema", sg: "ejercicio del tema", adjPl: "difíciles", adjSg: "difícil" },
  { pl: "los datos del fichero", sg: "dato del fichero", adjPl: "válidos", adjSg: "válido" },
  { pl: "los grafos de la lista", sg: "grafo de la lista", adjPl: "conexos", adjSg: "conexo" },
];
const RELATIONS: Array<{ verb: string; inf: string }> = [
  { verb: "ayuda a", inf: "ayudar a" },
  { verb: "conoce a", inf: "conocer a" },
  { verb: "sigue a", inf: "seguir a" },
  { verb: "saluda a", inf: "saludar a" },
];

type Template = { levels: readonly ExerciseLevel[]; make: (r: Rng) => { sentence: string; formula: string; legend: string; right: NegationOption; wrong: NegationOption[] } };

const PEOPLE = "x recorre las personas de un grupo";

const TEMPLATES: Template[] = [
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const t = r.pick(LIKES);
      return {
        sentence: `A algunas personas les gusta ${t}.`,
        formula: "∃x G(x)",
        legend: `${PEOPLE}; G(x): a x le gusta ${t}.`,
        right: { text: `A nadie le gusta ${t}.`, formula: "∀x ¬G(x)" },
        wrong: [
          { text: `A algunas personas no les gusta ${t}.`, formula: "∃x ¬G(x)" },
          { text: `A todo el mundo le gusta ${t}.`, formula: "∀x G(x)" },
          { text: `Hay al menos una persona a la que le gusta ${t}.`, formula: "∃x G(x)" },
        ],
      };
    },
  },
  {
    levels: ["básico", "medio"],
    make: (r) => {
      const [v] = r.pick(VERBS);
      return {
        sentence: `Nadie ${v}.`,
        formula: "¬∃x G(x)",
        legend: `${PEOPLE}; G(x): x ${v}.`,
        right: { text: `Alguien ${v}.`, formula: "∃x G(x)" },
        wrong: [
          { text: `Todo el mundo ${v}.`, formula: "∀x G(x)" },
          { text: `Alguien no ${v}.`, formula: "∃x ¬G(x)" },
          { text: `Ninguna persona ${v}.`, formula: "∀x ¬G(x)" },
        ],
      };
    },
  },
  {
    levels: ["básico", "medio", "avanzado"],
    make: (r) => {
      const g = r.pick(GROUPS);
      return {
        sentence: `Todos ${g.pl} son ${g.adjPl}.`,
        formula: "∀x (E(x) → P(x))",
        legend: `x recorre todos los objetos; E(x): x es un ${g.sg}; P(x): x es ${g.adjSg}.`,
        right: { text: `Algún ${g.sg} no es ${g.adjSg}.`, formula: "∃x (E(x) ∧ ¬P(x))" },
        wrong: [
          { text: `Ningún ${g.sg} es ${g.adjSg}.`, formula: "∀x (E(x) → ¬P(x))" },
          { text: `Algún ${g.sg} es ${g.adjSg}.`, formula: "∃x (E(x) ∧ P(x))" },
          { text: `Todo lo que no es un ${g.sg} es ${g.adjSg}.`, formula: "∀x (¬E(x) → P(x))" },
        ],
      };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const [a, b] = r.pick(PAIRS);
      return {
        sentence: `Todo el mundo es ${a} y ${b}.`,
        formula: "∀x (P(x) ∧ Q(x))",
        legend: `${PEOPLE}; P(x): x es ${a}; Q(x): x es ${b}.`,
        right: { text: `Alguien no es ${a} o no es ${b}.`, formula: "∃x (¬P(x) ∨ ¬Q(x))" },
        wrong: [
          { text: `Alguien no es ${a} y tampoco es ${b}.`, formula: "∃x (¬P(x) ∧ ¬Q(x))" },
          { text: `Nadie es ${a} y ${b} a la vez.`, formula: "∀x ¬(P(x) ∧ Q(x))" },
          { text: `Nadie es ${a} ni ${b}.`, formula: "∀x (¬P(x) ∧ ¬Q(x))" },
        ],
      };
    },
  },
  {
    levels: ["medio", "avanzado"],
    make: (r) => {
      const [a, b] = r.pick(PAIRS);
      return {
        sentence: `Todo el mundo es ${a} o ${b}.`,
        formula: "∀x (P(x) ∨ Q(x))",
        legend: `${PEOPLE}; P(x): x es ${a}; Q(x): x es ${b}.`,
        right: { text: `Alguien no es ${a} ni ${b}.`, formula: "∃x (¬P(x) ∧ ¬Q(x))" },
        wrong: [
          { text: `Alguien no es ${a} o no es ${b}.`, formula: "∃x (¬P(x) ∨ ¬Q(x))" },
          { text: `Nadie es ${a} ni ${b}.`, formula: "∀x (¬P(x) ∧ ¬Q(x))" },
          { text: `Alguien es ${a} y ${b}.`, formula: "∃x (P(x) ∧ Q(x))" },
        ],
      };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const v = r.pick(RELATIONS);
      return {
        sentence: `Hay alguien que ${v.verb} todo el mundo.`,
        formula: "∃x ∀y R(x, y)",
        legend: `x e y recorren las personas de un grupo; R(x, y): x ${v.verb} y.`,
        right: { text: `Cada persona tiene a alguien a quien no ${v.verb.replace(/ a$/, "")}.`, formula: "∀x ∃y ¬R(x, y)" },
        wrong: [
          { text: `Nadie ${v.verb} nadie.`, formula: "∀x ∀y ¬R(x, y)" },
          { text: `Hay alguien que no ${v.verb} nadie.`, formula: "∃x ∀y ¬R(x, y)" },
          { text: `Todo el mundo ${v.verb} alguien.`, formula: "∀x ∃y R(x, y)" },
        ],
      };
    },
  },
  {
    levels: ["avanzado"],
    make: (r) => {
      const v = r.pick(RELATIONS);
      return {
        sentence: `Todo el mundo ${v.verb} alguien.`,
        formula: "∀x ∃y R(x, y)",
        legend: `x e y recorren las personas de un grupo; R(x, y): x ${v.verb} y.`,
        right: { text: `Hay alguien que no ${v.verb} nadie.`, formula: "∃x ∀y ¬R(x, y)" },
        wrong: [
          { text: `Nadie ${v.verb} nadie.`, formula: "∀x ∀y ¬R(x, y)" },
          { text: `Hay alguien que ${v.verb} todo el mundo.`, formula: "∃x ∀y R(x, y)" },
          { text: `Cada persona tiene a alguien a quien no ${v.verb.replace(/ a$/, "")}.`, formula: "∀x ∃y ¬R(x, y)" },
        ],
      };
    },
  },
];

export function negationOf(r: Rng, level: ExerciseLevel): NegationDraft {
  const t = r.pick(TEMPLATES.filter((x) => x.levels.includes(level))).make(r);
  return { sentence: t.sentence, formula: t.formula, legend: t.legend, options: r.shuffle([t.right, ...t.wrong]) };
}

/** Dominios en los que se comparan las fórmulas (hasta tres elementos: todas las interpretaciones). */
export const NEGATION_DOMAINS = [["1"], ["1", "2"], ["1", "2", "3"]] as const;

function pred(text: string) {
  const r = parsePredicate(text);
  if (!r.ok) throw new Error(`fórmula ilegible: ${text}`);
  return r.formula;
}

/** ¿La opción es la negación de la frase? (Equivalente a ¬fórmula en todos los dominios pequeños.) */
export function isNegation(formula: string, option: string): boolean {
  return findPredDifference({ kind: "not", arg: pred(formula) }, pred(option), NEGATION_DOMAINS) === null;
}
