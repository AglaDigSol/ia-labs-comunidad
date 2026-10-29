// «Traducir»: una frase en castellano y un glosario de predicados; el estudiante escribe la fórmula y
// la app la compara con una traducción de referencia en dominios pequeños (de 1 a 4 elementos, todas
// las interpretaciones o una muestra). No es una demostración de equivalencia y solo va en un sentido
// (de la frase a la fórmula). La traducción de referencia queda detrás de SolutionGate.
import { Check, Lightbulb } from "lucide-react";
import { useState } from "react";
import { analyzeVariables, predicateSignature, predToPlain, predToTex } from "../../../../shared/predicates/ast.ts";
import { findPredDifference } from "../../../../shared/predicates/equivalence.ts";
import { parsePredicate, type PredParseError } from "../../../../shared/predicates/parser.ts";
import { PREDICADOS_PACK } from "../../../../content/predicados/practica.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { describeDomain, describeInterpretation, PredicateField, truthWord } from "./common.tsx";

/** Dominios en los que se compara: todos los tamaños de 1 a 4. */
export const TRANSLATION_DOMAINS = [["1"], ["1", "2"], ["1", "2", "3"], ["1", "2", "3", "4"]];

type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;

export function TranslateSection() {
  const [id, setId] = useState(PREDICADOS_PACK.translation[0]!.id);
  const ex = PREDICADOS_PACK.translation.find((t) => t.id === id)!;
  const [text, setText] = useState("");
  const [error, setError] = useState<PredParseError | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hint, setHint] = useState(false);

  const choose = (next: string) => {
    setId(next);
    setText("");
    setError(null);
    setFeedback(null);
    setHint(false);
  };

  const check = () => {
    setFeedback(null);
    const r = parsePredicate(text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    const mine = r.formula;
    const sig = predicateSignature(mine);
    if (!sig.ok) {
      setFeedback({ tone: "crit", text: `${sig.name} aparece con distinto número de argumentos.` });
      return;
    }
    for (const p of sig.predicates) {
      const g = ex.glossary.find((x) => x.name === p.name);
      if (!g) {
        setFeedback({ tone: "warn", text: `Usa solo los predicados del glosario: ${ex.glossary.map((x) => x.name).join(", ")}.` });
        return;
      }
      if (g.arity !== p.arity) {
        setFeedback({ tone: "warn", text: `${p.name} lleva ${g.arity} ${g.arity === 1 ? "argumento" : "argumentos"}.` });
        return;
      }
    }
    const vars = analyzeVariables(mine);
    if (vars.free.length > 0) {
      setFeedback({
        tone: "warn",
        text: `Tu fórmula tiene ${vars.free.length === 1 ? "la variable libre" : "las variables libres"} ${vars.free.join(", ")}: falta cuantificarla.`,
      });
      return;
    }
    if (vars.constants.length > 0) {
      setFeedback({ tone: "warn", text: "La frase no habla de ningún elemento concreto: no hace falta usar constantes." });
      return;
    }
    const ref = parsePredicate(ex.answer);
    if (!ref.ok) return;
    const d = findPredDifference(ref.formula, mine, TRANSLATION_DOMAINS);
    if (!d) {
      setFeedback({
        tone: "ok",
        text: "¡Bien! Tu fórmula dice lo mismo que la traducción de referencia en todos los dominios probados (de 1 a 4 elementos).",
      });
      return;
    }
    const preds = ex.glossary.map((g) => ({ name: g.name, arity: g.arity }));
    setFeedback({
      tone: "crit",
      text: `No dice lo mismo que la frase: en D = ${describeDomain(d.interpretation.domain)} con ${describeInterpretation(d.interpretation, preds)}, la frase es ${truthWord(d.left)} y tu fórmula es ${truthWord(d.right)}.`,
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="tr-choice" className="text-[14px] font-semibold">
          Frase
        </label>
        <select id="tr-choice" className={cn(selectClass, "w-full font-body")} value={id} onChange={(e) => choose(e.target.value)}>
          {(["básico", "medio", "avanzado"] as const).map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {PREDICADOS_PACK.translation
                .filter((t) => t.level === level)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.sentence}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p className="text-[14px] text-muted">
          La comprobación compara tu fórmula con una traducción de referencia en dominios de 1 a 4 elementos, con todas las
          interpretaciones de los predicados o con una muestra amplia. Si coinciden en todos, es muy probable que digan lo
          mismo, pero no es una demostración. Solo se traduce de la frase a la fórmula.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <blockquote className="rounded-lg border-l-4 border-accent bg-raised p-3 text-[18px]">{ex.sentence}</blockquote>
        <div>
          <p className="text-[14px] font-semibold">Glosario</p>
          <ul className="text-[14px]">
            {ex.glossary.map((g) => (
              <li key={g.name}>
                <span className="font-mono">{g.arity === 1 ? `${g.name}(x)` : `${g.name}(x, y)`}</span>
                {`: ${g.meaning}`}
              </li>
            ))}
          </ul>
        </div>
        <PredicateField
          id="tr-formula"
          label="Tu traducción"
          value={text}
          onChange={(v) => {
            setText(v);
            setError(null);
            setFeedback(null);
          }}
          error={error}
          predicates={ex.glossary.map((g) => g.name)}
          keypadOpen={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={check}>
            Comprobar
          </Button>
          <Button variant="ghost" disabled={hint} onClick={() => setHint(true)}>
            <Lightbulb size={16} aria-hidden="true" />
            Dame una pista
          </Button>
        </div>
        {hint ? <p className="text-[14px]">{ex.hint}</p> : null}
        {feedback ? (
          <div role="status">
            <Chip tone={feedback.tone} className="whitespace-normal font-normal">
              {feedback.tone === "ok" ? <Check size={16} aria-hidden="true" className="shrink-0" /> : null}
              {feedback.text}
            </Chip>
          </div>
        ) : null}
        <SolutionGate resetKey={ex.id}>
          <TranslationSolution answer={ex.answer} />
        </SolutionGate>
      </div>
    </div>
  );
}

function TranslationSolution({ answer }: { answer: string }) {
  const r = parsePredicate(answer);
  if (!r.ok) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-semibold">Una traducción posible</p>
      <Tex display tex={predToTex(r.formula)} label={predToPlain(r.formula)} className="text-[20px]" />
      <p className="text-[14px] text-muted">Hay otras equivalentes: la comprobación las acepta.</p>
    </div>
  );
}
