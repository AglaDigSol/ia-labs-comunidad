// Tablas pequeñas para los ejercicios cortos: títulos «Título - Año», notas de estudiantes inventados
// e inventario de un almacén. Cada una con sus hechos para corregir.
import { rngFor } from "../exercises/random.ts";
import { npRound, sortedRecord, toCsv, type Table } from "./csv.ts";
import { ITEMS, inventedWord, personNames, titles } from "./names.ts";

export interface MovieFacts {
  /** Cada texto partido por el último « - »: el título y el año (entero). */
  parsed: Array<{ titulo: string; anio: number }>;
  /** Títulos por década (1950, 1960…), en orden. */
  byDecade: Record<string, number>;
}

/**
 * n textos «Título - Año» con títulos inventados. Con `hyphen`, algunos títulos llevan « - » dentro
 * («Lomira - segunda parte - 1987»): hay que partir por el último.
 */
export function movieList(seed: number, n: number, hyphen = false): { items: string[]; facts: MovieFacts } {
  const rng = rngFor("pydata:titulos", seed);
  const ts = titles(rng, n).map((t) => (hyphen && rng.chance(0.4) ? `${t} - ${rng.pick(["segunda parte", "el regreso", "edición especial", "tomo dos"])}` : t));
  const parsed = ts.map((titulo) => ({ titulo, anio: rng.int(1950, 2024) }));
  const byDecade: Record<string, number> = {};
  for (const p of parsed) {
    const d = String(Math.floor(p.anio / 10) * 10);
    byDecade[d] = (byDecade[d] ?? 0) + 1;
  }
  return { items: parsed.map((p) => `${p.titulo} - ${p.anio}`), facts: { parsed, byDecade: sortedRecord(byDecade, true) } };
}

export const GRADE_COLUMNS = ["nombre", "grupo", "parcial", "final", "practicas"] as const;

export interface GradeFacts {
  /** Nota final = 0,3 · parcial + 0,5 · final + 0,2 · prácticas, redondeada a dos decimales. */
  weighted: Record<string, number>;
  /** Media de la nota final ponderada por grupo (redondeada a dos decimales). */
  meanByGroup: Record<string, number>;
  /** Aprobados (ponderada ≥ 5) por grupo. */
  passedByGroup: Record<string, number>;
  /** Quien tiene la mejor ponderada (sin empates en los datos). */
  best: string;
}

/** Notas de n estudiantes inventados en los grupos A, B y C (múltiplos de 0,25; sin empates en la ponderada). */
export function grades(seed: number, n: number): { file: string; csv: string; table: Table; facts: GradeFacts } {
  const rng = rngFor("pydata:notas", seed);
  for (;;) {
    const names = personNames(rng, n);
    const rows = names.map((nombre) => [nombre, rng.pick(["A", "B", "C"]), String(rng.int(0, 40) / 4), String(rng.int(0, 40) / 4), String(rng.int(8, 40) / 4)]);
    const w = rows.map((r) => npRound(0.3 * Number(r[2]) + 0.5 * Number(r[3]) + 0.2 * Number(r[4]), 2));
    if (new Set(w).size !== w.length) continue;
    const groups = [...new Set(rows.map((r) => r[1]!))].sort();
    const meanByGroup = Object.fromEntries(groups.map((g) => {
      const xs = w.filter((_, i) => rows[i]![1] === g);
      return [g, npRound(xs.reduce((s, x) => s + x, 0) / xs.length, 2)];
    }));
    const passedByGroup = Object.fromEntries(groups.map((g) => [g, w.filter((x, i) => rows[i]![1] === g && x >= 5).length]));
    const best = names[w.indexOf(Math.max(...w))]!;
    const table: Table = { header: [...GRADE_COLUMNS], rows };
    return { file: "notas.csv", csv: toCsv(table), table, facts: { weighted: Object.fromEntries(names.map((nm, i) => [nm, w[i]!])), meanByGroup, passedByGroup, best } };
  }
}

export const INVENTORY_COLUMNS = ["codigo", "producto", "stock", "minimo", "precio"] as const;

export interface InventoryFacts {
  /** Códigos con stock por debajo del mínimo, en el orden de la tabla. */
  belowMinimum: string[];
  /** Valor del almacén: suma de stock × precio, redondeada a dos decimales. */
  stockValue: number;
  /** Unidades que hay que pedir para llegar al mínimo, por código (solo los que están por debajo). */
  toOrder: Record<string, number>;
}

/** Inventario de n productos (códigos P-001…; precios en múltiplos de 0,05). */
export function inventory(seed: number, n: number): { file: string; csv: string; table: Table; facts: InventoryFacts } {
  const rng = rngFor("pydata:inventario", seed);
  const products = new Set<string>();
  while (products.size < n) products.add(`${rng.pick(ITEMS)} ${inventedWord(rng)}`);
  const rows = [...products].map((p, i) => {
    const minimo = rng.int(2, 20);
    const stock = rng.chance(0.35) ? rng.int(0, minimo - 1) : rng.int(minimo, 60);
    return [`P-${String(i + 1).padStart(3, "0")}`, p, String(stock), String(minimo), (rng.int(10, 400) * 0.05).toFixed(2)];
  });
  const below = rows.filter((r) => Number(r[2]) < Number(r[3]));
  const table: Table = { header: [...INVENTORY_COLUMNS], rows };
  return {
    file: "inventario.csv",
    csv: toCsv(table),
    table,
    facts: {
      belowMinimum: below.map((r) => r[0]!),
      stockValue: npRound(rows.reduce((s, r) => s + Number(r[2]) * Number(r[4]), 0), 2),
      toOrder: Object.fromEntries(below.map((r) => [r[0]!, Number(r[3]) - Number(r[2])])),
    },
  };
}
