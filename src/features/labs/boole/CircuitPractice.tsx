// «Circuito → función»: la app dibuja un circuito de content/boole/circuitos.ts y la persona escribe la
// función f que calcula. Se comprueba por tabla de verdad y, si no coincide, se explica la primera fila
// en la que difieren. Opcional: escribir lo que sale por cada cable intermedio (A, B, C…) y
// comprobarlo por separado. La fórmula del circuito queda detrás de «Ver la solución completa».
import { Check, Keyboard, Lightbulb, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  circuitToExpression,
  circuitToTex,
  evaluateCircuit,
  firstDifference,
  gateFormula,
  layoutCircuit,
  substituteVars,
  topoOrder,
  wireExpressions,
  type Netlist,
  type RowDifference,
} from "../../../../shared/boole/circuit.ts";
import { booleToTex, booleVars, parseBoole, type BExpr } from "../../../../shared/boole/expr.ts";
import { minimizeBoole } from "../../../../shared/boole/minimize.ts";
import type { CircuitContent } from "../../../../shared/boole/schema.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { CIRCUIT_PACK } from "../../../../content/boole/circuitos.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField, SymbolKeypad } from "../logic/FormulaInput.tsx";
import { selectClass } from "./AxiomPractice.tsx";
import { MAX_EXPR } from "./boole-storage.ts";
import { CircuitDiagram } from "./CircuitDiagram.tsx";
import { BOOLE_XOR_KEYS, rowText } from "./keys.ts";

type Result = { ok: true } | { ok: false; diff: RowDifference };
type Read = { ok: true; expr: BExpr } | { ok: false; error: ParseError };

/** Lee una respuesta: acepta las entradas del circuito y los cables (que se sustituyen por lo que valen). */
function readAnswer(text: string, net: Netlist, wires: Record<string, BExpr>, self: string | null): Read {
  if (text.length > MAX_EXPR) {
    return { ok: false, error: { code: "too-long", start: MAX_EXPR, end: text.length, message: `Como mucho ${MAX_EXPR} caracteres.` } };
  }
  const r = parseBoole(text, { xor: true });
  if (!r.ok) return r;
  const labels = Object.keys(wires).filter((l) => l !== self);
  const bad = booleVars(r.expr).find((v) => !net.inputs.includes(v) && !labels.includes(v));
  if (bad) {
    const at = Math.max(0, text.indexOf(bad));
    const allowed = [...net.inputs, ...labels].join(", ");
    return {
      ok: false,
      error: {
        code: "unexpected-token",
        start: at,
        end: at + bad.length,
        message:
          bad === self
            ? `${bad} no puede depender de sí mismo: escríbelo con las entradas o con otros cables.`
            : `«${bad}» no es una entrada ni un cable de este circuito. Puedes usar: ${allowed}.`,
      },
    };
  }
  return { ok: true, expr: substituteVars(r.expr, wires) };
}

function diffText(d: RowDifference, what: string): string {
  return `Con ${rowText(d.vars, d.values)}, ${what} vale ${d.expected ? 1 : 0} y tu expresión da ${d.given ? 1 : 0}.`;
}

/** Puertas en el orden de sus etiquetas (A, B, C…) y la salida al final. */
function byLabel(net: Netlist, labels: Record<string, string>) {
  const rank = (id: string) => {
    const l = labels[id];
    return l === undefined ? Infinity : (l.length - 1) * 1000 + l.charCodeAt(0) + Number(l.slice(1) || 0) * 26;
  };
  return [...topoOrder(net)].sort((a, b) => rank(a.id) - rank(b.id));
}

export function circuitDescription(net: Netlist, labels: Record<string, string>): string {
  const name = (s: string) => labels[s] ?? s;
  const parts = byLabel(net, labels).map((g) => `${g.id === net.output ? "f" : name(g.id)} = ${gateFormula(g, name)}`);
  return `Circuito con entradas ${net.inputs.join(", ")}. ${parts.join("; ")}.`;
}

function WireRow({
  label: l,
  value,
  error,
  result: res,
  onChange,
  onCheck,
}: {
  label: string;
  value: string;
  error: ParseError | null;
  result: Result | null;
  onChange: (v: string) => void;
  onCheck: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <li className="flex flex-col gap-2">
      <FormulaField id={`wire-${l}`} label={`${l} =`} value={value} onChange={onChange} error={error} inputRef={ref} placeholder="x ⊙ y" notation="boole" />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onCheck}>
          {`Comprobar ${l}`}
        </Button>
        <span role="status" className="text-[14px]">
          {res ? (
            <span className={cn("inline-flex items-center gap-1", res.ok ? "text-ok" : "text-crit")}>
              {res.ok ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              {res.ok ? `${l} es correcto.` : `${l} no coincide. ${diffText(res.diff, `el cable ${l}`)}`}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  );
}

function Exercise({ circuit }: { circuit: CircuitContent }) {
  const net: Netlist = circuit;
  const layout = useMemo(() => layoutCircuit(net), [net]);
  const labels = layout.labels;
  const exprs = useMemo(() => wireExpressions(net), [net]);
  // Lo que vale cada cable, por su etiqueta.
  const wireByLabel = useMemo(
    () => Object.fromEntries(Object.entries(labels).map(([g, l]) => [l, exprs[g]!])) as Record<string, BExpr>,
    [labels, exprs],
  );
  const target = useMemo(() => circuitToExpression(net), [net]);
  const minimal = useMemo(() => minimizeBoole(target), [target]);

  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<ParseError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wireText, setWireText] = useState<Record<string, string>>({});
  const [wireErr, setWireErr] = useState<Record<string, ParseError | null>>({});
  const [wireRes, setWireRes] = useState<Record<string, Result | null>>({});

  const vars = net.inputs;
  const fName = `f(${vars.join(", ")})`;

  const check = () => {
    setHint(false);
    const r = readAnswer(answer, net, wireByLabel, null);
    if (!r.ok) {
      setError(r.error);
      setResult(null);
      return;
    }
    setError(null);
    const d = firstDifference(target, r.expr, vars);
    setResult(d ? { ok: false, diff: d } : { ok: true });
  };

  const checkWire = (label: string) => {
    const r = readAnswer(wireText[label] ?? "", net, wireByLabel, label);
    if (!r.ok) {
      setWireErr((p) => ({ ...p, [label]: r.error }));
      setWireRes((p) => ({ ...p, [label]: null }));
      return;
    }
    setWireErr((p) => ({ ...p, [label]: null }));
    const d = firstDifference(wireByLabel[label]!, r.expr, vars);
    setWireRes((p) => ({ ...p, [label]: d ? { ok: false, diff: d } : { ok: true } }));
  };

  const hintRow = result && !result.ok ? result.diff : null;
  const hintValues = useMemo(() => {
    if (!hintRow) return null;
    const env = Object.fromEntries(vars.map((v, i) => [v, hintRow.values[i]!]));
    return evaluateCircuit(net, env).wires;
  }, [hintRow, net, vars]);
  const labelList = Object.entries(labels).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="flex flex-col gap-4">
      <CircuitDiagram net={net} showLabels label={circuitDescription(net, labels)} />
      <p className="text-[14px] text-muted">
        {`Entradas: ${vars.join(", ")}. `}
        {labelList.length > 0
          ? `Los cables intermedios llevan las etiquetas ${labelList.map(([, l]) => l).join(", ")}; la salida es f.`
          : "La salida es f."}
      </p>

      <section aria-labelledby="circuit-answer-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
        <h2 id="circuit-answer-title" className="font-display text-[20px] font-semibold">
          Comprueba tu respuesta
        </h2>
        <FormulaField
          id="circuit-answer"
          label={`${fName} =`}
          value={answer}
          onChange={(v) => {
            setAnswer(v);
            setError(null);
            setResult(null);
          }}
          error={error}
          inputRef={inputRef}
          placeholder="x ⊙ y ⊕ z′"
          notation="boole"
        />
        <button
          type="button"
          aria-pressed={keypad}
          onClick={() => setKeypad((k) => !k)}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
        >
          <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
          Teclado de símbolos
        </button>
        {keypad ? (
          <SymbolKeypad targetRef={inputRef} onChange={setAnswer} keys={BOOLE_XOR_KEYS} vars={vars} moreVars={labelList.map(([, l]) => l)} />
        ) : null}
        <p className="text-[14px] text-muted">
          Puedes usar ⊻ para XOR y los nombres de los cables (A, B…), que se sustituyen por lo que calcula el circuito.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={check}>
            <Check size={16} aria-hidden="true" />
            Comprobar
          </Button>
          {hintRow ? (
            <Button variant="ghost" onClick={() => setHint(true)} disabled={hint}>
              <Lightbulb size={16} aria-hidden="true" />
              Pista: valores de los cables en esa fila
            </Button>
          ) : null}
        </div>
        <div role="status" className="flex flex-col items-start gap-1 text-[14px]">
          {result?.ok ? (
            <Chip tone="ok" className="whitespace-normal">
              <Check size={16} aria-hidden="true" />
              {`¡Correcto! Tu expresión es equivalente al circuito en las ${1 << vars.length} filas de la tabla de verdad.`}
            </Chip>
          ) : result ? (
            <p className="text-crit">{`No es equivalente. ${diffText(result.diff, "el circuito")}`}</p>
          ) : null}
          {hint && hintRow && hintValues ? (
            <p>
              {`En la fila ${rowText(vars, hintRow.values)}: ${labelList.map(([g, l]) => `${l} = ${hintValues[g] ? 1 : 0}`).join(", ")}${labelList.length ? ", " : ""}f = ${hintValues[net.output] ? 1 : 0}. Recorre el circuito de izquierda a derecha y busca dónde se separa tu expresión.`}
            </p>
          ) : null}
        </div>
      </section>

      {labelList.length > 0 ? (
        <details className="rounded-lg border border-border bg-raised p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Cables intermedios (opcional)</summary>
          <p className="pb-2 text-[14px] text-muted">
            Escribe lo que sale por cada cable con las entradas (o con otros cables) y compruébalo por separado.
          </p>
          <ul className="flex flex-col gap-3">
            {labelList.map(([, l]) => {
              const res = wireRes[l];
              return (
                <WireRow
                  key={l}
                  label={l}
                  value={wireText[l] ?? ""}
                  error={wireErr[l] ?? null}
                  result={res ?? null}
                  onChange={(v) => {
                    setWireText((p) => ({ ...p, [l]: v }));
                    setWireErr((p) => ({ ...p, [l]: null }));
                    setWireRes((p) => ({ ...p, [l]: null }));
                  }}
                  onCheck={() => checkWire(l)}
                />
              );
            })}
          </ul>
        </details>
      ) : null}

      <SolutionGate resetKey={circuit.id}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          <h3 className="font-display text-[18px] font-semibold">Solución</h3>
          <p className="text-[14px] font-semibold">Leyendo el circuito puerta a puerta:</p>
          <ul className="flex flex-col gap-1">
            {byLabel(net, labels).map((g) => (
              <li key={g.id} className="max-w-full overflow-x-auto">
                <Tex
                  tex={`${g.id === net.output ? "f" : labels[g.id]} = ${gateFormula(g, (s) => labels[s] ?? s, true)}`}
                  label={`${g.id === net.output ? "f" : labels[g.id]} = ${gateFormula(g, (s) => labels[s] ?? s)}`}
                />
              </li>
            ))}
          </ul>
          <p className="text-[14px] font-semibold">Sustituyendo:</p>
          <Tex display tex={`f = ${circuitToTex(net)}`} label="Fórmula del circuito" />
          {minimal.ok ? (
            <>
              <p className="text-[14px] font-semibold">{`Suma de productos mínima (${minimal.sop.literals} literales):`}</p>
              <Tex display tex={`f = ${booleToTex(minimal.sop.expr)}`} label="Suma de productos mínima" />
            </>
          ) : null}
        </div>
      </SolutionGate>
    </div>
  );
}

export function CircuitPractice({ circuitId, onChoose }: { circuitId: string | null; onChoose: (id: string) => void }) {
  const circuits = CIRCUIT_PACK.circuits;
  const circuit = circuits.find((c) => c.id === circuitId) ?? circuits[0]!;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Lee el circuito y escribe la función f que calcula con ⊕, ⊙ y ′ (y ⊻ si quieres). La app la compara con el
        circuito fila a fila.
      </p>
      <label htmlFor="circuit-choice" className="text-[14px] font-semibold">
        Circuito
      </label>
      <select
        id="circuit-choice"
        className={cn(selectClass, "w-full max-w-md font-body")}
        value={circuit.id}
        onChange={(e) => onChoose(e.target.value)}
      >
        {(["básico", "medio", "avanzado"] as const).map((level) => (
          <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
            {circuits
              .filter((c) => c.level === level)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.title} (${c.gates.length} puertas)`}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <Exercise key={circuit.id} circuit={circuit} />
    </div>
  );
}
