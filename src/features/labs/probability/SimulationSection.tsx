// «Simulación»: repite N veces un experimento (con semilla, así que se puede repetir igual) y dibuja
// cómo la frecuencia relativa del suceso se acerca a su probabilidad exacta.
import { Play } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { MAX_SEED } from "../../../../shared/exercises/random.ts";
import {
  coinSpace,
  dieSpace,
  eventWhere,
  isFigure,
  probOf,
  productSpace,
  repeatSpace,
  spanishDeck,
  type ProbEvent,
  type SampleSpace,
} from "../../../../shared/probability/events.ts";
import { decimalComma } from "../../../../shared/probability/format.ts";
import { simulateFrequency, type SimulationPoint } from "../../../../shared/probability/simulation.ts";
import { toNumber } from "../../../../shared/rational.ts";
import { Button } from "../../../components/ui/button.tsx";
import { cn } from "../../../lib/cn.ts";
import { selectClass } from "../boole/AxiomPractice.tsx";
import { FrequencyChart, LegendItem } from "./charts.tsx";
import { PracticeBox, probWithDecimal } from "./common.tsx";

type Experiment = { id: string; label: string; make: () => { space: SampleSpace<unknown>; event: ProbEvent } };

const wrap = <T,>(space: SampleSpace<T>, pred: (x: T) => boolean) => ({ space: space as SampleSpace<unknown>, event: eventWhere(space, pred) });

export const EXPERIMENTS: Experiment[] = [
  { id: "seis", label: "Sacar un 6 con un dado", make: () => wrap(dieSpace(), (x) => x === 6) },
  { id: "suma-siete", label: "Sumar 7 con dos dados", make: () => wrap(productSpace(dieSpace(), dieSpace()), ([a, b]) => a + b === 7) },
  { id: "alguna-cara", label: "Al menos una cara con tres monedas", make: () => wrap(repeatSpace(coinSpace(), 3), (xs) => xs.includes("C")) },
  { id: "figura", label: "Sacar una figura de la baraja española", make: () => wrap(spanishDeck(), isFigure) },
  { id: "impar-trucado", label: "Impar con un dado trucado (impares el doble)", make: () => wrap(dieSpace([2, 1, 2, 1, 2, 1]), (x) => x % 2 === 1) },
];

const SIZES = [10, 100, 1000, 10000, 100000];

export function SimulationSection() {
  const id = useId();
  const [exp, setExp] = useState(EXPERIMENTS[0]!.id);
  const [n, setN] = useState(1000);
  const [seedText, setSeedText] = useState("2026");
  const [run, setRun] = useState<{ points: SimulationPoint[]; key: string } | null>(null);
  const experiment = EXPERIMENTS.find((e) => e.id === exp) ?? EXPERIMENTS[0]!;
  const { space, event } = useMemo(() => experiment.make(), [experiment]);
  const p = probOf(space, event);
  const seed = /^\d{1,10}$/.test(seedText.trim()) ? Math.min(MAX_SEED, Number(seedText.trim())) : null;
  const key = `${exp}|${n}|${seed}`;
  const current = run && run.key === key ? run.points : null;
  const last = current?.at(-1);
  return (
    <PracticeBox title="Frecuencia relativa y probabilidad">
      <p className="text-[14px] text-muted">
        La ley de los grandes números dice que, al repetir muchas veces un experimento, la frecuencia relativa de un suceso se acerca a su probabilidad. Con
        la misma semilla, la simulación sale igual.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-exp`} className="text-[14px] font-semibold">
            Experimento
          </label>
          <select id={`${id}-exp`} className={cn(selectClass, "w-full font-body")} value={exp} onChange={(e) => setExp(e.target.value)}>
            {EXPERIMENTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-n`} className="text-[14px] font-semibold">
            Repeticiones
          </label>
          <select id={`${id}-n`} className={cn(selectClass, "font-body")} value={n} onChange={(e) => setN(Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s.toLocaleString("es-ES")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-seed`} className="text-[14px] font-semibold">
            Semilla
          </label>
          <input
            id={`${id}-seed`}
            inputMode="numeric"
            autoComplete="off"
            value={seedText}
            aria-invalid={seed === null ? true : undefined}
            onChange={(e) => setSeedText(e.target.value.slice(0, 10))}
            className="h-11 w-32 rounded-md border border-border bg-sunken px-3 font-mono text-[16px] text-fg"
          />
        </div>
        <Button variant="primary" disabled={seed === null} onClick={() => seed !== null && setRun({ key, points: simulateFrequency(space, event, n, seed) })}>
          <Play size={16} aria-hidden="true" />
          Simular
        </Button>
      </div>
      {seed === null ? <p className="text-[14px] text-crit">La semilla es un número entero (sin signo).</p> : null}
      {current && last ? (
        <>
          <FrequencyChart
            points={current}
            p={toNumber(p)}
            label={`Frecuencia relativa de «${experiment.label}» en ${n.toLocaleString("es-ES")} repeticiones, en escala logarítmica, frente a la probabilidad ${probWithDecimal(p)}. Al final vale ${decimalComma(last.freq, 4)}.`}
          />
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Leyenda">
            <LegendItem label="Frecuencia relativa" color="var(--accent)" style="solid" shape="circle" />
            <LegendItem label="Probabilidad" color="var(--warn)" style="dashed" />
          </ul>
          <p role="status" className="text-[14px]">
            {`${last.hits.toLocaleString("es-ES")} de ${last.n.toLocaleString("es-ES")} veces: frecuencia ${decimalComma(last.freq, 4)}. Probabilidad exacta: ${probWithDecimal(p, 4)}. Diferencia: ${decimalComma(Math.abs(last.freq - toNumber(p)), 4)}.`}
          </p>
        </>
      ) : (
        <p className="text-[14px] text-muted">{`Probabilidad exacta del suceso: ${probWithDecimal(p, 4)}. Pulsa «Simular» para ver la frecuencia.`}</p>
      )}
    </PracticeBox>
  );
}
