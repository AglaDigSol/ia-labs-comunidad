// «Ejercicios»: banco de ejercicios generados. La lista agrupa los tipos por tema (con el nivel y el
// progreso de cada uno) y la práctica muestra una instancia con la práctica del laboratorio que le
// corresponde. Tipo, nivel y semilla van en la URL (?t=&n=&s=, y &m=<tema> al mezclar), así que un
// ejercicio se puede compartir o repetir. La app solo corrige y da pistas; las soluciones están detrás
// de «Ver la solución completa». El progreso (resueltos y último día, por tipo y nivel) se guarda con
// labs-storage.ts; las respuestas no.
import { ArrowLeft, Check, Shuffle, SkipForward } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { exerciseTopics, exercisesOfTopic, exerciseType, mixedType, type AnyExerciseType } from "../../../../shared/exercises/registry.ts";
import { randomSeed, seedFromText, seedToText } from "../../../../shared/exercises/random.ts";
import {
  EXERCISE_LEVELS,
  EXERCISE_TOPICS,
  LEVEL_SLUGS,
  levelFromSlug,
  type ExerciseLevel,
  type ExerciseTopic,
} from "../../../../shared/exercises/types.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { loadProgress, recordSolved, solvedOfType, type ExercisesProgress } from "./progress.ts";
import { EXERCISE_VIEWS } from "./views.tsx";

const levelLabel = (l: ExerciseLevel) => l[0]!.toUpperCase() + l.slice(1);
const isTopic = (x: string | null): x is ExerciseTopic => EXERCISE_TOPICS.some((t) => t.id === x);
const topicLabel = (id: ExerciseTopic) => EXERCISE_TOPICS.find((t) => t.id === id)!.label;

/** «29/10/2026» a partir de «2026-10-29». */
const dayText = (iso: string) => iso.split("-").reverse().join("/");

type Current = { type: AnyExerciseType; level: ExerciseLevel; seed: number; mix: ExerciseTopic | null };

/** Lo que dice la URL, si es un ejercicio válido (nivel y semilla pueden faltar: se completan). */
function readParams(params: URLSearchParams): { type: AnyExerciseType; level: ExerciseLevel | null; seed: number | null; mix: ExerciseTopic | null } | null {
  const type = exerciseType(params.get("t"));
  if (!type) return null;
  const level = levelFromSlug(params.get("n"));
  const mixRaw = params.get("m");
  return {
    type,
    level: level && type.levels.includes(level) ? level : null,
    seed: seedFromText(params.get("s")),
    mix: isTopic(mixRaw) && mixRaw === type.topic ? mixRaw : null,
  };
}

function paramsOf(c: Current): URLSearchParams {
  const p = new URLSearchParams({ t: c.type.id, n: LEVEL_SLUGS[c.level], s: seedToText(c.seed) });
  if (c.mix) p.set("m", c.mix);
  return p;
}

export function ExercisesPage() {
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState<ExercisesProgress>(loadProgress);
  // Ejercicios resueltos desde que se abrió la página.
  const [session, setSession] = useState(0);
  const read = readParams(params);

  // Tipo válido sin nivel o sin semilla: se completan (sustituyendo la entrada del historial).
  useEffect(() => {
    if (read && (read.level === null || read.seed === null)) {
      const level = read.level ?? read.type.levels[0]!;
      setParams(paramsOf({ type: read.type, level, seed: read.seed ?? randomSeed(), mix: read.mix }), { replace: true });
    }
  }, [read, setParams]);

  const open = (c: Current) => setParams(paramsOf(c));
  const start = (type: AnyExerciseType, level: ExerciseLevel) => open({ type, level, seed: randomSeed(), mix: null });
  const mix = (topic: ExerciseTopic, level: ExerciseLevel) => {
    const seed = randomSeed();
    open({ type: mixedType(topic, level, seed), level, seed, mix: topic });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
          Banco de ejercicios
        </h1>
        <p className="text-muted">
          Elige un tipo de ejercicio y un nivel, y practica con tantos como quieras: cada uno se genera al momento y la app
          corrige tus respuestas sin dártelas.
        </p>
      </div>
      {read && read.level !== null && read.seed !== null ? (
        <PracticeView
          current={{ type: read.type, level: read.level, seed: read.seed, mix: read.mix }}
          progress={progress}
          session={session}
          onOpen={open}
          onBack={() => setParams(new URLSearchParams())}
          onSolved={(type, level) => {
            setProgress(recordSolved(type.id, level));
            setSession((n) => n + 1);
          }}
        />
      ) : read ? null : (
        <ExerciseList progress={progress} session={session} onStart={start} onMix={mix} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Lista

function LevelSelect({ id, value, onChange, levels }: { id: string; value: ExerciseLevel; onChange: (l: ExerciseLevel) => void; levels: readonly ExerciseLevel[] }) {
  return (
    <select
      id={id}
      className={cn(selectClass, "font-body")}
      value={value}
      onChange={(e) => {
        const l = levels.find((x) => x === e.target.value);
        if (l) onChange(l);
      }}
    >
      {levels.map((l) => (
        <option key={l} value={l}>
          {levelLabel(l)}
        </option>
      ))}
    </select>
  );
}

function ExerciseList({
  progress,
  session,
  onStart,
  onMix,
}: {
  progress: ExercisesProgress;
  session: number;
  onStart: (t: AnyExerciseType, l: ExerciseLevel) => void;
  onMix: (topic: ExerciseTopic, l: ExerciseLevel) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {session > 0 ? <SessionCounter session={session} /> : null}
      {exerciseTopics().map((topic) => (
        <TopicBlock key={topic.id} topic={topic.id} progress={progress} onStart={onStart} onMix={onMix} />
      ))}
    </div>
  );
}

function TopicBlock({
  topic,
  progress,
  onStart,
  onMix,
}: {
  topic: ExerciseTopic;
  progress: ExercisesProgress;
  onStart: (t: AnyExerciseType, l: ExerciseLevel) => void;
  onMix: (topic: ExerciseTopic, l: ExerciseLevel) => void;
}) {
  const id = useId();
  const [mixLevel, setMixLevel] = useState<ExerciseLevel>("básico");
  const types = exercisesOfTopic(topic);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${id}-title`} className="font-display text-[22px] font-semibold">
          {topicLabel(topic)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-mix`} className="text-[14px] font-semibold">
            Nivel para mezclar
          </label>
          <LevelSelect id={`${id}-mix`} value={mixLevel} onChange={setMixLevel} levels={EXERCISE_LEVELS} />
          <Button onClick={() => onMix(topic, mixLevel)} aria-label={`Mezclar ejercicios de ${topicLabel(topic)}`}>
            <Shuffle size={16} aria-hidden="true" />
            Mezclar
          </Button>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((t) => (
          <ExerciseCard key={t.id} type={t} progress={progress} onStart={onStart} />
        ))}
      </ul>
    </section>
  );
}

function ExerciseCard({
  type,
  progress,
  onStart,
}: {
  type: AnyExerciseType;
  progress: ExercisesProgress;
  onStart: (t: AnyExerciseType, l: ExerciseLevel) => void;
}) {
  const id = useId();
  const [level, setLevel] = useState<ExerciseLevel>(type.levels[0]!);
  const total = solvedOfType(progress, type.id);
  const byLevel = progress[type.id] ?? {};
  const last = Object.values(byLevel)
    .map((p) => p?.last ?? "")
    .sort()
    .pop();
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <h3 id={`${id}-title`} className="font-display text-[18px] font-semibold">
        {type.title}
      </h3>
      <p className="text-[14px] text-muted">{type.description}</p>
      <p className="text-[14px]" data-testid={`progreso-${type.id}`}>
        {total === 0
          ? "Aún sin resolver."
          : `${total === 1 ? "1 resuelto" : `${total} resueltos`} (${type.levels
              .filter((l) => byLevel[l])
              .map((l) => `${l}: ${byLevel[l]!.solved}`)
              .join(", ")})${last ? `. Último: ${dayText(last)}.` : "."}`}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-level`} className="text-[14px] font-semibold">
          Nivel
        </label>
        <LevelSelect id={`${id}-level`} value={level} onChange={setLevel} levels={type.levels} />
        <Button variant="primary" aria-describedby={`${id}-title`} onClick={() => onStart(type, level)}>
          Practicar
        </Button>
      </div>
    </li>
  );
}

function SessionCounter({ session }: { session: number }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[14px]">
      <Check size={16} aria-hidden="true" className="text-ok" />
      {session === 1 ? "En esta sesión: 1 ejercicio resuelto." : `En esta sesión: ${session} ejercicios resueltos.`}
    </p>
  );
}

// ---------------------------------------------------------------- Práctica

function PracticeView({
  current,
  progress,
  session,
  onOpen,
  onBack,
  onSolved,
}: {
  current: Current;
  progress: ExercisesProgress;
  session: number;
  onOpen: (c: Current) => void;
  onBack: () => void;
  onSolved: (type: AnyExerciseType, level: ExerciseLevel) => void;
}) {
  const { type, level, seed, mix } = current;
  const key = `${type.id}|${level}|${seed}`;
  const instance = useInstance(type, level, seed);
  const View = EXERCISE_VIEWS[type.id];
  // Cada instancia cuenta una sola vez, aunque se compruebe de nuevo.
  const [solvedKey, setSolvedKey] = useState<string | null>(null);
  const [number, setNumber] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Al pasar al siguiente ejercicio, el foco va a su título (no al abrir la práctica).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus();
  }, [key]);

  const next = (lv: ExerciseLevel = level) => {
    moved.current = true;
    setNumber((n) => n + 1);
    const s = randomSeed();
    onOpen({ type: mix ? mixedType(mix, lv, s) : type, level: lv, seed: s, mix });
  };

  const solved = solvedKey === key;
  const done = progress[type.id]?.[level]?.solved ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Cambiar de tipo
        </Button>
        <SessionCounter session={session} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="outline" className="font-normal">
            {topicLabel(type.topic)}
          </Chip>
          {mix ? (
            <Chip tone="info" className="font-normal">
              <Shuffle size={14} aria-hidden="true" />
              Mezcla
            </Chip>
          ) : null}
        </div>
        <h2 ref={heading} tabIndex={-1} className="font-display text-[24px] font-semibold leading-[1.2]">
          {`Ejercicio ${number}: ${type.title}`}
        </h2>
        <p className="text-[14px] text-muted">
          {`${type.description} Código del ejercicio: ${seedToText(seed)} (va en el enlace de esta página).`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={level}
            aria-label="Nivel"
            onValueChange={(v) => {
              const l = type.levels.find((x) => x === v);
              if (l && l !== level) next(l);
            }}
          >
            {type.levels.map((l) => (
              <ToggleGroupItem key={l} value={l}>
                {levelLabel(l)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-[14px] text-muted">{`Resueltos en este nivel: ${done}`}</span>
        </div>
      </div>

      {View && instance ? (
        <View
          key={key}
          instance={instance}
          onSolved={() => {
            if (solved) return;
            setSolvedKey(key);
            onSolved(type, level);
          }}
        />
      ) : (
        <p role="alert" className="text-crit">
          No se ha podido generar este ejercicio. Prueba con el siguiente.
        </p>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-base py-3">
        <Button variant={solved ? "primary" : "secondary"} onClick={() => next()}>
          <SkipForward size={16} aria-hidden="true" />
          Siguiente ejercicio
        </Button>
        <div role="status" className="text-[14px]">
          {solved ? <span className="font-semibold text-ok">¡Resuelto! Cuenta en tu progreso.</span> : null}
        </div>
      </div>
    </div>
  );
}

/** Genera la instancia (determinista: misma semilla, mismo ejercicio). Null si el generador falla. */
function useInstance(type: AnyExerciseType, level: ExerciseLevel, seed: number): unknown {
  return useMemo(() => {
    try {
      return type.generate(seed, level);
    } catch {
      return null;
    }
  }, [type, level, seed]);
}
