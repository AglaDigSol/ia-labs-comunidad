// Publica Pyodide junto al sitio estático, solo si la pestaña Python está encendida (LABS_PYTHON=1 o
// config.modules.python). Se ejecuta en `npm run build`, después de `vite build`:
//
//   node scripts/vendor-pyodide.ts [dist]
//
// Escribe dist/pyodide/<versión>/: el núcleo copiado de node_modules/pyodide, los wheels del lock y los
// wheels extra de PyPI (packages.ts), y un pyodide-lock.json con solo los paquetes publicados. Cada
// archivo se comprueba (tamaño y SHA-256) contra pyodide-manifest.ts, pyodide-lock.json y
// packages.ts; si algo no cuadra, el build falla. Con Python encendido, un fallo de red también.
//
// Orígenes, en este orden:
//   1. La caché .cache/pyodide/<versión>/ (fuera de git), si el archivo está y está verificado.
//   2. PYODIDE_BASE_URL (por defecto, jsDelivr: https://cdn.jsdelivr.net/pyodide/v<versión>/full/),
//      archivo a archivo. Los wheels extra, de su URL de PyPI.
//   3. Si faltan wheels del lock: la release oficial de GitHub (pyodide-<versión>.tar.bz2, unos
//      390 MB), descomprimida con `tar` (necesita bzip2). PYODIDE_TARBALL=<ruta> usa una ya descargada.
//
// Otras variables: PYODIDE_CACHE_DIR (carpeta de la caché), PYODIDE_RELEASE_URL (otra URL para la
// release) y PYODIDE_FETCH_TIMEOUT_MS (por archivo, 120 000 por defecto). En Node 22, para pasar
// por un proxy HTTPS hace falta NODE_USE_ENV_PROXY=1.
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { EXTRA_WHEELS, LOCK_ROOTS, PYODIDE_VERSION } from "../src/features/labs/python/packages.ts";
import { PYODIDE_CORE, PYODIDE_LOCK_SHA256, PYODIDE_PACKAGES } from "../src/features/labs/python/pyodide-manifest.ts";
import {
  assertPlainFileName,
  downloadVerified,
  fmtMB,
  IntegrityError,
  isVerified,
  lockClosure,
  mapLimit,
  NetworkError,
  sha256File,
  trimLock,
  verifyFile,
  type Lock,
} from "./pyodide-lib.ts";
import { pythonEnabled } from "./python-flag.ts";

const run = promisify(execFile);

/** Un archivo que hay que publicar, con su origen remoto. */
export type VendorFile = { file: string; size: number; sha256: string; url: string; source: "lock" | "pypi" };

export const DEFAULT_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const DEFAULT_RELEASE_URL = `https://github.com/pyodide/pyodide/releases/download/${PYODIDE_VERSION}/pyodide-${PYODIDE_VERSION}.tar.bz2`;

/** Solo https y sin credenciales; siempre con barra final. */
export function validateBaseUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error(`PYODIDE_BASE_URL no es una URL válida: «${raw}»`);
  }
  if (u.protocol !== "https:" || u.username || u.password) throw new Error("PYODIDE_BASE_URL debe ser una URL https sin credenciales");
  u.search = "";
  u.hash = "";
  return u.href.endsWith("/") ? u.href : `${u.href}/`;
}

/**
 * Los wheels que hay que publicar: los del lock (según el manifiesto) y los extra de PyPI. Comprueba
 * que el manifiesto sigue al lock de node_modules: mismas raíces, mismos archivos, mismos hashes.
 */
export function vendorPlan(lock: Lock, baseUrl: string): VendorFile[] {
  const keys = lockClosure(lock, LOCK_ROOTS);
  const manifestNames = PYODIDE_PACKAGES.map((p) => p.name).sort();
  if (keys.join("\n") !== manifestNames.join("\n")) {
    throw new IntegrityError("pyodide-manifest.ts no coincide con pyodide-lock.json y LOCK_ROOTS: regenera el manifiesto (scripts/pyodide-manifest.ts)");
  }
  const files: VendorFile[] = PYODIDE_PACKAGES.map((p) => {
    const l = lock.packages[p.name]!;
    if (l.file_name !== p.file || l.sha256 !== p.sha256) throw new IntegrityError(`${p.file}: el manifiesto no coincide con pyodide-lock.json`);
    assertPlainFileName(p.file);
    return { file: p.file, size: p.size, sha256: p.sha256, url: new URL(p.file, baseUrl).href, source: "lock" };
  });
  for (const w of EXTRA_WHEELS) {
    assertPlainFileName(w.file);
    const u = new URL(w.url);
    if (u.protocol !== "https:" || u.host !== "files.pythonhosted.org") throw new IntegrityError(`${w.file}: la URL debe ser de files.pythonhosted.org`);
    if (!u.pathname.endsWith(`/${w.file}`)) throw new IntegrityError(`${w.file}: la URL no termina en el nombre del archivo`);
    files.push({ file: w.file, size: w.size, sha256: w.sha256, url: w.url, source: "pypi" });
  }
  return files;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Saca de la release oficial los archivos que faltan y los deja en la caché, verificados. */
async function fromRelease(missing: VendorFile[], cacheDir: string, timeoutMs: number): Promise<void> {
  const local = process.env.PYODIDE_TARBALL?.trim();
  const tarball = local ? resolve(local) : join(cacheDir, "..", `pyodide-${PYODIDE_VERSION}.tar.bz2`);
  if (!local && !(await exists(tarball))) {
    const url = process.env.PYODIDE_RELEASE_URL?.trim() || DEFAULT_RELEASE_URL;
    console.log(`Pyodide: descargando la release oficial (${new URL(url).host}, unos 390 MB)…`);
    const part = `${tarball}.part`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(Math.max(timeoutMs, 30 * 60_000)), redirect: "follow" });
    } catch (e) {
      throw new NetworkError(`release de Pyodide: sin conexión con ${new URL(url).host} (${e instanceof Error ? e.message : String(e)})`);
    }
    if (!res.ok || !res.body) throw new NetworkError(`release de Pyodide: ${new URL(url).host} respondió ${res.status}`);
    try {
      const { createWriteStream } = await import("node:fs");
      const { pipeline } = await import("node:stream/promises");
      const { Readable } = await import("node:stream");
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(part));
      await rename(part, tarball);
    } catch (e) {
      await rm(part, { force: true });
      throw new NetworkError(`release de Pyodide: descarga interrumpida (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const tmp = await mkdtemp(join(cacheDir, "..", "extract-"));
  try {
    await run("tar", ["-xjf", tarball, "-C", tmp, ...missing.map((f) => `pyodide/${f.file}`)], { maxBuffer: 16 * 1024 * 1024 });
    for (const f of missing) {
      const src = join(tmp, "pyodide", f.file);
      await verifyFile(src, f.file, f.size, f.sha256);
      await rename(src, join(cacheDir, f.file));
    }
  } catch (e) {
    if (e instanceof IntegrityError) throw e;
    throw new NetworkError(`release de Pyodide: no se pudo extraer con tar (${e instanceof Error ? e.message : String(e)})`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
    if (!local) await rm(tarball, { force: true });
  }
}

export type VendorOptions = {
  outDir: string;
  pkgDir: string;
  cacheDir: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Si false, no recurre a la release de GitHub (pruebas). */
  releaseFallback?: boolean;
  log?: (msg: string) => void;
};

export type VendorResult = { dest: string; files: number; bytes: number; downloaded: string[] };

export async function vendorPyodide(o: VendorOptions): Promise<VendorResult> {
  const log = o.log ?? console.log;
  const pkg = JSON.parse(await readFile(join(o.pkgDir, "package.json"), "utf8")) as { version: string };
  if (pkg.version !== PYODIDE_VERSION) throw new IntegrityError(`node_modules/pyodide es ${pkg.version} y se esperaba ${PYODIDE_VERSION} (¿npm ci?)`);
  const lockPath = join(o.pkgDir, "pyodide-lock.json");
  if ((await sha256File(lockPath)) !== PYODIDE_LOCK_SHA256) throw new IntegrityError("pyodide-lock.json de node_modules no es el del manifiesto");
  const lock = JSON.parse(await readFile(lockPath, "utf8")) as Lock;
  const plan = vendorPlan(lock, validateBaseUrl(o.baseUrl));

  const dest = join(o.outDir, "pyodide", PYODIDE_VERSION);
  await rm(join(o.outDir, "pyodide"), { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await mkdir(o.cacheDir, { recursive: true });

  // 1) Núcleo: de node_modules/pyodide, fijado por package-lock.json.
  let bytes = 0;
  for (const f of PYODIDE_CORE) {
    const src = join(o.pkgDir, f.file);
    await verifyFile(src, f.file, f.size, f.sha256);
    await copyFile(src, join(dest, f.file));
    bytes += f.size;
  }

  // 2) Wheels: de la caché o descargados (y verificados) a la caché.
  const todo: VendorFile[] = [];
  for (const f of plan) if (!(await isVerified(join(o.cacheDir, f.file), f.size, f.sha256))) todo.push(f);
  const downloaded: string[] = [];
  if (todo.length > 0) log(`Pyodide: descargando ${todo.length} paquetes (${fmtMB(todo.reduce((s, f) => s + f.size, 0))})…`);
  const results = await mapLimit(todo, 6, (f) =>
    downloadVerified({ url: f.url, dest: join(o.cacheDir, f.file), name: f.file, size: f.size, sha256: f.sha256, fetchImpl: o.fetchImpl, timeoutMs: o.timeoutMs }),
  );
  const failed: Array<{ file: VendorFile; error: unknown }> = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") downloaded.push(todo[i]!.file);
    else failed.push({ file: todo[i]!, error: r.reason });
  });
  const integrity = failed.find((x) => x.error instanceof IntegrityError);
  if (integrity) throw integrity.error;
  const other = failed.find((x) => !(x.error instanceof NetworkError));
  if (other) throw other.error;
  if (failed.length > 0) {
    const fromPypi = failed.filter((x) => x.file.source === "pypi");
    if (fromPypi.length > 0) throw fromPypi[0]!.error;
    if (o.releaseFallback === false) throw failed[0]!.error;
    log(`Pyodide: ${new URL(o.baseUrl).host} no responde (${failed.length} paquetes); se usa la release oficial de GitHub.`);
    await fromRelease(
      failed.map((x) => x.file),
      o.cacheDir,
      o.timeoutMs,
    );
    downloaded.push(...failed.map((x) => x.file.file));
  }

  for (const f of plan) {
    const src = join(o.cacheDir, f.file);
    await verifyFile(src, f.file, f.size, f.sha256);
    await copyFile(src, join(dest, f.file));
    bytes += f.size;
  }

  // 3) El lock, con solo lo publicado: un import de otro paquete da ModuleNotFoundError en vez de un 404.
  const trimmed = `${JSON.stringify(trimLock(lock, PYODIDE_PACKAGES.map((p) => p.name)))}\n`;
  await writeFile(join(dest, "pyodide-lock.json"), trimmed);
  bytes += Buffer.byteLength(trimmed);

  return { dest, files: PYODIDE_CORE.length + plan.length + 1, bytes, downloaded };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const outDir = resolve(process.argv[2] ?? join(root, "dist"));
  let enabled: boolean;
  try {
    enabled = pythonEnabled();
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  if (!enabled) {
    await rm(join(outDir, "pyodide"), { recursive: true, force: true });
    console.log("Python desactivado: no se publica Pyodide (LABS_PYTHON=1 lo activa).");
  } else {
    const timeout = Number(process.env.PYODIDE_FETCH_TIMEOUT_MS);
    try {
      const r = await vendorPyodide({
        outDir,
        pkgDir: join(root, "node_modules", "pyodide"),
        cacheDir: resolve(process.env.PYODIDE_CACHE_DIR?.trim() || join(root, ".cache", "pyodide", PYODIDE_VERSION)),
        baseUrl: process.env.PYODIDE_BASE_URL?.trim() || DEFAULT_BASE_URL,
        timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 120_000,
      });
      console.log(`Pyodide ${PYODIDE_VERSION}: ${r.files} archivos (${fmtMB(r.bytes)}) en ${r.dest}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof IntegrityError) {
        console.error(`Error de integridad al publicar Python: ${msg}. No se publica nada: revisa el origen o regenera el manifiesto.`);
      } else if (e instanceof NetworkError) {
        console.error(
          `No se pudieron descargar los paquetes de Python (LABS_PYTHON=1): ${msg}. Comprueba la conexión (o PYODIDE_BASE_URL / PYODIDE_TARBALL) o construye sin Python (LABS_PYTHON=0).`,
        );
      } else {
        console.error(`Error al publicar Python: ${msg}`);
      }
      await rm(join(outDir, "pyodide"), { recursive: true, force: true });
      process.exit(1);
    }
  }
}
