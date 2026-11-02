// Comprobación tras `vite build` (va en `npm run build`, después de vendor-pyodide.ts):
//
//   node scripts/check-python.ts [dist]
//
// - Siempre: Pyodide nunca está en el chunk de entrada ni en lo que este importa de forma estática
//   (dist/.vite/manifest.json). Se puede llegar a él solo por import() perezoso.
// - Python apagado: ningún archivo de dist/ contiene Pyodide y no hay dist/pyodide/.
// - Python encendido: hay un chunk de worker con el cargador de Pyodide y dist/pyodide/<versión>/
//   tiene todos los archivos del manifiesto con su tamaño.
// Al terminar borra dist/.vite/ (el manifiesto de Vite no se publica).
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRA_WHEELS, PYODIDE_VERSION } from "../src/features/labs/python/packages.ts";
import { PYODIDE_CORE, PYODIDE_PACKAGES } from "../src/features/labs/python/pyodide-manifest.ts";
import { pythonEnabled } from "./python-flag.ts";

type Chunk = { file: string; isEntry?: boolean; imports?: string[] };

/** Texto que solo aparece en el cargador de Pyodide o en su runtime. */
export const PYODIDE_MARKERS = ["loadPyodide", "pyodide.asm"];

export type CheckResult = { ok: true; notes: string[] } | { ok: false; errors: string[] };

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(p.slice(base.length + 1));
  }
  return out;
}

export function checkDist(dist: string, enabled: boolean): CheckResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const manifestPath = join(dist, ".vite", "manifest.json");
  if (!existsSync(manifestPath)) return { ok: false, errors: [`falta ${manifestPath} (build.manifest debe estar activado)`] };
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, Chunk>;

  // Entrada y sus imports estáticos.
  const seen = new Set<string>();
  const stack = Object.keys(manifest).filter((k) => manifest[k]!.isEntry === true);
  if (stack.length === 0) errors.push("el manifiesto de Vite no tiene chunk de entrada");
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const imp of manifest[key]?.imports ?? []) stack.push(imp);
  }
  for (const key of seen) {
    const chunk = manifest[key];
    if (!chunk || !/\.m?js$/.test(chunk.file)) continue;
    const text = readFileSync(join(dist, chunk.file), "utf8");
    for (const m of PYODIDE_MARKERS) if (text.includes(m)) errors.push(`Pyodide en el grafo de entrada: ${chunk.file} contiene «${m}»`);
  }

  const scripts = listFiles(join(dist, "assets")).filter((f) => /\.m?js$/.test(f));
  const withPyodide = scripts.filter((f) => readFileSync(join(dist, "assets", f), "utf8").includes("loadPyodide"));
  const pyodideDir = join(dist, "pyodide");
  if (!enabled) {
    for (const f of withPyodide) errors.push(`Python apagado, pero assets/${f} contiene Pyodide`);
    const python = scripts.filter((f) => /^PythonLabPage-|^py\.worker-/.test(f));
    for (const f of python) errors.push(`Python apagado, pero se ha generado assets/${f}`);
    if (existsSync(pyodideDir)) errors.push("Python apagado, pero existe dist/pyodide/");
    notes.push("Python apagado: sin chunks ni archivos de Pyodide.");
  } else {
    const workers = withPyodide.filter((f) => /^py\.worker-[\w-]+\.js$/.test(f));
    if (workers.length !== 1) errors.push(`se esperaba un worker assets/py.worker-*.js con Pyodide y hay ${workers.length}: ${withPyodide.join(", ")}`);
    else notes.push(`worker de Pyodide: assets/${workers[0]}`);
    const dir = join(pyodideDir, PYODIDE_VERSION);
    const expected = [...PYODIDE_CORE, ...PYODIDE_PACKAGES, ...EXTRA_WHEELS];
    for (const f of expected) {
      const p = join(dir, f.file);
      if (!existsSync(p)) errors.push(`falta dist/pyodide/${PYODIDE_VERSION}/${f.file}`);
      else if (statSync(p).size !== f.size) errors.push(`dist/pyodide/${PYODIDE_VERSION}/${f.file} no tiene el tamaño del manifiesto`);
    }
    if (!existsSync(join(dir, "pyodide-lock.json"))) errors.push(`falta dist/pyodide/${PYODIDE_VERSION}/pyodide-lock.json`);
    const extra = listFiles(dir).filter((f) => f !== "pyodide-lock.json" && !expected.some((e) => e.file === f));
    for (const f of extra) errors.push(`archivo inesperado en dist/pyodide/${PYODIDE_VERSION}/: ${f}`);
    notes.push(`dist/pyodide/${PYODIDE_VERSION}/: ${expected.length + 1} archivos`);
  }
  notes.unshift(`${seen.size} chunks en el grafo de entrada, sin Pyodide.`);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, notes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dist = resolve(process.argv[2] ?? join(root, "dist"));
  const r = checkDist(dist, pythonEnabled());
  rmSync(join(dist, ".vite"), { recursive: true, force: true });
  if (!r.ok) {
    for (const e of r.errors) console.error(`check-python: ${e}`);
    process.exit(1);
  }
  for (const n of r.notes) console.log(`check-python: ${n}`);
}
