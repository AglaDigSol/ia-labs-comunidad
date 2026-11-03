// Vistas de los ejercicios de Python (chunk perezoso: solo se descarga con el módulo Python
// encendido). Ejercicio de código: enunciado, editor con el código inicial, «Comprobar» (el banco de
// pruebas en el worker), pistas graduadas y la solución detrás de «Ver la solución completa».
// «¿Qué imprime?»: el fragmento, la respuesta de la persona y, si falla, el paso a paso.
// Integridad: el resultado de cada caso dice si es correcto y, si no, lo que hizo tu código; nunca
// el valor esperado. Las pistas no llevan código. Nada se ejecuta sin pulsar un botón.
import { CircleCheck, CircleX, Footprints, HardDriveDownload, Lightbulb, OctagonAlert, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PY_TEMAS, type PyCase, type PyCodeInstance, type PyInstance, type PyOutputInstance } from "../../../../../shared/exercises/python.ts";
import { SolutionGate } from "../../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../../components/ui/button.tsx";
import { Chip } from "../../../../components/ui/chip.tsx";
import { cn } from "../../../../lib/cn.ts";
import { runTrace, TraceView, type TraceOutcome } from "../../python/Tracer.tsx";
import type { ExerciseViewProps } from "../views.tsx";
import { checkCode, runSnippet, type Outcome } from "./check.ts";
import { allPassed, CASE_SECONDS, firstOutputDiff, type CaseDiff, type CaseResult, type CheckResult, type OutputResult } from "./harness.ts";
import { FIRST_DOWNLOAD_BYTES, usePythonRuntime, type RuntimePhase } from "./runtime.ts";

const fmtMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;
export const COPY_LOAD_FAILED = "No se pudo cargar Python. Comprueba la conexión y vuelve a intentarlo.";
const copyTimeout = (s: number) => `La comprobación superó ${s} s y se detuvo; Python se ha reiniciado. ¿Hay un bucle que no termina?`;

export function PythonExercise({ instance, onSolved }: ExerciseViewProps<PyInstance>) {
  return instance.kind === "code" ? <CodeExercise instance={instance} onSolved={onSolved} /> : <OutputExercise instance={instance} onSolved={onSolved} />;
}

// ---------------------------------------------------------------- Piezas comunes

/** Texto con `código` entre comillas invertidas. */
function Rich({ text }: { text: string }) {
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

function TemaChip({ tema }: { tema: PyInstance["tema"] }) {
  return (
    <Chip tone="outline" className="font-normal">
      {PY_TEMAS[tema]}
    </Chip>
  );
}

/** Pistas graduadas: una más cada vez que se pide. */
function Hints({ hints }: { hints: readonly string[] }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="ghost" disabled={shown >= hints.length} onClick={() => setShown((n) => n + 1)}>
        <Lightbulb size={16} aria-hidden="true" />
        {shown === 0 ? "Dame una pista" : shown >= hints.length ? "No hay más pistas" : "Otra pista"}
      </Button>
      {shown > 0 ? (
        <ol aria-label="Pistas" className="flex flex-col gap-1 text-[14px]">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i}>
              <span className="font-semibold">{`Pista ${i + 1} de ${hints.length}: `}</span>
              {h}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Aviso de la carga de Python (la primera vez descarga el intérprete). */
function RuntimeNote({ phase, onLoad }: { phase: RuntimePhase; onLoad: () => void }) {
  if (phase === "ready") return null;
  if (phase === "loading") return <p className="text-[14px] text-muted" role="status">Cargando Python…</p>;
  if (phase === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="flex items-start gap-2 text-[14px] text-crit">
          <OctagonAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {COPY_LOAD_FAILED}
        </p>
        <Button onClick={onLoad}>Reintentar carga</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
      <span>{`Para comprobar se usa Python en tu navegador. Si aún no está en este dispositivo, la primera vez se descargan unos ${fmtMB(FIRST_DOWNLOAD_BYTES)}.`}</span>
      <Button variant="ghost" onClick={onLoad}>
        <HardDriveDownload size={16} aria-hidden="true" />
        Cargar Python
      </Button>
    </div>
  );
}

/** Editor sencillo: números de línea, Tab inserta cuatro espacios (Esc y después Tab sale) y Ctrl+Intro comprueba. */
function CodeEditor({ value, onChange, onSubmit, label }: { value: string; onChange: (v: string) => void; onSubmit: () => void; label: string }) {
  const gutter = useRef<HTMLDivElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const caret = useRef<number | null>(null);
  const esc = useRef(false);
  useEffect(() => {
    if (caret.current === null || !area.current) return;
    area.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Escape") {
      esc.current = true;
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && !esc.current && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t } = e.currentTarget;
      caret.current = s + 4;
      onChange(`${value.slice(0, s)}    ${value.slice(t)}`);
      return;
    }
    esc.current = false;
  }
  const lines = value.split("\n").length;
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-sunken focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <div ref={gutter} aria-hidden="true" className="mono select-none overflow-hidden border-r border-border px-2 py-3 text-right text-[16px] leading-[1.5] text-muted">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={area}
        aria-label={label}
        aria-describedby="py-ex-editor-keys"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap="off"
        rows={Math.max(8, lines + 1)}
        className="mono w-full resize-y whitespace-pre bg-transparent px-3 py-3 text-[16px] leading-[1.5] text-fg outline-none"
      />
    </div>
  );
}

function Pre({ children, className }: { children: ReactNode; className?: string }) {
  return <pre className={cn("mono overflow-x-auto whitespace-pre rounded-md border border-border bg-sunken px-2 py-1 text-[14px]", className)}>{children}</pre>;
}

// ---------------------------------------------------------------- Ejercicio de código

function diffText(d: CaseDiff): string {
  if (d.que === "valor") return `Tu resultado: ${d.texto ?? "None"}${d.tipo ? ` (de tipo ${d.tipo}: revisa qué tipo pide el enunciado)` : ""}`;
  if (d.que === "salida") return d.texto === "''" ? "Tu código no imprime nada." : `Tu salida: ${d.texto}`;
  const name = d.que.slice("archivo:".length);
  return d.texto === null ? `No has creado el archivo ${name}.` : `Tu archivo ${name}: ${d.texto}`;
}

function caseDetail(c: CaseResult): string[] {
  if (c.ok) return [];
  if (c.interno) return ["No se ha podido comprobar este caso."];
  if (c.tiempo) return [`Superó el límite de ${CASE_SECONDS} s: ¿hay un bucle que no termina?`];
  if (c.falta) return ["Falta la función."];
  if (c.error) return [`Tu código lanzó ${c.error.mensaje}${c.error.linea ? ` (línea ${c.error.linea} de tu código)` : ""}.`];
  return (c.mal ?? []).map(diffText);
}

function CaseFiles({ files }: { files: PyCase["files"] }) {
  const entries = Object.entries(files ?? {});
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([name, text]) => (
        <details key={name} className="text-[14px]">
          <summary className="cursor-pointer">{`Ver ${name}`}</summary>
          <Pre>{text === "" ? "(vacío)" : text}</Pre>
        </details>
      ))}
    </>
  );
}

function CheckReport({ instance, result }: { instance: PyCodeInstance; result: CheckResult }) {
  if (result.sintaxis) {
    return (
      <p className="flex items-start gap-2 text-crit">
        <OctagonAlert size={16} aria-hidden="true" className="mt-1 shrink-0" />
        {`Tu código tiene un error de sintaxis${result.sintaxis.linea ? ` en la línea ${result.sintaxis.linea}` : ""}: ${result.sintaxis.mensaje}.`}
      </p>
    );
  }
  const passed = result.casos.filter((c) => c.ok).length;
  const solved = allPassed(result);
  const rules = instance.rules ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2">
        {solved ? (
          <Chip tone="ok">
            <CircleCheck size={16} aria-hidden="true" />
            ¡Correcto! Tu código pasa todas las pruebas.
          </Chip>
        ) : (
          <span className="font-semibold">{`${passed} de ${result.casos.length} casos correctos${rules.length && !result.reglas.every(Boolean) ? "; falta algún requisito" : ""}.`}</span>
        )}
      </p>
      {result.falta ? (
        <p className="text-[14px] text-crit">
          <Rich text={`No encuentro la función \`${instance.fn}\`: defínela con \`def ${instance.fn}(…):\` (con ese nombre exacto).`} />
        </p>
      ) : null}
      <ol aria-label="Resultados de las pruebas" className="flex flex-col gap-2">
        {result.casos.map((c, k) => {
          const detail = caseDetail(c);
          const cs = instance.cases[k];
          return (
            <li key={k} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
              <span className={cn("flex items-center gap-2 font-semibold", c.ok ? "text-ok" : "text-crit")}>
                {c.ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
                {`Caso ${k + 1}: ${c.ok ? "correcto" : "incorrecto"}`}
              </span>
              {cs ? <Pre>{cs.code}</Pre> : null}
              {detail.map((d, i) => (
                <span key={i} className="mono whitespace-pre-wrap break-words text-[14px]">
                  {d}
                </span>
              ))}
              {cs ? <CaseFiles files={cs.files} /> : null}
            </li>
          );
        })}
      </ol>
      {rules.length > 0 ? (
        <ul aria-label="Requisitos" className="flex flex-col gap-1 text-[14px]">
          {rules.map((r, i) => (
            <li key={i} className={cn("flex items-center gap-2", result.reglas[i] ? "text-ok" : "text-crit")}>
              {result.reglas[i] ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
              {`Requisito: ${r.label}: ${result.reglas[i] ? "cumplido" : "no cumplido"}`}
            </li>
          ))}
        </ul>
      ) : null}
      {result.superior ? (
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Lo que imprime tu código al ejecutarse (fuera de las pruebas)</span>
          <Pre>{result.superior}</Pre>
        </div>
      ) : null}
    </div>
  );
}

function CodeExercise({ instance, onSolved }: ExerciseViewProps<PyCodeInstance>) {
  const id = useId();
  const { phase, ensure } = usePythonRuntime();
  const [code, setCode] = useState(instance.starter);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome<CheckResult> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function check() {
    if (busy) return;
    setBusy(true);
    setLoadFailed(false);
    const client = await ensure();
    if (!alive.current) return;
    if (!client) {
      setBusy(false);
      setLoadFailed(true);
      return;
    }
    const o = await checkCode(client, instance, code);
    if (!alive.current) return;
    setOutcome(o);
    setBusy(false);
    if (o.kind === "result" && allPassed(o.result)) onSolved();
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
        <div className="flex flex-wrap items-center gap-2">
          <TemaChip tema={instance.tema} />
        </div>
        <h3 className="font-display text-[18px] font-semibold">{instance.title}</h3>
        {instance.statement.map((p, i) => (
          <p key={i}>
            <Rich text={p} />
          </p>
        ))}
        {instance.rules?.length ? (
          <ul aria-label="Requisitos del enunciado" className="list-disc pl-5 text-[14px]">
            {instance.rules.map((r, i) => (
              <li key={i}>{r.label}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
        <h2 id={`${id}-title`} className="font-display text-[20px] font-semibold">
          Comprueba tu respuesta
        </h2>
        <CodeEditor label="Tu código" value={code} onChange={setCode} onSubmit={() => void check()} />
        <p id="py-ex-editor-keys" className="text-[14px] text-muted">
          Tab sangra cuatro espacios (Esc y después Tab sale del editor) y Ctrl+Intro comprueba. Las pruebas llaman a tu función con
          otros datos: no basta con el ejemplo.
        </p>
        <RuntimeNote phase={loadFailed && phase !== "loading" ? "error" : phase} onLoad={() => void ensure()} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void check()} disabled={busy}>
            <Play size={16} aria-hidden="true" />
            Comprobar
          </Button>
          <Button variant="ghost" onClick={() => setCode(instance.starter)} disabled={busy || code === instance.starter}>
            <RotateCcw size={16} aria-hidden="true" />
            Volver al código inicial
          </Button>
        </div>
        <Hints hints={instance.hints} />
        <div role="status" aria-live="polite" className="flex flex-col gap-2 text-[14px]">
          {busy ? <span className="text-muted">{phase === "ready" ? "Comprobando…" : "Cargando Python…"}</span> : null}
          {!busy && outcome?.kind === "result" ? <CheckReport instance={instance} result={outcome.result} /> : null}
          {!busy && outcome?.kind === "timeout" ? <span className="text-crit">{copyTimeout(outcome.seconds)}</span> : null}
          {!busy && outcome?.kind === "failed" ? <span className="text-crit">{outcome.message}</span> : null}
        </div>
      </section>

      <SolutionGate resetKey={instance.solution}>
        <div className="flex flex-col gap-2">
          <p className="text-[14px] text-muted">Una solución posible (la tuya puede ser distinta y también correcta):</p>
          <Pre>{instance.solution}</Pre>
        </div>
      </SolutionGate>
    </>
  );
}

// ---------------------------------------------------------------- ¿Qué imprime?

type Verdict = { ok: true } | { ok: false; line: number } | { error: string };

function OutputExercise({ instance, onSolved }: ExerciseViewProps<PyOutputInstance>) {
  const id = useId();
  const { phase, ensure } = usePythonRuntime();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [trace, setTrace] = useState<TraceOutcome | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Lo que imprime de verdad: solo se usa para comparar, nunca se muestra antes de acertar.
  const real = useRef<OutputResult | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const lines = instance.code.replace(/\n$/, "").split("\n");

  async function client() {
    setLoadFailed(false);
    const c = await ensure();
    if (!c && alive.current) setLoadFailed(true);
    return c;
  }

  async function check() {
    if (busy) return;
    setBusy(true);
    const c = await client();
    if (!alive.current) return;
    if (!c) {
      setBusy(false);
      return;
    }
    if (!real.current) {
      const o = await runSnippet(c, instance.code);
      if (!alive.current) return;
      if (o.kind === "result") real.current = o.result;
      else {
        setVerdict({ error: o.kind === "timeout" ? copyTimeout(o.seconds) : o.message });
        setBusy(false);
        return;
      }
    }
    const r = real.current;
    if (r.error || r.sintaxis || r.tiempo) {
      setVerdict({ error: "No se ha podido ejecutar este fragmento. Pasa al siguiente ejercicio." });
    } else {
      const line = firstOutputDiff(r.salida, answer);
      setVerdict(line === null ? { ok: true } : { ok: false, line });
      if (line === null) onSolved();
    }
    setBusy(false);
  }

  async function traceIt() {
    if (busy) return;
    setBusy(true);
    const c = await client();
    if (!alive.current) return;
    if (c) {
      const t = await runTrace(c, instance.code);
      if (!alive.current) return;
      setTrace(t);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
        <div className="flex flex-wrap items-center gap-2">
          <TemaChip tema={instance.tema} />
        </div>
        <p>Lee el código sin ejecutarlo y escribe exactamente lo que imprime, línea a línea.</p>
        <ol aria-label="Código del ejercicio" className="mono overflow-x-auto rounded-md border border-border bg-sunken py-2 text-[16px] leading-[1.6]">
          {lines.map((l, k) => (
            <li key={k} className="flex whitespace-pre px-2">
              <span aria-hidden="true" className="w-8 shrink-0 select-none pr-2 text-right text-muted">
                {k + 1}
              </span>
              <span>{l || " "}</span>
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
        <h2 id={`${id}-title`} className="font-display text-[20px] font-semibold">
          Comprueba tu respuesta
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-answer`} className="text-[14px] font-semibold">
            Lo que imprime (una línea por cada línea de la salida)
          </label>
          <textarea
            id={`${id}-answer`}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setVerdict(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void check();
              }
            }}
            rows={Math.max(3, lines.length)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            className="mono w-full resize-y rounded-md border border-border bg-sunken px-3 py-2 text-[16px] leading-[1.5]"
          />
          <p className="text-[14px] text-muted">Los espacios al final de cada línea y las líneas vacías del final no cuentan.</p>
        </div>
        <RuntimeNote phase={loadFailed && phase !== "loading" ? "error" : phase} onLoad={() => void ensure()} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void check()} disabled={busy || answer.trim() === ""}>
            <Play size={16} aria-hidden="true" />
            Comprobar
          </Button>
        </div>
        <Hints hints={instance.hints} />
        <div role="status" aria-live="polite" className="flex flex-col items-start gap-2 text-[14px]">
          {busy && !trace ? <span className="text-muted">{phase === "ready" ? "Ejecutando…" : "Cargando Python…"}</span> : null}
          {verdict && "error" in verdict ? <span className="text-crit">{verdict.error}</span> : null}
          {verdict && "ok" in verdict && verdict.ok ? (
            <Chip tone="ok">
              <CircleCheck size={16} aria-hidden="true" />
              ¡Correcto! Eso es exactamente lo que imprime.
            </Chip>
          ) : null}
          {verdict && "ok" in verdict && !verdict.ok ? (
            <span className="flex items-center gap-2 text-crit">
              <CircleX size={16} aria-hidden="true" />
              {`No coincide: la primera diferencia está en la línea ${verdict.line} de la salida.`}
            </span>
          ) : null}
        </div>
        {verdict && "ok" in verdict && !verdict.ok && !trace ? (
          <div className="flex flex-col items-start gap-1">
            <p className="text-[14px] text-muted">Síguelo línea a línea para ver dónde cambia cada variable (verás también la salida).</p>
            <Button onClick={() => void traceIt()} disabled={busy}>
              <Footprints size={16} aria-hidden="true" />
              Ver paso a paso
            </Button>
          </div>
        ) : null}
      </section>

      {trace?.ok ? <TraceView code={instance.code} trace={trace.trace} onClose={() => setTrace(null)} /> : null}
      {trace && !trace.ok ? (
        <p role="alert" className="text-[14px] text-crit">
          {trace.message}
        </p>
      ) : null}
    </>
  );
}
