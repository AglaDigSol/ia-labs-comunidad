// «Gauss-Jordan paso a paso»: el estudiante lleva la matriz a la forma escalonada reducida con una
// operación elemental en cada paso. Puede elegir la operación (Fᵢ ↔ Fⱼ, Fᵢ ← k·Fᵢ, Fᵢ ← Fᵢ + k·Fⱼ) y
// escribir la matriz que sale, o escribir directamente la matriz siguiente. La app comprueba que la
// operación es elemental (k ≠ 0, filas distintas) y que la matriz coincide, marcando las celdas o las
// filas mal sin decir su valor. La pista dice qué regla toca y en qué columna. Al terminar, si es un
// sistema, se clasifica y se escribe la solución.
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { fracInput, gridMatrix, parseEntry, parseGrid, type Matrix } from "../../../../shared/linalg/matrix.ts";
import {
  applyRowOp,
  checkTypedStep,
  gaussHintText,
  isRowEchelon,
  isRref,
  nextGaussHint,
  rowName,
  rowOpError,
  rowOpTex,
  rowOpText,
  rref,
  rrefProgress,
  wrongCells,
  type RowOp,
} from "../../../../shared/linalg/rref.ts";
import { analyzeSystem, splitAugmented } from "../../../../shared/linalg/systems.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { cellKey, Hints, MatrixGrid, MatrixView, PracticeBox, Status, Verdict } from "./common.tsx";
import { SystemAnswer, SystemSolution } from "./SystemAnswer.tsx";

type Step = { matrix: Matrix; op: RowOp | null };
type Mode = "operacion" | "matriz";
type OpKind = RowOp["k"];
type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;

const OP_LABELS: Record<OpKind, string> = {
  swap: "Fᵢ ↔ Fⱼ (intercambiar dos filas)",
  scale: "Fᵢ ← k·Fᵢ (multiplicar una fila por k ≠ 0)",
  add: "Fᵢ ← Fᵢ + k·Fⱼ (sumar a una fila k veces otra)",
};

const toGrid = (M: Matrix) => M.map((r) => r.map(fracInput));

export function GaussPractice({
  start,
  unknowns,
  onSolved,
}: {
  start: Matrix;
  /** Número de incógnitas si es la matriz ampliada de un sistema (la raya va antes de la columna b); null si es una matriz sin más. */
  unknowns: number | null;
  onSolved?: () => void;
}) {
  const rows = start.length;
  // En un sistema, los pivotes se buscan solo en las columnas de A: la reducida no toca la columna b.
  const pivotCols = unknowns ?? (start[0]?.length ?? 0);
  const [steps, setSteps] = useState<Step[]>([]);
  const current = steps.length > 0 ? steps[steps.length - 1]!.matrix : start;
  const [mode, setMode] = useState<Mode>("operacion");
  const [opKind, setOpKind] = useState<OpKind>("swap");
  const [i, setI] = useState(0);
  const [j, setJ] = useState(rows > 1 ? 1 : 0);
  const [kText, setKText] = useState("");
  const [typeOwn, setTypeOwn] = useState(true);
  const [grid, setGrid] = useState<string[][]>(() => toGrid(start));
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Feedback>(null);

  const progress = useMemo(() => rrefProgress(current, pivotCols), [current, pivotCols]);
  const finished = progress.done === progress.total && isRowEchelon(current.map((r) => r.slice(0, pivotCols)));
  const echelon = isRowEchelon(current);
  const hint = useMemo(() => gaussHintText(nextGaussHint(current, pivotCols)), [current, pivotCols]);
  const bar = unknowns ?? undefined;
  const solution = useMemo(() => rref(start, pivotCols), [start, pivotCols]);
  const system = useMemo(() => (unknowns !== null ? splitAugmented(start) : null), [start, unknowns]);

  const accept = (matrix: Matrix, op: RowOp | null, text: string) => {
    const next = [...steps, { matrix, op }];
    setSteps(next);
    setGrid(toGrid(matrix));
    setFlagged(new Set());
    setFeedback({ tone: "ok", text });
    const done = rrefProgress(matrix, pivotCols);
    if (unknowns === null && done.done === done.total && isRref(matrix)) onSolved?.();
  };

  const reset = (to: Step[]) => {
    setSteps(to);
    const m = to.length > 0 ? to[to.length - 1]!.matrix : start;
    setGrid(toGrid(m));
    setFlagged(new Set());
    setFeedback(null);
  };

  const op = (): RowOp | { error: string } => {
    if (opKind === "swap") return { k: "swap", i, j };
    const k = parseEntry(kText);
    if (!k.ok) return { error: "Escribe k: un entero, una fracción (−1/2) o un decimal." };
    return opKind === "scale" ? { k: "scale", i, c: k.value } : { k: "add", i, j, c: k.value };
  };

  const checkStep = () => {
    if (mode === "operacion") {
      const o = op();
      if ("error" in o) return setFeedback({ tone: "crit", text: o.error });
      const error = rowOpError(o, rows);
      if (error) return setFeedback({ tone: "crit", text: error });
      const result = applyRowOp(current, o);
      if (!result.ok) return setFeedback({ tone: "crit", text: result.error });
      if (!typeOwn) return accept(result.value, o, `Hecho: ${rowOpText(o)}.`);
      const typed = parseGrid(grid);
      const wrong = wrongCells(result.value, typed);
      if (wrong.length === 0) return accept(result.value, o, `¡Bien! ${rowOpText(o)} da esa matriz.`);
      setFlagged(new Set(wrong.map(([a, c]) => cellKey(a, c))));
      return setFeedback({
        tone: "warn",
        text: `La operación ${rowOpText(o)} es válida, pero ${wrong.length === 1 ? "1 celda no coincide" : `${wrong.length} celdas no coinciden`} con su resultado: revísalas (las vacías o mal escritas también cuentan).`,
      });
    }
    const typed = gridMatrix(grid);
    if (!typed) {
      const g = parseGrid(grid);
      setFlagged(new Set(g.flatMap((r, a) => r.flatMap((x, c) => (x === null ? [cellKey(a, c)] : [])))));
      return setFeedback({ tone: "crit", text: "Hay celdas vacías o que no son números." });
    }
    const c = checkTypedStep(current, typed);
    if (c.kind === "same") return setFeedback({ tone: "warn", text: "No has cambiado nada: aplica una operación elemental." });
    if (c.kind === "ok") {
      return accept(typed, c.op, c.op ? `¡Bien! Es ${rowOpText(c.op)}.` : "¡Bien! Has hecho varias operaciones a la vez: la matriz es equivalente por filas a la anterior.");
    }
    setFlagged(new Set(c.badRows.flatMap((r) => typed[r]!.map((_, col) => cellKey(r, col)))));
    setFeedback({
      tone: "warn",
      text: c.lostRank
        ? "Has perdido una ecuación: la matriz nueva tiene menos rango. ¿Has multiplicado una fila por 0 o la has restado de sí misma?"
        : `${c.badRows.map(rowName).join(", ")}: no ${c.badRows.length === 1 ? "es combinación" : "son combinaciones"} de las filas de la matriz anterior. Revisa las cuentas de ${c.badRows.length === 1 ? "esa fila" : "esas filas"}.`,
    });
  };

  const rowOptions = Array.from({ length: rows }, (_, r) => (
    <option key={r} value={r}>
      {rowName(r)}
    </option>
  ));

  return (
    <PracticeBox title="Tu paso">
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold">{steps.length === 0 ? "Matriz de partida" : `Matriz después del paso ${steps.length}`}</p>
        <MatrixView M={current} bar={bar} label={steps.length === 0 ? "Matriz de partida" : `Matriz después del paso ${steps.length}`} />
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span>{`Columnas pivote terminadas: ${progress.done} de ${progress.total}.`}</span>
          {finished ? <Chip tone="ok">Forma escalonada reducida</Chip> : echelon ? <Chip tone="info">Escalonada</Chip> : null}
        </div>
      </div>

      {!finished ? (
        <>
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Cómo das el paso"
            className="self-start"
            onValueChange={(v) => {
              if (v === "operacion" || v === "matriz") {
                setMode(v);
                setFlagged(new Set());
                setFeedback(null);
              }
            }}
          >
            <ToggleGroupItem value="operacion">Elegir la operación</ToggleGroupItem>
            <ToggleGroupItem value="matriz">Escribir la matriz</ToggleGroupItem>
          </ToggleGroup>

          {mode === "operacion" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="gauss-op" className="text-[14px] font-semibold">
                  Operación elemental
                </label>
                <select
                  id="gauss-op"
                  className={cn(selectClass, "w-full font-body")}
                  value={opKind}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "swap" || v === "scale" || v === "add") setOpKind(v);
                    setFeedback(null);
                  }}
                >
                  {(Object.keys(OP_LABELS) as OpKind[]).map((k) => (
                    <option key={k} value={k}>
                      {OP_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[14px] font-semibold">
                  Fila i
                  <select className={selectClass} value={i} onChange={(e) => setI(Number(e.target.value))}>
                    {rowOptions}
                  </select>
                </label>
                {opKind !== "scale" ? (
                  <label className="flex flex-col gap-1 text-[14px] font-semibold">
                    Fila j
                    <select className={selectClass} value={j} onChange={(e) => setJ(Number(e.target.value))}>
                      {rowOptions}
                    </select>
                  </label>
                ) : null}
                {opKind !== "swap" ? (
                  <label className="flex flex-col gap-1 text-[14px] font-semibold">
                    k
                    <Input className="w-28 font-mono" autoComplete="off" placeholder="−1/2" value={kText} onChange={(e) => setKText(e.target.value.slice(0, 24))} />
                  </label>
                ) : null}
              </div>
              <label className="flex min-h-11 items-center gap-2 text-[14px]">
                <input type="checkbox" checked={typeOwn} onChange={(e) => setTypeOwn(e.target.checked)} />
                Escribo yo la matriz que sale
              </label>
            </div>
          ) : (
            <p className="text-[14px] text-muted">
              Escribe la matriz siguiente: puedes hacer una operación o varias a la vez (por ejemplo, hacer ceros en toda una columna).
            </p>
          )}

          {mode === "matriz" || typeOwn ? (
            <MatrixGrid
              name="Matriz siguiente"
              values={grid}
              bar={bar}
              flagged={flagged}
              onChange={(g) => {
                setGrid(g);
                setFlagged(new Set());
              }}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={checkStep}>
              <Check size={16} aria-hidden="true" />
              Comprobar paso
            </Button>
            <Hints hints={[hint, "Las tres operaciones elementales no cambian las soluciones: Fᵢ ↔ Fⱼ, Fᵢ ← k·Fᵢ con k ≠ 0 y Fᵢ ← Fᵢ + k·Fⱼ con i ≠ j."]} />
          </div>
        </>
      ) : null}

      {feedback ? (
        <Status>
          <Verdict tone={feedback.tone}>{feedback.text}</Verdict>
        </Status>
      ) : null}

      {steps.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-[18px] font-semibold">Tus pasos</h3>
          <ol className="flex flex-col gap-1 pl-6 text-[14px] [list-style:decimal]">
            {steps.map((s, k) => (
              <li key={k}>
                {s.op ? <Tex tex={rowOpTex(s.op)} label={rowOpText(s.op)} /> : <span>Varias operaciones</span>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => reset(steps.slice(0, -1))}>
              <Undo2 size={16} aria-hidden="true" />
              Deshacer el último paso
            </Button>
            <Button variant="ghost" onClick={() => reset([])}>
              <RotateCcw size={16} aria-hidden="true" />
              Empezar de nuevo
            </Button>
          </div>
        </div>
      ) : null}

      {finished && unknowns === null ? (
        <Status>
          <Verdict tone="ok">
            <Check size={16} aria-hidden="true" />
            {`¡Hecho! Has llegado a la forma escalonada reducida en ${steps.length} ${steps.length === 1 ? "paso" : "pasos"}.`}
          </Verdict>
        </Status>
      ) : null}

      {finished && system ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="font-display text-[18px] font-semibold">Clasifica el sistema y escribe su solución</h3>
          <SystemAnswer A={system.A} b={system.b} onSolved={onSolved} />
        </div>
      ) : null}

      <SolutionGate>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
          <h3 className="font-display text-[18px] font-semibold">{`Gauss-Jordan completo (${solution.ops.length} ${solution.ops.length === 1 ? "paso" : "pasos"})`}</h3>
          <ol className="flex flex-col gap-2 pl-6 [list-style:decimal]">
            {solution.ops.map((o, k) => (
              <li key={k} className="flex flex-col gap-1">
                <Tex tex={rowOpTex(o)} label={rowOpText(o)} />
                <MatrixView M={solution.steps[k]!} bar={bar} label={`Después de ${rowOpText(o)}`} className="text-[16px]" />
              </li>
            ))}
          </ol>
          {system ? <SystemSolution analysis={analyzeSystem(system.A, system.b)} /> : null}
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}
