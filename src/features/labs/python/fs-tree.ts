// Operaciones del worker sobre la carpeta de trabajo, con carpetas. Reciben el FS de Pyodide (o uno
// falso en las pruebas) y nunca salen de `root`: las rutas son relativas y se comprueban antes de
// tocar nada. Escribir un archivo nunca ejecuta su contenido.
import { MAX_PATH_DEPTH, safeFilePath, type FileInfo } from "./files.ts";

/** Lo que se usa del FS de Emscripten (pyodide.FS). */
export interface TreeFS {
  readdir(path: string): string[];
  stat(path: string): { mode: number; size: number };
  isFile(mode: number): boolean;
  isDir(mode: number): boolean;
  mkdirTree(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
  rmdir(path: string): void;
}

/** Como mucho tantos archivos en la lista (si el código crea miles, no se manda todo). */
export const MAX_LISTED = 1000;

/**
 * Partes de una ruta relativa que se puede leer o borrar, o null. Más permisiva que safeFilePath
 * (el código puede crear «a?.csv»), pero nunca absoluta ni con «.», «..» o partes vacías.
 */
export function relParts(path: unknown): string[] | null {
  if (typeof path !== "string" || path === "" || path.startsWith("/") || path.includes("\\")) return null;
  const parts = path.split("/");
  if (parts.length > MAX_PATH_DEPTH) return null;
  return parts.every((p) => p !== "" && p !== "." && p !== "..") ? parts : null;
}

/**
 * Archivos de la carpeta de trabajo, con su ruta relativa y en orden. Se salta lo oculto (punto
 * inicial: .cache, .config de matplotlib…) y lo que pase de MAX_PATH_DEPTH niveles.
 */
export function listTree(fs: TreeFS, root: string, max = MAX_LISTED): FileInfo[] {
  const out: FileInfo[] = [];
  const walk = (dir: string, prefix: string, depth: number) => {
    for (const name of fs.readdir(dir)) {
      if (out.length >= max) return;
      if (name.startsWith(".")) continue;
      const full = `${dir}/${name}`;
      const st = fs.stat(full);
      if (fs.isFile(st.mode)) out.push({ name: prefix + name, size: st.size });
      else if (fs.isDir(st.mode) && depth < MAX_PATH_DEPTH) walk(full, `${prefix}${name}/`, depth + 1);
    }
  };
  try {
    walk(root, "", 1);
  } catch {
    // una carpeta que desaparece a medias: se devuelve lo que se haya visto
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Escribe un archivo (creando sus carpetas). Lanza si la ruta no es segura o choca con un archivo. */
export function writeTree(fs: TreeFS, root: string, path: string, data: Uint8Array): void {
  const safe = safeFilePath(path);
  if (!safe || safe !== path) throw new Error(`ruta no válida: ${path}`);
  const slash = safe.lastIndexOf("/");
  if (slash > 0) fs.mkdirTree(`${root}/${safe.slice(0, slash)}`);
  fs.writeFile(`${root}/${safe}`, data);
}

/** Lee un archivo; null si no existe, no es un archivo o la ruta no vale. */
export function readTree(fs: TreeFS, root: string, path: string): Uint8Array | null {
  const parts = relParts(path);
  if (!parts) return null;
  try {
    const full = `${root}/${parts.join("/")}`;
    if (!fs.isFile(fs.stat(full).mode)) return null;
    return fs.readFile(full);
  } catch {
    return null;
  }
}

/** Borra las carpetas vacías desde `parts` hacia arriba, sin llegar a `root`. */
function pruneDirs(fs: TreeFS, root: string, parts: string[]): void {
  for (let n = parts.length; n > 0; n--) {
    const dir = `${root}/${parts.slice(0, n).join("/")}`;
    try {
      if (fs.readdir(dir).some((x) => x !== "." && x !== "..")) return;
      fs.rmdir(dir);
    } catch {
      return;
    }
  }
}

/** Borra un archivo y las carpetas que se queden vacías. false si no estaba. */
export function removeTree(fs: TreeFS, root: string, path: string): boolean {
  const parts = relParts(path);
  if (!parts) return false;
  try {
    const full = `${root}/${parts.join("/")}`;
    if (!fs.isFile(fs.stat(full).mode)) return false;
    fs.unlink(full);
  } catch {
    return false;
  }
  pruneDirs(fs, root, parts.slice(0, -1));
  return true;
}

/** «Vaciar archivos»: borra todos los archivos visibles y las carpetas que se queden vacías. */
export function clearTree(fs: TreeFS, root: string): void {
  // Varias pasadas por si hay más de MAX_LISTED; para cuando ya no se borra nada.
  for (;;) {
    const files = listTree(fs, root);
    let removed = 0;
    for (const f of files) if (removeTree(fs, root, f.name)) removed++;
    if (removed === 0 || files.length < MAX_LISTED) return;
  }
}
