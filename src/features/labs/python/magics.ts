// Órdenes mágicas de IPython que entiende la pestaña Python, mediante una transformación pequeña del
// código antes de ejecutarlo. Se conservan los números de línea (cada orden ocupa la misma línea), así
// que «Error en la línea N» sigue señalando la línea del editor.
//
//   %matplotlib inline       → sin efecto (los gráficos siempre salen debajo).
//   %time <instrucción>      → ejecuta la instrucción y escribe el tiempo.
//   %timeit [-n N] [-r R] <instrucción>
//                            → la repite con timeit y escribe media ± desviación.
//   %%time                   → (primera línea) mide toda la celda.
//   %%timeit [-n N] [-r R] [preparación]
//                            → (primera línea) repite el resto de la celda con timeit.
//
// Límites: se reconocen al principio de una línea (con sangría o sin ella) y fuera de cadenas de
// varias líneas; %time no muestra el valor de la expresión (usa print); %%time y %%timeit solo en la
// primera línea, como en Jupyter. Cualquier otra orden (%pip, !ls, %%capture…) da un error en español
// que la nombra, sin ejecutar nada.

export type MagicsResult =
  | { ok: true; code: string; used: string[] }
  | { ok: false; magic: string; line: number; message: string };

const SUPPORTED = "%time, %timeit, %%time, %%timeit y %matplotlib inline";

/** Opciones -n y -r de %timeit / %%timeit. Devuelve null si hay otra opción. */
function timeitOptions(args: string): { n: number | null; r: number | null; rest: string } | null {
  let rest = args.trimStart();
  let n: number | null = null;
  let r: number | null = null;
  for (;;) {
    const m = /^-([nr])\s*(\d+)\s*/.exec(rest);
    if (m) {
      const v = Number(m[2]);
      if (v < 1) return null;
      if (m[1] === "n") n = v;
      else r = v;
      rest = rest.slice(m[0].length);
      continue;
    }
    if (/^-\w/.test(rest)) return null;
    return { n, r, rest };
  }
}

/** Literal de cadena de Python (JSON es un subconjunto válido para cadenas). */
const pyStr = (s: string) => JSON.stringify(s);
const pyNum = (v: number | null) => (v === null ? "None" : String(v));

function badTimeit(magic: "%timeit" | "%%timeit", line: number, empty: boolean): MagicsResult {
  const message = empty
    ? `Escribe la instrucción que quieres medir después de «${magic}» (por ejemplo, %timeit sum(range(1000))).`
    : `«${magic}» solo admite las opciones -n y -r (por ejemplo, ${magic} -n 100 -r 5).`;
  return { ok: false, magic, line, message };
}

function unsupported(magic: string, line: number): MagicsResult {
  let message: string;
  if (/^[%!](pip|conda|mamba)$/.test(magic)) {
    message = `«${magic}» no está disponible: no se pueden instalar paquetes desde aquí. Los paquetes incluidos (numpy, pandas, matplotlib, seaborn, scikit-learn…) se cargan solos al importarlos.`;
  } else if (magic.startsWith("!")) {
    message = `«${magic}» es una orden de terminal y no funciona en el navegador. Para leer o escribir archivos, usa Python (open, os.listdir…) y «Subir archivo».`;
  } else {
    message = `La orden mágica «${magic}» no está disponible en este entorno. Se admiten ${SUPPORTED}.`;
  }
  return { ok: false, magic, line, message };
}

/**
 * Marca las líneas que empiezan dentro de una cadena de triple comilla, para no tomar por orden
 * mágica un «%» que es texto. Aproximado (no sigue prefijos ni comentarios con comillas), suficiente aquí.
 */
function linesInsideStrings(lines: string[]): boolean[] {
  const inside: boolean[] = [];
  let open: '"""' | "'''" | null = null;
  for (const line of lines) {
    inside.push(open !== null);
    let i = 0;
    while (i < line.length) {
      if (open) {
        const j = line.indexOf(open, i);
        if (j < 0) break;
        open = null;
        i = j + 3;
        continue;
      }
      const ch = line[i]!;
      if (ch === "#") break;
      if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
        open = line.slice(i, i + 3) as '"""' | "'''";
        i += 3;
        continue;
      }
      if (ch === '"' || ch === "'") {
        // Cadena de una línea: salta hasta su cierre.
        let k = i + 1;
        while (k < line.length && line[k] !== ch) k += line[k] === "\\" ? 2 : 1;
        i = k + 1;
        continue;
      }
      i++;
    }
  }
  return inside;
}

export function transformMagics(code: string): MagicsResult {
  const lines = code.split("\n");
  const inside = linesInsideStrings(lines);
  const used: string[] = [];
  const out = [...lines];

  // Órdenes de celda: solo en la primera línea con contenido (las líneas en blanco previas no cuentan).
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first >= 0 && lines[first]!.trimStart().startsWith("%%")) {
    const head = lines[first]!.trim();
    const name = /^%%(\w*)/.exec(head)![1]!;
    const args = head.slice(2 + name.length);
    if (name === "time" && args.trim() === "") {
      used.push("%%time");
      out[first] = "_labs_t0 = _labs_clock()";
      out.push("_labs_report(_labs_t0)");
    } else if (name === "timeit") {
      const opts = timeitOptions(args);
      if (!opts) return badTimeit("%%timeit", first + 1, false);
      used.push("%%timeit");
      const body = lines.slice(first + 1).join("\n");
      // Todo en la línea de la orden; las siguientes quedan vacías para conservar la numeración.
      out.splice(first, lines.length - first, `_labs_timeit(${pyStr(body)}, globals(), setup=${pyStr(opts.rest.trim() || "pass")}, number=${pyNum(opts.n)}, repeat=${pyNum(opts.r)})`, ...lines.slice(first + 1).map(() => ""));
      return { ok: true, code: out.join("\n"), used };
    } else {
      return unsupported(`%%${name}`, first + 1);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (inside[i] || (i === first && used.includes("%%time"))) continue;
    const line = lines[i]!;
    const m = /^(\s*)([%!])/.exec(line);
    if (!m) continue;
    const indent = m[1]!;
    const body = line.slice(indent.length);
    if (body.startsWith("!")) return unsupported(/^!\S*/.exec(body)![0], i + 1);
    if (body.startsWith("%%")) return unsupported(/^%%\w*/.exec(body)![0], i + 1);
    const mm = /^%(\w+)(.*)$/.exec(body);
    if (!mm) continue; // «%» suelto: que lo diga Python (SyntaxError)
    const [, name, args] = mm as unknown as [string, string, string];
    if (name === "matplotlib") {
      used.push("%matplotlib");
      out[i] = `${indent}pass  # %matplotlib: los gráficos ya salen debajo`;
    } else if (name === "time") {
      const stmt = args.trim();
      if (!stmt) {
        return { ok: false, magic: "%time", line: i + 1, message: "Escribe la instrucción que quieres medir después de «%time» (por ejemplo, %time sum(range(1000)))." };
      }
      used.push("%time");
      out[i] = `${indent}_labs_t0 = _labs_clock(); ${stmt}; _labs_report(_labs_t0)`;
    } else if (name === "timeit") {
      const opts = timeitOptions(args);
      if (!opts || !opts.rest.trim()) return badTimeit("%timeit", i + 1, opts !== null);
      used.push("%timeit");
      out[i] = `${indent}_labs_timeit(${pyStr(opts.rest.trim())}, globals(), number=${pyNum(opts.n)}, repeat=${pyNum(opts.r)})`;
    } else {
      return unsupported(`%${name}`, i + 1);
    }
  }
  return { ok: true, code: out.join("\n"), used };
}

/**
 * Funciones auxiliares que usan las órdenes transformadas. El worker las carga una vez en el módulo
 * _labs_magics y las copia en el espacio de nombres de cada ejecución.
 */
export const MAGICS_PY = String.raw`
import time as _time
import timeit as _timeit
import statistics as _statistics

def _fmt(seconds):
    if seconds >= 1:
        return f"{seconds:.3g} s"
    if seconds >= 1e-3:
        return f"{seconds * 1e3:.3g} ms"
    if seconds >= 1e-6:
        return f"{seconds * 1e6:.3g} µs"
    return f"{seconds * 1e9:.3g} ns"

def _labs_clock():
    return (_time.perf_counter(), _time.process_time())

def _labs_report(t0):
    wall = _time.perf_counter() - t0[0]
    cpu = _time.process_time() - t0[1]
    print(f"Tiempo de CPU: {_fmt(cpu)} · Tiempo real: {_fmt(wall)}")

def _labs_timeit(stmt, ns, setup="pass", number=None, repeat=None):
    timer = _timeit.Timer(stmt, setup=setup, globals=ns)
    if number is None:
        number, _ = timer.autorange()
    repeat = 7 if repeat is None else repeat
    runs = [t / number for t in timer.repeat(repeat=repeat, number=number)]
    mean = _statistics.fmean(runs)
    dev = _statistics.pstdev(runs) if len(runs) > 1 else 0.0
    vueltas = "bucle" if number == 1 else "bucles"
    ejecuciones = "ejecución" if repeat == 1 else "ejecuciones"
    print(f"{_fmt(mean)} ± {_fmt(dev)} por bucle (media ± desv. típica de {repeat} {ejecuciones}, {number} {vueltas} cada una)")

EXPORTS = {"_labs_clock": _labs_clock, "_labs_report": _labs_report, "_labs_timeit": _labs_timeit}
`;
