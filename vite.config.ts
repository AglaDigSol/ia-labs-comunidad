import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { PYODIDE_VERSION } from "./src/features/labs/python/packages.ts";
import { PYODIDE_PACKAGES } from "./src/features/labs/python/pyodide-manifest.ts";
import { trimLock, type Lock } from "./scripts/pyodide-lib.ts";
import { pythonEnabled } from "./scripts/python-flag.ts";
import { cspSafeRadix } from "./scripts/csp-safe-radix.ts";

/** Normaliza VITE_BASE ("/", "/labs", "labs/") a la forma que espera Vite: "/labs/". */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

/**
 * Solo en `npm run dev` con Python encendido: sirve <base>pyodide/<versión>/ desde node_modules/pyodide
 * (núcleo), la caché del build (.cache/pyodide/, la llena un `LABS_PYTHON=1 npm run build`) y un lock
 * recortado, como hará dist/.
 */
function devPyodide(base: string): Plugin {
  const prefix = `${base}pyodide/${PYODIDE_VERSION}/`;
  const core = join("node_modules", "pyodide");
  const cache = process.env.PYODIDE_CACHE_DIR?.trim() || join(".cache", "pyodide", PYODIDE_VERSION);
  const types: Record<string, string> = { wasm: "application/wasm", js: "text/javascript", json: "application/json" };
  return {
    name: "ia-labs:dev-pyodide",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith(prefix)) return next();
        const file = url.slice(prefix.length);
        if (!/^[\w.+-]+$/.test(file)) return next();
        if (file === "pyodide-lock.json") {
          const lock = JSON.parse(readFileSync(join(core, file), "utf8")) as Lock;
          res.setHeader("Content-Type", types.json!);
          res.end(JSON.stringify(trimLock(lock, PYODIDE_PACKAGES.map((p) => p.name))));
          return;
        }
        const path = [join(core, file), join(cache, file)].find((p) => existsSync(p) && statSync(p).isFile());
        if (!path) return next();
        res.setHeader("Content-Type", types[file.split(".").pop() ?? ""] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = normalizeBase(env.VITE_BASE ?? process.env.VITE_BASE);
  // Pestaña Python (LABS_PYTHON o config.modules.python). Sin definir en las pruebas: así se prueban
  // las dos posiciones con la prop `python` de LabsRoutes.
  const python = pythonEnabled();
  return {
    base,
    plugins: [cspSafeRadix(), react(), tailwindcss(), ...(python ? [devPyodide(base)] : [])],
    define: process.env.VITEST ? {} : { __LABS_PYTHON__: JSON.stringify(python) },
    // Pyodide se sirve tal cual: el optimizador de dependencias de Vite no debe reempaquetarlo.
    optimizeDeps: { exclude: ["pyodide"] },
    // El worker de Python es un módulo ES (import() del runtime de Pyodide).
    worker: { format: "es" },
    // Sin data: URIs en el bundle (fuentes de KaTeX incluidas): la CSP solo permite 'self'.
    // manifest: lo lee scripts/check-python.ts (y lo borra después).
    build: { assetsInlineLimit: 0, manifest: true },
    test: {
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts", "content/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
      // Radix pasa por Vite también en las pruebas, para que usen el mismo bloqueo de scroll sin <style>.
      server: { deps: { inline: [/@radix-ui[\\/]/] } },
    },
  };
});
