// «¿Qué fórmula es?»: un problema de recuento. En el laboratorio se contesta la guía (¿importa el
// orden?, ¿se repiten?, ¿se usan todos?), se elige el modelo entre las seis fórmulas y se escribe el
// número; «Comprobar» marca lo que está mal sin decir lo correcto. En el banco de ejercicios, solo el
// número («Problema de combinatoria») o solo el modelo entre cuatro opciones («¿Qué modelo es?»).
// Las pistas dicen qué fórmula encaja y por qué, nunca el número (en «¿Qué modelo es?», solo
// preguntas); un número que es el de otro modelo, o el total sin restar, se explica sin dar el bueno.
// La solución, detrás de SolutionGate.
import { Check } from "lucide-react";
import { useState } from "react";
import { equalsInteger, integerText, parseExamNumber } from "../../../../shared/discrete/answer.ts";
import {
  acceptedFormulas,
  countingFormula,
  countModel,
  FORMULA_IDS,
  FORMULAS,
  GUIDE_TEXT,
  guideFor,
  guideFormula,
  modelHints,
  modelQuestionHints,
  substitutedTex,
  substitutedText,
  thirdQuestion,
  type CountingModel,
  type FormulaId,
} from "../../../../shared/discrete/count.ts";
import { isMultiStep, problemAnswer, problemMistake, termModels, termValue, type CombProblemInstance, type CombTerm } from "../../../../shared/exercises/discrete.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { ExamNumberField, Hints, OptionList, PracticeBox, Status, Verdict, YesNo } from "./common.tsx";

export type CountingAsk = "lab" | "number" | "model";

/** Una fórmula como opción: su nombre y su expresión. */
export function FormulaChoice({ id }: { id: FormulaId }) {
  const f = FORMULAS[id];
  return (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <span>{f.name}</span>{" "}
      <Tex tex={f.tex} label={f.spoken} />
    </span>
  );
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function problemHints(p: CombProblemInstance, ask: CountingAsk): string[] {
  // Si lo que se pide es el modelo, las pistas solo preguntan: nombrarlo sería dar la respuesta.
  if (ask === "model") return modelQuestionHints(p.terms[0]!.model);
  if (!isMultiStep(p)) return modelHints(p.terms[0]!.model);
  const names = (t: CombTerm) => termModels(t).map((m) => FORMULAS[countingFormula(m)].name.toLowerCase()).join(" por ");
  return [
    ...(p.terms.some((t) => t.sign < 0) ? ["«Al menos» se cuenta mejor por el complementario: todos los casos posibles menos los que no cumplen la condición."] : []),
    ...(p.terms.some((t) => t.times) ? ["Si el recuento se hace en varias etapas seguidas (primero esto y, por cada forma, aquello), las etapas se multiplican: principio del producto."] : []),
    ...p.terms.map((t, i) => `${t.label ?? (i === 0 ? "Todos los casos" : "Los que no cumplen la condición")}: ${names(t)}.`),
    p.terms.length > 1 ? "Suma o resta cada paso según corresponda." : "Multiplica las etapas.",
  ];
}

/** La solución: cada paso con sus modelos y sus datos sustituidos, y el total. */
export function CountingSolution({ problem }: { problem: CombProblemInstance }) {
  const total = problemAnswer(problem);
  const multi = problem.terms.length > 1;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      {problem.terms.map((t, i) => {
        const ms = termModels(t);
        const label = t.label ?? (multi ? (i === 0 ? "Todos los casos" : "Menos los que no cumplen") : null);
        return (
          <div key={i} className="flex flex-col gap-1">
            <p className="text-[14px] text-muted">{`${label ? `${label}: ` : ""}${ms.map((m) => FORMULAS[countingFormula(m)].name.toLowerCase()).join(" por ")}.`}</p>
            {ms.map((m, j) => (
              <Tex key={j} display tex={`${substitutedTex(m)} = ${countModel(m).toString()}`} label={`${substitutedText(m)} = ${integerText(countModel(m))}`} className="text-[18px]" />
            ))}
            {ms.length > 1 ? <p className="font-mono text-[16px] [overflow-wrap:anywhere]">{`${ms.map((m) => integerText(countModel(m))).join(" · ")} = ${integerText(termValue(t))}`}</p> : null}
          </div>
        );
      })}
      {multi ? (
        <p className="font-mono text-[16px] [overflow-wrap:anywhere]">
          {`${problem.terms.map((t, i) => `${i === 0 ? "" : t.sign < 0 ? " − " : " + "}${integerText(termValue(t))}`).join("")} = ${integerText(total)}`}
        </p>
      ) : null}
      <p className="text-[16px]">
        Respuesta: <span className="font-mono font-semibold [overflow-wrap:anywhere]">{integerText(total)}</span>
      </p>
    </div>
  );
}

export function CountingPractice({
  problem,
  ask,
  options,
  title = "Tu respuesta",
  onSolved,
}: {
  problem: CombProblemInstance;
  ask: CountingAsk;
  /** Las cuatro fórmulas entre las que se elige (solo con ask = "model"). */
  options?: readonly FormulaId[];
  title?: string;
  onSolved?: () => void;
}) {
  const model: CountingModel = problem.terms[0]!.model;
  const accepted = acceptedFormulas(model);
  const [order, setOrder] = useState<boolean | null>(null);
  const [repetition, setRepetition] = useState<boolean | null>(null);
  const [third, setThird] = useState<boolean | null>(null);
  const [formula, setFormula] = useState<FormulaId | null>(null);
  const [number, setNumber] = useState("");
  const [checked, setChecked] = useState(false);

  const touch = () => setChecked(false);
  const askModel = ask !== "number";
  const askNumber = ask !== "model";
  const thirdQ = thirdQuestion(order, repetition);
  const guide = guideFor(model);
  const guided = guideFormula({ order, repetition, third: thirdQ ? third : null });

  const parsed = number.trim() === "" ? null : parseExamNumber(number);
  const numberOk = parsed?.ok === true && equalsInteger(parsed.value, problemAnswer(problem));
  // Un número entero equivocado que coincide con un error típico (otro modelo, el total sin restar…).
  const mistake = askNumber && parsed?.ok === true && !numberOk && parsed.value.units % 10n ** BigInt(parsed.value.scale) === 0n ? problemMistake(problem, parsed.value.units / 10n ** BigInt(parsed.value.scale)) : null;
  const modelOk = formula !== null && accepted.includes(formula);
  // La guía solo se corrige en lo que se ha contestado (es una ayuda, no una pregunta obligatoria).
  const orderBad = ask === "lab" && order !== null && order !== guide.order;
  const repBad = ask === "lab" && repetition !== null && repetition !== guide.repetition;
  const thirdBad = ask === "lab" && thirdQ !== null && third !== null && !orderBad && !repBad && third !== guide.third;
  const parts = [...(askModel ? [modelOk] : []), ...(askNumber ? [numberOk] : [])];
  const solved = parts.every(Boolean);

  const formulaChoices = (ask === "model" && options ? options : FORMULA_IDS).map((id) => ({ key: id, content: <FormulaChoice id={id} /> }));

  return (
    <PracticeBox title={title}>
      {ask === "lab" ? (
        <details className="rounded-md border border-border p-2" open>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Guía para decidir</summary>
          <div className="flex flex-col gap-2">
            <YesNo legend={GUIDE_TEXT.order} value={order} onChange={(v) => (setOrder(v), setThird(null), touch())} invalid={checked && orderBad} />
            <YesNo legend={GUIDE_TEXT.repetition} value={repetition} onChange={(v) => (setRepetition(v), setThird(null), touch())} invalid={checked && repBad} />
            {thirdQ ? <YesNo legend={GUIDE_TEXT[thirdQ]} value={third} onChange={(v) => (setThird(v), touch())} invalid={checked && thirdBad} /> : null}
            {guided ? (
              <p className="text-[14px]" aria-live="polite">
                {"Con tus respuestas, la guía lleva a: "}
                <FormulaChoice id={guided} />
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
      {askModel ? (
        <OptionList
          legend={ask === "model" ? "¿Qué fórmula cuenta lo que pide el enunciado?" : "Modelo"}
          options={formulaChoices}
          value={formula}
          onChange={(k) => (setFormula(k as FormulaId), touch())}
          invalid={checked && !modelOk && formula !== null}
          letters={ask === "model"}
        />
      ) : null}
      {askNumber ? <ExamNumberField label="Resultado" value={number} onChange={(v) => (setNumber(v), touch())} invalid={checked && !numberOk && parsed !== null} checked={checked} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            setChecked(true);
            if (solved) onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={problemHints(problem, ask)} />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              {ask === "model" ? "¡Correcto! Ese es el modelo." : ask === "number" ? "¡Correcto!" : "¡Correcto! Modelo y resultado bien."}
            </Verdict>
          ) : (
            <>
              <Verdict tone="warn">
                {parts.length > 1 ? `${parts.filter(Boolean).length} de ${parts.length} bien. Revisa lo marcado.` : askModel ? "Ese no es el modelo." : "Ese no es el resultado."}
              </Verdict>
              {askModel && formula !== null && !modelOk ? <span>{`Las ${FORMULAS[formula].name.toLowerCase()} se usan cuando ${lowerFirst(FORMULAS[formula].when)} ¿Pasa eso en este enunciado?`}</span> : null}
              {askModel && formula === null ? <span>Elige un modelo.</span> : null}
              {askNumber && parsed === null ? <span>Escribe el resultado.</span> : null}
              {mistake ? <span>{mistake}</span> : null}
              {orderBad || repBad || thirdBad ? <span>Alguna respuesta de la guía no encaja con el enunciado (está marcada).</span> : null}
            </>
          )}
        </Status>
      ) : null}
      <SolutionGate resetKey={problem.text}>
        <CountingSolution problem={problem} />
      </SolutionGate>
    </PracticeBox>
  );
}
