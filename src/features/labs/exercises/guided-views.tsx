// Vista de los tipos guiados (shared/exercises/guided-types.ts): el enunciado, los pasos uno detrás de
// otro con «Comprobar paso» (el siguiente aparece cuando el anterior está bien), las pistas de cada
// paso y la solución detrás de «Ver la solución completa». La corrección es la de shared
// (checkStep): aquí solo se pinta. Los pasos pueden pedir una matriz o un vector (cuadrícula), un
// entero, una forma de NumPy (o que da un error), una lista de números o una etiqueta por fila.
import { Check } from "lucide-react";
import { useId, useMemo, useState, type ComponentType } from "react";
import { blankAnswer, checkStep, type GuidedAnswer, type GuidedExercise, type GuidedStep, type StepVerdict } from "../../../../shared/exercises/guided.ts";
import { GUIDED_TYPES } from "../../../../shared/exercises/guided-types.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { OptionList } from "../combinatorics/common.tsx";
import { cellKey, HOW_TO_WRITE_NUMBERS, Hints, MatrixGrid, PracticeBox, Status, Verdict } from "../linalg/common.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

function Statement({ exercise }: { exercise: GuidedExercise }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      {exercise.statement.blocks.map((b, k) =>
        b.kind === "p" ? (
          <p key={k}>{b.text}</p>
        ) : b.kind === "tex" ? (
          <Tex key={k} display tex={b.tex} label={b.label} className="text-[18px]" />
        ) : (
          <pre key={k} className="overflow-x-auto rounded-md bg-sunken p-3 font-mono text-[15px]">
            {b.code}
          </pre>
        ),
      )}
      <p className="font-semibold">{exercise.statement.ask}</p>
    </div>
  );
}

const usesNumbers = (steps: readonly GuidedStep[]) => steps.some((s) => s.kind === "numbers" || s.kind === "list");

/** La entrada de un paso, según lo que pide. */
function StepInput({ step, answer, verdict, disabled, onChange }: { step: GuidedStep; answer: GuidedAnswer; verdict: StepVerdict | null; disabled: boolean; onChange: (a: GuidedAnswer) => void }) {
  const uid = useId();
  const bad = verdict !== null && !verdict.ok;
  switch (step.kind) {
    case "numbers": {
      if (answer.kind !== "numbers") return null;
      const flagged = verdict && !verdict.ok && verdict.cells ? new Set(verdict.cells.map(([i, j]) => cellKey(i, j))) : undefined;
      return <MatrixGrid name={step.name} values={answer.cells} disabled={disabled} flagged={flagged} onChange={(cells) => onChange({ kind: "numbers", cells })} />;
    }
    case "integer":
    case "list": {
      if (answer.kind !== step.kind) return null;
      return (
        <label className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
          {step.label}
          <Input
            className={cn("w-56 font-mono", bad && "border-crit")}
            aria-invalid={bad ? true : undefined}
            autoComplete="off"
            spellCheck={false}
            inputMode={step.kind === "integer" ? "numeric" : "text"}
            placeholder={step.kind === "list" ? "−1; 2  (o «ninguno»)" : undefined}
            disabled={disabled}
            value={answer.text}
            onChange={(e) => onChange({ kind: step.kind, text: e.target.value.slice(0, 120) } as GuidedAnswer)}
          />
        </label>
      );
    }
    case "shape": {
      if (answer.kind !== "shape") return null;
      const input = (
        <Input
          aria-label="Forma del resultado"
          autoComplete="off"
          spellCheck={false}
          className={cn("w-56 font-mono", bad && !answer.error && "border-crit")}
          placeholder="(2, 3)"
          disabled={disabled}
          value={answer.text}
          onChange={(e) => onChange({ kind: "shape", text: e.target.value.slice(0, 120), error: false })}
        />
      );
      if (!step.allowError) return input;
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-1 text-[14px] font-semibold">Resultado</legend>
          <label className="flex min-h-11 flex-wrap items-center gap-2">
            <input type="radio" name={`${uid}-claim`} checked={!answer.error} onChange={() => onChange({ ...answer, error: false })} />
            Tiene forma
            {input}
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name={`${uid}-claim`} checked={answer.error} onChange={() => onChange({ ...answer, error: true })} />
            NumPy da un error
          </label>
        </fieldset>
      );
    }
    case "labels": {
      if (answer.kind !== "labels") return null;
      const rows = new Set(verdict && !verdict.ok ? (verdict.rows ?? []) : []);
      return (
        <div className="flex flex-col gap-2">
          {step.items.map((item, i) => (
            <div key={item} className="flex flex-wrap items-center gap-2">
              <label htmlFor={`${uid}-${i}`} className="w-28 text-[14px] font-semibold">
                {item}
              </label>
              <select
                id={`${uid}-${i}`}
                className={cn(selectClass, "font-body", rows.has(i) && "border-2 border-crit")}
                aria-invalid={rows.has(i) ? true : undefined}
                disabled={disabled}
                value={answer.picks[i]}
                onChange={(e) => onChange({ kind: "labels", picks: answer.picks.map((p, k) => (k === i ? e.target.value : p)) })}
              >
                <option value="">Elige…</option>
                {step.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case "choice": {
      if (answer.kind !== "choice") return null;
      return (
        <OptionList
          legend="Elige una"
          options={step.options.map((o) => ({ key: o.id, content: o.text }))}
          value={answer.pick}
          invalid={bad}
          onChange={(pick) => (disabled ? undefined : onChange({ kind: "choice", pick }))}
        />
      );
    }
  }
}

/** Los pasos, uno detrás de otro. Otro ejercicio, otra instancia (con key, desde la vista). */
export function GuidedPractice({ exercise, onSolved }: { exercise: GuidedExercise; onSolved: () => void }) {
  const { steps } = exercise;
  const [state, setState] = useState(() => ({ done: 0, answers: steps.map(blankAnswer), verdicts: steps.map((): StepVerdict | null => null) }));
  const { done, answers, verdicts } = state;
  const visible = steps.slice(0, Math.min(done + 1, steps.length));
  return (
    <PracticeBox title="Comprueba tu respuesta">
      <p className="text-[14px] text-muted">{`Escribe cada resultado y pulsa «Comprobar paso».${usesNumbers(steps) ? ` ${HOW_TO_WRITE_NUMBERS}` : ""}`}</p>
      <ol className="flex flex-col gap-4">
        {visible.map((s, k) => (
          <li key={k} className="flex min-w-0 flex-col gap-2">
            <h3 className="font-semibold">{`Paso ${k + 1}. ${s.title}`}</h3>
            <StepInput
              step={s}
              answer={answers[k]!}
              verdict={verdicts[k]!}
              disabled={k < done}
              onChange={(a) => setState({ ...state, answers: answers.map((x, i) => (i === k ? a : x)), verdicts: verdicts.map((v, i) => (i === k ? null : v)) })}
            />
            {k < done ? (
              <Status>
                <Verdict tone="ok">
                  <Check size={16} aria-hidden="true" />
                  {verdicts[k]?.text ?? s.okText}
                </Verdict>
              </Status>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      const v = checkStep(s, answers[k]!);
                      setState({ ...state, verdicts: verdicts.map((x, i) => (i === k ? v : x)), done: v.ok ? k + 1 : done });
                      if (v.ok && k === steps.length - 1) onSolved();
                    }}
                  >
                    <Check size={16} aria-hidden="true" />
                    Comprobar paso
                  </Button>
                  <Hints hints={s.hints} />
                </div>
                {verdicts[k] && !verdicts[k]!.ok ? (
                  <Status>
                    <Verdict tone="warn">{verdicts[k]!.text}</Verdict>
                  </Status>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ol>
      {done >= steps.length ? (
        <Status>
          <Verdict tone="ok">
            <Check size={16} aria-hidden="true" />
            ¡Ejercicio resuelto! Todos los pasos son correctos.
          </Verdict>
        </Status>
      ) : null}
    </PracticeBox>
  );
}

function GuidedView({ exercise, resetKey, onSolved }: { exercise: GuidedExercise; resetKey: string; onSolved: () => void }) {
  return (
    <>
      <Statement exercise={exercise} />
      <GuidedPractice key={resetKey} exercise={exercise} onSolved={onSolved} />
      <SolutionGate resetKey={resetKey}>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3">
          {exercise.solution.map((line, k) => (
            <p key={k}>{line}</p>
          ))}
        </div>
      </SolutionGate>
    </>
  );
}

export const GUIDED_EXERCISE_VIEWS: Array<[string, View]> = GUIDED_TYPES.map(({ type, guided }) => {
  function TypeView({ instance, onSolved }: ExerciseViewProps<unknown>) {
    const exercise = useMemo(() => guided(instance), [instance]);
    return <GuidedView exercise={exercise} resetKey={JSON.stringify(instance)} onSolved={onSolved} />;
  }
  TypeView.displayName = `GuidedView(${type.id})`;
  return [type.id, TypeView];
});
