// Laboratorio de combinatoria: problemas de recuento para decidir el modelo (Pₙ, PR, V, VR, C o CR) y
// calcularlo, planteamientos de funciones entre conjuntos finitos según sus cardinales, fragmentos de
// pseudocódigo y costes para estimar su orden O grande. Contenido CC BY 4.0. Se valida con
// CombPackSchema (tests/content-combinatoria.test.ts). Nada de esto sale de actividades evaluables:
// son ejercicios de elaboración propia para entrenar, con el estilo de las preguntas de clase. La
// respuesta de cada problema no está escrita aquí: la calcula el motor (shared/discrete) a partir del
// modelo.
import type { CombPack } from "../../shared/discrete/schema.ts";

export const COMB_PACK: CombPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Combinatoria, funciones entre conjuntos finitos y complejidad computacional",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-11-03",
  },
  problems: [
    {
      id: "estanteria",
      level: "básico",
      title: "Libros en la estantería",
      story: "Tienes 7 libros distintos de la asignatura. ¿De cuántas formas puedes colocarlos en fila en una estantería?",
      model: { n: 7, k: 7, order: true, repetition: false },
    },
    {
      id: "podio",
      level: "básico",
      title: "Podio de robótica",
      story: "En una competición de robótica participan 12 equipos. ¿De cuántas formas distintas puede quedar el podio (primero, segundo y tercero)?",
      model: { n: 12, k: 3, order: true, repetition: false },
    },
    {
      id: "presentacion",
      level: "básico",
      title: "Grupo para la presentación",
      story: "De los 15 estudiantes de un grupo de prácticas se eligen 4 para presentar el proyecto. No hay cargos: solo cuenta quién va. ¿Cuántos grupos distintos se pueden formar?",
      model: { n: 15, k: 4, order: false, repetition: false },
    },
    {
      id: "candado",
      level: "básico",
      title: "Candado de maleta",
      story: "Un candado de maleta tiene 3 ruedas, cada una con las cifras del 0 al 9. ¿Cuántas combinaciones distintas puede tener?",
      model: { n: 10, k: 3, order: true, repetition: true },
    },
    {
      id: "codigo-sin-repetir",
      level: "medio",
      title: "Código sin cifras repetidas",
      story: "Una aplicación pide un código de 5 cifras en el que no se repita ninguna cifra. ¿Cuántos códigos distintos hay?",
      model: { n: 10, k: 5, order: true, repetition: false },
    },
    {
      id: "baliza",
      level: "medio",
      title: "Destellos de una baliza",
      story: "Una baliza emite mensajes de 7 destellos, cada uno largo o corto. ¿Cuántos mensajes distintos tienen exactamente 4 destellos largos y 3 cortos?",
      model: { n: 7, k: 7, order: true, repetition: true, groups: [4, 3] },
    },
    {
      id: "tarrina",
      level: "medio",
      title: "Tarrina de helado",
      story: "Una heladería ofrece 6 sabores. ¿Cuántas tarrinas distintas de 3 bolas se pueden pedir, si se puede repetir sabor y el orden de las bolas no importa?",
      model: { n: 6, k: 3, order: false, repetition: true },
    },
    {
      id: "tomate",
      level: "medio",
      title: "Reordenar TOMATE",
      story: "¿Cuántas palabras distintas, con o sin sentido, se pueden formar reordenando todas las letras de TOMATE?",
      model: { n: 6, k: 6, order: true, repetition: true, groups: [2, 1, 1, 1, 1] },
    },
    {
      id: "bits-equilibrados",
      level: "medio",
      title: "Cadenas equilibradas",
      story: "¿Cuántas cadenas de 10 bits tienen tantos ceros como unos?",
      model: { n: 10, k: 10, order: true, repetition: true, groups: [5, 5] },
    },
    {
      id: "capa-neuronas",
      level: "avanzado",
      title: "Salidas de una capa",
      story: "Cada una de las 10 neuronas de una capa da como salida 0, 0,5 o 1. ¿Cuántos vectores de salida distintos tienen cinco valores 0, tres valores 0,5 y dos valores 1?",
      model: { n: 10, k: 10, order: true, repetition: true, groups: [5, 3, 2] },
    },
    {
      id: "soluciones-naturales",
      level: "avanzado",
      title: "Soluciones de una ecuación",
      story: "¿Cuántas soluciones en números naturales (incluido el 0) tiene la ecuación x₁ + x₂ + x₃ + x₄ = 9?",
      model: { n: 4, k: 9, order: false, repetition: true },
    },
    {
      id: "tareas",
      level: "avanzado",
      title: "Tareas del laboratorio",
      story: "En un laboratorio hay 9 investigadores. Se asignan 4 tareas distintas, cada una a un investigador diferente. ¿De cuántas formas se pueden asignar?",
      model: { n: 9, k: 4, order: true, repetition: false },
    },
    {
      id: "contrasena",
      level: "avanzado",
      title: "Contraseña de minúsculas",
      story: "¿Cuántas contraseñas de 6 caracteres se pueden formar con las 26 letras minúsculas del alfabeto inglés, si se pueden repetir?",
      model: { n: 26, k: 6, order: true, repetition: true },
    },
    {
      id: "mano-cartas",
      level: "avanzado",
      title: "Mano de cartas",
      story: "¿Cuántas manos distintas de 5 cartas se pueden repartir con una baraja española de 40 cartas?",
      model: { n: 40, k: 5, order: false, repetition: false },
    },
  ],
  functions: [
    {
      id: "cuatro-en-seis",
      level: "básico",
      a: 4,
      b: 6,
      statements: [
        { k: "modal", mode: "puede", prop: "inyectiva" },
        { k: "modal", mode: "puede", prop: "sobreyectiva" },
        { k: "modal", mode: "no-puede", prop: "biyectiva" },
        { k: "modal", mode: "necesariamente", prop: "inyectiva" },
        { k: "count", what: "todas", value: 1296 },
      ],
    },
    {
      id: "siete-en-cinco",
      level: "básico",
      a: 7,
      b: 5,
      statements: [
        { k: "modal", mode: "puede", prop: "inyectiva" },
        { k: "modal", mode: "puede", prop: "sobreyectiva" },
        { k: "modal", mode: "necesariamente", prop: "sobreyectiva" },
        { k: "modal", mode: "puede", prop: "inversa" },
        { k: "count", what: "inyectivas", value: 2520 },
      ],
    },
    {
      id: "cinco-en-cinco",
      level: "medio",
      a: 5,
      b: 5,
      statements: [
        { k: "modal", mode: "puede", prop: "biyectiva" },
        { k: "modal", mode: "necesariamente", prop: "biyectiva" },
        { k: "modal", mode: "puede", prop: "inversa" },
        { k: "modal", mode: "necesariamente", prop: "inyectiva" },
        { k: "count", what: "biyectivas", value: 120 },
      ],
    },
    {
      id: "uno-en-cuatro",
      level: "medio",
      a: 1,
      b: 4,
      statements: [
        { k: "modal", mode: "necesariamente", prop: "inyectiva" },
        { k: "modal", mode: "puede", prop: "sobreyectiva" },
        { k: "modal", mode: "no-puede", prop: "inversa" },
        { k: "count", what: "todas", value: 4 },
      ],
    },
    {
      id: "imagen-sobre",
      level: "avanzado",
      a: 6,
      b: 4,
      image: 4,
      statements: [
        { k: "fixed", prop: "sobreyectiva" },
        { k: "fixed", prop: "inyectiva" },
        { k: "onto-image", prop: "sobreyectiva" },
        { k: "onto-image", prop: "biyectiva" },
        { k: "fixed", prop: "inversa" },
      ],
    },
    {
      id: "imagen-inyectiva",
      level: "avanzado",
      a: 3,
      b: 8,
      image: 3,
      statements: [
        { k: "fixed", prop: "inyectiva" },
        { k: "fixed", prop: "sobreyectiva" },
        { k: "onto-image", prop: "biyectiva" },
        { k: "onto-image", prop: "inversa" },
        { k: "count", what: "inyectivas", value: 336 },
      ],
    },
  ],
  algorithms: [
    {
      id: "pares-de-conjuntos",
      level: "básico",
      title: "Todos los pares (a, b)",
      algo: {
        sets: { A: "m", B: "n" },
        body: [
          { k: "op", text: "s ← 0" },
          { k: "forEach", v: "a", set: "A", body: [{ k: "forEach", v: "b", set: "B", body: [{ k: "op", text: "s ← s + a·b" }] }] },
        ],
      },
    },
    {
      id: "uno-tras-otro",
      level: "básico",
      title: "Dos bloques seguidos",
      algo: {
        body: [
          { k: "for", v: "i", to: "n", body: [{ k: "op", text: "s ← s + i" }] },
          { k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "n", body: [{ k: "op", text: "t ← t + i·j" }] }] },
        ],
      },
    },
    {
      id: "triangulo",
      level: "medio",
      title: "Bucle triangular",
      algo: {
        body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "i", body: [{ k: "op", text: "c ← c + 1" }] }] }],
      },
    },
    {
      id: "mitades",
      level: "medio",
      title: "Mitades dentro de un recorrido",
      algo: {
        sets: { A: "m" },
        body: [{ k: "forEach", v: "a", set: "A", body: [{ k: "halve", v: "j", from: "n", body: [{ k: "op", text: "c ← c + 1" }] }] }],
      },
    },
    {
      id: "llamada-exponencial",
      level: "avanzado",
      title: "Llamadas a otro algoritmo",
      algo: {
        sub: "2^k + k^6 + 5",
        body: [{ k: "for", v: "i", to: "n", body: [{ k: "op", text: "x ← i" }, { k: "call", arg: "n" }] }],
      },
    },
    {
      id: "llamada-polinomica",
      level: "avanzado",
      title: "Llamada dentro de dos bucles",
      algo: {
        sub: "3k^2 + k + 1",
        body: [{ k: "for", v: "i", to: "n", body: [{ k: "for", v: "j", to: "m", body: [{ k: "call", arg: "m" }] }] }],
      },
    },
  ],
  costs: [
    { id: "cuadrado-de-polinomio", level: "medio", cost: "(n^4 - 3n + 2)^3" },
    { id: "producto", level: "básico", cost: "(n^2 + log n)(4n + 3)" },
    { id: "exponencial-y-potencia", level: "básico", cost: "n^7 + 2^n + 100" },
    { id: "n-log-n", level: "básico", cost: "5n log n + 2n + 9" },
    { id: "exponencial-al-cuadrado", level: "avanzado", cost: "(3^n + n^4)^2" },
    { id: "dos-variables", level: "avanzado", cost: "m n^2 + 4m^3 + n" },
  ],
};
