// Publicación de Pyodide sin red: interruptor LABS_PYTHON, manifiesto frente a pyodide-lock.json,
// wheels extra fijados en PyPI, descargas verificadas (tamaño y SHA-256) y la comprobación del build
// (Pyodide fuera del grafo de entrada; nada de Python con la pestaña apagada).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type Rollup } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { checkDist, PYODIDE_MARKERS } from "../scripts/check-python.ts";
import { CORE_FILES } from "../scripts/pyodide-manifest.ts";
import { downloadVerified, IntegrityError, lockClosure, NetworkError, trimLock, type Lock } from "../scripts/pyodide-lib.ts";
import { configPythonSwitch, pythonEnabled } from "../scripts/python-flag.ts";
import { validateBaseUrl, vendorPlan, vendorPyodide } from "../scripts/vendor-pyodide.ts";
import { EXTRA_WHEELS, extraClosure, extraForImport, LOCK_ROOTS, PYODIDE_PYTHON, PYODIDE_VERSION } from "../src/features/labs/python/packages.ts";
import { PYODIDE_CORE, PYODIDE_LOCK_SHA256, PYODIDE_PACKAGES } from "../src/features/labs/python/pyodide-manifest.ts";

const root = new URL("..", import.meta.url).pathname;
const pkgDir = join(root, "node_modules", "pyodide");
const lockBuf = readFileSync(join(pkgDir, "pyodide-lock.json"));
const lock = JSON.parse(lockBuf.toString("utf8")) as Lock;
const sha = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");
const tmps: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "labs-py-"));
  tmps.push(d);
  return d;
};

afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("LABS_PYTHON", () => {
  it("src/config.ts trae python: false y manda si no hay variable", () => {
    expect(configPythonSwitch(readFileSync(join(root, "src", "config.ts"), "utf8"))).toBe(false);
    expect(pythonEnabled({})).toBe(false);
    expect(pythonEnabled({}, "modules: {\n    python: true,\n}")).toBe(true);
  });

  it("LABS_PYTHON=1/true enciende y 0/false apaga, diga lo que diga config.ts", () => {
    expect(pythonEnabled({ LABS_PYTHON: "1" })).toBe(true);
    expect(pythonEnabled({ LABS_PYTHON: "true" })).toBe(true);
    expect(pythonEnabled({ LABS_PYTHON: "0" }, "python: true,")).toBe(false);
    expect(pythonEnabled({ LABS_PYTHON: "" })).toBe(false);
    expect(() => pythonEnabled({ LABS_PYTHON: "sí" })).toThrow(/LABS_PYTHON debe ser 1 o 0/);
  });
});

describe("manifiesto de Pyodide", () => {
  it(`Pyodide ${PYODIDE_VERSION} con Python ${PYODIDE_PYTHON}, igual que node_modules`, () => {
    expect(PYODIDE_VERSION).toBe("0.27.7");
    expect(PYODIDE_PYTHON).toBe("3.12.7");
    expect(JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version).toBe(PYODIDE_VERSION);
    expect(lock.info).toMatchObject({ version: PYODIDE_VERSION, python: PYODIDE_PYTHON });
    expect(sha(lockBuf)).toBe(PYODIDE_LOCK_SHA256);
  });

  it("el núcleo coincide byte a byte con node_modules/pyodide", () => {
    expect(PYODIDE_CORE.map((f) => f.file)).toEqual([...CORE_FILES]);
    for (const f of PYODIDE_CORE) {
      const buf = readFileSync(join(pkgDir, f.file));
      expect(buf.byteLength, f.file).toBe(f.size);
      expect(sha(buf), f.file).toBe(f.sha256);
    }
  });

  it("los paquetes son las raíces y todas sus dependencias, con el archivo y el SHA-256 del lock", () => {
    const closure = lockClosure(lock, LOCK_ROOTS);
    expect(PYODIDE_PACKAGES.map((p) => p.name).sort()).toEqual(closure);
    for (const p of PYODIDE_PACKAGES) {
      expect(lock.packages[p.name]!.file_name).toBe(p.file);
      expect(lock.packages[p.name]!.sha256).toBe(p.sha256);
      expect(p.size).toBeGreaterThan(0);
    }
    for (const name of ["numpy", "pandas", "matplotlib", "scipy", "scikit-learn", "opencv-python", "statsmodels", "nltk", "micropip", "openblas"]) {
      expect(closure, name).toContain(name);
    }
  });

  it("los wheels extra: Python puro de PyPI, versión exacta, y sus dependencias del lock publicadas", () => {
    expect(EXTRA_WHEELS.map((w) => `${w.name}==${w.version}`)).toEqual(["seaborn==0.13.2", "branca==0.8.2", "folium==0.20.0", "ipytest==0.14.2"]);
    for (const w of EXTRA_WHEELS) {
      expect(w.file).toMatch(/-py[23.]*(?:\.py3)?-none-any\.whl$/);
      expect(w.file.startsWith(`${w.name}-${w.version}-`)).toBe(true);
      expect(w.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(new URL(w.url).host).toBe("files.pythonhosted.org");
      expect(lock.packages[w.name]).toBeUndefined(); // si Pyodide lo trajera, sobraría aquí
      for (const d of w.lockDeps) expect(PYODIDE_PACKAGES.some((p) => p.name === d), `${w.name} → ${d}`).toBe(true);
    }
    expect(extraForImport("seaborn")!.name).toBe("seaborn");
    expect(extraForImport("numpy")).toBeNull();
    expect(extraClosure(extraForImport("folium")!).map((w) => w.name)).toEqual(["branca", "folium"]);
  });

  it("cv2 solo trae OpenCV: es un paquete aparte en el manifiesto", () => {
    expect(lock.packages["opencv-python"]!.imports).toContain("cv2");
    expect(PYODIDE_PACKAGES.find((p) => p.name === "opencv-python")!.depends).toEqual(["numpy"]);
  });

  it("el lock publicado solo tiene lo que se publica", () => {
    const keep = PYODIDE_PACKAGES.map((p) => p.name);
    const trimmed = trimLock(lock, keep);
    expect(Object.keys(trimmed.packages).sort()).toEqual([...keep].sort());
    expect(trimmed.info).toEqual(lock.info);
    expect(trimmed.packages.sympy).toBeUndefined();
  });

  it("vendorPlan: lock y extras, con URL https del origen", () => {
    const plan = vendorPlan(lock, validateBaseUrl("https://cdn.jsdelivr.net/pyodide/v0.27.7/full"));
    expect(plan).toHaveLength(PYODIDE_PACKAGES.length + EXTRA_WHEELS.length);
    expect(plan[0]!.url.startsWith("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/")).toBe(true);
    expect(plan.filter((f) => f.source === "pypi").map((f) => f.file)).toEqual(EXTRA_WHEELS.map((w) => w.file));
    expect(() => validateBaseUrl("http://cdn.example.invalid/")).toThrow(/https/);
  });
});

describe("descargas verificadas (sin red)", () => {
  const body = new TextEncoder().encode("wheel de prueba");
  const ok = (bytes: Uint8Array) => (async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch;

  it("guarda el archivo si cuadran tamaño y SHA-256", async () => {
    const dir = tmp();
    await downloadVerified({ url: "https://x.example.invalid/a.whl", dest: join(dir, "a.whl"), name: "a.whl", size: body.length, sha256: sha(body), fetchImpl: ok(body) });
    expect(readFileSync(join(dir, "a.whl"))).toEqual(Buffer.from(body));
  });

  it("un SHA-256 o un tamaño distintos: IntegrityError y nada en disco", async () => {
    const dir = tmp();
    const dest = join(dir, "a.whl");
    await expect(
      downloadVerified({ url: "https://x.example.invalid/a.whl", dest, name: "a.whl", size: body.length, sha256: "0".repeat(64), fetchImpl: ok(body) }),
    ).rejects.toBeInstanceOf(IntegrityError);
    await expect(
      downloadVerified({ url: "https://x.example.invalid/a.whl", dest, name: "a.whl", size: body.length - 1, sha256: sha(body), fetchImpl: ok(body) }),
    ).rejects.toBeInstanceOf(IntegrityError);
    expect(existsSync(dest) || existsSync(`${dest}.part`)).toBe(false);
  });

  it("sin conexión o con un 404: NetworkError", async () => {
    const dir = tmp();
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(downloadVerified({ url: "https://x.example.invalid/a.whl", dest: join(dir, "a"), name: "a", size: 1, sha256: "", fetchImpl: down })).rejects.toBeInstanceOf(NetworkError);
    const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(downloadVerified({ url: "https://x.example.invalid/a.whl", dest: join(dir, "a"), name: "a", size: 1, sha256: "", fetchImpl: notFound })).rejects.toThrow(/404/);
  });

  it("vendorPyodide: bytes falsos en el origen paran el build y no dejan dist/pyodide", async () => {
    const out = tmp();
    const cacheDir = tmp();
    const fake = (async () => new Response(new Uint8Array(10), { status: 200 })) as unknown as typeof fetch;
    await expect(
      vendorPyodide({ outDir: out, pkgDir, cacheDir, baseUrl: "https://mirror.example.invalid/", timeoutMs: 1000, fetchImpl: fake, releaseFallback: false, log: () => {} }),
    ).rejects.toBeInstanceOf(IntegrityError);
  });

  it("vendorPyodide: sin red (y sin release) falla con NetworkError", async () => {
    const out = tmp();
    const cacheDir = tmp();
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      vendorPyodide({ outDir: out, pkgDir, cacheDir, baseUrl: "https://mirror.example.invalid/", timeoutMs: 1000, fetchImpl: down, releaseFallback: false, log: () => {} }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("check-python (tras el build)", () => {
  /** Un dist/ mínimo: entrada, un chunk perezoso y, si se pide, el worker y los archivos de Pyodide. */
  function fakeDist(o: { worker: boolean; pyodide: boolean; pyodideInEntry?: boolean; wheelsInShared?: boolean }) {
    const dist = tmp();
    mkdirSync(join(dist, ".vite"), { recursive: true });
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "assets", "index-a.js"), o.pyodideInEntry ? "import('./x');loadPyodide()" : "console.log('app')");
    writeFileSync(join(dist, "assets", "shared-b.js"), o.wheelsInShared ? `export const w = [{ file: "${EXTRA_WHEELS[0]!.file}" }]` : "export const x = 1");
    const manifest: Record<string, object> = {
      "index.html": { file: "assets/index-a.js", isEntry: true, imports: ["_shared"] },
      _shared: { file: "assets/shared-b.js" },
    };
    if (o.worker) {
      writeFileSync(join(dist, "assets", "PythonLabPage-c.js"), "new Worker(new URL('py.worker-d.js', import.meta.url))");
      writeFileSync(join(dist, "assets", "py.worker-d.js"), "async function loadPyodide(){}; 'pyodide.asm.js'");
      manifest["src/py.tsx"] = { file: "assets/PythonLabPage-c.js", isDynamicEntry: true };
    }
    writeFileSync(join(dist, ".vite", "manifest.json"), JSON.stringify(manifest));
    if (o.pyodide) {
      const dir = join(dist, "pyodide", PYODIDE_VERSION);
      mkdirSync(dir, { recursive: true });
      // Archivos dispersos del tamaño del manifiesto (check-python solo mira el tamaño).
      for (const f of [...PYODIDE_CORE, ...PYODIDE_PACKAGES, ...EXTRA_WHEELS]) {
        writeFileSync(join(dir, f.file), "");
        truncateSync(join(dir, f.file), f.size);
      }
      writeFileSync(join(dir, "pyodide-lock.json"), "{}");
    }
    return dist;
  }

  it("apagado y limpio: OK", () => {
    expect(checkDist(fakeDist({ worker: false, pyodide: false }), false).ok).toBe(true);
  });

  it("apagado con chunk de Python o con dist/pyodide: falla", () => {
    const r = checkDist(fakeDist({ worker: true, pyodide: true }), false);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join("\n")).toMatch(/assets\/py\.worker-d\.js contiene Pyodide[\s\S]*existe dist\/pyodide/);
  });

  it("encendido con worker y todos los archivos: OK", () => {
    const r = checkDist(fakeDist({ worker: true, pyodide: true }), true);
    expect(r).toMatchObject({ ok: true });
  });

  it("encendido sin los archivos de Pyodide: falla", () => {
    const r = checkDist(fakeDist({ worker: true, pyodide: false }), true);
    expect(!r.ok && r.errors[0]).toMatch(/falta dist\/pyodide\/0\.27\.7\//);
  });

  it("Pyodide en el chunk de entrada: falla siempre", () => {
    const r = checkDist(fakeDist({ worker: true, pyodide: true, pyodideInEntry: true }), true);
    expect(!r.ok && r.errors[0]).toBe(`Pyodide en el grafo de entrada: assets/index-a.js contiene «${PYODIDE_MARKERS[0]}»`);
  });

  it("la lista de wheels extra en un chunk que importa la entrada: falla siempre", () => {
    for (const enabled of [false, true]) {
      const r = checkDist(fakeDist({ worker: enabled, pyodide: enabled, wheelsInShared: true }), enabled);
      expect(!r.ok && r.errors[0]).toBe(`wheels extra en el grafo de entrada: assets/shared-b.js contiene «${EXTRA_WHEELS[0]!.file}»`);
    }
  });

  it("la configuración de Python no importa packages.ts (solo version.ts)", () => {
    const config = readFileSync(join(root, "src", "features", "labs", "python", "python-config.ts"), "utf8");
    const storage = readFileSync(join(root, "src", "features", "labs", "labs-storage.ts"), "utf8");
    expect(config).not.toMatch(/^import (?!type )[^;]*from "\.\/(packages|pyodide-manifest|files|drafts)\.ts"/m);
    expect(config).toContain('from "./version.ts"');
    expect(storage).not.toMatch(/packages\.ts/);
  });
});

describe("chunk de entrada de una app anfitriona", () => {
  it("configureLabs en la entrada no arrastra la lista de wheels extra (se queda en el chunk perezoso)", async () => {
    // La app anfitriona importa configureLabs de forma estática y la pestaña Python (que usa
    // EXTRA_WHEELS) con import(). Si la configuración importara packages.ts, la lista iría a la entrada.
    const dir = tmp();
    const src = join(root, "src", "features", "labs");
    writeFileSync(
      join(dir, "host.ts"),
      [
        `import { configureLabs } from ${JSON.stringify(join(src, "labs-storage.ts"))};`,
        'configureLabs({ python: { assetBaseUrl: "/py/" } });',
        `export const tab = () => import(${JSON.stringify(join(src, "python", "packages.ts"))}).then((m) => m.EXTRA_WHEELS.length);`,
      ].join("\n"),
    );
    const out = (await build({
      configFile: false,
      logLevel: "silent",
      root: dir,
      build: { write: false, minify: false, rollupOptions: { input: join(dir, "host.ts"), preserveEntrySignatures: "strict" } },
    })) as Rollup.RollupOutput;
    const chunks = out.output.filter((o): o is Rollup.OutputChunk => o.type === "chunk");
    const entry = chunks.find((c) => c.isEntry)!;
    const lazy = chunks.filter((c) => !c.isEntry);
    expect(entry.code).toContain("/py/");
    for (const w of EXTRA_WHEELS) {
      expect(entry.code, w.file).not.toContain(w.file);
      expect(lazy.some((c) => c.code.includes(w.file)), w.file).toBe(true);
    }
  });
});
