// Piezas compartidas por las secciones del laboratorio de conjuntos: teclado de símbolos, campo de
// expresión con su teclado, subexpresiones para las pistas y el aviso de estado.
import { Keyboard } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { normalizeSet, setToPlain, type SetExpr } from "../../../../shared/sets/expr.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { FormulaField, SymbolKeypad, type KeypadKey } from "../logic/FormulaInput.tsx";

export const SET_KEYS: KeypadKey[] = [
  { glyph: "∪", label: "unión" },
  { glyph: "∩", label: "intersección" },
  { glyph: "∖", label: "diferencia" },
  { glyph: "Δ", label: "diferencia simétrica" },
  { glyph: "ᶜ", label: "complementario" },
  { glyph: "∅", label: "conjunto vacío" },
  { glyph: "U", label: "conjunto universal" },
  { glyph: "A", label: "conjunto A" },
  { glyph: "B", label: "conjunto B" },
  { glyph: "C", label: "conjunto C" },
  { glyph: "(", label: "abrir paréntesis" },
  { glyph: ")", label: "cerrar paréntesis" },
];

export const HOW_TO_WRITE =
  "Unión: ∪ o |. Intersección: ∩ o &. Diferencia: ∖, \\ o −. Diferencia simétrica: Δ o ^. Complementario: ᶜ, ′ o ' detrás (Aᶜ, (A ∪ B)ᶜ). Vacío: ∅ o {}. Universal: U. Entre operaciones distintas hacen falta paréntesis: (A ∪ B) ∩ C.";

/** Campo de expresión de conjuntos con su teclado de símbolos plegable. */
export function SetExprField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = "(A ∪ B) ∩ Cᶜ",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: ParseError | null;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [keypad, setKeypad] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <FormulaField id={id} label={label} value={value} onChange={onChange} error={error} inputRef={ref} placeholder={placeholder} notation="boole" />
      <button
        type="button"
        aria-pressed={keypad}
        onClick={() => setKeypad((k) => !k)}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
      >
        <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
        Teclado de símbolos
      </button>
      {keypad ? <SymbolKeypad targetRef={ref} onChange={onChange} keys={SET_KEYS} vars={[]} moreVars={[]} /> : null}
    </div>
  );
}

/** Subexpresiones compuestas, de dentro hacia fuera (sin repetir), para la pista «trabaja por partes». */
export function subexpressions(e: SetExpr): string[] {
  const out: string[] = [];
  const walk = (x: SetExpr) => {
    if (x.k === "comp") walk(x.a);
    else if (x.k === "union" || x.k === "inter") x.args.forEach(walk);
    else if (x.k === "diff" || x.k === "sym") {
      walk(x.a);
      walk(x.b);
    } else return;
    const s = setToPlain(normalizeSet(x));
    if (!out.includes(s)) out.push(s);
  };
  walk(e);
  return out;
}

/** Qué hace cada operación que aparece en la expresión (pista que nunca dice qué regiones van). */
export function operationRules(e: SetExpr): string[] {
  const used = new Set<SetExpr["k"]>();
  const walk = (x: SetExpr) => {
    used.add(x.k);
    if (x.k === "comp") walk(x.a);
    else if (x.k === "union" || x.k === "inter") x.args.forEach(walk);
    else if (x.k === "diff" || x.k === "sym") {
      walk(x.a);
      walk(x.b);
    }
  };
  walk(e);
  const rules: Array<[SetExpr["k"], string]> = [
    ["union", "X ∪ Y: lo que está en X, en Y o en los dos."],
    ["inter", "X ∩ Y: lo que está a la vez en X y en Y."],
    ["diff", "X ∖ Y: lo que está en X y no en Y."],
    ["sym", "X Δ Y: lo que está en uno solo de los dos."],
    ["comp", "Xᶜ: todo lo del universo U que no está en X."],
  ];
  return rules.filter(([k]) => used.has(k)).map(([, t]) => t);
}

export type Tone = "ok" | "warn" | "crit";

/** Mensajes de corrección, en una región viva para lectores de pantalla. */
export function Status({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-start gap-1 text-[14px]", className)}>
      {children}
    </div>
  );
}

export function Verdict({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Chip tone={tone} className="whitespace-normal">
      {children}
    </Chip>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
