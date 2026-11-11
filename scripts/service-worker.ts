// Service worker de la app independiente: un plugin de Vite que, al construir, escribe dist/sw.js a
// partir de scripts/sw-template.js con la versión del build y la lista de archivos que precarga (la
// app: index.html, los chunks, los estilos, las fuentes woff2, el manifiesto y los iconos). Sin
// dependencias. Pyodide (dist/pyodide/) no se precarga: el service worker lo guarda al usarlo.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

export const SW_FILE = "sw.js";
const TEMPLATE = new URL("./sw-template.js", import.meta.url);
const PLACEHOLDER = "self.__SW_BUILD__";

/**
 * Lo que se precarga de los archivos del build (rutas relativas a dist/). Fuera: los mapas, el
 * manifiesto de Vite, el worker de Python y los chunks de Pyodide (se guardan al usarlos), las fuentes
 * que no son woff2 (los navegadores que lo admiten piden la woff2), los calendarios y robots.txt.
 */
export function precacheList(files: readonly string[]): string[] {
  const keep = (f: string) =>
    !f.endsWith(".map") &&
    !f.startsWith(".vite/") &&
    !f.startsWith("pyodide/") &&
    !/(^|\/)py\.worker-[\w-]+\.js$/.test(f) &&
    !/(^|\/)pyodide[\w.-]*\.(m?js|wasm|zip|json)$/i.test(f) &&
    !/\.(woff|ttf|eot)$/.test(f) &&
    !/^calendario[\w-]*\.(ics|json)$/.test(f) &&
    f !== "robots.txt" &&
    f !== SW_FILE;
  return [...new Set(files.filter(keep))].sort();
}

/** Versión del service worker: cambia si cambia cualquier archivo precargado (los nombres llevan hash) o index.html. */
export function swVersion(precache: readonly string[], salt: string): string {
  return createHash("sha256").update(precache.join("\n")).update("\0").update(salt).digest("hex").slice(0, 16);
}

/** El código de dist/sw.js para esa lista. */
export function swSource(precache: readonly string[], salt: string, template: string = readFileSync(TEMPLATE, "utf8")): string {
  if (template.split(PLACEHOLDER).length !== 2) throw new Error(`${TEMPLATE.pathname}: ${PLACEHOLDER} tiene que aparecer una vez`);
  const build = JSON.stringify({ version: swVersion(precache, salt), precache });
  return template.replace(PLACEHOLDER, build);
}

function publicFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  try {
    walk(dir);
  } catch {
    // sin public/
  }
  return out;
}

/** Plugin de Vite (solo en el build): emite sw.js. */
export function serviceWorker(): Plugin {
  let publicDir = "";
  return {
    name: "ia-labs:service-worker",
    apply: "build",
    // Después de vite:build-html, para que index.html ya esté en el bundle.
    enforce: "post",
    configResolved(config) {
      publicDir = typeof config.publicDir === "string" ? config.publicDir : "";
    },
    generateBundle(_options, bundle) {
      const files = ["index.html", ...Object.keys(bundle), ...(publicDir ? publicFiles(publicDir) : [])];
      const precache = precacheList(files);
      const index = bundle["index.html"];
      const salt = index && index.type === "asset" ? String(index.source) : "";
      this.emitFile({ type: "asset", fileName: SW_FILE, source: swSource(precache, salt) });
    },
  };
}
