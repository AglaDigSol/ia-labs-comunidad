// Diagrama de Venn en SVG en línea (geometría en venn-geometry.ts). Cada región es un camino propio:
// - interactivo (onToggle): cada región es una casilla (role="checkbox") que se marca con clic, Enter
//   o Espacio y se nombra como intersección («A ∩ Bᶜ ∩ C»);
// - de solo lectura: una imagen con la lista de regiones sombreadas en su etiqueta.
// Las regiones marcadas se rayan (no solo cambian de color) y las incorrectas llevan borde discontinuo
// y una ✕. Los colores salen de los tokens (fill-accent-soft, stroke-crit…), así que sigue al tema.
import { useId, type KeyboardEvent } from "react";
import { regionLabel, SET_NAMES, type Region, type SetName } from "../../../../shared/sets/expr.ts";
import { cn } from "../../../lib/cn.ts";
import { regionOrder, vennLayout } from "./venn-geometry.ts";

export function VennDiagram({
  n,
  selected,
  onToggle,
  wrong,
  values,
  label,
  className,
}: {
  n: 2 | 3;
  /** Regiones marcadas (índice = región). */
  selected: readonly boolean[];
  /** Si se pasa, las regiones se pueden marcar y desmarcar. */
  onToggle?: (region: Region) => void;
  /** Regiones señaladas como incorrectas tras «Comprobar». */
  wrong?: readonly boolean[];
  /** Texto (normalmente un número) que se escribe dentro de cada región. */
  values?: ReadonlyArray<string | null>;
  /** Nombre accesible del diagrama. */
  label: string;
  className?: string;
}) {
  const layout = vennLayout(n);
  const vars: SetName[] = SET_NAMES.slice(0, n);
  const hatch = `venn-hatch-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const order = regionOrder(n);
  const interactive = onToggle !== undefined;
  const shaded = order.filter((r) => selected[r]).map((r) => regionLabel(vars, r));
  const imgLabel = `${label}. ${shaded.length === 0 ? "Ninguna región sombreada." : `Regiones sombreadas: ${shaded.join("; ")}.`}`;

  const onKey = (r: Region) => (e: KeyboardEvent<SVGPathElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.(r);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role={interactive ? "group" : "img"}
      aria-label={interactive ? label : imgLabel}
      className={cn("h-auto w-full max-w-[420px] select-none", className)}
    >
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
          <rect width={8} height={8} className="fill-accent-soft" />
          <line x1={0} y1={0} x2={0} y2={8} className="stroke-accent" strokeWidth={3} />
        </pattern>
      </defs>
      {order.map((r) => {
        const on = selected[r] ?? false;
        const bad = wrong?.[r] ?? false;
        const name = regionLabel(vars, r);
        return (
          <path
            key={r}
            d={layout.paths[r]}
            fillRule="evenodd"
            fill={on ? `url(#${hatch})` : "transparent"}
            pointerEvents="all"
            className={cn(
              bad ? "stroke-crit" : "stroke-transparent",
              interactive && "cursor-pointer outline-none hover:opacity-80 focus-visible:stroke-accent",
            )}
            strokeWidth={bad ? 2.5 : 3}
            strokeDasharray={bad ? "6 4" : undefined}
            {...(interactive
              ? {
                  role: "checkbox",
                  tabIndex: 0,
                  "aria-checked": on,
                  "aria-label": `${name}${bad ? ", incorrecta" : ""}`,
                  onClick: () => onToggle(r),
                  onKeyDown: onKey(r),
                }
              : { "aria-hidden": true })}
          />
        );
      })}
      <rect
        x={8}
        y={8}
        width={layout.width - 16}
        height={layout.height - 16}
        rx={6}
        className="fill-none stroke-border"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <g className="fill-none stroke-fg" strokeWidth={1.75} pointerEvents="none">
        {layout.circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
        ))}
      </g>
      <g className="fill-fg font-display" fontSize={18} fontWeight={600} pointerEvents="none" aria-hidden="true">
        {vars.map((v, i) => (
          <text key={v} x={layout.names[i]!.x} y={layout.names[i]!.y} textAnchor="middle" dominantBaseline="central">
            {v}
          </text>
        ))}
        <text x={layout.universeName.x} y={layout.universeName.y} textAnchor="middle" dominantBaseline="central" fontSize={15}>
          U
        </text>
      </g>
      <g pointerEvents="none" aria-hidden="true">
        {order.map((r) => {
          const a = layout.anchors[r]!;
          const text = values?.[r] ?? null;
          const bad = wrong?.[r] ?? false;
          return (
            <g key={r}>
              {text !== null ? (
                <>
                  <rect x={a.x - 15} y={a.y - 11} width={30} height={22} rx={5} className="fill-raised stroke-border" strokeWidth={1} />
                  <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" className="fill-fg font-mono" fontSize={14} fontWeight={600}>
                    {text}
                  </text>
                </>
              ) : null}
              {bad ? (
                <g transform={`translate(${a.x + (text !== null ? 22 : 0)} ${a.y})`}>
                  <circle r={9} className="fill-raised stroke-crit" strokeWidth={1.5} />
                  <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" className="stroke-crit" strokeWidth={2} strokeLinecap="round" />
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
