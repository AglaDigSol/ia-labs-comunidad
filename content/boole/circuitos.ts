// Laboratorio de álgebra de Boole: circuitos para «Circuito → función». Contenido CC BY 4.0,
// elaboración propia: ninguno sale de diapositivas, apuntes ni actividades evaluables. Se valida con
// CircuitPackSchema (tests/content.test.ts), que comprueba también que no hay ciclos y que `table`
// (la columna f de la tabla de verdad) coincide con lo que calcula el circuito.
//
// Formato de cada puerta: { id: "g1", type, inputs }, con type = or, and, xor, not, nor, nand o xnor
// y entradas que son variables del circuito, otras puertas o las constantes 0 y 1.
import type { CircuitPack } from "../../shared/boole/schema.ts";

export const CIRCUIT_PACK: CircuitPack = {
  meta: {
    subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
    topic: "Álgebras de Boole: puertas y circuitos",
    level: "máster",
    language: "es",
    author: "Comunidad IA Labs",
    license: "CC-BY-4.0",
    source: "Elaboración propia",
    updated: "2026-10-27",
  },
  circuits: [
    {
      id: "dos-caminos",
      title: "Dos caminos hacia la suma",
      level: "básico",
      inputs: ["x", "y"],
      gates: [
        { id: "g1", type: "not", inputs: ["x"] },
        { id: "g2", type: "and", inputs: ["g1", "y"] },
        { id: "g3", type: "or", inputs: ["g2", "x"] },
      ],
      output: "g3",
      table: "0111",
    },
    {
      id: "negar-y-sumar",
      title: "Negar antes de sumar",
      level: "básico",
      inputs: ["x", "y"],
      gates: [
        { id: "g1", type: "not", inputs: ["y"] },
        { id: "g2", type: "nor", inputs: ["x", "g1"] },
      ],
      output: "g2",
      table: "0100",
    },
    {
      id: "producto-contra-nand",
      title: "Un producto frente a un NAND",
      level: "básico",
      inputs: ["x", "y", "z"],
      gates: [
        { id: "g1", type: "and", inputs: ["x", "y"] },
        { id: "g2", type: "nand", inputs: ["y", "z"] },
        { id: "g3", type: "xor", inputs: ["g1", "g2"] },
      ],
      output: "g3",
      table: "11101101",
    },
    {
      id: "filtro-de-y",
      title: "Filtro con y apagada",
      level: "medio",
      inputs: ["x", "y", "z"],
      gates: [
        { id: "g1", type: "or", inputs: ["x", "z"] },
        { id: "g2", type: "not", inputs: ["y"] },
        { id: "g3", type: "and", inputs: ["g1", "g2"] },
        { id: "g4", type: "xnor", inputs: ["g3", "x"] },
      ],
      output: "g4",
      table: "10111100",
    },
    {
      id: "puerta-de-z",
      title: "z deja pasar",
      level: "medio",
      inputs: ["x", "y", "z"],
      gates: [
        { id: "g1", type: "nand", inputs: ["x", "y"] },
        { id: "g2", type: "nor", inputs: ["y", "z"] },
        { id: "g3", type: "or", inputs: ["g1", "g2"] },
        { id: "g4", type: "and", inputs: ["g3", "z"] },
      ],
      output: "g4",
      table: "01010100",
    },
    {
      id: "paridad-negada",
      title: "Paridad negada con y",
      level: "medio",
      inputs: ["x", "y", "z"],
      gates: [
        { id: "g1", type: "xor", inputs: ["x", "z"] },
        { id: "g2", type: "not", inputs: ["g1"] },
        { id: "g3", type: "and", inputs: ["g2", "y"] },
        { id: "g4", type: "nor", inputs: ["x", "y"] },
        { id: "g5", type: "or", inputs: ["g3", "g4"] },
      ],
      output: "g5",
      table: "11100001",
    },
    {
      id: "cuatro-entradas",
      title: "Cuatro entradas, dos ramas",
      level: "avanzado",
      inputs: ["x", "y", "z", "w"],
      gates: [
        { id: "g1", type: "and", inputs: ["x", "w"] },
        { id: "g2", type: "nor", inputs: ["y", "z"] },
        { id: "g3", type: "or", inputs: ["g1", "g2"] },
        { id: "g4", type: "xor", inputs: ["y", "w"] },
        { id: "g5", type: "nand", inputs: ["g3", "g4"] },
      ],
      output: "g5",
      table: "1011111110101111",
    },
    {
      id: "seis-puertas",
      title: "Seis puertas y un AND de tres",
      level: "avanzado",
      inputs: ["x", "y", "z", "w"],
      gates: [
        { id: "g1", type: "not", inputs: ["w"] },
        { id: "g2", type: "and", inputs: ["x", "y", "g1"] },
        { id: "g3", type: "nand", inputs: ["z", "w"] },
        { id: "g4", type: "xnor", inputs: ["x", "z"] },
        { id: "g5", type: "or", inputs: ["g2", "g4"] },
        { id: "g6", type: "and", inputs: ["g5", "g3"] },
      ],
      output: "g6",
      table: "1100110000101010",
    },
  ],
};
