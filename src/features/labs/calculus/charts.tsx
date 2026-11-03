// Dibujos del laboratorio de cálculo, en SVG con los colores del tema: la gráfica de y = f(x) con
// otras curvas (f′, una recta), puntos, rectángulos de Riemann y las iteraciones del descenso; y el
// mapa de curvas de nivel de f(x, y) con flechas del gradiente, un camino y puntos marcados. Nada se
// distingue solo por el color: cada curva tiene su trazo (continuo, discontinuo, de puntos) y cada
// punto su forma, con leyenda; el resumen va en aria-label y los valores en tablas aparte.
import { useId, useMemo, type ReactNode } from "react";
import { decimalText } from "../../../../shared/calculus/expr.ts";
import { contourLevels, contourSegments, gradientField, niceRange, sampleCurve, sampleGrid, ticks } from "../../../../shared/calculus/plot.ts";

export type CurveStyle = "solid" | "dashed" | "dotted";
export type Curve = { id: string; label: string; f: (x: number) => number; style: CurveStyle; color: string; width?: number };
export type Shape = "circle" | "square" | "triangle" | "diamond" | "cross" | "ring";
export type Marker = { x: number; y: number; shape: Shape; color: string; label?: string };

const DASH: Record<CurveStyle, string | undefined> = { solid: undefined, dashed: "8 5", dotted: "2 4" };

export function MarkerShape({ shape, x, y, color, r = 5 }: { shape: Shape; x: number; y: number; color: string; r?: number }) {
  switch (shape) {
    case "circle":
      return <circle cx={x} cy={y} r={r} fill={color} />;
    case "ring":
      return <circle cx={x} cy={y} r={r} fill="var(--surface-raised)" stroke={color} strokeWidth={2.5} />;
    case "square":
      return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={color} />;
    case "triangle":
      return <polygon points={`${x},${y - r - 1} ${x - r - 1},${y + r} ${x + r + 1},${y + r}`} fill={color} />;
    case "diamond":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} fill={color} />;
    case "cross":
      return <path d={`M${x - r},${y - r} L${x + r},${y + r} M${x - r},${y + r} L${x + r},${y - r}`} stroke={color} strokeWidth={2.5} fill="none" />;
  }
}

/** Muestra de leyenda: el trazo o la forma, en pequeño. */
export function LegendItem({ label, color, style, shape }: { label: ReactNode; color: string; style?: CurveStyle; shape?: Shape }) {
  return (
    <li className="inline-flex items-center gap-2 text-[14px]">
      <svg width="28" height="14" aria-hidden="true">
        {style ? <line x1="0" y1="7" x2="28" y2="7" stroke={color} strokeWidth="2.5" strokeDasharray={DASH[style]} /> : null}
        {shape ? <MarkerShape shape={shape} x={14} y={7} color={color} r={4.5} /> : null}
      </svg>
      {label}
    </li>
  );
}

const W = 640;
const H = 360;
const M = { left: 44, right: 14, top: 12, bottom: 28 };

/** Ejes con marcas y rejilla tenue. */
function Axes({ sx, sy, xr, yr }: { sx: (x: number) => number; sy: (y: number) => number; xr: [number, number]; yr: [number, number] }) {
  return (
    <g>
      {ticks(yr[0], yr[1], 6).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={M.left - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {decimalText(t, 3)}
          </text>
        </g>
      ))}
      {ticks(xr[0], xr[1], 8).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={H - M.bottom} stroke="var(--border)" strokeWidth={1} />
          <text x={sx(t)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="font-mono">
            {decimalText(t, 3)}
          </text>
        </g>
      ))}
      {yr[0] < 0 && yr[1] > 0 ? <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)} stroke="var(--text-muted)" strokeWidth={1.5} /> : null}
      {xr[0] < 0 && xr[1] > 0 ? <line x1={sx(0)} x2={sx(0)} y1={M.top} y2={H - M.bottom} stroke="var(--text-muted)" strokeWidth={1.5} /> : null}
    </g>
  );
}

/**
 * Gráfica de funciones de x. El rango de y sale de la primera curva (percentiles), salvo que se dé;
 * los puntos y los rectángulos se ven siempre que caigan dentro.
 */
export function FunctionPlot({
  xRange,
  yRange,
  curves,
  markers = [],
  rects = [],
  path,
  label,
}: {
  xRange: [number, number];
  yRange?: [number, number];
  curves: Curve[];
  markers?: Marker[];
  rects?: Array<{ x0: number; x1: number; h: number }>;
  /** Iteraciones del descenso: [x, f(x)] unidas en orden. */
  path?: Array<[number, number]>;
  label: string;
}) {
  const clip = useId();
  const yr = useMemo<[number, number]>(() => {
    if (yRange) return yRange;
    const first = curves[0];
    if (!first) return [-1, 1];
    const vals: number[] = [];
    for (let i = 0; i <= 200; i++) vals.push(first.f(xRange[0] + ((xRange[1] - xRange[0]) * i) / 200));
    for (const m of markers) vals.push(m.y);
    return niceRange(vals);
  }, [yRange, curves, markers, xRange]);
  const sx = (x: number) => M.left + ((x - xRange[0]) / (xRange[1] - xRange[0])) * (W - M.left - M.right);
  const sy = (y: number) => M.top + (1 - (y - yr[0]) / (yr[1] - yr[0])) * (H - M.top - M.bottom);
  const clampY = (y: number) => Math.max(-1e4, Math.min(1e4, sy(y)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="h-auto w-full rounded-lg border border-border bg-raised" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
        </clipPath>
      </defs>
      <Axes sx={sx} sy={sy} xr={xRange} yr={yr} />
      <g clipPath={`url(#${clip})`}>
        {rects.map((r, i) => (
          <rect
            key={i}
            x={sx(r.x0)}
            width={Math.max(0, sx(r.x1) - sx(r.x0))}
            y={Math.min(clampY(r.h), sy(0))}
            height={Math.abs(clampY(r.h) - sy(0))}
            fill="var(--accent)"
            fillOpacity={0.16}
            stroke="var(--accent)"
            strokeWidth={1}
          />
        ))}
        {curves.map((c) =>
          sampleCurve(c.f, xRange[0], xRange[1], 320, yr).map((seg, i) => (
            <polyline
              key={`${c.id}-${i}`}
              data-curve={c.id}
              fill="none"
              stroke={c.color}
              strokeWidth={c.width ?? 2.5}
              strokeDasharray={DASH[c.style]}
              strokeLinejoin="round"
              points={seg.map(([x, y]) => `${sx(x)},${clampY(y)}`).join(" ")}
            />
          )),
        )}
        {path && path.length > 0 ? (
          <g data-path="descenso">
            <polyline fill="none" stroke="var(--crit)" strokeWidth={1.5} points={path.map(([x, y]) => `${sx(x)},${clampY(y)}`).join(" ")} />
            {path.map(([x, y], i) => (
              <MarkerShape key={i} shape={i === 0 ? "square" : i === path.length - 1 ? "ring" : "circle"} x={sx(x)} y={clampY(y)} color="var(--crit)" r={i === 0 || i === path.length - 1 ? 5.5 : 3.5} />
            ))}
          </g>
        ) : null}
        {markers.map((m, i) => (
          <g key={i}>
            <MarkerShape shape={m.shape} x={sx(m.x)} y={clampY(m.y)} color={m.color} r={6} />
            {m.label ? (
              <text x={sx(m.x) + 9} y={clampY(m.y) - 9} fontSize="13" fill={m.color}>
                {m.label}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}

const CW = 480;
const CM = { left: 40, right: 10, top: 10, bottom: 28 };

/**
 * Curvas de nivel de f(x, y) (cuadrados marchantes) con flechas del gradiente (opcionales), un camino
 * (el descenso) y puntos marcados (puntos críticos, el punto del gradiente).
 */
export function ContourPlot({
  f,
  grad,
  xRange,
  yRange,
  arrows = false,
  path,
  markers = [],
  label,
}: {
  f: (x: number, y: number) => number;
  grad?: (x: number, y: number) => [number, number];
  xRange: [number, number];
  yRange: [number, number];
  arrows?: boolean;
  path?: number[][];
  markers?: Marker[];
  label: string;
}) {
  const clip = useId();
  const arrowId = useId();
  const CH = 400;
  const sx = (x: number) => CM.left + ((x - xRange[0]) / (xRange[1] - xRange[0])) * (CW - CM.left - CM.right);
  const sy = (y: number) => CM.top + (1 - (y - yRange[0]) / (yRange[1] - yRange[0])) * (CH - CM.top - CM.bottom);
  const lines = useMemo(() => {
    const grid = sampleGrid(f, xRange, yRange, 56);
    return contourLevels(grid, 11).map((level) => ({ level, segs: contourSegments(grid, level) }));
  }, [f, xRange, yRange]);
  const field = useMemo(() => (arrows && grad ? gradientField(grad, xRange, yRange, 7) : []), [arrows, grad, xRange, yRange]);
  const cell = (CW - CM.left - CM.right) / 7;
  const clampP = (v: number) => Math.max(-2000, Math.min(2000, v));
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" className="h-auto w-full rounded-lg border border-border bg-raised" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <rect x={CM.left} y={CM.top} width={CW - CM.left - CM.right} height={CH - CM.top - CM.bottom} />
        </clipPath>
        <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
      </defs>
      {ticks(xRange[0], xRange[1], 6).map((t) => (
        <text key={`x${t}`} x={sx(t)} y={CH - 8} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="font-mono">
          {decimalText(t, 3)}
        </text>
      ))}
      {ticks(yRange[0], yRange[1], 6).map((t) => (
        <text key={`y${t}`} x={CM.left - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="font-mono">
          {decimalText(t, 3)}
        </text>
      ))}
      <g clipPath={`url(#${clip})`}>
        {xRange[0] < 0 && xRange[1] > 0 ? <line x1={sx(0)} x2={sx(0)} y1={CM.top} y2={CH - CM.bottom} stroke="var(--border)" strokeWidth={1.5} /> : null}
        {yRange[0] < 0 && yRange[1] > 0 ? <line x1={CM.left} x2={CW - CM.right} y1={sy(0)} y2={sy(0)} stroke="var(--border)" strokeWidth={1.5} /> : null}
        <g data-contours="" stroke="var(--text-muted)" strokeWidth={1} opacity={0.75} fill="none">
          {lines.map(({ level, segs }) => (
            <path key={level} d={segs.map(([a, b]) => `M${sx(a[0]).toFixed(1)},${sy(a[1]).toFixed(1)}L${sx(b[0]).toFixed(1)},${sy(b[1]).toFixed(1)}`).join("")} />
          ))}
        </g>
        {field.length > 0 ? (
          <g data-arrows="" stroke="var(--accent)" strokeWidth={1.5}>
            {field.map(({ at, g }, i) => {
              // Dirección del gradiente en píxeles (el eje y del dibujo va hacia abajo), longitud fija.
              const dx = sx(at[0] + g[0]) - sx(at[0]);
              const dy = sy(at[1] + g[1]) - sy(at[1]);
              const n = Math.hypot(dx, dy);
              if (n < 1e-9) return null;
              const len = cell * 0.38;
              const x0 = sx(at[0]);
              const y0 = sy(at[1]);
              return <line key={i} x1={x0} y1={y0} x2={x0 + (dx / n) * len} y2={y0 + (dy / n) * len} markerEnd={`url(#${arrowId})`} />;
            })}
          </g>
        ) : null}
        {path && path.length > 0 ? (
          <g data-path="descenso">
            <polyline fill="none" stroke="var(--crit)" strokeWidth={2} points={path.map((p) => `${clampP(sx(p[0]!))},${clampP(sy(p[1]!))}`).join(" ")} />
            {path.map((p, i) =>
              i === 0 || i === path.length - 1 || path.length <= 60 ? (
                <MarkerShape key={i} shape={i === 0 ? "square" : i === path.length - 1 ? "ring" : "circle"} x={clampP(sx(p[0]!))} y={clampP(sy(p[1]!))} color="var(--crit)" r={i === 0 || i === path.length - 1 ? 5.5 : 2.5} />
              ) : null,
            )}
          </g>
        ) : null}
        {markers.map((m, i) => (
          <g key={i}>
            <MarkerShape shape={m.shape} x={sx(m.x)} y={sy(m.y)} color={m.color} r={6.5} />
            {m.label ? (
              <text x={sx(m.x) + 9} y={sy(m.y) - 9} fontSize="13" fill={m.color}>
                {m.label}
              </text>
            ) : null}
          </g>
        ))}
      </g>
      <rect x={CM.left} y={CM.top} width={CW - CM.left - CM.right} height={CH - CM.top - CM.bottom} fill="none" stroke="var(--border)" />
    </svg>
  );
}
