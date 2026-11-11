// «Relaciones» (en «Comprobar una igualdad»): una relación entre conjuntos (A ⊆ B, B ∖ A ⊆ A,
// A ∩ C = ∅…), con supuestos si se quiere, y la persona decide si es siempre cierta, nunca cierta o
// depende. Se comprueba por regiones (shared/sets/relations.ts); solo después de responder se enseña,
// si no es siempre cierta, un contraejemplo: un diagrama que cumple los supuestos y en el que falla.
// A × B ⊆ A ∪ B, que sale en los exámenes, va como ejercicio fijo con su explicación.
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { SETS_PACK } from "../../../../content/conjuntos/practica.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import {
  analyzeHypotheses,
  CARTESIAN_RELATION,
  checkRelation,
  forcesNonEmptyAB,
  parseSetHypotheses,
  parseSetRelation,
  relationHolds,
  relationReason,
  relationSpoken,
  relationToPlain,
  relationToTex,
  VERDICT_TEXT,
  worldHas,
  worldPlace,
  worldText,
  type RelationVerdict,
  type SetRelation,
  type VennWorld,
} from "../../../../shared/sets/relations.ts";
import { regionCount, regionLabel, type SetName } from "../../../../shared/sets/expr.ts";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { EmptyLegend } from "./Hypotheses.tsx";
import { HOW_TO_WRITE_RELATIONS, SetExprField, Status, Verdict } from "./shared.tsx";
import { regionOrder } from "./venn-geometry.ts";
import { VennDiagram } from "./VennDiagram.tsx";

const LEVELS = ["básico", "medio", "avanzado"] as const;
const CARTESIAN_ID = "producto-cartesiano";
const CARTESIAN_HYPOTHESES = "∅ ≠ A ⊆ B";

const readHyps = (s: string): SetRelation[] => {
  const r = parseSetHypotheses(s);
  if (!r.ok) throw new Error(`supuestos ilegibles: ${s}`);
  return r.relations;
};

/** «Si ∅ ≠ A ⊆ B: B ∖ A ⊆ A» o, sin supuestos, la relación sola. */
const presetText = (h: string, r: string) => (h.trim() === "" ? r : `Si ${h}: ${r}`);

export function RelationsPractice() {
  const [choice, setChoice] = useState<string>(SETS_PACK.relations[0]!.id);
  const [ownHyps, setOwnHyps] = useState("");
  const [ownRel, setOwnRel] = useState("");

  const preset = SETS_PACK.relations.find((r) => r.id === choice);
  const hypText = choice === "propia" ? ownHyps : choice === CARTESIAN_ID ? CARTESIAN_HYPOTHESES : (preset?.hypotheses ?? "");
  const relText = choice === "propia" ? ownRel : (preset?.relation ?? "");
  const hypR = useMemo(() => parseSetHypotheses(hypText), [hypText]);
  const relR = useMemo(() => parseSetRelation(relText), [relText]);
  const hypError: ParseError | null = choice === "propia" && !hypR.ok ? hypR.error : null;
  const relError: ParseError | null = choice === "propia" && ownRel !== "" && !relR.ok ? relR.error : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="relation-choice" className="text-[14px] font-semibold">
          Relación
        </label>
        <select id="relation-choice" className={cn(selectClass, "w-full font-body")} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {LEVELS.map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {SETS_PACK.relations
                .filter((r) => r.level === level)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {presetText(r.hypotheses, r.relation)}
                  </option>
                ))}
              {level === "medio" ? <option value={CARTESIAN_ID}>{presetText(CARTESIAN_HYPOTHESES, CARTESIAN_RELATION.text)}</option> : null}
            </optgroup>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {choice === "propia" ? (
          <>
            <SetExprField
              id="relation-hypotheses"
              label="Supuestos (opcional, separados por comas)"
              value={ownHyps}
              onChange={setOwnHyps}
              error={hypError}
              placeholder="∅ ≠ A ⊆ B"
            />
            <SetExprField id="relation-own" label="Tu relación" value={ownRel} onChange={setOwnRel} error={relError} placeholder="B ∖ A ⊆ A" />
          </>
        ) : null}
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo escribir relaciones</summary>
          <p className="pb-2 text-muted">{HOW_TO_WRITE_RELATIONS}</p>
        </details>
      </div>
      {choice === CARTESIAN_ID ? (
        <CartesianQuestion key={CARTESIAN_ID} hypotheses={readHyps(CARTESIAN_HYPOTHESES)} />
      ) : (
        <RelationQuestion
          key={`${hypText}|${relText}`}
          hypotheses={hypR.ok ? hypR.relations : null}
          relations={relR.ok ? relR.relations : null}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- La pregunta

const VERDICTS: RelationVerdict[] = ["siempre", "nunca", "depende"];

function Choices({ value, onChange }: { value: RelationVerdict | null; onChange: (v: RelationVerdict) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-3">
      <legend className="mb-1 text-[14px] font-semibold">¿Es cierta?</legend>
      {VERDICTS.map((v) => (
        <label key={v} className="flex min-h-11 items-center gap-2">
          <input type="radio" name="relation-verdict" checked={value === v} onChange={() => onChange(v)} />
          {VERDICT_TEXT[v]}
        </label>
      ))}
    </fieldset>
  );
}

function HypothesesLine({ hypotheses }: { hypotheses: readonly SetRelation[] }) {
  if (hypotheses.length === 0) return <p className="text-[14px] text-muted">Sin supuestos: A, B y C son conjuntos cualesquiera de U.</p>;
  return (
    <p className="max-w-full overflow-x-auto text-[16px]">
      {"Supuestos: "}
      <Tex tex={hypotheses.map(relationToTex).join(",\\; ")} label={hypotheses.map(relationSpoken).join("; ")} />
    </p>
  );
}

/** Un diagrama concreto: regiones con elementos rayadas y vacías por hipótesis con su trama. */
function WorldDiagram({ vars, world, empty, label }: { vars: SetName[]; world: VennWorld; empty: boolean[]; label: string }) {
  const n = vars.length as 2 | 3;
  const selected = Array.from({ length: regionCount(n) }, (_, r) => worldHas(world, r));
  return <VennDiagram n={n} selected={selected} emptyRegions={empty} label={label} />;
}

/**
 * «¿Es cierta?» para una relación (o cadena) bajo unos supuestos (null si aún no se leen). El
 * contraejemplo solo aparece después de responder. `onSolved` se llama al acertar.
 */
export function RelationQuestion({
  hypotheses,
  relations,
  onSolved,
}: {
  hypotheses: readonly SetRelation[] | null;
  relations: readonly SetRelation[] | null;
  onSolved?: () => void;
}) {
  const [answer, setAnswer] = useState<RelationVerdict | null>(null);
  const [checked, setChecked] = useState(false);
  const ready = hypotheses !== null && relations !== null;
  const result = useMemo(() => (ready ? checkRelation(relations, hypotheses) : null), [ready, relations, hypotheses]);
  const analysis = useMemo(
    () => (ready && result ? analyzeHypotheses(hypotheses, result.vars) : null),
    [ready, result, hypotheses],
  );
  const contradiction = result !== null && result.verdict === null;
  const correct = result !== null && answer !== null && answer === result.verdict;
  const plain = relations ? relations.map(relationToPlain).join(" y ") : "";
  const order = result ? regionOrder(result.vars.length as 2 | 3) : [];
  const emptyNames = analysis && result ? order.filter((r) => analysis.empty[r]).map((r) => regionLabel(result.vars, r)) : [];

  // Por qué falla en el contraejemplo: la primera relación de la cadena que no se cumple.
  const why = (w: VennWorld) => {
    const bad = relations!.find((r) => !relationHolds(r, result!.vars, w));
    return bad ? relationReason(bad, result!.vars, w) : "";
  };

  return (
    <section aria-labelledby="relation-title" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3 lg:col-span-7">
      <h2 id="relation-title" className="font-display text-[20px] font-semibold">
        ¿Es siempre cierta?
      </h2>
      {ready ? (
        <>
          <HypothesesLine hypotheses={hypotheses} />
          <div className="max-w-full overflow-x-auto py-1 text-[20px]">
            <Tex tex={relations.map(relationToTex).join(" \\quad\\text{y}\\quad ")} label={relations.map(relationSpoken).join(" y ")} />
          </div>
          {hypotheses.length > 0 && analysis && !contradiction ? (
            <>
              <VennDiagram
                n={result!.vars.length as 2 | 3}
                selected={[]}
                emptyRegions={analysis.empty}
                label="Diagrama de los supuestos"
              />
              <EmptyLegend regions={emptyNames} />
            </>
          ) : null}
        </>
      ) : (
        <p className="text-muted">Escribe la relación (y, si quieres, los supuestos).</p>
      )}
      {contradiction ? (
        <p role="alert" className="text-[14px] text-crit">
          Estos supuestos se contradicen: ningún diagrama los cumple. Cambia alguno.
        </p>
      ) : null}
      <Choices
        value={answer}
        onChange={(v) => {
          setAnswer(v);
          setChecked(false);
        }}
      />
      <Button
        variant="primary"
        className="self-start"
        disabled={!ready || contradiction}
        onClick={() => {
          setChecked(true);
          if (correct) onSolved?.();
        }}
      >
        <Check size={16} aria-hidden="true" />
        Comprobar
      </Button>
      {checked && result && result.verdict ? (
        answer === null ? (
          <Status>
            <span>Elige una respuesta.</span>
          </Status>
        ) : (
          <>
            <Status>
              <Verdict tone={correct ? "ok" : "warn"}>
                {correct ? `¡Correcto! ${VERDICT_TEXT[result.verdict]}.` : `No es correcto: es «${VERDICT_TEXT[result.verdict].toLowerCase()}».`}
              </Verdict>
              <span>
                {result.verdict === "siempre"
                  ? `${plain} se cumple en todos los diagramas que cumplen los supuestos.`
                  : result.verdict === "nunca"
                    ? `${plain} no se cumple en ningún diagrama que cumpla los supuestos.`
                    : `${plain} se cumple en unos diagramas que cumplen los supuestos y en otros no.`}
              </span>
              {result.counterexample !== null ? (
                <span>
                  {`Contraejemplo: si solo hay elementos ${worldPlace(result.vars, result.counterexample, order)}, se cumplen los supuestos y falla porque ${why(result.counterexample)}.`}
                </span>
              ) : null}
              {result.verdict === "depende" && result.example !== null ? (
                <span>{`En cambio, si solo hay elementos ${worldPlace(result.vars, result.example, order)}, sí se cumple.`}</span>
              ) : null}
            </Status>
            {result.counterexample !== null && analysis ? (
              <WorldDiagram
                vars={result.vars}
                world={result.counterexample}
                empty={analysis.empty}
                label={`Contraejemplo: regiones con elementos: ${worldText(result.vars, result.counterexample, order)}`}
              />
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- A × B ⊆ A ∪ B

/** El ejercicio fijo del producto cartesiano: no se decide por regiones, va con su explicación. */
function CartesianQuestion({ hypotheses }: { hypotheses: readonly SetRelation[] }) {
  const [answer, setAnswer] = useState<RelationVerdict | null>(null);
  const [checked, setChecked] = useState(false);
  const verdict: RelationVerdict = forcesNonEmptyAB(hypotheses) ? "nunca" : "depende";
  const correct = answer === verdict;
  return (
    <section aria-labelledby="relation-title" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3 lg:col-span-7">
      <h2 id="relation-title" className="font-display text-[20px] font-semibold">
        ¿Es siempre cierta?
      </h2>
      <HypothesesLine hypotheses={hypotheses} />
      <div className="max-w-full overflow-x-auto py-1 text-[20px]">
        <Tex tex={CARTESIAN_RELATION.tex} label="A por B está contenido en A unión B" />
      </div>
      <p className="text-[14px] text-muted">A × B no se dibuja en el diagrama de Venn de A y B: sus elementos son pares.</p>
      <Choices
        value={answer}
        onChange={(v) => {
          setAnswer(v);
          setChecked(false);
        }}
      />
      <Button variant="primary" className="self-start" onClick={() => setChecked(true)}>
        <Check size={16} aria-hidden="true" />
        Comprobar
      </Button>
      {checked ? (
        <Status>
          {answer === null ? (
            <span>Elige una respuesta.</span>
          ) : (
            <>
              <Verdict tone={correct ? "ok" : "warn"}>
                {correct ? `¡Correcto! ${VERDICT_TEXT[verdict]}.` : `No es correcto: es «${VERDICT_TEXT[verdict].toLowerCase()}».`}
              </Verdict>
              <span>{CARTESIAN_RELATION.explanation}</span>
            </>
          )}
        </Status>
      ) : null}
    </section>
  );
}
