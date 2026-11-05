// Kernel del cuaderno del simulacro, como el de Jupyter: las celdas se ejecutan una a una en el mismo
// espacio de nombres, así que lo que define una celda lo ve la siguiente. El worker de Pyodide crea un
// espacio de nombres nuevo en cada ejecución; el del cuaderno vive en un módulo (_labs_cuaderno) que
// sobrevive entre ejecuciones hasta que se reinicia el kernel o el propio Python (por un límite de
// tiempo o «Detener»): entonces la celda siguiente lo dice («el kernel se había reiniciado»).
//
// La última expresión de la celda se muestra como en Jupyter: una tabla de pandas vuelve como datos
// (columnas, índice y celdas en texto, recortada) que la página pinta como tabla, sin HTML; cualquier
// otro valor, con su repr. Los errores vuelven con la traza desde la celda.
import { transformMagics } from "../python/magics.ts";

/** Filas y columnas de una tabla que se enseñan (como Jupyter: las primeras y las últimas). */
export const KERNEL_MAX_ROWS = 20;
export const KERNEL_MAX_COLS = 20;
/** Límite de una celda (la primera vez que se importa pandas o seaborn se descargan). */
export const CELL_TIMEOUT_MS = 120_000;

export const KERNEL_PY = String.raw`
import ast as _ast, json as _json, linecache as _linecache, sys as _sys, traceback as _tb, types as _types

def _celda_txt(x):
    if x is None:
        return "None"
    if isinstance(x, float):
        if x != x:
            return "NaN"
        return repr(x)
    try:
        pd = _sys.modules.get("pandas")
        if pd is not None and x is pd.NaT:
            return "NaT"
    except BaseException:
        pass
    t = str(x)
    return t if len(t) <= 200 else t[:199] + "…"

def _cortes(n, maximo):
    if n <= maximo:
        return list(range(n)), None
    mitad = maximo // 2
    return list(range(mitad)) + list(range(n - mitad // 2, n)), mitad

def _mostrar(v):
    pd = _sys.modules.get("pandas")
    if pd is not None and isinstance(v, (pd.DataFrame, pd.Series)):
        serie = isinstance(v, pd.Series)
        df = v.to_frame("" if v.name is None else v.name) if serie else v
        n, m = df.shape
        filas, cf = _cortes(n, ${KERNEL_MAX_ROWS})
        cols, cc = _cortes(m, ${KERNEL_MAX_COLS})
        sub = df.iloc[filas, cols]
        return {
            "tipo": "tabla",
            "serie": serie,
            "forma": [int(n), int(m)],
            "columnas": [_celda_txt(c) for c in sub.columns],
            "indice": [_celda_txt(i) for i in sub.index],
            "filas": [[_celda_txt(x) for x in fila] for fila in sub.itertuples(index=False, name=None)],
            "corteFilas": cf,
            "corteCols": cc,
        }
    try:
        t = repr(v)
    except BaseException as e:
        t = "<no se puede mostrar: " + type(e).__name__ + ">"
    return {"tipo": "texto", "texto": t if len(t) <= 20000 else t[:19999] + "…"}

def _traza(e):
    tb = e.__traceback__
    while tb is not None and not tb.tb_frame.f_code.co_filename.startswith("<celda"):
        tb = tb.tb_next
    return "".join(_tb.format_exception(type(e), e, tb)).rstrip()

def _linea(e, nombre):
    linea = None
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == nombre:
            linea = tb.tb_lineno
        tb = tb.tb_next
    if linea is None and isinstance(e, SyntaxError) and e.filename == nombre:
        linea = e.lineno
    return linea

def _kernel(p):
    k = _sys.modules.get("_labs_cuaderno")
    perdido = k is None and not p["nuevo"]
    if k is None or p["nuevo"] or getattr(k, "id", None) != p["kernel"]:
        if k is not None and not p["nuevo"]:
            perdido = True
        k = _types.ModuleType("_labs_cuaderno")
        k.ns = {"__name__": "__main__"}
        magias = _sys.modules.get("_labs_magics")
        if magias is not None:
            k.ns.update(magias.EXPORTS)
        k.id = p["kernel"]
        _sys.modules["_labs_cuaderno"] = k
        plt = _sys.modules.get("matplotlib.pyplot")
        if plt is not None:
            plt.close("all")
    return k, perdido

def __labs_celda(p):
    k, perdido = _kernel(p)
    nombre = p["nombre"]
    codigo = p["codigo"]
    res = {"kernel": k.id, "perdido": perdido, "valor": None, "error": None}
    _linecache.cache[nombre] = (len(codigo), None, codigo.splitlines(True), nombre)
    try:
        arbol = _ast.parse(codigo, nombre)
    except SyntaxError as e:
        res["error"] = {"tipo": type(e).__name__, "traza": "".join(_tb.format_exception_only(type(e), e)).rstrip(), "linea": e.lineno}
        return _json.dumps(res)
    ultima = None
    if arbol.body and isinstance(arbol.body[-1], _ast.Expr) and not codigo.rstrip().endswith(";"):
        ultima = _ast.Expression(arbol.body.pop().value)
    try:
        exec(compile(arbol, nombre, "exec"), k.ns)
        if ultima is not None:
            v = eval(compile(ultima, nombre, "eval"), k.ns)
            if v is not None:
                k.ns["_"] = v
                res["valor"] = _mostrar(v)
    except BaseException as e:
        res["error"] = {"tipo": type(e).__name__, "traza": _traza(e), "linea": _linea(e, nombre)}
    return _json.dumps(res)
`;

/** Lo que muestra una celda como valor: una tabla (en texto) o un repr. */
export type KernelValue =
  | { tipo: "tabla"; serie: boolean; forma: [number, number]; columnas: string[]; indice: string[]; filas: string[][]; corteFilas: number | null; corteCols: number | null }
  | { tipo: "texto"; texto: string };

export type KernelError = { tipo: string; traza: string; linea: number | null };

export type KernelReply = { kernel: string; perdido: boolean; valor: KernelValue | null; error: KernelError | null };

const pyJson = (data: unknown) => `__import__("json").loads(${JSON.stringify(JSON.stringify(data))})`;

/**
 * El programa de una celda: el kernel y la llamada, cuyo valor (un str con JSON) es la respuesta.
 * `kernel` identifica el kernel en uso; `fresh` lo crea de nuevo (al empezar o al reiniciarlo).
 * Devuelve también el código del que el worker saca los paquetes que tiene que cargar.
 */
export function cellProgram(code: string, n: number, kernel: string, fresh: boolean): { program: string; imports: string; error: string | null } {
  const t = transformMagics(code);
  const body = t.ok ? t.code : code;
  const call = { codigo: body, nombre: `<celda ${n}>`, kernel, nuevo: fresh };
  return { program: `${KERNEL_PY}\n__labs_celda(${pyJson(call)})\n`, imports: body, error: t.ok ? null : `Línea ${t.line}: ${t.message}` };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const strs = (x: unknown, max: number): string[] | null => (Array.isArray(x) && x.length <= max && x.every((s) => typeof s === "string") ? (x as string[]) : null);

function parseValue(x: unknown): KernelValue | null {
  if (!isObj(x)) return null;
  if (x.tipo === "texto" && typeof x.texto === "string") return { tipo: "texto", texto: x.texto };
  if (x.tipo !== "tabla") return null;
  const columnas = strs(x.columnas, KERNEL_MAX_COLS + 1);
  const indice = strs(x.indice, KERNEL_MAX_ROWS + 1);
  if (!columnas || !indice || !Array.isArray(x.filas) || x.filas.length !== indice.length) return null;
  const filas: string[][] = [];
  for (const f of x.filas) {
    const r = strs(f, columnas.length);
    if (!r || r.length !== columnas.length) return null;
    filas.push(r);
  }
  const forma = Array.isArray(x.forma) && x.forma.length === 2 && x.forma.every((v) => Number.isInteger(v) && v >= 0) ? (x.forma as [number, number]) : null;
  if (!forma) return null;
  const cut = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
  return { tipo: "tabla", serie: x.serie === true, forma, columnas, indice, filas, corteFilas: cut(x.corteFilas), corteCols: cut(x.corteCols) };
}

/** Lee la respuesta del kernel; null si no tiene la forma esperada. */
export function parseKernelReply(raw: string | undefined): KernelReply | null {
  if (typeof raw !== "string") return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || typeof d.kernel !== "string") return null;
  const error = isObj(d.error) && typeof d.error.traza === "string" ? { tipo: typeof d.error.tipo === "string" ? d.error.tipo : "Error", traza: d.error.traza, linea: Number.isInteger(d.error.linea) ? (d.error.linea as number) : null } : null;
  return { kernel: d.kernel, perdido: d.perdido === true, valor: d.valor === null ? null : parseValue(d.valor), error };
}

/** Un identificador nuevo para un kernel. */
export const newKernelId = (): string => `k${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
