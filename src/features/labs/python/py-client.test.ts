// Cliente del worker de Python con un worker falso: carga, ejecución, «Detener», límite de tiempo y archivos.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOAD_TIMEOUT_MS,
  parseErrorLine,
  PyClient,
  STOP_ESCALATE_MS,
  type PyEvent,
  type WorkerIn,
  type WorkerOut,
} from "./py-client.ts";

const INDEX = "https://labs.example.invalid/pyodide/0.27.7/";

class FakeWorker {
  posted: WorkerIn[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(m: WorkerIn) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: WorkerOut) {
    this.onmessage?.({ data } as MessageEvent<WorkerOut>);
  }
  lastRunId(): number {
    const runs = this.posted.filter((m) => m.type === "run");
    const last = runs[runs.length - 1];
    if (!last || last.type !== "run") throw new Error("no run posted");
    return last.id;
  }
}

function setup(isolated: boolean) {
  const workers: FakeWorker[] = [];
  const client = new PyClient({
    createWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    },
    isolated,
    indexURL: INDEX,
  });
  return { client, workers };
}

async function loaded(isolated: boolean) {
  const s = setup(isolated);
  const events: PyEvent[] = [];
  const p = s.client.load((e) => events.push(e));
  s.workers[0]!.emit({ type: "ready", python: "3.12.7", numpy: "2.0.2" });
  await p;
  return { ...s, events };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PyClient: carga", () => {
  it("crea un worker, envía init y resuelve al recibir ready", async () => {
    const { workers, events } = await loaded(false);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted[0]).toEqual({ type: "init", indexURL: INDEX });
    expect(events).toContainEqual({ type: "ready", python: "3.12.7", numpy: "2.0.2" });
  });

  it("con aislamiento pasa un SharedArrayBuffer en init", async () => {
    const { workers } = await loaded(true);
    const init = workers[0]!.posted[0]!;
    expect(init.type).toBe("init");
    expect(init.type === "init" && init.interrupt instanceof SharedArrayBuffer).toBe(true);
  });

  it("rechaza la carga si el worker informa un error de init", async () => {
    const { client, workers } = setup(false);
    const p = client.load(() => {});
    workers[0]!.emit({ type: "error", id: 0, message: "boom", line: null, ms: 0 });
    await expect(p).rejects.toThrow("boom");
  });
});

describe("PyClient: ejecución", () => {
  it("reenvía stdout, stderr y package en orden y resuelve done", async () => {
    const { client, workers } = await loaded(false);
    const events: PyEvent[] = [];
    const p = client.run("print(1)", 30_000, (e) => events.push(e));
    await Promise.resolve();
    await Promise.resolve();
    const w = workers[0]!;
    const id = w.lastRunId();
    w.emit({ type: "package", name: "numpy", phase: "start" });
    w.emit({ type: "package", name: "numpy", phase: "done" });
    w.emit({ type: "stdout", text: "1\n" });
    w.emit({ type: "stderr", text: "aviso\n" });
    w.emit({ type: "done", id, figures: ["iVBORw0KGgo=", "not base64 <script>"], ms: 1234, files: [{ name: "a.csv", size: 3 }] });
    expect(await p).toEqual({ kind: "done", figures: ["iVBORw0KGgo="], ms: 1234, files: [{ name: "a.csv", size: 3 }] });
    expect(events).toEqual([
      { type: "package", name: "numpy", phase: "start" },
      { type: "package", name: "numpy", phase: "done" },
      { type: "stdout", text: "1\n" },
      { type: "stderr", text: "aviso\n" },
    ]);
  });

  it("un error con 'File \"<exec>\", line 7' da la línea 7", async () => {
    const { client, workers } = await loaded(false);
    const p = client.run("x", 30_000, () => {});
    await Promise.resolve();
    await Promise.resolve();
    const w = workers[0]!;
    const message = 'Traceback (most recent call last):\n  File "<exec>", line 7, in <module>\nNameError: name \'x\' is not defined';
    w.emit({ type: "error", id: w.lastRunId(), message, line: null, ms: 5 });
    expect(await p).toEqual({ kind: "error", message, line: 7, ms: 5, files: null });
  });

  it("un error sin línea da null", async () => {
    const { client, workers } = await loaded(false);
    const p = client.run("x", 30_000, () => {});
    await Promise.resolve();
    await Promise.resolve();
    const w = workers[0]!;
    w.emit({ type: "error", id: w.lastRunId(), message: "MemoryError", line: null, ms: 5 });
    expect(await p).toEqual({ kind: "error", message: "MemoryError", line: null, ms: 5, files: null });
  });

  it("parseErrorLine toma el último marco <exec>", () => {
    expect(parseErrorLine('File "<exec>", line 3\n  File "<exec>", line 12, in f')).toBe(12);
    expect(parseErrorLine('File "/lib/python.zip/x.py", line 9')).toBeNull();
  });

  it("límite de tiempo: sin respuesta en 30 s da timeout y reinicia el worker", async () => {
    vi.useFakeTimers();
    const { client, workers } = await loaded(false);
    const p = client.run("while True: pass", 30_000, () => {});
    await vi.advanceTimersByTimeAsync(29_999);
    expect(workers).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ kind: "timeout", seconds: 30 });
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.posted[0]!.type).toBe("init");
  });
});

describe("PyClient: Detener", () => {
  it("aislado: escribe 2 en el buffer y resuelve interrupted si llega KeyboardInterrupt", async () => {
    vi.useFakeTimers();
    const { client, workers } = await loaded(true);
    const w = workers[0]!;
    const init = w.posted[0]!;
    const sab = init.type === "init" ? init.interrupt! : null;
    const run = client.run("while True: pass", 30_000, () => {});
    await vi.advanceTimersByTimeAsync(0);
    const id = w.lastRunId();
    const stop = client.stop();
    expect(Atomics.load(new Int32Array(sab!), 0)).toBe(2);
    await vi.advanceTimersByTimeAsync(800);
    w.emit({ type: "error", id, message: "KeyboardInterrupt", line: null, ms: 900 });
    expect(await stop).toBe("interrupted");
    expect(await run).toEqual({ kind: "stopped", restarted: false });
    expect(w.terminated).toBe(false);
    expect(workers).toHaveLength(1);
  });

  it("aislado sin respuesta en 1,5 s: termina, crea otro worker, lo inicia y resuelve restarted", async () => {
    vi.useFakeTimers();
    const { client, workers } = await loaded(true);
    const run = client.run("import numpy", 30_000, () => {});
    await vi.advanceTimersByTimeAsync(0);
    const stop = client.stop();
    await vi.advanceTimersByTimeAsync(STOP_ESCALATE_MS - 1);
    expect(workers[0]!.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await stop).toBe("restarted");
    expect(await run).toEqual({ kind: "stopped", restarted: true });
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.posted[0]!.type).toBe("init");
  });

  it("sin aislamiento: termina y reinicia al momento sin SharedArrayBuffer", async () => {
    const { client, workers } = await loaded(false);
    const run = client.run("while True: pass", 30_000, () => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(await client.stop()).toBe("restarted");
    expect(await run).toEqual({ kind: "stopped", restarted: true });
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.posted[0]).toEqual({ type: "init", indexURL: INDEX });
  });

  it("los mensajes del worker antiguo se ignoran tras reiniciar", async () => {
    const { client, workers } = await loaded(false);
    void client.run("x", 30_000, () => {});
    await Promise.resolve();
    await Promise.resolve();
    await client.stop();
    workers[1]!.emit({ type: "ready", python: "3.12.7" });
    const events: PyEvent[] = [];
    const p = client.run("print(2)", 30_000, (e) => events.push(e));
    await Promise.resolve();
    await Promise.resolve();
    workers[0]!.emit({ type: "stdout", text: "viejo\n" });
    workers[1]!.emit({ type: "stdout", text: "2\n" });
    workers[1]!.emit({ type: "done", id: workers[1]!.lastRunId(), figures: [], ms: 1, files: [] });
    await p;
    expect(events).toEqual([{ type: "stdout", text: "2\n" }]);
  });
});

describe("PyClient: entrada, archivos y carga", () => {
  it("manda las líneas de input() con la ejecución", async () => {
    const { client, workers } = await loaded(false);
    void client.run("input()", 30_000, () => {}, ["Ada", "42"]);
    await Promise.resolve();
    await Promise.resolve();
    expect(workers[0]!.posted.at(-1)).toMatchObject({ type: "run", code: "input()", stdin: ["Ada", "42"] });
  });

  it("los archivos subidos se envían al worker y se vuelven a enviar tras un reinicio", async () => {
    const { client, workers } = await loaded(false);
    client.upload("datos.csv", new TextEncoder().encode("x,y\n1,2\n").buffer);
    const write = workers[0]!.posted.find((m) => m.type === "fs-write");
    expect(write).toMatchObject({ type: "fs-write", name: "datos.csv" });
    expect(client.uploadedFiles()).toEqual([{ name: "datos.csv", size: 8 }]);
    void client.run("while True: pass", 30_000, () => {});
    await Promise.resolve();
    await Promise.resolve();
    await client.stop();
    // El worker nuevo recibe init y, detrás, el archivo.
    expect(workers[1]!.posted.map((m) => m.type)).toEqual(["init", "fs-write"]);
    const again = workers[1]!.posted[1]!;
    expect(again.type === "fs-write" && new TextDecoder().decode(again.data)).toBe("x,y\n1,2\n");
  });

  it("readFile pide el archivo al worker y resuelve con sus bytes (o null)", async () => {
    const { client, workers } = await loaded(false);
    const p = client.readFile("salida.csv");
    const req = workers[0]!.posted.at(-1)!;
    expect(req).toMatchObject({ type: "fs-read", name: "salida.csv" });
    const data = new TextEncoder().encode("ok").buffer;
    workers[0]!.emit({ type: "fs-data", id: req.type === "fs-read" ? req.id : -1, name: "salida.csv", data });
    expect(new TextDecoder().decode((await p)!)).toBe("ok");
    const missing = client.readFile("no.txt");
    const req2 = workers[0]!.posted.at(-1)!;
    workers[0]!.emit({ type: "fs-data", id: req2.type === "fs-read" ? req2.id : -1, name: "no.txt", data: null });
    expect(await missing).toBeNull();
  });

  it("clearFiles vacía la carpeta del worker y olvida los subidos", async () => {
    const { client, workers } = await loaded(false);
    client.upload("a.txt", new ArrayBuffer(2));
    client.clearFiles();
    expect(workers[0]!.posted.at(-1)).toEqual({ type: "fs-clear" });
    expect(client.uploadedFiles()).toEqual([]);
  });

  it("si Python no está listo en LOAD_TIMEOUT_MS, la carga falla y el worker se termina", async () => {
    vi.useFakeTimers();
    const { client, workers } = setup(false);
    const p = client.load(() => {});
    const rejected = expect(p).rejects.toThrow("load_timeout");
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    await rejected;
    expect(workers[0]!.terminated).toBe(true);
    // Se puede volver a intentar: otro worker.
    void client.load(() => {}).catch(() => {});
    expect(workers).toHaveLength(2);
  });

  it("un error del worker durante «Detener» cuenta como parada, no como error", async () => {
    vi.useFakeTimers();
    const { client, workers } = await loaded(true);
    const run = client.run("while True: pass", 30_000, () => {});
    await vi.advanceTimersByTimeAsync(0);
    void client.stop();
    workers[0]!.onerror?.({ message: "KeyboardInterrupt", preventDefault() {} } as unknown as ErrorEvent);
    expect(await run).toEqual({ kind: "stopped", restarted: false });
  });
});
