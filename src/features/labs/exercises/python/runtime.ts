// Python para los ejercicios: un solo PyClient (y su worker) compartido por las vistas de los
// ejercicios de Python mientras alguna está montada. «Siguiente ejercicio» monta otra vista: el
// intérprete se conserva porque solo se libera un poco después de que la última se desmonte.
// Pyodide se descarga al pulsar «Cargar Python» o «Comprobar» (o solo, si ya se cargó antes en este
// dispositivo, como en la pestaña Python). Nunca se ejecuta nada sin que la persona lo pida.
import { useEffect, useSyncExternalStore } from "react";
import { readLabItem, writeLabItem } from "../../labs-storage.ts";
import { createPyWorker, PyClient } from "../../python/py-client.ts";
import { closureBytes, EXTRA_WHEELS } from "../../python/packages.ts";
import { PYODIDE_CORE, PYODIDE_PACKAGES } from "../../python/pyodide-manifest.ts";
import { isolationAvailable, pyodideBaseUrl } from "../../python/python-config.ts";

export type RuntimePhase = "idle" | "loading" | "ready" | "error";

/** Bytes de la primera descarga (núcleo y numpy), para el aviso. */
export const FIRST_DOWNLOAD_BYTES =
  PYODIDE_CORE.reduce((s, f) => s + f.size, 0) + PYODIDE_PACKAGES.filter((p) => p.name === "numpy").reduce((s, p) => s + p.size, 0);

/**
 * Bytes que descargan, además de la primera descarga, los paquetes de un ejercicio («pandas»,
 * «matplotlib.pyplot», «seaborn»…), con sus dependencias del lock y los wheels extra.
 */
export function packagesBytes(modules: readonly string[]): number {
  const roots = new Set<string>();
  let extra = 0;
  for (const m of modules) {
    const root = m.split(".")[0]!;
    const wheel = EXTRA_WHEELS.find((w) => w.imports.includes(root));
    if (wheel) {
      extra += wheel.size;
      for (const d of wheel.lockDeps) roots.add(d);
    } else roots.add(root);
  }
  return extra + closureBytes(PYODIDE_PACKAGES, [...roots], new Set(["numpy"]));
}

/** Tras desmontarse la última vista, cuánto se espera antes de terminar el worker. */
export const RELEASE_DELAY_MS = 5000;

type State = { client: PyClient | null; phase: RuntimePhase; refs: number; timer: ReturnType<typeof setTimeout> | null };

const state: State = { client: null, phase: "idle", refs: 0, timer: null };
const listeners = new Set<() => void>();
let factory: () => Worker = createPyWorker;

function emit(phase: RuntimePhase) {
  state.phase = phase;
  for (const l of listeners) l();
}

/** Para las pruebas: el worker que se crea (por defecto, el real). */
export function setExerciseWorkerFactory(f: (() => Worker) | null): void {
  disposeRuntime();
  factory = f ?? createPyWorker;
}

/** Termina el worker y vuelve al principio (también para las pruebas). */
export function disposeRuntime(): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  state.client?.dispose();
  state.client = null;
  emit("idle");
}

/** ¿Se cargó Python antes en este dispositivo? Lo apunta la pestaña Python (y estos ejercicios). */
function loadedBefore(): boolean {
  try {
    const raw = readLabItem("python");
    return raw !== null && (JSON.parse(raw) as { loaded?: unknown }).loaded === true;
  } catch {
    return false;
  }
}

function rememberLoaded(): void {
  try {
    const raw = readLabItem("python");
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (prev && typeof prev === "object" && prev.loaded !== true) writeLabItem("python", JSON.stringify({ ...prev, loaded: true }));
  } catch {
    // preferencias ilegibles: la pestaña Python las rehará
  }
}

/** Carga Python (si hace falta) y devuelve el cliente listo, o null si falla. */
export async function ensurePython(): Promise<PyClient | null> {
  if (!state.client) state.client = new PyClient({ createWorker: factory, isolated: isolationAvailable(), indexURL: pyodideBaseUrl() });
  const client = state.client;
  if (state.phase !== "ready") emit("loading");
  try {
    await client.load(() => {});
    if (state.client !== client) return null;
    rememberLoaded();
    emit("ready");
    return client;
  } catch {
    if (state.client === client) {
      client.dispose();
      state.client = null;
      emit("error");
    }
    return null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Estado de Python para una vista; la mantiene viva mientras está montada. */
export function usePythonRuntime(): { phase: RuntimePhase; ensure: () => Promise<PyClient | null> } {
  const phase = useSyncExternalStore(subscribe, () => state.phase, () => state.phase);
  useEffect(() => {
    state.refs++;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.phase === "idle" && loadedBefore()) void ensurePython();
    return () => {
      state.refs--;
      if (state.refs > 0) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.refs === 0) disposeRuntime();
      }, RELEASE_DELAY_MS);
    };
  }, []);
  return { phase, ensure: ensurePython };
}
