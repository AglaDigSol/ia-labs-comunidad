// Laboratorio de álgebra de Boole: expresiones de práctica (originales) y descripciones de las
// estructuras predefinidas. Contenido CC BY 4.0. Se valida con BoolePackSchema (tests/content.test.ts).
// Notación de clase: ⊕ suma, ⊙ producto, ′ complemento, 0 y 1. Nada de esto sale de actividades
// evaluables: son ejercicios de elaboración propia para entrenar las leyes.
import type { BoolePack } from "../../shared/boole/schema.ts";

export const BOOLE_PACK: BoolePack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Álgebras de Boole",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-10-27",
  },
  practice: [
    { id: "basico-1", expr: "x ⊙ (x′ ⊕ y)", level: "básico" },
    { id: "basico-2", expr: "x ⊙ y ⊕ x ⊙ y′", level: "básico" },
    { id: "basico-3", expr: "x ⊙ x′ ⊕ y ⊙ 1 ⊕ 0", level: "básico" },
    { id: "basico-4", expr: "(x′)′ ⊕ x ⊙ z", level: "básico" },
    { id: "medio-1", expr: "(x ⊕ y) ⊙ (x ⊕ y′)", level: "medio" },
    { id: "medio-2", expr: "x ⊕ x′ ⊙ y", level: "medio" },
    { id: "medio-3", expr: "(x′ ⊙ y′)′ ⊙ x′", level: "medio" },
    { id: "medio-4", expr: "(x ⊕ y)′ ⊕ x", level: "medio" },
    { id: "medio-5", expr: "(x ⊕ x′ ⊙ y)′", level: "medio" },
    { id: "avanzado-1", expr: "x ⊙ y ⊕ x′ ⊙ z ⊕ y ⊙ z", level: "avanzado" },
    { id: "avanzado-2", expr: "((x ⊙ y)′ ⊕ z)′ ⊕ x ⊙ z", level: "avanzado" },
    { id: "avanzado-3", expr: "(w ⊕ x)′ ⊙ z ⊕ w′ ⊙ x ⊙ z", level: "avanzado" },
    { id: "avanzado-4", expr: "x ⊙ y ⊙ z ⊕ x ⊙ y′ ⊙ z ⊕ x ⊙ y ⊙ z′ ⊕ w ⊙ x", level: "avanzado" },
  ],
  presets: {
    dos: {
      name: "{0, 1}",
      description:
        "El álgebra de Boole más pequeña: dos elementos, la suma se comporta como «o» y el producto como «y». Toda álgebra de Boole finita es, salvo nombres, un producto de copias de esta.",
    },
    "partes-1": {
      name: "P(A) con |A| = 1",
      description: "Los subconjuntos de A = {a}: solo ∅ y {a}. Suma = unión, producto = intersección, complemento = lo que falta hasta A.",
    },
    "partes-2": {
      name: "P(A) con |A| = 2",
      description:
        "Los cuatro subconjuntos de A = {a, b} con ∪, ∩ y el complemento A ∖ X. El 0 es ∅, el 1 es A y el orden es la inclusión.",
    },
    "partes-3": {
      name: "P(A) con |A| = 3",
      description:
        "Los ocho subconjuntos de A = {a, b, c}. Su diagrama de Hasse es un cubo: cada subconjunto se une con los que tienen un elemento más.",
    },
    "cubo-2": {
      name: "{0, 1}²",
      description: "Pares de bits operados posición a posición: la suma toma el máximo de cada componente y el producto, el mínimo.",
    },
    "cubo-3": {
      name: "{0, 1}³",
      description: "Ternas de bits operadas posición a posición. El complemento invierte cada bit. Tiene la misma forma que P(A) con |A| = 3.",
    },
    "div-6": {
      name: "Divisores de 6",
      description: "Los divisores de 6 con suma = mínimo común múltiplo, producto = máximo común divisor y x′ = 6 / x. El 0 es 1 y el 1 es 6.",
    },
    "div-8": {
      name: "Divisores de 8",
      description:
        "Los divisores de 8 con mcm, mcd y x′ = 8 / x. Ordenados por divisibilidad forman una cadena: 1 | 2 | 4 | 8.",
    },
    "div-12": {
      name: "Divisores de 12",
      description:
        "Los divisores de 12 con mcm, mcd y x′ = 12 / x. 12 tiene un factor primo repetido: mira con calma si todos los axiomas se cumplen.",
    },
    "div-30": {
      name: "Divisores de 30",
      description:
        "Los ocho divisores de 30 = 2 · 3 · 5 con mcm, mcd y x′ = 30 / x. El 0 es 1, el 1 es 30, y su diagrama de Hasse vuelve a ser un cubo.",
    },
    f2: {
      name: "F₂ (funciones de dos variables)",
      description:
        "Las 16 funciones f(x, y), escritas con su vector de verdad (f(0,0), f(0,1), f(1,0), f(1,1)) y operadas punto a punto. El 0 es 0000 y el 1 es 1111; es isomorfa a {0, 1}⁴.",
    },
  },
  product:
    "El producto B₁ × B₂ toma pares (x, y) y opera cada componente en su estructura. Elige dos estructuras: si el producto pasa de 16 elementos, no se construye.",
  custom:
    "Rellena tú las tablas de ⊕ y ⊙ y la fila de ′ para 2, 3 o 4 elementos. El 0 es el primer elemento y el 1, el último.",
};
