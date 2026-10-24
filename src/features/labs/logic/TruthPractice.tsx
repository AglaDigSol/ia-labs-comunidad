// «Comprueba tu respuesta» para una tabla de verdad: el usuario rellena la columna del resultado y
// la clasificación; la app solo corrige y da pistas, no muestra la solución.
import { Check, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toPlain } from "../../../../shared/logic/ast.ts";
import { classify, type Table } from "../../../../shared/logic/truth-table.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import type { TruthFormat } from "./TruthTable.tsx";

type Kind = "tautologia" | "contradiccion" | "contingencia";
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "tautologia", label: "Tautología" },
  { value: "contradiccion", label: "Contradicción" },
  { value: "contingencia", label: "Contingencia" },
];

const fmt = (v: boolean, format: TruthFormat) => (format === "10" ? (v ? "1" : "0") : v ? "V" : "F");

export function TruthPractice({ table, format, formula }: { table: Table; format: TruthFormat; formula: string }) {
  const [answers, setAnswers] = useState<Array<boolean | null>>(() => table.rows.map(() => null));
  const [kind, setKind] = useState<Kind | null>(null);
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  useEffect(() => {
    setAnswers(table.rows.map(() => null));
    setKind(null);
    setChecked(false);
    setHints(0);
  }, [formula, table.rows]);

  const verdict = useMemo(() => classify(table.rows).kind, [table.rows]);
  const steps = useMemo(() => table.subformulas.slice(0, -1).map((n) => toPlain(n)), [table.subformulas]);
  const wrongRows = table.rows.map((r, i) => answers[i] !== null && answers[i] !== r.result);
  const missing = answers.filter((a) => a === null).length;
  const correct = table.rows.filter((r, i) => answers[i] === r.result).length;
  const allRight = checked && correct === table.rows.length && kind === verdict;

  const hintList = [
    steps.length > 0
      ? `Calcula las subfórmulas de dentro hacia fuera: ${steps.join(", ")} y, por último, ${formula}.`
      : `La fórmula es una sola variable o constante: copia su valor en cada fila.`,
    "Recuerda: p → q solo es falsa cuando p es verdadera y q es falsa; p ↔ q es verdadera cuando ambas coinciden; p ⊻ q, cuando difieren.",
    "Clasifica al final: tautología si todas las filas dan 1, contradicción si todas dan 0, contingencia en otro caso.",
  ];

  const cycle = (i: number) =>
    setAnswers((prev) => prev.map((a, k) => (k !== i ? a : a === null ? true : a ? false : null)));

  return (
    <section aria-labelledby="practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h2 id="practice-title" className="font-display text-[20px] font-semibold">
        Comprueba tu respuesta
      </h2>
      <p className="text-[14px] text-muted">
        Rellena la columna de {formula} (pulsa cada casilla para elegir {fmt(true, format)} o {fmt(false, format)}),
        elige la clasificación y pulsa «Comprobar».
      </p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-center">
          <caption className="sr-only">{`Tu tabla de verdad de ${formula}`}</caption>
          <thead>
            <tr>
              {table.vars.map((v) => (
                <th key={v} scope="col" className="px-3 py-2 font-mono font-normal">
                  {v}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-mono font-normal">
                {formula}
              </th>
              {checked ? <th scope="col" className="sr-only">Corrección</th> : null}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => {
              const a = answers[i];
              const label = `Fila ${i + 1} (${table.vars.map((v, k) => `${v} = ${fmt(r.values[k]!, format)}`).join(", ")})`;
              return (
                <tr key={r.minterm} className="border-t border-border">
                  {r.values.map((v, k) => (
                    <td key={k} className="px-3 py-1 font-mono text-muted">
                      {fmt(v, format)}
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      aria-label={`${label}: ${a === null ? "sin responder" : fmt(a, format)}`}
                      onClick={() => {
                        cycle(i);
                        setChecked(false);
                      }}
                      className={cn(
                        "min-h-11 min-w-11 rounded-md border font-mono text-[16px]",
                        checked && wrongRows[i] ? "border-crit text-crit" : "border-border",
                      )}
                    >
                      {a === null ? "?" : fmt(a, format)}
                    </button>
                  </td>
                  {checked ? (
                    <td className="px-2">
                      {a === null ? (
                        <span className="text-muted">—</span>
                      ) : wrongRows[i] ? (
                        <X size={16} aria-label="Incorrecta" className="text-crit" />
                      ) : (
                        <Check size={16} aria-label="Correcta" className="text-ok" />
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-[14px] font-semibold">Clasificación</legend>
        {KINDS.map((k) => (
          <label key={k.value} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name={`kind-${formula}`}
              checked={kind === k.value}
              onChange={() => {
                setKind(k.value);
                setChecked(false);
              }}
            />
            {k.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setChecked(true)}>
          Comprobar
        </Button>
        <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
          <Lightbulb size={16} aria-hidden="true" />
          {hints === 0 ? "Dame una pista" : "Otra pista"}
        </Button>
      </div>
      {hints > 0 ? (
        <ol className="list-decimal pl-6 text-[14px]">
          {hintList.slice(0, hints).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {allRight ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Tabla y clasificación bien.
            </Chip>
          ) : (
            <>
              <Chip tone="warn">{`${correct} de ${table.rows.length} filas correctas`}</Chip>
              {missing > 0 ? <span className="text-[14px]">{`Te faltan ${missing} filas por rellenar.`}</span> : null}
              {kind === null ? (
                <span className="text-[14px]">Elige una clasificación.</span>
              ) : kind !== verdict ? (
                <span className="text-[14px]">La clasificación no es correcta: revisa cuántas filas dan verdadero.</span>
              ) : (
                <span className="text-[14px]">La clasificación es correcta.</span>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
