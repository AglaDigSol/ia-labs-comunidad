// Piezas compartidas del laboratorio de probabilidad: el campo de una respuesta numérica (marcado sin
// decir el valor), el estado de unos campos tras «Comprobar», el resumen de la corrección con los
// avisos del formato del examen (dos decimales y coma), las opciones a)–d) y cómo se escriben los
// datos de un enunciado. Reutiliza las cajas, pistas y avisos de los otros laboratorios.
import { Check, OctagonAlert } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { answerFeedback, PROB_ANSWER_HELP, type AnswerState } from "../../../../shared/probability/answer.ts";
import { probTex, probText, probWithDecimal, probWithDecimalTex } from "../../../../shared/probability/format.ts";
import { formatDecimal, type Frac } from "../../../../shared/rational.ts";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { Verdict } from "../linalg/common.tsx";

export { Hints, levelLabel, LEVELS, PracticeBox, Status, Verdict } from "../linalg/common.tsx";
export { Statement } from "../calculus/common.tsx";

export const MAX_ANSWER_TEXT = 32;

/** ¿Se escribe como decimal en el enunciado? Si el denominador divide a 100 (0,25; 0,05); si no, fracción. */
const isShortDecimal = (x: Frac) => 100n % x.d === 0n;

/** Un dato del enunciado, en TeX: 0{,}25 o \frac{1}{3}. */
export const dataTex = (x: Frac): string => (isShortDecimal(x) ? formatDecimal(x, 2).text.replace("−", "-").replace(",", "{,}") : probTex(x));
/** Lo mismo, en texto: «0,25» o «1/3». */
export const dataText = (x: Frac): string => (isShortDecimal(x) ? formatDecimal(x, 2).text : probText(x));
/** Un porcentaje: «12 %». */
export const percentText = (x: Frac): string => `${formatDecimal({ n: x.n * 100n, d: x.d }, 2).text} %`;

export { probWithDecimal, probWithDecimalTex };

/** Ayuda de escritura de las respuestas (una vez por práctica). */
export function AnswerHelp({ id }: { id?: string }) {
  return (
    <p id={id} className="text-[14px] text-muted">
      {PROB_ANSWER_HELP}
    </p>
  );
}

/** Un campo de respuesta numérica con su etiqueta. Marcado (borde, icono y aria-invalid) sin decir el valor. */
export function AnswerField({
  label,
  labelNode,
  value,
  onChange,
  invalid = false,
  className,
  describedBy,
  hideLabel = false,
}: {
  /** La etiqueta solo para lectores de pantalla (en una tabla, la dan las cabeceras). */
  hideLabel?: boolean;
  /** Nombre accesible: «P(C | S₁)». */
  label: string;
  /** Lo que se ve como etiqueta (por defecto, `label`). */
  labelNode?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[14px] font-semibold"}>
        <span aria-hidden={labelNode ? true : undefined}>{labelNode ?? label}</span>
        {labelNode ? <span className="sr-only">{label}</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          autoComplete="off"
          spellCheck={false}
          inputMode="decimal"
          aria-label={label}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_ANSWER_TEXT))}
          className={cn(
            "h-11 w-full min-w-0 rounded-md border bg-sunken px-3 font-mono text-[16px] text-fg",
            invalid ? "border-2 border-crit pl-7" : "border-border",
          )}
        />
        {invalid ? <OctagonAlert size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-2 top-3.5 text-crit" /> : null}
      </div>
    </div>
  );
}

export type Graded<K extends string> = {
  states: Record<K, AnswerState>;
  notes: string[];
  ok: number;
  total: number;
  allOk: boolean;
};

/** Corrige varios campos: estado de cada uno y avisos (sin repetir). */
export function gradeFields<K extends string>(values: Record<K, string>, expected: Record<K, Frac | number>, digits?: number): Graded<K> {
  const states = {} as Record<K, AnswerState>;
  const notes = new Set<string>();
  let ok = 0;
  const keys = Object.keys(expected) as K[];
  for (const k of keys) {
    const f = answerFeedback(values[k] ?? "", expected[k], digits);
    states[k] = f.state;
    if (f.state === "bien") ok++;
    f.notes.forEach((n) => notes.add(n));
  }
  return { states, notes: [...notes], ok, total: keys.length, allOk: ok === keys.length };
}

/** Valores de unos campos, con «Comprobar» que se borra al cambiar cualquiera. */
export function useFields<K extends string>(keys: readonly K[]) {
  const [values, setValues] = useState<Record<K, string>>(() => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>);
  const [checked, setChecked] = useState(false);
  return {
    values,
    checked,
    set: (k: K, v: string) => {
      setValues((prev) => ({ ...prev, [k]: v }));
      setChecked(false);
    },
    check: () => setChecked(true),
    touch: () => setChecked(false),
  };
}

/** «Comprobar». */
export function CheckButton({ onClick, label = "Comprobar" }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="primary" onClick={onClick}>
      <Check size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Resumen de la corrección: «3 de 5 bien», qué campos no se leen y los avisos del formato. */
export function GradeSummary({ graded, solved, extra, success }: { graded: Graded<string>; solved: boolean; extra?: ReactNode; success: ReactNode }) {
  const unreadable = Object.values(graded.states).filter((s) => s === "ilegible").length;
  const empty = Object.values(graded.states).filter((s) => s === "vacío").length;
  return (
    <>
      {solved ? (
        <Verdict tone="ok">
          <Check size={16} aria-hidden="true" />
          {success}
        </Verdict>
      ) : (
        <Verdict tone="warn">{`${graded.ok} de ${graded.total} bien. Revisa los campos marcados.`}</Verdict>
      )}
      {empty > 0 && !solved ? <span>{empty === 1 ? "Hay un campo vacío." : `Hay ${empty} campos vacíos.`}</span> : null}
      {unreadable > 0 ? <span className="text-crit">{`${unreadable === 1 ? "Un campo no se lee" : `${unreadable} campos no se leen`} como número: escribe una fracción (3/8), un decimal (0,38) o un porcentaje.`}</span> : null}
      {extra}
      {graded.notes.map((n) => (
        <span key={n}>{n}</span>
      ))}
    </>
  );
}


const LETTERS = ["a", "b", "c", "d", "e", "f"];
export const optionLetter = (i: number) => LETTERS[i] ?? String(i + 1);

/**
 * Opciones a), b), c), d): de una sola respuesta (radio) o «la o las correctas» (casillas). Cada
 * opción ocupa al menos 44 px de alto.
 */
export function Options({
  legend,
  options,
  multi,
  selected,
  onChange,
  name,
}: {
  legend: string;
  options: Array<{ key: string; node: ReactNode; label: string }>;
  multi: boolean;
  selected: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  name: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[14px] font-semibold">{legend}</legend>
      {options.map((o, i) => (
        <label key={o.key} className="flex min-h-11 items-center gap-3 rounded-md px-1 hover:bg-sunken">
          <input
            type={multi ? "checkbox" : "radio"}
            name={name}
            aria-label={`${optionLetter(i)}) ${o.label}`}
            checked={selected.has(i)}
            onChange={(e) => {
              const next = multi ? new Set(selected) : new Set<number>();
              if (e.target.checked) next.add(i);
              else next.delete(i);
              onChange(next);
            }}
            className="h-5 w-5 shrink-0"
          />
          <span className="font-mono text-[14px] font-semibold" aria-hidden="true">{`${optionLetter(i)})`}</span>
          <span aria-hidden="true" className="min-w-0">
            {o.node}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Una línea de la solución en KaTeX, con su lectura. */
export function SolutionLine({ tex, label }: { tex: string; label: string }) {
  return <Tex display tex={tex} label={label} className="text-[16px]" />;
}

/** Caja de la solución. */
export function SolutionBox({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-[16px]">{children}</div>;
}

/** «un dado equilibrado», «un dado trucado en el que cada cara impar es el doble de probable que cada cara par»… */
export function loadedDieText(odd: number, even: number): string {
  if (odd === even) return "un dado equilibrado";
  const times = (k: number) => (k === 2 ? "el doble de" : k === 3 ? "el triple de" : `${k} veces más`);
  if (odd % even === 0) return `un dado trucado en el que cada cara impar es ${times(odd / even)} probable que cada cara par`;
  if (even % odd === 0) return `un dado trucado en el que cada cara par es ${times(even / odd)} probable que cada cara impar`;
  return `un dado trucado en el que cada cara impar y cada cara par tienen probabilidades en proporción ${odd} : ${even}`;
}
