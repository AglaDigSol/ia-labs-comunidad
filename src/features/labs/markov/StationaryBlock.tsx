import { Check, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import type { Mat } from "../../../../shared/markov/matrix.ts";
import { stationary } from "../../../../shared/markov/systems.ts";
import { formatDecimal, formatFrac } from "../../../../shared/rational.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { Tex } from "../../../lib/tex.tsx";

export const NO_STATIONARY =
  "No se pudo hallar una distribución estacionaria única. La matriz puede no ser irreducible.";

// Verification only: formulas, values and checks; no narrative, no copy affordance.
export function StationaryBlock({
  names,
  P,
  hint,
}: {
  names: string[];
  /** Null while the matrix is not (yet) a valid stochastic matrix. */
  P: Mat | null;
  hint: string | null;
}) {
  const result = useMemo(() => (P ? stationary(P) : null), [P]);

  return (
    <section aria-labelledby="markov-stat-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="markov-stat-title" className="font-display text-[20px] font-semibold">
          Distribución estacionaria π
        </h2>
      </div>

      {result === null ? (
        <Chip tone="info">{hint ?? "Corrige la matriz para ver la evolución."}</Chip>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <Tex display tex="\pi P = \pi" label="Definición de la distribución estacionaria" />
            <Tex display tex="\sum_i \pi_i = 1" label="Condición de normalización" />
          </div>
          {result.kind !== "invalid" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
            <h3 className="text-[16px] font-semibold">Sistema que define π</h3>
            <Tex
              display
              tex={`\\begin{aligned}${result.equations.map((e) => e.replace(" = ", " &= ")).join(" \\\\ ")}\\end{aligned}`}
              label="Sistema que define π"
            />
          </div>
          ) : null}

          {result.kind === "unique" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                {result.pi.map((x, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Chip tone="outline" className="font-mono">
                      {`${names[j] || `Estado ${j + 1}`} ${formatDecimal(x, 4, { pad: true }).text}`}
                    </Chip>
                    {x.d !== 1n && x.d <= 100n ? (
                      <Tex tex={`\\tfrac{${x.n}}{${x.d}}`} label={formatFrac(x)} className="text-muted" />
                    ) : null}
                  </div>
                ))}
              </div>
              {result.check ? (
                <Chip tone="ok" className="self-start">
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  Comprobación: π·P = π ✓ (exacta)
                </Chip>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Chip tone="warn" className="self-start">
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                Sin π única
              </Chip>
              <p>{NO_STATIONARY}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
