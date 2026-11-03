// Ejecuta el código Python de los ejercicios y del paso a paso con el python3 del sistema, para
// probar la lógica que en la app corre en Pyodide (es Python puro). Si no hay python3, las pruebas
// que lo usan se saltan (hasPython3).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const hasPython3 = (() => {
  try {
    return spawnSync("python3", ["-c", "import sys; assert sys.version_info >= (3, 12)"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
})();

export type Job = { fn: string; payload: unknown; files?: Array<{ path: string; text: string }> };

// Cada trabajo corre en su propia carpeta (con sus archivos) y su resultado (un str con JSON) se
// recoge en una lista. Un solo proceso para muchos trabajos: así las pruebas tardan poco.
const DRIVER = `
import json, os, sys
_jobs = json.load(open(sys.argv[2], encoding="utf-8"))
exec(open(sys.argv[1], encoding="utf-8").read())
_out = []
for _job in _jobs:
    os.chdir(_job["dir"])
    _out.append(json.loads(globals()[_job["fn"]](_job["payload"])))
sys.stdout.write(json.dumps(_out))
`;

/** Ejecuta `source` (que define las funciones) y llama a cada fn(payload) en su carpeta. */
export function runJobs<T = unknown>(source: string, jobs: Job[], timeoutMs = 120_000): T[] {
  const root = mkdtempSync(join(tmpdir(), "labs-py-"));
  try {
    const src = join(root, "fuente.py");
    const list = join(root, "trabajos.json");
    writeFileSync(src, source);
    const meta = jobs.map((job, i) => {
      const dir = join(root, `t${i}`);
      mkdirSync(dir);
      for (const f of job.files ?? []) {
        mkdirSync(dirname(join(dir, f.path)), { recursive: true });
        writeFileSync(join(dir, f.path), f.text);
      }
      return { dir, fn: job.fn, payload: job.payload };
    });
    writeFileSync(list, JSON.stringify(meta));
    const driver = join(root, "driver.py");
    writeFileSync(driver, DRIVER);
    const r = spawnSync("python3", ["-I", driver, src, list], { encoding: "utf8", timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`python3 falló (${r.status}): ${r.stderr.slice(0, 2000)}`);
    return JSON.parse(r.stdout) as T[];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
