// «Complejidad»: el orden O grande de un fragmento de pseudocódigo o de un coste T(n), entre cuatro
// opciones a)–d) como en el examen; y verdadero o falso sobre P y NP. «Comprobar» dice si está bien
// sin decir cuál es la buena (si eliges el orden correcto con una constante dentro, avisa de que en la
// O no van constantes). Las pistas dan la regla de cada estructura; la solución, detrás de
// SolutionGate. En P y NP, las explicaciones se ven al acertarlas todas o en la solución.
import { Check } from "lucide-react";
import { useState } from "react";
import { algorithmCost, algorithmGivens, algorithmHints, algorithmLines, costHints, type Algorithm } from "../../../../shared/discrete/algorithms.ts";
import { bigOTex, bigOText, costOf, costSpoken, costTex, isConstantTrap, isLooseBound, optionIsCorrect, optionTex, optionText, type BigOOption } from "../../../../shared/discrete/bigo.ts";
import { pnpStatement } from "../../../../shared/discrete/pnp.ts";
import { complexityGrowth } from "../../../../shared/exercises/discrete.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { CodeBlock, Hints, OptionList, PracticeBox, Status, Verdict, YesNo } from "./common.tsx";

export type ComplexityProblem = { kind: "algo"; algo: Algorithm } | { kind: "cost"; cost: string };

/** El enunciado: el pseudocódigo con sus datos, o el coste T(n). */
export function ComplexityStatement({ problem }: { problem: ComplexityProblem }) {
  if (problem.kind === "cost") {
    const c = costOf(problem.cost, ["n", "m"]);
    const lhs = /m/.test(problem.cost) ? "T(n, m)" : "T(n)";
    return <Tex display tex={`${lhs} = ${costTex(c)}`} label={`${lhs} igual a ${costSpoken(c)}`} className="text-[20px]" />;
  }
  const lines = algorithmLines(problem.algo);
  return (
    <div className="flex flex-col gap-2">
      {algorithmGivens(problem.algo).map((g) => (
        <Tex key={g.tex} tex={g.tex} label={g.label} className="text-[16px]" />
      ))}
      <CodeBlock lines={lines} label="Pseudocódigo" />
    </div>
  );
}

export function ComplexityPractice({ problem, options, onSolved }: { problem: ComplexityProblem; options: readonly BigOOption[]; onSolved?: () => void }) {
  const growth = complexityGrowth(problem);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const index = choice === null ? -1 : Number(choice);
  const solved = index >= 0 && optionIsCorrect(options, index, growth);
  const trap = index >= 0 && isConstantTrap(options[index]!, growth);
  const loose = index >= 0 && isLooseBound(options[index]!, growth);
  const hints = problem.kind === "algo" ? algorithmHints(problem.algo) : costHints(costOf(problem.cost, ["n", "m"]));
  const cost = problem.kind === "algo" ? algorithmCost(problem.algo) : costOf(problem.cost, ["n", "m"]);
  const choices = options.map((o, i) => ({ key: String(i), content: <Tex tex={optionTex(o)} label={optionText(o)} /> }));

  return (
    <PracticeBox title={problem.kind === "algo" ? "¿De qué orden es este algoritmo?" : "¿De qué orden es este coste?"}>
      <ComplexityStatement problem={problem} />
      <p className="text-[14px] text-muted">Se pide el orden exacto: la cota O ajustada (Θ), la que crece igual que el coste.</p>
      <OptionList legend="Elige una opción" options={choices} value={choice} onChange={(k) => (setChoice(k), setChecked(false))} invalid={checked && !solved} />
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
        <Hints hints={hints} />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto!
            </Verdict>
          ) : choice === null ? (
            <Verdict tone="warn">Elige una opción.</Verdict>
          ) : trap ? (
            <Verdict tone="warn">Casi: dentro de la O no se escriben constantes. Busca la opción simplificada.</Verdict>
          ) : loose ? (
            <Verdict tone="warn">Esa es una cota superior verdadera (O solo acota por arriba), pero no la ajustada: el coste crece más despacio. Busca el orden exacto.</Verdict>
          ) : (
            <Verdict tone="warn">Esa no es. Vuelve a contar el término que más crece.</Verdict>
          )}
        </Status>
      ) : null}
      <SolutionGate resetKey={JSON.stringify(problem)}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
          {problem.kind === "algo" ? (
            <>
              <p className="text-[14px] text-muted">Coste, contando las vueltas de cada bucle (un bucle multiplica, un bloque detrás de otro suma):</p>
              <Tex display tex={`T = ${costTex(cost)}`} label={`T igual a ${costSpoken(cost)}`} className="text-[18px]" />
            </>
          ) : null}
          <Tex display tex={bigOTex(growth)} label={bigOText(growth)} className="text-[20px]" />
          <p className="text-[14px]">
            {options.some((o, i) => "none" in o && optionIsCorrect(options, i, growth))
              ? "Ese orden no está entre las opciones: la buena es «Ninguna de las otras»."
              : `Es la opción ${"abcd"[options.findIndex((_, i) => optionIsCorrect(options, i, growth))]}).`}
          </p>
        </div>
      </SolutionGate>
    </PracticeBox>
  );
}

/** Verdadero o falso sobre P, NP y O grande. */
export function PnpPractice({ ids, onSolved }: { ids: readonly string[]; onSolved?: () => void }) {
  const statements = ids.map(pnpStatement);
  const [answers, setAnswers] = useState<Array<boolean | null>>(() => ids.map(() => null));
  const [checked, setChecked] = useState(false);
  const good = statements.filter((s, i) => answers[i] === s.value).length;
  const missing = answers.filter((a) => a === null).length;
  const solved = good === statements.length;
  const reasons = (
    <ul className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
      {statements.map((s) => (
        <li key={s.id} className="flex flex-col gap-1">
          <span>
            <Chip tone={s.value ? "ok" : "crit"}>{s.value ? "Verdadera" : "Falsa"}</Chip> {s.text}
          </span>
          <span className="text-muted">{s.why}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <PracticeBox title="Verdadero o falso">
      <div className="flex flex-col gap-2">
        {statements.map((s, i) => (
          <YesNoTF key={s.id} text={`${"abcdef"[i]}) ${s.text}`} value={answers[i] ?? null} onChange={(v) => (setAnswers((xs) => xs.map((x, j) => (j === i ? v : x))), setChecked(false))} />
        ))}
      </div>
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
        <Hints
          hints={[
            "P: se resuelve en tiempo polinómico. NP: una solución propuesta se comprueba en tiempo polinómico. Por eso P ⊆ NP.",
            "NP-completo: está en NP y todo problema de NP se reduce a él. Si uno de ellos estuviera en P, sería P = NP; hoy nadie lo sabe.",
            "O grande es una cota superior y no lleva constantes; en las exponenciales sí importa la base.",
          ]}
        />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Todas bien! Mira por qué cada una es verdadera o falsa.
            </Verdict>
          ) : (
            <Verdict tone="warn">{`${good} de ${statements.length} bien.${missing > 0 ? ` Te faltan ${missing} por contestar.` : ""}`}</Verdict>
          )}
        </Status>
      ) : null}
      {checked && solved ? reasons : <SolutionGate resetKey={ids.join("|")}>{reasons}</SolutionGate>}
    </PracticeBox>
  );
}

function YesNoTF({ text, value, onChange }: { text: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return <YesNo legend={text} value={value} onChange={onChange} labels={["Verdadera", "Falsa"]} />;
}
