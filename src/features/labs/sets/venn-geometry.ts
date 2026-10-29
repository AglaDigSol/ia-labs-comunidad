// Geometría del diagrama de Venn: dos o tres círculos dentro del rectángulo del universo. Cada región
// (shared/sets/expr.ts: máscara de bits, bit i = dentro del conjunto i) es un camino SVG exacto hecho
// con arcos de los círculos, así que se puede pulsar y enfocar región a región. Se calcula una vez por
// número de conjuntos.
import { regionCount, type Region } from "../../../../shared/sets/expr.ts";

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
  /** Camino de cada región (índice = región). La región 0 usa la regla evenodd. */
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

  // Ancla de cada región: el punto de una rejilla más alejado de cualquier borde.
  const regionAt = (p: { x: number; y: number }) => circles.reduce((r, c, j) => (inside(p, c) ? r | (1 << j) : r), 0);
  const best = Array.from({ length: regionCount(n) }, () => ({ x: width / 2, y: height / 2, score: -1 }));
  for (let x = PAD + 4; x < width - PAD; x += 3) {
    for (let y = PAD + 4; y < height - PAD; y += 3) {
      const p = { x, y };
      const edge = Math.min(x - PAD, width - PAD - x, y - PAD, height - PAD - y, ...circles.map((c) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r)));
      const r = regionAt(p);
      if (edge > best[r]!.score) best[r] = { x, y, score: edge };
    }
  }
  return { paths, anchors: best.map(({ x, y }) => ({ x, y })) };
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

const cache = new Map<number, VennLayout>();

/** Diagrama de Venn de dos o tres conjuntos (A, B y, si hace falta, C). */
export function vennLayout(n: 2 | 3): VennLayout {
  let l = cache.get(n);
  if (!l) {
    l = layout(n);
    cache.set(n, l);
  }
  return l;
}

/** Regiones en el orden de lectura del diagrama: de dentro hacia fuera. */
export function regionOrder(n: 2 | 3): Region[] {
  return n === 2 ? [3, 1, 2, 0] : [7, 3, 5, 6, 1, 2, 4, 0];
}
