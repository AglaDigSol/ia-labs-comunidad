// Configuración de la pestaña Python. La app independiente usa los valores por defecto; una app
// anfitriona la cambia con configureLabs({ python: { … } }) antes de montar los laboratorios.
// Este módulo va en el chunk de entrada del anfitrión (con configureLabs): solo importa version.ts
// y tipos, nunca packages.ts ni el resto de la pestaña.
import type { ReactNode } from "react";
import type { Draft } from "./drafts.ts";
import type { FileInfo } from "./files.ts";
import { PYODIDE_VERSION } from "./version.ts";

const MB = 1024 * 1024;
/** Límites por defecto de la carpeta de trabajo (archivos subidos y del anfitrión, juntos). */
export const MAX_FILE_BYTES = 20 * MB;
export const MAX_TOTAL_BYTES = 50 * MB;
export const MAX_FILES = 30;
/** Lo más que puede pedir un anfitrión: todo vive en la memoria del navegador (y otra copia en Python). */
export const CAP_FILE_BYTES = 50 * MB;
export const CAP_TOTAL_BYTES = 200 * MB;
export const CAP_FILES = 500;

export type FileLimits = { maxFileBytes: number; maxTotalBytes: number; maxFiles: number };

/** Un archivo que el anfitrión no pudo escribir y por qué. */
export type SkippedFile = { path: string; reason: "name" | "size" | "total" | "count"; message: string };

/** Lo que devuelve writeFiles: lo escrito (con su ruta) y lo descartado, en el orden recibido. */
export type WriteFilesResult = { written: FileInfo[]; skipped: SkippedFile[] };

/** Archivos de la carpeta de trabajo, para las ranuras del anfitrión. */
export interface PythonFilesApi {
  /**
   * Escribe archivos en la carpeta de trabajo de Python (en memoria; nada se ejecuta). Las rutas son
   * relativas y pueden tener carpetas ("datos/ventas.csv"). Admite cualquier extensión. Una ruta que
   * ya existe se sustituye. Si Python aún no está cargado, se escriben al cargarlo; tras un reinicio
   * se vuelven a escribir, y «Vaciar archivos» los borra.
   */
  writeFiles(files: ReadonlyArray<{ path: string; data: ArrayBuffer | ArrayBufferView }>): Promise<WriteFilesResult>;
  /** Límites efectivos (los de configureLabs, acotados). */
  limits: FileLimits;
  /** Los archivos que muestra ahora la lista «Archivos» (rutas relativas). */
  list(): FileInfo[];
}

export type DraftActionsContext = { draft: Draft; files: PythonFilesApi };
export type FilesActionsContext = { draft: Draft | null; files: PythonFilesApi };

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
  /**
   * Máximo en total de la carpeta de trabajo (archivos subidos y escritos por el anfitrión), en bytes.
   * Por defecto MAX_TOTAL_BYTES (50 MB); como mucho CAP_TOTAL_BYTES (200 MB).
   */
  maxTotalBytes?: number;
  /** Máximo por archivo, en bytes. Por defecto MAX_FILE_BYTES (20 MB); como mucho CAP_FILE_BYTES (50 MB). */
  maxFileBytes?: number;
  /** Número máximo de archivos. Por defecto MAX_FILES (30); como mucho CAP_FILES (500). */
  maxFiles?: number;
  /**
   * Ranura en la banda del borrador abierto (?borrador=): por ejemplo, un botón que escribe los datos
   * del curso con files.writeFiles. Solo se muestra con un borrador.
   */
  renderDraftActions?: (ctx: DraftActionsContext) => ReactNode;
  /** Ranura en la cabecera de «Archivos», con o sin borrador. */
  renderFilesActions?: (ctx: FilesActionsContext) => ReactNode;
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

/** Un límite del anfitrión: entero positivo, acotado a `cap`; si no vale, el de por defecto. */
function limit(v: unknown, fallback: number, cap: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 1) return fallback;
  return Math.min(Math.floor(v), cap);
}

/** Límites efectivos de la carpeta de trabajo. */
export function fileLimits(): FileLimits {
  return {
    maxFileBytes: limit(current.maxFileBytes, MAX_FILE_BYTES, CAP_FILE_BYTES),
    maxTotalBytes: limit(current.maxTotalBytes, MAX_TOTAL_BYTES, CAP_TOTAL_BYTES),
    maxFiles: limit(current.maxFiles, MAX_FILES, CAP_FILES),
  };
}

/** Las ranuras del anfitrión configuradas con configureLabs (las props de PythonLabPage mandan). */
export function pythonSlots(): Pick<PythonLabConfig, "renderDraftActions" | "renderFilesActions"> {
  return { renderDraftActions: current.renderDraftActions, renderFilesActions: current.renderFilesActions };
}

export function draftsKey(): string {
  return current.draftsKey?.trim() || DEFAULT_DRAFTS_KEY;
}

export function isolationAvailable(): boolean {
  const v = current.crossOriginIsolated ?? "auto";
  if (v === "auto") return globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer === "function";
  return v && typeof SharedArrayBuffer === "function";
}
