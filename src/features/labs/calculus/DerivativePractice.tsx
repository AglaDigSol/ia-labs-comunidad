// «Derivadas paso a paso»: partes de f′(x) = (f(x))′ y escribes la derivación línea a línea, eligiendo
// la regla de cada paso. La app comprueba que cada línea sigue valiendo f′ (en muchos puntos) y que
// la regla elegida es la que encaja con las derivadas que has hecho; si no, avisa, pero sin decir el
// resultado. «Solo el resultado» comprueba f′ directamente. La derivación completa, con la regla de
// cada paso, queda detrás de «Ver la solución completa».
import { Check, ClipboardCopy, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { derivativeRaw, RULE_BY_ID, RULE_PHRASE, RULES, type RuleId } from "../../../../shared/calculus/derive.ts";
import { equivalent } from "../../../../shared/calculus/equivalence.ts";
import { toPlain, toSpoken, toTex, type Expr } from "../../../../shared/calculus/expr.ts";
import { checkDerivStep, derivationSteps, nextRuleHints, SIMPLIFY_LABEL, stepRuleName, type StepRule } from "../../../../shared/calculus/steps.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { FnTex, FunctionField, Hints, HowToWrite, PracticeBox, readFunction, Status, Verdict } from "./common.tsx";

export type DerivMode = "pasos" | "resultado";
export const MAX_DERIV_STEPS = 20;

type Line = { expr: Expr; rule: StepRule | null; warning: string | null };
type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;

const isStepRule = (x: string): x is StepRule => x === "simplificar" || RULES.some((r) => r.id === x);
/** «la regla de la suma», «el factor constante o las derivadas elementales» (con su artículo). */
const ruleList = (ids: readonly RuleId[], last: "o" | "y" = "o") => {
  const names = ids.map((id) => RULE_PHRASE[id]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} ${last} ${names[names.length - 1]}`;
};

/** Las reglas que salen en la derivación de f (para la pista de «Solo el resultado»). */
function rulesUsed(f: Expr): RuleId[] {
  const out: RuleId[] = [];
  for (const s of derivationSteps(f)) if (s.rule !== "simplificar" && !out.includes(s.rule)) out.push(s.rule);
  return out;
}

/** Una línea de la derivación en KaTeX. */
function LineTex({ e, first }: { e: Expr; first: boolean }) {
  return (
    <div className="max-w-full overflow-x-auto py-1 text-[18px]">
      <Tex tex={`${first ? "f'(x)" : ""} = ${toTex(e)}`} label={`${first ? "f prima de x " : ""}igual a ${toSpoken(e)}`} />
    </div>
  );
}

export function DerivativeSolution({ f }: { f: Expr }) {
  const steps = useMemo(() => derivationSteps(f), [f]);
  return (
    <ol className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3" aria-label="Derivación completa">
      <li>
        <LineTex e={{ k: "d", a: f, v: "x" }} first />
      </li>
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col gap-1">
          <span className="text-[14px] text-muted">
            {s.rule === "simplificar" ? SIMPLIFY_LABEL : `${RULE_BY_ID[s.rule].name}${s.on ? " en " : ""}`}
            {s.on ? <Tex tex={`\\left(${toTex(s.on)}\\right)'`} label={`la derivada de ${toSpoken(s.on)}`} /> : null}
          </span>
          <LineTex e={s.line} first={false} />
        </li>
      ))}
    </ol>
  );
}

export function DerivativePractice({ f, initialMode = "pasos", onSolved }: { f: Expr; initialMode?: DerivMode; onSolved?: () => void }) {
  const [mode, setMode] = useState<DerivMode>(initialMode);
  return (
    <PracticeBox title="Deriva">
      <FnTex e={f} lhs="f(x)" display className="text-[20px]" />
      <ToggleGroup
        type="single"
        value={mode}
        aria-label="Cómo quieres derivar"
        className="grid max-w-full grid-cols-2 self-start sm:inline-flex"
        onValueChange={(v) => {
          if (v === "pasos" || v === "resultado") setMode(v);
        }}
      >
        <ToggleGroupItem value="pasos">Paso a paso</ToggleGroupItem>
        <ToggleGroupItem value="resultado">Solo el resultado</ToggleGroupItem>
      </ToggleGroup>
      {mode === "pasos" ? <StepByStep f={f} onSolved={onSolved} /> : <ResultOnly f={f} onSolved={onSolved} />}
      <SolutionGate resetKey={toPlain(f)}>
        <DerivativeSolution f={f} />
      </SolutionGate>
    </PracticeBox>
  );
}

function ResultOnly({ f, onSolved }: { f: Expr; onSolved?: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const parsed = readFunction(text);
  const target = useMemo(() => derivativeRaw(f), [f]);
  const verdict = checked && parsed.ok ? equivalent(parsed.expr, target).kind : null;
  return (
    <div className="flex flex-col gap-3">
      <FunctionField
        id={`${id}-d`}
        label="f′(x) ="
        value={text}
        onChange={(v) => {
          setText(v);
          setChecked(false);
        }}
        invalid={verdict === "different"}
      />
      <HowToWrite />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!parsed.ok}
          onClick={() => {
            setChecked(true);
            if (parsed.ok && equivalent(parsed.expr, target).kind === "equal") onSolved?.();
          }}
        >
          <Check size={16} aria-hidden="true" />
          Comprobar
        </Button>
        <Hints hints={[`Reglas que vas a necesitar: ${ruleList(rulesUsed(f), "y")}.`, ...rulesUsed(f).map((r) => `${RULE_BY_ID[r].name}: ${RULE_BY_ID[r].formula}`)]} />
      </div>
      {verdict ? (
        <Status>
          {verdict === "equal" ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto! Esa es f′(x).
            </Verdict>
          ) : verdict === "different" ? (
            <Verdict tone="warn">No es f′(x): lo he comprobado en varios puntos. Revisa cada regla, o hazlo paso a paso.</Verdict>
          ) : (
            <Verdict tone="warn">No lo puedo comprobar: tu expresión no está definida en casi ningún punto.</Verdict>
          )}
        </Status>
      ) : null}
    </div>
  );
}

function StepByStep({ f, onSolved }: { f: Expr; onSolved?: () => void }) {
  const id = useId();
  const start: Expr = useMemo(() => ({ k: "d", a: f, v: "x" }), [f]);
  const [lines, setLines] = useState<Line[]>([{ expr: start, rule: null, warning: null }]);
  const [lastF, setLastF] = useState(f);
  if (lastF !== f) {
    setLastF(f);
    setLines([{ expr: start, rule: null, warning: null }]);
  }
  const [next, setNext] = useState("");
  const [rule, setRule] = useState<StepRule | "">("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hint, setHint] = useState<string[] | null>(null);
  const current = lines[lines.length - 1]!.expr;

  const addStep = () => {
    setHint(null);
    const r = readFunction(next, { allowPrime: true });
    if (!r.ok) return setFeedback({ tone: "crit", text: r.error.message });
    if (rule === "") return setFeedback({ tone: "warn", text: "Elige la regla que aplicas en este paso." });
    if (lines.length > MAX_DERIV_STEPS) return setFeedback({ tone: "warn", text: `La derivación admite como mucho ${MAX_DERIV_STEPS} pasos.` });
    const c = checkDerivStep(f, current, r.expr, rule);
    if (!c.ok) {
      setFeedback(
        c.reason === "unknown"
          ? { tone: "warn", text: "No puedo comprobar esta línea: no está definida en casi ningún punto." }
          : {
              tone: "crit",
              text:
                rule === "simplificar"
                  ? "Esta línea ya no vale lo mismo que la anterior: revisa las cuentas."
                  : `Esta línea ya no vale lo mismo que la anterior. Repasa la regla: ${RULE_BY_ID[rule].formula}.`,
            },
      );
      return;
    }
    let warning: string | null = null;
    let text: string;
    if (c.applied.length === 0 && rule !== "simplificar") {
      warning = `Es equivalente, pero no has hecho ninguna derivada: si solo operas, elige «${SIMPLIFY_LABEL}».`;
      text = warning;
    } else if (!c.ruleFits) {
      warning =
        rule === "simplificar"
          ? `Es equivalente, pero en este paso también derivas: eso es ${ruleList(c.suggestions)}.`
          : `Es equivalente, pero no parece que hayas aplicado ${RULE_PHRASE[rule]}; ¿quizá ${ruleList(c.suggestions)}?`;
      text = warning;
    } else if (c.alsoApplied.length > 0) {
      warning = `Correcto, aunque en este paso también aplicas ${ruleList(c.alsoApplied)}: mejor una regla por paso.`;
      text = warning;
    } else text = `Paso correcto: ${stepRuleName(rule)}.`;
    if (c.done) {
      text += " Ya no quedan derivadas por hacer: esa es f′(x).";
      onSolved?.();
    }
    setLines([...lines, { expr: r.expr, rule, warning }]);
    setFeedback({ tone: warning ? "warn" : "ok", text });
    setNext("");
    setRule("");
  };

  const showHint = () => {
    setFeedback(null);
    const hs = nextRuleHints(current);
    setHint(
      hs.length === 0
        ? ["Ya no quedan derivadas por hacer. Si quieres, opera y simplifica."]
        : [
            "En la línea anterior quedan estas derivadas por hacer:",
            ...hs.map((h) => `(${toPlain(h.arg)})′: ${RULE_BY_ID[h.rule].name.toLowerCase()}, ${RULE_BY_ID[h.rule].formula}`),
          ],
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
        <h3 id={`${id}-title`} className="font-display text-[18px] font-semibold">
          Tu derivación
        </h3>
        <ol className="flex flex-col gap-2" aria-label="Pasos de la derivación">
          {lines.map((line, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-md border border-border bg-raised p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] text-muted">{i === 0 ? "Inicio" : `Paso ${i}`}</span>
                {line.rule ? <Chip tone={line.warning ? "warn" : "ok"}>{stepRuleName(line.rule)}</Chip> : null}
              </div>
              <LineTex e={line.expr} first={i === 0} />
              {line.warning ? <p className="text-[14px] text-warn">{line.warning}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={`${id}-next`} className="flex flex-col gap-3 rounded-lg border border-border bg-sunken/40 p-3">
        <h3 id={`${id}-next`} className="font-display text-[18px] font-semibold">
          Siguiente línea
        </h3>
        <p className="text-[14px] text-muted">
          Parte de la línea anterior y cambia solo lo que hace la regla. Lo que queda por derivar se escribe con prima: (x^2)′ o (sen(x))′.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            setNext(toPlain(current));
            setFeedback(null);
          }}
        >
          <ClipboardCopy size={16} aria-hidden="true" />
          Copiar la línea anterior
        </Button>
        <FunctionField
          id={`${id}-line`}
          label="= (nueva línea)"
          value={next}
          allowPrime
          onChange={(v) => {
            setNext(v);
            setFeedback(null);
          }}
        />
        <label htmlFor={`${id}-rule`} className="text-[14px] font-semibold">
          Regla que aplicas
        </label>
        <select
          id={`${id}-rule`}
          className={cn(selectClass, "w-full font-body")}
          value={rule}
          onChange={(e) => setRule(isStepRule(e.target.value) ? e.target.value : "")}
        >
          <option value="">Elige la regla…</option>
          {RULES.map((r) => (
            <option key={r.id} value={r.id}>
              {`${r.name}: ${r.formula}`}
            </option>
          ))}
          <option value="simplificar">{SIMPLIFY_LABEL}</option>
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
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            Deshacer
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
            Empezar de nuevo
          </Button>
        </div>
        <HowToWrite extra="En los pasos, (u)′ es la derivada de u que aún no has hecho." />
        {feedback || hint ? (
          <Status>
            {feedback ? <Verdict tone={feedback.tone}>{feedback.text}</Verdict> : null}
            {hint ? (
              <ul className="list-disc pl-6">
                {hint.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
          </Status>
        ) : null}
      </section>
    </div>
  );
}

