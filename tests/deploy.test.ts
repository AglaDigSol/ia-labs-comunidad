// Configuración de despliegue: nginx, cabeceras, CSP estricta, noindex y Dockerfile. Con la pestaña
// Python, solo el worker recibe 'wasm-unsafe-eval' (su CSP es la de su propia respuesta).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const nginx = read("deploy/nginx.conf");
const headers = read("deploy/security-headers.conf");
const workerHeaders = read("deploy/security-headers-wasm.conf");
const htaccess = read("deploy/htaccess.example");
const cspOf = (conf: string) => /Content-Security-Policy "([^"]+)"/.exec(conf)![1]!;
const parse = (csp: string) => new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k!, v]));
const csp = cspOf(headers);
const directives = parse(csp);
const headerLines = (conf: string) => conf.split("\n").filter((l) => l.startsWith("add_header"));

describe("CSP", () => {
  it("solo mismo origen, sin inline ni eval en scripts", () => {
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(directives.get("style-src-elem")).toEqual(["'self'"]);
    expect(directives.get("style-src-attr")).toEqual(["'unsafe-inline'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-eval|https?:|data:|\*/);
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("el worker de Python lleva la misma CSP con 'wasm-unsafe-eval' en script-src y nada más", () => {
    const worker = parse(cspOf(workerHeaders));
    expect(worker.get("script-src")).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(worker.get("connect-src")).toEqual(["'self'"]);
    for (const [k, v] of directives) if (k !== "script-src") expect(worker.get(k)).toEqual(v);
    expect([...worker.keys()]).toEqual([...directives.keys()]);
    expect(cspOf(workerHeaders)).not.toMatch(/'unsafe-eval'|https?:|data:|\*/);
    // El resto de cabeceras, idénticas.
    const others = (conf: string) => headerLines(conf).filter((l) => !l.includes("Content-Security-Policy"));
    expect(others(workerHeaders)).toEqual(others(headers));
  });

  it("Apache manda la misma CSP del worker solo a py.worker-*.js", () => {
    const page = /Header always set Content-Security-Policy "([^"]+)"/.exec(htaccess)![1]!;
    expect(page).toBe(csp);
    const files = /<FilesMatch "\^py\\\.worker-[^"]+">\s*Header always set Content-Security-Policy "([^"]+)"/.exec(htaccess);
    expect(files?.[1]).toBe(cspOf(workerHeaders));
    expect(htaccess).toContain("AddType application/wasm .wasm");
  });

  it("index.html no tiene scripts ni estilos inline ni recursos externos", () => {
    const html = read("index.html");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style|style="/);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});

describe("cabeceras", () => {
  it("envía HSTS, nosniff, Referrer-Policy, Permissions-Policy y X-Robots-Tag; sin COEP", () => {
    expect(headers).toMatch(/Strict-Transport-Security "max-age=\d+/);
    expect(headers).toContain('X-Content-Type-Options "nosniff"');
    expect(headers).toMatch(/Referrer-Policy "(no-referrer|strict-origin-when-cross-origin)"/);
    expect(headers).toContain("Permissions-Policy");
    expect(headers).toContain('X-Robots-Tag "noindex, nofollow"');
    expect(headers + nginx).not.toMatch(/Cross-Origin-Embedder-Policy/);
  });

  it("cada location incluye las cabeceras de seguridad; la del worker, las suyas", () => {
    const blocks = nginx.split(/\n\s*location /).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    for (const b of blocks) {
      const head = b.slice(0, b.indexOf("{"));
      const snippet = head.includes("py\\.worker-") ? "security-headers-wasm.conf" : "security-headers.conf";
      expect(b.slice(0, b.indexOf("}"))).toContain(`include /etc/nginx/snippets/${snippet};`);
    }
  });
});

describe("nginx", () => {
  it("fallback SPA, caché inmutable en /assets y .ics como text/calendar con caché de 1 h", () => {
    expect(nginx).toContain("try_files $uri $uri/ /index.html;");
    expect(nginx).toMatch(/location \/assets\/ \{[^}]*immutable/);
    const ics = nginx.slice(nginx.indexOf("\\.ics$"), nginx.indexOf("location = /calendario.json"));
    expect(ics).toContain('default_type "text/calendar; charset=utf-8";');
    expect(ics).toContain("max-age=3600");
  });

  it("Python: worker con su CSP, /pyodide/ con application/wasm, caché inmutable y gzip del wasm", () => {
    expect(nginx).toMatch(/location ~ \^\/assets\/py\\\.worker-\[A-Za-z0-9_-\]\+\\\.js\$ \{\s*include \/etc\/nginx\/snippets\/security-headers-wasm\.conf;/);
    const py = nginx.slice(nginx.indexOf("location /pyodide/"), nginx.indexOf("location /assets/"));
    expect(py).toContain("application/wasm wasm;");
    expect(py).toContain("immutable");
    expect(py).toContain("try_files $uri =404;");
    expect(nginx).toMatch(/gzip_types [^;]*application\/wasm/);
  });

  it("robots.txt bloquea todo", () => {
    expect(read("public/robots.txt")).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("Dockerfile", () => {
  it("multi-stage: build con node y nginx:alpine sirviendo dist", () => {
    const df = read("Dockerfile");
    expect(df).toMatch(/FROM node:[^\s]+ AS build/);
    expect(df).toMatch(/FROM nginx:[^\s]*alpine/);
    expect(df).toContain("npm ci --ignore-scripts");
    expect(df).toContain("COPY --from=build /app/dist /usr/share/nginx/html");
    expect(df).toContain("ARG CALENDAR_ICS_URL");
    expect(df).toContain("ARG LABS_PYTHON=");
    expect(df).toContain('LABS_PYTHON="$LABS_PYTHON"');
    expect(df).toContain("ARG VITE_GUIDES_URL=");
    expect(df).toContain('VITE_GUIDES_URL="$VITE_GUIDES_URL" npm run build');
    expect(df).toContain("COPY deploy/security-headers-wasm.conf /etc/nginx/snippets/security-headers-wasm.conf");
  });
});
