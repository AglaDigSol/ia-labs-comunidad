// Conjuntos de datos sintéticos (shared/pydata): deterministas, con los nombres inventados y unos hechos
// coherentes. Con pandas en el python3 del sistema, los hechos se recalculan siguiendo la receta de
// cada conjunto (*_PIPELINE) y tienen que coincidir; sin pandas, esa parte se salta.
import { describe, expect, it } from "vitest";
import {
  dirtySales,
  grades,
  incidents,
  interpolateColumn,
  inventory,
  isIsoDate,
  movieList,
  npRound,
  PANDAS_NA,
  SALES_COLUMNS,
  sensors,
  toCsv,
} from "../shared/pydata/index.ts";
import { hasPandas, runJobs } from "./system-python.ts";

const SEEDS = [1, 2, 3, 17, 99, 2024, 31337, 4_000_000_000];

describe("pydata: utilidades", () => {
  it("npRound redondea como NumPy (al par en los empates exactos)", () => {
    expect(npRound(2.5)).toBe(2);
    expect(npRound(3.5)).toBe(4);
    expect(npRound(-2.5)).toBe(-2);
    expect(npRound(0.125, 2)).toBe(0.12);
    expect(npRound(33.333333, 2)).toBe(33.33);
  });
  it("toCsv entrecomilla solo lo necesario", () => {
    expect(toCsv({ header: ["a", "b"], rows: [["1", "x,y"], ["", 'di "hola"']] })).toBe('a,b\n1,"x,y"\n,"di ""hola"""\n');
  });
  it("isIsoDate distingue fechas imposibles", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2025-13-01")).toBe(false);
    expect(isIsoDate("31/12/2025")).toBe(false);
  });
  it("interpolateColumn: lineal en medio, NaN al principio y el último valor al final", () => {
    expect(interpolateColumn([null, 1, null, 3, null])).toEqual([null, 1, 2, 3, 3]);
  });
});

describe("pydata: ventas sucias", () => {
  it("es determinista y cambia con la semilla", () => {
    for (const s of SEEDS) expect(dirtySales(s, { rows: 80 })).toEqual(dirtySales(s, { rows: 80 }));
    expect(dirtySales(1, { rows: 80 }).csv).not.toBe(dirtySales(2, { rows: 80 }).csv);
  });

  it("tamaños de 24 a unos miles de filas, con las columnas fijas", () => {
    for (const rows of [24, 30, 200, 3000]) {
      const d = dirtySales(5, { rows });
      expect(d.table.rows).toHaveLength(rows);
      expect(d.csv.split("\n")[0]).toBe(SALES_COLUMNS.join(","));
      expect(d.facts.rows).toBe(rows);
    }
  });

  it("los hechos son coherentes y siempre hay la trampa del primer precio", () => {
    for (const s of SEEDS) {
      for (const rows of [24, 120, 1500]) {
        const { facts: f, catalog } = dirtySales(s, { rows, corruption: 0.1 });
        // La moda es el precio de la carta; el primer precio visto difiere en algún artículo.
        expect(f.pricePerItem).toEqual(Object.fromEntries(Object.keys(f.pricePerItem).map((k) => [k, catalog[k]])));
        expect(Object.keys(f.pricePerItem).some((k) => f.firstSeenPrice[k] !== f.pricePerItem[k])).toBe(true);
        for (const c of SALES_COLUMNS) {
          expect(f.nullsRead[c]).toBeLessThanOrEqual(f.nullsTokens[c]);
          expect(f.nullsTokens[c]).toBeLessThanOrEqual(f.nullsNumeric[c]);
        }
        expect(f.nullsRead.ticket).toBe(0);
        expect(f.rowsWithItem).toBe(rows - f.nullsNumeric.articulo);
        expect(f.rowsFinal).toBe(f.rowsWithItem - f.droppedBoth);
        expect(Object.values(f.ticketsByPayment).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(f.rowsFinal);
      }
    }
  });

  it("nada de lo que no sea vacío se lee como NaN por defecto en pandas", () => {
    const d = dirtySales(7, { rows: 500, corruption: 0.3 });
    for (const r of d.table.rows) for (const v of r) if (v !== "") expect(PANDAS_NA.has(v), v).toBe(false);
  });
});

describe("pydata: incidencias, sensores y tablas pequeñas", () => {
  it("incidencias: deterministas, con coordenadas fuera de rango, repetidas y lugares sin país", () => {
    for (const s of SEEDS) {
      const a = incidents(s, { rows: 300 });
      expect(incidents(s, { rows: 300 })).toEqual(a);
      const f = a.facts;
      expect(f.validCoords).toBeLessThan(f.rows);
      expect(f.lookupUnique).toBeLessThan(f.lookupRows);
      expect(f.mergedRows).toBeGreaterThanOrEqual(f.mergedRowsDedup);
      expect(f.unmatched).toBeGreaterThan(0);
      expect(Object.values(f.byYear).reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(f.validCoords);
      // Lugares con mayúsculas mezcladas o espacios de más.
      expect(a.table.rows.some((r) => r[2] !== r[2]!.trim() || (r[2] !== r[2]!.toLowerCase() && r[2] !== ""))).toBe(true);
      expect(a.lookup.table.rows.every((r) => /^X[A-Z]{2}$/.test(r[1]!))).toBe(true);
    }
  });

  it("sensores: una columna rota (se quita) y otra con huecos en los bordes; sin NaN al final", () => {
    for (const s of SEEDS) {
      const d = sensors(s, { rows: 30, sensors: 5 });
      expect(sensors(s, { rows: 30, sensors: 5 })).toEqual(d);
      const f = d.facts;
      expect(f.dropped.length).toBeGreaterThanOrEqual(1);
      expect(f.kept.length + f.dropped.length).toBe(5);
      expect(Object.values(f.nanAfterInterpolate).some((x) => x > 0)).toBe(true);
      expect(f.filled.flat().every(Number.isFinite)).toBe(true);
      expect(f.filled).toHaveLength(30);
    }
  });

  it("títulos, notas e inventario", () => {
    const m = movieList(3, 12, true);
    expect(m.items).toHaveLength(12);
    expect(m.items.every((t, i) => t === `${m.facts.parsed[i]!.titulo} - ${m.facts.parsed[i]!.anio}`)).toBe(true);
    expect(m.facts.parsed.some((p) => p.titulo.includes(" - "))).toBe(true);
    expect(movieList(3, 12)).toEqual(movieList(3, 12));
    const g = grades(4, 15);
    expect(new Set(Object.values(g.facts.weighted)).size).toBe(15);
    expect(g.facts.weighted[g.facts.best]).toBe(Math.max(...Object.values(g.facts.weighted)));
    const inv = inventory(5, 20);
    expect(inv.facts.belowMinimum.length).toBeGreaterThan(0);
    expect(inv.table.rows.every((r) => /^P-\d{3}$/.test(r[0]!))).toBe(true);
  });
});

// Las recetas, en pandas: cada función recibe el nombre de los archivos y devuelve los hechos.
const PANDAS_FACTS = String.raw`
import json, warnings
import numpy as np
import pandas as pd
warnings.simplefilter("ignore")

def _rec(s):
    return {str(int(k)) if isinstance(k, float) and k.is_integer() else str(k): (v.item() if hasattr(v, "item") else v) for k, v in s.items()}

def __ventas(p):
    df = pd.read_csv("ventas.csv")
    f = {"rows": len(df), "nullsRead": _rec(df.isna().sum())}
    df = df.replace(["ERROR", "UNKNOWN"], np.nan)
    f["nullsTokens"] = _rec(df.isna().sum())
    for c in ["cantidad", "precio", "total"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    f["nullsNumeric"] = _rec(df.isna().sum())
    f["nullPercent"] = _rec((df.isna().mean() * 100).round(2))
    df = df.dropna(subset=["articulo"])
    f["rowsWithItem"] = len(df)
    validos = df.dropna(subset=["precio"])
    precios = validos.groupby("articulo")["precio"].agg(lambda s: s.mode()[0])
    f["pricePerItem"] = _rec(precios)
    f["firstSeenPrice"] = _rec(validos.drop_duplicates("articulo").set_index("articulo")["precio"].sort_index())
    f["pricesFilled"] = int(df["precio"].isna().sum())
    trampa = [a for a in precios.index if f["firstSeenPrice"][a] != f["pricePerItem"][a]]
    f["trapRows"] = int((df["precio"].isna() & df["articulo"].isin(trampa)).sum())
    df["precio"] = df["precio"].fillna(df["articulo"].map(precios))
    faltan_t = df["total"].isna() & df["cantidad"].notna()
    df.loc[faltan_t, "total"] = df["precio"] * df["cantidad"]
    faltan_c = df["cantidad"].isna() & df["total"].notna()
    df.loc[faltan_c, "cantidad"] = (df["total"] / df["precio"]).round()
    f["totalsFilled"] = int(faltan_t.sum())
    f["quantitiesFilled"] = int(faltan_c.sum())
    antes = len(df)
    df = df.dropna(subset=["cantidad", "total"], how="all")
    f["droppedBoth"] = antes - len(df)
    f["rowsFinal"] = len(df)
    f["revenue"] = round(float(df["total"].sum()), 2)
    f["revenueByBranch"] = _rec(df.groupby("local")["total"].sum().round(2))
    f["ticketsByPayment"] = _rec(df.groupby("pago").size())
    f["ticketsByMonth"] = _rec(pd.to_datetime(df["fecha"], format="%Y-%m-%d", errors="coerce").dt.month.dropna().astype(int).value_counts().sort_index())
    f["unitsByItem"] = _rec(df.groupby("articulo")["cantidad"].sum())
    return json.dumps(f)

def __incidencias(p):
    df = pd.read_csv("incidencias.csv")
    f = {"rows": len(df), "nullsRead": _rec(df.isna().sum()), "nullPercent": _rec((df.isna().mean() * 100).round(2))}
    df = df[df["lat"].between(-90, 90) & df["lon"].between(-180, 180)].copy()
    f["validCoords"] = len(df)
    df["anio"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year
    f["byYear"] = _rec(df.groupby("anio").size())
    t = df.pivot_table(index="categoria", columns="anio", values="id", aggfunc="count").fillna(0)
    f["pivot"] = {str(i): _rec(t.loc[i]) for i in t.index}
    df["lugar"] = df["lugar"].str.strip().str.lower()
    f["distinctPlaces"] = int(df["lugar"].nunique())
    paises = pd.read_csv("paises.csv")
    f["lookupRows"] = len(paises)
    f["lookupUnique"] = len(paises.drop_duplicates())
    f["mergedRows"] = len(df.merge(paises, on="lugar", how="left"))
    m = df.merge(paises.drop_duplicates(), on="lugar", how="left")
    f["mergedRowsDedup"] = len(m)
    f["unmatched"] = int(m["pais"].isna().sum())
    f["unmatchedPlaces"] = sorted(m.loc[m["pais"].isna(), "lugar"].dropna().unique().tolist())
    f["damageNulls"] = int(df["danio"].isna().sum())
    f["meanDamageByCategory"] = _rec(df.groupby("categoria")["danio"].mean().dropna().round(2))
    return json.dumps(f)

def __sensores(p):
    df = pd.read_csv("sensores.csv")
    k = p["k"]
    f = {"nanPerColumn": _rec(df.drop(columns="hora").isna().sum())}
    df = df.dropna(axis=1, thresh=len(df) - k)
    f["kept"] = [c for c in df.columns if c != "hora"]
    f["nanAfterInterpolate"] = _rec(df.interpolate().drop(columns="hora").isna().sum())
    df = df.interpolate().bfill().ffill()
    f["filled"] = df.drop(columns="hora").values.tolist()
    return json.dumps(f)
`;

describe.skipIf(!hasPandas)("pydata: los hechos coinciden con pandas", () => {
  it("ventas: cada paso de la limpieza", () => {
    const sets = SEEDS.flatMap((s) => [dirtySales(s, { rows: 30 }), dirtySales(s, { rows: 400, corruption: 0.15 }), dirtySales(s, { rows: 3000, corruption: 0.05 })]);
    const got = runJobs<Record<string, unknown>>(PANDAS_FACTS, sets.map((d) => ({ fn: "__ventas", payload: {}, files: [{ path: d.file, text: d.csv }] })));
    got.forEach((g, i) => {
      const { catalog: _, ...rest } = sets[i]!;
      expect(g).toEqual(rest.facts);
    });
  }, 120_000);

  it("incidencias y la tabla de países", () => {
    const sets = SEEDS.flatMap((s) => [incidents(s, { rows: 40 }), incidents(s, { rows: 600 }), incidents(s, { rows: 2500, duplicates: 4 })]);
    const got = runJobs<Record<string, unknown>>(
      PANDAS_FACTS,
      sets.map((d) => ({ fn: "__incidencias", payload: {}, files: [{ path: d.file, text: d.csv }, { path: d.lookup.file, text: d.lookup.csv }] })),
    );
    got.forEach((g, i) => expect(g).toEqual({ ...sets[i]!.facts }));
  }, 120_000);

  it("sensores: columnas quitadas, NaN tras interpolar y la tabla final (con tolerancia)", () => {
    const sets = SEEDS.flatMap((s) => [sensors(s, { rows: 12, sensors: 3 }), sensors(s, { rows: 60, sensors: 6 }), sensors(s, { rows: 300, sensors: 8, k: 40 })]);
    const got = runJobs<{ nanPerColumn: Record<string, number>; kept: string[]; nanAfterInterpolate: Record<string, number>; filled: number[][] }>(
      PANDAS_FACTS,
      sets.map((d) => ({ fn: "__sensores", payload: { k: d.facts.k }, files: [{ path: d.file, text: d.csv }] })),
    );
    got.forEach((g, i) => {
      const f = sets[i]!.facts;
      expect(g.nanPerColumn).toEqual(f.nanPerColumn);
      expect(g.kept).toEqual(f.kept);
      expect(g.nanAfterInterpolate).toEqual(f.nanAfterInterpolate);
      expect(g.filled.length).toBe(f.filled.length);
      g.filled.forEach((row, r) => row.forEach((v, c) => expect(v).toBeCloseTo(f.filled[r]![c]!, 9)));
    });
  }, 120_000);
});
