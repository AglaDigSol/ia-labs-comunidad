// El proyecto de datos del simulacro de 01MIAR (5 puntos): un CSV sucio y una serie de pasos (A, B,
// C…) que se encadenan como en el cuaderno del examen. Hay dos proyectos, que se alternan con la
// semilla: las ventas de una cafetería (dirtySales: tokens a NaN, to_numeric, dropna, precio por moda,
// total = precio × cantidad, fechas, rangos, pivot_table y dos figuras) y unas incidencias con su
// tabla de países (incidents: porcentaje de nulos, coordenadas válidas, años, cadenas, merge por la
// izquierda, lo que no casa, pivot_table, líneas por categoría y barras con hue).
//
// Cada paso trae su enunciado, lo que debe quedar definido, la celda «Test Use Case» (con valores de
// los hechos de shared/pydata, nunca de un cálculo a mano) y las comprobaciones ocultas, que comparan
// lo de la persona con la solución de referencia ejecutada sobre los mismos datos.
import { dirtySales, incidents, INCIDENT_COLUMNS, SALES_COLUMNS } from "../pydata/index.ts";
import { lit, py, tup, type PyCheck } from "../exercises/python-common.ts";
import type { Rng } from "../exercises/random.ts";
import type { PyExamProject, PyExamStep, PyExamStepCase } from "./types.ts";

const SETUP = "import numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n";
const PACKAGES = ["numpy", "pandas", "matplotlib.pyplot", "seaborn"];
/** Filas de cada conjunto: suficientes para agrupar y pocas para que Pyodide vaya rápido. */
export const PYEXAM_ROWS = 160;

const check = (kind: PyCheck["kind"], label: string, axes?: number): PyCheck => (axes === undefined ? { kind, label } : { kind, label, axes });
const lines = (...xs: string[]) => xs.join("\n");
const cols = (xs: readonly string[]) => lit([...xs]);

type StepDraft = Omit<PyExamStep, "letter" | "plot"> & { plot?: boolean };

function letters(steps: StepDraft[]): PyExamStep[] {
  return steps.map((s, i) => ({ ...s, letter: String.fromCharCode(65 + i), plot: s.plot ?? false }));
}

const FIG_LABELS = {
  una: "Una sola figura",
  ejes: "El número de gráficos que pide el enunciado",
  titulo: "Cada gráfico tiene título",
  etiquetas: "Los dos ejes tienen nombre",
};

// ---------------------------------------------------------------- Ventas

function ventas(rng: Rng): PyExamProject {
  const d = dirtySales(rng.int(0, 0x7fffffff), { rows: PYEXAM_ROWS });
  const f = d.facts;
  const items = Object.keys(f.pricePerItem);
  // En el test a la vista, el precio de un artículo sin trampa (su primer precio ya es la moda).
  const plain = items.find((it) => f.firstSeenPrice[it] === f.pricePerItem[it]);
  const months = Object.keys(f.ticketsByMonth);
  const month = months[rng.int(0, months.length - 1)]!;
  const lo = rng.int(8, 12);
  const hi = lo + rng.int(10, 20);
  const C = (code: string, label: string, extra: Partial<PyExamStepCase> = {}): PyExamStepCase => ({ code, label, ...extra });
  const steps: StepDraft[] = [
    {
      title: "Cargar los datos y marcar lo que falta",
      points: 0.5,
      statement: [
        "Lee `ventas.csv` en un DataFrame `df`. Las celdas que valen `ERROR` o `UNKNOWN` también son datos que faltan: conviértelas en `NaN` (las vacías ya lo son al leer).",
      ],
      artefacts: ["df"],
      test: lines(`assert df.shape == ${lit(tup(f.rows, SALES_COLUMNS.length))}`, `assert int(df["articulo"].isna().sum()) == ${f.nullsTokens.articulo}`, 'assert not df.isin(["ERROR", "UNKNOWN"]).any().any()'),
      solution: 'df = pd.read_csv("ventas.csv")\ndf = df.replace(["ERROR", "UNKNOWN"], np.nan)\n',
      cases: [C("df.isna()", "Los NaN de `df` están donde deben", { checks: [check("forma", "`df` tiene todas las filas y columnas")] })],
      practice: { type: "py-pandas-limpiar", level: "medio" },
    },
    {
      title: "Convertir a números y porcentaje de nulos",
      points: 0.5,
      statement: [
        "Convierte `cantidad`, `precio` y `total` en números con `pd.to_numeric`: lo que no sea un número (como `2,75`, `3.00€` o `dos`) tiene que quedar como `NaN`.",
        "Después guarda en `nulos_pct` el porcentaje de valores perdidos de cada columna (una Series con el nombre de la columna como índice), redondeado a dos decimales.",
      ],
      artefacts: ["df", "nulos_pct"],
      test: lines('assert df["precio"].dtype == float', `assert nulos_pct["precio"] == ${f.nullPercent.precio}`),
      solution: 'for c in ["cantidad", "precio", "total"]:\n    df[c] = pd.to_numeric(df[c], errors="coerce")\nnulos_pct = (df.isna().mean() * 100).round(2)\n',
      cases: [
        C('df[["cantidad", "precio", "total"]]', "Las columnas numéricas de `df` están bien convertidas"),
        C("nulos_pct", "`nulos_pct` tiene el porcentaje de cada columna"),
      ],
      practice: { type: "py-pandas-limpiar", level: "medio" },
    },
    {
      title: "Quitar las filas sin artículo",
      points: 0.25,
      statement: ["Quita de `df` las filas en las que falta el `articulo` (y solo esas)."],
      artefacts: ["df"],
      test: lines(`assert len(df) == ${f.rowsWithItem}`, 'assert df["articulo"].notna().all()'),
      solution: 'df = df.dropna(subset=["articulo"])\n',
      cases: [C(`df[${cols(SALES_COLUMNS)}]`, "`df` tiene las filas que deben quedar", { checks: [check("forma", "`df` tiene el número de filas que debe")] })],
      practice: { type: "py-pandas-limpiar", level: "medio" },
    },
    {
      title: "El precio de cada artículo",
      points: 0.75,
      statement: [
        "Algunas filas tienen un precio de promoción: el precio de un artículo es el que más se repite (la moda) entre sus filas con precio, no el primero que aparece.",
        "Guarda en `precios` una Series con el artículo como índice (en orden alfabético) y su precio. Después rellena con ella los precios que faltan en `df`.",
      ],
      artefacts: ["precios", "df"],
      test: lines(
        `assert precios.index.tolist() == ${lit(items)}`,
        ...(plain ? [`assert precios[${lit(plain)}] == ${f.pricePerItem[plain]}`] : []),
        'assert int(df["precio"].isna().sum()) == 0',
      ),
      solution: py`
        precios = df.dropna(subset=["precio"]).groupby("articulo")["precio"].agg(lambda s: s.mode()[0])
        df["precio"] = df["precio"].fillna(df["articulo"].map(precios))
      `,
      cases: [
        C("precios", "`precios` tiene la moda de cada artículo"),
        C('df["precio"]', "Los precios rellenados en `df` son los de `precios`", { options: { index: false } }),
      ],
      practice: { type: "py-pandas-limpiar", level: "avanzado" },
    },
    {
      title: "Total = precio × cantidad",
      points: 0.75,
      statement: [
        "Usa la relación `total = precio × cantidad` para completar los datos: donde falta el `total` y hay `cantidad`, calcúlalo; donde falta la `cantidad` y hay `total`, calcúlala como `total / precio` redondeado al entero más cercano.",
        "Después quita las filas en las que faltan a la vez la `cantidad` y el `total`.",
      ],
      artefacts: ["df"],
      test: lines(`assert len(df) == ${f.rowsFinal}`, 'assert df[["cantidad", "total"]].notna().all().all()'),
      solution: py`
        faltan_t = df["total"].isna() & df["cantidad"].notna()
        df.loc[faltan_t, "total"] = df["precio"] * df["cantidad"]
        faltan_c = df["cantidad"].isna() & df["total"].notna()
        df.loc[faltan_c, "cantidad"] = (df["total"] / df["precio"]).round()
        df = df.dropna(subset=["cantidad", "total"], how="all")
      `,
      cases: [C('df[["articulo", "cantidad", "precio", "total"]]', "Cantidades y totales completos y coherentes", { checks: [check("sin-nulos", "Ni la cantidad ni el total quedan vacíos")] })],
      practice: { type: "py-pandas-limpiar", level: "avanzado" },
    },
    {
      title: "Fechas y tickets por mes",
      points: 0.5,
      statement: [
        "Convierte `fecha` en fechas con `pd.to_datetime` y el formato `%Y-%m-%d`; las que no sean válidas (como `2025-02-30` o `31/12/2025`) tienen que quedar como `NaT`.",
        "Guarda en `por_mes` el número de tickets de cada mes (una Series con el número del mes como índice, de menor a mayor; sin las fechas que faltan).",
      ],
      artefacts: ["df", "por_mes"],
      test: lines(`assert int(por_mes.sum()) == ${Object.values(f.ticketsByMonth).reduce((s, x) => s + x, 0)}`, `assert por_mes.loc[${month}] == ${f.ticketsByMonth[month]}`),
      solution: 'df["fecha"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d", errors="coerce")\npor_mes = df.groupby(df["fecha"].dt.month).size()\n',
      cases: [
        C("por_mes", "`por_mes` cuenta los tickets de cada mes"),
        C('df["fecha"]', "`fecha` está convertida (con NaT en las no válidas)", { options: { index: false } }),
      ],
      practice: { type: "py-pandas-fechas", level: "medio" },
    },
    {
      title: "Filtrar por rangos",
      points: 0.25,
      statement: [`Guarda en \`grandes\` los tickets con un \`total\` entre ${lo} y ${hi} € (ambos incluidos) y de 2 unidades o más.`],
      artefacts: ["grandes"],
      test: lines(`assert grandes["total"].between(${lo}, ${hi}).all()`, 'assert (grandes["cantidad"] >= 2).all()', "assert 0 < len(grandes) < len(df)"),
      solution: `grandes = df[df["total"].between(${lo}, ${hi}) & (df["cantidad"] >= 2)]\n`,
      cases: [C('grandes[["ticket", "cantidad", "total"]]', "`grandes` tiene los tickets de los dos rangos", { checks: [check("forma", "`grandes` tiene el número de filas que debe")] })],
      practice: { type: "py-pandas-agrupar", level: "medio" },
    },
    {
      title: "Tabla dinámica",
      points: 0.5,
      statement: [
        "Guarda en `tabla` una tabla dinámica (`pivot_table`) con un local por fila, una forma de pago por columna y, en cada celda, la suma del `total`, redondeada a dos decimales. Las combinaciones sin tickets valen 0.",
      ],
      artefacts: ["tabla"],
      test: lines('assert tabla.index.name == "local" and tabla.columns.name == "pago"', "assert (tabla.values >= 0).all()"),
      solution: 'tabla = df.pivot_table(index="local", columns="pago", values="total", aggfunc="sum", fill_value=0).round(2)\n',
      cases: [C("tabla", "`tabla` tiene la suma de cada local y forma de pago", { options: { index: true }, checks: [check("forma", "`tabla` tiene las filas y columnas que debe")] })],
      practice: { type: "py-pandas-agrupar", level: "avanzado" },
    },
    {
      title: "Gráfico de dispersión",
      points: 0.5,
      plot: true,
      statement: [
        "Crea una figura `fig` de 8 × 5 pulgadas con un solo gráfico: la dispersión del `total` (eje y) frente a la `cantidad` (eje x) de cada ticket de `df`, con título y nombre en los dos ejes.",
      ],
      artefacts: ["fig"],
      test: lines("assert tuple(fig.get_size_inches()) == (8.0, 5.0)", "assert len(fig.axes) == 1"),
      solution: py`
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.scatter(df["cantidad"], df["total"])
        ax.set_title("Total según la cantidad")
        ax.set_xlabel("cantidad")
        ax.set_ylabel("total (€)")
        plt.show()
      `,
      cases: [
        C("None", "La figura cumple los requisitos", {
          value: false,
          checks: [
            check("fig-una", FIG_LABELS.una),
            check("fig-tamano", "La figura mide 8 × 5 pulgadas"),
            check("fig-tipo", "Es un gráfico de dispersión"),
            check("fig-puntos", "Un punto por ticket, en (cantidad, total)"),
            check("fig-titulo", "El gráfico tiene título"),
            check("fig-etiquetas", FIG_LABELS.etiquetas),
          ],
        }),
      ],
      practice: { type: "py-graficos", level: "medio" },
    },
    {
      title: "Dos gráficos de barras, uno al lado del otro",
      points: 0.5,
      plot: true,
      statement: [
        "Crea una figura `fig` de 12 × 4 pulgadas con dos gráficos uno al lado del otro (`plt.subplots(1, 2, …)`), los dos con `sns.barplot` y barras que sean sumas (`estimator=\"sum\"`):",
        "a la izquierda, los ingresos (suma de `total`) de cada `local`, separados por forma de `pago` (`hue`); a la derecha, las unidades vendidas (suma de `cantidad`) de cada `articulo`. Cada gráfico, con su título.",
      ],
      artefacts: ["fig"],
      test: lines("assert tuple(fig.get_size_inches()) == (12.0, 4.0)", "assert len(fig.axes) == 2", "assert all(ax.get_title() for ax in fig.axes)"),
      solution: py`
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        sns.barplot(data=df, x="local", y="total", hue="pago", estimator="sum", errorbar=None, ax=axes[0])
        axes[0].set_title("Ingresos por local y forma de pago")
        sns.barplot(data=df, x="articulo", y="cantidad", estimator="sum", errorbar=None, ax=axes[1])
        axes[1].set_title("Unidades vendidas por artículo")
        plt.tight_layout()
        plt.show()
      `,
      cases: [
        C("None", "La figura cumple los requisitos", {
          value: false,
          checks: [
            check("fig-una", FIG_LABELS.una),
            check("fig-tamano", "La figura mide 12 × 4 pulgadas"),
            check("fig-ejes", "Dos gráficos"),
            check("fig-tipo", "Los dos son de barras"),
            check("fig-alturas", "Izquierda: las barras son las sumas del total (estimator=\"sum\")", 0),
            check("fig-alturas", "Derecha: las barras son las sumas de la cantidad (estimator=\"sum\")", 1),
            check("fig-leyenda", "La leyenda tiene las formas de pago (hue)"),
            check("fig-titulo", FIG_LABELS.titulo),
          ],
        }),
      ],
      practice: { type: "py-graficos", level: "avanzado" },
    },
  ];
  return {
    kind: "ventas",
    title: "Ventas de una cafetería",
    intro: [
      "`ventas.csv` tiene un ticket por fila: `ticket, articulo, cantidad, precio, total, pago, local, fecha`. Algunas celdas están vacías, valen `ERROR` o `UNKNOWN`, o tienen números mal escritos (como `2,75`, `3.00€` o `dos`), y algunas fechas no existen.",
      "Resuelve los pasos en orden, cada uno en su celda: cada paso sigue con el `df` del anterior. Usa exactamente los nombres de variables que pide cada paso.",
    ],
    files: { [d.file]: d.csv },
    setup: SETUP,
    steps: letters(steps),
    packages: PACKAGES,
  };
}

// ---------------------------------------------------------------- Incidencias

function incidencias(rng: Rng): PyExamProject {
  const d = incidents(rng.int(0, 0x7fffffff), { rows: PYEXAM_ROWS });
  const f = d.facts;
  const years = Object.keys(f.byYear);
  const year = years[rng.int(0, years.length - 1)]!;
  const cats = Object.keys(f.pivot);
  const pivotYears = Object.keys(f.pivot[cats[0]!] ?? {});
  const C = (code: string, label: string, extra: Partial<PyExamStepCase> = {}): PyExamStepCase => ({ code, label, ...extra });
  const steps: StepDraft[] = [
    {
      title: "Cargar los datos y porcentaje de nulos",
      points: 0.5,
      statement: [
        "Lee `incidencias.csv` en un DataFrame `df` y guarda en `nulos_pct` el porcentaje de valores perdidos de cada columna (una Series con el nombre de la columna como índice), redondeado a dos decimales.",
      ],
      artefacts: ["df", "nulos_pct"],
      test: lines(`assert df.shape == ${lit(tup(f.rows, INCIDENT_COLUMNS.length))}`, `assert nulos_pct["danio"] == ${f.nullPercent.danio}`),
      solution: 'df = pd.read_csv("incidencias.csv")\nnulos_pct = (df.isna().mean() * 100).round(2)\n',
      cases: [C("df.isna()", "`df` tiene los datos tal como se leen", { checks: [check("forma", "`df` tiene todas las filas y columnas")] }), C("nulos_pct", "`nulos_pct` tiene el porcentaje de cada columna")],
      practice: { type: "py-pandas-agrupar", level: "medio" },
    },
    {
      title: "Coordenadas válidas",
      points: 0.5,
      statement: [
        "Quédate en `df` solo con las filas de coordenadas válidas: la latitud (`lat`) entre −90 y 90 y la longitud (`lon`) entre −180 y 180, los extremos incluidos. Una coordenada vacía no es válida.",
      ],
      artefacts: ["df"],
      test: lines(`assert len(df) == ${f.validCoords}`, 'assert df["lat"].between(-90, 90).all() and df["lon"].between(-180, 180).all()'),
      solution: 'df = df[df["lat"].between(-90, 90) & df["lon"].between(-180, 180)].copy()\n',
      cases: [C(`df[${cols(INCIDENT_COLUMNS)}]`, "`df` tiene las filas válidas", { checks: [check("forma", "`df` tiene el número de filas que debe")] })],
      practice: { type: "py-pandas-limpiar", level: "medio" },
    },
    {
      title: "El año de cada incidencia",
      points: 0.5,
      statement: [
        "Añade a `df` la columna `anio` con el año de la `fecha` (convierte antes la fecha con `pd.to_datetime` y el formato `%Y-%m-%d`).",
        "Guarda en `por_anio` el número de incidencias de cada año (una Series con el año como índice, de menor a mayor; sin las fechas que faltan).",
      ],
      artefacts: ["df", "por_anio"],
      test: lines(`assert int(por_anio.sum()) == ${Object.values(f.byYear).reduce((s, x) => s + x, 0)}`, `assert por_anio.loc[${year}] == ${f.byYear[year]}`),
      solution: 'df["anio"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year\npor_anio = df.groupby("anio").size()\n',
      cases: [C("por_anio", "`por_anio` cuenta las incidencias de cada año"), C('df["anio"]', "La columna `anio` tiene el año de cada fila", { options: { index: false } })],
      practice: { type: "py-pandas-fechas", level: "medio" },
    },
    {
      title: "Normalizar los lugares",
      points: 0.5,
      statement: [
        "Los lugares están escritos de cualquier manera (mayúsculas mezcladas y espacios de más). Normaliza la columna `lugar` de `df`: sin espacios al principio ni al final y en minúsculas.",
        "Guarda en `n_lugares` cuántos lugares distintos hay (sin contar los vacíos).",
      ],
      artefacts: ["df", "n_lugares"],
      test: lines(`assert n_lugares == ${f.distinctPlaces}`, 'assert (df["lugar"].dropna() == df["lugar"].dropna().str.strip().str.lower()).all()'),
      solution: 'df["lugar"] = df["lugar"].str.strip().str.lower()\nn_lugares = df["lugar"].nunique()\n',
      cases: [C('df["lugar"]', "`lugar` está normalizado", { options: { index: false } }), C("n_lugares", "`n_lugares` es el número de lugares distintos")],
      practice: { type: "py-pandas-fechas", level: "avanzado" },
    },
    {
      title: "Combinar con la tabla de países",
      points: 0.75,
      statement: [
        "`paises.csv` dice el país (`pais`) de cada lugar (`lugar`, ya en minúsculas), pero tiene alguna fila repetida y le faltan lugares.",
        "Guarda en `df_m` el resultado de combinar `df` con esa tabla por la izquierda (`merge` con `how=\"left\"`), de modo que `df_m` tenga exactamente una fila por cada fila de `df` y una columna más, `pais`.",
      ],
      artefacts: ["df_m"],
      test: lines("assert len(df_m) == len(df)", 'assert "pais" in df_m.columns'),
      solution: 'paises = pd.read_csv("paises.csv").drop_duplicates()\ndf_m = df.merge(paises, on="lugar", how="left")\n',
      cases: [
        C(`df_m[${cols([...INCIDENT_COLUMNS, "pais"])}]`, "`df_m` tiene una fila por incidencia y su país", {
          checks: [check("forma", "`df_m` tiene una fila por cada fila de `df`")],
        }),
      ],
      practice: { type: "py-pandas-combinar", level: "avanzado" },
    },
    {
      title: "Lo que no casa",
      points: 0.5,
      statement: [
        "Guarda en `sin_pais` cuántas filas de `df_m` se han quedado sin país, y en `lugares_sin_pais` una lista, en orden alfabético y sin repetidos, de sus lugares (sin los vacíos).",
      ],
      artefacts: ["sin_pais", "lugares_sin_pais"],
      test: lines("assert isinstance(lugares_sin_pais, list)", "assert sin_pais >= len(lugares_sin_pais)"),
      solution: 'sin_pais = int(df_m["pais"].isna().sum())\nlugares_sin_pais = sorted(df_m.loc[df_m["pais"].isna(), "lugar"].dropna().unique())\n',
      cases: [C("sin_pais", "`sin_pais` cuenta las filas sin país"), C("lugares_sin_pais", "`lugares_sin_pais` tiene los lugares que no casan")],
      practice: { type: "py-pandas-combinar", level: "medio" },
    },
    {
      title: "Tabla dinámica por categoría y año",
      points: 0.75,
      statement: [
        "Guarda en `tabla` una tabla dinámica (`pivot_table`) de `df_m` con una categoría por fila, un año por columna y, en cada celda, el número de incidencias (cuenta los `id`). Las combinaciones sin incidencias valen 0.",
      ],
      artefacts: ["tabla"],
      test: lines(`assert tabla.shape == ${lit(tup(cats.length, pivotYears.length))}`, `assert tabla.index.tolist() == ${lit(cats)}`),
      solution: 'tabla = df_m.pivot_table(index="categoria", columns="anio", values="id", aggfunc="count").fillna(0)\n',
      cases: [C("tabla", "`tabla` cuenta las incidencias de cada categoría y año", { options: { index: true }, checks: [check("forma", "`tabla` tiene las filas y columnas que debe")] })],
      practice: { type: "py-pandas-agrupar", level: "avanzado" },
    },
    {
      title: "Un gráfico de líneas por categoría",
      points: 0.5,
      plot: true,
      statement: [
        "Con `tabla`, crea una figura `fig` con un gráfico de líneas por categoría, uno debajo de otro y en el orden de `tabla` (`plt.subplots(n, 1, figsize=(8, 2 * n), sharex=True)`, con `n` el número de categorías).",
        "En cada gráfico, la evolución por año del número de incidencias de esa categoría, con la categoría como título.",
      ],
      artefacts: ["fig"],
      test: lines("assert tuple(fig.get_size_inches()) == (8.0, 2.0 * len(tabla))", "assert len(fig.axes) == len(tabla)"),
      solution: py`
        fig, axes = plt.subplots(len(tabla), 1, figsize=(8, 2 * len(tabla)), sharex=True)
        for ax, categoria in zip(axes, tabla.index):
            ax.plot(tabla.columns, tabla.loc[categoria], marker="o")
            ax.set_title(categoria)
        plt.tight_layout()
        plt.show()
      `,
      cases: [
        C("None", "La figura cumple los requisitos", {
          value: false,
          checks: [
            check("fig-una", FIG_LABELS.una),
            check("fig-tamano", "La figura mide 8 × 2n pulgadas"),
            check("fig-ejes", "Un gráfico por categoría"),
            check("fig-tipo", "Son gráficos de líneas"),
            check("fig-lineas", "Cada línea es la de su categoría, año a año"),
            check("fig-titulo", FIG_LABELS.titulo),
          ],
        }),
      ],
      practice: { type: "py-graficos", level: "avanzado" },
    },
    {
      title: "Dos gráficos de barras, uno al lado del otro",
      points: 0.5,
      plot: true,
      statement: [
        "Crea una figura `fig` de 12 × 4 pulgadas con dos gráficos uno al lado del otro (`plt.subplots(1, 2, …)`), los dos con `sns.barplot` sobre `df_m` y barras que sean sumas del daño (`danio`, con `estimator=\"sum\"`):",
        "a la izquierda, por `anio` y separado por `categoria` (`hue`); a la derecha, por `pais`. Cada gráfico, con su título.",
      ],
      artefacts: ["fig"],
      test: lines("assert tuple(fig.get_size_inches()) == (12.0, 4.0)", "assert len(fig.axes) == 2", "assert all(ax.get_title() for ax in fig.axes)"),
      solution: py`
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        sns.barplot(data=df_m, x="anio", y="danio", hue="categoria", estimator="sum", errorbar=None, ax=axes[0])
        axes[0].set_title("Daño total por año y categoría")
        sns.barplot(data=df_m, x="pais", y="danio", estimator="sum", errorbar=None, ax=axes[1])
        axes[1].set_title("Daño total por país")
        plt.tight_layout()
        plt.show()
      `,
      cases: [
        C("None", "La figura cumple los requisitos", {
          value: false,
          checks: [
            check("fig-una", FIG_LABELS.una),
            check("fig-tamano", "La figura mide 12 × 4 pulgadas"),
            check("fig-ejes", "Dos gráficos"),
            check("fig-tipo", "Los dos son de barras"),
            check("fig-alturas", "Izquierda: las barras son las sumas del daño (estimator=\"sum\")", 0),
            check("fig-alturas", "Derecha: las barras son las sumas del daño (estimator=\"sum\")", 1),
            check("fig-leyenda", "La leyenda tiene las categorías (hue)"),
            check("fig-titulo", FIG_LABELS.titulo),
          ],
        }),
      ],
      practice: { type: "py-graficos", level: "avanzado" },
    },
  ];
  return {
    kind: "incidencias",
    title: "Incidencias y países",
    intro: [
      "`incidencias.csv` tiene una incidencia por fila: `id, fecha, lugar, lat, lon, categoria, danio`. Hay celdas vacías, coordenadas fuera de rango y lugares escritos de cualquier manera. `paises.csv` dice el país de cada lugar.",
      "Resuelve los pasos en orden, cada uno en su celda: cada paso sigue con lo que dejó el anterior. Usa exactamente los nombres de variables que pide cada paso.",
    ],
    files: { [d.file]: d.csv, [d.lookup.file]: d.lookup.csv },
    setup: SETUP,
    steps: letters(steps),
    packages: PACKAGES,
  };
}

/** El proyecto de una semilla: ventas con las pares e incidencias con las impares. */
export function buildPyExamProject(seed: number, rng: Rng): PyExamProject {
  return seed % 2 === 0 ? ventas(rng) : incidencias(rng);
}
