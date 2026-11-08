// Piezas compartidas del laboratorio de combinatoria: opciones a)–d) como en el examen (una sola
// respuesta), casillas para marcar varias, el campo de una respuesta numérica con la convención del
// examen (coma decimal, sin separador de miles) y el bloque de pseudocódigo. Reutiliza las cajas,
// pistas y avisos del laboratorio de álgebra lineal.
import { useId, type ReactNode } from "react";
import { commaWarning, MAX_ANSWER_TEXT, parseExamNumber } from "../../../../shared/discrete/answer.ts";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";

export { Hints, levelLabel, LEVELS, PracticeBox, plural, Status, Verdict } from "../linalg/common.tsx";
export { optionLetter } from "../../../../shared/exercises/discrete.ts";

const LETTERS = "abcdefgh";

export type Choice = { key: string; content: ReactNode };

/** Opciones de una sola respuesta, a), b), c), d). */
export function OptionList({
  legend,
  options,
  value,
  onChange,
  invalid = false,
  letters = true,
}: {
  legend: ReactNode;
  options: readonly Choice[];
  value: string | null;
  onChange: (key: string) => void;
  invalid?: boolean;
  letters?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-1" aria-invalid={invalid ? true : undefined}>
      <legend className="mb-1 text-[14px] font-semibold">{legend}</legend>
      {options.map((o, i) => (
        <label
          key={o.key}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-1",
            value === o.key ? (invalid ? "border-2 border-crit" : "border-accent bg-sunken") : "border-border",
          )}
        >
          <input type="radio" name={name} className="h-5 w-5 shrink-0" checked={value === o.key} onChange={() => onChange(o.key)} />
          {letters ? <span className="font-semibold">{`${LETTERS[i]})`}</span> : null}{" "}
          <span className="min-w-0 overflow-x-auto">{o.content}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Casillas para marcar todas las que se cumplan. */
export function CheckList({
  legend,
  options,
  value,
  onChange,
}: {
  legend: ReactNode;
  options: readonly Choice[];
  value: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-[14px] font-semibold">{legend}</legend>
      {options.map((o, i) => (
        <label key={o.key} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-1", value.has(o.key) ? "border-accent bg-sunken" : "border-border")}>
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0"
            checked={value.has(o.key)}
            onChange={(e) => {
              const next = new Set(value);
              if (e.target.checked) next.add(o.key);
              else next.delete(o.key);
              onChange(next);
            }}
          />
          <span className="font-semibold">{`${LETTERS[i]})`}</span>{" "}
          <span className="min-w-0">{o.content}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Sí / No, en una línea. */
export function YesNo({
  legend,
  value,
  onChange,
  invalid = false,
  labels = ["Sí", "No"],
}: {
  legend: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  invalid?: boolean;
  labels?: [string, string];
}) {
  const name = useId();
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1 rounded-md p-1", invalid && "border-2 border-crit")} aria-invalid={invalid ? true : undefined}>
      <legend className="text-[14px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-x-6">
        {([true, false] as const).map((v) => (
          <label key={String(v)} className="flex min-h-11 cursor-pointer items-center gap-2">
            <input type="radio" name={name} className="h-5 w-5" checked={value === v} onChange={() => onChange(v)} />
            {v ? labels[0] : labels[1]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Respuesta numérica como en el examen. Tras comprobar, si no se lee, dice por qué (separador de
 * miles, punto decimal…) con las cifras de la persona.
 */
export function ExamNumberField({ label, value, onChange, invalid = false, checked = false }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean; checked?: boolean }) {
  const id = useId();
  const parsed = value.trim() === "" ? null : parseExamNumber(value);
  const message = checked && parsed && !parsed.ok ? parsed.error : checked && invalid ? commaWarning(value) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <Input
        id={id}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className={cn("max-w-full font-mono sm:max-w-sm", invalid && "border-2 border-crit")}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-help`}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_ANSWER_TEXT))}
      />
      <p id={`${id}-help`} className="text-[14px] text-muted">
        {message ?? "Como en el examen: el número exacto, sin separador de miles (y, si hiciera falta, con coma decimal)."}
      </p>
    </div>
  );
}

/** Pseudocódigo con su sangría. */
export function CodeBlock({ lines, label }: { lines: readonly string[]; label: string }) {
  return (
    <pre tabIndex={0} aria-label={label} className="max-w-full overflow-x-auto rounded-md border border-border bg-sunken p-3 font-mono text-[15px] leading-relaxed">
      <code>{lines.join("\n")}</code>
    </pre>
  );
}

/** Enunciado. */
export function Statement({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">{children}</div>;
}
