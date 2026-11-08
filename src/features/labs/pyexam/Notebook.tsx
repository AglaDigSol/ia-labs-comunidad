// El cuaderno del simulacro de 01MIAR durante el intento: celdas de enunciado, celdas de solución
// editables (con el editor de los ejercicios), la de los import del proyecto y las «Test Use Case» de
// solo lectura, todas con «Ejecutar celda» en un kernel compartido (kernel.ts): lo que define una celda
// lo ven las siguientes, como en Jupyter. «Ejecutar todo» las ejecuta en orden y para en el primer
// error; «Reiniciar kernel» borra las variables.
//
// Las salidas: lo que se imprime, el valor de la última expresión (una tabla de pandas se pinta como
// tabla con su texto, nunca como HTML), la traza de los errores y las figuras (en canvas). Solo se
// ejecuta lo que pide la persona; las comprobaciones ocultas no existen aquí.
import { CircleCheck, HardDriveDownload, OctagonAlert, Play, PlayCircle, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { pyExamCells, pyExamFiles, pyExamPartName, slotCode, type PyExam, type PyExamCell } from "../../../../shared/pyexam/index.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { FIRST_DOWNLOAD_BYTES, usePythonRuntime } from "../exercises/python/runtime.ts";
import { CodeEditor } from "../python/CodeEditor.tsx";
import { Figure } from "../python/Figure.tsx";
import type { PyClient, PyEvent } from "../python/py-client.ts";
import { CELL_TIMEOUT_MS, cellProgram, newKernelId, parseKernelReply, type KernelValue } from "./kernel.ts";
import { TableOutput } from "./TableOutput.tsx";

export const COPY_KERNEL_LOST = "Python se había reiniciado: las variables de antes se han perdido. Vuelve a ejecutar las celdas anteriores (o «Ejecutar todo»).";
export const COPY_KERNEL_RESTARTED = "Kernel reiniciado: las variables se han borrado.";
const COPY_LOAD_FAILED = "No se pudo cargar Python. Comprueba la conexión y vuelve a intentarlo.";
const MAX_STREAM = 20_000;
const fmtMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;

/** Texto con `código` entre comillas invertidas (como los enunciados de los ejercicios). */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 1 ? (
          <code key={i} className="mono rounded bg-sunken px-1 text-[0.95em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function Pre({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <pre aria-label={label} className={cn("mono overflow-x-auto whitespace-pre rounded-md border border-border bg-sunken px-3 py-2 text-[14px] leading-[1.5]", className)}>
      {children}
    </pre>
  );
}

// ---------------------------------------------------------------- Salidas

/** Lo que dejó la última ejecución de una celda. */
export type CellRun = { count: number; stream: string; value: KernelValue | null; error: string | null; figures: string[]; notice: string | null; ok: boolean };

export { TableOutput };

function CellOutput({ run, test }: { run: CellRun; test: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-label={`Salida [${run.count}]`} role="group">
      {run.notice ? <p className="text-[14px] font-semibold text-warn">{run.notice}</p> : null}
      {run.stream ? <Pre label="Lo que imprime">{run.stream}</Pre> : null}
      {run.value?.tipo === "tabla" ? <TableOutput value={run.value} /> : run.value ? <Pre label="Valor de la última expresión">{run.value.texto}</Pre> : null}
      {run.error ? (
        <Pre label="Error" className="border-crit text-crit">
          {run.error}
        </Pre>
      ) : null}
      {run.figures.map((b64, i) => (
        <Figure key={i} b64={b64} n={i + 1} label={run.figures.length > 1 ? `Figura ${i + 1} de la celda [${run.count}]` : `Figura de la celda [${run.count}]`} />
      ))}
      {test && run.ok ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ok">
          <CircleCheck size={16} aria-hidden="true" />
          Los assert de la vista se cumplen.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Kernel

type RunnableCell = Exclude<PyExamCell, { kind: "md" }>;

/**
 * El kernel de un cuaderno: ejecuta celdas en el PyClient compartido de los ejercicios, guarda la
 * salida de cada una y lleva la cuenta [n]. Los datos del enunciado se escriben en la carpeta de
 * trabajo antes de cada ejecución (con los nombres que usa el enunciado).
 */
export function useNotebookKernel(exam: PyExam) {
  const { phase, ensure } = usePythonRuntime();
  const [runs, setRuns] = useState<Record<string, CellRun>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loadFailed, setLoadFailed] = useState(false);
  const kernel = useRef<string | null>(null);
  const count = useRef(0);
  const client = useRef<PyClient | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const files = useCallback(() => Object.entries(pyExamFiles(exam)).map(([name, text]) => ({ name, data: new TextEncoder().encode(text).buffer as ArrayBuffer })), [exam]);

  /** Ejecuta una celda; true si terminó sin error. */
  const run = useCallback(
    async (cell: RunnableCell, code: string): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setRunning(cell.id);
      setLoadFailed(false);
      try {
        const c = await ensure();
        if (!alive.current) return false;
        if (!c) {
          setLoadFailed(true);
          return false;
        }
        client.current = c;
        for (const f of files()) c.upload(f.name, f.data);
        const fresh = kernel.current === null;
        if (fresh) {
          kernel.current = newKernelId();
          count.current = 0;
        }
        const n = ++count.current;
        const { program, imports, error } = cellProgram(code, n, kernel.current!, fresh);
        const out: CellRun = { count: n, stream: "", value: null, error: null, figures: [], notice: null, ok: false };
        if (error) {
          setRuns((r) => ({ ...r, [cell.id]: { ...out, error } }));
          return false;
        }
        const onEvent = (e: PyEvent) => {
          if (e.type === "package") setStatus(e.phase === "start" ? `Cargando ${e.name}…` : "");
          else if ((e.type === "stdout" || e.type === "stderr") && out.stream.length < MAX_STREAM) {
            out.stream = (out.stream + e.text).slice(0, MAX_STREAM);
            setRuns((r) => ({ ...r, [cell.id]: { ...out } }));
          }
        };
        setRuns((r) => ({ ...r, [cell.id]: { ...out } }));
        const o = await c.run(program, CELL_TIMEOUT_MS, onEvent, [], { capture: true, imports });
        if (!alive.current) return false;
        let result: CellRun;
        if (o.kind === "done") {
          const reply = parseKernelReply(o.value);
          if (!reply) result = { ...out, error: "No se ha podido leer el resultado de la celda.", figures: o.figures };
          else {
            kernel.current = reply.kernel;
            result = { ...out, value: reply.valor, error: reply.error?.traza ?? null, figures: o.figures, notice: reply.perdido ? COPY_KERNEL_LOST : null, ok: reply.error === null };
          }
        } else if (o.kind === "timeout") {
          kernel.current = null;
          result = { ...out, error: `La celda superó ${o.seconds} s y se detuvo. Python se ha reiniciado: las variables se han perdido.` };
        } else if (o.kind === "stopped") {
          if (o.restarted) kernel.current = null;
          result = { ...out, error: o.restarted ? "Ejecución detenida. Python se ha reiniciado: las variables se han perdido." : "Ejecución detenida por ti." };
        } else {
          result = { ...out, error: o.message };
        }
        setRuns((r) => ({ ...r, [cell.id]: result }));
        return result.ok;
      } catch (e) {
        setRuns((r) => ({ ...r, [cell.id]: { count: count.current, stream: "", value: null, error: e instanceof Error ? e.message : String(e), figures: [], notice: null, ok: false } }));
        return false;
      } finally {
        busy.current = false;
        setStatus("");
        if (alive.current) setRunning(null);
      }
    },
    [ensure, files],
  );

  const restart = useCallback(() => {
    kernel.current = null;
    count.current = 0;
    setRuns({});
  }, []);

  /** Para la celda en marcha (si hay una). */
  const stop = useCallback(async () => {
    if (busy.current && client.current) await client.current.stop();
  }, []);

  return { phase, ensure, runs, running, status, loadFailed, run, restart, stop };
}

export type NotebookKernel = ReturnType<typeof useNotebookKernel>;

// ---------------------------------------------------------------- Cuaderno

/** Ancla de una parte (para el navegador): el título de su enunciado. */
export const partAnchor = (part: number) => `pyexam-parte-${part}`;

export function Notebook({
  exam,
  code,
  starters,
  kernel,
  onCode,
}: {
  exam: PyExam;
  code: ReadonlyArray<string | null> | null;
  starters: readonly string[];
  kernel: NotebookKernel;
  onCode: (slot: number, text: string) => void;
}) {
  const cells = pyExamCells(exam);
  const textOf = (c: RunnableCell) => (c.kind === "code" ? slotCode(starters, code, c.slot) : c.code);
  const busy = kernel.running !== null;
  const shownParts = new Set<number>();
  return (
    <ol className="flex min-w-0 flex-col gap-4" aria-label="Celdas del cuaderno">
      {cells.map((c) => {
        if (c.kind === "md") {
          if (c.part === null) return null; // las instrucciones van en la pantalla de inicio y en la cabecera
          const first = !shownParts.has(c.part);
          shownParts.add(c.part);
          const H = c.level === 2 ? "h2" : "h3";
          return (
            <li key={c.id} className="flex min-w-0 flex-col gap-2 pt-2">
              <H id={first ? partAnchor(c.part) : undefined} tabIndex={-1} className={cn("font-display font-semibold", c.level === 2 ? "text-[22px]" : "text-[18px]")}>
                {c.title}
              </H>
              {c.text.map((p, i) => (
                <p key={i} className="min-w-0 break-words">
                  <RichText text={p} />
                </p>
              ))}
            </li>
          );
        }
        const run = kernel.runs[c.id];
        const name = pyExamPartName(exam, c.part);
        const label = c.kind === "code" ? `Tu solución AQUÍ · ${name}` : c.kind === "setup" ? "Celda de los import (solo lectura)" : `Test Use Case · ${name} (solo lectura)`;
        const execute = () => void kernel.run(c, textOf(c));
        return (
          <li key={c.id} className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-raised p-3", c.kind === "code" ? "border-accent" : "border-border")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[14px] font-semibold">
                <span className="mono text-muted" aria-label={run ? `Ejecutada en el turno ${run.count}` : "Sin ejecutar"}>{`[${run ? run.count : " "}]`}</span>
                {label}
              </span>
              <Button onClick={execute} disabled={busy} aria-label={`Ejecutar celda: ${label}`}>
                <Play size={16} aria-hidden="true" />
                {kernel.running === c.id ? "Ejecutando…" : "Ejecutar celda"}
              </Button>
            </div>
            {c.kind === "code" ? (
              <CodeEditor label={label} describedBy="pyexam-teclas" value={textOf(c)} onChange={(v) => onCode(c.slot, v)} onSubmit={execute} minRows={6} />
            ) : (
              <Pre label={label}>{c.code}</Pre>
            )}
            {run ? <CellOutput run={run} test={c.kind === "test"} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** La barra del kernel: «Ejecutar todo», «Reiniciar kernel», «Detener» y el estado de Python. */
export function KernelBar({ exam, code, starters, kernel, onMessage }: { exam: PyExam; code: ReadonlyArray<string | null> | null; starters: readonly string[]; kernel: NotebookKernel; onMessage: (m: string) => void }) {
  const runAll = async () => {
    for (const c of pyExamCells(exam)) {
      if (c.kind === "md") continue;
      const ok = await kernel.run(c, c.kind === "code" ? slotCode(starters, code, c.slot) : c.code);
      if (!ok) {
        onMessage(`«Ejecutar todo» se ha parado en un error: ${pyExamPartName(exam, c.part)}.`);
        return;
      }
    }
    onMessage("«Ejecutar todo» ha terminado sin errores.");
  };
  const busy = kernel.running !== null;
  const phase = kernel.loadFailed && kernel.phase !== "loading" ? "error" : kernel.phase;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void runAll()} disabled={busy}>
          <PlayCircle size={16} aria-hidden="true" />
          Ejecutar todo
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            kernel.restart();
            onMessage(COPY_KERNEL_RESTARTED);
          }}
          disabled={busy}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reiniciar kernel
        </Button>
        {busy ? (
          <Button variant="ghost" onClick={() => void kernel.stop()}>
            <Square size={16} aria-hidden="true" />
            Detener
          </Button>
        ) : null}
        {phase === "ready" ? (
          <Chip tone="ok">{kernel.status || (busy ? "Ejecutando…" : "Python listo")}</Chip>
        ) : phase === "loading" ? (
          <Chip tone="info">Cargando Python…</Chip>
        ) : phase === "error" ? (
          <span role="alert" className="flex items-center gap-2 text-[14px] text-crit">
            <OctagonAlert size={16} aria-hidden="true" />
            {COPY_LOAD_FAILED}
          </span>
        ) : (
          <Button variant="ghost" onClick={() => void kernel.ensure()}>
            <HardDriveDownload size={16} aria-hidden="true" />
            Cargar Python
          </Button>
        )}
      </div>
    </div>
  );
}

/** Aviso de la descarga de Python (fuera de la cabecera fija: en el móvil ocuparía media pantalla). */
export function KernelNote({ kernel }: { kernel: NotebookKernel }) {
  if (kernel.phase !== "idle") return null;
  return <p className="text-[14px] text-muted">{`Las celdas se ejecutan con Python en tu navegador. Si aún no está en este dispositivo, la primera vez se descargan unos ${fmtMB(FIRST_DOWNLOAD_BYTES)} (y pandas, matplotlib y seaborn al importarlos).`}</p>;
}
