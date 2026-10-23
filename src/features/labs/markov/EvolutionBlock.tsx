import type { EvolutionStep } from "../../../../shared/markov/evolution.ts";
import type { Vec } from "../../../../shared/markov/matrix.ts";
import { formatDecimal, toNumber } from "../../../../shared/rational.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { EvolutionChart } from "./EvolutionChart.tsx";

// Verification only (D-07, MRKV-05): steps and numbers, no narrative conclusion, no copy affordance.
export function EvolutionBlock({
  names,
  vectors,
  steps,
}: {
  names: string[];
  vectors: Vec[];
  steps: EvolutionStep[];
}) {
  return (
    <section aria-labelledby="markov-evo-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="markov-evo-title" className="font-display text-[20px] font-semibold">
          Evolución v₀ → vₙ
        </h2>
        <p className="text-[14px] text-muted">Comprueba tu desarrollo</p>
      </div>

      <ol className="flex flex-col gap-4">
        {steps.map((step) => {
          const result = vectors[step.k]!;
          return (
            <li key={step.k} className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
              <h3 className="text-[16px] font-semibold">{step.title}</h3>
              <Tex display tex={step.tex[0]!} label={`Producto del paso ${step.k}`} />
              <Tex
                display
                tex={`\\begin{aligned}${step.tex.slice(1).join(" \\\\ ")}\\end{aligned}`}
                label={`Componentes del paso ${step.k}`}
              />
              <div className="flex flex-wrap gap-3">
                {result.map((x, j) => {
                  const pct = Math.max(0, Math.min(100, toNumber(x) * 100));
                  return (
                    <div key={j} className="flex min-w-32 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Chip tone="outline" className="font-mono">
                          {`${names[j] || `Estado ${j + 1}`} ${formatDecimal(x, 4, { pad: true }).text}`}
                        </Chip>
                        {x.d <= 20n && x.d !== 1n ? (
                          <Tex tex={`\\tfrac{${x.n}}{${x.d}}`} className="text-muted" />
                        ) : null}
                      </div>
                      <div className="h-2 rounded-sm bg-sunken" aria-hidden="true">
                        <div className="h-2 rounded-sm bg-fg" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <EvolutionChart names={names} series={vectors.map((v) => v.map(toNumber))} exact={vectors} />
    </section>
  );
}
