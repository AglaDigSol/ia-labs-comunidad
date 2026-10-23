import { useState } from "react";
import type { Vec } from "../../../../shared/markov/matrix.ts";
import { formatDecimal } from "../../../../shared/rational.ts";
import { cn } from "../../../lib/cn.ts";

const W = 640;
const H = 240;
const M = { left: 40, right: 96, top: 16, bottom: 24 };
const COLORS = [
  "var(--text)",
  "var(--text-muted)",
  "color-mix(in srgb, var(--text) 55%, transparent)",
  "color-mix(in srgb, var(--text) 35%, transparent)",
  "var(--text-muted)",
];
const DASHES = [undefined, "10 5", "8 3 2 3", "2 4", "14 4 2 4"];
const SHAPES = ["circle", "square", "triangle", "diamond", "cross"] as const;

function Marker({ shape, x, y }: { shape: (typeof SHAPES)[number]; x: number; y: number }) {
  const r = 4;
  switch (shape) {
    case "circle":
      return <circle cx={x} cy={y} r={r} fill="currentColor" />;
    case "square":
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill="currentColor" />;
    case "triangle":
      return <polygon points={`${x},${y - r - 1} ${x - r - 1},${y + r} ${x + r + 1},${y + r}`} fill="currentColor" />;
    case "diamond":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} fill="currentColor" />;
    case "cross":
      return (
        <path
          d={`M${x - r},${y - r} L${x + r},${y + r} M${x - r},${y + r} L${x + r},${y - r}`}
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
        />
      );
  }
}

/** Hand-rolled SVG chart. `series[k][s]` = probability of state s at step k (plot only). */
export function EvolutionChart({
  names,
  series,
  exact,
}: {
  names: string[];
  series: number[][];
  exact: Vec[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const states = names.length;
  const steps = series.length - 1;
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const x = (k: number) => M.left + (steps === 0 ? 0 : (k / steps) * pw);
  const y = (p: number) => M.top + (1 - Math.max(0, Math.min(1, p))) * ph;
  const label = (s: number) => names[s] || `Estado ${s + 1}`;
  const fmt = (k: number, s: number) => formatDecimal(exact[k]![s]!, 4, { pad: true }).text;

  // Nudge end labels so they do not overlap.
  const ends = Array.from({ length: states }, (_, s) => ({ s, y: y(series[steps]![s]!) })).sort(
    (a, b) => a.y - b.y,
  );
  for (let i = 1; i < ends.length; i++) {
    if (ends[i]!.y - ends[i - 1]!.y < 14) ends[i]!.y = ends[i - 1]!.y + 14;
  }
  const labelY = new Map(ends.map((e) => [e.s, e.y]));

  const summary =
    "Evolución de la probabilidad de cada estado de k = 0 a " +
    `${steps}: ` +
    Array.from({ length: states }, (_, s) => `${label(s)} pasa de ${fmt(0, s)} a ${fmt(steps, s)}`).join("; ");

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Series del gráfico" className="flex flex-wrap gap-2">
        {Array.from({ length: states }, (_, s) => (
          <button
            key={s}
            type="button"
            aria-pressed={selected === s}
            onClick={() => setSelected(selected === s ? null : s)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-[14px] font-semibold",
              selected === s ? "border-accent bg-accent-soft" : "border-border bg-raised hover:bg-sunken",
            )}
          >
            <svg width="22" height="12" aria-hidden="true">
              <g
                className={selected === s ? "text-accent" : undefined}
                style={selected === s ? undefined : { color: COLORS[s] }}
              >
                <line x1="0" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2" strokeDasharray={DASHES[s]} />
                <Marker shape={SHAPES[s]!} x={11} y={6} />
              </g>
            </svg>
            {label(s)}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="h-[200px] sm:h-[240px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={summary}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="font-mono">
              {formatDecimal({ n: BigInt(Math.round(t * 100)), d: 100n }, 2).text}
            </text>
          </g>
        ))}
        {Array.from({ length: steps + 1 }, (_, k) => (
          <text key={k} x={x(k)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {k}
          </text>
        ))}
        {Array.from({ length: states }, (_, s) => {
          const isSel = selected === s;
          const dim = selected !== null && !isSel;
          return (
            <g
              key={s}
              data-series={s}
              className={isSel ? "text-accent" : undefined}
              style={isSel ? undefined : { color: COLORS[s], opacity: dim ? 0.45 : 1 }}
            >
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth={isSel ? 3 : 2}
                strokeDasharray={DASHES[s]}
                points={series.map((row, k) => `${x(k)},${y(row[s]!)}`).join(" ")}
              />
              {series.map((row, k) => (
                <g key={k}>
                  <title>{`${label(s)}, k=${k}: ${fmt(k, s)}`}</title>
                  <Marker shape={SHAPES[s]!} x={x(k)} y={y(row[s]!)} />
                </g>
              ))}
              <text
                x={x(steps) + 10}
                y={(labelY.get(s) ?? 0) + 4}
                fontSize="13"
                fill="currentColor"
                fontWeight={isSel ? 700 : 500}
              >
                {label(s)}
              </text>
            </g>
          );
        })}
      </svg>

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center">Ver los valores del gráfico</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-[14px]">
            <thead>
              <tr>
                <th scope="col" className="p-2">k</th>
                {Array.from({ length: states }, (_, s) => (
                  <th key={s} scope="col" className="p-2">
                    {label(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((_, k) => (
                <tr key={k} className="border-t border-border">
                  <th scope="row" className="p-2 font-mono">{k}</th>
                  {Array.from({ length: states }, (_, s) => (
                    <td key={s} className="p-2 font-mono">
                      {fmt(k, s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
