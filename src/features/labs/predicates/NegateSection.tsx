// «Negar paso a paso»: se parte de ¬φ y se lleva la negación hacia dentro, una ley cada vez. La app
// comprueba cada línea: que es equivalente a la anterior en el dominio (todas las interpretaciones de
// los predicados, o una muestra amplia, y la del estudiante) y que sale de aplicar la ley elegida. Al
// llegar a una fórmula con ¬ solo delante de átomos, el ejercicio está terminado. Las pistas nombran la
// ley y dónde se aplica, nunca el resultado.
import { Check, Copy, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  isNegationNormalForm,
  predicateSignature,
  predToPlain,
  predToTex,
  type PredFormula,
} from "../../../../shared/predicates/ast.ts";
import type { PredInterpretation } from "../../../../shared/predicates/evaluate.ts";
import {
  applicableNegationLaws,
  checkNegationStep,
  isNegationLawId,
  NEGATION_LAW_BY_ID,
  NEGATION_LAWS,
  pushNegation,
  type NegationLawId,
} from "../../../../shared/predicates/negation.ts";
import { parsePredicate, type PredParseError } from "../../../../shared/predicates/parser.ts";
import { PREDICADOS_PACK } from "../../../../content/predicados/practica.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { describeDomain, describeInterpretation, PredicateField, truthWord } from "./common.tsx";

/** Una derivación no necesita más: cada ley baja una negación o quita dos. */
export const MAX_NEGATION_LINES = 20;

type Line = { formula: PredFormula; law: NegationLawId | null };
type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;

const lawName = (id: NegationLawId) => NEGATION_LAW_BY_ID[id].name;

function Formula({ f }: { f: PredFormula }) {
  return <Tex tex={predToTex(f)} label={predToPlain(f)} className="text-[18px]" />;
}

export function NegateSection({ interp }: { interp: PredInterpretation }) {
  const [choice, setChoice] = useState<string>(PREDICADOS_PACK.negation[0]!.id);
  const [own, setOwn] = useState("");
  const [ownError, setOwnError] = useState<PredParseError | null>(null);
  const [start, setStart] = useState<PredFormula | null>(null);
  // Cambia con cada «Empezar»: reinicia la derivación aunque la fórmula sea la misma.
  const [begins, setBegins] = useState(0);

  const begin = () => {
    const text = choice === "propia" ? own : PREDICADOS_PACK.negation.find((n) => n.id === choice)!.formula;
    const r = parsePredicate(text);
    if (!r.ok) {
      setOwnError(r.error);
      return;
    }
    setOwnError(null);
    setStart({ kind: "not", arg: r.formula });
    setBegins((b) => b + 1);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <h2 className="font-display text-[20px] font-semibold">Fórmula que hay que negar</h2>
        <label htmlFor="neg-choice" className="text-[14px] font-semibold">
          Elige una de práctica o escribe la tuya
        </label>
        <select
          id="neg-choice"
          className={cn(selectClass, "w-full font-body")}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setOwnError(null);
          }}
        >
          {(["básico", "medio", "avanzado"] as const).map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {PREDICADOS_PACK.negation
                .filter((n) => n.level === level)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.formula}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {choice === "propia" ? (
          <PredicateField
            id="neg-own"
            label="Tu fórmula"
            value={own}
            onChange={(v) => {
              setOwn(v);
              setOwnError(null);
            }}
            error={ownError}
            predicates={["P", "Q", "M"]}
            keypadOpen={false}
          />
        ) : null}
        <Button variant="primary" className="self-start" onClick={begin}>
          {start ? "Empezar con esta fórmula" : "Empezar"}
        </Button>
        <div className="flex flex-col gap-1 text-[14px] text-muted">
          <p className="font-semibold text-fg">Leyes</p>
          <ul className="flex flex-col gap-1">
            {NEGATION_LAWS.map((l) => (
              <li key={l.id}>
                <span className="font-mono">{l.statement}</span>
                {` (${l.name})`}
              </li>
            ))}
          </ul>
          <p>
            {`Cada paso se comprueba en D = ${describeDomain(interp.domain)} (el de «Evaluar en un dominio») con todas las interpretaciones de los predicados, o con una muestra amplia si son demasiadas, y con la tuya. Además, la línea nueva tiene que salir de aplicar la ley elegida (en uno o varios sitios a la vez).`}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {!start ? (
          <p className="text-muted">Elige una fórmula y pulsa «Empezar»: la primera línea será su negación.</p>
        ) : (
          <NegationPractice key={begins} start={start} interp={interp} />
        )}
      </div>
    </div>
  );
}

/**
 * La derivación de «Negar paso a paso» desde ¬φ (`start`): cada línea se comprueba en el dominio de
 * `interp` y con la ley elegida. La usan el laboratorio de predicados y el banco de ejercicios.
 */
export function NegationPractice({
  start,
  interp,
  onSolved,
}: {
  start: PredFormula;
  interp: PredInterpretation;
  /** Se llama al llegar, con pasos correctos, a la forma normal negativa. */
  onSolved?: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => [{ formula: start, law: null }]);
  const [next, setNext] = useState("");
  const [nextError, setNextError] = useState<PredParseError | null>(null);
  const [law, setLaw] = useState<NegationLawId | "">("");
  const [feedback, setFeedback] = useState<Feedback>(() =>
    isNegationNormalForm(start)
      ? { tone: "ok", text: "La negación de una fórmula atómica ya está terminada: no hay ninguna ley que aplicar." }
      : null,
  );
  const [hints, setHints] = useState(0);

  const current = lines[lines.length - 1]!.formula;
  const done = isNegationNormalForm(current);
  const predicates = useMemo(() => {
    const sig = predicateSignature(current);
    return sig.ok ? sig.predicates.map((p) => p.name) : ["P", "Q", "M"];
  }, [current]);

  const addStep = () => {
        setFeedback(null);
    const r = parsePredicate(next);
    if (!r.ok) {
      setNextError(r.error);
      return;
    }
    setNextError(null);
    if (law === "") {
      setFeedback({ tone: "warn", text: "Elige la ley que aplicas en este paso." });
      return;
    }
    if (lines.length >= MAX_NEGATION_LINES) {
      setFeedback({ tone: "warn", text: `La derivación admite como mucho ${MAX_NEGATION_LINES} líneas.` });
      return;
    }
    const c = checkNegationStep(current, r.formula, law, interp.domain, interp);
    if (!c.ok) {
      switch (c.reason) {
        case "arity-conflict":
          setFeedback({ tone: "crit", text: `${c.name} aparece con un número de argumentos distinto del de la línea anterior.` });
          return;
        case "same":
          setFeedback({ tone: "warn", text: "Es la misma fórmula que la línea anterior: aplica una ley." });
          return;
        case "not-equivalent": {
          const d = c.difference;
          const sig = predicateSignature(current, r.formula);
          const preds = sig.ok ? sig.predicates : [];
          const assign = Object.entries(d.assignment).map(([v, e]) => `${v} = ${e}`);
          setFeedback({
            tone: "crit",
            text: `No es equivalente a la línea anterior: en D = ${describeDomain(d.interpretation.domain)} con ${[
              describeInterpretation(d.interpretation, preds),
              ...assign,
            ].join("; ")}, la anterior es ${truthWord(d.left)} y la nueva es ${truthWord(d.right)}.`,
          });
          return;
        }
        case "wrong-law":
          setFeedback({
            tone: "warn",
            text:
              c.suggestions.length > 0
                ? `Es equivalente, pero no sale de aplicar «${lawName(law)}». ¿Quizá es «${c.suggestions.map(lawName).join("» o «")}»?`
                : "Es equivalente, pero no sale de aplicar una sola ley: parece que haces varias cosas a la vez. Sepáralo en pasos.",
          });
          return;
      }
    }
    setLines([...lines, { formula: r.formula, law }]);
    if (c.done) onSolved?.();
    setFeedback(
      c.done
        ? { tone: "ok", text: `Paso correcto: ${lawName(law)}. ¡Terminado! La negación ya solo afecta a fórmulas atómicas.` }
        : { tone: "ok", text: `Paso correcto: ${lawName(law)}.` },
    );
    setNext("");
    setLaw("");
    setHints(0);
  };

  const undo = () => {
    if (lines.length <= 1) return;
    setLines(lines.slice(0, -1));
    setFeedback(null);
    setHints(0);
  };

  const applicable = !done ? applicableNegationLaws(current) : [];
  const first = applicable[0];
  const hintList = first
    ? [
        `Puedes aplicar «${lawName(first.law)}»: ${NEGATION_LAW_BY_ID[first.law].statement}.`,
        `Fíjate en la subfórmula ${predToPlain(first.at)}.`,
        "Escribe la línea entera: copia la anterior y cambia solo la parte a la que aplicas la ley.",
      ]
    : [];

  return (
    <>
      <section aria-labelledby="neg-derivation-title" className="flex flex-col gap-2">
        <h2 id="neg-derivation-title" className="font-display text-[20px] font-semibold">
          Tu derivación
        </h2>
        <ol className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <span className="text-muted">{i === 0 ? "" : "≡"}</span>
              <Formula f={l.formula} />
              {l.law ? (
                <Chip tone="outline" className="font-normal">
                  {lawName(l.law)}
                </Chip>
              ) : (
                <span className="text-[14px] text-muted">(negación de partida)</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {done ? null : (
        <section aria-labelledby="neg-next-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
          <h2 id="neg-next-title" className="font-display text-[20px] font-semibold">
            Siguiente línea
          </h2>
          <PredicateField
            id="neg-next"
            label="Fórmula equivalente"
            value={next}
            onChange={(v) => {
              setNext(v);
              setNextError(null);
            }}
            error={nextError}
            predicates={predicates}
            placeholder="∃x ¬P(x)"
            keypadOpen={false}
          />
          <Button variant="ghost" className="self-start" onClick={() => setNext(predToPlain(current))}>
            <Copy size={16} aria-hidden="true" />
            Copiar la línea anterior
          </Button>
          <label htmlFor="neg-law" className="text-[14px] font-semibold">
            Ley que aplicas
          </label>
          <select
            id="neg-law"
            className={cn(selectClass, "w-full font-body")}
            value={law}
            onChange={(e) => setLaw(isNegationLawId(e.target.value) ? e.target.value : "")}
          >
            <option value="">Elige una ley…</option>
            {NEGATION_LAWS.map((l) => (
              <option key={l.id} value={l.id}>
                {`${l.name}: ${l.statement}`}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={addStep}>
              Comprobar paso
            </Button>
            <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
              <Lightbulb size={16} aria-hidden="true" />
              {hints === 0 ? "Dame una pista" : "Otra pista"}
            </Button>
            <Button variant="ghost" disabled={lines.length <= 1} onClick={undo}>
              <Undo2 size={16} aria-hidden="true" />
              Deshacer el último paso
            </Button>
          </div>
          {hints > 0 ? (
            <ol className="list-decimal pl-6 text-[14px]">
              {hintList.slice(0, hints).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          ) : null}
        </section>
      )}

      {feedback ? (
        <div role="status">
          <Chip tone={feedback.tone} className="whitespace-normal font-normal">
            {feedback.tone === "ok" ? <Check size={16} aria-hidden="true" className="shrink-0" /> : null}
            {feedback.text}
          </Chip>
        </div>
      ) : null}
      {done && lines.length > 1 ? (
        <Button variant="ghost" className="self-start" onClick={() => undo()}>
          <RotateCcw size={16} aria-hidden="true" />
          Volver a la línea anterior
        </Button>
      ) : null}

      <SolutionGate resetKey={predToPlain(start)}>
        <NegationSolution start={start} />
      </SolutionGate>
    </>
  );
}

function NegationSolution({ start }: { start: PredFormula }) {
  const steps = useMemo(() => pushNegation(start), [start]);
  return (
    <ol className="flex flex-col gap-2" aria-label="Derivación de referencia">
      <li className="flex flex-wrap items-center gap-2">
        <Formula f={start} />
      </li>
      {steps.map((s, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <span className="text-muted">≡</span>
          <Formula f={s.formula} />
          <span className="text-[14px] text-muted">{`(${lawName(s.law)})`}</span>
        </li>
      ))}
    </ol>
  );
}
