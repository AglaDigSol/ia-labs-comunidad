// Vista de «Cuantificadores en un conjunto concreto»: el conjunto A con llaves, el enunciado (o su
// negación) con la nomenclatura debajo y, según el modo, Verdadero/Falso con testigo o contraejemplo,
// o elegir la negación entre cuatro y después decir si es verdadera en A. Todo se corrige al
// comprobar, recorriendo los elementos (shared/exercises/predicates-concrete.ts).
import { Check } from "lucide-react";
import { useId, useMemo, useState, type ComponentType } from "react";
import {
  askedStatement,
  bodyHolds,
  bodyTex,
  bodyText,
  checkWitness,
  concreteHints,
  conclusion,
  correctNegation,
  isNegation,
  MAX_WITNESS_TEXT,
  negatedTex,
  negatedText,
  negationMistakeText,
  negationSteps,
  nestedRows,
  nomenclature,
  numText,
  PRED_CONCRETE,
  propHolds,
  propsOf,
  relText,
  setTex,
  setText,
  spoken,
  statementTex,
  statementText,
  truthIn,
  needsWitness,
  type ConcreteStatement,
  type PredConcreteInstance,
} from "../../../../shared/exercises/predicates-concrete.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { Hints, OptionList, PracticeBox, Statement, Status, Verdict, YesNo } from "../combinatorics/common.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

const formula = (s: ConcreteStatement) => <Tex tex={statementTex(s)} label={spoken(statementText(s))} />;

function Result({ ok, children }: { ok: boolean; children: string }) {
  return (
    <Status>
      {ok ? (
        <Verdict tone="ok">
          <Check size={16} aria-hidden="true" />
          {`¡Correcto! ${children}`}
        </Verdict>
      ) : (
        <Verdict tone="warn">{children}</Verdict>
      )}
    </Status>
  );
}

/** Verdadero o falso en A y, si hace falta según lo elegido, un testigo o un contraejemplo. */
function TruthStep({ statement, set, legend, hints, onSolved }: { statement: ConcreteStatement; set: number[]; legend: string; hints: string[]; onSolved: () => void }) {
  const id = useId();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [witness, setWitness] = useState("");
  const [checked, setChecked] = useState(false);
  const value = truthIn(statement, set);
  // El campo sale según lo que se elige, no según la respuesta: así no la delata.
  const asks = choice !== null && needsWitness(statement, choice) ? statement : null;
  const role = asks?.q === "exists" ? "testigo" : "contraejemplo";
  const w = asks ? checkWitness(asks, set, witness) : null;
  const solved = choice === value && (w === null || w.ok);
  let message: string;
  if (choice === null) message = "Elige Verdadero o Falso.";
  else if (choice !== value) {
    const rule =
      statement.kind === "nested"
        ? "Revisa cada x de A por separado y, para cada uno, los y de A."
        : statement.q === "exists"
          ? choice
            ? "Revisa los elementos uno a uno."
            : "Un ∃ solo es falso si ningún elemento de A cumple la condición: revísalos todos."
          : choice
            ? "Un ∀ solo es verdadero si todos los elementos de A cumplen la condición: revísalos todos."
            : "Revisa los elementos uno a uno.";
    message = `No es eso. ${w && witness.trim() !== "" ? `${w.message} ` : ""}${rule}`;
  } else if (w && !w.ok) message = `El valor es correcto, pero falta un ${role} válido. ${w.message}`;
  else message = w ? w.message : conclusion(statement, set);
  const reset = () => setChecked(false);
  return (
    <div className="flex flex-col gap-3">
      <YesNo legend={legend} labels={["Verdadero", "Falso"]} value={choice} onChange={(v) => (setChoice(v), reset())} invalid={checked && choice !== null && choice !== value} />
      {asks ? (
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-w`} className="text-[14px] font-semibold">
            {asks.q === "exists" ? "Un testigo: un elemento de A que cumpla la condición" : "Un contraejemplo: un elemento de A que no cumpla la condición"}
          </label>
          <Input
            id={`${id}-w`}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            className={cn("max-w-40 font-mono", checked && w && !w.ok && "border-2 border-crit")}
            aria-invalid={checked && w && !w.ok ? true : undefined}
            value={witness}
            onChange={(e) => (setWitness(e.target.value.slice(0, MAX_WITNESS_TEXT)), reset())}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(true);
            if (solved) onSolved();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={hints} />
      </div>
      {checked ? <Result ok={solved}>{message}</Result> : null}
    </div>
  );
}

/** Tabla de cada elemento con el valor de cada propiedad (o, anidado, los y que cumplen la relación). */
function ElementTable({ statement, set }: { statement: ConcreteStatement; set: number[] }) {
  const vf = (b: boolean) => (b ? "V" : "F");
  if (statement.kind === "nested") {
    const rows = nestedRows(statement, set);
    const rel = relText(statement.rel);
    return (
      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse text-left text-[14px]">
          <caption className="pb-1 text-left">{`Para cada x de A, los y de A con ${rel}`}</caption>
          <thead>
            <tr>
              <th scope="col" className="h-11 border border-border bg-sunken px-2">x</th>
              <th scope="col" className="h-11 border border-border bg-sunken px-2">{`y con ${rel}`}</th>
              <th scope="col" className="h-11 border border-border bg-sunken px-2">{statement.inner === "exists" ? `∃y ∈ A : ${rel}` : `∀y ∈ A, ${rel}`}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.x}>
                <th scope="row" className="h-11 border border-border bg-sunken px-2 font-mono">{numText(r.x)}</th>
                <td className="border border-border px-2 font-mono">{r.ys.length === 0 ? "ninguno" : setText(r.ys)}</td>
                <td className="border border-border px-2 text-center font-mono">{vf(r.ok)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const props = propsOf(statement.body);
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse text-center text-[14px]">
        <caption className="pb-1 text-left">Cada elemento de A con el valor de cada propiedad (V verdadera, F falsa)</caption>
        <thead>
          <tr>
            <th scope="col" className="h-11 border border-border bg-sunken px-2">x</th>
            {props.map((p) => (
              <th key={JSON.stringify(p)} scope="col" className="h-11 border border-border bg-sunken px-2">
                <Tex tex={bodyTex({ kind: "atom", prop: p })} label={spoken(bodyText({ kind: "atom", prop: p }))} />
              </th>
            ))}
            <th scope="col" className="h-11 border border-border bg-sunken px-2">
              <Tex tex={bodyTex(statement.body)} label={spoken(bodyText(statement.body))} />
            </th>
          </tr>
        </thead>
        <tbody>
          {set.map((x) => (
            <tr key={x}>
              <th scope="row" className="h-11 border border-border bg-sunken px-2 font-mono">{numText(x)}</th>
              {props.map((p) => (
                <td key={JSON.stringify(p)} className="border border-border px-2 font-mono">{vf(propHolds(p, x))}</td>
              ))}
              <td className="border border-border px-2 font-mono font-semibold">{vf(bodyHolds(statement.body, x))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Solution({ instance }: { instance: PredConcreteInstance }) {
  const asked = askedStatement(instance);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3 text-[14px]">
      {instance.mode === "negar" ? (
        <ol className="flex flex-col gap-2">
          {negationSteps(instance.statement).map((s, i) => (
            <li key={i} className="flex flex-col gap-1">
              <Tex tex={`${i === 0 ? "" : "\\equiv "}${s.tex}`} label={spoken(s.text)} className="text-[16px]" />
              <span className="text-muted">{s.law}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <ElementTable statement={asked} set={instance.set} />
      <p>{`${instance.mode === "negar" ? "La negación, en A: " : ""}${conclusion(asked, instance.set)}`}</p>
    </div>
  );
}

function ConcreteExercise({ instance, onSolved }: ExerciseViewProps<PredConcreteInstance>) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [negated, setNegated] = useState(false);
  const right = useMemo(() => (instance.mode === "negar" ? instance.options.map((o) => isNegation(instance.statement, o, instance.set)) : []), [instance]);
  const legendLines = nomenclature(instance.statement);
  const setLine = <Tex tex={`A = ${setTex(instance.set)}`} label={`A es el conjunto ${setText(instance.set)}`} className="text-[18px]" />;
  const nomenclatureBlock =
    legendLines.length > 0 ? (
      <ul className="flex flex-col gap-1 text-[14px] text-muted" aria-label="Nomenclatura">
        {legendLines.map((l) => (
          <li key={l} className="font-mono">
            {l}
          </li>
        ))}
      </ul>
    ) : null;
  if (instance.mode === "evaluar") {
    return (
      <>
        <Statement>
          {setLine}
          <p className="text-[14px] text-muted">¿Es verdadero este enunciado en A?</p>
          <Tex display tex={statementTex(instance.statement)} label={spoken(statementText(instance.statement))} className="text-[20px]" />
          {nomenclatureBlock}
        </Statement>
        <PracticeBox title="Tu respuesta">
          <TruthStep statement={instance.statement} set={instance.set} legend="El enunciado es:" hints={concreteHints(instance)} onSolved={onSolved} />
          <SolutionGate resetKey={JSON.stringify(instance)}>
            <Solution instance={instance} />
          </SolutionGate>
        </PracticeBox>
      </>
    );
  }
  const solved = choice !== null && right[Number(choice)] === true;
  return (
    <>
      <Statement>
        {setLine}
        <p className="text-[14px] text-muted">¿Qué enunciado es equivalente a esta negación?</p>
        <Tex display tex={negatedTex(instance.statement)} label={spoken(negatedText(instance.statement))} className="text-[20px]" />
        {nomenclatureBlock}
      </Statement>
      <PracticeBox title="1. La negación">
        <OptionList
          legend="Es equivalente a:"
          options={instance.options.map((o, i) => ({ key: String(i), content: formula(o) }))}
          value={choice}
          onChange={(k) => {
            if (negated) return;
            setChoice(k);
            setChecked(false);
          }}
          invalid={checked && !solved}
        />
        {negated ? null : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setChecked(true);
                if (solved) setNegated(true);
              }}
            >
              <Check size={16} aria-hidden="true" />
              Comprobar
            </Button>
            <Hints hints={concreteHints(instance, "negar")} />
          </div>
        )}
        {checked ? (
          <Result ok={solved}>
            {choice === null ? "Elige una opción." : solved ? "Es la negación: ahora, ¿es verdadera en A?" : `Esa no es la negación. ${negationMistakeText(instance.statement, instance.options[Number(choice)]!)}`}
          </Result>
        ) : null}
      </PracticeBox>
      {negated ? (
        <PracticeBox title="2. ¿Es verdadera en A?">
          <p className="text-[14px]">
            {"La negación: "}
            {formula(correctNegation(instance.statement))}
          </p>
          <TruthStep statement={correctNegation(instance.statement)} set={instance.set} legend="La negación es:" hints={concreteHints(instance, "evaluar")} onSolved={onSolved} />
        </PracticeBox>
      ) : null}
      <SolutionGate resetKey={JSON.stringify(instance)}>
        <Solution instance={instance} />
      </SolutionGate>
    </>
  );
}

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

export const PRED_CONCRETE_EXERCISE_VIEWS: Array<[string, View]> = [entry(PRED_CONCRETE, (p: ExerciseViewProps<PredConcreteInstance>) => <ConcreteExercise key={JSON.stringify(p.instance)} {...p} />)];
