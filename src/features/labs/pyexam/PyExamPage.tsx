// «Simulacro de examen (01MIAR)»: el examen final de «Python para la IA» como un cuaderno de Jupyter,
// con ejercicios nuevos generados con una semilla. Cuatro pantallas, como el simulacro de 02MIAR:
// - Inicio: qué entra, instrucciones, reglas de la nota, «Descargar como .ipynb» (en blanco) y los
//   datos. La semilla va en la URL (?s=): con el mismo enlace sale el mismo examen. Nada se ejecuta.
// - Examen: el cuaderno (Notebook.tsx) con kernel compartido, navegador de ejercicios y pasos, reloj de
//   2 h que no se para (sobrevive a recargar) y entrega automática a 0. Se pueden ejecutar las celdas y
//   los «Test Use Case» a la vista; no hay pistas, ni comprobaciones ocultas, ni soluciones.
// - Resultados: al entregar se corrige con el banco de pruebas (grade-run.ts): nota sobre 10, puntos por
//   ejercicio y por paso, qué comprobaciones ocultas fallaron (lo que hizo tu código, nunca lo
//   esperado), tus figuras, la solución de referencia detrás de «Ver la solución completa» y
//   «Practicar este tipo». También «Descargar como .ipynb» con tus respuestas.
// - Historial.
// Los intentos se guardan con labs-storage.ts (clave «pyexam»).
import { ArrowLeft, CircleCheck, CircleX, Clock, Download, FileDown, History, Play, Printer, RefreshCw, RotateCcw, Send, Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useSearchParams } from "react-router";
import { randomSeed, seedFromText, seedToText } from "../../../../shared/exercises/random.ts";
import { LEVEL_SLUGS } from "../../../../shared/exercises/types.ts";
import {
  buildPyExam,
  finishPyExamAttempt,
  MAX_PYEXAM_CODE,
  pointsText,
  PYEXAM_INTEGRITY_NOTE,
  PYEXAM_MINUTES,
  PYEXAM_PROJECT_POINTS,
  PYEXAM_SHORT_POINTS,
  pyExamCodeSize,
  pyExamFiles,
  pyExamInstructions,
  pyExamNotebookJson,
  pyExamNotebookName,
  pyExamPartName,
  pyExamPartPoints,
  pyExamParts,
  pyExamRemaining,
  pyExamStarters,
  pyExamUnitLabels,
  recordPyExamAttempt,
  setPyExamCode,
  setPyExamResult,
  slotCode,
  startPyExamAttempt,
  type PyExam,
  type PyExamAttempt,
  type PyExamPractice,
  type PyExamStore,
} from "../../../../shared/pyexam/index.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button, buttonVariants } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog.tsx";
import { cn } from "../../../lib/cn.ts";
import { scrollBehavior } from "../../../lib/reveal.ts";
import { BELOW_LAB_TABS, EXAM_STICKY_TOP, useStickyHeight } from "../exam/sticky.ts";
import { announcementMarks, clockText, durationText, remainingAnnouncement } from "../exam/time-text.ts";
import { usePythonRuntime } from "../exercises/python/runtime.ts";
import { Figure, saveBlob } from "../python/Figure.tsx";
import { gradePyExam, type GradeStage } from "./grade-run.ts";
import type { PartReport, PyExamGrading } from "./grade.ts";
import { KernelBar, KernelNote, Notebook, partAnchor, Pre, RichText, useNotebookKernel } from "./Notebook.tsx";
import { loadPyExamStore, savePyExamStore } from "./pyexam-storage.ts";

export const PYEXAM_PAGE_TITLE = "Simulacro de examen (01MIAR)";
export { PYEXAM_INTEGRITY_NOTE };

export interface PyExamPageProps {
  /**
   * Ruta del banco de ejercicios para «Practicar este tipo», relativa a esta página (por defecto
   * «../../ejercicios»: en LabsRoutes, el simulacro va en …/python/simulacro).
   */
  exercisesPath?: string;
}

type View = { kind: "inicio" } | { kind: "examen" } | { kind: "resultados"; id: string; grade: boolean } | { kind: "historial" };

const dateText = (ts: number) => new Date(ts).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const COPY_GRADE_FAILED = "No se ha podido corregir: no se han podido cargar Python o los paquetes (pandas, matplotlib y seaborn). Comprueba la conexión y vuelve a intentarlo.";
const STAGE_TEXT: Record<GradeStage, string> = {
  paquetes: "Preparando Python, pandas, matplotlib y seaborn…",
  corrigiendo: "Ejecutando las pruebas ocultas…",
  repitiendo: "Repitiendo los pasos que fallan con la solución de referencia de los anteriores…",
};

/** Las reglas de la nota, para la pantalla de inicio y los resultados. */
export const PYEXAM_GRADING_RULES = [
  `Cada ejercicio corto vale ${pointsText(PYEXAM_SHORT_POINTS)}: proporcional a las pruebas ocultas que pasa, la mitad si no cumple algún requisito del enunciado (en una línea, con yield, sin bucles, sin bibliotecas…), redondeado a 0,25.`,
  `El proyecto vale ${PYEXAM_PROJECT_POINTS}: cada paso, proporcional a sus comprobaciones (cada valor y cada requisito de una figura cuentan una), redondeado a 0,25.`,
  "Un error que viene de un paso anterior no se paga dos veces: si un paso falla, se corrige también con la solución de referencia de los pasos anteriores y vale la mejor de las dos notas.",
  "Una celda que sigue como al principio vale 0.",
];

function downloadText(text: string, name: string, type: string) {
  saveBlob(new Blob([text], { type }), name);
}

function downloadFiles(exam: PyExam) {
  for (const [name, text] of Object.entries(pyExamFiles(exam))) downloadText(text, name, "text/csv");
}

function DataButtons({ exam, code, answers }: { exam: PyExam; code: ReadonlyArray<string | null> | null; answers: boolean }) {
  const names = Object.keys(pyExamFiles(exam));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => downloadText(pyExamNotebookJson(exam, code), pyExamNotebookName(exam, answers), "application/x-ipynb+json")}>
          <FileDown size={16} aria-hidden="true" />
          {answers ? "Descargar como .ipynb (con tus respuestas)" : "Descargar como .ipynb"}
        </Button>
        <Button onClick={() => downloadFiles(exam)}>
          <Download size={16} aria-hidden="true" />
          Descargar los datos (.csv)
        </Button>
      </div>
      <p className="text-[14px] text-muted">{`Para abrirlo en Jupyter o Colab, pon en la misma carpeta que el cuaderno ${names.length === 1 ? "el archivo" : "los archivos"} ${names.join(", ")}.`}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Página

export function PyExamPage({ exercisesPath = "../../ejercicios" }: PyExamPageProps = {}) {
  const [params, setParams] = useSearchParams();
  const [store, setStore] = useState<PyExamStore>(loadPyExamStore);
  const storeRef = useRef(store);
  const [view, setView] = useState<View>(() => (storeRef.current.active ? { kind: "examen" } : { kind: "inicio" }));
  const [seed, setSeed] = useState<number>(() => seedFromText(params.get("s")) ?? randomSeed());
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  // Al empezar o retomar, el principio del cuaderno sube a la vista (al abrir la página, no).
  const [reveal, setReveal] = useState(false);

  const commit = useCallback((next: PyExamStore) => {
    storeRef.current = next;
    savePyExamStore(next);
    setStore(next);
  }, []);

  // La semilla de la pantalla de inicio va en la URL (sustituyendo la entrada del historial).
  const search = new URLSearchParams({ s: seedToText(seed) }).toString();
  useEffect(() => {
    if (view.kind === "inicio" && params.toString() !== search) setParams(new URLSearchParams(search), { replace: true });
  }, [view.kind, search, params, setParams]);

  // Al cambiar de pantalla, el foco va a su título (no al abrir la página).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus(view.kind === "examen" ? { preventScroll: true } : undefined);
  }, [view]);

  const start = () => {
    const exam = buildPyExam(seed);
    commit({ ...storeRef.current, active: startPyExamAttempt(seed, pyExamParts(exam), Date.now()) });
    setReveal(true);
    setView({ kind: "examen" });
  };
  const resume = () => {
    setReveal(true);
    setView({ kind: "examen" });
  };

  const finish = (auto: boolean) => {
    const active = storeRef.current.active;
    if (!active) return;
    const done = finishPyExamAttempt(active, Date.now(), auto);
    commit(recordPyExamAttempt(storeRef.current, done));
    setView({ kind: "resultados", id: done.id, grade: true });
  };

  const repeat = (s: number) => {
    setSeed(s);
    setView({ kind: "inicio" });
  };

  const active = store.active;
  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label={PYEXAM_PAGE_TITLE}>
      {view.kind === "examen" && active ? (
        <ExamView key={active.id} attempt={active} heading={heading} reveal={reveal} onChange={(a) => commit({ ...storeRef.current, active: a })} onFinish={finish} />
      ) : view.kind === "resultados" ? (
        <ResultsView
          key={view.id}
          attempt={store.history.find((h) => h.id === view.id) ?? null}
          autoGrade={view.grade}
          heading={heading}
          exercisesPath={exercisesPath}
          onResult={(id, r) => commit(setPyExamResult(storeRef.current, id, r))}
          onRepeat={repeat}
          onNew={() => repeat(randomSeed())}
          onHistory={() => setView({ kind: "historial" })}
        />
      ) : view.kind === "historial" ? (
        <HistoryView store={store} heading={heading} onBack={() => setView({ kind: "inicio" })} onOpen={(id) => setView({ kind: "resultados", id, grade: false })} onResume={resume} onRepeat={repeat} />
      ) : (
        <StartView
          seed={seed}
          active={active}
          historyCount={store.history.length}
          heading={heading}
          onStart={start}
          onOther={() => setSeed(randomSeed())}
          onResume={resume}
          onHistory={() => setView({ kind: "historial" })}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Inicio

function StartView({
  seed,
  active,
  historyCount,
  heading,
  onStart,
  onOther,
  onResume,
  onHistory,
}: {
  seed: number;
  active: PyExamAttempt | null;
  historyCount: number;
  heading: RefObject<HTMLHeadingElement | null>;
  onStart: () => void;
  onOther: () => void;
  onResume: () => void;
  onHistory: () => void;
}) {
  const exam = useMemo(() => buildPyExam(seed), [seed]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          {PYEXAM_PAGE_TITLE}
        </h1>
        <p className="text-muted">Un examen como el final de «Python para la IA», en forma de cuaderno: cuatro ejercicios cortos y un proyecto de datos por pasos, generados al momento, con reloj, «Test Use Case» a la vista y nota al entregar.</p>
        <p role="note" className="rounded-md border border-border bg-raised p-3 text-[14px] font-semibold">
          {PYEXAM_INTEGRITY_NOTE}
        </p>
      </div>

      {active ? (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-accent bg-raised p-4">
          <h2 className="font-display text-[20px] font-semibold">Tienes un simulacro en curso</h2>
          <p>{`Empezado el ${dateText(active.startedAt)}. El reloj sigue corriendo: quedan ${clockText(pyExamRemaining(active, Date.now()))}.`}</p>
          <div>
            <Button variant="primary" onClick={onResume}>
              <Play size={16} aria-hidden="true" />
              Continuar el simulacro
            </Button>
          </div>
          <p className="text-[14px] text-muted">Entrégalo para poder empezar otro.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
        <h2 className="font-display text-[20px] font-semibold">Qué entra en este simulacro</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-6">
          {exam.shorts.map((s, i) => (
            <li key={i}>{`${s.title} (${pointsText(PYEXAM_SHORT_POINTS)} puntos)`}</li>
          ))}
          <li>{`Proyecto de datos: ${exam.project.title}, en ${exam.project.steps.length} pasos (${PYEXAM_PROJECT_POINTS} puntos)`}</li>
        </ol>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
        <h2 className="font-display text-[20px] font-semibold">Instrucciones</h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {pyExamInstructions(exam)
            .slice(0, 3)
            .map((t) => (
              <li key={t}>
                <RichText text={t} />
              </li>
            ))}
          <li>{`El tiempo (${PYEXAM_MINUTES / 60} horas) empieza al pulsar «Empezar» y no se puede parar. Puedes recargar la página: el reloj sigue y tu código se conserva (las variables del kernel, no: vuelve a ejecutar las celdas). A 0, el simulacro se entrega solo.`}</li>
          <li>Las celdas comparten las variables, como en Jupyter: ejecútalas en orden («Ejecutar todo») y usa «Reiniciar kernel» para empezar de cero.</li>
          <li>Durante el simulacro no hay pistas, ni comprobaciones ocultas, ni soluciones. Al entregar verás la nota, qué falló, tus figuras y la solución de referencia.</li>
        </ul>
        <h3 className="mt-2 font-semibold">Cómo se corrige</h3>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {PYEXAM_GRADING_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] text-muted">
          {"Código del simulacro: "}
          <span className="font-mono font-semibold text-fg">{seedToText(seed)}</span>
          {" (va en el enlace de esta página: con el mismo enlace sale el mismo examen)."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onStart} disabled={!!active}>
            <Play size={16} aria-hidden="true" />
            Empezar
          </Button>
          <Button onClick={onOther} disabled={!!active}>
            <Shuffle size={16} aria-hidden="true" />
            Otro simulacro
          </Button>
          <Button variant="ghost" onClick={onHistory}>
            <History size={16} aria-hidden="true" />
            {historyCount > 0 ? `Historial (${historyCount})` : "Historial"}
          </Button>
        </div>
        <DataButtons exam={exam} code={null} answers={false} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Examen

function ExamView({
  attempt,
  heading,
  reveal = false,
  onChange,
  onFinish,
}: {
  attempt: PyExamAttempt;
  heading: RefObject<HTMLHeadingElement | null>;
  /** Desplaza el principio del simulacro a la vista al montar (al pulsar «Empezar» o «Continuar»). */
  reveal?: boolean;
  onChange: (a: PyExamAttempt) => void;
  onFinish: (auto: boolean) => void;
}) {
  const exam = useMemo(() => buildPyExam(attempt.seed), [attempt.seed]);
  const starters = useMemo(() => pyExamStarters(exam), [exam]);
  const kernel = useNotebookKernel(exam);
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState(false);
  const finished = useRef(false);
  const remaining = pyExamRemaining(attempt, now);
  const marks = useMemo(() => announcementMarks(PYEXAM_MINUTES), []);
  const announced = useRef<Set<number> | null>(null);
  if (announced.current === null) announced.current = new Set(marks.filter((m) => remaining <= m * 60_000));
  const code = attempt.code;
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useStickyHeight(bar, root);

  useEffect(() => {
    const el = root.current;
    if (reveal && el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start", behavior: scrollBehavior() });
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const submit = useCallback(
    async (auto: boolean) => {
      if (finished.current) return;
      finished.current = true;
      await kernel.stop();
      onFinish(auto);
    },
    [kernel, onFinish],
  );

  // A 0, se entrega solo (una vez).
  useEffect(() => {
    if (remaining <= 0) void submit(true);
  }, [remaining, submit]);

  useEffect(() => {
    const hit = marks.filter((m) => remaining <= m * 60_000 && !announced.current!.has(m));
    if (hit.length === 0) return;
    for (const m of marks) if (m >= Math.min(...hit)) announced.current!.add(m);
    setMessage(remainingAnnouncement(Math.min(...hit)));
  }, [remaining, marks]);

  const setCode = (slot: number, text: string) => {
    const next = setPyExamCode(attempt, starters, slot, text);
    if (!next) {
      setLimit(true);
      return;
    }
    setLimit(false);
    onChange(next);
  };

  const parts = pyExamParts(exam);
  const touched = Array.from({ length: parts }, (_, i) => code?.[i] !== null && code?.[i] !== undefined);
  const untouched = touched.flatMap((t, i) => (t ? [] : [i]));
  const go = (part: number) => {
    // El título del ejercicio o paso queda justo debajo de la cabecera fija (scroll-margin-top).
    const el = document.getElementById(partAnchor(part));
    el?.scrollIntoView?.({ block: "start", behavior: scrollBehavior() });
    el?.focus({ preventScroll: true });
  };
  const low = remaining <= 5 * 60_000;
  const used = pyExamCodeSize(code);

  return (
    <div ref={root} className={cn("flex min-w-0 flex-col gap-4", BELOW_LAB_TABS)}>
      <div ref={bar} className={cn("sticky z-10 flex flex-col gap-2 border-b border-border bg-base py-2", EXAM_STICKY_TOP)}>
        <div className="flex items-center justify-between gap-2">
          <h1 ref={heading} tabIndex={-1} className="min-w-0 truncate font-display text-[17px] font-semibold sm:text-[20px]">
            {`${PYEXAM_PAGE_TITLE} · ${seedToText(attempt.seed)}`}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <div role="timer" aria-label="Tiempo restante" className={cn("flex min-h-11 items-center gap-2 rounded-md border px-3 font-mono text-[18px] font-semibold", low ? "border-2 border-crit text-crit" : "border-border")}>
              <Clock size={18} aria-hidden="true" />
              <span>{clockText(remaining)}</span>
            </div>
            <Button variant="primary" onClick={() => setConfirm(true)}>
              <Send size={16} aria-hidden="true" />
              Entregar
            </Button>
          </div>
        </div>
        <KernelBar exam={exam} code={code} starters={starters} kernel={kernel} onMessage={setMessage} />
        <p role="status" aria-live="polite" className="sr-only">
          {message}
        </p>
      </div>

      <nav aria-label="Ejercicios y pasos del simulacro" className="flex flex-col gap-2">
        <ol className="flex flex-wrap gap-2">
          {Array.from({ length: parts }, (_, i) => {
            const name = pyExamPartName(exam, i);
            const short = i < exam.shorts.length ? String(i + 1) : name.replace("Paso ", "");
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${name}: ${touched[i] ? "con código" : "sin empezar"}`}
                  className={cn("flex size-11 items-center justify-center rounded-md border text-[15px] font-semibold", touched[i] ? "border-accent bg-accent-soft" : "border-border bg-raised")}
                >
                  {short}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-[14px] text-muted">Del 1 al 4, los ejercicios cortos; las letras, los pasos del proyecto. Con fondo de color: la celda ya tiene tu código.</p>
      </nav>

      <KernelNote kernel={kernel} />
      <p id="pyexam-teclas" className="text-[14px] text-muted">
        En las celdas, Tab sangra cuatro espacios (Esc y después Tab sale del editor) y Ctrl+Intro ejecuta la celda. Tu código se guarda en este dispositivo mientras escribes.
      </p>
      {limit ? (
        <p role="alert" className="text-[14px] font-semibold text-crit">
          {`Has llegado al límite de código que se puede guardar en este simulacro (${MAX_PYEXAM_CODE.toLocaleString("es-ES")} caracteres en total): ese cambio no se ha aplicado.`}
        </p>
      ) : used > MAX_PYEXAM_CODE * 0.8 ? (
        <p className="text-[14px] text-warn">{`Tu código ocupa ${used.toLocaleString("es-ES")} de ${MAX_PYEXAM_CODE.toLocaleString("es-ES")} caracteres.`}</p>
      ) : null}

      <Notebook exam={exam} code={code} starters={starters} kernel={kernel} onCode={setCode} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" className="sm:ml-auto" onClick={() => setConfirm(true)}>
          <Send size={16} aria-hidden="true" />
          Entregar
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>¿Entregar el simulacro?</DialogTitle>
          <DialogDescription>Después de entregar ya no podrás cambiar tu código. Se corregirá con las pruebas ocultas (hace falta Python en el navegador).</DialogDescription>
          {untouched.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{untouched.length === 1 ? "Queda 1 celda sin empezar:" : `Quedan ${untouched.length} celdas sin empezar:`}</p>
              <ul className="flex flex-wrap gap-2" aria-label="Celdas sin empezar">
                {untouched.map((i) => (
                  <li key={i}>
                    <Button
                      onClick={() => {
                        setConfirm(false);
                        go(i);
                      }}
                    >
                      {pyExamPartName(exam, i)}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Todas las celdas tienen tu código.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Seguir con el examen</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false);
                void submit(false);
              }}
            >
              <Send size={16} aria-hidden="true" />
              Entregar ahora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Resultados

const practiceSearch = (p: PyExamPractice, seed: number) => `?${new URLSearchParams({ t: p.type, n: LEVEL_SLUGS[p.level], s: seedToText(seed) }).toString()}`;

function ResultsView({
  attempt,
  autoGrade,
  heading,
  exercisesPath,
  onResult,
  onRepeat,
  onNew,
  onHistory,
}: {
  attempt: PyExamAttempt | null;
  autoGrade: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  exercisesPath: string;
  onResult: (id: string, r: PyExamGrading["result"]) => void;
  onRepeat: (seed: number) => void;
  onNew: () => void;
  onHistory: () => void;
}) {
  const exam = useMemo(() => (attempt ? buildPyExam(attempt.seed) : null), [attempt]);
  const { ensure } = usePythonRuntime();
  const [stage, setStage] = useState<GradeStage | "cargando" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<PartReport[] | null>(null);
  const started = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const grade = useCallback(async () => {
    if (!attempt || !exam || attempt.code === null) return;
    setError(null);
    setStage("cargando");
    try {
      const client = await ensure();
      if (!alive.current) return;
      const g = client ? await gradePyExam(client, exam, attempt.code, (s) => alive.current && setStage(s)) : null;
      if (!alive.current) return;
      if (!g) setError(COPY_GRADE_FAILED);
      else {
        setReports(g.parts);
        onResult(attempt.id, g.result);
      }
    } catch (e) {
      if (alive.current) setError(`${COPY_GRADE_FAILED} (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      if (alive.current) setStage(null);
    }
  }, [attempt, exam, ensure, onResult]);

  // Recién entregado: se corrige solo (lo ha pedido la persona al entregar).
  useEffect(() => {
    if (autoGrade && !started.current && attempt && attempt.result === null && attempt.code !== null) {
      started.current = true;
      void grade();
    }
  }, [autoGrade, attempt, grade]);

  if (!attempt || !exam) {
    return (
      <div className="flex flex-col gap-3">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold">
          Resultados del simulacro
        </h1>
        <p>No se encuentra este intento.</p>
        <div>
          <Button onClick={onHistory}>Ver el historial</Button>
        </div>
      </div>
    );
  }
  const r = attempt.result;
  const used = (attempt.finishedAt ?? attempt.startedAt) - attempt.startedAt;
  const labels = pyExamUnitLabels(exam);
  const maxPoints = pyExamPartPoints(exam);
  const starters = pyExamStarters(exam);
  const n = exam.shorts.length;
  const projectPoints = r ? r.points.slice(n).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Resultados del simulacro
        </h1>
        <p className="text-muted">{`${PYEXAM_PAGE_TITLE} · ${dateText(attempt.startedAt)} · código ${seedToText(attempt.seed)} · ${durationText(used)} de ${PYEXAM_MINUTES / 60} h`}</p>
        {attempt.auto ? (
          <p role="status" className="font-semibold text-warn">
            Se ha acabado el tiempo: el simulacro se ha entregado solo.
          </p>
        ) : null}
        <p className="text-[14px] text-muted">{PYEXAM_INTEGRITY_NOTE}</p>
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {stage ? <p className="text-muted">{stage === "cargando" ? "Cargando Python para corregir…" : STAGE_TEXT[stage]}</p> : null}
        {error ? <p className="text-crit">{error}</p> : null}
      </div>

      {r ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
          <p className="font-display text-[40px] font-semibold leading-none" aria-label={`Nota: ${pointsText(r.score)} sobre 10`}>
            {pointsText(r.score)}
            <span className="text-[20px] text-muted"> / 10</span>
          </p>
          <table className="w-full max-w-xl text-[16px]">
            <caption className="sr-only">Puntos por ejercicio</caption>
            <tbody>
              {exam.shorts.map((s, i) => (
                <tr key={i} className="border-b border-border">
                  <th scope="row" className="py-1 pr-2 text-left font-normal">{`Ejercicio ${i + 1}. ${s.title}`}</th>
                  <td className="whitespace-nowrap py-1 text-right font-semibold">{`${pointsText(r.points[i] ?? 0)} / ${pointsText(PYEXAM_SHORT_POINTS)}`}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-1 pr-2 text-left font-normal">{`Ejercicio ${n + 1}. Proyecto: ${exam.project.title}`}</th>
                <td className="whitespace-nowrap py-1 text-right font-semibold">{`${pointsText(projectPoints)} / ${pointsText(PYEXAM_PROJECT_POINTS)}`}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[14px] text-muted">
            {`Pasos del proyecto: ${exam.project.steps.map((st, k) => `${st.letter} ${pointsText(r.points[n + k] ?? 0)}/${pointsText(st.points)}`).join(" · ")}`}
          </p>
        </div>
      ) : !stage ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-raised p-4">
          <p>{attempt.code ? "Este intento aún no está corregido." : "Este intento no se corrigió y ya no se guarda su código."}</p>
          {attempt.code ? (
            <Button variant="primary" onClick={() => void grade()}>
              <RefreshCw size={16} aria-hidden="true" />
              Corregir ahora
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="primary" onClick={() => onRepeat(attempt.seed)}>
          <RotateCcw size={16} aria-hidden="true" />
          Repetir este simulacro
        </Button>
        <Button onClick={onNew}>
          <Shuffle size={16} aria-hidden="true" />
          Nuevo simulacro
        </Button>
        {r && attempt.code && !reports && !stage ? (
          <Button onClick={() => void grade()}>
            <RefreshCw size={16} aria-hidden="true" />
            Volver a corregir (para ver los detalles y tus figuras)
          </Button>
        ) : null}
        <Button onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </Button>
        <Button variant="ghost" onClick={onHistory}>
          <History size={16} aria-hidden="true" />
          Historial
        </Button>
      </div>
      {attempt.code ? <DataButtons exam={exam} code={attempt.code} answers /> : null}

      <section aria-labelledby={`${attempt.id}-partes`} className="flex flex-col gap-4">
        <h2 id={`${attempt.id}-partes`} className="font-display text-[22px] font-semibold">
          Ejercicio a ejercicio
        </h2>
        <ol className="flex flex-col gap-4">
          {Array.from({ length: pyExamParts(exam) }, (_, i) => (
            <PartReview
              key={i}
              exam={exam}
              part={i}
              points={r?.points[i] ?? null}
              max={maxPoints[i]!}
              labels={labels[i]!}
              failed={r?.failed[i] ?? null}
              report={reports?.[i] ?? null}
              code={attempt.code ? slotCode(starters, attempt.code, i) : null}
              blank={attempt.code ? attempt.code[i] === null : false}
              seed={attempt.seed}
              exercisesPath={exercisesPath}
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby={`${attempt.id}-reglas`} className="flex flex-col gap-2">
        <h2 id={`${attempt.id}-reglas`} className="font-display text-[22px] font-semibold">
          Cómo se ha corregido
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {PYEXAM_GRADING_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PartReview({
  exam,
  part,
  points,
  max,
  labels,
  failed,
  report,
  code,
  blank,
  seed,
  exercisesPath,
}: {
  exam: PyExam;
  part: number;
  points: number | null;
  max: number;
  labels: readonly string[];
  failed: readonly number[] | null;
  report: PartReport | null;
  code: string | null;
  /** La celda sigue como al principio («Sin contestar»). */
  blank: boolean;
  seed: number;
  exercisesPath: string;
}) {
  const n = exam.shorts.length;
  const short = part < n ? exam.shorts[part]! : null;
  const step = part >= n ? exam.project.steps[part - n]! : null;
  const title = short ? `Ejercicio ${part + 1}. ${short.title}` : `Paso ${step!.letter}. ${step!.title}`;
  const practice = (short ?? step)!.practice;
  const solution = short ? short.check.solution : step!.solution;
  const all = report?.units ?? (failed ? labels.map((label, k) => ({ label, ok: !failed.includes(k), detail: [] as string[] })) : null);
  // En una celda sin contestar, «Requisito: … no cumplida» no aporta nada (ya dice «Sin contestar»).
  const units = all && blank ? all.filter((u) => !u.label.startsWith("Requisito:")) : all;
  return (
    <li className="flex min-w-0 break-inside-avoid flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[18px] font-semibold">{title}</h3>
        {points !== null ? (
          <Chip tone={points >= max ? "ok" : points > 0 ? "warn" : "crit"}>{`${pointsText(points)} / ${pointsText(max)}`}</Chip>
        ) : null}
        {report?.mode === "aislado" ? (
          <Chip tone="outline" className="font-normal">
            Corregido con la referencia de los pasos anteriores
          </Chip>
        ) : null}
      </div>
      {report?.note ? <p className="text-[14px] font-semibold">{report.note}</p> : null}
      {units ? (
        <ul aria-label={`Comprobaciones ocultas: ${title}`} className="flex flex-col gap-1 text-[14px]">
          {units.map((u, k) => (
            <li key={k} className={cn("flex flex-col", u.ok ? "text-ok" : "text-crit")}>
              <span className="flex items-start gap-2">
                {u.ok ? <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> : <CircleX size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}
                <span>
                  <RichText text={`${u.label}: ${u.ok ? "cumplida" : "no cumplida"}`} />
                </span>
              </span>
              {u.detail.map((d, i) => (
                <span key={i} className="mono whitespace-pre-wrap break-words pl-6 text-fg">
                  {d}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {report?.figures.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">Tu figura</span>
          {report.figures.map((b64, i) => (
            <Figure key={i} b64={b64} n={i + 1} label={report.figures.length > 1 ? `Figura ${i + 1} entregada en el ${title}` : `Figura entregada: ${title}`} />
          ))}
        </div>
      ) : null}
      {code !== null ? (
        <details className="flex flex-col gap-2">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Tu código</summary>
          <Pre>{code}</Pre>
        </details>
      ) : null}
      <SolutionGate resetKey={solution}>
        <div className="flex flex-col gap-2">
          <p className="text-[14px] text-muted">{step ? "Solución de referencia de este paso (se ejecuta tras las de los anteriores). La tuya puede ser distinta y también correcta:" : "Una solución de referencia (la tuya puede ser distinta y también correcta):"}</p>
          <Pre>{solution}</Pre>
        </div>
      </SolutionGate>
      <div className="print:hidden">
        <Link to={{ pathname: exercisesPath, search: practiceSearch(practice, seed) }} relative="path" className={buttonVariants({ variant: "secondary" })}>
          {`Practicar este tipo: ${pyExamPartName(exam, part)}`}
        </Link>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Historial

function HistoryView({
  store,
  heading,
  onBack,
  onOpen,
  onResume,
  onRepeat,
}: {
  store: PyExamStore;
  heading: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onOpen: (id: string) => void;
  onResume: () => void;
  onRepeat: (seed: number) => void;
}) {
  const active = store.active;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al inicio
        </Button>
      </div>
      <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold">
        Historial de simulacros de 01MIAR
      </h1>
      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-accent bg-raised p-3">
          <p>{`En curso: empezado el ${dateText(active.startedAt)}.`}</p>
          <Button variant="primary" onClick={onResume}>
            <Play size={16} aria-hidden="true" />
            Continuar
          </Button>
        </div>
      ) : null}
      {store.history.length === 0 ? (
        <p className="text-muted">Aún no has entregado ningún simulacro.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {store.history.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{`${dateText(h.startedAt)} · código ${seedToText(h.seed)}`}</span>
                <span className="font-display text-[22px] font-semibold">{h.result ? `${pointsText(h.result.score)} / 10` : "Sin corregir"}</span>
              </div>
              <p className="text-[14px]">{`${durationText((h.finishedAt ?? h.startedAt) - h.startedAt)}${h.auto ? " · entregado al acabarse el tiempo" : ""}`}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onOpen(h.id)}>Ver resultados</Button>
                <Button variant="ghost" onClick={() => onRepeat(h.seed)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Repetir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
