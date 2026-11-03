// Vista del paso a paso: el código con la línea actual marcada, «Principio / Anterior / Siguiente /
// Final» y un deslizador, los marcos de la pila con sus variables (y los alias) y lo impreso hasta
// ese paso. La línea actual se anuncia con aria-live. La usan la pestaña Python («Ejecutar paso a
// paso») y «¿Qué imprime?» (tras una respuesta equivocada).
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, OctagonAlert, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import type { PyClient } from "./py-client.ts";
import {
  aliasText,
  buildTraceProgram,
  frameLabel,
  LIMIT_TEXT,
  parseTrace,
  stepText,
  TRACE_TIMEOUT_MS,
  tracePayload,
  type Trace,
} from "./tracer.ts";

export type TraceOutcome = { ok: true; trace: Trace } | { ok: false; message: string };

/** Ejecuta el paso a paso en el worker de `client` (ya cargado). */
export async function runTrace(client: PyClient, code: string, stdin: string[] = []): Promise<TraceOutcome> {
  try {
    const o = await client.run(buildTraceProgram(tracePayload(code, stdin)), TRACE_TIMEOUT_MS, () => {}, [], { capture: true, imports: code });
    switch (o.kind) {
      case "done": {
        const trace = parseTrace(o.value);
        return trace ? { ok: true, trace } : { ok: false, message: "No se ha podido leer el paso a paso." };
      }
      case "timeout":
        return { ok: false, message: `El paso a paso superó ${o.seconds} s y Python se ha reiniciado.` };
      case "stopped":
        return { ok: false, message: "Paso a paso detenido." };
      case "error":
        return { ok: false, message: o.message };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export function TraceView({ code, trace, onClose }: { code: string; trace: Trace; onClose?: () => void }) {
  const id = useId();
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [trace]);
  const n = trace.pasos.length;
  const step = trace.pasos[Math.min(i, n - 1)];
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  // Las posiciones de la salida son caracteres de Python (puntos de código), no unidades UTF-16.
  const chars = useMemo(() => Array.from(trace.salida), [trace]);
  const out = step ? chars.slice(0, step.salida).join("") : "";
  const announce = n > 0 ? stepText(trace, Math.min(i, n - 1)) : "";
  const go = (k: number) => setI(Math.max(0, Math.min(n - 1, k)));

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-display text-[20px] font-semibold">
          Paso a paso
        </h2>
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cerrar el paso a paso
          </Button>
        ) : null}
      </div>

      {trace.sintaxis ? (
        <p className="flex items-start gap-2 text-[14px] text-crit">
          <OctagonAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {`El código tiene un error de sintaxis${trace.sintaxis.linea ? ` en la línea ${trace.sintaxis.linea}` : ""}: ${trace.sintaxis.mensaje}. Corrígelo y vuelve a intentarlo.`}
        </p>
      ) : n === 0 ? (
        <p className="text-[14px] text-muted">No hay ninguna línea que ejecutar.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div role="toolbar" aria-label="Controles del paso a paso" className="flex flex-wrap items-center gap-2">
              <Button onClick={() => go(0)} disabled={i === 0}>
                <ChevronsLeft size={16} aria-hidden="true" />
                Principio
              </Button>
              <Button onClick={() => go(i - 1)} disabled={i === 0}>
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </Button>
              <Button variant="primary" onClick={() => go(i + 1)} disabled={i >= n - 1}>
                Siguiente
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
              <Button onClick={() => go(n - 1)} disabled={i >= n - 1}>
                Final
                <ChevronsRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor={`${id}-slider`} className="text-[14px] font-semibold">
                Paso
              </label>
              <input
                id={`${id}-slider`}
                type="range"
                min={1}
                max={n}
                value={Math.min(i, n - 1) + 1}
                aria-valuetext={announce}
                onChange={(e) => go(Number(e.target.value) - 1)}
                className="min-h-11 min-w-0 flex-1 accent-[var(--color-accent)]"
              />
              <span className="mono text-[14px]">{`${Math.min(i, n - 1) + 1} / ${n}`}</span>
            </div>
            <p className="text-[14px]" aria-live="polite" data-testid="trace-step">
              {announce}
            </p>
          </div>

          {trace.limite ? (
            <p role="note" className="flex items-start gap-2 rounded-md bg-warn-bg px-3 py-2 text-[14px] text-warn">
              <OctagonAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {LIMIT_TEXT[trace.limite]}
            </p>
          ) : null}
          {trace.error ? (
            <p className="flex items-start gap-2 text-[14px] text-crit">
              <OctagonAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {`El programa termina con un error${trace.error.linea ? ` en la línea ${trace.error.linea}` : ""}: ${trace.error.mensaje}`}
            </p>
          ) : null}

          <div className="grid items-start gap-3 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-[14px] font-semibold">Código</h3>
              <ol aria-label="Código con la línea actual" className="mono overflow-x-auto rounded-md border border-border bg-sunken py-2 text-[14px] leading-[1.6]">
                {lines.map((text, k) => {
                  const current = step?.linea === k + 1;
                  return (
                    <li
                      key={k}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex whitespace-pre px-2",
                        current && (step?.evento === "error" ? "bg-crit-bg font-semibold" : "bg-info-bg font-semibold"),
                      )}
                    >
                      <span aria-hidden="true" className="w-5 shrink-0 text-accent">
                        {current ? "▶" : ""}
                      </span>
                      <span aria-hidden="true" className="w-8 shrink-0 select-none pr-2 text-right text-muted">
                        {k + 1}
                      </span>
                      <span>
                        {current ? <span className="sr-only">Línea actual: </span> : null}
                        {text || " "}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-[14px] font-semibold">Variables</h3>
                {step?.evento === "return" ? (
                  <p className="mono text-[14px]">{`${frameLabel(step.marcos[step.marcos.length - 1]?.nombre ?? "")} devuelve ${step.devuelve ?? "None"}`}</p>
                ) : null}
                <div className="flex flex-col gap-2">
                  {(step?.marcos ?? []).map((f, k, all) => (
                    <section
                      key={k}
                      aria-label={frameLabel(f.nombre)}
                      className={cn("rounded-md border px-3 py-2", k === all.length - 1 ? "border-accent" : "border-border")}
                    >
                      <h4 className="text-[14px] font-semibold">{`${frameLabel(f.nombre)}${k === all.length - 1 ? " (activo)" : ""}`}</h4>
                      {f.variables.length === 0 ? (
                        <p className="text-[14px] text-muted">Sin variables todavía.</p>
                      ) : (
                        <dl className="mono grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
                          {f.variables.map((v) => {
                            const alias = aliasText(v, all, k);
                            return (
                              <div key={v.nombre} className="contents">
                                <dt className="font-semibold">{v.nombre}</dt>
                                <dd className="min-w-0 break-words">
                                  {v.valor}
                                  {alias ? <span className="block font-body text-muted">{alias}</span> : null}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </section>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h3 id={`${id}-out`} className="text-[14px] font-semibold">
                  Salida hasta este paso
                </h3>
                <pre aria-labelledby={`${id}-out`} className="mono min-h-11 whitespace-pre-wrap break-words rounded-md border border-border bg-base p-2 text-[14px]">
                  {out}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
