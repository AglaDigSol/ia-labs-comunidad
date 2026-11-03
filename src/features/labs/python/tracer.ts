// Paso a paso (como Python Tutor): el código se ejecuta en el worker bajo sys.settrace y, antes de
// cada línea del código de la persona (y al volver de cada función), se apunta la línea, la pila de
// llamadas con sus variables locales (repr recortado) y cuánto se ha impreso hasta ese momento. Dos
// nombres que apuntan al mismo objeto mutable (mismo id()) se marcan: «misma lista que x». Con
// límites de pasos, de salida y de tiempo; al llegar a uno se para y se dice cuál fue.
// Solo se traza el código de la persona: las funciones de la biblioteca se ejecutan sin pasos.

export const TRACE_MAX_STEPS = 2000;
export const TRACE_MAX_OUTPUT = 10_000;
export const TRACE_SECONDS = 5;
/** Límite de toda la ejecución en el worker (si se pasa, se reinicia Python). */
export const TRACE_TIMEOUT_MS = 20_000;
/** Variables por marco y elementos por colección que se muestran. */
export const TRACE_MAX_VARS = 30;

export const TRACER_PY = String.raw`
import builtins as _builtins, io as _io, json as _json, reprlib as _reprlib, sys as _sys, time as _time, types as _types

_TU = "<tu código>"

class _Alto(BaseException):
    pass

def __labs_trace(p):
    res = {"pasos": [], "salida": "", "limite": None, "error": None, "sintaxis": None}
    try:
        obj = compile(p["codigo"], _TU, "exec")
    except SyntaxError as e:
        res["sintaxis"] = {"mensaje": type(e).__name__ + ": " + str(e.msg), "linea": e.lineno}
        return _json.dumps(res)
    max_pasos, max_salida, max_vars = p["pasos"], p["salida"], p["variables"]
    fin = _time.perf_counter() + p["segundos"]
    pasos = res["pasos"]
    buf = _io.StringIO()

    class Salida(_io.TextIOBase):
        def writable(self):
            return True
        def write(self, s):
            resto = max_salida - buf.tell()
            if len(s) > resto:
                buf.write(s[: max(resto, 0)])
                res["limite"] = "salida"
                raise _Alto()
            return buf.write(s)

    rep = _reprlib.Repr()
    rep.maxlevel = 3
    rep.maxlist = rep.maxtuple = rep.maxset = rep.maxfrozenset = rep.maxdeque = rep.maxarray = 8
    rep.maxdict = 6
    rep.maxstring = rep.maxother = 60
    rep.maxlong = 40

    def texto(x):
        if isinstance(x, _types.FunctionType):
            return "función " + x.__name__
        if isinstance(x, type):
            return "clase " + x.__name__
        try:
            t = rep.repr(x)
        except BaseException:
            t = "<no se puede mostrar>"
        return t if len(t) <= 120 else t[:119] + "…"

    def clase(x):
        if isinstance(x, list):
            return "lista"
        if isinstance(x, dict):
            return "diccionario"
        if isinstance(x, set):
            return "conjunto"
        if isinstance(x, (int, float, complex, str, bytes, bool, tuple, frozenset, range, type(None), _types.FunctionType, type)):
            return None
        return "objeto"

    def foto(frame, evento, arg):
        pila = []
        f = frame
        while f is not None and f.f_code.co_filename == _TU:
            pila.append(f)
            f = f.f_back
        pila.reverse()
        vistos = {}
        marcos = []
        for i, f in enumerate(pila):
            modulo = f.f_code.co_name == "<module>"
            variables = []
            fuente = f.f_globals if modulo else f.f_locals
            for nombre, valor in list(fuente.items()):
                if nombre.startswith("__") or isinstance(valor, _types.ModuleType):
                    continue
                if len(variables) >= max_vars:
                    break
                v = {"nombre": nombre, "valor": texto(valor)}
                c = clase(valor)
                if c is not None:
                    v["clase"] = c
                    clave = id(valor)
                    if clave in vistos:
                        v["alias"] = vistos[clave]
                    else:
                        vistos[clave] = {"nombre": nombre, "marco": i}
                variables.append(v)
            marcos.append({"nombre": f.f_code.co_name, "linea": f.f_lineno, "variables": variables})
        paso = {"linea": frame.f_lineno, "evento": evento, "marcos": marcos, "salida": buf.tell()}
        if evento == "return":
            paso["devuelve"] = texto(arg)
        pasos.append(paso)

    # Marcos por los que pasa una excepción: su «return» no devuelve nada, sale con el error (si la
    # excepción se captura dentro, la siguiente línea del marco lo saca de aquí).
    lanzando = set()

    def local(frame, evento, arg):
        modulo = frame.f_code.co_name == "<module>"
        if evento == "exception":
            lanzando.add(id(frame))
            return local
        if evento == "line":
            lanzando.discard(id(frame))
            tipo = "line"
        elif evento == "return":
            if id(frame) in lanzando:
                lanzando.discard(id(frame))
                if modulo:
                    return local
                tipo = "sale"
            else:
                tipo = "fin" if modulo else "return"
        else:
            return local
        if len(pasos) >= max_pasos:
            res["limite"] = "pasos"
            raise _Alto()
        if _time.perf_counter() > fin:
            res["limite"] = "tiempo"
            raise _Alto()
        foto(frame, tipo, arg)
        return local

    def traza(frame, evento, arg):
        if frame.f_code.co_filename != _TU:
            return None
        return local

    entrada = list(p.get("entrada", []))

    def leer(prompt=""):
        salida.write(str(prompt))
        if not entrada:
            raise EOFError("EOF when reading a line")
        linea = entrada.pop(0)
        salida.write(linea + "\n")
        return linea

    salida = Salida()
    mis_builtins = dict(vars(_builtins))
    mis_builtins["input"] = leer
    ns = {"__name__": "__main__", "__builtins__": mis_builtins}
    viejo = _sys.stdout
    _sys.stdout = salida
    _sys.settrace(traza)
    try:
        exec(obj, ns)
    except _Alto:
        pass
    except BaseException as e:
        linea = None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == _TU:
                linea = tb.tb_lineno
            tb = tb.tb_next
        t = str(e)
        res["error"] = {"mensaje": type(e).__name__ + (": " + t if t else ""), "linea": linea}
        if pasos:
            # Último paso: el estado de antes del error, señalando la línea que lo lanzó.
            ultimo = dict(pasos[-1])
            ultimo["evento"] = "error"
            ultimo.pop("devuelve", None)
            if linea is not None:
                ultimo["linea"] = linea
            ultimo["salida"] = buf.tell()
            pasos.append(ultimo)
    finally:
        _sys.settrace(None)
        _sys.stdout = viejo
    res["salida"] = buf.getvalue()
    return _json.dumps(res)
`;

export type TracePayload = { codigo: string; pasos: number; salida: number; segundos: number; variables: number; entrada: string[] };

export function tracePayload(code: string, stdin: string[] = [], limits: Partial<Pick<TracePayload, "pasos" | "salida" | "segundos">> = {}): TracePayload {
  return {
    codigo: code,
    pasos: limits.pasos ?? TRACE_MAX_STEPS,
    salida: limits.salida ?? TRACE_MAX_OUTPUT,
    segundos: limits.segundos ?? TRACE_SECONDS,
    variables: TRACE_MAX_VARS,
    entrada: stdin,
  };
}

/** Programa del paso a paso: el trazador y la llamada final, cuyo valor (un str con JSON) es la traza. */
export function buildTraceProgram(payload: TracePayload): string {
  return `${TRACER_PY}\n__labs_trace(_json.loads(${JSON.stringify(JSON.stringify(payload))}))\n`;
}

// ---------------------------------------------------------------- Resultado

export type TraceVar = { nombre: string; valor: string; clase?: "lista" | "diccionario" | "conjunto" | "objeto"; alias?: { nombre: string; marco: number } };
export type TraceFrame = { nombre: string; linea: number; variables: TraceVar[] };
export type TraceEvent = "line" | "return" | "sale" | "fin" | "error";
export type TraceStep = { linea: number; evento: TraceEvent; marcos: TraceFrame[]; salida: number; devuelve?: string };
export type TraceLimit = "pasos" | "salida" | "tiempo";
export type Trace = {
  pasos: TraceStep[];
  salida: string;
  limite: TraceLimit | null;
  error: { mensaje: string; linea: number | null } | null;
  sintaxis: { mensaje: string; linea: number | null } | null;
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const int = (x: unknown, min = 0) => (typeof x === "number" && Number.isInteger(x) && x >= min ? x : null);
const CLASES = new Set(["lista", "diccionario", "conjunto", "objeto"]);
const EVENTS = new Set<string>(["line", "return", "sale", "fin", "error"]);

function parseVar(x: unknown): TraceVar | null {
  if (!isObj(x) || typeof x.nombre !== "string" || typeof x.valor !== "string") return null;
  const v: TraceVar = { nombre: x.nombre, valor: x.valor };
  if (typeof x.clase === "string" && CLASES.has(x.clase)) v.clase = x.clase as TraceVar["clase"];
  if (isObj(x.alias) && typeof x.alias.nombre === "string" && int(x.alias.marco) !== null) v.alias = { nombre: x.alias.nombre, marco: x.alias.marco as number };
  return v;
}

function parseStep(x: unknown): TraceStep | null {
  if (!isObj(x) || !Array.isArray(x.marcos)) return null;
  const linea = int(x.linea, 1);
  const salida = int(x.salida);
  if (linea === null || salida === null || typeof x.evento !== "string" || !EVENTS.has(x.evento)) return null;
  const marcos: TraceFrame[] = [];
  for (const m of x.marcos) {
    if (!isObj(m) || typeof m.nombre !== "string" || int(m.linea, 1) === null || !Array.isArray(m.variables)) return null;
    marcos.push({ nombre: m.nombre, linea: m.linea as number, variables: m.variables.map(parseVar).filter((v): v is TraceVar => v !== null) });
  }
  const step: TraceStep = { linea, evento: x.evento as TraceEvent, marcos, salida };
  if (typeof x.devuelve === "string") step.devuelve = x.devuelve;
  return step;
}

const parseMsg = (x: unknown) => (isObj(x) && typeof x.mensaje === "string" ? { mensaje: x.mensaje, linea: int(x.linea, 1) } : null);

/** Lee el JSON del trazador; null si no tiene la forma esperada. */
export function parseTrace(raw: string | undefined): Trace | null {
  if (typeof raw !== "string") return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || !Array.isArray(d.pasos) || typeof d.salida !== "string") return null;
  const pasos: TraceStep[] = [];
  for (const s of d.pasos) {
    const step = parseStep(s);
    if (!step) return null;
    pasos.push(step);
  }
  const limite = d.limite === "pasos" || d.limite === "salida" || d.limite === "tiempo" ? d.limite : null;
  return { pasos, salida: d.salida, limite, error: parseMsg(d.error), sintaxis: parseMsg(d.sintaxis) };
}

// ---------------------------------------------------------------- Textos

/** Nombre de un marco para la persona: «Programa principal» o «función f». */
export const frameLabel = (name: string) => (name === "<module>" ? "Programa principal" : name === "<lambda>" ? "lambda" : `función ${name}`);

/** «misma lista que x» (o «… que x en Programa principal», si es de otro marco). */
export function aliasText(v: TraceVar, frames: readonly TraceFrame[], frameIndex: number): string | null {
  if (!v.alias) return null;
  const what = v.clase === "diccionario" ? "mismo diccionario" : v.clase === "conjunto" ? "mismo conjunto" : v.clase === "objeto" ? "mismo objeto" : "misma lista";
  const other = v.alias.marco === frameIndex ? "" : ` en ${frameLabel(frames[v.alias.marco]?.nombre ?? "")}`;
  return `${what} que ${v.alias.nombre}${other}`;
}

/** Lo que se anuncia en cada paso (aria-live). */
export function stepText(trace: Trace, i: number): string {
  const s = trace.pasos[i];
  if (!s) return "";
  const n = `Paso ${i + 1} de ${trace.pasos.length}`;
  if (s.evento === "fin") return `${n}: fin del programa.`;
  if (s.evento === "error") return `${n}: error en la línea ${s.linea}${trace.error ? `: ${trace.error.mensaje}` : ""}.`;
  if (s.evento === "sale") return `${n}: ${frameLabel(s.marcos[s.marcos.length - 1]?.nombre ?? "")} termina por un error (línea ${s.linea}).`;
  if (s.evento === "return") {
    const f = s.marcos[s.marcos.length - 1];
    return `${n}: ${frameLabel(f?.nombre ?? "")} devuelve ${s.devuelve ?? "None"} (línea ${s.linea}).`;
  }
  return `${n}: se va a ejecutar la línea ${s.linea}.`;
}

export const LIMIT_TEXT: Record<TraceLimit, string> = {
  pasos: `Se ha llegado al límite de ${TRACE_MAX_STEPS} pasos: el paso a paso se para aquí y el resto del programa no se muestra. Prueba con menos vueltas.`,
  salida: `El programa ha impreso más de ${TRACE_MAX_OUTPUT.toLocaleString("es-ES")} caracteres: el paso a paso se para aquí.`,
  tiempo: `El paso a paso ha superado ${TRACE_SECONDS} s y se ha parado (¿un bucle que no termina?).`,
};
