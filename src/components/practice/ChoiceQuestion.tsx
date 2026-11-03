// Preguntas de opción múltiple como las del examen (Blackboard Ultra): «opción múltiple» con cuatro
// opciones a)–d) y una correcta (lo normal) y, como variantes, cinco con «Ninguna de las otras» o
// «selecciona la o las correctas». Dos piezas:
//
// - ChoiceOptions: solo las opciones (radios o casillas), controladas desde fuera. Es lo que usará el
//   simulador de examen, que recoge las respuestas y corrige al final.
// - ChoicePractice: las opciones con «Comprobar», el aviso (sin decir cuál es la buena) y la solución
//   detrás de SolutionGate. Es lo que usan los laboratorios y el banco de ejercicios.
//
// Los datos y la corrección están en shared/exercises/choice.ts (arrangeChoices, gradeChoice).
import { Check, CircleCheck, CircleX } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  arrangeChoices,
  gradeChoice,
  toggleChoice,
  type ArrangedOption,
  type ChoiceMode,
  type ChoiceQuestion,
} from "../../../shared/exercises/choice.ts";
import { cn } from "../../lib/cn.ts";
import { Tex } from "../../lib/tex.tsx";
import { Button } from "../ui/button.tsx";
import { Chip } from "../ui/chip.tsx";
import { SolutionGate } from "./SolutionGate.tsx";

/** Indicación que acompaña a la pregunta según el modo. */
export const CHOICE_INSTRUCTIONS: Record<ChoiceMode, string> = {
  single: "Elige una sola opción.",
  multi: "Selecciona la o las correctas (puede haber más de una).",
};

/** El contenido de una opción: su fórmula (con lectura) o su texto. */
export function OptionContent({ option }: { option: Pick<ArrangedOption, "text" | "tex"> }) {
  return option.tex ? <Tex tex={option.tex} label={option.text} /> : <span>{option.text}</span>;
}

/**
 * Las opciones de una pregunta, controladas: `value` son los ids elegidos. Con `marks` (tras corregir
 * un examen, por ejemplo) cada opción enseña si está bien o mal; sin ellas no se dice nada.
 */
export function ChoiceOptions({
  legend,
  options,
  mode,
  value,
  onChange,
  disabled = false,
  marks,
  describedBy,
}: {
  legend: ReactNode;
  options: readonly ArrangedOption[];
  mode: ChoiceMode;
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  marks?: Readonly<Record<string, "ok" | "bad">>;
  describedBy?: string;
}) {
  const uid = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={describedBy}>
      <legend className="mb-1 text-[16px] font-semibold">{legend}</legend>
      <p className="text-[14px] text-muted">{CHOICE_INSTRUCTIONS[mode]}</p>
      {options.map((o) => {
        const checked = value.includes(o.id);
        const mark = marks?.[o.id];
        return (
          <label
            key={o.id}
            className={cn(
              "flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-md border bg-raised px-3 py-2 text-[16px] hover:bg-sunken",
              checked ? "border-2 border-accent" : "border-border",
              mark === "ok" && "border-ok",
              mark === "bad" && "border-crit",
              disabled && "cursor-default opacity-80",
            )}
          >
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={`${uid}-choice`}
              className="mt-1 size-5 shrink-0 accent-accent"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(toggleChoice(mode, value, o.id))}
            />
            <span className="w-7 shrink-0 font-semibold">{`${o.letter})`}</span>{" "}
            <span className="min-w-0 max-w-full overflow-x-auto">
              <OptionContent option={o} />
            </span>
            {mark ? (
              mark === "ok" ? (
                <CircleCheck size={18} className="ml-auto mt-1 shrink-0 text-ok" aria-label="Bien" />
              ) : (
                <CircleX size={18} className="ml-auto mt-1 shrink-0 text-crit" aria-label="Mal" />
              )
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}

/** La solución: cada opción con su letra, si es correcta y por qué. */
export function ChoiceSolution({ options }: { options: readonly ArrangedOption[] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]" aria-label="Solución opción a opción">
      {options.map((o) => (
        <li key={o.id} className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <Chip tone={o.correct ? "ok" : "outline"}>{`${o.letter}) ${o.correct ? "Correcta" : "No"}`}</Chip>
            <span className="max-w-full overflow-x-auto text-[16px]">
              <OptionContent option={o} />
            </span>
          </span>
          {o.why ? <span className="text-muted">{o.why}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pregunta de práctica: opciones barajadas con `seedKey`, «Comprobar» y un aviso que nunca dice cuál es
 * la buena. `actions` se pone junto a «Comprobar» (por ejemplo, las pistas); `solution` sustituye a la
 * solución por defecto (ChoiceSolution), y `extraSolution` va debajo de ella.
 */
export function ChoicePractice({
  legend,
  question,
  seedKey,
  onSolved,
  actions,
  solution,
  extraSolution,
}: {
  legend: ReactNode;
  question: ChoiceQuestion;
  seedKey: string | number;
  onSolved?: () => void;
  actions?: ReactNode;
  solution?: ReactNode;
  extraSolution?: ReactNode;
}) {
  const options = useMemo(() => arrangeChoices(question, seedKey), [question, seedKey]);
  const [value, setValue] = useState<string[]>([]);
  const [checked, setChecked] = useState<string | null>(null);
  const key = value.join("|");
  const grade = gradeChoice(options, value);
  const showing = checked === key;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ChoiceOptions legend={legend} options={options} mode={question.mode} value={value} onChange={setValue} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(key);
            if (value.length > 0 && grade.correct) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        {actions}
      </div>
      <div role="status" className="flex flex-col items-start gap-1 text-[14px]">
        {showing ? (
          value.length === 0 ? (
            <Chip tone="warn" className="whitespace-normal">
              {question.mode === "single" ? "Elige una opción." : "Marca al menos una opción."}
            </Chip>
          ) : grade.correct ? (
            <Chip tone="ok" className="whitespace-normal">
              <Check size={16} aria-hidden="true" />
              {question.mode === "single" ? "¡Correcto!" : "¡Correcto! Has marcado todas las correctas y ninguna más."}
            </Chip>
          ) : (
            <Chip tone="warn" className="whitespace-normal">
              {question.mode === "single"
                ? "No es esa. Repasa la regla y vuelve a mirar cada opción."
                : "Aún no: sobra alguna marcada o falta alguna. Decide cada afirmación por separado."}
            </Chip>
          )
        ) : null}
      </div>
      <SolutionGate resetKey={String(seedKey)}>
        <div className="flex flex-col gap-3">
          {solution ?? <ChoiceSolution options={options} />}
          {extraSolution}
        </div>
      </SolutionGate>
    </div>
  );
}
