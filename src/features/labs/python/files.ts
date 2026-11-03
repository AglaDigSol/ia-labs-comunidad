// Archivos de la pestaña Python: lo que se sube va a la carpeta de trabajo del sistema de archivos
// virtual de Pyodide (en memoria, dentro del navegador), así que open("datos.txt") o
// pd.read_csv("datos.csv") los encuentran sin ruta. Nada sale del dispositivo.
// Una app anfitriona también puede escribir archivos (writeFiles en sus ranuras), con carpetas
// ("datos/ventas.csv") y de cualquier tipo; los límites son los mismos para todos y se configuran
// con configureLabs({ python: { maxTotalBytes, maxFileBytes, maxFiles } }).
import { fileLimits, type FileLimits } from "./python-config.ts";

export { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "./python-config.ts";

/** Ruta del anfitrión: como mucho MAX_PATH_DEPTH partes de MAX_SEGMENT caracteres y MAX_PATH en total. */
export const MAX_PATH = 400;
export const MAX_PATH_DEPTH = 8;
export const MAX_SEGMENT = 120;

/** Extensiones admitidas: datos de texto e imágenes. */
export const UPLOAD_EXTENSIONS = [".csv", ".tsv", ".txt", ".json", ".md", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"] as const;
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.join(",");

/** Un archivo de la carpeta de trabajo. `name` es su ruta relativa ("datos.csv" o "datos/ventas.csv"). */
export type FileInfo = { name: string; size: number };

const isControl = (ch: string) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127;
const RESERVED = '<>:"|?*';

/**
 * Nombre seguro para la carpeta de trabajo: solo el nombre (sin ruta), sin caracteres de control ni
 * separadores, sin punto inicial y de 120 caracteres como mucho. null si no queda nada usable.
 */
export function safeFileName(raw: string): string | null {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = [...base.normalize("NFC")]
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || '<>:"|?*'.includes(ch) ? "_" : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (name.length > 120) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : "";
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name === "" || name === "." || name === ".." ? null : name;
}

/**
 * Ruta relativa segura dentro de la carpeta de trabajo, o null. No se arregla nada: se rechaza la ruta
 * absoluta, la barra invertida, los caracteres de control y <>:"|?*, las partes vacías, «.» y «..»,
 * las que empiezan por punto o tienen espacios en los extremos, y las demasiado largas o profundas.
 */
export function safeFilePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.normalize("NFC");
  if (path === "" || path.length > MAX_PATH || path.startsWith("/") || path.includes("\\")) return null;
  if ([...path].some((ch) => isControl(ch) || RESERVED.includes(ch))) return null;
  const parts = path.split("/");
  if (parts.length > MAX_PATH_DEPTH) return null;
  for (const part of parts) {
    if (part === "" || part.startsWith(".") || part.length > MAX_SEGMENT || part.trim() !== part) return null;
  }
  return path;
}

/** Una ruta para mostrarla en un mensaje: sin caracteres de control y de 80 caracteres como mucho. */
function shown(raw: unknown): string {
  const text = [...String(raw)].map((ch) => (isControl(ch) ? "?" : ch)).join("");
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

const hasAllowedExtension = (name: string) => UPLOAD_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

export const fmtBytes = (n: number) =>
  n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
    : n >= 1024
      ? `${Math.round(n / 1024)} KB`
      : `${n} B`;

export type UploadCheck =
  | { ok: true; name: string; replaces: boolean }
  | { ok: false; reason: "name" | "type" | "size" | "total" | "count"; message: string };

export type HostFileCheck =
  | { ok: true; name: string; replaces: boolean }
  | { ok: false; reason: "name" | "size" | "total" | "count"; message: string };

/**
 * Límites comunes: tamaño, número y total. Un archivo con la misma ruta sustituye al anterior (su
 * tamaño deja de contar para el total). Una ruta no puede ser a la vez archivo y carpeta.
 */
function checkLimits(existing: readonly FileInfo[], name: string, size: number, limits: FileLimits): HostFileCheck {
  const clash = existing.find((f) => f.name.startsWith(`${name}/`) || name.startsWith(`${f.name}/`));
  if (clash) {
    return { ok: false, reason: "name", message: `«${name}» choca con «${clash.name}»: una ruta no puede ser archivo y carpeta a la vez.` };
  }
  if (size > limits.maxFileBytes) {
    return { ok: false, reason: "size", message: `«${name}» ocupa ${fmtBytes(size)}; el máximo por archivo es ${fmtBytes(limits.maxFileBytes)}.` };
  }
  const replaces = existing.some((f) => f.name === name);
  const others = existing.filter((f) => f.name !== name);
  if (!replaces && others.length >= limits.maxFiles) {
    return { ok: false, reason: "count", message: `Como mucho ${limits.maxFiles} archivos. Borra alguno con «Vaciar archivos».` };
  }
  const total = others.reduce((s, f) => s + f.size, 0) + size;
  if (total > limits.maxTotalBytes) {
    return {
      ok: false,
      reason: "total",
      message: `Con «${name}» los archivos sumarían ${fmtBytes(total)}; el máximo en total es ${fmtBytes(limits.maxTotalBytes)}.`,
    };
  }
  return { ok: true, name, replaces };
}

/**
 * ¿Se puede añadir este archivo subido a los que ya hay? Solo el nombre (sin ruta) y solo los tipos
 * de UPLOAD_EXTENSIONS.
 */
export function checkUpload(existing: readonly FileInfo[], file: { name: string; size: number }, limits: FileLimits = fileLimits()): UploadCheck {
  const name = safeFileName(file.name);
  if (!name) return { ok: false, reason: "name", message: "El archivo no tiene un nombre válido." };
  if (!hasAllowedExtension(name)) {
    return {
      ok: false,
      reason: "type",
      message: `«${name}» no es un tipo admitido. Sube CSV, TSV, TXT, JSON, MD o imágenes (PNG, JPG, GIF, BMP, WebP).`,
    };
  }
  return checkLimits(existing, name, file.size, limits);
}

/** ¿Se puede escribir este archivo del anfitrión? Ruta relativa con carpetas y cualquier extensión. */
export function checkHostFile(existing: readonly FileInfo[], file: { path: unknown; size: number }, limits: FileLimits = fileLimits()): HostFileCheck {
  const name = safeFilePath(file.path);
  if (!name) return { ok: false, reason: "name", message: `«${shown(file.path)}» no es una ruta válida dentro de la carpeta de trabajo.` };
  return checkLimits(existing, name, file.size, limits);
}

/** El último tramo de una ruta: el nombre con el que se descarga. */
export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Tipo MIME para descargar un archivo que escribió el código (HTML, SVG y el resto, como binario). */
export function mimeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
