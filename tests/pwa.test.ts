// Instalable y sin conexión: manifiesto (.json, el que deja pasar la pasarela), iconos que no son
// blancos ni crema, service worker escrito a mano y su despliegue sin tocar la CSP.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { precacheList, SW_FILE, swSource, swVersion } from "../scripts/service-worker.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const bytes = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));
const manifest = JSON.parse(read("public/manifest.json")) as {
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  id: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

/** Luminancia relativa (WCAG) de un color #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe("manifiesto", () => {
  it("es public/manifest.json (no .webmanifest), en español y relativo a la base del sitio", () => {
    expect(manifest.name).toBe("IA Labs · Comunidad");
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.lang).toBe("es");
    // Relativos al manifiesto: funcionan con cualquier VITE_BASE.
    expect([manifest.start_url, manifest.scope, manifest.id]).toEqual(["./", "./", "./"]);
    expect(manifest.display).toBe("standalone");
    const html = read("index.html");
    expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.json" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%icons/apple-touch-icon.png" />');
  });

  it("colores e iconos oscuros, con el acento: nada blanco ni crema", () => {
    for (const c of [manifest.background_color, manifest.theme_color]) expect(luminance(c)).toBeLessThan(0.1);
    for (const svg of ["public/icons/icon.svg", "public/icons/icon-maskable.svg"]) {
      const fills = [...read(svg).matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]!);
      expect(fills[0]).toBe("#0e1320");
      // Ningún relleno claro de fondo: ni blanco (#fff) ni crema.
      expect(read(svg)).not.toMatch(/#fff\b|#ffffff|white|#f[0-9a-f]{5}/i);
    }
  });

  it("iconos PNG de 192 y 512 (y uno maskable), con su tamaño real, y el de iOS de 180", () => {
    const size = (p: string) => {
      const b = bytes(p);
      expect(b.subarray(1, 4).toString()).toBe("PNG");
      return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    };
    for (const icon of manifest.icons) {
      if (icon.type === "image/png") expect(size(`public/${icon.src}`)).toBe(icon.sizes);
      else expect(read(`public/${icon.src}`)).toContain("<svg");
    }
    expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
    expect(size("public/icons/apple-touch-icon.png")).toBe("180x180");
  });
});

describe("service worker", () => {
  const files = [
    "index.html",
    "assets/index-abc123.js",
    "assets/index-abc123.css",
    "assets/LogicLabPage-x1.js",
    "assets/py.worker-Zz_9.js",
    "assets/KaTeX_Main-Regular-1.woff2",
    "assets/KaTeX_Main-Regular-1.woff",
    "assets/KaTeX_Main-Regular-1.ttf",
    "assets/index-abc123.js.map",
    ".vite/manifest.json",
    "pyodide/0.27.7/pyodide.asm.wasm",
    "calendario.ics",
    "calendario-02MIAR.ics",
    "calendario.json",
    "robots.txt",
    "theme-init.js",
    "favicon.svg",
    "manifest.json",
    "icons/icon-192.png",
    "sw.js",
  ];

  it("precarga la app (y las woff2), no Pyodide, el worker de Python, los mapas ni los calendarios", () => {
    expect(precacheList(files)).toEqual([
      "assets/KaTeX_Main-Regular-1.woff2",
      "assets/LogicLabPage-x1.js",
      "assets/index-abc123.css",
      "assets/index-abc123.js",
      "favicon.svg",
      "icons/icon-192.png",
      "index.html",
      "manifest.json",
      "theme-init.js",
    ]);
  });

  it("la versión cambia con la lista o con index.html, y el código no trae nada de fuera", () => {
    const list = precacheList(files);
    expect(swVersion(list, "a")).toBe(swVersion(list, "a"));
    expect(swVersion(list, "a")).not.toBe(swVersion(list, "b"));
    expect(swVersion(list.slice(1), "a")).not.toBe(swVersion(list, "a"));
    const src = swSource(list, "a");
    expect(src).not.toContain("self.__SW_BUILD__");
    expect(src).toContain(`"version":"${swVersion(list, "a")}"`);
    expect(src).toContain('"assets/index-abc123.js"');
    // Sin importScripts ni direcciones externas: todo del mismo origen (CSP 'self').
    expect(src).not.toMatch(/importScripts|https?:\/\/|eval\(|new Function/);
    // Todo relativo a sw.js: respeta VITE_BASE.
    expect(src).toContain('new URL("./", self.location.href)');
    expect(SW_FILE).toBe("sw.js");
  });

  it("solo intercepta GET del mismo origen y del alcance; Pyodide se guarda al usarlo", () => {
    const src = read("scripts/sw-template.js");
    expect(src).toContain('request.method !== "GET"');
    expect(src).toContain("url.origin !== SCOPE.origin");
    expect(src).toMatch(/inScope\(url, "pyodide\/"\)\) \{\s*event\.respondWith\(cacheFirst\(request, PYODIDE\)\)/);
  });
});

describe("despliegue", () => {
  it("nginx sirve sw.js sin caché y con las cabeceras de seguridad; la CSP ya permite el manifiesto y el worker", () => {
    const nginx = read("deploy/nginx.conf");
    const block = nginx.slice(nginx.indexOf("location = /sw.js"), nginx.indexOf("location = /manifest.json"));
    expect(block).toContain("include /etc/nginx/snippets/security-headers.conf;");
    expect(block).toContain('Cache-Control "no-cache"');
    const csp = /Content-Security-Policy "([^"]+)"/.exec(read("deploy/security-headers.conf"))![1]!;
    expect(csp).toContain("manifest-src 'self'");
    // El service worker cae en script-src 'self' (no hace falta worker-src).
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("worker-src");
  });

  it("Apache: sw.js sin caché, después de la regla inmutable de los .js", () => {
    const htaccess = read("deploy/htaccess.example");
    const js = htaccess.indexOf('<FilesMatch "\\.(js|css');
    const sw = htaccess.indexOf('<FilesMatch "^sw\\.js$">');
    expect(js).toBeGreaterThan(0);
    expect(sw).toBeGreaterThan(js);
    expect(htaccess.slice(sw, htaccess.indexOf("</FilesMatch>", sw))).toContain('Header set Cache-Control "no-cache"');
  });
});
