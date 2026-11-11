// Instalable y sin conexión (app independiente): registra dist/sw.js (scripts/service-worker.ts) con
// alcance en la base del sitio (VITE_BASE) y cuenta si la app ya funciona sin conexión. La primera vez
// que lo consigue, un aviso «Disponible sin conexión»; el inicio lo muestra siempre que es así.
// No se registra en `npm run dev` ni en las pruebas, ni en una app anfitriona (la entrada del paquete
// no pasa por aquí).
import { useSyncExternalStore } from "react";

export type OfflineState = "unsupported" | "pending" | "ready";

let state: OfflineState = "unsupported";
const listeners = new Set<() => void>();
const set = (next: OfflineState) => {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
};

export const offlineState = (): OfflineState => state;

/** ¿Funciona ya la app sin conexión en este dispositivo? */
export function useOfflineReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state === "ready",
    () => false,
  );
}

export const OFFLINE_READY_MESSAGE = "Disponible sin conexión: la app ya funciona sin internet en este dispositivo.";

export interface RegisterOptions {
  /** Base del sitio, con la barra final (import.meta.env.BASE_URL). */
  base: string;
  /** El navigator.serviceWorker del navegador (inyectable en las pruebas). */
  container?: ServiceWorkerContainer;
  /** Se llama una vez, la primera vez que la app queda disponible sin conexión (no en las visitas siguientes). */
  onFirstReady?: () => void;
}

/** Registra el service worker. Sin soporte, o si falla, la app sigue igual (con conexión). */
export async function registerServiceWorker({ base, container, onFirstReady }: RegisterOptions): Promise<void> {
  const sw = container ?? (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);
  if (!sw) return;
  // Ya controlada por un service worker: esta visita ya era sin conexión.
  const first = !sw.controller;
  set(first ? "pending" : "ready");
  try {
    await sw.register(`${base}sw.js`, { scope: base });
    // `ready` se cumple cuando hay un service worker activo: con la app ya precargada.
    await sw.ready;
    set("ready");
    if (first) onFirstReady?.();
  } catch {
    set("unsupported");
  }
}

/** Solo para las pruebas. */
export function __resetOfflineForTests(): void {
  state = "unsupported";
  listeners.clear();
}
