// Campo de respuesta numérica neutro, como el de Blackboard: una etiqueta, el campo y la indicación de
// formato (coma decimal, redondeo), sin «Comprobar» ni marcas. Lo usa el simulacro de examen, que
// recoge la respuesta y corrige al final. Nunca lleva un texto de ejemplo dentro del campo.
// inputMode="text": el teclado decimal del iPad y del móvil no tiene signo menos ni «/», y muchas
// respuestas son negativas (−20, −2,25) o fracciones.
import { useId } from "react";
import { MAX_NUMERIC_ANSWER } from "../../../shared/exam/numeric.ts";
import { cn } from "../../lib/cn.ts";
import { Input } from "../ui/input.tsx";

export function NumericField({
  label,
  value,
  onChange,
  note,
  disabled = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Indicación de formato, debajo del campo (va en aria-describedby). */
  note?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[16px] font-semibold">
        {label}
      </label>
      <Input
        id={id}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={MAX_NUMERIC_ANSWER}
        className="w-full font-mono text-[18px] sm:w-64"
        aria-describedby={note ? `${id}-note` : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {note ? (
        <p id={`${id}-note`} className="text-[14px] text-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
