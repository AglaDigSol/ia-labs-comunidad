import { Minus, OctagonAlert, Plus } from "lucide-react";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Button } from "../../../components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../components/ui/dialog.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import {
  isSize,
  MAX_CELL,
  MAX_NAME,
  MAX_UI_STEPS,
  MIN_STEPS,
  type Size,
} from "./markov-storage.ts";

export const cellId = (i: number, j: number) => `markov-p-${i}-${j}`;
export const v0Id = (j: number) => `markov-v0-${j}`;

export interface MatrixEditorProps {
  size: Size;
  names: string[];
  P: string[][];
  v0: string[];
  steps: number;
  /** Cell keys "i-j" with a problem (parse error or invalid probability). */
  invalidCells: ReadonlySet<string>;
  /** Parse error text per cell key "i-j". */
  cellErrors: ReadonlyMap<string, string>;
  v0Errors: ReadonlyMap<number, string>;
  v0Message: string | null;
  rowSums: (string | null)[];
  v0Sum: string | null;
  isExample: boolean;
  isEmpty: boolean;
  /** True when shrinking to `size` would drop typed data. */
  wouldLose: (size: Size) => boolean;
  onSize: (size: Size) => void;
  onName: (i: number, text: string) => void;
  onCell: (i: number, j: number, text: string) => void;
  onPasteP: (i: number, j: number, text: string) => void;
  onV0: (j: number, text: string) => void;
  onSteps: (n: number) => void;
  onLoadExample: () => void;
  onReset: () => void;
}

const abbr = (name: string, i: number) => {
  const t = name.trim();
  if (!t || /^Estado \d+$/i.test(t)) return `E${i + 1}`;
  return t.slice(0, 3);
};

function focusId(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}

export function MatrixEditor(p: MatrixEditorProps) {
  const [pending, setPending] = useState<Size | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const s = p.size;

  const onSizeChange = (value: string) => {
    const next = Number(value);
    if (!isSize(next) || next === s) return;
    if (next < s && p.wouldLose(next)) setPending(next);
    else p.onSize(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number, j: number) => {
    let ti = i;
    let tj = j;
    if (e.key === "ArrowDown" || e.key === "Enter") ti = Math.min(s - 1, i + 1);
    else if (e.key === "ArrowUp") ti = Math.max(0, i - 1);
    else if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length)
      tj = Math.min(s - 1, j + 1);
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) tj = Math.max(0, j - 1);
    else return;
    e.preventDefault();
    focusId(cellId(ti, tj));
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number, j: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    p.onPasteP(i, j, text);
  };

  const cellClass = (bad: boolean) =>
    cn(
      "h-11 w-full min-w-0 rounded-md border bg-raised px-1.5 text-right font-mono text-[16px] text-fg",
      bad ? "border-2 border-crit" : "border-border",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold" id="markov-size-label">
          Tamaño
        </span>
        <ToggleGroup
          type="single"
          value={String(s)}
          aria-labelledby="markov-size-label"
          onValueChange={onSizeChange}
        >
          {([3, 4, 5] as const).map((z) => (
            <ToggleGroupItem key={z} value={String(z)}>
              {`${z}×${z}`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Estados</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
          {p.names.slice(0, s).map((name, i) => (
            <input
              key={i}
              aria-label={`Nombre del estado ${i + 1}`}
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => p.onName(i, e.target.value)}
              className="h-12 rounded-md border border-border bg-raised px-2 text-[14px] text-fg"
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Matriz de transición P</span>
          {p.isExample ? (
            <span className="rounded-md bg-info-bg px-2 py-1 text-[14px] text-info">
              Ejemplo ilustrativo
            </span>
          ) : null}
        </div>
        <div className="max-w-full overflow-x-auto">
          <div
            role="grid"
            aria-label="Matriz P por filas"
            className="grid min-w-[300px] gap-1.5"
            style={{ gridTemplateColumns: `auto repeat(${s}, minmax(0,1fr)) auto` }}
          >
            <div role="row" className="contents">
              <span />
              {p.names.slice(0, s).map((n, j) => (
                <span
                  key={j}
                  role="columnheader"
                  title={n}
                  aria-label={n || `Estado ${j + 1}`}
                  className="min-w-0 truncate px-0.5 text-center text-[13px] text-muted"
                >
                  {abbr(n, j)}
                </span>
              ))}
              <span role="columnheader" className="text-center text-[14px] text-muted">
                Σ
              </span>
            </div>
            {p.P.slice(0, s).map((row, i) => (
              <div role="row" className="contents" key={i}>
                <span role="rowheader" title={p.names[i]} className="self-center pr-1 text-[13px] text-muted">
                  {abbr(p.names[i] ?? "", i)}
                </span>
                {row.slice(0, s).map((val, j) => {
                  const key = `${i}-${j}`;
                  const bad = p.invalidCells.has(key);
                  return (
                    <div role="gridcell" key={j} className="relative">
                      <input
                        id={cellId(i, j)}
                        aria-label={`P(${i + 1},${j + 1})`}
                        aria-invalid={bad ? "true" : undefined}
                        aria-describedby={p.cellErrors.has(key) ? `markov-err-${key}` : undefined}
                        inputMode="decimal"
                        autoComplete="off"
                        maxLength={MAX_CELL}
                        value={val}
                        onChange={(e) => p.onCell(i, j, e.target.value)}
                        onKeyDown={(e) => onKey(e, i, j)}
                        onPaste={(e) => onPaste(e, i, j)}
                        className={cellClass(bad)}
                      />
                      {bad ? (
                        <OctagonAlert
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1 top-1 text-crit"
                        />
                      ) : null}
                    </div>
                  );
                })}
                <span role="gridcell" className="self-center whitespace-nowrap pl-1 text-right font-mono text-[12px] text-muted">
                  {p.rowSums[i] === null || p.rowSums[i] === undefined ? "" : `Σ ${p.rowSums[i]}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        {[...p.cellErrors.entries()].map(([key, msg]) => {
          const [i, j] = key.split("-").map(Number) as [number, number];
          return (
            <p key={key} id={`markov-err-${key}`} className="flex gap-2 text-[14px] text-crit">
              <span className="font-mono">{`P(${i + 1},${j + 1})`}</span>
              <span>{msg}</span>
            </p>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold">Distribución inicial v₀</span>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${s}, minmax(0,1fr)) auto` }}>
          {p.v0.slice(0, s).map((val, j) => {
            const bad = p.v0Errors.has(j);
            return (
              <input
                key={j}
                id={v0Id(j)}
                aria-label={`v₀(${j + 1})`}
                aria-invalid={bad ? "true" : undefined}
                inputMode="decimal"
                autoComplete="off"
                maxLength={MAX_CELL}
                value={val}
                onChange={(e) => p.onV0(j, e.target.value)}
                className={cellClass(bad)}
              />
            );
          })}
          <span className="self-center font-mono text-[14px] text-muted">
            {p.v0Sum === null ? "" : `Σ ${p.v0Sum}`}
          </span>
        </div>
        {[...p.v0Errors.entries()].map(([j, msg]) => (
          <p key={j} className="flex gap-2 text-[14px] text-crit">
            <span className="font-mono">{`v₀(${j + 1})`}</span>
            <span>{msg}</span>
          </p>
        ))}
        {p.v0Message ? <p className="text-[14px] text-crit">{p.v0Message}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold" id="markov-steps-label">
          Pasos n
        </span>
        <div className="inline-flex items-center gap-1" role="group" aria-labelledby="markov-steps-label">
          <Button
            aria-label="Menos pasos"
            className="min-w-11 px-0"
            disabled={p.steps <= MIN_STEPS}
            onClick={() => p.onSteps(p.steps - 1)}
          >
            <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <output aria-live="polite" className="min-w-10 text-center font-mono text-[20px]">
            {p.steps}
          </output>
          <Button
            aria-label="Más pasos"
            className="min-w-11 px-0"
            disabled={p.steps >= MAX_UI_STEPS}
            onClick={() => p.onSteps(p.steps + 1)}
          >
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={p.onLoadExample}>Cargar ejemplo ilustrativo</Button>
        <Button
          className="border-destructive text-destructive"
          disabled={p.isEmpty}
          onClick={() => setResetOpen(true)}
        >
          Restablecer matriz
        </Button>
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogTitle>{`Reducir a ${pending}×${pending}`}</DialogTitle>
          <DialogDescription>
            {`Reducir a ${pending}×${pending}: se perderán las filas y columnas sobrantes.`}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button>Conservar tamaño</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending !== null) p.onSize(pending);
                setPending(null);
              }}
            >
              Reducir matriz
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogTitle>Confirmar restablecimiento</DialogTitle>
          <DialogDescription>
            Restablecer matriz: se perderán los valores de P, v₀ y los nombres de estados que has
            escrito. No se puede deshacer.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button>Conservar matriz</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                p.onReset();
                setResetOpen(false);
              }}
            >
              Restablecer matriz
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
