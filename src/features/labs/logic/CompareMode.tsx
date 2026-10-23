import { Check, Keyboard, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { compareFormulas } from "../../../../shared/logic/compare.ts";
import {
  MAX_FORMULA_LENGTH,
  parseFormula,
  type ParseError,
} from "../../../../shared/logic/parser.ts";
import { MAX_VARIABLES } from "../../../../shared/logic/truth-table.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Switch } from "../../../components/ui/switch.tsx";
import { FormulaField, SymbolKeypad } from "./FormulaInput.tsx";
import { TruthTable, type TruthFormat } from "./TruthTable.tsx";

const DEBOUNCE_MS = 400;
const EXAMPLES = [
  { label: "Implicación frente a contrarrecíproco", a: "p → q", b: "¬q → ¬p" },
  { label: "Implicación frente a recíproco", a: "p → q", b: "q → p" },
];

const fromParam = (v: string | null) => (v && v.length <= MAX_FORMULA_LENGTH ? v : "");

export function CompareMode({
  format,
  formatToggle,
}: {
  format: TruthFormat;
  formatToggle: React.ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const [a, setA] = useState(() => fromParam(params.get("f")));
  const [b, setB] = useState(() => fromParam(params.get("g")));
  const [settled, setSettled] = useState({ a, b });
  const [keypad, setKeypad] = useState(true);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);
  const active = useRef<HTMLInputElement | null>(null);
  const activeSide = useRef<"a" | "b">("a");
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active.current) active.current = refA.current;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSettled({ a, b });
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (a) next.set("f", a);
          else next.delete("f");
          if (b) next.set("g", b);
          else next.delete("g");
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [a, b, setParams]);

  const pa = useMemo(() => parseFormula(a), [a]);
  const pb = useMemo(() => parseFormula(b), [b]);
  const emptyA = a.trim() === "";
  const emptyB = b.trim() === "";
  const errA: ParseError | null = !pa.ok && !emptyA && settled.a === a ? pa.error : null;
  const errB: ParseError | null = !pb.ok && !emptyB && settled.b === b ? pb.error : null;

  const result = useMemo(
    () => (pa.ok && pb.ok ? compareFormulas(pa.ast, pb.ast) : null),
    [pa, pb],
  );

  const onKeypadChange = (v: string) => (activeSide.current === "a" ? setA(v) : setB(v));
  const track = (side: "a" | "b") => (e: React.FocusEvent) => {
    if (e.target instanceof HTMLInputElement) {
      active.current = e.target;
      activeSide.current = side;
    }
  };

  const compareNow = () => {
    if (verdictRef.current) verdictRef.current.focus();
    else if (!pa.ok || emptyA) refA.current?.focus();
    else refB.current?.focus();
  };
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      compareNow();
    }
  };

  const ok = result && result.ok ? result : null;
  const rowsTotal = ok ? ok.rows.length : 0;
  const shownRows = ok ? (onlyDiff ? ok.differing : rowsTotal) : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:col-span-5">
        <div onFocusCapture={track("a")} onKeyDown={onEnter}>
          <FormulaField id="formula-a" label="Fórmula A" value={a} onChange={setA} error={errA} inputRef={refA} />
        </div>
        <div onFocusCapture={track("b")} onKeyDown={onEnter}>
          <FormulaField id="formula-b" label="Fórmula B" value={b} onChange={setB} error={errB} inputRef={refB} />
        </div>
        <Button variant="primary" className="self-start" onClick={compareNow}>
          Comparar fórmulas
        </Button>
        <button
          type="button"
          aria-pressed={keypad}
          onClick={() => setKeypad((k) => !k)}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
        >
          <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
          Teclado de símbolos
        </button>
        {keypad ? <SymbolKeypad targetRef={active} onChange={onKeypadChange} /> : null}
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">Ejemplos</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setA(ex.a);
                  setB(ex.b);
                }}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-[14px] hover:bg-sunken"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {result && !result.ok ? (
          <div className="flex flex-col items-start gap-2">
            <Chip tone="warn">Demasiadas variables</Chip>
            <p>
              Entre las dos fórmulas hay {result.count} variables distintas. El límite es{" "}
              {MAX_VARIABLES} variables ({2 ** MAX_VARIABLES} filas).
            </p>
          </div>
        ) : ok ? (
          <div className="flex flex-col gap-4">
            <div
              ref={verdictRef}
              tabIndex={-1}
              data-testid="verdict"
              aria-live="polite"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-raised p-3"
            >
              {ok.equivalent ? (
                <Chip tone="ok" className="text-[20px] font-semibold leading-[1.2]">
                  <Check size={20} strokeWidth={1.75} aria-hidden="true" />
                  Equivalentes
                </Chip>
              ) : (
                <Chip tone="crit" className="text-[20px] font-semibold leading-[1.2]">
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                  {`No equivalentes: difieren en ${ok.differing} ${ok.differing === 1 ? "fila" : "filas"}`}
                </Chip>
              )}
            </div>
            {ok.onlyA.length > 0 || ok.onlyB.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ok.onlyB.map((v) => (
                  <Chip key={`a-${v}`} tone="info">{`A no usa ${v}`}</Chip>
                ))}
                {ok.onlyA.map((v) => (
                  <Chip key={`b-${v}`} tone="info">{`B no usa ${v}`}</Chip>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              {formatToggle}
              <Switch
                label="Mostrar solo filas que difieren"
                checked={onlyDiff}
                onCheckedChange={setOnlyDiff}
              />
              {onlyDiff ? (
                <span className="text-[14px] text-muted">{`${shownRows} de ${rowsTotal} filas`}</span>
              ) : null}
            </div>
            <TruthTable
              compare={{ vars: ok.vars, rows: ok.rows, onlyDiffering: onlyDiff }}
              format={format}
              caption={`Comparación de A y B: ${shownRows} filas`}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[20px] font-semibold">Escribe dos fórmulas</h2>
            <p className="text-muted">
              Escribe la fórmula A y la fórmula B para comprobar si son equivalentes, o elige un
              ejemplo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
