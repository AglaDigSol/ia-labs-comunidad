// Archivos de la pestaña Python: lo que se sube va a la carpeta de trabajo del sistema de archivos
// virtual de Pyodide (en memoria, dentro del navegador), así que open("datos.txt") o
// pd.read_csv("datos.csv") los encuentran sin ruta. Nada sale del dispositivo.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 30;

/** Extensiones admitidas: datos de texto e imágenes. */
export const UPLOAD_EXTENSIONS = [".csv", ".tsv", ".txt", ".json", ".md", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"] as const;
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.join(",");

export type FileInfo = { name: string; size: number };

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

/**
 * ¿Se puede añadir este archivo a los ya subidos? Un archivo con el mismo nombre sustituye al anterior
 * (su tamaño deja de contar para el total).
 */
export function checkUpload(existing: readonly FileInfo[], file: { name: string; size: number }): UploadCheck {
  const name = safeFileName(file.name);
  if (!name) return { ok: false, reason: "name", message: "El archivo no tiene un nombre válido." };
  if (!hasAllowedExtension(name)) {
    return {
      ok: false,
      reason: "type",
      message: `«${name}» no es un tipo admitido. Sube CSV, TSV, TXT, JSON, MD o imágenes (PNG, JPG, GIF, BMP, WebP).`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: "size", message: `«${name}» ocupa ${fmtBytes(file.size)}; el máximo por archivo es ${fmtBytes(MAX_FILE_BYTES)}.` };
  }
  const replaces = existing.some((f) => f.name === name);
  const others = existing.filter((f) => f.name !== name);
  if (!replaces && others.length >= MAX_FILES) {
    return { ok: false, reason: "count", message: `Como mucho ${MAX_FILES} archivos. Borra alguno con «Vaciar archivos».` };
  }
  const total = others.reduce((s, f) => s + f.size, 0) + file.size;
  if (total > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      reason: "total",
      message: `Con «${name}» los archivos subidos sumarían ${fmtBytes(total)}; el máximo en total es ${fmtBytes(MAX_TOTAL_BYTES)}.`,
    };
  }
  return { ok: true, name, replaces };
}

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
