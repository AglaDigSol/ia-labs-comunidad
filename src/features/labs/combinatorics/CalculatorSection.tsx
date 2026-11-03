// «Calculadora guiada»: una herramienta, no una práctica. Eliges la fórmula, escribes n y k (o los
// grupos de elementos iguales) y se ve la fórmula con tus datos y su valor exacto. Para comprobar un
// problema está «¿Qué fórmula es?».
import { useId, useState } from "react";
import { integerText } from "../../../../shared/discrete/answer.ts";
import { countModel, FORMULA_IDS, FORMULAS, MAX_COUNT_N, modelProblem, substitutedTex, substitutedText, type CountingModel, type FormulaId } from "../../../../shared/discrete/count.ts";
import { Input } from "../../../components/ui/input.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { OptionList, PracticeBox } from "./common.tsx";
import { FormulaChoice } from "./CountingPractice.tsx";

const readNat = (s: string): number | null => (/^\s*\d{1,3}\s*$/.test(s) ? Number(s) : null);

function modelFor(id: FormulaId, n: number, k: number, groups: number[]): CountingModel {
  switch (id) {
    case "P":
      return { n, k: n, order: true, repetition: false };
    case "PR": {
      const total = groups.reduce((a, b) => a + b, 0);
      return { n: total, k: total, order: true, repetition: true, groups };
    }
    case "V":
      return { n, k, order: true, repetition: false };
    case "VR":
      return { n, k, order: true, repetition: true };
    case "C":
      return { n, k, order: false, repetition: false };
    case "CR":
      return { n, k, order: false, repetition: true };
  }
}

export function CalculatorSection() {
  const id = useId();
  const [formula, setFormula] = useState<FormulaId>("V");
  const [nText, setN] = useState("8");
  const [kText, setK] = useState("3");
  const [groupsText, setGroups] = useState("3, 2, 1");
  const n = readNat(nText);
  const k = readNat(kText);
  const groups = groupsText.split(/[,;\s]+/).filter((x) => x !== "").map(readNat);
  const groupsOk = groups.length >= 2 && groups.every((g) => g !== null && g > 0);

  let error: string | null = null;
  let model: CountingModel | null = null;
  if (formula === "PR") {
    if (!groupsOk) error = "Escribe al menos dos grupos, separados por comas: cuántos elementos iguales hay de cada tipo (3, 2, 1).";
    else model = modelFor(formula, 0, 0, groups as number[]);
  } else if (n === null || (formula !== "P" && k === null)) {
    error = `Escribe ${formula === "P" ? "n" : "n y k"} como números naturales (hasta ${MAX_COUNT_N}).`;
  } else {
    model = modelFor(formula, n, k ?? 0, []);
  }
  if (model && !error) error = modelProblem(model);
  const value = model && !error ? countModel(model) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <p className="text-[14px] text-muted">
          Esto es una herramienta: calcula lo que le pidas, pero no te dice qué fórmula toca. Para practicar con un enunciado, usa «¿Qué fórmula es?».
        </p>
        <OptionList legend="Fórmula" options={FORMULA_IDS.map((f) => ({ key: f, content: <FormulaChoice id={f} /> }))} value={formula} onChange={(f) => setFormula(f as FormulaId)} letters={false} />
      </div>
      <PracticeBox title="Calculadora" className="lg:col-span-7">
        <p className="text-[14px] text-muted">{FORMULAS[formula].when}</p>
        {formula === "PR" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-g`} className="text-[14px] font-semibold">
              Grupos de elementos iguales (n₁, n₂, …)
            </label>
            <Input id={`${id}-g`} className="max-w-sm font-mono" autoComplete="off" value={groupsText} onChange={(e) => setGroups(e.target.value.slice(0, 60))} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-n`} className="text-[14px] font-semibold">
                n
              </label>
              <Input id={`${id}-n`} className="w-28 font-mono" inputMode="numeric" autoComplete="off" value={nText} onChange={(e) => setN(e.target.value.slice(0, 4))} />
            </div>
            {formula !== "P" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-k`} className="text-[14px] font-semibold">
                  k
                </label>
                <Input id={`${id}-k`} className="w-28 font-mono" inputMode="numeric" autoComplete="off" value={kText} onChange={(e) => setK(e.target.value.slice(0, 4))} />
              </div>
            ) : null}
          </div>
        )}
        <div aria-live="polite" className="flex min-w-0 flex-col gap-2">
          {error ? (
            <p className="text-[14px] text-crit">{error}</p>
          ) : model && value !== null ? (
            <>
              <Tex display tex={substitutedTex(model)} label={substitutedText(model)} className="text-[20px]" />
              <p className="font-mono text-[18px] font-semibold [overflow-wrap:anywhere]">{`= ${integerText(value)}`}</p>
              <p className="text-[14px] text-muted">{`${value.toString().length} ${value.toString().length === 1 ? "cifra" : "cifras"}. Escrito como en el examen: sin separador de miles.`}</p>
            </>
          ) : null}
        </div>
      </PracticeBox>
    </div>
  );
}
