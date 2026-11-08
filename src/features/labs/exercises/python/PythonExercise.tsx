// Vistas de los ejercicios de Python (chunk perezoso: solo se descarga con el módulo Python
// encendido). Ejercicio de código: enunciado, editor con el código inicial, «Comprobar» (el banco de
// pruebas en el worker), pistas graduadas y la solución detrás de «Ver la solución completa».
// «¿Qué imprime?»: el fragmento, la respuesta de la persona y, si falla, el paso a paso.
// Integridad: el resultado de cada caso dice si es correcto y, si no, lo que hizo tu código; nunca
// el valor esperado. Las pistas no llevan código. Nada se ejecuta sin pulsar un botón.
// Temas 6 a 13: con tablas y arrays, por qué no coincide (forma, columnas, NaN…, siempre lo tuyo);
// las comprobaciones con nombre una a una (las de los gráficos miran tu figura) y tu gráfico debajo.
import { CircleCheck, CircleX, Footprints, HardDriveDownload, Lightbulb, OctagonAlert, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PY_TEMAS, type PyCase, type PyCodeInstance, type PyInstance, type PyOutputInstance } from "../../../../../shared/exercises/python.ts";
import { SolutionGate } from "../../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../../components/ui/button.tsx";
import { Chip } from "../../../../components/ui/chip.tsx";
import { cn } from "../../../../lib/cn.ts";
import { CodeEditor } from "../../python/CodeEditor.tsx";
import { isSmartQuoteError, SmartQuotesHint } from "../../python/SmartQuotes.tsx";
import { Figure } from "../../python/Figure.tsx";
import { runTrace, TraceView, type TraceOutcome } from "../../python/Tracer.tsx";
import type { ExerciseViewProps } from "../views.tsx";
import { checkCode, runSnippet, type CheckStage, type Outcome } from "./check.ts";
import { allPassed, firstOutputDiff, type CaseResult, type CheckResult, type OutputResult } from "./harness.ts";
import { caseDetail } from "./report.ts";

export { detailText } from "./report.ts";
import { FIRST_DOWNLOAD_BYTES, packagesBytes, usePythonRuntime, type RuntimePhase } from "./runtime.ts";

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

function Pre({ children, className }: { children: ReactNode; className?: string }) {
  return <pre className={cn("mono overflow-x-auto whitespace-pre rounded-md border border-border bg-sunken px-2 py-1 text-[14px]", className)}>{children}</pre>;
}

// ---------------------------------------------------------------- Ejercicio de código

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

/** Comprobaciones con nombre de un caso: el requisito, si se cumple y, si no, lo que hizo tu código. */
function CaseChecks({ labels, result }: { labels: readonly string[]; result: CaseResult }) {
  if (!result.checks?.length) return null;
  return (
    <ul aria-label="Comprobaciones" className="flex flex-col gap-1 text-[14px]">
      {result.checks.map((c, i) => (
        <li key={i} className={cn("flex items-start gap-2", c.ok ? "text-ok" : "text-crit")}>
          {c.ok ? <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> : <CircleX size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}
          <span>{`${labels[i] ?? "Comprobación"}: ${c.ok ? "cumplida" : "no cumplida"}${!c.ok && c.tuyo ? ` (lo tuyo: ${c.tuyo})` : ""}`}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckReport({
  instance,
  result,
  figures,
  code,
  onFixQuotes,
}: {
  instance: PyCodeInstance;
  result: CheckResult;
  figures?: readonly string[];
  /** El código comprobado y cómo cambiarlo, para «Cambiar por comillas rectas». */
  code?: string;
  onFixQuotes?: (fixed: string) => void;
}) {
  if (result.sintaxis) {
    return (
      <>
        <p className="flex items-start gap-2 text-crit">
          <OctagonAlert size={16} aria-hidden="true" className="mt-1 shrink-0" />
          {`Tu código tiene un error de sintaxis${result.sintaxis.linea ? ` en la línea ${result.sintaxis.linea}` : ""}: ${result.sintaxis.mensaje}.`}
        </p>
        {code !== undefined && onFixQuotes && isSmartQuoteError(result.sintaxis.mensaje, code) ? <SmartQuotesHint code={code} onFix={onFixQuotes} /> : null}
      </>
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
              {cs?.checks ? <CaseChecks labels={cs.checks.map((x) => x.label)} result={c} /> : null}
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
      {figures?.length ? <YourFigures instance={instance} figures={figures} /> : null}
    </div>
  );
}

/** El gráfico que dibuja tu código en el primer caso con gráfico (las comprobaciones miran ese). */
function YourFigures({ instance, figures }: { instance: PyCodeInstance; figures: readonly string[] }) {
  const k = instance.cases.findIndex((c) => c.checks?.some((x) => x.kind.startsWith("fig-"))) + 1;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold">{k > 0 ? `Tu gráfico (el del caso ${k})` : "Tu gráfico"}</span>
      {figures.map((b64, i) => (
        <Figure key={i} b64={b64} n={i + 1} label={figures.length > 1 ? `Gráfico ${i + 1} de tu código` : "Gráfico de tu código"} />
      ))}
    </div>
  );
}

const PACKAGE_NAMES: Record<string, string> = { numpy: "NumPy", pandas: "pandas", "matplotlib.pyplot": "matplotlib", seaborn: "seaborn" };

/** «pandas, matplotlib y seaborn». */
export function packagesLabel(modules: readonly string[]): string {
  const ns = [...new Set(modules.map((m) => PACKAGE_NAMES[m] ?? m.split(".")[0]!))];
  return ns.length <= 1 ? (ns[0] ?? "") : `${ns.slice(0, -1).join(", ")} y ${ns.at(-1)}`;
}

function CodeExercise({ instance, onSolved }: ExerciseViewProps<PyCodeInstance>) {
  const id = useId();
  const { phase, ensure } = usePythonRuntime();
  const [code, setCode] = useState(instance.starter);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome<CheckResult> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<CheckStage>("casos");
  const alive = useRef(true);
  const pkgs = instance.packages ?? [];
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
    const o = await checkCode(client, instance, code, (s) => {
      if (alive.current) setStage(s);
    });
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
        <CodeEditor label="Tu código" describedBy="py-ex-editor-keys" value={code} onChange={setCode} onSubmit={() => void check()} />
        <p id="py-ex-editor-keys" className="text-[14px] text-muted">
          Tab sangra cuatro espacios (Esc y después Tab sale del editor) y Ctrl+Intro comprueba. Las pruebas llaman a tu función con
          otros datos: no basta con el ejemplo.
        </p>
        <RuntimeNote phase={loadFailed && phase !== "loading" ? "error" : phase} onLoad={() => void ensure()} />
        {packagesBytes(pkgs) > 0 ? (
          <p className="text-[14px] text-muted">
            {`Este ejercicio usa ${packagesLabel(pkgs)}: la primera vez que compruebes se descargan unos ${fmtMB(packagesBytes(pkgs))} más (después quedan en el dispositivo). Los datos de cada caso se escriben en su carpeta de trabajo (ejercicio/caso1/…) y los puedes ver en el resultado.`}
          </p>
        ) : null}
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
          {busy ? (
            <span className="text-muted">
              {phase !== "ready" ? "Cargando Python…" : stage === "paquetes" ? `Preparando ${packagesLabel(pkgs)}…` : "Comprobando…"}
            </span>
          ) : null}
          {!busy && outcome?.kind === "result" ? <CheckReport instance={instance} result={outcome.result} figures={outcome.figures} code={code} onFixQuotes={setCode} /> : null}
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
