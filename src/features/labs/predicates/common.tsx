// Piezas comunes del laboratorio de predicados: el campo de fórmula con su teclado, los textos de los
// valores de verdad y la descripción de una interpretación («P = {2, 4}; M = {(1, 2)}»).
import { Keyboard } from "lucide-react";
import { useRef, useState } from "react";
import type { PredInterpretation } from "../../../../shared/predicates/evaluate.ts";
import type { PredParseError } from "../../../../shared/predicates/parser.ts";
import { FormulaField, SymbolKeypad, type KeypadKey } from "../logic/FormulaInput.tsx";

/** Como mucho 5 elementos: la rejilla de un predicado binario tiene 25 casillas. */
export const MAX_UI_DOMAIN = 5;

export const truthWord = (v: boolean) => (v ? "verdadera" : "falsa");
export const truthLetter = (v: boolean) => (v ? "V" : "F");

const QUANT_KEYS: KeypadKey[] = [
  { glyph: "∀", label: "para todo" },
  { glyph: "∃", label: "existe" },
  { glyph: "¬", label: "negación" },
  { glyph: "∧", label: "conjunción" },
  { glyph: "∨", label: "disyunción" },
  { glyph: "→", label: "implicación" },
  { glyph: "↔", label: "bicondicional" },
  { glyph: "(", label: "abrir paréntesis" },
  { glyph: ")", label: "cerrar paréntesis" },
  { glyph: ",", label: "coma" },
];

/** Teclas del teclado de símbolos: cuantificadores, conectivas y los predicados que se usan. */
export const predicateKeys = (predicates: string[]): KeypadKey[] => [
  ...QUANT_KEYS,
  ...predicates.map((p) => ({ glyph: p, label: `predicado ${p}` })),
];

/** Campo de fórmula con el teclado de símbolos (∀, ∃, conectivas, predicados y variables). */
export function PredicateField({
  id,
  label,
  value,
  onChange,
  error,
  predicates,
  placeholder = "∀x (P(x) → Q(x))",
  keypadOpen = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error: PredParseError | null;
  predicates: string[];
  placeholder?: string;
  keypadOpen?: boolean;
}) {
  const [keypad, setKeypad] = useState(keypadOpen);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <FormulaField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        error={error}
        inputRef={ref}
        placeholder={placeholder}
        notation="predicados"
      />
      <button
        type="button"
        aria-pressed={keypad}
        onClick={() => setKeypad((k) => !k)}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
      >
        <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
        Teclado de símbolos
      </button>
      {keypad ? (
        <SymbolKeypad targetRef={ref} onChange={onChange} keys={predicateKeys(predicates)} vars={["x", "y", "z"]} moreVars={["u", "v", "w"]} />
      ) : null}
    </div>
  );
}

const set = (items: string[]) => (items.length === 0 ? "∅" : `{${items.join(", ")}}`);

/** «P = {2, 4}; M = {(1, 2), (2, 3)}» para los predicados indicados. */
export function describeInterpretation(interp: PredInterpretation, predicates: Array<{ name: string; arity: number }>): string {
  return predicates
    .map((p) => {
      const ext = interp.predicates[p.name] ?? [];
      return `${p.name} = ${set(ext.map((t) => (p.arity === 1 ? t[0]! : `(${t.join(", ")})`)))}`;
    })
    .join("; ");
}

export const describeDomain = (domain: readonly string[]) => set([...domain]);
