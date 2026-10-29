// Cardinales de conjuntos finitos: inclusión–exclusión con dos y tres conjuntos y el reparto de un
// problema en las regiones del diagrama de Venn. Cada dato del problema (|A| = 40, |A ∪ B| = 55, |U| =
// 60…) es una ecuación lineal: la suma de las regiones que forman la expresión. Si los datos fijan una
// única solución entera y no negativa, esa es la cuenta de cada región.
import { div, frac, isZero, mul, sub, ZERO, type Frac } from "../rational.ts";
import { inRegion, regionCount, type Region, type SetExpr, type SetName } from "./expr.ts";

/** |A ∪ B| = |A| + |B| − |A ∩ B|. */
export const inclusionExclusion2 = (a: number, b: number, ab: number): number => a + b - ab;

/** |A ∪ B ∪ C| = |A| + |B| + |C| − |A ∩ B| − |A ∩ C| − |B ∩ C| + |A ∩ B ∩ C|. */
export const inclusionExclusion3 = (a: number, b: number, c: number, ab: number, ac: number, bc: number, abc: number): number =>
  a + b + c - ab - ac - bc + abc;

/** Fórmula de inclusión–exclusión en TeX, para 2 o 3 conjuntos. */
export function inclusionExclusionTex(n: 2 | 3): string {
  return n === 2
    ? "|A \\cup B| = |A| + |B| - |A \\cap B|"
    : "|A \\cup B \\cup C| = |A| + |B| + |C| - |A \\cap B| - |A \\cap C| - |B \\cap C| + |A \\cap B \\cap C|";
}

/** Número de elementos de la expresión, sumando las regiones que la forman. */
export function countOf(e: SetExpr, vars: readonly SetName[], counts: readonly number[]): number {
  return counts.reduce((s, c, r) => (inRegion(e, vars, r) ? s + c : s), 0);
}

/**
 * Orden en que se rellenan las regiones «de dentro hacia fuera»: primero la de todos los conjuntos,
 * luego las de n − 1, … y por último la de fuera de todos.
 */
export function regionLayers(n: number): Region[][] {
  const pop = (r: number) => r.toString(2).split("").filter((c) => c === "1").length;
  const layers: Region[][] = [];
  for (let k = n; k >= 0; k--) {
    const layer: Region[] = [];
    for (let r = regionCount(n) - 1; r >= 0; r--) if (pop(r) === k) layer.push(r);
    layers.push(layer);
  }
  return layers;
}

export type CardinalDatum = { expr: SetExpr; value: number };

export type RegionSolution =
  | { ok: true; counts: number[] }
  | { ok: false; reason: "underdetermined" | "inconsistent" | "not-natural" };

/**
 * Resuelve las regiones a partir de los datos (eliminación de Gauss con fracciones exactas). Falla si
 * los datos no bastan, se contradicen o la solución no son números naturales.
 */
export function solveRegions(vars: readonly SetName[], data: readonly CardinalDatum[]): RegionSolution {
  const m = regionCount(vars.length);
  const rows: Frac[][] = data.map((d) => [
    ...Array.from({ length: m }, (_, r) => (inRegion(d.expr, vars, r) ? frac(1n) : ZERO)),
    frac(BigInt(d.value)),
  ]);
  let rank = 0;
  const pivotCol: number[] = [];
  for (let col = 0; col < m && rank < rows.length; col++) {
    const p = rows.findIndex((row, i) => i >= rank && !isZero(row[col]!));
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p]!, rows[rank]!];
    const pivot = rows[rank]![col]!;
    rows[rank] = rows[rank]!.map((x) => div(x, pivot));
    for (let i = 0; i < rows.length; i++) {
      if (i === rank || isZero(rows[i]![col]!)) continue;
      const f = rows[i]![col]!;
      rows[i] = rows[i]!.map((x, j) => sub(x, mul(f, rows[rank]![j]!)));
    }
    pivotCol.push(col);
    rank++;
  }
  // Una fila 0 = c con c ≠ 0 es una contradicción.
  for (let i = rank; i < rows.length; i++) if (!isZero(rows[i]![m]!)) return { ok: false, reason: "inconsistent" };
  if (rank < m) return { ok: false, reason: "underdetermined" };
  const counts = new Array<number>(m).fill(0);
  for (let i = 0; i < rank; i++) {
    const v = rows[i]![m]!;
    if (v.d !== 1n || v.n < 0n) return { ok: false, reason: "not-natural" };
    counts[pivotCol[i]!] = Number(v.n);
  }
  return { ok: true, counts };
}
