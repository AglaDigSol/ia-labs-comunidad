// @vitest-environment jsdom
// Ejercicios de Python en «Ejercicios», con un worker falso que ejecuta de verdad cada programa con el
// python3 del sistema (el protocolo es el del worker de Pyodide: init, fs-write, fs-clear y run con
// capture). Tema oculto sin el módulo, ejercicio resuelto y fallado, archivos del tema 5, pistas,
// solución detrás de la puerta y «¿Qué imprime?» con el paso a paso.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PY_CODE_TYPES, PY_OUTPUT, PYTHON_EXERCISES, type PyCodeInstance } from "../shared/exercises/python.ts";
import { LEVEL_SLUGS, type ExerciseLevel } from "../shared/exercises/types.ts";
import { seedToText } from "../shared/exercises/random.ts";
import { MemoryAdapter } from "../src/lib/storage-adapter.ts";
import { configureLabs } from "../src/features/labs/labs-storage.ts";
import { LabsRoutes } from "../src/features/labs/labs.tsx";
import { disposeRuntime, setExerciseWorkerFactory } from "../src/features/labs/exercises/python/runtime.ts";
import { HARNESS_PY } from "../src/features/labs/exercises/python/harness.ts";
import type { WorkerIn, WorkerOut } from "../src/features/labs/python/py-client.ts";
import { hasPython3, runJobs } from "./system-python.ts";

// Ejecuta el programa y devuelve el valor de su última expresión si es un str (como capture).
const RUNNER = `
import ast, json, sys
src = open(sys.argv[1], encoding="utf-8").read()
tree = ast.parse(src)
last = tree.body.pop()
ns = {"__name__": "__main__"}
exec(compile(tree, "<exec>", "exec"), ns)
v = eval(compile(ast.Expression(last.value), "<exec>", "eval"), ns)
sys.stdout.write(json.dumps(v if isinstance(v, str) else None))
`;

class Python3Worker {
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  files = new Map<string, ArrayBuffer>();
  posted: WorkerIn[] = [];
  static all: Python3Worker[] = [];
  constructor() {
    Python3Worker.all.push(this);
  }
  private emit(data: WorkerOut) {
    setTimeout(() => this.onmessage?.({ data } as MessageEvent<WorkerOut>), 0);
  }
  postMessage(m: WorkerIn) {
    this.posted.push(m);
    switch (m.type) {
      case "init":
        return this.emit({ type: "ready", python: "3.12.7" });
      case "fs-write":
        this.files.set(m.path, m.data);
        return;
      case "fs-clear":
        this.files.clear();
        return;
      case "run": {
        const dir = mkdtempSync(join(tmpdir(), "labs-ui-"));
        try {
          for (const [path, data] of this.files) {
            mkdirSync(dirname(join(dir, path)), { recursive: true });
            writeFileSync(join(dir, path), new Uint8Array(data));
          }
          writeFileSync(join(dir, "programa.py"), m.code);
          writeFileSync(join(dir, "runner.py"), RUNNER);
          const r = spawnSync("python3", ["-I", "runner.py", "programa.py"], { cwd: dir, encoding: "utf8", timeout: 60_000 });
          if (r.status !== 0) return this.emit({ type: "error", id: m.id, message: r.stderr, line: null, ms: 1 });
          const value = JSON.parse(r.stdout) as string | null;
          return this.emit({ type: "done", id: m.id, figures: [], ms: 1, files: [], ...(value === null ? {} : { value }) });
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
      default:
        return;
    }
  }
  terminate() {}
}

let storage: MemoryAdapter;
beforeEach(() => {
  storage = new MemoryAdapter();
  configureLabs({ storage });
  Python3Worker.all = [];
  setExerciseWorkerFactory(() => new Python3Worker() as unknown as Worker);
});
afterEach(() => {
  cleanup();
  disposeRuntime();
  setExerciseWorkerFactory(null);
  configureLabs();
  localStorage.clear();
});

function renderAt(url: string, python = true) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/laboratorios/*" element={<LabsRoutes python={python} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const page = () => screen.findByRole("heading", { level: 1, name: "Banco de ejercicios" }, { timeout: 5000 });
const urlOf = (id: string, level: ExerciseLevel, seed: number) => `/laboratorios/ejercicios?t=${id}&n=${LEVEL_SLUGS[level]}&s=${seedToText(seed)}`;
const typeOf = (id: string) => PY_CODE_TYPES.find((t) => t.id === id)!;

async function openCode(id: string, level: ExerciseLevel, seed: number): Promise<PyCodeInstance> {
  renderAt(urlOf(id, level, seed));
  await page();
  await screen.findByLabelText("Tu código", undefined, { timeout: 5000 });
  return typeOf(id).generate(seed, level);
}

async function submit(code: string) {
  fireEvent.change(screen.getByLabelText("Tu código"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
}

describe("tema Python en «Ejercicios»", () => {
  it("sin el módulo no aparece; con él, sus nueve tipos y sin cargar Python", async () => {
    const { unmount } = renderAt("/laboratorios/ejercicios", false);
    await page();
    expect(screen.queryByRole("heading", { level: 2, name: "Python (01MIAR)" })).toBeNull();
    unmount();
    renderAt("/laboratorios/ejercicios");
    await page();
    const block = screen.getByRole("heading", { level: 2, name: "Python (01MIAR)" }).closest("section")!;
    expect(within(block).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(PYTHON_EXERCISES.map((t) => t.title));
    expect(Python3Worker.all).toHaveLength(0);
  });

  it("un id de Python en la URL sin el módulo vuelve a la lista", async () => {
    renderAt(urlOf("py-tipos", "básico", 1), false);
    await page();
    expect(screen.queryByLabelText("Tu código")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Practicar/ }).length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasPython3)("ejercicio de código con python3", () => {
  it("la solución correcta: todos los casos correctos, cuenta como resuelto y no carga Python sin pedirlo", async () => {
    const inst = await openCode("py-tipos", "medio", 11);
    expect(Python3Worker.all).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 3, name: inst.title })).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
    expect(screen.queryByText(inst.solution.split("\n")[1]!.trim())).toBeNull();
    await submit(inst.solution);
    expect(await screen.findByText("¡Correcto! Tu código pasa todas las pruebas.", undefined, { timeout: 30_000 })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Resultados de las pruebas" });
    expect(within(list).getAllByText(/^Caso \d+: correcto$/)).toHaveLength(inst.cases.length);
    expect(screen.getByText("¡Resuelto! Cuenta en tu progreso.")).toBeTruthy();
  }, 60_000);

  it("una solución equivocada: casos incorrectos con «Tu resultado», sin el valor esperado", async () => {
    const inst = await openCode("py-cadenas", "básico", 3);
    // Devuelve siempre lo mismo: falla en (casi) todos.
    await submit(`def ${inst.fn}(*args):\n    return 'xyz'\n`);
    const list = await screen.findByRole("list", { name: "Resultados de las pruebas" }, { timeout: 30_000 });
    expect(within(list).getAllByText(/^Caso \d+: incorrecto$/).length).toBeGreaterThan(0);
    expect(within(list).getAllByText(/^Tu resultado: 'xyz'/).length).toBeGreaterThan(0);
    expect(screen.queryByText("¡Correcto! Tu código pasa todas las pruebas.")).toBeNull();
    // Las llamadas se muestran; lo esperado no.
    expect(within(list).getByText(inst.cases[0]!.code)).toBeTruthy();
    expect(list.textContent).not.toMatch(/esperad/i);
  }, 60_000);

  it("errores: la línea de tu código y la función que falta", async () => {
    const inst = await openCode("py-control", "básico", 5);
    await submit(`def ${inst.fn}(*args):\n    x = 1\n    return x / 0\n`);
    expect((await screen.findAllByText(/Tu código lanzó ZeroDivisionError: division by zero \(línea 3 de tu código\)\./, undefined, { timeout: 30_000 })).length).toBeGreaterThan(0);
    await submit("def otra():\n    pass\n");
    expect(await screen.findByText(/No encuentro la función/, undefined, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getAllByText("Falta la función.").length).toBeGreaterThan(0);
    await submit("def x(:\n");
    expect(await screen.findByText(/error de sintaxis en la línea 1/, undefined, { timeout: 30_000 })).toBeTruthy();
  }, 90_000);

  it("ficheros: escribe los archivos de cada caso con la API de archivos y los borra al terminar", async () => {
    // Una semilla cuyo ejercicio tenga archivos de entrada.
    const seed = [...Array(50).keys()].find((s) => Object.keys(typeOf("py-ficheros").generate(s, "básico").cases[0]!.files ?? {}).length > 0)!;
    const inst = await openCode("py-ficheros", "básico", seed);
    await submit(inst.solution);
    expect(await screen.findByText("¡Correcto! Tu código pasa todas las pruebas.", undefined, { timeout: 30_000 })).toBeTruthy();
    const w = Python3Worker.all[0]!;
    const writes = w.posted.filter((m) => m.type === "fs-write").map((m) => (m.type === "fs-write" ? m.path : ""));
    expect(writes.length).toBeGreaterThan(0);
    for (const p of writes) expect(p).toMatch(/^ejercicio\/caso\d+\/[\w.]+$/);
    expect(w.posted.at(-1)!.type).toBe("fs-clear");
    expect(w.files.size).toBe(0);
    // El contenido de los archivos del caso se puede ver.
    expect(screen.getAllByText(/^Ver [\w.]+$/).length).toBeGreaterThan(0);
  }, 60_000);

  it("pistas graduadas y la solución solo detrás de «Ver la solución completa»", async () => {
    const inst = await openCode("py-recursion", "básico", 4);
    fireEvent.click(screen.getByRole("button", { name: "Dame una pista" }));
    expect(screen.getByText(`Pista 1 de ${inst.hints.length}:`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otra pista" }));
    expect(screen.getByText(`Pista 2 de ${inst.hints.length}:`)).toBeTruthy();
    expect(screen.queryByTestId("solution")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver la solución completa" }));
    expect(within(screen.getByTestId("solution")).getByText((_, el) => el?.tagName === "PRE" && el.textContent === inst.solution)).toBeTruthy();
  }, 30_000);
});

describe.skipIf(!hasPython3)("«¿Qué imprime?» con python3", () => {
  it("respuesta equivocada: la primera línea distinta y el paso a paso; después, la correcta", async () => {
    const seed = 21;
    const inst = PY_OUTPUT.generate(seed, "medio");
    renderAt(urlOf("py-que-imprime", "medio", seed));
    await page();
    const answer = await screen.findByLabelText("Lo que imprime (una línea por cada línea de la salida)", undefined, { timeout: 5000 });
    expect(screen.queryByRole("heading", { name: "Paso a paso" })).toBeNull();
    fireEvent.change(answer, { target: { value: "no es esto" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText("No coincide: la primera diferencia está en la línea 1 de la salida.", undefined, { timeout: 30_000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver paso a paso" }));
    expect(await screen.findByRole("heading", { name: "Paso a paso" }, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByTestId("trace-step").textContent).toMatch(/^Paso 1 de \d+: se va a ejecutar la línea 1\.$/);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByTestId("trace-step").textContent).toMatch(/^Paso 2 de/);
    const [real] = runJobs<{ salida: string }>(HARNESS_PY, [{ fn: "__labs_output", payload: { codigo: inst.code, segundos: 2 } }]);
    fireEvent.change(answer, { target: { value: real!.salida } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText("¡Correcto! Eso es exactamente lo que imprime.", undefined, { timeout: 30_000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("¡Resuelto! Cuenta en tu progreso.")).toBeTruthy());
  }, 90_000);

  it("Python ya cargado en este dispositivo: se prepara al abrir, pero nada se ejecuta sin pulsar", async () => {
    storage.save({ python: JSON.stringify({ loaded: true }) });
    renderAt(urlOf("py-que-imprime", "básico", 3));
    await page();
    await screen.findByLabelText("Lo que imprime (una línea por cada línea de la salida)", undefined, { timeout: 5000 });
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(Python3Worker.all).toHaveLength(1);
    expect(Python3Worker.all[0]!.posted.map((m) => m.type)).toEqual(["init"]);
  });
});
