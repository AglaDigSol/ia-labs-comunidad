// Interfaz de almacenamiento. Hoy la única implementación es localStorage (los datos viven en el
// navegador); detrás de esta interfaz se podrá poner más adelante una con cuentas y sincronización
// sin tocar los componentes, que solo usan kv-store.ts.
export interface StorageAdapter {
  /** Lee el mapa completo clave → valor, o null si no hay nada guardado o no se puede leer. */
  load(): Record<string, unknown> | null;
  /** Guarda el mapa completo. Devuelve false si no se pudo (cuota, modo privado…). */
  save(data: Record<string, unknown>): boolean;
  /** Avisa cuando los datos cambian fuera de esta pestaña. Devuelve la función para dejar de escuchar. */
  subscribe(onExternalChange: () => void): () => void;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  private storage(): Storage | null {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  }

  load(): Record<string, unknown> | null {
    try {
      const raw = this.storage()?.getItem(this.key) ?? null;
      if (raw === null) return null;
      const data = JSON.parse(raw) as unknown;
      return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  save(data: Record<string, unknown>): boolean {
    try {
      const s = this.storage();
      if (!s) return false;
      s.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  subscribe(onExternalChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key === this.key || e.key === null) onExternalChange();
    };
    try {
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    } catch {
      return () => {};
    }
  }
}

/** Implementación en memoria: útil en tests o si el navegador bloquea el almacenamiento. */
export class MemoryAdapter implements StorageAdapter {
  private data: Record<string, unknown> | null = null;
  load() {
    return this.data ? { ...this.data } : null;
  }
  save(data: Record<string, unknown>) {
    this.data = { ...data };
    return true;
  }
  subscribe() {
    return () => {};
  }
}
