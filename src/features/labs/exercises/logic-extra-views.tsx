// Vistas de los ejercicios de lógica con lenguaje natural y conjuntos numéricos: «Formalizar un
// enunciado» (elegir entre cuatro fórmulas o escribirla; se corrige por equivalencia), «Negar en
// lenguaje natural» (cuatro frases) y «Predicados sobre conjuntos numéricos» (cuatro opciones). No
// tocan los laboratorios de lógica ni de predicados: usan sus motores y el campo de fórmula.
import { Check } from "lucide-react";
import { useId, useMemo, useRef, useState, type ComponentType } from "react";
import { toTex } from "../../../../shared/logic/ast.ts";
import { parseFormula } from "../../../../shared/logic/parser.ts";
import { predToPlain, predToTex } from "../../../../shared/predicates/ast.ts";
import { parsePredicate } from "../../../../shared/predicates/parser.ts";
import { isNegation, negationMistake } from "../../../../shared/exercises/logic-extra-negation.ts";
import {
  ATOMS,
  divides,
  formalizeMatches,
  formalizePattern,
  formalizeSentence,
  formalizeTarget,
  LOGIC_FORMALIZE,
  numberFamily,
  NUMBER_SETS,
  PRED_NEGATE_NL,
  PRED_NUMBERS,
  readFormalizeInput,
  SET_TEX,
  SET_TEXT,
  setsText,
  truthSets,
  type LogicFormalizeInstance,
  type PredNegateNLInstance,
  type PredNumbersInstance,
} from "../../../../shared/exercises/logic-extra.ts";
import type { ExerciseType } from "../../../../shared/exercises/types.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { Hints, OptionList, PracticeBox, Statement, Status, Verdict } from "../combinatorics/common.tsx";
import { FormulaField } from "../logic/FormulaInput.tsx";
import type { ExerciseViewProps } from "./views.tsx";

type View = ComponentType<ExerciseViewProps<unknown>>;

function logicTex(text: string): string {
  const r = parseFormula(text);
  if (!r.ok) throw new Error(`fórmula ilegible: ${text}`);
  return toTex(r.ast);
}
function predTex(text: string): { tex: string; plain: string } {
  const r = parsePredicate(text);
  if (!r.ok) throw new Error(`fórmula ilegible: ${text}`);
  return { tex: predToTex(r.formula), plain: predToPlain(r.formula) };
}

/** Comprobar + pistas + aviso, igual en los tres. */
function CheckRow({ onCheck, hints }: { onCheck: () => void; hints: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={onCheck}>
        <Check size={16} aria-hidden="true" />
        Comprobar
      </Button>
      <Hints hints={hints} />
    </div>
  );
}

function Verdicts({ checked, solved, message }: { checked: boolean; solved: boolean; message: string }) {
  if (!checked) return null;
  return (
    <Status>
      {solved ? (
        <Verdict tone="ok">
          <Check size={16} aria-hidden="true" />
          ¡Correcto!
        </Verdict>
      ) : (
        <Verdict tone="warn">{message}</Verdict>
      )}
    </Status>
  );
}

// ---------------------------------------------------------------- Formalizar

function FormalizeExercise({ instance, onSolved }: ExerciseViewProps<LogicFormalizeInstance>) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"elegir" | "escribir">("elegir");
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const pattern = formalizePattern(instance.pattern);
  const letters = ["p", "q", "r"].slice(0, instance.atoms.length);
  // «p v q»: la v suelta es el «o» (aquí no hay ninguna letra v).
  const input = readFormalizeInput(text);
  const parsed = text.trim() === "" ? null : parseFormula(input);
  const typed = text.trim() === "" ? null : formalizeMatches(input, instance);
  const solved = mode === "elegir" ? choice !== null && formalizeMatches(instance.options[Number(choice)]!, instance) === true : typed === true;
  const message =
    mode === "elegir"
      ? choice === null
        ? "Elige una opción."
        : "Esa no es. Vuelve a leer qué va a cada lado de la flecha."
      : parsed && !parsed.ok
        ? parsed.error.message
        : typed === null
          ? `Usa solo ${letters.join(", ")}.${/v/i.test(input) ? " Para «o», escribe ∨ o | (o una v suelta, entre espacios: p v q)." : ""}`
          : "No es equivalente a la frase. Vuelve a leerla.";
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">Formaliza la frase con estas proposiciones:</p>
        <ul className="flex flex-col gap-1 text-[14px]">
          {instance.atoms.map((a, i) => (
            <li key={a}>
              <span className="font-mono font-semibold">{letters[i]}</span>
              {`: ${ATOMS.find((x) => x.id === a)!.fin}`}
            </li>
          ))}
        </ul>
        <p className="text-[18px]">{`«${formalizeSentence(instance)}»`}</p>
      </Statement>
      <PracticeBox title="Tu fórmula">
        <OptionList
          legend="Cómo contestar"
          letters={false}
          options={[
            { key: "elegir", content: "Elegir entre cuatro" },
            { key: "escribir", content: "Escribir la fórmula" },
          ]}
          value={mode}
          onChange={(m) => (setMode(m as "elegir" | "escribir"), setChecked(false))}
        />
        {mode === "elegir" ? (
          <OptionList
            legend="¿Qué fórmula dice lo mismo que la frase?"
            options={instance.options.map((o, i) => ({ key: String(i), content: <Tex tex={logicTex(o)} label={o} /> }))}
            value={choice}
            onChange={(k) => (setChoice(k), setChecked(false))}
            invalid={checked && !solved}
          />
        ) : (
          <FormulaField
            id={`${id}-f`}
            label="Fórmula"
            value={text}
            onChange={(v) => (setText(v), setChecked(false))}
            error={parsed && !parsed.ok ? parsed.error : null}
            inputRef={ref}
            placeholder=""
            invalid={checked && !solved && !(parsed && !parsed.ok)}
          />
        )}
        <CheckRow
          onCheck={() => {
            setChecked(true);
            if (solved) onSolved();
          }}
          hints={[
            "Busca la palabra clave (suficiente, necesario, solo si, a menos que, ni… ni…) y decide qué parte es la condición y qué parte la consecuencia.",
            pattern.rule,
            "Se escribe con ¬, ∧, ∨, → y ↔ (o con ~, &, |, ->, <->; el «o» también con una v suelta: p v q).",
          ]}
        />
        <Verdicts checked={checked} solved={solved} message={message} />
        <SolutionGate resetKey={JSON.stringify(instance)}>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
            <Tex display tex={logicTex(formalizeTarget(instance))} label={formalizeTarget(instance)} className="text-[20px]" />
            <p className="text-[14px]">{pattern.rule}</p>
          </div>
        </SolutionGate>
      </PracticeBox>
    </>
  );
}

// ---------------------------------------------------------------- Negar en lenguaje natural

function NegateNLExercise({ instance, onSolved }: ExerciseViewProps<PredNegateNLInstance>) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = useMemo(() => instance.options.map((o) => isNegation(instance.formula, o.formula)), [instance]);
  const solved = choice !== null && right[Number(choice)] === true;
  const original = predTex(instance.formula);
  const good = instance.options[right.indexOf(true)]!;
  const goodF = predTex(good.formula);
  return (
    <>
      <Statement>
        <p className="text-[14px] text-muted">¿Cuál es la negación de esta frase?</p>
        <p className="text-[18px]">{`«${instance.sentence}»`}</p>
      </Statement>
      <PracticeBox title="Elige la negación">
        <OptionList legend="La negación es:" options={instance.options.map((o, i) => ({ key: String(i), content: o.text }))} value={choice} onChange={(k) => (setChoice(k), setChecked(false))} invalid={checked && !solved} />
        <CheckRow
          onCheck={() => {
            setChecked(true);
            if (solved) onSolved();
          }}
          hints={[
            "Negar no es cambiar el predicado y dejar el cuantificador: ¬∀x P(x) ≡ ∃x ¬P(x) y ¬∃x P(x) ≡ ∀x ¬P(x).",
            "Dentro, De Morgan: ¬(A ∧ B) ≡ ¬A ∨ ¬B y ¬(A ∨ B) ≡ ¬A ∧ ¬B. Y ¬(A → B) ≡ A ∧ ¬B.",
            "Escríbela con fórmulas (la leyenda está en la solución) y vuelve a pasarla a palabras.",
          ]}
        />
        <Verdicts checked={checked} solved={solved} message={choice === null ? "Elige una opción." : `Esa no es la negación. ${negationMistake(instance.formula, instance.options[Number(choice)]!.formula)}`} />
        <SolutionGate resetKey={instance.sentence}>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
            <p>{instance.legend}</p>
            <Tex display tex={`\\lnot\\left(${original.tex}\\right) \\equiv ${goodF.tex}`} label={`no (${original.plain}) equivale a ${goodF.plain}`} className="text-[18px]" />
            <p>{`Negación: «${good.text}»`}</p>
          </div>
        </SolutionGate>
      </PracticeBox>
    </>
  );
}

// ---------------------------------------------------------------- Conjuntos numéricos

function NumbersExercise({ instance, onSolved }: ExerciseViewProps<PredNumbersInstance>) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  if (instance.kind === "divide") {
    const ok = instance.pairs.map(([a, b]) => divides(a, b));
    const solved = choice !== null && ok[Number(choice)] === true;
    return (
      <>
        <Statement>
          <Tex display tex="p(x, y) \equiv \exists k \in \mathbb{Z} : y = k\cdot x \quad (x, y \in \mathbb{Z})" label="p de x, y equivale a: existe k entero con y igual a k por x, con x e y enteros" className="text-[18px]" />
          <p className="text-[14px] text-muted">¿Cuál de estas afirmaciones es verdadera?</p>
        </Statement>
        <PracticeBox title="Elige la verdadera">
          <OptionList legend="Es verdadera:" options={instance.pairs.map(([a, b], i) => ({ key: String(i), content: <Tex tex={`p(${a}, ${b})`} label={`p de ${a}, ${b}`} /> }))} value={choice} onChange={(k) => (setChoice(k), setChecked(false))} invalid={checked && !solved} />
          <CheckRow
            onCheck={() => {
              setChecked(true);
              if (solved) onSolved();
            }}
            hints={["p(x, y) dice que y es un múltiplo entero de x (x divide a y).", "Cuidado con el 0: 0 = 0·x para cualquier x, pero y = k·0 solo da y = 0."]}
          />
          <Verdicts checked={checked} solved={solved} message={choice === null ? "Elige una opción." : "Esa no es verdadera."} />
          <SolutionGate resetKey={JSON.stringify(instance)}>
            <ul className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-[14px]">
              {instance.pairs.map(([a, b], i) => (
                <li key={i}>{`p(${a}, ${b}): ${ok[i] ? `verdadera (k = ${a === 0 ? "cualquiera" : b / a})` : a === 0 ? `falsa: k·0 = 0 ≠ ${b}` : `falsa: ${b}/${a} no es entero`}`}</li>
              ))}
            </ul>
          </SolutionGate>
        </PracticeBox>
      </>
    );
  }
  const f = numberFamily(instance.family);
  const truth = truthSets(f);
  const same = (o: readonly string[]) => o.length === truth.length && o.every((x) => (truth as string[]).includes(x));
  const solved = choice !== null && same(instance.options[Number(choice)]!);
  const why = f.why(instance.c);
  return (
    <>
      <Statement>
        <Tex display tex={f.tex(instance.c)} label={f.text(instance.c)} className="text-[20px]" />
        <p className="text-[14px] text-muted">
          {"¿Para qué conjuntos A es verdadero? Aquí "}
          <Tex tex="\mathbb{N} = \{1, 2, 3, \ldots\}" label="ene igual a 1, 2, 3 y siguientes" />.
        </p>
      </Statement>
      <PracticeBox title="Elige la opción">
        <OptionList legend="Es verdadero:" options={instance.options.map((o, i) => ({ key: String(i), content: setsText(o) }))} value={choice} onChange={(k) => (setChoice(k), setChecked(false))} invalid={checked && !solved} />
        <CheckRow
          onCheck={() => {
            setChecked(true);
            if (solved) onSolved();
          }}
          hints={[
            "∀…∃: para cada valor tiene que haber un testigo dentro de A. Basta un valor sin testigo para que sea falso.",
            "Prueba en cada conjunto con valores pequeños (1, 2) y despeja: ¿la solución está en A?",
            "√2 y ∛2 son irracionales; 1/2 no es entero; ℕ tiene mínimo y ℤ no; entre dos racionales siempre hay otro.",
          ]}
        />
        <Verdicts checked={checked} solved={solved} message={choice === null ? "Elige una opción." : "No es esa. Busca un contraejemplo en cada conjunto."} />
        <SolutionGate resetKey={JSON.stringify(instance)}>
          <ul className="flex flex-col gap-1 rounded-lg border border-border bg-raised p-3 text-[14px]">
            {NUMBER_SETS.map((s) => (
              <li key={s}>
                <Tex tex={SET_TEX[s]} label={SET_TEXT[s]} />
                {` ${f.truth[s] ? "verdadero" : "falso"}: ${why[s]}`}
              </li>
            ))}
          </ul>
        </SolutionGate>
      </PracticeBox>
    </>
  );
}

const entry = <I,>(type: ExerciseType<I>, view: ComponentType<ExerciseViewProps<I>>): [string, View] => [type.id, view as View];

const keyed =
  <I,>(V: ComponentType<ExerciseViewProps<I>>) =>
  (p: ExerciseViewProps<I>) => <V key={JSON.stringify(p.instance)} {...p} />;

export const LOGIC_EXTRA_EXERCISE_VIEWS: Array<[string, View]> = [
  entry(LOGIC_FORMALIZE, keyed(FormalizeExercise)),
  entry(PRED_NEGATE_NL, keyed(NegateNLExercise)),
  entry(PRED_NUMBERS, keyed(NumbersExercise)),
];
