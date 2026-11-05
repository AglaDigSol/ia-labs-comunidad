// Utilidades de los conjuntos de datos sintéticos: escribir CSV como lo lee pandas, redondear como
// NumPy y contar. TypeScript puro (sin DOM ni Node): lo usan los ejercicios, el simulacro y las pruebas.

/** Una tabla: cabecera y filas, todo como texto (tal cual queda en el CSV; "" es una celda vacía). */
export interface Table {
  header: string[];
  rows: string[][];
}

/** Celda de CSV: entre comillas solo si lleva coma, comillas o salto de línea (como csv.writer). */
function cell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV con salto de línea \n al final de cada fila (lo que escribe pandas con to_csv(index=False)). */
export function toCsv(t: Table): string {
  return [t.header, ...t.rows].map((r) => `${r.map(cell).join(",")}\n`).join("");
}

/** Redondeo de NumPy (np.round / Series.round): multiplica, redondea al par más cercano y divide. */
export function npRound(x: number, decimals = 0): number {
  const f = 10 ** decimals;
  const y = x * f;
  const lo = Math.floor(y);
  const d = y - lo;
  const r = d > 0.5 ? lo + 1 : d < 0.5 ? lo : lo % 2 === 0 ? lo : lo + 1;
  return r / f;
}

/** Cuántas veces aparece cada valor (en el orden de la primera aparición). */
export function countBy<T>(items: readonly T[], key: (x: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of items) {
    const k = key(x);
    if (k !== null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Diccionario con las claves ordenadas (como el índice de un groupby). */
export function sortedRecord<V>(r: Record<string, V>, numeric = false): Record<string, V> {
  const keys = Object.keys(r).sort(numeric ? (a, b) => Number(a) - Number(b) : (a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(keys.map((k) => [k, r[k]!]));
}

/**
 * Textos que pandas lee como NaN por defecto (na_values de read_csv). Los generadores no producen
 * ninguno salvo la celda vacía: los «ERROR» y «UNKNOWN» se quedan como texto hasta que se limpian.
 */
export const PANDAS_NA = new Set([
  "", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A", "NA", "NULL", "NaN",
  "None", "n/a", "nan", "null",
]);

/** ¿Es un número que pd.to_numeric entiende? (decimal con punto, sin unidades ni comas). */
export const isNumeric = (v: string) => /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(v);

/** Fecha AAAA-MM-DD válida (lo que to_datetime(..., format="%Y-%m-%d", errors="coerce") no convierte en NaT). */
export function isIsoDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]!;
  return d <= days;
}

/** Fecha AAAA-MM-DD al azar del año (días 1 a 28, para no depender del mes). */
export const isoDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Número con dos decimales, como lo escribiría una caja registradora. */
export const money = (x: number) => x.toFixed(2);
