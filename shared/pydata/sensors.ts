// Lecturas de sensores inventados, una fila por hora, con valores perdidos (NaN) en patrones
// distintos: columnas casi completas, huecos en medio, huecos en los extremos y columnas «rotas» con
// más de k huecos. Sirve para isna, dropna(axis=1, thresh=…), interpolate y fillna.
//
// Hechos (SENSORS_PIPELINE): con el umbral k, qué columnas se quitan (más de k NaN), y la tabla tras
// interpolate() (lineal) y bfill() / ffill() en los extremos. La interpolación aquí es la de np.interp,
// así que las pruebas la comparan con pandas con tolerancia.
import { rngFor, type Rng } from "../exercises/random.ts";
import { npRound, toCsv, type Table } from "./csv.ts";

export interface SensorOptions {
  /** Filas (horas), de 8 a 500. */
  rows: number;
  /** Sensores (columnas además de «hora»), de 3 a 8. */
  sensors: number;
  /** Umbral: se quitan las columnas con más de k NaN (por defecto, un 20 % de las filas, al menos 2). */
  k?: number;
}

export type SensorProfile = "completa" | "huecos" | "bordes" | "rota";

export interface SensorFacts {
  rows: number;
  k: number;
  columns: string[];
  /** Perfil de cada sensor (cómo se repartieron sus NaN). */
  profiles: Record<string, SensorProfile>;
  nanPerColumn: Record<string, number>;
  /** Columnas con más de k NaN (las que quita dropna(axis=1, thresh=filas - k)) y las que quedan. */
  dropped: string[];
  kept: string[];
  /** NaN que quedan en cada columna tras solo interpolate() (los del principio no se rellenan). */
  nanAfterInterpolate: Record<string, number>;
  /** La tabla final (columnas de kept), tras interpolate().bfill().ffill(), fila a fila. */
  filled: number[][];
  /** Suma de cada columna de kept en la tabla final, redondeada a dos decimales. */
  sums: Record<string, number>;
}

export const SENSORS_PIPELINE = [
  'df = pd.read_csv("sensores.csv")',
  "df = df.dropna(axis=1, thresh=len(df) - k)",
  "df = df.interpolate().bfill().ffill()",
] as const;

export interface SensorDataset {
  file: string;
  csv: string;
  table: Table;
  /** Los valores, con null en los NaN (columna «hora» incluida). */
  values: Array<Array<number | null>>;
  facts: SensorFacts;
}

/** Interpolación lineal como interpolate() de pandas (np.interp por posiciones; al final, el último valor). */
export function interpolateColumn(col: ReadonlyArray<number | null>): Array<number | null> {
  const idx = col.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (idx.length === 0) return [...col];
  return col.map((v, i) => {
    if (v !== null) return v;
    if (i < idx[0]!) return null; // antes del primer valor: sigue siendo NaN
    let j = 0;
    while (j + 1 < idx.length && idx[j + 1]! < i) j++;
    if (j + 1 >= idx.length) return col[idx[idx.length - 1]!]!; // tras el último valor: el último
    const [x0, x1] = [idx[j]!, idx[j + 1]!];
    const [y0, y1] = [col[x0]!, col[x1]!];
    const slope = (y1 - y0) / (x1 - x0);
    return slope * (i - x0) + y0;
  });
}

function fillEdges(col: ReadonlyArray<number | null>): number[] {
  const first = col.find((v) => v !== null) ?? 0;
  const out: number[] = [];
  let last: number | null = null;
  for (const v of col) {
    last = v ?? last;
    out.push(v ?? last ?? first);
  }
  return out;
}

function holes(rng: Rng, n: number, profile: SensorProfile, k: number): Set<number> {
  const out = new Set<number>();
  const interior = () => rng.int(1, n - 2);
  if (profile === "completa") {
    if (rng.chance(0.5)) out.add(interior());
  } else if (profile === "huecos") {
    const target = rng.int(2, Math.max(2, k));
    while (out.size < target) {
      const start = interior();
      for (let d = 0; d < rng.int(1, 3) && out.size < target; d++) if (start + d <= n - 2) out.add(start + d);
    }
  } else if (profile === "bordes") {
    const lead = rng.int(1, Math.max(1, Math.floor(k / 2)));
    for (let i = 0; i < lead; i++) out.add(i);
    const tail = rng.int(1, Math.max(1, k - lead));
    for (let i = 0; i < tail; i++) out.add(n - 1 - i);
  } else {
    const target = rng.int(k + 1, Math.min(n - 2, k + 1 + Math.floor(n / 4)));
    while (out.size < target) out.add(rng.int(0, n - 1));
  }
  return out;
}

/** Sensores deterministas: misma semilla y opciones, mismo CSV. Siempre hay al menos una columna rota y una con bordes. */
export function sensors(seed: number, options: SensorOptions): SensorDataset {
  const n = Math.max(8, Math.min(500, Math.round(options.rows)));
  const m = Math.max(3, Math.min(8, Math.round(options.sensors)));
  const k = Math.max(2, Math.min(n - 3, options.k ?? Math.max(2, Math.round(n * 0.2))));
  const rng = rngFor("pydata:sensores", seed);
  const columns = Array.from({ length: m }, (_, i) => `s${i + 1}`);
  const profiles = Object.fromEntries(
    columns.map((c, i) => [c, i === 0 ? "rota" : i === 1 ? "bordes" : rng.pick<SensorProfile>(["completa", "huecos", "bordes", "rota", "huecos"])]),
  ) as Record<string, SensorProfile>;
  // Baraja el orden para que la rota no sea siempre la primera.
  const order = rng.shuffle(columns);
  const prof = Object.fromEntries(order.map((c, i) => [c, profiles[columns[i]!]!])) as Record<string, SensorProfile>;
  const series: Record<string, Array<number | null>> = {};
  for (const c of columns) {
    const base = rng.int(100, 300) / 10;
    const trend = rng.int(-5, 5) / 10;
    const hs = holes(rng, n, prof[c]!, k);
    series[c] = Array.from({ length: n }, (_, i) => (hs.has(i) ? null : npRound(base + trend * i + rng.int(-20, 20) / 10, 1)));
  }
  const values = Array.from({ length: n }, (_, i) => [i, ...columns.map((c) => series[c]![i]!)]);
  const nanPerColumn = Object.fromEntries(columns.map((c) => [c, series[c]!.filter((v) => v === null).length]));
  const dropped = columns.filter((c) => nanPerColumn[c]! > k);
  const kept = columns.filter((c) => nanPerColumn[c]! <= k);
  const interp = Object.fromEntries(kept.map((c) => [c, interpolateColumn(series[c]!)]));
  const filledCols = Object.fromEntries(kept.map((c) => [c, fillEdges(interp[c]!)]));
  const table: Table = {
    header: ["hora", ...columns],
    rows: values.map((r) => r.map((v) => (v === null ? "" : String(v)))),
  };
  return {
    file: "sensores.csv",
    csv: toCsv(table),
    table,
    values,
    facts: {
      rows: n,
      k,
      columns,
      profiles: prof,
      nanPerColumn,
      dropped,
      kept,
      nanAfterInterpolate: Object.fromEntries(kept.map((c) => [c, interp[c]!.filter((v) => v === null).length])),
      filled: Array.from({ length: n }, (_, i) => kept.map((c) => filledCols[c]![i]!)),
      sums: Object.fromEntries(kept.map((c) => [c, npRound(filledCols[c]!.reduce((s, x) => s + x, 0), 2)])),
    },
  };
}
