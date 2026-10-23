import { CheckCircle2, GraduationCap, Info, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { evolve } from "../../../../shared/markov/evolution.ts";
import type { Mat, Vec } from "../../../../shared/markov/matrix.ts";
import {
  describeIssue,
  validateDistribution,
  validateStochastic,
  type Issue,
} from "../../../../shared/markov/validate.ts";
import { formatDecimal, parseNumber, toNumber, type Frac } from "../../../../shared/rational.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { EvolutionBlock } from "./EvolutionBlock.tsx";
import { InverseBlock } from "./InverseBlock.tsx";
import { cellId, MatrixEditor } from "./MatrixEditor.tsx";
import {
  DEFAULT_NAMES,
  loadMarkovDraft,
  MAX_CELL,
  MAX_NAME,
  saveMarkovDraft,
  type MarkovDraft,
  type Size,
} from "./markov-storage.ts";
import { StationaryBlock } from "./StationaryBlock.tsx";
import { ValidationBlock, type RowReport } from "./ValidationBlock.tsx";

const SAVE_DEBOUNCE_MS = 600;
const DEFAULT_STEPS = 3;

// Original illustrative chain (how a study session moves between activities). It is not taken from
// any course activity: keep examples original (see CONTRIBUTING.md).
const EXAMPLE = {
  names: DEFAULT_NAMES.slice(0, 3),
  P: [
    ["0,5", "0,3", "0,2"],
    ["0,2", "0,6", "0,2"],
    ["0,1", "0,3", "0,6"],
  ],
  v0: ["0,5", "0,5", "0"],
};

type Draft = Omit<MarkovDraft, "v">;

const blankRow = (s: number) => Array.from({ length: s }, () => "");

function emptyDraft(size: Size): Draft {
  return {
    size,
    names: DEFAULT_NAMES.slice(0, size),
    P: Array.from({ length: size }, () => blankRow(size)),
    v0: blankRow(size),
    n: DEFAULT_STEPS,
  };
}

function resize(d: Draft, size: Size): Draft {
  const fit = (row: string[]) => Array.from({ length: size }, (_, j) => row[j] ?? "");
  return {
    ...d,
    size,
    names: Array.from({ length: size }, (_, i) => d.names[i] ?? DEFAULT_NAMES[i]!),
    P: Array.from({ length: size }, (_, i) => fit(d.P[i] ?? [])),
    v0: fit(d.v0),
    vInv: d.vInv ? fit(d.vInv) : undefined,
  };
}

function initialDraft(nParam: string | null): Draft {
  const loaded = loadMarkovDraft();
  const requested = nParam !== null && /^[345]$/.test(nParam) ? (Number(nParam) as Size) : null;
  const base: Draft = loaded ? { ...loaded } : emptyDraft(requested ?? 3);
  return requested !== null && requested !== base.size ? resize(base, requested) : base;
}

const num = (x: Frac) => {
  const f = formatDecimal(x, 6);
  return f.exact ? f.text : `≈ ${f.text}`;
};

type Parsed = { value: Frac } | { error: string } | null;
const parseCell = (text: string): Parsed => {
  if (text.trim() === "") return null;
  const r = parseNumber(text);
  return r.ok ? { value: r.value } : { error: r.error };
};

function AcademicMarkovCheck({
  stateName,
  targetFrac,
}: {
  stateName: string;
  targetFrac: Frac | null;
}) {
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setVal("");
    setChecked(false);
  }, [stateName, targetFrac]);

  const parsed = useMemo(() => parseNumber(val), [val]);
  const isCorrect = useMemo(() => {
    if (!checked || !targetFrac || !parsed.ok) return false;
    const diff = Math.abs(toNumber(parsed.value) - toNumber(targetFrac));
    return diff < 0.005;
  }, [checked, targetFrac, parsed]);

  if (!targetFrac) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="text-accent" aria-hidden="true" />
        <h3 className="font-display text-[15px] font-semibold">
          Comprueba tu respuesta
        </h3>
      </div>
      <p className="text-[14px] text-muted">
        Calcula manualmente la probabilidad del estado <strong>{stateName}</strong> tras el paso 1 (v₁) antes de consultar la solución completa:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setChecked(false);
          }}
          placeholder="Ej: 0,35 o 7/20"
          aria-label={`Comprobar probabilidad paso 1 para ${stateName}`}
          className="min-h-9 w-44 rounded-md border border-border bg-sunken px-3 text-[14px] font-mono focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={!val.trim()}
          onClick={() => setChecked(true)}
          className="inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-[14px] font-semibold text-accent-contrast hover:opacity-90 disabled:opacity-40"
        >
          Comprobar
        </button>
      </div>

      {checked ? (
        <div className="pt-1">
          {isCorrect ? (
            <Chip tone="ok" className="text-[13px]">
              <CheckCircle2 size={16} aria-hidden="true" />
              ¡Correcto! Tu valor coincide con el cálculo de v₁ para {stateName}.
            </Chip>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Chip tone="warn" className="text-[13px]">
                No coincide. Inténtalo de nuevo.
              </Chip>
              <p className="text-[13px] text-muted">
                Pista: Multiplica el vector fila inicial v₀ por la columna correspondiente de la matriz P: v₁(j) = ∑ v₀(i) · P(i, j).
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function MarkovLabPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(params.get("n")));
  const [showSolution, setShowSolution] = useState(true);
  const { size, names, P, v0, n } = draft;
  // Inverse-problem vector: initialised from v0 until the user edits it (draft field vInv).
  const vInv = draft.vInv ?? v0;

  // Persist locally (strings only), debounced. Nothing but the size goes in the URL.
  useEffect(() => {
    const t = setTimeout(() => saveMarkovDraft({ v: 1, ...draft }), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    setParams(
      (prev) => {
        if (prev.get("n") === String(size)) return prev;
        const next = new URLSearchParams(prev);
        next.set("n", String(size));
        return next;
      },
      { replace: true },
    );
  }, [size, setParams]);

  const analysis = useMemo(() => {
    const parsedP = P.map((row) => row.map(parseCell));
    const cellErrors = new Map<string, string>();
    parsedP.forEach((row, i) =>
      row.forEach((c, j) => {
        if (c && "error" in c) cellErrors.set(`${i}-${j}`, c.error);
      }),
    );
    const invalidCells = new Set<string>(cellErrors.keys());
    const rowIssues: Issue[][] = [];
    const rowSums: (string | null)[] = [];
    const rowSumOk: boolean[] = [];
    const fullRows: (Frac[] | null)[] = parsedP.map((row) =>
      row.every((c) => c && "value" in c) ? row.map((c) => (c as { value: Frac }).value) : null,
    );
    fullRows.forEach((row, i) => {
      if (!row) {
        rowIssues.push([]);
        rowSums.push(null);
        rowSumOk.push(false);
        return;
      }
      const r = validateStochastic([row]);
      const issues = r.issues
        .filter((x) => x.kind !== "not-square")
        .map((x) => ({ ...x, row: i }) as Issue);
      issues.forEach((x) => {
        if (x.kind === "negative" || x.kind === "above-one") invalidCells.add(`${i}-${x.col}`);
      });
      rowIssues.push(issues);
      rowSums.push(num(r.rowSums[0]!));
      rowSumOk.push(!issues.some((x) => x.kind === "row-sum"));
    });
    const complete = fullRows.every((r) => r !== null);
    const allEmpty = P.every((row) => row.every((c) => c.trim() === ""));
    const matrixOk = complete && rowIssues.every((x) => x.length === 0);
    const matrix: Mat | null = complete ? (fullRows as Frac[][]) : null;

    const parsedV0 = v0.map(parseCell);
    const v0Errors = new Map<number, string>();
    parsedV0.forEach((c, j) => {
      if (c && "error" in c) v0Errors.set(j, c.error);
    });
    const v0Full = parsedV0.every((c) => c && "value" in c);
    const vec: Vec | null = v0Full ? parsedV0.map((c) => (c as { value: Frac }).value) : null;
    let v0Sum: string | null = null;
    let v0Message: string | null = null;
    let v0Ok = false;
    if (vec) {
      const dist = validateDistribution(vec);
      v0Sum = num(dist.sum);
      v0Ok = dist.ok;
      if (!dist.ok) {
        v0Message = `v₀ debe sumar 1 y no tener valores negativos. Ahora suma ${v0Sum}.`;
      }
    }
    return {
      cellErrors,
      invalidCells,
      rowIssues,
      rowSums,
      rowSumOk,
      complete,
      allEmpty,
      matrixOk,
      matrix,
      v0Errors,
      v0Sum,
      v0Message,
      v0Ok,
      vec,
    };
  }, [P, v0]);

  const reports: RowReport[] = useMemo(
    () =>
      P.map((row, i) => {
        const issues = analysis.rowIssues[i] ?? [];
        const parseBad = row.findIndex((_, j) => analysis.cellErrors.has(`${i}-${j}`));
        const entryIssue = issues.find((x) => x.kind === "negative" || x.kind === "above-one");
        const targetCol = parseBad >= 0 ? parseBad : entryIssue && "col" in entryIssue ? entryIssue.col : 0;
        const messages = [
          ...issues.map((x) => describeIssue(x, names)),
          ...(parseBad >= 0 ? ["Hay una celda sin número válido en esta fila."] : []),
        ];
        return {
          name: names[i] || `Estado ${i + 1}`,
          sumText: analysis.rowSums[i] ?? null,
          sumOk: analysis.rowSumOk[i] ?? false,
          messages,
          invalid: messages.length > 0,
          targetId: cellId(i, targetCol),
        };
      }),
    [P, names, analysis],
  );

  const evolution = useMemo(
    () =>
      analysis.matrixOk && analysis.v0Ok && analysis.matrix && analysis.vec
        ? evolve(analysis.matrix, analysis.vec, n)
        : null,
    [analysis, n],
  );

  const solverMatrix = analysis.matrixOk ? analysis.matrix : null;
  const solverHint = analysis.matrixOk ? null : "Corrige la matriz para ver la evolución.";

  const displayNames = names.map((nm, i) => nm || `Estado ${i + 1}`);

  const verdict = analysis.complete ? (analysis.matrixOk ? "ok" : "bad") : "incomplete";

  const isExample =
    size === 3 &&
    names.every((nm, i) => nm === EXAMPLE.names[i]) &&
    P.every((row, i) => row.every((c, j) => c === EXAMPLE.P[i]![j])) &&
    v0.every((c, j) => c === EXAMPLE.v0[j]);
  const isEmpty =
    P.every((row) => row.every((c) => c === "")) &&
    v0.every((c) => c === "") &&
    names.every((nm, i) => nm === DEFAULT_NAMES[i]);

  const patch = (f: (d: Draft) => Draft) => setDraft(f);
  const setCell = (i: number, j: number, text: string) =>
    patch((d) => ({
      ...d,
      P: d.P.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? text.slice(0, MAX_CELL) : c)) : row)),
    }));

  const evolutionHint = !analysis.matrixOk
    ? "Corrige la matriz para ver la evolución."
    : !analysis.v0Ok
      ? "Corrige v₀ para ver la evolución."
      : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Simulador de Markov
        </h1>
        <p className="text-muted">
          Comprueba tu desarrollo de cadenas de Markov con los pasos a la vista.
        </p>
        <p className="flex items-start gap-2 text-[14px] text-muted">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0" />
          <span>
            Comprueba tu desarrollo: aquí ves los pasos para contrastar tu resultado con el de la
            herramienta. Escribe tú tu propio desarrollo.
          </span>
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <MatrixEditor
            size={size}
            names={names}
            P={P}
            v0={v0}
            steps={n}
            invalidCells={analysis.invalidCells}
            cellErrors={analysis.cellErrors}
            v0Errors={analysis.v0Errors}
            v0Message={analysis.v0Message}
            rowSums={analysis.rowSums}
            v0Sum={analysis.v0Sum}
            isExample={isExample}
            isEmpty={isEmpty}
            wouldLose={(next) =>
              P.some((row, i) => row.some((c, j) => (i >= next || j >= next) && c !== "")) ||
              v0.some((c, j) => j >= next && c !== "")
            }
            onSize={(next) => patch((d) => resize(d, next))}
            onName={(i, text) =>
              patch((d) => ({ ...d, names: d.names.map((x, k) => (k === i ? text.slice(0, MAX_NAME) : x)) }))
            }
            onCell={setCell}
            onPasteP={(i, j, text) => {
              const lines = text.split(/\r?\n/);
              if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
              patch((d) => ({
                ...d,
                P: d.P.map((row, ri) => {
                  const line = lines[ri - i];
                  if (ri < i || line === undefined) return row;
                  const cells = line.split("\t");
                  return row.map((c, ci) => {
                    const v = cells[ci - j];
                    return ci < j || v === undefined ? c : v.trim().slice(0, MAX_CELL);
                  });
                }),
              }));
            }}
            onV0={(j, text) =>
              patch((d) => ({ ...d, v0: d.v0.map((c, k) => (k === j ? text.slice(0, MAX_CELL) : c)) }))
            }
            onSteps={(next) => patch((d) => ({ ...d, n: next }))}
            onLoadExample={() =>
              patch((d) => ({
                ...resize(d, 3),
                names: [...EXAMPLE.names],
                P: EXAMPLE.P.map((r) => [...r]),
                v0: [...EXAMPLE.v0],
                vInv: undefined,
              }))
            }
            onReset={() => patch((d) => ({ ...emptyDraft(d.size), n: DEFAULT_STEPS }))}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          {analysis.allEmpty ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[20px] font-semibold">Introduce tu matriz P</h2>
              <p className="text-muted">
                Escribe cada fila de probabilidades (por ejemplo, 0,25 o 1/4) o pega una tabla desde
                Numbers o Excel. También puedes cargar un ejemplo ilustrativo para ver cómo funciona.
              </p>
            </div>
          ) : (
            <>
              <ValidationBlock verdict={verdict} rows={reports} />

              {evolution && evolution.vectors[1] && evolution.vectors[1][0] ? (
                <AcademicMarkovCheck
                  stateName={displayNames[0] ?? "Estado 1"}
                  targetFrac={evolution.vectors[1][0]}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken/40 px-3 py-2">
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <Info size={16} aria-hidden="true" />
                  <span>
                    Aviso de integridad: calcula el desarrollo en papel antes de consultar la solución completa generada por la herramienta.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSolution((s) => !s)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-raised px-3 text-[13px] font-medium hover:bg-sunken"
                >
                  {showSolution ? "Ocultar solución detallada" : "Ver la solución completa"}
                </button>
              </div>

              {showSolution ? (
                <>
                  <div className="flex flex-col gap-3">
                    {evolution ? (
                      <EvolutionBlock
                        names={displayNames}
                        vectors={evolution.vectors}
                        steps={evolution.steps}
                      />
                    ) : evolutionHint ? (
                      <Chip tone="info">{evolutionHint}</Chip>
                    ) : null}
                  </div>
                  <StationaryBlock names={displayNames} P={solverMatrix} hint={solverHint} />
                  <InverseBlock
                    names={displayNames}
                    P={solverMatrix}
                    hint={solverHint}
                    v={vInv}
                    onV={(j, text) =>
                      patch((d) => ({
                        ...d,
                        vInv: (d.vInv ?? d.v0).map((c, k) => (k === j ? text.slice(0, MAX_CELL) : c)),
                      }))
                    }
                  />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
