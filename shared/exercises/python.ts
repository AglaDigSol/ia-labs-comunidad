// Ejercicios de Python (01MIAR, temas 1 a 5). Cada plantilla genera, con semilla y nivel, un enunciado
// en español, el código inicial, los casos de prueba (llamadas con datos generados y, en el tema 5,
// archivos de entrada) y una solución de referencia en Python. La corrección la hace el banco de
// pruebas en el worker de Pyodide (src/features/labs/exercises/python/harness.ts): ejecuta la
// referencia y el código de la persona en cada caso y compara, sin mostrar nunca el valor esperado.
// La solución solo se enseña detrás de «Ver la solución completa». Las pistas no llevan código.
// «¿Qué imprime?» genera un fragmento corto; su salida la calcula Python al comprobar.
// Contenido original (no procede de los cuadernos de la asignatura). Solo existe con el módulo Python.
import { rngFor, type Rng } from "./random.ts";
import type { ExerciseLevel, ExerciseType } from "./types.ts";

export type PyTema = 1 | 2 | 3 | 4 | 5;

/** Qué se compara con la referencia en un caso: lo que devuelve, lo que imprime o un archivo. */
export type PyCompare = "valor" | "salida" | `archivo:${string}`;

export interface PyCase {
  /** Código del caso, tal como se muestra: la última línea es la expresión que se evalúa. */
  code: string;
  /** Por defecto, ["valor"]. */
  compare?: PyCompare[];
  /** Archivos de entrada (texto UTF-8) en la carpeta de trabajo del caso. */
  files?: Record<string, string>;
}

/** Requisito sobre el código (se comprueba con ast): «usa una comprensión», «sin if»… */
export interface PyRule {
  kind: "usa" | "evita";
  /** comprension | nodo:<clase de ast> | llamada:<nombre> | recursion:<función> | modulo:<módulo> */
  what: string;
  label: string;
}

export interface PyCodeInstance {
  kind: "code";
  tema: PyTema;
  template: string;
  title: string;
  /** Párrafos; lo que va entre `comillas invertidas` se muestra como código. */
  statement: string[];
  /** Función que hay que definir. */
  fn: string;
  starter: string;
  cases: PyCase[];
  /** Pistas graduadas, de la más general a la más concreta. Nunca código de la solución. */
  hints: string[];
  /** Solo para el banco de pruebas y para «Ver la solución completa». */
  solution: string;
  rules?: PyRule[];
}

export interface PyOutputInstance {
  kind: "output";
  tema: PyTema;
  template: string;
  title: string;
  code: string;
  hints: string[];
}

export type PyInstance = PyCodeInstance | PyOutputInstance;

/** Tema de 01MIAR de cada número. */
export const PY_TEMAS: Record<PyTema, string> = {
  1: "Tema 1 · Introducción a Python",
  2: "Tema 2 · Tipos de datos",
  3: "Tema 3 · Estructuras de control",
  4: "Tema 4 · Funciones",
  5: "Tema 5 · Ficheros",
};

// ---------------------------------------------------------------- Utilidades

/** Quita el salto inicial y la sangría común (para escribir el código Python sangrado en el TS). */
export function dedent(text: string): string {
  const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const indents = lines.filter((l) => l.trim() !== "").map((l) => /^ */.exec(l)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return `${lines.map((l) => l.slice(cut)).join("\n")}\n`;
}

/** Código Python: String.raw (las barras invertidas quedan tal cual) y sin la sangría común. */
const py = (s: TemplateStringsArray, ...v: unknown[]) => dedent(String.raw(s, ...v));

/** Tupla de Python (en JS, un array se escribe como lista). */
export class Tup {
  readonly items: readonly PyVal[];
  constructor(items: readonly PyVal[]) {
    this.items = items;
  }
}
export type PyVal = string | number | boolean | null | Tup | readonly PyVal[] | { readonly [k: string]: PyVal };

const tup = (...items: PyVal[]) => new Tup(items);

/** Literal de Python para un valor de los datos de prueba. */
export function lit(v: PyVal): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("número no finito");
    return String(v);
  }
  if (typeof v === "string") {
    const body = v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    return `'${body}'`;
  }
  if (v instanceof Tup) return v.items.length === 1 ? `(${lit(v.items[0]!)},)` : `(${v.items.map(lit).join(", ")})`;
  if (Array.isArray(v)) return `[${v.map(lit).join(", ")}]`;
  return `{${Object.entries(v as Record<string, PyVal>)
    .map(([k, x]) => `${lit(k)}: ${lit(x)}`)
    .join(", ")}}`;
}

/** Llamada con los argumentos como literales: call("es_par", 7) → "es_par(7)". */
const call = (fn: string, ...args: PyVal[]) => `${fn}(${args.map(lit).join(", ")})`;

/** Casos de una función: una llamada por cada lista de argumentos. */
const calls = (fn: string, argLists: PyVal[][]): PyCase[] => argLists.map((a) => ({ code: call(fn, ...a) }));

/** Código inicial: la cabecera de la función y un pass. */
const starterOf = (fn: string, params: string, note = "Escribe aquí tu código") => `def ${fn}(${params}):\n    # ${note}\n    pass\n`;

const WORDS = [
  "sol", "luna", "rio", "mar", "casa", "arbol", "nube", "piedra", "camino", "libro", "mesa", "flor", "puerta", "monte",
  "viento", "fuego", "tierra", "agua", "verde", "azul", "gato", "perro", "lago", "isla", "valle", "torre", "puente",
  "reloj", "papel", "barco", "hoja", "raiz", "cielo", "playa", "nieve", "campo",
] as const;
const SYLLABLES = ["ka", "lo", "mi", "ra", "te", "su", "no", "vi", "da", "ze", "pa", "ri", "bo", "le", "xa", "tu", "me", "ni"] as const;

/** Palabra inventada de 2 o 3 sílabas (para nombres: así no hay nombres reales). */
const invented = (rng: Rng) => Array.from({ length: rng.int(2, 3) }, () => rng.pick(SYLLABLES)).join("");
const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);
/** Varios nombres inventados distintos, con mayúscula. */
function names(rng: Rng, n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(cap(invented(rng)));
  return [...out];
}
const words = (rng: Rng, n: number): string[] => Array.from({ length: n }, () => rng.pick(WORDS));
const distinctWords = (rng: Rng, n: number): string[] => rng.shuffle(WORDS).slice(0, n);
const ints = (rng: Rng, n: number, min: number, max: number) => Array.from({ length: n }, () => rng.int(min, max));
/** Un número con como mucho dos decimales (múltiplo de 0,25 para no arrastrar errores de redondeo). */
const quarter = (rng: Rng, min: number, max: number) => rng.int(min * 4, max * 4) / 4;

type Make = (rng: Rng, level: ExerciseLevel) => PyCodeInstance;
type Tpl = { id: string; tema: PyTema; make: Make };

const USA_FOR: PyRule = { kind: "usa", what: "nodo:For", label: "Usa un bucle for" };
const USA_WHILE: PyRule = { kind: "usa", what: "nodo:While", label: "Usa un bucle while" };
const USA_COMP: PyRule = { kind: "usa", what: "comprension", label: "Usa una comprensión" };
const USA_DICTCOMP: PyRule = { kind: "usa", what: "nodo:DictComp", label: "Usa una comprensión de diccionario" };
const USA_WITH: PyRule = { kind: "usa", what: "nodo:With", label: "Abre el archivo con with" };
const USA_CSV: PyRule = { kind: "usa", what: "modulo:csv", label: "Usa el módulo csv" };
const USA_ZIP: PyRule = { kind: "usa", what: "llamada:zip", label: "Usa zip()" };
const USA_LAMBDA: PyRule = { kind: "usa", what: "nodo:Lambda", label: "Usa una lambda" };
const recursive = (fn: string): PyRule => ({ kind: "usa", what: `recursion:${fn}`, label: `${fn} se llama a sí misma (recursión)` });

// ---------------------------------------------------------------- Tema 1–2: variables, operadores y tipos

const TIEMPO: Tpl = {
  id: "tiempo",
  tema: 1,
  make(rng, level) {
    const secs = [0, 59, 60, ...ints(rng, 3, 61, level === "básico" ? 9999 : 99_999)];
    const hints = [
      "Piensa cuántos segundos tiene un minuto y cuántos tiene una hora.",
      "La división entera (//) dice cuántas veces cabe un número en otro y el resto (%) lo que sobra.",
      level === "avanzado"
        ? "Calcula primero las horas, los minutos y los segundos; después da formato a cada uno con dos cifras (un f-string con :02d)."
        : "Devuelve los números separados por comas: Python los junta en una tupla.",
    ];
    if (level === "básico") {
      return {
        kind: "code", tema: 1, template: "tiempo", title: "Segundos a minutos",
        statement: [
          "Escribe la función `a_minutos(segundos)` que reciba un número entero de segundos y devuelva una tupla `(minutos, segundos)` con los minutos completos y los segundos que sobran.",
          "Por ejemplo, `a_minutos(130)` devuelve `(2, 10)`.",
        ],
        fn: "a_minutos", starter: starterOf("a_minutos", "segundos"), cases: calls("a_minutos", secs.map((s) => [s])), hints,
        solution: py`
          def a_minutos(segundos):
              return segundos // 60, segundos % 60
        `,
      };
    }
    if (level === "medio") {
      return {
        kind: "code", tema: 1, template: "tiempo", title: "Segundos a horas",
        statement: [
          "Escribe la función `a_horas(segundos)` que devuelva una tupla `(horas, minutos, segundos)` a partir de un número entero de segundos.",
          "Por ejemplo, `a_horas(3725)` devuelve `(1, 2, 5)`.",
        ],
        fn: "a_horas", starter: starterOf("a_horas", "segundos"), cases: calls("a_horas", secs.map((s) => [s])), hints,
        solution: py`
          def a_horas(segundos):
              horas = segundos // 3600
              minutos = segundos % 3600 // 60
              return horas, minutos, segundos % 60
        `,
      };
    }
    return {
      kind: "code", tema: 1, template: "tiempo", title: "Reloj HH:MM:SS",
      statement: [
        "Escribe la función `reloj(segundos)` que devuelva un texto con el formato `HH:MM:SS`: horas, minutos y segundos con dos cifras cada uno (con un cero delante si hace falta).",
        "Por ejemplo, `reloj(3725)` devuelve `'01:02:05'`.",
      ],
      fn: "reloj", starter: starterOf("reloj", "segundos"), cases: calls("reloj", secs.map((s) => [s])), hints,
      solution: py`
        def reloj(segundos):
            horas = segundos // 3600
            minutos = segundos % 3600 // 60
            return f"{horas:02d}:{minutos:02d}:{segundos % 60:02d}"
      `,
    };
  },
};

const TEMPERATURA: Tpl = {
  id: "temperatura",
  tema: 2,
  make(rng, level) {
    const hints = [
      "Escribe primero la fórmula en papel y comprueba un valor conocido: 0 °C son 32 °F y 100 °C son 212 °F.",
      "Cuidado con el orden de las operaciones: usa paréntesis donde haga falta.",
      level === "básico" ? "La división / siempre da un float en Python 3." : "round(x, n) redondea x a n decimales.",
    ];
    if (level === "básico") {
      const cs = [0, 100, -40, ...ints(rng, 2, -30, 45), quarter(rng, -10, 40)];
      return {
        kind: "code", tema: 2, template: "temperatura", title: "Celsius a Fahrenheit",
        statement: [
          "Escribe la función `celsius_a_fahrenheit(c)` que convierta una temperatura de grados Celsius a Fahrenheit con la fórmula F = C · 9 / 5 + 32. Devuelve el resultado sin redondear.",
        ],
        fn: "celsius_a_fahrenheit", starter: starterOf("celsius_a_fahrenheit", "c"), cases: calls("celsius_a_fahrenheit", cs.map((c) => [c])), hints,
        solution: py`
          def celsius_a_fahrenheit(c):
              return c * 9 / 5 + 32
        `,
      };
    }
    if (level === "medio") {
      const fs = [32, 212, ...ints(rng, 3, -20, 110), quarter(rng, 0, 100)];
      return {
        kind: "code", tema: 2, template: "temperatura", title: "Fahrenheit a Celsius",
        statement: [
          "Escribe la función `fahrenheit_a_celsius(f)` que convierta grados Fahrenheit a Celsius (C = (F − 32) · 5 / 9) y devuelva el resultado redondeado a un decimal con `round`.",
        ],
        fn: "fahrenheit_a_celsius", starter: starterOf("fahrenheit_a_celsius", "f"), cases: calls("fahrenheit_a_celsius", fs.map((f) => [f])), hints,
        solution: py`
          def fahrenheit_a_celsius(f):
              return round((f - 32) * 5 / 9, 1)
        `,
      };
    }
    const args: PyVal[][] = [[0, "C"], [212, "F"], [rng.int(-20, 40), "C"], [rng.int(0, 100), "F"], [quarter(rng, 0, 30), "C"], [rng.int(1, 50), "K"]];
    return {
      kind: "code", tema: 2, template: "temperatura", title: "Conversor de temperaturas",
      statement: [
        "Escribe la función `convertir(valor, escala)`. Si `escala` es `'C'`, `valor` está en Celsius y devuelve su equivalente en Fahrenheit; si es `'F'`, al revés. Redondea el resultado a dos decimales.",
        "Con cualquier otra escala, devuelve `None`.",
      ],
      fn: "convertir", starter: starterOf("convertir", "valor, escala"), cases: calls("convertir", args), hints,
      solution: py`
        def convertir(valor, escala):
            if escala == "C":
                return round(valor * 9 / 5 + 32, 2)
            if escala == "F":
                return round((valor - 32) * 5 / 9, 2)
            return None
      `,
    };
  },
};

const PRECIO: Tpl = {
  id: "precio",
  tema: 2,
  make(rng, level) {
    const iva = rng.pick([21, 10, 4]);
    const desc = rng.pick([5, 10, 15, 20]);
    const umbral = rng.pick([3, 5, 10]);
    const precios = Array.from({ length: 5 }, () => rng.int(100, 9999) / 100);
    const hints = [
      `Un IVA del ${iva} % significa multiplicar por 1 + ${iva}/100.`,
      level === "básico" ? "Redondea al final, no en cada paso." : `El descuento solo se aplica cuando las unidades llegan a ${umbral}: eso es una condición.`,
      level === "avanzado" ? "Un f-string con :.2f escribe un número con dos decimales." : "round(x, 2) deja dos decimales.",
    ];
    if (level === "básico") {
      return {
        kind: "code", tema: 2, template: "precio", title: "Precio con IVA",
        statement: [`Escribe la función \`precio_con_iva(precio)\` que devuelva el precio con un IVA del ${iva} %, redondeado a dos decimales.`],
        fn: "precio_con_iva", starter: starterOf("precio_con_iva", "precio"), cases: calls("precio_con_iva", precios.map((p) => [p])), hints,
        solution: py`
          def precio_con_iva(precio):
              return round(precio * (1 + ${iva} / 100), 2)
        `,
      };
    }
    const unidades = [1, umbral - 1, umbral, umbral + rng.int(1, 5), rng.int(1, 20)];
    const args: PyVal[][] = unidades.map((u, i) => [precios[i]!, u]);
    const body = py`
          base = precio * unidades
          if unidades >= ${umbral}:
              base = base * (1 - ${desc} / 100)
          total = round(base * (1 + ${iva} / 100), 2)
    `.replace(/^/gm, "    ").trimEnd();
    if (level === "medio") {
      return {
        kind: "code", tema: 2, template: "precio", title: "Total con descuento",
        statement: [
          `Escribe la función \`total(precio, unidades)\`: multiplica el precio por las unidades, aplica un descuento del ${desc} % si se compran ${umbral} unidades o más y, después, un IVA del ${iva} %. Devuelve el total redondeado a dos decimales.`,
        ],
        fn: "total", starter: starterOf("total", "precio, unidades"), cases: calls("total", args), hints,
        solution: `def total(precio, unidades):\n${body}\n    return total\n`,
      };
    }
    return {
      kind: "code", tema: 2, template: "precio", title: "Línea del ticket",
      statement: [
        `Escribe la función \`ticket(precio, unidades)\` que calcule el total como en una tienda: descuento del ${desc} % a partir de ${umbral} unidades y después IVA del ${iva} %, redondeado a dos decimales.`,
        `Devuelve un texto como \`'2 x 2.50 € = ${((5 * (100 + iva)) / 100).toFixed(2)} €'\`: las unidades, el precio unitario y el total, ambos con dos decimales.`,
      ],
      fn: "ticket", starter: starterOf("ticket", "precio, unidades"), cases: calls("ticket", args), hints,
      solution: `def ticket(precio, unidades):\n${body}\n    return f"{unidades} x {precio:.2f} € = {total:.2f} €"\n`,
    };
  },
};

const TEXTO_NUMERO: Tpl = {
  id: "texto-numero",
  tema: 2,
  make(rng, level) {
    if (level === "básico") {
      const args: PyVal[][] = Array.from({ length: 5 }, () => [String(rng.int(-500, 999)), String(rng.int(0, 999))]);
      return {
        kind: "code", tema: 2, template: "texto-numero", title: "Sumar números escritos como texto",
        statement: ["Escribe la función `sumar_textos(a, b)` que reciba dos textos con números enteros (como `'12'` y `'30'`) y devuelva su suma como número entero."],
        fn: "sumar_textos", starter: starterOf("sumar_textos", "a, b"), cases: calls("sumar_textos", args),
        hints: ["Con + dos textos se pegan uno detrás de otro: primero hay que convertirlos.", "int() convierte un texto con un número entero en un int.", "Convierte cada parámetro y suma los resultados."],
        solution: py`
          def sumar_textos(a, b):
              return int(a) + int(b)
        `,
      };
    }
    if (level === "medio") {
      const dec = () => `${rng.int(0, 99)},${rng.int(0, 99)}`;
      const args: PyVal[][] = [[dec(), dec()], [dec(), String(rng.int(1, 9))], [dec(), dec()], ["0,5", "0,25"], [dec(), dec()]];
      return {
        kind: "code", tema: 2, template: "texto-numero", title: "Decimales con coma",
        statement: [
          "En España los decimales se escriben con coma. Escribe la función `sumar_decimales(a, b)` que reciba dos textos como `'3,5'` y `'1,25'` y devuelva su suma como float (`4.75`).",
        ],
        fn: "sumar_decimales", starter: starterOf("sumar_decimales", "a, b"), cases: calls("sumar_decimales", args),
        hints: ["float() solo entiende el punto como separador decimal.", "Los textos tienen un método para cambiar un carácter por otro.", "Cambia la coma por un punto en cada texto, conviértelos y súmalos."],
        solution: py`
          def sumar_decimales(a, b):
              return float(a.replace(",", ".")) + float(b.replace(",", "."))
        `,
      };
    }
    const n = rng.int(1, 999);
    const pool = [` ${n} `, `-${n}`, `+${rng.int(0, 99)}`, `${n}.5`, "", "abc", `${n}a`, "-", ` -${rng.int(1, 9)}`, `${rng.int(1, 9)} ${rng.int(1, 9)}`];
    const texts = rng.shuffle(pool).slice(0, 7);
    if (!texts.includes("-")) texts.push("-");
    return {
      kind: "code", tema: 2, template: "texto-numero", title: "¿Es un entero válido?",
      statement: [
        "Escribe la función `es_entero(texto)` que devuelva `True` si el texto, sin los espacios de los extremos, es un número entero escrito con cifras y, como mucho, un signo `+` o `-` delante. Si no, `False`.",
        "Por ejemplo, `es_entero(' -12 ')` es `True` y `es_entero('4.5')` es `False`.",
      ],
      fn: "es_entero", starter: starterOf("es_entero", "texto"), cases: calls("es_entero", texts.map((t) => [t])),
      hints: [
        "Divide el problema: primero limpia los espacios, después mira el signo y al final las cifras.",
        "Hay métodos de str para quitar espacios de los extremos y para saber si todos los caracteres son cifras.",
        "Ojo con los casos raros: un texto vacío o un signo solo no son números.",
      ],
      solution: py`
        def es_entero(texto):
            t = texto.strip()
            if t[:1] in ("+", "-"):
                t = t[1:]
            return t.isdigit()
      `,
    };
  },
};

const BOOLEANOS: Tpl = {
  id: "booleanos",
  tema: 2,
  make(rng, level) {
    if (level === "básico") {
      const k = rng.pick([3, 4, 6, 7, 9]);
      const ns = [0, k, k * rng.int(2, 9), k * rng.int(2, 9) + rng.int(1, k - 1), -k * rng.int(1, 5), rng.int(1, 100)];
      return {
        kind: "code", tema: 2, template: "booleanos", title: `¿Múltiplo de ${k}?`,
        statement: [`Escribe la función \`es_multiplo(n)\` que devuelva \`True\` si el entero \`n\` es múltiplo de ${k} y \`False\` si no.`],
        fn: "es_multiplo", starter: starterOf("es_multiplo", "n"), cases: calls("es_multiplo", ns.map((x) => [x])),
        hints: ["Un número es múltiplo de otro si al dividirlos no sobra nada.", "El operador % da el resto de la división.", "Una comparación con == ya es un valor booleano: puedes devolverla directamente."],
        solution: py`
          def es_multiplo(n):
              return n % ${k} == 0
        `,
      };
    }
    const years = [1900, 2000, 2024, 2023, rng.int(1, 499) * 4, rng.int(1000, 2999), rng.pick([1700, 1800, 2100, 2200])];
    const rules: PyRule[] | undefined =
      level === "avanzado"
        ? [
            { kind: "evita", what: "nodo:If", label: "Sin if: una sola expresión booleana" },
            { kind: "evita", what: "nodo:IfExp", label: "Sin el operador ternario (x if c else y)" },
          ]
        : undefined;
    return {
      kind: "code", tema: 2, template: "booleanos", title: level === "medio" ? "Año bisiesto" : "Año bisiesto sin if",
      statement: [
        "Escribe la función `es_bisiesto(anio)`. Un año es bisiesto si es divisible entre 4, salvo los divisibles entre 100, que solo lo son si también son divisibles entre 400.",
        ...(level === "avanzado" ? ["Hazlo sin `if`: devuelve directamente una expresión con `and`, `or` y `not`."] : []),
      ],
      fn: "es_bisiesto", starter: starterOf("es_bisiesto", "anio"), cases: calls("es_bisiesto", years.map((y) => [y])),
      hints: [
        "Prueba la regla a mano con 1900 (no es bisiesto), 2000 (sí) y 2024 (sí).",
        "Hay dos formas de ser bisiesto: divisible entre 4 y no entre 100, o divisible entre 400.",
        level === "avanzado" ? "Une las dos formas con or; cada una es una comparación de restos." : "Puedes comprobar primero el caso de 400, después el de 100 y por último el de 4.",
      ],
      solution: py`
        def es_bisiesto(anio):
            return (anio % 4 == 0 and anio % 100 != 0) or anio % 400 == 0
      `,
      ...(rules ? { rules } : {}),
    };
  },
};

// ---------------------------------------------------------------- Tema 2: cadenas

/** Palíndromo al azar (de letras) y, a veces, estropeado en una letra. */
function palindrome(rng: Rng, len: number): string {
  const half = Array.from({ length: Math.floor(len / 2) }, () => rng.pick("abdelmnoprst".split(""))).join("");
  const mid = len % 2 ? rng.pick("aeiou".split("")) : "";
  return half + mid + [...half].reverse().join("");
}

const CAPICUA: Tpl = {
  id: "capicua",
  tema: 2,
  make(rng, level) {
    if (level === "básico") {
      const ts = [...words(rng, 3), "a", "", `${rng.pick(WORDS)} ${rng.pick(WORDS)}`];
      return {
        kind: "code", tema: 2, template: "capicua", title: "Invertir un texto",
        statement: ["Escribe la función `invertir(texto)` que devuelva el texto al revés. Por ejemplo, `invertir('hola')` devuelve `'aloh'`."],
        fn: "invertir", starter: starterOf("invertir", "texto"), cases: calls("invertir", ts.map((t) => [t])),
        hints: ["Las rebanadas (slicing) aceptan un tercer número: el paso.", "Un paso negativo recorre el texto desde el final.", "También puedes construir el resultado con un bucle, añadiendo cada letra delante."],
        solution: py`
          def invertir(texto):
              return texto[::-1]
        `,
      };
    }
    if (level === "medio") {
      const ts = [palindrome(rng, rng.int(3, 7)), cap(palindrome(rng, rng.int(4, 8))), rng.pick(WORDS), "", palindrome(rng, 5).toUpperCase(), `${palindrome(rng, 4)}x`];
      return {
        kind: "code", tema: 2, template: "capicua", title: "¿Es capicúa?",
        statement: ["Escribe la función `es_capicua(palabra)` que devuelva `True` si la palabra se lee igual al derecho y al revés, sin distinguir mayúsculas de minúsculas (`'Radar'` lo es)."],
        fn: "es_capicua", starter: starterOf("es_capicua", "palabra"), cases: calls("es_capicua", ts.map((t) => [t])),
        hints: ["Primero pasa la palabra a minúsculas para que 'R' y 'r' cuenten igual.", "Compara la palabra con su versión invertida.", "La comparación con == ya devuelve True o False."],
        solution: py`
          def es_capicua(palabra):
              p = palabra.lower()
              return p == p[::-1]
        `,
      };
    }
    const spaced = (s: string) => {
      const chars = [...s];
      const at = rng.int(1, Math.max(1, chars.length - 1));
      chars.splice(at, 0, rng.pick([" ", ", ", " ", "! "]));
      return chars.map((c, i) => (i === 0 ? c.toUpperCase() : c)).join("");
    };
    const ts = [spaced(palindrome(rng, 7)), spaced(palindrome(rng, 6)), `${spaced(palindrome(rng, 5))}.`, `${rng.pick(WORDS)} ${rng.pick(WORDS)}`, spaced(`${palindrome(rng, 6)}z`), "¡!"];
    return {
      kind: "code", tema: 2, template: "capicua", title: "Frase capicúa",
      statement: [
        "Escribe la función `es_frase_capicua(frase)` que diga si la frase es capicúa teniendo en cuenta solo las letras y las cifras: sin mayúsculas, espacios ni signos de puntuación.",
        "Por ejemplo, `es_frase_capicua('Ana, lava lana')` es `True`. Una frase sin letras ni cifras también lo es.",
      ],
      fn: "es_frase_capicua", starter: starterOf("es_frase_capicua", "frase"), cases: calls("es_frase_capicua", ts.map((t) => [t])),
      hints: [
        "Primero construye un texto limpio y después comprueba si es capicúa.",
        "str tiene un método que dice si un carácter es letra o cifra.",
        "Recorre la frase en minúsculas y quédate solo con los caracteres que te interesan.",
      ],
      solution: py`
        def es_frase_capicua(frase):
            limpio = "".join(c for c in frase.lower() if c.isalnum())
            return limpio == limpio[::-1]
      `,
    };
  },
};

const VOCALES: Tpl = {
  id: "vocales",
  tema: 2,
  make(rng, level) {
    const phrase = () => words(rng, rng.int(2, 5)).join(" ");
    if (level === "básico") {
      const letra = rng.pick(["a", "e", "o", "r", "n", "s"]);
      const ts = [phrase(), phrase(), "", letra.repeat(3), phrase().toUpperCase()];
      return {
        kind: "code", tema: 2, template: "vocales", title: `¿Cuántas «${letra}»?`,
        statement: [`Escribe la función \`contar_letra(texto)\` que devuelva cuántas veces aparece la letra \`'${letra}'\` (en minúscula) en el texto. Las mayúsculas no cuentan.`],
        fn: "contar_letra", starter: starterOf("contar_letra", "texto"), cases: calls("contar_letra", ts.map((t) => [t])),
        hints: ["Puedes recorrer el texto letra a letra con un for y llevar la cuenta.", "Los textos también tienen un método que cuenta apariciones.", "Un texto vacío no tiene ninguna letra: el resultado es 0."],
        solution: py`
          def contar_letra(texto):
              return texto.count("${letra}")
        `,
      };
    }
    if (level === "medio") {
      const ts = [phrase(), cap(phrase()), "canción árbol", "", "AEIOU xyz", "pingüino"];
      return {
        kind: "code", tema: 2, template: "vocales", title: "Contar vocales",
        statement: ["Escribe la función `contar_vocales(texto)` que devuelva cuántas vocales tiene el texto, en mayúscula o minúscula. Las vocales con tilde (á, é, í, ó, ú) y la ü también cuentan."],
        fn: "contar_vocales", starter: starterOf("contar_vocales", "texto"), cases: calls("contar_vocales", ts.map((t) => [t])),
        hints: ["Pasa el texto a minúsculas para no tener que comprobar dos versiones de cada vocal.", "El operador in dice si un carácter está dentro de otro texto.", "Prepara un texto con todas las vocales que cuentan y comprueba cada letra."],
        solution: py`
          def contar_vocales(texto):
              return sum(1 for c in texto.lower() if c in "aeiouáéíóúü")
        `,
      };
    }
    const ts = [phrase(), phrase().toUpperCase(), "", "xyz", cap(phrase())];
    return {
      kind: "code", tema: 2, template: "vocales", title: "Vocales por tipo",
      statement: [
        "Escribe la función `vocales_por_tipo(texto)` que devuelva un diccionario con cuántas veces aparece cada vocal sin tilde (a, e, i, o, u), sin distinguir mayúsculas. Solo deben aparecer las vocales que estén en el texto.",
        "Por ejemplo, `vocales_por_tipo('Casa azul')` devuelve `{'a': 3, 'u': 1}`.",
      ],
      fn: "vocales_por_tipo", starter: starterOf("vocales_por_tipo", "texto"), cases: calls("vocales_por_tipo", ts.map((t) => [t])),
      hints: ["Empieza con un diccionario vacío y recorre el texto en minúsculas.", "Para cada vocal, suma 1 a su cuenta; si aún no estaba, empieza en 1.", "dict.get(clave, 0) devuelve 0 si la clave no está."],
      solution: py`
        def vocales_por_tipo(texto):
            cuentas = {}
            for c in texto.lower():
                if c in "aeiou":
                    cuentas[c] = cuentas.get(c, 0) + 1
            return cuentas
      `,
    };
  },
};

const INICIALES: Tpl = {
  id: "iniciales",
  tema: 2,
  make(rng, level) {
    const person = (k: number) => names(rng, k).map((w) => (rng.chance(0.3) ? w.toLowerCase() : w)).join(" ");
    const ts = [person(2), person(2), person(3), person(rng.int(2, 3)), person(2).toUpperCase()];
    if (level === "básico") {
      return {
        kind: "code", tema: 2, template: "iniciales", title: "Iniciales",
        statement: ["Escribe la función `iniciales(nombre)` que devuelva las iniciales de cada palabra del nombre, en mayúsculas y juntas. Por ejemplo, `iniciales('lira Tomeva')` devuelve `'LT'`."],
        fn: "iniciales", starter: starterOf("iniciales", "nombre"), cases: calls("iniciales", ts.map((t) => [t])),
        hints: ["split() separa un texto en una lista de palabras.", "La primera letra de una palabra es la de índice 0.", "Junta las letras y pásalas a mayúsculas."],
        solution: py`
          def iniciales(nombre):
              return "".join(p[0] for p in nombre.split()).upper()
        `,
      };
    }
    if (level === "medio") {
      return {
        kind: "code", tema: 2, template: "iniciales", title: "Iniciales con puntos",
        statement: ["Escribe la función `iniciales_con_puntos(nombre)` que devuelva cada inicial en mayúscula seguida de un punto, separadas por un espacio. Por ejemplo, `'lira Tomeva'` da `'L. T.'`."],
        fn: "iniciales_con_puntos", starter: starterOf("iniciales_con_puntos", "nombre"), cases: calls("iniciales_con_puntos", ts.map((t) => [t])),
        hints: ["Primero consigue la lista de palabras.", "Convierte cada palabra en su inicial en mayúscula más un punto.", "join() une los elementos de una lista con el separador que elijas."],
        solution: py`
          def iniciales_con_puntos(nombre):
              return " ".join(p[0].upper() + "." for p in nombre.split())
        `,
      };
    }
    return {
      kind: "code", tema: 2, template: "iniciales", title: "Formato de cita",
      statement: [
        "Escribe la función `formato_cita(nombre)` que convierta un nombre de dos o tres palabras al formato de las referencias: la última palabra con la primera letra en mayúscula y el resto en minúscula, una coma y las iniciales de las demás palabras con punto.",
        "Por ejemplo, `formato_cita('lira bo Tomeva')` devuelve `'Tomeva, L. B.'`.",
      ],
      fn: "formato_cita", starter: starterOf("formato_cita", "nombre"), cases: calls("formato_cita", ts.map((t) => [t])),
      hints: ["Separa las palabras y distingue la última del resto (los índices negativos ayudan).", "Para la última palabra: primera letra en mayúscula y el resto en minúscula.", "Para las demás, como en «Iniciales con puntos»; después junta las dos partes con una coma."],
      solution: py`
        def formato_cita(nombre):
            partes = nombre.split()
            apellido = partes[-1][0].upper() + partes[-1][1:].lower()
            resto = " ".join(p[0].upper() + "." for p in partes[:-1])
            return apellido + ", " + resto
      `,
    };
  },
};

const REBANADAS: Tpl = {
  id: "rebanadas",
  tema: 2,
  make(rng, level) {
    const long = () => words(rng, 3).join("");
    if (level === "básico") {
      const args: PyVal[][] = Array.from({ length: 5 }, () => {
        const t = long();
        return [t, rng.int(1, Math.floor(t.length / 2))];
      });
      return {
        kind: "code", tema: 2, template: "rebanadas", title: "Principio y final",
        statement: ["Escribe la función `extremos(texto, n)` que devuelva los `n` primeros caracteres del texto seguidos de los `n` últimos. Por ejemplo, `extremos('paraguas', 2)` devuelve `'paas'`."],
        fn: "extremos", starter: starterOf("extremos", "texto, n"), cases: calls("extremos", args),
        hints: ["Las rebanadas texto[a:b] toman los caracteres de a hasta b, sin incluir b.", "Si omites el inicio o el final de la rebanada, va hasta el extremo.", "Los índices negativos cuentan desde el final."],
        solution: py`
          def extremos(texto, n):
              return texto[:n] + texto[-n:]
        `,
      };
    }
    if (level === "medio") {
      const args: PyVal[][] = Array.from({ length: 5 }, () => [long(), rng.int(1, 4)]);
      return {
        kind: "code", tema: 2, template: "rebanadas", title: "Uno de cada k",
        statement: ["Escribe la función `cada_k(texto, k)` que devuelva un carácter de cada `k`, empezando por el primero. Por ejemplo, `cada_k('abcdefg', 3)` devuelve `'adg'`."],
        fn: "cada_k", starter: starterOf("cada_k", "texto, k"), cases: calls("cada_k", args),
        hints: ["Las rebanadas tienen un tercer número: el paso.", "Con paso k se salta de k en k.", "No hace falta ningún bucle."],
        solution: py`
          def cada_k(texto, k):
              return texto[::k]
        `,
      };
    }
    const ts = [rng.pick(WORDS), long(), "a", "ab", rng.pick(WORDS).toUpperCase(), long()];
    return {
      kind: "code", tema: 2, template: "rebanadas", title: "El centro",
      statement: ["Escribe la función `centro(texto)` que devuelva el carácter central si la longitud es impar, o los dos centrales si es par. Por ejemplo, `centro('raton')` es `'t'` y `centro('casa')` es `'as'`."],
      fn: "centro", starter: starterOf("centro", "texto"), cases: calls("centro", ts.map((t) => [t])),
      hints: ["Calcula la posición de la mitad con la división entera.", "Distingue los dos casos con el resto de dividir la longitud entre 2.", "Con longitud par, el centro empieza una posición antes de la mitad."],
      solution: py`
        def centro(texto):
            m = len(texto) // 2
            if len(texto) % 2 == 1:
                return texto[m]
            return texto[m - 1 : m + 1]
      `,
    };
  },
};

const FRASES: Tpl = {
  id: "frases",
  tema: 2,
  make(rng, level) {
    const phrase = () => words(rng, rng.int(3, 6)).join(" ");
    if (level === "básico") {
      const ts = [phrase(), phrase(), rng.pick(WORDS), "sol mar pez"];
      return {
        kind: "code", tema: 2, template: "frases", title: "La palabra más larga",
        statement: ["Escribe la función `palabra_mas_larga(frase)` que devuelva la palabra más larga de una frase (palabras separadas por espacios). Si hay empate, la primera."],
        fn: "palabra_mas_larga", starter: starterOf("palabra_mas_larga", "frase"), cases: calls("palabra_mas_larga", ts.map((t) => [t])),
        hints: ["Separa la frase en palabras y recórrelas.", "Guarda la mejor hasta ahora y cámbiala solo si encuentras una estrictamente más larga.", "max() también acepta un argumento key; mira qué hace con los empates."],
        solution: py`
          def palabra_mas_larga(frase):
              mejor = ""
              for p in frase.split():
                  if len(p) > len(mejor):
                      mejor = p
              return mejor
        `,
      };
    }
    if (level === "medio") {
      const mixed = () => words(rng, rng.int(2, 5)).map((w) => (rng.chance(0.4) ? w.toUpperCase() : w)).join(" ");
      const ts = [mixed(), mixed(), mixed(), "a b c"];
      return {
        kind: "code", tema: 2, template: "frases", title: "Cada palabra con mayúscula",
        statement: ["Escribe la función `capitalizar(frase)` que ponga en mayúscula la primera letra de cada palabra y en minúscula el resto, con las palabras separadas por un espacio. Hazlo sin `title()` ni `capitalize()`."],
        fn: "capitalizar", starter: starterOf("capitalizar", "frase"), cases: calls("capitalizar", ts.map((t) => [t])),
        rules: [
          { kind: "evita", what: "llamada:title", label: "Sin title()" },
          { kind: "evita", what: "llamada:capitalize", label: "Sin capitalize()" },
        ],
        hints: ["Trabaja palabra a palabra.", "Cada palabra se puede partir en su primera letra y el resto con rebanadas.", "Al final, une las palabras con un espacio."],
        solution: py`
          def capitalizar(frase):
              return " ".join(p[0].upper() + p[1:].lower() for p in frase.split())
        `,
      };
    }
    const small = ["de", "la", "el", "y", "del", "en", "los"];
    const sentence = () => {
      const ws = words(rng, rng.int(3, 4));
      return ws.flatMap((w, i) => (i > 0 && rng.chance(0.5) ? [rng.pick(small), w] : [w])).join(" ");
    };
    const ts = [sentence(), sentence(), sentence(), cap(sentence())];
    return {
      kind: "code", tema: 2, template: "frases", title: "Acrónimo",
      statement: [
        `Escribe la función \`acronimo(frase)\` que devuelva, en mayúsculas, la inicial de cada palabra de la frase salvo las palabras vacías ${small.map((w) => `\`${w}\``).join(", ")} (en cualquier mezcla de mayúsculas).`,
        "Por ejemplo, `acronimo('torre de control y radar')` devuelve `'TCR'`.",
      ],
      fn: "acronimo", starter: starterOf("acronimo", "frase"), cases: calls("acronimo", ts.map((t) => [t])),
      hints: ["Guarda las palabras vacías en un conjunto o una lista.", "Compara cada palabra en minúsculas con esa colección.", "Junta las iniciales de las que no estén y pásalas a mayúsculas."],
      solution: py`
        def acronimo(frase):
            vacias = {${small.map((w) => `"${w}"`).join(", ")}}
            return "".join(p[0] for p in frase.split() if p.lower() not in vacias).upper()
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 2: colecciones

const FRECUENCIAS: Tpl = {
  id: "frecuencias",
  tema: 2,
  make(rng, level) {
    const pool = distinctWords(rng, 4);
    const lists = () => Array.from({ length: rng.int(3, 8) }, () => rng.pick(pool));
    if (level === "básico") {
      const ls = [lists(), lists(), ints(rng, 6, 1, 4), []];
      return {
        kind: "code", tema: 2, template: "frecuencias", title: "Contar apariciones",
        statement: ["Escribe la función `contar(elementos)` que devuelva un diccionario con cuántas veces aparece cada elemento de la lista. Por ejemplo, `contar(['a', 'b', 'a'])` devuelve `{'a': 2, 'b': 1}`."],
        fn: "contar", starter: starterOf("contar", "elementos"), cases: calls("contar", ls.map((l) => [l])),
        hints: ["Empieza con un diccionario vacío.", "Para cada elemento, súmale 1 a su cuenta.", "Si el elemento aún no es una clave, su cuenta empieza en 0: dict.get ayuda."],
        solution: py`
          def contar(elementos):
              cuentas = {}
              for x in elementos:
                  cuentas[x] = cuentas.get(x, 0) + 1
              return cuentas
        `,
      };
    }
    if (level === "medio") {
      const ls = [lists(), lists(), lists(), [pool[0]!, pool[1]!, pool[1]!, pool[0]!], []];
      return {
        kind: "code", tema: 2, template: "frecuencias", title: "El más frecuente",
        statement: ["Escribe la función `mas_frecuente(elementos)` que devuelva el elemento que más se repite. Si hay empate, el que aparece antes en la lista; con la lista vacía, `None`."],
        fn: "mas_frecuente", starter: starterOf("mas_frecuente", "elementos"), cases: calls("mas_frecuente", ls.map((l) => [l])),
        hints: ["Primero cuenta cuántas veces aparece cada uno, con un diccionario.", "Después recorre la lista original en orden para resolver los empates.", "Cambia de candidato solo si la cuenta es estrictamente mayor."],
        solution: py`
          def mas_frecuente(elementos):
              cuentas = {}
              for x in elementos:
                  cuentas[x] = cuentas.get(x, 0) + 1
              mejor = None
              for x in elementos:
                  if mejor is None or cuentas[x] > cuentas[mejor]:
                      mejor = x
              return mejor
        `,
      };
    }
    const ls = [words(rng, 6), words(rng, 5), [...words(rng, 3), "sol", "sol"], []];
    return {
      kind: "code", tema: 2, template: "frecuencias", title: "Agrupar por inicial",
      statement: [
        "Escribe la función `agrupar_por_inicial(palabras)` que devuelva un diccionario cuya clave es la primera letra y cuyo valor es la lista, ordenada alfabéticamente y sin repetidos, de las palabras que empiezan por ella.",
        "Por ejemplo, `agrupar_por_inicial(['mar', 'luz', 'mesa', 'mar'])` devuelve `{'m': ['mar', 'mesa'], 'l': ['luz']}`.",
      ],
      fn: "agrupar_por_inicial", starter: starterOf("agrupar_por_inicial", "palabras"), cases: calls("agrupar_por_inicial", ls.map((l) => [l])),
      hints: ["Un conjunto por cada inicial evita los repetidos.", "Recorre las palabras y añade cada una al grupo de su inicial (créalo si no existe).", "Al final, convierte cada grupo en una lista ordenada."],
      solution: py`
        def agrupar_por_inicial(palabras):
            grupos = {}
            for p in palabras:
                grupos.setdefault(p[0], set()).add(p)
            return {k: sorted(v) for k, v in grupos.items()}
      `,
    };
  },
};

const CONJUNTOS: Tpl = {
  id: "conjuntos",
  tema: 2,
  make(rng, level) {
    const pair = (): PyVal[] => [ints(rng, rng.int(3, 7), 1, 12), ints(rng, rng.int(3, 7), 1, 12)];
    if (level === "básico" || level === "medio") {
      const args = [pair(), pair(), pair(), [[1, 2], [3, 4]], [[], ints(rng, 3, 1, 5)]];
      const medio = level === "medio";
      return {
        kind: "code", tema: 2, template: "conjuntos", title: medio ? "Solo en una de las dos" : "Elementos comunes",
        statement: [
          medio
            ? "Escribe la función `solo_en_una(a, b)` que devuelva, en una lista ordenada de menor a mayor y sin repetidos, los números que están en una de las dos listas pero no en las dos."
            : "Escribe la función `comunes(a, b)` que devuelva, en una lista ordenada de menor a mayor y sin repetidos, los números que están en las dos listas.",
        ],
        fn: medio ? "solo_en_una" : "comunes", starter: starterOf(medio ? "solo_en_una" : "comunes", "a, b"), cases: calls(medio ? "solo_en_una" : "comunes", args),
        hints: [
          "Convertir una lista en conjunto (set) quita los repetidos.",
          medio ? "Entre conjuntos hay un operador para la diferencia simétrica." : "Entre conjuntos hay un operador para la intersección.",
          "Un conjunto no tiene orden: conviértelo en una lista ordenada al final.",
        ],
        solution: medio
          ? py`
            def solo_en_una(a, b):
                return sorted(set(a) ^ set(b))
          `
          : py`
            def comunes(a, b):
                return sorted(set(a) & set(b))
          `,
      };
    }
    const ls = [ints(rng, 8, 1, 6), words(rng, 6), [], ints(rng, 5, 1, 3)];
    return {
      kind: "code", tema: 2, template: "conjuntos", title: "Sin repetidos y en orden",
      statement: ["Escribe la función `sin_repetidos(elementos)` que devuelva una lista nueva sin repetidos, conservando el orden de la primera aparición. Por ejemplo, `sin_repetidos([3, 1, 3, 2, 1])` devuelve `[3, 1, 2]`."],
      fn: "sin_repetidos", starter: starterOf("sin_repetidos", "elementos"), cases: calls("sin_repetidos", ls.map((l) => [l])),
      hints: ["Convertir en set quita los repetidos, pero pierde el orden.", "Recorre la lista y lleva aparte un conjunto con lo que ya has visto.", "Añade un elemento al resultado solo la primera vez que lo ves."],
      solution: py`
        def sin_repetidos(elementos):
            vistos = set()
            resultado = []
            for x in elementos:
                if x not in vistos:
                    vistos.add(x)
                    resultado.append(x)
            return resultado
      `,
    };
  },
};

const TUPLAS: Tpl = {
  id: "tuplas",
  tema: 2,
  make(rng, level) {
    if (level === "básico") {
      const ls = [ints(rng, 5, -20, 50), ints(rng, 1, 0, 9), ints(rng, 7, 0, 100), [quarter(rng, 0, 10), quarter(rng, 0, 10), quarter(rng, 0, 10)]];
      return {
        kind: "code", tema: 2, template: "tuplas", title: "Mínimo y máximo",
        statement: ["Escribe la función `minimo_y_maximo(numeros)` que devuelva una tupla con el menor y el mayor de una lista no vacía de números."],
        fn: "minimo_y_maximo", starter: starterOf("minimo_y_maximo", "numeros"), cases: calls("minimo_y_maximo", ls.map((l) => [l])),
        hints: ["Python tiene funciones integradas para el mínimo y el máximo.", "Devuelve los dos valores separados por una coma.", "Una tupla se escribe entre paréntesis, pero la coma basta."],
        solution: py`
          def minimo_y_maximo(numeros):
              return min(numeros), max(numeros)
        `,
      };
    }
    const ns = names(rng, 4);
    const notas = (k: number, repeat: boolean) =>
      Array.from({ length: k }, (_, i) => tup(repeat ? rng.pick(ns) : ns[i % ns.length]!, quarter(rng, 0, 10)));
    if (level === "medio") {
      const tie = [tup(ns[0]!, 7), tup(ns[1]!, 9), tup(ns[2]!, 9)];
      const ls = [notas(3, false), notas(4, false), tie, notas(2, false)];
      return {
        kind: "code", tema: 2, template: "tuplas", title: "La mejor nota",
        statement: ["Escribe la función `mejor(notas)` que reciba una lista no vacía de tuplas `(nombre, nota)` y devuelva el nombre con la nota más alta. Si hay empate, el que aparece antes."],
        fn: "mejor", starter: starterOf("mejor", "notas"), cases: calls("mejor", ls.map((l) => [l])),
        hints: ["Puedes desempaquetar cada tupla en el for: dos variables a la vez.", "Guarda el mejor nombre y su nota, y cámbialos solo con una nota estrictamente mayor.", "Devuelve solo el nombre, no la tupla."],
        solution: py`
          def mejor(notas):
              mejor_nombre, mejor_nota = notas[0]
              for nombre, nota in notas[1:]:
                  if nota > mejor_nota:
                      mejor_nombre, mejor_nota = nombre, nota
              return mejor_nombre
        `,
      };
    }
    const ls = [notas(6, true), notas(5, true), notas(1, true), []];
    return {
      kind: "code", tema: 2, template: "tuplas", title: "Media por persona",
      statement: ["Escribe la función `medias(notas)` que reciba una lista de tuplas `(nombre, nota)`, con varias notas por persona, y devuelva un diccionario con la media de cada nombre redondeada a dos decimales."],
      fn: "medias", starter: starterOf("medias", "notas"), cases: calls("medias", ls.map((l) => [l])),
      hints: ["Agrupa primero: un diccionario de nombre a lista de notas.", "La media es la suma entre el número de notas.", "Redondea al final con round(x, 2)."],
      solution: py`
        def medias(notas):
            grupos = {}
            for nombre, nota in notas:
                grupos.setdefault(nombre, []).append(nota)
            return {n: round(sum(v) / len(v), 2) for n, v in grupos.items()}
      `,
    };
  },
};

const MUTABILIDAD: Tpl = {
  id: "mutabilidad",
  tema: 2,
  make(rng, level) {
    if (level === "básico") {
      const cases: PyCase[] = [ints(rng, 4, -9, 20), ints(rng, 2, 0, 9), [], ints(rng, 5, 1, 50)].map((l) => ({ code: `datos = ${lit(l)}\nr = duplicar(datos)\n(r, datos)` }));
      return {
        kind: "code", tema: 2, template: "mutabilidad", title: "Lista nueva, original intacta",
        statement: ["Escribe la función `duplicar(numeros)` que devuelva una lista nueva con cada número multiplicado por 2, sin modificar la lista original (las pruebas comprueban las dos)."],
        fn: "duplicar", starter: starterOf("duplicar", "numeros"), cases,
        hints: ["Crea una lista vacía nueva y ve añadiendo los dobles.", "Si cambias numeros[i] dentro de la función, también cambias la lista de quien te llamó: las listas se pasan por referencia.", "Devuelve la lista nueva."],
        solution: py`
          def duplicar(numeros):
              return [x * 2 for x in numeros]
        `,
      };
    }
    if (level === "medio") {
      const pairs: Array<[PyVal, PyVal]> = [
        [ints(rng, 3, 0, 9), rng.int(10, 99)],
        [[], rng.int(0, 9)],
        [words(rng, 2), rng.pick(WORDS)],
      ];
      const cases: PyCase[] = pairs.map(([l, x]) => ({ code: `datos = ${lit(l)}\nr = agregar_en_sitio(datos, ${lit(x)})\n(r, datos)` }));
      return {
        kind: "code", tema: 2, template: "mutabilidad", title: "Modificar en el sitio",
        statement: ["Escribe la función `agregar_en_sitio(lista, x)` que añada `x` al final de la lista que recibe, modificándola, y no devuelva nada (es decir, `None`), como hace `list.append`."],
        fn: "agregar_en_sitio", starter: starterOf("agregar_en_sitio", "lista, x"), cases,
        hints: ["Aquí sí quieres cambiar la lista original.", "Los métodos de list modifican la lista sobre la que se llaman.", "Si no escribes return, la función devuelve None."],
        solution: py`
          def agregar_en_sitio(lista, x):
              lista.append(x)
        `,
      };
    }
    const mat = () => Array.from({ length: rng.int(2, 3) }, () => ints(rng, rng.int(1, 3), 0, 9));
    const cases: PyCase[] = [mat(), mat(), [[rng.int(0, 9)], []]].map((m) => ({ code: `m = ${lit(m)}\nc = copiar_matriz(m)\nc[0].append(99)\n(c, m)` }));
    return {
      kind: "code", tema: 2, template: "mutabilidad", title: "Copia de una matriz",
      statement: [
        "Escribe la función `copiar_matriz(m)` que devuelva una copia de una lista de listas tal que modificar las filas de la copia no cambie la original.",
        "Ojo: `m[:]` o `list(m)` copian la lista de fuera, pero las filas siguen siendo las mismas.",
      ],
      fn: "copiar_matriz", starter: starterOf("copiar_matriz", "m"), cases,
      hints: ["Una copia superficial comparte las filas: necesitas copiar también cada fila.", "Recorre las filas y crea una lista nueva a partir de cada una.", "El módulo copy tiene una función para copias profundas, pero puedes hacerlo con una comprensión."],
      solution: py`
        def copiar_matriz(m):
            return [fila[:] for fila in m]
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 3: control

const NOTAS: Tpl = {
  id: "notas",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const ns = [5, 4.99, 10, 0, quarter(rng, 0, 10), quarter(rng, 0, 10)];
      return {
        kind: "code", tema: 3, template: "notas", title: "¿Aprobado?",
        statement: ["Escribe la función `aprobado(nota)` que devuelva `True` si la nota es 5 o más y `False` si no."],
        fn: "aprobado", starter: starterOf("aprobado", "nota"), cases: calls("aprobado", ns.map((n) => [n])),
        hints: ["Es una sola comparación.", "Cuidado con el 5: ¿mayor o mayor o igual?", "La comparación ya es True o False: no hace falta un if."],
        solution: py`
          def aprobado(nota):
              return nota >= 5
        `,
      };
    }
    const ns = [4.99, 5, 6.75, 7, 8.9, 9, 10, quarter(rng, 0, 10), ...(level === "avanzado" ? [-1, 10.5] : [])];
    const avanzado = level === "avanzado";
    return {
      kind: "code", tema: 3, template: "notas", title: avanzado ? "Calificación con control de errores" : "Calificación",
      statement: [
        "Escribe la función `calificacion(nota)` que devuelva `'Suspenso'` (menos de 5), `'Aprobado'` (de 5 a menos de 7), `'Notable'` (de 7 a menos de 9) o `'Sobresaliente'` (9 o más).",
        ...(avanzado ? ["Si la nota es menor que 0 o mayor que 10, devuelve `'Nota no válida'`."] : []),
      ],
      fn: "calificacion", starter: starterOf("calificacion", "nota"), cases: calls("calificacion", ns.map((n) => [n])),
      hints: [
        "Una cadena de if, elif y else elige un solo camino.",
        "Si compruebas de menor a mayor, cada elif ya sabe que las condiciones anteriores no se cumplieron.",
        avanzado ? "Comprueba primero si la nota es válida." : "Prueba los límites: 5, 7 y 9.",
      ],
      solution: avanzado
        ? py`
          def calificacion(nota):
              if nota < 0 or nota > 10:
                  return "Nota no válida"
              if nota < 5:
                  return "Suspenso"
              elif nota < 7:
                  return "Aprobado"
              elif nota < 9:
                  return "Notable"
              else:
                  return "Sobresaliente"
        `
        : py`
          def calificacion(nota):
              if nota < 5:
                  return "Suspenso"
              elif nota < 7:
                  return "Aprobado"
              elif nota < 9:
                  return "Notable"
              else:
                  return "Sobresaliente"
        `,
    };
  },
};

const SUMAS: Tpl = {
  id: "sumas",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const ns = [0, 1, rng.int(2, 10), rng.int(11, 100), rng.int(100, 1000)];
      return {
        kind: "code", tema: 3, template: "sumas", title: "Suma hasta n",
        statement: ["Escribe la función `suma_hasta(n)` que devuelva 1 + 2 + … + n con un bucle `for` (y 0 si n es 0)."],
        fn: "suma_hasta", starter: starterOf("suma_hasta", "n"), cases: calls("suma_hasta", ns.map((n) => [n])), rules: [USA_FOR],
        hints: ["Usa una variable acumuladora que empiece en 0.", "range(a, b) llega hasta b − 1.", "En cada vuelta, suma el número de esa vuelta al acumulador."],
        solution: py`
          def suma_hasta(n):
              total = 0
              for i in range(1, n + 1):
                  total += i
              return total
        `,
      };
    }
    if (level === "medio") {
      const k = rng.pick([3, 4, 5, 7]);
      const args: PyVal[][] = [[rng.int(10, 100), k], [k, k], [k - 1, k], [rng.int(100, 500), rng.int(2, 9)], [0, k]];
      return {
        kind: "code", tema: 3, template: "sumas", title: "Suma de múltiplos",
        statement: ["Escribe la función `suma_multiplos(n, k)` que devuelva la suma de los múltiplos de `k` entre 1 y `n`, ambos incluidos. Por ejemplo, `suma_multiplos(10, 3)` es 3 + 6 + 9 = 18."],
        fn: "suma_multiplos", starter: starterOf("suma_multiplos", "n, k"), cases: calls("suma_multiplos", args),
        hints: ["Puedes recorrer todos los números y quedarte con los que cumplen la condición.", "O, mejor, usar range con un paso de k.", "Recuerda que n está incluido."],
        solution: py`
          def suma_multiplos(n, k):
              return sum(range(k, n + 1, k))
        `,
      };
    }
    const [a, b] = rng.shuffle([2, 3, 5, 7]).slice(0, 2) as [number, number];
    const args: PyVal[][] = [[10, 3, 5], [rng.int(20, 200), a, b], [rng.int(20, 200), a, b], [1, a, b], [a * b, a, b]];
    return {
      kind: "code", tema: 3, template: "sumas", title: "Múltiplos de uno u otro",
      statement: ["Escribe la función `suma_multiplos_de_alguno(n, a, b)` que sume los números menores que `n` (sin incluirlo) que sean múltiplos de `a` o de `b`. Los múltiplos de los dos cuentan una sola vez. Por ejemplo, con `(10, 3, 5)` da 3 + 5 + 6 + 9 = 23."],
      fn: "suma_multiplos_de_alguno", starter: starterOf("suma_multiplos_de_alguno", "n, a, b"), cases: calls("suma_multiplos_de_alguno", args),
      hints: ["Recorre los números de 1 a n − 1.", "Une las dos condiciones con or: así ningún número se suma dos veces.", "Comprueba el ejemplo a mano antes de probar."],
      solution: py`
        def suma_multiplos_de_alguno(n, a, b):
            total = 0
            for i in range(1, n):
                if i % a == 0 or i % b == 0:
                    total += i
            return total
      `,
    };
  },
};

const DIGITOS: Tpl = {
  id: "digitos",
  tema: 3,
  make(rng, level) {
    const ns = [0, rng.int(1, 9), rng.int(10, 99), rng.int(100, 99_999), rng.int(1_000_000, 9_999_999)];
    const noStr: PyRule[] = [USA_WHILE, { kind: "evita", what: "llamada:str", label: "Sin convertir el número en texto (sin str)" }];
    if (level === "básico") {
      return {
        kind: "code", tema: 3, template: "digitos", title: "Contar cifras",
        statement: ["Escribe la función `cuenta_digitos(n)` que devuelva cuántas cifras tiene un entero `n` ≥ 0 usando un bucle `while` y la división entera, sin convertirlo en texto. El 0 tiene una cifra."],
        fn: "cuenta_digitos", starter: starterOf("cuenta_digitos", "n"), cases: calls("cuenta_digitos", ns.map((n) => [n])), rules: noStr,
        hints: ["Dividir entre 10 (división entera) quita la última cifra.", "Repite mientras queden cifras y cuenta las vueltas.", "Piensa qué pasa con el 0: el bucle no daría ninguna vuelta."],
        solution: py`
          def cuenta_digitos(n):
              cifras = 1
              while n >= 10:
                  n //= 10
                  cifras += 1
              return cifras
        `,
      };
    }
    if (level === "medio") {
      return {
        kind: "code", tema: 3, template: "digitos", title: "Suma de cifras",
        statement: ["Escribe la función `suma_digitos(n)` que sume las cifras de un entero `n` ≥ 0 con un bucle `while`, sin convertirlo en texto. Por ejemplo, `suma_digitos(472)` es 13."],
        fn: "suma_digitos", starter: starterOf("suma_digitos", "n"), cases: calls("suma_digitos", ns.map((n) => [n])), rules: noStr,
        hints: ["n % 10 es la última cifra.", "n // 10 quita la última cifra.", "Repite mientras n sea mayor que 0, acumulando las cifras."],
        solution: py`
          def suma_digitos(n):
              total = 0
              while n > 0:
                  total += n % 10
                  n //= 10
              return total
        `,
      };
    }
    const cs = [1, 2, 6, 7, rng.int(8, 200), rng.int(200, 2000)];
    return {
      kind: "code", tema: 3, template: "digitos", title: "Pasos de Collatz",
      statement: [
        "Escribe la función `pasos_collatz(n)` que, para un entero `n` ≥ 1, cuente cuántos pasos hacen falta para llegar a 1 repitiendo: si es par, se divide entre 2; si es impar, se multiplica por 3 y se suma 1.",
        "Por ejemplo, `pasos_collatz(6)` es 8 (6, 3, 10, 5, 16, 8, 4, 2, 1).",
      ],
      fn: "pasos_collatz", starter: starterOf("pasos_collatz", "n"), cases: calls("pasos_collatz", cs.map((n) => [n])), rules: [USA_WHILE],
      hints: ["No sabes cuántas vueltas habrá: es un trabajo para while.", "Dentro del bucle, un if decide qué hacer según la paridad.", "Usa la división entera para que n siga siendo int."],
      solution: py`
        def pasos_collatz(n):
            pasos = 0
            while n != 1:
                if n % 2 == 0:
                    n //= 2
                else:
                    n = 3 * n + 1
                pasos += 1
            return pasos
      `,
    };
  },
};

const SALTOS: Tpl = {
  id: "saltos",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const ls = [[...ints(rng, 3, 0, 9), -rng.int(1, 9), ...ints(rng, 2, -9, 9)], ints(rng, 4, 0, 20), [], [-1], [rng.int(1, 9), -rng.int(1, 9), -rng.int(1, 9)]];
      return {
        kind: "code", tema: 3, template: "saltos", title: "Primer negativo",
        statement: ["Escribe la función `primer_negativo(numeros)` que devuelva la posición (índice) del primer número negativo de la lista, o -1 si no hay ninguno."],
        fn: "primer_negativo", starter: starterOf("primer_negativo", "numeros"), cases: calls("primer_negativo", ls.map((l) => [l])),
        hints: ["Necesitas recorrer la lista conociendo la posición de cada elemento.", "En cuanto encuentres el primero, ya puedes terminar (return o break).", "Si el bucle acaba sin encontrarlo, el resultado es -1."],
        solution: py`
          def primer_negativo(numeros):
              for i, x in enumerate(numeros):
                  if x < 0:
                      return i
              return -1
        `,
      };
    }
    if (level === "medio") {
      const ls = [
        [...ints(rng, 2, 1, 9), -rng.int(1, 9), rng.int(1, 9), 0, rng.int(1, 9)],
        [...ints(rng, 4, -5, 9)],
        [0, ...ints(rng, 3, 1, 9)],
        [-rng.int(1, 9), rng.int(1, 9), 0],
      ];
      return {
        kind: "code", tema: 3, template: "saltos", title: "Sumar hasta el cero",
        statement: ["Escribe la función `suma_hasta_cero(numeros)` que sume los números de la lista en orden, saltándose los negativos (`continue`) y parando en el primer 0 (`break`), que no se suma. Si no hay ningún 0, suma todos los no negativos."],
        fn: "suma_hasta_cero", starter: starterOf("suma_hasta_cero", "numeros"), cases: calls("suma_hasta_cero", ls.map((l) => [l])),
        rules: [
          { kind: "usa", what: "nodo:Break", label: "Usa break" },
          { kind: "usa", what: "nodo:Continue", label: "Usa continue" },
        ],
        hints: ["break sale del bucle; continue pasa a la siguiente vuelta.", "Piensa en qué orden comprobar las dos condiciones.", "El acumulador empieza en 0 y se devuelve al terminar el bucle."],
        solution: py`
          def suma_hasta_cero(numeros):
              total = 0
              for x in numeros:
                  if x == 0:
                      break
                  if x < 0:
                      continue
                  total += x
              return total
        `,
      };
    }
    const ns = [1, 2, 14, rng.int(15, 100), rng.int(100, 1000), 90];
    return {
      kind: "code", tema: 3, template: "saltos", title: "El siguiente primo",
      statement: ["Escribe la función `primo_desde(n)` que devuelva el menor número primo mayor o igual que `n` (con `n` ≥ 1). Un primo es un entero mayor que 1 que solo es divisible entre 1 y entre sí mismo."],
      fn: "primo_desde", starter: starterOf("primo_desde", "n"), cases: calls("primo_desde", ns.map((n) => [n])),
      hints: ["Separa el problema: primero, cómo saber si un número es primo; después, buscar desde n.", "Para saber si es primo basta probar divisores hasta su raíz cuadrada; en cuanto uno divide, break.", "El 1 no es primo."],
      solution: py`
        def primo_desde(n):
            candidato = max(n, 2)
            while True:
                primo = True
                d = 2
                while d * d <= candidato:
                    if candidato % d == 0:
                        primo = False
                        break
                    d += 1
                if primo:
                    return candidato
                candidato += 1
      `,
    };
  },
};

const DIBUJOS: Tpl = {
  id: "dibujos",
  tema: 3,
  make(rng, level) {
    const out = (fn: string, argLists: PyVal[][]): PyCase[] => argLists.map((a) => ({ code: call(fn, ...a), compare: ["salida"] }));
    if (level === "básico") {
      return {
        kind: "code", tema: 3, template: "dibujos", title: "Tabla de multiplicar",
        statement: ["Escribe la función `tabla(n)` que imprima (con `print`) la tabla de multiplicar de `n` del 1 al 10, una línea por multiplicación con el formato `7 x 3 = 21`."],
        fn: "tabla", starter: starterOf("tabla", "n"), cases: out("tabla", [[rng.int(2, 9)], [rng.int(10, 20)], [1]]),
        hints: ["Un for con range da los multiplicadores.", "Recuerda que range no incluye el final.", "print con varios argumentos los separa con un espacio; un f-string te da el formato exacto."],
        solution: py`
          def tabla(n):
              for i in range(1, 11):
                  print(f"{n} x {i} = {n * i}")
        `,
      };
    }
    if (level === "medio") {
      return {
        kind: "code", tema: 3, template: "dibujos", title: "Triángulo de asteriscos",
        statement: ["Escribe la función `triangulo(n)` que imprima `n` líneas: la primera con un asterisco, la segunda con dos… y la última con `n`. Con `n` = 0 no imprime nada."],
        fn: "triangulo", starter: starterOf("triangulo", "n"), cases: out("triangulo", [[rng.int(2, 5)], [rng.int(6, 9)], [1], [0]]),
        hints: ["Una línea por vuelta del bucle.", "Un texto multiplicado por un entero se repite.", "Fíjate en el primer y el último valor de range."],
        solution: py`
          def triangulo(n):
              for i in range(1, n + 1):
                  print("*" * i)
        `,
      };
    }
    return {
      kind: "code", tema: 3, template: "dibujos", title: "Tabla alineada",
      statement: [
        "Escribe la función `tabla_alineada(n, hasta)` que imprima la tabla de `n` desde 1 hasta `hasta`, con cada número alineado a la derecha: el multiplicando y el multiplicador en 2 caracteres y el producto en 3.",
        "Por ejemplo, la línea de 7 por 3 es ` 7 x  3 =  21`.",
      ],
      fn: "tabla_alineada", starter: starterOf("tabla_alineada", "n, hasta"), cases: out("tabla_alineada", [[rng.int(2, 9), rng.int(5, 12)], [rng.int(10, 12), rng.int(3, 9)], [1, 1]]),
      hints: ["Los f-string admiten un ancho después de los dos puntos.", "> alinea a la derecha dentro de ese ancho.", "Compara tu salida carácter a carácter con el ejemplo, espacios incluidos."],
      solution: py`
        def tabla_alineada(n, hasta):
            for i in range(1, hasta + 1):
                print(f"{n:>2} x {i:>2} = {n * i:>3}")
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 3: enumerate, zip y comprensiones

const ENUMERAR: Tpl = {
  id: "enumerar",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const l = ints(rng, 8, 1, 4);
      const args: PyVal[][] = [[l, l[0]!], [ints(rng, 6, 1, 3), 2], [words(rng, 5), "sol"], [[], 1], [l, 9]];
      return {
        kind: "code", tema: 3, template: "enumerar", title: "Todas las posiciones",
        statement: ["Escribe la función `posiciones(lista, x)` que devuelva la lista de índices en los que aparece `x`. Si no aparece, la lista vacía."],
        fn: "posiciones", starter: starterOf("posiciones", "lista, x"), cases: calls("posiciones", args),
        hints: ["enumerate da a la vez la posición y el elemento.", "Añade la posición cuando el elemento sea igual a x.", "Cabe en una comprensión con un if."],
        solution: py`
          def posiciones(lista, x):
              return [i for i, y in enumerate(lista) if y == x]
        `,
      };
    }
    if (level === "medio") {
      const ls = [words(rng, 3), words(rng, 5), [], [rng.pick(WORDS)]];
      return {
        kind: "code", tema: 3, template: "enumerar", title: "Numerar una lista",
        statement: ["Escribe la función `numerar(palabras)` que devuelva una lista de textos con cada palabra precedida de su número, empezando en 1: `numerar(['sol', 'mar'])` es `['1. sol', '2. mar']`. Usa `enumerate`."],
        fn: "numerar", starter: starterOf("numerar", "palabras"), cases: calls("numerar", ls.map((l) => [l])), rules: [{ kind: "usa", what: "llamada:enumerate", label: "Usa enumerate()" }],
        hints: ["enumerate empieza en 0 salvo que le digas otra cosa.", "Mira el segundo parámetro de enumerate (start).", "Un f-string construye cada texto."],
        solution: py`
          def numerar(palabras):
              return [f"{i}. {p}" for i, p in enumerate(palabras, start=1)]
        `,
      };
    }
    const m = rng.int(5, 9);
    const ls = [[1, m, 3, m, 2], ints(rng, 6, 0, 5), [rng.int(0, 9)], [], [m, m, m]];
    return {
      kind: "code", tema: 3, template: "enumerar", title: "Dónde está el máximo",
      statement: ["Escribe la función `indices_del_maximo(numeros)` que devuelva la lista de posiciones en las que está el valor máximo. Con la lista vacía, devuelve `[]`."],
      fn: "indices_del_maximo", starter: starterOf("indices_del_maximo", "numeros"), cases: calls("indices_del_maximo", ls.map((l) => [l])),
      hints: ["Primero calcula el máximo; después busca dónde aparece.", "Piensa en la lista vacía antes de llamar a max().", "enumerate te da las posiciones."],
      solution: py`
        def indices_del_maximo(numeros):
            if not numeros:
                return []
            m = max(numeros)
            return [i for i, x in enumerate(numeros) if x == m]
      `,
    };
  },
};

const CREMALLERA: Tpl = {
  id: "cremallera",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const k = () => rng.int(1, 4);
      const args: PyVal[][] = [1, 2, 3].map(() => {
        const n = k();
        return [distinctWords(rng, n), ints(rng, n, 0, 99)];
      });
      args.push([[], []]);
      return {
        kind: "code", tema: 3, template: "cremallera", title: "Emparejar claves y valores",
        statement: ["Escribe la función `emparejar(claves, valores)` que reciba dos listas de la misma longitud y devuelva un diccionario que asocie cada clave con el valor de la misma posición. Usa `zip`."],
        fn: "emparejar", starter: starterOf("emparejar", "claves, valores"), cases: calls("emparejar", args), rules: [USA_ZIP],
        hints: ["zip recorre dos listas a la vez, por parejas.", "dict() puede construir un diccionario a partir de parejas.", "También vale una comprensión de diccionario."],
        solution: py`
          def emparejar(claves, valores):
              return dict(zip(claves, valores))
        `,
      };
    }
    if (level === "medio") {
      const pair = (n: number): PyVal[] => [ints(rng, n, -9, 20), ints(rng, n, -9, 20)];
      const args = [pair(3), pair(5), pair(1), pair(0)];
      return {
        kind: "code", tema: 3, template: "cremallera", title: "Sumar dos listas",
        statement: ["Escribe la función `sumar_listas(a, b)` que devuelva la lista de las sumas elemento a elemento de dos listas de la misma longitud: `sumar_listas([1, 2], [10, 20])` es `[11, 22]`."],
        fn: "sumar_listas", starter: starterOf("sumar_listas", "a, b"), cases: calls("sumar_listas", args), rules: [USA_ZIP],
        hints: ["zip da las parejas (a[i], b[i]).", "Suma cada pareja.", "Una comprensión lo hace en una línea."],
        solution: py`
          def sumar_listas(a, b):
              return [x + y for x, y in zip(a, b)]
        `,
      };
    }
    const ls = [ints(rng, 5, 0, 50), ints(rng, 3, -10, 10), [rng.int(0, 9)], []];
    return {
      kind: "code", tema: 3, template: "cremallera", title: "Diferencias consecutivas",
      statement: ["Escribe la función `diferencias(numeros)` que devuelva la lista de diferencias entre cada número y el anterior: `diferencias([3, 7, 4])` es `[4, -3]`. Con menos de dos números, `[]`. Usa `zip`."],
      fn: "diferencias", starter: starterOf("diferencias", "numeros"), cases: calls("diferencias", ls.map((l) => [l])), rules: [USA_ZIP],
      hints: ["Necesitas cada número junto a su siguiente.", "Combina la lista con una rebanada de sí misma que empiece en la posición 1.", "zip para en la lista más corta."],
      solution: py`
        def diferencias(numeros):
            return [b - a for a, b in zip(numeros, numeros[1:])]
      `,
    };
  },
};

const COMP_LISTAS: Tpl = {
  id: "comprension-listas",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const ns = [0, 1, rng.int(2, 6), rng.int(7, 15)];
      return {
        kind: "code", tema: 3, template: "comprension-listas", title: "Cuadrados",
        statement: ["Escribe la función `cuadrados(n)` que devuelva con una comprensión la lista de los cuadrados de 1 a `n`: `cuadrados(4)` es `[1, 4, 9, 16]`."],
        fn: "cuadrados", starter: starterOf("cuadrados", "n"), cases: calls("cuadrados", ns.map((n) => [n])), rules: [USA_COMP],
        hints: ["Una comprensión tiene la forma [expresión for variable in iterable].", "El iterable es un range: piensa en su inicio y su final.", "x ** 2 o x * x dan el cuadrado."],
        solution: py`
          def cuadrados(n):
              return [x * x for x in range(1, n + 1)]
        `,
      };
    }
    if (level === "medio") {
      const ls = [ints(rng, 6, -10, 10), ints(rng, 4, 1, 9), [], [1, 3, 5]];
      return {
        kind: "code", tema: 3, template: "comprension-listas", title: "Pares al cuadrado",
        statement: ["Escribe la función `pares_al_cuadrado(numeros)` que devuelva, con una comprensión, los cuadrados de los números pares de la lista, en el mismo orden."],
        fn: "pares_al_cuadrado", starter: starterOf("pares_al_cuadrado", "numeros"), cases: calls("pares_al_cuadrado", ls.map((l) => [l])), rules: [USA_COMP],
        hints: ["Una comprensión puede llevar un if al final para filtrar.", "Un número es par si el resto entre 2 es 0.", "La expresión del principio es el cuadrado."],
        solution: py`
          def pares_al_cuadrado(numeros):
              return [x * x for x in numeros if x % 2 == 0]
        `,
      };
    }
    const mat = () => Array.from({ length: rng.int(1, 4) }, () => ints(rng, rng.int(0, 3), 0, 9));
    const ms = [mat(), mat(), [], [[1], [], [2, 3]]];
    return {
      kind: "code", tema: 3, template: "comprension-listas", title: "Aplanar una matriz",
      statement: ["Escribe la función `aplanar(matriz)` que devuelva, con una sola comprensión, todos los elementos de una lista de listas en orden: `aplanar([[1, 2], [3]])` es `[1, 2, 3]`."],
      fn: "aplanar", starter: starterOf("aplanar", "matriz"), cases: calls("aplanar", ms.map((m) => [m])), rules: [USA_COMP],
      hints: ["Una comprensión puede tener dos for seguidos.", "Los for van en el mismo orden que si escribieras los bucles anidados.", "Primero recorres las filas; después, los elementos de cada fila."],
      solution: py`
        def aplanar(matriz):
            return [x for fila in matriz for x in fila]
      `,
    };
  },
};

const COMP_DICT: Tpl = {
  id: "comprension-dict",
  tema: 3,
  make(rng, level) {
    if (level === "básico") {
      const ls = [distinctWords(rng, 3), distinctWords(rng, 5), []];
      return {
        kind: "code", tema: 3, template: "comprension-dict", title: "Longitud de cada palabra",
        statement: ["Escribe la función `longitudes(palabras)` que devuelva, con una comprensión de diccionario, un diccionario de cada palabra a su número de letras."],
        fn: "longitudes", starter: starterOf("longitudes", "palabras"), cases: calls("longitudes", ls.map((l) => [l])), rules: [USA_DICTCOMP],
        hints: ["Una comprensión de diccionario va entre llaves y tiene clave: valor.", "len() da la longitud.", "La clave es la palabra."],
        solution: py`
          def longitudes(palabras):
              return {p: len(p) for p in palabras}
        `,
      };
    }
    const dict = (n: number) => Object.fromEntries(distinctWords(rng, n).map((w) => [w, quarter(rng, 0, 10)])) as Record<string, number>;
    if (level === "medio") {
      const values = rng.shuffle(Array.from({ length: 30 }, (_, i) => i + 1));
      const inv = (n: number) => Object.fromEntries(distinctWords(rng, n).map((w, i) => [w, values[i]!])) as Record<string, number>;
      const ds = [inv(3), inv(4), {}];
      return {
        kind: "code", tema: 3, template: "comprension-dict", title: "Invertir un diccionario",
        statement: ["Escribe la función `invertir(diccionario)` que devuelva, con una comprensión, un diccionario nuevo con las claves y los valores intercambiados (los valores no se repiten)."],
        fn: "invertir", starter: starterOf("invertir", "diccionario"), cases: calls("invertir", ds.map((d) => [d])), rules: [USA_DICTCOMP],
        hints: ["items() da las parejas (clave, valor).", "En la comprensión, pon primero lo que será la clave nueva.", "No modifiques el diccionario original."],
        solution: py`
          def invertir(diccionario):
              return {v: k for k, v in diccionario.items()}
        `,
      };
    }
    const min = rng.pick([5, 6, 7]);
    const ds = [dict(4), dict(5), {}];
    return {
      kind: "code", tema: 3, template: "comprension-dict", title: "Filtrar un diccionario",
      statement: ["Escribe la función `filtrar(notas, minimo)` que devuelva, con una comprensión, solo las entradas del diccionario `notas` cuyo valor sea mayor o igual que `minimo`."],
      fn: "filtrar", starter: starterOf("filtrar", "notas, minimo"), cases: calls("filtrar", ds.map((d) => [d, min])), rules: [USA_DICTCOMP],
      hints: ["Las comprensiones de diccionario también admiten un if.", "Recorre las parejas con items().", "Deja la clave y el valor como están."],
      solution: py`
        def filtrar(notas, minimo):
            return {k: v for k, v in notas.items() if v >= minimo}
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 4: funciones

const POR_DEFECTO: Tpl = {
  id: "por-defecto",
  tema: 4,
  make(rng, level) {
    if (level === "básico") {
      const saludo = rng.pick(["Hola", "Buenos días", "Bienvenido"]);
      const [a, b, c] = names(rng, 3) as [string, string, string];
      const cases: PyCase[] = [{ code: call("saludar", a) }, { code: call("saludar", b, "Buenas tardes") }, { code: `saludar(${lit(c)}, saludo=${lit("Hasta luego")})` }];
      return {
        kind: "code", tema: 4, template: "por-defecto", title: "Saludo con valor por defecto",
        statement: [`Escribe la función \`saludar(nombre, saludo)\` que devuelva \`'<saludo>, <nombre>!'\`, donde \`saludo\` vale \`'${saludo}'\` si no se indica. Por ejemplo, \`saludar('Lira')\` devuelve \`'${saludo}, Lira!'\`.`],
        fn: "saludar", starter: starterOf("saludar", "nombre"), cases,
        hints: ["Un parámetro con valor por defecto se escribe parametro=valor en la cabecera.", "Los parámetros con valor por defecto van después de los obligatorios.", "Un f-string compone el texto."],
        solution: py`
          def saludar(nombre, saludo="${saludo}"):
              return f"{saludo}, {nombre}!"
        `,
      };
    }
    if (level === "medio") {
      const cases: PyCase[] = [{ code: call("potencia", rng.int(2, 12)) }, { code: call("potencia", rng.int(2, 5), rng.int(3, 6)) }, { code: `potencia(${rng.int(2, 9)}, exponente=0)` }, { code: call("potencia", -3) }];
      return {
        kind: "code", tema: 4, template: "por-defecto", title: "Potencia (al cuadrado por defecto)",
        statement: ["Escribe la función `potencia(base, exponente)` que devuelva `base` elevado a `exponente`, donde `exponente` vale 2 si no se indica."],
        fn: "potencia", starter: starterOf("potencia", "base"), cases,
        hints: ["Añade el segundo parámetro con su valor por defecto en la cabecera.", "El operador ** eleva a una potencia.", "Las pruebas llaman a la función con uno y con dos argumentos."],
        solution: py`
          def potencia(base, exponente=2):
              return base ** exponente
        `,
      };
    }
    const [x, y] = [rng.int(1, 9), rng.int(10, 99)];
    const cases: PyCase[] = [
      { code: `a = agregar(${x})\nb = agregar(${y})\n(a, b)` },
      { code: `mia = [${rng.int(0, 9)}]\nr = agregar(${x}, mia)\n(r, mia, r is mia)` },
      { code: `agregar(${lit(rng.pick(WORDS))})` },
    ];
    return {
      kind: "code", tema: 4, template: "por-defecto", title: "El valor por defecto mutable",
      statement: [
        "Escribe la función `agregar(elemento, lista)` que añada `elemento` al final de `lista` y la devuelva. Si no se pasa una lista, debe empezar cada vez con una lista vacía nueva.",
        "Cuidado: `lista=[]` en la cabecera crea una sola lista que se comparte entre todas las llamadas.",
      ],
      fn: "agregar", starter: starterOf("agregar", "elemento"), cases,
      hints: ["El valor por defecto se evalúa una sola vez, al definir la función.", "Usa un valor por defecto que no se pueda modificar y que indique «no me han pasado nada».", "Dentro de la función, si recibes ese valor, crea la lista vacía."],
      solution: py`
        def agregar(elemento, lista=None):
            if lista is None:
                lista = []
            lista.append(elemento)
            return lista
      `,
    };
  },
};

const ARGS_KWARGS: Tpl = {
  id: "args-kwargs",
  tema: 4,
  make(rng, level) {
    const raw = (fn: string, args: number[]) => ({ code: `${fn}(${args.join(", ")})` });
    if (level === "básico") {
      const cases = [raw("sumar_todos", ints(rng, 3, 0, 20)), raw("sumar_todos", ints(rng, 6, -9, 9)), raw("sumar_todos", []), raw("sumar_todos", [rng.int(1, 99)])];
      return {
        kind: "code", tema: 4, template: "args-kwargs", title: "Sumar todos",
        statement: ["Escribe la función `sumar_todos` que acepte cualquier número de argumentos y devuelva su suma: `sumar_todos(1, 2, 3)` es 6 y `sumar_todos()` es 0."],
        fn: "sumar_todos", starter: "def sumar_todos():\n    # Escribe aquí tu código (y cambia los parámetros)\n    pass\n", cases,
        hints: ["Un parámetro con un asterisco delante recoge todos los argumentos posicionales.", "Dentro de la función, ese parámetro es una tupla.", "sum() suma los elementos de una tupla."],
        solution: py`
          def sumar_todos(*numeros):
              return sum(numeros)
        `,
      };
    }
    if (level === "medio") {
      const cases = [raw("media", ints(rng, 3, 0, 10)), raw("media", ints(rng, 5, 0, 10)), raw("media", []), raw("media", [rng.int(1, 9)])];
      return {
        kind: "code", tema: 4, template: "args-kwargs", title: "Media de los argumentos",
        statement: ["Escribe la función `media` que acepte cualquier número de argumentos y devuelva su media redondeada a dos decimales, o 0 si no recibe ninguno."],
        fn: "media", starter: "def media():\n    # Escribe aquí tu código (y cambia los parámetros)\n    pass\n", cases,
        hints: ["*numeros recoge los argumentos en una tupla.", "Una tupla vacía es falsa en un if: compruébalo antes de dividir.", "La media es la suma entre la cantidad."],
        solution: py`
          def media(*numeros):
              if not numeros:
                  return 0
              return round(sum(numeros) / len(numeros), 2)
        `,
      };
    }
    const kw = () =>
      distinctWords(rng, rng.int(1, 3))
        .map((k) => `${k}=${rng.chance(0.5) ? rng.int(0, 99) : lit(rng.pick(WORDS))}`)
        .join(", ");
    const cases: PyCase[] = [{ code: `ficha(${kw()})` }, { code: `ficha(${kw()})` }, { code: "ficha()" }, { code: `ficha(${kw()})` }];
    return {
      kind: "code", tema: 4, template: "args-kwargs", title: "Ficha con argumentos con nombre",
      statement: [
        "Escribe la función `ficha` que acepte cualquier número de argumentos con nombre y devuelva un texto `clave=valor` por cada uno, ordenados por la clave y separados por una coma y un espacio.",
        "Por ejemplo, `ficha(talla=40, color='azul')` devuelve `'color=azul, talla=40'`; sin argumentos, `''`.",
      ],
      fn: "ficha", starter: "def ficha():\n    # Escribe aquí tu código (y cambia los parámetros)\n    pass\n", cases,
      hints: ["Dos asteriscos delante de un parámetro recogen los argumentos con nombre en un diccionario.", "Ordena las parejas (clave, valor) por la clave.", "join() une los textos con el separador."],
      solution: py`
        def ficha(**datos):
            return ", ".join(f"{k}={v}" for k, v in sorted(datos.items()))
      `,
    };
  },
};

const VARIOS_VALORES: Tpl = {
  id: "varios-valores",
  tema: 4,
  make(rng, level) {
    if (level === "básico") {
      const ls = [ints(rng, 4, 0, 99), words(rng, 3), [rng.int(0, 9)], ints(rng, 6, -9, 9)];
      return {
        kind: "code", tema: 4, template: "varios-valores", title: "Primero y último",
        statement: ["Escribe la función `primero_y_ultimo(lista)` que devuelva dos valores: el primer y el último elemento de una lista no vacía."],
        fn: "primero_y_ultimo", starter: starterOf("primero_y_ultimo", "lista"), cases: calls("primero_y_ultimo", ls.map((l) => [l])),
        hints: ["return puede devolver varios valores separados por comas.", "El último elemento tiene un índice negativo cómodo.", "Quien llama recibe una tupla."],
        solution: py`
          def primero_y_ultimo(lista):
              return lista[0], lista[-1]
        `,
      };
    }
    if (level === "medio") {
      const ls = [ints(rng, 5, 0, 20), ints(rng, 3, -9, 9), [rng.int(0, 9)], [quarter(rng, 0, 10), quarter(rng, 0, 10)]];
      const cases: PyCase[] = ls.map((l) => ({ code: `mn, mx, md = estadisticas(${lit(l)})\n(mn, mx, md)` }));
      return {
        kind: "code", tema: 4, template: "varios-valores", title: "Estadísticas básicas",
        statement: ["Escribe la función `estadisticas(numeros)` que devuelva tres valores: el mínimo, el máximo y la media (redondeada a dos decimales) de una lista no vacía. Las pruebas los recogen como `mn, mx, md = estadisticas(...)`."],
        fn: "estadisticas", starter: starterOf("estadisticas", "numeros"), cases,
        hints: ["Calcula cada valor por separado.", "Devuelve los tres separados por comas, en ese orden.", "round(x, 2) para la media."],
        solution: py`
          def estadisticas(numeros):
              return min(numeros), max(numeros), round(sum(numeros) / len(numeros), 2)
        `,
      };
    }
    const args: PyVal[][] = [[rng.int(10, 99), rng.int(2, 9)], [rng.int(0, 5), rng.int(6, 9)], [rng.int(1, 50), 0], [-rng.int(10, 30), rng.int(2, 7)]];
    return {
      kind: "code", tema: 4, template: "varios-valores", title: "Cociente y resto con control",
      statement: ["Escribe la función `dividir(a, b)` que devuelva el cociente entero y el resto de dividir `a` entre `b`. Si `b` es 0, devuelve `(None, None)` en lugar de lanzar un error."],
      fn: "dividir", starter: starterOf("dividir", "a, b"), cases: calls("dividir", args),
      hints: ["Comprueba el caso problemático antes de dividir.", "// y % dan el cociente y el resto (y divmod, los dos a la vez).", "En el caso especial, devuelve dos None."],
      solution: py`
        def dividir(a, b):
            if b == 0:
                return None, None
            return a // b, a % b
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 4: recursión, lambdas y sorted

const RECURSION: Tpl = {
  id: "recursion",
  tema: 4,
  make(rng, level) {
    if (level === "básico") {
      const ns = [0, 1, rng.int(2, 6), rng.int(7, 15)];
      return {
        kind: "code", tema: 4, template: "recursion", title: "Factorial recursivo",
        statement: ["Escribe la función recursiva `factorial(n)` que devuelva n! = n · (n − 1) · … · 1, con 0! = 1. Debe llamarse a sí misma."],
        fn: "factorial", starter: starterOf("factorial", "n"), cases: calls("factorial", ns.map((n) => [n])), rules: [recursive("factorial")],
        hints: ["Toda recursión necesita un caso base que no se llame a sí mismo.", "¿Qué relación hay entre n! y (n − 1)!?", "El caso base es n igual a 0 (o menor que 2)."],
        solution: py`
          def factorial(n):
              if n < 2:
                  return 1
              return n * factorial(n - 1)
        `,
      };
    }
    if (level === "medio") {
      const ns = [0, rng.int(1, 9), rng.int(10, 999), rng.int(1000, 999_999)];
      return {
        kind: "code", tema: 4, template: "recursion", title: "Suma de cifras recursiva",
        statement: ["Escribe la función recursiva `suma_cifras(n)` que sume las cifras de un entero `n` ≥ 0 llamándose a sí misma, sin bucles."],
        fn: "suma_cifras", starter: starterOf("suma_cifras", "n"), cases: calls("suma_cifras", ns.map((n) => [n])),
        rules: [recursive("suma_cifras"), { kind: "evita", what: "nodo:For", label: "Sin for" }, { kind: "evita", what: "nodo:While", label: "Sin while" }],
        hints: ["La última cifra es n % 10 y el resto del número es n // 10.", "La suma de cifras de n es su última cifra más la suma de cifras del resto.", "¿Cuándo paras? Cuando no quedan cifras."],
        solution: py`
          def suma_cifras(n):
              if n == 0:
                  return 0
              return n % 10 + suma_cifras(n // 10)
        `,
      };
    }
    const ls: PyVal[] = [[1, [2, [3, [4]]], 5], [[rng.int(0, 9), [rng.int(0, 9)]], [], rng.int(0, 9)], [], [[[]], [rng.int(0, 9)]], ints(rng, 3, 0, 9)];
    return {
      kind: "code", tema: 4, template: "recursion", title: "Aplanar a cualquier profundidad",
      statement: ["Escribe la función recursiva `aplanar_todo(lista)` que devuelva todos los elementos que no son listas, en orden, aunque estén anidados a cualquier profundidad: `aplanar_todo([1, [2, [3]], 4])` es `[1, 2, 3, 4]`."],
      fn: "aplanar_todo", starter: starterOf("aplanar_todo", "lista"), cases: calls("aplanar_todo", ls.map((l) => [l])), rules: [recursive("aplanar_todo")],
      hints: ["isinstance(x, list) dice si x es una lista.", "Si un elemento es una lista, aplánalo con la misma función y añade lo que devuelva.", "extend() añade varios elementos a la vez."],
      solution: py`
        def aplanar_todo(lista):
            resultado = []
            for x in lista:
                if isinstance(x, list):
                    resultado.extend(aplanar_todo(x))
                else:
                    resultado.append(x)
            return resultado
      `,
    };
  },
};

const ORDENAR: Tpl = {
  id: "ordenar",
  tema: 4,
  make(rng, level) {
    if (level === "básico") {
      const ls = [distinctWords(rng, 5), distinctWords(rng, 4), [], ["mar", "sol", "luz"]];
      return {
        kind: "code", tema: 4, template: "ordenar", title: "Ordenar por longitud",
        statement: ["Escribe la función `por_longitud(palabras)` que devuelva una lista nueva con las palabras ordenadas de más corta a más larga. Si dos miden lo mismo, quedan en el orden en que estaban. Usa `sorted`."],
        fn: "por_longitud", starter: starterOf("por_longitud", "palabras"), cases: calls("por_longitud", ls.map((l) => [l])), rules: [{ kind: "usa", what: "llamada:sorted", label: "Usa sorted()" }],
        hints: ["sorted acepta un argumento key: una función que dice por qué ordenar.", "Ya existe una función que da la longitud.", "sorted es estable: los empates conservan el orden."],
        solution: py`
          def por_longitud(palabras):
              return sorted(palabras, key=len)
        `,
      };
    }
    const ns = names(rng, 5);
    if (level === "medio") {
      const al = (k: number) => ns.slice(0, k).map((n) => tup(n, rng.int(0, 10)));
      const ls = [al(4), al(5), [tup(ns[0]!, 7), tup(ns[1]!, 7), tup(ns[2]!, 9)], []];
      return {
        kind: "code", tema: 4, template: "ordenar", title: "Ordenar por nota",
        statement: ["Escribe la función `por_nota(alumnos)` que reciba una lista de tuplas `(nombre, nota)` y la devuelva ordenada de mayor a menor nota y, con la misma nota, por nombre alfabéticamente. Usa `sorted` con una `lambda`."],
        fn: "por_nota", starter: starterOf("por_nota", "alumnos"), cases: calls("por_nota", ls.map((l) => [l])), rules: [USA_LAMBDA],
        hints: ["La key puede devolver una tupla: se ordena por su primer elemento y, si empata, por el segundo.", "Para ordenar una nota numérica de mayor a menor dentro de la tupla, cámbiale el signo.", "La lambda recibe cada tupla del alumno."],
        solution: py`
          def por_nota(alumnos):
              return sorted(alumnos, key=lambda a: (-a[1], a[0]))
        `,
      };
    }
    const pts = (k: number) => Object.fromEntries(ns.slice(0, k).map((n) => [n, rng.int(0, 20)])) as Record<string, number>;
    const args: PyVal[][] = [[pts(5), 3], [pts(4), 1], [{ [ns[0]!]: 5, [ns[1]!]: 5, [ns[2]!]: 2 }, 2], [pts(3), 5]];
    return {
      kind: "code", tema: 4, template: "ordenar", title: "Los n mejores",
      statement: ["Escribe la función `mejores(puntos, n)` que reciba un diccionario de nombre a puntos y devuelva la lista de los `n` nombres con más puntos (o todos, si hay menos), de más a menos puntos y, en caso de empate, por orden alfabético. Usa `sorted` con una `lambda`."],
      fn: "mejores", starter: starterOf("mejores", "puntos, n"), cases: calls("mejores", args), rules: [USA_LAMBDA],
      hints: ["Ordena las claves del diccionario, no las parejas.", "La key puede devolver una tupla (puntos cambiados de signo, nombre).", "Una rebanada [:n] se queda con los primeros, aunque haya menos."],
      solution: py`
        def mejores(puntos, n):
            return sorted(puntos, key=lambda k: (-puntos[k], k))[:n]
      `,
    };
  },
};

const LAMBDAS: Tpl = {
  id: "lambdas",
  tema: 4,
  make(rng, level) {
    if (level === "básico") {
      const k = rng.int(2, 9);
      const cases: PyCase[] = [
        { code: `aplicar(lambda x: x * ${k}, ${lit(ints(rng, 4, 0, 9))})` },
        { code: `aplicar(len, ${lit(words(rng, 3))})` },
        { code: "aplicar(str.upper, ['a', 'b'])" },
        { code: "aplicar(abs, [])" },
      ];
      return {
        kind: "code", tema: 4, template: "lambdas", title: "Aplicar una función",
        statement: ["Escribe la función `aplicar(f, lista)` que devuelva una lista nueva con el resultado de aplicar la función `f` a cada elemento. Las pruebas le pasan lambdas y funciones como `len`."],
        fn: "aplicar", starter: starterOf("aplicar", "f, lista"), cases,
        hints: ["En Python, una función es un valor más: se puede pasar como argumento.", "Llama a f con cada elemento.", "Una comprensión lo resuelve en una línea."],
        solution: py`
          def aplicar(f, lista):
              return [f(x) for x in lista]
        `,
      };
    }
    if (level === "medio") {
      const [a, b] = [rng.int(1, 9), rng.int(2, 5)];
      const cases: PyCase[] = [
        { code: `h = componer(lambda x: x + ${a}, lambda x: x * ${b})\n[h(0), h(${rng.int(1, 9)})]` },
        { code: `h = componer(len, str.strip)\nh(${lit(`  ${rng.pick(WORDS)} `)})` },
        { code: `h = componer(lambda x: x * ${b}, lambda x: x + ${a})\nh(${rng.int(1, 9)})` },
      ];
      return {
        kind: "code", tema: 4, template: "lambdas", title: "Componer funciones",
        statement: ["Escribe la función `componer(f, g)` que devuelva una función nueva que, al llamarla con `x`, devuelva `f(g(x))`."],
        fn: "componer", starter: starterOf("componer", "f, g"), cases,
        hints: ["El resultado de componer no es un número: es una función.", "Puedes devolver una lambda que use f y g.", "Primero se aplica g y después f."],
        solution: py`
          def componer(f, g):
              return lambda x: f(g(x))
        `,
      };
    }
    const k = rng.int(2, 9);
    const cases: PyCase[] = [
      { code: `por_${k} = multiplicador(${k})\n[por_${k}(1), por_${k}(${rng.int(2, 9)})]` },
      { code: `fs = [multiplicador(i) for i in range(4)]\n[f(10) for f in fs]` },
      { code: `multiplicador(${rng.int(-5, -1)})(${rng.int(1, 9)})` },
    ];
    return {
      kind: "code", tema: 4, template: "lambdas", title: "Fábrica de funciones",
      statement: ["Escribe la función `multiplicador(k)` que devuelva una función de un argumento que multiplique por `k`: `multiplicador(3)(5)` es 15. Cada función creada recuerda su propio `k`."],
      fn: "multiplicador", starter: starterOf("multiplicador", "k"), cases,
      hints: ["La función que devuelves puede usar los parámetros de multiplicador.", "Una lambda de un argumento basta.", "Cada llamada a multiplicador crea una función distinta con su k."],
      solution: py`
        def multiplicador(k):
            return lambda x: x * k
      `,
    };
  },
};

// ---------------------------------------------------------------- Tema 5: ficheros

/** Texto de varias líneas (cada una acaba en \n), con alguna vacía si `blanks`. */
function textLines(rng: Rng, n: number, blanks: boolean): string {
  return Array.from({ length: n }, () => (blanks && rng.chance(0.25) ? (rng.chance(0.5) ? "" : "   ") : words(rng, rng.int(1, 5)).join(" ")))
    .map((l) => `${l}\n`)
    .join("");
}

const LINEAS: Tpl = {
  id: "lineas",
  tema: 5,
  make(rng, level) {
    const file = (text: string, code: string): PyCase => ({ code, files: { "datos.txt": text } });
    if (level === "básico") {
      const cases = [textLines(rng, rng.int(2, 8), false), textLines(rng, rng.int(5, 12), true), "", "una sola línea\n"].map((t) => file(t, "contar_lineas('datos.txt')"));
      return {
        kind: "code", tema: 5, template: "lineas", title: "Contar líneas",
        statement: ["Escribe la función `contar_lineas(ruta)` que abra el archivo de texto `ruta` (con `with open`) y devuelva cuántas líneas tiene. En cada prueba hay un `datos.txt` distinto en la carpeta de trabajo."],
        fn: "contar_lineas", starter: starterOf("contar_lineas", "ruta"), cases, rules: [USA_WITH],
        hints: ["with open(ruta) abre el archivo y lo cierra al salir del bloque.", "Recorrer un archivo con for da una línea en cada vuelta.", "Cuenta las vueltas (o usa readlines)."],
        solution: py`
          def contar_lineas(ruta):
              with open(ruta, encoding="utf-8") as f:
                  return len(f.readlines())
        `,
      };
    }
    if (level === "medio") {
      const cases = [textLines(rng, rng.int(4, 10), true), textLines(rng, rng.int(4, 10), true), "\n\n  \n", textLines(rng, 3, false)].map((t) => file(t, "lineas_no_vacias('datos.txt')"));
      return {
        kind: "code", tema: 5, template: "lineas", title: "Líneas con contenido",
        statement: ["Escribe la función `lineas_no_vacias(ruta)` que devuelva cuántas líneas del archivo tienen algo más que espacios."],
        fn: "lineas_no_vacias", starter: starterOf("lineas_no_vacias", "ruta"), cases, rules: [USA_WITH],
        hints: ["Cada línea que lees termina en \\n (salvo, quizá, la última).", "strip() quita espacios y saltos de línea de los extremos.", "Un texto vacío es falso en un if."],
        solution: py`
          def lineas_no_vacias(ruta):
              with open(ruta, encoding="utf-8") as f:
                  return sum(1 for linea in f if linea.strip())
        `,
      };
    }
    const w = rng.pick(WORDS);
    const withWord = (n: number) =>
      Array.from({ length: n }, () => {
        const ws = words(rng, rng.int(1, 4));
        if (rng.chance(0.4)) ws.splice(rng.int(0, ws.length), 0, rng.chance(0.5) ? w.toUpperCase() : w);
        return `${ws.join(" ")}\n`;
      }).join("");
    const cases = [withWord(6), withWord(9), "", withWord(4)].map((t) => file(t, `lineas_con('datos.txt', ${lit(w)})`));
    return {
      kind: "code", tema: 5, template: "lineas", title: "Líneas que contienen una palabra",
      statement: ["Escribe la función `lineas_con(ruta, palabra)` que devuelva cuántas líneas del archivo contienen el texto `palabra`, sin distinguir mayúsculas de minúsculas."],
      fn: "lineas_con", starter: starterOf("lineas_con", "ruta, palabra"), cases, rules: [USA_WITH],
      hints: ["Recorre el archivo línea a línea.", "Pasa la línea y la palabra a minúsculas antes de comparar.", "El operador in busca un texto dentro de otro."],
      solution: py`
        def lineas_con(ruta, palabra):
            palabra = palabra.lower()
            with open(ruta, encoding="utf-8") as f:
                return sum(1 for linea in f if palabra in linea.lower())
      `,
    };
  },
};

const PALABRAS_FICHERO: Tpl = {
  id: "palabras-fichero",
  tema: 5,
  make(rng, level) {
    const file = (text: string, code: string, compare?: PyCompare[]): PyCase => ({ code, files: { "texto.txt": text }, ...(compare ? { compare } : {}) });
    if (level === "básico") {
      const cases = [textLines(rng, 4, true), textLines(rng, 7, false), ""].map((t) => file(t, "contar_palabras('texto.txt')"));
      return {
        kind: "code", tema: 5, template: "palabras-fichero", title: "Contar palabras de un archivo",
        statement: ["Escribe la función `contar_palabras(ruta)` que devuelva cuántas palabras (separadas por espacios o saltos de línea) tiene el archivo `texto.txt` que se le pasa."],
        fn: "contar_palabras", starter: starterOf("contar_palabras", "ruta"), cases, rules: [USA_WITH],
        hints: ["read() lee todo el archivo en un solo texto.", "split() sin argumentos separa por cualquier espacio en blanco, saltos de línea incluidos.", "La longitud de la lista es el número de palabras."],
        solution: py`
          def contar_palabras(ruta):
              with open(ruta, encoding="utf-8") as f:
                  return len(f.read().split())
        `,
      };
    }
    const mixed = (n: number) =>
      Array.from({ length: n }, () => `${words(rng, rng.int(2, 5)).map((x) => (rng.chance(0.3) ? cap(x) : x)).join(" ")}\n`).join("");
    if (level === "medio") {
      const cases = [mixed(4), mixed(6), "Sol sol LUNA luna\n"].map((t) => file(t, "mas_frecuente_en('texto.txt')"));
      return {
        kind: "code", tema: 5, template: "palabras-fichero", title: "La palabra más frecuente",
        statement: ["Escribe la función `mas_frecuente_en(ruta)` que devuelva, en minúsculas, la palabra que más se repite en el archivo (sin distinguir mayúsculas). Si hay empate, la primera en orden alfabético."],
        fn: "mas_frecuente_en", starter: starterOf("mas_frecuente_en", "ruta"), cases, rules: [USA_WITH],
        hints: ["Lee el archivo, pásalo a minúsculas y sepáralo en palabras.", "Cuenta con un diccionario.", "Para el empate, ordena por (−cuenta, palabra) o recorre las palabras en orden alfabético."],
        solution: py`
          def mas_frecuente_en(ruta):
              with open(ruta, encoding="utf-8") as f:
                  palabras = f.read().lower().split()
              cuentas = {}
              for p in palabras:
                  cuentas[p] = cuentas.get(p, 0) + 1
              return sorted(cuentas, key=lambda p: (-cuentas[p], p))[0]
        `,
      };
    }
    const cases = [mixed(4), mixed(6), "b a\nb\n"].map((t) => file(t, "frecuencias_a_fichero('texto.txt', 'frecuencias.txt')", ["valor", "archivo:frecuencias.txt"]));
    return {
      kind: "code", tema: 5, template: "palabras-fichero", title: "Escribir las frecuencias",
      statement: [
        "Escribe la función `frecuencias_a_fichero(entrada, salida)` que cuente las palabras del archivo `entrada` (en minúsculas) y escriba en `salida` una línea `palabra: n` por cada una, de la más frecuente a la menos y, con la misma frecuencia, por orden alfabético.",
        "Debe devolver cuántas palabras distintas ha escrito. Las pruebas comprueban el valor devuelto y el contenido de `frecuencias.txt`.",
      ],
      fn: "frecuencias_a_fichero", starter: starterOf("frecuencias_a_fichero", "entrada, salida"), cases, rules: [USA_WITH],
      hints: ["Hay dos archivos: uno se abre para leer y otro para escribir (modo \"w\").", "Cuenta primero; después ordena las palabras por (−cuenta, palabra).", "write() no añade el salto de línea: ponlo tú al final de cada línea."],
      solution: py`
        def frecuencias_a_fichero(entrada, salida):
            with open(entrada, encoding="utf-8") as f:
                palabras = f.read().lower().split()
            cuentas = {}
            for p in palabras:
                cuentas[p] = cuentas.get(p, 0) + 1
            orden = sorted(cuentas, key=lambda p: (-cuentas[p], p))
            with open(salida, "w", encoding="utf-8") as f:
                for p in orden:
                    f.write(f"{p}: {cuentas[p]}\n")
            return len(orden)
      `,
    };
  },
};

const CSV: Tpl = {
  id: "csv",
  tema: 5,
  make(rng, level) {
    const grupos = ["A", "B", "C"];
    const table = (n: number) => {
      const ns = names(rng, n);
      const rows = ns.map((nm) => `${nm},${rng.pick(grupos)},${quarter(rng, 0, 10)}`);
      return `nombre,grupo,nota\n${rows.join("\n")}\n`;
    };
    if (level === "básico") {
      const cases: PyCase[] = [table(4), table(6), "nombre,grupo,nota\n"].map((t) => ({ code: "suma_columna('notas.csv', 'nota')", files: { "notas.csv": t } }));
      return {
        kind: "code", tema: 5, template: "csv", title: "Sumar una columna de un CSV",
        statement: ["Escribe la función `suma_columna(ruta, columna)` que lea un CSV con cabecera (como `nombre,grupo,nota`) con el módulo `csv` y devuelva la suma de los valores de esa columna como float, redondeada a dos decimales."],
        fn: "suma_columna", starter: `import csv\n\n\n${starterOf("suma_columna", "ruta, columna")}`, cases, rules: [USA_CSV, USA_WITH],
        hints: ["csv.DictReader da cada fila como un diccionario cuyas claves son los nombres de la cabecera.", "Los valores llegan como texto: conviértelos con float().", "Redondea solo al final."],
        solution: py`
          import csv

          def suma_columna(ruta, columna):
              with open(ruta, encoding="utf-8", newline="") as f:
                  return round(sum(float(fila[columna]) for fila in csv.DictReader(f)), 2)
        `,
      };
    }
    if (level === "medio") {
      const min = rng.pick([5, 6, 7]);
      const cases: PyCase[] = [table(5), table(7), "nombre,grupo,nota\n"].map((t) => ({
        code: `filtrar_csv('notas.csv', 'aprobados.csv', 'nota', ${min})`,
        files: { "notas.csv": t },
        compare: ["valor", "archivo:aprobados.csv"],
      }));
      return {
        kind: "code", tema: 5, template: "csv", title: "Filtrar filas de un CSV",
        statement: [
          `Escribe la función \`filtrar_csv(entrada, salida, columna, minimo)\` que copie en el CSV \`salida\` la cabecera y solo las filas de \`entrada\` cuyo valor en \`columna\` (como número) sea mayor o igual que \`minimo\`, en el mismo orden y con los valores tal cual. Usa el módulo \`csv\`.`,
          "Debe devolver cuántas filas de datos ha escrito. Las pruebas comprueban el valor y el contenido de `aprobados.csv`.",
        ],
        fn: "filtrar_csv", starter: `import csv\n\n\n${starterOf("filtrar_csv", "entrada, salida, columna, minimo")}`, cases, rules: [USA_CSV],
        hints: ["Abre los dos archivos: uno para leer y otro para escribir, con newline=\"\".", "csv.DictReader lee y csv.DictWriter escribe; el escritor necesita los nombres de las columnas y writeheader().", "Compara float(fila[columna]) con el mínimo y cuenta las filas que escribes."],
        solution: py`
          import csv

          def filtrar_csv(entrada, salida, columna, minimo):
              with open(entrada, encoding="utf-8", newline="") as f:
                  lector = csv.DictReader(f)
                  campos = lector.fieldnames
                  filas = [fila for fila in lector if float(fila[columna]) >= minimo]
              with open(salida, "w", encoding="utf-8", newline="") as f:
                  escritor = csv.DictWriter(f, fieldnames=campos)
                  escritor.writeheader()
                  escritor.writerows(filas)
              return len(filas)
        `,
      };
    }
    const cases: PyCase[] = [table(6), table(8), "nombre,grupo,nota\n"].map((t) => ({ code: "media_por_grupo('notas.csv')", files: { "notas.csv": t } }));
    return {
      kind: "code", tema: 5, template: "csv", title: "Media por grupo",
      statement: ["Escribe la función `media_por_grupo(ruta)` que lea un CSV con las columnas `nombre,grupo,nota` (usa el módulo `csv`) y devuelva un diccionario de cada grupo a la media de sus notas, redondeada a dos decimales. Sin filas, el diccionario vacío."],
      fn: "media_por_grupo", starter: `import csv\n\n\n${starterOf("media_por_grupo", "ruta")}`, cases, rules: [USA_CSV, USA_WITH],
      hints: ["Agrupa las notas por grupo en un diccionario de listas.", "Convierte cada nota con float().", "Calcula las medias al terminar de leer."],
      solution: py`
        import csv

        def media_por_grupo(ruta):
            grupos = {}
            with open(ruta, encoding="utf-8", newline="") as f:
                for fila in csv.DictReader(f):
                    grupos.setdefault(fila["grupo"], []).append(float(fila["nota"]))
            return {g: round(sum(v) / len(v), 2) for g, v in grupos.items()}
      `,
    };
  },
};

const ESCRIBIR: Tpl = {
  id: "escribir",
  tema: 5,
  make(rng, level) {
    if (level === "básico") {
      const cases: PyCase[] = [words(rng, 3), words(rng, 5), []].map((l) => ({ code: `escribir_lineas('salida.txt', ${lit(l)})`, compare: ["archivo:salida.txt"] }));
      return {
        kind: "code", tema: 5, template: "escribir", title: "Escribir líneas",
        statement: ["Escribe la función `escribir_lineas(ruta, lineas)` que cree (o sustituya) el archivo `ruta` y escriba en él cada texto de la lista en su propia línea, cada una terminada en salto de línea. Las pruebas comprueban el contenido de `salida.txt`."],
        fn: "escribir_lineas", starter: starterOf("escribir_lineas", "ruta, lineas"), cases, rules: [USA_WITH],
        hints: ["El modo \"w\" de open crea el archivo o lo vacía.", "write() escribe exactamente lo que le das, sin salto de línea.", "Recorre la lista y escribe cada texto seguido de \\n."],
        solution: py`
          def escribir_lineas(ruta, lineas):
              with open(ruta, "w", encoding="utf-8") as f:
                  for linea in lineas:
                      f.write(linea + "\n")
        `,
      };
    }
    if (level === "medio") {
      const cases: PyCase[] = [textLines(rng, 3, false), textLines(rng, 5, true), ""].map((t) => ({
        code: "copiar_en_mayusculas('entrada.txt', 'salida.txt')",
        files: { "entrada.txt": t },
        compare: ["archivo:salida.txt"],
      }));
      return {
        kind: "code", tema: 5, template: "escribir", title: "Copiar en mayúsculas",
        statement: ["Escribe la función `copiar_en_mayusculas(entrada, salida)` que copie el archivo `entrada` en `salida` con todo el texto en mayúsculas."],
        fn: "copiar_en_mayusculas", starter: starterOf("copiar_en_mayusculas", "entrada, salida"), cases, rules: [USA_WITH],
        hints: ["Lee todo el contenido del primero.", "upper() pasa un texto a mayúsculas.", "Escribe el resultado en el segundo, abierto en modo \"w\"."],
        solution: py`
          def copiar_en_mayusculas(entrada, salida):
              with open(entrada, encoding="utf-8") as f:
                  texto = f.read()
              with open(salida, "w", encoding="utf-8") as f:
                  f.write(texto.upper())
        `,
      };
    }
    const cases: PyCase[] = [textLines(rng, 5, true), textLines(rng, 7, true), "\n\n"].map((t) => ({
      code: "numerar_lineas('entrada.txt', 'numerado.txt')",
      files: { "entrada.txt": t },
      compare: ["valor", "archivo:numerado.txt"],
    }));
    return {
      kind: "code", tema: 5, template: "escribir", title: "Numerar líneas",
      statement: [
        "Escribe la función `numerar_lineas(entrada, salida)` que escriba en `salida` las líneas de `entrada` que tengan algo más que espacios, sin los espacios de los extremos y numeradas desde 1 con el formato `1: texto`, y devuelva cuántas ha escrito.",
      ],
      fn: "numerar_lineas", starter: starterOf("numerar_lineas", "entrada, salida"), cases, rules: [USA_WITH],
      hints: ["Lleva un contador aparte: solo avanza con las líneas que escribes.", "strip() quita los espacios y el salto de línea de los extremos.", "Cada línea que escribes necesita su \\n."],
      solution: py`
        def numerar_lineas(entrada, salida):
            n = 0
            with open(entrada, encoding="utf-8") as f, open(salida, "w", encoding="utf-8") as g:
                for linea in f:
                    texto = linea.strip()
                    if texto:
                        n += 1
                        g.write(f"{n}: {texto}\n")
            return n
      `,
    };
  },
};

// ---------------------------------------------------------------- ¿Qué imprime?

type OutTpl = { id: string; tema: PyTema; make(rng: Rng): { code: string; hints: string[] } };

const OUT_BASIC: OutTpl[] = [
  {
    id: "intercambio",
    tema: 1,
    make(rng) {
      const [a, b] = [rng.int(1, 9), rng.int(1, 9)];
      return {
        code: py`
          a = ${a}
          b = ${b}
          a, b = b, a + b
          print(a, b)
          a = a * 2
          print(a, b)
        `,
        hints: ["En a, b = b, a + b se calcula todo el lado derecho antes de asignar.", "print con dos valores los separa con un espacio."],
      };
    },
  },
  {
    id: "division",
    tema: 1,
    make(rng) {
      const y = rng.pick([2, 4, 5, 8]);
      const x = rng.int(y + 1, 60);
      return {
        code: py`
          x = ${x}
          y = ${y}
          print(x // y, x % y)
          print(x / y)
          print(-x // y)
        `,
        hints: ["// es la división entera (redondea hacia abajo, también con negativos) y % el resto.", "/ siempre da un float, aunque la división sea exacta."],
      };
    },
  },
  {
    id: "rebanadas",
    tema: 2,
    make(rng) {
      const w = rng.pick(WORDS.filter((x) => x.length >= 5));
      const i = rng.int(1, 2);
      const j = rng.int(3, w.length - 1);
      return {
        code: py`
          s = "${w}"
          print(s[${i}:${j}])
          print(s[-2:])
          print(s[::-1])
          print(len(s), s[0].upper())
        `,
        hints: ["s[a:b] va de la posición a hasta la b sin incluirla; se empieza a contar en 0.", "Los índices negativos cuentan desde el final y [::-1] invierte."],
      };
    },
  },
  {
    id: "metodos-lista",
    tema: 2,
    make(rng) {
      const l = ints(rng, 4, 1, 9);
      const [x, y] = [rng.int(10, 19), rng.int(20, 29)];
      return {
        code: py`
          nums = ${lit(l)}
          nums.append(${x})
          primero = nums.pop(0)
          nums.insert(1, ${y})
          print(nums)
          print(primero, len(nums))
        `,
        hints: ["append añade al final y pop(0) quita (y devuelve) el primero.", "insert(i, x) coloca x en la posición i y desplaza el resto."],
      };
    },
  },
  {
    id: "metodos-texto",
    tema: 2,
    make(rng) {
      const [w1, w2] = distinctWords(rng, 2) as [string, string];
      const c = rng.pick([...new Set(w1 + w2)].filter((ch) => /[a-z]/.test(ch)));
      return {
        code: py`
          t = "${w1} ${w2}"
          print(t.upper())
          print(t.split())
          print(t.replace("${c}", "*"))
          print(t.count("${c}"), t.find("${w2}"))
        `,
        hints: ["Los métodos de str devuelven un texto nuevo: t no cambia.", "find devuelve la posición donde empieza el texto buscado (desde 0)."],
      };
    },
  },
];

const OUT_MEDIUM: OutTpl[] = [
  {
    id: "range-continue",
    tema: 3,
    make(rng) {
      const a = rng.int(0, 4);
      const c = rng.int(2, 3);
      const b = a + c * rng.int(4, 6);
      const k = rng.int(2, 4);
      return {
        code: py`
          for i in range(${a}, ${b}, ${c}):
              if i % ${k} == 0:
                  continue
              print(i)
        `,
        hints: ["range(a, b, c) empieza en a, avanza de c en c y no llega a b.", "continue salta el print de esa vuelta."],
      };
    },
  },
  {
    id: "while-break",
    tema: 3,
    make(rng) {
      const n = rng.int(15, 40);
      const d = rng.int(3, 7);
      return {
        code: py`
          n = ${n}
          vueltas = 0
          while n > 0:
              n -= ${d}
              vueltas += 1
              if n % 2 == 0:
                  break
          print(n, vueltas)
        `,
        hints: ["Apunta en una tabla el valor de n y de vueltas en cada vuelta.", "break sale del bucle en cuanto n es par, aunque siga siendo positivo."],
      };
    },
  },
  {
    id: "alias",
    tema: 2,
    make(rng) {
      const [x, y, z] = [rng.int(1, 9), rng.int(10, 19), rng.int(20, 29)];
      return {
        code: py`
          a = [${x}, ${x + 1}]
          b = a
          b.append(${y})
          c = a[:]
          c.append(${z})
          print(a)
          print(b is a, c is a)
        `,
        hints: ["b = a no copia la lista: los dos nombres apuntan al mismo objeto.", "a[:] crea una lista nueva con los mismos elementos."],
      };
    },
  },
  {
    id: "dict-bucle",
    tema: 3,
    make(rng) {
      const ks = distinctWords(rng, 4);
      const d = Object.fromEntries(ks.map((k) => [k, rng.int(1, 9)]));
      const t = rng.int(3, 6);
      return {
        code: py`
          d = ${lit(d)}
          total = 0
          for k, v in d.items():
              if v > ${t}:
                  total += v
          print(total, len(d))
          print(sorted(d)[0])
        `,
        hints: ["items() recorre las parejas (clave, valor) en el orden en que se insertaron.", "sorted(d) ordena las claves alfabéticamente."],
      };
    },
  },
  {
    id: "enumerate-zip",
    tema: 3,
    make(rng) {
      const xs = ints(rng, 3, 1, 9);
      const ys = ints(rng, rng.int(2, 4), 1, 9);
      return {
        code: py`
          xs = ${lit(xs)}
          ys = ${lit(ys)}
          for i, (a, b) in enumerate(zip(xs, ys)):
              print(i, a * b)
        `,
        hints: ["zip para cuando se acaba la lista más corta.", "enumerate numera desde 0."],
      };
    },
  },
];

const OUT_ADVANCED: OutTpl[] = [
  {
    id: "defecto-mutable",
    tema: 4,
    make(rng) {
      const [a, b, c] = [rng.int(1, 9), rng.int(10, 19), rng.int(20, 29)];
      return {
        code: py`
          def f(x, lista=[]):
              lista.append(x)
              return lista

          print(f(${a}))
          print(f(${b}))
          print(f(${c}, []))
        `,
        hints: ["El valor por defecto se crea una sola vez, al definir la función.", "La tercera llamada pasa su propia lista."],
      };
    },
  },
  {
    id: "recursion",
    tema: 4,
    make(rng) {
      const k = rng.int(5, 9);
      return {
        code: py`
          def g(n):
              if n <= 1:
                  return 1
              return n + g(n - 2)

          print(g(${k}))
          print(g(${k - 1}))
        `,
        hints: ["Desarrolla la llamada a mano: g(n) = n + g(n − 2) hasta llegar al caso base.", "El caso base devuelve 1 para n ≤ 1 (también si n es 0)."],
      };
    },
  },
  {
    id: "comprension",
    tema: 3,
    make(rng) {
      const a = rng.int(5, 9);
      const m = rng.int(2, 5);
      const r = rng.int(0, 1);
      return {
        code: py`
          print([x * ${m} for x in range(${a}) if x % 2 == ${r}])
          print({x: x ** 2 for x in range(3)})
          print(sum(x for x in range(${a})))
        `,
        hints: ["El if de una comprensión filtra antes de calcular la expresión.", "range(a) va de 0 a a − 1."],
      };
    },
  },
  {
    id: "ambito",
    tema: 4,
    make(rng) {
      const [a, b] = [rng.int(1, 9), rng.int(10, 19)];
      return {
        code: py`
          x = ${a}

          def h():
              x = ${b}
              return x * 2

          def k():
              return x + 1

          print(h(), x)
          print(k())
        `,
        hints: ["Asignar a x dentro de una función crea una variable local que no toca la global.", "Si una función solo lee x, usa la global."],
      };
    },
  },
  {
    id: "sorted-key",
    tema: 4,
    make(rng) {
      const ps = distinctWords(rng, 4);
      return {
        code: py`
          ps = ${lit(ps)}
          print(sorted(ps, key=len))
          print(sorted(ps, key=lambda p: p[-1]))
          print(max(ps, key=len))
        `,
        hints: ["sorted es estable: con la misma clave, se respeta el orden original.", "max con key devuelve el primero de los que tienen la clave máxima."],
      };
    },
  },
  {
    id: "args-kwargs",
    tema: 4,
    make(rng) {
      const n = rng.int(1, 3);
      const args = ints(rng, n, 1, 9).join(", ");
      const [k1, k2] = distinctWords(rng, 2) as [string, string];
      return {
        code: py`
          def f(primero, *resto, **opciones):
              return primero, len(resto), sorted(opciones)

          print(f(0, ${args}, ${k1}=1, ${k2}=2))
          print(f(5))
        `,
        hints: ["*resto recoge los argumentos posicionales que sobran en una tupla.", "**opciones recoge los argumentos con nombre en un diccionario."],
      };
    },
  },
];

const OUTPUT_BY_LEVEL: Record<ExerciseLevel, OutTpl[]> = { básico: OUT_BASIC, medio: OUT_MEDIUM, avanzado: OUT_ADVANCED };

// ---------------------------------------------------------------- Tipos

type PyTypeDef = { id: string; title: string; description: string; templates: Tpl[] };

const CODE_TYPES: PyTypeDef[] = [
  { id: "py-tipos", title: "Variables, operadores y tipos", description: "Temas 1 y 2: operadores aritméticos y lógicos, int, float, str y bool.", templates: [TIEMPO, TEMPERATURA, PRECIO, TEXTO_NUMERO, BOOLEANOS] },
  { id: "py-cadenas", title: "Cadenas: rebanadas y métodos", description: "Tema 2: slicing, recorridos y métodos de str.", templates: [CAPICUA, VOCALES, INICIALES, REBANADAS, FRASES] },
  { id: "py-colecciones", title: "Listas, tuplas, diccionarios y conjuntos", description: "Tema 2: colecciones, mutabilidad y copias.", templates: [FRECUENCIAS, CONJUNTOS, TUPLAS, MUTABILIDAD] },
  { id: "py-control", title: "if, for y while", description: "Tema 3: condiciones, bucles, range, break y continue.", templates: [NOTAS, SUMAS, DIGITOS, SALTOS, DIBUJOS] },
  { id: "py-comprensiones", title: "enumerate, zip y comprensiones", description: "Tema 3: recorrer con posición o por parejas y construir listas y diccionarios.", templates: [ENUMERAR, CREMALLERA, COMP_LISTAS, COMP_DICT] },
  { id: "py-funciones", title: "Parámetros y valores devueltos", description: "Tema 4: valores por defecto, *args, **kwargs y return múltiple.", templates: [POR_DEFECTO, ARGS_KWARGS, VARIOS_VALORES] },
  { id: "py-recursion", title: "Recursión, lambdas y sorted", description: "Tema 4: funciones recursivas, funciones como valores y ordenar con key.", templates: [RECURSION, ORDENAR, LAMBDAS] },
  { id: "py-ficheros", title: "Ficheros de texto y CSV", description: "Tema 5: with open, leer líneas, contar palabras, escribir archivos y el módulo csv.", templates: [LINEAS, PALABRAS_FICHERO, CSV, ESCRIBIR] },
];

/** Todas las plantillas de código, por id (para las pruebas). */
export const PY_CODE_TEMPLATES: ReadonlyMap<string, Tpl> = new Map(CODE_TYPES.flatMap((t) => t.templates).map((t) => [t.id, t]));
/** Todas las plantillas de «¿Qué imprime?», por nivel (para las pruebas). */
export const PY_OUTPUT_TEMPLATES: Readonly<Record<ExerciseLevel, readonly OutTpl[]>> = OUTPUT_BY_LEVEL;

/** Quita los casos repetidos (los datos al azar pueden coincidir): un caso igual no aporta nada. */
function uniqueCases(inst: PyCodeInstance): PyCodeInstance {
  const seen = new Set<string>();
  const cases = inst.cases.filter((c) => {
    const key = `${c.code}|${JSON.stringify(c.files ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return cases.length === inst.cases.length ? inst : { ...inst, cases };
}

/** Instancia de una plantilla concreta (para las pruebas). */
export function makeCodeTemplate(id: string, seed: number, level: ExerciseLevel): PyCodeInstance {
  const t = PY_CODE_TEMPLATES.get(id);
  if (!t) throw new Error(`plantilla desconocida: ${id}`);
  return uniqueCases(t.make(rngFor(`py:${id}`, seed), level));
}

const LEVELS = ["básico", "medio", "avanzado"] as const;

function codeType(def: PyTypeDef): ExerciseType<PyCodeInstance> {
  return {
    id: def.id,
    topic: "python",
    module: "python",
    title: def.title,
    description: def.description,
    levels: LEVELS,
    generate(seed, level) {
      const rng = rngFor(def.id, seed);
      return uniqueCases(rng.pick(def.templates).make(rng, level));
    },
  };
}

export const PY_OUTPUT: ExerciseType<PyOutputInstance> = {
  id: "py-que-imprime",
  topic: "python",
  module: "python",
  title: "¿Qué imprime?",
  description: "Lee un fragmento corto y escribe exactamente lo que imprime; si fallas, síguelo paso a paso.",
  levels: LEVELS,
  generate(seed, level) {
    const rng = rngFor("py-que-imprime", seed);
    const t = rng.pick(OUTPUT_BY_LEVEL[level]);
    const { code, hints } = t.make(rng);
    return { kind: "output", tema: t.tema, template: t.id, title: "¿Qué imprime?", code, hints };
  },
};

export const PY_CODE_TYPES: readonly ExerciseType<PyCodeInstance>[] = CODE_TYPES.map(codeType);

export const PYTHON_EXERCISES: readonly ExerciseType<PyInstance>[] = [...PY_CODE_TYPES, PY_OUTPUT];
