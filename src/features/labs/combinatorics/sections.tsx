// Secciones del laboratorio de combinatoria: cada una elige un ejemplo de content/combinatoria y
// monta su práctica (con key, para no arrastrar respuestas de otro ejemplo).
import { RefreshCw } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { COMB_PACK } from "../../../../content/combinatoria/practica.ts";
import { algorithmGrowth } from "../../../../shared/discrete/algorithms.ts";
import { costOf, growthOf } from "../../../../shared/discrete/bigo.ts";
import { bigOOptions, COMB_PNP } from "../../../../shared/exercises/discrete.ts";
import { randomSeed, rngFor } from "../../../../shared/exercises/random.ts";
import type { ExerciseLevel } from "../../../../shared/exercises/types.ts";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { levelLabel, LEVELS, Statement } from "./common.tsx";
import { ComplexityPractice, PnpPractice, type ComplexityProblem } from "./ComplexityPractice.tsx";
import { CountingPractice } from "./CountingPractice.tsx";
import { FunctionsPractice } from "./FunctionsPractice.tsx";

type Preset = { id: string; level: string; label: string; group?: string };

function PresetPicker({ label, presets, value, onChange }: { label: string; presets: readonly Preset[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  const groups = [...new Set(presets.map((p) => p.group ?? ""))];
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <select id={id} className={cn(selectClass, "w-full font-body")} value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.flatMap((g) =>
          LEVELS.map((level) => {
            const items = presets.filter((p) => (p.group ?? "") === g && p.level === level);
            return items.length === 0 ? null : (
              <optgroup key={`${g}-${level}`} label={g ? `${g} · ${levelLabel(level)}` : levelLabel(level)}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            );
          }),
        )}
      </select>
    </div>
  );
}

function Layout({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">{side}</div>
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- ¿Qué fórmula es?

export function FormulaSection() {
  const list = COMB_PACK.problems;
  const [choice, setChoice] = useState(list[0]!.id);
  const p = list.find((x) => x.id === choice)!;
  const problem = useMemo(() => ({ text: p.story, terms: [{ sign: 1 as const, model: p.model }] }), [p]);
  return (
    <Layout
      side={
        <>
          <PresetPicker label="Problema" presets={list.map((x) => ({ id: x.id, level: x.level, label: x.title }))} value={choice} onChange={setChoice} />
          <Statement>
            <h2 className="font-display text-[20px] font-semibold">{p.title}</h2>
            <p>{p.story}</p>
          </Statement>
          <p className="text-[14px] text-muted">
            Primero decide el modelo: contesta la guía (¿importa el orden?, ¿se repiten?, ¿se usan todos?) y elige la fórmula. Después calcula el número y
            escríbelo como en el examen. «Comprobar» marca lo que no encaja sin decirte la respuesta.
          </p>
        </>
      }
    >
      <CountingPractice key={p.id} problem={problem} ask="lab" title="Modelo y resultado" />
    </Layout>
  );
}

// ---------------------------------------------------------------- Funciones y cardinales

export function FunctionsSection() {
  const list = COMB_PACK.functions;
  const [choice, setChoice] = useState(list[0]!.id);
  const f = list.find((x) => x.id === choice)!;
  const label = (x: (typeof list)[number]) => `|A| = ${x.a}, |B| = ${x.b}${x.image !== undefined ? `, |f(A)| = ${x.image}` : ""}`;
  return (
    <Layout
      side={
        <>
          <PresetPicker label="Planteamiento" presets={list.map((x) => ({ id: x.id, level: x.level, label: label(x) }))} value={choice} onChange={setChoice} />
          <p className="text-[14px] text-muted">
            Como en las preguntas de «respuesta múltiple»: marca todas las afirmaciones verdaderas sobre f: A → B. «Puede» pide que exista al menos una
            función así; «necesariamente», que lo sean todas. En «Ejercicios» hay más, también con una sola respuesta entre a) y d).
          </p>
        </>
      }
    >
      <FunctionsPractice key={f.id} setting={f} statements={f.statements} multi />
    </Layout>
  );
}

// ---------------------------------------------------------------- Complejidad

export function ComplexitySection() {
  const presets: Preset[] = [
    ...COMB_PACK.algorithms.map((a) => ({ id: `a-${a.id}`, level: a.level, label: a.title, group: "Pseudocódigo" })),
    ...COMB_PACK.costs.map((c) => ({ id: `c-${c.id}`, level: c.level, label: `T = ${c.cost}`, group: "Coste" })),
  ];
  const [choice, setChoice] = useState(presets[0]!.id);
  const { problem, options } = useMemo(() => {
    const a = COMB_PACK.algorithms.find((x) => `a-${x.id}` === choice);
    const c = COMB_PACK.costs.find((x) => `c-${x.id}` === choice);
    const prob: ComplexityProblem = a ? { kind: "algo", algo: a.algo } : { kind: "cost", cost: c!.cost };
    const g = a ? algorithmGrowth(a.algo) : growthOf(costOf(c!.cost, ["n", "m"]));
    return { problem: prob, options: bigOOptions(rngFor(choice, 0), g, 0.2) };
  }, [choice]);
  return (
    <div className="flex flex-col gap-8">
      <Layout
        side={
          <>
            <PresetPicker label="Fragmento o coste" presets={presets} value={choice} onChange={setChoice} />
            <p className="text-[14px] text-muted">
              Cuenta cuántas veces se ejecuta lo de dentro: los bucles anidados multiplican, los bloques seguidos suman y se queda el término que más
              crece, sin constantes. Se pide el orden exacto (la cota ajustada), no una cota mayor. A veces la buena es «Ninguna de las otras».
            </p>
          </>
        }
      >
        <ComplexityPractice key={choice} problem={problem} options={options} />
      </Layout>
      <PnpBlock />
    </div>
  );
}

function PnpBlock() {
  const id = useId();
  const [level, setLevel] = useState<ExerciseLevel>("básico");
  const [seed, setSeed] = useState(1);
  const instance = useMemo(() => COMB_PNP.generate(seed, level), [seed, level]);
  return (
    <Layout
      side={
        <>
          <h2 className="font-display text-[20px] font-semibold">P y NP</h2>
          <p className="text-[14px] text-muted">Decide si cada afirmación es verdadera o falsa. Al acertarlas todas verás por qué.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={id} className="text-[14px] font-semibold">
                Nivel
              </label>
              <select id={id} className={cn(selectClass, "font-body")} value={level} onChange={(e) => setLevel(e.target.value as ExerciseLevel)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {levelLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => setSeed(randomSeed())}>
              <RefreshCw size={16} aria-hidden="true" />
              Otras afirmaciones
            </Button>
          </div>
        </>
      }
    >
      <PnpPractice key={instance.ids.join("|")} ids={instance.ids} />
    </Layout>
  );
}
