// @vitest-environment jsdom
// El simulacro de 01MIAR en la página, con Testing Library. Sin Python: la entrada en la pestaña Python
// y en «Ejercicios» (solo con el módulo), la pantalla de inicio (nada se ejecuta, la semilla en la URL,
// .ipynb en blanco), empezar, guardar el código, recargar y seguir con el reloj, la entrega con su
// aviso y la entrega automática al acabarse el tiempo. Con un worker falso que mantiene vivo un
// python3 del sistema entre ejecuciones (como Pyodide en el worker): ejecutar una celda, la tabla de
// pandas como tabla, el kernel compartido y su reinicio, «Ejecutar todo» que para en el primer error,
// entregar y ver la nota, las comprobaciones ocultas que fallan y la solución detrás de la puerta.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedToText } from "../shared/exercises/random.ts";
import { buildPyExam, parsePyExamStore, pyExamParts, startPyExamAttempt, serializePyExamStore, type PyExamStore } from "../shared/pyexam/index.ts";
import { configureLabs } from "../src/features/labs/labs-storage.ts";
import { LabsRoutes } from "../src/features/labs/labs.tsx";
import { disposeRuntime, setExerciseWorkerFactory } from "../src/features/labs/exercises/python/runtime.ts";
import type { WorkerIn, WorkerOut } from "../src/features/labs/python/py-client.ts";
import { MemoryAdapter } from "../src/lib/storage-adapter.ts";
import { hasPlots } from "./system-python.ts";

// Un python3 que vive mientras vive el worker: cada programa se ejecuta en un espacio de nombres nuevo
// (como hace el worker de Pyodide), pero los módulos —y con ellos el kernel del cuaderno— se conservan.
const SERVER = String.raw`
import ast, base64, contextlib, io, json, os, sys, traceback
os.environ["MPLBACKEND"] = "Agg"
real = sys.stdout
for line in sys.stdin:
    m = json.loads(line)
    if m["type"] == "write":
        os.makedirs(os.path.dirname(m["path"]) or ".", exist_ok=True)
        with open(m["path"], "wb") as f:
            f.write(base64.b64decode(m["data"]))
        continue
    if m["type"] == "delete":
        try:
            os.remove(m["path"])
        except OSError:
            pass
        continue
    buf = io.StringIO()
    out = {"id": m["id"]}
    try:
        with contextlib.redirect_stdout(buf):
            tree = ast.parse(m["code"])
            last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
            ns = {"__name__": "__main__"}
            exec(compile(tree, "<exec>", "exec"), ns)
            v = eval(compile(ast.Expression(last.value), "<exec>", "eval"), ns) if last is not None else None
        figs = []
        if "matplotlib.pyplot" in sys.modules:
            import matplotlib.pyplot as plt
            for n in plt.get_fignums():
                b = io.BytesIO()
                plt.figure(n).savefig(b, format="png", dpi=30)
                figs.append(base64.b64encode(b.getvalue()).decode())
            plt.close("all")
        out.update(ok=True, value=v if isinstance(v, str) else None, figures=figs, stdout=buf.getvalue())
    except BaseException:
        out.update(ok=False, message=traceback.format_exc(), stdout=buf.getvalue())
    real.write(json.dumps(out) + "\n")
    real.flush()
`;

class LivePythonWorker {
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  static all: LivePythonWorker[] = [];
  runs: string[] = [];
  private proc: ChildProcessWithoutNullStreams;
  private dir: string;
  private buffer = "";
  constructor() {
    LivePythonWorker.all.push(this);
    this.dir = mkdtempSync(join(tmpdir(), "labs-pyexam-"));
    this.proc = spawn("python3", ["-I", "-u", "-c", SERVER], { cwd: this.dir, env: { ...process.env, MPLBACKEND: "Agg" } });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      let i: number;
      while ((i = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 1);
        const r = JSON.parse(line) as { id: number; ok: boolean; value?: string | null; figures?: string[]; stdout: string; message?: string };
        if (r.stdout) this.emit({ type: "stdout", text: r.stdout });
        if (r.ok) this.emit({ type: "done", id: r.id, figures: r.figures ?? [], ms: 1, files: [], ...(r.value ? { value: r.value } : {}) });
        else this.emit({ type: "error", id: r.id, message: r.message ?? "", line: null, ms: 1 });
      }
    });
  }
  private emit(data: WorkerOut) {
    setTimeout(() => this.onmessage?.({ data } as MessageEvent<WorkerOut>), 0);
  }
  private send(m: unknown) {
    this.proc.stdin.write(`${JSON.stringify(m)}\n`);
  }
  postMessage(m: WorkerIn) {
    switch (m.type) {
      case "init":
        return this.emit({ type: "ready", python: "3.12.7" });
      case "fs-write":
        return this.send({ type: "write", path: m.path, data: Buffer.from(new Uint8Array(m.data)).toString("base64") });
      case "fs-delete":
        return this.send({ type: "delete", path: m.path });
      case "run":
        this.runs.push(m.code);
        return this.send({ type: "run", id: m.id, code: m.code });
      default:
        return;
    }
  }
  terminate() {
    this.proc.kill();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Un worker que arranca pero en el que todo falla (para las pruebas sin Python). */
class FailingWorker {
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  static runs = 0;
  postMessage(m: WorkerIn) {
    const emit = (data: WorkerOut) => setTimeout(() => this.onmessage?.({ data } as MessageEvent<WorkerOut>), 0);
    if (m.type === "init") emit({ type: "ready", python: "3.12.7" });
    if (m.type === "run") {
      FailingWorker.runs++;
      emit({ type: "error", id: m.id, message: "ModuleNotFoundError: No module named 'pandas'", line: null, ms: 1 });
    }
  }
  terminate() {}
}

let storage: MemoryAdapter;
beforeEach(() => {
  storage = new MemoryAdapter();
  configureLabs({ storage });
  LivePythonWorker.all = [];
  FailingWorker.runs = 0;
  setExerciseWorkerFactory(() => new FailingWorker() as unknown as Worker);
});
afterEach(() => {
  cleanup();
  disposeRuntime();
  setExerciseWorkerFactory(null);
  configureLabs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function Where() {
  const l = useLocation();
  return <span data-testid="url">{`${l.pathname}${l.search}`}</span>;
}

function renderAt(url: string, python = true) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/laboratorios/*"
          element={
            <>
              <LabsRoutes python={python} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const startHeading = () => screen.findByRole("heading", { level: 1, name: "Simulacro de examen (01MIAR)" }, { timeout: 5000 });
const saved = (): PyExamStore => parsePyExamStore(storage.load()!.pyexam as string)!;
const seedStore = (s: PyExamStore) => storage.save({ pyexam: serializePyExamStore(s) });

describe("simulacro de 01MIAR: entrada y pantalla de inicio", () => {
  it("con el módulo Python: botón en la pestaña Python y tarjeta en «Ejercicios»; sin él, ni ruta", async () => {
    const { unmount } = renderAt("/laboratorios/python");
    const link = await screen.findByRole("link", { name: "Simulacro de examen (01MIAR)" }, { timeout: 5000 });
    expect(link.getAttribute("href")).toBe("/laboratorios/python/simulacro");
    unmount();
    const r2 = renderAt("/laboratorios/ejercicios");
    const card = await screen.findByRole("link", { name: "Abrir el simulacro de 01MIAR" }, { timeout: 5000 });
    expect(card.getAttribute("href")).toBe("/laboratorios/python/simulacro");
    r2.unmount();
    const r3 = renderAt("/laboratorios/ejercicios", false);
    await screen.findByRole("heading", { level: 1, name: "Banco de ejercicios" }, { timeout: 5000 });
    expect(screen.queryByRole("link", { name: "Abrir el simulacro de 01MIAR" })).toBeNull();
    r3.unmount();
    renderAt("/laboratorios/python/simulacro", false);
    expect(await screen.findByRole("heading", { level: 1, name: "Página no encontrada" })).toBeTruthy();
    expect(screen.getByTestId("url").textContent).toBe("/laboratorios/python/simulacro");
  });

  it("inicio: aviso de integridad, la semilla en la URL, qué entra y el .ipynb en blanco; no se ejecuta nada", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => (blobs.push(b), "blob:x")), revokeObjectURL: vi.fn() }));
    renderAt(`/laboratorios/python/simulacro?s=${seedToText(2)}`);
    await startHeading();
    expect(screen.getByRole("note").textContent).toBe("Es un simulacro para practicar; no es el examen oficial ni lo sustituye.");
    expect(screen.getByTestId("url").textContent).toBe(`/laboratorios/python/simulacro?s=${seedToText(2)}`);
    const exam = buildPyExam(2);
    for (const s of exam.shorts) expect(screen.getByText(new RegExp(`^${s.title.replace(/[()]/g, ".")} \\(1,25 puntos\\)$`))).toBeTruthy();
    expect(screen.getByText(/^Proyecto de datos: Ventas de una cafetería, en 10 pasos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descargar como .ipynb" }));
    expect(blobs).toHaveLength(1);
    const nb = JSON.parse(await blobs[0]!.text());
    expect([nb.nbformat, nb.nbformat_minor]).toEqual([4, 5]);
    expect(nb.metadata.kernelspec.name).toBe("python3");
    fireEvent.click(screen.getByRole("button", { name: "Descargar los datos (.csv)" }));
    expect(blobs.length).toBe(1 + Object.keys(exam.project.files).length + exam.shorts.filter((s) => Object.keys(s.files).length > 0).length);
    expect(FailingWorker.runs).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Otro simulacro" }));
    await waitFor(() => expect(screen.getByTestId("url").textContent).not.toBe(`/laboratorios/python/simulacro?s=${seedToText(2)}`));
  });

  it("empezar, escribir, recargar y seguir: el código se guarda y el reloj no se para", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-05T10:00:00Z") });
    const { unmount } = renderAt(`/laboratorios/python/simulacro?s=${seedToText(5)}`);
    await startHeading();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    expect(await screen.findByRole("timer", { name: "Tiempo restante" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("2:00:00");
    const exam = buildPyExam(5);
    const editor = screen.getByRole("textbox", { name: "Tu solución AQUÍ · Ejercicio 1" });
    fireEvent.change(editor, { target: { value: "def hola():\n    return 1\n" } });
    expect(saved().active!.code![0]).toBe("def hola():\n    return 1\n");
    expect(saved().active!.code!.slice(1).every((c) => c === null)).toBe(true);
    expect(screen.getByRole("button", { name: "Ejercicio 1: con código" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paso A: sin empezar" })).toBeTruthy();
    // Las celdas: una de solución, una de import y un «Test Use Case» por parte.
    expect(screen.getAllByRole("button", { name: /^Ejecutar celda: Test Use Case/ })).toHaveLength(pyExamParts(exam));
    expect(FailingWorker.runs).toBe(0);
    unmount();
    vi.setSystemTime(new Date("2026-11-05T10:30:00Z"));
    renderAt("/laboratorios/python/simulacro");
    expect(await screen.findByRole("timer", { name: "Tiempo restante" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("1:30:00");
    expect((screen.getByRole("textbox", { name: "Tu solución AQUÍ · Ejercicio 1" }) as HTMLTextAreaElement).value).toBe("def hola():\n    return 1\n");
  });

  it("en el móvil: «Empezar» sube el cuaderno a la vista y el navegador deja cada parte debajo de la cabecera fija", async () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    try {
      renderAt(`/laboratorios/python/simulacro?s=${seedToText(7)}`);
      await startHeading();
      fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
      const timer = await screen.findByRole("timer");
      const bar = timer.closest("div.sticky")!;
      // Debajo de la cabecera de la app y de las pestañas de los laboratorios, no tapada por ellas.
      expect(bar.className).toContain("top-[calc(3rem+2.75rem+1px)]");
      expect(scrolled).toHaveLength(1);
      expect(scrolled[0]!.contains(bar)).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Paso A: sin empezar" }));
      expect(scrolled).toHaveLength(2);
      const step = scrolled[1] as HTMLElement;
      expect(document.activeElement).toBe(step);
      expect(step.className).toMatch(/scroll-mt-\[calc\(3rem\+2\.75rem\+1px\+var\(--exam-sticky/);
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it("«Entregar» pide confirmación y lista las celdas sin empezar", async () => {
    renderAt(`/laboratorios/python/simulacro?s=${seedToText(7)}`);
    await startHeading();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    await screen.findByRole("timer");
    fireEvent.click(screen.getAllByRole("button", { name: "Entregar" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "¿Entregar el simulacro?" });
    const exam = buildPyExam(7);
    expect(within(within(dialog).getByRole("list", { name: "Celdas sin empezar" })).getAllByRole("button")).toHaveLength(pyExamParts(exam));
    fireEvent.click(within(dialog).getByRole("button", { name: "Seguir con el examen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(saved().active).not.toBeNull();
  });

  it("a 0 se entrega solo; sin Python no se puede corregir y queda «sin corregir» en el historial", async () => {
    const exam = buildPyExam(9);
    const old = startPyExamAttempt(9, pyExamParts(exam), Date.now() - 2 * 3600_000 - 5000);
    old.code![0] = "x = 1\n";
    seedStore({ active: old, history: [] });
    renderAt("/laboratorios/python/simulacro");
    expect(await screen.findByText("Se ha acabado el tiempo: el simulacro se ha entregado solo.", undefined, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText(/^No se ha podido corregir/, undefined, { timeout: 5000 })).toBeTruthy();
    const s = saved();
    expect(s.active).toBeNull();
    expect(s.history[0]!.auto).toBe(true);
    expect(s.history[0]!.finishedAt).toBe(old.startedAt + 2 * 3600_000);
    expect(s.history[0]!.result).toBeNull();
    expect(s.history[0]!.code![0]).toBe("x = 1\n");
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    expect(await screen.findByText("Sin corregir")).toBeTruthy();
  });
});

/** Pulsa «Ejecutar celda» de una celda y espera a que el kernel quede libre. */
async function runCell(label: string) {
  fireEvent.click(screen.getByRole("button", { name: `Ejecutar celda: ${label}` }));
  await idle();
}

const idle = () => waitFor(() => expect((screen.getByRole("button", { name: "Ejecutar todo" }) as HTMLButtonElement).disabled).toBe(false), { timeout: 120_000 });

describe.skipIf(!hasPlots)("simulacro de 01MIAR con un python3 vivo", () => {
  beforeEach(() => setExerciseWorkerFactory(() => new LivePythonWorker() as unknown as Worker));

  it("celdas en un kernel compartido, reinicio, «Ejecutar todo», entrega y resultados", async () => {
    const exam = buildPyExam(2);
    const n = exam.shorts.length;
    renderAt(`/laboratorios/python/simulacro?s=${seedToText(2)}`);
    await startHeading();
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    await screen.findByRole("timer");

    // El corto 1, resuelto con su solución: la celda y su «Test Use Case».
    const first = exam.shorts[0]!;
    fireEvent.change(screen.getByRole("textbox", { name: "Tu solución AQUÍ · Ejercicio 1" }), { target: { value: first.check.solution } });
    await runCell("Tu solución AQUÍ · Ejercicio 1");
    expect(screen.getByLabelText("Ejecutada en el turno 1")).toBeTruthy();
    await runCell("Test Use Case · Ejercicio 1 (solo lectura)");
    expect(screen.getByText("Los assert de la vista se cumplen.")).toBeTruthy();
    expect(screen.getByLabelText("Ejecutada en el turno 2")).toBeTruthy();

    // Reiniciar el kernel borra la función: el test ya no la encuentra.
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar kernel" }));
    await runCell("Test Use Case · Ejercicio 1 (solo lectura)");
    expect(screen.getByText(/NameError: name '\w+' is not defined/)).toBeTruthy();
    expect(screen.getByLabelText("Ejecutada en el turno 1")).toBeTruthy();

    // Proyecto: los import y el paso A con df.head() al final: una tabla de verdad (nunca HTML).
    await runCell("Celda de los import (solo lectura)");
    const a = screen.getByRole("textbox", { name: "Tu solución AQUÍ · Paso A" });
    fireEvent.change(a, { target: { value: `${exam.project.steps[0]!.solution}df.head()\n` } });
    await runCell("Tu solución AQUÍ · Paso A");
    const table = screen.getByRole("table", { name: "DataFrame: 5 filas × 8 columnas" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "ticket", "articulo", "cantidad", "precio", "total", "pago", "local", "fecha"]);
    expect(within(table).getAllByRole("row")).toHaveLength(6);

    // «Ejecutar todo»: en orden, y para en el primer error (el corto 2 sigue sin hacer).
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar todo" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/«Ejecutar todo» se ha parado en un error: Ejercicio 2\./), { timeout: 40_000 });
    await idle();

    // Entregar: se corrige y sale la nota (el corto 1 entero y el paso A).
    fireEvent.click(screen.getAllByRole("button", { name: "Entregar" })[0]!);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Entregar ahora" }));
    const score = await screen.findByLabelText(/^Nota: .* sobre 10$/, undefined, { timeout: 120_000 });
    const expected = 1.25 + exam.project.steps[0]!.points;
    expect(score.getAttribute("aria-label")).toBe(`Nota: ${String(expected).replace(".", ",")} sobre 10`);
    expect(saved().history[0]!.result!.score).toBe(expected);
    // Las comprobaciones ocultas de un paso sin hacer: «no cumplida», sin valores esperados.
    const listB = screen.getByRole("list", { name: `Comprobaciones ocultas: Paso B. ${exam.project.steps[1]!.title}` });
    expect(within(listB).getAllByText(/: no cumplida$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sin contestar: la celda sigue como al principio.").length).toBe(pyExamParts(exam) - 2);
    // En las celdas sin contestar no se listan los requisitos («Requisito: … no cumplida» no aporta nada).
    expect(exam.shorts.slice(1).some((s) => (s.check.rules ?? []).length > 0)).toBe(true);
    exam.shorts.slice(1).forEach((s, k) => {
      const list = screen.getByRole("list", { name: `Comprobaciones ocultas: Ejercicio ${k + 2}. ${s.title}` });
      expect(list.textContent).not.toMatch(/Requisito:/);
      expect(list.textContent).toMatch(/Prueba oculta 1: no cumplida/);
    });
    // La solución, detrás de la puerta; «Practicar este tipo» va al banco de ejercicios.
    expect(screen.queryByTestId("solution")).toBeNull();
    const practice = screen.getByRole("link", { name: "Practicar este tipo: Paso D" });
    expect(practice.getAttribute("href")).toBe(`/laboratorios/ejercicios?t=py-pandas-limpiar&n=avanzado&s=${seedToText(2)}`);
    expect(screen.getAllByRole("button", { name: "Ver la solución completa" })).toHaveLength(pyExamParts(exam));
    expect(n).toBe(4);
  }, 300_000);
});
