// Almacén clave-valor local (por defecto, localStorage a través de StorageAdapter). Misma API pública que tenía el almacén sincronizado del
// proyecto original (useKv, useKvPrefix, setKv, deleteKv, readKvPrefix) para que los componentes no
// cambien. No hay servidor: los datos viven solo en este navegador, de ahí «Exportar / Importar».
// Todo acceso a localStorage va envuelto en try/catch (modo privado, cuota llena, almacenamiento
// bloqueado): si falla, la app sigue funcionando en memoria.
import { useCallback, useSyncExternalStore } from "react";
import { validateValue } from "../../shared/keys.ts";
import { LocalStorageAdapter, type StorageAdapter } from "./storage-adapter.ts";

export const STORAGE_KEY = "ia-labs.kv.v1";

const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
const prefixMemo = new Map<string, { version: number; result: Array<{ key: string; value: unknown }> }>();
let version = 0;
let persistError = false;
let adapter: StorageAdapter = new LocalStorageAdapter(STORAGE_KEY);
let unsubscribeAdapter: () => void = () => {};

function persist(): void {
  persistError = !adapter.save(Object.fromEntries(cache));
}

function restore(): void {
  const data = adapter.load();
  if (!data) return;
  for (const [k, v] of Object.entries(data)) {
    if (validateValue(k, v).ok) cache.set(k, v);
  }
}

function listenAdapter(): void {
  unsubscribeAdapter();
  // Otra pestaña cambió los datos: recargar la caché.
  unsubscribeAdapter = adapter.subscribe(() => {
    cache.clear();
    restore();
    emit();
  });
}

/** Cambia la implementación de almacenamiento (por ejemplo, una futura con sincronización). */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
  cache.clear();
  restore();
  listenAdapter();
  emit();
}

function emit(): void {
  version++;
  for (const l of [...listeners]) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** True si el último intento de guardar en localStorage falló (cuota, modo privado…). */
export function lastPersistFailed(): boolean {
  return persistError;
}

export function setKv(key: string, value: unknown): void {
  cache.set(key, value);
  persist();
  emit();
}

export function deleteKv(key: string): void {
  if (!cache.delete(key)) return;
  persist();
  emit();
}

export function useKv<T>(key: string, fallback: T): T {
  const get = useCallback(() => cache.get(key), [key]);
  const value = useSyncExternalStore(subscribe, get, get);
  return value === undefined ? fallback : (value as T);
}

function collect(prefix: string): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of cache) if (key.startsWith(prefix)) result.push({ key, value });
  return result.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Lectura imperativa (misma vista que useKvPrefix), para acciones fuera del render. */
export function readKvPrefix<T>(prefix: string): Array<{ key: string; value: T }> {
  return collect(prefix) as Array<{ key: string; value: T }>;
}

export function useKvPrefix<T>(prefix: string): Array<{ key: string; value: T }> {
  const get = useCallback(() => {
    const memo = prefixMemo.get(prefix);
    if (memo && memo.version === version) return memo.result;
    const result = collect(prefix);
    prefixMemo.set(prefix, { version, result });
    return result;
  }, [prefix]);
  return useSyncExternalStore(subscribe, get, get) as Array<{ key: string; value: T }>;
}

/** Copia de todos los datos guardados (para «Exportar mis datos»). */
export function snapshotKv(): Record<string, unknown> {
  return Object.fromEntries([...cache].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export type ImportReport = { imported: number; skipped: string[] };

/**
 * Sustituye (replace) o combina (merge) los datos con los de una copia. Cada entrada se valida con el
 * mismo esquema que usa la app; las claves desconocidas o los valores inválidos se descartan.
 */
export function importKv(data: Record<string, unknown>, mode: "replace" | "merge"): ImportReport {
  const accepted = new Map<string, unknown>();
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (validateValue(k, v).ok) accepted.set(k, v);
    else skipped.push(k);
  }
  if (mode === "replace") cache.clear();
  for (const [k, v] of accepted) cache.set(k, v);
  persist();
  emit();
  return { imported: accepted.size, skipped };
}

/** Borra todos los datos de la app en este navegador. */
export function clearKv(): void {
  cache.clear();
  persist();
  emit();
}

restore();
listenAdapter();

/** Ayuda para tests: vacía el estado del módulo y el almacenamiento. */
export function __resetKvStoreForTests(): void {
  cache.clear();
  prefixMemo.clear();
  persistError = false;
  adapter.save({});
  try {
    localStorage.clear();
  } catch {
    // sin almacenamiento
  }
  version++;
}
