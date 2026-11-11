// «Funciones y cardinales»: con |A| y |B| (o A ⊂ B, y a veces |f(A)|), elegir la afirmación verdadera
// entre a) y d) o marcar todas las verdaderas. «Comprobar» dice si está bien o cuántas están bien
// marcadas, sin decir cuáles; con todo bien se ven las explicaciones. La solución, detrás de
// SolutionGate.
import { Check } from "lucide-react";
import { useState } from "react";
import { functionHints, statementReason, statementText, statementTrue, type FnSetting, type FnStatement } from "../../../../shared/discrete/functions.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { CheckList, Hints, OptionList, PracticeBox, Status, Verdict } from "./common.tsx";

/** Los datos: |A|, |B| (o A ⊂ B) y |f(A)|. */
export function SettingView({ setting }: { setting: FnSetting }) {
  const parts = [
    ...(setting.subset ? [{ tex: "A \\subset B", label: "A es un subconjunto propio de B" }] : []),
    { tex: `|A| = ${setting.a}`, label: `cardinal de A igual a ${setting.a}` },
    { tex: `|B| = ${setting.b}`, label: `cardinal de B igual a ${setting.b}` },
    ...(setting.image !== undefined ? [{ tex: `|f(A)| = ${setting.image}`, label: `cardinal de f de A igual a ${setting.image}` }] : []),
  ];
  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[18px]">
      <Tex tex="f\colon A \to B" label="f de A en B" />
      {parts.map((p) => (
        <Tex key={p.tex} tex={p.tex} label={p.label} />
      ))}
    </p>
  );
}

export function FunctionsPractice({ setting, statements, multi, onSolved }: { setting: FnSetting; statements: readonly FnStatement[]; multi: boolean; onSolved?: () => void }) {
  const truth = statements.map((s) => statementTrue(s, setting));
  const [one, setOne] = useState<string | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const choices = statements.map((s, i) => ({ key: String(i), content: statementText(s) }));
  const goodCount = multi ? truth.filter((t, i) => t === marked.has(String(i))).length : 0;
  const solved = multi ? goodCount === statements.length : one !== null && truth[Number(one)] === true;
  const resetKey = JSON.stringify([setting, statements]);

  return (
    <PracticeBox title={multi ? "Marca todas las verdaderas" : "Elige la verdadera"}>
      <SettingView setting={setting} />
      {multi ? (
        <CheckList legend="¿Qué afirmaciones son verdaderas? (puede haber varias)" options={choices} value={marked} onChange={(v) => (setMarked(v), setChecked(false))} />
      ) : (
        <OptionList legend="¿Cuál de estas afirmaciones es verdadera?" options={choices} value={one} onChange={(k) => (setOne(k), setChecked(false))} invalid={checked && !solved} />
      )}
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
        <Hints hints={functionHints(setting)} />
      </div>
      {checked ? (
        <Status>
          {solved ? (
            <Verdict tone="ok">
              <Check size={16} aria-hidden="true" />
              ¡Correcto!
            </Verdict>
          ) : multi ? (
            <Verdict tone="warn">{`${goodCount} de ${statements.length} bien marcadas o bien dejadas sin marcar. Revisa las demás.`}</Verdict>
          ) : (
            <Verdict tone="warn">{one === null ? "Elige una opción." : "Esa no es verdadera. Vuelve a pensarlo."}</Verdict>
          )}
        </Status>
      ) : null}
      {checked && solved ? <Reasons setting={setting} statements={statements} truth={truth} /> : null}
      {checked && solved ? null : (
        <SolutionGate resetKey={resetKey}>
          <Reasons setting={setting} statements={statements} truth={truth} />
        </SolutionGate>
      )}
    </PracticeBox>
  );
}

function Reasons({ setting, statements, truth }: { setting: FnSetting; statements: readonly FnStatement[]; truth: boolean[] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3 text-[14px]">
      {statements.map((s, i) => (
        <li key={i} className="flex flex-col gap-1">
          <span>
            <Chip tone={truth[i] ? "ok" : "crit"}>{truth[i] ? "Verdadera" : "Falsa"}</Chip> {statementText(s)}
          </span>
          <span className="text-muted">{statementReason(s, setting)}</span>
        </li>
      ))}
    </ul>
  );
}
