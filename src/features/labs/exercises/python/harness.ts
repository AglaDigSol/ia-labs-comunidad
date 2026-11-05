// Banco de pruebas de los ejercicios de Python. Arma el programa que corre en el worker de Pyodide
// (o, en las pruebas, en el python3 del sistema): ejecuta la solución de referencia y el código de la
// persona, cada uno en un espacio de nombres nuevo por caso y en una carpeta temporal con los archivos
// del caso, y compara. El resultado (JSON) solo lleva si cada caso es correcto y, si no, lo que hizo
// el código de la persona: nunca el valor esperado. La solución de referencia viaja al worker dentro
// del programa, pero no vuelve a la página.
//
// Para los temas 6 a 13 (harness-data.ts): tablas de pandas, series y arrays de NumPy se comparan con
// tolerancia (PyCompareOptions); los generadores se consumen hasta `take` elementos; cada caso puede
// llevar comprobaciones con nombre (PyCheck: generador, forma, sin NaN… y las de figura, que miran la
// figura de matplotlib que deja abierta el caso); y los requisitos de ast incluyen «en una línea», la
// firma de una función, clases, herencia, propiedades, generadores y decoradores. La figura del primer
// caso con gráfico se queda abierta para que el worker la dibuje y la persona la vea.
import type { PyCase, PyCheckKind, PyCodeInstance, PyCompareOptions, PyRule } from "../../../../../shared/exercises/python.ts";
import { HARNESS_DATA_PY } from "./harness-data.ts";

/** Nombre de archivo con el que se compila el código de la persona (para las líneas de los errores). */
export const STUDENT_FILE = "<tu código>";
/** Carpeta (relativa a la de trabajo) donde se escriben los archivos de entrada: ejercicio/caso1/… */
export const CASE_DIR = "ejercicio";
/** Límite de cada caso, en segundos (lo vigila la propia traza de Python). */
export const CASE_SECONDS = 2;
/** Límite de toda la comprobación en el worker (si se pasa, se reinicia Python). */
export const CHECK_TIMEOUT_MS = 20_000;
/** Como mucho tantos caracteres de salida por caso (lo demás se corta). */
export const MAX_CASE_OUTPUT = 10_000;

export const casePath = (k: number, name: string) => `${CASE_DIR}/caso${k}/${name}`;

// El código Python del banco. Va en una cadena: se antepone al programa de cada comprobación.
// _Tiempo hereda de BaseException para que un «except Exception» del código no lo trague.
export const HARNESS_PY = String.raw`
import ast as _ast, contextlib as _ctx, importlib as _importlib, io as _io, json as _json, math as _math, os as _os
import reprlib as _reprlib, shutil as _shutil, sys as _sys, tempfile as _tempfile, time as _time

_TU = "<tu código>"

class _Tiempo(BaseException):
    pass

class _Salida(_io.StringIO):
    def __init__(self, limite):
        super().__init__()
        self._limite = limite
        self.cortada = False
    def write(self, s):
        resto = self._limite - self.tell()
        if resto <= 0:
            self.cortada = True
            return len(s)
        if len(s) > resto:
            self.cortada = True
            super().write(s[:resto])
            return len(s)
        return super().write(s)

_rep = _reprlib.Repr()
_rep.maxlevel = 4
_rep.maxlist = _rep.maxtuple = _rep.maxset = _rep.maxfrozenset = _rep.maxdict = 20
_rep.maxstring = _rep.maxother = 200
_rep.maxlong = 60

def _repr(x):
    try:
        if _es_tabla(x) or _es_array(x):
            return _repr_datos(x)
        texto = _rep.repr(x)
    except BaseException:
        texto = "<no se puede mostrar>"
    return texto if len(texto) <= 300 else texto[:299] + "…"

def _igual(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if isinstance(a, float) or isinstance(b, float):
            return _math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
        return a == b
    if type(a) is not type(b):
        return False
    if isinstance(a, (list, tuple)):
        return len(a) == len(b) and all(_igual(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_igual(a[k], b[k]) for k in a)
    try:
        return bool(a == b)
    except BaseException:
        return False

def _linea(e):
    linea = None
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _TU:
            linea = tb.tb_lineno
        tb = tb.tb_next
    if linea is None and isinstance(e, SyntaxError) and e.filename == _TU:
        linea = e.lineno
    return linea

def _error(e):
    texto = str(e)
    return {"tipo": type(e).__name__, "mensaje": (type(e).__name__ + ": " + texto) if texto else type(e).__name__, "linea": _linea(e)}

_PROPIOS = (_TU, "<caso>", "<referencia>")

def _vigilar(segundos):
    fin = _time.perf_counter() + segundos
    cuenta = [0]
    def traza(frame, evento, arg):
        cuenta[0] += 1
        if (cuenta[0] & 255) == 0 and _time.perf_counter() > fin:
            raise _Tiempo()
        # Las funciones de las bibliotecas (pandas, NumPy…) se cuentan al entrar, pero no línea a línea:
        # así no se hacen mucho más lentas. El código de la persona y el del caso sí se siguen.
        if evento == "call" and frame.f_code.co_filename not in _PROPIOS:
            return None
        return traza
    return traza

def _partes(codigo):
    arbol = _ast.parse(codigo, "<caso>")
    ultima = arbol.body[-1] if arbol.body else None
    if isinstance(ultima, _ast.Expr):
        arbol.body.pop()
        expr = compile(_ast.Expression(ultima.value), "<caso>", "eval")
    else:
        # Un caso que acaba en una sentencia (por ejemplo, un assert) vale None.
        expr = compile("None", "<caso>", "eval")
    previo = compile(arbol, "<caso>", "exec")
    return previo, expr

def _correr(obj, caso, origen, segundos, fn, guardar=False):
    tmp = _tempfile.mkdtemp(prefix="labs-caso-")
    if _os.path.isdir(origen):
        _shutil.copytree(origen, tmp, dirs_exist_ok=True)
    previa = _os.getcwd()
    salida = _Salida(${MAX_CASE_OUTPUT})
    r = {"valor": None, "inicio": 0, "error": None, "tiempo": False, "falta": False, "archivos": {}}
    r.update({"clase": "NoneType", "generador": False, "creado": False, "iter": False, "figuras": []})
    con_figura = any(ch["tipo"].startswith("fig-") for ch in caso.get("checks", []))
    antes = _figs() if con_figura else set()
    entrada = _io.StringIO("")
    ns = {"__name__": "__main__"}
    try:
        _os.chdir(tmp)
        previo, expr = _partes(caso["codigo"])
        with _ctx.redirect_stdout(salida):
            viejo_in = _sys.stdin
            _sys.stdin = entrada
            _sys.settrace(_vigilar(segundos))
            try:
                exec(obj, ns)
                r["inicio"] = salida.tell()
                if fn and fn not in ns:
                    r["falta"] = True
                else:
                    exec(previo, ns)
                    v = eval(expr, ns)
                    r["clase"] = type(v).__name__
                    r["generador"] = _inspect.isgenerator(v)
                    r["creado"] = r["generador"] and _inspect.getgeneratorstate(v) == "GEN_CREATED"
                    if _iterador(v):
                        # Un generador (o iterador) se compara por lo que produce, como mucho «toma» elementos.
                        r["iter"] = True
                        v = list(_itertools.islice(v, caso.get("toma") or 1000))
                    r["valor"] = v
            finally:
                _sys.settrace(None)
                _sys.stdin = viejo_in
    except _Tiempo:
        r["tiempo"] = True
    except BaseException as e:
        r["error"] = _error(e)
    finally:
        _os.chdir(previa)
        if con_figura:
            try:
                r["figuras"] = _figuras_nuevas(antes, guardar and r["error"] is None and not r["tiempo"])
            except BaseException:
                r["figuras"] = []
        for que in caso["compara"]:
            if que.startswith("archivo:"):
                nombre = que[8:]
                try:
                    with open(_os.path.join(tmp, nombre), encoding="utf-8") as f:
                        r["archivos"][nombre] = f.read()
                except (OSError, UnicodeDecodeError):
                    r["archivos"][nombre] = None
        _shutil.rmtree(tmp, ignore_errors=True)
    texto = salida.getvalue()
    r["superior"] = texto[: r["inicio"]]
    r["salida"] = texto[r["inicio"] :]
    return r

def _usa(arbol, que):
    nodos = list(_ast.walk(arbol))
    if que == "comprension":
        return any(isinstance(n, (_ast.ListComp, _ast.SetComp, _ast.DictComp, _ast.GeneratorExp)) for n in nodos)
    if que.startswith("nodo:"):
        clase = getattr(_ast, que[5:])
        return any(isinstance(n, clase) for n in nodos)
    if que.startswith("llamada:"):
        nombre = que[8:]
        return any(
            isinstance(n, _ast.Call)
            and ((isinstance(n.func, _ast.Name) and n.func.id == nombre) or (isinstance(n.func, _ast.Attribute) and n.func.attr == nombre))
            for n in nodos
        )
    if que.startswith("recursion:"):
        fn = que[10:]
        return any(
            isinstance(d, (_ast.FunctionDef, _ast.AsyncFunctionDef))
            and d.name == fn
            and any(isinstance(c, _ast.Call) and isinstance(c.func, _ast.Name) and c.func.id == fn for c in _ast.walk(d))
            for d in nodos
        )
    if que.startswith("modulo:"):
        mod = que[7:]
        return any(
            (isinstance(n, _ast.Import) and any(a.name.split(".")[0] == mod for a in n.names))
            or (isinstance(n, _ast.ImportFrom) and (n.module or "").split(".")[0] == mod)
            for n in nodos
        )
    if que.startswith(("una-linea:", "generador:", "clase:", "decorador:", "firma:", "hereda:", "metodo:", "propiedad:")):
        tipo, _, resto = que.partition(":")
        nombre, _, arg = resto.partition(":")
        defs = [n for n in nodos if isinstance(n, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and n.name == nombre]
        clases = [n for n in nodos if isinstance(n, _ast.ClassDef) and n.name == nombre]
        if tipo == "una-linea":
            return any(_una_linea(d) for d in defs)
        if tipo == "generador":
            return any(isinstance(x, (_ast.Yield, _ast.YieldFrom)) for d in defs for x in _ast.walk(d))
        if tipo == "firma":
            return any(_parametros(d) == [x for x in arg.split(",") if x] for d in defs)
        if tipo == "clase":
            return bool(clases)
        if tipo == "hereda":
            return any(_nombre(b) == arg for c in clases for b in c.bases)
        if tipo == "metodo":
            return any(isinstance(m, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and m.name == arg for c in clases for m in c.body)
        if tipo == "propiedad":
            return any(
                isinstance(m, _ast.FunctionDef) and m.name == arg and any(_nombre(d) == "property" for d in m.decorator_list)
                for c in clases
                for m in c.body
            )
        return any(
            _nombre(d.func if isinstance(d, _ast.Call) else d) == nombre
            for n in nodos
            if isinstance(n, (_ast.FunctionDef, _ast.AsyncFunctionDef, _ast.ClassDef))
            for d in n.decorator_list
        )
    raise ValueError(que)

def _nombre(n):
    if isinstance(n, _ast.Name):
        return n.id
    if isinstance(n, _ast.Attribute):
        return n.attr
    return None

def _parametros(d):
    a = d.args
    nombres = [x.arg for x in a.posonlyargs + a.args]
    if a.vararg:
        nombres.append("*" + a.vararg.arg)
    nombres += [x.arg for x in a.kwonlyargs]
    if a.kwarg:
        nombres.append("**" + a.kwarg.arg)
    return nombres

def _una_linea(d):
    cuerpo = d.body
    if cuerpo and isinstance(cuerpo[0], _ast.Expr) and isinstance(cuerpo[0].value, _ast.Constant) and isinstance(cuerpo[0].value.value, str):
        cuerpo = cuerpo[1:]  # la docstring no cuenta
    if len(cuerpo) != 1 or not isinstance(cuerpo[0], _ast.Return) or cuerpo[0].value is None:
        return False
    ret = cuerpo[0]
    comp = any(isinstance(n, (_ast.ListComp, _ast.SetComp, _ast.DictComp, _ast.GeneratorExp)) for n in _ast.walk(ret.value))
    return comp and ret.lineno == ret.end_lineno

def _preparar(paquetes):
    """Importa los paquetes del ejercicio antes de los casos, fuera del límite de tiempo, y cierra las figuras que hubiera."""
    for m in paquetes:
        if m == "matplotlib.pyplot" and "matplotlib.pyplot" not in _sys.modules:
            try:
                import matplotlib
                matplotlib.use("Agg")
            except BaseException:
                pass
        try:
            _importlib.import_module(m)
        except BaseException:
            pass
    plt = _mod("matplotlib.pyplot")
    if plt is not None:
        plt.show = lambda *a, **k: None
        plt.close("all")

def __labs_check(p):
    res = {"sintaxis": None, "falta": False, "superior": "", "casos": [], "reglas": []}
    try:
        arbol = _ast.parse(p["codigo"], _TU)
        tu = compile(arbol, _TU, "exec")
    except SyntaxError as e:
        res["sintaxis"] = {"mensaje": type(e).__name__ + ": " + str(e.msg), "linea": e.lineno}
        return _json.dumps(res)
    ref = compile(p["solucion"], "<referencia>", "exec")
    res["reglas"] = [(_usa(arbol, r["que"]) == (r["tipo"] == "usa")) for r in p["reglas"]]
    _preparar(p.get("paquetes", []))
    base = _os.getcwd()
    dibujar = None
    for k, caso in enumerate(p["casos"], 1):
        origen = _os.path.join(base, "${CASE_DIR}", "caso" + str(k))
        op = caso.get("opciones") or {}
        con_figura = any(ch["tipo"].startswith("fig-") for ch in caso.get("checks", []))
        esperado = _correr(ref, caso, origen, max(10, p["segundos"]), p["fn"])
        tu_r = _correr(tu, caso, origen, p["segundos"], p["fn"])
        if con_figura and tu_r["figuras"] and dibujar is None:
            dibujar = (caso, origen)
        if k == 1:
            res["superior"] = tu_r["superior"]
        if tu_r["falta"]:
            res["falta"] = True
        fila = {"ok": False}
        if esperado["error"] is not None or esperado["tiempo"]:
            fila["interno"] = True
        elif tu_r["tiempo"]:
            fila["tiempo"] = True
        elif tu_r["falta"]:
            fila["falta"] = True
        elif tu_r["error"] is not None:
            fila["error"] = tu_r["error"]
        else:
            mal = []
            for que in caso["compara"]:
                if que == "valor":
                    d = _dif(esperado["valor"], tu_r["valor"], op)
                    if d is not None or esperado["iter"] != tu_r["iter"]:
                        dif = {"que": "valor", "texto": _repr(tu_r["valor"])}
                        if esperado["clase"] != tu_r["clase"]:
                            dif["tipo"] = tu_r["clase"]
                        if d:
                            dif["detalle"] = d
                        mal.append(dif)
                elif que == "salida":
                    if esperado["salida"] != tu_r["salida"]:
                        mal.append({"que": "salida", "texto": _repr(tu_r["salida"])})
                else:
                    nombre = que[8:]
                    if esperado["archivos"].get(nombre) != tu_r["archivos"].get(nombre):
                        hay = tu_r["archivos"].get(nombre)
                        mal.append({"que": que, "texto": None if hay is None else _repr(hay)})
            checks = []
            for ch in caso.get("checks", []):
                try:
                    ok, tuyo = _comprobar(ch, op, esperado, tu_r)
                    ok_ref = _comprobar(ch, op, esperado, esperado)[0]
                except BaseException:
                    ok, tuyo, ok_ref = False, None, True
                if ok is None or not ok_ref:
                    fila["interno"] = True
                checks.append({"ok": bool(ok), "tuyo": tuyo})
            if checks:
                fila["comprobaciones"] = checks
            fila["ok"] = not mal and all(c["ok"] for c in checks) and not fila.get("interno")
            if mal:
                fila["mal"] = mal
        res["casos"].append(fila)
    if dibujar is not None:
        # La figura del primer caso con gráfico, otra vez y abierta: el worker la dibuja para la persona.
        # (Cada caso cierra las suyas al terminar, así que ninguna se mezcla con la del caso siguiente.)
        _correr(tu, dibujar[0], dibujar[1], p["segundos"], p["fn"], guardar=True)
    return _json.dumps(res)

def __labs_output(p):
    res = {"sintaxis": None, "salida": "", "error": None, "tiempo": False}
    try:
        obj = compile(p["codigo"], _TU, "exec")
    except SyntaxError as e:
        res["sintaxis"] = {"mensaje": type(e).__name__ + ": " + str(e.msg), "linea": e.lineno}
        return _json.dumps(res)
    salida = _Salida(${MAX_CASE_OUTPUT})
    try:
        with _ctx.redirect_stdout(salida):
            _sys.settrace(_vigilar(p["segundos"]))
            try:
                exec(obj, {"__name__": "__main__"})
            finally:
                _sys.settrace(None)
    except _Tiempo:
        res["tiempo"] = True
    except BaseException as e:
        res["error"] = _error(e)
    res["salida"] = salida.getvalue()
    return _json.dumps(res)
${HARNESS_DATA_PY}`;

/** Un caso tal como lo recibe el banco de pruebas (opciones, comprobaciones y toma solo si las hay). */
export type CasePayload = {
  codigo: string;
  compara: string[];
  opciones?: PyCompareOptions;
  checks?: Array<{ tipo: PyCheckKind; ejes?: number }>;
  toma?: number;
};

/** Lo que manda la página al banco de pruebas para un ejercicio de código. */
export type CheckPayload = {
  codigo: string;
  solucion: string;
  fn: string;
  segundos: number;
  casos: CasePayload[];
  reglas: Array<{ tipo: PyRule["kind"]; que: string }>;
  /** Módulos que se importan antes de los casos (fuera del límite de tiempo). */
  paquetes?: string[];
};

function casePayload(c: PyCase): CasePayload {
  const out: CasePayload = { codigo: c.code, compara: c.compare ?? ["valor"] };
  if (c.options) out.opciones = c.options;
  if (c.checks?.length) out.checks = c.checks.map((ch) => (ch.axes === undefined ? { tipo: ch.kind } : { tipo: ch.kind, ejes: ch.axes }));
  if (c.take !== undefined) out.toma = c.take;
  return out;
}

/** El programa de comprobación de una instancia; `seconds` por defecto, el de la instancia o CASE_SECONDS. */
export function checkPayload(instance: PyCodeInstance, code: string, seconds = instance.seconds ?? CASE_SECONDS): CheckPayload {
  const payload: CheckPayload = {
    codigo: code,
    solucion: instance.solution,
    fn: instance.fn,
    segundos: seconds,
    casos: instance.cases.map(casePayload),
    reglas: (instance.rules ?? []).map((r) => ({ tipo: r.kind, que: r.what })),
  };
  if (instance.packages?.length) payload.paquetes = instance.packages;
  return payload;
}

/**
 * Texto del que el worker saca los paquetes que tiene que cargar: el código de la persona y los
 * import de los paquetes del ejercicio (la solución y los casos pueden usar pandas aunque la persona
 * aún no lo haya importado).
 */
export function importsOf(instance: PyCodeInstance, code: string): string {
  const extra = (instance.packages ?? []).map((m) => `import ${m}`).join("\n");
  return extra ? `${code}\n${extra}\n` : code;
}

/** Literal de Python con el JSON (JSON.stringify da un literal de cadena válido en Python). */
const pyJson = (data: unknown) => `_json.loads(${JSON.stringify(JSON.stringify(data))})`;

/** Programa de una comprobación: el banco y la llamada final, cuyo valor (un str con JSON) es el resultado. */
export function buildCheckProgram(payload: CheckPayload): string {
  return `${HARNESS_PY}\n__labs_check(${pyJson(payload)})\n`;
}

/** Programa de «¿Qué imprime?»: ejecuta el fragmento y devuelve su salida. */
export function buildOutputProgram(code: string, seconds = CASE_SECONDS): string {
  return `${HARNESS_PY}\n__labs_output(${pyJson({ codigo: code, segundos: seconds })})\n`;
}

/** Archivos de entrada de cada caso, con su ruta en la carpeta de trabajo (ejercicio/caso<k>/…). */
export function caseFiles(cases: readonly PyCase[]): Array<{ path: string; text: string }> {
  return cases.flatMap((c, i) => Object.entries(c.files ?? {}).map(([name, text]) => ({ path: casePath(i + 1, name), text })));
}

// ---------------------------------------------------------------- Resultado

export type PyError = { tipo: string; mensaje: string; linea: number | null };
/**
 * Por qué no coincide una tabla, una serie o un array (siempre sobre lo que hizo la persona): forma,
 * columnas, tipos, índice, orden, nulos (cuántos NaN tiene cada columna tuya), valores (dónde está el
 * primero distinto y qué vale el tuyo) o tipo (no es una tabla, serie o array).
 */
export type DataDetail = { clave: string; tuyo?: string; donde?: string; fila?: number };
export type CaseDiff = { que: string; texto: string | null; tipo?: string; detalle?: DataDetail };
/** Resultado de una comprobación con nombre (en el orden de PyCase.checks). */
export type CheckOutcome = { ok: boolean; tuyo: string | null };
export type CaseResult = { ok: boolean; interno?: boolean; tiempo?: boolean; falta?: boolean; error?: PyError; mal?: CaseDiff[]; checks?: CheckOutcome[] };
export type CheckResult = {
  sintaxis: { mensaje: string; linea: number | null } | null;
  falta: boolean;
  superior: string;
  casos: CaseResult[];
  reglas: boolean[];
};
export type OutputResult = { sintaxis: { mensaje: string; linea: number | null } | null; salida: string; error: PyError | null; tiempo: boolean };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === "string" ? x : "");
const lineOf = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x > 0 ? x : null);

function parseError(x: unknown): PyError | null {
  if (!isObj(x)) return null;
  return { tipo: str(x.tipo), mensaje: str(x.mensaje), linea: lineOf(x.linea) };
}

function parseDetail(x: unknown): DataDetail | null {
  if (!isObj(x) || typeof x.clave !== "string") return null;
  const d: DataDetail = { clave: x.clave };
  if (typeof x.tuyo === "string") d.tuyo = x.tuyo;
  if (typeof x.donde === "string") d.donde = x.donde;
  if (typeof x.fila === "number" && Number.isInteger(x.fila)) d.fila = x.fila;
  return d;
}

function parseSyntax(x: unknown): CheckResult["sintaxis"] {
  return isObj(x) ? { mensaje: str(x.mensaje), linea: lineOf(x.linea) } : null;
}

/** Lee el JSON del banco de pruebas; null si no tiene la forma esperada. */
export function parseCheckResult(raw: string | undefined): CheckResult | null {
  if (typeof raw !== "string") return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || !Array.isArray(d.casos) || !Array.isArray(d.reglas)) return null;
  const casos: CaseResult[] = d.casos.map((c) => {
    const o = isObj(c) ? c : {};
    const r: CaseResult = { ok: o.ok === true };
    if (o.interno === true) r.interno = true;
    if (o.tiempo === true) r.tiempo = true;
    if (o.falta === true) r.falta = true;
    const e = parseError(o.error);
    if (e) r.error = e;
    if (Array.isArray(o.mal)) {
      r.mal = o.mal.filter(isObj).map((m) => {
        const diff: CaseDiff = { que: str(m.que), texto: typeof m.texto === "string" ? m.texto : null };
        if (typeof m.tipo === "string") diff.tipo = m.tipo;
        const det = parseDetail(m.detalle);
        if (det) diff.detalle = det;
        return diff;
      });
    }
    if (Array.isArray(o.comprobaciones)) {
      r.checks = o.comprobaciones.map((c) => (isObj(c) ? { ok: c.ok === true, tuyo: typeof c.tuyo === "string" ? c.tuyo : null } : { ok: false, tuyo: null }));
    }
    return r;
  });
  return { sintaxis: parseSyntax(d.sintaxis), falta: d.falta === true, superior: str(d.superior), casos, reglas: d.reglas.map((x) => x === true) };
}

export function parseOutputResult(raw: string | undefined): OutputResult | null {
  if (typeof raw !== "string") return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || typeof d.salida !== "string") return null;
  return { sintaxis: parseSyntax(d.sintaxis), salida: d.salida, error: parseError(d.error), tiempo: d.tiempo === true };
}

/** ¿Resuelto? Todos los casos correctos y todos los requisitos cumplidos. */
export const allPassed = (r: CheckResult) => r.sintaxis === null && r.casos.length > 0 && r.casos.every((c) => c.ok) && r.reglas.every(Boolean);

/**
 * Compara la salida que escribe la persona con la real, sin tener en cuenta los espacios al final de
 * cada línea ni las líneas vacías del final. Devuelve la primera línea distinta (desde 1) o null.
 */
export function firstOutputDiff(expected: string, answer: string): number | null {
  const norm = (s: string) => {
    const lines = s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  };
  const a = norm(expected);
  const b = norm(answer);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i + 1;
  return null;
}
