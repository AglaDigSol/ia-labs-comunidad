// @vitest-environment jsdom
// Pestaña Python con un cliente falso (sin Pyodide): primera carga, plantillas, salida, órdenes
// mágicas, input(), archivos y borradores de «Abrir en Python».
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryAdapter } from "../../../lib/storage-adapter.ts";
import type { PyEvent, RunOutcome } from "./py-client.ts";

type FakeRun = { code: string; ms: number; stdin: string[]; onEvent: (e: PyEvent) => void; resolve: (o: RunOutcome) => void };

const h = vi.hoisted(() => ({
  clients: [] as Array<{
    opts: { indexURL: string; isolated: boolean };
    load: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    clearFiles: ReturnType<typeof vi.fn>;
    removeFile: ReturnType<typeof vi.fn>;
    uploads: Map<string, ArrayBuffer>;
    resolveLoad: () => void;
    rejectLoad: (e: Error) => void;
    runs: FakeRun[];
  }>,
}));

vi.mock("./py-client.ts", async (orig) => {
  const real = await orig<typeof import("./py-client.ts")>();
  class FakeClient {
    opts: { indexURL: string; isolated: boolean };
    resolveLoad: () => void = () => {};
    rejectLoad: (e: Error) => void = () => {};
    runs: FakeRun[] = [];
    uploads = new Map<string, ArrayBuffer>();
    load = vi.fn(
      (onEvent: (e: PyEvent) => void) =>
        new Promise<void>((res, rej) => {
          this.resolveLoad = () => {
            onEvent({ type: "ready", python: "3.12.7", numpy: "2.0.2" });
            res();
          };
          this.rejectLoad = rej;
        }),
    );
    run = vi.fn(
      (code: string, ms: number, onEvent: (e: PyEvent) => void, stdin: string[] = []) =>
        new Promise<RunOutcome>((resolve) => this.runs.push({ code, ms, stdin, onEvent, resolve })),
    );
    stop = vi.fn(async () => "restarted" as const);
    dispose = vi.fn();
    upload = vi.fn((name: string, data: ArrayBuffer) => this.uploads.set(name, data));
    readFile = vi.fn(async (name: string) => this.uploads.get(name) ?? null);
    clearFiles = vi.fn(() => this.uploads.clear());
    removeFile = vi.fn((name: string) => this.uploads.delete(name));
    uploadedFiles = () => [...this.uploads].map(([name, d]) => ({ name, size: d.byteLength }));
    uploadsSnapshot = () => [...this.uploads];
    constructor(opts: { indexURL: string; isolated: boolean }) {
      this.opts = opts;
      h.clients.push(this);
    }
  }
  return { ...real, PyClient: FakeClient, createPyWorker: vi.fn() };
});

const { PythonLabPage, fmtMB, stdinLines } = await import("./PythonLabPage.tsx");
const { TEMPLATES } = await import("./templates.ts");
const { createDraft, getDraft } = await import("./drafts.ts");
const { configureLabs } = await import("../labs-storage.ts");
const { PYODIDE_CORE, PYODIDE_PACKAGES } = await import("./pyodide-manifest.ts");

const PREFS = "ia-labs.python.v1";
const FIRST = PYODIDE_CORE.reduce((s, f) => s + f.size, 0) + PYODIDE_PACKAGES.find((p) => p.name === "numpy")!.size;

const client = () => h.clients[h.clients.length - 1]!;
const editor = () => screen.getByLabelText("Código Python") as HTMLTextAreaElement;
const runBtn = () => screen.getByRole("button", { name: "Ejecutar código" }) as HTMLButtonElement;
const isPrimary = (el: HTMLElement) => el.className.includes("bg-accent");
const flush = () => act(async () => {});
const prefs = () => JSON.parse(localStorage.getItem(PREFS) ?? "{}") as Record<string, unknown>;

function renderAt(url = "/laboratorios/python") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PythonLabPage />
    </MemoryRouter>,
  );
}

async function renderReady(url?: string) {
  localStorage.setItem(PREFS, JSON.stringify({ loaded: true }));
  renderAt(url);
  await flush();
  await act(async () => client().resolveLoad());
  await screen.findByText("Python listo");
}

async function startRun() {
  fireEvent.click(runBtn());
  await flush();
  return client().runs[client().runs.length - 1]!;
}

const choose = async (trigger: HTMLElement, label: string) => {
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("option", { name: label }), { key: "Enter" });
  await flush();
};

/** fetch que devuelve `bytes` bytes por archivo; con `hold`, el primero no termina hasta liberarlo. */
function stubFetch(opts: { fail?: boolean; hold?: boolean } = {}) {
  let release: () => void = () => {};
  const fn = vi.fn(async (_url: URL, init?: RequestInit) => {
    if (opts.fail) throw new TypeError("Failed to fetch");
    const body = new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(new Uint8Array(1_000_000));
        if (opts.hold) {
          await new Promise<void>((r) => {
            release = r;
            init?.signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
          });
          opts.hold = false;
        }
        c.close();
      },
    });
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, release: () => release() };
}

beforeEach(() => {
  h.clients.length = 0;
  localStorage.clear();
  configureLabs();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  configureLabs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PythonLabPage: primera carga", () => {
  it("sin Python en el dispositivo: panel con los tamaños del manifiesto y «Cargar Python» como único primario", async () => {
    renderAt();
    expect(await screen.findByText("Python aún no está en este dispositivo")).toBeTruthy();
    expect(screen.getByText(new RegExp(`La primera vez se descargan unos ${fmtMB(FIRST)} \\(Python y numpy\\)`))).toBeTruthy();
    expect(screen.getByText(/pandas \([\d,]+ MB\), matplotlib \([\d,]+ MB\) y el resto/)).toBeTruthy();
    expect(screen.getByText("Python sin cargar")).toBeTruthy();
    const load = screen.getByRole("button", { name: "Cargar Python" });
    expect(screen.getAllByRole("button").filter(isPrimary)).toEqual([load]);
    expect(runBtn().disabled).toBe(true);
    expect(document.getElementById(runBtn().getAttribute("aria-describedby")!)!.textContent).toBe("Carga Python primero");
    expect(client().load).not.toHaveBeenCalled();
  });

  it("el cliente usa la carpeta de Pyodide del sitio (o la del anfitrión) y su aislamiento", async () => {
    renderAt();
    expect(client().opts.indexURL).toBe("http://localhost:3000/pyodide/0.27.7/");
    expect(client().opts.isolated).toBe(false);
    cleanup();
    configureLabs({ python: { assetBaseUrl: "/estatico/py/", crossOriginIsolated: false } });
    renderAt();
    expect(client().opts.indexURL).toBe("http://localhost:3000/estatico/py/");
  });

  it("«Cargar Python»: descarga el núcleo y numpy con progreso, prepara y queda listo", async () => {
    const f = stubFetch({ hold: true });
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Cargar Python" }));
    await flush();
    expect(screen.getByText("Descargando Python")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe(`1,0 MB de ${fmtMB(FIRST)}`);
    const urls = f.fn.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe("http://localhost:3000/pyodide/0.27.7/pyodide.asm.js");
    await act(async () => f.release());
    await flush();
    expect(f.fn.mock.calls.map((c) => String(c[0]).split("/").pop())).toEqual([
      ...PYODIDE_CORE.map((x) => x.file),
      PYODIDE_PACKAGES.find((p) => p.name === "numpy")!.file,
    ]);
    expect(screen.getByText("Preparando Python…")).toBeTruthy();
    expect(screen.getByText("Iniciando el intérprete y numpy…")).toBeTruthy();
    await act(async () => client().resolveLoad());
    expect(screen.getByText("Python listo").closest("[title]")!.getAttribute("title")).toBe("Python 3.12.7 · numpy 2.0.2");
    expect(isPrimary(runBtn())).toBe(true);
    expect(prefs().loaded).toBe(true);
  });

  it("«Detener descarga» vuelve al panel", async () => {
    stubFetch({ hold: true });
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Cargar Python" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Detener descarga" }));
    await flush();
    expect(screen.getByText("Python aún no está en este dispositivo")).toBeTruthy();
  });

  it("si la descarga falla: «Error al cargar» y «Reintentar carga»", async () => {
    stubFetch({ fail: true });
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Cargar Python" }));
    await flush();
    expect(screen.getByText("Error al cargar")).toBeTruthy();
    expect(screen.getByText(/No se pudo cargar Python\. Comprueba la conexión/)).toBeTruthy();
    stubFetch();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    await flush();
    expect(h.clients).toHaveLength(2);
  });

  it("con Python ya cargado antes en el dispositivo, empieza sola y sin panel", async () => {
    localStorage.setItem(PREFS, JSON.stringify({ loaded: true }));
    renderAt();
    await flush();
    expect(client().load).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Python aún no está en este dispositivo")).toBeNull();
    expect(screen.getByText("Preparando Python…")).toBeTruthy();
  });

  it("si el worker no arranca: «Error al cargar»", async () => {
    localStorage.setItem(PREFS, JSON.stringify({ loaded: true }));
    renderAt();
    await flush();
    await act(async () => client().rejectLoad(new Error("load_timeout")));
    expect(screen.getByText("Error al cargar")).toBeTruthy();
  });
});

describe("PythonLabPage: plantillas y editor", () => {
  it("elegir una plantilla carga su código; los cambios se guardan por plantilla y se pueden restablecer", async () => {
    await renderReady();
    expect(editor().value).toBe(TEMPLATES[0]!.code);
    await choose(screen.getByRole("combobox", { name: "Plantilla" }), "PerceptronSimple");
    const original = TEMPLATES.find((t) => t.id === "perceptron")!.code;
    expect(editor().value).toBe(original);
    fireEvent.change(editor(), { target: { value: `${original}# mi cambio\n` } });
    expect((prefs().codes as Record<string, string>).perceptron).toBe(`${original}# mi cambio\n`);
    await choose(screen.getByRole("combobox", { name: "Plantilla" }), "Tipos de datos");
    expect(editor().value).toBe(TEMPLATES.find((t) => t.id === "tipos")!.code);
    await choose(screen.getByRole("combobox", { name: "Plantilla" }), "PerceptronSimple");
    expect(editor().value).toBe(`${original}# mi cambio\n`);
    expect(prefs().template).toBe("perceptron");

    fireEvent.click(screen.getByRole("button", { name: "Restablecer plantilla" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Restablecer «PerceptronSimple»: perderás los cambios/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer plantilla" }));
    await flush();
    expect(editor().value).toBe(original);
    expect((prefs().codes as Record<string, string>).perceptron).toBeUndefined();
  });

  it("Ctrl/Cmd+Enter ejecuta; Tab inserta 4 espacios; Esc y después Tab sale del editor", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "x = 1" } });
    editor().setSelectionRange(0, 0);
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(editor().value).toBe("    x = 1");
    fireEvent.keyDown(editor(), { key: "Escape" });
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await flush();
    expect(client().run.mock.calls[0]![0]).toBe("    x = 1");
    expect(client().run.mock.calls[0]![1]).toBe(30_000);
  });

  it("el límite de ejecución se elige y se guarda", async () => {
    await renderReady();
    await choose(screen.getByRole("combobox", { name: "Límite de ejecución" }), "60 s");
    expect(prefs().limit).toBe(60);
    expect((await startRun()).ms).toBe(60_000);
  });

  it("con el almacén del anfitrión (MemoryAdapter) no guarda nada en localStorage", async () => {
    const storage = new MemoryAdapter();
    configureLabs({ storage });
    renderAt();
    await flush();
    fireEvent.change(editor(), { target: { value: "print(1)" } });
    expect(localStorage.length).toBe(0);
    expect(JSON.parse(String(storage.load()?.python)).codes.blank).toBe("print(1)");
  });
});

describe("PythonLabPage: salida", () => {
  it("paquetes con su tamaño, gráficos en canvas con «Descargar PNG», stdout en mono y anuncio final", async () => {
    await renderReady();
    const run = await startRun();
    expect(screen.getByText("Ejecutando… 00:00")).toBeTruthy();
    await act(async () => run.onEvent({ type: "package", name: "pandas", phase: "start" }));
    expect(screen.getByText("Cargando pandas")).toBeTruthy();
    expect(screen.getByText(/^Cargando pandas \([\d,]+ MB\)…$/)).toBeTruthy();
    await act(async () => {
      run.onEvent({ type: "package", name: "pandas", phase: "done" });
      run.onEvent({ type: "stdout", text: "hola\n" });
      run.resolve({ kind: "done", figures: ["iVBORw0KGgo=", "iVBORw0KGgoB"], ms: 1234, files: [] });
    });
    expect(screen.getByText("pandas listo")).toBeTruthy();
    const log = screen.getByRole("log");
    expect(within(log).getByText("hola").className).toContain("mono");
    const imgs = within(log).getAllByRole("img");
    expect(imgs.map((i) => [i.tagName, i.getAttribute("aria-label")])).toEqual([
      ["CANVAS", "Gráfico 1 de la ejecución"],
      ["CANVAS", "Gráfico 2 de la ejecución"],
    ]);
    expect(within(log).getAllByRole("button", { name: "Descargar PNG" })).toHaveLength(2);
    expect(log.innerHTML).not.toContain("data:");
    expect(screen.getByText("Terminado en 1,2 s")).toBeTruthy();
    expect(screen.getByText("Ejecución terminada en 1,2 s").className).toContain("sr-only");
  });

  it("error: «Error en la línea 7», la traza en tono crítico y el aviso de PyTorch encima", async () => {
    await renderReady();
    const run = await startRun();
    const message = "Traceback (most recent call last):\n  File \"<exec>\", line 7, in <module>\nModuleNotFoundError: No module named 'torch'";
    await act(async () => run.resolve({ kind: "error", message, line: 7, ms: 20, files: null }));
    expect(screen.getByText("Error en la línea 7")).toBeTruthy();
    expect(screen.getByText(/No module named 'torch'/).className).toContain("text-crit");
    expect(screen.getByText("PyTorch no funciona en el navegador. Usa Google Colab o un entorno local con Python 3.12")).toBeTruthy();
  });

  it("comillas tipográficas: aviso en español y «Cambiar por comillas rectas» corrige el editor", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "print(“hola”)" } });
    const run = await startRun();
    const message = "  File \"<exec>\", line 1\n    print(“hola”)\n          ^\nSyntaxError: invalid character '“' (U+201C)";
    await act(async () => run.resolve({ kind: "error", message, line: 1, ms: 5, files: null }));
    expect(screen.getByRole("note").textContent).toMatch(/^Tus comillas son tipográficas/);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar por comillas rectas" }));
    expect(editor().value).toBe('print("hola")');
  });

  it("sin internet: el aviso aparece también si el error solo está en la salida (nltk.download)", async () => {
    await renderReady();
    const run = await startRun();
    await act(async () => {
      run.onEvent({ type: "stderr", text: "[nltk_data] Error loading punkt: <urlopen error>\n" });
      run.resolve({ kind: "done", figures: [], ms: 5, files: [] });
    });
    expect(screen.getByText("Este entorno no accede a internet: descarga el archivo y súbelo con «Subir archivo»")).toBeTruthy();
  });

  it("tiempo superado y «Detener» con reinicio", async () => {
    await renderReady();
    let run = await startRun();
    await act(async () => run.resolve({ kind: "timeout", seconds: 30 }));
    expect(
      screen.getByText("La ejecución superó 30 s y se detuvo. Si necesitas más tiempo, cambia el límite en «Límite de ejecución»."),
    ).toBeTruthy();
    run = await startRun();
    fireEvent.click(screen.getByRole("button", { name: "Detener" }));
    expect(client().stop).toHaveBeenCalledTimes(1);
    await act(async () => run.resolve({ kind: "stopped", restarted: true }));
    expect(screen.getByText("Ejecución detenida por ti.")).toBeTruthy();
    expect(screen.getByText("Python se ha reiniciado; las variables anteriores se han perdido.")).toBeTruthy();
  });

  it("muestra el valor de la última expresión como Jupyter: una tabla de pandas en texto o el repr", async () => {
    await renderReady();
    let run = await startRun();
    expect(client().run.mock.calls.at(-1)![4]).toEqual({ display: true });
    const tabla = { tipo: "tabla", serie: false, forma: [2, 1], columnas: ["<b>x</b>"], indice: ["0", "1"], filas: [["1"], ["<img src=x>"]], corteFilas: null, corteCols: null };
    await act(async () => run.resolve({ kind: "done", figures: [], ms: 5, files: [], display: JSON.stringify(tabla) }));
    const log = screen.getByRole("log");
    const table = within(log).getByRole("table");
    expect(within(table).getByText("DataFrame: 2 filas × 1 columna")).toBeTruthy();
    // Texto, nunca HTML.
    expect(within(table).getByText("<b>x</b>")).toBeTruthy();
    expect(within(table).getByText("<img src=x>")).toBeTruthy();
    expect(log.querySelector("img, b")).toBeNull();
    run = await startRun();
    await act(async () => run.resolve({ kind: "done", figures: [], ms: 5, files: [], display: JSON.stringify({ tipo: "texto", texto: "array([1, 2, 3])" }) }));
    expect(within(screen.getByRole("log")).getByLabelText("Valor de la última expresión").textContent).toBe("array([1, 2, 3])");
    // Un valor que no se lee no se muestra.
    run = await startRun();
    await act(async () => run.resolve({ kind: "done", figures: [], ms: 5, files: [], display: "{roto" }));
    expect(within(screen.getByRole("log")).queryByLabelText("Valor de la última expresión")).toBeNull();
  });

  it("los avisos de stderr no van en rojo: la caché de fuentes es un aviso neutro y un FutureWarning, un aviso", async () => {
    await renderReady();
    const run = await startRun();
    await act(async () => {
      run.onEvent({ type: "stderr", text: "Matplotlib is building the font cache; this may take a moment.\n" });
      run.onEvent({ type: "stderr", text: "<exec>:3: FutureWarning: Series.__getitem__ treating keys as positions is deprecated\n" });
      run.resolve({ kind: "done", figures: [], ms: 5, files: [] });
    });
    const log = screen.getByRole("log");
    expect(within(log).getByText("matplotlib está preparando su caché de fuentes: solo pasa la primera vez y tarda unos segundos.").className).toContain("text-muted");
    expect(within(log).queryByText(/building the font cache/)).toBeNull();
    const warn = within(log).getByLabelText("Aviso de Python (no es un error)");
    expect(warn.textContent).toMatch(/FutureWarning/);
    expect(warn.className).not.toContain("text-crit");
  });

  it("«Limpiar salida» vacía la salida", async () => {
    await renderReady();
    const run = await startRun();
    await act(async () => {
      run.onEvent({ type: "stdout", text: "hola\n" });
      run.resolve({ kind: "done", figures: [], ms: 10, files: [] });
    });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar salida" }));
    expect(screen.queryByText("hola")).toBeNull();
    expect(screen.getByText("La salida y los gráficos aparecerán aquí al ejecutar el código.")).toBeTruthy();
  });
});

describe("PythonLabPage: órdenes mágicas e input()", () => {
  it("%time se transforma antes de ejecutar", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "%time x = 1" } });
    await startRun();
    expect(client().run.mock.calls[0]![0]).toBe("_labs_t0 = _labs_clock(); x = 1; _labs_report(_labs_t0)");
  });

  it("una orden no admitida da un error en español y no ejecuta nada", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "import numpy\n%pip install seaborn" } });
    fireEvent.click(runBtn());
    await flush();
    expect(client().run).not.toHaveBeenCalled();
    expect(screen.getByText("Error en la línea 2")).toBeTruthy();
    expect(screen.getByText(/«%pip» no está disponible: no se pueden instalar paquetes/)).toBeTruthy();
  });

  it("las líneas de «Entrada para input()» van con la ejecución y se guardan", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText(/Cada input\(\) lee la siguiente línea/), { target: { value: "Ada\n42\n" } });
    const run = await startRun();
    expect(run.stdin).toEqual(["Ada", "42"]);
    expect(prefs().stdin).toBe("Ada\n42\n");
    expect(stdinLines("")).toEqual([]);
    expect(stdinLines("a\r\n\nb")).toEqual(["a", "", "b"]);
  });
});

describe("PythonLabPage: archivos", () => {
  const pick = async (files: File[]) => {
    const input = screen.getByTestId("py-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: files, configurable: true });
    fireEvent.change(input);
    await flush();
  };

  it("sube CSV a la carpeta de trabajo, los lista, los descarga y los vacía", async () => {
    await renderReady();
    await pick([new File(["x,y\n1,2\n"], "datos.csv", { type: "text/csv" })]);
    expect(client().upload).toHaveBeenCalledWith("datos.csv", expect.any(ArrayBuffer));
    const list = screen.getByRole("list", { name: "Archivos de la carpeta de trabajo" });
    expect(within(list).getByText("datos.csv")).toBeTruthy();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Descargar datos.csv" }));
    await flush();
    expect(client().readFile).toHaveBeenCalledWith("datos.csv");
    // Lo que escribe el código aparece tras la ejecución.
    const run = await startRun();
    await act(async () =>
      run.resolve({ kind: "done", figures: [], ms: 1, files: [{ name: "datos.csv", size: 8 }, { name: "resumen.csv", size: 30 }] }),
    );
    expect(within(screen.getByRole("list", { name: "Archivos de la carpeta de trabajo" })).getByText("resumen.csv")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vaciar archivos" }));
    expect(client().clearFiles).toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "Archivos de la carpeta de trabajo" })).toBeNull();
  });

  it("rechaza tipos no admitidos y archivos de más de 20 MB con un mensaje", async () => {
    await renderReady();
    const big = new File(["x"], "grande.csv");
    Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
    await pick([new File(["MZ"], "programa.exe"), big]);
    expect(client().upload).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("«programa.exe» no es un tipo admitido");
    expect(alert.textContent).toContain("«grande.csv» ocupa 21,0 MB; el máximo por archivo es 20,0 MB.");
  });
});

describe("PythonLabPage: borradores de «Abrir en Python»", () => {
  const CELL_CODE = "import numpy as np\nt = np.ones((2, 3))\nprint(t.shape)";
  const BAND =
    "Borrador de Tensores, celda 12. Las celdas anteriores no se han ejecutado: si este código usa variables de otras celdas, ábrelas también.";
  const NOTICE = "Celda 12 abierta como borrador nuevo. El cuaderno no cambia";
  const cellDraft = () => createDraft({ origin: { kind: "cell", notebookTitle: "Tensores", cell: 12 }, code: CELL_CODE });

  it("?borrador= elige «Celda 12 · Tensores», muestra la banda y el aviso una sola vez", async () => {
    const id = cellDraft();
    renderAt(`/laboratorios/python?borrador=${id}`);
    await flush();
    expect(editor().value).toBe(CELL_CODE);
    expect(screen.getByRole("combobox", { name: "Plantilla" }).textContent).toContain("Celda 12 · Tensores");
    expect(screen.getByText(BAND)).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(getDraft(id)!.fresh).toBe(false);
    cleanup();
    renderAt(`/laboratorios/python?borrador=${id}`);
    await flush();
    expect(screen.getByText(BAND)).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("no ejecuta nada hasta pulsar «Ejecutar código»", async () => {
    const id = cellDraft();
    await renderReady(`/laboratorios/python?borrador=${id}`);
    await flush();
    expect(client().run).not.toHaveBeenCalled();
    fireEvent.click(runBtn());
    await flush();
    expect(client().run.mock.calls[0]![0]).toBe(CELL_CODE);
  });

  it("las ediciones se guardan en el borrador; cambiar a una plantilla y volver lo conserva", async () => {
    const id = cellDraft();
    renderAt(`/laboratorios/python?borrador=${id}`);
    await flush();
    fireEvent.change(editor(), { target: { value: "x = 2" } });
    expect(getDraft(id)!.code).toBe("x = 2");
    expect(prefs().codes).toBeUndefined();
    await choose(screen.getByRole("combobox", { name: "Plantilla" }), "Min-Max");
    expect(editor().value).toBe(TEMPLATES.find((t) => t.id === "minmax")!.code);
    expect(screen.queryByText(BAND)).toBeNull();
    await choose(screen.getByRole("combobox", { name: "Plantilla" }), "Celda 12 · Tensores");
    expect(editor().value).toBe("x = 2");
  });

  it("un ?borrador desconocido muestra la última plantilla sin error", async () => {
    localStorage.setItem(PREFS, JSON.stringify({ template: "minmax" }));
    renderAt("/laboratorios/python?borrador=d_noexiste00");
    await flush();
    expect(editor().value).toBe(TEMPLATES.find((t) => t.id === "minmax")!.code);
    expect(screen.queryByText(/borrador nuevo/)).toBeNull();
  });
});

describe("PythonLabPage: archivos del anfitrión (ranuras y writeFiles)", () => {
  type Ctx = import("./python-config.ts").DraftActionsContext;
  const csv = (text: string) => new TextEncoder().encode(text).buffer;
  /** Ruta y tamaño de lo que recibió el cliente (los bytes son copias). */
  const uploaded = () => client().upload.mock.calls.map((c) => [c[0], (c[1] as ArrayBuffer).byteLength]);
  const repoDraft = () =>
    createDraft({
      origin: { kind: "cell", notebookTitle: "Tensores", cell: 3, source: { kind: "repo", path: "notebooks/tema1.ipynb" } },
      code: "import pandas as pd\nprint(pd.read_csv('res/data.csv').shape)",
    });

  /** Ranura de ejemplo: un botón que escribe dos archivos y enseña lo que devolvió writeFiles. */
  function slot(seen: Ctx[], results: unknown[]) {
    return (ctx: Ctx) => {
      seen.push(ctx);
      return (
        <button
          type="button"
          onClick={() =>
            void ctx.files
              .writeFiles([
                { path: "res/data.csv", data: csv("a,b\n1,2\n") },
                { path: "img/oop/x.png", data: new Uint8Array([137, 80, 78, 71]) },
                { path: "../fuera.txt", data: csv("no") },
              ])
              .then((r) => results.push(r))
          }
        >
          Cargar los archivos del repositorio (res/, img/)
        </button>
      );
    };
  }

  it("la ranura del borrador recibe el borrador (con origin.source) y writeFiles escribe con carpetas", async () => {
    const seen: Ctx[] = [];
    const results: unknown[] = [];
    configureLabs({ python: { renderDraftActions: slot(seen, results) } });
    const id = repoDraft();
    await renderReady(`/laboratorios/python?borrador=${id}`);
    expect(seen.at(-1)!.draft).toMatchObject({ id, origin: { source: { kind: "repo", path: "notebooks/tema1.ipynb" } } });
    expect(seen.at(-1)!.files.limits).toEqual({ maxFileBytes: 20 * 1024 * 1024, maxTotalBytes: 50 * 1024 * 1024, maxFiles: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Cargar los archivos del repositorio (res/, img/)" }));
    await flush();
    expect(results[0]).toEqual({
      written: [
        { name: "res/data.csv", size: 8 },
        { name: "img/oop/x.png", size: 4 },
      ],
      skipped: [{ path: "../fuera.txt", reason: "name", message: "«../fuera.txt» no es una ruta válida dentro de la carpeta de trabajo." }],
    });
    expect(uploaded()).toEqual([
      ["res/data.csv", 8],
      ["img/oop/x.png", 4],
    ]);
    const list = screen.getByRole("list", { name: "Archivos de la carpeta de trabajo" });
    expect(within(list).getByText("res/data.csv")).toBeTruthy();
    expect(within(list).getByText("img/oop/x.png")).toBeTruthy();
    expect(seen.at(-1)!.files.list().map((f) => f.name)).toEqual(["img/oop/x.png", "res/data.csv"]);
    // Nada se ejecuta por escribir archivos.
    expect(client().run).not.toHaveBeenCalled();
  });

  it("sin borrador no hay ranura del borrador; la de «Archivos» sale siempre", async () => {
    const draftSlot = vi.fn(() => <span>ranura del borrador</span>);
    const filesSlot = vi.fn((ctx: import("./python-config.ts").FilesActionsContext) => <span>{ctx.draft ? "con borrador" : "sin borrador"}</span>);
    configureLabs({ python: { renderDraftActions: draftSlot, renderFilesActions: filesSlot } });
    await renderReady();
    expect(draftSlot).not.toHaveBeenCalled();
    expect(screen.queryByText("ranura del borrador")).toBeNull();
    expect(screen.getByText("sin borrador")).toBeTruthy();
  });

  it("las props de PythonLabPage mandan sobre configureLabs; un borrador de archivo también tiene banda", async () => {
    configureLabs({ python: { renderDraftActions: () => <span>de la configuración</span> } });
    const id = createDraft({ origin: { kind: "file", fileName: "utils.py" }, code: "x = 1" });
    render(
      <MemoryRouter initialEntries={[`/laboratorios/python?borrador=${id}`]}>
        <PythonLabPage renderDraftActions={({ draft }) => <span>de la prop: {draft.label}</span>} />
      </MemoryRouter>,
    );
    await flush();
    expect(screen.getByText("de la prop: utils.py")).toBeTruthy();
    expect(screen.queryByText("de la configuración")).toBeNull();
  });

  it("si la ranura falla, la pestaña sigue", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    configureLabs({
      python: {
        renderDraftActions: () => {
          throw new Error("ranura rota");
        },
      },
    });
    await renderReady(`/laboratorios/python?borrador=${repoDraft()}`);
    expect(editor().value).toContain("res/data.csv");
    expect(screen.getByText("Python listo")).toBeTruthy();
    err.mockRestore();
  });

  it("límites del anfitrión: total configurable; lo que no cabe se descarta con su motivo", async () => {
    const seen: Ctx[] = [];
    configureLabs({ python: { maxTotalBytes: 12, maxFiles: 2, renderDraftActions: (ctx) => (seen.push(ctx), null) } });
    await renderReady(`/laboratorios/python?borrador=${repoDraft()}`);
    const files = seen.at(-1)!.files;
    expect(files.limits).toMatchObject({ maxTotalBytes: 12, maxFiles: 2 });
    let r!: Awaited<ReturnType<typeof files.writeFiles>>;
    await act(async () => {
      r = await files.writeFiles([
        { path: "a.txt", data: csv("12345") },
        { path: "b.txt", data: csv("1234567890") },
        { path: "c.txt", data: csv("1") },
        { path: "d.txt", data: csv("1") },
        { path: "e.txt", data: "no es binario" as unknown as ArrayBuffer },
      ]);
    });
    expect(r.written.map((f) => f.name)).toEqual(["a.txt", "c.txt"]);
    expect(r.skipped.map((s) => [s.path, s.reason])).toEqual([
      ["b.txt", "total"],
      ["d.txt", "count"],
      ["e.txt", "name"],
    ]);
  });

  it("descarga con el nombre del archivo, borra uno, sobrevive al reinicio y «Vaciar archivos» los borra", async () => {
    const seen: Ctx[] = [];
    configureLabs({ python: { renderDraftActions: (ctx) => (seen.push(ctx), null) } });
    await renderReady(`/laboratorios/python?borrador=${repoDraft()}`);
    await act(async () => {
      await seen.at(-1)!.files.writeFiles([
        { path: "res/data.csv", data: csv("a\n1\n") },
        { path: "res/one_line.txt", data: csv("hola") },
      ]);
    });
    const created: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        created.push(el as HTMLAnchorElement);
        (el as HTMLAnchorElement).click = () => {};
      }
      return el;
    });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Descargar res/data.csv" }));
    await flush();
    expect(client().readFile).toHaveBeenCalledWith("res/data.csv");
    expect(created.at(-1)!.download).toBe("data.csv");
    spy.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Borrar res/one_line.txt" }));
    expect(client().removeFile).toHaveBeenCalledWith("res/one_line.txt");
    expect(screen.queryByText("res/one_line.txt")).toBeNull();
    // Tiempo superado: el worker se reinicia y la lista vuelve a los archivos guardados.
    const run = await startRun();
    await act(async () => run.resolve({ kind: "timeout", seconds: 30 }));
    expect(within(screen.getByRole("list", { name: "Archivos de la carpeta de trabajo" })).getByText("res/data.csv")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vaciar archivos" }));
    expect(client().clearFiles).toHaveBeenCalled();
    expect(seen.at(-1)!.files.list()).toEqual([]);
  });

  it("«Reintentar carga» pasa los archivos del anfitrión al cliente nuevo", async () => {
    const seen: Ctx[] = [];
    configureLabs({ python: { renderDraftActions: (ctx) => (seen.push(ctx), null) } });
    stubFetch({ fail: true });
    renderAt(`/laboratorios/python?borrador=${repoDraft()}`);
    await flush();
    await act(async () => {
      await seen.at(-1)!.files.writeFiles([{ path: "res/data.csv", data: csv("a\n1\n") }]);
    });
    fireEvent.click(screen.getByRole("button", { name: "Cargar Python" }));
    await flush();
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar carga" }));
    await flush();
    expect(h.clients).toHaveLength(2);
    expect(uploaded()).toEqual([["res/data.csv", 4]]);
  });

  it("no guarda los archivos en ningún almacenamiento del navegador", async () => {
    const idb = { open: vi.fn() };
    const cacheStorage = { open: vi.fn(), put: vi.fn() };
    vi.stubGlobal("indexedDB", idb);
    vi.stubGlobal("caches", cacheStorage);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const seen: Ctx[] = [];
    configureLabs({ python: { renderDraftActions: (ctx) => (seen.push(ctx), null) } });
    await renderReady(`/laboratorios/python?borrador=${repoDraft()}`);
    await act(async () => {
      await seen.at(-1)!.files.writeFiles([{ path: "res/data.csv", data: csv("SECRETO,1\n") }]);
    });
    expect(idb.open).not.toHaveBeenCalled();
    expect(cacheStorage.open).not.toHaveBeenCalled();
    for (const [, value] of setItem.mock.calls) expect(String(value)).not.toContain("SECRETO");
    for (let i = 0; i < localStorage.length; i++) expect(localStorage.getItem(localStorage.key(i)!)).not.toContain("SECRETO");
    setItem.mockRestore();
  });
});

describe("PythonLabPage: paso a paso", () => {
  const trace = {
    pasos: [
      { linea: 1, evento: "line", marcos: [{ nombre: "<module>", linea: 1, variables: [] }], salida: 0 },
      { linea: 1, evento: "fin", marcos: [{ nombre: "<module>", linea: 1, variables: [{ nombre: "x", valor: "1" }] }], salida: 0 },
    ],
    salida: "",
    limite: null,
    error: null,
    sintaxis: null,
  };

  it("«Ejecutar paso a paso» traza el código del editor y lo muestra hasta que el código cambia", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "x = 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar paso a paso" }));
    await flush();
    const run = client().runs.at(-1)!;
    expect(run.code).toContain("def __labs_trace(p):");
    expect(run.code).toContain(JSON.stringify(JSON.stringify({ codigo: "x = 1" }).slice(1, -1)).slice(1, -1));
    expect(client().run.mock.calls.at(-1)![4]).toEqual({ capture: true, imports: "x = 1" });
    expect(runBtn().disabled).toBe(true);
    await act(async () => run.resolve({ kind: "done", figures: [], ms: 5, files: [], value: JSON.stringify(trace) }));
    expect(await screen.findByRole("heading", { name: "Paso a paso" })).toBeTruthy();
    expect(screen.getByTestId("trace-step").textContent).toBe("Paso 1 de 2: se va a ejecutar la línea 1.");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(screen.getByText("x")).toBeTruthy();
    fireEvent.change(editor(), { target: { value: "x = 2" } });
    expect(screen.queryByRole("heading", { name: "Paso a paso" })).toBeNull();
  });

  it("el paso a paso se lleva a la vista con el foco en su título, y al cerrarlo el foco vuelve al botón", async () => {
    const scrolled: Array<[Element, unknown]> = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, arg?: unknown) {
      scrolled.push([this, arg]);
    };
    // Por debajo de la pantalla, como en el iPad en horizontal.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 1275, bottom: 1600, left: 0, right: 900, width: 900, height: 325, x: 0, y: 1275, toJSON() {} } as DOMRect);
    try {
      await renderReady();
      fireEvent.change(editor(), { target: { value: "x = 1" } });
      fireEvent.click(screen.getByRole("button", { name: "Ejecutar paso a paso" }));
      await flush();
      await act(async () => client().runs.at(-1)!.resolve({ kind: "done", figures: [], ms: 5, files: [], value: JSON.stringify(trace) }));
      const title = await screen.findByRole("heading", { name: "Paso a paso" });
      expect(document.activeElement).toBe(title);
      expect(scrolled.some(([el]) => el.hasAttribute("data-trace-panel"))).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Cerrar el paso a paso" }));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ejecutar paso a paso" }));
    } finally {
      rect.mockRestore();
      Element.prototype.scrollIntoView = original;
    }
  });

  it("no traza código con órdenes mágicas y avisa", async () => {
    await renderReady();
    const before = client().runs.length;
    fireEvent.change(editor(), { target: { value: "%time x = 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar paso a paso" }));
    await flush();
    expect(client().runs.length).toBe(before);
    expect(screen.getByRole("alert").textContent).toMatch(/no admite órdenes mágicas/);
  });

  it("si la traza supera el tiempo, lo dice", async () => {
    await renderReady();
    fireEvent.change(editor(), { target: { value: "while True: pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar paso a paso" }));
    await flush();
    await act(async () => client().runs.at(-1)!.resolve({ kind: "timeout", seconds: 20 }));
    expect(screen.getByRole("alert").textContent).toMatch(/superó 20 s/);
  });
});
