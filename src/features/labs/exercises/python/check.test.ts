// «Comprobar» con el worker falso de las pruebas del cliente: orden de los mensajes (vaciar, escribir
// los archivos de cada caso, ejecutar con capture y vaciar), lectura del resultado y fallos.
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeCodeTemplate } from "../../../../../shared/exercises/python.ts";
import { PyClient, type WorkerIn, type WorkerOut } from "../../python/py-client.ts";
import { checkCode, runSnippet } from "./check.ts";
import { CHECK_TIMEOUT_MS } from "./harness.ts";

class FakeWorker {
  posted: WorkerIn[] = [];
  onmessage: ((e: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(m: WorkerIn) {
    this.posted.push(m);
  }
  terminate() {}
  emit(data: WorkerOut) {
    this.onmessage?.({ data } as MessageEvent<WorkerOut>);
  }
  lastRun() {
    const r = this.posted.filter((m) => m.type === "run").at(-1);
    if (!r || r.type !== "run") throw new Error("sin run");
    return r;
  }
}

async function ready() {
  const workers: FakeWorker[] = [];
  const client = new PyClient({ createWorker: () => (workers.push(new FakeWorker()), workers.at(-1) as unknown as Worker), isolated: false, indexURL: "https://x.invalid/" });
  const p = client.load(() => {});
  workers[0]!.emit({ type: "ready", python: "3.12.7" });
  await p;
  return { client, w: () => workers.at(-1)! };
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

afterEach(() => vi.useRealTimers());

describe("checkCode", () => {
  it("escribe los archivos de los casos, ejecuta con capture y vacía la carpeta", async () => {
    const { client, w } = await ready();
    const inst = makeCodeTemplate("lineas", 1, "básico");
    const p = checkCode(client, inst, "def contar_lineas(r):\n    return 0\n");
    await tick();
    const types = w().posted.map((m) => m.type);
    expect(types.slice(1)).toEqual(["fs-clear", ...inst.cases.filter((c) => c.files).map(() => "fs-write"), "run"]);
    const writes = w().posted.filter((m): m is Extract<WorkerIn, { type: "fs-write" }> => m.type === "fs-write");
    expect(writes.map((m) => m.path)).toEqual(inst.cases.map((_, k) => `ejercicio/caso${k + 1}/datos.txt`));
    expect(new TextDecoder().decode(writes[0]!.data)).toBe(inst.cases[0]!.files!["datos.txt"]);
    const run = w().lastRun();
    expect(run.capture).toBe(true);
    expect(run.imports).toBe("def contar_lineas(r):\n    return 0\n");
    expect(run.code).toContain("def __labs_check(p):");
    w().emit({ type: "done", id: run.id, figures: [], ms: 3, files: [], value: JSON.stringify({ sintaxis: null, falta: false, superior: "", casos: [{ ok: false, mal: [{ que: "valor", texto: "0" }] }], reglas: [false] }) });
    const o = await p;
    expect(o).toEqual({ kind: "result", result: { sintaxis: null, falta: false, superior: "", casos: [{ ok: false, mal: [{ que: "valor", texto: "0" }] }], reglas: [false] } });
    expect(w().posted.at(-1)!.type).toBe("fs-clear");
    expect(client.uploadedFiles()).toEqual([]);
  });

  it("límite de tiempo: timeout (y el cliente reinicia el worker)", async () => {
    vi.useFakeTimers();
    const { client } = await ready();
    const p = checkCode(client, makeCodeTemplate("sumas", 1, "básico"), "while True: pass");
    await tick();
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS + 1);
    expect(await p).toEqual({ kind: "timeout", seconds: CHECK_TIMEOUT_MS / 1000 });
  });

  it("un resultado ilegible o un error del worker se informan como fallo", async () => {
    const { client, w } = await ready();
    const p = checkCode(client, makeCodeTemplate("sumas", 1, "básico"), "x");
    await tick();
    w().emit({ type: "done", id: w().lastRun().id, figures: [], ms: 1, files: [] });
    expect((await p).kind).toBe("failed");
    const q = runSnippet(client, "print(1)");
    await tick();
    w().emit({ type: "error", id: w().lastRun().id, message: "MemoryError", line: null, ms: 1 });
    expect(await q).toEqual({ kind: "failed", message: "MemoryError" });
  });
});
