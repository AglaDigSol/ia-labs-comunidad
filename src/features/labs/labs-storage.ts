// Persistencia de los laboratorios (borrador de Markov, formato de las tablas de verdad, «Avanzar al
// escribir» de las rejillas, borrador del laboratorio de álgebra de Boole, progreso del banco de
// ejercicios, editor de la pestaña Python e intentos de los simulacros de examen de 02MIAR y de 01MIAR, y lo último que se hizo),
// detrás de la misma interfaz StorageAdapter que usa el almacén KV.
// La app independiente guarda cada valor en su propia clave de localStorage, como siempre; una app que
// integra los laboratorios puede inyectar su almacén con configureLabs({ storage }) (por ejemplo,
// MemoryAdapter para que no se guarde nada).
import type { StorageAdapter } from "../../lib/storage-adapter.ts";
import { setPythonConfig, type PythonLabConfig } from "./python/python-config.ts";

/** Valores que guardan los laboratorios. Todos son cadenas (JSON en el caso de Markov, Boole, los ejercicios, Python y el simulacro). */
export type LabsStorageKey = "markov" | "logicFormat" | "boole" | "exercises" | "python" | "exam" | "pyexam" | "gridAdvance" | "labsIntro" | "sets" | "recent";

/** Claves de localStorage de la app independiente. */
export const DEFAULT_LABS_KEYS = {
  markov: "ia-labs.markov.v1",
  logicFormat: "ia-labs.logic-format",
  boole: "ia-labs.boole.v1",
  exercises: "ia-labs.exercises.v1",
  python: "ia-labs.python.v1",
  exam: "ia-labs.exam.v1",
  pyexam: "ia-labs.pyexam.v1",
  gridAdvance: "ia-labs.grid-advance",
  labsIntro: "ia-labs.labs-intro",
  sets: "ia-labs.sets.v1",
  recent: "ia-labs.recent.v1",
} as const satisfies Record<LabsStorageKey, string>;

const LAB_KEYS = Object.keys(DEFAULT_LABS_KEYS) as LabsStorageKey[];

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Adaptador por defecto: un valor por clave de localStorage. `keys` permite conservar las claves que
 * ya usaba una app anfitriona (así no se pierden los borradores al migrar). Las claves que no se pasan
 * usan las de DEFAULT_LABS_KEYS (por ejemplo, `boole`, añadida en 0.4.0, `exercises`, en 0.7.0,
 * `python`, en 0.8.0, `exam`, la del simulacro de examen, `pyexam`, la del simulacro de 01MIAR,
 * `gridAdvance`, en 0.13.0, la opción «Avanzar al escribir» de las tablas: "0" apagada, "1" o nada encendida,
 * `labsIntro`, la orientación de la primera visita: "0" cerrada, o `sets`, la expresión y los supuestos del
 * diagrama de Venn de Conjuntos, en JSON, o `recent`, en 0.18.0, la última pestaña y el último ejercicio del banco
 * (tipo, nivel y semilla) para «Continuar», en JSON).
 */
export function createLocalStorageLabsAdapter(keys: Partial<Record<LabsStorageKey, string>> = {}): StorageAdapter {
  const map: Record<LabsStorageKey, string> = { ...DEFAULT_LABS_KEYS, ...keys };
  return {
    load() {
      const s = getStorage();
      if (!s) return null;
      const out: Record<string, unknown> = {};
      try {
        for (const k of LAB_KEYS) {
          const raw = s.getItem(map[k]);
          if (raw !== null) out[k] = raw;
        }
      } catch {
        return null;
      }
      return out;
    },
    save(data) {
      const s = getStorage();
      if (!s) return false;
      try {
        for (const k of LAB_KEYS) {
          const v = data[k];
          if (typeof v === "string") s.setItem(map[k], v);
          else s.removeItem(map[k]);
        }
        return true;
      } catch {
        return false;
      }
    },
    subscribe(onExternalChange) {
      if (typeof window === "undefined") return () => {};
      const watched = new Set(Object.values(map));
      const handler = (e: StorageEvent) => {
        if (e.key === null || watched.has(e.key)) onExternalChange();
      };
      try {
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
      } catch {
        return () => {};
      }
    },
  };
}

let adapter: StorageAdapter = createLocalStorageLabsAdapter();

export interface LabsConfig {
  /** Dónde guardan los laboratorios su estado. Por defecto, localStorage. */
  storage?: StorageAdapter;
  /** Pestaña Python: carpeta de Pyodide, clave de los borradores y aislamiento entre orígenes. */
  python?: PythonLabConfig;
}

/**
 * Configura los laboratorios desde la app anfitriona. Llámala antes de montar LabsRoutes. Cada
 * llamada sustituye a la anterior: lo que no se pasa vuelve al valor por defecto.
 */
export function configureLabs(config: LabsConfig = {}): void {
  adapter = config.storage ?? createLocalStorageLabsAdapter();
  setPythonConfig(config.python);
}

/** Lee un valor guardado, o null si no hay nada o el almacenamiento falla. */
export function readLabItem(key: LabsStorageKey): string | null {
  try {
    const v = adapter.load()?.[key];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Guarda un valor. Si el almacenamiento falla, el laboratorio sigue funcionando en memoria. */
export function writeLabItem(key: LabsStorageKey, value: string): void {
  try {
    const current = adapter.load() ?? {};
    adapter.save({ ...current, [key]: value });
  } catch {
    // almacenamiento no disponible o lleno
  }
}
