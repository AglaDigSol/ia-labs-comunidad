// Genera src/features/labs/python/pyodide-manifest.ts: el conjunto exacto de archivos de Pyodide que
// se publica con la pestaña Python, con su tamaño y su SHA-256. Se ejecuta al subir la versión de
// pyodide (o al cambiar LOCK_ROOTS en packages.ts) y el resultado se versiona:
//
//   node scripts/pyodide-manifest.ts <carpeta con los wheels>
//
// La carpeta puede ser la caché del build (.cache/pyodide/<versión>/) o la carpeta pyodide/ de la
// release oficial (pyodide-<versión>.tar.bz2 de GitHub). pyodide-lock.json no trae tamaños: se miden
// de esos archivos, después de comprobar que su SHA-256 es el del lock.
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCK_ROOTS, PYODIDE_PYTHON, PYODIDE_VERSION, type CoreAsset, type LockAsset } from "../src/features/labs/python/packages.ts";
import { assertPlainFileName, lockClosure, type Lock } from "./pyodide-lib.ts";

/** Archivos del núcleo que se publican; pyodide.mjs no, porque Vite lo mete dentro del worker. */
export const CORE_FILES = ["pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip"] as const;

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

export function buildManifest(pkgDir: string, wheelsDir: string): { core: CoreAsset[]; packages: LockAsset[]; lockSha256: string } {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version: string };
  if (pkg.version !== PYODIDE_VERSION) throw new Error(`node_modules/pyodide es ${pkg.version}; packages.ts dice ${PYODIDE_VERSION}`);
  const lockBuf = readFileSync(join(pkgDir, "pyodide-lock.json"));
  const lock = JSON.parse(lockBuf.toString("utf8")) as Lock;
  if (lock.info.python !== PYODIDE_PYTHON) throw new Error(`El lock es de Python ${lock.info.python}; packages.ts dice ${PYODIDE_PYTHON}`);

  const core = CORE_FILES.map((file) => {
    const buf = readFileSync(join(pkgDir, file));
    return { file, size: buf.byteLength, sha256: sha256(buf) };
  });

  const packages = lockClosure(lock, LOCK_ROOTS).map((key): LockAsset => {
    const p = lock.packages[key]!;
    assertPlainFileName(p.file_name);
    const path = join(wheelsDir, p.file_name);
    const buf = readFileSync(path);
    if (sha256(buf) !== p.sha256) throw new Error(`${p.file_name}: el SHA-256 no es el de pyodide-lock.json`);
    return { name: key, file: p.file_name, size: statSync(path).size, sha256: p.sha256, depends: [...p.depends].sort() };
  });
  return { core, packages, lockSha256: sha256(lockBuf) };
}

export function serializeManifest(m: ReturnType<typeof buildManifest>): string {
  const total = m.core.reduce((s, f) => s + f.size, 0) + m.packages.reduce((s, p) => s + p.size, 0);
  const line = (o: object) => `  ${JSON.stringify(o)},`;
  return [
    "// Generado por scripts/pyodide-manifest.ts: no lo edites a mano.",
    `// Archivos de Pyodide ${PYODIDE_VERSION} que se publican en dist/pyodide/${PYODIDE_VERSION}/ con la pestaña Python:`,
    `// ${m.core.length} del núcleo (de node_modules/pyodide) y ${m.packages.length} paquetes del lock (${(total / 1e6).toFixed(1)} MB en total,`,
    "// sin los wheels extra de packages.ts). Tamaños en bytes; SHA-256 de node_modules y de pyodide-lock.json.",
    'import type { CoreAsset, LockAsset } from "./packages.ts";',
    "",
    "/** SHA-256 del pyodide-lock.json de node_modules/pyodide. */",
    `export const PYODIDE_LOCK_SHA256 = ${JSON.stringify(m.lockSha256)};`,
    "",
    "export const PYODIDE_CORE: readonly CoreAsset[] = [",
    ...m.core.map(line),
    "];",
    "",
    "export const PYODIDE_PACKAGES: readonly LockAsset[] = [",
    ...m.packages.map(line),
    "];",
    "",
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const wheelsDir = process.argv[2];
  if (!wheelsDir) {
    console.error("Uso: node scripts/pyodide-manifest.ts <carpeta con los wheels de Pyodide>");
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const m = buildManifest(join(root, "node_modules", "pyodide"), resolve(wheelsDir));
  writeFileSync(join(root, "src", "features", "labs", "python", "pyodide-manifest.ts"), serializeManifest(m));
  console.log(`pyodide-manifest.ts: Pyodide ${PYODIDE_VERSION}, ${m.core.length} archivos del núcleo y ${m.packages.length} paquetes`);
}
