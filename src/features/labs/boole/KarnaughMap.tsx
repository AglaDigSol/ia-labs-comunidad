// Mapa de Karnaugh accesible: una tabla con rótulos de fila y de columna en código Gray, celdas de al
// menos 44 px y navegación con las flechas (un solo punto de tabulación). Cada grupo lleva su número
// en una insignia con su propio estilo de borde (continuo, discontinuo, punteado, doble) además del
// color, y la etiqueta de cada celda dice sus variables, su valor y sus grupos: «Celda x=0, y=1, z=1:
// 1, en el grupo 2». Sin `onActivate`, el mapa es de solo lectura (para la solución).
import { useRef, useState, type KeyboardEvent } from "react";
import { rowValues } from "../../../../shared/boole/canonical.ts";
import {
  implicantCells,
  kmapColLabel,
  kmapMinterm,
  kmapRowLabel,
  type KMapLayout,
} from "../../../../shared/boole/karnaugh.ts";
import type { Implicant } from "../../../../shared/boole/minimize.ts";
import { cn } from "../../../lib/cn.ts";

/** Estilos de los grupos: el borde cambia de forma, no solo de color. */
const GROUP_STYLES = [
  "border-solid border-accent text-accent",
  "border-dashed border-ok text-ok",
  "border-dotted border-warn text-warn",
  "border-double border-fg text-fg",
] as const;
export const groupStyle = (i: number) => GROUP_STYLES[i % GROUP_STYLES.length]!;

/** Insignia con el número del grupo. */
export function GroupBadge({ index, className }: { index: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border-2 bg-raised px-0.5 font-body text-[11px] font-semibold leading-none",
        groupStyle(index),
        className,
      )}
    >
      {index + 1}
    </span>
  );
}

const VALUE_TEXT: Record<string, string> = { "0": "0", "1": "1", X: "X (indiferencia)" };

/** «en el grupo 2» o «en los grupos 1 y 3». */
function groupsText(list: number[]): string {
  if (list.length === 0) return "";
  const nums = list.map((i) => String(i + 1));
  if (nums.length === 1) return `, en el grupo ${nums[0]}`;
  return `, en los grupos ${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
}

/** Etiqueta accesible de una celda. */
export function cellLabel(layout: KMapLayout, vector: string, m: number, groups: number[], selected: boolean): string {
  const vals = rowValues(layout.vars.length, m);
  const where = layout.vars.map((v, i) => `${v}=${vals[i] ? 1 : 0}`).join(", ");
  return `Celda ${where}: ${VALUE_TEXT[vector[m]!] ?? vector[m]}${groupsText(groups)}${selected ? ", seleccionada" : ""}`;
}

/** «fila wx = 01, columna yz = 11», para las pistas y los mensajes. */
export function cellPlace(layout: KMapLayout, row: number, col: number): string {
  return `fila ${layout.rowVars.join("")} = ${kmapRowLabel(layout, row)}, columna ${layout.colVars.join("")} = ${kmapColLabel(layout, col)}`;
}

const axisText = (vars: string[], label: string) => vars.map((v, i) => `${v} = ${label[i]}`).join(", ");

export function KarnaughMap({
  layout,
  vector,
  caption,
  groups,
  selected,
  onActivate,
}: {
  layout: KMapLayout;
  vector: string;
  caption: string;
  groups: Implicant[];
  selected?: ReadonlySet<number>;
  /** Al pulsar (o con Intro / Espacio) una celda; sin él, el mapa es de solo lectura. */
  onActivate?: (m: number) => void;
}) {
  const n = layout.vars.length;
  const R = layout.rowCodes.length;
  const C = layout.colCodes.length;
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const memberOf = (m: number) => groups.flatMap((g, i) => (implicantCells(n, g).includes(m) ? [i] : []));

  const move = (e: KeyboardEvent, r: number, c: number) => {
    const next: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, r - 1), c],
      ArrowDown: [Math.min(R - 1, r + 1), c],
      ArrowLeft: [r, Math.max(0, c - 1)],
      ArrowRight: [r, Math.min(C - 1, c + 1)],
      Home: [r, 0],
      End: [r, C - 1],
    };
    const to = next[e.key];
    if (!to) return;
    e.preventDefault();
    setFocus(to);
    refs.current.get(`${to[0]}:${to[1]}`)?.focus();
  };

  const corner = `${layout.rowVars.join("")} \\ ${layout.colVars.join("")}`;

  return (
    <div className="max-w-full overflow-x-auto">
      <table role={onActivate ? "grid" : undefined} className="border-separate border-spacing-1 text-center">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              className="px-1 font-mono text-[13px] font-normal text-muted"
              aria-label={`Filas: ${layout.rowVars.join(", ")}; columnas: ${layout.colVars.join(", ")}`}
            >
              {corner}
            </th>
            {layout.colCodes.map((_, c) => (
              <th
                key={c}
                scope="col"
                aria-label={axisText(layout.colVars, kmapColLabel(layout, c))}
                className="px-1 font-mono text-[14px] font-semibold"
              >
                {kmapColLabel(layout, c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.rowCodes.map((_, r) => (
            <tr key={r}>
              <th
                scope="row"
                aria-label={axisText(layout.rowVars, kmapRowLabel(layout, r))}
                className="px-1 font-mono text-[14px] font-semibold"
              >
                {kmapRowLabel(layout, r)}
              </th>
              {layout.colCodes.map((_, c) => {
                const m = kmapMinterm(layout, r, c);
                const value = vector[m]!;
                const member = memberOf(m);
                const isSelected = selected?.has(m) ?? false;
                const label = cellLabel(layout, vector, m, member, isSelected);
                const body = (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "font-mono text-[18px] leading-none",
                        value === "1" ? "font-semibold" : value === "0" ? "text-muted" : "italic",
                      )}
                    >
                      {value}
                    </span>
                    <span aria-hidden="true" className="flex min-h-5 flex-wrap justify-center gap-0.5">
                      {member.map((i) => (
                        <GroupBadge key={i} index={i} />
                      ))}
                    </span>
                    <span aria-hidden="true" className="absolute right-1 top-0.5 font-mono text-[10px] text-muted">
                      {m}
                    </span>
                  </>
                );
                const box = cn(
                  "relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-md border pb-1 pt-3",
                  member.length > 0 ? "bg-accent-soft" : "bg-raised",
                  isSelected ? "border-2 border-dashed border-accent outline-2 outline-offset-1 outline-accent" : "border-border",
                );
                return (
                  <td key={c} role={onActivate ? "gridcell" : undefined} className="p-0">
                    {onActivate ? (
                      <button
                        ref={(el) => {
                          if (el) refs.current.set(`${r}:${c}`, el);
                          else refs.current.delete(`${r}:${c}`);
                        }}
                        type="button"
                        tabIndex={focus[0] === r && focus[1] === c ? 0 : -1}
                        aria-label={label}
                        aria-pressed={selected ? isSelected : undefined}
                        onClick={() => {
                          setFocus([r, c]);
                          onActivate(m);
                        }}
                        onKeyDown={(e) => move(e, r, c)}
                        className={cn(box, "w-full hover:border-accent")}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className={box}>
                        <span className="sr-only">{label}</span>
                        {body}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
