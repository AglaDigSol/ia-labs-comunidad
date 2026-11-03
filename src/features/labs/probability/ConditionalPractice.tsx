// Prácticas de probabilidad condicionada: la tabla de contingencia 2×2 (casillas que faltan, P(A | B),
// P(B | A) e independencia), un par de sucesos con P(A), P(B) y un dato más (unión, intersección,
// condicionada y las afirmaciones a)–d)) y la condicionada con un dado (cuatro opciones). Todo se
// corrige con el motor de shared/probability y se marca sin decir el valor.
import { useId, useMemo, useState } from "react";
import {
  pairStatementsFor,
  qFrac,
  statementTrue,
  type PairStatement,
} from "../../../../shared/exercises/probability.ts";
import {
  CONTINGENCY_KEYS,
  interFromCond,
  interFromUnion,
  pairFacts,
  solveContingency,
  type Contingency,
  type ContingencyKey,
  type PairFacts,
} from "../../../../shared/probability/conditional.ts";
import { condProbOf, dieEvent, dieEventHolds, dieEventText, dieSpace, eventInter, probOf, type DieEventSpec } from "../../../../shared/probability/events.ts";
import { probTex } from "../../../../shared/probability/format.ts";
import { equals, mul, type Frac } from "../../../../shared/rational.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import {
  AnswerField,
  AnswerHelp,
  CheckButton,
  dataTex,
  dataText,
  GradeSummary,
  gradeFields,
  Hints,
  loadedDieText,
  optionLetter,
  Options,
  PracticeBox,
  probWithDecimal,
  probWithDecimalTex,
  SolutionBox,
  SolutionLine,
  Status,
  TexList,
  useFields,
  Verdict,
} from "./common.tsx";

// ---------------------------------------------------------------- Tabla de contingencia

const CELL_LABEL: Record<ContingencyKey, [string, string]> = {
  ab: ["P(A ∩ B)", "P(A \\cap B)"],
  aNotB: ["P(A ∩ Bᶜ)", "P(A \\cap B^c)"],
  pA: ["P(A)", "P(A)"],
  notAB: ["P(Aᶜ ∩ B)", "P(A^c \\cap B)"],
  notANotB: ["P(Aᶜ ∩ Bᶜ)", "P(A^c \\cap B^c)"],
  pNotA: ["P(Aᶜ)", "P(A^c)"],
  pB: ["P(B)", "P(B)"],
  pNotB: ["P(Bᶜ)", "P(B^c)"],
};

const ROWS: Array<[string, ContingencyKey, ContingencyKey, ContingencyKey]> = [
  ["A", "ab", "aNotB", "pA"],
  ["Aᶜ", "notAB", "notANotB", "pNotA"],
];

export function ContingencyPractice({ c, a, b, given, onSolved }: { c: Contingency; a: string; b: string; given: readonly ContingencyKey[]; onSolved?: () => void }) {
  const help = useId();
  const sol = useMemo(() => solveContingency(c), [c]);
  const missing = CONTINGENCY_KEYS.filter((k) => !given.includes(k));
  const keys = useMemo(() => [...missing, "aGivenB", "bGivenA"], [missing.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const expected = useMemo(() => {
    const e: Record<string, Frac> = {};
    for (const k of missing) e[k] = sol[k];
    e.aGivenB = sol.aGivenB!;
    e.bGivenA = sol.bGivenA!;
    return e;
  }, [sol, missing.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = useFields(keys);
  const [indep, setIndep] = useState<"si" | "no" | null>(null);
  const graded = gradeFields(f.values, expected);
  const indepOk = indep === (sol.independent ? "si" : "no");
  const solved = f.checked && graded.allOk && indepOk;
  const bad = (k: string) => f.checked && graded.states[k] !== "bien";
  const name = useId();

  const cell = (k: ContingencyKey) =>
    given.includes(k) ? (
      <Tex tex={dataTex(sol[k])} label={`${CELL_LABEL[k][0]} = ${dataText(sol[k])}`} className="text-[16px]" />
    ) : (
      <AnswerField label={CELL_LABEL[k][0]} hideLabel value={f.values[k] ?? ""} onChange={(v) => f.set(k, v)} invalid={bad(k)} describedBy={help} />
    );

  return (
    <PracticeBox title="Tabla de contingencia">
      <p className="text-[14px] text-muted">{`A: ${a}. B: ${b}. Completa la tabla (las filas y las columnas suman sus totales, y todo suma 1).`}</p>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-center text-[14px]">
          <caption className="sr-only">Tabla de contingencia de A y B</caption>
          <thead>
            <tr>
              <td />
              <th scope="col" className="p-1 font-semibold">B</th>
              <th scope="col" className="p-1 font-semibold">Bᶜ</th>
              <th scope="col" className="p-1 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([row, k1, k2, k3]) => (
              <tr key={row}>
                <th scope="row" className="p-1 font-semibold">{row}</th>
                <td className="p-1">{cell(k1)}</td>
                <td className="p-1">{cell(k2)}</td>
                <td className="border-l-2 border-border p-1">{cell(k3)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border">
              <th scope="row" className="p-1 font-semibold">Total</th>
              <td className="p-1">{cell("pB")}</td>
              <td className="p-1">{cell("pNotB")}</td>
              <td className="border-l-2 border-border p-1 font-mono text-[16px]">1</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <AnswerField label="P(A | B)" labelNode={<Tex tex="P(A \mid B)" />} value={f.values.aGivenB ?? ""} onChange={(v) => f.set("aGivenB", v)} invalid={bad("aGivenB")} describedBy={help} className="w-full sm:w-40" />
        <AnswerField label="P(B | A)" labelNode={<Tex tex="P(B \mid A)" />} value={f.values.bGivenA ?? ""} onChange={(v) => f.set("bGivenA", v)} invalid={bad("bGivenA")} describedBy={help} className="w-full sm:w-40" />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[14px] font-semibold">¿Son A y B independientes?</legend>
        <div className={cn("flex flex-wrap gap-x-4 rounded-md", f.checked && !indepOk && "border-2 border-crit px-2")}>
          {(["si", "no"] as const).map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={name}
                checked={indep === v}
                aria-invalid={f.checked && !indepOk ? true : undefined}
                onChange={() => {
                  setIndep(v);
                  f.touch();
                }}
                className="h-5 w-5"
              />
              {v === "si" ? "Sí" : "No"}
            </label>
          ))}
        </div>
      </fieldset>
      <AnswerHelp id={help} />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk && indepOk) onSolved?.();
          }}
        />
        <Hints
          hints={[
            "Cada fila suma su total: P(A ∩ B) + P(A ∩ Bᶜ) = P(A). Cada columna, igual: P(A ∩ B) + P(Aᶜ ∩ B) = P(B).",
            "P(A | B) = P(A ∩ B) / P(B): la casilla de A ∩ B entre el total de su columna. P(B | A), entre el total de su fila.",
            "A y B son independientes si P(A ∩ B) = P(A)·P(B), o, lo que es lo mismo, si P(A | B) = P(A).",
          ]}
        />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary
            graded={graded}
            solved={solved}
            success={`¡Correcto! ${sol.independent ? "Son independientes: P(A ∩ B) = P(A)·P(B)." : "No son independientes: P(A ∩ B) ≠ P(A)·P(B)."}`}
            extra={indep === null ? <span>Elige si son independientes.</span> : !indepOk ? <span>Revisa la independencia: compara P(A ∩ B) con P(A)·P(B).</span> : null}
          />
        </Status>
      ) : null}
      <SolutionGate resetKey={[c.ab, c.aNotB, c.notAB, c.notANotB].map(probTex).join("|")}>
        <SolutionBox>
          <SolutionLine
            tex={`P(A) = ${probTex(sol.pA)},\\ P(A^c) = ${probTex(sol.pNotA)},\\ P(B) = ${probTex(sol.pB)},\\ P(B^c) = ${probTex(sol.pNotB)}`}
            label={`P de A igual a ${probWithDecimal(sol.pA)}; P de B igual a ${probWithDecimal(sol.pB)}`}
          />
          <SolutionLine
            tex={`P(A \\cap B^c) = ${probTex(sol.aNotB)},\\ P(A^c \\cap B) = ${probTex(sol.notAB)},\\ P(A^c \\cap B^c) = ${probTex(sol.notANotB)}`}
            label="Casillas de la tabla"
          />
          <SolutionLine tex={`P(A \\mid B) = \\dfrac{${probTex(sol.ab)}}{${probTex(sol.pB)}} = ${probWithDecimalTex(sol.aGivenB!)},\\quad P(B \\mid A) = \\dfrac{${probTex(sol.ab)}}{${probTex(sol.pA)}} = ${probWithDecimalTex(sol.bGivenA!)}`} label={`P de A dado B igual a ${probWithDecimal(sol.aGivenB!)}; P de B dado A igual a ${probWithDecimal(sol.bGivenA!)}`} />
          <p>{sol.independent ? "P(A)·P(B) = P(A ∩ B): son independientes." : "P(A)·P(B) ≠ P(A ∩ B): no son independientes."}</p>
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}

// ---------------------------------------------------------------- Un par de sucesos

export type PairGiven = "inter" | "union" | "cond";

const GIVEN_TEX: Record<PairGiven, string> = { inter: "P(A \\cap B)", union: "P(A \\cup B)", cond: "P(A \\mid B)" };
const GIVEN_TEXT: Record<PairGiven, string> = { inter: "P(A ∩ B)", union: "P(A ∪ B)", cond: "P(A | B)" };

/** La afirmación en TeX y en texto. */
export function statementNode(s: PairStatement): { tex: string; text: string } {
  switch (s.kind) {
    case "independientes":
      return { tex: "\\text{A y B son independientes.}", text: "A y B son independientes." };
    case "incompatibles":
      return { tex: "\\text{A y B son incompatibles: } P(A \\cap B) = 0.", text: "A y B son incompatibles: P(A ∩ B) = 0." };
    case "condicionada-igual":
      return { tex: "P(A \\mid B) = P(A)", text: "P(A | B) = P(A)." };
    case "a-dado-b":
      return { tex: `P(A \\mid B) = ${dataTex(qFrac(s.value))}`, text: `P(A | B) = ${dataText(qFrac(s.value))}.` };
    case "b-dado-a":
      return { tex: `P(B \\mid A) = ${dataTex(qFrac(s.value))}`, text: `P(B | A) = ${dataText(qFrac(s.value))}.` };
    case "union":
      return { tex: `P(A \\cup B) = ${dataTex(qFrac(s.value))}`, text: `P(A ∪ B) = ${dataText(qFrac(s.value))}.` };
    case "ninguno":
      return { tex: `P(A^c \\cap B^c) = ${dataTex(qFrac(s.value))}`, text: `P(Aᶜ ∩ Bᶜ) = ${dataText(qFrac(s.value))}.` };
  }
}

export function pairFactsOf(pA: Frac, pB: Frac, given: PairGiven, value: Frac): PairFacts {
  return pairFacts(pA, pB, given === "inter" ? value : given === "union" ? interFromUnion(pA, pB, value) : interFromCond(value, pB));
}

export function PairPractice({
  pA,
  pB,
  given,
  value,
  statements,
  multi,
  onSolved,
}: {
  pA: Frac;
  pB: Frac;
  given: PairGiven;
  value: Frac;
  /** Afirmaciones a)–d); por defecto, las de pairStatementsFor. */
  statements?: readonly PairStatement[];
  multi: boolean;
  onSolved?: () => void;
}) {
  const help = useId();
  const name = useId();
  const facts = useMemo(() => pairFactsOf(pA, pB, given, value), [pA, pB, given, value]);
  const list = useMemo(() => statements ?? pairStatementsFor(facts), [statements, facts]);
  const truth = list.map((s) => statementTrue(s, facts));
  const condKey = given === "cond" ? "bGivenA" : "aGivenB";
  const expected = useMemo(() => {
    const e: Record<string, Frac> = {};
    if (given !== "inter") e.inter = facts.inter;
    if (given !== "union") e.union = facts.union;
    e[condKey] = (given === "cond" ? facts.bGivenA : facts.aGivenB)!;
    return e;
  }, [facts, given, condKey]);
  const keys = useMemo(() => Object.keys(expected), [expected]);
  const f = useFields(keys);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const graded = gradeFields(f.values, expected);
  const choiceOk = truth.every((t, i) => t === selected.has(i));
  const solved = f.checked && graded.allOk && choiceOk;
  const bad = (k: string) => f.checked && graded.states[k] !== "bien";
  const LABELS: Record<string, [string, string]> = {
    inter: ["P(A ∩ B)", "P(A \\cap B)"],
    union: ["P(A ∪ B)", "P(A \\cup B)"],
    aGivenB: ["P(A | B)", "P(A \\mid B)"],
    bGivenA: ["P(B | A)", "P(B \\mid A)"],
  };

  return (
    <PracticeBox title="Condicionada e independencia">
      <TexList
        items={[
          [`P(A) = ${dataTex(pA)}`, `P de A igual a ${dataText(pA)}`],
          [`P(B) = ${dataTex(pB)}`, `P de B igual a ${dataText(pB)}`],
          [`${GIVEN_TEX[given]} = ${dataTex(value)}`, `${GIVEN_TEXT[given]} igual a ${dataText(value)}`],
        ]}
      />
      <div className="flex flex-wrap gap-3">
        {keys.map((k) => (
          <AnswerField key={k} label={LABELS[k]![0]} labelNode={<Tex tex={LABELS[k]![1]} />} value={f.values[k] ?? ""} onChange={(v) => f.set(k, v)} invalid={bad(k)} describedBy={help} className="w-full sm:w-40" />
        ))}
      </div>
      <AnswerHelp id={help} />
      <div className={cn("rounded-md", f.checked && !choiceOk && "border-2 border-crit p-2")}>
        <Options
          legend={multi ? "Selecciona la o las afirmaciones correctas" : "Elige la afirmación correcta"}
          name={name}
          multi={multi}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            f.touch();
          }}
          options={list.map((s, i) => {
            const t = statementNode(s);
            return { key: `${i}-${t.text}`, label: t.text, node: <Tex tex={t.tex} /> };
          })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            f.check();
            if (graded.allOk && choiceOk) onSolved?.();
          }}
        />
        <Hints
          hints={[
            given === "union" ? "Despeja P(A ∩ B) de P(A ∪ B) = P(A) + P(B) − P(A ∩ B)." : given === "cond" ? "De P(A | B) = P(A ∩ B) / P(B) sale P(A ∩ B) = P(A | B)·P(B)." : "P(A ∪ B) = P(A) + P(B) − P(A ∩ B): si no restas la intersección, la cuentas dos veces.",
            "P(A | B) = P(A ∩ B) / P(B) y P(B | A) = P(A ∩ B) / P(A): cambia el denominador.",
            "Independientes: P(A ∩ B) = P(A)·P(B). Incompatibles: P(A ∩ B) = 0. Dos sucesos con probabilidad positiva no pueden ser las dos cosas a la vez.",
            "P(Aᶜ ∩ Bᶜ) = 1 − P(A ∪ B) (leyes de De Morgan).",
          ]}
        />
      </div>
      {f.checked ? (
        <Status>
          <GradeSummary
            graded={graded}
            solved={solved}
            success={`¡Correcto! ${facts.independent ? "Son independientes." : "No son independientes."}`}
            extra={selected.size === 0 ? <span>Elige una opción.</span> : !choiceOk ? <span>{multi ? "Revisa la elección: alguna afirmación está mal marcada." : "Esa opción no es la correcta."}</span> : null}
          />
        </Status>
      ) : null}
      <SolutionGate resetKey={[pA, pB, value].map(probTex).join("|") + given}>
        <SolutionBox>
          <SolutionLine tex={`P(A \\cap B) = ${probWithDecimalTex(facts.inter)},\\quad P(A)\\,P(B) = ${probWithDecimalTex(mul(pA, pB))}`} label={`P de A y B igual a ${probWithDecimal(facts.inter)}`} />
          <SolutionLine tex={`P(A \\cup B) = ${probTex(pA)} + ${probTex(pB)} - ${probTex(facts.inter)} = ${probWithDecimalTex(facts.union)}`} label={`P de A o B igual a ${probWithDecimal(facts.union)}`} />
          {facts.aGivenB ? <SolutionLine tex={`P(A \\mid B) = \\dfrac{${probTex(facts.inter)}}{${probTex(pB)}} = ${probWithDecimalTex(facts.aGivenB)}`} label={`P de A dado B igual a ${probWithDecimal(facts.aGivenB)}`} /> : null}
          {facts.bGivenA ? <SolutionLine tex={`P(B \\mid A) = \\dfrac{${probTex(facts.inter)}}{${probTex(pA)}} = ${probWithDecimalTex(facts.bGivenA)}`} label={`P de B dado A igual a ${probWithDecimal(facts.bGivenA)}`} /> : null}
          <ul className="flex flex-col gap-1">
            {list.map((s, i) => (
              <li key={i}>{`${optionLetter(i)}) ${statementNode(s).text} ${truth[i] ? "Verdadera." : "Falsa."}`}</li>
            ))}
          </ul>
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}


// ---------------------------------------------------------------- Condicionada con un dado

export function DieCondPractice({ odd, even, a, b, options, onSolved }: { odd: number; even: number; a: DieEventSpec; b: DieEventSpec; options: readonly Frac[]; onSolved?: () => void }) {
  const name = useId();
  const die = useMemo(() => dieSpace([1, 2, 3, 4, 5, 6].map((x) => (x % 2 ? odd : even))), [odd, even]);
  const A = dieEvent(die, a);
  const B = dieEvent(die, b);
  const pB = probOf(die, B);
  const pAB = probOf(die, eventInter(A, B));
  const answer = condProbOf(die, A, B);
  const correct = options.findIndex((o) => answer !== null && equals(o, answer));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const ok = selected.has(correct);
  const facesB = [1, 2, 3, 4, 5, 6].filter((x) => dieEventHolds(b, x));
  const facesAB = facesB.filter((x) => dieEventHolds(a, x));
  return (
    <PracticeBox title="Condicionada con un dado">
      <p>{`Se tira ${loadedDieText(odd, even)}. ¿Cuál es la probabilidad de que el resultado ${dieEventText(a)}, sabiendo que ${dieEventText(b)}?`}</p>
      <Options
        legend="Elige la respuesta correcta"
        name={name}
        multi={false}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          setChecked(false);
        }}
        options={options.map((o) => ({ key: probTex(o), label: dataText(o), node: <Tex tex={probTex(o)} className="text-[18px]" /> }))}
      />
      <div className="flex flex-wrap gap-2">
        <CheckButton
          onClick={() => {
            setChecked(true);
            if (ok) onSolved?.();
          }}
        />
        <Hints
          hints={[
            "«Sabiendo que…» reduce el espacio muestral: solo cuentan las caras en las que se cumple la condición.",
            "P(A | B) = P(A ∩ B) / P(B).",
            odd === even ? "Con un dado equilibrado, P(A | B) = |A ∩ B| / |B|: casos favorables entre casos posibles dentro de B." : "Con el dado trucado, las caras no pesan lo mismo: calcula primero la probabilidad de cada cara (todas suman 1) y suma las de B y las de A ∩ B.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {ok ? <Verdict tone="ok">¡Correcto!</Verdict> : <Verdict tone="warn">{selected.size === 0 ? "Elige una opción." : "Esa opción no es la correcta."}</Verdict>}
        </Status>
      ) : null}
      <SolutionGate resetKey={JSON.stringify([odd, even, a, b])}>
        <SolutionBox>
          <p>{`B = {${facesB.join(", ")}} y A ∩ B = {${facesAB.join(", ")}}.`}</p>
          <SolutionLine
            tex={`P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)} = \\dfrac{${probTex(pAB)}}{${probTex(pB)}} = ${answer ? probWithDecimalTex(answer) : "\\text{—}"}`}
            label={`P de A dado B igual a ${answer ? probWithDecimal(answer) : "no definida"}`}
          />
          {correct >= 0 ? <p>{`Es la opción ${optionLetter(correct)}).`}</p> : null}
        </SolutionBox>
      </SolutionGate>
    </PracticeBox>
  );
}

