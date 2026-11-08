// Ejercicios cortos del simulacro de 01MIAR (1,25 puntos cada uno), por familias como las del examen:
// corregir un bug, reescribir en una línea, un algoritmo sin bibliotecas, un generador sobre las filas
// de una tabla, valores perdidos, partir cadenas en una tabla, matrices de NumPy y sistemas lineales.
//
// Cada familia da el enunciado, la celda inicial, la celda «Test Use Case» (asserts con valores
// calculados aquí, en TypeScript, para los datos del enunciado) y la comprobación oculta: casos con
// otros datos que el banco de pruebas compara con la solución de referencia, más los requisitos del
// enunciado (en una línea, generador, sin bucles…). Contenido original: ni enunciados ni datos salen de
// los cuadernos de la asignatura o del examen.
import { grades, movieList, sensors } from "../pydata/index.ts";
import { makeCodeTemplate } from "../exercises/python.ts";
import { call, lit, py, starterOf, tup, type PyCase, type PyCheck, type PyCodeInstance, type PyRule, type PyVal } from "../exercises/python-common.ts";
import type { Rng } from "../exercises/random.ts";
import type { PyExamFamily, PyExamShort } from "./types.ts";

/** Los ejercicios cortos son de nivel medio o avanzado, como en el examen. */
export type PyExamLevel = "medio" | "avanzado";

const HEAD_NP = "import numpy as np\n";
const HEAD_PD = "import numpy as np\nimport pandas as pd\n";
const NUMPY = ["numpy"];
const PANDAS = ["numpy", "pandas"];
/** Segundos por caso (en Pyodide, pandas es más lento que Python nativo). */
const DATA_SECONDS = 6;
const NOTE_TESTS = "La celda «Test Use Case» tiene algunas pruebas para estos datos; al corregir se usan también otros.";

const dataSeed = (rng: Rng) => rng.int(0, 0x7fffffff);
const ints = (rng: Rng, n: number, min: number, max: number) => Array.from({ length: n }, () => rng.int(min, max));
const matrix = (rng: Rng, rows: number, cols: number, min: number, max: number) => Array.from({ length: rows }, () => ints(rng, cols, min, max));
const npArray = (m: number[][]) => `np.array(${lit(m)})`;
/** El resto de Python (siempre con el signo del divisor). */
const pyMod = (a: number, b: number) => ((a % b) + b) % b;
const check = (kind: PyCheck["kind"], label: string): PyCheck => ({ kind, label });
const SIN_IMPORT: PyRule[] = [
  { kind: "evita", what: "nodo:Import", label: "Sin import: solo Python, sin bibliotecas" },
  { kind: "evita", what: "nodo:ImportFrom", label: "Sin from … import" },
];
const SIN_FOR: PyRule = { kind: "evita", what: "nodo:For", label: "Sin bucles for: con operaciones de NumPy" };
const oneLine = (fn: string): PyRule => ({ kind: "usa", what: `una-linea:${fn}`, label: `El cuerpo de ${fn} es un solo return con una comprensión, en una línea` });
const GEN_CHECKS = [check("generador", "Devuelve un generador"), check("perezoso", "No hace nada hasta que se le piden valores")];

/** Celda inicial: los import y la cabecera de la función con el «Tu solución AQUÍ». */
const starter = (head: string, fn: string, params: string) => `${head ? `${head}\n\n` : ""}${starterOf(fn, params, "Tu solución AQUÍ")}`;

/** La comprobación oculta de un ejercicio corto. */
function hidden(p: Omit<PyCodeInstance, "kind" | "hints" | "statement"> & { statement: string[] }): PyCodeInstance {
  return { kind: "code", hints: [], ...p };
}

// ---------------------------------------------------------------- Encuentra el bug

function bug(rng: Rng, level: PyExamLevel): PyExamShort {
  // La plantilla del banco de ejercicios: su primer caso son los assert del enunciado.
  const inst = makeCodeTemplate("bug", dataSeed(rng), level);
  return {
    family: "bug",
    title: `Encuentra el bug: ${inst.title.charAt(0).toLowerCase()}${inst.title.slice(1)}`,
    statement: [inst.statement[0]!, NOTE_TESTS],
    starter: inst.starter,
    test: inst.cases[0]!.code,
    files: {},
    check: inst,
    practice: { type: "py-bug", level },
  };
}

// ---------------------------------------------------------------- En una línea

function unaLinea(rng: Rng, level: PyExamLevel): PyExamShort {
  if (level === "medio") {
    const t = rng.int(-3, 3);
    const [si, no] = rng.pick<[string, string]>([["par", "impar"], ["P", "I"], ["sí", "no"]]);
    const long = py`
      def clasificar_larga(numeros):
          salida = []
          for n in numeros:
              if n > ${t}:
                  if n % 2 == 0:
                      salida.append("${si}")
                  else:
                      salida.append("${no}")
          return salida
    `;
    const ref = (xs: number[]) => xs.filter((n) => n > t).map((n) => (pyMod(n, 2) === 0 ? si : no));
    const shown = ints(rng, 7, -6, 10);
    const other = ints(rng, 5, -4, 8);
    const fn = "clasificar";
    return {
      family: "una-linea",
      title: "En una línea: if anidados",
      statement: [
        `\`clasificar_larga\` usa un bucle con dos if anidados. Escribe \`clasificar(numeros)\`, que devuelva exactamente lo mismo con una sola línea: un \`return\` con una comprensión de lista.`,
        NOTE_TESTS,
      ],
      starter: `${long}\n\n${starterOf(fn, "numeros", "Tu solución AQUÍ: una sola línea")}`,
      test: [`assert ${call(fn, shown)} == ${lit(ref(shown))}`, `assert ${call(fn, other)} == ${lit(ref(other))}`, `assert ${call(fn, [])} == []`].join("\n"),
      files: {},
      check: hidden({
        tema: 3, template: "pyexam-una-linea", title: "En una línea: if anidados", statement: [], fn,
        starter: "", solution: `${long}\n\ndef ${fn}(numeros):\n    return ["${si}" if n % 2 == 0 else "${no}" for n in numeros if n > ${t}]\n`,
        cases: [ints(rng, 9, -9, 12), [t, t + 1, t + 2, t + 3], ints(rng, 6, -3, 6), [t]].map((l) => ({ code: call(fn, l) })),
        rules: [oneLine(fn)],
      }),
      practice: { type: "py-una-linea", level },
    };
  }
  const fn = "parejas";
  const long = py`
    def parejas_larga(xs, ys):
        salida = []
        for a in xs:
            for b in ys:
                if a < b:
                    if (a + b) % 3 == 0:
                        salida.append((a, b))
        return salida
  `;
  const ref = (xs: number[], ys: number[]): PyVal[] => xs.flatMap((a) => ys.filter((b) => a < b && pyMod(a + b, 3) === 0).map((b) => tup(a, b)));
  const [x1, y1] = [ints(rng, 4, -3, 9), ints(rng, 4, -3, 9)];
  return {
    family: "una-linea",
    title: "En una línea: dos bucles y dos condiciones",
    statement: [
      "`parejas_larga` recorre dos listas con dos bucles anidados y dos if. Escribe `parejas(xs, ys)`, que devuelva la misma lista de tuplas, en el mismo orden, con una sola línea: un `return` con una comprensión.",
      NOTE_TESTS,
    ],
    starter: `${long}\n\n${starterOf(fn, "xs, ys", "Tu solución AQUÍ: una sola línea")}`,
    test: [`assert ${call(fn, x1, y1)} == ${lit(ref(x1, y1))}`, `assert ${call(fn, [1, 2], [])} == []`].join("\n"),
    files: {},
    check: hidden({
      tema: 3, template: "pyexam-una-linea", title: "En una línea: dos bucles", statement: [], fn, starter: "",
      solution: `${long}\n\ndef ${fn}(xs, ys):\n    return [(a, b) for a in xs for b in ys if a < b if (a + b) % 3 == 0]\n`,
      cases: [[ints(rng, 5, -5, 9), ints(rng, 5, -5, 9)], [[], [1]], [ints(rng, 3, 0, 6), ints(rng, 6, -2, 8)]].map((a) => ({ code: call(fn, ...a) })),
      rules: [oneLine(fn)],
    }),
    practice: { type: "py-una-linea", level },
  };
}

// ---------------------------------------------------------------- Algoritmo sin bibliotecas

/** «aaabcc» → «a3b1c2». */
function rle(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += `${s[i]}${j - i}`;
    i = j;
  }
  return out;
}

function algoritmo(rng: Rng, level: PyExamLevel): PyExamShort {
  if (level === "medio") {
    const text = (n: number) => Array.from({ length: n }, () => rng.pick(["a", "a", "b", "c", "x"])).join("");
    const shown = [text(9), text(6)];
    const fn = "comprimir";
    return {
      family: "algoritmo",
      title: "Algoritmo: comprimir repeticiones",
      statement: [
        "Escribe `comprimir(texto)`, que sustituya cada grupo de letras iguales seguidas por la letra y el número de veces que se repite: `comprimir(\"aaabcc\")` devuelve `\"a3b1c2\"`. Con el texto vacío devuelve `\"\"`.",
        "Sin bibliotecas: ni `import` ni `from … import` (tampoco `itertools.groupby`).",
        NOTE_TESTS,
      ],
      starter: starter("", fn, "texto"),
      test: [...shown.map((s) => `assert ${call(fn, s)} == ${lit(rle(s))}`), `assert ${call(fn, "")} == ""`].join("\n"),
      files: {},
      check: hidden({
        tema: 3, template: "pyexam-algoritmo", title: "Comprimir repeticiones", statement: [], fn, starter: "",
        solution: py`
          def comprimir(texto):
              salida = ""
              i = 0
              while i < len(texto):
                  j = i
                  while j < len(texto) and texto[j] == texto[i]:
                      j += 1
                  salida += texto[i] + str(j - i)
                  i = j
              return salida
        `,
        cases: [text(12), "z", "", text(4), "abcabc", "q".repeat(rng.int(10, 14))].map((s) => ({ code: call(fn, s) })),
        rules: SIN_IMPORT,
      }),
      practice: { type: "py-control", level },
    };
  }
  const sorted = (n: number) => ints(rng, n, -9, 30).sort((a, b) => a - b);
  const [a, b] = [sorted(5), sorted(4)];
  const merge = (x: number[], y: number[]) => [...x, ...y].sort((p, q) => p - q);
  const fn = "fusionar";
  return {
    family: "algoritmo",
    title: "Algoritmo: fusionar dos listas ordenadas",
    statement: [
      "Escribe `fusionar(a, b)`, que reciba dos listas ordenadas de menor a mayor y devuelva una lista nueva, también ordenada, con todos sus elementos (los repetidos se mantienen). Recorre las dos listas a la vez con dos índices.",
      "Sin bibliotecas y sin ordenar: ni `import`, ni `sorted`, ni `.sort()`. No cambies las listas que recibes.",
      NOTE_TESTS,
    ],
    starter: starter("", fn, "a, b"),
    test: [`assert ${call(fn, a, b)} == ${lit(merge(a, b))}`, `assert ${call(fn, [], [1, 2])} == [1, 2]`].join("\n"),
    files: {},
    check: hidden({
      tema: 3, template: "pyexam-algoritmo", title: "Fusionar dos listas ordenadas", statement: [], fn, starter: "",
      solution: py`
        def fusionar(a, b):
            salida = []
            i = j = 0
            while i < len(a) and j < len(b):
                if a[i] <= b[j]:
                    salida.append(a[i])
                    i += 1
                else:
                    salida.append(b[j])
                    j += 1
            return salida + a[i:] + b[j:]
      `,
      cases: [
        { code: call(fn, sorted(7), sorted(6)) },
        { code: call(fn, [], []) },
        { code: call(fn, sorted(3), []) },
        { code: call(fn, [1, 1, 2], [1, 2, 2]) },
        // Las listas que recibe no cambian.
        { code: `a = ${lit(sorted(4))}\nb = ${lit(sorted(4))}\nfusionar(a, b)\n(a, b)` },
      ],
      rules: [...SIN_IMPORT, { kind: "evita", what: "llamada:sorted", label: "Sin sorted()" }, { kind: "evita", what: "llamada:sort", label: "Sin .sort()" }],
    }),
    practice: { type: "py-control", level },
  };
}

// ---------------------------------------------------------------- Generador sobre las filas de una tabla

function generador(rng: Rng, level: PyExamLevel): PyExamShort {
  const col = rng.pick(["parcial", "final", "practicas"] as const);
  const shown = grades(dataSeed(rng), 10);
  const colIdx = ["nombre", "grupo", "parcial", "final", "practicas"].indexOf(col);
  // Orden: de mayor a menor nota y, si empatan, por nombre (como sort_values con dos claves).
  const ordered = [...shown.table.rows].sort((p, q) => Number(q[colIdx]) - Number(p[colIdx]) || (p[0]! < q[0]! ? -1 : p[0]! > q[0]! ? 1 : 0));
  const others = [8, 14, 11].map((n) => grades(dataSeed(rng), n));
  const read = (g: { file: string }) => `notas = pd.read_csv("${g.file}")`;
  const head = "`notas.csv` tiene una fila por estudiante con las columnas `nombre, grupo, parcial, final, practicas`.";
  if (level === "medio") {
    const fn = `por_${col}`;
    return {
      family: "generador",
      title: "Generador sobre las filas de una tabla",
      statement: [
        head,
        `Escribe la función generadora \`${fn}(df)\`, que recorra las filas del DataFrame ordenadas de mayor a menor \`${col}\` (si empatan, por \`nombre\` en orden alfabético) y produzca, una a una, tuplas \`(nombre, ${col})\`. Usa \`yield\`: no devuelvas una lista.`,
        NOTE_TESTS,
      ],
      starter: starter(HEAD_PD.trimEnd(), fn, "df"),
      test: [
        "import inspect",
        "import pandas as pd",
        read(shown),
        `g = ${fn}(notas)`,
        "assert inspect.isgenerator(g)",
        ...ordered.slice(0, 2).map((r) => `assert next(g) == ${lit(tup(r[0]!, Number(r[colIdx])))}`),
      ].join("\n"),
      files: { [shown.file]: shown.csv },
      check: hidden({
        tema: 13, template: "pyexam-generador", title: "Generador sobre las filas", statement: [], fn, starter: "",
        solution: py`
          import pandas as pd


          def ${fn}(df):
              for fila in df.sort_values(["${col}", "nombre"], ascending=[False, True]).itertuples():
                  yield (fila.nombre, fila.${col})
        `,
        cases: others.map((g) => ({ code: `${HEAD_PD}${read(g)}\n${fn}(notas)`, files: { [g.file]: g.csv }, checks: GEN_CHECKS })),
        rules: [{ kind: "usa", what: `generador:${fn}`, label: `${fn} es una función generadora (usa yield)` }],
        packages: PANDAS, seconds: DATA_SECONDS,
      }),
      practice: { type: "py-generadores", level },
    };
  }
  const fn = "mejores";
  const n = rng.int(3, 4);
  return {
    family: "generador",
    title: "Generador: los mejores de una tabla",
    statement: [
      head,
      `Escribe la función generadora \`${fn}(df, columna, n)\`, que produzca para las \`n\` mejores filas según \`columna\` (de mayor a menor; si empatan, por \`nombre\` en orden alfabético) la tupla \`(puesto, nombre, nota)\`, con el puesto desde 1. Si la tabla tiene menos de \`n\` filas, produce las que haya.`,
      "Tiene que ser perezosa: no hace nada hasta que se le pide el primer valor.",
      NOTE_TESTS,
    ],
    starter: starter(HEAD_PD.trimEnd(), fn, "df, columna, n"),
    test: [
      "import inspect",
      "import pandas as pd",
      read(shown),
      `g = ${fn}(notas, "${col}", ${n})`,
      "assert inspect.isgenerator(g)",
      `assert next(g) == ${lit(tup(1, ordered[0]![0]!, Number(ordered[0]![colIdx])))}`,
      `assert len(list(${fn}(notas, "${col}", ${n}))) == ${n}`,
    ].join("\n"),
    files: { [shown.file]: shown.csv },
    check: hidden({
      tema: 13, template: "pyexam-generador", title: "Los mejores de una tabla", statement: [], fn, starter: "",
      solution: py`
        import pandas as pd


        def ${fn}(df, columna, n):
            orden = df.sort_values([columna, "nombre"], ascending=[False, True]).head(n)
            for puesto, fila in enumerate(orden.itertuples(), start=1):
                yield (puesto, fila.nombre, getattr(fila, columna))
      `,
      cases: [
        ...others.map((g, i) => ({ code: `${HEAD_PD}${read(g)}\n${fn}(notas, "${["parcial", "final", "practicas"][i]}", ${n})`, files: { [g.file]: g.csv }, checks: GEN_CHECKS })),
        { code: `${HEAD_PD}${read(others[0]!)}\n${fn}(notas, "final", 50)`, files: { [others[0]!.file]: others[0]!.csv } },
      ],
      rules: [{ kind: "usa", what: `generador:${fn}`, label: `${fn} es una función generadora (usa yield)` }],
      packages: PANDAS, seconds: DATA_SECONDS,
    }),
    practice: { type: "py-generadores", level },
  };
}

// ---------------------------------------------------------------- Valores perdidos

function nulos(rng: Rng, level: PyExamLevel): PyExamShort {
  const shown = sensors(dataSeed(rng), { rows: 16, sensors: 4 });
  const others = [12, 20, 26].map((rows, i) => sensors(dataSeed(rng), { rows, sensors: 3 + i }));
  const head = "`sensores.csv` tiene una fila por hora (columna `hora`) y una columna por sensor (`s1`, `s2`…), con valores perdidos (NaN).";
  const read = (d: { file: string }) => `sensores = pd.read_csv("${d.file}")`;
  const f = shown.facts;
  const cols = ["hora", ...f.columns.filter((c) => f.kept.includes(c))];
  const caseOf = (d: (typeof others)[number], fn: string, checks: PyCheck[]): PyCase => ({ code: `${HEAD_PD}${read(d)}\n${fn}(sensores, ${d.facts.k})`, files: { [d.file]: d.csv }, checks });
  if (level === "medio") {
    const fn = "quitar_columnas";
    const left = f.kept.reduce((s, c) => s + f.nanPerColumn[c]!, 0);
    return {
      family: "nulos",
      title: "Valores perdidos: quitar columnas",
      statement: [head, `Escribe \`${fn}(df, k)\`, que devuelva la tabla sin las columnas que tienen más de \`k\` NaN (las que tienen exactamente \`k\` se quedan). No cambies nada más.`, NOTE_TESTS],
      starter: starter(HEAD_PD.trimEnd(), fn, "df, k"),
      test: [
        "import pandas as pd",
        read(shown),
        `r = ${fn}(sensores, ${f.k})`,
        `assert list(r.columns) == ${lit(cols)}`,
        `assert r.shape == ${lit(tup(f.rows, cols.length))}`,
        `assert int(r.isna().sum().sum()) == ${left}`,
      ].join("\n"),
      files: { [shown.file]: shown.csv },
      check: hidden({
        tema: 12, template: "pyexam-nulos", title: "Quitar columnas con NaN", statement: [], fn, starter: "",
        solution: `${HEAD_PD}\n\ndef ${fn}(df, k):\n    return df.dropna(axis=1, thresh=len(df) - k)\n`,
        cases: others.map((d) => caseOf(d, fn, [check("columnas", "Quedan las columnas con k NaN o menos")])),
        packages: PANDAS, seconds: DATA_SECONDS,
      }),
      practice: { type: "py-pandas-nulos", level },
    };
  }
  const fn = "rellenar";
  return {
    family: "nulos",
    title: "Valores perdidos: interpolar y rellenar los extremos",
    statement: [
      head,
      `Escribe \`${fn}(df, k)\`: quita las columnas con más de \`k\` NaN; después rellena los huecos de las demás interpolando linealmente entre los valores vecinos y, los que queden al principio o al final de una columna, con el valor conocido más cercano. No debe quedar ningún NaN.`,
      NOTE_TESTS,
    ],
    starter: starter(HEAD_PD.trimEnd(), fn, "df, k"),
    test: [
      "import pandas as pd",
      read(shown),
      `r = ${fn}(sensores, ${f.k})`,
      `assert list(r.columns) == ${lit(cols)}`,
      `assert r.shape == ${lit(tup(f.rows, cols.length))}`,
      "assert int(r.isna().sum().sum()) == 0",
    ].join("\n"),
    files: { [shown.file]: shown.csv },
    check: hidden({
      tema: 12, template: "pyexam-nulos", title: "Interpolar y rellenar", statement: [], fn, starter: "",
      solution: `${HEAD_PD}\n\ndef ${fn}(df, k):\n    df = df.dropna(axis=1, thresh=len(df) - k)\n    return df.interpolate().bfill().ffill()\n`,
      cases: others.map((d) => caseOf(d, fn, [check("columnas", "Quedan las columnas con k NaN o menos"), check("sin-nulos", "No queda ningún NaN")])),
      packages: PANDAS, seconds: DATA_SECONDS,
    }),
    practice: { type: "py-pandas-nulos", level },
  };
}

// ---------------------------------------------------------------- Cadenas a una tabla

function parsear(rng: Rng, level: PyExamLevel): PyExamShort {
  const hyphen = level === "avanzado";
  const shown = movieList(dataSeed(rng), 6, hyphen);
  const lists = [8, 5, 10].map((n) => movieList(dataSeed(rng), n, hyphen).items);
  const fn = "a_tabla";
  const cols = hyphen ? ["titulo", "anio", "decada"] : ["titulo", "anio"];
  const p = shown.facts.parsed;
  const j = hyphen ? Math.max(0, p.findIndex((x) => x.titulo.includes(" - "))) : p.length - 1;
  const solution = hyphen
    ? py`
        import pandas as pd


        def a_tabla(textos):
            partes = [t.rsplit(" - ", 1) for t in textos]
            df = pd.DataFrame(partes, columns=["titulo", "anio"])
            df["anio"] = df["anio"].astype(int)
            df["decada"] = df["anio"] // 10 * 10
            return df
      `
    : py`
        import pandas as pd


        def a_tabla(textos):
            partes = [t.rsplit(" - ", 1) for t in textos]
            df = pd.DataFrame(partes, columns=["titulo", "anio"])
            df["anio"] = df["anio"].astype(int)
            return df
      `;
  return {
    family: "parsear",
    title: hyphen ? "Cadenas a una tabla (con guiones en el título)" : "Cadenas a una tabla",
    statement: [
      "Cada texto tiene la forma `\"Título - Año\"`. Escribe `a_tabla(textos)`, que reciba una lista de esos textos y devuelva un DataFrame con una fila por texto (en el mismo orden) y las columnas `titulo` (texto) y `anio` (entero).",
      ...(hyphen
        ? ["Ojo: algunos títulos llevan « - » dentro; el año es siempre lo que va detrás del último. Añade también la columna `decada` (entero: 1987 → 1980)."]
        : []),
      NOTE_TESTS,
    ],
    starter: starter("import pandas as pd", fn, "textos"),
    test: [
      `TEXTOS = ${lit(shown.items)}`,
      `t = ${fn}(TEXTOS)`,
      `assert list(t.columns) == ${lit(cols)}`,
      `assert t.shape == ${lit(tup(p.length, cols.length))}`,
      `assert t["anio"].dtype.kind == "i"`,
      `assert t.loc[${j}, "titulo"] == ${lit(p[j]!.titulo)}`,
      `assert t.loc[0, "anio"] == ${p[0]!.anio}`,
    ].join("\n"),
    files: {},
    check: hidden({
      tema: 9, template: "pyexam-parsear", title: "Cadenas a una tabla", statement: [], fn, starter: "", solution,
      cases: lists.map((l) => ({ code: `import pandas as pd\n${call(fn, l)}`, options: { dtypes: true }, checks: [check("columnas", "Las columnas que pide el enunciado"), check("tipos", "anio es de enteros")] })),
      packages: PANDAS, seconds: DATA_SECONDS,
    }),
    practice: { type: "py-pandas-fechas", level },
  };
}

// ---------------------------------------------------------------- NumPy: matrices y máscaras

function numpy(rng: Rng, level: PyExamLevel): PyExamShort {
  if (level === "medio") {
    const fn = "medias_arriba";
    const m = matrix(rng, 4, 4, -5, 20);
    const means = m[0]!.map((_, j) => Math.ceil(m.reduce((s, r) => s + r[j]!, 0) / m.length));
    return {
      family: "numpy",
      title: "NumPy: medias por columna redondeadas hacia arriba",
      statement: [
        `Escribe \`${fn}(m)\`, que reciba una matriz de NumPy y devuelva un array de enteros con la media de cada columna redondeada hacia arriba (3,2 → 4; −1,5 → −1).`,
        "Sin bucles: con operaciones de NumPy.",
        NOTE_TESTS,
      ],
      starter: starter("import numpy as np", fn, "m"),
      test: ["import numpy as np", `M = ${npArray(m)}`, `r = ${fn}(M)`, `assert r.tolist() == ${lit(means)}`, `assert r.dtype.kind == "i"`].join("\n"),
      files: {},
      check: hidden({
        tema: 8, template: "pyexam-numpy", title: "Medias redondeadas hacia arriba", statement: [], fn, starter: "",
        solution: `${HEAD_NP}\n\ndef ${fn}(m):\n    return np.ceil(m.mean(axis=0)).astype(int)\n`,
        cases: [matrix(rng, 3, 5, -9, 9), matrix(rng, 5, 2, 0, 30), matrix(rng, 1, 3, -4, 4), [[1, 2], [2, 3]]].map((x) => ({ code: `${HEAD_NP}${fn}(${npArray(x)})`, options: { dtypes: true } })),
        rules: [SIN_FOR], packages: NUMPY, seconds: DATA_SECONDS,
      }),
      practice: { type: "py-numpy-mascaras", level },
    };
  }
  const fn = "quitar_multiplos";
  const k = rng.int(3, 5);
  // Una matriz en la que queda al menos una columna (sin múltiplos positivos de k).
  let m = matrix(rng, 4, 5, -6, 14);
  const bad = (x: number) => x > 0 && x % k === 0;
  for (let i = 0; i < 50 && m[0]!.every((_, j) => m.some((r) => bad(r[j]!))); i++) m = matrix(rng, 4, 5, -6, 14);
  const keep = m[0]!.map((_, j) => !m.some((r) => bad(r[j]!)));
  const kept = keep.filter(Boolean).length;
  return {
    family: "numpy",
    title: "NumPy: máscaras con NaN y quitar columnas",
    statement: [
      `Escribe \`${fn}(m, k)\`, que, sin cambiar \`m\` y sin bucles: 1) haga una copia de reales de la matriz; 2) ponga \`np.nan\` en los múltiplos de \`k\` estrictamente positivos; 3) quite las columnas que tengan algún NaN. Devuelve la matriz que queda.`,
      NOTE_TESTS,
    ],
    starter: starter("import numpy as np", fn, "m, k"),
    test: [
      "import numpy as np",
      `M = ${npArray(m)}`,
      `r = ${fn}(M, ${k})`,
      `assert r.shape == ${lit(tup(m.length, kept))}`,
      "assert not np.isnan(r).any()",
      `assert M.dtype.kind == "i"`,
    ].join("\n"),
    files: {},
    check: hidden({
      tema: 8, template: "pyexam-numpy", title: "Máscaras y columnas", statement: [], fn, starter: "",
      solution: `${HEAD_NP}\n\ndef ${fn}(m, k):\n    r = m.astype(float)\n    r[(r > 0) & (r % k == 0)] = np.nan\n    return r[:, ~np.isnan(r).any(axis=0)]\n`,
      cases: [
        ...[matrix(rng, 3, 6, -9, 20), matrix(rng, 5, 3, 0, 12), matrix(rng, 2, 4, -3, 3)].map((x) => ({ code: `${HEAD_NP}${fn}(${npArray(x)}, ${k})`, checks: [check("forma", "Quedan las columnas sin múltiplos")] })),
        // La original no cambia.
        { code: `${HEAD_NP}m = ${npArray(m)}\n${fn}(m, ${k})\nm` },
      ],
      rules: [SIN_FOR], packages: NUMPY, seconds: DATA_SECONDS,
    }),
    practice: { type: "py-numpy-mascaras", level },
  };
}

// ---------------------------------------------------------------- Sistemas lineales

function det(m: number[][]): number {
  if (m.length === 1) return m[0]![0]!;
  return m[0]!.reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(m.slice(1).map((r) => r.filter((_, c) => c !== j))), 0);
}
const mul = (a: number[][], x: number[]) => a.map((r) => r.reduce((s, v, j) => s + v * x[j]!, 0));

function system(rng: Rng, n: number) {
  let a = matrix(rng, n, n, -5, 5);
  while (det(a) === 0) a = matrix(rng, n, n, -5, 5);
  const x = ints(rng, n, -6, 6);
  return { a, x, b: mul(a, x) };
}

function singular(rng: Rng, n: number) {
  const a = matrix(rng, n - 1, n, -4, 4);
  const f = rng.int(-2, 2) || 1;
  return { a: [...a, a[0]!.map((v, j) => v * f + (n > 2 ? a[1]![j]! : 0))], b: ints(rng, n, -9, 9) };
}

function sistemas(rng: Rng, level: PyExamLevel): PyExamShort {
  const s = system(rng, 3);
  const given = ["import numpy as np", `A = ${npArray(s.a)}`, `b = np.array(${lit(s.b)})`];
  if (level === "medio") {
    const fn = "resolver";
    return {
      family: "sistemas",
      title: "Sistema lineal con NumPy",
      statement: [
        `Escribe \`${fn}(A, b)\`, que devuelva la solución \`x\` del sistema \`A x = b\` (con \`A\` cuadrada e invertible) usando \`np.linalg.solve\`. Antes de devolverla, comprueba con \`np.allclose\` que \`A @ x\` reproduce \`b\` (si no, lanza un \`ValueError\`).`,
        NOTE_TESTS,
      ],
      starter: starter("import numpy as np", fn, "A, b"),
      test: [...given, `x = ${fn}(A, b)`, "assert np.allclose(A @ x, b)", `assert np.allclose(x, ${lit(s.x)})`].join("\n"),
      files: {},
      check: hidden({
        tema: 8, template: "pyexam-sistemas", title: "Sistema lineal", statement: [], fn, starter: "",
        solution: `${HEAD_NP}\n\ndef ${fn}(A, b):\n    x = np.linalg.solve(A, b)\n    if not np.allclose(A @ x, b):\n        raise ValueError("no es solución")\n    return x\n`,
        cases: [2, 3, 4, 4].map((n) => {
          const t = system(rng, n);
          return { code: `${HEAD_NP}${fn}(${npArray(t.a)}, np.array(${lit(t.b)}))` };
        }),
        rules: [
          { kind: "usa", what: "llamada:solve", label: "Usa np.linalg.solve" },
          { kind: "usa", what: "llamada:allclose", label: "Comprueba la solución con np.allclose" },
        ],
        packages: NUMPY, seconds: DATA_SECONDS,
      }),
      practice: { type: "py-numpy-sistemas", level },
    };
  }
  const fn = "resolver_o_nada";
  const z = singular(rng, 3);
  return {
    family: "sistemas",
    title: "Sistemas sin solución única",
    statement: [
      `Escribe \`${fn}(A, b)\`: si la matriz cuadrada \`A\` es invertible (su rango es el número de filas), devuelve la solución de \`A x = b\` redondeada a 6 decimales, después de comprobar con \`np.allclose\` que reproduce \`b\`; si no lo es, devuelve \`None\`.`,
      NOTE_TESTS,
    ],
    starter: starter("import numpy as np", fn, "A, b"),
    test: [...given, `assert ${fn}(A, b).tolist() == ${lit(s.x)}`, `S = ${npArray(z.a)}`, `assert ${fn}(S, np.array(${lit(z.b)})) is None`].join("\n"),
    files: {},
    check: hidden({
      tema: 8, template: "pyexam-sistemas", title: "Sistemas sin solución única", statement: [], fn, starter: "",
      solution: py`
        import numpy as np


        def resolver_o_nada(A, b):
            if np.linalg.matrix_rank(A) < A.shape[0]:
                return None
            x = np.linalg.solve(A, b)
            if not np.allclose(A @ x, b):
                return None
            return np.round(x, 6)
      `,
      // Con det = 3 la solución tiene infinitos decimales: sin el redondeo a 6 no pasa (tolerancia 1e-9).
      cases: [...[2, 3, 3, 4].map((n, i) => (i % 2 === 1 ? singular(rng, n) : system(rng, n))), { a: [[2, 1], [1, 2]], b: [rng.pick([1, 2, 4, 5]), 0] }].map((t) => ({
        code: `${HEAD_NP}${fn}(${npArray(t.a)}, np.array(${lit(t.b)}))`,
        options: { tolerance: 1e-9 },
      })),
      rules: [{ kind: "usa", what: "llamada:allclose", label: "Comprueba la solución con np.allclose" }],
      packages: NUMPY, seconds: DATA_SECONDS,
    }),
    practice: { type: "py-numpy-sistemas", level },
  };
}

// ---------------------------------------------------------------- Registro

export const PYEXAM_SHORT_MAKERS: Record<PyExamFamily, (rng: Rng, level: PyExamLevel) => PyExamShort> = {
  bug,
  "una-linea": unaLinea,
  algoritmo,
  generador,
  nulos,
  parsear,
  numpy,
  sistemas,
};

/** Grupos para que los cuatro ejercicios cortos no salgan todos del mismo tipo. */
export const PYEXAM_FAMILY_GROUPS: Record<"python" | "datos" | "numpy", readonly PyExamFamily[]> = {
  python: ["bug", "una-linea", "algoritmo"],
  datos: ["generador", "nulos", "parsear"],
  numpy: ["numpy", "sistemas"],
};

/** Las de nivel básico no van al examen; con un nivel, la familia da su variante. */
export const PYEXAM_LEVELS: readonly PyExamLevel[] = ["medio", "avanzado"];
