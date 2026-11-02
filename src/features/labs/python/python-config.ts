// Configuración de la pestaña Python. La app independiente usa los valores por defecto; una app
// anfitriona la cambia con configureLabs({ python: { … } }) antes de montar los laboratorios.
import { PYODIDE_VERSION } from "./packages.ts";

export interface PythonLabConfig {
  /**
   * URL (absoluta o relativa al documento) de la carpeta con los archivos de Pyodide de esta versión:
   * pyodide.asm.js, pyodide.asm.wasm, python_stdlib.zip, pyodide-lock.json y los wheels. Por defecto,
   * `<base del sitio>pyodide/0.27.7/`, que es donde los deja `npm run build` con LABS_PYTHON=1.
   */
  assetBaseUrl?: string;
  /** Clave de localStorage de los borradores de «Abrir en Python». Por defecto, "ia-labs.py.drafts". */
  draftsKey?: string;
  /**
   * ¿Hay aislamiento entre orígenes (COOP same-origin + COEP require-corp)? Con él, «Detener»
   * interrumpe Python sin perder las variables; sin él, reinicia el intérprete. Por defecto, "auto"
   * (lo que diga crossOriginIsolated en el navegador).
   */
  crossOriginIsolated?: boolean | "auto";
}

export const DEFAULT_DRAFTS_KEY = "ia-labs.py.drafts";

let current: PythonLabConfig = {};

/** La llama configureLabs; sin argumento vuelve a los valores por defecto. */
export function setPythonConfig(config: PythonLabConfig = {}): void {
  current = { ...config };
}

/** Base del sitio según Vite ("/" o "/labs/"); en una app anfitriona, la suya. */
function siteBase(): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** URL absoluta de la carpeta de Pyodide, siempre con barra final (el worker la necesita absoluta). */
export function pyodideBaseUrl(): string {
  const raw = current.assetBaseUrl?.trim() || `${siteBase()}pyodide/${PYODIDE_VERSION}/`;
  const withSlash = raw.endsWith("/") ? raw : `${raw}/`;
  const origin = typeof location === "undefined" ? "http://localhost/" : location.href;
  return new URL(withSlash, origin).href;
}

export function draftsKey(): string {
  return current.draftsKey?.trim() || DEFAULT_DRAFTS_KEY;
}

export function isolationAvailable(): boolean {
  const v = current.crossOriginIsolated ?? "auto";
  if (v === "auto") return globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer === "function";
  return v && typeof SharedArrayBuffer === "function";
}
