import type { Notation } from "../../shared/logic/notation.ts";

// Convenciones de notación del laboratorio de lógica, elegidas para 02MIAR.
export const NOTATION_02MIAR: Notation = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Lógica proposicional y álgebras de Boole",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia a partir de la notación usada en la asignatura",
    updated: "2026-10-23",
  },
  truthValues: "10",
  oplus: {
    note: "En el álgebra de Boole de clase, ⊕ es la suma (∨). Aquí ⊕ se interpreta como disyunción exclusiva (⊻). Usa + o ∨ si querías la suma.",
    actionLabel: "Interpretar ⊕ como suma",
    replaceWith: "∨",
  },
  f1: [
    { name: "Id", values: [0, 1] },
    { name: "f", values: [0, 0] },
    { name: "g", values: [1, 1] },
    { name: "h", values: [1, 0] },
  ],
};
