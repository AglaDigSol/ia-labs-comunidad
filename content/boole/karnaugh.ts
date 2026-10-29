// Laboratorio de álgebra de Boole: ejercicios de formas canónicas y mapas de Karnaugh. Contenido
// CC BY 4.0, elaboración propia: ninguno sale de diapositivas, apuntes ni actividades evaluables. Se
// valida con KarnaughPackSchema (tests/content.test.ts), que comprueba también que cada expresión se
// lee en modo Boole con 2, 3 o 4 variables y que ninguna función es constante.
//
// Cada ejercicio es una expresión con la notación de clase (⊕, ⊙, ′) o una función dada por sus
// listas: `ones` son los índices de Σm y `dontCares` los de d (las X del mapa), con la primera
// variable como bit alto.
import type { KarnaughPack } from "../../shared/boole/schema.ts";

export const KARNAUGH_PACK: KarnaughPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Álgebras de Boole: formas canónicas y mapas de Karnaugh",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-10-29",
  },
  exercises: [
    { id: "dos-columna", level: "básico", expr: "x′ ⊙ y ⊕ x ⊙ y" },
    { id: "dos-tres-unos", level: "básico", expr: "x ⊙ y′ ⊕ x′ ⊙ y′ ⊕ x ⊙ y" },
    { id: "tres-pareja-y-suelto", level: "básico", expr: "x ⊙ y′ ⊙ z′ ⊕ x ⊙ y′ ⊙ z ⊕ x′ ⊙ y ⊙ z" },
    { id: "tres-pares", level: "básico", vars: ["x", "y", "z"], ones: [0, 2, 4, 6], dontCares: [] },
    { id: "tres-producto", level: "medio", expr: "(x ⊕ y) ⊙ (x′ ⊕ z)" },
    { id: "tres-cinco-unos", level: "medio", vars: ["x", "y", "z"], ones: [1, 2, 3, 5, 7], dontCares: [] },
    { id: "tres-con-x", level: "medio", vars: ["x", "y", "z"], ones: [0, 4, 6], dontCares: [2] },
    { id: "cuatro-seis-unos", level: "medio", vars: ["w", "x", "y", "z"], ones: [0, 2, 5, 8, 10, 13], dontCares: [] },
    { id: "cuatro-sin-x", level: "medio", expr: "w′ ⊙ x′ ⊙ y′ ⊕ w ⊙ x′ ⊙ y′ ⊕ w′ ⊙ x′ ⊙ y ⊙ z′ ⊕ w ⊙ x′ ⊙ y ⊙ z′" },
    { id: "tres-ciclico", level: "avanzado", vars: ["x", "y", "z"], ones: [0, 1, 2, 5, 6, 7], dontCares: [] },
    { id: "cuatro-indiferencias", level: "avanzado", vars: ["w", "x", "y", "z"], ones: [1, 3, 7, 11, 15], dontCares: [0, 2, 5] },
    { id: "cuatro-mezcla", level: "avanzado", expr: "(w ⊕ x′) ⊙ (y ⊕ z) ⊕ w′ ⊙ x ⊙ y′ ⊙ z′" },
    { id: "cuatro-ocho-unos", level: "avanzado", vars: ["w", "x", "y", "z"], ones: [1, 5, 6, 7, 9, 13, 14, 15], dontCares: [] },
    { id: "cuatro-casi-todo", level: "avanzado", vars: ["w", "x", "y", "z"], ones: [0, 1, 2, 3, 5, 8, 9, 10, 11], dontCares: [7, 13] },
  ],
};
