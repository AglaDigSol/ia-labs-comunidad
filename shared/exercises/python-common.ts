// Piezas comunes de los ejercicios de Python (01MIAR): los tipos de las instancias (enunciado, casos,
// requisitos y comprobaciones), los temas y las utilidades para escribir datos y código Python desde
// TypeScript. Las usan los ejercicios de los temas 1 a 5 (python.ts) y los de los temas 6 a 13
// (python-datos.ts); python.ts reexporta la parte pública.
import type { Rng } from "./random.ts";
import type { ExerciseLevel } from "./types.ts";

export type PyTema = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** Qué se compara con la referencia en un caso: lo que devuelve, lo que imprime o un archivo. */
export type PyCompare = "valor" | "salida" | `archivo:${string}`;

/**
 * Cómo se compara el valor devuelto cuando es una tabla de pandas, una serie o un array de NumPy (con
 * los demás valores no cambia nada). Por defecto: el orden de las filas importa, el índice solo en
 * las series, el orden de las columnas no, los tipos (dtype) no y la tolerancia es 1e-6.
 */
export interface PyCompareOptions {
  /** ¿Importa el orden de las filas? (por defecto, sí). */
  rowOrder?: boolean;
  /** ¿Se compara el índice? (por defecto, solo en las series: el de un groupby son las claves). */
  index?: boolean;
  /** ¿Importa el orden de las columnas? (por defecto, no). */
  columnOrder?: boolean;
  /** ¿Se comparan los tipos de cada columna (entero, real, texto, fecha…)? (por defecto, no). */
  dtypes?: boolean;
  /** Tolerancia relativa y absoluta de los números (por defecto, 1e-6). */
  tolerance?: number;
}

/**
 * Comprobación con nombre sobre lo que hace el código en un caso, además de (o en vez de) comparar el
 * valor. Las de valor miran lo que devuelve la función; las «fig-» miran la figura de matplotlib que
 * deja abierta (la que crea el caso). Cada una se informa por separado («cumplida» o «no cumplida» y
 * lo que hizo tu código), nunca con el valor esperado.
 *
 * - generador: devuelve un objeto generador. perezoso: y aún no ha empezado a ejecutarse.
 * - tipo: del mismo tipo que la referencia (DataFrame, Series, ndarray, list…).
 * - forma: misma forma (shape). columnas: las mismas columnas. tipos: mismos tipos por columna.
 * - sin-nulos: ningún NaN. nulos: los NaN en las mismas posiciones. orden: las filas en el mismo
 *   orden. indice: el mismo índice.
 * - fig-una: una sola figura. fig-tamano: el mismo figsize. fig-ejes: el mismo número de gráficos.
 * - fig-tipo: el mismo tipo de gráfico (dispersión, barras o líneas) en cada uno.
 * - fig-barras: el mismo número de barras. fig-alturas: las mismas alturas (así se comprueba un
 *   estimator=sum: las alturas son las sumas de los datos). fig-puntos: los mismos puntos.
 * - fig-lineas: las mismas líneas (sus valores y). fig-leyenda: la misma leyenda (los niveles del hue).
 * - fig-titulo: cada gráfico tiene título. fig-etiquetas: cada gráfico tiene nombre en los dos ejes.
 */
export type PyCheckKind =
  | "generador"
  | "perezoso"
  | "tipo"
  | "forma"
  | "columnas"
  | "tipos"
  | "sin-nulos"
  | "nulos"
  | "orden"
  | "indice"
  | "fig-una"
  | "fig-tamano"
  | "fig-ejes"
  | "fig-tipo"
  | "fig-barras"
  | "fig-alturas"
  | "fig-puntos"
  | "fig-lineas"
  | "fig-leyenda"
  | "fig-titulo"
  | "fig-etiquetas";

export interface PyCheck {
  kind: PyCheckKind;
  /** Lo que se enseña: «La figura mide 8 × 4 pulgadas». Es un requisito del enunciado, no un resultado. */
  label: string;
  /** Solo para las «fig-»: el gráfico (eje) al que se refiere, desde 0; sin él, todos. */
  axes?: number;
}

export interface PyCase {
  /**
   * Código del caso, tal como se muestra: la última línea es la expresión que se evalúa (si no es una
   * expresión, el valor es None: sirve para un caso que solo tiene assert).
   */
  code: string;
  /** Por defecto, ["valor"]. Un caso de gráfico puede no comparar nada y llevar solo checks. */
  compare?: PyCompare[];
  /** Archivos de entrada (texto UTF-8) en la carpeta de trabajo del caso. */
  files?: Record<string, string>;
  /** Comparación de tablas, series y arrays. */
  options?: PyCompareOptions;
  /** Comprobaciones con nombre (se informan una a una). */
  checks?: PyCheck[];
  /** Si el valor es un generador o un iterador, cuántos elementos se toman como mucho para comparar (por defecto, 1000). */
  take?: number;
}

/** Requisito sobre el código (se comprueba con ast): «usa una comprensión», «sin if»… */
export interface PyRule {
  kind: "usa" | "evita";
  /**
   * comprension | nodo:<clase de ast> | llamada:<nombre> | recursion:<función> | modulo:<módulo> |
   * una-linea:<función> (su cuerpo es un solo return, en una línea, con una comprensión) |
   * firma:<función>:<p1,p2…> (la función tiene exactamente esos parámetros) | clase:<Clase> |
   * hereda:<Clase>:<Base> | metodo:<Clase>:<método> | propiedad:<Clase>:<nombre> (con @property) |
   * generador:<función> (tiene yield) | decorador:<función> (se aplica con @ a alguna función)
   */
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
  /** Función (o clase) que hay que definir. */
  fn: string;
  starter: string;
  cases: PyCase[];
  /** Pistas graduadas, de la más general a la más concreta. Nunca código de la solución. */
  hints: string[];
  /** Solo para el banco de pruebas y para «Ver la solución completa». */
  solution: string;
  rules?: PyRule[];
  /**
   * Módulos que se importan antes de los casos, fuera del límite de tiempo («pandas»,
   * «matplotlib.pyplot», «seaborn»…). En el navegador, además, se descargan antes de comprobar.
   */
  packages?: string[];
  /** Límite de cada caso en segundos (por defecto, CASE_SECONDS del banco de pruebas). */
  seconds?: number;
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

/** Tema de 01MIAR de cada número (como en la guía docente y el calendario). */
export const PY_TEMAS: Record<PyTema, string> = {
  1: "Tema 1 · Introducción a Python",
  2: "Tema 2 · Tipos de datos",
  3: "Tema 3 · Estructuras de control",
  4: "Tema 4 · Funciones",
  5: "Tema 5 · Ficheros",
  6: "Tema 6 · Programación orientada a objetos",
  7: "Tema 7 · Python avanzado",
  8: "Tema 8 · NumPy",
  9: "Tema 9 · Pandas",
  10: "Tema 10 · Más Pandas",
  11: "Tema 11 · Visualización de datos",
  12: "Tema 12 · Procesamiento de datos",
  13: "Tema 13 · Generadores",
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
export const py = (s: TemplateStringsArray, ...v: unknown[]) => dedent(String.raw(s, ...v));

/** Tupla de Python (en JS, un array se escribe como lista). */
export class Tup {
  readonly items: readonly PyVal[];
  constructor(items: readonly PyVal[]) {
    this.items = items;
  }
}
export type PyVal = string | number | boolean | null | Tup | readonly PyVal[] | { readonly [k: string]: PyVal };

export const tup = (...items: PyVal[]) => new Tup(items);

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
export const call = (fn: string, ...args: PyVal[]) => `${fn}(${args.map(lit).join(", ")})`;

/** Casos de una función: una llamada por cada lista de argumentos. */
export const calls = (fn: string, argLists: PyVal[][]): PyCase[] => argLists.map((a) => ({ code: call(fn, ...a) }));

/** Código inicial: la cabecera de la función y un pass. */
export const starterOf = (fn: string, params: string, note = "Escribe aquí tu código") => `def ${fn}(${params}):\n    # ${note}\n    pass\n`;

export const WORDS = [
  "sol", "luna", "rio", "mar", "casa", "arbol", "nube", "piedra", "camino", "libro", "mesa", "flor", "puerta", "monte",
  "viento", "fuego", "tierra", "agua", "verde", "azul", "gato", "perro", "lago", "isla", "valle", "torre", "puente",
  "reloj", "papel", "barco", "hoja", "raiz", "cielo", "playa", "nieve", "campo",
] as const;
export const SYLLABLES = ["ka", "lo", "mi", "ra", "te", "su", "no", "vi", "da", "ze", "pa", "ri", "bo", "le", "xa", "tu", "me", "ni"] as const;

/** Palabra inventada de 2 o 3 sílabas (para nombres: así no hay nombres reales). */
export const invented = (rng: Rng) => Array.from({ length: rng.int(2, 3) }, () => rng.pick(SYLLABLES)).join("");
export const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);
/** Varios nombres inventados distintos, con mayúscula. */
export function names(rng: Rng, n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(cap(invented(rng)));
  return [...out];
}
export const words = (rng: Rng, n: number): string[] => Array.from({ length: n }, () => rng.pick(WORDS));
export const distinctWords = (rng: Rng, n: number): string[] => rng.shuffle(WORDS).slice(0, n);
export const ints = (rng: Rng, n: number, min: number, max: number) => Array.from({ length: n }, () => rng.int(min, max));
/** Un número con como mucho dos decimales (múltiplo de 0,25 para no arrastrar errores de redondeo). */
export const quarter = (rng: Rng, min: number, max: number) => rng.int(min * 4, max * 4) / 4;

export type Make = (rng: Rng, level: ExerciseLevel) => PyCodeInstance;
export type Tpl = { id: string; tema: PyTema; make: Make };

export const USA_FOR: PyRule = { kind: "usa", what: "nodo:For", label: "Usa un bucle for" };
export const USA_WHILE: PyRule = { kind: "usa", what: "nodo:While", label: "Usa un bucle while" };
export const USA_COMP: PyRule = { kind: "usa", what: "comprension", label: "Usa una comprensión" };
export const USA_DICTCOMP: PyRule = { kind: "usa", what: "nodo:DictComp", label: "Usa una comprensión de diccionario" };
export const USA_WITH: PyRule = { kind: "usa", what: "nodo:With", label: "Abre el archivo con with" };
export const USA_CSV: PyRule = { kind: "usa", what: "modulo:csv", label: "Usa el módulo csv" };
export const USA_ZIP: PyRule = { kind: "usa", what: "llamada:zip", label: "Usa zip()" };
export const USA_LAMBDA: PyRule = { kind: "usa", what: "nodo:Lambda", label: "Usa una lambda" };
export const recursive = (fn: string): PyRule => ({ kind: "usa", what: `recursion:${fn}`, label: `${fn} se llama a sí misma (recursión)` });
