// Secciones del laboratorio de probabilidad: cada una elige un ejemplo de content/probabilidad y monta
// su práctica. Cada práctica se vuelve a montar (key) al cambiar de ejemplo, así que no arrastra
// respuestas de otro. La condicionada con un dado sale del generador de ejercicios («Otro dado»).
import { RefreshCw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { PROB_PACK } from "../../../../content/probabilidad/practica.ts";
import { PROB_DIE_COND, qFrac } from "../../../../shared/exercises/probability.ts";
import { randomSeed } from "../../../../shared/exercises/random.ts";
import { coinGameRows, dieGameRows } from "../../../../shared/probability/variable.ts";
import { loadedDieWeights } from "../../../../shared/probability/events.ts";
import { distFromContent, readProb } from "../../../../shared/probability/schema.ts";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { dataText, levelLabel, LEVELS, Statement } from "./common.tsx";
import { ContingencyPractice, DieCondPractice, PairPractice } from "./ConditionalPractice.tsx";
import { DistributionExplorer, DistributionPractice } from "./DistributionPractice.tsx";
import { GamePractice, PenaltyPractice, ProductPractice } from "./ExpectationPractice.tsx";
import { TreePractice } from "./TreePractice.tsx";

type Preset = { id: string; level: string; label: string };

/** Lista de ejemplos agrupados por nivel. */
function Picker({ label, presets, value, onChange }: { label: string; presets: Preset[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </label>
      <select id={id} className={cn(selectClass, "w-full font-body")} value={value} onChange={(e) => onChange(e.target.value)}>
        {LEVELS.map((level) => {
          const items = presets.filter((p) => p.level === level);
          return items.length === 0 ? null : (
            <optgroup key={level} label={levelLabel(level)}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

function usePreset<T extends { id: string }>(list: readonly T[]) {
  const [id, setId] = useState(list[0]!.id);
  return { id, setId, item: list.find((x) => x.id === id) ?? list[0]! };
}

// ---------------------------------------------------------------- Condicionada y Bayes

export function ConditionalSection() {
  const tree = usePreset(PROB_PACK.trees);
  const table = usePreset(PROB_PACK.contingency);
  const [dieSeed, setDieSeed] = useState(() => randomSeed());
  const t = tree.item;
  const probTree = useMemo(() => ({ priors: t.priors.map(readProb), likelihoods: t.likelihoods.map(readProb) }), [t]);
  const c = table.item;
  const cont = useMemo(() => ({ ab: readProb(c.ab), aNotB: readProb(c.aNotB), notAB: readProb(c.notAB), notANotB: readProb(c.notANotB) }), [c]);
  const die = useMemo(() => PROB_DIE_COND.generate(dieSeed, "medio"), [dieSeed]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Picker label="Árbol" presets={PROB_PACK.trees.map((x) => ({ id: x.id, level: x.level, label: x.title }))} value={tree.id} onChange={tree.setId} />
        <Statement>
          <p>{t.story}</p>
          <p className="text-[14px] text-muted">{`C: ${t.event}. Se pide P(C) y P(${t.branches[t.ask]} | C).`}</p>
        </Statement>
        <TreePractice key={t.id} tree={probTree} branches={t.branches} hiddenPrior={t.hiddenPrior ?? null} ask={t.ask} />
      </div>
      <div className="flex flex-col gap-3">
        <Picker label="Tabla de contingencia" presets={PROB_PACK.contingency.map((x) => ({ id: x.id, level: x.level, label: x.title }))} value={table.id} onChange={table.setId} />
        <Statement>
          <p>{c.story}</p>
        </Statement>
        <ContingencyPractice key={c.id} c={cont} a={c.a} b={c.b} given={c.given} />
      </div>
      <div className="flex flex-col gap-3">
        <DieCondPractice key={dieSeed} odd={die.odd} even={die.even} a={die.a} b={die.b} options={die.options.map(qFrac)} />
        <Button className="self-start" onClick={() => setDieSeed(randomSeed())}>
          <RefreshCw size={16} aria-hidden="true" />
          Otro dado
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Independencia

export function IndependenceSection() {
  const pair = usePreset(PROB_PACK.pairs);
  const p = pair.item;
  const [pA, pB, value] = useMemo(() => [readProb(p.pA), readProb(p.pB), readProb(p.value)], [p]);
  return (
    <div className="flex flex-col gap-3">
      <Picker label="Ejemplo" presets={PROB_PACK.pairs.map((x) => ({ id: x.id, level: x.level, label: `${x.a[0]!.toUpperCase()}${x.a.slice(1)} / ${x.b}` }))} value={pair.id} onChange={pair.setId} />
      <Statement>
        <p>{p.story}</p>
        <p className="text-[14px] text-muted">{`A: ${p.a}. B: ${p.b}.`}</p>
      </Statement>
      <PairPractice key={p.id} pA={pA} pB={pB} given={p.given} value={value} multi />
    </div>
  );
}

// ---------------------------------------------------------------- Distribuciones

export function DistributionsSection() {
  const story = usePreset(PROB_PACK.stories);
  const s = story.item;
  const d = useMemo(() => distFromContent(s.dist), [s]);
  return (
    <div className="flex flex-col gap-6">
      <DistributionExplorer />
      <div className="flex flex-col gap-3">
        <Picker label="Historia" presets={PROB_PACK.stories.map((x) => ({ id: x.id, level: x.level, label: x.title }))} value={story.id} onChange={story.setId} />
        <Statement>
          <p>{s.story}</p>
        </Statement>
        <DistributionPractice key={s.id} d={d} k={s.k} ask={s.ask} identify title="¿Qué distribución es? Calcula" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Valor esperado y juegos

export function ExpectationSection() {
  const game = usePreset(PROB_PACK.games);
  const pen = usePreset(PROB_PACK.penalties);
  const g = game.item;
  const rows = useMemo(() => (g.kind === "dado" ? dieGameRows(g.rule, loadedDieWeights(g.odd, g.even)) : coinGameRows(g.coins, g.payoffs)), [g]);
  const pe = pen.item;
  const prod = PROB_PACK.products[0]!;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Picker label="Juego" presets={PROB_PACK.games.map((x) => ({ id: x.id, level: x.level, label: x.title }))} value={game.id} onChange={game.setId} />
        <Statement>
          <p>{g.story}</p>
        </Statement>
        <GamePractice key={g.id} rows={rows} outcome={g.kind === "dado" ? "Cara" : "Resultado"} askVariance={g.level === "avanzado"} />
      </div>
      <div className="flex flex-col gap-3">
        <Picker
          label="Test"
          presets={PROB_PACK.penalties.map((x) => ({ id: x.id, level: x.level, label: `${x.options} opciones, acierto ${x.reward}, media ${dataText(readProb(x.target))}` }))}
          value={pen.id}
          onChange={pen.setId}
        />
        <PenaltyPractice key={pe.id} options={pe.options} reward={readProb(pe.reward)} target={readProb(pe.target)} />
      </div>
      <div className="flex flex-col gap-3">
        <Statement>
          <p>{prod.story}</p>
        </Statement>
        <ProductPractice x={{ n: prod.x.n, p: readProb(prod.x.p) }} y={{ n: prod.y.n, p: readProb(prod.y.p) }} />
      </div>
    </div>
  );
}

