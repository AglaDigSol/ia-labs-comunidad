// Public dictionary schema (no personal data, no links). Authored content only.

export type SymbolCategory =
  | "logica-proposicional"
  | "conjuntos"
  | "boole-fn"
  | "primer-orden"
  | "markov-algebra"
  | "tensorial";

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  "logica-proposicional",
  "conjuntos",
  "boole-fn",
  "primer-orden",
  "markov-algebra",
  "tensorial",
];

export const CATEGORY_LABELS: Record<SymbolCategory, string> = {
  "logica-proposicional": "Lógica proposicional",
  conjuntos: "Conjuntos",
  "boole-fn": "Álgebra de Boole y Fₙ",
  "primer-orden": "Lógica de primer orden",
  "markov-algebra": "Markov y álgebra lineal",
  tensorial: "Cálculo tensorial",
};

export interface NotationVariant {
  tex?: string;
  text?: string;
  /** Which convention uses it: "Apuntes", "Blackboard", "ASCII", "Computación"... */
  convention: string;
}

export interface CodeEquivalent {
  lib: "python" | "numpy" | "pytorch";
  code: string;
  note?: string;
}

export interface SymbolEntry {
  id: string;
  category: SymbolCategory;
  session: 1 | 2 | "posterior";
  name: string;
  aliases: string[];
  tex: string;
  variants: NotationVariant[];
  reading: string;
  altReadings?: string[];
  /** Plain Spanish words for text-to-speech: never symbols. */
  spoken: string;
  example?: { tex: string; reading: string; spoken: string };
  code: CodeEquivalent[];
  codeNote?: string;
  related?: string[];
}

type Required3 = "id" | "category" | "session" | "name" | "tex" | "reading" | "spoken";

/** Authoring helper: fills optional collections with empty defaults. */
export function sym(
  e: Pick<SymbolEntry, Required3> & Partial<Omit<SymbolEntry, Required3>>,
): SymbolEntry {
  return { aliases: [], variants: [], code: [], ...e };
}

/** Raw-string tag so TeX backslashes are written once. */
export const T = String.raw;
