// Ejercicios de Python de 01MIAR, temas 6 a 13 (y dos tipos de examen de los temas 3 y 4): clases,
// Python avanzado, NumPy, pandas, gráficos y generadores, con el formato de las preguntas cortas del
// examen («Encuentra el bug», «En una línea», «Generadores»…) y los pasos del proyecto de datos
// (valores perdidos, limpiar y convertir, agrupar y pivotar, fechas y cadenas, combinar y gráficos con
// requisitos). Igual que python.ts: con semilla y nivel, enunciado, código inicial, casos, pistas sin
// código y una solución de referencia que solo se enseña detrás de «Ver la solución completa».
//
// Los datos salen de shared/pydata (sintéticos y deterministas) y se escriben en la carpeta de cada
// caso (ejercicio/caso<k>/ventas.csv…). Las tablas y los arrays se comparan con tolerancia, los
// generadores por lo que producen y los gráficos con la inspección de figuras del banco de pruebas
// (harness-data.ts): número de gráficos, figsize, tipo, barras y sus alturas (estimator="sum"),
// puntos, líneas, leyenda (hue), títulos y nombres de los ejes.
// Contenido original: ningún enunciado ni dato procede de los cuadernos de la asignatura ni del examen.
import { dirtySales, grades, incidents, movieList, sensors, type SalesDataset } from "../pydata/index.ts";
import type { Rng } from "./random.ts";
import {
  call,
  ints,
  lit,
  names,
  py,
  starterOf,
  type PyCase,
  type PyCheck,
  type PyCheckKind,
  type PyCodeInstance,
  type PyCompareOptions,
  type PyRule,
  type PyVal,
  type Tpl,
} from "./python-common.ts";

// ---------------------------------------------------------------- Utilidades

const PANDAS = ["numpy", "pandas"];
const NUMPY = ["numpy"];
const PLOTS = ["numpy", "pandas", "matplotlib.pyplot", "seaborn"];
const HEAD_PD = "import numpy as np\nimport pandas as pd\n";
const HEAD_NP = "import numpy as np\n";
const HEAD_PLT = "import matplotlib.pyplot as plt\nimport pandas as pd\nimport seaborn as sns\n";
/** Segundos por caso con pandas o con gráficos (Pyodide es más lento que Python nativo). */
const DATA_SECONDS = 6;
const PLOT_SECONDS = 10;

/** Código inicial con los import y la cabecera de la función. */
const starterWith = (head: string, fn: string, params: string) => `${head}\n\n${starterOf(fn, params)}`;
/** Semilla de un conjunto de datos a partir del generador del ejercicio. */
const dataSeed = (rng: Rng) => rng.int(0, 0x7fffffff);
const check = (kind: PyCheckKind, label: string, axes?: number): PyCheck => (axes === undefined ? { kind, label } : { kind, label, axes });
const firma = (fn: string, params: string): PyRule => ({ kind: "usa", what: `firma:${fn}:${params.replace(/\s/g, "")}`, label: `Conserva el nombre y los parámetros: ${fn}(${params})` });
const generador = (fn: string): PyRule => ({ kind: "usa", what: `generador:${fn}`, label: `${fn} es una función generadora (usa yield)` });
const enUnaLinea = (fn: string): PyRule => ({ kind: "usa", what: `una-linea:${fn}`, label: `El cuerpo de ${fn} es un solo return con una comprensión, en una línea` });
const usaModulo = (m: string, label: string): PyRule => ({ kind: "usa", what: `modulo:${m}`, label });

/**
 * Un iterable infinito escrito en Python (no itertools.count): si el código lo convierte en lista, la
 * vigilancia del tiempo lo para a los pocos segundos (un bucle en C no se podría parar).
 */
const NATURALES = "def naturales(desde):\n    n = desde\n    while True:\n        yield n\n        n += 1\n\n";

const GEN_CHECKS = [check("generador", "Devuelve un generador"), check("perezoso", "No hace nada hasta que se le piden valores")];

/** Caso de pandas: lee los archivos y llama a la función (con los import a la vista, como en el cuaderno). */
function dataCase(files: Record<string, string>, setup: string, callCode: string, extra: Partial<PyCase> = {}): PyCase {
  return { code: `${HEAD_PD}${setup}${setup ? "\n" : ""}${callCode}`, files, ...extra };
}

// ---------------------------------------------------------------- Tema 4: «Encuentra el bug»

type Bug = { fn: string; params: string; title: string; what: string; buggy: string; fixed: string; asserts: string[]; cases: PyCase[]; hints: string[] };

function bugBasic(rng: Rng): Bug {
  if (rng.chance(0.5)) {
    const xs = ints(rng, 6, 0, 20);
    const u = xs[rng.int(0, 5)]!;
    return {
      fn: "contar_mayores", params: "numeros, umbral", title: "Encuentra el bug: contar los mayores",
      what: "debería devolver cuántos números de la lista son estrictamente mayores que `umbral`",
      buggy: py`
        def contar_mayores(numeros, umbral):
            cuenta = 0
            for n in numeros:
                if n >= umbral:
                    cuenta += 1
            return cuenta
      `,
      fixed: py`
        def contar_mayores(numeros, umbral):
            cuenta = 0
            for n in numeros:
                if n > umbral:
                    cuenta += 1
            return cuenta
      `,
      asserts: ["assert contar_mayores([3, 5, 5, 8], 5) == 1", "assert contar_mayores([], 0) == 0"],
      cases: [{ code: call("contar_mayores", xs, u) }, { code: call("contar_mayores", ints(rng, 5, -5, 5), 0) }, { code: call("contar_mayores", [u, u, u], u) }],
      hints: ["Prueba la función a mano con el primer assert: ¿qué número cuenta de más?", "«Estrictamente mayor» no incluye el caso de igualdad.", "El fallo está en la comparación del if."],
    };
  }
  const xs = ints(rng, rng.int(4, 7), -9, 30);
  xs[xs.length - 1] = Math.max(...xs) + rng.int(1, 9);
  return {
    fn: "posicion_maximo", params: "lista", title: "Encuentra el bug: la posición del máximo",
    what: "debería devolver la posición (el índice) del mayor elemento de una lista no vacía; si se repite, la primera",
    buggy: py`
      def posicion_maximo(lista):
          mejor = 0
          for i in range(1, len(lista) - 1):
              if lista[i] > lista[mejor]:
                  mejor = i
          return mejor
    `,
    fixed: py`
      def posicion_maximo(lista):
          mejor = 0
          for i in range(1, len(lista)):
              if lista[i] > lista[mejor]:
                  mejor = i
          return mejor
    `,
    asserts: ["assert posicion_maximo([4, 9, 2]) == 1", "assert posicion_maximo([1, 2, 7]) == 2"],
    cases: [{ code: call("posicion_maximo", xs) }, { code: call("posicion_maximo", [rng.int(0, 9)]) }, { code: call("posicion_maximo", ints(rng, 6, 0, 9)) }],
    hints: ["Mira el segundo assert: ¿en qué posición está el máximo?", "Repasa qué valores toma i en el range.", "range(a, b) no incluye b."],
  };
}

function bugMedium(rng: Rng): Bug {
  if (rng.chance(0.5)) {
    const [a, b, c] = ints(rng, 3, 1, 99);
    return {
      fn: "anotar", params: "elemento, lista=None", title: "Encuentra el bug: la lista que se acuerda",
      what: "debería devolver una lista con `elemento` añadido al final de `lista` (o de una lista vacía si no se pasa ninguna). Pero las llamadas sin lista se acuerdan de las anteriores",
      buggy: py`
        def anotar(elemento, lista=[]):
            lista.append(elemento)
            return lista
      `,
      fixed: py`
        def anotar(elemento, lista=None):
            if lista is None:
                lista = []
            lista.append(elemento)
            return lista
      `,
      asserts: ["assert anotar(1) == [1]", "assert anotar(2) == [2]"],
      cases: [{ code: `(anotar(${a}), anotar(${b}))` }, { code: `(anotar(${c}, [0]), anotar(${a}))` }, { code: `[anotar(x) for x in ${lit([a, b, c])}]` }],
      hints: ["Llama dos veces a la función sin pasar lista y mira qué devuelve la segunda.", "El valor por defecto de un parámetro se crea una sola vez, al definir la función.", "Usa un valor por defecto que no se pueda modificar y crea la lista dentro."],
    };
  }
  const xs = () => Array.from({ length: rng.int(5, 8) }, () => rng.int(-9, 9));
  const consecutive = [rng.int(1, 9), -rng.int(1, 9), -rng.int(1, 9), rng.int(1, 9), -rng.int(1, 9)];
  return {
    fn: "quitar_negativos", params: "numeros", title: "Encuentra el bug: quitar los negativos",
    what: "debería devolver una lista nueva sin los números negativos, sin modificar la original. Falla con negativos seguidos y, además, estropea la lista que recibe",
    buggy: py`
      def quitar_negativos(numeros):
          for n in numeros:
              if n < 0:
                  numeros.remove(n)
          return numeros
    `,
    fixed: py`
      def quitar_negativos(numeros):
          resultado = []
          for n in numeros:
              if n >= 0:
                  resultado.append(n)
          return resultado
    `,
    asserts: ["assert quitar_negativos([1, -2, -3, 4]) == [1, 4]"],
    cases: [consecutive, xs(), xs()].map((l) => ({ code: `datos = ${lit(l)}\nr = quitar_negativos(datos)\n(r, datos)` })),
    hints: ["Sigue el bucle a mano con el assert: ¿qué pasa con el elemento que va detrás de uno que se borra?", "Borrar de una lista mientras se recorre desplaza los elementos que quedan.", "Construye una lista nueva en vez de tocar la que recibes."],
  };
}

function bugAdvanced(rng: Rng): Bug {
  if (rng.chance(0.5)) {
    const n = rng.int(3, 6);
    const x = rng.int(10, 50);
    return {
      fn: "crear_sumadores", params: "n", title: "Encuentra el bug: funciones que suman",
      what: "debería devolver una lista de `n` funciones en la que la de posición `i` suma `i` a su argumento. Pero todas suman lo mismo",
      buggy: py`
        def crear_sumadores(n):
            sumadores = []
            for i in range(n):
                sumadores.append(lambda x: x + i)
            return sumadores
      `,
      fixed: py`
        def crear_sumadores(n):
            sumadores = []
            for i in range(n):
                sumadores.append(lambda x, i=i: x + i)
            return sumadores
      `,
      asserts: ["assert [f(10) for f in crear_sumadores(3)] == [10, 11, 12]"],
      cases: [{ code: `[f(${x}) for f in crear_sumadores(${n})]` }, { code: `[f(0) for f in crear_sumadores(1)]` }, { code: `crear_sumadores(${n})[1](${x})` }],
      hints: ["Llama a la primera función de la lista: ¿cuánto suma?", "La lambda no guarda el valor de i cuando se crea: lo busca cuando se llama, y para entonces el bucle ya terminó.", "Haz que cada función tenga su propia copia de i en el momento de crearla."],
    };
  }
  const items = names(rng, 3);
  const prices = Object.fromEntries(items.map((it) => [it.toLowerCase(), rng.int(100, 2000) / 100]));
  const pct = rng.pick([10, 15, 20, 25]);
  return {
    fn: "aplicar_descuento", params: "precios, pct", title: "Encuentra el bug: precios con descuento",
    what: `debería devolver un diccionario nuevo con cada precio rebajado un \`pct\` % y redondeado a dos decimales, sin cambiar el diccionario original. Pero el original cambia`,
    buggy: py`
      def aplicar_descuento(precios, pct):
          nuevos = precios
          for producto in nuevos:
              nuevos[producto] = round(nuevos[producto] * (1 - pct / 100), 2)
          return nuevos
    `,
    fixed: py`
      def aplicar_descuento(precios, pct):
          nuevos = {}
          for producto, precio in precios.items():
              nuevos[producto] = round(precio * (1 - pct / 100), 2)
          return nuevos
    `,
    asserts: ["p = {'pan': 2.0}", "assert aplicar_descuento(p, 50) == {'pan': 1.0}", "assert p == {'pan': 2.0}"],
    cases: [
      { code: `precios = ${lit(prices)}\nr = aplicar_descuento(precios, ${pct})\n(r, precios)` },
      { code: `precios = {}\n(aplicar_descuento(precios, ${pct}), precios)` },
      { code: `precios = ${lit(Object.fromEntries(Object.entries(prices).slice(0, 2)))}\n(aplicar_descuento(precios, 100), precios)` },
    ],
    hints: ["Comprueba el diccionario original después de llamar a la función.", "Asignar un diccionario a otra variable no lo copia: los dos nombres son el mismo objeto.", "Construye un diccionario nuevo (o copia el original antes de cambiarlo)."],
  };
}

const BUG: Tpl = {
  id: "bug",
  tema: 4,
  make(rng, level) {
    const b = level === "básico" ? bugBasic(rng) : level === "medio" ? bugMedium(rng) : bugAdvanced(rng);
    // Los assert del enunciado van primero, como en la celda «Test» del cuaderno.
    const given: PyCase = { code: b.asserts.join("\n") };
    return {
      kind: "code", tema: 4, template: "bug", title: b.title,
      statement: [
        `La función \`${b.fn}\` ${b.what}. Encuentra el error y corrígelo sin cambiar el nombre de la función ni sus parámetros.`,
        `Pruebas del enunciado (el caso 1): ${b.asserts.map((a) => `\`${a}\``).join(" · ")}. Los demás casos usan otros datos.`,
      ],
      fn: b.fn, starter: b.buggy, cases: [given, ...b.cases], hints: b.hints, solution: b.fixed,
      rules: [firma(b.fn, b.params.replace(/=None/, ""))],
    };
  },
};

// ---------------------------------------------------------------- Tema 3: «En una línea»

const UNA_LINEA: Tpl = {
  id: "una-linea",
  tema: 3,
  make(rng, level) {
    const tail = (fn: string, params: string, long: string) => `${long}\n\n${starterOf(fn, params, "Una sola línea: return y una comprensión")}`;
    if (level === "básico") {
      const k = rng.int(2, 5);
      const [expr, desc] = rng.pick<[string, string]>([["n * n", "su cuadrado"], [`n // ${k}`, `n // ${k}`], ["-n", "su opuesto"], ["n + 1", "el siguiente"]]);
      const long = py`
        def transformar_larga(numeros):
            resultado = []
            for n in numeros:
                if n % ${k} == 0:
                    resultado.append(${expr})
            return resultado
      `;
      return {
        kind: "code", tema: 3, template: "una-linea", title: "En una línea: filtrar y transformar",
        statement: [
          `\`transformar_larga\` recorre una lista y, de cada múltiplo de ${k}, se queda con ${desc}. Escribe \`transformar(numeros)\`, que haga lo mismo con una sola línea: un \`return\` con una comprensión de lista.`,
        ],
        fn: "transformar", starter: tail("transformar", "numeros", long),
        cases: [ints(rng, 8, -10, 30), [], ints(rng, 5, 0, 12), [k, 2 * k, 1]].map((l) => ({ code: call("transformar", l) })),
        rules: [enUnaLinea("transformar")],
        hints: ["Una comprensión tiene tres partes: lo que se añade, el for y, al final, el if que filtra.", "Lo que va dentro del append es lo primero que se escribe en la comprensión.", "No llames a transformar_larga: la comprobación mira el cuerpo de tu función."],
        solution: `${long}\n\ndef transformar(numeros):\n    return [${expr} for n in numeros if n % ${k} == 0]\n`,
      };
    }
    if (level === "medio") {
      const t = rng.int(-3, 3);
      const [si, no] = rng.pick<[string, string]>([["par", "impar"], ["P", "I"], ["sí", "no"]]);
      const long = py`
        def etiquetas_larga(numeros):
            resultado = []
            for n in numeros:
                if n > ${t}:
                    if n % 2 == 0:
                        resultado.append("${si}")
                    else:
                        resultado.append("${no}")
            return resultado
      `;
      return {
        kind: "code", tema: 3, template: "una-linea", title: "En una línea: if anidados",
        statement: [
          `\`etiquetas_larga\` tiene dos if anidados. Escribe \`etiquetas(numeros)\`, que devuelva lo mismo con una sola línea: un \`return\` con una comprensión de lista.`,
          "Pista de forma: el if que decide qué se añade y el if que filtra van en sitios distintos de la comprensión.",
        ],
        fn: "etiquetas", starter: tail("etiquetas", "numeros", long),
        cases: [ints(rng, 8, -8, 12), [], [t, t + 1, t + 2], ints(rng, 6, -3, 6)].map((l) => ({ code: call("etiquetas", l) })),
        rules: [enUnaLinea("etiquetas")],
        hints: ["El if exterior solo filtra: va al final de la comprensión.", "El if interior elige entre dos valores: eso es una expresión condicional (valor si condición, si no otro valor).", "La expresión condicional va al principio, antes del for."],
        solution: `${long}\n\ndef etiquetas(numeros):\n    return ["${si}" if n % 2 == 0 else "${no}" for n in numeros if n > ${t}]\n`,
      };
    }
    if (rng.chance(0.5)) {
      const min = rng.pick([5, 6]);
      const long = py`
        def aprobados_larga(notas):
            resultado = {}
            for nombre, lista in notas.items():
                if len(lista) > 0:
                    media = sum(lista) / len(lista)
                    if media >= ${min}:
                        resultado[nombre] = round(media, 1)
            return resultado
      `;
      const ns = names(rng, 5);
      const data = () => Object.fromEntries(ns.slice(0, rng.int(2, 5)).map((n) => [n, ints(rng, rng.int(0, 4), 0, 10)]));
      return {
        kind: "code", tema: 3, template: "una-linea", title: "En una línea: diccionario de medias",
        statement: [
          `\`aprobados_larga\` recibe un diccionario de nombre a lista de notas y devuelve la media (redondeada a un decimal) de quienes tienen alguna nota y media de ${min} o más. Escribe \`aprobados(notas)\` con una sola línea: un \`return\` con una comprensión de diccionario.`,
        ],
        fn: "aprobados", starter: tail("aprobados", "notas", long),
        // [min, min + 1, min + 1] tiene media min + 2/3: sin redondear no pasa.
        cases: [data(), data(), {}, { [ns[0]!]: [], [ns[1]!]: [min, min], [ns[2]!]: [min, min + 1, min + 1] }].map((d) => ({ code: call("aprobados", d) })),
        rules: [enUnaLinea("aprobados")],
        hints: ["Recorre notas.items() en la comprensión: dos variables a la vez.", "Las dos condiciones se pueden unir con and en un solo if; and no evalúa la segunda si la primera es falsa (así no divides entre cero).", "La media se calcula dos veces (en el if y en el valor): en una línea no hay sitio para una variable."],
        solution: `${long}\n\ndef aprobados(notas):\n    return {n: round(sum(l) / len(l), 1) for n, l in notas.items() if len(l) > 0 and sum(l) / len(l) >= ${min}}\n`,
      };
    }
    const long = py`
      def parejas_larga(xs, ys):
          resultado = []
          for a in xs:
              for b in ys:
                  if a < b:
                      if (a + b) % 2 == 1:
                          resultado.append((a, b))
          return resultado
    `;
    return {
      kind: "code", tema: 3, template: "una-linea", title: "En una línea: dos bucles",
      statement: ["`parejas_larga` recorre dos listas con dos bucles anidados y dos if. Escribe `parejas(xs, ys)`, que devuelva la misma lista de tuplas con una sola línea: un `return` con una comprensión."],
      fn: "parejas", starter: tail("parejas", "xs, ys", long),
      cases: [[ints(rng, 4, 0, 9), ints(rng, 4, 0, 9)], [[], [1]], [ints(rng, 3, -5, 5), ints(rng, 5, -5, 5)]].map((a) => ({ code: call("parejas", ...a) })),
      rules: [enUnaLinea("parejas")],
      hints: ["Una comprensión admite varios for seguidos, en el mismo orden que los bucles.", "Varios if seguidos dentro de una comprensión equivalen a unirlos con and.", "Lo que se añade es la tupla (a, b)."],
      solution: `${long}\n\ndef parejas(xs, ys):\n    return [(a, b) for a in xs for b in ys if a < b if (a + b) % 2 == 1]\n`,
    };
  },
};

// ---------------------------------------------------------------- Tema 13: «Generadores»

const GENERADORES: Tpl = {
  id: "generadores",
  tema: 13,
  make(rng, level) {
    if (level === "básico") {
      const k = rng.int(2, 9);
      const ns = [0, 1, rng.int(3, 8), rng.int(10, 20)];
      return {
        kind: "code", tema: 13, template: "generadores", title: "Generador de múltiplos",
        statement: [`Escribe la función generadora \`multiplos(n)\` que produzca, uno a uno, los \`n\` primeros múltiplos positivos de ${k} (${k}, ${2 * k}, ${3 * k}…). Usa \`yield\`: no construyas ninguna lista.`],
        fn: "multiplos", starter: starterOf("multiplos", "n"),
        cases: [...ns.map((n) => ({ code: call("multiplos", n), checks: GEN_CHECKS })), { code: `g = multiplos(${rng.int(3, 9)})\n(next(g), next(g))` }],
        rules: [generador("multiplos")],
        hints: ["Una función con yield no devuelve una lista: devuelve un generador que va dando valores cuando se le piden.", "Un for con range da las vueltas; en cada una, yield entrega un valor.", "next(g) pide al generador el siguiente valor: el último caso pide solo dos."],
        solution: `def multiplos(n):\n    for i in range(1, n + 1):\n        yield ${k} * i\n`,
      };
    }
    if (level === "medio") {
      const col = rng.pick(["parcial", "final", "practicas"]);
      const cases = [8, 12, 15].map((n) => {
        const g = grades(dataSeed(rng), n);
        return dataCase({ [g.file]: g.csv }, `df = pd.read_csv("${g.file}")`, `por_${col}(df)`, { checks: GEN_CHECKS });
      });
      return {
        kind: "code", tema: 13, template: "generadores", title: "Generador sobre las filas de una tabla",
        statement: [
          `\`notas.csv\` tiene las columnas \`nombre, grupo, parcial, final, practicas\`. Escribe la función generadora \`por_${col}(df)\` que recorra las filas del DataFrame ordenadas de mayor a menor \`${col}\` (y, si empatan, por \`nombre\` en orden alfabético) y produzca para cada una la tupla \`(nombre, ${col})\`.`,
        ],
        fn: `por_${col}`, starter: starterWith(HEAD_PD, `por_${col}`, "df"), cases, rules: [generador(`por_${col}`)], packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["Primero ordena la tabla; sort_values acepta varias columnas y un ascending para cada una.", "itertuples() o iterrows() recorren las filas de un DataFrame.", "En cada vuelta, yield con la tupla de los dos valores."],
        solution: py`
          import numpy as np
          import pandas as pd


          def por_${col}(df):
              ordenado = df.sort_values(["${col}", "nombre"], ascending=[False, True])
              for fila in ordenado.itertuples():
                  yield (fila.nombre, fila.${col})
        `,
      };
    }
    if (rng.chance(0.5)) {
      const k = rng.int(2, 4);
      const xs = ints(rng, 7, 0, 9);
      return {
        kind: "code", tema: 13, template: "generadores", title: "Ventanas deslizantes",
        statement: [
          `Escribe la función generadora \`ventanas(iterable, k)\` que produzca tuplas con cada grupo de \`k\` elementos consecutivos: con \`k = 3\` y \`[1, 2, 3, 4]\`, \`(1, 2, 3)\` y \`(2, 3, 4)\`. Si hay menos de \`k\` elementos, no produce nada.`,
          "Tiene que funcionar con un iterable infinito (una prueba usa un generador que no se acaba nunca): no lo conviertas en lista. Las pruebas cogen solo las primeras ventanas.",
        ],
        fn: "ventanas", starter: starterOf("ventanas", "iterable, k"),
        cases: [
          { code: call("ventanas", xs, k), checks: GEN_CHECKS },
          { code: call("ventanas", [1], k) },
          { code: `${NATURALES}ventanas(naturales(${rng.int(0, 9)}), ${k})`, take: 8, checks: GEN_CHECKS },
          { code: `ventanas(iter(${lit(xs)}), 1)` },
        ],
        rules: [generador("ventanas")],
        hints: ["Guarda los últimos k elementos vistos; collections.deque con maxlen lo hace solo.", "Recorre el iterable con un for normal: así no hace falta saber su longitud.", "Cuando ya tienes k elementos guardados, produce una tupla con ellos en cada vuelta."],
        solution: py`
          from collections import deque


          def ventanas(iterable, k):
              ultimos = deque(maxlen=k)
              for x in iterable:
                  ultimos.append(x)
                  if len(ultimos) == k:
                      yield tuple(ultimos)
        `,
      };
    }
    const xs = ints(rng, 6, -5, 9);
    return {
      kind: "code", tema: 13, template: "generadores", title: "Sumas acumuladas sin fin",
      statement: [
        "Escribe la función generadora `acumulados(iterable)` que produzca la suma acumulada de los elementos: con `[3, 1, 4]`, produce 3, 4 y 8.",
        "Tiene que funcionar con un iterable infinito (una prueba usa un generador que no se acaba nunca): no lo conviertas en lista ni uses `sum` de todo.",
      ],
      fn: "acumulados", starter: starterOf("acumulados", "iterable"),
      cases: [
        { code: call("acumulados", xs), checks: GEN_CHECKS },
        { code: call("acumulados", []) },
        { code: `${NATURALES}acumulados(naturales(1))`, take: 10, checks: GEN_CHECKS },
      ],
      rules: [generador("acumulados")],
      hints: ["Lleva el total en una variable fuera del bucle.", "En cada vuelta, suma el elemento y entrega el total con yield.", "itertools.accumulate hace esto mismo; aquí se trata de escribirlo con yield."],
      solution: py`
        def acumulados(iterable):
            total = 0
            for x in iterable:
                total += x
                yield total
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 6: clases y objetos

/** Caso de una clase: un pequeño guion que la usa y devuelve lo que ha pasado (también si lanza un error). */
const intento = (stmt: string) => `def intento():\n    try:\n        ${stmt}\n        return "sin error"\n    except ValueError:\n        return "ValueError"\n`;

const CLASES: Tpl = {
  id: "clases",
  tema: 6,
  make(rng, level) {
    if (level === "básico") {
      const [titular] = names(rng, 1);
      const s0 = rng.int(0, 100);
      const a = rng.int(1, 80);
      const b = rng.int(1, s0 + a);
      return {
        kind: "code", tema: 6, template: "clases", title: "Una clase con métodos",
        statement: [
          "Escribe la clase `Cuenta` para una cuenta de ahorro: `Cuenta(titular, saldo=0)` guarda los dos atributos con esos nombres.",
          "`ingresar(cantidad)` suma la cantidad al saldo y `retirar(cantidad)` la resta. Las dos lanzan `ValueError` si la cantidad no es positiva, y `retirar` también si no hay saldo suficiente (en ese caso el saldo no cambia).",
        ],
        fn: "Cuenta", starter: "class Cuenta:\n    # Escribe aquí tu código\n    pass\n",
        cases: [
          { code: `c = Cuenta(${lit(titular!)}, ${s0})\nc.ingresar(${a})\nc.retirar(${b})\n(c.titular, c.saldo)` },
          { code: `c = Cuenta(${lit(titular!)})\n(c.titular, c.saldo)` },
          { code: `c = Cuenta("x", ${s0})\n${intento(`c.retirar(${s0 + rng.int(1, 50)})`)}(intento(), c.saldo)` },
          { code: `c = Cuenta("x", ${s0})\n${intento("c.ingresar(0)")}(intento(), c.saldo)` },
        ],
        rules: [{ kind: "usa", what: "clase:Cuenta", label: "Define la clase Cuenta" }],
        hints: ["__init__ recibe self y los parámetros, y guarda cada uno como self.nombre.", "Cada método recibe self primero; desde él lees y cambias self.saldo.", "raise ValueError(\"…\") lanza el error; compruébalo antes de tocar el saldo."],
        solution: py`
          class Cuenta:
              def __init__(self, titular, saldo=0):
                  self.titular = titular
                  self.saldo = saldo

              def ingresar(self, cantidad):
                  if cantidad <= 0:
                      raise ValueError("la cantidad tiene que ser positiva")
                  self.saldo += cantidad

              def retirar(self, cantidad):
                  if cantidad <= 0:
                      raise ValueError("la cantidad tiene que ser positiva")
                  if cantidad > self.saldo:
                      raise ValueError("saldo insuficiente")
                  self.saldo -= cantidad
        `,
      };
    }
    if (level === "medio") {
      const [w, h, l] = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)];
      return {
        kind: "code", tema: 6, template: "clases", title: "Herencia: rectángulos y cuadrados",
        statement: [
          "Escribe la clase `Rectangulo(ancho, alto)` con los métodos `area()` y `perimetro()`, y que al convertirla en texto (`str`) dé `'Rectángulo 3 x 4'`.",
          "Escribe también `Cuadrado(lado)`, que herede de `Rectangulo` (un cuadrado es un rectángulo con los dos lados iguales) y cuyo texto sea `'Cuadrado 5'`. No repitas `area` ni `perimetro` en `Cuadrado`.",
        ],
        fn: "Rectangulo", starter: "class Rectangulo:\n    # Escribe aquí tu código\n    pass\n\n\nclass Cuadrado(Rectangulo):\n    pass\n",
        cases: [
          { code: `r = Rectangulo(${w}, ${h})\n(r.area(), r.perimetro(), str(r))` },
          { code: `c = Cuadrado(${l})\n(c.area(), c.perimetro(), str(c), isinstance(c, Rectangulo))` },
          { code: `figuras = [Rectangulo(${h}, ${l}), Cuadrado(${w})]\n[f.area() for f in figuras]` },
        ],
        rules: [
          { kind: "usa", what: "hereda:Cuadrado:Rectangulo", label: "Cuadrado hereda de Rectangulo" },
          { kind: "evita", what: "metodo:Cuadrado:area", label: "Cuadrado no redefine area" },
          { kind: "usa", what: "metodo:Rectangulo:__str__", label: "Rectangulo define __str__" },
        ],
        hints: ["El texto de un objeto lo da el método especial __str__.", "En Cuadrado, __init__ puede llamar al de la clase madre con super().__init__(…) pasando el lado dos veces.", "Cuadrado necesita su propio __str__, pero hereda area y perimetro."],
        solution: py`
          class Rectangulo:
              def __init__(self, ancho, alto):
                  self.ancho = ancho
                  self.alto = alto

              def area(self):
                  return self.ancho * self.alto

              def perimetro(self):
                  return 2 * (self.ancho + self.alto)

              def __str__(self):
                  return f"Rectángulo {self.ancho} x {self.alto}"


          class Cuadrado(Rectangulo):
              def __init__(self, lado):
                  super().__init__(lado, lado)

              def __str__(self):
                  return f"Cuadrado {self.ancho}"
        `,
      };
    }
    const prods = names(rng, 3).map((n) => n.toLowerCase());
    const [q1, q2, q3] = ints(rng, 3, 1, 20);
    return {
      kind: "code", tema: 6, template: "clases", title: "Métodos especiales y propiedades",
      statement: [
        "Escribe la clase `Inventario`: empieza vacío; `agregar(producto, cantidad)` suma unidades (crea el producto si no estaba) y `quitar(producto, cantidad)` las resta, con `ValueError` si no hay tantas (y entonces no cambia nada); si un producto se queda a 0, desaparece.",
        "Además: `len(inv)` es el número de productos distintos, `producto in inv` dice si está, y `inv.total` (una propiedad, sin paréntesis y de solo lectura) es el total de unidades.",
      ],
      fn: "Inventario", starter: "class Inventario:\n    # Escribe aquí tu código\n    pass\n",
      cases: [
        { code: `inv = Inventario()\ninv.agregar(${lit(prods[0]!)}, ${q1})\ninv.agregar(${lit(prods[1]!)}, ${q2})\ninv.agregar(${lit(prods[0]!)}, ${q3})\n(len(inv), inv.total, ${lit(prods[0]!)} in inv, ${lit(prods[2]!)} in inv)` },
        { code: `inv = Inventario()\ninv.agregar(${lit(prods[1]!)}, ${q2})\ninv.quitar(${lit(prods[1]!)}, ${q2})\n(len(inv), inv.total, ${lit(prods[1]!)} in inv)` },
        { code: `inv = Inventario()\ninv.agregar("x", ${q1})\n${intento(`inv.quitar("x", ${q1 + 1})`)}(intento(), inv.total)` },
        { code: `inv = Inventario()\ndef intento():\n    try:\n        inv.total = 5\n    except AttributeError:\n        return "AttributeError"\n    return "sin error"\n(intento(), len(Inventario()))` },
      ],
      rules: [
        { kind: "usa", what: "propiedad:Inventario:total", label: "total es una propiedad (@property)" },
        { kind: "usa", what: "metodo:Inventario:__len__", label: "Inventario define __len__" },
        { kind: "usa", what: "metodo:Inventario:__contains__", label: "Inventario define __contains__" },
      ],
      hints: ["Guarda las unidades en un diccionario de producto a cantidad, creado en __init__.", "len() llama a __len__ y el operador in llama a __contains__.", "Con @property encima de un método, se lee como un atributo; si no defines un setter, asignarle da AttributeError."],
      solution: py`
        class Inventario:
            def __init__(self):
                self._unidades = {}

            def agregar(self, producto, cantidad):
                self._unidades[producto] = self._unidades.get(producto, 0) + cantidad

            def quitar(self, producto, cantidad):
                if self._unidades.get(producto, 0) < cantidad:
                    raise ValueError("no hay tantas unidades")
                self._unidades[producto] -= cantidad
                if self._unidades[producto] == 0:
                    del self._unidades[producto]

            def __len__(self):
                return len(self._unidades)

            def __contains__(self, producto):
                return producto in self._unidades

            @property
            def total(self):
                return sum(self._unidades.values())
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 7: Python avanzado

const AVANZADO: Tpl = {
  id: "avanzado",
  tema: 7,
  make(rng, level) {
    if (level === "básico") {
      const pool = names(rng, 5).map((n) => n.toLowerCase());
      const words = () => Array.from({ length: rng.int(6, 14) }, () => rng.pick(pool));
      return {
        kind: "code", tema: 7, template: "avanzado", title: "collections.Counter",
        statement: ["Escribe `mas_comunes(palabras, k)`, que devuelva una lista con las `k` palabras más repetidas y sus cuentas, como tuplas `(palabra, n)`, de la más a la menos repetida; con el mismo número, en el orden en que aparecen por primera vez. Usa `collections.Counter`."],
        fn: "mas_comunes", starter: `from collections import Counter\n\n\n${starterOf("mas_comunes", "palabras, k")}`,
        cases: [[words(), 2], [words(), 3], [[], 2], [words(), 10]].map((a) => ({ code: call("mas_comunes", ...(a as PyVal[])) })),
        rules: [usaModulo("collections", "Usa el módulo collections")],
        hints: ["Counter(lista) cuenta cada elemento.", "Counter tiene un método que devuelve los k más comunes como lista de tuplas.", "Ese método ya resuelve los empates por orden de aparición."],
        solution: py`
          from collections import Counter


          def mas_comunes(palabras, k):
              return Counter(palabras).most_common(k)
        `,
      };
    }
    if (level === "medio") {
      const xs = ints(rng, rng.int(2, 5), 0, 9);
      const m = rng.int(2, 5);
      return {
        kind: "code", tema: 7, template: "avanzado", title: "Un decorador que cuenta",
        statement: [
          "Escribe el decorador `contar_llamadas(funcion)`: la función decorada hace lo mismo que la original, pero lleva la cuenta de cuántas veces se ha llamado en el atributo `llamadas` (empieza en 0) y conserva el nombre de la original (`__name__`).",
        ],
        fn: "contar_llamadas", starter: `import functools\n\n\n${starterOf("contar_llamadas", "funcion")}`,
        cases: [
          { code: `@contar_llamadas\ndef por_${m}(x):\n    return x * ${m}\n\nr = [por_${m}(x) for x in ${lit(xs)}]\n(r, por_${m}.llamadas, por_${m}.__name__)` },
          { code: `@contar_llamadas\ndef nada():\n    pass\n\n(nada.llamadas, nada.__name__)` },
          { code: `@contar_llamadas\ndef suma(*args, **kwargs):\n    return sum(args) + len(kwargs)\n\n(suma(1, 2, a=3), suma(), suma.llamadas)` },
        ],
        rules: [{ kind: "usa", what: "llamada:wraps", label: "Usa functools.wraps" }],
        hints: ["Un decorador recibe una función y devuelve otra (la envoltura) que llama a la primera.", "La envoltura acepta *args y **kwargs para servir con cualquier función.", "functools.wraps copia el nombre de la original en la envoltura; la cuenta puede ser un atributo de la propia envoltura."],
        solution: py`
          import functools


          def contar_llamadas(funcion):
              @functools.wraps(funcion)
              def envoltura(*args, **kwargs):
                  envoltura.llamadas += 1
                  return funcion(*args, **kwargs)

              envoltura.llamadas = 0
              return envoltura
        `,
      };
    }
    if (rng.chance(0.5)) {
      const lists = () => Array.from({ length: rng.int(2, 4) }, () => ints(rng, rng.int(0, 5), 0, 30).sort((a, b) => a - b));
      return {
        kind: "code", tema: 7, template: "avanzado", title: "heapq: mezclar listas ordenadas",
        statement: ["Escribe `mezclar(listas)`, que reciba una lista de listas ya ordenadas de menor a mayor y devuelva una sola lista ordenada con todos sus elementos. Usa el módulo `heapq` (sin ordenar todo al final)."],
        fn: "mezclar", starter: `import heapq\n\n\n${starterOf("mezclar", "listas")}`,
        cases: [lists(), lists(), [[], []], [[1, 1], [1]]].map((l) => ({ code: call("mezclar", l) })),
        rules: [usaModulo("heapq", "Usa el módulo heapq"), { kind: "evita", what: "llamada:sorted", label: "Sin sorted" }, { kind: "evita", what: "llamada:sort", label: "Sin sort" }],
        hints: ["heapq tiene una función que mezcla varios iterables ya ordenados.", "Esa función recibe los iterables como argumentos separados: el * desempaqueta una lista.", "Devuelve un iterador: conviértelo en lista."],
        solution: py`
          import heapq


          def mezclar(listas):
              return list(heapq.merge(*listas))
        `,
      };
    }
    const k = rng.int(2, 4);
    const nums = () => ints(rng, rng.int(k, 10), -50, 50);
    return {
      kind: "code", tema: 7, template: "avanzado", title: "heapq: los k más pequeños",
      statement: [`Escribe \`k_menores(numeros, k)\`, que devuelva en una lista ordenada de menor a mayor los \`k\` números más pequeños (con repetidos si los hay). Usa el módulo \`heapq\`, sin ordenar la lista entera.`],
      fn: "k_menores", starter: `import heapq\n\n\n${starterOf("k_menores", "numeros, k")}`,
      cases: [[nums(), k], [nums(), 1], [[5, 5, 1], 2], [nums(), 0]].map((a) => ({ code: call("k_menores", ...(a as PyVal[])) })),
      rules: [usaModulo("heapq", "Usa el módulo heapq"), { kind: "evita", what: "llamada:sorted", label: "Sin sorted" }, { kind: "evita", what: "llamada:sort", label: "Sin sort" }],
      hints: ["Un montículo (heap) da siempre el menor elemento en tiempo logarítmico.", "heapq tiene una función que devuelve directamente los n más pequeños.", "Esa función ya devuelve la lista ordenada."],
      solution: py`
        import heapq


        def k_menores(numeros, k):
            return heapq.nsmallest(k, numeros)
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 8: NumPy

/** Matriz de enteros al azar como literal de NumPy. */
const matrix = (rng: Rng, rows: number, cols: number, min: number, max: number) => Array.from({ length: rows }, () => ints(rng, cols, min, max));
/** Comparación más fina que el redondeo a 6 decimales que pide el enunciado. */
const EXACT_6: PyCompareOptions = { tolerance: 1e-9 };
const npArray = (m: number[][]) => `np.array(${lit(m)})`;

const NP_MASCARAS: Tpl = {
  id: "numpy-mascaras",
  tema: 8,
  make(rng, level) {
    if (level === "básico") {
      if (rng.chance(0.5)) {
        const cases = [matrix(rng, 3, 4, 0, 20), matrix(rng, 4, 2, -9, 9), matrix(rng, 1, 3, 0, 5)].map((m) => ({ code: `${HEAD_NP}centrar(${npArray(m)})` }));
        return {
          kind: "code", tema: 8, template: "numpy-mascaras", title: "Centrar las columnas",
          statement: ["Escribe `centrar(m)`, que reciba una matriz de NumPy y devuelva otra (de reales) en la que a cada columna se le ha restado su media. Sin bucles: usa operaciones de NumPy."],
          fn: "centrar", starter: starterWith(HEAD_NP, "centrar", "m"), cases, packages: NUMPY, seconds: DATA_SECONDS,
          rules: [{ kind: "evita", what: "nodo:For", label: "Sin bucles for" }],
          hints: ["m.mean(axis=0) da la media de cada columna.", "Restar un vector a una matriz lo resta a cada fila (broadcasting).", "El resultado ya es de reales porque la media lo es."],
          solution: `${HEAD_NP}\n\ndef centrar(m):\n    return m - m.mean(axis=0)\n`,
        };
      }
      const seeds = ints(rng, 3, 0, 999);
      const [lo, hi] = [rng.int(-9, 0), rng.int(10, 30)];
      return {
        kind: "code", tema: 8, template: "numpy-mascaras", title: "Matriz aleatoria con semilla",
        statement: [
          `Escribe \`matriz(semilla, filas, columnas)\`, que cree con \`np.random.default_rng(semilla).integers(${lo}, ${hi}, size=(filas, columnas))\` una matriz de enteros entre ${lo} y ${hi - 1}, y devuelva una tupla con la matriz y el máximo de cada columna.`,
          "Con la misma semilla, el generador da siempre los mismos números: por eso las pruebas pueden comparar.",
        ],
        fn: "matriz", starter: starterWith(HEAD_NP, "matriz", "semilla, filas, columnas"),
        cases: [[seeds[0]!, 3, 4], [seeds[1]!, 5, 2], [seeds[2]!, 1, 6]].map((a) => ({ code: call("matriz", ...a) })), packages: NUMPY, seconds: DATA_SECONDS,
        hints: ["Crea el generador con la semilla y pídele los enteros con integers.", "El límite superior de integers no se incluye.", "max(axis=0) da el máximo de cada columna."],
        solution: `${HEAD_NP}\n\ndef matriz(semilla, filas, columnas):\n    m = np.random.default_rng(semilla).integers(${lo}, ${hi}, size=(filas, columnas))\n    return m, m.max(axis=0)\n`,
      };
    }
    if (level === "medio") {
      const k = rng.int(2, 5);
      const ms = [matrix(rng, 3, 4, -10, 20), matrix(rng, 4, 4, 0, 12), matrix(rng, 2, 3, 1, 9)];
      const cases: PyCase[] = [
        ...ms.map((m) => ({ code: `${HEAD_NP}marcar_multiplos(${npArray(m)}, ${k})`, checks: [check("nulos", "Los NaN están en los múltiplos (y solo en ellos)")] })),
        // La original no cambia.
        { code: `${HEAD_NP}m = ${npArray(ms[0]!)}\nmarcar_multiplos(m, ${k})\nm` },
      ];
      return {
        kind: "code", tema: 8, template: "numpy-mascaras", title: "Máscaras: múltiplos a NaN",
        statement: [`Escribe \`marcar_multiplos(m, k)\`, que devuelva una copia de la matriz, de reales, con \`np.nan\` en las posiciones donde hay un múltiplo de \`k\` (el 0 también lo es). La matriz original no debe cambiar.`],
        fn: "marcar_multiplos", starter: starterWith(HEAD_NP, "marcar_multiplos", "m, k"), cases, packages: NUMPY, seconds: DATA_SECONDS,
        hints: ["m % k == 0 da una matriz de booleanos: una máscara.", "Un array de enteros no puede guardar NaN: conviértelo antes a float (eso ya crea una copia).", "Con la máscara entre corchetes puedes asignar a todas esas posiciones a la vez."],
        solution: `${HEAD_NP}\n\ndef marcar_multiplos(m, k):\n    r = m.astype(float)\n    r[m % k == 0] = np.nan\n    return r\n`,
      };
    }
    const k = rng.int(2, 4);
    const t = rng.int(1, 2);
    const cases = [0, 1, 2].map(() => {
      const [s, f, c] = [rng.int(0, 999), rng.int(3, 6), rng.int(3, 6)];
      return { code: `${HEAD_NP}m = np.random.default_rng(${s}).integers(-9, 10, size=(${f}, ${c}))\nlimpiar(m, ${k}, ${t + 1})` };
    });
    return {
      kind: "code", tema: 8, template: "numpy-mascaras", title: "Restar, marcar y quitar columnas",
      statement: [
        "Escribe `limpiar(m, k, t)`, que, sin bucles y sin cambiar `m`:",
        "1) reste a cada fila su mínimo; 2) marque con `np.nan` los múltiplos de `k` estrictamente positivos del resultado; 3) quite las columnas que tengan `t` o más NaN. Devuelve la matriz (de reales) que queda.",
      ],
      fn: "limpiar", starter: starterWith(HEAD_NP, "limpiar", "m, k, t"), cases, packages: NUMPY, seconds: DATA_SECONDS,
      rules: [{ kind: "evita", what: "nodo:For", label: "Sin bucles for" }],
      hints: [
        "El mínimo de cada fila con keepdims=True conserva la forma para restarlo bien.",
        "Una máscara puede combinar dos condiciones con & (y paréntesis alrededor de cada una).",
        "np.isnan(r).sum(axis=0) cuenta los NaN de cada columna; una máscara de columnas va en el segundo índice: r[:, mascara].",
      ],
      solution: py`
        import numpy as np


        def limpiar(m, k, t):
            r = (m - m.min(axis=1, keepdims=True)).astype(float)
            r[(r > 0) & (r % k == 0)] = np.nan
            return r[:, np.isnan(r).sum(axis=0) < t]
      `,
    };
  },
};

/** Determinante de una matriz pequeña de enteros (desarrollo por la primera fila). */
function det(m: number[][]): number {
  if (m.length === 1) return m[0]![0]!;
  return m[0]!.reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(m.slice(1).map((r) => r.filter((_, c) => c !== j))), 0);
}

const mul = (a: number[][], x: number[]) => a.map((r) => r.reduce((s, v, j) => s + v * x[j]!, 0));

function invertible(rng: Rng, n: number): number[][] {
  for (;;) {
    const a = matrix(rng, n, n, -5, 5);
    if (det(a) !== 0) return a;
  }
}

function singular(rng: Rng, n: number): number[][] {
  const a = matrix(rng, n - 1, n, -4, 4);
  const f = rng.int(-2, 2) || 1;
  return [...a, a[0]!.map((v, j) => v * f + (n > 2 ? a[1]![j]! : 0))];
}

const NP_SISTEMAS: Tpl = {
  id: "numpy-sistemas",
  tema: 8,
  make(rng, level) {
    const system = (n: number) => {
      const a = invertible(rng, n);
      const x = ints(rng, n, -6, 6);
      return { a, x, b: mul(a, x) };
    };
    if (level === "básico") {
      const cases = [2, 3, 3, 4].map((n) => {
        const s = system(n);
        return { code: `${HEAD_NP}A = ${npArray(s.a)}\nb = np.array(${lit(s.b)})\nresolver(A, b)` };
      });
      return {
        kind: "code", tema: 8, template: "numpy-sistemas", title: "Resolver un sistema lineal",
        statement: ["Escribe `resolver(A, b)`, que devuelva la solución `x` del sistema `A x = b` (con `A` cuadrada e invertible) como array de NumPy. Usa `np.linalg.solve`."],
        fn: "resolver", starter: starterWith(HEAD_NP, "resolver", "A, b"), cases, packages: NUMPY, seconds: DATA_SECONDS,
        rules: [{ kind: "usa", what: "llamada:solve", label: "Usa np.linalg.solve" }],
        hints: ["np.linalg.solve recibe la matriz y el vector de términos independientes.", "No hace falta calcular la inversa: solve es más preciso.", "La solución es un array de reales aunque sea entera."],
        solution: `${HEAD_NP}\n\ndef resolver(A, b):\n    return np.linalg.solve(A, b)\n`,
      };
    }
    if (level === "medio") {
      // La solución calculada (con decimales de redondeo), la exacta y dos que fallan por poco.
      const cases = [2, 3, 3, 4].map((n, i) => {
        const s = system(n);
        const at = rng.int(0, n - 1);
        const wrong = s.x.map((v, j) => (j === at ? v + rng.pick([-1, 1]) : v));
        const x = i === 0 ? "np.linalg.solve(A, b)" : i === 1 ? `np.array(${lit(s.x)})` : `np.array(${lit(wrong)}, dtype=float)`;
        return { code: `${HEAD_NP}A = ${npArray(s.a)}\nb = np.array(${lit(s.b)})\nx = ${x}\nes_solucion(A, b, x)` };
      });
      return {
        kind: "code", tema: 8, template: "numpy-sistemas", title: "Comprobar una solución",
        statement: ["Escribe `es_solucion(A, b, x)`, que devuelva `True` si `x` resuelve el sistema `A x = b` salvo errores de redondeo y `False` si no. Usa el producto de matrices y `np.allclose`: no compares con `==`."],
        fn: "es_solucion", starter: starterWith(HEAD_NP, "es_solucion", "A, b, x"), cases, packages: NUMPY, seconds: DATA_SECONDS,
        rules: [{ kind: "usa", what: "llamada:allclose", label: "Usa np.allclose" }],
        hints: ["A @ x es el producto de la matriz por el vector.", "Con decimales, A @ x casi nunca es exactamente b: allclose admite una diferencia muy pequeña.", "Convierte el resultado con bool() si quieres un True de Python."],
        solution: `${HEAD_NP}\n\ndef es_solucion(A, b, x):\n    return bool(np.allclose(A @ x, b))\n`,
      };
    }
    const cases = [2, 3, 3, 4].map((n, i) => {
      const s = i === 1 || i === 3 ? { a: singular(rng, n), b: ints(rng, n, -9, 9) } : system(n);
      return { code: `${HEAD_NP}A = ${npArray(s.a)}\nb = np.array(${lit(s.b)})\nresolver_o_nada(A, b)`, options: EXACT_6 };
    });
    // Con det = 3, la solución tiene infinitos decimales (2/3, −1/3): sin redondear a 6 no pasa (con la
    // tolerancia de siempre, 1e-6, la diferencia de 3·10⁻⁷ no se notaría).
    const k = rng.pick([1, 2, 4, 5]);
    cases.push({ code: `${HEAD_NP}A = ${npArray([[2, 1], [1, 2]])}\nb = np.array(${lit([k, 0])})\nresolver_o_nada(A, b)`, options: EXACT_6 });
    return {
      kind: "code", tema: 8, template: "numpy-sistemas", title: "Sistemas que no tienen solución única",
      statement: [
        "Escribe `resolver_o_nada(A, b)`: si la matriz cuadrada `A` es invertible (su rango es el número de filas), devuelve la solución de `A x = b` redondeada a 6 decimales; si no, devuelve `None`.",
        "Antes de devolverla, comprueba con `np.allclose` que la solución reproduce `b`.",
      ],
      fn: "resolver_o_nada", starter: starterWith(HEAD_NP, "resolver_o_nada", "A, b"), cases, packages: NUMPY, seconds: DATA_SECONDS,
      hints: ["np.linalg.matrix_rank da el rango de una matriz.", "Con una matriz singular, np.linalg.solve lanza un error: compruébalo antes (o captura LinAlgError).", "np.round(x, 6) redondea todo el array."],
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
    };
  },
};

// ---------------------------------------------------------------- Tema 12: valores perdidos

const SENSOR_HEAD = "`sensores.csv` tiene una fila por hora (columna `hora`) y una columna por sensor (`s1`, `s2`…), con valores perdidos (NaN).";

const NULOS: Tpl = {
  id: "pandas-nulos",
  tema: 12,
  make(rng, level) {
    const sets = [12, 20, 30].map((rows, i) => sensors(dataSeed(rng), { rows, sensors: 3 + i }));
    const read = (d: (typeof sets)[number]) => ({ files: { [d.file]: d.csv }, setup: `df = pd.read_csv("${d.file}")` });
    if (level === "básico") {
      if (rng.chance(0.5)) {
        return {
          kind: "code", tema: 12, template: "pandas-nulos", title: "Contar los valores perdidos",
          statement: [SENSOR_HEAD, "Escribe `nulos_por_columna(df)`, que devuelva una Series con cuántos NaN tiene cada columna (con el nombre de la columna como índice, en el orden de la tabla)."],
          fn: "nulos_por_columna", starter: starterWith(HEAD_PD, "nulos_por_columna", "df"),
          cases: sets.map((d) => dataCase(read(d).files, read(d).setup, "nulos_por_columna(df)")), packages: PANDAS, seconds: DATA_SECONDS,
          hints: ["isna() da una tabla de booleanos del mismo tamaño: True donde falta el dato.", "Al sumar booleanos, cada True cuenta 1.", "sum() de un DataFrame suma cada columna."],
          solution: `${HEAD_PD}\n\ndef nulos_por_columna(df):\n    return df.isna().sum()\n`,
        };
      }
      return {
        kind: "code", tema: 12, template: "pandas-nulos", title: "Columnas con huecos",
        statement: [SENSOR_HEAD, "Escribe `columnas_con_nulos(df)`, que devuelva una lista con los nombres de las columnas que tienen algún NaN, en el orden de la tabla."],
        fn: "columnas_con_nulos", starter: starterWith(HEAD_PD, "columnas_con_nulos", "df"),
        cases: sets.map((d) => dataCase(read(d).files, read(d).setup, "columnas_con_nulos(df)")), packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["isna() marca los huecos; any() dice, por columnas, si hay alguno.", "Con esa Series de booleanos puedes filtrar df.columns.", "tolist() convierte un índice en una lista de Python."],
        solution: `${HEAD_PD}\n\ndef columnas_con_nulos(df):\n    return df.columns[df.isna().any()].tolist()\n`,
      };
    }
    if (level === "medio") {
      return {
        kind: "code", tema: 12, template: "pandas-nulos", title: "Quitar las columnas con demasiados huecos",
        statement: [SENSOR_HEAD, "Escribe `quitar_columnas(df, k)`, que devuelva la tabla sin las columnas que tienen más de `k` NaN (las que tienen exactamente `k` se quedan). No cambies nada más."],
        fn: "quitar_columnas", starter: starterWith(HEAD_PD, "quitar_columnas", "df, k"),
        cases: sets.map((d) => dataCase(read(d).files, read(d).setup, `quitar_columnas(df, ${d.facts.k})`, { checks: [check("columnas", "Quedan las columnas con k NaN o menos")] })),
        packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["dropna puede quitar columnas en vez de filas (axis=1).", "Su parámetro thresh es el mínimo de valores no nulos para quedarse.", "Si una columna puede tener como mucho k huecos, ¿cuántos valores tiene que tener como mínimo?"],
        solution: `${HEAD_PD}\n\ndef quitar_columnas(df, k):\n    return df.dropna(axis=1, thresh=len(df) - k)\n`,
      };
    }
    return {
      kind: "code", tema: 12, template: "pandas-nulos", title: "Interpolar y rellenar los extremos",
      statement: [
        SENSOR_HEAD,
        "Escribe `rellenar(df, k)`: quita las columnas con más de `k` NaN; después rellena los huecos de las demás interpolando linealmente entre los valores vecinos y, los que queden al principio o al final, con el valor más cercano. No debe quedar ningún NaN.",
      ],
      fn: "rellenar", starter: starterWith(HEAD_PD, "rellenar", "df, k"),
      cases: sets.map((d) =>
        dataCase(read(d).files, read(d).setup, `rellenar(df, ${d.facts.k})`, {
          checks: [check("columnas", "Quedan las columnas con k NaN o menos"), check("sin-nulos", "No queda ningún NaN")],
        }),
      ),
      packages: PANDAS, seconds: DATA_SECONDS,
      hints: [
        "Primero el dropna por columnas, como en el nivel medio.",
        "interpolate() rellena entre dos valores conocidos (y al final repite el último), pero no los huecos del principio.",
        "bfill() copia hacia atrás el siguiente valor válido y ffill() hacia delante el anterior.",
      ],
      solution: `${HEAD_PD}\n\ndef rellenar(df, k):\n    df = df.dropna(axis=1, thresh=len(df) - k)\n    return df.interpolate().bfill().ffill()\n`,
    };
  },
};

// ---------------------------------------------------------------- Tema 12: limpiar y convertir

/** Requisito: redondear con round() (función o método de pandas y NumPy). */
const USA_ROUND: PyRule = { kind: "usa", what: "llamada:round", label: "Redondea con round()" };

const SALES_HEAD =
  "`ventas.csv` tiene un ticket por fila: `ticket, articulo, cantidad, precio, total, pago, local, fecha`. Algunas celdas están vacías, valen `ERROR` o `UNKNOWN`, o tienen números mal escritos (como `2,75`, `3.00€` o `dos`).";
/** Lectura con los tokens ya convertidos en NaN y las columnas numéricas convertidas (para los pasos siguientes). */
const SALES_CLEAN = 'df = pd.read_csv("ventas.csv", na_values=["ERROR", "UNKNOWN"])\nfor c in ["cantidad", "precio", "total"]:\n    df[c] = pd.to_numeric(df[c], errors="coerce")';

/** Ventas para un caso: con alguna fila que delate el «primer precio visto» si se pide. */
function salesFor(rng: Rng, rows: number, trap: boolean): SalesDataset {
  for (let i = 0; ; i++) {
    const d = dirtySales(dataSeed(rng), { rows, corruption: 0.12 });
    if (!trap || d.facts.trapRows > 0 || i > 50) return d;
  }
}

const LIMPIAR: Tpl = {
  id: "pandas-limpiar",
  tema: 12,
  make(rng, level) {
    if (level === "básico") {
      const cases = [24, 36, 60].map((rows) => {
        const d = salesFor(rng, rows, false);
        return dataCase({ [d.file]: d.csv }, `df = pd.read_csv("${d.file}")`, "a_numeros(df)", { checks: [check("forma", "Conserva todas las filas y columnas")] });
      });
      return {
        kind: "code", tema: 12, template: "pandas-limpiar", title: "De textos estropeados a números",
        statement: [SALES_HEAD, "Escribe `a_numeros(df)`, que devuelva la tabla con `ERROR` y `UNKNOWN` cambiados por NaN en todas las columnas y las columnas `cantidad`, `precio` y `total` convertidas en números (lo que no se pueda convertir, NaN)."],
        fn: "a_numeros", starter: starterWith(HEAD_PD, "a_numeros", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["replace acepta una lista de valores que cambiar por uno solo (np.nan).", "pd.to_numeric convierte una columna; con errors=\"coerce\", lo que no entiende pasa a NaN.", "Convierte las tres columnas, una a una o en un bucle."],
        solution: py`
          import numpy as np
          import pandas as pd


          def a_numeros(df):
              df = df.replace(["ERROR", "UNKNOWN"], np.nan)
              for c in ["cantidad", "precio", "total"]:
                  df[c] = pd.to_numeric(df[c], errors="coerce")
              return df
        `,
      };
    }
    if (level === "medio") {
      const cases = [30, 50, 80].map((rows) => {
        const d = salesFor(rng, rows, false);
        return dataCase({ [d.file]: d.csv }, SALES_CLEAN, "precio_por_articulo(df)");
      });
      return {
        kind: "code", tema: 12, template: "pandas-limpiar", title: "El precio de cada artículo",
        statement: [
          SALES_HEAD,
          "El caso lee la tabla con los NaN ya puestos y las columnas numéricas convertidas. Cada artículo tiene un precio habitual, pero algunos tickets llevan un precio de promoción.",
          "Escribe `precio_por_articulo(df)`, que devuelva un diccionario de cada artículo a su precio habitual: el que más se repite (la moda) entre sus filas con precio válido. Ojo: el primer precio que aparece no tiene por qué ser el habitual.",
        ],
        fn: "precio_por_articulo", starter: starterWith(HEAD_PD, "precio_por_articulo", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["Quédate solo con las filas que tienen precio (dropna con subset).", "Agrupa por artículo; una Series tiene el método mode(), que devuelve las modas (la primera es [0]).", "Convierte el resultado en diccionario (to_dict o una comprensión)."],
        solution: py`
          import numpy as np
          import pandas as pd


          def precio_por_articulo(df):
              validos = df.dropna(subset=["precio"])
              return {articulo: float(precios.mode()[0]) for articulo, precios in validos.groupby("articulo")["precio"]}
        `,
      };
    }
    const cases = [36, 60, 120].map((rows) => {
      const d = salesFor(rng, rows, true);
      return dataCase({ [d.file]: d.csv }, `${SALES_CLEAN}\ndf = df.dropna(subset=["articulo"])`, "completar(df)", { checks: [check("forma", "Tiene las filas que deben quedar")] });
    });
    return {
      kind: "code", tema: 12, template: "pandas-limpiar", title: "Total = precio × cantidad",
      statement: [
        SALES_HEAD,
        "El caso lee la tabla con los NaN puestos, las columnas numéricas convertidas y sin las filas sin artículo. Escribe `completar(df)`, que devuelva una tabla coherente:",
        "1) los precios que faltan, con el precio habitual del artículo (la moda de sus precios válidos); 2) los totales que faltan, con precio × cantidad; 3) las cantidades que faltan, con total / precio redondeado al entero (con `round()`); 4) sin las filas a las que les faltan a la vez la cantidad y el total. El orden de las filas no cambia.",
      ],
      fn: "completar", starter: starterWith(HEAD_PD, "completar", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
      // total / precio da la cantidad salvo el ruido del float: el round() que pide el enunciado, como requisito.
      rules: [USA_ROUND],
      hints: [
        "Calcula primero el precio habitual de cada artículo (una Series indexada por artículo) y úsalo con map para rellenar con fillna.",
        "Una máscara como total.isna() & cantidad.notna() dice qué filas rellenar; df.loc[mascara, \"total\"] = … las cambia solo a ellas.",
        "dropna con subset y how=\"all\" quita las filas a las que les faltan todas esas columnas.",
      ],
      solution: py`
        import numpy as np
        import pandas as pd


        def completar(df):
            df = df.copy()
            validos = df.dropna(subset=["precio"])
            precios = validos.groupby("articulo")["precio"].agg(lambda s: s.mode()[0])
            df["precio"] = df["precio"].fillna(df["articulo"].map(precios))
            faltan_t = df["total"].isna() & df["cantidad"].notna()
            df.loc[faltan_t, "total"] = df.loc[faltan_t, "precio"] * df.loc[faltan_t, "cantidad"]
            faltan_c = df["cantidad"].isna() & df["total"].notna()
            df.loc[faltan_c, "cantidad"] = (df.loc[faltan_c, "total"] / df.loc[faltan_c, "precio"]).round()
            return df.dropna(subset=["cantidad", "total"], how="all")
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 10: agrupar y pivotar

const INC_HEAD =
  "`incidencias.csv` tiene una incidencia por fila: `id, fecha, lugar, lat, lon, categoria, danio` (lugar escrito de cualquier manera, alguna coordenada fuera de rango y huecos).";

const AGRUPAR: Tpl = {
  id: "pandas-agrupar",
  tema: 10,
  make(rng, level) {
    if (level === "básico") {
      const cases = [30, 45, 60].map((rows) => {
        const d = incidents(dataSeed(rng), { rows });
        return dataCase({ [d.file]: d.csv }, `df = pd.read_csv("${d.file}")`, "porcentaje_nulos(df)");
      });
      return {
        kind: "code", tema: 10, template: "pandas-agrupar", title: "Porcentaje de nulos por columna",
        statement: [INC_HEAD, "Escribe `porcentaje_nulos(df)`, que devuelva una Series con el porcentaje (de 0 a 100) de valores perdidos de cada columna, redondeado a dos decimales, con el nombre de la columna como índice."],
        fn: "porcentaje_nulos", starter: starterWith(HEAD_PD, "porcentaje_nulos", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["isna() marca los huecos.", "La media de una columna de booleanos es la proporción de True.", "Multiplica por 100 y redondea con round(2)."],
        solution: `${HEAD_PD}\n\ndef porcentaje_nulos(df):\n    return (df.isna().mean() * 100).round(2)\n`,
      };
    }
    if (level === "medio") {
      const total = rng.chance(0.5);
      const cases = [30, 50, 80].map((rows) => {
        const d = salesFor(rng, rows, false);
        return dataCase({ [d.file]: d.csv }, SALES_CLEAN, total ? "total_por_local(df)" : "tickets_por_pago(df)");
      });
      return total
        ? {
            kind: "code", tema: 10, template: "pandas-agrupar", title: "Total vendido por local",
            statement: [SALES_HEAD, "El caso lee la tabla con los NaN puestos y las columnas numéricas convertidas. Escribe `total_por_local(df)`, que devuelva una Series con la suma de `total` de cada local, redondeada a dos decimales y ordenada por el nombre del local (como la deja `groupby`). Los locales vacíos no cuentan."],
            fn: "total_por_local", starter: starterWith(HEAD_PD, "total_por_local", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
            // Los totales ya tienen dos decimales: lo que cambia el redondeo es el ruido del float (0,1 + 0,2), que la
            // comparación tolera; por eso el redondeo que pide el enunciado se comprueba como requisito.
            rules: [USA_ROUND],
            hints: ["groupby(\"local\") agrupa las filas por local y deja fuera los NaN.", "Elige la columna total del grupo y súmala.", "round(2) redondea toda la Series."],
            solution: `${HEAD_PD}\n\ndef total_por_local(df):\n    return df.groupby("local")["total"].sum().round(2)\n`,
          }
        : {
            kind: "code", tema: 10, template: "pandas-agrupar", title: "Tickets por forma de pago",
            statement: [SALES_HEAD, "El caso lee la tabla con los NaN puestos. Escribe `tickets_por_pago(df)`, que devuelva una Series con cuántos tickets hay de cada forma de pago, ordenada por la forma de pago (como la deja `groupby`). Los pagos vacíos no cuentan."],
            fn: "tickets_por_pago", starter: starterWith(HEAD_PD, "tickets_por_pago", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
            hints: ["groupby(\"pago\") agrupa las filas.", "size() cuenta las filas de cada grupo.", "value_counts() también cuenta, pero ordena de mayor a menor: el enunciado pide el orden del groupby."],
            solution: `${HEAD_PD}\n\ndef tickets_por_pago(df):\n    return df.groupby("pago").size()\n`,
          };
    }
    const cases = [40, 80, 160].map((rows) => {
      const d = incidents(dataSeed(rng), { rows });
      return dataCase({ [d.file]: d.csv }, `df = pd.read_csv("${d.file}")`, "tabla_por_anio(df)", { options: { index: true }, checks: [check("forma", "Una fila por categoría y una columna por año")] });
    });
    return {
      kind: "code", tema: 10, template: "pandas-agrupar", title: "Tabla dinámica: categorías por año",
      statement: [
        INC_HEAD,
        "Escribe `tabla_por_anio(df)`: añade la columna `anio` con el año de `fecha` (con `pd.to_datetime`) y devuelve una tabla dinámica (`pivot_table`) con una fila por categoría, una columna por año y, en cada celda, cuántas incidencias hay (`aggfunc=\"count\"` sobre `id`), con 0 donde no hay ninguna.",
      ],
      fn: "tabla_por_anio", starter: starterWith(HEAD_PD, "tabla_por_anio", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
      hints: ["pd.to_datetime convierte el texto en fechas y .dt.year saca el año.", "pivot_table recibe index, columns, values y aggfunc.", "Las combinaciones sin incidencias salen como NaN: fillna(0)."],
      solution: py`
        import numpy as np
        import pandas as pd


        def tabla_por_anio(df):
            df = df.copy()
            df["anio"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year
            return df.pivot_table(index="categoria", columns="anio", values="id", aggfunc="count").fillna(0)
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 9: fechas y cadenas

const FECHAS: Tpl = {
  id: "pandas-fechas",
  tema: 9,
  make(rng, level) {
    const titlesCase = (hyphen: boolean) => [8, 10, 5].map((n) => ({ code: `${HEAD_PD}separar_titulos(${lit(movieList(dataSeed(rng), n, hyphen).items)})`, options: { dtypes: true } }));
    const titlesTpl = (hyphen: boolean): PyCodeInstance => ({
      kind: "code", tema: 9, template: "pandas-fechas", title: hyphen ? "Partir por el último separador" : "Separar «Título - Año»",
      statement: [
        "Escribe `separar_titulos(textos)`, que reciba una lista de textos con la forma `Título - Año` y devuelva un DataFrame con dos columnas: `titulo` (texto) y `anio` (entero), en el mismo orden.",
        ...(hyphen ? ["Algunos títulos llevan ` - ` dentro (`El faro - segunda parte - 1987`): el año es lo que va detrás del último ` - `."] : []),
      ],
      fn: "separar_titulos", starter: starterWith(HEAD_PD, "separar_titulos", "textos"), cases: titlesCase(hyphen), packages: PANDAS, seconds: DATA_SECONDS,
      hints: [
        hyphen ? "rsplit parte empezando por la derecha; su segundo argumento dice cuántas veces." : "split(\" - \") parte un texto por el separador.",
        "pd.DataFrame acepta una lista de listas y los nombres de las columnas.",
        "astype(int) convierte la columna del año (que llega como texto).",
      ],
      solution: `${HEAD_PD}\n\ndef separar_titulos(textos):\n    filas = [t.rsplit(" - ", 1) for t in textos]\n    return pd.DataFrame(filas, columns=["titulo", "anio"]).astype({"anio": int})\n`,
    });
    if (level === "básico") return titlesTpl(false);
    if (level === "medio") {
      const cases = [30, 50, 90].map((rows) => {
        const d = incidents(dataSeed(rng), { rows });
        return dataCase({ [d.file]: d.csv }, `df = pd.read_csv("${d.file}")`, "por_anio(df)");
      });
      return {
        kind: "code", tema: 9, template: "pandas-fechas", title: "Incidencias por año",
        statement: [INC_HEAD, "Escribe `por_anio(df)`, que convierta `fecha` con `pd.to_datetime` (formato `%Y-%m-%d`) y devuelva una Series con cuántas incidencias hay de cada año, ordenada por año. Las fechas vacías no cuentan."],
        fn: "por_anio", starter: starterWith(HEAD_PD, "por_anio", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["pd.to_datetime(columna, format=…) convierte; las celdas vacías quedan como NaT.", "El accesor .dt da el año de cada fecha.", "groupby por esa Series de años y size() cuenta; los NaT no forman grupo."],
        solution: `${HEAD_PD}\n\ndef por_anio(df):\n    anios = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year\n    return df.groupby(anios).size()\n`,
      };
    }
    if (rng.chance(0.5)) return titlesTpl(true);
    const cases = [30, 60, 90].map((rows) => {
      const d = incidents(dataSeed(rng), { rows });
      return dataCase({ [d.file]: d.csv }, `df = pd.read_csv("${d.file}")`, "lugares(df)");
    });
    return {
      kind: "code", tema: 9, template: "pandas-fechas", title: "Normalizar nombres de lugares",
      statement: [INC_HEAD, "Los lugares están escritos con mayúsculas mezcladas y espacios de más (`  Villa Ravi`, `VILLA RAVI `…). Escribe `lugares(df)`, que devuelva una Series con cuántas incidencias hay de cada lugar, ya en minúsculas y sin espacios en los extremos, ordenada por el nombre del lugar."],
      fn: "lugares", starter: starterWith(HEAD_PD, "lugares", "df"), cases, packages: PANDAS, seconds: DATA_SECONDS,
      hints: ["El accesor .str aplica métodos de texto a toda la columna.", "strip() quita los espacios de los extremos y lower() pasa a minúsculas.", "value_counts() cuenta; sort_index() ordena por el nombre."],
      solution: `${HEAD_PD}\n\ndef lugares(df):\n    return df["lugar"].str.strip().str.lower().value_counts().sort_index()\n`,
    };
  },
};

// ---------------------------------------------------------------- Tema 10: combinar

const COMBINAR: Tpl = {
  id: "pandas-combinar",
  tema: 10,
  make(rng, level) {
    const data = (rows: number) => incidents(dataSeed(rng), { rows });
    const files = (d: ReturnType<typeof data>) => ({ [d.file]: d.csv, [d.lookup.file]: d.lookup.csv });
    const both = 'df = pd.read_csv("incidencias.csv")\npaises = pd.read_csv("paises.csv")';
    const head = `${INC_HEAD} \`paises.csv\` relaciona cada lugar (en minúsculas) con un código de país (\`lugar, pais\`); tiene alguna fila repetida y no están todos los lugares.`;
    if (level === "básico") {
      const cases = [30, 50, 70].map((rows) => {
        const d = data(rows);
        return dataCase(files(d), `${both}\ndf["lugar"] = df["lugar"].str.strip().str.lower()\npaises = paises.drop_duplicates()`, "unir(df, paises)", {
          checks: [check("forma", "Tiene una fila por incidencia (merge por la izquierda)"), check("columnas", "Añade la columna pais")],
        });
      });
      return {
        kind: "code", tema: 10, template: "pandas-combinar", title: "Unir con merge",
        statement: [head, "En el caso, los lugares ya están normalizados y las repetidas, quitadas. Escribe `unir(df, paises)`, que añada a cada incidencia su país con un `merge` por la columna `lugar` que conserve todas las incidencias (también las que no tienen país) y en su orden."],
        fn: "unir", starter: starterWith(HEAD_PD, "unir", "df, paises"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["merge une dos tablas por las columnas que coinciden (on=…).", "how=\"left\" conserva todas las filas de la tabla de la izquierda.", "Las que no encuentran pareja quedan con NaN en pais."],
        solution: `${HEAD_PD}\n\ndef unir(df, paises):\n    return df.merge(paises, on="lugar", how="left")\n`,
      };
    }
    if (level === "medio") {
      const cases = [30, 60, 90].map((rows) => {
        const d = data(rows);
        return dataCase(files(d), both, "sin_pais(df, paises)");
      });
      return {
        kind: "code", tema: 10, template: "pandas-combinar", title: "¿Cuántas no casan?",
        statement: [head, "Escribe `sin_pais(df, paises)`, que normalice `lugar` (minúsculas y sin espacios en los extremos), quite las filas repetidas de `paises`, haga un `merge` por la izquierda y devuelva cuántas incidencias se quedan sin país (un entero)."],
        fn: "sin_pais", starter: starterWith(HEAD_PD, "sin_pais", "df, paises"), cases, packages: PANDAS, seconds: DATA_SECONDS,
        hints: ["Normaliza con .str.strip().str.lower() antes de unir: si no, casi nada casa.", "drop_duplicates() quita las filas repetidas.", "Tras el merge, cuenta los NaN de pais con isna().sum() (y conviértelo con int())."],
        solution: py`
          import numpy as np
          import pandas as pd


          def sin_pais(df, paises):
              df = df.copy()
              df["lugar"] = df["lugar"].str.strip().str.lower()
              unidas = df.merge(paises.drop_duplicates(), on="lugar", how="left")
              return int(unidas["pais"].isna().sum())
        `,
      };
    }
    const cases = [40, 80, 120].map((rows) => {
      const d = data(rows);
      return dataCase(files(d), both, "por_pais(df, paises)");
    });
    return {
      kind: "code", tema: 10, template: "pandas-combinar", title: "Incidencias por país",
      statement: [
        head,
        "Escribe `por_pais(df, paises)`, que normalice `lugar`, quite las repetidas de `paises`, una las dos tablas por la izquierda y devuelva una Series con cuántas incidencias hay de cada país, contando las que no tienen país como `'desconocido'`, ordenada por el código.",
        "Cuidado: si no quitas las repetidas, el merge duplica incidencias.",
      ],
      fn: "por_pais", starter: starterWith(HEAD_PD, "por_pais", "df, paises"), cases, packages: PANDAS, seconds: DATA_SECONDS,
      hints: ["Primero los mismos pasos que en el nivel medio.", "fillna(\"desconocido\") en la columna pais antes de agrupar.", "groupby(\"pais\").size() cuenta y ya ordena por el código."],
      solution: py`
        import numpy as np
        import pandas as pd


        def por_pais(df, paises):
            df = df.copy()
            df["lugar"] = df["lugar"].str.strip().str.lower()
            unidas = df.merge(paises.drop_duplicates(), on="lugar", how="left")
            unidas["pais"] = unidas["pais"].fillna("desconocido")
            return unidas.groupby("pais").size()
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 11: gráficos con requisitos

const GRAFICOS: Tpl = {
  id: "graficos",
  tema: 11,
  make(rng, level) {
    if (level === "básico") {
      const [w, h] = rng.pick<[number, number]>([[8, 4], [7, 3], [9, 5], [6, 4]]);
      const [x, y] = rng.pick<[string, string]>([["parcial", "final"], ["practicas", "final"], ["parcial", "practicas"]]);
      const cases: PyCase[] = [10, 14].map((n) => {
        const g = grades(dataSeed(rng), n);
        return {
          code: `${HEAD_PLT}df = pd.read_csv("${g.file}")\ndispersion(df)`,
          files: { [g.file]: g.csv },
          compare: [],
          checks: [
            check("fig-una", "Dibuja una sola figura"),
            check("fig-tamano", `La figura mide ${w} × ${h} pulgadas (figsize)`),
            check("fig-tipo", "Es un gráfico de dispersión"),
            check("fig-puntos", `Un punto por estudiante: (${x}, ${y})`),
            check("fig-titulo", "Tiene título"),
            check("fig-etiquetas", "Los dos ejes tienen nombre"),
          ],
        };
      });
      return {
        kind: "code", tema: 11, template: "graficos", title: "Dispersión con figsize",
        statement: [
          "`notas.csv` tiene las columnas `nombre, grupo, parcial, final, practicas`.",
          `Escribe \`dispersion(df)\`, que dibuje un gráfico de dispersión con \`${x}\` en el eje x y \`${y}\` en el eje y, en una figura de \`figsize=(${w}, ${h})\`, con título y nombre en los dos ejes. No hace falta devolver nada ni llamar a \`plt.show()\`.`,
        ],
        fn: "dispersion", starter: starterWith(HEAD_PLT, "dispersion", "df"), cases, packages: PLOTS, seconds: PLOT_SECONDS,
        hints: ["plt.figure(figsize=…) o plt.subplots(figsize=…) crean la figura con su tamaño.", "plt.scatter (o ax.scatter) dibuja puntos sueltos; plt.plot dibujaría líneas.", "title, xlabel e ylabel (o set_title, set_xlabel y set_ylabel en un eje) ponen los textos."],
        solution: `${HEAD_PLT}\n\ndef dispersion(df):\n    fig, ax = plt.subplots(figsize=(${w}, ${h}))\n    ax.scatter(df["${x}"], df["${y}"])\n    ax.set_title("${cap1(y)} frente a ${x}")\n    ax.set_xlabel("${x}")\n    ax.set_ylabel("${y}")\n`,
      };
    }
    if (level === "medio") {
      const cases: PyCase[] = [24, 30].map((rows) => {
        const d = salesFor(rng, rows, false);
        return {
          code: `${HEAD_PLT}${SALES_CLEAN}\nbarras(df)`,
          files: { [d.file]: d.csv },
          compare: [],
          checks: [
            check("fig-ejes", "Tiene dos gráficos, uno al lado del otro"),
            check("fig-tamano", "La figura mide 12 × 4 pulgadas (figsize)"),
            check("fig-tipo", "Los dos son de barras"),
            check("fig-alturas", "Izquierda: las barras son las sumas de total (estimator=\"sum\")", 0),
            check("fig-alturas", "Derecha: las barras son las sumas de cantidad (estimator=\"sum\")", 1),
            check("fig-leyenda", "La leyenda muestra las formas de pago (hue)"),
          ],
        };
      });
      return {
        kind: "code", tema: 11, template: "graficos", title: "Dos barplots con hue y estimator",
        statement: [
          `${SALES_HEAD} El caso la lee con los NaN puestos y las columnas numéricas convertidas.`,
          "Escribe `barras(df)`, que dibuje con seaborn, en una figura de `figsize=(12, 4)`, dos gráficos de barras uno al lado del otro: a la izquierda, el `total` vendido por `local`; a la derecha, la `cantidad` por `local`. En los dos, las barras son sumas (`estimator=\"sum\"`) y el color distingue la forma de pago (`hue=\"pago\"`).",
          "Las barras de error no hacen falta (`errorbar=None`).",
        ],
        fn: "barras", starter: starterWith(HEAD_PLT, "barras", "df"), cases, packages: PLOTS, seconds: PLOT_SECONDS,
        hints: ["plt.subplots(1, 2, figsize=…) da la figura y una lista con los dos ejes.", "sns.barplot acepta data, x, y, hue, estimator y ax (el eje donde dibuja).", "Sin estimator, barplot dibuja la media, no la suma."],
        solution: py`
          import matplotlib.pyplot as plt
          import pandas as pd
          import seaborn as sns


          def barras(df):
              fig, (izq, der) = plt.subplots(1, 2, figsize=(12, 4))
              sns.barplot(data=df, x="local", y="total", hue="pago", estimator="sum", errorbar=None, ax=izq)
              sns.barplot(data=df, x="local", y="cantidad", hue="pago", estimator="sum", errorbar=None, ax=der)
              izq.set_title("Total vendido")
              der.set_title("Unidades")
        `,
      };
    }
    const cases: PyCase[] = [60, 90].map((rows) => {
      const d = incidents(dataSeed(rng), { rows });
      return {
        code: `${HEAD_PLT}df = pd.read_csv("${d.file}")\nlineas(df)`,
        files: { [d.file]: d.csv },
        compare: [],
        checks: [
          check("fig-ejes", "Un gráfico por categoría"),
          check("fig-tipo", "Todos son de líneas"),
          check("fig-lineas", "Cada línea tiene las incidencias de cada año de su categoría"),
          check("fig-titulo", "Cada gráfico tiene título"),
        ],
      };
    });
    return {
      kind: "code", tema: 11, template: "graficos", title: "Un gráfico de líneas por categoría",
      statement: [
        INC_HEAD,
        "Escribe `lineas(df)`, que dibuje una figura con un gráfico de líneas por categoría (en orden alfabético, uno debajo de otro) con el número de incidencias de cada año de esa categoría (solo los años en que hay alguna, en orden), y el nombre de la categoría como título de cada gráfico. Las filas sin categoría o sin fecha no cuentan.",
      ],
      fn: "lineas", starter: starterWith(HEAD_PLT, "lineas", "df"), cases, packages: PLOTS, seconds: PLOT_SECONDS,
      hints: [
        "Saca el año con pd.to_datetime(…).dt.year y cuenta por categoría y año con groupby([…]).size().",
        "plt.subplots(n, 1) da n ejes uno debajo de otro; recórrelos a la vez que las categorías (zip).",
        "En cada eje, plot con los años y los recuentos de su categoría, y set_title con su nombre.",
      ],
      solution: py`
        import matplotlib.pyplot as plt
        import pandas as pd
        import seaborn as sns


        def lineas(df):
            df = df.dropna(subset=["categoria", "fecha"]).copy()
            df["anio"] = pd.to_datetime(df["fecha"], format="%Y-%m-%d").dt.year
            cuentas = df.groupby(["categoria", "anio"]).size()
            categorias = sorted(df["categoria"].unique())
            fig, ejes = plt.subplots(len(categorias), 1, figsize=(8, 2 * len(categorias)), sharex=True, squeeze=False)
            for eje, categoria in zip(ejes[:, 0], categorias):
                serie = cuentas.loc[categoria]
                eje.plot(serie.index, serie.values, marker="o")
                eje.set_title(categoria)
            fig.tight_layout()
      `,
    };
  },
};

function cap1(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------- Tipos

export type PyDataTypeDef = { id: string; title: string; description: string; templates: Tpl[] };

/** Los tipos de los temas 6 a 13 (y los de examen de los temas 3 y 4), en el orden en que se muestran. */
export const DATA_TYPES: PyDataTypeDef[] = [
  { id: "py-bug", title: "Encuentra el bug", description: "Tema 4: corrige una función que falla sin cambiar su firma (comparaciones, rangos, valores por defecto mutables, alias y clausuras).", templates: [BUG] },
  { id: "py-una-linea", title: "En una línea", description: "Tema 3: reescribe un bucle con if anidados como una sola comprensión.", templates: [UNA_LINEA] },
  { id: "py-clases", title: "Clases y objetos", description: "Tema 6: clases con métodos, herencia, métodos especiales y propiedades.", templates: [CLASES] },
  { id: "py-avanzado", title: "Python avanzado", description: "Tema 7: collections.Counter, decoradores y heapq.", templates: [AVANZADO] },
  { id: "py-numpy-mascaras", title: "NumPy: matrices y máscaras", description: "Tema 8: operaciones por columnas, semillas, máscaras booleanas, NaN y quitar columnas.", templates: [NP_MASCARAS] },
  { id: "py-numpy-sistemas", title: "Sistemas con NumPy", description: "Tema 8: np.linalg.solve, comprobar con np.allclose y matrices singulares.", templates: [NP_SISTEMAS] },
  { id: "py-pandas-fechas", title: "pandas: fechas y cadenas", description: "Tema 9: partir «Título - Año», to_datetime y .dt.year, str.strip y str.lower.", templates: [FECHAS] },
  { id: "py-pandas-agrupar", title: "pandas: agrupar y pivotar", description: "Tema 10: porcentaje de nulos, groupby con size y sum, y pivot_table.", templates: [AGRUPAR] },
  { id: "py-pandas-combinar", title: "pandas: combinar", description: "Tema 10: merge por la izquierda, claves normalizadas, repetidas y lo que no casa.", templates: [COMBINAR] },
  { id: "py-graficos", title: "Gráficos con requisitos", description: "Tema 11: dispersión con figsize, barplots con hue y estimator=\"sum\" y un gráfico por categoría (se comprueba la figura).", templates: [GRAFICOS] },
  { id: "py-pandas-nulos", title: "pandas: valores perdidos", description: "Tema 12: isna, dropna con thresh, interpolate y rellenar los extremos.", templates: [NULOS] },
  { id: "py-pandas-limpiar", title: "pandas: limpiar y convertir", description: "Tema 12: tokens a NaN, to_numeric, precio por moda y total = precio × cantidad.", templates: [LIMPIAR] },
  { id: "py-generadores", title: "Generadores", description: "Tema 13: yield, generadores sobre las filas de un DataFrame e iterables infinitos.", templates: [GENERADORES] },
];
