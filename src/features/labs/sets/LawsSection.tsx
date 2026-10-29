// «Comprobar una igualdad»: dos modos.
// - «Paso a paso»: partes del lado izquierdo de una igualdad y reescribes una ley cada vez, eligiendo
//   cuál. La app comprueba que cada línea es igual a la anterior (por regiones del diagrama de Venn) y
//   que la ley encaja (reescritura, como en el laboratorio de Boole), y avisa al llegar al lado derecho.
// - «¿Son iguales?»: decides si dos expresiones son iguales. Solo después de responder se enseña una
//   región donde difieren (contraejemplo) o se confirma que ocupan las mismas regiones.
import { Check, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SETS_PACK } from "../../../../content/conjuntos/practica.ts";
import {
  compareSetExprs,
  parseSetExpr,
  regionLabel,
  sameSetExpr,
  setToPlain,
  setToTex,
  type SetExpr,
} from "../../../../shared/sets/expr.ts";
import {
  checkSetStep,
  isSetLawId,
  SET_LAW_BY_ID,
  SET_LAWS,
  setApplicableLaws,
  type SetLawId,
} from "../../../../shared/sets/laws.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { HOW_TO_WRITE, SetExprField, Status, Verdict } from "./shared.tsx";
import { VennDiagram } from "./VennDiagram.tsx";

type Mode = "pasos" | "iguales";
type Pair = { left: string; right: string };
const LEVELS = ["básico", "medio", "avanzado"] as const;

const parse = (s: string): SetExpr | null => {
  const r = parseSetExpr(s);
  return r.ok ? r.expr : null;
};
const isEqualPair = (p: Pair) => {
  const l = parse(p.left);
  const r = parse(p.right);
  return l !== null && r !== null && compareSetExprs(l, r).equal;
};
const TRUE_IDENTITIES = SETS_PACK.identities.filter(isEqualPair);

export function LawsSection() {
  const [mode, setMode] = useState<Mode>("pasos");
  // Igualdad que «¿Son iguales?» pasa a «Paso a paso» para demostrarla.
  const [handoff, setHandoff] = useState<Pair | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={mode}
        aria-label="Modo"
        onValueChange={(v) => {
          if (v === "pasos" || v === "iguales") setMode(v);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="pasos">Paso a paso</ToggleGroupItem>
        <ToggleGroupItem value="iguales">¿Son iguales?</ToggleGroupItem>
      </ToggleGroup>
      {mode === "pasos" ? (
        <StepsPractice key={handoff ? `${handoff.left}=${handoff.right}` : "inicio"} initial={handoff} />
      ) : (
        <DecidePractice
          onProve={(p) => {
            setHandoff(p);
            setMode("pasos");
          }}
        />
      )}
      <details className="text-[14px]">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Leyes que puedes usar</summary>
        <ul className="flex flex-col gap-2 pb-2">
          {SET_LAWS.map((l) => (
            <li key={l.id} className="flex flex-col gap-1">
              <span className="font-semibold">{l.name}</span>
              <span className="max-w-full overflow-x-auto">
                <Tex tex={l.tex} label={l.name} />
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- Paso a paso

type Line = { expr: SetExpr; law: SetLawId | null; warning: string | null };
type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;
const MAX_STEPS = 30;

const lawNames = (ids: SetLawId[]) => {
  const names = ids.map((id) => SET_LAW_BY_ID[id].name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
};

function softWarning(law: SetLawId, suggestions: SetLawId[]): string {
  const base = `Es igual, pero no parece ser la ley ${SET_LAW_BY_ID[law].name}`;
  return suggestions.length > 0
    ? `${base}; ¿quizá ${lawNames(suggestions)}?`
    : `${base}. Quizá combinas varias leyes en un paso: prueba a separarlo.`;
}

function StepsPractice({ initial }: { initial: Pair | null }) {
  const [choice, setChoice] = useState<string>(initial ? "propia" : TRUE_IDENTITIES[0]!.id);
  const [ownLeft, setOwnLeft] = useState(initial?.left ?? "");
  const [ownRight, setOwnRight] = useState(initial?.right ?? "");
  const [leftError, setLeftError] = useState<ParseError | null>(null);
  const [rightError, setRightError] = useState<ParseError | null>(null);
  const [start, setStart] = useState<{ left: SetExpr; target: SetExpr | null } | null>(() => {
    const l = initial ? parse(initial.left) : null;
    return l ? { left: l, target: initial ? parse(initial.right) : null } : null;
  });
  // Cambia con cada «Empezar»: reinicia la demostración aunque la igualdad sea la misma.
  const [begins, setBegins] = useState(0);

  const begin = () => {
    const pair: Pair =
      choice === "propia" ? { left: ownLeft, right: ownRight } : TRUE_IDENTITIES.find((p) => p.id === choice)!;
    const l = parseSetExpr(pair.left);
    if (!l.ok) {
      setLeftError(l.error);
      return;
    }
    let t: SetExpr | null = null;
    if (pair.right.trim() !== "") {
      const r = parseSetExpr(pair.right);
      if (!r.ok) {
        setRightError(r.error);
        return;
      }
      t = r.expr;
    }
    setLeftError(null);
    setRightError(null);
    setStart({ left: l.expr, target: t });
    setBegins((b) => b + 1);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <h2 className="font-display text-[20px] font-semibold">Igualdad que demuestras</h2>
        <label htmlFor="laws-choice" className="text-[14px] font-semibold">
          Elige una de práctica o escribe la tuya
        </label>
        <select
          id="laws-choice"
          className={cn(selectClass, "w-full font-body")}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setLeftError(null);
            setRightError(null);
          }}
        >
          {LEVELS.map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {TRUE_IDENTITIES.filter((p) => p.level === level).map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.left} = ${p.right}`}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {choice === "propia" ? (
          <>
            <SetExprField
              id="laws-left"
              label="Lado izquierdo (punto de partida)"
              value={ownLeft}
              onChange={(v) => {
                setOwnLeft(v);
                setLeftError(null);
              }}
              error={leftError}
            />
            <SetExprField
              id="laws-right"
              label="Lado derecho (a donde quieres llegar, opcional)"
              value={ownRight}
              onChange={(v) => {
                setOwnRight(v);
                setRightError(null);
              }}
              error={rightError}
              placeholder="A ∩ B"
            />
          </>
        ) : null}
        <Button variant={start ? "secondary" : "primary"} className="self-start" onClick={begin}>
          {start ? "Empezar con esta igualdad" : "Empezar"}
        </Button>
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo escribir</summary>
          <p className="pb-2 text-muted">{HOW_TO_WRITE}</p>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {!start ? (
          <p className="text-muted">Elige una igualdad y pulsa «Empezar» para escribir tu demostración paso a paso.</p>
        ) : (
          <SetProof key={begins} start={start.left} target={start.target} />
        )}
      </div>
    </div>
  );
}

/**
 * La demostración paso a paso desde `start`: cada línea se comprueba por regiones y con la ley
 * elegida; si hay `target`, avisa al llegar. La usan el laboratorio y el banco de ejercicios.
 */
export function SetProof({
  start,
  target,
  onSolved,
}: {
  start: SetExpr;
  target: SetExpr | null;
  /** Se llama al llegar al lado derecho con un paso correcto. */
  onSolved?: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => [{ expr: start, law: null, warning: null }]);
  const [next, setNext] = useState("");
  const [nextError, setNextError] = useState<ParseError | null>(null);
  const [law, setLaw] = useState<SetLawId | "">("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hint, setHint] = useState<string | null>(null);

  const current = lines[lines.length - 1]!.expr;
  const reached = target !== null && lines.length > 1 && sameSetExpr(current, target);
  const startKey = `${setToPlain(start)}=${target ? setToPlain(target) : ""}`;

  const addStep = () => {
    setHint(null);
    const r = parseSetExpr(next);
    if (!r.ok) {
      setNextError(r.error);
      setFeedback(null);
      return;
    }
    setNextError(null);
    if (law === "") {
      setFeedback({ tone: "warn", text: "Elige la ley que aplicas en este paso." });
      return;
    }
    if (lines.length > MAX_STEPS) {
      setFeedback({ tone: "warn", text: `La derivación admite como mucho ${MAX_STEPS} pasos.` });
      return;
    }
    const c = checkSetStep(current, r.expr, law);
    if (!c.ok) {
      const { label, before } = c.region;
      setFeedback({
        tone: "crit",
        text: `No es igual a la expresión anterior: la región ${label} ${before ? "está en la anterior y no en la nueva" : "está en la nueva y no en la anterior"}.`,
      });
      return;
    }
    const warning = c.lawMatches ? null : softWarning(law, c.suggestions);
    setLines([...lines, { expr: r.expr, law, warning }]);
    if (target !== null && sameSetExpr(r.expr, target)) onSolved?.();
    setFeedback(warning ? { tone: "warn", text: warning } : { tone: "ok", text: `Paso correcto: ${SET_LAW_BY_ID[law].name}.` });
    setNext("");
    setLaw("");
  };

  const showHint = () => {
    const laws = setApplicableLaws(current);
    setHint(
      laws.length === 0
        ? "Ninguna ley cambia directamente esta expresión."
        : `Leyes con alguna instancia aplicable ahora: ${laws.map((id) => SET_LAW_BY_ID[id].name).join(", ")}. No tienes que usarlas todas.`,
    );
  };

  return (
    <>
      {target ? (
        <p className="text-[14px]">
          <span className="text-muted">Objetivo: </span>
          <Tex tex={`${setToTex(lines[0]!.expr)} = ${setToTex(target)}`} label={`${setToPlain(lines[0]!.expr)} = ${setToPlain(target)}`} />
        </p>
      ) : null}
      <section aria-labelledby="sets-derivation-title" className="flex flex-col gap-2">
        <h2 id="sets-derivation-title" className="font-display text-[20px] font-semibold">
          Tu demostración
        </h2>
        <ol className="flex flex-col gap-2" aria-label="Pasos de la demostración">
          {lines.map((line, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-md border border-border bg-raised p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] text-muted">{i === 0 ? "Inicio" : `Paso ${i}`}</span>
                {line.law ? <Chip tone={line.warning ? "warn" : "ok"}>{SET_LAW_BY_ID[line.law].name}</Chip> : null}
              </div>
              <div className="max-w-full overflow-x-auto py-1 text-[18px]">
                {i > 0 ? <span aria-hidden="true">= </span> : null}
                <Tex tex={setToTex(line.expr)} label={`${i === 0 ? "Inicio" : `Paso ${i}`}: ${setToPlain(line.expr)}`} />
              </div>
              {line.warning ? <p className="text-[14px] text-warn">{line.warning}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      {reached ? (
        <Status>
          <Verdict tone="ok">
            <Check size={16} aria-hidden="true" />
            {`¡Igualdad demostrada! Has llegado a ${setToPlain(target!)}.`}
          </Verdict>
        </Status>
      ) : null}

      <section aria-labelledby="sets-next-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
        <h2 id="sets-next-title" className="font-display text-[20px] font-semibold">
          Siguiente paso
        </h2>
        <SetExprField
          id="laws-next"
          label="Nueva expresión"
          value={next}
          onChange={(v) => {
            setNext(v);
            setNextError(null);
          }}
          error={nextError}
          placeholder="A ∩ Bᶜ"
        />
        <label htmlFor="laws-law" className="text-[14px] font-semibold">
          Ley que aplicas
        </label>
        <select
          id="laws-law"
          className={cn(selectClass, "w-full font-body")}
          value={law}
          onChange={(e) => setLaw(isSetLawId(e.target.value) ? e.target.value : "")}
        >
          <option value="">Elige la ley…</option>
          {SET_LAWS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={addStep}>
            <Check size={16} aria-hidden="true" />
            Comprobar paso
          </Button>
          <Button variant="ghost" onClick={showHint}>
            <Lightbulb size={16} aria-hidden="true" />
            Pista
          </Button>
          <Button
            variant="ghost"
            disabled={lines.length <= 1}
            onClick={() => {
              setLines(lines.slice(0, -1));
              setFeedback(null);
              setHint(null);
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            Deshacer último paso
          </Button>
          <Button
            variant="ghost"
            disabled={lines.length <= 1}
            onClick={() => {
              setLines(lines.slice(0, 1));
              setFeedback(null);
              setHint(null);
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Borrar los pasos
          </Button>
        </div>
        <Status>
          {feedback ? (
            <p className={cn(feedback.tone === "ok" ? "text-ok" : feedback.tone === "warn" ? "text-warn" : "text-crit")}>
              {feedback.text}
            </p>
          ) : null}
          {hint ? <p>{hint}</p> : null}
        </Status>
      </section>

      {target ? (
        <SolutionGate resetKey={startKey}>
          <RegionsCheck left={lines[0]!.expr} right={target} />
        </SolutionGate>
      ) : null}
    </>
  );
}

/** Comprobación por regiones de una igualdad: el diagrama de cada lado. */
function RegionsCheck({ left, right }: { left: SetExpr; right: SetExpr }) {
  const cmp = compareSetExprs(left, right);
  const n = cmp.vars.length as 2 | 3;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
      <h3 className="font-display text-[18px] font-semibold">Comprobación por regiones</h3>
      <p className="text-[14px]">
        {cmp.equal
          ? "Los dos lados ocupan exactamente las mismas regiones del diagrama, así que son iguales."
          : `Los dos lados no son iguales: difieren en ${cmp.differ.map((r) => regionLabel(cmp.vars, r)).join("; ")}.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="flex flex-col gap-1">
          <VennDiagram n={n} selected={cmp.left} label={`Lado izquierdo, ${setToPlain(left)}`} />
          <figcaption className="text-center font-mono text-[14px]">{setToPlain(left)}</figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          <VennDiagram n={n} selected={cmp.right} label={`Lado derecho, ${setToPlain(right)}`} />
          <figcaption className="text-center font-mono text-[14px]">{setToPlain(right)}</figcaption>
        </figure>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ¿Son iguales?

function DecidePractice({ onProve }: { onProve: (p: Pair) => void }) {
  const [choice, setChoice] = useState<string>(SETS_PACK.identities[0]!.id);
  const [own, setOwn] = useState<Pair>({ left: "", right: "" });

  const pair: Pair = choice === "propia" ? own : SETS_PACK.identities.find((p) => p.id === choice)!;
  const leftR = useMemo(() => parseSetExpr(pair.left), [pair.left]);
  const rightR = useMemo(() => parseSetExpr(pair.right), [pair.right]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <label htmlFor="decide-choice" className="text-[14px] font-semibold">
          Igualdad
        </label>
        <select
          id="decide-choice"
          className={cn(selectClass, "w-full font-body")}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
          }}
        >
          {LEVELS.map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {SETS_PACK.identities
                .filter((p) => p.level === level)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.left} = ${p.right}`}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="propia">Escribir las mías</option>
        </select>
        {choice === "propia" ? (
          <>
            <SetExprField
              id="decide-left"
              label="Primera expresión"
              value={own.left}
              onChange={(v) => {
                setOwn((o) => ({ ...o, left: v }));
              }}
              error={!leftR.ok && own.left !== "" ? leftR.error : null}
            />
            <SetExprField
              id="decide-right"
              label="Segunda expresión"
              value={own.right}
              onChange={(v) => {
                setOwn((o) => ({ ...o, right: v }));
              }}
              error={!rightR.ok && own.right !== "" ? rightR.error : null}
              placeholder="Aᶜ ∩ Bᶜ"
            />
          </>
        ) : null}
      </div>

      <EqualityQuestion
        key={`${pair.left}|${pair.right}`}
        left={leftR.ok ? leftR.expr : null}
        right={rightR.ok ? rightR.expr : null}
        onProve={() => onProve(pair)}
      />
    </div>
  );
}

/**
 * «¿Son iguales?» para dos expresiones (null si aún no se leen): el contraejemplo o la confirmación
 * solo aparecen después de responder. `onProve` ofrece demostrarla; `onSolved` se llama al acertar.
 */
export function EqualityQuestion({
  left,
  right,
  onProve,
  onSolved,
}: {
  left: SetExpr | null;
  right: SetExpr | null;
  onProve?: () => void;
  onSolved?: () => void;
}) {
  const [claim, setClaim] = useState<"si" | "no" | null>(null);
  const [checked, setChecked] = useState(false);
  const ready = left !== null && right !== null;
  const cmp = ready ? compareSetExprs(left, right) : null;
  const correct = cmp !== null && claim !== null && (claim === "si") === cmp.equal;

  return (
    <section aria-labelledby="decide-title" className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-3 lg:col-span-7">
      <h2 id="decide-title" className="font-display text-[20px] font-semibold">
        ¿Son iguales?
      </h2>
      {ready ? (
        <div className="max-w-full overflow-x-auto py-1 text-[20px]">
          <Tex
            tex={`${setToTex(left)} \\overset{?}{=} ${setToTex(right)}`}
            label={`¿${setToPlain(left)} es igual a ${setToPlain(right)}?`}
          />
        </div>
      ) : (
        <p className="text-muted">Escribe las dos expresiones.</p>
      )}
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-[14px] font-semibold">Tu respuesta</legend>
        {(
          [
            ["si", "Son iguales"],
            ["no", "No son iguales"],
          ] as const
        ).map(([v, text]) => (
          <label key={v} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="decide-claim"
              checked={claim === v}
              onChange={() => {
                setClaim(v);
                setChecked(false);
              }}
            />
            {text}
          </label>
        ))}
      </fieldset>
      <Button
        variant="primary"
        className="self-start"
        disabled={!ready}
        onClick={() => {
          setChecked(true);
          if (correct) onSolved?.();
        }}
      >
        <Check size={16} aria-hidden="true" />
        Comprobar
      </Button>
      {checked && cmp && left && right ? (
        claim === null ? (
          <Status>
            <span>Elige una respuesta.</span>
          </Status>
        ) : (
          <>
            <Status>
              <Verdict tone={correct ? "ok" : "warn"}>
                {correct
                  ? cmp.equal
                    ? "¡Correcto! Son iguales."
                    : "¡Correcto! No son iguales."
                  : cmp.equal
                    ? "No es correcto: sí son iguales."
                    : "No es correcto: no son iguales."}
              </Verdict>
              {cmp.equal ? (
                <span>Ocupan exactamente las mismas regiones del diagrama de Venn.</span>
              ) : (
                <span>
                  {`Contraejemplo: la región ${regionLabel(cmp.vars, cmp.differ[0]!)} está en ${
                    cmp.left[cmp.differ[0]!] ? "la primera expresión y no en la segunda" : "la segunda expresión y no en la primera"
                  }.`}
                </span>
              )}
            </Status>
            {cmp.equal ? (
              onProve ? (
                <Button variant="secondary" className="self-start" onClick={onProve}>
                  Demostrarlo paso a paso
                </Button>
              ) : null
            ) : (
              <VennDiagram
                n={cmp.vars.length as 2 | 3}
                selected={cmp.left.map((_, r) => r === cmp.differ[0])}
                label={`Contraejemplo: región ${regionLabel(cmp.vars, cmp.differ[0]!)}`}
              />
            )}
          </>
        )
      ) : null}
    </section>
  );
}
