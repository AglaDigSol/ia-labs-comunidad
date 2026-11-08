// Geometría del diagrama de Venn: dos o tres círculos dentro del rectángulo del universo. Cada región
// (shared/sets/expr.ts: máscara de bits, bit i = dentro del conjunto i) es un camino SVG exacto hecho
// con arcos de los círculos, así que se puede pulsar y enfocar región a región. Se calcula una vez por
// número de conjuntos.
// Con dos conjuntos y unos supuestos que lo permiten (shared/sets/relations.ts, nestedShape) hay otros
// dibujos: A dentro de B, B dentro de A, separados (disjuntos) o un solo círculo (A = B). Las regiones
// que esos dibujos no tienen (vacías por hipótesis) llevan un camino vacío y no se pintan.
import { regionCount, type Region } from "../../../../shared/sets/expr.ts";
import type { NestedShape } from "../../../../shared/sets/relations.ts";

type Circle = { cx: number; cy: number; r: number };
type Pt = { x: number; y: number; id: string };
type Arc = { k: number; from: Pt; to: Pt; t1: number; t2: number; mid: { x: number; y: number } };

export type VennLayout = {
  width: number;
  height: number;
  circles: Circle[];
  /** Posición del nombre de cada conjunto (A, B, C) y del universal U. */
  names: Array<{ x: number; y: number }>;
  universeName: { x: number; y: number };
  /** Texto de cada nombre si no es el del conjunto («A = B» en el dibujo de un solo círculo; "" lo omite). */
  nameText?: string[];
  /** Camino de cada región (índice = región), "" si el dibujo no la tiene. Se pintan con la regla evenodd. */
  paths: string[];
  /** Punto bien dentro de cada región, para rotular un número o una marca. */
  anchors: Array<{ x: number; y: number }>;
};

const PAD = 8;

function intersections(a: Circle, b: Circle, ids: [string, string]): [Pt, Pt] {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h = Math.sqrt(a.r * a.r - l * l);
  const mx = a.cx + (dx * l) / d;
  const my = a.cy + (dy * l) / d;
  return [
    { x: mx + (h * -dy) / d, y: my + (h * dx) / d, id: ids[0] },
    { x: mx - (h * -dy) / d, y: my - (h * dx) / d, id: ids[1] },
  ];
}

const inside = (p: { x: number; y: number }, c: Circle) => Math.hypot(p.x - c.cx, p.y - c.cy) < c.r;
const f = (x: number) => Number(x.toFixed(2));

function build(circles: Circle[], width: number, height: number): Pick<VennLayout, "paths" | "anchors"> {
  const n = circles.length;
  // Puntos de corte de cada par de círculos y, en cada círculo, los arcos entre cortes consecutivos.
  const onCircle: Pt[][] = circles.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pts = intersections(circles[i]!, circles[j]!, [`${i}${j}a`, `${i}${j}b`]);
      onCircle[i]!.push(...pts);
      onCircle[j]!.push(...pts);
    }
  }
  const arcs: Arc[] = [];
  circles.forEach((c, k) => {
    const pts = onCircle[k]!.map((p) => ({ p, t: Math.atan2(p.y - c.cy, p.x - c.cx) })).sort((a, b) => a.t - b.t);
    pts.forEach((cur, i) => {
      const next = pts[(i + 1) % pts.length]!;
      const t2 = i + 1 < pts.length ? next.t : next.t + 2 * Math.PI;
      const tm = (cur.t + t2) / 2;
      arcs.push({ k, from: cur.p, to: next.p, t1: cur.t, t2, mid: { x: c.cx + c.r * Math.cos(tm), y: c.cy + c.r * Math.sin(tm) } });
    });
  });

  const arcPath = (a: Arc, forward: boolean) => {
    const r = circles[a.k]!.r;
    const end = forward ? a.to : a.from;
    const large = a.t2 - a.t1 > Math.PI ? 1 : 0;
    return `A ${r} ${r} 0 ${large} ${forward ? 1 : 0} ${f(end.x)} ${f(end.y)}`;
  };

  const paths: string[] = [];
  for (let m = 0; m < regionCount(n); m++) {
    // Un arco del círculo k separa la región m de su vecina si el resto de círculos coincide con m.
    const border = arcs.filter((a) => circles.every((c, j) => j === a.k || inside(a.mid, c) === (((m >> j) & 1) === 1)));
    const left = [...border];
    let d = m === 0 ? `M ${PAD} ${PAD} H ${width - PAD} V ${height - PAD} H ${PAD} Z ` : "";
    while (left.length > 0) {
      const first = left.shift()!;
      d += `M ${f(first.from.x)} ${f(first.from.y)} ${arcPath(first, true)} `;
      let end = first.to.id;
      while (end !== first.from.id) {
        const i = left.findIndex((a) => a.from.id === end || a.to.id === end);
        if (i < 0) break;
        const a = left.splice(i, 1)[0]!;
        const forward = a.from.id === end;
        d += `${arcPath(a, forward)} `;
        end = forward ? a.to.id : a.from.id;
      }
      d += "Z ";
    }
    paths.push(d.trim());
  }

  const regionAt = (p: { x: number; y: number }) => circles.reduce((r, c, j) => (inside(p, c) ? r | (1 << j) : r), 0);
  return { paths, anchors: anchorsOf(circles, width, height, regionCount(n), regionAt) };
}

/** Ancla de cada región: el punto de una rejilla más alejado de cualquier borde. */
function anchorsOf(
  circles: Circle[],
  width: number,
  height: number,
  count: number,
  regionAt: (p: { x: number; y: number }) => number,
): Array<{ x: number; y: number }> {
  const best = Array.from({ length: count }, () => ({ x: width / 2, y: height / 2, score: -1 }));
  for (let x = PAD + 4; x < width - PAD; x += 3) {
    for (let y = PAD + 4; y < height - PAD; y += 3) {
      const p = { x, y };
      const edge = Math.min(x - PAD, width - PAD - x, y - PAD, height - PAD - y, ...circles.map((c) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r)));
      const r = regionAt(p);
      if (edge > best[r]!.score) best[r] = { x, y, score: edge };
    }
  }
  return best.map(({ x, y }) => ({ x, y }));
}

const circlePath = (c: Circle) =>
  `M ${f(c.cx - c.r)} ${c.cy} A ${c.r} ${c.r} 0 1 0 ${f(c.cx + c.r)} ${c.cy} A ${c.r} ${c.r} 0 1 0 ${f(c.cx - c.r)} ${c.cy} Z`;

/** Dibujos de dos conjuntos según los supuestos (mismo tamaño que el normal). */
function nestedLayout(shape: NestedShape): VennLayout {
  const width = 320;
  const height = 210;
  const rect = `M ${PAD} ${PAD} H ${width - PAD} V ${height - PAD} H ${PAD} Z`;
  const universeName = { x: 22, y: 196 };
  if (shape === "iguales") {
    const o = { cx: 160, cy: 112, r: 78 };
    const paths = [`${rect} ${circlePath(o)}`, "", "", circlePath(o)];
    return {
      width,
      height,
      circles: [o],
      names: [
        { x: 56, y: 32 },
        { x: 56, y: 32 },
      ],
      nameText: ["A = B", ""],
      universeName,
      paths,
      anchors: anchorsOf([o], width, height, 4, (p) => (inside(p, o) ? 3 : 0)),
    };
  }
  if (shape === "separados") {
    const a = { cx: 88, cy: 112, r: 62 };
    const b = { cx: 232, cy: 112, r: 62 };
    const circles = [a, b];
    return {
      width,
      height,
      circles,
      names: [
        { x: 40, y: 36 },
        { x: 280, y: 36 },
      ],
      universeName,
      paths: [`${rect} ${circlePath(a)} ${circlePath(b)}`, circlePath(a), circlePath(b), ""],
      anchors: anchorsOf(circles, width, height, 4, (p) => (inside(p, a) ? 1 : 0) | (inside(p, b) ? 2 : 0)),
    };
  }
  // Uno dentro del otro: el grande, a la derecha; el pequeño, dentro y algo desplazado.
  const big = { cx: 170, cy: 108, r: 88 };
  const small = { cx: 150, cy: 118, r: 44 };
  const aInB = shape === "A-en-B";
  const a = aInB ? small : { ...big, cx: 150 };
  const b = aInB ? big : { ...small, cx: 170 };
  const outer = aInB ? b : a;
  const inner = aInB ? a : b;
  const circles = [a, b];
  const paths = ["", "", "", ""];
  paths[0] = `${rect} ${circlePath(outer)}`;
  paths[3] = circlePath(inner);
  // El anillo: la región del grande que no está en el pequeño (Aᶜ ∩ B o A ∩ Bᶜ).
  paths[aInB ? 2 : 1] = `${circlePath(outer)} ${circlePath(inner)}`;
  const innerName = { x: inner.cx, y: inner.cy - inner.r - 12 };
  const outerName = { x: aInB ? 72 : 48, y: 34 };
  return {
    width,
    height,
    circles,
    names: aInB ? [innerName, outerName] : [outerName, innerName],
    universeName,
    paths,
    anchors: anchorsOf(circles, width, height, 4, (p) => (inside(p, a) ? 1 : 0) | (inside(p, b) ? 2 : 0)),
  };
}

function layout(n: 2 | 3): VennLayout {
  if (n === 2) {
    const width = 320;
    const height = 210;
    const circles = [
      { cx: 125, cy: 108, r: 76 },
      { cx: 195, cy: 108, r: 76 },
    ];
    return {
      width,
      height,
      circles,
      names: [
        { x: 40, y: 44 },
        { x: 280, y: 44 },
      ],
      universeName: { x: 22, y: 196 },
      ...build(circles, width, height),
    };
  }
  const width = 320;
  const height = 262;
  const circles = [
    { cx: 126, cy: 102, r: 70 },
    { cx: 194, cy: 102, r: 70 },
    { cx: 160, cy: 162, r: 70 },
  ];
  return {
    width,
    height,
    circles,
    names: [
      { x: 44, y: 40 },
      { x: 276, y: 40 },
      { x: 250, y: 236 },
    ],
    universeName: { x: 22, y: 248 },
    ...build(circles, width, height),
  };
}

const cache = new Map<string, VennLayout>();

/**
 * Diagrama de Venn de dos o tres conjuntos (A, B y, si hace falta, C). Con dos conjuntos, `shape`
 * pide uno de los dibujos de los supuestos (A dentro de B, separados…).
 */
export function vennLayout(n: 2 | 3, shape: NestedShape | null = null): VennLayout {
  const key = n === 2 && shape ? shape : String(n);
  let l = cache.get(key);
  if (!l) {
    l = n === 2 && shape ? nestedLayout(shape) : layout(n);
    cache.set(key, l);
  }
  return l;
}

/** Regiones en el orden de lectura del diagrama: de dentro hacia fuera. */
export function regionOrder(n: 2 | 3): Region[] {
  return n === 2 ? [3, 1, 2, 0] : [7, 3, 5, 6, 1, 2, 4, 0];
}

/** Las regiones que tiene un dibujo, en orden de lectura (las vacías por hipótesis no están). */
export function drawnRegions(n: 2 | 3, shape: NestedShape | null = null): Region[] {
  const l = vennLayout(n, shape);
  return regionOrder(n).filter((r) => l.paths[r] !== "");
}
