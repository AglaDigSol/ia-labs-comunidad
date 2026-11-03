// Dibujos del laboratorio de probabilidad, en SVG con los colores del tema y al estilo de los de
// cálculo: el árbol de probabilidad (cada rama con su valor, «?» si falta, y las ramas marcadas tras
// comprobar con trazo discontinuo y ✗), el diagrama de barras de la función de probabilidad con la
// función de distribución escalonada encima, y la frecuencia relativa de una simulación frente a la
// probabilidad. Nada se distingue solo por el color: trazos (continuo, discontinuo), formas y
// rayado, con leyenda; el resumen va en aria-label y los valores en tablas aparte.
import { useId } from "react";
import { decimalComma } from "../../../../shared/probability/format.ts";
import { LegendItem } from "../calculus/charts.tsx";

export { LegendItem };

// ---------------------------------------------------------------- Árbol

export type EdgeState = "dato" | "respuesta" | "mal" | "vacío";
export type TreeEdge = { text: string; state: EdgeState };

const EDGE_COLOR: Record<EdgeState, string> = { dato: "var(--text)", respuesta: "var(--accent)", mal: "var(--crit)", vacío: "var(--text-muted)" };

/**
 * Árbol de dos niveles: la raíz, las ramas de la partición (A₁, A₂…) y, de cada una, C y Cᶜ. `first`
 * son los textos de las ramas del primer nivel; `second[i]` = [rama a C, rama a Cᶜ] de Aᵢ; `leaves[i]`
 * = texto de P(Aᵢ ∩ C).
 */
export function TreeDiagram({
  branches,
  first,
  second,
  leaves,
  label,
}: {
  branches: readonly string[];
  first: readonly TreeEdge[];
  second: ReadonlyArray<readonly [TreeEdge, TreeEdge]>;
  leaves: readonly TreeEdge[];
  label: string;
}) {
  const n = branches.length;
  const W = 640;
  const rowH = 52;
  const H = n * 2 * rowH + 16;
  const rootY = H / 2;
  const x0 = 24;
  const x1 = 250;
  const x2 = 470;
  const leafY = (i: number, j: number) => 8 + (2 * i + j) * rowH + rowH / 2;
  const midY = (i: number) => (leafY(i, 0) + leafY(i, 1)) / 2;
  const edge = (key: string, ax: number, ay: number, bx: number, by: number, e: TreeEdge) => {
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const text = e.state === "mal" ? `✗ ${e.text}` : e.text;
    return (
      <g key={key} data-edge={key} data-state={e.state}>
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={EDGE_COLOR[e.state]} strokeWidth={e.state === "mal" ? 2.5 : 2} strokeDasharray={e.state === "mal" ? "7 5" : e.state === "vacío" ? "2 4" : undefined} />
        <rect x={mx - 48} y={my - 13} width={96} height={24} rx={4} fill="var(--surface-raised)" stroke={EDGE_COLOR[e.state]} strokeWidth={1} />
        <text x={mx} y={my + 4} textAnchor="middle" fontSize="13" fill={EDGE_COLOR[e.state]} className="font-mono">
          {text.length > 13 ? `${text.slice(0, 12)}…` : text}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="h-auto w-full rounded-lg border border-border bg-raised" role="img" aria-label={label}>
      <circle cx={x0} cy={rootY} r={6} fill="var(--text)" />
      {branches.map((b, i) => (
        <g key={b}>
          {edge(`p${i}`, x0, rootY, x1 - 20, midY(i), first[i]!)}
          {edge(`c${i}`, x1 + 20, midY(i), x2 - 22, leafY(i, 0), second[i]![0])}
          {edge(`n${i}`, x1 + 20, midY(i), x2 - 22, leafY(i, 1), second[i]![1])}
          <text x={x1} y={midY(i) + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text)">
            {b.length > 10 ? `${b.slice(0, 9)}…` : b}
          </text>
          <text x={x2} y={leafY(i, 0) + 5} fontSize="15" fontWeight="600" fill="var(--text)">
            C
          </text>
          <text x={x2} y={leafY(i, 1) + 5} fontSize="15" fontWeight="600" fill="var(--text)">
            Cᶜ
          </text>
          <text x={x2 + 26} y={leafY(i, 0) + 5} fontSize="13" fill={EDGE_COLOR[leaves[i]!.state]} className="font-mono">
            {`∩: ${leaves[i]!.state === "mal" ? "✗ " : ""}${leaves[i]!.text.length > 12 ? `${leaves[i]!.text.slice(0, 11)}…` : leaves[i]!.text}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- Barras de la función de probabilidad

const CW = 640;
const CH = 300;
const M = { left: 44, right: 14, top: 12, bottom: 30 };

/**
 * Barras de P(X = k) (las de `highlight`, rayadas: el suceso que se pregunta) y la función de
 * distribución F(k) = P(X ≤ k) escalonada, discontinua y con puntos, en la misma escala de 0 a 1 si
 * `cdf` está; sin ella, la escala se ajusta a la barra más alta.
 */
export function PmfChart({ ks, pmf, cdf, highlight, label }: { ks: number[]; pmf: number[]; cdf?: number[]; highlight?: ReadonlySet<number>; label: string }) {
  const hatch = useId();
  const top = cdf ? 1 : Math.max(0.05, ...pmf) * 1.1;
  const n = ks.length;
  const bw = (CW - M.left - M.right) / Math.max(1, n);
  const sx = (i: number) => M.left + i * bw;
  const sy = (y: number) => M.top + (1 - y / top) * (CH - M.top - M.bottom);
  const yt = cdf ? [0, 0.25, 0.5, 0.75, 1] : [0, top / 4, top / 2, (3 * top) / 4].map((t) => Math.round(t * 1000) / 1000);
  const every = Math.ceil(n / 16);
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" className="h-auto w-full rounded-lg border border-border bg-raised" role="img" aria-label={label}>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--accent)" fillOpacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="3" />
        </pattern>
      </defs>
      {yt.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={CW - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={M.left - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {decimalComma(t, 3)}
          </text>
        </g>
      ))}
      {ks.map((k, i) => {
        const h = sy(0) - sy(pmf[i]!);
        const on = highlight?.has(k) ?? false;
        return (
          <g key={k} data-k={k} data-highlight={on ? "true" : undefined}>
            <rect x={sx(i) + bw * 0.18} width={bw * 0.64} y={sy(pmf[i]!)} height={Math.max(0, h)} fill={on ? `url(#${hatch})` : "var(--accent)"} fillOpacity={on ? 1 : 0.55} stroke="var(--accent)" strokeWidth={on ? 2 : 1} />
            {i % every === 0 ? (
              <text x={sx(i) + bw / 2} y={CH - 10} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="font-mono">
                {k}
              </text>
            ) : null}
          </g>
        );
      })}
      {cdf ? (
        <g data-curve="cdf">
          {ks.map((k, i) => (
            <g key={k}>
              <line x1={sx(i)} x2={sx(i) + bw} y1={sy(cdf[i]!)} y2={sy(cdf[i]!)} stroke="var(--text)" strokeWidth={2} strokeDasharray="6 4" />
              <circle cx={sx(i) + bw / 2} cy={sy(cdf[i]!)} r={3.5} fill="var(--text)" />
            </g>
          ))}
        </g>
      ) : null}
      <line x1={M.left} x2={CW - M.right} y1={sy(0)} y2={sy(0)} stroke="var(--text-muted)" strokeWidth={1.5} />
    </svg>
  );
}

// ---------------------------------------------------------------- Frecuencia relativa

/** Frecuencia relativa (continua, con puntos) frente al número de repeticiones en escala logarítmica, y p (discontinua). */
export function FrequencyChart({ points, p, label }: { points: Array<{ n: number; freq: number }>; p: number; label: string }) {
  const last = points.at(-1)?.n ?? 1;
  const maxLog = Math.max(1, Math.ceil(Math.log10(last)));
  const sx = (n: number) => M.left + (Math.log10(n) / maxLog) * (CW - M.left - M.right);
  const sy = (y: number) => M.top + (1 - y) * (CH - M.top - M.bottom);
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" className="h-auto w-full rounded-lg border border-border bg-raised" role="img" aria-label={label}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={M.left} x2={CW - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={M.left - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {decimalComma(t, 2)}
          </text>
        </g>
      ))}
      {Array.from({ length: maxLog + 1 }, (_, e) => (
        <g key={e}>
          <line x1={sx(10 ** e)} x2={sx(10 ** e)} y1={M.top} y2={CH - M.bottom} stroke="var(--border)" strokeWidth={1} />
          <text x={sx(10 ** e)} y={CH - 10} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {(10 ** e).toLocaleString("es-ES")}
          </text>
        </g>
      ))}
      <line data-curve="p" x1={M.left} x2={CW - M.right} y1={sy(p)} y2={sy(p)} stroke="var(--warn)" strokeWidth={2.5} strokeDasharray="8 5" />
      <polyline data-curve="frecuencia" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" points={points.map((q) => `${sx(q.n)},${sy(q.freq)}`).join(" ")} />
      {points.filter((_, i) => i % 6 === 0 || i === points.length - 1).map((q) => (
        <circle key={q.n} cx={sx(q.n)} cy={sy(q.freq)} r={3} fill="var(--accent)" />
      ))}
    </svg>
  );
}
