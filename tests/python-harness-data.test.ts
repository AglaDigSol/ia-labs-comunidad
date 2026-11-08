// Banco de pruebas, parte de datos (harness-data.ts), con el python3 del sistema: comparar tablas de
// pandas, series y arrays con tolerancia; generadores (y su pereza); requisitos de ast nuevos («en una
// línea», firma, clases…); comprobaciones con nombre y la inspección de figuras de matplotlib y seaborn.
// Cada bloque se salta si al python3 le falta lo que necesita (hasPython3, hasPandas, hasPlots).
import { describe, expect, it } from "vitest";
import type { PyCase, PyCheck, PyCodeInstance, PyRule } from "../shared/exercises/python.ts";
import { allPassed, caseFiles, checkPayload, HARNESS_PY, importsOf, parseCheckResult, type CheckResult } from "../src/features/labs/exercises/python/harness.ts";
import { hasPandas, hasPlots, hasPython3, runJobs } from "./system-python.ts";

function inst(over: Partial<PyCodeInstance> & Pick<PyCodeInstance, "fn" | "solution" | "cases">): PyCodeInstance {
  return { kind: "code", tema: 9, template: "prueba", title: "Prueba", statement: ["`x`"], starter: "", hints: ["a", "b"], ...over };
}

function check(i: PyCodeInstance, codes: string[]): CheckResult[] {
  const raw = runJobs<unknown>(HARNESS_PY, codes.map((code) => ({ fn: "__labs_check", payload: checkPayload(i, code), files: caseFiles(i.cases) })));
  return raw.map((r) => {
    const p = parseCheckResult(JSON.stringify(r));
    if (!p) throw new Error(`ilegible: ${JSON.stringify(r).slice(0, 300)}`);
    return p;
  });
}

const detail = (r: CheckResult, k = 0) => r.casos[k]!.mal?.[0]?.detalle;

describe("importsOf y checkPayload", () => {
  it("añade los import de los paquetes del ejercicio y pasa opciones, comprobaciones y toma", () => {
    const i = inst({ fn: "f", solution: "", cases: [{ code: "f()", options: { rowOrder: false }, checks: [{ kind: "fig-alturas", label: "x", axes: 1 }], take: 5 }], packages: ["pandas", "seaborn"], seconds: 6 });
    expect(importsOf(i, "x = 1")).toBe("x = 1\nimport pandas\nimport seaborn\n");
    expect(importsOf(inst({ fn: "f", solution: "", cases: [] }), "x = 1")).toBe("x = 1");
    const p = checkPayload(i, "x = 1");
    expect(p.segundos).toBe(6);
    expect(p.paquetes).toEqual(["pandas", "seaborn"]);
    expect(p.casos[0]).toEqual({ codigo: "f()", compara: ["valor"], opciones: { rowOrder: false }, checks: [{ tipo: "fig-alturas", ejes: 1 }], toma: 5 });
  });
});

describe.skipIf(!hasPython3)("banco de pruebas: generadores, casos con assert y requisitos nuevos", () => {
  it("generadores: se comparan por lo que producen; generador y perezoso; toma con uno infinito", () => {
    const checks: PyCheck[] = [
      { kind: "generador", label: "Devuelve un generador" },
      { kind: "perezoso", label: "No empieza hasta que se le pide" },
    ];
    const i = inst({
      fn: "cuadrados",
      solution: "def cuadrados(n):\n    for i in range(n):\n        yield i * i\n",
      cases: [{ code: "cuadrados(5)", checks }, { code: "from itertools import count\ndef cuadrados_inf():\n    return cuadrados(10**9)\ncuadrados_inf()", take: 20, checks }],
      rules: [{ kind: "usa", what: "generador:cuadrados", label: "Usa yield" }],
    });
    const [ok, lista, eager, malo] = check(i, [
      i.solution,
      "def cuadrados(n):\n    return [i * i for i in range(n)]\n",
      "def cuadrados(n):\n    r = [i * i for i in range(min(n, 30))]\n    yield from r\n",
      "def cuadrados(n):\n    for i in range(n):\n        yield i\n",
    ]);
    expect(allPassed(ok!)).toBe(true);
    // Una lista con los mismos valores no vale: no es un generador (ni se compara como tal).
    expect(lista!.casos[0]!.ok).toBe(false);
    expect(lista!.casos[0]!.checks).toEqual([{ ok: false, tuyo: "list" }, { ok: false, tuyo: "list" }]);
    expect(lista!.casos[0]!.mal?.[0]?.tipo).toBe("list");
    expect(lista!.reglas).toEqual([false]);
    // Este produce lo mismo al principio pero se queda corto con el infinito.
    expect(eager!.casos[0]!.ok).toBe(true);
    expect(eager!.casos[1]!.ok).toBe(true);
    expect(malo!.casos[0]!.ok).toBe(false);
    expect(malo!.casos[0]!.checks).toEqual([{ ok: true, tuyo: "generator" }, { ok: true, tuyo: "empezó a ejecutarse antes de pedirle nada" }]);
  });

  it("un caso que acaba en assert vale None: pasa si no falla", () => {
    const i = inst({ fn: "doble", solution: "def doble(x):\n    return 2 * x\n", cases: [{ code: "assert doble(2) == 4" }, { code: "doble(7)" }] });
    const [ok, mal] = check(i, [i.solution, "def doble(x):\n    return x + 2\n"]);
    expect(allPassed(ok!)).toBe(true);
    expect(mal!.casos[0]!.ok).toBe(true); // 2 + 2 == 4: el assert del enunciado no basta
    expect(mal!.casos[1]!.ok).toBe(false);
    const [boom] = check(i, ["def doble(x):\n    return 0\n"]);
    expect(boom!.casos[0]!.error?.tipo).toBe("AssertionError");
  });

  it("en una línea, firma, clases, herencia, métodos, propiedades y decoradores", () => {
    const rules: PyRule[] = [
      { kind: "usa", what: "una-linea:pares", label: "" },
      { kind: "usa", what: "firma:pares:xs,k", label: "" },
      { kind: "usa", what: "clase:Caja", label: "" },
      { kind: "usa", what: "hereda:Caja:Base", label: "" },
      { kind: "usa", what: "metodo:Caja:vaciar", label: "" },
      { kind: "usa", what: "propiedad:Caja:total", label: "" },
      { kind: "usa", what: "decorador:registrar", label: "" },
    ];
    const i = inst({ fn: "pares", solution: "def pares(xs, k):\n    return [x for x in xs if x % k == 0]\n", cases: [{ code: "pares([1, 2, 4], 2)" }], rules });
    const good = String.raw`
def registrar(f):
    return f

class Base:
    pass

class Caja(Base):
    @property
    def total(self):
        return 0
    def vaciar(self):
        pass

@registrar
def pares(xs, k):
    """Los múltiplos de k."""
    return [x for x in xs if x % k == 0]
`;
    const loop = "def pares(xs, k):\n    out = []\n    for x in xs:\n        if x % k == 0:\n            out.append(x)\n    return out\n";
    const twoLines = "def pares(xs, k):\n    return [x for x in xs\n            if x % k == 0]\n";
    const otherSig = "def pares(lista, k=2):\n    return [x for x in lista if x % k == 0]\n";
    const [a, b, c, d] = check(i, [good, loop, twoLines, otherSig]);
    expect(a!.reglas).toEqual([true, true, true, true, true, true, true]);
    expect(b!.reglas.slice(0, 2)).toEqual([false, true]);
    expect(c!.reglas.slice(0, 2)).toEqual([false, true]);
    expect(d!.reglas.slice(0, 2)).toEqual([true, false]);
  });

  it("los ejercicios de antes no cambian: tipos estrictos con listas, sin detalle", () => {
    const i = inst({ fn: "f", solution: "def f():\n    return [1, 2]\n", cases: [{ code: "f()" }] });
    const [r] = check(i, ["def f():\n    return (1, 2)\n"]);
    expect(r!.casos[0]!.mal).toEqual([{ que: "valor", texto: "(1, 2)", tipo: "tuple" }]);
  });
});

const PD = "import pandas as pd\nimport numpy as np\n";

describe.skipIf(!hasPandas)("banco de pruebas: tablas, series y arrays", () => {
  const files = { "t.csv": "a,b,c\n1,x,1.5\n2,y,\n3,z,2.25\n" };
  const tabla = (code: string, opts: PyCase["options"] = undefined, checks: PyCheck[] = []): PyCodeInstance =>
    inst({
      fn: "leer",
      solution: `${PD}def leer(ruta):\n    ${code}\n`,
      cases: [{ code: "leer('t.csv')", files, ...(opts ? { options: opts } : {}), ...(checks.length ? { checks } : {}) }],
      packages: ["pandas"],
    });

  it("DataFrame: igual con tolerancia, columnas en otro orden, forma, columnas, nulos, valores y orden", () => {
    const i = tabla("return pd.read_csv(ruta)");
    const [same, tol, cols, shape, names, nulls, vals, order, notdf] = check(i, [
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta)\n`,
      `${PD}def leer(ruta):\n    df = pd.read_csv(ruta)\n    df['c'] = df['c'] + 1e-9\n    return df\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta)[['c', 'a', 'b']]\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).head(2)\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).rename(columns={'a': 'A'})\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).fillna(0)\n`,
      `${PD}def leer(ruta):\n    df = pd.read_csv(ruta)\n    df.loc[2, 'a'] = 30\n    return df\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).iloc[::-1]\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).values\n`,
    ]);
    expect(allPassed(same!)).toBe(true);
    expect(allPassed(tol!)).toBe(true);
    expect(allPassed(cols!)).toBe(true);
    expect(detail(shape!)).toEqual({ clave: "forma", tuyo: "(2, 3)" });
    expect(detail(names!)).toEqual({ clave: "columnas", tuyo: "['A', 'b', 'c']" });
    expect(detail(nulls!)).toEqual({ clave: "nulos", tuyo: "c: 0" });
    expect(detail(vals!)).toEqual({ clave: "valores", donde: "la columna 'a'", fila: 2, tuyo: "30" });
    expect(detail(order!)).toEqual({ clave: "orden" });
    expect(detail(notdf!)).toEqual({ clave: "tipo", tuyo: "ndarray" });
    // El texto enseña la tabla de la persona (con su forma), nunca la esperada.
    expect(shape!.casos[0]!.mal![0]!.texto).toMatch(/^DataFrame \(2, 3\)\n/);
  });

  it("opciones: sin orden de filas, con tipos, con orden de columnas", () => {
    const rev = `${PD}def leer(ruta):\n    return pd.read_csv(ruta).iloc[::-1]\n`;
    expect(allPassed(check(tabla("return pd.read_csv(ruta)", { rowOrder: false }), [rev])[0]!)).toBe(true);
    const asFloat = `${PD}def leer(ruta):\n    return pd.read_csv(ruta).astype({'a': float})\n`;
    expect(allPassed(check(tabla("return pd.read_csv(ruta)"), [asFloat])[0]!)).toBe(true);
    expect(detail(check(tabla("return pd.read_csv(ruta)", { dtypes: true }), [asFloat])[0]!)).toEqual({ clave: "tipos", tuyo: "a: real" });
    const reord = `${PD}def leer(ruta):\n    return pd.read_csv(ruta)[['b', 'a', 'c']]\n`;
    expect(detail(check(tabla("return pd.read_csv(ruta)", { columnOrder: true }), [reord])[0]!)?.clave).toBe("columnas");
  });

  it("Series: el índice cuenta (es el del groupby); index: false lo ignora", () => {
    const i = inst({
      fn: "cuenta",
      solution: `${PD}def cuenta(xs):\n    return pd.Series(xs).value_counts().sort_index()\n`,
      cases: [{ code: "cuenta(['b', 'a', 'b', 'c'])" }],
      packages: ["pandas"],
    });
    const [ok, desorden, sinIndice] = check(i, [
      `${PD}def cuenta(xs):\n    return pd.Series(xs).groupby(xs).size()\n`,
      `${PD}def cuenta(xs):\n    return pd.Series(xs).value_counts()\n`,
      `${PD}def cuenta(xs):\n    return pd.Series([1, 2, 1])\n`,
    ]);
    expect(allPassed(ok!)).toBe(true);
    expect(detail(desorden!)?.clave).toBe("orden");
    expect(detail(sinIndice!)?.clave).toBe("valores");
    const j = { ...i, cases: [{ code: "cuenta(['b', 'a', 'b', 'c'])", options: { index: false } }] };
    expect(allPassed(check(j, [`${PD}def cuenta(xs):\n    return pd.Series([1, 2, 1])\n`])[0]!)).toBe(true);
  });

  it("arrays de NumPy: forma, NaN en otro sitio y el primer valor distinto; escalares de NumPy como números", () => {
    const i = inst({
      fn: "m",
      solution: `${PD}def m():\n    a = np.arange(6, dtype=float).reshape(2, 3)\n    a[0, 1] = np.nan\n    return a\n`,
      cases: [{ code: "m()" }],
      packages: ["numpy"],
    });
    const [ok, forma, nan, val] = check(i, [
      i.solution,
      `${PD}def m():\n    return np.zeros((3, 2))\n`,
      `${PD}def m():\n    a = np.arange(6, dtype=float).reshape(2, 3)\n    a[1, 1] = np.nan\n    return a\n`,
      `${PD}def m():\n    a = np.arange(6, dtype=float).reshape(2, 3)\n    a[0, 1] = np.nan\n    a[1, 2] = 50\n    return a\n`,
    ]);
    expect(allPassed(ok!)).toBe(true);
    expect(detail(forma!)).toEqual({ clave: "forma", tuyo: "(3, 2)" });
    expect(detail(nan!)).toEqual({ clave: "nulos", tuyo: "1" });
    expect(detail(val!)).toEqual({ clave: "valores", donde: "la posición (1, 2)", tuyo: "50.0" });
    const s = inst({ fn: "s", solution: `${PD}def s():\n    return np.int64(3)\n`, cases: [{ code: "s()" }], packages: ["numpy"] });
    expect(allPassed(check(s, ["def s():\n    return 3\n"])[0]!)).toBe(true);
  });

  it("comprobaciones con nombre: forma, columnas, tipos, sin-nulos, nulos, orden, índice y tipo", () => {
    const checks: PyCheck[] = ["tipo", "forma", "columnas", "tipos", "sin-nulos", "nulos", "orden", "indice"].map((k) => ({ kind: k as PyCheck["kind"], label: k }));
    const i = tabla("return pd.read_csv(ruta).fillna(0)", undefined, checks);
    const [ok, conNan, otra] = check(i, [
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta).fillna(0)\n`,
      `${PD}def leer(ruta):\n    return pd.read_csv(ruta)\n`,
      `${PD}def leer(ruta):\n    df = pd.read_csv(ruta).fillna(0).iloc[::-1]\n    df['a'] = df['a'].astype(str)\n    return df\n`,
    ]);
    expect(allPassed(ok!)).toBe(true);
    expect(ok!.casos[0]!.checks!.every((c) => c.ok)).toBe(true);
    const byKind = (r: CheckResult) => Object.fromEntries(checks.map((c, k) => [c.kind, r.casos[0]!.checks![k]!]));
    expect(byKind(conNan!)["sin-nulos"]).toEqual({ ok: false, tuyo: "1 valor perdido" });
    expect(byKind(conNan!).nulos!.ok).toBe(false);
    expect(byKind(conNan!).forma!.ok).toBe(true);
    const o = byKind(otra!);
    expect(o.tipos).toEqual({ ok: false, tuyo: "a: texto" });
    expect(o.indice).toEqual({ ok: false, tuyo: "2, 1, 0" });
    expect(o.columnas!.ok).toBe(true);
  });
});

const PLT = "import pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n";

describe.skipIf(!hasPlots)("banco de pruebas: inspección de figuras", () => {
  const data = { "d.csv": "g,h,x,y\na,u,1,2\na,v,2,3\nb,u,3,5\nb,v,4,1\nb,u,5,4\n" };
  const fig = (solution: string, checks: PyCheck[]) =>
    inst({ fn: "dibujar", solution: `${PLT}${solution}`, cases: [{ code: "import pandas as pd\ndibujar(pd.read_csv('d.csv'))", compare: [], files: data, checks }], packages: ["pandas", "matplotlib.pyplot", "seaborn"] });
  const C = (kind: PyCheck["kind"], axes?: number): PyCheck => (axes === undefined ? { kind, label: kind } : { kind, label: kind, axes });

  it("dispersión: tamaño, un gráfico, tipo, puntos, título y nombres de los ejes", () => {
    const i = fig(
      "def dibujar(df):\n    fig, ax = plt.subplots(figsize=(8, 4))\n    ax.scatter(df.x, df.y)\n    ax.set_title('x frente a y')\n    ax.set_xlabel('x')\n    ax.set_ylabel('y')\n",
      [C("fig-una"), C("fig-tamano"), C("fig-ejes"), C("fig-tipo"), C("fig-puntos"), C("fig-titulo"), C("fig-etiquetas")],
    );
    const [ok, mal, nada] = check(i, [
      i.solution,
      `${PLT}def dibujar(df):\n    plt.figure(figsize=(6, 4))\n    plt.plot(df.y, df.x)\n`,
      "def dibujar(df):\n    pass\n",
    ]);
    expect(ok!.casos[0]!.checks!.map((c) => c.ok)).toEqual([true, true, true, true, true, true, true]);
    expect(allPassed(ok!)).toBe(true);
    expect(mal!.casos[0]!.checks).toEqual([
      { ok: true, tuyo: "1 figura" },
      { ok: false, tuyo: "6 × 4 pulgadas" },
      { ok: true, tuyo: "1 gráfico" },
      { ok: false, tuyo: "líneas" },
      { ok: false, tuyo: "0 puntos" },
      { ok: false, tuyo: "sin título" },
      { ok: false, tuyo: "x: —, y: —" },
    ]);
    expect(nada!.casos[0]!.checks![1]).toEqual({ ok: false, tuyo: "tu código no deja ninguna figura abierta" });
    expect(nada!.casos[0]!.interno).toBeUndefined();
  });

  it("el tamaño de lo tuyo, con coma decimal: 6,4 × 4,8 pulgadas", () => {
    const i = fig("def dibujar(df):\n    fig, ax = plt.subplots(figsize=(8, 4))\n    ax.scatter(df.x, df.y)\n", [C("fig-tamano")]);
    const [r] = check(i, [`${PLT}def dibujar(df):\n    plt.figure()\n    plt.scatter(df.x, df.y)\n`]);
    expect(r!.casos[0]!.checks).toEqual([{ ok: false, tuyo: "6,4 × 4,8 pulgadas" }]);
  });

  it("barras de seaborn con hue y estimator=sum: las alturas son las sumas; la media no vale", () => {
    const i = fig(
      "def dibujar(df):\n    fig, axs = plt.subplots(1, 2, figsize=(10, 4))\n    sns.barplot(data=df, x='g', y='y', hue='h', estimator='sum', errorbar=None, ax=axs[0])\n    sns.barplot(data=df, x='g', y='x', hue='h', estimator='sum', ax=axs[1])\n",
      [C("fig-ejes"), C("fig-tipo"), C("fig-barras", 0), C("fig-alturas", 0), C("fig-alturas", 1), C("fig-leyenda")],
    );
    const [ok, media, uno] = check(i, [
      i.solution,
      `${PLT}def dibujar(df):\n    fig, axs = plt.subplots(1, 2, figsize=(10, 4))\n    sns.barplot(data=df, x='g', y='y', hue='h', ax=axs[0])\n    sns.barplot(data=df, x='g', y='x', hue='h', estimator='sum', ax=axs[1])\n`,
      `${PLT}def dibujar(df):\n    sns.barplot(data=df, x='g', y='y', estimator='sum')\n`,
    ]);
    expect(allPassed(ok!)).toBe(true);
    const m = media!.casos[0]!.checks!;
    expect(m.map((c) => c.ok)).toEqual([true, true, true, false, true, true]);
    expect(m[3]!.tuyo).toBe("1; 2; 3; 4,5");
    const u = uno!.casos[0]!.checks!;
    expect(u[0]).toEqual({ ok: false, tuyo: "1 gráfico" });
    expect(u[5]).toEqual({ ok: false, tuyo: "sin leyenda" });
  });

  it("líneas, un gráfico por categoría: número de gráficos, líneas y títulos", () => {
    const i = fig(
      "def dibujar(df):\n    gs = sorted(df.g.unique())\n    fig, axs = plt.subplots(len(gs), 1, figsize=(6, 6), sharex=True)\n    for ax, g in zip(axs, gs):\n        d = df[df.g == g]\n        ax.plot(d.x, d.y)\n        ax.set_title(g)\n",
      [C("fig-ejes"), C("fig-tipo"), C("fig-lineas"), C("fig-titulo")],
    );
    const [ok, junto] = check(i, [i.solution, `${PLT}def dibujar(df):\n    for g, d in df.groupby('g'):\n        plt.plot(d.x, d.y, label=g)\n    plt.legend()\n`]);
    expect(allPassed(ok!)).toBe(true);
    expect(junto!.casos[0]!.checks!.map((c) => c.ok)).toEqual([false, false, false, false]);
    expect(junto!.casos[0]!.checks![0]!.tuyo).toBe("1 gráfico");
  });

  it("solo la figura de la persona del primer caso con gráfico queda abierta (para dibujarla)", () => {
    const i = inst({
      fn: "dibujar",
      solution: `${PLT}def dibujar(n):\n    plt.figure()\n    plt.plot(range(n))\n`,
      cases: [1, 2, 3].map((n) => ({ code: `dibujar(${n + 2})`, compare: [], checks: [C("fig-lineas")] })),
      packages: ["matplotlib.pyplot"],
    });
    const probe = `${HARNESS_PY}
def __abiertas(p):
    r = __labs_check(p)
    import matplotlib.pyplot as plt
    return _json.dumps({"r": _json.loads(r), "abiertas": len(plt.get_fignums())})
`;
    const [out] = runJobs<{ r: unknown; abiertas: number }>(probe, [{ fn: "__abiertas", payload: checkPayload(i, i.solution) }]);
    expect(allPassed(parseCheckResult(JSON.stringify(out!.r))!)).toBe(true);
    expect(out!.abiertas).toBe(1);
  });
});
