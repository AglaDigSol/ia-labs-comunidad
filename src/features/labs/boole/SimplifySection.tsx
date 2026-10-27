// «Simplificar paso a paso»: partes de una expresión y escribes la derivación línea a línea, eligiendo
// la ley de cada paso. La app comprueba que cada paso es equivalente (tabla de verdad) y que la ley
// encaja (reescritura sobre el árbol); al terminar, compara con la forma mínima sin enseñarla.
import { Check, Flag, Keyboard, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  booleToPlain,
  booleToTex,
  booleVars,
  literalCount,
  parseBoole,
  type BExpr,
} from "../../../../shared/boole/expr.ts";
import { LAW_BY_ID, LAWS, isLawId, type LawId } from "../../../../shared/boole/laws.ts";
import { minimizeBoole } from "../../../../shared/boole/minimize.ts";
import { applicableLaws, checkStep } from "../../../../shared/boole/rewrite.ts";
import { MAX_VARIABLES } from "../../../../shared/logic/truth-table.ts";
import type { ParseError } from "../../../../shared/logic/parser.ts";
import { BOOLE_PACK } from "../../../../content/boole/practica.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { FormulaField, SymbolKeypad, type KeypadKey } from "../logic/FormulaInput.tsx";
import { selectClass } from "./AxiomPractice.tsx";
import { MAX_EXPR, MAX_STEPS, type SavedStep } from "./boole-storage.ts";

const BOOLE_KEYS: KeypadKey[] = [
  { glyph: "⊕", label: "suma" },
  { glyph: "⊙", label: "producto" },
  { glyph: "′", label: "complemento" },
  { glyph: "0", label: "cero" },
  { glyph: "1", label: "uno" },
  { glyph: "(", label: "abrir paréntesis" },
  { glyph: ")", label: "cerrar paréntesis" },
];
const BOOLE_VARS = ["x", "y", "z", "w"];

type Line = { expr: BExpr; law: LawId | null; warning: string | null };

const lawNames = (ids: LawId[]) => {
  const names = ids.map((id) => LAW_BY_ID[id].name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
};

function softWarning(law: LawId, suggestions: LawId[]): string {
  const base = `Equivalente, pero no parece ser la ley ${LAW_BY_ID[law].name}`;
  return suggestions.length > 0
    ? `${base}; ¿quizá ${lawNames(suggestions)}?`
    : `${base}. Quizá combinas varias leyes en un paso: prueba a separarlo.`;
}

/** Reconstruye la derivación guardada; se corta en el primer paso que ya no es válido. */
function rebuild(start: string | null, steps: SavedStep[]): Line[] | null {
  if (start === null) return null;
  const s = parseBoole(start);
  if (!s.ok) return null;
  const lines: Line[] = [{ expr: s.expr, law: null, warning: null }];
  for (const st of steps) {
    const p = parseBoole(st.expr);
    if (!p.ok) break;
    const r = checkStep(lines[lines.length - 1]!.expr, p.expr, st.law);
    if (!r.ok) break;
    lines.push({ expr: p.expr, law: st.law, warning: r.lawMatches ? null : softWarning(st.law, r.suggestions) });
  }
  return lines;
}

type Feedback = { tone: "ok" | "warn" | "crit"; text: string } | null;

export function SimplifySection({
  start,
  steps,
  onChange,
}: {
  start: string | null;
  steps: SavedStep[];
  onChange: (start: string | null, steps: SavedStep[]) => void;
}) {
  const lines = useMemo(() => rebuild(start, steps), [start, steps]);
  const [choice, setChoice] = useState<string>(BOOLE_PACK.practice[0]!.id);
  const [own, setOwn] = useState("");
  const [ownError, setOwnError] = useState<ParseError | null>(null);
  const [next, setNext] = useState("");
  const [nextError, setNextError] = useState<ParseError | null>(null);
  const [law, setLaw] = useState<LawId | "">("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [finish, setFinish] = useState<Feedback>(null);
  const [keypad, setKeypad] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);

  const current = lines ? lines[lines.length - 1]!.expr : null;
  const clearMessages = () => {
    setFeedback(null);
    setHint(null);
    setFinish(null);
  };

  const begin = () => {
    const text = choice === "propia" ? own : BOOLE_PACK.practice.find((p) => p.id === choice)!.expr;
    const r = parseBoole(text);
    if (!r.ok) {
      setOwnError(r.error);
      return;
    }
    const vars = booleVars(r.expr).length;
    if (vars > MAX_VARIABLES || text.length > MAX_EXPR) {
      setOwnError({ code: "too-long", start: 0, end: text.length, message: `Usa como mucho ${MAX_VARIABLES} variables y ${MAX_EXPR} caracteres.` });
      return;
    }
    setOwnError(null);
    clearMessages();
    setNext("");
    setLaw("");
    onChange(text, []);
  };

  const addStep = () => {
    if (!lines || !current || start === null) return;
    clearMessages();
    if (next.length > MAX_EXPR) {
      setNextError({ code: "too-long", start: MAX_EXPR, end: next.length, message: `Como mucho ${MAX_EXPR} caracteres.` });
      return;
    }
    const r = parseBoole(next);
    if (!r.ok) {
      setNextError(r.error);
      return;
    }
    setNextError(null);
    if (law === "") {
      setFeedback({ tone: "warn", text: "Elige la ley que aplicas en este paso." });
      return;
    }
    if (steps.length >= MAX_STEPS) {
      setFeedback({ tone: "warn", text: `La derivación admite como mucho ${MAX_STEPS} pasos.` });
      return;
    }
    const c = checkStep(current, r.expr, law);
    if (!c.ok) {
      if (c.reason === "too-many-variables") {
        setFeedback({ tone: "crit", text: `Hay ${c.count} variables; el máximo es ${MAX_VARIABLES}.` });
      } else {
        const where = c.row.vars.map((v, i) => `${v} = ${c.row.values[i] ? 1 : 0}`).join(", ");
        setFeedback({
          tone: "crit",
          text: `No es equivalente a la expresión anterior: con ${where}, la anterior vale ${c.row.before ? 1 : 0} y la nueva vale ${c.row.after ? 1 : 0}.`,
        });
      }
      return;
    }
    onChange(start, [...steps, { expr: next.trim(), law }]);
    setFeedback(
      c.lawMatches
        ? { tone: "ok", text: `Paso correcto: ${LAW_BY_ID[law].name}.` }
        : { tone: "warn", text: softWarning(law, c.suggestions) },
    );
    setNext("");
    setLaw("");
  };

  const undo = () => {
    clearMessages();
    onChange(start, steps.slice(0, -1));
  };

  const showHint = () => {
    if (!current) return;
    setFinish(null);
    const laws = applicableLaws(current);
    setHint(
      laws.length === 0
        ? "Ninguna ley simplifica directamente esta expresión. Si crees que ya está, pulsa «He terminado»."
        : `Leyes con alguna instancia aplicable ahora: ${laws.map((id) => LAW_BY_ID[id].name).join(", ")}. No tienes que usarlas todas.`,
    );
  };

  const done = () => {
    if (!current) return;
    setHint(null);
    setFeedback(null);
    const m = minimizeBoole(current);
    if (!m.ok) {
      setFinish({ tone: "warn", text: `Hay ${m.count} variables; el máximo es ${MAX_VARIABLES}.` });
      return;
    }
    const mine = literalCount(current);
    setFinish(
      mine <= m.minLiterals
        ? {
            tone: "ok",
            text: `¡Bien! Tu expresión tiene ${mine} ${mine === 1 ? "literal" : "literales"}: no hay una suma de productos ni un producto de sumas con menos.`,
          }
        : {
            tone: "warn",
            text: `Tu expresión es equivalente, pero tiene ${mine} literales y existe una forma con ${m.minLiterals}. Sigue simplificando o pide una pista.`,
          },
    );
  };

  const minimal = useMemo(() => (current ? minimizeBoole(current) : null), [current]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <h2 className="font-display text-[20px] font-semibold">Expresión de partida</h2>
        <label htmlFor="boole-start-choice" className="text-[14px] font-semibold">
          Elige una de práctica o escribe la tuya
        </label>
        <select
          id="boole-start-choice"
          className={cn(selectClass, "w-full font-body")}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setOwnError(null);
          }}
        >
          {(["básico", "medio", "avanzado"] as const).map((level) => (
            <optgroup key={level} label={level[0]!.toUpperCase() + level.slice(1)}>
              {BOOLE_PACK.practice
                .filter((p) => p.level === level)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.expr}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="propia">Escribir la mía</option>
        </select>
        {choice === "propia" ? (
          <FormulaField
            id="boole-start"
            label="Tu expresión"
            value={own}
            onChange={(v) => {
              setOwn(v);
              setOwnError(null);
            }}
            error={ownError}
            inputRef={ownRef}
            placeholder="x ⊕ x′ ⊙ y"
            notation="boole"
          />
        ) : ownError ? (
          <p role="alert" className="text-[14px] text-crit">
            {ownError.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant={lines ? "secondary" : "primary"} onClick={begin}>
            {lines ? "Empezar con esta expresión" : "Empezar"}
          </Button>
        </div>
        <details className="text-[14px]">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo escribir</summary>
          <p className="pb-2 text-muted">
            Suma: ⊕, + o ∨. Producto: ⊙, ·, ∧ o juntando letras (xy). Complemento: ′, &apos;, / o ¬ delante. Aquí ⊕ es la
            suma booleana, no la disyunción exclusiva. Precedencia: ′, después ⊙ y por último ⊕.
          </p>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        {!lines ? (
          <p className="text-muted">Elige una expresión y pulsa «Empezar» para escribir tu derivación paso a paso.</p>
        ) : (
          <>
            <section aria-labelledby="derivation-title" className="flex flex-col gap-2">
              <h2 id="derivation-title" className="font-display text-[20px] font-semibold">
                Tu derivación
              </h2>
              <ol className="flex flex-col gap-2" aria-label="Pasos de la derivación">
                {lines.map((line, i) => (
                  <li key={i} className="flex flex-col gap-1 rounded-md border border-border bg-raised p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-muted">{i === 0 ? "Inicio" : `Paso ${i}`}</span>
                      {line.law ? (
                        <Chip tone={line.warning ? "warn" : "ok"}>{LAW_BY_ID[line.law].name}</Chip>
                      ) : null}
                    </div>
                    <div className="max-w-full overflow-x-auto py-1 text-[18px]">
                      {i > 0 ? <span aria-hidden="true">= </span> : null}
                      <Tex tex={booleToTex(line.expr)} label={`${i === 0 ? "Inicio" : `Paso ${i}`}: ${booleToPlain(line.expr)}`} />
                    </div>
                    {line.warning ? <p className="text-[14px] text-warn">{line.warning}</p> : null}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="next-step-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
              <h2 id="next-step-title" className="font-display text-[20px] font-semibold">
                Siguiente paso
              </h2>
              <FormulaField
                id="boole-next"
                label="Nueva expresión"
                value={next}
                onChange={(v) => {
                  setNext(v);
                  setNextError(null);
                }}
                error={nextError}
                inputRef={nextRef}
                placeholder="x ⊙ y ⊕ z"
                notation="boole"
              />
              <button
                type="button"
                aria-pressed={keypad}
                onClick={() => setKeypad((k) => !k)}
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-border bg-raised px-4 text-[14px] font-semibold hover:bg-sunken"
              >
                <Keyboard size={20} strokeWidth={1.75} aria-hidden="true" />
                Teclado de símbolos
              </button>
              {keypad ? (
                <SymbolKeypad targetRef={nextRef} onChange={setNext} keys={BOOLE_KEYS} vars={BOOLE_VARS} moreVars={[]} />
              ) : null}
              <label htmlFor="boole-law" className="text-[14px] font-semibold">
                Ley que aplicas
              </label>
              <select
                id="boole-law"
                className={cn(selectClass, "w-full font-body")}
                value={law}
                onChange={(e) => setLaw(isLawId(e.target.value) ? e.target.value : "")}
              >
                <option value="">Elige la ley…</option>
                {LAWS.map((l) => (
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
                <Button variant="ghost" onClick={undo} disabled={steps.length === 0}>
                  <Undo2 size={16} aria-hidden="true" />
                  Deshacer último paso
                </Button>
              </div>
              <div role="status" className="flex flex-col gap-1 text-[14px]">
                {feedback ? (
                  <p className={cn(feedback.tone === "ok" ? "text-ok" : feedback.tone === "warn" ? "text-warn" : "text-crit")}>
                    {feedback.text}
                  </p>
                ) : null}
                {hint ? <p>{hint}</p> : null}
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={done}>
                <Flag size={16} aria-hidden="true" />
                He terminado
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearMessages();
                  onChange(start, []);
                }}
                disabled={steps.length === 0}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Borrar los pasos
              </Button>
            </div>
            {finish ? (
              <div role="status">
                <Chip tone={finish.tone} className="whitespace-normal">
                  {finish.text}
                </Chip>
              </div>
            ) : null}

            <SolutionGate resetKey={start ?? ""}>
              {minimal && minimal.ok ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
                  <h3 className="font-display text-[18px] font-semibold">Formas mínimas</h3>
                  <p className="text-[14px] text-muted">
                    Calculadas con Quine–McCluskey a partir de la tabla de verdad de la expresión de partida.
                  </p>
                  <p className="text-[14px] font-semibold">{`Suma de productos (${minimal.sop.literals} literales):`}</p>
                  <Tex display tex={booleToTex(minimal.sop.expr)} label="Suma de productos mínima" />
                  <p className="text-[14px] font-semibold">{`Producto de sumas (${minimal.pos.literals} literales):`}</p>
                  <Tex display tex={booleToTex(minimal.pos.expr)} label="Producto de sumas mínimo" />
                </div>
              ) : null}
            </SolutionGate>
          </>
        )}
      </div>
    </div>
  );
}

