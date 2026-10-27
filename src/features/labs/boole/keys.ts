// Teclas y textos compartidos por las secciones de circuitos y de Fₙ.
import type { KeypadKey } from "../logic/FormulaInput.tsx";

export const BOOLE_KEYS: KeypadKey[] = [
  { glyph: "⊕", label: "suma" },
  { glyph: "⊙", label: "producto" },
  { glyph: "′", label: "complemento" },
  { glyph: "0", label: "cero" },
  { glyph: "1", label: "uno" },
  { glyph: "(", label: "abrir paréntesis" },
  { glyph: ")", label: "cerrar paréntesis" },
];

/** Las de Boole más ⊻ (XOR), para describir circuitos. */
export const BOOLE_XOR_KEYS: KeypadKey[] = [...BOOLE_KEYS.slice(0, 3), { glyph: "⊻", label: "o exclusivo (XOR)" }, ...BOOLE_KEYS.slice(3)];

/** «x = 1, y = 0». */
export const rowText = (vars: string[], values: boolean[]) => vars.map((v, i) => `${v} = ${values[i] ? 1 : 0}`).join(", ");
