// Diccionario de símbolos (contenido, CC BY-SA 4.0). Para añadir un símbolo, edita el fichero de su
// bloque; para añadir un bloque nuevo, crea un fichero junto a estos y añádelo a esta lista.
// tests/content.test.ts valida cada paquete con SymbolPackSchema (shared/symbols/schema.ts).
import type { ContentMeta } from "../../shared/content/meta.ts";
import type { SymbolEntry } from "../../shared/symbols/types.ts";
import { LOGICA_SYMBOLS } from "./logica.ts";
import { MARKOV_TENSORIAL_SYMBOLS } from "./markov-tensorial.ts";
import { PREDICADOS_CONJUNTOS_SYMBOLS } from "./predicados-conjuntos.ts";

export type SymbolPack = { file: string; meta: ContentMeta; entries: SymbolEntry[] };

const BASE = {
  subject: "02MIAR · Matemáticas para la Inteligencia Artificial",
  level: "máster",
  language: "es",
  author: "Comunidad IA Labs",
  license: "CC-BY-SA-4.0",
  source: "Elaboración propia",
  updated: "2026-10-23",
} as const;

export const SYMBOL_PACKS: SymbolPack[] = [
  { file: "logica.ts", meta: { ...BASE, topic: "Lógica proposicional y álgebras de Boole" }, entries: LOGICA_SYMBOLS },
  {
    file: "predicados-conjuntos.ts",
    meta: { ...BASE, topic: "Lógica de primer orden y conjuntos" },
    entries: PREDICADOS_CONJUNTOS_SYMBOLS,
  },
  {
    file: "markov-tensorial.ts",
    meta: { ...BASE, topic: "Cadenas de Markov, álgebra lineal y cálculo tensorial" },
    entries: MARKOV_TENSORIAL_SYMBOLS,
  },
];
