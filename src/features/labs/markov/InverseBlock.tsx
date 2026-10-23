import { Check, TriangleAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Mat, Vec } from "../../../../shared/markov/matrix.ts";
import { inverseProblem } from "../../../../shared/markov/systems.ts";
import { validateDistribution } from "../../../../shared/markov/validate.ts";
import { formatDecimal, formatFrac, parseNumber, type Frac } from "../../../../shared/rational.ts";
import { Chip } from "../../../components/ui/chip.tsx";
import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.tsx";
import { Tex } from "../../../lib/tex.tsx";
import { MAX_CELL } from "./markov-storage.ts";

export const vInvId = (j: number) => `markov-vinv-${j}`;

const minus = (s: string) => s.replace("-", "−");
const txt = (x: Frac) => {
  const f = formatDecimal(x, 6);
  return f.exact ? f.text : `≈ ${f.text}`;
};

// Verification only (D-07, MRKV-05): formulas, values and validity; no narrative, no copy affordance.
export function InverseBlock({
  names,
  P,
  hint,
  v,
  onV,
}: {
  names: string[];
  /** Null while the matrix is not (yet) a valid stochastic matrix. */
  P: Mat | null;
  hint: string | null;
  v: string[];
  onV: (j: number, text: string) => void;
}) {
  const [mode, setMode] = useState<"inversa" | "sistema">("inversa");

  const parsed = useMemo(() => {
    const errors = new Map<number, string>();
    const vals: Frac[] = [];
    let complete = true;
    v.forEach((cell, j) => {
      if (cell.trim() === "") {
        complete = false;
        return;
      }
      const r = parseNumber(cell);
      if (r.ok) vals.push(r.value);
      else {
        complete = false;
        errors.set(j, r.error);
      }
    });
    const vec: Vec | null = complete ? vals : null;
    const dist = vec ? validateDistribution(vec) : null;
    return { errors, vec, dist };
  }, [v]);

  const vMessage =
    parsed.dist && !parsed.dist.ok
      ? `v debe sumar 1 y no tener valores negativos. Ahora suma ${txt(parsed.dist.sum)}.`
      : null;

  const result = useMemo(
    () => (P && parsed.vec && parsed.dist?.ok ? inverseProblem(P, parsed.vec) : null),
    [P, parsed],
  );
  const label = (i: number) => names[i] || `Estado ${i + 1}`;

  return (
    <section aria-labelledby="markov-inv-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="markov-inv-title" className="font-display text-[20px] font-semibold">
          Problema inverso u₀
        </h2>
      </div>

      {P === null ? (
        <Chip tone="info">{hint ?? "Corrige la matriz para ver la evolución."}</Chip>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Distribución dada (v)</span>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${v.length}, minmax(72px,1fr)) auto` }}
            >
              {v.map((val, j) => (
                <input
                  key={j}
                  id={vInvId(j)}
                  aria-label={`v(${j + 1})`}
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={MAX_CELL}
                  value={val}
                  aria-invalid={parsed.errors.has(j) || undefined}
                  onChange={(e) => onV(j, e.target.value)}
                  className={`h-12 w-full min-w-[72px] rounded-md border bg-raised px-2 text-right font-mono text-[16px] text-fg ${
                    parsed.errors.has(j) ? "border-2 border-crit" : "border-border"
                  }`}
                />
              ))}
              <span className="self-center font-mono text-[14px] text-muted">
                {parsed.dist ? `Σ ${txt(parsed.dist.sum)}` : ""}
              </span>
            </div>
            {[...parsed.errors.entries()].map(([j, msg]) => (
              <p key={j} className="flex gap-2 text-[14px] text-crit">
                <span className="font-mono">{`v(${j + 1})`}</span>
                <span>{msg}</span>
              </p>
            ))}
            {vMessage ? <p className="text-[14px] text-crit">{vMessage}</p> : null}
          </div>

          {result === null ? (
            <Chip tone="info">Corrige v para ver u₀.</Chip>
          ) : result.kind === "singular" ? (
            <div className="flex flex-col gap-2">
              <Chip tone="warn" className="self-start">
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                P no es invertible
              </Chip>
              <p>P no es invertible, así que no hay un único u₀ con u₀P = v₀.</p>
            </div>
          ) : (
            <>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(next) => {
                  if (next === "inversa" || next === "sistema") setMode(next);
                }}
                aria-label="Método de resolución"
              >
                <ToggleGroupItem value="inversa">Con la inversa</ToggleGroupItem>
                <ToggleGroupItem value="sistema">Con el sistema</ToggleGroupItem>
              </ToggleGroup>

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
                <Tex display tex="u_0 P = v" label="Planteamiento" />
                {mode === "inversa" ? (
                  <>
                    <Tex display tex="u_0 = v\,P^{-1}" label="Despeje con la inversa" />
                    <Tex
                      display
                      tex={`P^{-1} = ${result.inverseTex}`}
                      label="Matriz inversa de P"
                    />
                  </>
                ) : (
                  <Tex
                    display
                    tex={`\\begin{aligned}${result.systemTex.map((e) => e.replace(" = ", " &= ")).join(" \\\\ ")}\\end{aligned}`}
                    label="Sistema de u₀P = v"
                  />
                )}
                <Tex
                  tex={`\\det P = ${result.det.d === 1n ? result.det.n : `\\tfrac{${result.det.n}}{${result.det.d}}`}`}
                  label="Determinante de P"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {result.u0.map((x, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Chip tone="outline" className="font-mono">
                      {`${label(j)} ${formatDecimal(x, 4, { pad: true }).text}`}
                    </Chip>
                    {x.d !== 1n && x.d <= 100n ? (
                      <Tex
                        tex={`${x.n < 0n ? "-" : ""}\\tfrac{${x.n < 0n ? -x.n : x.n}}{${x.d}}`}
                        label={minus(formatFrac(x))}
                        className="text-muted"
                      />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2" aria-live="polite">
                {result.valid ? (
                  <Chip tone="ok" className="self-start">
                    <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                    Distribución válida
                  </Chip>
                ) : (
                  <>
                    <Chip tone="crit" className="self-start">
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                      No es una distribución
                    </Chip>
                    {result.negatives.map((i) => (
                      <p key={i} className="text-[14px] text-crit">
                        {`La componente ${label(i)} de u₀ es negativa (${minus(formatFrac(result.u0[i]!))}).`}
                      </p>
                    ))}
                    {result.sum.n !== result.sum.d ? (
                      <p className="text-[14px] text-crit">
                        {`Las componentes de u₀ suman ${txt(result.sum)}, no 1.`}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
