// «Simulacro de examen (02MIAR)»: un examen como el final, con preguntas generadas por el banco de
// ejercicios. Cuatro pantallas:
// - Inicio: modo (completo 20 preguntas · 2 h, rápido 10 · 1 h o por temas), orden, penalización
//   opcional e instrucciones como las del examen. La configuración y la semilla van en la URL, así que
//   un simulacro se puede repetir o compartir.
// - Examen: una pregunta por pantalla, navegador (contestada, pendiente, marcada para revisar), reloj
//   que no se para (la hora de inicio se guarda: sobrevive a recargar) y entrega automática a 0. Sin
//   pistas, sin «Comprobar» y sin soluciones.
// - Resultados: nota sobre 10, tiempo, desglose por bloques y, pregunta a pregunta, tu respuesta, la
//   correcta y la solución razonada, con «Practicar este tipo» en el banco de ejercicios.
// - Historial: los intentos entregados (y el que está en curso se retoma).
// Los intentos se guardan con labs-storage.ts (clave «exam»).
import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleMinus, CircleX, Clock, Flag, History, Play, Printer, RotateCcw, Send, Shuffle } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, useSearchParams } from "react-router";
import {
  attemptRemaining,
  configExam,
  configFromSearch,
  configMinutes,
  configQuestions,
  configToSearch,
  defaultExamConfig,
  EXAM_MODE_INFO,
  EXAM_MODES,
  finishAttempt,
  recordAttempt,
  startAttempt,
  type ExamAttempt,
  type ExamConfig,
  type ExamMode,
  type ExamStore,
} from "../../../../shared/exam/attempt.ts";
import { EXAM_SECTION_IDS, EXAM_SECTIONS, examSectionLabel, MAX_EXAM_MINUTES, MAX_EXAM_QUESTIONS, MIN_EXAM_MINUTES, MIN_EXAM_QUESTIONS, type ExamQuestion } from "../../../../shared/exam/blueprint.ts";
import { scoreExam, scoreText, WRONG_PENALTY, type QuestionOutcome } from "../../../../shared/exam/grading.ts";
import { numericNotes } from "../../../../shared/exam/numeric.ts";
import { decodeChoiceAnswer, encodeChoiceAnswer, isAnswered } from "../../../../shared/exam/types.ts";
import { randomSeed, seedToText } from "../../../../shared/exercises/random.ts";
import { ChoiceOptions, ChoiceSolution } from "../../../components/practice/ChoiceQuestion.tsx";
import { NumericField } from "../../../components/practice/NumericField.tsx";
import { Button, buttonVariants } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog.tsx";
import { Switch } from "../../../components/ui/switch.tsx";
import { cn } from "../../../lib/cn.ts";
import { ExamBlocks } from "./ExamBlocks.tsx";
import { announcementMarks, clockText, durationText, remainingAnnouncement } from "./time-text.ts";

export { clockText, durationText } from "./time-text.ts";
import { loadExamStore, saveExamStore } from "./exam-storage.ts";

export const INTEGRITY_EXAM_NOTE = "Es un simulacro para practicar; no es el examen oficial ni lo sustituye.";

export interface ExamSimulatorPageProps {
  /**
   * Ruta del banco de ejercicios para «Practicar este tipo», relativa a esta página (por defecto «..»:
   * el simulacro va en …/ejercicios/simulacro).
   */
  exercisesPath?: string;
}

type View = { kind: "inicio" } | { kind: "examen" } | { kind: "resultados"; id: string; auto: boolean } | { kind: "historial" };

// ---------------------------------------------------------------- Formatos

const minutesText = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const dateText = (ts: number) => new Date(ts).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const modeText = (c: ExamConfig) => (c.mode === "temas" ? `Por temas (${configQuestions(c)} preguntas)` : EXAM_MODE_INFO[c.mode].label);


// ---------------------------------------------------------------- Página

export function ExamSimulatorPage({ exercisesPath = ".." }: ExamSimulatorPageProps = {}) {
  const [params, setParams] = useSearchParams();
  const [store, setStore] = useState<ExamStore>(loadExamStore);
  const storeRef = useRef(store);
  const [view, setView] = useState<View>(() => (storeRef.current.active ? { kind: "examen" } : { kind: "inicio" }));
  const [config, setConfig] = useState<ExamConfig>(() => configFromSearch(params) ?? defaultExamConfig(randomSeed()));
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const commit = useCallback((next: ExamStore) => {
    storeRef.current = next;
    saveExamStore(next);
    setStore(next);
  }, []);

  // La configuración de la pantalla de inicio va en la URL (sustituyendo la entrada del historial).
  const search = configToSearch(config).toString();
  useEffect(() => {
    if (view.kind === "inicio" && params.toString() !== search) setParams(new URLSearchParams(search), { replace: true });
  }, [view.kind, search, params, setParams]);

  // Al cambiar de pantalla, el foco va a su título (no al abrir la página).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [view]);

  const start = () => {
    const questions = configExam(config);
    commit({ ...storeRef.current, active: startAttempt(config, questions.length, Date.now()) });
    setView({ kind: "examen" });
  };

  const finish = (auto: boolean) => {
    const active = storeRef.current.active;
    if (!active) return;
    const done = finishAttempt(active, configExam(active.config), Date.now(), auto);
    commit(recordAttempt(storeRef.current, done));
    setView({ kind: "resultados", id: done.id, auto: done.result?.auto ?? auto });
  };

  const repeat = (c: ExamConfig) => {
    setConfig(c);
    setView({ kind: "inicio" });
  };

  const active = store.active;

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Simulacro de examen">
      {view.kind === "examen" && active ? (
        <ExamView
          key={active.id}
          attempt={active}
          heading={heading}
          onChange={(a) => commit({ ...storeRef.current, active: a })}
          onFinish={finish}
        />
      ) : view.kind === "resultados" ? (
        <ResultsView
          attempt={store.history.find((h) => h.id === view.id) ?? null}
          auto={view.auto}
          heading={heading}
          exercisesPath={exercisesPath}
          onRepeat={repeat}
          onNew={(c) => repeat({ ...c, seed: randomSeed() })}
          onHistory={() => setView({ kind: "historial" })}
        />
      ) : view.kind === "historial" ? (
        <HistoryView
          store={store}
          heading={heading}
          onBack={() => setView({ kind: "inicio" })}
          onOpen={(id) => setView({ kind: "resultados", id, auto: false })}
          onResume={() => setView({ kind: "examen" })}
          onRepeat={repeat}
        />
      ) : (
        <StartView
          config={config}
          onConfig={setConfig}
          active={active}
          historyCount={store.history.length}
          heading={heading}
          onStart={start}
          onResume={() => setView({ kind: "examen" })}
          onHistory={() => setView({ kind: "historial" })}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Inicio

function StartView({
  config,
  onConfig,
  active,
  historyCount,
  heading,
  onStart,
  onResume,
  onHistory,
}: {
  config: ExamConfig;
  onConfig: (c: ExamConfig) => void;
  active: ExamAttempt | null;
  historyCount: number;
  heading: RefObject<HTMLHeadingElement | null>;
  onStart: () => void;
  onResume: () => void;
  onHistory: () => void;
}) {
  const id = useId();
  const n = configQuestions(config);
  const minutes = configMinutes(config);
  const set = (patch: Partial<ExamConfig>) => onConfig({ ...config, ...patch });
  const canStart = n > 0 && !active;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Simulacro de examen (02MIAR)
        </h1>
        <p className="text-muted">Un examen como el final de «Matemáticas para la IA», con preguntas nuevas generadas al momento: opción múltiple a)–d) y respuestas numéricas, con reloj y nota al entregar.</p>
        <p role="note" className="rounded-md border border-border bg-raised p-3 text-[14px] font-semibold">
          {INTEGRITY_EXAM_NOTE}
        </p>
      </div>

      {active ? (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-accent bg-raised p-4">
          <h2 className="font-display text-[20px] font-semibold">Tienes un simulacro en curso</h2>
          <p>{`${modeText(active.config)}, empezado el ${dateText(active.startedAt)}. El reloj sigue corriendo: quedan ${clockText(attemptRemaining(active, Date.now()))}.`}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onResume}>
              <Play size={16} aria-hidden="true" />
              Continuar el simulacro
            </Button>
          </div>
          <p className="text-[14px] text-muted">Entrégalo para poder empezar otro.</p>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-3" disabled={!!active}>
        <legend className="mb-2 font-display text-[20px] font-semibold">Modo</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {EXAM_MODES.map((m) => (
            <label key={m} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-raised p-3", config.mode === m ? "border-2 border-accent" : "border-border")}>
              <input type="radio" name={`${id}-modo`} className="mt-1 size-5 shrink-0 accent-accent" checked={config.mode === m} onChange={() => set({ mode: m as ExamMode })} />
              <span className="flex flex-col">
                <span className="font-semibold">{`${EXAM_MODE_INFO[m].label}${m === "temas" ? "" : `: ${EXAM_MODE_INFO[m].detail}`}`}</span>
                {m === "temas" ? <span className="text-[14px] text-muted">{EXAM_MODE_INFO[m].detail}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {config.mode === "temas" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-4">
          <fieldset className="flex flex-col gap-2" disabled={!!active}>
            <legend className="mb-1 font-semibold">Temas</legend>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {EXAM_SECTIONS.map((s) => (
                <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-accent"
                    checked={config.sections.includes(s.id)}
                    onChange={(e) => set({ sections: EXAM_SECTION_IDS.filter((x) => (x === s.id ? e.target.checked : config.sections.includes(x))) })}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => set({ sections: [...EXAM_SECTION_IDS] })}>Todos</Button>
              <Button onClick={() => set({ sections: [] })}>Ninguno</Button>
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-4">
            <NumberInput label="Número de preguntas" value={config.count} min={MIN_EXAM_QUESTIONS} max={MAX_EXAM_QUESTIONS} disabled={!!active} onChange={(v) => set({ count: v })} />
            <NumberInput label="Tiempo (minutos)" value={config.minutes} min={MIN_EXAM_MINUTES} max={MAX_EXAM_MINUTES} disabled={!!active} onChange={(v) => set({ minutes: v })} />
          </div>
          {config.sections.length === 0 ? <p className="text-[14px] font-semibold text-warn">Elige al menos un tema.</p> : null}
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2" disabled={!!active}>
        <legend className="mb-1 font-semibold">Orden de las preguntas</legend>
        {(
          [
            ["tema", "Por temas, como en el examen"],
            ["barajado", "Barajadas"],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name={`${id}-orden`} className="size-5 shrink-0 accent-accent" checked={config.order === v} onChange={() => set({ order: v })} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <Switch label="Penalización por fallo" checked={config.penalty} disabled={!!active} onCheckedChange={(v) => set({ penalty: v })} aria-describedby={`${id}-pen`} />
        <p id={`${id}-pen`} className="text-[14px] text-muted">
          {config.penalty
            ? `Activada: cada respuesta incorrecta resta un tercio del valor de la pregunta (${scoreText((10 / Math.max(1, n)) * WRONG_PENALTY)} puntos); en blanco no resta. Así, contestar al azar entre cuatro opciones vale 0 de media. La nota nunca baja de 0.`
            : "Desactivada, como en el examen de 2025-26: una respuesta incorrecta vale 0, igual que una en blanco."}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
        <h2 className="font-display text-[20px] font-semibold">Instrucciones</h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li>{`${n} ${n === 1 ? "pregunta" : "preguntas"} en ${minutesText(minutes)}. Cada pregunta vale ${n > 0 ? scoreText(10 / n) : "0"} puntos; la nota es sobre 10.`}</li>
          <li>Opción múltiple: cuatro opciones, de a) a d), y una sola correcta.</li>
          <li>Respuesta numérica: solo cifras, sin separador de miles; los decimales, con coma (0,25). Si se pide, redondea a dos decimales: la segunda cifra sube si la tercera es 5 o más (2/3 → 0,67).</li>
          <li>El tiempo empieza al pulsar «Empezar» y no se puede parar. Puedes recargar la página: el reloj sigue y tus respuestas se conservan. A 0, el simulacro se entrega solo.</li>
          <li>Durante el simulacro no hay pistas, ni «Comprobar», ni soluciones. Puedes marcar preguntas para revisarlas antes de entregar.</li>
          <li>Al entregar verás la nota, la respuesta correcta y la solución de cada pregunta, con un enlace para practicar ese tipo de ejercicio.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] text-muted">
          {`Código del simulacro: `}
          <span className="font-mono font-semibold text-fg">{seedToText(config.seed)}</span>
          {` (va en el enlace de esta página: con el mismo enlace salen las mismas preguntas).`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onStart} disabled={!canStart}>
            <Play size={16} aria-hidden="true" />
            Empezar
          </Button>
          <Button onClick={() => set({ seed: randomSeed() })} disabled={!!active}>
            <Shuffle size={16} aria-hidden="true" />
            Otras preguntas
          </Button>
          <Button variant="ghost" onClick={onHistory}>
            <History size={16} aria-hidden="true" />
            {historyCount > 0 ? `Historial (${historyCount})` : "Historial"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void }) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        disabled={disabled}
        className="min-h-11 w-32 rounded-md border border-border bg-sunken px-3 text-fg"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (Number.isInteger(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={() => setText(String(value))}
      />
      <span className="text-[14px] text-muted">{`Entre ${min} y ${max}.`}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Examen


function ExamView({
  attempt,
  heading,
  onChange,
  onFinish,
}: {
  attempt: ExamAttempt;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (a: ExamAttempt) => void;
  onFinish: (auto: boolean) => void;
}) {
  const questions = useMemo(() => configExam(attempt.config), [attempt.config]);
  const answers = attempt.answers ?? [];
  const n = questions.length;
  const current = Math.min(attempt.current, Math.max(0, n - 1));
  const q = questions[current];
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const finished = useRef(false);
  const remaining = attemptRemaining(attempt, now);
  const marks = useMemo(() => announcementMarks(configMinutes(attempt.config)), [attempt.config]);
  const announced = useRef<Set<number> | null>(null);
  if (announced.current === null) announced.current = new Set(marks.filter((m) => remaining <= m * 60_000));

  // Un tic por segundo (y al volver a la pestaña): el reloj se calcula con la hora de inicio.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  // A 0, se entrega solo (una vez).
  useEffect(() => {
    if (remaining <= 0 && !finished.current) {
      finished.current = true;
      onFinish(true);
    }
  }, [remaining, onFinish]);

  // Avisos accesibles del tiempo, como mucho uno por umbral.
  useEffect(() => {
    const hit = marks.filter((m) => remaining <= m * 60_000 && !announced.current!.has(m));
    if (hit.length === 0) return;
    for (const m of marks) if (m >= Math.min(...hit)) announced.current!.add(m);
    setMessage(remainingAnnouncement(Math.min(...hit)));
  }, [remaining, marks]);

  // Al navegar, el foco va al título de la pregunta.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    questionHeading.current?.focus();
  }, [current]);

  if (!q) {
    return (
      <div className="flex flex-col gap-3">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[24px] font-semibold">
          Simulacro en curso
        </h1>
        <p role="alert">No se han podido generar las preguntas de este simulacro.</p>
        <Button variant="primary" onClick={() => onFinish(false)}>
          Entregar
        </Button>
      </div>
    );
  }

  const go = (i: number) => {
    if (i < 0 || i >= n || i === current) return;
    moved.current = true;
    onChange({ ...attempt, current: i });
  };
  const setAnswer = (value: string | null) => {
    const next = Array.from({ length: n }, (_, i) => answers[i] ?? null);
    next[current] = value === "" ? null : value;
    onChange({ ...attempt, answers: next, current });
  };
  const flagged = attempt.flagged.includes(current);
  const toggleFlag = () => onChange({ ...attempt, flagged: flagged ? attempt.flagged.filter((i) => i !== current) : [...attempt.flagged, current].sort((a, b) => a - b) });
  const answeredCount = questions.filter((qq, i) => isAnswered(qq, answers[i])).length;
  const unanswered = questions.map((qq, i) => (isAnswered(qq, answers[i]) ? -1 : i + 1)).filter((i) => i > 0);
  const low = remaining <= 5 * 60_000;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="sticky top-[93px] z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-base py-2 lg:top-0">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[20px] font-semibold">
          {`Simulacro: ${modeText(attempt.config)}`}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px]">{`Contestadas: ${answeredCount} de ${n}`}</span>
          <div role="timer" aria-label="Tiempo restante" className={cn("flex min-h-11 items-center gap-2 rounded-md border px-3 font-mono text-[18px] font-semibold", low ? "border-2 border-crit text-crit" : "border-border")}>
            <Clock size={18} aria-hidden="true" />
            <span>{clockText(remaining)}</span>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {message}
        </p>
      </div>

      <Navigator questions={questions} answers={answers} flagged={attempt.flagged} current={current} onGo={go} />

      <article className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-raised p-4" aria-labelledby={`${attempt.id}-q`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="outline" className="font-normal">
            {examSectionLabel(q.section)}
          </Chip>
          <Chip tone="info" className="font-normal">
            {q.kind === "choice" ? "Opción múltiple" : "Respuesta numérica"}
          </Chip>
          {flagged ? (
            <Chip tone="warn">
              <Flag size={14} aria-hidden="true" />
              Marcada para revisar
            </Chip>
          ) : null}
        </div>
        <h2 id={`${attempt.id}-q`} ref={questionHeading} tabIndex={-1} className="font-display text-[22px] font-semibold">
          {`Pregunta ${current + 1} de ${n}`}
        </h2>
        <ExamBlocks blocks={q.stem} />
        {q.kind === "choice" ? (
          <ChoiceOptions
            key={q.id}
            legend={q.prompt}
            options={q.options}
            mode={q.mode}
            value={decodeChoiceAnswer(answers[current] ?? null)}
            onChange={(ids) => setAnswer(encodeChoiceAnswer(ids))}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">{q.prompt}</p>
            <NumericField key={q.id} label={q.label} value={answers[current] ?? ""} note={q.formatNote} onChange={(v) => setAnswer(v)} />
          </div>
        )}
        {q.kind === "choice" && isAnswered(q, answers[current]) ? (
          <div>
            <Button variant="ghost" onClick={() => setAnswer(null)}>
              Borrar mi respuesta
            </Button>
          </div>
        ) : null}
      </article>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => go(current - 1)} disabled={current === 0}>
          <ArrowLeft size={16} aria-hidden="true" />
          Anterior
        </Button>
        <Button onClick={toggleFlag} aria-pressed={flagged}>
          <Flag size={16} aria-hidden="true" />
          {flagged ? "Quitar la marca" : "Marcar para revisar"}
        </Button>
        <Button onClick={() => go(current + 1)} disabled={current === n - 1}>
          Siguiente
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <Button variant="primary" className="sm:ml-auto" onClick={() => setConfirm(true)}>
          <Send size={16} aria-hidden="true" />
          Entregar
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>¿Entregar el simulacro?</DialogTitle>
          <DialogDescription>{`Has contestado ${answeredCount} de ${n} preguntas. Después de entregar ya no podrás cambiar las respuestas.`}</DialogDescription>
          {unanswered.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{unanswered.length === 1 ? "Queda 1 pregunta sin contestar:" : `Quedan ${unanswered.length} preguntas sin contestar:`}</p>
              <ul className="flex flex-wrap gap-2" aria-label="Preguntas sin contestar">
                {unanswered.map((i) => (
                  <li key={i}>
                    <Button
                      onClick={() => {
                        setConfirm(false);
                        go(i - 1);
                      }}
                      aria-label={`Ir a la pregunta ${i}`}
                    >
                      {i}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Has contestado todas las preguntas.</p>
          )}
          {attempt.flagged.length > 0 ? <p className="text-[14px]">{`Marcadas para revisar: ${attempt.flagged.map((i) => i + 1).join(", ")}.`}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Seguir con el examen</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false);
                finished.current = true;
                onFinish(false);
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

function Navigator({
  questions,
  answers,
  flagged,
  current,
  onGo,
}: {
  questions: readonly ExamQuestion[];
  answers: ReadonlyArray<string | null>;
  flagged: readonly number[];
  current: number;
  onGo: (i: number) => void;
}) {
  return (
    <nav aria-label="Preguntas del simulacro" className="flex flex-col gap-2">
      <ol className="flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const done = isAnswered(q, answers[i]);
          const flag = flagged.includes(i);
          const state = `${done ? "contestada" : "sin contestar"}${flag ? ", marcada para revisar" : ""}`;
          return (
            <li key={q.id}>
              <button
                type="button"
                aria-label={`Pregunta ${i + 1}: ${state}`}
                aria-current={i === current ? "step" : undefined}
                onClick={() => onGo(i)}
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-md border text-[15px] font-semibold",
                  done ? "border-accent bg-accent-soft" : "border-border bg-raised",
                  i === current && "outline outline-2 outline-offset-2 outline-accent",
                )}
              >
                {i + 1}
                {done ? <Check size={12} aria-hidden="true" className="absolute bottom-0.5 right-0.5" /> : null}
                {flag ? <Flag size={12} aria-hidden="true" className="absolute right-0.5 top-0.5 text-warn" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Check size={14} aria-hidden="true" /> contestada (fondo de color)
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag size={14} aria-hidden="true" /> marcada para revisar
        </span>
        <span>sin marca: pendiente</span>
      </p>
    </nav>
  );
}

// ---------------------------------------------------------------- Resultados

const OUTCOME: Record<QuestionOutcome, { label: string; tone: "ok" | "crit" | "outline"; icon: ReactNode }> = {
  bien: { label: "Bien", tone: "ok", icon: <CircleCheck size={16} aria-hidden="true" /> },
  mal: { label: "Mal", tone: "crit", icon: <CircleX size={16} aria-hidden="true" /> },
  "en-blanco": { label: "En blanco", tone: "outline", icon: <CircleMinus size={16} aria-hidden="true" /> },
};

function ResultsView({
  attempt,
  auto,
  heading,
  exercisesPath,
  onRepeat,
  onNew,
  onHistory,
}: {
  attempt: ExamAttempt | null;
  auto: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  exercisesPath: string;
  onRepeat: (c: ExamConfig) => void;
  onNew: (c: ExamConfig) => void;
  onHistory: () => void;
}) {
  const questions = useMemo(() => (attempt ? configExam(attempt.config) : []), [attempt]);
  if (!attempt || !attempt.result) {
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
  const answers = attempt.answers;
  const s = answers ? scoreExam(questions, answers, attempt.config.penalty) : null;
  const r = attempt.result;
  const used = (attempt.finishedAt ?? attempt.startedAt) - attempt.startedAt;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Resultados del simulacro
        </h1>
        <p className="text-muted">{`${modeText(attempt.config)} · ${dateText(attempt.startedAt)} · código ${seedToText(attempt.config.seed)}`}</p>
        {auto || r.auto ? (
          <p role="status" className="font-semibold text-warn">
            Se ha acabado el tiempo: el simulacro se ha entregado solo.
          </p>
        ) : null}
        <p className="text-[14px] text-muted">{INTEGRITY_EXAM_NOTE}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
        <p className="font-display text-[40px] font-semibold leading-none" aria-label={`Nota: ${scoreText(r.score)} sobre 10`}>
          {scoreText(r.score)}
          <span className="text-[20px] text-muted"> / 10</span>
        </p>
        <p>{`Bien: ${r.correct} · Mal: ${r.wrong} · En blanco: ${r.blank}`}</p>
        <p>{`Tiempo: ${durationText(used)} de ${minutesText(configMinutes(attempt.config))}.`}</p>
        <p className="text-[14px] text-muted">
          {attempt.config.penalty ? "Con penalización: cada fallo resta un tercio del valor de la pregunta; en blanco no resta." : "Sin penalización por fallo."}
        </p>
      </div>

      <section aria-labelledby={`${attempt.id}-temas`} className="flex flex-col gap-3">
        <h2 id={`${attempt.id}-temas`} className="font-display text-[22px] font-semibold">
          Por temas
        </h2>
        <ul className="flex flex-col gap-2">
          {r.sections.map(([sec, ok, total]) => (
            <li key={sec} className="flex flex-col gap-1">
              <span className="flex flex-wrap justify-between gap-2 text-[14px]">
                <span className="font-semibold">{examSectionLabel(sec)}</span>
                <span>{`${ok} de ${total} bien (${Math.round((100 * ok) / total)} %)`}</span>
              </span>
              <span className="block h-3 w-full overflow-hidden rounded-full border border-border bg-sunken" aria-hidden="true">
                <span className="block h-full bg-accent" style={{ width: `${(100 * ok) / total}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="primary" onClick={() => onRepeat(attempt.config)}>
          <RotateCcw size={16} aria-hidden="true" />
          Repetir este simulacro
        </Button>
        <Button onClick={() => onNew(attempt.config)}>
          <Shuffle size={16} aria-hidden="true" />
          Nuevo simulacro
        </Button>
        <Button onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </Button>
        <Button variant="ghost" onClick={onHistory}>
          <History size={16} aria-hidden="true" />
          Historial
        </Button>
      </div>

      {s && answers ? (
        <section aria-labelledby={`${attempt.id}-preguntas`} className="flex flex-col gap-4">
          <h2 id={`${attempt.id}-preguntas`} className="font-display text-[22px] font-semibold">
            Pregunta a pregunta
          </h2>
          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <QuestionReview key={q.id} index={i} question={q} answer={answers[i] ?? null} outcome={s.outcomes[i]!} exercisesPath={exercisesPath} />
            ))}
          </ol>
        </section>
      ) : (
        <p className="text-muted">Las respuestas de este intento ya no se guardan (solo se conservan las de los cinco últimos).</p>
      )}
    </div>
  );
}

function QuestionReview({ index, question: q, answer, outcome, exercisesPath }: { index: number; question: ExamQuestion; answer: string | null; outcome: QuestionOutcome; exercisesPath: string }) {
  const o = OUTCOME[outcome];
  const chosen = q.kind === "choice" ? q.options.filter((x) => decodeChoiceAnswer(answer).includes(x.id)) : [];
  const yours = outcome === "en-blanco" ? "sin contestar" : q.kind === "choice" ? chosen.map((x) => `${x.letter}) ${x.text}`).join("; ") : (answer ?? "");
  const notes = q.kind === "numeric" ? numericNotes(answer, q.format) : [];
  return (
    <li className="flex min-w-0 break-inside-avoid flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[18px] font-semibold">{`Pregunta ${index + 1}`}</h3>
        <Chip tone={o.tone}>
          {o.icon}
          {o.label}
        </Chip>
        <Chip tone="outline" className="font-normal">
          {examSectionLabel(q.section)}
        </Chip>
      </div>
      <ExamBlocks blocks={q.stem} />
      <p className="font-semibold">{q.prompt}</p>
      <dl className="grid gap-1 text-[16px] sm:grid-cols-[max-content_1fr] sm:gap-x-3">
        <dt className="font-semibold">Tu respuesta:</dt>
        <dd className="min-w-0 break-words">{yours}</dd>
        <dt className="font-semibold">Respuesta correcta:</dt>
        <dd className="min-w-0 break-words">{q.correctText}</dd>
      </dl>
      {notes.length > 0 ? (
        <ul className="text-[14px] text-muted">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <details className="flex flex-col gap-2" open>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Solución</summary>
        <div className="flex flex-col gap-3">
          {q.kind === "choice" ? <ChoiceSolution options={q.options} /> : null}
          {q.solution.length > 0 ? <ExamBlocks blocks={q.solution} /> : null}
        </div>
      </details>
      <div className="print:hidden">
        <Link to={{ pathname: exercisesPath, search: q.practiceLink }} relative="path" className={buttonVariants({ variant: "secondary" })}>
          {`Practicar este tipo: ${q.title}`}
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
  store: ExamStore;
  heading: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onOpen: (id: string) => void;
  onResume: () => void;
  onRepeat: (c: ExamConfig) => void;
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
        Historial de simulacros
      </h1>
      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-accent bg-raised p-3">
          <p>{`En curso: ${modeText(active.config)}, empezado el ${dateText(active.startedAt)}.`}</p>
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
                <span className="font-semibold">{`${dateText(h.startedAt)} · ${modeText(h.config)}`}</span>
                <span className="font-display text-[22px] font-semibold">{`${scoreText(h.result!.score)} / 10`}</span>
              </div>
              <p className="text-[14px]">
                {`Bien ${h.result!.correct}, mal ${h.result!.wrong}, en blanco ${h.result!.blank} · ${durationText((h.finishedAt ?? h.startedAt) - h.startedAt)}${h.result!.auto ? " · entregado al acabarse el tiempo" : ""}${h.config.penalty ? " · con penalización" : ""}`}
              </p>
              <p className="text-[14px] text-muted">{h.result!.sections.map(([sec, ok, total]) => `${examSectionLabel(sec)}: ${ok}/${total}`).join(" · ")}</p>
              <div className="flex flex-wrap gap-2">
                {h.answers ? <Button onClick={() => onOpen(h.id)}>Ver resultados</Button> : null}
                <Button variant="ghost" onClick={() => onRepeat(h.config)}>
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

