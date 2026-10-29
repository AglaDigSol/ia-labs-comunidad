// «Comprueba tu respuesta» para el valor de un enunciado en un dominio. Dos modos:
// - «Paso a paso» (por defecto si hay cuantificadores): cada fórmula cuantificada, de dentro hacia
//   fuera; se marca V o F en cada instancia y en la fórmula cuantificada, se comprueba y se bloquea.
//   Si la fórmula completa no es cuantificada, al final se pide su valor.
// - «Solo el resultado»: el valor de la fórmula completa.
// En los dos, si la fórmula es ∀ falsa o ∃ verdadera, se pide además un contraejemplo o un testigo.
// La app solo corrige y da pistas; nunca muestra los valores correctos (eso queda en la solución).
import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { predToPlain, substitute, type PredFormula } from "../../../../shared/predicates/ast.ts";
import {
  evaluationSteps,
  predEvaluator,
  witnesses,
  type EvalStep,
  type PredInterpretation,
} from "../../../../shared/predicates/evaluate.ts";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { truthLetter, truthWord } from "./common.tsx";

/** Más pasos que esto no caben en una práctica razonable: solo queda «Solo el resultado». */
export const MAX_EVAL_STEPS = 10;

const next = (a: boolean | null) => (a === null ? true : a ? false : null);

export type EvalMode = "pasos" | "resultado";

const QUANT_RULE = {
  forall: (v: string) =>
    `Recuerda: ∀${v} es verdadera si todas sus instancias son verdaderas; basta una instancia falsa para que sea falsa.`,
  exists: (v: string) =>
    `Recuerda: ∃${v} es verdadera si al menos una instancia es verdadera; solo es falsa si todas son falsas.`,
};

const CONNECTIVE_HINT =
  "Combina los valores de las fórmulas cuantificadas que ya has resuelto: ¬ cambia el valor, ∧ pide las dos verdaderas, ∨ al menos una, → solo es falsa con antecedente verdadero y consecuente falso, ↔ pide que coincidan.";

/** `mode` vive fuera para que no se pierda al reiniciar la práctica (otra fórmula u otra interpretación). */
export function EvalPractice({
  formula,
  interp,
  mode,
  onMode,
}: {
  formula: PredFormula;
  interp: PredInterpretation;
  mode: EvalMode;
  onMode: (m: EvalMode) => void;
}) {
  const plain = predToPlain(formula);
  const steps = useMemo(() => evaluationSteps(formula, interp, MAX_EVAL_STEPS), [formula, interp]);
  const hasSteps = steps.ok && steps.steps.length > 0;
  const effective: EvalMode = hasSteps ? mode : "resultado";

  return (
    <section aria-labelledby="pred-practice-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pred-practice-title" className="font-display text-[20px] font-semibold">
          Comprueba tu respuesta
        </h2>
        {hasSteps ? (
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Modo de práctica"
            onValueChange={(v) => {
              if (v === "pasos" || v === "resultado") onMode(v);
            }}
          >
            <ToggleGroupItem value="pasos">Paso a paso</ToggleGroupItem>
            <ToggleGroupItem value="resultado">Solo el resultado</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>
      {!steps.ok ? (
        <p className="text-[14px] text-muted">
          {`Esta fórmula necesita más de ${MAX_EVAL_STEPS} pasos en este dominio: practica solo el resultado o usa un dominio más pequeño.`}
        </p>
      ) : null}
      {effective === "pasos" && steps.ok ? (
        <StepPractice formula={formula} plain={plain} steps={steps.steps} value={steps.value} interp={interp} />
      ) : (
        <ResultPractice formula={formula} plain={plain} interp={interp} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Botón V/F

function TruthButton({
  value,
  onClick,
  label,
  bad,
  buttonRef,
}: {
  value: boolean | null;
  onClick: () => void;
  label: string;
  bad: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label}: ${value === null ? "sin responder" : truthWord(value)}${bad ? ", incorrecta" : ""}`}
        onClick={onClick}
        className={cn("min-h-11 min-w-11 rounded-md border font-mono text-[16px]", bad ? "border-crit text-crit" : "border-border")}
      >
        {value === null ? "?" : truthLetter(value)}
      </button>
      {bad ? <X size={16} aria-hidden="true" className="text-crit" /> : null}
    </span>
  );
}

function Hints({ list, shown, onMore }: { list: string[]; shown: number; onMore: () => void }) {
  return (
    <>
      <Button variant="ghost" disabled={shown >= list.length} onClick={onMore}>
        <Lightbulb size={16} aria-hidden="true" />
        {shown === 0 ? "Dame una pista" : "Otra pista"}
      </Button>
      {shown > 0 ? (
        <ol className="w-full list-decimal pl-6 text-[14px]">
          {list.slice(0, shown).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- Paso a paso

function StepPractice({
  formula,
  plain,
  steps,
  value,
  interp,
}: {
  formula: PredFormula;
  plain: string;
  steps: EvalStep[];
  value: boolean;
  interp: PredInterpretation;
}) {
  // Si la fórmula completa es el último paso, no hace falta preguntar su valor otra vez.
  const finalIsStep = steps[steps.length - 1]!.plain === plain;
  const total = steps.length + (finalIsStep ? 0 : 1);
  const blank = (s: EvalStep) => s.instances.map(() => null as boolean | null);

  const [answers, setAnswers] = useState<Array<boolean | null>>(() => blank(steps[0]!));
  const [quant, setQuant] = useState<boolean | null>(null);
  // index: paso en pantalla; solved: pasos comprobados (index o index + 1).
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(0);
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const firstCell = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const isFinal = !finalIsStep && index === steps.length;
  const step = isFinal ? null : steps[index]!;
  const stepDone = solved > index;
  const allDone = solved === total;

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    firstCell.current?.focus();
  }, [index]);

  const wrong = step ? step.instances.map((inst, i) => inst.step === null && answers[i] !== null && answers[i] !== inst.value) : [];
  const instOk = step ? step.instances.every((inst, i) => inst.step !== null || answers[i] === inst.value) : true;
  const missing = step ? step.instances.filter((inst, i) => inst.step === null && answers[i] === null).length : 0;
  const target = step ? step.value : value;
  const quantBad = checked && quant !== null && quant !== target;

  const check = () => {
    setChecked(true);
    if (instOk && quant === target) setSolved(index + 1);
  };
  const advance = () => {
    moved.current = true;
    setIndex(index + 1);
    const n = steps[index + 1];
    setAnswers(n ? blank(n) : []);
    setQuant(null);
    setChecked(false);
    setHints(0);
  };
  const restart = () => {
    setAnswers(blank(steps[0]!));
    setQuant(null);
    setIndex(0);
    setSolved(0);
    setChecked(false);
    setHints(0);
  };

  const hintList = step
    ? [
        `Cada instancia sustituye ${step.variable} por un elemento del dominio. Para un átomo como P(2), mira si está marcado en la extensión de P.`,
        QUANT_RULE[step.quantifier](step.variable),
      ]
    : [CONNECTIVE_HINT];
  const nextLabel = index + 1 < steps.length ? `Siguiente paso: ${steps[index + 1]!.plain}` : `Siguiente paso: ${plain}`;

  return (
    <>
      <p className="text-[14px] text-muted">
        Evalúa de dentro hacia fuera: en cada paso, pulsa cada casilla para elegir V o F en las instancias y en la fórmula
        cuantificada, y pulsa «Comprobar paso».
      </p>
      {solved > 0 ? (
        <div>
          <p className="text-[14px] font-semibold">Pasos resueltos</p>
          <ul className="text-[14px]">
            {steps.slice(0, Math.min(solved, steps.length)).map((s) => (
              <li key={s.plain} className="font-mono">{`${s.plain}: ${truthLetter(s.value)}`}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[14px] font-semibold">
        {`Paso ${index + 1} de ${total}: `}
        <span className="font-mono font-normal">{step ? step.plain : plain}</span>
      </p>

      {step ? (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0">
            <caption className="sr-only">{`Instancias de ${step.plain}`}</caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-[14px] font-semibold">
                  {`${step.variable} =`}
                </th>
                <th scope="col" className="px-3 py-2 text-left text-[14px] font-semibold">
                  Instancia
                </th>
                <th scope="col" className="px-3 py-2 text-[14px] font-semibold">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {step.instances.map((inst, i) => (
                <tr key={inst.element}>
                  <td className="px-3 py-1 font-mono text-muted">{inst.element}</td>
                  <td className="px-3 py-1 font-mono">{inst.plain}</td>
                  <td className="px-2 py-1 text-center">
                    {inst.step !== null ? (
                      <span className="font-mono">
                        {truthLetter(inst.value)}
                        <span className="sr-only">{` (resuelta en el paso ${inst.step + 1})`}</span>
                      </span>
                    ) : stepDone ? (
                      <span className="font-mono">{truthLetter(inst.value)}</span>
                    ) : (
                      <TruthButton
                        value={answers[i] ?? null}
                        bad={checked && wrong[i]!}
                        label={`Instancia ${inst.plain}`}
                        buttonRef={i === step.instances.findIndex((x) => x.step === null) ? firstCell : undefined}
                        onClick={() => {
                          setAnswers((prev) => prev.map((a, k) => (k === i ? next(a) : a)));
                          setChecked(false);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td />
                <th scope="row" className="px-3 py-2 text-left font-mono font-semibold">
                  {step.plain}
                </th>
                <td className="px-2 py-1 text-center">
                  {stepDone ? (
                    <span className="font-mono">{truthLetter(step.value)}</span>
                  ) : (
                    <TruthButton
                      value={quant}
                      bad={quantBad}
                      label={`Fórmula ${step.plain}`}
                      buttonRef={step.instances.every((x) => x.step !== null) ? firstCell : undefined}
                      onClick={() => {
                        setQuant(next);
                        setChecked(false);
                      }}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono">{plain}</span>
          {allDone ? (
            <span className="font-mono">{truthLetter(value)}</span>
          ) : (
            <TruthButton
              value={quant}
              bad={quantBad}
              label={`Fórmula ${plain}`}
              buttonRef={firstCell}
              onClick={() => {
                setQuant(next);
                setChecked(false);
              }}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {allDone ? null : stepDone ? (
          <Button variant="primary" onClick={advance}>
            {nextLabel}
          </Button>
        ) : (
          <Button variant="primary" onClick={check}>
            Comprobar paso
          </Button>
        )}
        {allDone ? null : <Hints list={hintList} shown={hints} onMore={() => setHints((h) => h + 1)} />}
        <Button variant="ghost" onClick={restart}>
          <RotateCcw size={16} aria-hidden="true" />
          Empezar de nuevo
        </Button>
      </div>

      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {stepDone ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              {allDone ? `¡Correcto! La fórmula es ${truthWord(value)} en este dominio.` : `Paso ${index + 1} correcto`}
            </Chip>
          ) : (
            <>
              {step && !instOk ? <Chip tone="warn">Hay instancias mal: revisa las marcadas.</Chip> : null}
              {missing > 0 ? <span className="text-[14px]">{`Te faltan ${missing} instancias por responder.`}</span> : null}
              {quant === null ? (
                <span className="text-[14px]">Falta el valor de la fórmula.</span>
              ) : quant !== target ? (
                <span className="text-[14px]">El valor de la fórmula no es correcto.</span>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {allDone ? <WitnessQuestion formula={formula} interp={interp} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- Solo el resultado

function ResultPractice({ formula, plain, interp }: { formula: PredFormula; plain: string; interp: PredInterpretation }) {
  const value = useMemo(() => predEvaluator(interp)(formula), [formula, interp]);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const right = checked && answer === value;
  const hintList = [
    "Sustituye la variable de cada cuantificador por los elementos del dominio, uno a uno, empezando por el cuantificador más interno.",
    "∀ necesita que todas las instancias sean verdaderas; ∃, que lo sea al menos una.",
    CONNECTIVE_HINT,
  ];
  return (
    <>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-[14px] font-semibold">{`¿Es verdadera ${plain} en este dominio?`}</legend>
        {[true, false].map((v) => (
          <label key={String(v)} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="pred-result"
              checked={answer === v}
              onChange={() => {
                setAnswer(v);
                setChecked(false);
              }}
            />
            {v ? "Verdadera" : "Falsa"}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setChecked(true)}>
          Comprobar
        </Button>
        <Hints list={hintList} shown={hints} onMore={() => setHints((h) => h + 1)} />
      </div>
      {checked ? (
        <div role="status" className="flex flex-col items-start gap-1">
          {answer === null ? (
            <span className="text-[14px]">Elige verdadera o falsa.</span>
          ) : right ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              {`¡Correcto! La fórmula es ${truthWord(value)} en este dominio.`}
            </Chip>
          ) : (
            <Chip tone="warn">No es correcto: revisa las instancias o prueba el modo paso a paso.</Chip>
          )}
        </div>
      ) : null}
      {right ? <WitnessQuestion formula={formula} interp={interp} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- Testigo o contraejemplo

/** Si la fórmula es ∀ falsa o ∃ verdadera, pide un contraejemplo o un testigo y lo comprueba. */
function WitnessQuestion({ formula, interp }: { formula: PredFormula; interp: PredInterpretation }) {
  const w = useMemo(() => witnesses(formula, interp), [formula, interp]);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  if (!w || (formula.kind !== "forall" && formula.kind !== "exists")) return null;
  const x = formula.variable;
  const body = predToPlain(formula.body);
  const isCounter = w.kind === "contraejemplo";
  const ok = pick !== null && w.elements.includes(pick);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-[14px] font-semibold">
          {isCounter
            ? `Ahora elige un contraejemplo: un valor de ${x} para el que ${body} es falsa.`
            : `Ahora elige un testigo: un valor de ${x} para el que ${body} es verdadera.`}
        </legend>
        {interp.domain.map((d) => (
          <label key={d} className="flex min-h-11 items-center gap-2 font-mono">
            <input
              type="radio"
              name="pred-witness"
              checked={pick === d}
              onChange={() => {
                setPick(d);
                setChecked(false);
              }}
            />
            {`${x} = ${d}`}
          </label>
        ))}
      </fieldset>
      <Button variant="secondary" className="self-start" onClick={() => setChecked(true)}>
        {isCounter ? "Comprobar el contraejemplo" : "Comprobar el testigo"}
      </Button>
      {checked ? (
        <div role="status">
          {pick === null ? (
            <span className="text-[14px]">Elige un elemento del dominio.</span>
          ) : ok ? (
            <Chip tone="ok">
              <Check size={16} aria-hidden="true" />
              {`Correcto: con ${x} = ${pick}, ${predToPlain(substitute(formula.body, x, pick))} es ${isCounter ? "falsa" : "verdadera"}.`}
            </Chip>
          ) : (
            <Chip tone="warn">{`${x} = ${pick} no es ${isCounter ? "un contraejemplo" : "un testigo"}: prueba con otro elemento.`}</Chip>
          )}
        </div>
      ) : null}
    </div>
  );
}
