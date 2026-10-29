// «Evaluar en un dominio»: un dominio con la extensión de cada predicado, una fórmula y su análisis
// (variables libres y ligadas), la práctica «Comprueba tu respuesta» y la solución completa detrás de
// SolutionGate.
import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  analyzeVariables,
  predicateSignature,
  predToPlain,
  predToTex,
  type PredFormula,
} from "../../../../shared/predicates/ast.ts";
import {
  evaluationSteps,
  predEvaluator,
  sentenceIssues,
  witnesses,
  type PredInterpretation,
  type SentenceIssue,
} from "../../../../shared/predicates/evaluate.ts";
import { parsePredicate } from "../../../../shared/predicates/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { describeDomain, PredicateField, truthLetter, truthWord } from "./common.tsx";
import { DomainEditor, interpretationKey, presetOf, toInterpretation, type DomainState } from "./DomainEditor.tsx";
import { EvalPractice, MAX_EVAL_STEPS, type EvalMode } from "./EvalPractice.tsx";

const DEBOUNCE_MS = 400;

function issueText(i: SentenceIssue): string {
  switch (i.kind) {
    case "empty-domain":
      return "El dominio está vacío.";
    case "arity-conflict":
      return `${i.name} aparece con ${i.arities.join(" y ")} argumentos: cada predicado tiene siempre el mismo número.`;
    case "free-variables":
      return `Tiene ${i.variables.length === 1 ? "la variable libre" : "las variables libres"} ${i.variables.join(", ")}: no es un enunciado y no tiene un valor de verdad fijo. Ciérrala con ∀ o ∃, o cambia la variable por un elemento del dominio.`;
    case "unknown-constant":
      return `${i.name} no es un elemento del dominio: las constantes tienen que ser elementos de D.`;
  }
}

const list = (xs: string[]) => (xs.length === 0 ? "ninguna" : xs.join(", "));

export function EvaluateSection({ domain, onDomain }: { domain: DomainState; onDomain: (s: DomainState) => void }) {
  const preset = presetOf(domain);
  const [text, setText] = useState(() => preset?.formulas[0] ?? "");
  const [settled, setSettled] = useState(text);
  const [mode, setMode] = useState<EvalMode>("pasos");
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const parsed = useMemo(() => parsePredicate(text), [text]);
  const formula = parsed.ok ? parsed.formula : null;
  const empty = text.trim() === "";
  const error = !parsed.ok && !empty && settled === text ? parsed.error : null;

  const interp = useMemo(() => toInterpretation(domain), [domain]);
  const sig = formula ? predicateSignature(formula) : null;
  // Predicados que se pueden editar: los de la fórmula y, si no hay fórmula válida, los del ejemplo.
  const editable = sig?.ok ? sig.predicates : preset ? preset.predicates.map((p) => ({ name: p.name, arity: p.arity })) : [];
  const keyNames = [...new Set([...(preset?.predicates.map((p) => p.name) ?? []), ...editable.map((p) => p.name)])];

  const issues = formula ? sentenceIssues(formula, interp) : [];
  const vars = formula ? analyzeVariables(formula) : null;
  const ready = formula !== null && issues.length === 0;
  const plain = formula ? predToPlain(formula) : "";
  const resetKey = `${plain}|${interpretationKey(domain)}`;

  // Al elegir otro dominio de ejemplo, la fórmula pasa a ser su primer ejemplo.
  const changeDomain = (s: DomainState) => {
    const p = s.presetId !== domain.presetId ? presetOf(s) : null;
    if (p) setText(p.formulas[0]!);
    onDomain(s);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <DomainEditor state={domain} onChange={changeDomain} predicates={editable} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <PredicateField id="pred-formula" label="Fórmula" value={text} onChange={setText} error={error} predicates={keyNames} />
        {preset ? (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-semibold">Fórmulas de ejemplo para este dominio</p>
            <div className="flex flex-wrap gap-2">
              {preset.formulas.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setText(f)}
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-3 font-mono text-[16px] hover:bg-sunken"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2">
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            Cómo se escribe
          </summary>
          <div className="flex flex-col gap-1 pb-2 text-muted">
            <p>Predicados con mayúscula y sus argumentos entre paréntesis: P(x), M(x, y). Variables: u, v, w, x, y, z.</p>
            <p>
              ∀ y ∃ afectan solo a lo que va justo detrás, como ¬: ∀x P(x) ∧ Q(x) es (∀x P(x)) ∧ Q(x). Para abarcar más,
              usa paréntesis: ∀x (P(x) ∧ Q(x)).
            </p>
            <p>Precedencia: ¬, ∀, ∃, después ∧, ∨, → y ↔. También vale escribir forall x, exists y, ~, &amp;, |, -&gt;, &lt;-&gt;.</p>
          </div>
        </details>

        {formula && vars ? (
          <div className="flex flex-col gap-3">
            <Tex display tex={predToTex(formula)} label="Fórmula normalizada" className="text-[20px]" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-[14px]">
              <dt className="font-semibold">Variables ligadas</dt>
              <dd className="font-mono">{list(vars.bound)}</dd>
              <dt className="font-semibold">Variables libres</dt>
              <dd className="font-mono">{list(vars.free)}</dd>
              <dt className="font-semibold">Constantes</dt>
              <dd className="font-mono">{list(vars.constants)}</dd>
            </dl>
            {vars.vacuous.length > 0 ? (
              <Chip tone="info" className="whitespace-normal font-normal">
                {`El cuantificador de ${vars.vacuous.join(", ")} no liga ninguna aparición: no cambia el valor de la fórmula.`}
              </Chip>
            ) : null}
            {issues.length > 0 ? (
              <div role="status" className="flex flex-col items-start gap-1">
                {issues.map((i) => (
                  <Chip key={i.kind} tone="warn" className="whitespace-normal font-normal">
                    {issueText(i)}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : empty ? (
          <p className="text-muted">Escribe una fórmula o elige uno de los ejemplos.</p>
        ) : null}

        {ready && formula ? (
          <>
            <EvalPractice key={resetKey} formula={formula} interp={interp} mode={mode} onMode={setMode} />
            <SolutionGate resetKey={resetKey}>
              <EvalSolution formula={formula} interp={interp} />
            </SolutionGate>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Solución completa: valor, pasos con sus instancias y testigos o contraejemplos (va detrás de SolutionGate). */
export function EvalSolution({ formula: f, interp }: { formula: PredFormula; interp: PredInterpretation }) {
  const formulaText = predToPlain(f);
  const value = predEvaluator(interp)(f);
  const steps = evaluationSteps(f, interp, 200);
  const w = witnesses(f, interp);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-raised p-3">
        <Chip tone={value ? "ok" : "crit"} className="text-[20px] font-semibold leading-[1.2]">
          {value ? "Verdadera" : "Falsa"}
        </Chip>
        <span>{`${formulaText} es ${truthWord(value)} en D = ${describeDomain(interp.domain)}.`}</span>
      </div>
      {steps.ok && steps.steps.length > 0 ? (
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          {steps.steps.map((s) => (
            <li key={s.plain}>
              <span className="font-mono">{`${s.plain}: ${truthLetter(s.value)}`}</span>
              <p className="font-mono text-[14px] text-muted">
                {s.instances.map((i) => `${i.plain} = ${truthLetter(i.value)}`).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      {steps.ok && steps.steps.length > MAX_EVAL_STEPS ? (
        <p className="text-[14px] text-muted">{`Son ${steps.steps.length} pasos: demasiados para practicarlos uno a uno.`}</p>
      ) : null}
      {w && (f.kind === "forall" || f.kind === "exists") ? (
        <p>{`${w.kind === "testigo" ? "Testigos" : "Contraejemplos"} para ${f.variable}: ${w.elements.join(", ")}.`}</p>
      ) : null}
    </div>
  );
}
