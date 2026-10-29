// «Cardinales e inclusión–exclusión»: problemas de enunciado (content/conjuntos/practica.ts). Se
// rellena el diagrama de Venn de dentro hacia fuera, una capa de regiones cada vez: «Comprobar paso»
// marca las casillas mal sin decir el número correcto y, con la capa bien, la fija en el diagrama.
// Después se contestan las preguntas. Las pistas dan el procedimiento, nunca los valores.
import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SETS_PACK } from "../../../../content/conjuntos/practica.ts";
import { countOf, inclusionExclusionTex, regionLayers, solveRegions } from "../../../../shared/sets/cardinal.ts";
import { parseSetExpr, regionCount, regionExpr, regionLabel, SET_NAMES, setToTex, type SetExpr, type SetName } from "../../../../shared/sets/expr.ts";
import type { SetsCardinalProblem } from "../../../../shared/sets/schema.ts";
import { SolutionGate } from "../../../components/practice/SolutionGate.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { cn } from "../../../lib/cn.ts";
import { Tex } from "../../../lib/tex.tsx";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { Status, Verdict } from "./shared.tsx";
import { VennDiagram } from "./VennDiagram.tsx";

const exprOf = (s: string): SetExpr => {
  const r = parseSetExpr(s);
  if (!r.ok) throw new Error(`Expresión del contenido ilegible: ${s}`);
  return r.expr;
};

/** «12», «12 » o «+12» valen; lo demás no es un número natural. */
const readNat = (s: string): number | null => (/^\s*\+?\d{1,6}\s*$/.test(s) ? Number(s) : null);

function layerHints(n: 2 | 3, layer: number): string[] {
  const last = n;
  if (layer === 0) {
    return n === 2
      ? [
          "Empieza por el centro: |A ∩ B|.",
          "Si |A ∩ B| no es un dato, despéjalo de |A ∪ B| = |A| + |B| − |A ∩ B|; y si tampoco tienes |A ∪ B|, sale de |U| menos los que no están en ninguno.",
        ]
      : [
          "Empieza por el centro: |A ∩ B ∩ C|.",
          "Si |A ∩ B ∩ C| no es un dato, despéjalo de la fórmula de inclusión–exclusión, con |A ∪ B ∪ C| = |U| − |(A ∪ B ∪ C)ᶜ|.",
        ];
  }
  if (layer === last) {
    return [
      "Falta la región de fuera: los elementos de U que no están en ningún conjunto.",
      `Réstale a |U| la suma de todas las regiones de dentro, que ya tienes (es |${n === 2 ? "A ∪ B" : "A ∪ B ∪ C"}|).`,
    ];
  }
  if (n === 3 && layer === 1) {
    return [
      "Ahora las regiones que están en exactamente dos conjuntos.",
      "Por ejemplo, |A ∩ B ∩ Cᶜ| = |A ∩ B| − |A ∩ B ∩ C|: a la intersección de dos le quitas lo que también está en el tercero.",
    ];
  }
  return [
    "Ahora las regiones que están en un solo conjunto.",
    n === 2
      ? "|A ∩ Bᶜ| = |A| − |A ∩ B|, y lo mismo con B."
      : "|A ∩ Bᶜ ∩ Cᶜ| = |A| menos las otras tres regiones de A, que ya están en el diagrama.",
  ];
}

export function CardinalSection() {
  const [id, setId] = useState<string>(SETS_PACK.cardinal[0]!.id);
  const problem = SETS_PACK.cardinal.find((p) => p.id === id)!;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-md flex-col gap-2">
        <label htmlFor="cardinal-choice" className="text-[14px] font-semibold">
          Problema
        </label>
        <select id="cardinal-choice" className={cn(selectClass, "w-full font-body")} value={id} onChange={(e) => setId(e.target.value)}>
          {SETS_PACK.cardinal.map((p) => (
            <option key={p.id} value={p.id}>
              {`${p.title} (${p.sets.C === undefined ? "dos" : "tres"} conjuntos)`}
            </option>
          ))}
        </select>
      </div>
      <CardinalProblem key={id} problem={problem} />
    </div>
  );
}

/**
 * Un problema de recuento: el diagrama de dentro hacia fuera y las preguntas. Lo usan el laboratorio
 * (problemas de content/conjuntos) y el banco de ejercicios (problemas generados). `onSolved` se llama
 * al comprobar todas las respuestas bien.
 */
export function CardinalProblem({ problem, onSolved }: { problem: SetsCardinalProblem; onSolved?: () => void }) {
  const vars: SetName[] = useMemo(() => SET_NAMES.slice(0, problem.sets.C === undefined ? 2 : 3), [problem]);
  const n = vars.length as 2 | 3;
  const counts = useMemo(() => {
    const sol = solveRegions(
      vars,
      problem.data.map((d) => ({ expr: exprOf(d.expr), value: d.value })),
    );
    if (!sol.ok) throw new Error(`Problema sin solución única: ${problem.id}`);
    return sol.counts;
  }, [problem, vars]);
  const layers = useMemo(() => regionLayers(n), [n]);

  const [inputs, setInputs] = useState<string[]>(() => Array.from({ length: regionCount(n) }, () => ""));
  const [layer, setLayer] = useState(0);
  const [solved, setSolved] = useState(0);
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => problem.questions.map(() => ""));
  const [answersChecked, setAnswersChecked] = useState(false);
  const moved = useRef(false);

  // Al pasar a la capa siguiente, el foco va a su primera casilla (no al montar el problema).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const first = layers[layer]?.[0];
    if (first !== undefined) document.getElementById(`cardinal-${problem.id}-${first}`)?.focus();
  }, [layer, layers, problem.id]);

  const current = layers[layer] ?? [];
  const allDone = solved === layers.length;
  const stepDone = solved > layer;
  // Una casilla vacía no está mal: está sin responder.
  const empty = current.map((r) => inputs[r]!.trim() === "");
  const wrong = current.map((r, i) => !empty[i] && readNat(inputs[r]!) !== counts[r]);
  const bad = wrong.filter(Boolean).length;
  const missing = empty.filter(Boolean).length;
  const hintList = allDone ? [] : layerHints(n, layer);

  const fixed = new Set(layers.slice(0, solved).flat());
  const values = Array.from({ length: regionCount(n) }, (_, r) => (fixed.has(r) ? String(counts[r]) : null));
  const highlight = Array.from({ length: regionCount(n) }, (_, r) => !allDone && !stepDone && current.includes(r));

  const checkStep = () => {
    setChecked(true);
    if (bad === 0 && missing === 0) setSolved(layer + 1);
  };
  const nextStep = () => {
    moved.current = true;
    setLayer(layer + 1);
    setChecked(false);
    setHints(0);
  };
  const restart = () => {
    setInputs(inputs.map(() => ""));
    setLayer(0);
    setSolved(0);
    setChecked(false);
    setHints(0);
  };

  const questionValues = problem.questions.map((q) => countOf(exprOf(q.expr), vars, counts));
  const questionRight = answers.map((a, i) => readNat(a) === questionValues[i]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
        <h2 className="font-display text-[20px] font-semibold">{problem.title}</h2>
        <p>{problem.story}</p>
        <ul className="flex flex-col gap-1 text-[14px]">
          {vars.map((v) => (
            <li key={v}>
              <span className="font-mono font-semibold">{v}</span>
              {`: ${problem.sets[v]}`}
            </li>
          ))}
        </ul>
        <h3 className="text-[14px] font-semibold">Datos</h3>
        <ul className="flex flex-col gap-1">
          {problem.data.map((d) => (
            <li key={d.expr}>
              <Tex tex={`|${setToTex(exprOf(d.expr))}| = ${d.value}`} label={`cardinal de ${d.expr} = ${d.value}`} />
            </li>
          ))}
        </ul>
        <h3 className="text-[14px] font-semibold">Inclusión–exclusión</h3>
        <div className="max-w-full overflow-x-auto text-[14px]">
          <Tex tex={inclusionExclusionTex(n)} label="Fórmula de inclusión–exclusión" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <section aria-labelledby="cardinal-steps-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
          <h2 id="cardinal-steps-title" className="font-display text-[20px] font-semibold">
            Rellena el diagrama
          </h2>
          <p className="text-[14px] text-muted">
            De dentro hacia fuera: escribe cuántos elementos hay en cada región de este paso y pulsa «Comprobar paso». Las
            regiones del paso actual se ven rayadas.
          </p>
          <VennDiagram n={n} selected={highlight} values={values} label={`Diagrama de Venn de «${problem.title}»`} />
          {!allDone ? (
            <>
              <p className="text-[14px] font-semibold">{`Paso ${layer + 1} de ${layers.length}`}</p>
              <div className="flex flex-col gap-2">
                {current.map((r, i) => {
                  const isBad = checked && wrong[i]!;
                  const name = regionLabel(vars, r);
                  return (
                    <div key={r} className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`cardinal-${problem.id}-${r}`} className="min-w-40">
                        <Tex tex={`|${setToTex(regionExpr(vars, r))}|`} label={`cardinal de ${name}`} />
                      </label>
                      <Input
                        id={`cardinal-${problem.id}-${r}`}
                        aria-label={`|${name}|`}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={stepDone}
                        className={cn("w-24 font-mono", isBad && "border-crit")}
                        aria-invalid={isBad ? true : undefined}
                        value={inputs[r]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setInputs((prev) => prev.map((x, j) => (j === r ? v : x)));
                          setChecked(false);
                        }}
                      />
                      {isBad ? (
                        <span className="inline-flex items-center gap-1 text-[14px] text-crit">
                          <X size={16} aria-hidden="true" />
                          incorrecta
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {stepDone ? (
                  <Button variant="primary" onClick={nextStep}>
                    Siguiente paso
                  </Button>
                ) : (
                  <Button variant="primary" onClick={checkStep}>
                    <Check size={16} aria-hidden="true" />
                    Comprobar paso
                  </Button>
                )}
                <Button variant="ghost" disabled={hints >= hintList.length} onClick={() => setHints((h) => h + 1)}>
                  <Lightbulb size={16} aria-hidden="true" />
                  {hints === 0 ? "Dame una pista" : "Otra pista"}
                </Button>
                <Button variant="ghost" onClick={restart}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Empezar de nuevo
                </Button>
              </div>
              {hints > 0 ? (
                <ol className="list-decimal pl-6 text-[14px]">
                  {hintList.slice(0, hints).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
              ) : null}
              {checked ? (
                <Status>
                  {stepDone ? (
                    <Verdict tone="ok">
                      <Check size={16} aria-hidden="true" />
                      {`Paso ${layer + 1} correcto`}
                    </Verdict>
                  ) : (
                    <>
                      <Verdict tone="warn">{`${current.length - bad - missing} de ${current.length} regiones bien`}</Verdict>
                      {missing > 0 ? <span>{`Te ${missing === 1 ? "falta 1 región" : `faltan ${missing} regiones`} por rellenar.`}</span> : null}
                    </>
                  )}
                </Status>
              ) : null}
            </>
          ) : (
            <Status>
              <Verdict tone="ok">
                <Check size={16} aria-hidden="true" />
                Diagrama completo: ahora contesta las preguntas.
              </Verdict>
            </Status>
          )}
        </section>

        <section aria-labelledby="cardinal-questions-title" className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-3">
          <h2 id="cardinal-questions-title" className="font-display text-[20px] font-semibold">
            Preguntas
          </h2>
          {problem.questions.map((q, i) => {
            const isBad = answersChecked && !questionRight[i];
            return (
              <div key={q.id} className="flex flex-col gap-1">
                <label htmlFor={`question-${problem.id}-${q.id}`} className="text-[14px] font-semibold">
                  {q.prompt}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`question-${problem.id}-${q.id}`}
                    inputMode="numeric"
                    autoComplete="off"
                    className={cn("w-24 font-mono", isBad && "border-crit")}
                    aria-invalid={isBad ? true : undefined}
                    value={answers[i]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAnswers((prev) => prev.map((x, j) => (j === i ? v : x)));
                      setAnswersChecked(false);
                    }}
                  />
                  {answersChecked ? (
                    questionRight[i] ? (
                      <Check size={16} aria-label="Correcta" className="text-ok" />
                    ) : (
                      <X size={16} aria-label="Incorrecta" className="text-crit" />
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
          <Button
            variant="primary"
            className="self-start"
            onClick={() => {
              setAnswersChecked(true);
              if (questionRight.every(Boolean)) onSolved?.();
            }}
          >
            <Check size={16} aria-hidden="true" />
            Comprobar respuestas
          </Button>
          {answersChecked ? (
            <Status>
              {questionRight.every(Boolean) ? (
                <Verdict tone="ok">¡Correcto! Todas las respuestas están bien.</Verdict>
              ) : (
                <Verdict tone="warn">{`${questionRight.filter(Boolean).length} de ${problem.questions.length} respuestas correctas`}</Verdict>
              )}
            </Status>
          ) : null}
        </section>

        <SolutionGate resetKey={problem.id}>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3">
            <h3 className="font-display text-[18px] font-semibold">Diagrama completo</h3>
            <VennDiagram
              n={n}
              selected={counts.map(() => false)}
              values={counts.map(String)}
              label={`Solución: ${regionLayers(n)
                .flat()
                .map((r) => `|${regionLabel(vars, r)}| = ${counts[r]}`)
                .join("; ")}`}
            />
            <ul className="flex flex-col gap-1 text-[14px]">
              {problem.questions.map((q, i) => (
                <li key={q.id}>{`${q.prompt} ${questionValues[i]}.`}</li>
              ))}
            </ul>
          </div>
        </SolutionGate>
      </div>
    </div>
  );
}
