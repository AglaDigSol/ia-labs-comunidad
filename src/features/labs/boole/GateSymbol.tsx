// Símbolos de puertas lógicas con las formas ANSI habituales (AND en «D», OR con la trasera curva,
// XOR con una segunda curva, NOT en triángulo y una burbuja para las negadas). Dibujos propios en SVG
// en línea; los colores salen de los tokens (fill-raised, stroke-fg), así que siguen al tema.
import {
  CIRCUIT_GEOMETRY,
  gateBodyOffset,
  gateBodyWidth,
  gateHeight,
  gateWidth,
  isNegatedGate,
  portX,
  type GateType,
} from "../../../../shared/boole/circuit.ts";

const G = CIRCUIT_GEOMETRY;

/** Cuerpo de la puerta con el borde izquierdo en x y el centro vertical en y. */
export function GateShape({ type, x, y, h }: { type: GateType; x: number; y: number; h: number }) {
  const top = y - h / 2;
  const off = gateBodyOffset(type);
  const W = gateBodyWidth(type);
  const bx = x + off;
  let body: string;
  if (type === "and" || type === "nand") {
    const r = h / 2;
    body = `M${bx},${top} H${bx + W - r} A${r},${r} 0 0 1 ${bx + W - r},${top + h} H${bx} Z`;
  } else if (type === "not") {
    body = `M${bx},${top} L${bx + W},${y} L${bx},${top + h} Z`;
  } else {
    body = `M${bx},${top} Q${bx + W * 0.6},${top} ${bx + W},${y} Q${bx + W * 0.6},${top + h} ${bx},${top + h} Q${bx + W * 0.25},${y} ${bx},${top} Z`;
  }
  return (
    <g className="fill-raised stroke-fg" strokeWidth={1.75} strokeLinejoin="round">
      {type === "xor" || type === "xnor" ? (
        <path d={`M${x},${top} Q${x + W * 0.25},${y} ${x},${top + h}`} fill="none" />
      ) : null}
      <path d={body} />
      {isNegatedGate(type) ? <circle cx={bx + W + G.bubble / 2} cy={y} r={G.bubble / 2 - 0.5} /> : null}
    </g>
  );
}

/** Símbolo suelto para la referencia: entradas a la izquierda y salida a la derecha. */
export function GateIcon({ type, label }: { type: GateType; label: string }) {
  const k = type === "not" ? 1 : 2;
  const h = gateHeight(type, k);
  const w = gateWidth(type);
  const stub = 18;
  const W = stub * 2 + w;
  const H = h + 16;
  const y = H / 2;
  const x = stub;
  const ports = Array.from({ length: k }, (_, i) => y - h / 2 + ((i + 1) * h) / (k + 1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * 1.25} height={H * 1.25} role="img" aria-label={label} className="shrink-0">
      <g className="stroke-fg" strokeWidth={1.75} fill="none">
        {ports.map((py) => (
          <line key={py} x1={0} y1={py} x2={x + portX(type, h, py - y)} y2={py} />
        ))}
        <line x1={x + w} y1={y} x2={W} y2={y} />
      </g>
      <GateShape type={type} x={x} y={y} h={h} />
    </svg>
  );
}
