// «Comprueba tu respuesta» al comparar dos fórmulas: ¿son equivalentes? y ¿en cuántas filas difieren?
import { Check, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Input } from "../../../components/ui/input.tsx";

export function ComparePractice({ equivalent, differing, total, resetKey }: { equivalent: boolean; differing: number; total: number; resetKey: string }) {
  const [answer, setAnswer] = useState<"si" | "no" | null>(null);
  const [rows, setRows] = useState("");
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setAnswer(null);
    setRows("");
    setChecked(false);
    setHint(false);
  }, [resetKey]);

  const okEq = answer !== null && (answer === "si") === equivalent;
  const n = Number(rows.trim());
  const okRows = rows.trim() !== "" && Number.isInteger(n) && n === differing;

  return (
    <section aria-labelledby="compare-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="compare-practice-title" className="font-display text-[20px] font-semibold">
        Comprueba tu respuesta
      </h2>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-[14px] font-semibold">¿Son equivalentes A y B?</legend>
        {(["si", "no"] as const).map((v) => (
          <label key={v} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="equivalentes"
              checked={answer === v}
              onChange={() => {
                setAnswer(v);
                setChecked(false);
              }}
            />
            {v === "si" ? "Sí" : "No"}
          </label>
        ))}
      </fieldset>
      <div className="flex max-w-xs flex-col gap-1">
        <label htmlFor="compare-rows" className="text-[14px] font-semibold">
          {`¿En cuántas filas difieren? (de ${total})`}
        </label>
        <Input
          id="compare-rows"
          inputMode="numeric"
          autoComplete="off"
          className="mono"
          value={rows}
          onChange={(e) => {
            setRows(e.target.value);
            setChecked(false);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setChecked(true)}>
          Comprobar
        </Button>
        <Button variant="ghost" disabled={hint} onClick={() => setHint(true)}>
          <Lightbulb size={16} aria-hidden="true" />
          Dame una pista
        </Button>
      </div>
      {hint ? (
        <p className="text-[14px]">
          Haz la tabla de verdad de las dos fórmulas con las mismas variables y compara fila a fila. Son equivalentes solo
          si coinciden en todas las filas.
        </p>
      ) : null}
      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1 text-[14px]">
          {okEq && okRows ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto!
            </Chip>
          ) : (
            <>
              <span>{answer === null ? "Indica si son equivalentes." : okEq ? "La equivalencia es correcta." : "La equivalencia no es correcta."}</span>
              <span>{rows.trim() === "" ? "Indica cuántas filas difieren." : okRows ? "El número de filas es correcto." : "El número de filas no es correcto."}</span>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
