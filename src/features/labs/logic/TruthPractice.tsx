// «Comprueba tu respuesta» para una tabla de verdad. Dos modos:
// - «Paso a paso» (por defecto si hay subfórmulas intermedias): una columna cada vez, de dentro
//   hacia fuera; cada columna se comprueba y se bloquea antes de añadir la siguiente, y al final
//   se elige la clasificación.
// - «Solo el resultado»: la columna de la fórmula completa y la clasificación.
// La app solo corrige y da pistas; nunca rellena ni muestra los valores correctos.
import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPlain, type Node } from "../../../../shared/logic/ast.ts";
import { classify, type Table } from "../../../../shared/logic/truth-table.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import type { TruthFormat } from "./TruthTable.tsx";

type Kind = "tautologia" | "contradiccion" | "contingencia";
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "tautologia", label: "Tautología" },
  { value: "contradiccion", label: "Contradicción" },
  { value: "contingencia", label: "Contingencia" },
];
const CLASSIFY_HINT =
  "Clasifica al final: tautología si todas las filas dan 1, contradicción si todas dan 0, contingencia en otro caso.";

const fmt = (v: boolean, format: TruthFormat) => (format === "10" ? (v ? "1" : "0") : v ? "V" : "F");
const next = (a: boolean | null) => (a === null ? true : a ? false : null);

export type TruthPracticeMode = "pasos" | "resultado";
type Mode = TruthPracticeMode;

export function TruthPractice({
  table,
  format,
  formula,
  fixedMode,
  onSolved,
}: {
  table: Table;
  format: TruthFormat;
  formula: string;
  /** Modo fijo, sin el selector (el banco de ejercicios elige el modo de cada tipo). */
  fixedMode?: Mode;
  /** Se llama al comprobar la tabla y la clasificación completas y correctas. */
  onSolved?: () => void;
}) {
  // Sin subfórmulas intermedias (p, ¬p, p ∧ q) no hay pasos: solo la columna del resultado.
  const hasSteps = table.subformulas.length >= 2;
  const [mode, setMode] = useState<Mode>(fixedMode ?? "pasos");
  const effective: Mode = hasSteps ? (fixedMode ?? mode) : "resultado";

  return (
    <section aria-labelledby="practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-title" className="font-display text-[20px] font-semibold">
          Comprueba tu respuesta
        </h2>
        {hasSteps && fixedMode === undefined ? (
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Modo de práctica"
            onValueChange={(v) => {
              if (v === "pasos" || v === "resultado") setMode(v);
            }}
          >
            <ToggleGroupItem value="pasos">Paso a paso</ToggleGroupItem>
            <ToggleGroupItem value="resultado">Solo el resultado</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>
      {effective === "pasos" ? (
        // La clave reinicia el ejercicio al cambiar de fórmula.
        <StepPractice key={formula} table={table} format={format} formula={formula} onSolved={onSolved} />
      ) : (
        <ResultPractice table={table} format={format} formula={formula} onSolved={onSolved} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Paso a paso

const isBinary = (n: Node): n is Extract<Node, { left: Node }> =>
  n.kind !== "var" && n.kind !== "const" && n.kind !== "not";
const OP: Record<Exclude<Node["kind"], "var" | "const">, string> = {
  not: "¬",
  and: "∧",
  or: "∨",
  xor: "⊻",
  imp: "→",
  iff: "↔",
};
// Operando tal y como se nombra en las pistas: entre paréntesis si es un binario.
const operandText = (n: Node) => (isBinary(n) ? `(${toPlain(n)})` : toPlain(n));

/** Columna de la que sale un operando: una variable, un paso anterior o una constante (sin columna). */
type Source = { col: string | null; text: string };

function operands(node: Node, vars: string[], keys: string[]): Source[] {
  const list = node.kind === "not" ? [node.arg] : isBinary(node) ? [node.left, node.right] : [];
  return list.map((n) => {
    const text = operandText(n);
    if (n.kind === "var") return { col: vars.includes(n.name) ? `v:${n.name}` : null, text };
    if (n.kind === "const") return { col: null, text };
    const j = keys.indexOf(toPlain(n));
    return { col: j >= 0 ? `s:${j}` : null, text };
  });
}

function stepHints(node: Node, ops: Source[]): string[] {
  if (node.kind === "var" || node.kind === "const") return [];
  const op = OP[node.kind];
  const [a, b] = ops.map((o) => o.text);
  const withCols = new Set(ops.filter((o) => o.col !== null).map((o) => o.col)).size;
  const look = withCols === 0 ? "" : withCols === 1 ? ": mira esa columna" : ": mira esas dos columnas";
  const first = node.kind === "not" ? `Esta columna aplica ¬ a ${a}${look}.` : `Esta columna aplica ${op} a ${a} y ${b}${look}.`;
  const rule: Record<Exclude<Node["kind"], "var" | "const">, string> = {
    not: `¬ cambia el valor: ¬${a} es verdadera cuando ${a} es falsa, y falsa cuando ${a} es verdadera.`,
    and: `${a} ∧ ${b} solo es verdadera cuando ${a} y ${b} son verdaderas.`,
    or: `${a} ∨ ${b} solo es falsa cuando ${a} y ${b} son falsas.`,
    xor: `${a} ⊻ ${b} es verdadera cuando ${a} y ${b} difieren.`,
    imp: `${a} → ${b} solo es falsa cuando ${a} es verdadera y ${b} es falsa.`,
    iff: `${a} ↔ ${b} es verdadera cuando ${a} y ${b} coinciden.`,
  };
  return [first, `Recuerda: ${rule[node.kind]}`];
}

type PartProps = { table: Table; format: TruthFormat; formula: string; onSolved?: () => void };

function StepPractice({ table, format, formula, onSolved }: PartProps) {
  const subs = table.subformulas;
  const n = subs.length;
  const keys = useMemo(() => subs.map((s) => toPlain(s)), [subs]);
  const blank = () => table.rows.map(() => null as boolean | null);

  // cols[j]: respuestas de la columna j (solo existen las columnas ya añadidas).
  const [cols, setCols] = useState<Array<Array<boolean | null>>>(() => [blank()]);
  const [solved, setSolved] = useState(0);
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [kindChecked, setKindChecked] = useState(false);
  const firstCell = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const step = cols.length - 1;
  const current = subs[step]!;
  const ops = useMemo(() => operands(current, table.vars, keys), [current, table.vars, keys]);
  const highlighted = new Set(ops.map((o) => o.col).filter((c): c is string => c !== null));
  const stepDone = solved > step;
  const allDone = solved === n;
  const verdict = useMemo(() => classify(table.rows).kind, [table.rows]);
  const hintList = allDone ? [CLASSIFY_HINT] : stepHints(current, ops);

  const answers = cols[step]!;
  const truth = table.rows.map((r) => r.sub[step]!);
  const wrong = answers.map((a, i) => a !== null && a !== truth[i]);
  const missing = answers.filter((a) => a === null).length;
  const correct = answers.filter((a, i) => a === truth[i]).length;

  // Al añadir una columna, el foco pasa a su primera casilla (no al montar el ejercicio).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    firstCell.current?.focus();
  }, [step]);

  const cycle = (i: number) => {
    setCols((prev) => prev.map((c, j) => (j !== step ? c : c.map((a, k) => (k !== i ? a : next(a))))));
    setChecked(false);
  };
  const checkStep = () => {
    setChecked(true);
    if (correct !== table.rows.length) return;
    setSolved(step + 1);
    // Tras la última columna, las pistas pasan a ser las de la clasificación.
    if (step + 1 === n) setHints(0);
  };
  const nextStep = () => {
    moved.current = true;
    setCols((prev) => [...prev, blank()]);
    setChecked(false);
    setHints(0);
  };
  const restart = () => {
    setCols([blank()]);
    setSolved(0);
    setChecked(false);
    setHints(0);
    setKind(null);
    setKindChecked(false);
  };

  const rowLabel = (i: number) =>
    `Fila ${i + 1} (${table.vars.map((v, k) => `${v} = ${fmt(table.rows[i]!.values[k]!, format)}`).join(", ")})`;
  const headClass = (col: string) =>
    cn(
      "px-3 py-2 font-mono font-normal whitespace-nowrap",
      highlighted.has(col) && !allDone && "border-b-2 border-b-accent bg-accent-soft",
    );
  const operandMark = (col: string) =>
    highlighted.has(col) && !allDone ? <span className="sr-only"> (se usa en este paso)</span> : null;

  return (
    <>
      <p className="text-[14px] text-muted">
        Resuelve la tabla de dentro hacia fuera, una columna cada vez: pulsa cada casilla para elegir{" "}
        {fmt(true, format)} o {fmt(false, format)} y pulsa «Comprobar paso». Las columnas resaltadas son las que
        combina el paso actual.
      </p>
      <p className="text-[14px] font-semibold">
        {`Paso ${step + 1} de ${n}: `}
        <span className="font-mono font-normal">{keys[step]}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-center">
          <caption className="sr-only">{`Tu tabla de verdad de ${formula}, paso a paso`}</caption>
          <thead>
            <tr>
              {table.vars.map((v) => (
                <th key={v} scope="col" className={headClass(`v:${v}`)}>
                  {v}
                  {operandMark(`v:${v}`)}
                </th>
              ))}
              {cols.map((_, j) => (
                <th
                  key={j}
                  scope="col"
                  className={cn(headClass(`s:${j}`), j === step && !stepDone && "font-semibold")}
                >
                  {keys[j]}
                  {operandMark(`s:${j}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={r.minterm} className="border-t border-border">
                {r.values.map((v, k) => (
                  <td key={k} className="px-3 py-1 font-mono text-muted">
                    {fmt(v, format)}
                  </td>
                ))}
                {cols.map((c, j) => {
                  const a = c[i] ?? null;
                  // Columnas bloqueadas: los valores que escribió el estudiante, ya comprobados.
                  if (j < solved)
                    return (
                      <td key={j} className="px-3 py-1 font-mono">
                        {a === null ? "" : fmt(a, format)}
                      </td>
                    );
                  const bad = checked && wrong[i]!;
                  return (
                    <td key={j} className="px-2 py-1">
                      <span className="inline-flex items-center gap-1">
                        <button
                          ref={i === 0 ? firstCell : undefined}
                          type="button"
                          aria-label={`${rowLabel(i)}, columna ${keys[j]}: ${a === null ? "sin responder" : fmt(a, format)}${bad ? ", incorrecta" : ""}`}
                          onClick={() => cycle(i)}
                          className={cn(
                            "min-h-11 min-w-11 rounded-md border font-mono text-[16px]",
                            bad ? "border-crit text-crit" : "border-border",
                          )}
                        >
                          {a === null ? "?" : fmt(a, format)}
                        </button>
                        {bad ? <X size={16} aria-hidden="true" className="text-crit" /> : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allDone ? (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-[14px] font-semibold">Clasificación</legend>
          {KINDS.map((k) => (
            <label key={k.value} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={`kind-pasos-${formula}`}
                checked={kind === k.value}
                onChange={() => {
                  setKind(k.value);
                  setKindChecked(false);
                }}
              />
              {k.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {allDone ? (
          <Button
            variant="primary"
            onClick={() => {
              setKindChecked(true);
              if (kind === verdict) onSolved?.();
            }}
          >
            Comprobar
          </Button>
        ) : stepDone ? (
          <Button variant="primary" onClick={nextStep}>
            {`Siguiente paso: ${keys[step + 1]}`}
          </Button>
        ) : (
          <Button variant="primary" onClick={checkStep}>
            Comprobar paso
          </Button>
        )}
        <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
          <Lightbulb size={16} aria-hidden="true" />
          {hints === 0 ? "Dame una pista" : "Otra pista"}
        </Button>
        <Button variant="ghost" onClick={restart}>
          <RotateCcw size={16} aria-hidden="true" />
          Empezar de nuevo
        </Button>
      </div>
      {hints > 0 ? (
        <ol className="list-decimal pl-6 text-[14px]">
          {hintList.slice(0, hints).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}

      {allDone && kindChecked ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {kind === verdict ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Tabla y clasificación bien.
            </Chip>
          ) : kind === null ? (
            <span className="text-[14px]">Elige una clasificación.</span>
          ) : (
            <Chip tone="warn">La clasificación no es correcta: revisa cuántas filas dan verdadero.</Chip>
          )}
        </div>
      ) : checked ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {stepDone ? (
            <>
              <Chip tone="ok">
                <Check size={16} aria-hidden="true" />
                {`Paso ${step + 1} correcto`}
              </Chip>
              {allDone ? <span className="text-[14px]">Tabla completa: ahora elige la clasificación.</span> : null}
            </>
          ) : (
            <>
              <Chip tone="warn">{`${correct} de ${table.rows.length} filas correctas`}</Chip>
              {missing > 0 ? <span className="text-[14px]">{`Te faltan ${missing} filas por rellenar.`}</span> : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- Solo el resultado

function ResultPractice({ table, format, formula, onSolved }: PartProps) {
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
    CLASSIFY_HINT,
  ];

  const cycle = (i: number) => setAnswers((prev) => prev.map((a, k) => (k !== i ? a : next(a))));

  return (
    <>
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
        <Button
          variant="primary"
          onClick={() => {
            setChecked(true);
            if (correct === table.rows.length && kind === verdict) onSolved?.();
          }}
        >
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
    </>
  );
}
