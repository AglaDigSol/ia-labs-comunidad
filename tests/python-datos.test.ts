// Ejercicios de Python de los temas 6 a 13 y de examen (python-datos.ts) con el python3 del sistema:
// la referencia pasa con muchas semillas en los tres niveles, el código inicial no, y al menos dos
// soluciones equivocadas típicas por tipo fallan (entre ellas, el «primer precio visto» en vez de la
// moda). Las que necesitan pandas, NumPy, matplotlib o seaborn se saltan si el python3 no los tiene.
import { describe, expect, it } from "vitest";
import { makeCodeTemplate, PY_CODE_TYPES, PY_DATA_TEMPLATE_IDS, PY_DATA_TYPE_IDS, PY_TEMAS, type PyCodeInstance } from "../shared/exercises/python.ts";
import { EXERCISE_LEVELS, type ExerciseLevel } from "../shared/exercises/types.ts";
import { allPassed, caseFiles, checkPayload, HARNESS_PY, parseCheckResult, type CheckResult } from "../src/features/labs/exercises/python/harness.ts";
import { hasPandas, hasPlots, hasPython3, runJobs } from "./system-python.ts";

const SEEDS = Array.from({ length: 8 }, (_, i) => (i * 2654435761 + 101) >>> 0);
const DATA_TYPES = PY_CODE_TYPES.filter((t) => PY_DATA_TYPE_IDS.has(t.id));

/** ¿Puede el python3 del sistema comprobar esta instancia? */
function runnable(inst: PyCodeInstance): boolean {
  const p = inst.packages ?? [];
  if (p.some((m) => m.startsWith("matplotlib") || m === "seaborn")) return hasPlots;
  if (p.length > 0) return hasPandas;
  return hasPython3;
}

/** Comprueba en tandas (un proceso por tanda: así la memoria no crece sin límite). */
function check(items: Array<{ inst: PyCodeInstance; code: string }>): CheckResult[] {
  const raw: unknown[] = [];
  for (let i = 0; i < items.length; i += 120) {
    const batch = items.slice(i, i + 120);
    raw.push(...runJobs<unknown>(HARNESS_PY, batch.map(({ inst, code }) => ({ fn: "__labs_check", payload: checkPayload(inst, code), files: caseFiles(inst.cases) })), 300_000));
  }
  return raw.map((r) => {
    const p = parseCheckResult(JSON.stringify(r));
    if (!p) throw new Error(`ilegible: ${JSON.stringify(r).slice(0, 300)}`);
    return p;
  });
}

describe("ejercicios de los temas 6 a 13: generación", () => {
  it("trece tipos, cada uno con su tema y tres niveles", () => {
    expect(DATA_TYPES.map((t) => t.id)).toEqual([
      "py-bug", "py-una-linea", "py-clases", "py-avanzado", "py-numpy-mascaras", "py-numpy-sistemas", "py-pandas-fechas", "py-pandas-agrupar",
      "py-pandas-combinar", "py-graficos", "py-pandas-nulos", "py-pandas-limpiar", "py-generadores",
    ]);
    for (const t of DATA_TYPES) {
      expect(t.levels).toEqual(EXERCISE_LEVELS);
      expect(t.module).toBe("python");
      expect(t.description).toMatch(/^Tema \d+: /);
      const inst = t.generate(1, "medio");
      expect(t.description.startsWith(`Tema ${inst.tema}:`), t.id).toBe(true);
      expect(PY_TEMAS[inst.tema]).toMatch(new RegExp(`^Tema ${inst.tema} · `));
    }
  });

  it("los datos van a la carpeta del caso como CSV y los casos con pandas importan lo que usan", () => {
    for (const t of DATA_TYPES) {
      for (const level of EXERCISE_LEVELS) {
        const inst = t.generate(3, level);
        for (const c of inst.cases) {
          for (const [name, text] of Object.entries(c.files ?? {})) {
            expect(name).toMatch(/^\w+\.csv$/);
            expect(text.split("\n")[0]).toMatch(/^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)+$/);
          }
          if (/\bpd\./.test(c.code)) expect(c.code).toContain("import pandas as pd");
          if (/\bnp\./.test(c.code)) expect(c.code).toContain("import numpy as np");
        }
        if (inst.cases.some((c) => c.files)) expect(inst.packages).toContain("pandas");
      }
    }
  });

  it("ningún dato real: sin correos, URLs ni rutas en los enunciados y los datos", () => {
    for (const t of DATA_TYPES) {
      for (const level of EXERCISE_LEVELS) {
        const inst = t.generate(5, level);
        const text = [...inst.statement, ...inst.cases.flatMap((c) => [c.code, ...Object.values(c.files ?? {})])].join("\n");
        expect(text).not.toMatch(/\w@\w|https?:|\/home\/|\/Users\//);
      }
    }
  });
});

const all: Array<{ inst: PyCodeInstance; label: string }> = [];
for (const t of DATA_TYPES) for (const level of EXERCISE_LEVELS) for (const s of SEEDS) all.push({ inst: t.generate(s, level), label: `${t.id} ${level} ${s}` });
for (const id of PY_DATA_TEMPLATE_IDS) for (const level of EXERCISE_LEVELS) for (const s of SEEDS.slice(0, 3)) all.push({ inst: makeCodeTemplate(id, s, level), label: `${id} ${level} ${s}` });
const usable = all.filter((x) => runnable(x.inst));

describe.skipIf(!hasPython3)("ejercicios de los temas 6 a 13: referencia y código inicial", () => {
  it("la referencia pasa todos los casos y requisitos (con las semillas que se puedan comprobar aquí)", () => {
    const results = check(usable.map(({ inst }) => ({ inst, code: inst.solution })));
    results.forEach((r, i) => {
      const bad = r.casos.map((c, k) => (c.ok ? null : `caso ${k + 1}: ${JSON.stringify(c).slice(0, 400)}`)).filter(Boolean);
      expect({ label: usable[i]!.label, sintaxis: r.sintaxis, bad, reglas: r.reglas }).toEqual({ label: usable[i]!.label, sintaxis: null, bad: [], reglas: r.reglas.map(() => true) });
    });
  }, 600_000);

  it("el código inicial no resuelve ninguno (y nunca da «no se ha podido comprobar»)", () => {
    const items = usable.filter((_, i) => i % 2 === 0);
    const results = check(items.map(({ inst }) => ({ inst, code: inst.starter })));
    results.forEach((r, i) => {
      expect(allPassed(r), items[i]!.label).toBe(false);
      expect(r.casos.some((c) => c.interno), items[i]!.label).toBe(false);
    });
  }, 600_000);
});

// Soluciones equivocadas típicas: cada una debe fallar (por los casos, las comprobaciones o los
// requisitos) con todas las semillas probadas. Algunas dependen de la variante que salga (la función).
type Wrong = (inst: PyCodeInstance) => string;
const PD = "import numpy as np\nimport pandas as pd\n\n";
const PLT = "import matplotlib.pyplot as plt\nimport pandas as pd\nimport seaborn as sns\n\n";
const byFn = (m: Record<string, string>): Wrong => (inst) => {
  const code = m[inst.fn];
  if (code === undefined) throw new Error(`sin solución equivocada para ${inst.fn}`);
  return code;
};
/** La referencia con otra firma (un parámetro de más delante). */
const otherSignature: Wrong = (inst) => inst.solution.replace(`def ${inst.fn}(`, `def ${inst.fn}(extra, `);
/** La referencia con la comprensión partida en dos líneas (sigue siendo correcta, pero no «en una línea»). */
const twoLines: Wrong = (inst) => inst.solution.replace(/(\n {4}return [^\n]*?) for /, "$1\n        for ");
/** La referencia con la condición de la comprensión al revés. */
const negated: Wrong = (inst) => {
  const lines = inst.solution.split("\n");
  const k = lines.findLastIndex((l) => l.trimStart().startsWith("return "));
  lines[k] = lines[k]!.replace(/ for (.+?) if /, " for $1 if not ");
  return lines.join("\n");
};

const WRONG: Record<string, Partial<Record<ExerciseLevel, Wrong[]>>> = {
  bug: {
    básico: [otherSignature, byFn({ contar_mayores: "def contar_mayores(numeros, umbral):\n    return len(numeros)\n", posicion_maximo: "def posicion_maximo(lista):\n    return lista.index(max(lista[:-1] or lista))\n" })],
    medio: [otherSignature, byFn({ anotar: "def anotar(elemento, lista=None):\n    lista = lista or []\n    return lista + [elemento, elemento]\n", quitar_negativos: "def quitar_negativos(numeros):\n    numeros[:] = [n for n in numeros if n >= 0]\n    return numeros\n" })],
    avanzado: [otherSignature, byFn({ crear_sumadores: "def crear_sumadores(n):\n    return [lambda x: x + n for i in range(n)]\n", aplicar_descuento: "def aplicar_descuento(precios, pct):\n    for p in precios:\n        precios[p] = round(precios[p] * (1 - pct / 100), 2)\n    return precios\n" })],
  },
  "una-linea": { básico: [twoLines, negated], medio: [twoLines, negated], avanzado: [twoLines, negated] },
  generadores: {
    básico: [(i) => i.solution.replace(/for i in range\(1, n \+ 1\):\n {8}yield (.+)/, "return iter([$1 for i in range(1, n + 1)])"), (i) => i.solution.replace("range(1, n + 1)", "range(n)")],
    medio: [(i) => i.solution.replace("ascending=[False, True]", "ascending=[True, True]"), (i) => i.solution.replace(/ {4}for fila in ordenado.itertuples\(\):\n {8}yield (.+)/, "    return [$1 for fila in ordenado.itertuples()]")],
    avanzado: [
      byFn({ ventanas: "def ventanas(iterable, k):\n    xs = list(iterable)\n    for i in range(len(xs) - k + 1):\n        yield tuple(xs[i:i + k])\n", acumulados: "def acumulados(iterable):\n    xs = list(iterable)\n    for i in range(len(xs)):\n        yield sum(xs[: i + 1])\n" }),
      byFn({ ventanas: "def ventanas(iterable, k):\n    ultimos = []\n    for x in iterable:\n        ultimos = (ultimos + [x])[-k:]\n        if len(ultimos) == k:\n            yield ultimos\n", acumulados: "def acumulados(iterable):\n    for x in iterable:\n        yield x\n" }),
    ],
  },
  clases: {
    básico: [
      () => "class Cuenta:\n    def __init__(self, titular, saldo=0):\n        self.titular = titular\n        self.saldo = saldo\n    def ingresar(self, c):\n        self.saldo += c\n    def retirar(self, c):\n        self.saldo -= c\n",
      () => "class Cuenta:\n    def __init__(self, titular, saldo):\n        self.titular = titular\n        self.saldo = saldo\n    def ingresar(self, c):\n        if c <= 0:\n            raise ValueError\n        self.saldo += c\n    def retirar(self, c):\n        if c <= 0 or c > self.saldo:\n            raise ValueError\n        self.saldo -= c\n",
    ],
    medio: [
      (i) => i.solution.replace("class Cuadrado(Rectangulo):\n    def __init__(self, lado):\n        super().__init__(lado, lado)", "class Cuadrado:\n    def __init__(self, lado):\n        self.ancho = self.alto = lado\n    def area(self):\n        return self.ancho ** 2\n    def perimetro(self):\n        return 4 * self.ancho"),
      (i) => i.solution.replace('return f"Rectángulo {self.ancho} x {self.alto}"', 'return f"Rectangulo {self.ancho}x{self.alto}"'),
    ],
    avanzado: [
      (i) => i.solution.replace("    @property\n    def total(self):\n        return sum(self._unidades.values())", "    def total(self):\n        return sum(self._unidades.values())"),
      (i) => i.solution.replace("        if self._unidades[producto] == 0:\n            del self._unidades[producto]\n", ""),
    ],
  },
  avanzado: {
    básico: [
      () => "def mas_comunes(palabras, k):\n    c = {}\n    for p in palabras:\n        c[p] = c.get(p, 0) + 1\n    return sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:k]\n",
      () => "from collections import Counter\n\ndef mas_comunes(palabras, k):\n    return Counter(palabras).most_common()[: max(k - 1, 0)]\n",
    ],
    medio: [
      () => "def contar_llamadas(funcion):\n    def envoltura(*args, **kwargs):\n        envoltura.llamadas += 1\n        return funcion(*args, **kwargs)\n    envoltura.llamadas = 0\n    return envoltura\n",
      () => "import functools\n\ndef contar_llamadas(funcion):\n    @functools.wraps(funcion)\n    def envoltura(*args, **kwargs):\n        return funcion(*args, **kwargs)\n    envoltura.llamadas = 1\n    return envoltura\n",
    ],
    avanzado: [
      byFn({ mezclar: "import heapq\n\ndef mezclar(listas):\n    return sorted(x for l in listas for x in l)\n", k_menores: "import heapq\n\ndef k_menores(numeros, k):\n    return sorted(numeros)[:k]\n" }),
      byFn({ mezclar: "import heapq\n\ndef mezclar(listas):\n    return [x for l in listas for x in l]\n", k_menores: "import heapq\n\ndef k_menores(numeros, k):\n    return heapq.nlargest(k, numeros)\n" }),
    ],
  },
  "numpy-mascaras": {
    básico: [
      byFn({ centrar: `${PD}def centrar(m):\n    return m - m.mean()\n`, matriz: `${PD}def matriz(semilla, filas, columnas):\n    np.random.seed(semilla)\n    m = np.random.randint(-9, 30, size=(filas, columnas))\n    return m, m.max(axis=0)\n` }),
      byFn({ centrar: `${PD}def centrar(m):\n    return m - m.mean(axis=1, keepdims=True)\n`, matriz: `${PD}def matriz(semilla, filas, columnas):\n    m = np.random.default_rng(semilla).integers(0, 10, size=(filas, columnas))\n    return m, m.max(axis=1)\n` }),
    ],
    medio: [() => `${PD}def marcar_multiplos(m, k):\n    r = m.astype(float)\n    r[m % k != 0] = np.nan\n    return r\n`, () => `${PD}def marcar_multiplos(m, k):\n    m[m % k == 0] = -1\n    return m\n`],
    avanzado: [(i) => i.solution.replace("m.min(axis=1, keepdims=True)", "m.min(axis=0)"), (i) => i.solution.replace("r[(r > 0) & (r % k == 0)]", "r[r % k == 0]")],
  },
  "numpy-sistemas": {
    básico: [() => `${PD}def resolver(A, b):\n    return np.linalg.solve(A.T, b)\n`, () => `${PD}def resolver(A, b):\n    return b / A.sum(axis=1)\n`],
    medio: [() => `${PD}def es_solucion(A, b, x):\n    return True\n`, () => `${PD}def es_solucion(A, b, x):\n    return bool(np.allclose(x, b))\n`],
    avanzado: [() => `${PD}def resolver_o_nada(A, b):\n    return np.round(np.linalg.lstsq(A, b, rcond=None)[0], 6)\n`, () => `${PD}def resolver_o_nada(A, b):\n    if np.linalg.matrix_rank(A) < A.shape[0]:\n        return np.zeros(A.shape[0])\n    return np.round(np.linalg.solve(A, b), 6)\n`],
  },
  "pandas-nulos": {
    básico: [
      byFn({ nulos_por_columna: `${PD}def nulos_por_columna(df):\n    return df.isna().sum(axis=1)\n`, columnas_con_nulos: `${PD}def columnas_con_nulos(df):\n    return df.columns[df.isna().all()].tolist()\n` }),
      byFn({ nulos_por_columna: `${PD}def nulos_por_columna(df):\n    return df.notna().sum()\n`, columnas_con_nulos: `${PD}def columnas_con_nulos(df):\n    return list(df.columns)\n` }),
    ],
    medio: [() => `${PD}def quitar_columnas(df, k):\n    return df.dropna(axis=1, thresh=k)\n`, () => `${PD}def quitar_columnas(df, k):\n    return df.dropna()\n`],
    avanzado: [() => `${PD}def rellenar(df, k):\n    return df.dropna(axis=1, thresh=len(df) - k).interpolate()\n`, () => `${PD}def rellenar(df, k):\n    df = df.dropna(axis=1, thresh=len(df) - k)\n    return df.fillna(df.mean())\n`],
  },
  "pandas-limpiar": {
    básico: [() => `${PD}def a_numeros(df):\n    return df.replace(["ERROR", "UNKNOWN"], np.nan)\n`, () => `${PD}def a_numeros(df):\n    for c in ["cantidad", "precio", "total"]:\n        df[c] = pd.to_numeric(df[c], errors="coerce")\n    return df\n`],
    // El error típico: el primer precio que aparece en vez de la moda.
    medio: [
      () => `${PD}def precio_por_articulo(df):\n    primeros = df.dropna(subset=["precio"]).drop_duplicates("articulo")\n    return dict(zip(primeros["articulo"], primeros["precio"]))\n`,
      () => `${PD}def precio_por_articulo(df):\n    return df.dropna(subset=["precio"]).groupby("articulo")["precio"].mean().to_dict()\n`,
    ],
    avanzado: [
      (i) => i.solution.replace('precios = validos.groupby("articulo")["precio"].agg(lambda s: s.mode()[0])', 'precios = validos.drop_duplicates("articulo").set_index("articulo")["precio"]'),
      (i) => i.solution.replace('.agg(lambda s: s.mode()[0])', ".mean()"),
      () => `${PD}def completar(df):\n    return df\n`,
    ],
  },
  "pandas-agrupar": {
    básico: [() => `${PD}def porcentaje_nulos(df):\n    return df.isna().sum()\n`, () => `${PD}def porcentaje_nulos(df):\n    return df.isna().mean().round(2)\n`],
    medio: [
      byFn({ total_por_local: `${PD}def total_por_local(df):\n    return df.groupby("local")["total"].mean().round(2)\n`, tickets_por_pago: `${PD}def tickets_por_pago(df):\n    return df.groupby("local").size()\n` }),
      byFn({ total_por_local: `${PD}def total_por_local(df):\n    return df.groupby("local")["total"].count()\n`, tickets_por_pago: `${PD}def tickets_por_pago(df):\n    return df.groupby("pago").size() * 0 + len(df)\n` }),
    ],
    avanzado: [(i) => i.solution.replace('aggfunc="count"', 'aggfunc="sum"'), (i) => i.solution.replace('index="categoria", columns="anio"', 'index="anio", columns="categoria"')],
  },
  "pandas-fechas": {
    básico: [() => `${PD}def separar_titulos(textos):\n    return pd.DataFrame([t.split(" - ") for t in textos], columns=["titulo", "anio"])\n`, () => `${PD}def separar_titulos(textos):\n    return pd.DataFrame([t.rsplit(" - ", 1) for t in textos], columns=["título", "año"]).astype({"año": int})\n`],
    medio: [(i) => i.solution.replace(".dt.year", ".dt.month"), () => `${PD}def por_anio(df):\n    return df.groupby(df["fecha"].str[:4]).size()\n`],
    avanzado: [
      byFn({ separar_titulos: `${PD}def separar_titulos(textos):\n    filas = [t.split(" - ") for t in textos]\n    return pd.DataFrame([[f[0], int(f[-1])] for f in filas], columns=["titulo", "anio"])\n`, lugares: `${PD}def lugares(df):\n    return df["lugar"].str.lower().value_counts().sort_index()\n` }),
      byFn({ separar_titulos: `${PD}def separar_titulos(textos):\n    return pd.DataFrame([t.rsplit(" - ", 1) for t in textos], columns=["titulo", "anio"])\n`, lugares: `${PD}def lugares(df):\n    return df["lugar"].str.strip().str.upper().value_counts().sort_index()\n` }),
    ],
  },
  "pandas-combinar": {
    básico: [(i) => i.solution.replace('how="left"', 'how="inner"'), () => `${PD}def unir(df, paises):\n    return pd.concat([df, paises], axis=1)\n`],
    medio: [(i) => i.solution.replace('    df["lugar"] = df["lugar"].str.strip().str.lower()\n', ""), (i) => i.solution.replace('how="left"', 'how="inner"')],
    avanzado: [(i) => i.solution.replace("paises.drop_duplicates()", "paises"), (i) => i.solution.replace('    unidas["pais"] = unidas["pais"].fillna("desconocido")\n', "")],
  },
  graficos: {
    básico: [(i) => i.solution.replace(/ax\.scatter\((.+)\)/, "ax.plot($1)"), (i) => i.solution.replace(/figsize=\(\d+, \d+\)/, "figsize=(10, 10)")],
    medio: [(i) => i.solution.replace(/, estimator="sum"/g, ""), () => `${PLT}def barras(df):\n    sns.barplot(data=df, x="local", y="total", hue="pago", estimator="sum", errorbar=None)\n`],
    avanzado: [
      () => `${PLT}def lineas(df):\n    df = df.dropna(subset=["categoria", "fecha"]).copy()\n    df["anio"] = pd.to_datetime(df["fecha"]).dt.year\n    for c, d in df.groupby("categoria"):\n        s = d.groupby("anio").size()\n        plt.plot(s.index, s.values, label=c)\n    plt.title("Incidencias")\n`,
      (i) => i.solution.replace("eje.plot(serie.index, serie.values, marker=\"o\")", "eje.bar(serie.index, serie.values)"),
    ],
  },
};

describe.skipIf(!hasPython3)("ejercicios de los temas 6 a 13: soluciones equivocadas", () => {
  it("cada tipo tiene al menos dos soluciones equivocadas por nivel, y fallan con todas las semillas", () => {
    const items: Array<{ inst: PyCodeInstance; code: string; label: string }> = [];
    for (const id of PY_DATA_TEMPLATE_IDS) {
      for (const level of EXERCISE_LEVELS) {
        const ws = WRONG[id]?.[level] ?? [];
        expect(ws.length, `${id} ${level}`).toBeGreaterThanOrEqual(2);
        for (const s of SEEDS.slice(0, 5)) {
          const inst = makeCodeTemplate(id, s, level);
          if (!runnable(inst)) continue;
          ws.forEach((w, k) => {
            const code = w(inst);
            expect(code, `${id} ${level} n.º ${k + 1}: no cambia nada`).not.toBe(inst.solution);
            items.push({ inst, code, label: `${id} ${level} ${s} equivocada n.º ${k + 1}` });
          });
        }
      }
    }
    const results = check(items);
    results.forEach((r, i) => {
      expect(allPassed(r), items[i]!.label).toBe(false);
      expect(r.casos.some((c) => c.interno), items[i]!.label).toBe(false);
    });
  }, 600_000);

  it.skipIf(!hasPandas)("el resultado no lleva los precios de la moda (lo esperado), solo lo que hizo la persona", () => {
    const inst = makeCodeTemplate("pandas-limpiar", 4, "medio");
    const [r] = runJobs<unknown>(HARNESS_PY, [{ fn: "__labs_check", payload: checkPayload(inst, `${PD}def precio_por_articulo(df):\n    return {}\n`), files: caseFiles(inst.cases) }]);
    const text = JSON.stringify(r);
    expect(text).toContain("{}");
    expect(text).not.toMatch(/'(café|té|zumo|batido|tostada|bocadillo|ensalada|sopa|empanada|galleta|magdalena|yogur|tarta|agua|infusión|croissant)': \d/);
  });
});
