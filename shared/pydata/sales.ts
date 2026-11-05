// Ventas sucias de una cafetería inventada: un ticket por fila con el artículo, la cantidad, el precio
// unitario, el total, la forma de pago, el local y la fecha. Una parte de las celdas está estropeada
// («ERROR», «UNKNOWN», vacía o un número mal escrito como «2,75» o «dos»), y algunas filas llevan un
// precio de promoción distinto del habitual: así el precio de cada artículo hay que deducirlo con la
// moda de las filas válidas, no con el primero que aparece (en los datos hay siempre algún artículo
// cuyo primer precio válido es el de promoción).
//
// Junto al CSV vienen los hechos que hacen falta para corregir, calculados aquí con la misma receta que
// seguiría pandas (SALES_PIPELINE) y comprobados en las pruebas con pandas de verdad.
import { createRng, rngFor, type Rng } from "../exercises/random.ts";
import { countBy, isIsoDate, isNumeric, isoDate, money, npRound, PANDAS_NA, sortedRecord, toCsv, type Table } from "./csv.ts";
import { BRANCHES, ITEMS, PAYMENTS } from "./names.ts";

export const SALES_COLUMNS = ["ticket", "articulo", "cantidad", "precio", "total", "pago", "local", "fecha"] as const;
export type SalesColumn = (typeof SALES_COLUMNS)[number];
/** Columnas numéricas (las que se convierten con pd.to_numeric). */
export const SALES_NUMERIC = ["cantidad", "precio", "total"] as const;
/** Textos que significan «sin dato» además de la celda vacía. */
export const SALES_TOKENS = ["ERROR", "UNKNOWN"] as const;

export interface SalesOptions {
  /** Filas (de 24 a 5000). */
  rows: number;
  /** Proporción de celdas estropeadas en cada columna salvo ticket (de 0 a 0,4; por defecto 0,08). */
  corruption?: number;
  /** Cuántos artículos distintos (de 3 a 16; por defecto, según el tamaño). */
  items?: number;
  /** Proporción de filas válidas con precio de promoción (de 0 a 0,3; por defecto 0,15). */
  promo?: number;
  /** Año de las fechas (por defecto 2025). */
  year?: number;
}

/**
 * Hechos de las ventas, paso a paso, siguiendo SALES_PIPELINE. Los recuentos de nulos son por
 * columna, en el orden de SALES_COLUMNS.
 */
export interface SalesFacts {
  rows: number;
  /** 1. Tras pd.read_csv: solo las celdas vacías son NaN. */
  nullsRead: Record<SalesColumn, number>;
  /** 2. Tras df.replace(["ERROR", "UNKNOWN"], np.nan). */
  nullsTokens: Record<SalesColumn, number>;
  /** 3. Tras pd.to_numeric(..., errors="coerce") en cantidad, precio y total. */
  nullsNumeric: Record<SalesColumn, number>;
  /** 3. Porcentaje de nulos por columna tras el paso 3: (df.isna().mean() * 100).round(2). */
  nullPercent: Record<SalesColumn, number>;
  /** 4. Filas tras df.dropna(subset=["articulo"]). */
  rowsWithItem: number;
  /** 5. Precio de cada artículo: la moda de sus precios válidos (si empatan, el menor, como Series.mode()[0]). */
  pricePerItem: Record<string, number>;
  /** El primer precio válido de cada artículo (el error típico): distinto de la moda en algún artículo. */
  firstSeenPrice: Record<string, number>;
  /** 5. Precios que se rellenan con la moda. */
  pricesFilled: number;
  /** 5. De ellos, los de un artículo cuyo primer precio no es la moda: los que delatan el «primero visto». */
  trapRows: number;
  /** 6. Totales rellenados con precio × cantidad, cantidades con round(total / precio) y filas sin ninguno de los dos. */
  totalsFilled: number;
  quantitiesFilled: number;
  droppedBoth: number;
  /** 6. Filas al final y suma de los totales (redondeada a dos decimales). */
  rowsFinal: number;
  revenue: number;
  /** Al final: suma de total por local (sin los locales nulos), redondeada a dos decimales y por orden alfabético. */
  revenueByBranch: Record<string, number>;
  /** Al final: tickets por forma de pago (groupby("pago").size(), sin los nulos). */
  ticketsByPayment: Record<string, number>;
  /** Al final: tickets por mes (pd.to_datetime(fecha, format="%Y-%m-%d", errors="coerce").dt.month, sin NaT). */
  ticketsByMonth: Record<string, number>;
  /** Al final: unidades vendidas por artículo (suma de cantidad). */
  unitsByItem: Record<string, number>;
}

/** La receta que siguen los hechos (en pandas), para el enunciado del simulacro y las pruebas. */
export const SALES_PIPELINE = [
  'df = pd.read_csv("ventas.csv")',
  'df = df.replace(["ERROR", "UNKNOWN"], np.nan)',
  'for c in ["cantidad", "precio", "total"]: df[c] = pd.to_numeric(df[c], errors="coerce")',
  'df = df.dropna(subset=["articulo"])',
  'precios = df.dropna(subset=["precio"]).groupby("articulo")["precio"].agg(lambda s: s.mode()[0])',
  'df["precio"] = df["precio"].fillna(df["articulo"].map(precios))',
  "faltan_t = df.total.isna() & df.cantidad.notna(); df.loc[faltan_t, \"total\"] = df.precio * df.cantidad",
  "faltan_c = df.cantidad.isna() & df.total.notna(); df.loc[faltan_c, \"cantidad\"] = (df.total / df.precio).round()",
  'df = df.dropna(subset=["cantidad", "total"], how="all")',
] as const;

export interface SalesDataset {
  /** Nombre del archivo con el que se escribe («ventas.csv»). */
  file: string;
  csv: string;
  table: Table;
  /** Precio habitual de cada artículo (el de la carta). */
  catalog: Record<string, number>;
  facts: SalesFacts;
}

type Row = Record<SalesColumn, string>;

/** Precio en múltiplos de 0,25 €: así precio × cantidad es exacto en coma flotante. */
const priceOf = (rng: Rng) => rng.int(5, 39) / 4;

function corruptCell(rng: Rng, col: SalesColumn, value: string): string {
  if (col === "cantidad" && rng.chance(0.35)) return rng.pick(["dos", "tres", `${value} uds`]);
  if ((col === "precio" || col === "total") && rng.chance(0.35)) return rng.chance(0.5) ? value.replace(".", ",") : `${value}€`;
  if (col === "fecha" && rng.chance(0.3)) return rng.pick(["2025-02-30", "2025-13-01", "31/12/2025"]);
  return rng.pick(["ERROR", "UNKNOWN", ""]);
}

function draft(rng: Rng, opts: Required<SalesOptions>): { rows: Row[]; catalog: Record<string, number> } {
  const items = rng.shuffle(ITEMS).slice(0, opts.items);
  const catalog: Record<string, number> = {};
  for (const it of items) catalog[it] = priceOf(rng);
  const rows: Row[] = [];
  for (let i = 0; i < opts.rows; i++) {
    const item = rng.pick(items);
    const qty = rng.int(1, 6);
    const promo = rng.chance(opts.promo) && catalog[item]! > 1;
    const price = promo ? catalog[item]! - 0.5 : catalog[item]!;
    rows.push({
      ticket: `T${String(i + 1).padStart(5, "0")}`,
      articulo: item,
      cantidad: String(qty),
      precio: money(price),
      total: money(price * qty),
      pago: rng.pick(PAYMENTS),
      local: rng.pick(BRANCHES),
      fecha: isoDate(opts.year, rng.int(1, 12), rng.int(1, 28)),
    });
  }
  // Estropea celdas al azar (nunca el ticket ni la primera fila, que fija el formato de las fechas).
  for (const r of rows.slice(1)) {
    for (const col of SALES_COLUMNS) {
      if (col !== "ticket" && rng.chance(opts.corruption)) r[col] = corruptCell(rng, col, r[col]);
    }
  }
  return { rows, catalog };
}

const nullCounts = (rows: readonly Row[], isNull: (col: SalesColumn, v: string) => boolean) =>
  Object.fromEntries(SALES_COLUMNS.map((c) => [c, rows.filter((r) => isNull(c, r[c])).length])) as Record<SalesColumn, number>;

/** Moda de una lista de números (si hay empate, la menor, como Series.mode()[0]); null si está vacía. */
function mode(xs: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [x, n] of counts) if (n > bestN || (n === bestN && best !== null && x < best)) [best, bestN] = [x, n];
  return best;
}

/** Valor de una celda tras los pasos 1 a 3: null si es NaN; si no, el texto o el número. */
type Clean = { item: string | null; qty: number | null; price: number | null; total: number | null; pago: string | null; local: string | null; fecha: string | null };

function cleanRow(r: Row): Clean {
  const txt = (v: string) => (PANDAS_NA.has(v) || (SALES_TOKENS as readonly string[]).includes(v) ? null : v);
  const num = (v: string) => {
    const t = txt(v);
    return t !== null && isNumeric(t) ? Number(t) : null;
  };
  return { item: txt(r.articulo), qty: num(r.cantidad), price: num(r.precio), total: num(r.total), pago: txt(r.pago), local: txt(r.local), fecha: txt(r.fecha) };
}

export function salesFacts(rows: readonly Row[]): SalesFacts {
  const n = rows.length;
  const nullsRead = nullCounts(rows, (_c, v) => PANDAS_NA.has(v));
  const isTok = (v: string) => PANDAS_NA.has(v) || (SALES_TOKENS as readonly string[]).includes(v);
  const nullsTokens = nullCounts(rows, (_c, v) => isTok(v));
  const nullsNumeric = nullCounts(rows, (c, v) => isTok(v) || ((SALES_NUMERIC as readonly string[]).includes(c) && !isNumeric(v)));
  const nullPercent = Object.fromEntries(SALES_COLUMNS.map((c) => [c, npRound((nullsNumeric[c] / n) * 100, 2)])) as Record<SalesColumn, number>;

  const kept = rows.map(cleanRow).filter((r) => r.item !== null);
  const byItem = new Map<string, number[]>();
  for (const r of kept) if (r.price !== null) byItem.set(r.item!, [...(byItem.get(r.item!) ?? []), r.price]);
  const pricePerItem: Record<string, number> = {};
  const firstSeenPrice: Record<string, number> = {};
  for (const [it, ps] of byItem) {
    pricePerItem[it] = mode(ps)!;
    firstSeenPrice[it] = ps[0]!;
  }
  const trapRows = kept.filter((r) => r.price === null && pricePerItem[r.item!] !== undefined && firstSeenPrice[r.item!] !== pricePerItem[r.item!]).length;
  let pricesFilled = 0;
  let totalsFilled = 0;
  let quantitiesFilled = 0;
  for (const r of kept) {
    if (r.price === null && pricePerItem[r.item!] !== undefined) {
      r.price = pricePerItem[r.item!]!;
      pricesFilled++;
    }
  }
  for (const r of kept) {
    if (r.total === null && r.qty !== null) {
      r.total = r.price === null ? null : r.price * r.qty;
      totalsFilled++;
    } else if (r.qty === null && r.total !== null) {
      r.qty = r.price === null ? null : npRound(r.total / r.price);
      quantitiesFilled++;
    }
  }
  const final = kept.filter((r) => r.qty !== null || r.total !== null);
  const droppedBoth = kept.length - final.length;
  const sumBy = (key: (r: Clean) => string | null, val: (r: Clean) => number | null) => {
    const out: Record<string, number> = {};
    for (const r of final) {
      const k = key(r);
      const v = val(r);
      if (k !== null) out[k] = (out[k] ?? 0) + (v ?? 0);
    }
    return out;
  };
  const revenueByBranch = sortedRecord(Object.fromEntries(Object.entries(sumBy((r) => r.local, (r) => r.total)).map(([k, v]) => [k, npRound(v, 2)])));
  return {
    rows: n,
    nullsRead,
    nullsTokens,
    nullsNumeric,
    nullPercent,
    rowsWithItem: kept.length,
    pricePerItem: sortedRecord(pricePerItem),
    firstSeenPrice: sortedRecord(firstSeenPrice),
    pricesFilled,
    trapRows,
    totalsFilled,
    quantitiesFilled,
    droppedBoth,
    rowsFinal: final.length,
    revenue: npRound(final.reduce((s, r) => s + (r.total ?? 0), 0), 2),
    revenueByBranch,
    ticketsByPayment: sortedRecord(countBy(final, (r) => r.pago)),
    ticketsByMonth: sortedRecord(countBy(final, (r) => (r.fecha !== null && isIsoDate(r.fecha) ? String(Number(r.fecha.slice(5, 7))) : null)), true),
    unitsByItem: sortedRecord(sumBy((r) => r.item, (r) => r.qty)),
  };
}

/** ¿Sirven los datos? Cada artículo con precio válido, la moda sin empates y algún primer precio de promoción. */
function usable(rows: readonly Row[], catalog: Record<string, number>): boolean {
  const kept = rows.map(cleanRow).filter((r) => r.item !== null);
  let trap = false;
  for (const it of Object.keys(catalog)) {
    const ps = kept.filter((r) => r.item === it && r.price !== null).map((r) => r.price!);
    if (ps.length === 0) return false;
    const regular = ps.filter((p) => p === catalog[it]).length;
    if (regular <= ps.length - regular) return false;
    if (ps[0] !== catalog[it]) trap = true;
  }
  return trap;
}

/**
 * Ventas sucias deterministas: la misma semilla y opciones dan el mismo CSV. Repite el sorteo (con el
 * mismo generador) hasta que los datos sirven para el ejercicio del precio por moda.
 */
export function dirtySales(seed: number, options: SalesOptions): SalesDataset {
  const rows = Math.max(24, Math.min(5000, Math.round(options.rows)));
  const opts: Required<SalesOptions> = {
    rows,
    corruption: Math.max(0, Math.min(0.4, options.corruption ?? 0.08)),
    items: Math.max(3, Math.min(ITEMS.length, options.items ?? (rows < 60 ? 3 : rows < 300 ? 6 : 10))),
    promo: Math.max(0, Math.min(0.3, options.promo ?? 0.15)),
    year: options.year ?? 2025,
  };
  const rng = rngFor("pydata:ventas", seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const { rows: data, catalog } = draft(attempt === 0 ? rng : createRng((seed + attempt * 7919) >>> 0), opts);
    if (!usable(data, catalog)) continue;
    const table: Table = { header: [...SALES_COLUMNS], rows: data.map((r) => SALES_COLUMNS.map((c) => r[c])) };
    return { file: "ventas.csv", csv: toCsv(table), table, catalog, facts: salesFacts(data) };
  }
  throw new Error("dirtySales: no se han encontrado datos válidos");
}
