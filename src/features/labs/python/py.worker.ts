// Worker de módulo con Pyodide. Solo se crea cuando se abre la pestaña Python; Pyodide se carga del
// mismo origen (indexURL, que manda el hilo principal), nunca de un CDN. Protocolo en py-client.ts.
//
// Los paquetes se cargan bajo demanda a partir de los import del código: los de la distribución de
// Pyodide con loadPackagesFromImports y los wheels extra (seaborn, folium…) con micropip, desde las
// mismas URL del sitio y sin resolver dependencias (deps=False, lista explícita).
import { loadPyodide, type PyodideInterface } from "pyodide";
import type { PyDict } from "pyodide/ffi";
import type { FileInfo } from "./files.ts";
import { MAGICS_PY } from "./magics.ts";
import { extraClosure, extraForImport, type ExtraWheel } from "./packages.ts";
import { INIT_ID, parseErrorLine, type WorkerIn, type WorkerOut } from "./py-client.ts";

const ctx = self as unknown as {
  postMessage(m: WorkerOut, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<WorkerIn>) => void) | null;
};
const post = (m: WorkerOut, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);

/** Carpeta de trabajo: la HOME de Pyodide. Ahí van los archivos subidos. */
const WORKDIR = "/home/pyodide";

// Backend Agg y plt.show sin efecto, para que el código que llama a show() funcione sin pantalla.
const SETUP_MPL = `
import os
os.environ["MPLBACKEND"] = "Agg"
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.show = lambda *a, **k: None
`;

// Guarda cada figura abierta como PNG en base64 y las cierra.
const FLUSH_FIGS = `
def __labs_flush():
    import sys, io, base64, warnings
    out = []
    if "matplotlib.pyplot" in sys.modules:
        import matplotlib.pyplot as plt
        for n in plt.get_fignums():
            buf = io.BytesIO()
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                plt.figure(n).savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="white")
            out.append(base64.b64encode(buf.getvalue()).decode())
        plt.close("all")
    return out
__labs_flush()
`;

let py: PyodideInterface | null = null;
let indexURL = "";
let mplReady = false;
let stdinLines: string[] = [];
/** Módulo importable -> paquete del lock que lo trae (de pyodide-lock.json). */
let lockImports = new Map<string, string>();
/** Funciones de las órdenes mágicas (_labs_magics.EXPORTS), para copiarlas en cada ejecución. */
let magicsExports: unknown = null;
const installedExtras = new Set<string>();
let queue: Promise<void> = Promise.resolve();

/** Deja la parte de la traza que importa: desde el primer marco del código del usuario. */
function cleanTraceback(raw: string): string {
  const lines = raw.replace(/\s+$/, "").split("\n");
  const first = lines.findIndex((l) => l.includes('File "<exec>"'));
  if (first <= 0) return lines.join("\n");
  return ["Traceback (most recent call last):", ...lines.slice(first)].join("\n");
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const quiet = { messageCallback: () => {}, errorCallback: () => {} };

async function init(url: string, interrupt: SharedArrayBuffer | undefined): Promise<void> {
  try {
    indexURL = url;
    const p = await loadPyodide({ indexURL: url, env: { HOME: WORKDIR, MPLBACKEND: "Agg" } });
    if (interrupt) p.setInterruptBuffer(new Int32Array(interrupt));
    p.setStdout({ batched: (text: string) => post({ type: "stdout", text: `${text}\n` }) });
    p.setStderr({ batched: (text: string) => post({ type: "stderr", text: `${text}\n` }) });
    // input() lee las líneas que el usuario escribió antes de ejecutar; al acabarse, EOFError.
    p.setStdin({ stdin: () => stdinLines.shift(), isatty: false });
    p.runPython(`import sys, types\n_m = types.ModuleType("_labs_magics")\nexec(${JSON.stringify(MAGICS_PY)}, _m.__dict__)\nsys.modules["_labs_magics"] = _m\ndel _m`);
    magicsExports = p.pyimport("_labs_magics").EXPORTS;
    lockImports = await readLockImports(url);
    // numpy va en la primera descarga: casi todas las plantillas lo usan.
    let numpy: string | undefined;
    try {
      await p.loadPackage("numpy", quiet);
      numpy = String(p.runPython("import numpy\nnumpy.__version__"));
    } catch {
      numpy = undefined;
    }
    const python = String(p.runPython("import sys\nsys.version.split()[0]"));
    py = p;
    post(numpy ? { type: "ready", python, numpy } : { type: "ready", python });
  } catch (e) {
    post({ type: "error", id: INIT_ID, message: errorMessage(e), line: null, ms: 0 });
  }
}

/** Módulos raíz que importa el código (vacío si tiene un error de sintaxis: lo dirá la ejecución). */
function importedModules(p: PyodideInterface, code: string): string[] {
  try {
    const found = p.pyodide_py.code.find_imports(code);
    const names = (found.toJs() as string[]).map((n) => n.split(".")[0]!);
    found.destroy();
    return [...new Set(names)];
  } catch {
    return [];
  }
}

/** El mismo pyodide-lock.json que usa Pyodide (ya en la caché del navegador). */
async function readLockImports(url: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(new URL("pyodide-lock.json", url));
    const lock = (await res.json()) as { packages: Record<string, { name: string; imports?: string[] }> };
    for (const pkg of Object.values(lock.packages)) for (const m of pkg.imports ?? []) map.set(m, pkg.name);
  } catch {
    // sin el mapa solo se pierde el aviso «Cargando …»; la carga la hace Pyodide igualmente
  }
  return map;
}

/** Paquetes del lock que el código hará descargar (para avisar con su nombre). */
function missingLockPackages(p: PyodideInterface, modules: string[]): string[] {
  const names = modules.map((m) => lockImports.get(m)).filter((n): n is string => n !== undefined);
  return [...new Set(names)].filter((n) => !(n in p.loadedPackages));
}

async function installExtras(p: PyodideInterface, wanted: ExtraWheel[]): Promise<void> {
  const todo = wanted.flatMap(extraClosure).filter((w, i, all) => all.indexOf(w) === i && !installedExtras.has(w.name));
  if (todo.length === 0) return;
  const deps = [...new Set(["micropip", ...todo.flatMap((w) => w.lockDeps)])];
  // Avisa de los paquetes del lock que bajan con él (seaborn trae pandas y matplotlib), no de micropip.
  const shown = [...todo.flatMap((w) => w.lockDeps).filter((d) => !(d in p.loadedPackages)), ...todo.map((w) => w.name)];
  const unique = [...new Set(shown)];
  for (const name of unique) post({ type: "package", name, phase: "start" });
  await p.loadPackage(deps, quiet);
  const urls = todo.map((w) => new URL(w.file, indexURL).href);
  await p.runPythonAsync(`import micropip\nawait micropip.install(${JSON.stringify(urls)}, deps=False)`);
  for (const w of todo) installedExtras.add(w.name);
  for (const name of unique) post({ type: "package", name, phase: "done" });
}

function listFiles(p: PyodideInterface | null): FileInfo[] {
  if (!p) return [];
  try {
    const out: FileInfo[] = [];
    for (const name of p.FS.readdir(WORKDIR) as string[]) {
      if (name === "." || name === "..") continue;
      const st = p.FS.stat(`${WORKDIR}/${name}`);
      if (p.FS.isFile(st.mode)) out.push({ name, size: st.size });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch {
    return [];
  }
}

async function run(id: number, code: string, stdin: string[]): Promise<void> {
  const t0 = performance.now();
  const p = py;
  if (!p) {
    post({ type: "error", id, message: "Python no está cargado.", line: null, ms: 0 });
    return;
  }
  stdinLines = [...stdin];
  let ns: PyDict | null = null;
  try {
    const modules = importedModules(p, code);
    const extras = modules.map(extraForImport).filter((w): w is ExtraWheel => w !== null);
    const lockPkgs = missingLockPackages(p, modules);
    for (const name of lockPkgs) post({ type: "package", name, phase: "start" });
    if (lockPkgs.length > 0) await p.loadPackagesFromImports(code, quiet);
    for (const name of lockPkgs) post({ type: "package", name, phase: "done" });
    await installExtras(p, extras);
    if (!mplReady && "matplotlib" in p.loadedPackages) {
      await p.runPythonAsync(SETUP_MPL); // el primer import de pyplot crea la caché de fuentes
      mplReady = true;
    }
    const globals = p.globals.get("dict")() as PyDict; // espacio de nombres nuevo en cada ejecución
    ns = globals;
    globals.set("__name__", "__main__");
    (globals as unknown as { update(d: unknown): void }).update(magicsExports);
    p.FS.chdir(WORKDIR);
    await p.runPythonAsync(code, { globals });
    const figsProxy = await p.runPythonAsync(FLUSH_FIGS);
    const figures = figsProxy.toJs() as string[];
    figsProxy.destroy();
    post({ type: "done", id, figures, ms: Math.round(performance.now() - t0), files: listFiles(p) });
  } catch (e) {
    const message = cleanTraceback(errorMessage(e));
    try {
      // Cierra las figuras a medio dibujar para que no pasen a la siguiente ejecución.
      if (mplReady) p.runPython(`import matplotlib.pyplot as plt\nplt.close("all")`);
    } catch {
      /* da igual */
    }
    post({
      type: "error",
      id,
      message,
      line: parseErrorLine(message),
      ms: Math.round(performance.now() - t0),
      files: listFiles(p),
    });
  } finally {
    ns?.destroy();
    stdinLines = [];
  }
}

function writeFile(name: string, data: ArrayBuffer): void {
  py?.FS.writeFile(`${WORKDIR}/${name}`, new Uint8Array(data));
}

function readFile(id: number, name: string): void {
  try {
    if (!py || name.includes("/")) throw new Error("no");
    const bytes = py.FS.readFile(`${WORKDIR}/${name}`) as Uint8Array;
    const copy = bytes.slice().buffer;
    post({ type: "fs-data", id, name, data: copy }, [copy]);
  } catch {
    post({ type: "fs-data", id, name, data: null });
  }
}

function clearFiles(): void {
  for (const f of listFiles(py)) {
    try {
      py?.FS.unlink(`${WORKDIR}/${f.name}`);
    } catch {
      /* ya no está */
    }
  }
}

// Al interrumpir con «Detener», el bucle de eventos de Pyodide vuelve a lanzar el KeyboardInterrupt
// fuera de la ejecución (que ya lo ha informado como error). No es un fallo del worker: se descarta.
const isInterrupt = (v: unknown) => /KeyboardInterrupt/.test(v instanceof Error ? v.message : String(v));
self.addEventListener("error", (e) => {
  if (isInterrupt(e.message) || isInterrupt(e.error)) e.preventDefault();
});
self.addEventListener("unhandledrejection", (e) => {
  if (isInterrupt(e.reason)) e.preventDefault();
});

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  // Un mensaje cada vez: una ejecución o un archivo enviados mientras se inicia esperan a que acabe.
  const next = (): Promise<void> | void => {
    switch (msg.type) {
      case "init":
        return init(msg.indexURL, msg.interrupt);
      case "run":
        return run(msg.id, msg.code, msg.stdin);
      case "fs-write":
        return writeFile(msg.name, msg.data);
      case "fs-read":
        return readFile(msg.id, msg.name);
      case "fs-clear":
        return clearFiles();
    }
  };
  queue = queue.then(next).catch(() => {});
};
