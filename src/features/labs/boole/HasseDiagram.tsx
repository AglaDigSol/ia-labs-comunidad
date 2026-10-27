// Diagrama de Hasse del orden a ≤ b ⇔ a ⊕ b = b, en SVG en línea: capas por nivel (de abajo arriba),
// cada capa ordenada por el baricentro de sus elementos cubiertos para cruzar menos aristas. Los
// colores salen de los tokens (fill-raised, stroke-accent…), así que sigue al tema claro u oscuro.
import { useMemo } from "react";
import { checkPartialOrder, hasse, type FiniteStructure } from "../../../../shared/boole/algebra.ts";

const NODE_H = 30;
const GAP_X = 14;
const GAP_Y = 64;
const PAD = 12;
const CHAR_W = 8.4;

type Placed = { i: number; x: number; y: number; w: number };

export function layoutHasse(s: FiniteStructure) {
  const h = hasse(s);
  if (!h) return null;
  const n = s.elements.length;
  const top = Math.max(0, ...h.rank);
  const layers: number[][] = Array.from({ length: top + 1 }, () => []);
  for (let i = 0; i < n; i++) layers[h.rank[i]!]!.push(i);
  const widthOf = (i: number) => Math.max(NODE_H, s.elements[i]!.length * CHAR_W + 16);
  const layerWidth = (layer: number[]) => layer.reduce((sum, i) => sum + widthOf(i), 0) + GAP_X * (layer.length - 1);
  const W = Math.max(160, ...layers.map(layerWidth)) + 2 * PAD;
  const H = top * (NODE_H + GAP_Y) + NODE_H + 2 * PAD;
  const pos = new Map<number, Placed>();
  layers.forEach((layer, r) => {
    if (r > 0) {
      const center = (i: number) => {
        const below = h.covers.filter(([, b]) => b === i).map(([a]) => pos.get(a)!.x);
        return below.length ? below.reduce((x, y) => x + y, 0) / below.length : W / 2;
      };
      layer.sort((a, b) => center(a) - center(b) || a - b);
    }
    let x = (W - layerWidth(layer)) / 2;
    const y = H - PAD - NODE_H / 2 - r * (NODE_H + GAP_Y);
    for (const i of layer) {
      const w = widthOf(i);
      pos.set(i, { i, x: x + w / 2, y, w });
      x += w + GAP_X;
    }
  });
  return { W, H, nodes: [...pos.values()], covers: h.covers, pos };
}

export function HasseDiagram({ structure: s }: { structure: FiniteStructure }) {
  const layout = useMemo(() => layoutHasse(s), [s]);
  if (!layout) {
    const why = checkPartialOrder(s);
    const L = (i: number) => s.elements[i]!;
    const detail = why.ok
      ? ""
      : why.property === "reflexiva"
        ? ` Por ejemplo, ${L(why.a)} ⊕ ${L(why.a)} ≠ ${L(why.a)}.`
        : why.property === "antisimétrica"
          ? ` Por ejemplo, ${L(why.a)} ≤ ${L(why.b)} y ${L(why.b)} ≤ ${L(why.a)}.`
          : ` Por ejemplo, ${L(why.a)} ≤ ${L(why.b)} y ${L(why.b)} ≤ ${L(why.c)}, pero no ${L(why.a)} ≤ ${L(why.c)}.`;
    return (
      <p className="text-[14px] text-muted">
        {`Con estas tablas, a ≤ b ⇔ a ⊕ b = b no es un orden parcial (falla la propiedad ${why.ok ? "" : why.property}), así que no hay diagrama de Hasse.${detail}`}
      </p>
    );
  }
  const { W, H, nodes, covers, pos } = layout;
  const L = (i: number) => s.elements[i]!;
  const label =
    covers.length === 0
      ? `Diagrama de Hasse de ${s.name}: ningún elemento cubre a otro.`
      : `Diagrama de Hasse de ${s.name}. Relaciones de cobertura: ${covers.map(([a, b]) => `${L(b)} cubre a ${L(a)}`).join("; ")}.`;
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="h-auto w-full"
        style={{ maxWidth: `${W}px` }}
      >
        <g className="stroke-muted" strokeWidth={1.5}>
          {covers.map(([a, b]) => {
            const p = pos.get(a)!;
            const q = pos.get(b)!;
            return <line key={`${a}-${b}`} x1={p.x} y1={p.y - NODE_H / 2} x2={q.x} y2={q.y + NODE_H / 2} />;
          })}
        </g>
        {nodes.map((n) => {
          const special = n.i === s.zero || n.i === s.one;
          return (
            <g key={n.i}>
              <rect
                x={n.x - n.w / 2}
                y={n.y - NODE_H / 2}
                width={n.w}
                height={NODE_H}
                rx={8}
                className={special ? "fill-accent-soft stroke-accent" : "fill-raised stroke-border"}
                strokeWidth={1.5}
              />
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-fg font-mono"
                fontSize={14}
                fontWeight={special ? 700 : 400}
              >
                {L(n.i)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[14px] text-muted">
        {`Orden a ≤ b ⇔ a ⊕ b = b, de abajo arriba. Resaltados: 0 = ${L(s.zero)} y 1 = ${L(s.one)}.`}
      </figcaption>
    </figure>
  );
}
