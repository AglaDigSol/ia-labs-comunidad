// Utilidades de Node para publicar Pyodide: dependencias del lock, verificación de tamaño y SHA-256 y
// descargas atómicas. Las usan scripts/pyodide-manifest.ts y scripts/vendor-pyodide.ts.
//
// Cadena de integridad: package-lock.json fija node_modules/pyodide (núcleo y pyodide-lock.json); el
// lock fija el SHA-256 de cada wheel; src/features/labs/python/pyodide-manifest.ts (generado y
// versionado) fija el conjunto exacto de archivos con su tamaño; packages.ts fija los wheels extra de
// PyPI con su tamaño y su SHA-256. Cada descarga se escribe en un .part y solo se renombra si cuadran
// el tamaño y el hash.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeName } from "../src/features/labs/python/packages.ts";

export type LockPackage = {
  name: string;
  version: string;
  file_name: string;
  sha256: string;
  depends: string[];
  imports: string[];
  package_type?: string;
};
export type Lock = { info: { version: string; python: string; [k: string]: unknown }; packages: Record<string, LockPackage> };

/** El paquete del lock con ese nombre (sin distinguir «-», «_», «.» ni mayúsculas), o null. */
export function lockEntry(lock: Lock, name: string): [string, LockPackage] | null {
  const n = normalizeName(name);
  for (const [key, pkg] of Object.entries(lock.packages)) if (normalizeName(key) === n) return [key, pkg];
  return null;
}

/** Las raíces y todas sus dependencias, con la clave que tienen en el lock, ordenadas. */
export function lockClosure(lock: Lock, roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const name = stack.pop()!;
    const entry = lockEntry(lock, name);
    if (!entry) throw new Error(`pyodide-lock.json no contiene «${name}»`);
    const [key, pkg] = entry;
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push(...pkg.depends);
  }
  return [...seen].sort();
}

/** El lock con solo los paquetes publicados: así un import de otro paquete da ModuleNotFoundError. */
export function trimLock(lock: Lock, keep: readonly string[]): Lock {
  const set = new Set(keep);
  return { ...lock, packages: Object.fromEntries(Object.entries(lock.packages).filter(([k]) => set.has(k))) };
}

export class IntegrityError extends Error {}
export class NetworkError extends Error {}

/** Nombre de archivo de un manifiesto: sin rutas ni nada raro. */
export function assertPlainFileName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*\.(whl|zip|tar|js|wasm|json)$/.test(name)) throw new IntegrityError(`Nombre de archivo inesperado: ${name}`);
}

export async function sha256File(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest("hex");
}

/** ¿Existe el archivo con ese tamaño y ese SHA-256? */
export async function isVerified(path: string, size: number, sha256: string): Promise<boolean> {
  try {
    const st = await stat(path);
    if (!st.isFile() || st.size !== size) return false;
    return (await sha256File(path)) === sha256;
  } catch {
    return false;
  }
}

/** Lanza IntegrityError si el archivo no tiene el tamaño o el SHA-256 esperados. */
export async function verifyFile(path: string, name: string, size: number, sha256: string): Promise<void> {
  let st;
  try {
    st = await stat(path);
  } catch {
    throw new IntegrityError(`${name}: no existe`);
  }
  if (st.size !== size) throw new IntegrityError(`${name}: ocupa ${st.size} bytes y deberían ser ${size}`);
  const got = await sha256File(path);
  if (got !== sha256) throw new IntegrityError(`${name}: SHA-256 ${got} distinto del esperado ${sha256}`);
}

/**
 * Descarga `url` en `dest` comprobando tamaño y SHA-256 mientras llega. Un error de red lanza
 * NetworkError; unos bytes distintos, IntegrityError. Nunca deja un archivo a medias.
 */
export async function downloadVerified(o: {
  url: string;
  dest: string;
  name: string;
  size: number;
  sha256: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<void> {
  const part = `${o.dest}.part`;
  let res: Response;
  try {
    res = await (o.fetchImpl ?? fetch)(o.url, { signal: AbortSignal.timeout(o.timeoutMs ?? 120_000), redirect: "follow" });
  } catch (e) {
    throw new NetworkError(`${o.name}: sin conexión con ${new URL(o.url).host} (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {});
    throw new NetworkError(`${o.name}: ${new URL(o.url).host} respondió ${res.status}`);
  }
  await mkdir(dirname(o.dest), { recursive: true });
  const fh = await open(part, "w");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        bytes += chunk.byteLength;
        if (bytes > o.size) throw new IntegrityError(`${o.name}: ocupa más de los ${o.size} bytes esperados`);
        hash.update(chunk);
        await fh.write(chunk);
      }
    } catch (e) {
      if (e instanceof IntegrityError) throw e;
      throw new NetworkError(`${o.name}: descarga interrumpida (${e instanceof Error ? e.message : String(e)})`);
    }
    await fh.close();
    if (bytes !== o.size) throw new IntegrityError(`${o.name}: ocupa ${bytes} bytes y deberían ser ${o.size}`);
    const got = hash.digest("hex");
    if (got !== o.sha256) throw new IntegrityError(`${o.name}: SHA-256 ${got} distinto del esperado ${o.sha256}`);
    await rename(part, o.dest);
  } catch (e) {
    await fh.close().catch(() => {});
    await rm(part, { force: true });
    throw e;
  }
}

/** Ejecuta `fn` sobre los elementos con como mucho `limit` a la vez; devuelve todos los resultados. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<Array<PromiseSettledResult<R>>> {
  const out: Array<PromiseSettledResult<R>> = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]!) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const fmtMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;
