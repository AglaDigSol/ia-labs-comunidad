// Prueba de humo de la pestaña Python en Chromium sin interfaz (no va en CI: descarga ~110 MB y
// necesita Playwright instalado aparte; no es dependencia del proyecto):
//
//   node scripts/e2e-python.ts [--no-build] [--strict-worker] [--coep]
//
// 1. Construye con LABS_PYTHON=1 (salvo --no-build) y, en dist/host/, la app anfitriona de prueba
//    (tests/e2e-host/: <LabsRoutes python /> con una ranura que escribe archivos con writeFiles).
// 2. Sirve dist/ con un servidor estático mínimo que imita deploy/nginx.conf: las mismas cabeceras
//    (leídas de deploy/security-headers*.conf), la CSP con 'wasm-unsafe-eval' solo en el worker,
//    los tipos de /pyodide/ y el fallback SPA. --strict-worker manda al worker la CSP del documento
//    (para comprobar que entonces falla) y --coep añade COEP require-corp (aislamiento).
// 3. Abre /laboratorios/python, carga Python y ejecuta código real: print, numpy, seaborn, un
//    gráfico, %timeit, un archivo subido, input(), sin internet, TensorFlow y «Detener».
// 4. Abre /host/ (la app anfitriona), escribe res/data.csv y res/programa.py desde la ranura del
//    borrador, los lee con pandas y exec(open(…)), y comprueba que siguen tras reiniciar Python.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const args = new Set(process.argv.slice(2));

/** Las cabeceras add_header de un snippet de nginx. */
export function readNginxHeaders(path: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of readFileSync(path, "utf8").matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)) out.push([m[1]!, m[2]!]);
  return out;
}

const PAGE = readNginxHeaders(join(root, "deploy", "security-headers.conf"));
const WORKER = readNginxHeaders(join(root, "deploy", args.has("--strict-worker") ? "security-headers.conf" : "security-headers-wasm.conf"));
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ics": "text/calendar; charset=utf-8",
  ".wasm": "application/wasm",
  ".whl": "application/zip",
  ".zip": "application/zip",
  ".txt": "text/plain",
};

function send(res: ServerResponse, path: string, headers: Array<[string, string]>, cache: string) {
  for (const [k, v] of headers) res.setHeader(k, v);
  if (args.has("--coep")) res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cache-Control", cache);
  res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
  res.end(readFileSync(path));
}

function serve(): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const file = normalize(join(dist, pathname));
    const isFile = file.startsWith(dist) && existsSync(file) && statSync(file).isFile();
    if (/^(\/host)?\/assets\/py\.worker-[A-Za-z0-9_-]+\.js$/.test(pathname) && isFile) return send(res, file, WORKER, "public, max-age=31536000, immutable");
    if (pathname.startsWith("/pyodide/")) {
      if (!isFile) {
        res.statusCode = 404;
        for (const [k, v] of PAGE) res.setHeader(k, v);
        return res.end();
      }
      return send(res, file, PAGE, pathname.endsWith(".json") ? "public, max-age=3600" : "public, max-age=31536000, immutable");
    }
    if (isFile) return send(res, file, PAGE, /^(\/host)?\/assets\//.test(pathname) ? "public, max-age=31536000, immutable" : "no-cache");
    if (pathname === "/host" || pathname.startsWith("/host/")) return send(res, join(dist, "host", "index.html"), PAGE, "no-cache");
    return send(res, join(dist, "index.html"), PAGE, "no-cache");
  });
  return new Promise((ok) =>
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      ok({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    }),
  );
}

type Step = { name: string; ok: boolean; detail: string; ms: number };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!args.has("--no-build")) {
    const b = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", env: { ...process.env, LABS_PYTHON: "1" } });
    if (b.status !== 0) process.exit(b.status ?? 1);
  }
  if (!args.has("--no-build") || !existsSync(join(dist, "host", "index.html"))) {
    // La app anfitriona de prueba, con la misma configuración de Vite y Python encendido.
    const h = spawnSync("npx", ["vite", "build", "tests/e2e-host", "--config", "vite.config.ts", "--base", "/host/", "--outDir", join(dist, "host"), "--emptyOutDir"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, LABS_PYTHON: "1" },
    });
    if (h.status !== 0) process.exit(h.status ?? 1);
  }
  const require = createRequire(import.meta.url);
  // Playwright no es dependencia del proyecto (se usa el instalado en la máquina): sin sus tipos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { chromium } = require("playwright") as { chromium: { launch(): Promise<any> } };
  const { url, close } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleLines: string[] = [];
  page.on("console", (m: { type(): string; text(): string }) => {
    if (m.type() === "error" || /Content Security Policy|Refused/.test(m.text())) consoleLines.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e: Error) => consoleLines.push(`[pageerror] ${e.message}`));
  const steps: Step[] = [];
  const editor = page.getByLabel("Código Python");
  const log = page.getByRole("log", { name: "Salida" });

  async function step(name: string, fn: () => Promise<string>) {
    if (steps.some((s) => !s.ok && s.name === "Cargar Python")) return; // sin Python no tiene sentido seguir
    const t0 = Date.now();
    try {
      steps.push({ name, ok: true, detail: await fn(), ms: Date.now() - t0 });
    } catch (e) {
      steps.push({ name, ok: false, detail: e instanceof Error ? e.message.split("\n")[0]! : String(e), ms: Date.now() - t0 });
    }
  }
  /** La barra de pestañas es sticky: con la página desplazada taparía los botones de arriba. */
  const toTop = () => page.evaluate("window.scrollTo(0, 0)");
  async function runCode(code: string, expect: string | RegExp, timeout = 120_000): Promise<string> {
    await toTop();
    await editor.fill(code);
    await page.getByRole("button", { name: "Ejecutar código" }).click();
    await log.getByText(expect).first().waitFor({ timeout });
    return (await log.innerText()).replace(/\s+/g, " ").slice(0, 160);
  }

  await step("abrir /laboratorios/python", async () => {
    await page.goto(`${url}/laboratorios/python`);
    await page.getByRole("heading", { level: 1, name: "Python" }).waitFor({ timeout: 20_000 });
    const isolated = await page.evaluate("crossOriginIsolated");
    return `pestaña visible; crossOriginIsolated=${isolated}`;
  });
  await step("Cargar Python", async () => {
    await page.getByRole("button", { name: "Cargar Python" }).click();
    await page.getByText("Python listo").waitFor({ timeout: args.has("--strict-worker") ? 30_000 : 180_000 });
    return (await page.getByText("Python listo").getAttribute("title")) ?? "";
  });
  await step("print(sum(range(10)))", () => runCode("print(sum(range(10)))", "45"));
  await step("import numpy", () => runCode("import numpy as np\nprint('numpy', np.__version__, np.arange(4).sum())", /numpy 2\.0\.2 6/));
  await step("import seaborn (wheel extra con micropip)", () =>
    runCode("import seaborn as sns\nprint('seaborn', sns.__version__)", /seaborn 0\.13\.2/, 240_000),
  );
  await step("gráfico de matplotlib en canvas", async () => {
    await runCode("import matplotlib.pyplot as plt\nplt.plot([1, 3, 2])\nplt.show()\nprint('ok')", "ok");
    const fig = log.getByRole("img", { name: "Gráfico 1 de la ejecución" });
    await fig.waitFor({ timeout: 10_000 });
    // Código que corre en la página (como texto: este script no tiene los tipos del DOM).
    await page.waitForFunction(`(document.querySelector('canvas[role="img"]')?.width ?? 0) > 0`);
    return `canvas ${await page.evaluate(`(() => { const c = document.querySelector('canvas[role="img"]'); return c.width + "x" + c.height; })()`)}`;
  });
  await step("%timeit", () => runCode("%timeit -n 10 -r 3 sum(range(1000))", /por bucle \(media ± desv\. típica de 3 ejecuciones, 10 bucles cada una\)/));
  await step("archivo subido + pandas", async () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-py-"));
    const csv = join(dir, "datos.csv");
    writeFileSync(csv, "x,y\n1,2\n3,4\n");
    await page.getByTestId("py-file-input").setInputFiles(csv);
    await page.getByText("datos.csv").first().waitFor({ timeout: 5_000 });
    return runCode("import pandas as pd\ndf = pd.read_csv('datos.csv')\nprint('suma', int(df.y.sum()))\ndf.to_csv('salida.csv')", "suma 6", 180_000);
  });
  await step("input() con la entrada", async () => {
    await page.getByText("Entrada para input()").click();
    await page.locator("#py-stdin").fill("Ada\n");
    return runCode("nombre = input('¿Nombre? ')\nprint('Hola', nombre)", "Hola Ada");
  });
  await step("sin internet: aviso", () =>
    runCode("import urllib.request\nurllib.request.urlopen('https://example.com')", "Este entorno no accede a internet"),
  );
  await step("sin internet con requests", () =>
    runCode("import requests\nrequests.get('https://example.com', timeout=5)", "Este entorno no accede a internet", 180_000),
  );
  await step("sin internet con pyodide.http", () =>
    runCode("from pyodide.http import pyfetch\nawait pyfetch('https://example.com')", "Este entorno no accede a internet"),
  );
  await step("sin internet con nltk.download", () =>
    runCode("import nltk\nprint('descargado:', nltk.download('punkt'))", "Este entorno no accede a internet", 180_000),
  );
  await step("TensorFlow: aviso", () => runCode("import tensorflow as tf", "TensorFlow no funciona en el navegador"));
  await step("import cv2 (solo OpenCV)", () => runCode("import cv2\nprint('cv2', cv2.__version__)", /cv2 4\.10/, 240_000));
  await step("folium e ipytest (wheels extra)", () =>
    runCode(
      "import folium, ipytest\nfrom importlib.metadata import version\nm = folium.Map(location=[40.4, -3.7], tiles=None)\nprint('folium', folium.__version__, 'ipytest', version('ipytest'))",
      /folium 0\.20\.0 ipytest 0\.14\.2/,
      240_000,
    ),
  );
  await step("plantilla «Gráficos con seaborn»", async () => {
    await toTop();
    await page.getByRole("combobox", { name: "Plantilla" }).click();
    await page.getByRole("option", { name: "Gráficos con seaborn" }).click();
    await page.getByRole("button", { name: "Ejecutar código" }).click();
    await log.getByRole("img", { name: "Gráfico 1 de la ejecución" }).waitFor({ timeout: 120_000 });
    return "1 gráfico";
  });
  await step("Detener un bucle infinito", async () => {
    await toTop();
    await editor.fill("while True:\n    pass");
    await page.getByRole("button", { name: "Ejecutar código" }).click();
    await page.getByText(/Ejecutando…/).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await toTop();
    await page.getByRole("button", { name: "Detener" }).click();
    await log.getByText("Ejecución detenida por ti.").waitFor({ timeout: 20_000 });
    const restarted = await log.getByText(/Python se ha reiniciado/).count();
    await page.getByText("Python listo").waitFor({ timeout: 120_000 });
    return restarted > 0 ? "reiniciado (sin aislamiento)" : "interrumpido (KeyboardInterrupt)";
  });

  await step("anfitrión: writeFiles desde la ranura del borrador", async () => {
    await page.goto(`${url}/host/`);
    await page.getByRole("heading", { level: 1, name: "Python" }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Cargar los archivos de prueba (res/, img/)" }).click();
    await page.getByText("3 escritos, 1 descartados").waitFor({ timeout: 5_000 });
    const list = page.getByRole("list", { name: "Archivos de la carpeta de trabajo" });
    await list.getByText("res/data.csv").waitFor({ timeout: 5_000 });
    // Python ya se cargó en este origen (pasos anteriores): arranca solo.
    await page.getByText("Python listo").waitFor({ timeout: 180_000 });
    return runCode(
      "import pandas as pd\nprint('anfitrión', int(pd.read_csv('res/data.csv').y.sum()))\nexec(open('res/programa.py').read())\nimport os\nprint(sorted(os.listdir('res')))",
      /anfitrión 6[\s\S]*hola desde res\/programa\.py/,
      180_000,
    );
  });
  await step("anfitrión: los archivos siguen tras reiniciar Python", async () => {
    await toTop();
    await editor.fill("while True:\n    pass");
    await page.getByRole("button", { name: "Ejecutar código" }).click();
    await page.getByText(/Ejecutando…/).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await toTop();
    await page.getByRole("button", { name: "Detener" }).click();
    await log.getByText("Ejecución detenida por ti.").waitFor({ timeout: 20_000 });
    await page.getByText("Python listo").waitFor({ timeout: 120_000 });
    return runCode("import os\nprint('tras reiniciar', os.path.getsize('img/demo/vacio.bin'), open('res/data.csv').readline().strip())", "tras reiniciar 1024 x,y", 180_000);
  });

  await browser.close();
  close();
  for (const s of steps) console.log(`${s.ok ? "OK  " : "FALLO"} ${s.name} (${(s.ms / 1000).toFixed(1)} s): ${s.detail}`);
  if (consoleLines.length) console.log(`Consola:\n  ${consoleLines.slice(0, 20).join("\n  ")}`);
  process.exit(steps.every((s) => s.ok) ? 0 : 1);
}
