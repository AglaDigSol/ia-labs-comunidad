// Lado del hilo principal de la pestaña Python. Un único worker de módulo a la vez. «Detener» pide
// primero a Python que pare con la interrupción de SharedArrayBuffer (solo con aislamiento entre
// orígenes) y, si nadie responde en STOP_ESCALATE_MS, termina el worker y arranca otro. Sin
// aislamiento reinicia al momento. El límite de tiempo usa el mismo reinicio.
//
// Los archivos subidos (y los que escribe el anfitrión) se guardan también aquí, solo en memoria, para
// volver a escribirlos en el worker nuevo tras un reinicio; los que haya creado el código se pierden
// con él. Las rutas son relativas a la carpeta de trabajo y pueden tener carpetas ("datos/a.csv").
import type { FileInfo } from "./files.ts";

/** principal -> worker */
export type WorkerIn =
  | { type: "init"; indexURL: string; interrupt?: SharedArrayBuffer }
  | { type: "run"; id: number; code: string; stdin: string[]; capture?: boolean; imports?: string }
  | { type: "fs-write"; path: string; data: ArrayBuffer }
  | { type: "fs-read"; id: number; path: string }
  | { type: "fs-delete"; path: string }
  | { type: "fs-clear" };

/** worker -> principal */
export type WorkerOut =
  | { type: "ready"; python: string; numpy?: string }
  | { type: "stdout" | "stderr"; text: string }
  | { type: "package"; name: string; phase: "start" | "done" }
  | { type: "done"; id: number; figures: string[]; ms: number; files: FileInfo[]; value?: string }
  | { type: "error"; id: number; message: string; line: number | null; ms: number; files?: FileInfo[] }
  | { type: "fs-data"; id: number; path: string; data: ArrayBuffer | null };

export type PyEvent = Extract<WorkerOut, { type: "ready" | "stdout" | "stderr" | "package" }>;

export type RunOutcome =
  | { kind: "done"; figures: string[]; ms: number; files: FileInfo[]; value?: string }
  | { kind: "error"; message: string; line: number | null; ms: number; files: FileInfo[] | null }
  | { kind: "stopped"; restarted: boolean }
  | { kind: "timeout"; seconds: number };

/**
 * Opciones de una ejecución. `capture`: el valor de la última expresión, si es un str, vuelve en
 * `value` (lo usan los ejercicios y el paso a paso, que devuelven su resultado como JSON). `imports`:
 * el código del que se sacan los paquetes que cargar, cuando el que se ejecuta lo lleva dentro de
 * una cadena (por defecto, el propio código).
 */
export type RunOptions = { capture?: boolean; imports?: string };

export const STOP_ESCALATE_MS = 1500;
/**
 * Si Python no está listo en este tiempo, la carga falla (y el worker se termina). Pasa, por ejemplo,
 * si el servidor no manda 'wasm-unsafe-eval' en la CSP del worker: WebAssembly no compila y Pyodide
 * se queda esperando.
 */
export const LOAD_TIMEOUT_MS = 90_000;
/** Id con el que el worker informa de un fallo al iniciar (las ejecuciones empiezan en 1). */
export const INIT_ID = 0;

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const BASE64 = /^[A-Za-z0-9+/=]+$/;
const EXEC_LINE = /File "<exec>", line (\d+)/g;

/** Línea del marco más interno del código del usuario, o null si la traza no tiene ninguno. */
export function parseErrorLine(message: string): number | null {
  let line: number | null = null;
  for (const m of message.matchAll(EXEC_LINE)) line = Number(m[1]);
  return line;
}

/**
 * El worker real. `new URL(..., import.meta.url)` hace que Vite lo emita como chunk propio, también
 * cuando una app anfitriona compila este paquete desde node_modules.
 */
export function createPyWorker(): Worker {
  return new Worker(new URL("./py.worker.ts", import.meta.url), { type: "module", name: "python" });
}

type Pending = {
  id: number;
  onEvent: (e: PyEvent) => void;
  resolve: (o: RunOutcome) => void;
  timer: unknown;
  stopping: boolean;
  onSettled: (() => void) | null;
};

export class PyClient {
  private readonly createWorker: () => Worker;
  private readonly isolated: boolean;
  private readonly indexURL: string;
  private readonly timers: Timers;
  private worker: Worker | null = null;
  private int32: Int32Array | null = null;
  private ready: Promise<void> | null = null;
  private readyRes: (() => void) | null = null;
  private readyRej: ((e: Error) => void) | null = null;
  private loadTimer: unknown = null;
  private loadEvent: (e: PyEvent) => void = () => {};
  private pending: Pending | null = null;
  private nextId = 1;
  private readonly uploads = new Map<string, ArrayBuffer>();
  private readonly reads = new Map<number, (data: ArrayBuffer | null) => void>();

  constructor(opts: { createWorker: () => Worker; isolated: boolean; indexURL: string; timers?: Timers }) {
    this.createWorker = opts.createWorker;
    this.isolated = opts.isolated && typeof SharedArrayBuffer === "function";
    this.indexURL = opts.indexURL;
    this.timers = opts.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
    };
  }

  /** Arranca el worker y resuelve cuando Python (y numpy) están listos. */
  load(onEvent: (e: PyEvent) => void): Promise<void> {
    this.loadEvent = onEvent;
    if (!this.worker) this.spawn();
    return this.ready!;
  }

  async run(code: string, timeoutMs: number, onEvent: (e: PyEvent) => void, stdin: string[] = [], opts: RunOptions = {}): Promise<RunOutcome> {
    if (!this.ready) throw new Error("not_loaded");
    if (this.pending) throw new Error("busy");
    await this.ready;
    const worker = this.worker!;
    const id = this.nextId++;
    if (this.int32) Atomics.store(this.int32, 0, 0);
    return new Promise<RunOutcome>((resolve) => {
      const p: Pending = { id, onEvent, resolve, timer: null, stopping: false, onSettled: null };
      p.timer = this.timers.setTimeout(() => {
        if (this.pending !== p) return;
        this.restart();
        this.finish(p, { kind: "timeout", seconds: Math.round(timeoutMs / 1000) });
      }, timeoutMs);
      this.pending = p;
      const msg: WorkerIn = { type: "run", id, code, stdin };
      if (opts.capture) msg.capture = true;
      if (opts.imports !== undefined) msg.imports = opts.imports;
      worker.postMessage(msg);
    });
  }

  /** Para la ejecución: "interrupted" si Python se detuvo solo, "restarted" si hubo que cambiar de worker. */
  async stop(): Promise<"interrupted" | "restarted"> {
    const p = this.pending;
    if (!p) return "interrupted";
    p.stopping = true;
    if (this.isolated && this.int32) {
      Atomics.store(this.int32, 0, 2); // SIGINT -> KeyboardInterrupt dentro de Python
      const answered = await new Promise<boolean>((res) => {
        const h = this.timers.setTimeout(() => res(false), STOP_ESCALATE_MS);
        p.onSettled = () => {
          this.timers.clearTimeout(h);
          res(true);
        };
      });
      if (answered) return "interrupted";
    }
    if (this.pending === p) {
      this.restart();
      this.finish(p, { kind: "stopped", restarted: true });
    }
    return "restarted";
  }

  /**
   * Escribe un archivo en la carpeta de trabajo (y lo recuerda para los reinicios). La ruta ya viene
   * comprobada (checkUpload o checkHostFile); el worker la vuelve a comprobar.
   */
  upload(path: string, data: ArrayBuffer): void {
    this.uploads.set(path, data);
    // Se envía una copia: la original queda aquí para un reinicio.
    if (this.worker) this.worker.postMessage({ type: "fs-write", path, data: data.slice(0) } satisfies WorkerIn);
  }

  /** Lee un archivo de la carpeta de trabajo (subido, del anfitrión o creado por el código). null si no existe. */
  readFile(path: string): Promise<ArrayBuffer | null> {
    const worker = this.worker;
    if (!worker) return Promise.resolve(this.uploads.get(path)?.slice(0) ?? null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.reads.set(id, resolve);
      worker.postMessage({ type: "fs-read", id, path } satisfies WorkerIn);
    });
  }

  /** Borra un archivo de la carpeta de trabajo (y lo olvida, si era de los guardados). */
  removeFile(path: string): void {
    this.uploads.delete(path);
    this.worker?.postMessage({ type: "fs-delete", path } satisfies WorkerIn);
  }

  /** Borra todos los archivos de la carpeta de trabajo. */
  clearFiles(): void {
    this.uploads.clear();
    this.worker?.postMessage({ type: "fs-clear" } satisfies WorkerIn);
  }

  /** Los archivos guardados con su contenido, para pasarlos a otro cliente. */
  uploadsSnapshot(): Array<[string, ArrayBuffer]> {
    return [...this.uploads].map(([name, data]) => [name, data.slice(0)]);
  }

  /** Archivos guardados: subidos y del anfitrión (los que sobreviven a un reinicio). */
  uploadedFiles(): FileInfo[] {
    return [...this.uploads].map(([name, data]) => ({ name, size: data.byteLength }));
  }

  dispose(): void {
    this.timers.clearTimeout(this.loadTimer);
    if (this.pending) this.finish(this.pending, { kind: "stopped", restarted: false });
    this.settleReads();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  private spawn(): void {
    const worker = this.createWorker();
    this.worker = worker;
    this.ready = new Promise<void>((res, rej) => {
      this.readyRes = res;
      this.readyRej = rej;
    });
    this.ready.catch(() => {}); // un reinicio fallido se informa en el siguiente load/run, nunca sin capturar
    this.ready.then(
      () => this.timers.clearTimeout(this.loadTimer),
      () => this.timers.clearTimeout(this.loadTimer),
    );
    this.timers.clearTimeout(this.loadTimer);
    this.loadTimer = this.timers.setTimeout(() => {
      if (worker !== this.worker) return;
      this.readyRej?.(new Error("load_timeout"));
      worker.terminate();
      this.worker = null;
      this.ready = null;
    }, LOAD_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(worker, e.data);
    worker.onerror = (e: ErrorEvent) => {
      if (worker !== this.worker) return;
      e.preventDefault?.();
      const message = e.message || "worker_error";
      this.readyRej?.(new Error(message));
      const p = this.pending;
      if (p) this.finish(p, p.stopping ? { kind: "stopped", restarted: false } : { kind: "error", message, line: null, ms: 0, files: null });
    };
    if (this.isolated) {
      const sab = new SharedArrayBuffer(4);
      this.int32 = new Int32Array(sab);
      worker.postMessage({ type: "init", indexURL: this.indexURL, interrupt: sab } satisfies WorkerIn);
    } else {
      worker.postMessage({ type: "init", indexURL: this.indexURL } satisfies WorkerIn);
    }
    // El worker atiende los mensajes en orden: estos esperan a que Python esté listo.
    for (const [path, data] of this.uploads) {
      worker.postMessage({ type: "fs-write", path, data: data.slice(0) } satisfies WorkerIn);
    }
  }

  private restart(): void {
    this.settleReads();
    this.worker?.terminate();
    this.worker = null;
    this.spawn();
  }

  private settleReads(): void {
    for (const resolve of this.reads.values()) resolve(null);
    this.reads.clear();
  }

  private finish(p: Pending, outcome: RunOutcome): void {
    if (this.pending !== p) return;
    this.timers.clearTimeout(p.timer);
    this.pending = null;
    p.resolve(outcome);
    p.onSettled?.();
  }

  private onMessage(worker: Worker, msg: WorkerOut): void {
    if (worker !== this.worker) return; // mensajes viejos de un worker ya terminado
    const p = this.pending;
    switch (msg.type) {
      case "ready":
        this.readyRes?.();
        this.loadEvent(msg);
        return;
      case "stdout":
      case "stderr":
      case "package":
        (p ? p.onEvent : this.loadEvent)(msg);
        return;
      case "done":
        if (p && p.id === msg.id) {
          const figures = msg.figures.filter((f) => typeof f === "string" && BASE64.test(f));
          const done: RunOutcome = { kind: "done", figures, ms: msg.ms, files: validFiles(msg.files) };
          if (typeof msg.value === "string") done.value = msg.value;
          this.finish(p, done);
        }
        return;
      case "error":
        if (msg.id === INIT_ID && !p) {
          this.readyRej?.(new Error(msg.message));
          return;
        }
        if (p && p.id === msg.id) {
          if (p.stopping) this.finish(p, { kind: "stopped", restarted: false });
          else {
            const line = typeof msg.line === "number" ? msg.line : parseErrorLine(msg.message);
            const files = msg.files ? validFiles(msg.files) : null;
            this.finish(p, { kind: "error", message: msg.message, line, ms: msg.ms, files });
          }
        }
        return;
      case "fs-data": {
        const resolve = this.reads.get(msg.id);
        if (resolve) {
          this.reads.delete(msg.id);
          resolve(msg.data instanceof ArrayBuffer ? msg.data : null);
        }
        return;
      }
    }
  }
}

function validFiles(list: unknown): FileInfo[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (f): f is FileInfo => !!f && typeof f.name === "string" && typeof f.size === "number" && Number.isFinite(f.size),
  );
}
