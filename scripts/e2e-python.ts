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
// 4. Paso a paso de un bucle de 5 líneas en la pestaña y, en «Ejercicios», un ejercicio de Python
//    resuelto (de ficheros CSV), otro fallado, uno de pandas del tema 12 resuelto (con ventas.csv en
//    la carpeta de cada caso), uno de gráficos del tema 11 comprobado mirando la figura (seaborn con
//    hue y estimator="sum": primero sin estimator, que falla, y después bien) y un «¿Qué imprime?»
//    fallado con su paso a paso.
// 5. El simulacro de 01MIAR (…/python/simulacro): empezar, ejecutar la celda de los import y un paso
//    con df.head() (tabla de pandas como tabla), resolver un ejercicio corto con su «Test Use Case»,
//    «Ejecutar todo», entregar con un paso de gráficos hecho y ver la nota, las comprobaciones ocultas y
//    la figura entregada; y el diseño a 390 px en oscuro y 1280 px en claro (sin desbordar en
//    horizontal) del inicio, el cuaderno y los resultados.
// 6. Abre /host/ (la app anfitriona), escribe res/data.csv y res/programa.py desde la ranura del
//    borrador, los lee con pandas y exec(open(…)), y comprueba que siguen tras reiniciar Python.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { PY_CODE_TYPES } from "../shared/exercises/python.ts";
import { seedToText } from "../shared/exercises/random.ts";
import { buildPyExam, finishPyExamAttempt, pyExamParts, pyExamPartPoints, recordPyExamAttempt, serializePyExamStore, setPyExamResult, startPyExamAttempt } from "../shared/pyexam/index.ts";

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

  await step("paso a paso: un bucle de 5 líneas", async () => {
    await toTop();
    await editor.fill('total = 0\nfor i in range(3):\n    total += i\n    print(i, total)\nprint("fin", total)');
    await page.getByRole("button", { name: "Ejecutar paso a paso" }).click();
    const status = page.getByTestId("trace-step");
    await status.waitFor({ timeout: 60_000 });
    const first = await status.innerText();
    if (first !== "Paso 1 de 13: se va a ejecutar la línea 1.") throw new Error(`primer paso: ${first}`);
    for (let k = 0; k < 3; k++) await page.getByRole("button", { name: "Siguiente paso" }).click();
    const fourth = await status.innerText();
    await page.getByRole("button", { name: "Final" }).click();
    await page.getByText("Paso 13 de 13: fin del programa.").waitFor({ timeout: 5_000 });
    const out = await page.locator("pre", { hasText: "fin 3" }).count();
    if (out === 0) throw new Error("la salida del último paso no tiene «fin 3»");
    return `${fourth} … fin con «fin 3»`;
  });

  /** Un ejercicio de Python de «Ejercicios» con la semilla dada. */
  const exerciseUrl = (id: string, level: "basico" | "medio" | "avanzado", seed: number) => `${url}/laboratorios/ejercicios?t=${id}&n=${level}&s=${seedToText(seed)}`;
  const tipo = (id: string) => PY_CODE_TYPES.find((t) => t.id === id)!;

  await step("ejercicio de Python resuelto (CSV del tema 5)", async () => {
    const seed = [...Array(200).keys()].find((k) => tipo("py-ficheros").generate(k, "medio").template === "csv")!;
    const inst = tipo("py-ficheros").generate(seed, "medio");
    await page.goto(exerciseUrl("py-ficheros", "medio", seed));
    await page.getByLabel("Tu código").fill(inst.solution);
    await page.getByRole("button", { name: "Comprobar" }).click();
    await page.getByText("¡Correcto! Tu código pasa todas las pruebas.").waitFor({ timeout: 180_000 });
    await page.getByText("¡Resuelto! Cuenta en tu progreso.").waitFor({ timeout: 5_000 });
    return `${inst.title}: ${inst.cases.length} casos correctos`;
  });
  await step("ejercicio de Python fallado", async () => {
    const inst = tipo("py-tipos").generate(7, "medio");
    await page.goto(exerciseUrl("py-tipos", "medio", 7));
    await page.getByLabel("Tu código").fill(`def ${inst.fn}(*args):\n    return 'no'\n`);
    await page.getByRole("button", { name: "Comprobar" }).click();
    const list = page.getByRole("list", { name: "Resultados de las pruebas" });
    await list.getByText("Caso 1: incorrecto").waitFor({ timeout: 180_000 });
    const mine = await list.getByText(/^Tu resultado: 'no'/).count();
    if (mine === 0) throw new Error("no muestra «Tu resultado»");
    if (await page.getByText("¡Correcto!").count()) throw new Error("lo da por bueno");
    return `${inst.title}: ${await list.getByText(/: incorrecto$/).count()} casos incorrectos`;
  });
  await step("ejercicio de pandas resuelto (tema 12: total = precio × cantidad)", async () => {
    const inst = tipo("py-pandas-limpiar").generate(3, "avanzado");
    await page.goto(exerciseUrl("py-pandas-limpiar", "avanzado", 3));
    await page.getByText("Tema 12 · Procesamiento de datos").waitFor({ timeout: 20_000 });
    // Primero el error típico: el primer precio visto en vez de la moda.
    const firstSeen = inst.solution.replace('precios = validos.groupby("articulo")["precio"].agg(lambda s: s.mode()[0])', 'precios = validos.drop_duplicates("articulo").set_index("articulo")["precio"]');
    await page.getByLabel("Tu código").fill(firstSeen);
    await page.getByRole("button", { name: "Comprobar" }).click();
    const list = page.getByRole("list", { name: "Resultados de las pruebas" });
    await list.getByText(/: incorrecto$/).first().waitFor({ timeout: 300_000 });
    const why = await list.getByText(/^Hay algún valor distinto en la columna '/).count();
    if (why === 0) throw new Error("no dice qué columna no coincide");
    await page.getByLabel("Tu código").fill(inst.solution);
    await page.getByRole("button", { name: "Comprobar" }).click();
    await page.getByText("¡Correcto! Tu código pasa todas las pruebas.").waitFor({ timeout: 180_000 });
    return `${inst.title}: el «primer precio visto» falla (${why} casos lo dicen); la moda, ${inst.cases.length} casos correctos`;
  });
  await step("gráfico con requisitos comprobado (tema 11: dos barplots con hue y estimator)", async () => {
    const inst = tipo("py-graficos").generate(5, "medio");
    await page.goto(exerciseUrl("py-graficos", "medio", 5));
    await page.getByText("Tema 11 · Visualización de datos").waitFor({ timeout: 20_000 });
    await page.getByLabel("Tu código", { exact: true }).fill(inst.solution.replace(/, estimator="sum"/g, ""));
    await page.getByRole("button", { name: "Comprobar" }).click();
    const list = page.getByRole("list", { name: "Resultados de las pruebas" });
    await list.getByText(/^Izquierda: las barras son las sumas de total \(estimator="sum"\): no cumplida/).first().waitFor({ timeout: 300_000 });
    await page.getByRole("img", { name: "Gráfico de tu código" }).waitFor({ timeout: 10_000 });
    await page.waitForFunction(`(document.querySelector('canvas[aria-label="Gráfico de tu código"]')?.width ?? 0) > 0`);
    await page.getByLabel("Tu código", { exact: true }).fill(inst.solution);
    await page.getByRole("button", { name: "Comprobar" }).click();
    await page.getByText("¡Correcto! Tu código pasa todas las pruebas.").waitFor({ timeout: 180_000 });
    const ok = await list.getByText(/: cumplida$/).count();
    const size = await page.evaluate(`(() => { const c = document.querySelector('canvas[aria-label="Gráfico de tu código"]'); return c.width + "x" + c.height; })()`);
    return `sin estimator: no cumplida; bien: ${ok} comprobaciones cumplidas; tu gráfico en canvas ${size}`;
  });
  await step("«¿Qué imprime?» fallado y su paso a paso", async () => {
    await page.goto(exerciseUrl("py-que-imprime", "medio", 21));
    await page.getByLabel("Lo que imprime (una línea por cada línea de la salida)").fill("nada");
    await page.getByRole("button", { name: "Comprobar" }).click();
    await page.getByText(/No coincide: la primera diferencia está en la línea 1/).waitFor({ timeout: 180_000 });
    await page.getByRole("button", { name: "Ver paso a paso" }).click();
    await page.getByTestId("trace-step").waitFor({ timeout: 60_000 });
    return await page.getByTestId("trace-step").innerText();
  });

  // ---------------------------------------------------------------- Simulacro de 01MIAR
  const pyExam = buildPyExam(2);
  const pyExamUrl = `${url}/laboratorios/python/simulacro?s=${seedToText(2)}`;
  /** Pulsa «Ejecutar celda» y espera a que el kernel quede libre. */
  async function runCell(label: string, timeout = 180_000) {
    await page.getByRole("button", { name: `Ejecutar celda: ${label}`, exact: true }).click();
    await kernelIdle(timeout);
  }
  /** Espera a que «Ejecutar todo» se pueda pulsar otra vez (el kernel no está ejecutando nada). */
  async function kernelIdle(timeout: number) {
    const all = page.getByRole("button", { name: "Ejecutar todo", exact: true });
    const end = Date.now() + timeout;
    await page.waitForTimeout(300);
    while (await all.isDisabled()) {
      if (Date.now() > end) throw new Error(`el kernel sigue ocupado tras ${timeout / 1000} s`);
      await page.waitForTimeout(200);
    }
  }
  await step("simulacro de 01MIAR: abrir y empezar", async () => {
    await page.goto(pyExamUrl);
    await page.getByRole("heading", { level: 1, name: "Simulacro de examen (01MIAR)" }).waitFor({ timeout: 20_000 });
    await page.getByRole("note").getByText("Es un simulacro para practicar; no es el examen oficial ni lo sustituye.").waitFor({ timeout: 5_000 });
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.getByRole("timer", { name: "Tiempo restante" }).waitFor({ timeout: 10_000 });
    return `reloj ${await page.getByRole("timer").innerText()}; ${pyExamParts(pyExam)} partes`;
  });
  await step("simulacro: ejecutar una celda (import y df.head() como tabla)", async () => {
    await runCell("Celda de los import (solo lectura)", 300_000);
    await page.getByLabel("Ejecutada en el turno 1").waitFor({ timeout: 5_000 });
    await page.getByRole("textbox", { name: "Tu solución AQUÍ · Paso A" }).fill(`${pyExam.project.steps[0]!.solution}df.head()\n`);
    await runCell("Tu solución AQUÍ · Paso A");
    const table = page.getByRole("table", { name: "DataFrame: 5 filas × 8 columnas" });
    await table.waitFor({ timeout: 10_000 });
    const html = await table.innerHTML();
    if (/<(script|img|iframe)/i.test(html)) throw new Error("la tabla lleva HTML que no es suyo");
    return `tabla con ${await table.getByRole("row").count()} filas`;
  });
  await step("simulacro: resolver un ejercicio corto y su «Test Use Case»", async () => {
    const short = pyExam.shorts[0]!;
    await page.getByRole("textbox", { name: "Tu solución AQUÍ · Ejercicio 1" }).fill(short.check.solution);
    await runCell("Tu solución AQUÍ · Ejercicio 1");
    await runCell("Test Use Case · Ejercicio 1 (solo lectura)");
    await page.getByText("Los assert de la vista se cumplen.").first().waitFor({ timeout: 10_000 });
    // Y un paso de gráficos (la dispersión), para ver la figura en los resultados.
    const scatter = pyExam.project.steps.find((st) => st.plot)!;
    await page.getByRole("textbox", { name: `Tu solución AQUÍ · Paso ${scatter.letter}` }).fill(scatter.solution);
    return `${short.title}: los assert se cumplen`;
  });
  await step("simulacro: «Ejecutar todo»", async () => {
    await page.getByRole("button", { name: "Ejecutar todo", exact: true }).click();
    const said = page.getByText(/«Ejecutar todo» (se ha parado en un error|ha terminado)/);
    await said.waitFor({ state: "attached", timeout: 300_000 });
    await kernelIdle(60_000);
    return (await said.innerText()).trim();
  });
  await step("simulacro: entregar y ver los resultados", async () => {
    await page.getByRole("button", { name: "Entregar" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Entregar ahora" }).click();
    const score = page.getByLabel(/^Nota: .* sobre 10$/);
    await score.waitFor({ timeout: 420_000 });
    const label = (await score.getAttribute("aria-label")) ?? "";
    const scatter = pyExam.project.steps.find((st) => st.plot)!;
    const expected = `Nota: ${String(1.25 + pyExam.project.steps[0]!.points + scatter.points).replace(".", ",")} sobre 10`;
    if (label !== expected) throw new Error(`${label} (esperaba ${expected})`);
    const canvas = page.getByRole("img", { name: `Figura entregada: Paso ${scatter.letter}. ${scatter.title}` });
    await canvas.waitFor({ timeout: 10_000 });
    let width = 0;
    for (let i = 0; i < 50 && width === 0; i++) {
      width = await canvas.evaluate((c: { width: number }) => c.width);
      if (width === 0) await page.waitForTimeout(200);
    }
    if (width === 0) throw new Error("la figura entregada no se dibuja");
    const fails = await page.getByText(/: no cumplida$/).count();
    if ((await page.getByTestId("solution").count()) !== 0) throw new Error("la solución se ve sin pedirla");
    return `${label}; ${fails} comprobaciones ocultas no cumplidas; figura entregada en canvas de ${width} px`;
  });
  await step("simulacro: diseño a 390 px (oscuro) y 1280 px (claro)", async () => {
    // Un intento corregido en el historial, para abrir también los resultados.
    const parts = pyExamParts(pyExam);
    const a = startPyExamAttempt(2, parts, Date.now() - 3_600_000);
    a.code![0] = pyExam.shorts[0]!.check.solution;
    const done = finishPyExamAttempt(a, Date.now() - 60_000);
    const points = pyExamPartPoints(pyExam).map((p, i) => (i === 0 ? p : 0));
    const store = setPyExamResult(recordPyExamAttempt({ active: null, history: [] }, done), done.id, { score: 1.25, points, failed: points.map((p, i) => (i === 0 ? [] : [0])) });
    const saved = serializePyExamStore(store);
    const out: string[] = [];
    const shots = process.env.E2E_SHOTS;
    for (const [width, scheme] of [[390, "dark"], [1280, "light"]] as const) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      await ctx.addInitScript(`try { if (!sessionStorage.getItem("puesto")) { localStorage.setItem("ia-labs.pyexam.v1", ${JSON.stringify(saved)}); sessionStorage.setItem("puesto", "1"); } } catch {}`);
      const p = await ctx.newPage();
      const wide = async (what: string) => {
        const w = (await p.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")) as [number, number];
        if (w[0] > w[1] + 1) throw new Error(`${what} a ${width} px desborda: ${w[0]} > ${w[1]}`);
        if (shots) await p.screenshot({ path: join(shots, `pyexam-${width}-${what}.png`), fullPage: false });
      };
      await p.goto(pyExamUrl);
      await p.getByRole("heading", { level: 1, name: "Simulacro de examen (01MIAR)" }).waitFor({ timeout: 20_000 });
      await wide("inicio");
      await p.getByRole("button", { name: /^Historial/ }).click();
      await p.getByRole("button", { name: "Ver resultados" }).first().click();
      await p.getByLabel("Nota: 1,25 sobre 10").waitFor({ timeout: 10_000 });
      await wide("resultados");
      await p.getByRole("button", { name: "Repetir este simulacro" }).click();
      await p.getByRole("button", { name: "Empezar" }).click();
      await p.getByRole("timer").waitFor({ timeout: 10_000 });
      await wide("cuaderno");
      out.push(`${width} px ${scheme}: sin desbordar`);
      await ctx.close();
    }
    return out.join("; ");
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
