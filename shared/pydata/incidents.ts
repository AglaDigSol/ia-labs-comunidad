// Incidencias inventadas (inundaciones, incendios, tormentas…) con la fecha, el lugar escrito de
// cualquier manera (mayúsculas mezcladas y espacios de más), la latitud y la longitud (con algunas
// fuera de rango y alguna justo en el límite), la categoría y el nivel de daño (con huecos). Y una
// tabla de consulta lugar → código de país (códigos inventados del rango X..) con filas repetidas y
// lugares que faltan, para practicar merge(how="left") y contar lo que no casa.
//
// Los hechos siguen INCIDENTS_PIPELINE y se comprueban en las pruebas con pandas de verdad.
import { rngFor, type Rng } from "../exercises/random.ts";
import { countBy, isIsoDate, isNumeric, isoDate, npRound, PANDAS_NA, sortedRecord, toCsv, type Table } from "./csv.ts";
import { CATEGORIES, countryCodes, messy, placeNames } from "./names.ts";

export const INCIDENT_COLUMNS = ["id", "fecha", "lugar", "lat", "lon", "categoria", "danio"] as const;
export type IncidentColumn = (typeof INCIDENT_COLUMNS)[number];
export const LOOKUP_COLUMNS = ["lugar", "pais"] as const;

export interface IncidentOptions {
  /** Filas (de 20 a 5000). */
  rows: number;
  /** Lugares distintos (por defecto, según el tamaño). */
  places?: number;
  /** Primer año y cuántos años (por defecto, 2019 y 5). */
  firstYear?: number;
  years?: number;
  /** Proporción de coordenadas fuera de rango (por defecto 0,06). */
  outOfRange?: number;
  /** Proporción de niveles de daño vacíos (por defecto 0,15). */
  damageBlank?: number;
  /** Proporción de lugares que no están en la tabla de consulta (por defecto 0,2) y filas repetidas en ella (por defecto 2). */
  unmatched?: number;
  duplicates?: number;
}

export interface IncidentFacts {
  rows: number;
  /** Tras pd.read_csv: celdas vacías por columna. */
  nullsRead: Record<IncidentColumn, number>;
  /** (df.isna().mean() * 100).round(2) recién leído. */
  nullPercent: Record<IncidentColumn, number>;
  /** 1. Filas con lat entre −90 y 90 y lon entre −180 y 180 (ambos incluidos; un NaN no pasa). */
  validCoords: number;
  /** 2. En las filas válidas: incidencias por año (pd.to_datetime(fecha).dt.year; sin las fechas vacías). */
  byYear: Record<string, number>;
  /** 2. En las filas válidas: pivot_table(index="categoria", columns="anio", values="id", aggfunc="count").fillna(0). */
  pivot: Record<string, Record<string, number>>;
  /** 3. En las filas válidas, con lugar = lugar.str.strip().str.lower(): lugares distintos (sin el NaN). */
  distinctPlaces: number;
  /** 4. Filas de la tabla de consulta, y sin repetidas (drop_duplicates()). */
  lookupRows: number;
  lookupUnique: number;
  /** 4. merge(how="left") de las filas válidas con la tabla tal cual (las repetidas multiplican filas) y sin repetidas. */
  mergedRows: number;
  mergedRowsDedup: number;
  /** 4. Tras el merge sin repetidas: filas sin país (pais NaN) y sus lugares (normalizados, en orden alfabético). */
  unmatched: number;
  unmatchedPlaces: string[];
  /** En las filas válidas: niveles de daño vacíos y media del daño por categoría (redondeada a dos decimales). */
  damageNulls: number;
  meanDamageByCategory: Record<string, number>;
}

export const INCIDENTS_PIPELINE = [
  'df = pd.read_csv("incidencias.csv")',
  'df = df[df["lat"].between(-90, 90) & df["lon"].between(-180, 180)]',
  'df["anio"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year',
  'df["lugar"] = df["lugar"].str.strip().str.lower()',
  'paises = pd.read_csv("paises.csv").drop_duplicates()',
  'df = df.merge(paises, on="lugar", how="left")',
] as const;

export interface IncidentDataset {
  file: string;
  csv: string;
  table: Table;
  /** La tabla de consulta (paises.csv). */
  lookup: { file: string; csv: string; table: Table };
  facts: IncidentFacts;
}

type Row = Record<IncidentColumn, string>;

const coord = (rng: Rng, min: number, max: number) => (rng.int(min * 10_000, max * 10_000) / 10_000).toFixed(4);

function outOfRange(rng: Rng, limit: number): string {
  const sign = rng.chance(0.5) ? -1 : 1;
  return (sign * (limit + rng.int(1, 600_000) / 10_000)).toFixed(4);
}

function draft(rng: Rng, o: Required<IncidentOptions>, places: string[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < o.rows; i++) {
    let lat = coord(rng, -55, 70);
    let lon = coord(rng, -170, 170);
    if (rng.chance(o.outOfRange)) {
      if (rng.chance(0.5)) lat = outOfRange(rng, 90);
      else lon = outOfRange(rng, 180);
    } else if (rng.chance(0.02)) {
      // Justo en el límite: es válida (between incluye los extremos).
      if (rng.chance(0.5)) lat = rng.pick(["90.0000", "-90.0000"]);
      else lon = rng.pick(["180.0000", "-180.0000"]);
    }
    if (rng.chance(0.03)) lat = "";
    if (rng.chance(0.03)) lon = "";
    rows.push({
      id: String(i + 1),
      fecha: i > 0 && rng.chance(0.03) ? "" : isoDate(o.firstYear + rng.int(0, o.years - 1), rng.int(1, 12), rng.int(1, 28)),
      lugar: rng.chance(0.02) ? "" : messy(rng, rng.pick(places)),
      lat,
      lon,
      categoria: rng.chance(0.02) ? "" : rng.pick(CATEGORIES),
      danio: rng.chance(o.damageBlank) ? "" : String(rng.int(1, 5)),
    });
  }
  return rows;
}

const nullOf = (v: string) => PANDAS_NA.has(v);

export function incidentFacts(rows: readonly Row[], lookup: readonly string[][]): IncidentFacts {
  const n = rows.length;
  const nullsRead = Object.fromEntries(INCIDENT_COLUMNS.map((c) => [c, rows.filter((r) => nullOf(r[c])).length])) as Record<IncidentColumn, number>;
  const nullPercent = Object.fromEntries(INCIDENT_COLUMNS.map((c) => [c, npRound((nullsRead[c] / n) * 100, 2)])) as Record<IncidentColumn, number>;
  const inRange = (v: string, lim: number) => isNumeric(v) && Math.abs(Number(v)) <= lim;
  const valid = rows.filter((r) => inRange(r.lat, 90) && inRange(r.lon, 180));
  const year = (r: Row) => (isIsoDate(r.fecha) ? r.fecha.slice(0, 4) : null);
  // pivot_table deja fuera las filas con la categoría o el año vacíos (y con ellas sus filas y columnas).
  const both = valid.filter((r) => !nullOf(r.categoria) && year(r) !== null);
  const cats = [...new Set(both.map((r) => r.categoria))].sort();
  const years = [...new Set(both.map((r) => year(r)!))].sort();
  const pivot: Record<string, Record<string, number>> = {};
  for (const c of cats) pivot[c] = Object.fromEntries(years.map((y) => [y, both.filter((r) => r.categoria === c && year(r) === y).length]));
  const norm = (r: Row) => (nullOf(r.lugar) ? null : r.lugar.trim().toLowerCase());
  const keys = lookup.map((r) => r[0]!);
  const unique = [...new Set(lookup.map((r) => r.join(",")))];
  const uniqueKeys = new Set(keys);
  const copies = (k: string | null) => (k === null ? 0 : keys.filter((x) => x === k).length);
  const unmatchedRows = valid.filter((r) => !uniqueKeys.has(norm(r) ?? "\u0000"));
  const damage = new Map<string, number[]>();
  for (const r of valid) if (!nullOf(r.categoria) && !nullOf(r.danio)) damage.set(r.categoria, [...(damage.get(r.categoria) ?? []), Number(r.danio)]);
  return {
    rows: n,
    nullsRead,
    nullPercent,
    validCoords: valid.length,
    byYear: sortedRecord(countBy(valid, year), true),
    pivot,
    distinctPlaces: new Set(valid.map(norm).filter((x) => x !== null)).size,
    lookupRows: lookup.length,
    lookupUnique: unique.length,
    mergedRows: valid.reduce((s, r) => s + Math.max(1, copies(norm(r))), 0),
    mergedRowsDedup: valid.length,
    unmatched: unmatchedRows.length,
    unmatchedPlaces: [...new Set(unmatchedRows.map(norm).filter((x): x is string => x !== null))].sort(),
    damageNulls: valid.filter((r) => nullOf(r.danio)).length,
    meanDamageByCategory: sortedRecord(Object.fromEntries([...damage].map(([c, xs]) => [c, npRound(xs.reduce((s, x) => s + x, 0) / xs.length, 2)]))),
  };
}

/** Incidencias y su tabla de países, deterministas (misma semilla y opciones, mismos CSV). */
export function incidents(seed: number, options: IncidentOptions): IncidentDataset {
  const rows = Math.max(20, Math.min(5000, Math.round(options.rows)));
  const o: Required<IncidentOptions> = {
    rows,
    places: Math.max(4, options.places ?? (rows < 60 ? 6 : rows < 400 ? 12 : 25)),
    firstYear: options.firstYear ?? 2019,
    years: Math.max(1, Math.min(10, options.years ?? 5)),
    outOfRange: Math.max(0, Math.min(0.3, options.outOfRange ?? 0.06)),
    damageBlank: Math.max(0, Math.min(0.5, options.damageBlank ?? 0.15)),
    unmatched: Math.max(0, Math.min(0.6, options.unmatched ?? 0.2)),
    duplicates: Math.max(0, Math.min(5, options.duplicates ?? 2)),
  };
  const rng = rngFor("pydata:incidencias", seed);
  const places = placeNames(rng, o.places);
  const data = draft(rng, o, places);
  // Tabla de consulta: los lugares normalizados menos unos cuantos, más algún lugar que no sale y repetidas.
  const missing = Math.max(1, Math.round(places.length * o.unmatched));
  const listed = rng.shuffle(places).slice(missing);
  const extra = placeNames(rng, places.length + 2).filter((p) => !places.includes(p)).slice(0, 2);
  const codes = countryCodes(rng, Math.max(3, Math.ceil(places.length / 3)));
  const lookupRows: string[][] = [...listed, ...extra].map((p) => [p.toLowerCase(), rng.pick(codes)]);
  for (let k = 0; k < o.duplicates && lookupRows.length > 0; k++) lookupRows.push([...rng.pick(lookupRows.slice(0, listed.length))]);
  const lookup = rng.shuffle(lookupRows);
  const table: Table = { header: [...INCIDENT_COLUMNS], rows: data.map((r) => INCIDENT_COLUMNS.map((c) => r[c])) };
  const lookupTable: Table = { header: [...LOOKUP_COLUMNS], rows: lookup };
  return {
    file: "incidencias.csv",
    csv: toCsv(table),
    table,
    lookup: { file: "paises.csv", csv: toCsv(lookupTable), table: lookupTable },
    facts: incidentFacts(data, lookup),
  };
}
