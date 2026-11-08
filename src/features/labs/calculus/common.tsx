// Piezas compartidas del laboratorio de cálculo: el campo para escribir una función (con el error del
// analizador subrayado y «Se lee: …» en notación de libro), la función en KaTeX con su lectura, el
// campo de un número y el enunciado de cada práctica. Reutiliza las cajas, pistas y avisos del
// laboratorio de álgebra lineal.
import { useId, useRef, useState } from "react";
import { toPlain, toSpoken, toTex, type Expr, type VarName } from "../../../../shared/calculus/expr.ts";
import { HOW_TO_WRITE_FUNCTION, parseExpr, type CalcParse } from "../../../../shared/calculus/parser.ts";
import { parseNumberAnswer } from "../../../../shared/calculus/integrals.ts";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField } from "../logic/FormulaInput.tsx";

export { Hints, levelLabel, LEVELS, PracticeBox, Status, Verdict } from "../linalg/common.tsx";

export const MAX_FN_TEXT = 200;

/** Lee lo que escribe la persona, quitando un «f(x) =» o «y =» delante si lo pone. */
export function readFunction(text: string, opts: { vars?: readonly VarName[]; allowPrime?: boolean } = {}): CalcParse {
  const m = /^\s*(?:[fFy]\s*['′]?\s*(?:\(\s*x\s*(?:,\s*y\s*)?\))?|[∂∇][^=]*)\s*=\s*/.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  const r = parseExpr(body, opts);
  if (r.ok || !m) return r;
  // Las posiciones del error, sobre el texto completo.
  return { ok: false, error: { ...r.error, start: r.error.start + m[0].length, end: r.error.end + m[0].length } };
}

/** La función en KaTeX, con su lectura en texto para lectores de pantalla. */
export function FnTex({ e, lhs, display = false, className }: { e: Expr; lhs?: string; display?: boolean; className?: string }) {
  const tex = lhs ? `${lhs} = ${toTex(e)}` : toTex(e);
  return <Tex tex={tex} display={display} label={`${lhs ? `${lhs.replace(/\\[a-z]+/g, "").replace(/[{}]/g, "")} = ` : ""}${toSpoken(e)}`} className={className} />;
}

/**
 * Campo para escribir una función. Debajo dice cómo la ha leído (en notación de libro), para ver
 * enseguida si 1/2x es (1/2)·x o 1/(2x).
 */
export function FunctionField({
  id,
  label,
  value,
  onChange,
  vars = ["x"],
  allowPrime = false,
  placeholder,
  invalid = false,
  showPreview = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  vars?: readonly VarName[];
  allowPrime?: boolean;
  placeholder?: string;
  /** Marcado como incorrecto tras comprobar (sin decir el valor). */
  invalid?: boolean;
  showPreview?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const parsed = value.trim() === "" ? null : readFunction(value, { vars, allowPrime });
  const error = parsed && !parsed.ok ? parsed.error : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FormulaField
        id={id}
        label={label}
        value={value}
        onChange={(v) => onChange(v.slice(0, MAX_FN_TEXT))}
        error={error}
        inputRef={ref}
        // Sin el «p → q» de lógica que FormulaField pone por defecto: un ejemplo de cálculo.
        placeholder={placeholder ?? (vars.length === 2 ? "p. ej. 2x·y + y^2" : "p. ej. 3x^2 + cos(x)")}
        notation="calculo"
        invalid={invalid}
      />
      {showPreview && parsed?.ok ? (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px] text-muted" aria-live="polite">
          Se lee:
          <span className="max-w-full overflow-x-auto text-[16px] text-fg">
            <Tex tex={toTex(parsed.expr)} label={toPlain(parsed.expr)} />
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Ayuda de escritura, plegada. */
export function HowToWrite({ extra }: { extra?: string }) {
  return (
    <details className="text-[14px] text-muted">
      <summary className="flex min-h-11 cursor-pointer items-center">Cómo se escribe</summary>
      <p>{`${HOW_TO_WRITE_FUNCTION}${extra ? ` ${extra}` : ""}`}</p>
    </details>
  );
}

/** Un número (o una expresión sin x: π/4, ln 2, e − 1) con su etiqueta. */
export function NumberField({
  label,
  value,
  onChange,
  invalid = false,
  placeholder,
  className,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  describedBy?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <Input
        id={id}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        className={cn("font-mono", invalid && "border-2 border-crit")}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 60))}
      />
    </div>
  );
}

/** Lee un número escrito: devuelve su valor o null. */
export function readNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const r = parseNumberAnswer(text);
  return r.ok ? r.value : null;
}

/** Enunciado de un ejercicio. */
export function Statement({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">{children}</div>;
}

/** Estado de un campo tras «Comprobar»: sin comprobar, bien o mal. */
export type FieldState = "idle" | "ok" | "bad";

/** Recuerda la última versión comprobada de unos campos: si cambian, se vuelve a «sin comprobar». */
export function useChecked<T>(values: T) {
  const key = JSON.stringify(values);
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  return { checked: checkedKey === key, check: () => setCheckedKey(key), reset: () => setCheckedKey(null) };
}
