// Laboratorio de lógica de predicados: dominios de ejemplo con sus interpretaciones, fórmulas para
// negar y frases para traducir. Contenido CC BY 4.0. Se valida con PredicatesPackSchema
// (tests/content.test.ts). Son ejemplos de elaboración propia para entrenar; nada de esto sale de
// actividades evaluables.
import type { PredicatesPack } from "../../shared/predicates/schema.ts";

const lessThan = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).flatMap((x) =>
    Array.from({ length: n }, (_, j) => j + 1)
      .filter((y) => x < y)
      .map((y) => [String(x), String(y)]),
  );
const divides = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).flatMap((x) =>
    Array.from({ length: n }, (_, j) => j + 1)
      .filter((y) => y % x === 0)
      .map((y) => [String(x), String(y)]),
  );

const NUMEROS = [
  { name: "P", arity: 1, meaning: "x es par" },
  { name: "Q", arity: 1, meaning: "x es mayor que 2" },
  { name: "M", arity: 2, meaning: "x es menor que y" },
] as const;

export const PREDICADOS_PACK: PredicatesPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Lógica de predicados",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-10-29",
  },
  domains: [
    {
      id: "numeros",
      name: "Números del 1 al 4",
      description: "D = {1, 2, 3, 4} con dos propiedades (ser par, ser mayor que 2) y la relación «menor que».",
      domain: ["1", "2", "3", "4"],
      predicates: [
        { ...NUMEROS[0], extension: [["2"], ["4"]] },
        { ...NUMEROS[1], extension: [["3"], ["4"]] },
        { ...NUMEROS[2], extension: lessThan(4) },
      ],
      formulas: [
        "∀x (P(x) → Q(x))",
        "∃x (P(x) ∧ Q(x))",
        "∀x ∃y M(x, y)",
        "∃x ∀y ¬M(y, x)",
        "∀x (Q(x) → ∃y M(y, x))",
        "∃x P(x) → ∀x Q(x)",
      ],
    },
    {
      id: "divisores",
      name: "Divisibilidad del 1 al 5",
      description: "D = {1, 2, 3, 4, 5}, I(x): «x es impar» y D(x, y): «x divide a y» (y es múltiplo de x).",
      domain: ["1", "2", "3", "4", "5"],
      predicates: [
        { name: "I", arity: 1, meaning: "x es impar", extension: [["1"], ["3"], ["5"]] },
        { name: "D", arity: 2, meaning: "x divide a y", extension: divides(5) },
      ],
      formulas: [
        "∃x ∀y D(x, y)",
        "∀x D(x, x)",
        "∀y ∃x D(x, y)",
        "∀x ∀y (D(x, y) → D(y, x))",
        "∀x (I(x) → ∃y (D(x, y) ∧ ¬I(y)))",
        "D(2, 4) ∧ ¬D(4, 2)",
      ],
    },
    {
      id: "grafo",
      name: "Un grafo dirigido",
      description: "D = {a, b, c, d}: F(x, y) dice que hay una flecha de x a y (a → b → c → a y c → d) y C(x) que x está coloreado.",
      domain: ["a", "b", "c", "d"],
      predicates: [
        { name: "C", arity: 1, meaning: "x está coloreado", extension: [["a"], ["d"]] },
        { name: "F", arity: 2, meaning: "hay una flecha de x a y", extension: [["a", "b"], ["b", "c"], ["c", "a"], ["c", "d"]] },
      ],
      formulas: [
        "∃x ∀y ¬F(x, y)",
        "∀x ∃y F(x, y)",
        "∀x (C(x) → ∃y F(y, x))",
        "∃x ∃y (F(x, y) ∧ F(y, x))",
        "∀x ∀y (F(x, y) → ¬C(y))",
      ],
    },
  ],
  negation: [
    { id: "basico-1", formula: "∀x P(x)", level: "básico" },
    { id: "basico-2", formula: "∃x (P(x) ∧ Q(x))", level: "básico" },
    { id: "basico-3", formula: "∀x (P(x) → Q(x))", level: "básico" },
    { id: "medio-1", formula: "∀x ∃y M(x, y)", level: "medio" },
    { id: "medio-2", formula: "∃x (P(x) ∨ ¬Q(x))", level: "medio" },
    { id: "medio-3", formula: "∀x (P(x) → ∃y M(x, y))", level: "medio" },
    { id: "avanzado-1", formula: "∃x ∀y (M(x, y) → P(y))", level: "avanzado" },
    { id: "avanzado-2", formula: "∀x (Q(x) ↔ ∃y M(y, x))", level: "avanzado" },
    { id: "avanzado-3", formula: "¬∃x P(x) ∨ ∀x Q(x)", level: "avanzado" },
  ],
  translation: [
    {
      id: "todos",
      sentence: "Todos los números pares son mayores que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "∀x (P(x) → Q(x))",
      hint: "«Todos los A son B» se escribe con ∀ y una implicación: para cada x, si x es A, entonces x es B.",
      level: "básico",
    },
    {
      id: "alguno",
      sentence: "Algún número par es mayor que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "∃x (P(x) ∧ Q(x))",
      hint: "«Algún A es B» se escribe con ∃ y una conjunción: existe un x que es A y es B.",
      level: "básico",
    },
    {
      id: "ninguno",
      sentence: "Ningún número par es mayor que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "∀x (P(x) → ¬Q(x))",
      hint: "«Ningún A es B» es lo mismo que «no existe un x que sea A y B», o que «todo A no es B».",
      level: "básico",
    },
    {
      id: "no-todos",
      sentence: "No todos los números pares son mayores que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "¬∀x (P(x) → Q(x))",
      hint: "Es la negación de «todos los pares son mayores que 2»: escribe esa frase y niégala entera.",
      level: "medio",
    },
    {
      id: "solo",
      sentence: "Solo los números pares son mayores que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "∀x (Q(x) → P(x))",
      hint: "«Solo los A son B» significa que, si algo es B, entonces es A. Fíjate en el orden de la implicación.",
      level: "medio",
    },
    {
      id: "cada-uno",
      sentence: "Cada número es menor que algún número.",
      glossary: [NUMEROS[2]],
      answer: "∀x ∃y M(x, y)",
      hint: "Hay dos cuantificadores: primero «cada número x» y, dentro, «algún número y». El orden importa.",
      level: "medio",
    },
    {
      id: "maximo",
      sentence: "Hay un número que no es menor que ningún número.",
      glossary: [NUMEROS[2]],
      answer: "∃x ∀y ¬M(x, y)",
      hint: "«Hay un x» va fuera; «no es menor que ningún y» es «para todo y, x no es menor que y».",
      level: "avanzado",
    },
    {
      id: "si-todos",
      sentence: "Si todos los números son pares, entonces alguno es mayor que 2.",
      glossary: [NUMEROS[0], NUMEROS[1]],
      answer: "(∀x P(x)) → ∃x Q(x)",
      hint: "Es una implicación entre dos frases cuantificadas: cada una lleva su propio cuantificador.",
      level: "avanzado",
    },
  ],
};
