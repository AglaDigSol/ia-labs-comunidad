// Datos para los dibujos: muestreo de una curva y = f(x) partida en tramos donde no está definida o
// salta (tan x, 1/x), un rango de y razonable, curvas de nivel de f(x, y) por cuadrados marchantes y
// una rejilla de flechas del gradiente. Solo números: el dibujo (SVG con los colores del tema) está en
// los componentes.

export type Pt = [number, number];

/** Tramos de la curva: se corta donde f no es finita o sale muy lejos del rango visible. */
export function sampleCurve(f: (x: number) => number, a: number, b: number, n = 240, yRange?: [number, number]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  const span = yRange ? yRange[1] - yRange[0] : Infinity;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    const prev = cur[cur.length - 1];
    const jump = prev !== undefined && yRange !== undefined && Math.abs(y - prev[1]) > 4 * span;
    if (!Number.isFinite(y) || jump) {
      if (cur.length > 1) out.push(cur);
      cur = Number.isFinite(y) ? [[x, y]] : [];
      continue;
    }
    cur.push([x, y]);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Rango de y que enseña lo importante: percentiles 5–95 de los valores, con un margen. */
export function niceRange(values: readonly number[], fallback: [number, number] = [-1, 1]): [number, number] {
  const fin = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (fin.length === 0) return fallback;
  const lo = fin[Math.floor(fin.length * 0.05)]!;
  const hi = fin[Math.min(fin.length - 1, Math.ceil(fin.length * 0.95))]!;
  const pad = Math.max((hi - lo) * 0.12, 0.5);
  return [lo - pad, hi + pad];
}

/** Marcas «redondas» de un eje (1, 2, 5 × 10ᵏ). */
export function ticks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  return out;
}

export type Grid = { xs: number[]; ys: number[]; z: number[][] };

/** Valores de f en una rejilla (z[j][i] = f(xs[i], ys[j])). */
export function sampleGrid(f: (x: number, y: number) => number, x: [number, number], y: [number, number], n = 48): Grid {
  const xs = Array.from({ length: n + 1 }, (_, i) => x[0] + ((x[1] - x[0]) * i) / n);
  const ys = Array.from({ length: n + 1 }, (_, j) => y[0] + ((y[1] - y[0]) * j) / n);
  return { xs, ys, z: ys.map((yy) => xs.map((xx) => f(xx, yy))) };
}

/**
 * Niveles para las curvas: cuantiles de los valores de la rejilla (así se ven también en funciones
 * muy empinadas como la de Rosenbrock), sin repetir.
 */
export function contourLevels(grid: Grid, count = 10): number[] {
  const vals = grid.z.flat().filter(Number.isFinite).sort((a, b) => a - b);
  if (vals.length === 0) return [];
  const out: number[] = [];
  for (let k = 1; k <= count; k++) {
    // Más niveles cerca del mínimo: cuantiles al cuadrado.
    const q = Math.pow(k / (count + 1), 2);
    const v = vals[Math.floor(q * (vals.length - 1))]!;
    if (!out.some((o) => Math.abs(o - v) <= 1e-9 * Math.max(1, Math.abs(v)))) out.push(v);
  }
  return out;
}

/** Segmentos de la curva de nivel f = level (cuadrados marchantes con interpolación lineal). */
export function contourSegments(grid: Grid, level: number): Array<[Pt, Pt]> {
  const { xs, ys, z } = grid;
  const segs: Array<[Pt, Pt]> = [];
  const lerp = (p: Pt, q: Pt, a: number, b: number): Pt => {
    const t = a === b ? 0.5 : (level - a) / (b - a);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const v = [z[j]![i]!, z[j]![i + 1]!, z[j + 1]![i + 1]!, z[j + 1]![i]!];
      if (!v.every(Number.isFinite)) continue;
      const c: Pt[] = [
        [xs[i]!, ys[j]!],
        [xs[i + 1]!, ys[j]!],
        [xs[i + 1]!, ys[j + 1]!],
        [xs[i]!, ys[j + 1]!],
      ];
      const cross: Pt[] = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e]!;
        const b = v[(e + 1) % 4]!;
        if ((a < level) !== (b < level)) cross.push(lerp(c[e]!, c[(e + 1) % 4]!, a, b));
      }
      if (cross.length === 2) segs.push([cross[0]!, cross[1]!]);
      else if (cross.length === 4) {
        segs.push([cross[0]!, cross[1]!]);
        segs.push([cross[2]!, cross[3]!]);
      }
    }
  }
  return segs;
}

/** Flechas del gradiente en una rejilla de m × m puntos (dirección; la longitud se normaliza al dibujar). */
export function gradientField(
  grad: (x: number, y: number) => [number, number],
  x: [number, number],
  y: [number, number],
  m = 7,
): Array<{ at: Pt; g: Pt }> {
  const out: Array<{ at: Pt; g: Pt }> = [];
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const px = x[0] + ((x[1] - x[0]) * (i + 0.5)) / m;
      const py = y[0] + ((y[1] - y[0]) * (j + 0.5)) / m;
      const g = grad(px, py);
      if (g.every(Number.isFinite)) out.push({ at: [px, py], g });
    }
  }
  return out;
}
