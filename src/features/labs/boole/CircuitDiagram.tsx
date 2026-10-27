// Dibujo de un circuito en SVG en línea a partir de layoutCircuit (shared/boole/circuit.ts): entradas a
// la izquierda, puertas por capas y la salida f a la derecha. Si el circuito es más ancho que la
// pantalla, se desplaza dentro de su propio contenedor (nunca la página).
import { useMemo } from "react";
import { layoutCircuit, type Netlist } from "../../../../shared/boole/circuit.ts";
import { GateShape } from "./GateSymbol.tsx";

/** Escala del dibujo respecto a las unidades de layoutCircuit. */
const SCALE = 1.2;

export function CircuitDiagram({
  net,
  label,
  showLabels = false,
  outputName = "f",
}: {
  net: Netlist;
  /** Descripción accesible del circuito (como expresión). */
  label: string;
  /** Rotula la salida de cada puerta intermedia con A, B, C… */
  showLabels?: boolean;
  outputName?: string;
}) {
  const layout = useMemo(() => layoutCircuit(net), [net]);
  const { width, height, nodes, wires, junctions, labels, output } = layout;
  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-border bg-base" tabIndex={0} role="group" aria-label="Circuito (desplázalo si no cabe)">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={Math.round(width * SCALE)}
        height={Math.round(height * SCALE)}
        role="img"
        aria-label={label}
        className="block"
      >
        <g className="stroke-fg" strokeWidth={1.75} fill="none" strokeLinejoin="round" strokeLinecap="round">
          {wires.map((w, i) => (
            <polyline key={i} points={w.points.map(([x, y]) => `${x},${y}`).join(" ")} />
          ))}
          <line x1={output.from[0]} y1={output.from[1]} x2={output.to[0]} y2={output.to[1]} />
        </g>
        <g className="fill-fg">
          {junctions.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} />
          ))}
        </g>
        {nodes.map((n) =>
          n.kind === "gate" ? (
            <GateShape key={n.id} type={n.type} x={n.x} y={n.y} h={n.h} />
          ) : (
            <text
              key={n.id}
              x={n.x - 6}
              y={n.y}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-fg font-mono"
              fontSize={15}
              fontWeight={600}
            >
              {n.id}
            </text>
          ),
        )}
        {showLabels
          ? nodes.map((n) =>
              n.kind === "gate" && labels[n.id] ? (
                <text
                  key={`l-${n.id}`}
                  x={n.x + n.w + 4}
                  y={n.y - 7}
                  className="fill-accent stroke-base font-mono"
                  strokeWidth={4}
                  paintOrder="stroke"
                  fontSize={13}
                  fontWeight={700}
                >
                  {labels[n.id]}
                </text>
              ) : null,
            )
          : null}
        <text
          x={output.to[0] + 6}
          y={output.to[1]}
          dominantBaseline="central"
          className="fill-fg font-mono"
          fontSize={15}
          fontWeight={700}
        >
          {outputName}
        </text>
      </svg>
    </div>
  );
}
